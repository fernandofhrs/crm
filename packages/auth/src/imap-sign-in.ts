import "@crm/env/load";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { IMAP_SIGN_IN } from "./imap-sign-in-config";
import { isWorkspaceEmail } from "./workspace";

export type ImapSignInCredentials = {
	address: string;
	password: string;
};

export type ImapSignInVerdict = "accepted" | "refused" | "unavailable";

export type ImapSignInHost = {
	verify(credentials: ImapSignInCredentials): Promise<ImapSignInVerdict>;
	connect(userId: string, credentials: ImapSignInCredentials): Promise<void>;
};

let host: ImapSignInHost | null = null;

export function hostImapSignIn(next: ImapSignInHost | null): void {
	host = next;
}

export function imapSignInDomains(): readonly string[] {
	if (!process.env.IMAP_HOST?.trim()) return [];

	return (process.env.IMAP_SIGN_IN ?? "")
		.split(",")
		.map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
		.filter(Boolean);
}

export function isImapSignInEnabled(): boolean {
	return imapSignInDomains().length > 0;
}

export function acceptsImapSignIn(address: string): boolean {
	const parts = address.trim().toLowerCase().split("@");
	if (parts.length !== 2) return false;

	const [local, domain] = parts;
	if (!local || !domain) return false;

	return imapSignInDomains().includes(domain) && isWorkspaceEmail(address);
}

export function nameFromAddress(address: string): string {
	const local = address.split("@").at(0) ?? address;

	const words = local
		.split(/[._+-]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1));

	return words.join(" ") || address;
}

const signInBody = z.object({
	email: z
		.string()
		.trim()
		.toLowerCase()
		.max(IMAP_SIGN_IN.input.addressMax)
		.pipe(z.email()),
	password: z.string().min(1).max(IMAP_SIGN_IN.input.passwordMax),
});

export const imapSignIn = () =>
	({
		id: IMAP_SIGN_IN.pluginId,
		endpoints: {
			signInImap: createAuthEndpoint(
				IMAP_SIGN_IN.path,
				{ method: "POST", body: signInBody },
				async (ctx) => {
					const { email: address, password } = ctx.body;

					if (!isImapSignInEnabled()) {
						throw new APIError("NOT_FOUND", {
							message: "Mailbox sign-in is not enabled on this install.",
						});
					}

					if (!acceptsImapSignIn(address)) {
						throw new APIError("FORBIDDEN", {
							message: `This CRM is private. Sign in with a mailbox at ${imapSignInDomains().join(" or ")}.`,
						});
					}

					if (!host) {
						throw new APIError("SERVICE_UNAVAILABLE", {
							message: "Mailbox sign-in is not available right now.",
						});
					}

					const verdict = await host.verify({ address, password });

					if (verdict === "refused") {
						throw new APIError("UNAUTHORIZED", {
							message: "The mail server refused that address and password.",
						});
					}

					if (verdict !== "accepted") {
						throw new APIError("SERVICE_UNAVAILABLE", {
							message: "The mail server could not be reached. Try again.",
						});
					}

					const adapter = ctx.context.internalAdapter;
					const found = await adapter.findUserByEmail(address, {
						includeAccounts: true,
					});

					const user =
						found?.user ??
						(await adapter.createUser({
							email: address,
							name: nameFromAddress(address),
							emailVerified: true,
						}));

					const linked = found?.accounts.some(
						(account) => account.providerId === IMAP_SIGN_IN.providerId,
					);

					if (!linked) {
						await adapter.linkAccount({
							userId: user.id,
							providerId: IMAP_SIGN_IN.providerId,
							accountId: address,
						});
					}

					const session = await adapter.createSession(user.id);
					await setSessionCookie(ctx, { session, user });

					try {
						await host.connect(user.id, { address, password });
					} catch (error) {
						console.error(
							"[auth] the mailbox was not connected at sign-in",
							error instanceof Error ? error.message : "unknown error",
						);
					}

					return ctx.json({
						user: { id: user.id, email: user.email, name: user.name },
					});
				},
			),
		},
		rateLimit: [
			{
				pathMatcher: (path) => path === IMAP_SIGN_IN.path,
				window: IMAP_SIGN_IN.attempts.windowSeconds,
				max: IMAP_SIGN_IN.attempts.max,
			},
		],
	}) satisfies BetterAuthPlugin;
