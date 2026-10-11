import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { db, GoogleSyncStatus } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { CompanyDirectoryService } from "../src/companies/company-directory.service";
import type { EnvironmentVariables } from "../src/config/env.validation";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { EnrichmentLogService } from "../src/crm/enrichment-log.service";
import type {
	ImapClient,
	ImapConnectResult,
	ImapCredentials,
	ImapFolder,
	ImapFolderState,
	ImapMessage,
	ImapSession,
} from "../src/imap/imap.client";
import { IMAP } from "../src/imap/imap-config";
import { ImapConnectionService } from "../src/imap/imap-connection.service";
import { ImapCredentialsService } from "../src/imap/imap-credentials.service";
import { parseImapCursor } from "../src/imap/imap-cursor";
import { ImapSyncService } from "../src/imap/imap-sync.service";
import { CredentialVaultService } from "../src/mailbox/credential-vault.service";
import { MailboxMatchService } from "../src/mailbox/mailbox-match.service";
import { SyncStateService } from "../src/mailbox/sync-state.service";
import { ThreadWriterService } from "../src/mailbox/thread-writer.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "imap-sync-spec";
const domain = `imap-${suffix}.test`;
const noise = `noise-${suffix}.test`;
const userId = `user-${suffix}`;
const mailbox = `rep-${suffix}@example.test`;
const buyer = `buyer@${domain}`;
const password = "the-mailbox-password";

const DAY_MS = 24 * 60 * 60 * 1_000;
const ago = (days: number) => new Date(Date.now() - days * DAY_MS);

const id = (name: string) => `<${name}-${suffix}@mail.test>`;
const stored = (name: string) => `${name}-${suffix}@mail.test`;

type Stocked = ImapMessage & { body: string; receivedAt: Date };

type Box = { uidValidity: string; messages: Stocked[] };

type Boxes = { Sent: Box; INBOX: Box };

const EMPTY_BOXES: Boxes = {
	Sent: { uidValidity: "0", messages: [] },
	INBOX: { uidValidity: "0", messages: [] },
};

function letter(
	uid: number,
	name: string,
	from: string,
	to: string,
	receivedAt: Date,
	thread: { inReplyTo?: string; references?: string } = {},
): Stocked {
	return {
		uid,
		messageId: id(name),
		inReplyTo: thread.inReplyTo ?? null,
		references: thread.references ?? null,
		subject: "Pricing",
		from: { email: from, name: null },
		to: [{ email: to, name: null }],
		cc: [],
		sentAt: receivedAt,
		textPart: { part: "1", html: false },
		body: `Body of ${name}.`,
		receivedAt,
	};
}

class FakeServer implements ImapSession {
	boxes: Boxes = EMPTY_BOXES;
	failure: ImapConnectResult | null = null;
	bodiesRead: number[] = [];
	seenCredentials: ImapCredentials[] = [];
	closed = 0;
	private current: Box | null = null;

	async folders(): Promise<ImapFolder[]> {
		return [
			{ path: "Sent", role: "sent" },
			{ path: "INBOX", role: "inbox" },
		];
	}

	async open(path: string): Promise<ImapFolderState> {
		const box =
			path === "Sent"
				? this.boxes.Sent
				: path === "INBOX"
					? this.boxes.INBOX
					: null;
		if (!box) throw new Error(`No folder ${path}.`);

		this.current = box;

		const highest = box.messages.reduce(
			(top, message) => Math.max(top, message.uid),
			0,
		);

		return { uidValidity: box.uidValidity, uidNext: highest + 1 };
	}

	async firstUidSince(since: Date): Promise<number | null> {
		const inWindow = (this.current?.messages ?? [])
			.filter((message) => message.receivedAt >= since)
			.map((message) => message.uid);

		return inWindow.length > 0 ? Math.min(...inWindow) : null;
	}

	async listAfter(lastUid: number, limit: number): Promise<ImapMessage[]> {
		return (this.current?.messages ?? [])
			.filter((message) => message.uid > lastUid)
			.sort((a, b) => a.uid - b.uid)
			.slice(0, limit);
	}

	async bodyOf(message: ImapMessage): Promise<string> {
		this.bodiesRead.push(message.uid);
		return (message as Stocked).body;
	}

	async close(): Promise<void> {
		this.closed += 1;
	}
}

const agent = {
	contactCreated: async () => true,
	companyCreated: async () => undefined,
	withCrmEvents: withDiscardedCrmEvents,
	companyRequested: async () => true,
} as unknown as AgentTriggerService;

function config(values: Record<string, string | undefined>) {
	return {
		get: (key: string) => values[key],
	} as unknown as ConfigService<EnvironmentVariables, true>;
}

