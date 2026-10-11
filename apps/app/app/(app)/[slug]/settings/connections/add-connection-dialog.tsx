"use client";

import Email from "@carbon/icons-react/es/Email";
import Plug from "@carbon/icons-react/es/Plug";
import AsanaLogo from "@crm/ui/components/brand-logos/asana";
import DocusignLogo from "@crm/ui/components/brand-logos/docusign";
import GoogleLogo from "@crm/ui/components/brand-logos/google";
import MicrosoftLogo from "@crm/ui/components/brand-logos/microsoft";
import SlackLogo from "@crm/ui/components/brand-logos/slack";
import StripeLogo from "@crm/ui/components/brand-logos/stripe";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AddConnectionDialog({
	slug,
	open,
	connected,
	imapConfigured,
}: {
	slug: string;
	open: boolean;
	connected: string[];
	imapConfigured: boolean;
}) {
	const router = useRouter();
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) router.replace(`/${slug}/settings/connections`);
			}}
		>
			<DialogContent className="max-w-(--container-narrow) gap-0 p-0 md:left-[calc(50%+calc((56px+213px)/2))]">
				<DialogHeader className="gap-2 px-(--spacing-block-inline) pt-5 pb-4">
					<DialogTitle className="text-base">Adicionar uma conexão</DialogTitle>
					<DialogDescription>
						Nada é enviado nem recebido até você terminar de configurar uma.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col border-y px-2 py-2">
					{!connected.includes("Google Workspace") ? (
						<CatalogRow
							logo={GoogleLogo}
							name="Google Workspace"
							description="Traz mensagens do Gmail e reuniões do Google Agenda"
							href={`/${slug}/settings/connections/google`}
						/>
					) : null}
					{!connected.includes("Slack") ? (
						<CatalogRow
							logo={SlackLogo}
							name="Slack"
							description="Permite que agentes publicados avisem canais e pessoas aprovados"
							href={`/${slug}/settings/connections/slack`}
						/>
					) : null}
					{!connected.includes("Microsoft 365") ? (
						<CatalogRow
							logo={MicrosoftLogo}
							name="Microsoft 365"
							description="Traz e-mails do Outlook e as pessoas envolvidas"
							href={`/${slug}/settings/connections/microsoft`}
						/>
					) : null}
					{imapConfigured && !connected.includes("E-mail por IMAP") ? (
						<CatalogRow
							logo={Email}
							name="E-mail por IMAP"
							description="Traz e-mails do seu próprio servidor de e-mail"
							href={`/${slug}/settings/connections/imap`}
						/>
					) : null}
					{!connected.includes("Asana") ? (
						<CatalogRow
							logo={AsanaLogo}
							name="Asana"
							description="Traz as tarefas com data de um projeto como sua agenda"
							href={`/${slug}/settings/connections/asana`}
						/>
					) : null}
					<CatalogRow logo={StripeLogo} name="Stripe" description="Em breve" />
					<CatalogRow
						logo={DocusignLogo}
						name="Docusign"
						description="Em breve"
					/>
					<CatalogRow
						logo={Plug}
						name="Outra coisa"
						description="A API de intake ainda não está disponível"
						href={`/${slug}/settings/connections/intake`}
					/>
				</div>
				<p className="px-(--spacing-block-inline) py-4 text-muted-foreground text-xs">
					{connected.length > 0
						? `${connected.length === 1 ? "Já conectado" : "Já conectados"}: ${connected.join(", ")}.`
						: "Nada conectado ainda."}
				</p>
			</DialogContent>
		</Dialog>
	);
}

function CatalogRow({
	logo: Logo,
	name,
	description,
	href,
}: {
	logo: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	name: string;
	description: string;
	href?: string;
}) {
	const content = (
		<>
			<Logo className="size-5 shrink-0" />
			<div>
				<p className="font-medium text-sm">{name}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
		</>
	);
	return href ? (
		<Link
			href={href}
			className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted"
		>
			{content}
		</Link>
	) : (
		<div
			aria-disabled="true"
			className="flex items-center gap-3 rounded-md px-3 py-3 opacity-60"
		>
			{content}
		</div>
	);
}
