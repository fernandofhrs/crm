import { DEAL_STAGE_LABELS } from "@crm/db/deal-stage";

export function stagesMarkdown(): string {
	const lines = Object.entries(DEAL_STAGE_LABELS).map(
		([stage, label]) => `- \`${stage}\` is "${label}"`,
	);

	return [
		"## Deal stages",
		"",
		"A tool names a stage by its key. A person reads the name this CRM shows.",
		"Write that name alone. Never write the key, not even in brackets, and",
		"never translate the key:",
		"",
		...lines,
	].join("\n");
}
