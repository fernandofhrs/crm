import { createHash } from "node:crypto";
import { canManageConnections, workspaceRoleOf } from "@crm/auth";
import {
	ActivityType,
	type Db,
	type DealStage,
	EnrichmentStatus,
	MirrorEntity,
	type Prisma,
	RecordSource,
} from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import { isClosedStage, LOSING_DEAL_STAGES } from "@crm/db/deal-stage";
import { fieldKeyFromLabel } from "@crm/db/fields-shape";
import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	Injectable,
	Logger,
} from "@nestjs/common";
import { domainFromEmail, normalizeDomain } from "../companies/domain";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { decimalFromCents, normalizeEmail } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import type {
	MirrorActivity,
	MirrorCompany,
	MirrorContact,
	MirrorDeal,
	MirrorField,
	MirrorPushInput,
	MirrorPushOutput,
	MirrorStatusOutput,
	MirrorTally,
} from "./mirror.contracts";
import { MIRROR } from "./mirror-config";

type Outcome = "created" | "updated" | "unchanged";

type Saved = { id: string; outcome: Outcome };

type Ref = {
	hash: string;
	companyId: string | null;
	contactId: string | null;
	dealId: string | null;
	activityId: string | null;
};

type Target =
	| { companyId: string }
	| { contactId: string }
	| { dealId: string }
	| { activityId: string };

type Push = {
	source: string;
	actorId: string;
	owners: Map<string, string>;
	refs: Map<string, Ref | null>;
	touched: {
		companyIds: Set<string>;
		contactIds: Set<string>;
		dealIds: Set<string>;
	};
};

const LOSING = new Set<DealStage>(LOSING_DEAL_STAGES);

const REF_SELECT = {
	entity: true,
	externalId: true,
	hash: true,
	companyId: true,
	contactId: true,
	dealId: true,
	activityId: true,
} satisfies Prisma.MirrorRecordSelect;

const SAVE_FAILED = "Não foi possível salvar.";

const TRANSACTION = {
	timeout: MIRROR.transaction.timeoutMs,
	maxWait: MIRROR.transaction.maxWaitMs,
} as const;

class MirrorRefusal extends Error {}

@Injectable()
export class MirrorService {
	private readonly logger = new Logger(MirrorService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly fields: FieldsService,
		private readonly conversion: ConversionService,
		private readonly stamp: ActivityStampService,
	) {}

	async push(
		userId: string,
		input: MirrorPushInput,
	): Promise<MirrorPushOutput> {
		await this.requireManager(userId);
		await this.ensureFields(input.fields);

		const push: Push = {
			source: input.source,
			actorId: userId,
			owners: await this.ownersOf(input),
			refs: new Map(),
			touched: {
				companyIds: new Set(),
				contactIds: new Set(),
				dealIds: new Set(),
			},
		};

		await Promise.all([
			this.prime(push, MirrorEntity.COMPANY, [
				...input.companies.map((row) => row.externalId),
				...input.contacts.flatMap((row) => row.companyExternalId ?? []),
				...input.deals.map((row) => row.companyExternalId),
				...input.activities.flatMap((row) => row.companyExternalId ?? []),
			]),
			this.prime(push, MirrorEntity.CONTACT, [
				...input.contacts.map((row) => row.externalId),
				...input.deals.flatMap((row) => row.contactExternalIds),
				...input.activities.flatMap((row) => row.contactExternalId ?? []),
			]),
			this.prime(push, MirrorEntity.DEAL, [
				...input.deals.map((row) => row.externalId),
				...input.activities.flatMap((row) => row.dealExternalId ?? []),
			]),
			this.prime(
				push,
				MirrorEntity.ACTIVITY,
				input.activities.map((row) => row.externalId),
			),
		]);

		const companies = await this.each(input.companies, (row) =>
			this.company(push, row),
		);
		const contacts = await this.each(input.contacts, (row) =>
			this.contact(push, row),
		);
		const deals = await this.each(input.deals, (row) => this.deal(push, row));
		const activities = await this.each(input.activities, (row) =>
			this.activity(push, row),
		);

		await this.ownTheUnowned(push);

		const ownersReassigned = await this.reconcileOwners(input.source);

		await this.stamp.recomputeMany({
			companyIds: [...push.touched.companyIds],
			contactIds: [...push.touched.contactIds],
			dealIds: [...push.touched.dealIds],
		});

		this.logger.log({
			message: "Mirror push applied",
			source: input.source,
			companies: counts(companies),
			contacts: counts(contacts),
			deals: counts(deals),
			activities: counts(activities),
			ownersReassigned,
		});

		return { companies, contacts, deals, activities, ownersReassigned };
	}

