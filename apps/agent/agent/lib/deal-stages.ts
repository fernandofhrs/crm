import { DEAL_STAGE_LABELS } from "@crm/db/deal-stage";

export function stagesMarkdown(): string {
	const lines = Object.entries(DEAL_STAGE_LABELS).map(
		([stage, label]) => `- \`${stage}\` is "${label}"`,
	);

	return [
		"## Deal stages",
		"",
		"A tool names a stage by its key. A person reads the name this CRM shows.",
		"Write that name, never the key and never a translation of the key:",
		"",
		...lines,
	].join("\n");
}
