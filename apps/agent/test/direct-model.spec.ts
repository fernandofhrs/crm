import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import {
	anthropicKey,
	anthropicModelId,
	defaultModel,
	overDefault,
} from "../agent/lib/model";
import { MODEL } from "../agent/lib/model-config";

const VARIABLE = MODEL.direct.anthropic.keyVariable;

const chosenDefault = {
	model: DEFAULT_AGENT_MODEL.id,
	modelContextWindowTokens: DEFAULT_AGENT_MODEL.contextWindowTokens,
};

const other = { model: "zai/glm-5.2-fast", modelContextWindowTokens: 7 };

let savedKey: string | undefined;
let savedFetch: typeof fetch;

beforeEach(() => {
	savedKey = process.env[VARIABLE];
	savedFetch = globalThis.fetch;
	delete process.env[VARIABLE];
});

afterEach(() => {
	globalThis.fetch = savedFetch;
	if (savedKey === undefined) delete process.env[VARIABLE];
	else process.env[VARIABLE] = savedKey;
});

describe("the Anthropic id of a gateway model", () => {
	it("drops the provider and writes the version with hyphens", () => {
		expect(anthropicModelId("anthropic/claude-haiku-5.5")).toBe(
			"claude-haiku-5-5",
		);
		expect(anthropicModelId("anthropic/claude-sonnet-5")).toBe(
			"claude-sonnet-5",
		);
	});

	it("has none for a model of another provider", () => {
		expect(anthropicModelId("zai/glm-5.2-fast")).toBeNull();
		expect(anthropicModelId("anthropic/")).toBeNull();
	});
});

describe("the default model without a Claude Platform key", () => {
	it("is the gateway id, and a chosen model is kept as chosen", () => {
		process.env[VARIABLE] = "  ";

		expect(anthropicKey()).toBeNull();
		expect(defaultModel()).toBe(DEFAULT_AGENT_MODEL.id);
		expect(overDefault(chosenDefault)).toEqual(chosenDefault);
		expect(overDefault(other)).toEqual(other);
	});
});

describe("the default model with a Claude Platform key", () => {
	it("is an Anthropic model, not a gateway id", () => {
		process.env[VARIABLE] = "test-key";

		const model = defaultModel();
		if (model === DEFAULT_AGENT_MODEL.id)
			throw new Error("Still a gateway id.");

		expect(model).toMatchObject({
			provider: "anthropic.messages",
			modelId: "claude-haiku-5-5",
		});
	});

	it("takes over a selection that names the default, and no other", () => {
		process.env[VARIABLE] = "test-key";

		expect(overDefault(chosenDefault)).toBeNull();
		expect(overDefault(other)).toEqual(other);
	});

	it("sends the request to Anthropic, with the key and no thinking", async () => {
		process.env[VARIABLE] = "test-key";

		const calls: { url: string; key: string | null; body: string }[] = [];

		const answer = async (
			input: Parameters<typeof fetch>[0],
			init?: RequestInit,
		) => {
			calls.push({
				url: String(input),
				key: new Headers(init?.headers).get("x-api-key"),
				body: String(init?.body),
			});

			return Response.json({
				id: "msg_1",
				type: "message",
				role: "assistant",
				model: "claude-haiku-5-5",
				content: [{ type: "text", text: "Olá." }],
				stop_reason: "end_turn",
				stop_sequence: null,
				usage: { input_tokens: 3, output_tokens: 2 },
			});
		};

		globalThis.fetch = Object.assign(answer, {
			preconnect: savedFetch.preconnect,
		});

		const model = defaultModel();
		if (model === DEFAULT_AGENT_MODEL.id)
			throw new Error("Still a gateway id.");

		await model.doGenerate({
			prompt: [{ role: "user", content: [{ type: "text", text: "Oi" }] }],
		});

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://api.anthropic.com/v1/messages");
		expect(calls[0]?.key).toBe("test-key");

		const sent = JSON.parse(calls[0]?.body ?? "{}");

		expect(sent.model).toBe("claude-haiku-5-5");
		expect(sent.thinking).toEqual({ type: "disabled" });
		expect(sent.max_tokens).toBeGreaterThan(4_096);
		expect(sent).not.toHaveProperty("temperature");
		expect(sent).not.toHaveProperty("top_p");
		expect(sent).not.toHaveProperty("top_k");
	});
});
