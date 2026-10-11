import { Button } from "@crm/ui/components/button";
import Link from "next/link";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { ConnectionPage, ConnectionPageLoading } from "../connection-page";

export default function IntakeConnectionPage(
	props: PageProps<"/[slug]/settings/connections/intake">,
) {
	return (
		<Suspense fallback={<ConnectionPageLoading />}>
			<IntakeConnectionPageContent {...props} />
		</Suspense>
	);
}

async function IntakeConnectionPageContent({
	params,
}: PageProps<"/[slug]/settings/connections/intake">) {
	await requireSession();
	const { slug } = await params;

	return (
		<ConnectionPage centered className="max-w-(--container-narrow) text-center">
			<header className="flex flex-col gap-3 px-(--spacing-block-inline)">
				<h1 className="font-medium text-2xl tracking-tight">
					Endpoint de intake
				</h1>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Esta conexão ainda não está disponível. Nenhum endpoint, chave de API
					ou atividade de intake foi criado para este espaço de trabalho.
				</p>
			</header>
			<div>
				<Button asChild variant="outline">
					<Link href={`/${slug}/settings/connections`}>
						Voltar para conexões
					</Link>
				</Button>
			</div>
		</ConnectionPage>
	);
}
