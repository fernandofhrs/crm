import { DealStage } from "./generated/prisma/enums";

export const OPEN_DEAL_STAGES = [
	DealStage.DEMO_BOOKED,
	DealStage.QUALIFIED_TO_BUY,
	DealStage.DECISION_MAKER_BOUGHT_IN,
	DealStage.CONTRACT_SENT,
] as const;

export const CLOSED_DEAL_STAGES = [
	DealStage.CLOSED_WON,
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
] as const;

export const LOSING_DEAL_STAGES = [
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
] as const;

export const DEAL_STAGE_LABELS = {
	DEMO_BOOKED: "Lead",
	QUALIFIED_TO_BUY: "Proposta enviada",
	DECISION_MAKER_BOUGHT_IN: "OK verbal · piloto",
	CONTRACT_SENT: "Aprovada · entrada",
	CLOSED_WON: "Ganha",
	CLOSED_LOST: "Perdida",
	UNQUALIFIED_TO_BUY: "Sem perfil",
} as const satisfies Record<DealStage, string>;

const CLOSED = new Set<DealStage>(CLOSED_DEAL_STAGES);

export function isClosedStage(stage: DealStage): boolean {
	return CLOSED.has(stage);
}
