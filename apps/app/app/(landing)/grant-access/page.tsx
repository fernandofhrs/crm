import {
	isIdentityOnlySignIn,
	type MailboxProviderId,
	mailboxGrantsNeeded,
} from "@crm/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireSession, signInAccounts } from "@/lib/session";
import { GrantAccess } from "./grant-access";

export const metadata: Metadata = {
	title: "Conceder acesso",
};

export const instant = false;

const DESCRIPTION = {
	google:
		"Este CRM lê seu Gmail e sua agenda para que reuniões e conversas de e-mail apareçam na empresa certa. O acesso é só de leitura: nada é enviado em seu nome.",
	microsoft:
		"Este CRM lê seu e-mail do Outlook para que as conversas de e-mail apareçam na empresa certa. O acesso é só de leitura: nada é enviado em seu nome.",
} satisfies Record<MailboxProviderId, string>;

const BOTH =
	"Este CRM lê seu e-mail e sua agenda para que reuniões e conversas de e-mail apareçam na empresa certa. O acesso é só de leitura: nada é enviado em seu nome.";

export default async function GrantAccessPage() {
	const { user } = await requireSession();

	if (isIdentityOnlySignIn()) {
		redirect("/");
	}

	const providers = mailboxGrantsNeeded(await signInAccounts(user.id));

	if (providers.length === 0) {
		redirect("/");
	}

	const only = providers.length === 1 ? providers[0] : undefined;

	return (
		<AuthShell>
			<AuthHeading
				title="Só mais um passo"
				description={(only ? DESCRIPTION[only] : undefined) ?? BOTH}
			/>

			<GrantAccess providers={providers} />

			<p className="text-center text-muted-foreground text-sm/5">
				Só as conversas com empresas que estão no CRM são guardadas. E-mails
				pessoais são descartados sem serem salvos.
			</p>
		</AuthShell>
	);
}
