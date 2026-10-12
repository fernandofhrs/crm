import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { ForbiddenException } from "@nestjs/common";
import type { z } from "zod";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { FieldsService } from "../src/fields/fields.service";
import {
	type MirrorPushInput,
	mirrorPushInput,
} from "../src/mirror/mirror.contracts";
import { MirrorService } from "../src/mirror/mirror.service";
import { MIRROR } from "../src/mirror/mirror-config";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = (process.env.TEST_RUN_ID ?? "mirror-spec")
	.toLowerCase()
	.replace(/[^a-z0-9]+/g, "-");
const source = `portal-${suffix}`;
const tld = `mirror-${suffix}.test`;
const fieldKey = `doc_${suffix.replace(/-/g, "_")}`;

const ownerId = `owner-${suffix}`;
const memberId = `member-${suffix}`;
const sellerId = `seller-${suffix}`;
const sellerEmail = `seller@${tld}`;

const agent = {
	withCrmEvents: withDiscardedCrmEvents,
	fieldBackfillRecords: async () => ({ queued: 0, merged: 0 }),
} as unknown as AgentTriggerService;

const conversion = new ConversionService(db);
const mirror = new MirrorService(
	db,
	new FieldsService(db, agent),
	conversion,
	new ActivityStampService(db),
);

let currency = "USD";
let membersBefore: string[] = [];

type Draft = Partial<z.input<typeof mirrorPushInput>>;

type DealDraft = NonNullable<Draft["deals"]>[number];

function batch(draft: Draft): MirrorPushInput {
	return mirrorPushInput.parse({ source, ...draft });
}

function push(draft: Draft, as = ownerId) {
	return mirror.push(as, batch(draft));
}

const acme = {
	externalId: "d:11222333000181",
	name: "Acme Velas Ltda",
	email: `compras@acme.${tld}`,
	phone: "11 5555-0000",
	city: "São Paulo",
	ownerEmail: sellerEmail,
	createdAt: "2026-03-02T12:00:00.000Z",
};

const buyer = {
	externalId: "d:11222333000181#contato",
	companyExternalId: acme.externalId,
	firstName: "Ana",
	lastName: "Souza",
	email: `ana@acme.${tld}`,
};

function proposal(over: Partial<DealDraft> = {}): DealDraft {
	return {
		externalId: "1426",
		companyExternalId: acme.externalId,
		name: "Proposta 1426 · Acme Velas",
		stage: "QUALIFIED_TO_BUY",
		amountCents: 1_250_050,
		currency,
		ownerEmail: sellerEmail,
		createdAt: "2026-09-01T13:00:00.000Z",
		contactExternalIds: [buyer.externalId],
		...over,
	};
}

async function mirrored<Key extends "companyId" | "dealId" | "contactId">(
	entity: "COMPANY" | "DEAL" | "CONTACT",
	externalId: string,
	key: Key,
): Promise<string> {
	const row = await db.mirrorRecord.findUniqueOrThrow({
		where: { source_entity_externalId: { source, entity, externalId } },
	});

	const id = row[key];
	if (!id) throw new Error(`${externalId} holds no ${key}.`);

	return id;
}

async function clean() {
	const theirs = { mirrorRecords: { some: { source } } };

	await db.deal.deleteMany({ where: theirs });
	await db.contact.deleteMany({
		where: { OR: [theirs, { email: { endsWith: `.${tld}` } }] },
	});
	await db.company.deleteMany({
		where: { OR: [theirs, { domain: { endsWith: `.${tld}` } }] },
	});
	await db.mirrorRecord.deleteMany({ where: { source } });
	await db.fieldDefinition.deleteMany({ where: { key: fieldKey } });
	await db.user.deleteMany({ where: { id: sellerId } });
}

beforeAll(async () => {
	currency = await conversion.reportingCurrency();

	membersBefore = (await db.member.findMany({ select: { id: true } })).map(
		(member) => member.id,
	);

	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: `crm-${suffix}`,
			createdAt: new Date(),
		},
		update: {},
	});

	for (const [id, role] of [
		[ownerId, "owner"],
		[memberId, "member"],
	] as const) {
		await db.user.upsert({
			where: { id },
			create: {
				id,
				name: role,
				email: `${role}@${tld}`,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			update: {},
		});
		await db.member.upsert({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId: id },
			},
			create: {
				id: `${id}-member`,
				organizationId: WORKSPACE_ID,
				userId: id,
				role,
				createdAt: new Date(),
			},
			update: { role },
		});
	}
});

beforeEach(clean);

afterAll(async () => {
	await clean();
	await db.member.deleteMany({ where: { id: { notIn: membersBefore } } });
	await db.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
});

