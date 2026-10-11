import { apiKeyClient } from "@better-auth/api-key/client";
import { ssoClient } from "@better-auth/sso/client";
import type { BetterAuthClientPlugin } from "better-auth";
import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { imapSignIn } from "./imap-sign-in";
import { IMAP_SIGN_IN } from "./imap-sign-in-config";

const imapSignInClient = () =>
	({
		id: IMAP_SIGN_IN.pluginId,
		$InferServerPlugin: {} as ReturnType<typeof imapSignIn>,
	}) satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({
	baseURL: globalThis.window?.location.origin,
	plugins: [
		ssoClient(),
		genericOAuthClient(),
		apiKeyClient(),
		imapSignInClient(),
	],
});

export const { getSession, signIn, signOut, useSession } = authClient;

export type AuthClient = typeof authClient;