	async status(userId: string): Promise<MirrorStatusOutput> {
		await this.requireManager(userId);

		const groups = await this.db.mirrorRecord.groupBy({
			by: ["source", "entity"],
			_count: { _all: true },
			_max: { updatedAt: true },
		});

		const sources = new Map<string, MirrorStatusOutput["sources"][number]>();

		for (const group of groups) {
			const row = sources.get(group.source) ?? {
				source: group.source,
				companies: 0,
				contacts: 0,
				deals: 0,
				activities: 0,
				lastPushedAt: null,
			};

			row[STATUS_KEY[group.entity]] = group._count._all;

			const pushedAt = group._max.updatedAt?.toISOString() ?? null;
			if (pushedAt && (!row.lastPushedAt || pushedAt > row.lastPushedAt)) {
				row.lastPushedAt = pushedAt;
			}

			sources.set(group.source, row);
		}

		return {
			sources: [...sources.values()].sort((a, b) =>
				a.source.localeCompare(b.source),
			),
		};
	}

	private async requireManager(userId: string): Promise<void> {
		const role = await workspaceRoleOf(userId, this.db);

		if (!canManageConnections(role)) {
			throw new ForbiddenException(
				"Só um dono ou um administrador pode espelhar registros no CRM.",
			);
		}
	}

	private async ensureFields(fields: MirrorField[]): Promise<void> {
		for (const field of fields) {
			if (fieldKeyFromLabel(field.key) !== field.key) {
				throw new BadRequestException(
					`"${field.key}" não pode ser usada como chave de campo.`,
				);
			}

			const existing = await this.db.fieldDefinition.findUnique({
				where: { entity_key: { entity: field.entity, key: field.key } },
				select: { id: true },
			});

			if (existing) continue;

			const last = await this.db.fieldDefinition.findFirst({
				where: { entity: field.entity },
				orderBy: { position: "desc" },
				select: { position: true },
			});

			await this.db.fieldDefinition.create({
				data: {
					entity: field.entity,
					key: field.key,
					label: field.label,
					type: field.type,
					agentFilled: false,
					showOnTable: field.showOnTable,
					position: (last?.position ?? -1) + 1,
				},
			});
		}
	}

	private async ownersOf(input: MirrorPushInput): Promise<Map<string, string>> {
		const emails = new Set<string>();

		for (const row of [...input.companies, ...input.contacts, ...input.deals]) {
			if (row.ownerEmail) emails.add(row.ownerEmail);
		}
		for (const row of input.activities) {
			if (row.authorEmail) emails.add(row.authorEmail);
		}

		if (emails.size === 0) return new Map();

		const users = await this.db.user.findMany({
			where: { email: { in: [...emails] } },
			select: { id: true, email: true },
		});

		return new Map(users.map((user) => [user.email, user.id]));
	}

	private async prime(
		push: Push,
		entity: MirrorEntity,
		externalIds: string[],
	): Promise<void> {
		const wanted = [...new Set(externalIds)];
		if (wanted.length === 0) return;

		const rows = await this.db.mirrorRecord.findMany({
			where: { source: push.source, entity, externalId: { in: wanted } },
			select: REF_SELECT,
		});

		for (const externalId of wanted) {
			push.refs.set(refKey(entity, externalId), null);
		}
		for (const row of rows) {
			push.refs.set(refKey(entity, row.externalId), row);
		}
	}

