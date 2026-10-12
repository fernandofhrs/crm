import { describe, expect, it } from "bun:test";
import { builderTurnHasSettled } from "../lib/agent-builder-state";

const asked = "2026-10-11T23:11:10.000Z";
const before = "2026-10-11T23:10:00.000Z";
const after = "2026-10-11T23:11:40.000Z";

const accepted = [{ status: "ACCEPTED", createdAt: asked }];

const event = (type: string, at: string) => ({ type, meta: { at } });

describe("builderTurnHasSettled", () => {
	it("is settled when the stream ends waiting, after the last question", () => {
		expect(
			builderTurnHasSettled(accepted, [
				event("message.completed", after),
				event("session.waiting", after),
			]),
		).toBe(true);
	});

	it("is not settled while the agent is still writing", () => {
		expect(
			builderTurnHasSettled(accepted, [
				event("session.waiting", before),
				event("step.started", after),
			]),
		).toBe(false);
	});

	it("does not take the end of the previous turn for the end of this one", () => {
		expect(
			builderTurnHasSettled(accepted, [event("session.waiting", before)]),
		).toBe(false);
	});

	it("is not settled while a question is still on its way to the agent", () => {
		expect(
			builderTurnHasSettled(
				[...accepted, { status: "PENDING", createdAt: after }],
				[event("session.waiting", after)],
			),
		).toBe(false);
	});

	it("is settled when the turn failed or asked the user something", () => {
		expect(
			builderTurnHasSettled(accepted, [event("session.failed", after)]),
		).toBe(true);
		expect(
			builderTurnHasSettled(accepted, [event("input.requested", after)]),
		).toBe(true);
	});

	it("has nothing to settle on an empty stream", () => {
		expect(builderTurnHasSettled(accepted, [])).toBe(false);
	});
});
