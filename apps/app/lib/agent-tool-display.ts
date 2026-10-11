import {
	type EveToolFields,
	type EveToolInput,
	eveToolText,
} from "@crm/validation/eve-tool";

type ArtifactNames = Record<string, string>;

const ARTIFACT_NAMES: ArtifactNames = {
	"agent/instructions.md": "as instruções",
	"agent/manifest.json": "o manifesto",
	"agent/README.md": "o readme",
};

type LabelInput = {
	tool: string;
	input: EveToolInput;
	label: string;
	pending: boolean;
};

type ToolInputLabel = (input: EveToolFields, pending: boolean) => string | null;

type ToolInputLabels = Record<string, ToolInputLabel>;

const INPUT_LABELS: ToolInputLabels = {
	write_agent_file: (input, pending) => {
		const path = eveToolText.parse(input.path);
		if (!path) return null;
		const name = ARTIFACT_NAMES[path] ?? path;
		return pending ? `Escrevendo ${name}` : `Escreveu ${name}`;
	},
	save_agent_draft: (input, pending) => {
		const name = eveToolText.parse(input.name).trim();
		const verb = pending ? "Salvando rascunho" : "Rascunho salvo";
		return name ? `${verb} · ${name}` : verb;
	},
	set_chat_title: (input, pending) => {
		const title = eveToolText.parse(input.title).trim();
		const verb = pending ? "Dando nome ao chat" : "Deu nome ao chat";
		return title ? `${verb} · ${title}` : verb;
	},
};

export function toolLabel(item: LabelInput): string {
	const fromInput = item.input
		? INPUT_LABELS[item.tool]?.(item.input, item.pending)
		: null;
	return fromInput ?? item.label;
}