	private ref(
		push: Push,
		entity: MirrorEntity,
		externalId: string,
	): Ref | null {
		return push.refs.get(refKey(entity, externalId)) ?? null;
	}

	private async each<Row extends { externalId: string }>(
		rows: Row[],
		apply: (row: Row) => Promise<Outcome>,
	): Promise<MirrorTally> {
		const tally: MirrorTally = {
			created: 0,
			updated: 0,
			unchanged: 0,
			failed: [],
		};

		for (const row of rows) {
			try {
				tally[await apply(row)] += 1;
			} catch (error) {
				if (error instanceof MirrorRefusal || error instanceof HttpException) {
					tally.failed.push({
						externalId: row.externalId,
						reason: error.message,
					});
					continue;
				}

				this.logger.error(
					{ message: "A mirrored record could not be saved" },
					error instanceof Error ? error.stack : String(error),
				);

				tally.failed.push({ externalId: row.externalId, reason: SAVE_FAILED });
			}
		}

		return tally;
	}

	private async company(push: Push, input: MirrorCompany): Promise<Outcome> {
		const hash = hashOf(input);
		const known = this.ref(push, MirrorEntity.COMPANY, input.externalId);

		if (known?.companyId && known.hash === hash) return "unchanged";

		const domain =
			normalizeDomain(input.domain) ?? domainFromEmail(input.email);
		const ownerId = this.ownerOf(push, input.ownerEmail);

		const details = {
			name: input.name,
			email: normalizeEmail(input.email ?? ""),
			phone: blank(input.phone),
			city: blank(input.city),
			stateCode: blank(input.stateCode),
			country: blank(input.country),
		};

		const saved = await this.db.$transaction(async (tx): Promise<Saved> => {
			const held = await this.claim(tx, push, MirrorEntity.COMPANY, input);

			if (held?.companyId && held.hash === hash) {
				return { id: held.companyId, outcome: "unchanged" };
			}

			const existingId =
				held?.companyId ??
				(await this.adoptableCompany(tx, push.source, domain));

			if (existingId) {
				const current = await tx.company.findUniqueOrThrow({
					where: { id: existingId },
					select: { domain: true, name: true, source: true, ownerId: true },
				});
				const takes =
					domain !== null &&
					current.domain === null &&
					(await domainIsFree(tx, domain));

				await tx.company.update({
					where: { id: existingId },
					data: {
						...present(details),
						name: namedHere(current) ? undefined : details.name,
						ownerId: ownerId ?? (current.ownerId ? undefined : push.actorId),
						domain: takes ? domain : undefined,
						website: takes ? `https://${domain}` : undefined,
					},
				});

				await this.fields.applyValues(
					tx,
					"COMPANY",
					existingId,
					input.fields ?? {},
				);
				await this.settle(tx, push, MirrorEntity.COMPANY, input, hash, {
					companyId: existingId,
				});

				return {
					id: existingId,
					outcome: held?.companyId ? "updated" : "created",
				};
			}

			const free = domain !== null && (await domainIsFree(tx, domain));

			const created = await tx.company.create({
				data: {
					...details,
					domain: free ? domain : null,
					website: free ? `https://${domain}` : null,
					ownerId: ownerId ?? push.actorId,
					source: RecordSource.IMPORT,
					enrichmentStatus: EnrichmentStatus.SKIPPED,
					createdAt: input.createdAt,
				},
				select: { id: true },
			});

			await this.fields.applyValues(
				tx,
				"COMPANY",
				created.id,
				input.fields ?? {},
			);
			await this.settle(tx, push, MirrorEntity.COMPANY, input, hash, {
				companyId: created.id,
			});

			return { id: created.id, outcome: "created" };
		}, TRANSACTION);

		if (saved.outcome !== "unchanged") push.touched.companyIds.add(saved.id);

		return saved.outcome;
	}

