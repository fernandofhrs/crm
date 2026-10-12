import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { ActivityType, DealStage, db } from "@crm/db";
import { SEES_EVERYTHING, viewerLimitedTo } from "@crm/db/visibility";
import { ActivitiesService } from "../src/activities/activities.service";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { companyListInput } from "../src/companies/companies.contracts";
import { CompaniesService } from "../src/companies/companies.service";
import { CompanyDirectoryService } from "../src/companies/company-directory.service";
import type { FaviconService } from "../src/companies/favicon.service";
import { contactListInput } from "../src/contacts/contacts.contracts";
import { ContactsService } from "../src/contacts/contacts.service";
import { ConversationsService } from "../src/conversations/conversations.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ViewerService } from "../src/crm/viewer.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { dealListInput } from "../src/deals/deals.contracts";
import { DealsService } from "../src/deals/deals.service";
import { EnrichmentService } from "../src/enrichment/enrichment.service";
import { FieldsService } from "../src/fields/fields.service";
import { ConversationService } from "../src/google/conversation.service";
import { SearchService } from "../src/search/search.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "visibility-spec";
const domain = `visibility-${suffix}.test`;
const anaId = `ana-${suffix}`;
const brunoId = `bruno-${suffix}`;
const managerId = `manager-${suffix}`;
const word = `Visivel${suffix.replace(/[^a-z0-9]/gi, "")}`;

const everyCompany = companyListInput.parse({ q: word, pageSize: 50 });
const everyContact = contactListInput.parse({ q: word, pageSize: 50 });
const everyDeal = dealListInput.parse({ q: word, pageSize: 50 });

const ana = viewerLimitedTo(anaId);
const bruno = viewerLimitedTo(brunoId);

const agent = {
	contactCreated: async () => true,
	companyCreated: async () => undefined,
	companyRequested: async () => true,
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;

const stamp = new ActivityStampService(db);
const queue = new AgentQueueService(db);
const conversion = new ConversionService(db);
const directory = new CompanyDirectoryService(agent);
const fields = new FieldsService(db, agent);
const viewers = new ViewerService(db);
const contacts = new ContactsService(
	db,
	directory,
	agent,
	queue,
	stamp,
	fields,
);
const companies = new CompaniesService(
	db,
	agent,
	queue,
	{ backfill: async () => undefined } as unknown as FaviconService,
	stamp,
	conversion,
	fields,
);
const deals = new DealsService(db, agent, stamp, conversion, fields);
const activities = new ActivitiesService(db, stamp, viewers);
const search = new SearchService(db);
const dashboard = new DashboardService(db, conversion);
const enrichment = new EnrichmentService(db);
const threads = new ConversationService(db);
const chats = new ConversationsService(db);

let membersBefore: string[] = [];
let ofAna: string;
let ofBruno: string;
let shared: string;
let unowned: string;
let dealOfAna: string;
let dealOfBruno: string;
let contactOfBruno: string;
let looseOfAna: string;
let threadOfBruno: string;

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

	await db.emailThread.deleteMany({ where: { companyId: { in: companyIds } } });
	await db.deal.deleteMany({ where: { companyId: { in: companyIds } } });
	await db.activity.deleteMany({
		where: {
			OR: [
				{ companyId: { in: companyIds } },
				{ createdById: { in: [anaId, brunoId, managerId] } },
			],
		},
	});
	await db.agentTask.deleteMany({
		where: {
			OR: [{ companyId: { in: companyIds } }, { subject: suffix }],
		},
	});
	await db.contact.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
	await db.suppressedContact.deleteMany({
		where: { email: { endsWith: `@${domain}` } },
	});
	await db.company.deleteMany({ where: { domain: { endsWith: domain } } });
	await db.user.deleteMany({
		where: { id: { in: [anaId, brunoId, managerId] } },
	});
}

