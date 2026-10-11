import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { auth, hostImapSignIn, IMAP_SIGN_IN } from "@crm/auth";
import { db } from "@crm/db";
import type { ConfigService } from "@nestjs/config";
import { APIError } from "better-auth/api";
import type { EnvironmentVariables } from "../src/config/env.validation";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import type { ImapClient, ImapCredentials } from "../src/imap/imap.client";
import { ImapConnectionService } from "../src/imap/imap-connection.service";
import { ImapCredentialsService } from "../src/imap/imap-credentials.service";
import { ImapSignInService } from "../src/imap/imap-sign-in.service";
import { CredentialVaultService } from "../src/mailbox/credential-vault.service";
import { SyncStateService } from "../src/mailbox/sync-state.service";

const suffix = process.env.TEST_RUN_ID ?? "imap-sign-in-spec";
const hosted = `hosted-${suffix}.test`;
const elsewhere = `elsewhere-${suffix}.test`;
const rep = `rep@${hosted}`;
const stranger = `stranger@${hosted}`;
const outsider = `rep@${elsewhere}`;
const password = "the-mailbox-password";

const MANAGED = ["IMAP_HOST", "IMAP_SIGN_IN", "ALLOWED_SIGN_IN"] as const;
const before = new Map<string, string | undefined>();

type Outcome = Awaited<ReturnType<ImapClient["verify"]>>;

let answer: Outcome = { outcome: "ok" };
let asked: ImapCredentials[] = [];
let membersBefore: string[] = [];

function config(values: Record<string, string | undefined>) {
	return {
		get: (key: string) => values[key],
	} as unknown as ConfigService<EnvironmentVariables, true>;
}

const settings = config({
	BETTER_AUTH_SECRET: "imap-sign-in-spec-secret-imap-sign-in",
	IMAP_HOST: "imap.mail.test",
});

const client = {
	verify: async (given: ImapCredentials): Promise<Outcome> => {
		asked.push(given);
		return answer;
	},
} as unknown as ImapClient;

const state = new SyncStateService(db);
const vault = new CredentialVaultService(settings);
const credentials = new ImapCredentialsService(db, vault, settings);
const connections = new ImapConnectionService(
	db,
	client,
	credentials,
	state,
	new ActivityStampService(db),
);

async function clean() {
	await db.user.deleteMany({
		where: {
			OR: [
				{ email: { endsWith: `@${hosted}` } },
				{ email: { endsWith: `@${elsewhere}` } },
			],
		},
	});
}

function signIn(email: string, secret = password) {
	return auth.api.signInImap({
		body: { email, password: secret },
		returnHeaders: true,
	});
}

async function refusal(attempt: Promise<unknown>): Promise<string> {
	try {
		await attempt;
	} catch (error) {
		if (error instanceof APIError) return String(error.status);
		throw error;
	}

	return "signed in";
}

beforeAll(async () => {
	for (const key of MANAGED) before.set(key, process.env[key]);

	process.env.IMAP_HOST = "imap.mail.test";
	process.env.IMAP_SIGN_IN = `${hosted}, ${elsewhere}`;
	process.env.ALLOWED_SIGN_IN = `${rep},${outsider}`;

	membersBefore = (await db.member.findMany({ select: { id: true } })).map(
		(member) => member.id,
	);

	new ImapSignInService(client, credentials, connections).onModuleInit();
});

beforeEach(async () => {
	await clean();
	answer = { outcome: "ok" };
	asked = [];
});

