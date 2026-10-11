"use client";

import { useQueryState } from "nuqs";
import { PageShellDescription, PageShellTitle } from "@/components/page-shell";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { overviewParsers } from "./overview-search-params";

export function OverviewGreetingFallback() {
	return (
		<>
			<PageShellTitle>Que bom ver você de novo</PageShellTitle>
			<PageShellDescription>
				O que você ganhou, o que está em andamento e o que precisa de você hoje.
			</PageShellDescription>
		</>
	);
}

export function OverviewGreeting() {
	const [scope] = useQueryState(
		SEARCH_PARAM.overview.scope,
		overviewParsers[SEARCH_PARAM.overview.scope],
	);

	return (
		<>
			<PageShellTitle>Que bom ver você de novo</PageShellTitle>
			<PageShellDescription>
				{scope === "me"
					? "O que você ganhou, o que está em andamento e o que precisa de você hoje."
					: "O que o time ganhou, o que está em andamento e o que precisa de você hoje."}
			</PageShellDescription>
		</>
	);
}
