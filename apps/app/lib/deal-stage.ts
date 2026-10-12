import { DEAL_STAGE_LABELS } from "@crm/db/deal-stage";
import { DealStage } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

const ORDER = [
	DealStage.DEMO_BOOKED,
	DealStage.QUALIFIED_TO_BUY,
	DealStage.DECISION_MAKER_BOUGHT_IN,
	DealStage.CONTRACT_SENT,
	DealStage.CLOSED_WON,
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
] as const;

const TONE = {
	DEMO_BOOKED: "neutral",
	QUALIFIED_TO_BUY: "info",
	DECISION_MAKER_BOUGHT_IN: "info",
	CONTRACT_SENT: "warning",
	CLOSED_WON: "success",
	CLOSED_LOST: "error",
	UNQUALIFIED_TO_BUY: "warning",
} as const satisfies Record<DealStage, StatusTone>;

export const OPEN_STAGES = ORDER.slice(0, 4) as readonly DealStage[];

export const LOSING_STAGES: readonly DealStage[] = [
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
];

export const DEAL_STAGE_OPTIONS = ORDER.map((value) => ({
	value,
	label: DEAL_STAGE_LABELS[value],
}));

const OPEN_STAGE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
] as const;

export function isClosedStage(stage: DealStage): boolean {
	return !OPEN_STAGES.includes(stage);
}

export function dealStageColor(stage: DealStage): string {
	return OPEN_STAGE_COLORS[OPEN_STAGES.indexOf(stage)] ?? "var(--chart-5)";
}

export function dealStageLabel(stage: DealStage): string {
	return DEAL_STAGE_LABELS[stage];
}

export function dealStagePresentation(stage: DealStage) {
	return { label: DEAL_STAGE_LABELS[stage], tone: TONE[stage] };
}
