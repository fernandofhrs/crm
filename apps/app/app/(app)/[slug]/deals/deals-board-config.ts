import { DealStage } from "@crm/db/enums";
import { createLoader, parseAsStringLiteral } from "nuqs/server";
import { SEARCH_PARAM } from "@/lib/search-param-keys";

export const DEALS_VIEWS = ["board", "list"] as const;

export type DealsView = (typeof DEALS_VIEWS)[number];

export const DEALS_BOARD = {
	pageSize: 30,
	columns: [
		{ stage: DealStage.DEMO_BOOKED, sort: "amount" },
		{ stage: DealStage.QUALIFIED_TO_BUY, sort: "amount" },
		{ stage: DealStage.DECISION_MAKER_BOUGHT_IN, sort: "amount" },
		{ stage: DealStage.CONTRACT_SENT, sort: "amount" },
		{ stage: DealStage.CLOSED_WON, sort: "lastActivity" },
	],
} as const;

export const dealsViewParsers = {
	[SEARCH_PARAM.deals.view]:
		parseAsStringLiteral(DEALS_VIEWS).withDefault("board"),
};

export const loadDealsView = createLoader(dealsViewParsers);
