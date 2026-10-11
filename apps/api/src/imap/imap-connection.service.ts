import type { Db, Prisma } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { InjectDatabase } from "../database/database.constants";
import { SyncStateService } from "../mailbox/sync-state.service";
import { rebuildThreads } from "../mailbox/thread-rebuild";
import { ImapClient } from "./imap.client";
import type {
	ConnectImapInput,
	DisconnectImapOutput,
	ImapConnectionStatus,
	PurgeImapDataOutput,
} from "./imap.contracts";
import { IMAP, IMAP_SOURCE } from "./imap-config";
import { ImapCredentialsService } from "./imap-credentials.service";
import { isImporting } from "./imap-cursor";

const DAY_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class ImapConnectionService {
	private readonly logger = new Logger(ImapConnectionService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly client: ImapClient,
		private readonly credentials: ImapCredentialsService,
		private readonly state: SyncStateService,
		private readonly stamp: ActivityStampService,
	) {}

	async status(userId: string): Promise<ImapConnectionStatus> {
		const server = this.credentials.server();

		const [address, row] = await Promise.all([
			this.credentials.addressOf(userId),
			this.state.get(userId, IMAP_SOURCE),
		]);

		const connected = server !== null && address !== null && row !== null;

		return {
			configured: server !== null,
			host: server?.host ?? null,
			connected,
			address,
			status: row?.status ?? null,
			lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
			lastError: row?.lastError ?? null,
			autoCreate: row?.autoCreate ?? false,
			importing: connected && isImporting(row?.cursor ?? null),
			historyDays: Math.round(IMAP.backfill.windowMs / DAY_MS),
		};
	}

	async connect(userId: string, input: ConnectImapInput): Promise<void> {
		const server = this.credentials.server();

		if (!server) {
			throw new ServiceUnavailableException(
				"IMAP is not configured on this install.",
			);
		}

		const username = input.username || input.address;

		const verified = await this.client.verify({
			...server,
			username,
			password: input.password,
		});

		if (verified.outcome !== "ok") {
			throw new BadRequestException(verified.reason);
		}

		const previous = await this.credentials.addressOf(userId);

		await this.credentials.save(userId, {
			address: input.address,
			username,
			password: input.password,
		});

		const row = await this.state.ensure(userId, IMAP_SOURCE, {
			autoCreate: input.autoCreate,
		});

		await this.state.setAutoCreate(userId, IMAP_SOURCE, input.autoCreate);

		if (previous !== null && previous !== input.address) {
			await this.state.clearCursor(
				row.id,
				"A different mailbox was connected.",
			);
		}

		this.logger.log({ message: "IMAP mailbox connected", userId });
	}

	async disconnect(userId: string): Promise<DisconnectImapOutput> {
		await this.state.remove(userId, IMAP_SOURCE);
		const disconnected = await this.credentials.remove(userId);

		if (disconnected) {
			this.logger.log({ message: "IMAP mailbox disconnected", userId });
		}

		return { disconnected };
	}

	async setAutoCreate(userId: string, enabled: boolean): Promise<void> {
		await this.requireRow(userId);
		await this.state.setAutoCreate(userId, IMAP_SOURCE, enabled);
	}

	async reimport(userId: string): Promise<void> {
		const row = await this.requireRow(userId);
		await this.state.clearCursor(row.id, "A history import was requested.");
	}

	async purgeSyncedData(userId: string): Promise<PurgeImapDataOutput> {
		const mine: Prisma.EmailMessageWhereInput = {
			syncedByUserId: userId,
			imapMessageRef: { not: null },
		};

		const purged = await this.db.$transaction(
			async (tx) => {
				const touched = await tx.emailMessage.findMany({
					where: mine,
					select: { threadId: true },
					distinct: ["threadId"],
				});

				const threadIds = touched.map((row) => row.threadId);
				const messages = await tx.emailMessage.deleteMany({ where: mine });

				await tx.emailThread.deleteMany({
					where: { id: { in: threadIds }, messages: { none: {} } },
				});

				await rebuildThreads(tx, threadIds);

				return messages.count;
			},
			{ timeout: IMAP.purge.timeoutMs },
		);

		await this.stamp.recomputeAll();

		this.logger.log({ message: "IMAP data purged", userId, purged });

		return { purged };
	}

	private async requireRow(userId: string) {
		const row = await this.state.get(userId, IMAP_SOURCE);

		if (!row) {
			throw new NotFoundException("No mailbox is connected.");
		}

		return row;
	}
}
