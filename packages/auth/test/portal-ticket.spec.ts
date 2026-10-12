import { describe, expect, it } from "bun:test";
import {
	PORTAL_SIGN_IN,
	portalLandingPath,
} from "../src/portal-sign-in-config";
import {
	type PortalTicketClaims,
	readPortalTicket,
	signPortalTicket,
} from "../src/portal-ticket";

const secret = "portal-ticket-spec-secret-0123456789abcdef";
const now = new Date("2026-10-12T12:00:00Z");
const nowSeconds = Math.floor(now.getTime() / 1_000);

function claims(
	overrides: Partial<PortalTicketClaims> = {},
): PortalTicketClaims {
	return {
		email: "rep@moulin.test",
		sub: "rep.one",
		name: "Rep One",
		exp: nowSeconds + PORTAL_SIGN_IN.ticket.lifetimeSeconds,
		jti: "nonce-0123456789abcdef",
		...overrides,
	};
}

describe("a portal ticket", () => {
	it("reads back what the portal signed", () => {
		const reading = readPortalTicket(
			signPortalTicket(claims(), secret),
			secret,
			now,
		);

		expect(reading).toEqual({ ok: true, claims: claims() });
	});

	it("lowercases the address it carries", () => {
		const reading = readPortalTicket(
			signPortalTicket(claims({ email: "Rep@Moulin.Test" }), secret),
			secret,
			now,
		);

		expect(reading.ok && reading.claims.email).toBe("rep@moulin.test");
	});

	it("refuses a ticket signed with another secret", () => {
		const ticket = signPortalTicket(claims(), `${secret}-other`);

		expect(readPortalTicket(ticket, secret, now)).toEqual({
			ok: false,
			reason: "forged",
		});
	});

	it("refuses a ticket whose claims were changed after signing", () => {
		const [, signature] = signPortalTicket(claims(), secret).split(".");
		const swapped = Buffer.from(
			JSON.stringify(claims({ email: "owner@moulin.test" })),
		).toString("base64url");

		expect(readPortalTicket(`${swapped}.${signature}`, secret, now)).toEqual({
			ok: false,
			reason: "forged",
		});
	});

	it("refuses a ticket that ran out", () => {
		const late = new Date(
			(nowSeconds +
				PORTAL_SIGN_IN.ticket.lifetimeSeconds +
				PORTAL_SIGN_IN.ticket.clockSkewSeconds +
				1) *
				1_000,
		);

		expect(
			readPortalTicket(signPortalTicket(claims(), secret), secret, late),
		).toEqual({ ok: false, reason: "expired" });
	});

	it("refuses a ticket that claims to live longer than a ticket may", () => {
		const ticket = signPortalTicket(
			claims({ exp: nowSeconds + 3_600 }),
			secret,
		);

		expect(readPortalTicket(ticket, secret, now)).toEqual({
			ok: false,
			reason: "expired",
		});
	});

	it("refuses text that is not a ticket", () => {
		for (const text of ["", "a", "a.b.c", ".", "x."]) {
			expect(readPortalTicket(text, secret, now).ok).toBe(false);
		}
	});

	it("refuses a signed ticket without a usable nonce", () => {
		const ticket = signPortalTicket(claims({ jti: "short" }), secret);

		expect(readPortalTicket(ticket, secret, now)).toEqual({
			ok: false,
			reason: "malformed",
		});
	});
});

describe("where a portal sign-in lands", () => {
	it("keeps a path inside the app", () => {
		expect(portalLandingPath("/deals")).toBe("/deals");
		expect(portalLandingPath("/companies?owner=me")).toBe(
			"/companies?owner=me",
		);
	});

	it("falls back to the start for anything that could leave the app", () => {
		for (const to of [
			undefined,
			"",
			"deals",
			"//evil.test",
			"/\\evil.test",
			"https://evil.test",
			"/deals\nSet-Cookie: x=1",
		]) {
			expect(portalLandingPath(to)).toBe("/");
		}
	});
});
