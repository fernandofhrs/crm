export type SlackScopeGroup = "people" | "read" | "send" | "change";

export type SlackScope = {
	scope: string;
	group?: SlackScopeGroup;
	grant: string;
	sensitive: boolean;
};

export const SLACK_SCOPES: readonly SlackScope[] = [
	{
		scope: "users:read",
		group: "people",
		grant: "Ver as pessoas do seu workspace do Slack",
		sensitive: false,
	},
	{
		scope: "users:read.email",
		group: "people",
		grant: "Ver os e-mails delas, para ligar cada pessoa a um registro do CRM",
		sensitive: true,
	},
	{
		scope: "channels:read",
		group: "read",
		grant: "Ver o nome e o tópico de todos os canais públicos",
		sensitive: false,
	},
	{
		scope: "groups:read",
		group: "read",
		grant: "Ver os canais privados em que foi adicionado",
		sensitive: false,
	},
	{
		scope: "channels:history",
		group: "read",
		grant: "Ler mensagens dos canais públicos em que foi adicionado",
		sensitive: true,
	},
	{
		scope: "groups:history",
		group: "read",
		grant: "Ler mensagens dos canais privados em que foi adicionado",
		sensitive: false,
	},
	{
		scope: "chat:write",
		group: "send",
		grant: "Publicar mensagens como o app",
		sensitive: false,
	},
	{
		scope: "chat:write.public",
		group: "send",
		grant: "Publicar em qualquer canal público, mesmo sem ter entrado nele",
		sensitive: true,
	},
	{
		scope: "im:write",
		group: "send",
		grant: "Abrir uma mensagem direta com uma pessoa",
		sensitive: false,
	},
	{
		scope: "channels:join",
		group: "change",
		grant: "Entrar sozinho em um canal público",
		sensitive: true,
	},
	{
		scope: "channels:manage",
		group: "change",
		grant:
			"Criar canais públicos, e renomear ou arquivar os canais em que está",
		sensitive: true,
	},
	{
		scope: "groups:write",
		group: "change",
		grant:
			"Criar canais privados, e renomear ou arquivar os canais em que está",
		sensitive: true,
	},
	{
		scope: "channels:write.invites",
		group: "change",
		grant: "Convidar pessoas para um canal público",
		sensitive: true,
	},
	{
		scope: "groups:write.invites",
		group: "change",
		grant: "Convidar pessoas para um canal privado",
		sensitive: true,
	},
	{
		scope: "conversations.connect:write",
		group: "change",
		grant: "Enviar e aceitar convites do Slack Connect",
		sensitive: true,
	},
	{
		scope: "links:write",
		group: "send",
		grant: "Mostrar uma prévia abaixo de um link que publica",
		sensitive: false,
	},
];

export const SLACK_REQUESTED_SCOPES = SLACK_SCOPES.map((entry) => entry.scope);

export const SLACK_USER_SCOPES = [
	"channels:read",
	"channels:write",
	"groups:read",
	"groups:write",
] as const;

export const SLACK_USER_GRANT = {
	scope: "slack:user-invite",
	grant: "Entrar em um canal privado em seu nome",
	sensitive: true,
} as const satisfies SlackScope;

export const SLACK_SCOPE_GROUPS: ReadonlyArray<{
	id: SlackScopeGroup;
	label: string;
	summary: string;
}> = [
	{
		id: "people",
		label: "Pessoas",
		summary:
			"Nomes e e-mails, para ligar uma conta do Slack a um registro do CRM.",
	},
	{
		id: "read",
		label: "Canais que pode ler",
		summary:
			"Nomes e tópicos dos canais públicos, e as mensagens de qualquer canal em que foi adicionado.",
	},
	{
		id: "send",
		label: "Mensagens que pode enviar",
		summary:
			"Publicar como o app, abrir uma mensagem direta e mostrar a prévia de um link que publica.",
	},
	{
		id: "change",
		label: "Canais que pode alterar",
		summary:
			"Entrar, criar, renomear, arquivar e convidar pessoas para canais.",
	},
];

export type SlackScopeSummary = {
	id: SlackScopeGroup;
	label: string;
	summary: string;
	total: number;
	broad: number;
};

export function summariseSlackScopes(
	granted: readonly string[],
): SlackScopeSummary[] {
	const held = describeSlackScopes(granted);

	return SLACK_SCOPE_GROUPS.map((group) => {
		const inGroup = held.filter((entry) => entry.group === group.id);
		return {
			...group,
			total: inGroup.length,
			broad: inGroup.filter((entry) => entry.sensitive).length,
		};
	}).filter((group) => group.total > 0);
}

export type SlackScopeDrift = {
	extra: SlackScope[];
	missing: SlackScope[];
};

export function slackScopeDrift(granted: readonly string[]): SlackScopeDrift {
	const held = new Set(granted);
	return {
		extra: describeSlackScopes(
			granted.filter((scope) => !SLACK_REQUESTED_SCOPES.includes(scope)),
		),
		missing: SLACK_SCOPES.filter((entry) => !held.has(entry.scope)),
	};
}

export function describeSlackScopes(granted: readonly string[]): SlackScope[] {
	const known = new Map(SLACK_SCOPES.map((entry) => [entry.scope, entry]));
	return granted.map(
		(scope) =>
			known.get(scope) ?? {
				scope,
				grant: `Uma permissão não documentada chamada ${scope}`,
				sensitive: true,
			},
	);
}