	private async contact(push: Push, input: MirrorContact): Promise<Outcome> {
		const hash = hashOf(input);
		const known = this.ref(push, MirrorEntity.CONTACT, input.externalId);

		if (known?.contactId && known.hash === hash) return "unchanged";

		const companyId = input.companyExternalId
			? this.requireCompany(push, input.companyExternalId)
			: null;
		const email = normalizeEmail(input.email ?? "");
		const ownerId = this.ownerOf(push, input.ownerEmail);

		const details = {
			firstName: input.firstName,
			lastName: blank(input.lastName),
			phone: blank(input.phone),
			title: blank(input.title),
		};

		const saved = await this.db.$transaction(async (tx): Promise<Saved> => {
			const held = await this.claim(tx, push, MirrorEntity.CONTACT, input);

			if (held?.contactId && held.hash === hash) {
				return { id: held.contactId, outcome: "unchanged" };
			}

			const existingId =
				held?.contactId ??
				(await this.adoptableContact(tx, push.source, email));

			const holder = email
				? await tx.contact.findFirst({
						where: { email, archivedAt: null },
						select: { id: true },
					})
				: null;
			const mayHoldEmail =
				email !== null && (holder === null || holder.id === existingId);

			if (existingId) {
				const current = await tx.contact.findUniqueOrThrow({
					where: { id: existingId },
					select: { ownerId: true },
				});

				await tx.contact.update({
					where: { id: existingId },
					data: {
						...present(details),
						email: mayHoldEmail ? email : undefined,
						companyId: companyId ?? undefined,
						ownerId: ownerId ?? (current.ownerId ? undefined : push.actorId),
					},
				});

				await this.fields.applyValues(
					tx,
					"CONTACT",
					existingId,
					input.fields ?? {},
				);
				await this.settle(tx, push, MirrorEntity.CONTACT, input, hash, {
					contactId: existingId,
				});

				return {
					id: existingId,
					outcome: held?.contactId ? "updated" : "created",
				};
			}

			const created = await tx.contact.create({
				data: {
					...details,
					email: mayHoldEmail ? email : null,
					companyId,
					ownerId: ownerId ?? push.actorId,
					source: RecordSource.IMPORT,
					enrichmentStatus: EnrichmentStatus.SKIPPED,
					createdAt: input.createdAt,
				},
				select: { id: true },
			});

			await this.fields.applyValues(
				tx,
				"CONTACT",
				created.id,
				input.fields ?? {},
			);
			await this.settle(tx, push, MirrorEntity.CONTACT, input, hash, {
				contactId: created.id,
			});

			return { id: created.id, outcome: "created" };
		}, TRANSACTION);

		if (companyId && saved.outcome !== "unchanged") {
			await this.offerAsPrimary(companyId, saved.id);
		}

		return saved.outcome;
	}

