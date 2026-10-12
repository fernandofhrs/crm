import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import {
	auth,
	PORTAL_SIGN_IN,
	type PortalTicketClaims,
	signPortalTicket,
	WORKSPACE_ID,
} from "@crm/auth";
import { db } from "@crm/db";

const suffix = process.env.TEST_RUN_ID ?? "portal-sign-in-spec";
const domain = `portal-${suffix}.test`;
const rep = `rep@${domain}`;
const manager = `manager@${domain}`;
const stranger = `rep@elsewhere-${suffix}.test`;
const secret = "portal-sign-in-spec-secret-0123456789abcdef";

const MANAGED = ["PORTAL_SIGN_IN_SECRET", "ALLOWED_SIGN_IN"] as const;
const before = new Map<string, string | undefined>();

let membersBefore: string[] = [];
let nonce = 0;

function ticket(overrides: Partial<PortalTicketClaims> = {}): string {
	nonce += 1;

	return signPortalTicket(
		{
			email: rep,
			sub: "rep.one",
			name: "Rep One",
			exp:
				Math.floor(Date.now() / 1_000) + PORTAL_SIGN_IN.ticket.lifetimeSeconds,
			jti: `nonce-${suffix}-${nonce}`.padEnd(20, "0").slice(0, 64),
			...overrides,
		},
		secret,
	);
}

async function enter(given: string, to?: string) {
	const response = await auth.api.signInPortal({
		query: to === undefined ? { ticket: given } : { ticket: given, to },
		asResponse: true,
	});

	return {
		status: response.status,
		location: response.headers.get("location") ?? "",
		cookie: response.headers.get("set-cookie") ?? "",
	};
}

async function clean() {
	await db.user.deleteMany({
		where: {
			OR: [{ email: { endsWith: `@${domain}` } }, { email: stranger }],
		},
	});
	await db.portalTicket.deleteMany({
		where: { id: { startsWith: `nonce-${suffix}` } },
	});
}

beforeAll(async () => {
	for (const key of MANAGED) before.set(key, process.env[key]);

	process.env.PORTAL_SIGN_IN_SECRET = secret;
	process.env.ALLOWED_SIGN_IN = domain;

	membersBefore = (await db.member.findMany({ select: { id: true } })).map(
		(member) => member.id,
	);
});

async function seedOwner() {
	const owner = await db.user.create({
		data: {
			id: `owner-${suffix}`,
			name: "Owner",
			email: `owner@${domain}`,
			emailVerified: true,
		},
		select: { id: true },
	});

	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: "crm",
			createdAt: new Date(),
		},
		update: {},
	});

	await db.member.create({
		data: {
			id: `owner-member-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: owner.id,
			role: "owner",
			createdAt: new Date(),
		},
	});
}

beforeEach(async () => {
	await clean();
	await seedOwner();
	process.env.PORTAL_SIGN_IN_SECRET = secret;
});

afterAll(async () => {
	await clean();
	await db.member.deleteMany({ where: { id: { notIn: membersBefore } } });

	for (const key of MANAGED) {
		const value = before.get(key);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("entering from the portal", () => {
	it("creates the account as a member, opens the session and lands in the app", async () => {
		const result = await enter(ticket(), "/deals");

		expect(result.status).toBe(302);
		expect(new URL(result.location).pathname).toBe("/deals");
		expect(result.cookie).toContain("session_token=");

		const user = await db.user.findUniqueOrThrow({
			where: { email: rep },
			select: {
				name: true,
				emailVerified: true,
				accounts: { select: { providerId: true, accountId: true } },
				sessions: { select: { id: true } },
				members: { select: { organizationId: true, role: true } },
			},
		});

		expect(user.name).toBe("Rep One");
		expect(user.emailVerified).toBe(true);
		expect(user.accounts).toEqual([
			{ providerId: PORTAL_SIGN_IN.providerId, accountId: "rep.one" },
		]);
		expect(user.sessions).toHaveLength(1);
		expect(user.members).toEqual([
			{ organizationId: WORKSPACE_ID, role: "member" },
		]);
	});

	it("lets a ticket in once", async () => {
		const once = ticket();

		expect((await enter(once)).cookie).toContain("session_token=");

		const again = await enter(once);

		expect(new URL(again.location).pathname).toBe(PORTAL_SIGN_IN.signInPath);
		expect(new URL(again.location).searchParams.get("portal")).toBe("refused");
		expect(again.cookie).not.toContain("session_token=");
		expect(await db.session.count({ where: { user: { email: rep } } })).toBe(1);
	});

	it("says when the ticket ran out", async () => {
		const result = await enter(
			ticket({ exp: Math.floor(Date.now() / 1_000) - 600 }),
		);

		expect(new URL(result.location).searchParams.get("portal")).toBe("expired");
		expect(await db.user.count({ where: { email: rep } })).toBe(0);
	});

	it("refuses a ticket the portal did not sign", async () => {
		const forged = signPortalTicket(
			{
				email: rep,
				sub: "rep.one",
				exp: Math.floor(Date.now() / 1_000) + 30,
				jti: `nonce-${suffix}-forged-000000`,
			},
			`${secret}-other`,
		);

		const result = await enter(forged);

		expect(new URL(result.location).searchParams.get("portal")).toBe("refused");
		expect(await db.user.count({ where: { email: rep } })).toBe(0);
	});

	it("refuses an address this CRM does not allow", async () => {
		const result = await enter(ticket({ email: stranger }));

		expect(new URL(result.location).searchParams.get("portal")).toBe(
			"forbidden",
		);
		expect(await db.user.count({ where: { email: stranger } })).toBe(0);
	});

	it("never opens the session of an owner or an admin", async () => {
		await enter(ticket({ email: manager, sub: "manager" }));
		const user = await db.user.findUniqueOrThrow({
			where: { email: manager },
			select: { id: true },
		});
		await db.member.updateMany({
			where: { userId: user.id },
			data: { role: "admin" },
		});
		await db.session.deleteMany({ where: { userId: user.id } });

		const result = await enter(ticket({ email: manager, sub: "manager" }));

		expect(new URL(result.location).searchParams.get("portal")).toBe("direct");
		expect(result.cookie).not.toContain("session_token=");
		expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
	});

	it("does not leave the app, whatever the portal asks", async () => {
		const result = await enter(ticket(), "//evil.test/deals");

		expect(new URL(result.location).pathname).toBe("/");
		expect(new URL(result.location).host).not.toBe("evil.test");
	});

	it("is not there until the install sets the secret", async () => {
		delete process.env.PORTAL_SIGN_IN_SECRET;

		const result = await enter(ticket());

		expect(result.status).toBe(404);
		expect(await db.user.count({ where: { email: rep } })).toBe(0);
	});

	it("treats a short secret as no secret", async () => {
		process.env.PORTAL_SIGN_IN_SECRET = "too-short";

		expect((await enter(ticket())).status).toBe(404);
	});
});
