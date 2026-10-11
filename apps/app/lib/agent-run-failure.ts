type RunFailureReasons = Record<string, string>;

const REASONS: RunFailureReasons = {
	ACTION_NOT_PERFORMED:
		"O agente terminou sem fazer o que foi criado para fazer. Abra a execução para ver qual passo ele pulou.",
	NO_EXECUTOR:
		"Este agente pede algo que o CRM ainda não faz. É preciso recriar o agente.",
	DEPENDENCY_UNAVAILABLE:
		"Falta uma conexão de que este agente precisa. Reconecte e execute de novo.",
	NOT_AUTHORISED:
		"A conexão recusou o pedido. O acesso dela pode ter sido revogado ou reduzido.",
	PROVIDER_ERROR:
		"O serviço externo rejeitou o pedido. Normalmente vale tentar de novo.",
	NEVER_SETTLED:
		"O agente parou sem informar um resultado. Nada ficou pela metade.",
	TURN_FAILED: "O modelo falhou no meio desta execução.",
	DELIVERY_FAILED: "A execução não chegou ao agente.",
	DELIVERY_EXHAUSTED:
		"O pedido não chegou ao agente depois de três tentativas. Nada foi executado.",
	ACTION_REJECTED: "O agente tentou a ação e o CRM recusou. Nada foi gravado.",
	AGENT_UNAVAILABLE:
		"O agente estava pausado ou arquivado quando esta execução começou.",
	AGENT_DELETED: "O agente foi excluído antes de esta execução terminar.",
	CANCELLED_BY_USER: "Alguém interrompeu esta execução.",
	RUN_TIMED_OUT:
		"Esta execução demorou demais e foi interrompida para as próximas poderem começar.",
};

export function runFailureReason(
	code: string | null | undefined,
	message: string | null | undefined,
): string {
	const known = code ? REASONS[code] : undefined;
	if (known) return known;
	if (message?.trim()) return message.trim();
	return "Esta execução falhou sem informar o motivo.";
}