afterAll(async () => {
	hostImapSignIn(null);
	await clean();
	await db.member.deleteMany({ where: { id: { notIn: membersBefore } } });

	for (const key of MANAGED) {
		const value = before.get(key);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("signing in with a mailbox", () => {
	it("creates the account, the session and the mailbox connection", async () => {
		const { headers, response } = await signIn(`  REP@${hosted} `);

		expect(asked).toEqual([
			{
				host: "imap.mail.test",
				port: 993,
				username: rep,
				password,
			},
		]);

		const user = await db.user.findUniqueOrThrow({
			where: { email: rep },
			select: {
				id: true,
				name: true,
				emailVerified: true,
				accounts: { select: { providerId: true, accountId: true } },
				sessions: { select: { id: true } },
			},
		});

		expect(response.user).toEqual({ id: user.id, email: rep, name: "Rep" });
		expect(user.emailVerified).toBe(true);
		expect(user.accounts).toEqual([
			{ providerId: IMAP_SIGN_IN.providerId, accountId: rep },
		]);
		expect(user.sessions).toHaveLength(1);
		expect(headers.get("set-cookie")).toContain("session_token=");
		expect(headers.get("set-cookie")).not.toContain(password);

		const saved = await db.imapConnection.findUniqueOrThrow({
			where: { userId: user.id },
		});

		expect(saved.address).toBe(rep);
		expect(saved.username).toBe(rep);
		expect(saved.secret).not.toContain(password);
		expect(vault.open(saved.secret)).toBe(password);

		expect(await state.get(user.id, "imap")).toMatchObject({
			status: "IDLE",
			autoCreate: true,
		});
	});

	it("joins the workspace like any other sign-in", async () => {
		await signIn(rep);

		const user = await db.user.findUniqueOrThrow({
			where: { email: rep },
			select: { members: { select: { organizationId: true } } },
		});

		expect(user.members).toHaveLength(1);
	});

	it("refuses a wrong password and creates nothing", async () => {
		answer = { outcome: "auth-failed", reason: "Refused." };

		expect(await refusal(signIn(rep, "not-the-password"))).toBe("UNAUTHORIZED");
		expect(await db.user.count({ where: { email: rep } })).toBe(0);
	});

	it("says the server is unreachable instead of calling the password wrong", async () => {
		answer = { outcome: "unreachable", reason: "ETIMEDOUT" };

		expect(await refusal(signIn(rep))).toBe("SERVICE_UNAVAILABLE");
		expect(await db.user.count({ where: { email: rep } })).toBe(0);
	});

	it("never tries a domain the install did not list", async () => {
		process.env.IMAP_SIGN_IN = hosted;

		expect(await refusal(signIn(outsider))).toBe("FORBIDDEN");
		expect(asked).toEqual([]);

		process.env.IMAP_SIGN_IN = `${hosted}, ${elsewhere}`;
	});

	it("never tries an address the allow-list does not hold", async () => {
		expect(await refusal(signIn(stranger))).toBe("FORBIDDEN");
		expect(asked).toEqual([]);
		expect(await db.user.count({ where: { email: stranger } })).toBe(0);
	});

	it("is not there at all until the install turns it on", async () => {
		delete process.env.IMAP_SIGN_IN;

		expect(await refusal(signIn(rep))).toBe("NOT_FOUND");
		expect(asked).toEqual([]);

		process.env.IMAP_SIGN_IN = `${hosted}, ${elsewhere}`;
	});

	it("signs an existing account in without a second user or account row", async () => {
		await db.user.create({
			data: {
				id: `google-${suffix}`,
				name: "Existing Rep",
				email: rep,
				emailVerified: true,
				createdAt: new Date(),
				updatedAt: new Date(),
				accounts: {
					create: {
						id: `google-account-${suffix}`,
						providerId: "google",
						accountId: `google-sub-${suffix}`,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				},
			},
		});

		await signIn(rep);
		await signIn(rep);

		const users = await db.user.findMany({
			where: { email: rep },
			select: {
				id: true,
				name: true,
				accounts: {
					select: { providerId: true },
					orderBy: { providerId: "asc" },
				},
			},
		});

		expect(users).toEqual([
			{
				id: `google-${suffix}`,
				name: "Existing Rep",
				accounts: [
					{ providerId: "google" },
					{ providerId: IMAP_SIGN_IN.providerId },
				],
			},
		]);
	});

	it("keeps what the rep chose about importing when they sign in again", async () => {
		await signIn(rep);

		const user = await db.user.findUniqueOrThrow({
			where: { email: rep },
			select: { id: true },
		});

		await connections.setAutoCreate(user.id, false);
		await signIn(rep, "a-new-password");

		expect(await state.get(user.id, "imap")).toMatchObject({
			autoCreate: false,
		});

		const saved = await db.imapConnection.findUniqueOrThrow({
			where: { userId: user.id },
		});

		expect(vault.open(saved.secret)).toBe("a-new-password");
	});

	it("still signs in when the mailbox cannot be saved", async () => {
		const broken = new ImapSignInService(client, credentials, {
			remember: async () => {
				throw new Error("The vault is closed.");
			},
		} as unknown as ImapConnectionService);

		broken.onModuleInit();

		const { headers } = await signIn(rep);

		expect(headers.get("set-cookie")).toContain("session_token=");

		new ImapSignInService(client, credentials, connections).onModuleInit();
	});
});
