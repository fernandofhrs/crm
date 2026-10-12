const MINUTE_SECONDS = 60;

export const PORTAL_SIGN_IN = {
	pluginId: "portal-sign-in",
	providerId: "portal",
	path: "/sign-in/portal",
	secretVariable: "PORTAL_SIGN_IN_SECRET",
	secretMinLength: 32,
	ticket: {
		lifetimeSeconds: MINUTE_SECONDS,
		clockSkewSeconds: MINUTE_SECONDS / 2,
		maxLength: 2_048,
		nonceMinLength: 16,
		nonceMaxLength: 64,
	},
	attempts: {
		windowSeconds: MINUTE_SECONDS,
		max: 30,
	},
	input: {
		addressMax: 320,
		nameMax: 120,
		subjectMax: 120,
		pathMax: 512,
	},
	refusalParam: "portal",
	signInPath: "/sign-in",
} as const;

export const PORTAL_REFUSALS = [
	"expired",
	"refused",
	"forbidden",
	"direct",
] as const;

export type PortalRefusal = (typeof PORTAL_REFUSALS)[number];

const LANDING_PATH = /^\/(?!\/)[!-~]*$/;

export function portalLandingPath(to: string | undefined): string {
	if (!to) return "/";

	const safe = LANDING_PATH.test(to) && !to.includes("\\");

	return safe ? to : "/";
}
