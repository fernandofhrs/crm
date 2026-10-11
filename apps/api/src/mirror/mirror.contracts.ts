import { DealStage } from "@crm/db";
import { z } from "zod";
import { currencyCode } from "../currency/currency.contracts";
import { MAX_AMOUNT_CENTS } from "../deals/deals.contracts";
import { MIRROR } from "./mirror-config";

const externalId = z.string().trim().min(1).max(MIRROR.text.externalId);

const line = z.string().trim().max(MIRROR.text.line).nullish();

const email = z.string().trim().toLowerCase().max(MIRROR.text.line).nullish();

const instant = z.iso
	.datetime({ offset: true })
	.transform((value) => new Date(value));

const fieldValue = z.union([
	z.string().max(MIRROR.text.body),
	z.number(),
	z.boolean(),
	z.null(),
]);

const fieldValues = z.record(z.string(), fieldValue).optional();

const records = <Shape extends z.ZodType>(shape: Shape) =>
	z.array(shape).max(MIRROR.batch.records).default([]);

const MIRROR_FIELD_TYPES = [
	"TEXT",
	"LONG_TEXT",
	"NUMBER",
	"DATE",
	"CHECKBOX",
	"URL",
] as const;

const mirrorField = z.object({
	entity: z.enum(["COMPANY", "CONTACT", "DEAL"]),
	key: z
		.string()
		.max(MIRROR.text.fieldKey)
		.regex(/^[a-z][a-z0-9_]*$/, "A field key is lower case with underscores."),
	label: z.string().trim().min(1).max(MIRROR.text.fieldLabel),
	type: z.enum(MIRROR_FIELD_TYPES),
	showOnTable: z.boolean().default(false),
});

const mirrorCompany = z.object({
	externalId,
	name: z.string().trim().min(1).max(MIRROR.text.name),
	domain: line,
	email,
	phone: line,
	city: line,
	stateCode: line,
	country: line,
	ownerEmail: email,
	createdAt: instant.optional(),
	fields: fieldValues,
});

const mirrorContact = z.object({
	externalId,
	companyExternalId: externalId.optional(),
	firstName: z.string().trim().min(1).max(MIRROR.text.name),
	lastName: line,
	email,
	phone: line,
	title: line,
	ownerEmail: email,
	createdAt: instant.optional(),
	fields: fieldValues,
});

const mirrorDeal = z.object({
	externalId,
	companyExternalId: externalId,
	name: z.string().trim().min(1).max(MIRROR.text.name),
	description: z.string().trim().max(MIRROR.text.body).nullish(),
	stage: z.enum(Object.values(DealStage) as [DealStage, ...DealStage[]]),
	amountCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS).nullish(),
	currency: currencyCode.optional(),
	ownerEmail: email,
	createdAt: instant.optional(),
	closedAt: instant.optional(),
	expectedCloseDate: instant.nullish(),
	closedReason: line,
	contactExternalIds: z
		.array(externalId)
		.max(MIRROR.batch.dealContacts)
		.default([]),
	fields: fieldValues,
});

const mirrorActivity = z
	.object({
		externalId,
		dealExternalId: externalId.optional(),
		companyExternalId: externalId.optional(),
		contactExternalId: externalId.optional(),
		subject: z.string().trim().min(1).max(MIRROR.text.line),
		body: z.string().trim().max(MIRROR.text.body).nullish(),
		occurredAt: instant,
		authorEmail: email,
	})
	.refine(
		(activity) =>
			Boolean(
				activity.dealExternalId ??
					activity.companyExternalId ??
					activity.contactExternalId,
			),
		{ error: "An activity belongs to a deal, a company or a contact." },
	);

export const mirrorPushInput = z.object({
	source: z
		.string()
		.max(MIRROR.text.source)
		.regex(/^[a-z][a-z0-9-]*$/, "A source is a lower-case slug."),
	fields: z.array(mirrorField).max(MIRROR.batch.fields).default([]),
	companies: records(mirrorCompany),
	contacts: records(mirrorContact),
	deals: records(mirrorDeal),
	activities: records(mirrorActivity),
});

const tally = z.object({
	created: z.number(),
	updated: z.number(),
	unchanged: z.number(),
	failed: z.array(z.object({ externalId: z.string(), reason: z.string() })),
});

export const mirrorPushOutput = z.object({
	companies: tally,
	contacts: tally,
	deals: tally,
	activities: tally,
	ownersReassigned: z.number(),
});

export const mirrorStatusOutput = z.object({
	sources: z.array(
		z.object({
			source: z.string(),
			companies: z.number(),
			contacts: z.number(),
			deals: z.number(),
			activities: z.number(),
			lastPushedAt: z.string().nullable(),
		}),
	),
});

export type MirrorPushInput = z.infer<typeof mirrorPushInput>;
export type MirrorPushOutput = z.infer<typeof mirrorPushOutput>;
export type MirrorStatusOutput = z.infer<typeof mirrorStatusOutput>;
export type MirrorTally = z.infer<typeof tally>;
export type MirrorField = z.infer<typeof mirrorField>;
export type MirrorCompany = z.infer<typeof mirrorCompany>;
export type MirrorContact = z.infer<typeof mirrorContact>;
export type MirrorDeal = z.infer<typeof mirrorDeal>;
export type MirrorActivity = z.infer<typeof mirrorActivity>;
