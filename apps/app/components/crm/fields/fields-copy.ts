import type { RecordKind } from "@/components/crm/record-sheet/record-stack";
import type { FieldEntity } from "./fields-entity";

export const SHEET_TITLE = "Campos";

const SUBTITLE = {
	company: "Isto vale para todas as empresas do seu CRM.",
	contact: "Isto vale para todos os contatos do seu CRM.",
	deal: "Isto vale para todos os negócios do seu CRM.",
} satisfies Record<RecordKind, string>;

export function subtitleFor(kind: RecordKind): string {
	return SUBTITLE[kind];
}

export const STANDARD_ROW = "Campos padrão";
export const STANDARD_NOTE = "só reordenar e ocultar";
export const SUGGESTED_ROW = "Campos sugeridos";
export const SUGGESTED_NOTE = "um clique para adicionar";
export const ADD = "Adicionar";
export const CUSTOM_GROUP = "Campos personalizados";
export const DRAG_NOTE = "Arraste para ordenar";
export const ARCHIVED_ROW = "Arquivados";
export const ARCHIVED_NOTE = "valores mantidos, ocultos em todo lugar";
export const NEW_FIELD = "Novo campo";
export const ORDER_NOTE = "A ordem aqui é a ordem na ficha";
export const MANUAL_ONLY = "Só manual";
export const TABLE_NOTE = "também é coluna na tabela";
export const FILTER_NOTE = "também é filtro";

export const EMPTY_TITLE = "Nenhum campo personalizado ainda";
export const EMPTY_BODY =
	"Crie campos dinâmicos que seus agentes pesquisam e preenchem para você.";

export const ERROR_TITLE = "Não foi possível carregar seus campos";
export const ERROR_BODY =
	"Seus campos continuam lá. Tente de novo em instantes, antes de criar algo novo.";
export const RETRY = "Tentar de novo";

export const LABEL_LABEL = "Rótulo";
export const KEY_LABEL = "Chave";
export const KEY_HELP =
	"É como a API e seus agentes chamam o campo. Vem do rótulo e fica fixa depois de salvar: mudar o rótulo depois não quebra nenhuma integração.";
export const AGENT_LABEL = "Deixar seus agentes preencherem";
export const AGENT_HELP =
	"Eles propõem um valor com a origem e nunca sobrescrevem o seu.";
export const BRIEF_LABEL = "O que conta como resposta";
export const BRIEF_HELP =
	"Deixe vazio e seus agentes usam só o rótulo e o tipo.";
export const TYPE_LABEL = "Tipo";
export const OPTIONS_LABEL = "Opções";
export const ADD_OPTION = "Adicionar opção";
export const ALL_FILLED = "Nada mais a preencher";

export function optionLabel(index: number): string {
	return `Opção ${index + 1}`;
}

export function removeOptionLabel(index: number): string {
	return `Remover opção ${index + 1}`;
}

export const OPTION_FALLBACK = "opção";
export const ADD_FIELD = "Criar campo";
export const CANCEL = "Cancelar";
export const SAVE = "Salvar alterações";
export const ARCHIVE = "Arquivar";
export const FILL_REST = "Preencher o restante";

const SHEET_PLACEMENT = {
	COMPANY: "Mostrar na ficha da empresa",
	CONTACT: "Mostrar na ficha do contato",
	DEAL: "Mostrar na ficha do negócio",
} satisfies Record<FieldEntity, string>;

const TABLE_PLACEMENT = {
	COMPANY: "Oferecer como coluna na tabela de empresas",
	CONTACT: "Oferecer como coluna na tabela de contatos",
	DEAL: "Oferecer como coluna na tabela de negócios",
} satisfies Record<FieldEntity, string>;

const FILTER_PLACEMENT = {
	COMPANY: "Oferecer como filtro na tabela de empresas",
	CONTACT: "Oferecer como filtro na tabela de contatos",
	DEAL: "Oferecer como filtro na tabela de negócios",
} satisfies Record<FieldEntity, string>;

export function sheetPlacement(entity: FieldEntity): string {
	return SHEET_PLACEMENT[entity];
}

export function tablePlacement(entity: FieldEntity): string {
	return TABLE_PLACEMENT[entity];
}

export function filterPlacement(entity: FieldEntity): string {
	return FILTER_PLACEMENT[entity];
}

export const ENTITY_TABS = [
	{ kind: "company", label: "Empresas" },
	{ kind: "contact", label: "Contatos" },
	{ kind: "deal", label: "Negócios" },
] as const satisfies readonly { kind: RecordKind; label: string }[];
