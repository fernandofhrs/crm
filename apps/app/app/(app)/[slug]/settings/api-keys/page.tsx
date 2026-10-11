import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { apiKeysSearchParams } from "./api-keys-search-params";
import { ApiKeysTable } from "./api-keys-table";
import { CreateApiKeySheet } from "./create-api-key-sheet";

export const metadata: Metadata = {
	title: "Chaves de API",
};

export default function ApiKeysSettingsPage({
	searchParams,
}: PageProps<"/[slug]/settings/api-keys">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Chaves de API</PageShellTitle>
					<PageShellDescription>
						Chaves pessoais para chamar a API do CRM. Cada uma age como você: lê
						e altera exatamente o que você pode ler e alterar.
					</PageShellDescription>
				</PageShellHeading>

				<PageShellActions>
					<CreateApiKeySheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<ApiKeys searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function ApiKeys({
	searchParams,
}: Pick<PageProps<"/[slug]/settings/api-keys">, "searchParams">) {
	await requireSession();

	const values = await apiKeysSearchParams.load(searchParams);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(
		trpc.apiKeys.list.queryOptions(apiKeysSearchParams.toInput(values)),
	);

	return (
		<HydrateClient>
			<ApiKeysTable />
		</HydrateClient>
	);
}
