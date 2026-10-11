import {
	MAX_ARCHIVE_RETENTION_DAYS,
	MIN_ARCHIVE_RETENTION_DAYS,
} from "@crm/db/settings";
import { z } from "zod";

export const catalogModelOutput = z.object({
	id: z.string(),
	name: z.string(),
	provider: z.string(),
	contextWindowTokens: z.number(),
	pricing: z.object({ input: z.number(), output: z.number() }).nullable(),
});

export type CatalogModel = z.infer<typeof catalogModelOutput>;

export const agentModelOutput = z.object({
	selectedId: z.string().nullable(),
	effectiveId: z.string(),
	defaultId: z.string(),
	effective: catalogModelOutput.nullable(),
	updatedAt: z.string().nullable(),
});

export type AgentModelSettings = z.infer<typeof agentModelOutput>;

export const modelCatalogOutput = z.object({
	models: z.array(catalogModelOutput),
	available: z.boolean(),
});

export type ModelCatalogResult = z.infer<typeof modelCatalogOutput>;

export const researchKeyOutput = z.object({
	configured: z.boolean(),
	hint: z.string().nullable(),
});

export type ResearchKeySettings = z.infer<typeof researchKeyOutput>;

export const archiveRetentionOutput = z.object({
	days: z.number(),
});

export type ArchiveRetentionSettings = z.infer<typeof archiveRetentionOutput>;

export const setAgentModelInput = z.object({
	modelId: z.string().trim().min(1).max(200).nullable(),
});

export type SetAgentModelInput = z.infer<typeof setAgentModelInput>;

export const setResearchKeyInput = z.object({
	apiKey: z
		.string()
		.trim()
		.min(8, "Isso não parece uma chave de API do Context: é curta demais.")
		.max(500, "Isso não parece uma chave de API do Context: é longa demais.")
		.refine(
			(value) => !/\s/.test(value),
			"Uma chave de API não tem espaços. Cole só a chave, inteira.",
		),
});

export type SetResearchKeyInput = z.infer<typeof setResearchKeyInput>;

export const setArchiveRetentionDaysInput = z.object({
	days: z
		.number()
		.int()
		.min(
			MIN_ARCHIVE_RETENTION_DAYS,
			`A retenção precisa ser de pelo menos ${MIN_ARCHIVE_RETENTION_DAYS} dia.`,
		)
		.max(
			MAX_ARCHIVE_RETENTION_DAYS,
			`A retenção não pode passar de ${MAX_ARCHIVE_RETENTION_DAYS} dias.`,
		),
});

export type SetArchiveRetentionDaysInput = z.infer<
	typeof setArchiveRetentionDaysInput
>;
