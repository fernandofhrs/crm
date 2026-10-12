import type { PortalRefusal } from "@crm/auth/portal";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";

type Notice = { title: string; body: string; opensHere: boolean };

const NOTICES = {
	expired: {
		title: "O acesso pelo Portal venceu",
		body: "Volte ao Portal e abra a aba CRM de novo.",
		opensHere: false,
	},
	refused: {
		title: "O Portal não conseguiu abrir a sua sessão",
		body: "Volte ao Portal e abra a aba CRM de novo. Se continuar, avise o gestor.",
		opensHere: false,
	},
	forbidden: {
		title: "Seu e-mail do Portal não entra neste CRM",
		body: "Peça ao gestor para conferir o seu e-mail na tela do espelho do Portal.",
		opensHere: false,
	},
	direct: {
		title: "Sua conta entra direto no CRM",
		body: "Contas de dono e de administrador não entram pelo Portal. Entre uma vez por aqui e a aba do Portal passa a abrir sozinha.",
		opensHere: true,
	},
} as const satisfies Record<PortalRefusal, Notice>;

export function PortalNotice({ refusal }: { refusal: PortalRefusal }) {
	const notice = NOTICES[refusal];

	return (
		<Alert variant="warning">
			<AlertTitle>{notice.title}</AlertTitle>
			<AlertDescription>
				{notice.body}
				{notice.opensHere ? (
					<>
						{" "}
						<a href="/sign-in" target="_blank" rel="noopener">
							Abrir o CRM em outra aba
						</a>
						.
					</>
				) : null}
			</AlertDescription>
		</Alert>
	);
}