	private async deal(push: Push, input: MirrorDeal): Promise<Outcome> {
		const hash = hashOf(input);
		const known = this.ref(push, MirrorEntity.DEAL, input.externalId);

		if (known?.dealId && known.hash === hash) return "unchanged";

		const companyId = this.requireCompany(push, input.companyExternalId);
		const resolvedOwner = this.ownerOf(push, input.ownerEmail);
		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const amount = decimalFromCents(input.amountCents);
		const fx = await this.conversion.dealFields(amount, currency);
		const closed = isClosedStage(input.stage);
		const now = new Date();
		const createdAt = input.createdAt ?? now;
		const closedAt = closed ? (input.closedAt ?? now) : null;
		const closedReason =
			closed && LOSING.has(input.stage)
				? (blank(input.closedReason) ?? MIRROR.lost.reason)
				: null;

		const contactIds = input.contactExternalIds.flatMap(
			(externalId) =>
				this.ref(push, MirrorEntity.CONTACT, externalId)?.contactId ?? [],
		);

		const shared = {
			name: input.name,
			description: blank(input.description),
			companyId,
			stage: input.stage,
			closedAt,
			closedReason,
			currency,
			expectedCloseDate: input.expectedCloseDate ?? null,
		};

		const saved = await this.db.$transaction(async (tx): Promise<Saved> => {
			const held = await this.claim(tx, push, MirrorEntity.DEAL, input);

			if (held?.dealId && held.hash === hash) {
				return { id: held.dealId, outcome: "unchanged" };
			}

			const current = held?.dealId
				? await tx.deal.findUnique({
						where: { id: held.dealId },
						select: {
							id: true,
							stage: true,
							amount: true,
							currency: true,
							ownerId: true,
						},
					})
				: null;

			if (current) {
				const repriced =
					current.currency !== currency || !sameAmount(current.amount, amount);
				const moved = current.stage !== input.stage;
				const movedAt = closedAt ?? now;

				await tx.deal.update({
					where: { id: current.id },
					data: {
						...shared,
						ownerId: resolvedOwner ?? undefined,
						...(repriced ? { amount, ...fx } : undefined),
						stageChangedAt: moved ? movedAt : undefined,
					},
				});

				if (moved) {
					await tx.activity.create({
						data: {
							type: ActivityType.STAGE_CHANGE,
							subject: MIRROR.stageChange.subject,
							body: closedReason,
							occurredAt: movedAt,
							createdAt: movedAt,
							companyId,
							dealId: current.id,
							createdById: resolvedOwner ?? current.ownerId,
							meta: {
								from: current.stage,
								to: input.stage,
								source: push.source,
							},
						},
					});
				}

				await this.linkContacts(tx, current.id, contactIds);
				await this.fields.applyValues(
					tx,
					"DEAL",
					current.id,
					input.fields ?? {},
				);
				await this.settle(tx, push, MirrorEntity.DEAL, input, hash, {
					dealId: current.id,
				});

				return { id: current.id, outcome: "updated" };
			}

			const created = await tx.deal.create({
				data: {
					...shared,
					ownerId: resolvedOwner ?? push.actorId,
					amount,
					...fx,
					stageChangedAt: closedAt ?? createdAt,
					createdAt,
				},
				select: { id: true },
			});

			await this.linkContacts(tx, created.id, contactIds);
			await this.fields.applyValues(tx, "DEAL", created.id, input.fields ?? {});
			await this.settle(tx, push, MirrorEntity.DEAL, input, hash, {
				dealId: created.id,
			});

			return { id: created.id, outcome: "created" };
		}, TRANSACTION);

		if (saved.outcome !== "unchanged") {
			push.touched.dealIds.add(saved.id);
			push.touched.companyIds.add(companyId);
		}

		return saved.outcome;
	}

	private async activity(push: Push, input: MirrorActivity): Promise<Outcome> {
		const hash = hashOf(input);
		const known = this.ref(push, MirrorEntity.ACTIVITY, input.externalId);

		if (known?.activityId && known.hash === hash) return "unchanged";

		const dealId = input.dealExternalId
			? this.requireDeal(push, input.dealExternalId)
			: null;
		const contactId = input.contactExternalId
			? this.requireContact(push, input.contactExternalId)
			: null;
		const companyId = input.companyExternalId
			? this.requireCompany(push, input.companyExternalId)
			: await this.companyOfDeal(dealId);

		const data = {
			type: ActivityType.NOTE,
			subject: input.subject,
			body: blank(input.body),
			occurredAt: input.occurredAt,
			createdAt: input.occurredAt,
			companyId,
			contactId,
			dealId,
			meta: { source: push.source },
		};

		const saved = await this.db.$transaction(async (tx): Promise<Saved> => {
			const held = await this.claim(tx, push, MirrorEntity.ACTIVITY, input);

			if (held?.activityId && held.hash === hash) {
				return { id: held.activityId, outcome: "unchanged" };
			}

			const current = held?.activityId
				? await tx.activity.findUnique({
						where: { id: held.activityId },
						select: { id: true },
					})
				: null;

			const written = current
				? await tx.activity.update({
						where: { id: current.id },
						data,
						select: { id: true },
					})
				: await tx.activity.create({
						data: {
							...data,
							createdById:
								this.ownerOf(push, input.authorEmail) ?? push.actorId,
						},
						select: { id: true },
					});

			await this.settle(tx, push, MirrorEntity.ACTIVITY, input, hash, {
				activityId: written.id,
			});

			return { id: written.id, outcome: current ? "updated" : "created" };
		}, TRANSACTION);

		if (saved.outcome === "unchanged") return saved.outcome;

		if (companyId) push.touched.companyIds.add(companyId);
		if (contactId) push.touched.contactIds.add(contactId);
		if (dealId) push.touched.dealIds.add(dealId);

		return saved.outcome;
	}

