import {
	ActivityType,
	type Db,
	GoogleSyncStatus,
	type MailboxSyncModel as MailboxSync,
} from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { InjectDatabase } from "../database/database.constants";
import { SyncStateService } from "../mailbox/sync-state.service";
import { AsanaClient, type AsanaTask } from "./asana.client";
import { AsanaAssigneesService } from "./asana-assignees.service";
import { ASANA, ASANA_SOURCE } from "./asana-config";
import { AsanaCredentialsService } from "./asana-credentials.service";
import { type AgendaTask, isInWindow, toAgendaTask } from "./asana-task";

export type AsanaSyncOutcome = {
	source: typeof ASANA_SOURCE;
	userId: string;
	status: "synced" | "skipped" | "reconnect" | "rate-limited" | "failed";
	tasksWritten?: number;
	tasksClosed?: number;
	reason?: string;
};

type TaskOwner = { syncedById: string; ownerId: string; reassign: boolean };

type OpenTasks =
	| { outcome: "ok"; tasks: AsanaTask[]; complete: boolean }
	| { outcome: "stopped"; result: AsanaSyncOutcome };

@Injectable()
export class AsanaSyncService {
	private readonly logger = new Logger(AsanaSyncService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly client: AsanaClient,
		private readonly credentials: AsanaCredentialsService,
		private readonly state: SyncStateService,
		private readonly stamp: ActivityStampService,
		private readonly assignees: AsanaAssigneesService,
	) {}

	async runOne(userId: string): Promise<AsanaSyncOutcome | null> {
		const row = await this.state.get(userId, ASANA_SOURCE);
		if (!row) return null;

		return this.sync(row);
	}

	async sync(row: MailboxSync): Promise<AsanaSyncOutcome> {
		const found = await this.credentials.forUser(row.userId);

		if (found.outcome === "not-connected") {
			return this.outcome(row, "skipped", { reason: found.reason });
		}

		if (found.outcome === "needs-reconnect") {
			await this.state.markNeedsReconnect(row.id, found.reason);
			return this.outcome(row, "reconnect", { reason: found.reason });
		}

		const { id: connectionId, projectGid, projectName, shared } = found.link;

		if (!projectGid) {
			return this.outcome(row, "skipped", {
				reason: "No Asana project is chosen.",
			});
		}

		await this.state.markRunning(row.id);

		const open = await this.openTasks(row, found.token, projectGid);
		if (open.outcome === "stopped") return open.result;

		const now = new Date();

		const [existing, owners] = await Promise.all([
			this.db.activity.findMany({
				where: { asanaSyncedById: row.userId, asanaTaskGid: { not: null } },
				select: { id: true, asanaTaskGid: true, completedAt: true },
			}),
			shared ? this.assignees.resolve(connectionId, open.tasks) : null,
		]);

		const tracked = new Set(existing.map((activity) => activity.asanaTaskGid));
		const stillOpen = new Set<string>();

		let written = 0;

		for (const raw of open.tasks) {
			stillOpen.add(raw.gid);

			const task = toAgendaTask(raw);
			if (!task) continue;

			const known = tracked.has(task.gid);
			if (!known && !isInWindow(task.dueAt, now)) continue;

			const assigned = task.assigneeGid
				? owners?.get(task.assigneeGid)
				: undefined;

			await this.write(
				{
					syncedById: row.userId,
					ownerId: assigned ?? row.userId,
					reassign: shared,
				},
				task,
				projectName,
				known,
				now,
			);
			written += 1;
		}

		const closed = open.complete
			? await this.close(
					existing
						.filter(
							(activity) =>
								activity.completedAt === null &&
								activity.asanaTaskGid !== null &&
								!stillOpen.has(activity.asanaTaskGid),
						)
						.map((activity) => activity.id),
					now,
				)
			: 0;

		await this.state.settle(row.id, { status: GoogleSyncStatus.IDLE });

		this.logger.log({
			message: "Asana agenda synced",
			userId: row.userId,
			shared,
			written,
			closed,
		});

		return this.outcome(row, "synced", {
			tasksWritten: written,
			tasksClosed: closed,
		});
	}

