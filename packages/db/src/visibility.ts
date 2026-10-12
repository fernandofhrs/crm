import type { Db } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { ADMIN_ROLES, WORKSPACE_ID } from "./workspace";

export type Viewer =
	| { readonly sees: "everything" }
	| { readonly sees: "own"; readonly userId: string };

export const SEES_EVERYTHING: Viewer = { sees: "everything" };

export function viewerLimitedTo(userId: string): Viewer {
	return { sees: "own", userId };
}

export function seesEverything(viewer: Viewer): boolean {
	return viewer.sees === "everything";
}

export async function viewerOf(
	db: Pick<Db, "member">,
	userId: string,
): Promise<Viewer> {
	const member = await db.member.findUnique({
		where: { organizationId_userId: { organizationId: WORKSPACE_ID, userId } },
		select: { role: true },
	});

	return member && ADMIN_ROLES.includes(member.role)
		? SEES_EVERYTHING
		: viewerLimitedTo(userId);
}

export type RecordKind = "company" | "contact" | "deal";

export type RecordRef = { readonly kind: RecordKind; readonly id: string };

type RecordReader = Pick<Db, "company" | "contact" | "deal">;

export async function isVisibleTo(
	db: RecordReader,
	viewer: Viewer,
	record: RecordRef,
): Promise<boolean> {
	if (viewer.sees === "everything") return true;

	const { id } = record;

	if (record.kind === "company") {
		const found = await db.company.count({
			where: { id, AND: [companiesVisibleTo(viewer)] },
		});
		return found > 0;
	}

	if (record.kind === "contact") {
		const found = await db.contact.count({
			where: { id, AND: [contactsVisibleTo(viewer)] },
		});
		return found > 0;
	}

	const found = await db.deal.count({
		where: { id, AND: [dealsVisibleTo(viewer)] },
	});
	return found > 0;
}

export function companiesVisibleTo(viewer: Viewer): Prisma.CompanyWhereInput {
	if (viewer.sees === "everything") return {};

	const ownerId = viewer.userId;

	return {
		OR: [
			{ ownerId },
			{ deals: { some: { ownerId } } },
			{ contacts: { some: { ownerId } } },
		],
	};
}

export function contactsVisibleTo(viewer: Viewer): Prisma.ContactWhereInput {
	if (viewer.sees === "everything") return {};

	return {
		OR: [
			{ company: companiesVisibleTo(viewer) },
			{ companyId: null, ownerId: viewer.userId },
		],
	};
}

export function dealsVisibleTo(viewer: Viewer): Prisma.DealWhereInput {
	if (viewer.sees === "everything") return {};

	return { company: companiesVisibleTo(viewer) };
}

export function activitiesVisibleTo(viewer: Viewer): Prisma.ActivityWhereInput {
	if (viewer.sees === "everything") return {};

	return {
		OR: [
			{ company: companiesVisibleTo(viewer) },
			{ deal: dealsVisibleTo(viewer) },
			{ contact: contactsVisibleTo(viewer) },
			{
				companyId: null,
				contactId: null,
				dealId: null,
				createdById: viewer.userId,
			},
		],
	};
}

export function emailThreadsVisibleTo(
	viewer: Viewer,
): Prisma.EmailThreadWhereInput {
	if (viewer.sees === "everything") return {};

	return {
		OR: [
			{ company: companiesVisibleTo(viewer) },
			{ contact: contactsVisibleTo(viewer) },
		],
	};
}

export function calendarEventsVisibleTo(
	viewer: Viewer,
): Prisma.CalendarEventWhereInput {
	if (viewer.sees === "everything") return {};

	return {
		OR: [
			{ company: companiesVisibleTo(viewer) },
			{ contact: contactsVisibleTo(viewer) },
		],
	};
}
