import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@crm/db";
import { DEFAULT_AGENT_MODEL, readAgentModel } from "@crm/db/settings";
import {
	defaultSettingsMiddleware,
	type LanguageModel,
	wrapLanguageModel,
} from "ai";
import { MODEL } from "./model-config";

export interface ModelSelection {
	model: string;
	modelContextWindowTokens: number;
}

export async function selectedModel(): Promise<ModelSelection | null> {
	try {
		const setting = await readAgentModel(db);

		if (setting.isDefault) return null;

		return overDefault({
			model: setting.id,
			modelContextWindowTokens: setting.contextWindowTokens,
		});
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return null;
	}
}

export function anthropicKey(): string | null {
	return process.env[MODEL.direct.anthropic.keyVariable]?.trim() || null;
}

export function anthropicModelId(gatewayId: string): string | null {
	const { gatewayPrefix } = MODEL.direct.anthropic;

	if (!gatewayId.startsWith(gatewayPrefix)) return null;

	return gatewayId.slice(gatewayPrefix.length).replaceAll(".", "-") || null;
}

export function defaultModel(): LanguageModel {
	const id = anthropicModelId(DEFAULT_AGENT_MODEL.id);

	if (!anthropicKey() || !id) return DEFAULT_AGENT_MODEL.id;

	return wrapLanguageModel({
		model: anthropic(id),
		middleware: defaultSettingsMiddleware({ settings: MODEL.direct.settings }),
	});
}

export function overDefault(selection: ModelSelection): ModelSelection | null {
	const direct = defaultModel() !== DEFAULT_AGENT_MODEL.id;

	return direct && selection.model === DEFAULT_AGENT_MODEL.id
		? null
		: selection;
}