beforeAll(async () => {
	await clean();

	membersBefore = (await db.member.findMany({ select: { id: true } })).map(
		(member) => member.id,
	);

	await db.user.createMany({
		data: [
			{ id: anaId, name: "Ana", email: `ana@${domain}` },
			{ id: brunoId, name: "Bruno", email: `bruno@${domain}` },
			{ id: managerId, name: "Gestora", email: `gestora@${domain}` },
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
			{ userId: anaId, role: "member" },
			{ userId: brunoId, role: "member" },
			{ userId: managerId, role: "admin" },
		].map((member) => ({
			id: `member-${member.userId}`,
			organizationId: WORKSPACE_ID,
			createdAt: new Date(),
			...member,
		})),
	});

	const company = (name: string, sub: string, ownerId: string | null) =>
		db.company.create({
			data: { name: `${word} ${name}`, domain: `${sub}.${domain}`, ownerId },
			select: { id: true },
		});

	ofAna = (await company("Alfa", "alfa", anaId)).id;
	ofBruno = (await company("Beta", "beta", brunoId)).id;
	shared = (await company("Gama", "gama", brunoId)).id;
	unowned = (await company("Delta", "delta", null)).id;

	const deal = (name: string, companyId: string, ownerId: string) =>
		db.deal.create({
			data: {
				name: `${word} ${name}`,
				companyId,
				ownerId,
				stage: DealStage.DEMO_BOOKED,
			},
			select: { id: true },
		});

	dealOfAna = (await deal("negócio da Ana", ofAna, anaId)).id;
	dealOfBruno = (await deal("negócio do Bruno", ofBruno, brunoId)).id;
	await deal("negócio da Ana na Gama", shared, anaId);

	contactOfBruno = (
		await db.contact.create({
			data: {
				firstName: word,
				lastName: "Bruno",
				email: `contato.bruno@${domain}`,
				companyId: ofBruno,
				ownerId: brunoId,
			},
			select: { id: true },
		})
	).id;

	looseOfAna = (
		await db.contact.create({
			data: {
				firstName: word,
				lastName: "Solto",
				email: `solto@${domain}`,
				ownerId: anaId,
			},
			select: { id: true },
		})
	).id;

	threadOfBruno = (
		await db.emailThread.create({
			data: {
				subject: `${word} conversa`,
				rootMessageId: `root-${suffix}`,
				companyId: ofBruno,
				firstMessageAt: new Date(),
				lastMessageAt: new Date(),
			},
			select: { id: true },
		})
	).id;

	await db.activity.create({
		data: {
			type: ActivityType.NOTE,
			subject: `${word} nota do Bruno`,
			companyId: ofBruno,
			createdById: brunoId,
			occurredAt: new Date(),
		},
	});

	await db.agentTask.createMany({
		data: [
			{ companyId: ofAna, subject: suffix },
			{ companyId: ofBruno, subject: suffix },
		].map((task) => ({
			...task,
			kind: "company-brand",
			reason: "visibility spec",
			dueAt: new Date(Date.now() - 60_000),
		})),
	});
});

afterAll(async () => {
	await clean();
	await db.member.deleteMany({ where: { id: { notIn: membersBefore } } });
});

describe("who sees every record", () => {
	it("limits a member and frees an owner or an admin", async () => {
		expect(await viewers.of(anaId)).toEqual(ana);
		expect(await viewers.of(managerId)).toEqual(SEES_EVERYTHING);
		expect(await viewers.of(`nobody-${suffix}`)).toEqual(
			viewerLimitedTo(`nobody-${suffix}`),
		);
	});
});

describe("a member sees the companies they answer for", () => {
	it("lists a company they own and a company where they own a deal", async () => {
		const list = await companies.list(everyCompany, ana);
		const ids = list.rows.map((row) => row.id).sort();

		expect(ids).toEqual([ofAna, shared].sort());
		expect(list.total).toBe(2);
	});

	it("lists a company through a contact they own", async () => {
		const list = await companies.list(everyCompany, bruno);

		expect(list.rows.map((row) => row.id).sort()).toEqual(
			[ofBruno, shared].sort(),
		);
	});

	it("shows every company to someone who sees everything", async () => {
		const list = await companies.list(everyCompany, SEES_EVERYTHING);

		expect(list.rows.map((row) => row.id).sort()).toEqual(
			[ofAna, ofBruno, shared, unowned].sort(),
		);
	});

	it("answers that a hidden company does not exist", async () => {
		expect(await rejection(() => companies.byId(ofBruno, ana))).toContain(
			"Nenhuma empresa",
		);
		expect(
			await rejection(() => companies.update(ofBruno, { name: "X" }, ana)),
		).toContain("Nenhuma empresa");
		expect(await rejection(() => companies.archive(ofBruno, ana))).toContain(
			"Nenhuma empresa",
		);
		expect(await rejection(() => companies.byId(unowned, ana))).toContain(
			"Nenhuma empresa",
		);

		const after = await db.company.findUniqueOrThrow({
			where: { id: ofBruno },
			select: { name: true, archivedAt: true },
		});
		expect(after.name).toBe(`${word} Beta`);
		expect(after.archivedAt).toBeNull();
	});

	it("opens a company the member shares through a deal", async () => {
		const company = await companies.byId(shared, ana);

		expect(company.id).toBe(shared);
	});

	it("makes the member the owner of a company they create", async () => {
		const created = await companies.create(
			{ name: `${word} Nova`, domain: `nova.${domain}` },
			ana,
		);
		const row = await db.company.findUniqueOrThrow({
			where: { id: created.id },
			select: { ownerId: true },
		});

		expect(row.ownerId).toBe(anaId);
	});

	it("does not name a hidden company that holds the domain", async () => {
		const message = await rejection(() =>
			companies.create({ name: "Outra", domain: `beta.${domain}` }, ana),
		);

		expect(message).toContain("já usa o domínio");
		expect(message).not.toContain("Beta");
	});

	it("skips hidden companies in a bulk change", async () => {
		const result = await companies.bulkAssignOwner(
			{ ids: [ofAna, ofBruno], ownerId: anaId },
			ana,
		);
		const untouched = await db.company.findUniqueOrThrow({
			where: { id: ofBruno },
			select: { ownerId: true },
		});

		expect(result.succeeded).toBe(1);
		expect(untouched.ownerId).toBe(brunoId);
	});
});

