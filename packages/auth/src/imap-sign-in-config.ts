const MINUTE_SECONDS = 60;

export const IMAP_SIGN_IN = {
	pluginId: "imap-sign-in",
	providerId: "imap",
	path: "/sign-in/imap",
	attempts: {
		windowSeconds: MINUTE_SECONDS,
		max: 5,
	},
	input: {
		addressMax: 320,
		passwordMax: 1_024,
	},
} as const;
