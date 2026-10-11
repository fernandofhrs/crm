const SECOND_MS = 1_000;
const DAY_MS = 24 * 60 * 60 * SECOND_MS;

export const ASANA = {
	api: {
		baseUrl: "https://app.asana.com/api/1.0",
		pageSize: 100,
		maxTaskPages: 10,
		maxProjectPages: 5,
		maxWorkspaces: 10,
	},
	window: {
		pastMs: 30 * DAY_MS,
		futureMs: 180 * DAY_MS,
	},
	task: {
		untitled: "(untitled task)",
		bodyMax: 2_000,
		dateOnlyDueTime: "T23:59:59.000Z",
	},
	match: {
		maxAddresses: 10,
	},
	purge: {
		timeoutMs: 60 * SECOND_MS,
	},
} as const;

export const ASANA_SOURCE = "asana";
