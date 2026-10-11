"use client";

import Column from "@carbon/icons-react/es/Column";
import List from "@carbon/icons-react/es/List";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useQueryState } from "nuqs";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import {
	DEALS_VIEWS,
	type DealsView,
	dealsViewParsers,
} from "./deals-board-config";

function isView(value: string): value is DealsView {
	return (DEALS_VIEWS as readonly string[]).includes(value);
}

const LABEL = "Como mostrar os negócios";

function ViewItems() {
	return (
		<>
			<ToggleGroupItem value="board">
				<Column data-icon="inline-start" />
				Quadro
			</ToggleGroupItem>
			<ToggleGroupItem value="list">
				<List data-icon="inline-start" />
				Lista
			</ToggleGroupItem>
		</>
	);
}

export function DealsViewToggle() {
	const [view, setView] = useQueryState(
		SEARCH_PARAM.deals.view,
		dealsViewParsers[SEARCH_PARAM.deals.view],
	);

	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			spacing={0}
			value={view}
			onValueChange={(next) => {
				if (isView(next)) void setView(next);
			}}
			aria-label={LABEL}
		>
			<ViewItems />
		</ToggleGroup>
	);
}
