import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { ActivityType, db, GoogleSyncStatus } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type {
	AsanaClient,
	AsanaProject,
	AsanaProjectPage,
	AsanaTask,
	AsanaTaskPage,
	AsanaUser,
} from "../src/asana/asana.client";
import { ASANA } from "../src/asana/asana-config";
import { AsanaConnectionService } from "../src/asana/asana-connection.service";
import { AsanaCredentialsService } from "../src/asana/asana-credentials.service";
import { AsanaSyncService } from "../src/asana/asana-sync.service";
import {
	addressesIn,
	dueDateOf,
	isInWindow,
	toAgendaTask,
} from "../src/asana/asana-task";
import type { EnvironmentVariables } from "../src/config/env.validation";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { CredentialVaultService } from "../src/mailbox/credential-vault.service";
import type { MailboxResult } from "../src/mailbox/mailbox-api.client";
import { SyncStateService } from "../src/mailbox/sync-state.service";

const suffix = process.env.TEST_RUN_ID ?? "asana-sync-spec";
const userId = `user-${suffix}`;
const person = `buyer@asana-${suffix}.test`;
const token = "a-personal-access-token";
const projectGid = "1200000000000001";

const DAY_MS = 24 * 60 * 60 * 1_000;
const day = (offset: number) =>
	new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);

const gid = (name: string) => `${name}-${suffix}`;

const ok = <T>(data: T): MailboxResult<T> => ({ outcome: "ok", data });

class FakeAsana {
	tasks: AsanaTask[] = [];
	pageSize = 100;
	refuse: Exclude<MailboxResult<never>, { outcome: "ok" }> | null = null;
	tokens: string[] = [];

	async me(given: string): Promise<MailboxResult<AsanaUser>> {
		this.tokens.push(given);
		if (this.refuse) return this.refuse;

		return ok({
			gid: "1",
			name: "Test Rep",
			email: "rep@example.test",
			workspaces: [{ gid: "10", name: "Sales" }],
		});
	}

	async project(
		_given: string,
		wanted: string,
	): Promise<MailboxResult<AsanaProject>> {
		if (wanted !== projectGid) {
			return { outcome: "cursor-invalid", reason: "Not found" };
		}

		return ok({ gid: projectGid, name: "Agenda" });
	}

	async projects(): Promise<MailboxResult<AsanaProjectPage>> {
		return ok({
			data: [
				{ gid: projectGid, name: "Agenda" },
				{ gid: "1200000000000002", name: "A first project" },
			],
			next_page: null,
		});
	}

	async openTasks(
		_given: string,
		_project: string,
		offset?: string,
	): Promise<MailboxResult<AsanaTaskPage>> {
		if (this.refuse) return this.refuse;

		const start = offset ? Number(offset) : 0;
		const end = start + this.pageSize;

		return ok({
			data: this.tasks.slice(start, end),
			next_page: end < this.tasks.length ? String(end) : null,
		});
	}
}

const settings = {
	get: () => "asana-spec-secret-asana-spec-secret-asana",
} as unknown as ConfigService<EnvironmentVariables, true>;

const stamp = new ActivityStampService(db);
const state = new SyncStateService(db);
const vault = new CredentialVaultService(settings);
const credentials = new AsanaCredentialsService(db, vault);

let asana: FakeAsana;

const client = {
	me: (given: string) => asana.me(given),
	project: (given: string, wanted: string) => asana.project(given, wanted),
	projects: () => asana.projects(),
	openTasks: (given: string, project: string, offset?: string) =>
		asana.openTasks(given, project, offset),
} as unknown as AsanaClient;

const sync = new AsanaSyncService(db, client, credentials, state, stamp);
const connection = new AsanaConnectionService(
	db,
	client,
	credentials,
	state,
	stamp,
);

function task(name: string, patch: Partial<AsanaTask> = {}): AsanaTask {
	return {
		gid: gid(name),
		name: `Call about ${name}`,
		notes: "",
		due_on: day(2),
		due_at: null,
		created_at: "2026-01-01T09:00:00.000Z",
		permalink_url: `https://app.asana.com/0/${projectGid}/${name}`,
		...patch,
	};
}

