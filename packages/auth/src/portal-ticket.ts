import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PORTAL_SIGN_IN } from "./portal-sign-in-config";

const claims = z.object({
	email: z
		.string()
		.trim()
		.toLowerCase()
		.max(PORTAL_SIGN_IN.input.addressMax)
		.pipe(z.email()),
	sub: z.string().trim().min(1).max(PORTAL_SIGN_IN.input.subjectMax),
	name: z.string().trim().max(PORTAL_SIGN_IN.input.nameMax).optional(),
	exp: z.number().int().positive(),
	jti: z
		.string()
		.min(PORTAL_SIGN_IN.ticket.nonceMinLength)
		.max(PORTAL_SIGN_IN.ticket.nonceMaxLength)
		.regex(/^[A-Za-z0-9_-]+$/),
});

export type PortalTicketClaims = z.infer<typeof claims>;

export type PortalTicketReading =
	| { ok: true; claims: PortalTicketClaims }
	| { ok: false; reason: "malformed" | "forged" | "expired" };

function seal(payload: string, secret: string): Buffer {
	return createHmac("sha256", secret).update(payload).digest();
}

export function signPortalTicket(
	ticket: PortalTicketClaims,
	secret: string,
): string {
	const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");

	return `${payload}.${seal(payload, secret).toString("base64url")}`;
}

export function readPortalTicket(
	ticket: string,
	secret: string,
	now: Date,
): PortalTicketReading {
	if (ticket.length > PORTAL_SIGN_IN.ticket.maxLength) {
		return { ok: false, reason: "malformed" };
	}

	const parts = ticket.split(".");
	const [payload, signature] = parts;
	if (parts.length !== 2 || !payload || !signature) {
		return { ok: false, reason: "malformed" };
	}

	const expected = seal(payload, secret);
	const given = Buffer.from(signature, "base64url");

	if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
		return { ok: false, reason: "forged" };
	}

	const read = readClaims(payload);
	if (!read) return { ok: false, reason: "malformed" };

	const nowSeconds = Math.floor(now.getTime() / 1_000);
	const { lifetimeSeconds, clockSkewSeconds } = PORTAL_SIGN_IN.ticket;

	if (
		read.exp < nowSeconds - clockSkewSeconds ||
		read.exp > nowSeconds + lifetimeSeconds + clockSkewSeconds
	) {
		return { ok: false, reason: "expired" };
	}

	return { ok: true, claims: read };
}

function readClaims(payload: string): PortalTicketClaims | null {
	try {
		const parsed = claims.safeParse(
			JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
		);

		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
