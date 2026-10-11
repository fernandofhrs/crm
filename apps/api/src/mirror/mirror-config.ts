const SECOND_MS = 1_000;

export const MIRROR = {
	transaction: {
		timeoutMs: 20 * SECOND_MS,
		maxWaitMs: 10 * SECOND_MS,
	},
	lock: {
		namespace: "mirror",
	},
	batch: {
		records: 50,
		fields: 40,
		dealContacts: 20,
	},
	text: {
		source: 40,
		externalId: 160,
		name: 200,
		line: 320,
		body: 8_000,
		fieldKey: 60,
		fieldLabel: 80,
	},
	lost: {
		reason: "O sistema de origem deste negócio não registrou um motivo.",
	},
	stageChange: {
		subject: "Etapa alterada",
	},
} as const;
