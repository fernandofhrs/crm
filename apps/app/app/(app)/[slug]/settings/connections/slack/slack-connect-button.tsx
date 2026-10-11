"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

const CONNECT_ERRORS = new Map([
	[
		"access_denied",
		"A instalação do Slack foi cancelada antes de o acesso ser concedido.",
	],
	[
		"account_already_linked_to_different_user",
		"Essa conta do Slack já está vinculada a outra conta do CRM.",
	],
	[
		"email_doesn't_match",
		"O e-mail de quem instala o Slack precisa ser o mesmo da conta do CRM em que você entrou.",
	],
	[
		"oauth_code_verification_failed",
		"O Slack recusou as credenciais do app ou a URL de redirecionamento. Confira o client ID, o client secret e a URL de redirecionamento do OAuth e tente de novo.",
	],
	[
		"user_info_is_missing",
		"O Slack não devolveu o perfil de quem instalou. Confirme que o app tem users:read e users:read.email, reinstale e tente de novo.",
	],
]);

async function startSlackOAuth(slug: string) {
	try {
		const { error } = await authClient.oauth2.link({
			providerId: "slack",
			callbackURL: `${window.location.origin}/${slug}/settings/connections/slack/people`,
			errorCallbackURL: `${window.location.origin}/${slug}/settings/connections/slack?provider=slack`,
		});
		if (error)
			toast.error(error.message || "Não foi possível conectar o Slack.");
	} catch (error) {
		toast.error(
			error instanceof Error
				? error.message
				: "Não foi possível conectar o Slack.",
		);
	}
}

export function SlackReconnectButton({ slug }: { slug: string }) {
	const [pending, setPending] = useState(false);

	return (
		<Button
			disabled={pending}
			onClick={async () => {
				setPending(true);
				await startSlackOAuth(slug);
				setPending(false);
			}}
			size="xs"
			variant="contrast"
		>
			{pending ? "Abrindo o Slack…" : "Reconectar"}
		</Button>
	);
}

export function SlackConnectButton({
	slug,
	configured,
	connectError,
}: {
	slug: string;
	configured: boolean;
	connectError?: string;
}) {
	const [pending, setPending] = useState(false);
	const connect = async () => {
		setPending(true);
		await startSlackOAuth(slug);
		setPending(false);
	};
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<Button onClick={() => void connect()} disabled={!configured || pending}>
				{pending
					? "Abrindo o Slack…"
					: configured
						? "Conectar o Slack"
						: "O Slack não está configurado"}
			</Button>
			{connectError ? (
				<p role="alert" className="max-w-sm text-destructive text-xs">
					{CONNECT_ERRORS.get(connectError) ??
						`Não foi possível conectar o Slack (${connectError.replaceAll("_", " ")}).`}
				</p>
			) : null}
		</div>
	);
}
