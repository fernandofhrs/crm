import { db } from "@crm/db";
import {
	isVisibleTo,
	type RecordKind,
	type RecordRef,
	SEES_EVERYTHING,
	seesEverything,
	type Viewer,
	viewerOf,
} from "@crm/db/visibility";
import { APP_AUTH } from "./app-auth";
import { attribute } from "./session-purpose";

type Principal = {
	readonly principalId: string;
	readonly principalType: string;
	readonly attributes: Readonly<Record<string, string | readonly string[]>>;
};

export type ViewerContext = {
	readonly session: {
		readonly auth: {
			readonly current: Principal | null;
			readonly initiator: Principal | null;
		};
	};
};

export const RECORD_KIND = {
	COMPANY: "company",
	CONTACT: "contact",
	DEAL: "deal",
} as const satisfies Record<string, RecordKind>;

const MISSING = {
	company: "No such company.",
	contact: "No such contact.",
	deal: "No such deal.",
} as const satisfies Record<RecordKind, string>;

export async function viewerFor(ctx: ViewerContext): Promise<Viewer> {
	const { current, initiator } = ctx.session.auth;
	const principals = [current, initiator].filter(
		(principal) => principal !== null,
	);

	if (principals.length === 0) {
		throw new Error("This session has no caller. It reads no CRM record.");
	}

	const named = attribute(ctx, "userId");
	const viewers = await Promise.all([
		...(named ? [viewerOf(db, named)] : []),
		...principals.map(viewerOfPrincipal),
	]);

	return viewers.find((viewer) => !seesEverything(viewer)) ?? SEES_EVERYTHING;
}

export async function sees(
	ctx: ViewerContext,
	record: RecordRef,
): Promise<boolean> {
	return isVisibleTo(db, await viewerFor(ctx), record);
}

export async function assertSees(
	ctx: ViewerContext,
	record: RecordRef,
): Promise<void> {
	if (await sees(ctx, record)) return;

	throw new Error(MISSING[record.kind]);
}

export async function assertVisible(
	viewer: Viewer,
	record: RecordRef,
): Promise<void> {
	if (await isVisibleTo(db, viewer, record)) return;

	throw new Error(MISSING[record.kind]);
}

async function viewerOfPrincipal(principal: Principal): Promise<Viewer> {
	if (principal.principalType === "user") {
		return viewerOf(db, principal.principalId);
	}
	if (principal.principalId === APP_AUTH.principalId) return SEES_EVERYTHING;

	const members = await db.member.count({
		where: { userId: principal.principalId },
	});

	return members > 0 ? viewerOf(db, principal.principalId) : SEES_EVERYTHING;
}