const settings = config({
	BETTER_AUTH_SECRET: "imap-spec-secret-imap-spec-secret-imap",
	IMAP_HOST: "imap.mail.test",
});

const stamp = new ActivityStampService(db);
const directory = new CompanyDirectoryService(agent);
const log = new EnrichmentLogService(db, stamp);
const match = new MailboxMatchService(db, directory, agent, log);
const threads = new ThreadWriterService(db, match, stamp);
const state = new SyncStateService(db);
const vault = new CredentialVaultService(settings);
const credentials = new ImapCredentialsService(db, vault, settings);

let server: FakeServer;

const client = {
	connect: async (given: ImapCredentials): Promise<ImapConnectResult> => {
		server.seenCredentials.push(given);
		return server.failure ?? { outcome: "ok", session: server };
	},
	verify: async (given: ImapCredentials) => {
		server.seenCredentials.push(given);
		if (server.failure && server.failure.outcome !== "ok")
			return server.failure;
		return { outcome: "ok" as const };
	},
} as unknown as ImapClient;

const sync = new ImapSyncService(client, credentials, state, threads);
const connection = new ImapConnectionService(
	db,
	client,
	credentials,
	state,
	stamp,
);

async function clean() {
	await db.emailThread.deleteMany({
		where: { rootMessageId: { endsWith: `-${suffix}@mail.test` } },
	});
	await db.contact.deleteMany({
		where: { OR: [{ email: buyer }, { email: { endsWith: `@${noise}` } }] },
	});
	await db.company.deleteMany({ where: { domain: { in: [domain, noise] } } });
	await db.mailboxSync.deleteMany({ where: { userId } });
	await db.imapConnection.deleteMany({ where: { userId } });
	await db.user.deleteMany({ where: { id: userId } });
}

function conversation(): Boxes {
	return {
		Sent: {
			uidValidity: "1",
			messages: [
				letter(5, "reply", mailbox, buyer, ago(2), {
					inReplyTo: id("first"),
					references: id("first"),
				}),
			],
		},
		INBOX: {
			uidValidity: "1",
			messages: [
				letter(1, "ancient", buyer, mailbox, ago(40)),
				letter(2, "first", buyer, mailbox, ago(3)),
				letter(3, "stranger", `someone@${noise}`, mailbox, ago(1)),
				letter(4, "followup", buyer, mailbox, ago(0), {
					inReplyTo: id("reply"),
					references: `${id("first")} ${id("reply")}`,
				}),
			],
		},
	};
}

async function storedIds(): Promise<string[]> {
	const rows = await db.emailMessage.findMany({
		where: { rfcMessageId: { endsWith: `-${suffix}@mail.test` } },
		select: { rfcMessageId: true },
		orderBy: { sentAt: "asc" },
	});

	return rows.map((row) => row.rfcMessageId);
}

async function row() {
	const found = await state.get(userId, "imap");
	if (!found) throw new Error("The imap sync row is missing.");
	return found;
}

beforeAll(async () => {
	await clean();
	await db.user.create({
		data: { id: userId, name: "Test Rep", email: mailbox },
	});
});

afterAll(clean);

beforeEach(() => {
	server = new FakeServer();
	server.boxes = conversation();
});

describe("connecting a mailbox by IMAP", () => {
	it("refuses a password the mail server refuses, and saves nothing", async () => {
		server.failure = {
			outcome: "auth-failed",
			reason: "The mail server refused that address and password.",
		};

		await expect(
			connection.connect(userId, {
				address: mailbox,
				password: "wrong",
				autoCreate: true,
			}),
		).rejects.toBeInstanceOf(BadRequestException);

		expect(await db.imapConnection.count({ where: { userId } })).toBe(0);
		expect(await state.get(userId, "imap")).toBeNull();
	});

	it("checks the password against the configured server and seals it", async () => {
		await connection.connect(userId, {
			address: mailbox,
			password,
			autoCreate: true,
		});

		expect(server.seenCredentials.at(-1)).toEqual({
			host: "imap.mail.test",
			port: IMAP.server.defaultPort,
			username: mailbox,
			password,
		});

		const saved = await db.imapConnection.findUniqueOrThrow({
			where: { userId },
		});

		expect(saved.secret).not.toContain(password);
		expect(vault.open(saved.secret)).toBe(password);

		const status = await connection.status(userId);

		expect(status).toMatchObject({
			configured: true,
			connected: true,
			address: mailbox,
			autoCreate: true,
			importing: true,
			historyDays: 30,
		});
	});
});