describe("contacts and deals follow the company", () => {
	it("lists the contacts of visible companies and the member's loose contacts", async () => {
		const list = await contacts.list(everyContact, ana);

		expect(list.rows.map((row) => row.id)).toEqual([looseOfAna]);
		expect(await rejection(() => contacts.byId(contactOfBruno, ana))).toContain(
			"Nenhum contato",
		);
	});

	it("lists every deal of a visible company and no other", async () => {
		const list = await deals.list(everyDeal, ana);
		const names = list.rows.map((row) => row.name).sort();

		expect(names).toEqual(
			[`${word} negócio da Ana`, `${word} negócio da Ana na Gama`].sort(),
		);
		expect(await rejection(() => deals.byId(dealOfBruno, ana))).toContain(
			"Nenhum negócio",
		);
	});

	it("refuses a deal in a hidden company", async () => {
		const message = await rejection(() =>
			deals.create(
				{ name: "Intruso", companyId: ofBruno, ownerId: anaId },
				ana,
			),
		);

		expect(message).toContain("Essa empresa");
		expect(await db.deal.count({ where: { name: "Intruso" } })).toBe(0);
	});

	it("refuses to move a hidden deal", async () => {
		const message = await rejection(() =>
			deals.setStage(
				{ id: dealOfBruno, stage: DealStage.CLOSED_WON },
				anaId,
				ana,
			),
		);
		const deal = await db.deal.findUniqueOrThrow({
			where: { id: dealOfBruno },
			select: { stage: true },
		});

		expect(message).toContain("Nenhum negócio");
		expect(deal.stage).toBe(DealStage.DEMO_BOOKED);
	});
});

describe("everything filed under a company follows the company", () => {
	it("hides the timeline of a hidden company", async () => {
		const input = { companyId: ofBruno, filter: "all" as const, limit: 20 };

		expect(await rejection(() => activities.timeline(input, ana))).toContain(
			"Nenhuma empresa",
		);
		expect((await activities.timeline(input, bruno)).entries).toHaveLength(1);
	});

	it("refuses a note on a hidden company", async () => {
		const message = await rejection(() =>
			activities.create(
				{ type: ActivityType.NOTE, body: "x", companyId: ofBruno },
				anaId,
				ana,
			),
		);

		expect(message).toContain("Nenhuma empresa");
	});

	it("hides an e-mail thread of a hidden company", async () => {
		expect(await rejection(() => threads.thread(threadOfBruno, ana))).toContain(
			"Nenhuma conversa",
		);
		expect((await threads.thread(threadOfBruno, bruno)).id).toBe(threadOfBruno);
	});

	it("searches visible records only", async () => {
		const mine = await search.quick(word, ana);
		const all = await search.quick(word, SEES_EVERYTHING);
		const hidden = [ofBruno, unowned, dealOfBruno, contactOfBruno];

		expect(mine.hits.some((hit) => hidden.includes(hit.id))).toBe(false);
		expect(mine.hits.some((hit) => hit.id === ofAna)).toBe(true);
		expect(all.hits.some((hit) => hit.id === ofBruno)).toBe(true);
	});

	it("offers visible records only to the chat", async () => {
		const offered = await chats.builderResources(word, anaId, ana);
		const ids = offered.map((resource) => resource.id);

		expect(ids).toContain(ofAna);
		expect(ids).not.toContain(ofBruno);
		expect(ids).not.toContain(contactOfBruno);
		expect(ids).not.toContain(dealOfBruno);
	});

	it("counts visible deals only on the dashboard", async () => {
		const mine = await dashboard.summary(anaId, { scope: "everyone" }, ana);
		const names = mine.biggestOpen.map((deal) => deal.name);

		expect(names).not.toContain(`${word} negócio do Bruno`);
		expect(names).toContain(`${word} negócio da Ana`);
		expect(
			mine.recentActivity.some(
				(entry) => entry.subject === `${word} nota do Bruno`,
			),
		).toBe(false);
	});

	it("queues visible records only", async () => {
		const mine = await enrichment.queue(ana, 100);
		const all = await enrichment.queue(SEES_EVERYTHING, 100);
		const idsOf = (rows: { subject: { id: string } }[]) =>
			rows.map((row) => row.subject.id);

		expect(idsOf(mine.rows)).toContain(ofAna);
		expect(idsOf(mine.rows)).not.toContain(ofBruno);
		expect(idsOf(all.rows)).toContain(ofBruno);
	});
});