	private async openTasks(
		row: MailboxSync,
		token: string,
		projectGid: string,
	): Promise<OpenTasks> {
		const tasks: AsanaTask[] = [];
		let offset: string | undefined;

		for (let page = 0; page < ASANA.api.maxTaskPages; page += 1) {
			const result = await this.client.openTasks(token, projectGid, offset);

			if (result.outcome === "unauthorized") {
				const reason = "O Asana não aceita mais o token salvo.";
				await this.state.markNeedsReconnect(row.id, reason);
				return this.stopped(row, "reconnect", reason);
			}

			if (result.outcome === "rate-limited") {
				await this.state.markRateLimited(row.id, result.retryAfterMs);
				return this.stopped(row, "rate-limited", result.reason);
			}

			if (result.outcome === "cursor-invalid") {
				const reason = "O projeto escolhido no Asana não foi mais encontrado.";
				await this.state.markFailed(row.id, reason);
				return this.stopped(row, "failed", reason);
			}

			if (result.outcome === "failed") {
				await this.state.markFailed(row.id, result.reason);
				return this.stopped(row, "failed", result.reason);
			}

			tasks.push(...result.data.data);

			if (!result.data.next_page) {
				return { outcome: "ok", tasks, complete: true };
			}

			offset = result.data.next_page;
		}

		return { outcome: "ok", tasks, complete: false };
	}

	private async write(
		owner: TaskOwner,
		task: AgendaTask,
		projectName: string | null,
		known: boolean,
		now: Date,
	): Promise<void> {
		const link = known ? null : await this.contactFor(task.addresses);

		const meta = {
			synced: true,
			source: ASANA_SOURCE,
			url: task.url,
			project: projectName,
		};

		const activity = await this.db.activity.upsert({
			where: { asanaTaskGid: task.gid },
			create: {
				type: ActivityType.TASK,
				subject: task.subject,
				body: task.body,
				dueAt: task.dueAt,
				occurredAt: task.createdAt ?? now,
				createdById: owner.ownerId,
				asanaTaskGid: task.gid,
				asanaSyncedById: owner.syncedById,
				contactId: link?.id ?? null,
				companyId: link?.companyId ?? null,
				meta,
			},
			update: {
				subject: task.subject,
				body: task.body,
				dueAt: task.dueAt,
				asanaSyncedById: owner.syncedById,
				createdById: owner.reassign ? owner.ownerId : undefined,
				meta,
			},
			select: { createdAt: true, companyId: true, contactId: true },
		});

		if (known || (!activity.companyId && !activity.contactId)) return;

		await this.stamp.touch(
			{ companyId: activity.companyId, contactId: activity.contactId },
			activity.createdAt,
		);
	}

	private async contactFor(
		addresses: string[],
	): Promise<{ id: string; companyId: string | null } | null> {
		if (addresses.length === 0) return null;

		return this.db.contact.findFirst({
			where: { email: { in: addresses }, archivedAt: null },
			select: { id: true, companyId: true },
		});
	}

	private async close(ids: string[], now: Date): Promise<number> {
		if (ids.length === 0) return 0;

		const closed = await this.db.activity.updateMany({
			where: { id: { in: ids }, completedAt: null },
			data: { completedAt: now },
		});

		return closed.count;
	}

	private stopped(
		row: MailboxSync,
		status: AsanaSyncOutcome["status"],
		reason: string,
	): OpenTasks {
		return {
			outcome: "stopped",
			result: this.outcome(row, status, { reason }),
		};
	}

	private outcome(
		row: MailboxSync,
		status: AsanaSyncOutcome["status"],
		detail: {
			tasksWritten?: number;
			tasksClosed?: number;
			reason?: string;
		} = {},
	): AsanaSyncOutcome {
		return { source: ASANA_SOURCE, userId: row.userId, status, ...detail };
	}
}
