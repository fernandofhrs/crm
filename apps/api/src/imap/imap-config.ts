const SECOND_MS = 1_000;
const DAY_MS = 24 * 60 * 60 * SECOND_MS;
const KILOBYTE = 1_024;

export const IMAP = {
	server: {
		defaultPort: 993,
		maxPort: 65_535,
		implicitTlsPort: 993,
		loopbackHosts: ["127.0.0.1", "localhost", "::1"],
	},
	timeouts: {
		connectMs: 15 * SECOND_MS,
		greetingMs: 10 * SECOND_MS,
		socketMs: 30 * SECOND_MS,
	},
	backfill: {
		windowMs: 30 * DAY_MS,
	},
	tick: {
		maxMessages: 400,
		budgetMs: 40 * SECOND_MS,
	},
	body: {
		maxBytes: 256 * KILOBYTE,
		rootPart: "1",
	},
	cursor: {
		version: 1,
	},
	folders: {
		inbox: "INBOX",
		sentFlag: "\\Sent",
		sentNames: [
			"sent",
			"sent items",
			"sent mail",
			"sent messages",
			"enviados",
			"itens enviados",
			"mensagens enviadas",
		],
	},
	purge: {
		timeoutMs: 60 * SECOND_MS,
	},
	signIn: {
		autoCreate: true,
	},
} as const;

export const IMAP_SOURCE = "imap";