describe("reading a mailbox by IMAP", () => {
	it("imports the window, sent mail first, and stores only CRM conversations", async () => {
		const outcome = await sync.sync(await row());

		expect(outcome.status).toBe("synced");
		expect(outcome.messagesWritten).toBe(3);

		expect(await storedIds()).toEqual([
			stored("first"),
			stored("reply"),
			stored("followup"),
		]);

		expect(server.bodiesRead).toEqual([5, 2, 3, 4]);
		expect(server.closed).toBe(1);

		const contact = await db.contact.findFirst({ where: { email: buyer } });
		expect(contact).not.toBeNull();

		const messages = await db.emailMessage.findMany({
			where: { rfcMessageId: stored("reply") },
			select: { direction: true, imapMessageRef: true, syncedByUserId: true },
		});

		expect(messages).toEqual([
			{
				direction: "OUTBOUND",
				imapMessageRef: "Sent:5",
				syncedByUserId: userId,
			},
		]);

		const after = await row();

		expect(after.status).toBe(GoogleSyncStatus.IDLE);
		expect(after.lastSyncedAt).not.toBeNull();
		expect(parseImapCursor(after.cursor)).toEqual({
			version: 1,
			importing: false,
			folders: {
				Sent: { uidValidity: "1", lastUid: 5 },
				INBOX: { uidValidity: "1", lastUid: 4 },
			},
		});

		expect((await connection.status(userId)).importing).toBe(false);
	});

	it("reads only what arrived since the last check", async () => {
		server.boxes.INBOX.messages.push(
			letter(6, "later", buyer, mailbox, ago(0), {
				references: id("first"),
			}),
		);

		const outcome = await sync.sync(await row());

		expect(outcome.messagesWritten).toBe(1);
		expect(server.bodiesRead).toEqual([6]);
		expect(await storedIds()).toContain(stored("later"));
	});

	it("starts the folder again when the server renumbers it, without duplicates", async () => {
		server.boxes.INBOX.uidValidity = "2";

		const before = await storedIds();
		const outcome = await sync.sync(await row());

		expect(outcome.status).toBe("synced");
		expect(outcome.messagesWritten).toBe(0);
		expect(await storedIds()).toEqual(before);
		expect(parseImapCursor((await row()).cursor)?.folders.INBOX).toEqual({
			uidValidity: "2",
			lastUid: 4,
		});
	});

	it("asks for a reconnect when the mail server refuses the saved password", async () => {
		server.failure = {
			outcome: "auth-failed",
			reason: "The mail server refused that address and password.",
		};

		const outcome = await sync.sync(await row());
		const after = await row();

		expect(outcome.status).toBe("reconnect");
		expect(after.status).toBe(GoogleSyncStatus.NEEDS_RECONNECT);
		expect(after.lastError).toBe(
			"The mail server refused that address and password.",
		);
	});

	it("stops at the tick limit and carries on from there", async () => {
		await connection.connect(userId, {
			address: mailbox,
			password,
			autoCreate: false,
		});
		await connection.reimport(userId);

		const total = IMAP.tick.maxMessages + 1;

		server.boxes = {
			Sent: { uidValidity: "7", messages: [] },
			INBOX: {
				uidValidity: "7",
				messages: Array.from({ length: total }, (_, index) =>
					letter(
						index + 1,
						`bulk${index + 1}`,
						`sender${index + 1}@${noise}`,
						mailbox,
						ago(1),
					),
				),
			},
		};

		const first = await sync.sync(await row());

		expect(first.status).toBe("synced");
		expect(server.bodiesRead.length).toBe(IMAP.tick.maxMessages);
		expect(parseImapCursor((await row()).cursor)).toMatchObject({
			importing: true,
			folders: { INBOX: { lastUid: IMAP.tick.maxMessages } },
		});
		expect((await connection.status(userId)).importing).toBe(true);

		const second = await sync.sync(await row());

		expect(second.status).toBe("synced");
		expect(server.bodiesRead.length).toBe(total);
		expect(parseImapCursor((await row()).cursor)).toMatchObject({
			importing: false,
			folders: { INBOX: { lastUid: total } },
		});
	});
});

describe("removing what IMAP brought in", () => {
	it("deletes the synced mail and forgets the mailbox on disconnect", async () => {
		const before = await storedIds();
		expect(before.length).toBeGreaterThan(0);

		const purged = await connection.purgeSyncedData(userId);

		expect(purged.purged).toBe(before.length);
		expect(await storedIds()).toEqual([]);

		const result = await connection.disconnect(userId);

		expect(result.disconnected).toBe(true);
		expect(await db.imapConnection.count({ where: { userId } })).toBe(0);
		expect(await state.get(userId, "imap")).toBeNull();
		expect((await connection.status(userId)).connected).toBe(false);
	});
});
