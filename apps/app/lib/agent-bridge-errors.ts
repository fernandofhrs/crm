export const BRIDGE_ERRORS = {
	notConfigured: "O agente de pesquisa não está configurado nesta instalação.",
	notSignedIn: "Entre no CRM para continuar.",
	conversationNotFound: "Conversa não encontrada.",
	recordNotFound: "Registro não encontrado.",
	notReachable: "Não foi possível acessar o agente de pesquisa.",
} as const;

const BRIDGE_HINTS = [
	{
		error: BRIDGE_ERRORS.notReachable,
		hint: "Inicie com `bun run dev` ou confira AGENT_URL.",
	},
	{
		error: BRIDGE_ERRORS.notConfigured,
		hint: "Defina AGENT_BRIDGE_SECRET no aplicativo e no agente.",
	},
] as const;

export function bridgeErrorHint(message: string): string | null {
	return (
		BRIDGE_HINTS.find((entry) => message.includes(entry.error))?.hint ?? null
	);
}
