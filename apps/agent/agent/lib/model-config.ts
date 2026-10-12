export const MODEL = {
	direct: {
		anthropic: {
			keyVariable: "ANTHROPIC_API_KEY",
			gatewayPrefix: "anthropic/",
		},
		settings: {
			providerOptions: {
				anthropic: { thinking: { type: "disabled" } },
			},
		},
	},
} as const;
