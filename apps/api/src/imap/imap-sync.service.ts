import {
	GoogleSyncStatus,
	type MailboxSyncModel as MailboxSync,
} from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import type { MatchContext } from "../mailbox/mailbox-match.service";
import { SyncStateService } from "../mailbox/sync-state.service";
import { ThreadWriterService } from "../mailbox/thread-writer.service";
import { ImapClient, type ImapSession } from "./imap.client";
import { IMAP, IMAP_SOURCE } from "./imap-config";
import { ImapCredentialsService } from "./imap-credentials.service";
import {
	emptyImapCursor,
	type ImapCursor,
	parseImapCursor,
} from "./imap-cursor";
import { toIncomingMessage } from "./imap-message";

export type ImapSyncOutcome = {
	source: typeof IMAP_SOURCE;
	userId: string;
	status: "synced" | "skipped" | "reconnect" | "failed";
	messagesWritten?: number;
	reason?: string;
};

type Progress = {
	written: number;
	seen: number;
	exhausted: boolean;
};

@Injectable()
export class ImapSyncService {
	private readonly logger = new Logger(ImapSyncService.name);

	constructor(
		private readonly client: ImapClient,
		private readonly credentials: ImapCredentialsService,
		private readonly state: SyncStateService,
		private readonly threads: ThreadWriterService,
	) {}

	async runOne(userId: string): Promise<ImapSyncOutcome | null> {
		const row = await this.state.get(userId, IMAP_SOURCE);
		if (!row) return null;

		return this.sync(row);
	}

	async sync(row: MailboxSync): Promise<ImapSyncOutcome> {
		const found = await this.credentials.forUser(row.userId);

		if (found.outcome === "not-connected") {
			return this.outcome(row, "skipped", { reason: found.reason });
		}

		if (found.outcome === "needs-reconnect") {
			await this.state.markNeedsReconnect(row.id, found.reason);
			return this.outcome(row, "reconnect", { reason: found.reason });
		}

		await this.state.markRunning(row.id);

		const opened = await this.client.connect(found.credentials);

		if (opened.outcome === "auth-failed") {
			await this.state.markNeedsReconnect(row.id, opened.reason);
			return this.outcome(row, "reconnect", { reason: opened.reason });
		}

		if (opened.outcome !== "ok") {
			await this.state.markFailed(row.id, opened.reason);
			return this.outcome(row, "failed", { reason: opened.reason });
		}

		const cursor = parseImapCursor(row.cursor) ?? emptyImapCursor();

		try {
			const progress = await this.read(
				opened.session,
				row,
				found.address,
				cursor,
			);

			cursor.importing = !progress.exhausted;

			await this.state.settle(row.id, {
				cursor: JSON.stringify(cursor),
				status: GoogleSyncStatus.IDLE,
			});

			return this.outcome(row, "synced", {
				messagesWritten: progress.written,
				reason: progress.exhausted
					? undefined
					: "Budget reached; continuing on the next check.",
			});
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);

			this.logger.error(
				{ message: "IMAP sync failed", userId: row.userId },
				error instanceof Error ? error.stack : String(error),
			);

			await this.state.markFailed(row.id, reason);
			return this.outcome(row, "failed", { reason });
		} finally {
			await opened.session.close();
		}
	}

	private async read(
		session: ImapSession,
		row: MailboxSync,
		mailbox: string,
		cursor: ImapCursor,
	): Promise<Progress> {
		const startedAt = Date.now();
		const since = new Date(startedAt - IMAP.backfill.windowMs);
		const progress: Progress = { written: 0, seen: 0, exhausted: true };

		let context: MatchContext | null = null;

		for (const folder of await session.folders()) {
			const state = await session.open(folder.path);
			const known = cursor.folders[folder.path];

			const position =
				known && known.uidValidity === state.uidValidity
					? known
					: {
							uidValidity: state.uidValidity,
							lastUid:
								((await session.firstUidSince(since)) ?? state.uidNext) - 1,
						};

			cursor.folders[folder.path] = position;

			const room = IMAP.tick.maxMessages - progress.seen;
			if (room <= 0) {
				progress.exhausted = false;
				continue;
			}

			const messages = await session.listAfter(position.lastUid, room + 1);

			for (const message of messages) {
				const outOfRoom = progress.seen >= IMAP.tick.maxMessages;
				const outOfTime = Date.now() - startedAt > IMAP.tick.budgetMs;

				if (outOfRoom || outOfTime) {
					progress.exhausted = false;
					break;
				}

				progress.seen += 1;

				const body = await session.bodyOf(message);
				const parsed = toIncomingMessage(message, folder, body);

				if (parsed) {
					context ??= await this.threads.context();

					const stored = await this.threads.store(
						row,
						{ mailbox, origin: IMAP_SOURCE },
						parsed,
						context,
					);

					if (stored) progress.written += 1;
				}

				position.lastUid = message.uid;
			}
		}

		return progress;
	}

	private outcome(
		row: MailboxSync,
		status: ImapSyncOutcome["status"],
		detail: { messagesWritten?: number; reason?: string } = {},
	): ImapSyncOutcome {
		return { source: IMAP_SOURCE, userId: row.userId, status, ...detail };
	}
}
