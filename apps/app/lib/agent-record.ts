import type { CarbonIcon } from "@crm/ui/components/icon";

export type AgentRecordKind = "contact" | "company" | "deal";

export type AgentRecord = { kind: AgentRecordKind; id: string };

type RecordCopy = {
	header: string;
	field: "contactId" | "companyId" | "dealId";
	title: string;
	blurb: string;
	placeholder: string;
	suggestions: string[];
};

type RecordCopyByKind = Record<AgentRecordKind, RecordCopy>;

export type AgentRecordHeader = Record<string, string>;

export type AgentRecordFilter = {
	contactId?: string;
	companyId?: string;
	dealId?: string;
};

const COPY: RecordCopyByKind = {
	contact: {
		header: "x-crm-contact",
		field: "contactId",
		title: "Pergunte sobre esta pessoa",
		blurb:
			"Cada passo aparece na hora em que acontece, inclusive as pistas que o agente descarta.",
		placeholder: "Ainda trabalha lá?",
		suggestions: [
			"Quem é esta pessoa?",
			"Ainda trabalha lá?",
			"O que preciso saber antes de uma ligação?",
		],
	},
	company: {
		header: "x-crm-company",
		field: "companyId",
		title: "Pergunte sobre esta empresa",
		blurb:
			"O agente lê o site da empresa e o nosso histórico com ela, e mostra o caminho que fez.",
		placeholder: "O que a empresa vende?",
		suggestions: [
			"O que a empresa faz?",
			"Quem conhecemos lá?",
			"O que mudou recentemente?",
		],
	},
	deal: {
		header: "x-crm-deal",
		field: "dealId",
		title: "Pergunte sobre este negócio",
		blurb:
			"O agente lê a conversa, as reuniões e as pessoas dos dois lados do negócio.",
		placeholder: "Onde este negócio travou?",
		suggestions: [
			"Em que pé está este negócio?",
			"Quem mais deveria participar?",
			"Qual é o risco aqui?",
		],
	},
};

export function recordCopy(kind: AgentRecordKind): RecordCopy {
	return COPY[kind];
}

export function recordHeader(record: AgentRecord): AgentRecordHeader {
	return { [COPY[record.kind].header]: record.id };
}

export function recordFilter(record: AgentRecord): AgentRecordFilter {
	return { [COPY[record.kind].field]: record.id };
}

export type { CarbonIcon };