	private ownerOf(push: Push, email: string | null | undefined): string | null {
		return email ? (push.owners.get(email) ?? null) : null;
	}

	private requireCompany(push: Push, externalId: string): string {
		const companyId = this.ref(
			push,
			MirrorEntity.COMPANY,
			externalId,
		)?.companyId;

		if (!companyId) {
			throw new MirrorRefusal(`A empresa ${externalId} não foi espelhada.`);
		}

		return companyId;
	}

	private requireContact(push: Push, externalId: string): string {
		const contactId = this.ref(
			push,
			MirrorEntity.CONTACT,
			externalId,
		)?.contactId;

		if (!contactId) {
			throw new MirrorRefusal(`O contato ${externalId} não foi espelhado.`);
		}

		return contactId;
	}

	private requireDeal(push: Push, externalId: string): string {
		const dealId = this.ref(push, MirrorEntity.DEAL, externalId)?.dealId;

		if (!dealId) {
			throw new MirrorRefusal(`O negócio ${externalId} não foi espelhado.`);
		}

		return dealId;
	}

	private async companyOfDeal(dealId: string | null): Promise<string | null> {
		if (!dealId) return null;

		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: { companyId: true },
		});

		return deal?.companyId ?? null;
	}

	private async adoptableCompany(
		tx: Prisma.TransactionClient,
		source: string,
		domain: string | null,
	): Promise<string | null> {
		if (!domain) return null;

		const company = await tx.company.findFirst({
			where: {
				domain,
				archivedAt: null,
				mirrorRecords: { none: { source, entity: MirrorEntity.COMPANY } },
			},
			select: { id: true },
		});

		return company?.id ?? null;
	}

	private async adoptableContact(
		tx: Prisma.TransactionClient,
		source: string,
		email: string | null,
	): Promise<string | null> {
		if (!email) return null;

		const contact = await tx.contact.findFirst({
			where: {
				email,
				archivedAt: null,
				mirrorRecords: { none: { source, entity: MirrorEntity.CONTACT } },
			},
			select: { id: true },
		});

		return contact?.id ?? null;
	}

	private async offerAsPrimary(
		companyId: string,
		contactId: string,
	): Promise<void> {
		const alreadyPrimary = await this.db.company.findFirst({
			where: { primaryContactId: contactId },
			select: { id: true },
		});

		if (alreadyPrimary) return;

		await this.db.company.updateMany({
			where: { id: companyId, primaryContactId: null },
			data: { primaryContactId: contactId },
		});
	}

	private async linkContacts(
		tx: Prisma.TransactionClient,
		dealId: string,
		contactIds: string[],
	): Promise<void> {
		if (contactIds.length === 0) return;

		await tx.dealContact.createMany({
			data: contactIds.map((contactId) => ({ dealId, contactId })),
			skipDuplicates: true,
		});
	}

	private async claim(
		tx: Prisma.TransactionClient,
		push: Push,
		entity: MirrorEntity,
		input: { externalId: string },
	): Promise<Ref | null> {
		const lock = `${MIRROR.lock.namespace}:${push.source}:${entity}:${input.externalId}`;

		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;

		const held = await tx.mirrorRecord.findUnique({
			where: {
				source_entity_externalId: {
					source: push.source,
					entity,
					externalId: input.externalId,
				},
			},
			select: REF_SELECT,
		});

		push.refs.set(refKey(entity, input.externalId), held);

		return held;
	}

	private async settle(
		tx: Prisma.TransactionClient,
		push: Push,
		entity: MirrorEntity,
		input: {
			externalId: string;
			ownerEmail?: string | null;
			authorEmail?: string | null;
		},
		hash: string,
		target: Target,
	): Promise<void> {
		const ownerEmail = input.ownerEmail ?? null;

		const row = await tx.mirrorRecord.upsert({
			where: {
				source_entity_externalId: {
					source: push.source,
					entity,
					externalId: input.externalId,
				},
			},
			create: {
				source: push.source,
				entity,
				externalId: input.externalId,
				hash,
				ownerEmail,
				...target,
			},
			update: { hash, ownerEmail, ...target },
			select: REF_SELECT,
		});

		push.refs.set(refKey(entity, input.externalId), row);
	}

	private async ownTheUnowned(push: Push): Promise<void> {
		const unowned = {
			ownerId: null,
			mirrorRecords: { some: { source: push.source } },
		};

		await Promise.all([
			this.db.company.updateMany({
				where: unowned,
				data: { ownerId: push.actorId },
			}),
			this.db.contact.updateMany({
				where: unowned,
				data: { ownerId: push.actorId },
			}),
		]);
	}

	private async reconcileOwners(source: string): Promise<number> {
		const named = await this.db.mirrorRecord.findMany({
			where: { source, ownerEmail: { not: null } },
			distinct: ["ownerEmail"],
			select: { ownerEmail: true },
		});

		const emails = named.flatMap((row) => row.ownerEmail ?? []);
		if (emails.length === 0) return 0;

		const users = await this.db.user.findMany({
			where: { email: { in: emails } },
			select: { id: true, email: true },
		});

		let reassigned = 0;

		for (const user of users) {
			const theirs = {
				mirrorRecords: { some: { source, ownerEmail: user.email } },
			};
			const notTheirs = {
				OR: [{ ownerId: null }, { ownerId: { not: user.id } }],
			};

			const [deals, companies, contacts] = await Promise.all([
				this.db.deal.updateMany({
					where: { ...theirs, ownerId: { not: user.id } },
					data: { ownerId: user.id },
				}),
				this.db.company.updateMany({
					where: { ...theirs, ...notTheirs },
					data: { ownerId: user.id },
				}),
				this.db.contact.updateMany({
					where: { ...theirs, ...notTheirs },
					data: { ownerId: user.id },
				}),
			]);

			reassigned += deals.count + companies.count + contacts.count;
		}

		return reassigned;
	}
}

