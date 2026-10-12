import { db } from "@crm/db";
import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import { type DynamicResolveContext, defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import {
	defaultModel,
	type ModelSelection,
	overDefault,
} from "../../lib/model";
import { attribute, purposeOf } from "../../lib/session-purpose";

async function versionModel(
	ctx: DynamicResolveContext,
): Promise<ModelSelection | null> {
	if (purposeOf(ctx) !== "team-agent") return null;
	const runId = attribute(ctx, "runId");
	if (!runId) return null;

	const run = await db.agentRun.findUnique({
		where: { id: runId },
		select: {
			version: {
				select: { modelId: true, modelContextWindowTokens: true },
			},
		},
	});

	return run
		? overDefault({
				model: run.version.modelId,
				modelContextWindowTokens: run.version.modelContextWindowTokens,
			})
		: null;
}

export default defineAgent({
	description:
		"Execute one immutable deployed CRM agent version and persist its result and every side effect.",
	model: defineDynamic({
		fallback: defaultModel(),
		events: { "session.started": (_event, ctx) => versionModel(ctx) },
	}),
	modelContextWindowTokens: DEFAULT_AGENT_MODEL.contextWindowTokens,
	outputSchema: z.object({
		summary: z.string().min(1).max(1000),
		result: z.record(z.string(), z.unknown()).nullable(),
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 40_000,
		sessionTimeoutMs: 24 * 60 * 60 * 1000,
	},
});