async function activities() {
	return db.activity.findMany({
		where: { asanaTaskGid: { endsWith: `-${suffix}` } },
		orderBy: { asanaTaskGid: "asc" },
		select: {
			asanaTaskGid: true,
			type: true,
			subject: true,
			dueAt: true,
			completedAt: true,
			contactId: true,
			createdById: true,
			meta: true,
		},
	});
}

async function row() {
	const found = await state.get(userId, "asana");
	if (!found) throw new Error("The asana sync row is missing.");
	return found;
}

async function clean() {
	await db.activity.deleteMany({
		where: { asanaTaskGid: { endsWith: `-${suffix}` } },
	});
	await db.contact.deleteMany({ where: { email: person } });
	await db.mailboxSync.deleteMany({ where: { userId } });
	await db.asanaConnection.deleteMany({ where: { userId } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();
	await db.user.create({
		data: { id: userId, name: "Test Rep", email: `rep-${suffix}@example.test` },
	});
	await db.contact.create({
		data: { firstName: "A", lastName: "Buyer", email: person },
	});
});

afterAll(clean);

beforeEach(() => {
	asana = new FakeAsana();
});

describe("reading an Asana task as an agenda entry", () => {
	it("prefers the timed due date and ends a dated one with its day", () => {
		expect(
			dueDateOf(task("timed", { due_at: "2026-03-04T15:30:00.000Z" })),
		).toEqual(new Date("2026-03-04T15:30:00.000Z"));

		expect(dueDateOf(task("dated", { due_on: "2026-03-04" }))).toEqual(
			new Date(`2026-03-04${ASANA.task.dateOnlyDueTime}`),
		);

		expect(dueDateOf(task("undated", { due_on: null }))).toBeNull();
	});

	it("leaves a task with no date off the agenda", () => {
		expect(toAgendaTask(task("undated", { due_on: null }))).toBeNull();
	});

	it("names an untitled task and trims long notes", () => {
		const entry = toAgendaTask(
			task("blank", { name: "  ", notes: "x".repeat(5_000) }),
		);

		expect(entry?.subject).toBe(ASANA.task.untitled);
		expect(entry?.body?.length).toBe(ASANA.task.bodyMax);
	});

	it("finds the addresses a task mentions, once each", () => {
		expect(
			addressesIn("Ligar para Buyer@Acme.test e buyer@acme.test, cc x@y.io"),
		).toEqual(["buyer@acme.test", "x@y.io"]);
	});

	it("keeps the agenda to the recent past and the coming months", () => {
		const now = new Date("2026-06-01T12:00:00.000Z");

		expect(isInWindow(new Date("2026-05-20T00:00:00.000Z"), now)).toBe(true);
		expect(isInWindow(new Date("2026-04-01T00:00:00.000Z"), now)).toBe(false);
		expect(isInWindow(new Date("2026-10-01T00:00:00.000Z"), now)).toBe(true);
		expect(isInWindow(new Date("2027-06-01T00:00:00.000Z"), now)).toBe(false);
	});
});

describe("connecting Asana", () => {
	it("refuses a token Asana refuses, and saves nothing", async () => {
		asana.refuse = { outcome: "unauthorized", reason: "HTTP 401" };

		await expect(connection.connect(userId, token)).rejects.toBeInstanceOf(
			BadRequestException,
		);

		expect(await db.asanaConnection.count({ where: { userId } })).toBe(0);
	});

	it("seals the token and waits for a project before it syncs", async () => {
		await connection.connect(userId, token);

		const saved = await db.asanaConnection.findUniqueOrThrow({
			where: { userId },
		});

		expect(saved.secret).not.toContain(token);
		expect(vault.open(saved.secret)).toBe(token);

		expect(await connection.status(userId)).toMatchObject({
			connected: true,
			accountName: "Test Rep",
			project: null,
			status: null,
		});
		expect(await state.get(userId, "asana")).toBeNull();
	});

	it("lists the projects the token can see, by name", async () => {
		const listed = await connection.projects(userId);

		expect(asana.tokens.at(-1)).toBe(token);
		expect(listed.truncated).toBe(false);
		expect(listed.projects.map((project) => project.name)).toEqual([
			"A first project",
			"Agenda",
		]);
	});

	it("refuses a project the token cannot open", async () => {
		await expect(
			connection.chooseProject(userId, "999"),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("remembers the chosen project", async () => {
		await connection.chooseProject(userId, projectGid);

		expect((await connection.status(userId)).project).toEqual({
			gid: projectGid,
			name: "Agenda",
		});
		expect((await row()).status).toBe(GoogleSyncStatus.IDLE);
	});
});

describe("syncing the Asana agenda", () => {
	it("writes dated tasks in the window as the rep's CRM tasks", async () => {
		asana.tasks = [
			task("soon"),
			task("linked", { notes: `Retornar para ${person} com a proposta.` }),
			task("undated", { due_on: null }),
			task("faraway", { due_on: day(400) }),
			task("ancient", { due_on: day(-90) }),
		];

		const outcome = await sync.sync(await row());

		expect(outcome).toMatchObject({
			status: "synced",
			tasksWritten: 2,
			tasksClosed: 0,
		});

		const written = await activities();
		const contact = await db.contact.findFirstOrThrow({
			where: { email: person },
		});

		expect(written.map((activity) => activity.asanaTaskGid)).toEqual([
			gid("linked"),
			gid("soon"),
		]);

		expect(written[0]).toMatchObject({
			type: ActivityType.TASK,
			subject: "Call about linked",
			completedAt: null,
			contactId: contact.id,
			createdById: userId,
		});
		expect(written[0]?.meta).toMatchObject({
			synced: true,
			source: "asana",
			project: "Agenda",
		});
		expect(written[1]?.contactId).toBeNull();
		expect(written[1]?.dueAt).toEqual(
			new Date(`${day(2)}${ASANA.task.dateOnlyDueTime}`),
		);

		expect((await connection.status(userId)).openTasks).toBe(2);
	});

	it("follows a task that was renamed and rescheduled", async () => {
		asana.tasks = [
			task("soon", { name: "Call moved", due_on: day(300) }),
			task("linked", { notes: `Retornar para ${person} com a proposta.` }),
		];

		await sync.sync(await row());

		const moved = (await activities()).find(
			(activity) => activity.asanaTaskGid === gid("soon"),
		);

		expect(moved?.subject).toBe("Call moved");
		expect(moved?.dueAt).toEqual(
			new Date(`${day(300)}${ASANA.task.dateOnlyDueTime}`),
		);
		expect(moved?.completedAt).toBeNull();
	});

	it("completes a task that is no longer open in Asana", async () => {
		asana.tasks = [task("soon")];

		const outcome = await sync.sync(await row());
		const after = await activities();

		expect(outcome.tasksClosed).toBe(1);
		expect(
			after.find((activity) => activity.asanaTaskGid === gid("linked"))
				?.completedAt,
		).not.toBeNull();
		expect(
			after.find((activity) => activity.asanaTaskGid === gid("soon"))
				?.completedAt,
		).toBeNull();
	});

	it("closes nothing when the task list was cut short", async () => {
		asana.pageSize = 1;
		asana.tasks = Array.from({ length: ASANA.api.maxTaskPages + 1 }, (_, n) =>
			task(`extra${String(n).padStart(2, "0")}`),
		);

		const outcome = await sync.sync(await row());
		const after = await activities();

		expect(outcome.tasksClosed).toBe(0);
		expect(
			after.find((activity) => activity.asanaTaskGid === gid("soon"))
				?.completedAt,
		).toBeNull();
	});

	it("asks for a reconnect when Asana refuses the saved token", async () => {
		asana.refuse = { outcome: "unauthorized", reason: "HTTP 401" };

		const outcome = await sync.sync(await row());
		const after = await row();

		expect(outcome.status).toBe("reconnect");
		expect(after.status).toBe(GoogleSyncStatus.NEEDS_RECONNECT);
		expect(after.lastError).toBe("Asana no longer accepts the saved token.");
	});
});

describe("removing what Asana brought in", () => {
	it("deletes the synced tasks and forgets the token on disconnect", async () => {
		const before = await activities();
		const purged = await connection.purgeSyncedData(userId);

		expect(purged.purged).toBe(before.length);
		expect(await activities()).toEqual([]);

		expect((await connection.disconnect(userId)).disconnected).toBe(true);
		expect(await db.asanaConnection.count({ where: { userId } })).toBe(0);
		expect(await state.get(userId, "asana")).toBeNull();
	});
});
