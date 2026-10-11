import type { FieldEntity } from "./fields-entity";

export const STANDARD_FIELDS = {
	COMPANY: [
		"Nome",
		"Domínio",
		"Site",
		"Telefone",
		"E-mail",
		"Cidade",
		"País",
		"Responsável",
	],
	CONTACT: [
		"Nome",
		"Sobrenome",
		"Cargo",
		"E-mail",
		"Telefone",
		"LinkedIn",
		"GitHub",
		"Empresa",
		"Responsável",
	],
	DEAL: [
		"Nome",
		"Valor",
		"Moeda",
		"Data de fechamento",
		"Empresa",
		"Responsável",
		"Etapa",
	],
} satisfies Record<FieldEntity, readonly string[]>;
