import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { DealStage, db } from "@crm/db";
import { SEES_EVERYTHING, viewerLimitedTo } from "@crm/db/visibility";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { APP_AUTH } from "../agent/lib/app-auth";
import { contactsNeedingWork } from "../agent/lib/crm";
import { countRecords, listDeals, searchCrm } from "../agent/lib/lookup";
import {
	assertSees,
	sees,
	type ViewerContext,
	viewerFor,
} from "../agent/lib/viewer";

const suffix = process.env.TEST_RUN_ID ?? "viewer-spec";
const domain = `viewer-${suffix}.test`;
const repId = `rep-${suffix}`;
const otherId = `other-${suffix}`;
const adminId = `admin-${suffix}`;
const word = `Olhar${suffix.replace(/[^a-z0-9]/gi, "")}`;

type Caller = NonNullable<ViewerContext["session"]["auth"]["current"]>;

const user = (id: string): Caller => ({
	principalId: id,
	principalType: "user",
	attributes: {},
});

const scheduled = (id: string): Caller => ({
	principalId: id,
	principalType: "runtime",
	attributes: { purpose: "team-agent", userId: id },
});

const session = (
	current: Caller | null,
	initiator: Caller | null = current,
): ViewerContext => ({ session: { auth: { current, initiator } } });

let membersBefore: string[] = [];
let mine: string;
let theirs: string;
let theirDeal: string;
let theirContact: string;

async function rejection(work: () => Promise<unknown>): Promise<string> {
	try {
		await work();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	return "";
}

async function clean() {
	const owned = await db.company.findMany({
		where: { domain: { endsWith: domain } },
		select: { id: true },
	});
	const companyIds = owned.map((row) => row.id);

	await db.deal.deleteMany({ where: { companyId: { in: companyIds } } });
	await db.contact.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
	await db.company.deleteMany({ where: { domain: { endsWith: domain } } });
	await db.user.deleteMany({
		where: { id: { in: [repId, otherId, adminId] } },
	});
}

beforeAll(async () => {
	await clean();

	membersBefore = (await db.member.findMany({ select: { id: true } })).map(
		(member) => member.id,
	);

	await db.user.createMany({
		data: [
			{ id: repId, name: "Rep", email: `rep@${domain}` },
			{ id: otherId, name: "Other", email: `other@${domain}` },
			{ id: adminId, name: "Admin", email: `admin@${domain}` },
		],
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

	await db.member.createMany({
		data: [
			{ userId: repId, role: "member" },
			{ userId: otherId, role: "member" },
			{ userId: adminId, role: "admin" },
		].map((member) => ({
			id: `member-${member.userId}`,
			organizationId: WORKSPACE_ID,
			createdAt: new Date(),
			...member,
		})),
	});

	mine = (
		await db.company.create({
			data: {
				name: `${word} Meu`,
				domain: `meu.${domain}`,
				ownerId: repId,
			},
			select: { id: true },
		})
	).id;

	theirs = (
		await db.company.create({
			data: {
				name: `${word} Deles`,
				domain: `deles.${domain}`,
				ownerId: otherId,
			},
			select: { id: true },
		})
	).id;

	await db.deal.create({
		data: {
			name: `${word} meu negócio`,
			companyId: mine,
			ownerId: repId,
			stage: DealStage.DEMO_BOOKED,
		},
	});

	theirDeal = (
		await db.deal.create({
			data: {
				name: `${word} negócio deles`,
				companyId: theirs,
				ownerId: otherId,
				stage: DealStage.DEMO_BOOKED,
			},
			select: { id: true },
		})
	).id;

	theirContact = (
		await db.contact.create({
			data: {
				firstName: word,
				lastName: "Deles",
				email: `contato@${domain}`,
				companyId: theirs,
				ownerId: otherId,
			},
			select: { id: true },
		})
	).id;
});

afterAll(async () => {
	await clean();
	await db.member.deleteMany({ where: { id: { notIn: membersBefore } } });
});

describe("the viewer of a session", () => {
	it("lets the dispatcher see everything", async () => {
		expect(await viewerFor(session(APP_AUTH))).toEqual(SEES_EVERYTHING);
	});

	it("limits a member who talks to the agent", async () => {
		expect(await viewerFor(session(user(repId)))).toEqual(
			viewerLimitedTo(repId),
		);
	});

	it("lets an admin see everything", async () => {
		expect(await viewerFor(session(user(adminId)))).toEqual(SEES_EVERYTHING);
	});

	it("limits a scheduled agent to what its member sees", async () => {
		expect(await viewerFor(session(scheduled(repId)))).toEqual(
			viewerLimitedTo(repId),
		);
	});

	it("limits a later turn of the app in a session a member started", async () => {
		expect(await viewerFor(session(APP_AUTH, user(repId)))).toEqual(
			viewerLimitedTo(repId),
		);
	});

	it("limits a user the workspace does not know", async () => {
		const stranger = `stranger-${suffix}`;

		expect(await viewerFor(session(user(stranger)))).toEqual(
			viewerLimitedTo(stranger),
		);
	});

	it("refuses a session with no caller", async () => {
		expect(await rejection(() => viewerFor(session(null)))).toContain(
			"no caller",
		);
	});
});

describe("what a limited session reaches", () => {
	const rep = session(user(repId));

	it("opens the member's record and no other", async () => {
		expect(await sees(rep, { kind: "company", id: mine })).toBe(true);
		expect(await sees(rep, { kind: "company", id: theirs })).toBe(false);
		expect(await sees(rep, { kind: "deal", id: theirDeal })).toBe(false);
		expect(
			await rejection(() =>
				assertSees(rep, { kind: "contact", id: theirContact }),
			),
		).toBe("No such contact.");
	});

	it("searches the member's records only", async () => {
		const limited = await searchCrm(viewerLimitedTo(repId), word);
		const everything = await searchCrm(SEES_EVERYTHING, word);

		expect(limited.companies.map((hit) => hit.id)).toEqual([mine]);
		expect(limited.contacts).toHaveLength(0);
		expect(limited.deals.map((hit) => hit.company.id)).toEqual([mine]);
		expect(everything.companies.map((hit) => hit.id).sort()).toEqual(
			[mine, theirs].sort(),
		);
	});

	it("counts the member's records only", async () => {
		const limited = await countRecords(viewerLimitedTo(repId));

		expect(limited.companies).toBe(1);
		expect(limited.contacts).toBe(0);
		expect(limited.deals.total).toBe(1);
	});

	it("lists the member's deals only", async () => {
		const limited = await listDeals(viewerLimitedTo(repId), { status: "all" });

		expect(limited.deals.map((deal) => deal.company.id)).toEqual([mine]);
	});

	it("lists the member's outstanding contacts only", async () => {
		const limited = await contactsNeedingWork(viewerLimitedTo(repId), 500);
		const everything = await contactsNeedingWork(SEES_EVERYTHING, 500);

		expect(limited.some((item) => item.id === theirContact)).toBe(false);
		expect(everything.some((item) => item.id === theirContact)).toBe(true);
	});
});
