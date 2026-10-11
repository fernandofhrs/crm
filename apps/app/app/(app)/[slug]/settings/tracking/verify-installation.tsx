"use client";

import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@crm/ui/components/input-group";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Result = RouterOutputs["tracking"]["verify"];

export function VerifyInstallation() {
	const trpc = useTRPC();
	const urlId = useId();

	const [url, setUrl] = useState("");
	const [result, setResult] = useState<Result | null>(null);

	const tracking = useQuery(trpc.tracking.settings.queryOptions());

	const verify = useMutation(
		trpc.tracking.verify.mutationOptions({
			onSuccess: (outcome) => setResult(outcome),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!tracking.data) return null;

	const { canManage, siteId } = tracking.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Verificar instalação
						{result ? <Indicator result={result} /> : null}
					</div>
				</CardTitle>
				<CardDescription>
					Carregamos uma página e procuramos o script. Se ele não estiver no
					HTML, lemos seu contêiner do Tag Manager.
				</CardDescription>

				<CardAction>
					<Button
						size="sm"
						type="submit"
						form="verify-tracking"
						disabled={!canManage || verify.isPending || url.trim() === ""}
					>
						{verify.isPending ? <Spinner data-icon="inline-start" /> : null}
						Verificar agora
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="verify-tracking"
					onSubmit={(event) => {
						event.preventDefault();
						setResult(null);
						verify.mutate({ url: url.trim() });
					}}
				>
					<Field>
						<FieldLabel htmlFor={urlId}>Página a verificar</FieldLabel>
						<InputGroup>
							<InputGroupAddon>
								<InputGroupText>https://</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput
								id={urlId}
								value={url}
								onChange={(event) => {
									setUrl(event.target.value);
									setResult(null);
								}}
								placeholder="acme.com/precos"
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								inputMode="url"
								disabled={!canManage || verify.isPending}
							/>
						</InputGroup>
						<FieldDescription>
							A página precisa ser pública. Uma página que exige login sempre
							falha nesta verificação.
						</FieldDescription>
					</Field>
				</form>

				{result && siteId ? <Outcome result={result} siteId={siteId} /> : null}
			</CardContent>
		</Card>
	);
}

function Indicator({ result }: { result: Result }) {
	if (result.status === "found" && result.pageView) {
		return (
			<StatusIndicator size="sm" tone="success" label="Verificado agora" />
		);
	}

	if (result.status === "found" && result.container?.carriesSiteId === false) {
		return (
			<StatusIndicator
				size="sm"
				tone="warning"
				label="Tag Manager precisa de ajuste"
			/>
		);
	}

	return (
		<StatusIndicator
			size="sm"
			tone="warning"
			label={
				result.status === "found"
					? "Nenhuma visualização ainda"
					: "Não detectado"
			}
		/>
	);
}

function Outcome({ result, siteId }: { result: Result; siteId: string }) {
	if (result.status === "unreachable") {
		return (
			<Alert variant="destructive">
				<Icon icon={Warning} />
				<AlertTitle>Não foi possível abrir {result.host}</AlertTitle>
				<AlertDescription>
					{result.detail} Só acessamos páginas públicas e nunca seguimos um
					redirecionamento para um endereço privado.
				</AlertDescription>
			</Alert>
		);
	}

	if (result.status === "missing") {
		return (
			<Alert variant="destructive">
				<Icon icon={Warning} />
				<AlertTitle>Nenhum script em {result.host}</AlertTitle>
				<AlertDescription>
					A página respondeu em {result.responseMs} ms, mas a tag não estava no
					HTML. Confira se ela está no head, acima de qualquer coisa que
					reescreva a página.
					{result.containers.length > 0
						? ` Também lemos ${result.containers.join(" e ")} no Tag Manager, e a tag também não está lá.`
						: ""}
				</AlertDescription>
			</Alert>
		);
	}

	if (result.container && !result.container.carriesSiteId) {
		return (
			<Alert variant="destructive">
				<Icon icon={Warning} />
				<AlertTitle>O Tag Manager vai descartar o ID do site</AlertTitle>
				<AlertDescription>
					O contêiner {result.container.id} tem a tag, mas o ID do site não está
					na URL do script. O Tag Manager mantém só a URL ao injetar um script,
					então o atributo data-site nunca chega à página e o rastreador nunca
					inicia. Copie o trecho do Tag Manager acima e substitua o HTML da tag.
					{result.pageView
						? " Uma visualização de página chegou nos últimos cinco minutos, então algo neste site ainda está registrando."
						: ""}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Alert>
			<Icon icon={CheckmarkFilled} className="text-success" />
			<AlertTitle>
				{result.container
					? `Script encontrado no contêiner ${result.container.id}`
					: `Script encontrado em ${result.host}`}
			</AlertTitle>
			<AlertDescription>
				Respondeu em {result.responseMs} ms. O ID do site {siteId} confere, e
				este domínio {result.allowed ? "está" : "não está"} na lista de
				permitidos.
				{result.container
					? " A tag não está no HTML, então só roda quando o Tag Manager a dispara. A prova é uma visualização de página."
					: ""}
				{result.pageView
					? " Uma visualização de página chegou nos últimos cinco minutos."
					: " Nenhuma visualização de página chegou ainda. Abra a página em um navegador para enviar uma."}
			</AlertDescription>
		</Alert>
	);
}