const STATUS_KEY = {
	COMPANY: "companies",
	CONTACT: "contacts",
	DEAL: "deals",
	ACTIVITY: "activities",
} as const satisfies Record<MirrorEntity, string>;

function refKey(entity: MirrorEntity, externalId: string): string {
	return `${entity}:${externalId}`;
}

function hashOf(
	input: MirrorCompany | MirrorContact | MirrorDeal | MirrorActivity,
): string {
	return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function blank(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function namedHere(company: {
	name: string;
	domain: string | null;
	source: RecordSource;
}): boolean {
	if (company.source === RecordSource.IMPORT) return false;

	return company.name.trim().toLowerCase() !== company.domain?.toLowerCase();
}

function present<Row extends Record<string, string | null>>(
	row: Row,
): Partial<Row> {
	const kept: Partial<Row> = {};

	for (const key of Object.keys(row) as Array<keyof Row>) {
		if (row[key] !== null) kept[key] = row[key];
	}

	return kept;
}

function sameAmount(
	a: Prisma.Decimal | null,
	b: Prisma.Decimal | null,
): boolean {
	if (a === null || b === null) return a === b;
	return a.equals(b);
}

function counts(tally: MirrorTally) {
	return {
		created: tally.created,
		updated: tally.updated,
		unchanged: tally.unchanged,
		failed: tally.failed.length,
	};
}

async function domainIsFree(
	tx: Prisma.TransactionClient,
	domain: string,
): Promise<boolean> {
	const holder = await tx.company.findFirst({
		where: { domain, archivedAt: null },
		select: { id: true },
	});

	return holder === null;
}
