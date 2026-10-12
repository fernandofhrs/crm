import "@crm/env/load";
import { db } from "@crm/db";
import type { BetterAuthPlugin } from "better-auth";
import {
	APIError,
	createAuthEndpoint,
	getSessionFromCtx,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { env } from "./env";
import { nameFromAddress } from "./imap-sign-in";
import { isWorkspaceAdmin, workspaceRoleOf } from "./organization";
import {
	PORTAL_SIGN_IN,
	type PortalRefusal,
	portalLandingPath,
} from "./portal-sign-in-config";
import { type PortalTicketClaims, readPortalTicket } from "./portal-ticket";
import { isWorkspaceEmail } from "./workspace";

function portalSignInSecret(): string | null {
	const secret = process.env[PORTAL_SIGN_IN.secretVariable]?.trim() ?? "";

	return secret.length >= PORTAL_SIGN_IN.secretMinLength ? secret : null;
}

function refusalUrl(reason: PortalRefusal): string {
	const url = new URL(PORTAL_SIGN_IN.signInPath, env.appUrl);
	url.searchParams.set(PORTAL_SIGN_IN.refusalParam, reason);

	return url.toString();
}

async function spendTicket(ticket: PortalTicketClaims): Promise<boolean> {
	const now = new Date();

	await db.portalTicket.deleteMany({ where: { expiresAt: { lt: now } } });

	const kept = new Date(
		(ticket.exp + PORTAL_SIGN_IN.ticket.clockSkewSeconds * 2) * 1_000,
	);

	const spent = await db.portalTicket.createMany({
		data: [{ id: ticket.jti, expiresAt: kept }],
		skipDuplicates: true,
	});

	return spent.count === 1;
}

const signInQuery = z.object({
	ticket: z.string().min(1).max(PORTAL_SIGN_IN.ticket.maxLength),
	to: z.string().max(PORTAL_SIGN_IN.input.pathMax).optional(),
});

export const portalSignIn = () =>
	({
		id: PORTAL_SIGN_IN.pluginId,
		endpoints: {
			signInPortal: createAuthEndpoint(
				PORTAL_SIGN_IN.path,
				{ method: "GET", query: signInQuery },
				async (ctx) => {
					const secret = portalSignInSecret();

					if (!secret) {
						throw new APIError("NOT_FOUND", {
							message:
								"A entrada pelo Portal não está ativada nesta instalação.",
						});
					}

					const reading = readPortalTicket(
						ctx.query.ticket,
						secret,
						new Date(),
					);

					if (!reading.ok) {
						throw ctx.redirect(
							refusalUrl(reading.reason === "expired" ? "expired" : "refused"),
						);
					}

					const ticket = reading.claims;
					const landing = new URL(
						portalLandingPath(ctx.query.to),
						env.appUrl,
					).toString();

					if (!isWorkspaceEmail(ticket.email)) {
						throw ctx.redirect(refusalUrl("forbidden"));
					}

					const current = await getSessionFromCtx(ctx);

					if (current?.user.email.toLowerCase() === ticket.email) {
						throw ctx.redirect(landing);
					}

					const adapter = ctx.context.internalAdapter;
					const found = await adapter.findUserByEmail(ticket.email, {
						includeAccounts: true,
					});

					if (found && isWorkspaceAdmin(await workspaceRoleOf(found.user.id))) {
						throw ctx.redirect(current ? landing : refusalUrl("direct"));
					}

					if (!(await spendTicket(ticket))) {
						throw ctx.redirect(refusalUrl("refused"));
					}

					const user =
						found?.user ??
						(await adapter.createUser({
							email: ticket.email,
							name: ticket.name || nameFromAddress(ticket.email),
							emailVerified: true,
						}));

					const linked = found?.accounts.some(
						(account) => account.providerId === PORTAL_SIGN_IN.providerId,
					);

					if (!linked) {
						await adapter.linkAccount({
							userId: user.id,
							providerId: PORTAL_SIGN_IN.providerId,
							accountId: ticket.sub,
						});
					}

					const session = await adapter.createSession(user.id);
					await setSessionCookie(ctx, { session, user });

					throw ctx.redirect(landing);
				},
			),
		},
		rateLimit: [
			{
				pathMatcher: (path) => path === PORTAL_SIGN_IN.path,
				window: PORTAL_SIGN_IN.attempts.windowSeconds,
				max: PORTAL_SIGN_IN.attempts.max,
			},
		],
	}) satisfies BetterAuthPlugin;
