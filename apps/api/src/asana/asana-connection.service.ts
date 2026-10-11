import type { Db } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { InjectDatabase } from "../database/database.constants";
import type { MailboxResult } from "../mailbox/mailbox-api.client";
import { SyncStateService } from "../mailbox/sync-state.service";
import { AsanaClient } from "./asana.client";
import type {
	AsanaConnectionStatus,
	AsanaProjectsOutput,
	DisconnectAsanaOutput,
	PurgeAsanaDataOutput,
} from "./asana.contracts";
import { ASANA, ASANA_SOURCE } from "./asana-config";
import { AsanaCredentialsService } from "./asana-credentials.service";

const DAY_MS = 24 * 60 * 60 * 1_000;

const REFUSED = "Asana did not accept that token.";

@Injectable()
export class AsanaConnectionService {
	private readonly logger = new Logger(AsanaConnectionService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly client: AsanaClient,
		private readonly credentials: AsanaCredentialsService,
		private readonly state: SyncStateService,
		private readonly stamp: ActivityStampService,
	) {}

	async status(userId: string): Promise<AsanaConnectionStatus> {
		const [link, row, openTasks] = await Promise.all([
			this.credentials.linkOf(userId),
			this.state.get(userId, ASANA_SOURCE),
			this.db.activity.count({
				where: {
					createdById: userId,
					asanaTaskGid: { not: null },
					completedAt: null,
				},
			}),
		]);

		return {
			connected: link !== null,
			accountName: link?.accountName ?? null,
			project: link?.projectGid
				? { gid: link.projectGid, name: link.projectName }
				: null,
			status: row?.status ?? null,
			lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
			lastError: row?.lastError ?? null,
			openTasks,
			windowDays: {
				past: Math.round(ASANA.window.pastMs / DAY_MS),
				future: Math.round(ASANA.window.futureMs / DAY_MS),
			},
		};
	}

	async connect(userId: string, token: string): Promise<void> {
		const me = await this.client.me(token);

		if (me.outcome !== "ok") {
			throw new BadRequestException(reasonOf(me));
		}

		await this.credentials.saveToken(userId, {
			token,
			accountName: me.data.name ?? me.data.email ?? null,
		});

		this.logger.log({ message: "Asana connected", userId });
	}

	async projects(userId: string): Promise<AsanaProjectsOutput> {
		const token = await this.tokenFor(userId);
		const me = await this.client.me(token);

		if (me.outcome !== "ok") {
			throw new BadRequestException(reasonOf(me));
		}

		const projects: AsanaProjectsOutput["projects"] = [];
		const workspaces = me.data.workspaces.slice(0, ASANA.api.maxWorkspaces);
		let truncated = me.data.workspaces.length > workspaces.length;

		for (const workspace of workspaces) {
			let offset: string | undefined;

			for (let page = 0; page < ASANA.api.maxProjectPages; page += 1) {
				const result = await this.client.projects(token, workspace.gid, offset);

				if (result.outcome !== "ok") {
					throw new BadRequestException(reasonOf(result));
				}

				for (const project of result.data.data) {
					projects.push({
						gid: project.gid,
						name: project.name?.trim() || project.gid,
						workspace: workspace.name ?? null,
					});
				}

				offset = result.data.next_page ?? undefined;
				if (!offset) break;
			}

			if (offset) truncated = true;
		}

		projects.sort((a, b) => a.name.localeCompare(b.name));

		return { projects, truncated };
	}

	async chooseProject(userId: string, projectGid: string): Promise<void> {
		const token = await this.tokenFor(userId);
		const project = await this.client.project(token, projectGid);

		if (project.outcome !== "ok") {
			throw new BadRequestException(
				project.outcome === "cursor-invalid"
					? "Asana has no project with that id for this token."
					: reasonOf(project),
			);
		}

		await this.credentials.saveProject(userId, {
			gid: project.data.gid,
			name: project.data.name?.trim() || null,
		});

		await this.state.ensure(userId, ASANA_SOURCE, { autoCreate: false });

		this.logger.log({ message: "Asana project chosen", userId });
	}

	async disconnect(userId: string): Promise<DisconnectAsanaOutput> {
		await this.state.remove(userId, ASANA_SOURCE);
		const disconnected = await this.credentials.remove(userId);

		if (disconnected) {
			this.logger.log({ message: "Asana disconnected", userId });
		}

		return { disconnected };
	}

	async purgeSyncedData(userId: string): Promise<PurgeAsanaDataOutput> {
		const removed = await this.db.activity.deleteMany({
			where: { createdById: userId, asanaTaskGid: { not: null } },
		});

		await this.stamp.recomputeAll();

		this.logger.log({
			message: "Asana tasks purged",
			userId,
			purged: removed.count,
		});

		return { purged: removed.count };
	}

	private async tokenFor(userId: string): Promise<string> {
		const found = await this.credentials.forUser(userId);

		if (found.outcome === "not-connected") {
			throw new NotFoundException(found.reason);
		}

		if (found.outcome === "needs-reconnect") {
			throw new BadRequestException(found.reason);
		}

		return found.token;
	}
}

function reasonOf(result: Exclude<MailboxResult<unknown>, { outcome: "ok" }>) {
	if (result.outcome === "unauthorized") return REFUSED;
	if (result.outcome === "rate-limited") {
		return "Asana is rate limiting this token. Try again in a minute.";
	}

	return `Asana could not be read: ${result.reason}`;
}