describe("mirroring records in from another system", () => {
	it("is an owner or admin decision", async () => {
		await expect(push({ companies: [acme] }, memberId)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(await db.mirrorRecord.count({ where: { source } })).toBe(0);
	});

	it("writes the history as it happened, not as of the push", async () => {
		const result = await push({
			companies: [acme],
			contacts: [buyer],
			deals: [
				proposal({
					stage: "CLOSED_WON",
					closedAt: "2026-09-20T15:00:00.000Z",
				}),
			],
			activities: [
				{
					externalId: "1426:enviada",
					dealExternalId: "1426",
					subject: "Proposta enviada",
					body: "25 velas 170 g",
					occurredAt: "2026-09-01T13:00:00.000Z",
				},
				{
					externalId: "1426:pagamento:1",
					dealExternalId: "1426",
					subject: "Pagamento recebido",
					occurredAt: "2026-09-22T10:00:00.000Z",
				},
			],
		});

		expect(result.companies).toMatchObject({ created: 1, failed: [] });
		expect(result.contacts).toMatchObject({ created: 1, failed: [] });
		expect(result.deals).toMatchObject({ created: 1, failed: [] });
		expect(result.activities).toMatchObject({ created: 2, failed: [] });

		const company = await db.company.findUniqueOrThrow({
			where: { id: await mirrored("COMPANY", acme.externalId, "companyId") },
			include: { primaryContact: true },
		});

		expect(company).toMatchObject({
			name: "Acme Velas Ltda",
			domain: `acme.${tld}`,
			source: "IMPORT",
			enrichmentStatus: "SKIPPED",
			ownerId,
		});
		expect(company.createdAt.toISOString()).toBe("2026-03-02T12:00:00.000Z");
		expect(company.primaryContact?.firstName).toBe("Ana");
		expect(company.lastActivityAt?.toISOString()).toBe(
			"2026-09-22T10:00:00.000Z",
		);

		const deal = await db.deal.findUniqueOrThrow({
			where: { id: await mirrored("DEAL", "1426", "dealId") },
			include: {
				contacts: true,
				activities: { orderBy: { occurredAt: "asc" } },
			},
		});

		expect(deal).toMatchObject({
			stage: "CLOSED_WON",
			currency,
			baseCurrency: currency,
			ownerId,
			closedReason: null,
		});
		expect(deal.amount?.toString()).toBe("12500.5");
		expect(deal.baseAmount?.toString()).toBe("12500.5");
		expect(deal.createdAt.toISOString()).toBe("2026-09-01T13:00:00.000Z");
		expect(deal.closedAt?.toISOString()).toBe("2026-09-20T15:00:00.000Z");
		expect(deal.stageChangedAt.toISOString()).toBe("2026-09-20T15:00:00.000Z");
		expect(deal.contacts).toHaveLength(1);
		expect(deal.activities.map((activity) => activity.subject)).toEqual([
			"Proposta enviada",
			"Pagamento recebido",
		]);
		expect(deal.activities[0]?.createdAt.toISOString()).toBe(
			"2026-09-01T13:00:00.000Z",
		);

		expect(await db.agentTask.count({ where: { companyId: company.id } })).toBe(
			0,
		);
	});

	it("changes nothing when the same batch arrives again", async () => {
		const first = { companies: [acme], contacts: [buyer], deals: [proposal()] };

		await push(first);
		const again = await push(first);

		expect(again.companies).toMatchObject({ created: 0, unchanged: 1 });
		expect(again.contacts).toMatchObject({ created: 0, unchanged: 1 });
		expect(again.deals).toMatchObject({ created: 0, unchanged: 1 });
		expect(await db.mirrorRecord.count({ where: { source } })).toBe(3);
		expect(await db.company.count({ where: { domain: `acme.${tld}` } })).toBe(
			1,
		);
	});

	it("moves a deal when the source moved it, and says so on the timeline", async () => {
		await push({
			companies: [acme],
			deals: [proposal({ contactExternalIds: [] })],
		});

		const lost = await push({
			deals: [
				proposal({
					contactExternalIds: [],
					stage: "CLOSED_LOST",
					closedAt: "2026-10-02T09:30:00.000Z",
				}),
			],
		});

		expect(lost.deals).toMatchObject({ updated: 1, failed: [] });

		const deal = await db.deal.findUniqueOrThrow({
			where: { id: await mirrored("DEAL", "1426", "dealId") },
			include: { activities: true },
		});

		expect(deal.stage).toBe("CLOSED_LOST");
		expect(deal.closedReason).toBe(MIRROR.lost.reason);
		expect(deal.closedAt?.toISOString()).toBe("2026-10-02T09:30:00.000Z");
		expect(deal.createdAt.toISOString()).toBe("2026-09-01T13:00:00.000Z");
		expect(deal.activities).toHaveLength(1);
		expect(deal.activities[0]).toMatchObject({
			type: "STAGE_CHANGE",
			meta: { from: "QUALIFIED_TO_BUY", to: "CLOSED_LOST", source },
		});
	});

	it("joins the company the mailbox already filed under the same domain", async () => {
		const filed = await db.company.create({
			data: { name: `acme.${tld}`, domain: `acme.${tld}`, source: "EMAIL" },
		});
		const known = await db.contact.create({
			data: { firstName: "ana", email: buyer.email, companyId: filed.id },
		});

		await push({ companies: [acme], contacts: [buyer] });

		expect(await mirrored("COMPANY", acme.externalId, "companyId")).toBe(
			filed.id,
		);
		expect(await mirrored("CONTACT", buyer.externalId, "contactId")).toBe(
			known.id,
		);

		const company = await db.company.findUniqueOrThrow({
			where: { id: filed.id },
		});

		expect(company.name).toBe("Acme Velas Ltda");
		expect(company.source).toBe("EMAIL");
	});

	it("keeps the name a company already had here, and takes the rest", async () => {
		const filed = await db.company.create({
			data: { name: "Acme", domain: `acme.${tld}`, source: "EMAIL" },
		});

		await push({ companies: [acme] });
		await push({ companies: [{ ...acme, city: "Campinas" }] });

		const company = await db.company.findUniqueOrThrow({
			where: { id: filed.id },
		});

		expect(await mirrored("COMPANY", acme.externalId, "companyId")).toBe(
			filed.id,
		);
		expect(company.name).toBe("Acme");
		expect(company.city).toBe("Campinas");
		expect(company.phone).toBe(acme.phone);
	});

	it("renames a company it created when the source renames it", async () => {
		await push({ companies: [acme] });
		await push({ companies: [{ ...acme, name: "Acme Aromas Ltda" }] });

		const company = await db.company.findUniqueOrThrow({
			where: { id: await mirrored("COMPANY", acme.externalId, "companyId") },
		});

		expect(company.name).toBe("Acme Aromas Ltda");
	});

	it("leaves no record without an owner while the seller is not here", async () => {
		const mine = await db.company.create({
			data: {
				name: `outra.${tld}`,
				domain: `outra.${tld}`,
				source: "EMAIL",
				ownerId: memberId,
			},
		});

		await push({
			companies: [
				acme,
				{ ...acme, externalId: "n:outra", email: `x@outra.${tld}` },
			],
			contacts: [buyer],
		});

		const company = await db.company.findUniqueOrThrow({
			where: { id: await mirrored("COMPANY", acme.externalId, "companyId") },
		});
		const contact = await db.contact.findUniqueOrThrow({
			where: { id: await mirrored("CONTACT", buyer.externalId, "contactId") },
		});
		const adopted = await db.company.findUniqueOrThrow({
			where: { id: mine.id },
		});

		expect(company.ownerId).toBe(ownerId);
		expect(contact.ownerId).toBe(ownerId);
		expect(adopted.ownerId).toBe(memberId);
	});

	it("gives an owner to what an earlier push left without one", async () => {
		await push({ companies: [acme], contacts: [buyer] });

		const companyId = await mirrored("COMPANY", acme.externalId, "companyId");
		const contactId = await mirrored("CONTACT", buyer.externalId, "contactId");

		await db.company.update({
			where: { id: companyId },
			data: { ownerId: null },
		});
		await db.contact.update({
			where: { id: contactId },
			data: { ownerId: null },
		});

		const again = await push({ companies: [acme], contacts: [buyer] });

		expect(again.companies).toMatchObject({ unchanged: 1 });
		expect(
			(await db.company.findUniqueOrThrow({ where: { id: companyId } }))
				.ownerId,
		).toBe(ownerId);
		expect(
			(await db.contact.findUniqueOrThrow({ where: { id: contactId } }))
				.ownerId,
		).toBe(ownerId);
	});

	it("gives a second customer at the same domain a company of its own", async () => {
		const branch = {
			...acme,
			externalId: "d:11222333000262",
			name: "Acme Filial",
		};

		const result = await push({ companies: [acme, branch] });

		expect(result.companies).toMatchObject({ created: 2, failed: [] });

		const second = await db.company.findUniqueOrThrow({
			where: { id: await mirrored("COMPANY", branch.externalId, "companyId") },
		});

		expect(second.domain).toBeNull();
		expect(second.name).toBe("Acme Filial");
	});

	it("hands the records to their seller the moment the seller exists", async () => {
		const records = {
			companies: [acme],
			deals: [proposal({ contactExternalIds: [] })],
		};

		await push(records);

		const dealId = await mirrored("DEAL", "1426", "dealId");

		expect(
			(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).ownerId,
		).toBe(ownerId);

		await db.user.create({
			data: {
				id: sellerId,
				name: "Seller",
				email: sellerEmail,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		const again = await push(records);

		expect(again.deals).toMatchObject({ unchanged: 1 });
		expect(again.ownersReassigned).toBe(2);
		expect(
			(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).ownerId,
		).toBe(sellerId);
	});

	it("refuses one record without losing the rest of the batch", async () => {
		const result = await push({
			companies: [acme],
			deals: [
				proposal({ contactExternalIds: [] }),
				proposal({
					externalId: "9999",
					companyExternalId: "d:00000000000000",
					contactExternalIds: [],
				}),
			],
		});

		expect(result.deals.created).toBe(1);
		expect(result.deals.failed).toEqual([
			{
				externalId: "9999",
				reason: "A empresa d:00000000000000 não foi espelhada.",
			},
		]);
	});

	it("creates the fields it is told about, and never asks the agent to fill them", async () => {
		const withDoc = { ...acme, fields: { [fieldKey]: "11.222.333/0001-81" } };

		const refused = await push({ companies: [withDoc] });

		expect(refused.companies.failed).toHaveLength(1);
		expect(await db.mirrorRecord.count({ where: { source } })).toBe(0);

		const accepted = await push({
			fields: [
				{ entity: "COMPANY", key: fieldKey, label: "CNPJ", type: "TEXT" },
			],
			companies: [withDoc],
		});

		expect(accepted.companies).toMatchObject({ created: 1, failed: [] });

		const definition = await db.fieldDefinition.findUniqueOrThrow({
			where: { entity_key: { entity: "COMPANY", key: fieldKey } },
			include: { values: true },
		});

		expect(definition.agentFilled).toBe(false);
		expect(definition.values.map((value) => value.text)).toEqual([
			"11.222.333/0001-81",
		]);
	});

	it("saves each record once when the same batch arrives twice at once", async () => {
		const draft = { companies: [acme], contacts: [buyer], deals: [proposal()] };

		const [first, second] = await Promise.all([push(draft), push(draft)]);

		for (const result of [first, second]) {
			expect(result.companies.failed).toEqual([]);
			expect(result.contacts.failed).toEqual([]);
			expect(result.deals.failed).toEqual([]);
		}

		expect(first.companies.created + second.companies.created).toBe(1);
		expect(first.deals.created + second.deals.created).toBe(1);

		const companies = await db.company.findMany({
			where: { name: acme.name, email: acme.email },
			select: { id: true },
		});

		expect(companies).toHaveLength(1);
		expect(await db.contact.count({ where: { email: buyer.email } })).toBe(1);
		expect(
			await db.deal.count({ where: { companyId: companies[0]?.id } }),
		).toBe(1);
	});

	it("reports what each source has mirrored", async () => {
		await push({ companies: [acme], contacts: [buyer], deals: [proposal()] });

		const { sources } = await mirror.status(ownerId);

		expect(sources.find((row) => row.source === source)).toMatchObject({
			companies: 1,
			contacts: 1,
			deals: 1,
			activities: 0,
		});
	});
});

describe("the mirror contract", () => {
	it("takes a bounded batch from a named source", () => {
		const tooMany = Array.from(
			{ length: MIRROR.batch.records + 1 },
			(_, index) => ({ externalId: String(index), name: "x" }),
		);

		expect(
			mirrorPushInput.safeParse({ source, companies: tooMany }).success,
		).toBe(false);
		expect(mirrorPushInput.safeParse({ source: "Portal v1" }).success).toBe(
			false,
		);
		expect(mirrorPushInput.safeParse({ source }).success).toBe(true);
	});

	it("needs an activity to belong to something", () => {
		const orphan = {
			externalId: "a",
			subject: "Nota",
			occurredAt: "2026-09-01T13:00:00.000Z",
		};

		expect(
			mirrorPushInput.safeParse({ source, activities: [orphan] }).success,
		).toBe(false);
	});

	it("takes dates with an offset and nothing looser", () => {
		const dated = (createdAt: string) =>
			mirrorPushInput.safeParse({
				source,
				companies: [{ externalId: "1", name: "x", createdAt }],
			}).success;

		expect(dated("2026-09-01T13:00:00-03:00")).toBe(true);
		expect(dated("01/09/2026")).toBe(false);
	});
});
