export type FieldTemplate = {
	legacyKey: string;
	label: string;
	type: "SELECT" | "USER" | "NUMBER";
	options?: readonly string[];
};

export const FIELD_TEMPLATES = {
	COMPANY: [
		{
			legacyKey: "account_type",
			label: "Tipo de conta",
			type: "SELECT",
			options: ["Prospect", "Cliente", "Parceiro", "Ex-cliente"],
		},
		{
			legacyKey: "segment",
			label: "Segmento",
			type: "SELECT",
			options: ["Grande empresa", "Média empresa", "Pequena empresa"],
		},
		{
			legacyKey: "territory",
			label: "Regional",
			type: "SELECT",
			options: ["AMER", "EMEA", "APAC"],
		},
		{
			legacyKey: "lifecycle_stage",
			label: "Etapa do ciclo de vida",
			type: "SELECT",
			options: ["Lead", "MQL", "SQL", "Oportunidade", "Cliente"],
		},
		{
			legacyKey: "lead_source",
			label: "Origem do lead",
			type: "SELECT",
			options: ["Inbound", "Outbound", "Evento"],
		},
		{
			legacyKey: "icp_fit_score",
			label: "Nota de fit com o ICP",
			type: "NUMBER",
		},
		{ legacyKey: "bdr_owner", label: "BDR da conta", type: "USER" },
	],
	CONTACT: [],
	DEAL: [],
} satisfies Record<"COMPANY" | "CONTACT" | "DEAL", readonly FieldTemplate[]>;
