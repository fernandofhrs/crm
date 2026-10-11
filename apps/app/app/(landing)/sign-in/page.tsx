import type { MailboxProviderId } from "@crm/auth/scopes";
import { FieldSeparator } from "@crm/ui/components/field";
import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ImapSignIn } from "./imap-sign-in";
import { SocialSignIn } from "./social-sign-in";
import { type SsoProvider, SsoSignIn } from "./sso-sign-in";

export const metadata: Metadata = {
	title: "Entrar",
};

type SignInOptions = {
	google: boolean;
	microsoft: boolean;
	imap: boolean;
	providers: SsoProvider[];
};

async function signInOptions(): Promise<SignInOptions | null> {
	try {
		return await getServerQueryClient().fetchQuery(
			getServerTrpc().sso.signInOptions.queryOptions(),
		);
	} catch (error) {
		unstable_rethrow(error);
		console.error("Sign-in: could not read the sign-in options.", error);
		return null;
	}
}

async function currentSession() {
	try {
		return await getSession();
	} catch (error) {
		unstable_rethrow(error);
		console.error("Sign-in: could not read the session.", error);
		return null;
	}
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
	return (
		<AuthShell>
			<Suspense
				fallback={
					<AuthHeading
						title="Que bom ver você de novo"
						description="Entre com sua conta para continuar."
					/>
				}
			>
				<SignIn searchParams={searchParams} />
			</Suspense>
		</AuthShell>
	);
}

async function SignIn({
	searchParams,
}: Pick<PageProps<"/sign-in">, "searchParams">) {
	const [session, options, { method }] = await Promise.all([
		currentSession(),
		signInOptions(),
		searchParams,
	]);

	if (session) {
		redirect("/");
	}

	const configured: MailboxProviderId[] = [];
	if (options?.google ?? true) configured.push("google");
	if (options?.microsoft ?? false) configured.push("microsoft");

	const providers = options?.providers ?? [];

	const insisted = configured.find((provider) => provider === method);
	const showSso = providers.length > 0 && insisted === undefined;
	const social =
		insisted !== undefined
			? [insisted]
			: providers.length === 0
				? configured
				: [];

	const showImap = (options?.imap ?? false) && insisted === undefined;
	const showOthers = showSso || social.length > 0;

	if (!showOthers && !showImap) {
		return (
			<>
				<AuthHeading
					title="Ainda não há como entrar"
					description="Este CRM não tem nenhuma forma de entrar configurada, então ninguém consegue acessar, nem você."
				/>

				<p className="text-center text-muted-foreground text-sm/5">
					Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (ou MICROSOFT_CLIENT_ID
					e MICROSOFT_CLIENT_SECRET, ou IMAP_HOST e IMAP_SIGN_IN) no arquivo
					.env da raiz e reinicie. Seu próprio provedor de identidade pode ser
					adicionado em Configurações depois que alguém entrar.
				</p>
			</>
		);
	}

	return (
		<>
			<AuthHeading
				title="Que bom ver você de novo"
				description="Entre com sua conta para continuar."
			/>

			{showImap ? <ImapSignIn /> : null}
			{showImap && showOthers ? <FieldSeparator>ou</FieldSeparator> : null}
			{showSso ? <SsoSignIn providers={providers} /> : null}
			{social.map((provider) => (
				<SocialSignIn key={provider} provider={provider} />
			))}
		</>
	);
}
