import ArrowRight from "@carbon/icons-react/es/ArrowRight";
import Chat from "@carbon/icons-react/es/Chat";
import Email from "@carbon/icons-react/es/Email";
import Events from "@carbon/icons-react/es/Events";
import MagicWand from "@carbon/icons-react/es/MagicWand";
import Phone from "@carbon/icons-react/es/Phone";
import Task from "@carbon/icons-react/es/Task";
import type { ActivityType } from "@crm/db/enums";
import type { CarbonIcon } from "@crm/ui/components/icon";

type ActivityPresentation = Record<
	ActivityType,
	{ icon: CarbonIcon; label: string }
>;

const PRESENTATION: ActivityPresentation = {
	NOTE: { icon: Chat, label: "Nota" },
	CALL: { icon: Phone, label: "Ligação" },
	EMAIL: { icon: Email, label: "E-mail" },
	MEETING: { icon: Events, label: "Reunião" },
	TASK: { icon: Task, label: "Tarefa" },
	STAGE_CHANGE: { icon: ArrowRight, label: "Mudança de etapa" },
	ENRICHMENT: { icon: MagicWand, label: "Pesquisa" },
};

export function activityLabel(type: ActivityType): string {
	return PRESENTATION[type].label;
}

export function activityIcon(type: ActivityType): CarbonIcon {
	return PRESENTATION[type].icon;
}

const SYNC_ORIGIN = new Map([
	["gmail", "via Gmail"],
	["outlook", "via Outlook"],
	["imap", "via e-mail"],
	["calendar", "via Agenda"],
	["asana", "via Asana"],
]);

export function syncOriginLabel(source: string | null): string | null {
	return source ? (SYNC_ORIGIN.get(source) ?? null) : null;
}
