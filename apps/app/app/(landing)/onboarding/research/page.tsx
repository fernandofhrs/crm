import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { ResearchForm } from "./research-form";

export const metadata: Metadata = {
	title: "Chave de pesquisa",
};

export const instant = false;

export default async function ResearchKeyPage() {
	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading
				title="Melhore os dados do seu CRM"
				description="Use o Context no seu agente de pesquisa para pesquisar cada empresa adicionada ao CRM."
			/>

			<ResearchForm />
		</AuthShell>
	);
}
