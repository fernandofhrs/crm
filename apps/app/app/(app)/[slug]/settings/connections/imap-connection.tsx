"use client";

import Email from "@carbon/icons-react/es/Email";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { isSyncing, SYNC_POLL_MS } from "@/lib/sync-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const AUTO_CREATE =
	"Adicionar a empresa e o contato quando você responder a alguém novo";

const IMPORT_MAX_ROUNDS = 40;

type ImapStatus = {
	status: "IDLE" | "RUNNING" | "NEEDS_RECONNECT" | "FAILED" | null;
	importing: boolean;
	lastError: string | null;
};

function canContinue(status: ImapStatus): boolean {
	return status.importing && status.status === "IDLE" && !status.lastError;
}

function ImapUnavailable() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						E-mail por IMAP
						<StatusIndicator size="sm" tone="neutral" label="Não configurado" />
					</div>
				</CardTitle>
				<CardDescription>
					Defina IMAP_HOST no arquivo .env da raiz com o seu servidor de e-mail,
					por exemplo imap.hostinger.com, e reinicie.
				</CardDescription>
			</CardHeader>
		</Card>
	);
}

function ConnectImap({
	host,
	historyDays,
	reconnecting = false,
	initialAutoCreate = true,
	onConnected,
}: {
	host: string | null;
	historyDays: number;
	reconnecting?: boolean;
	initialAutoCreate?: boolean;
	onConnected: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const addressId = useId();
	const passwordId = useId();
	const autoCreateId = useId();

	const [address, setAddress] = useState("");
	const [password, setPassword] = useState("");
	const [autoCreate, setAutoCreate] = useState(initialAutoCreate);

	const connect = useMutation(
		trpc.imap.connect.mutationOptions({
			onSuccess: async () => {
				setPassword("");
				await cache.imap();
				toast.success("Caixa de e-mail conectada.");
				onConnected();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const ready = address.trim() !== "" && password !== "";

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						{reconnecting
							? "Conectar a caixa de e-mail de novo"
							: "E-mail por IMAP"}
						{reconnecting ? null : (
							<StatusIndicator size="sm" tone="neutral" label="Não conectado" />
						)}
					</div>
				</CardTitle>
				<CardDescription>
					E-mails de {host ?? "seu servidor de e-mail"}, somente para leitura.
					Só as conversas com empresas do CRM são guardadas.
				</CardDescription>

				<CardAction>
					<Button
						size="sm"
						type="submit"
						form="connect-imap"
						disabled={connect.isPending || !ready}
					>
						{connect.isPending ? (
							<Spinner data-icon="inline-start" />
						) : (
							<Icon icon={Email} data-icon="inline-start" />
						)}
						Conectar
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="connect-imap"
					onSubmit={(event) => {
						event.preventDefault();
						connect.mutate({
							address: address.trim(),
							password,
							autoCreate,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={addressId}>Endereço de e-mail</FieldLabel>
							<Input
								id={addressId}
								type="email"
								value={address}
								onChange={(event) => setAddress(event.target.value)}
								placeholder="voce@empresa.com.br"
								autoComplete="username"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={connect.isPending}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={passwordId}>
								Senha da caixa de e-mail
							</FieldLabel>
							<Input
								id={passwordId}
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={connect.isPending}
							/>
							<FieldDescription>
								É conferida no servidor de e-mail e depois guardada com
								criptografia. Ela nunca mais é exibida, e nada é enviado por
								esta caixa de e-mail.
							</FieldDescription>
						</Field>

						<div className="flex items-center justify-between gap-6">
							<Label
								htmlFor={autoCreateId}
								className="flex flex-col items-start gap-1"
							>
								<span className="text-sm">
									Importar os últimos {historyDays} dias
								</span>
								<span className="font-normal text-muted-foreground text-xs">
									{AUTO_CREATE}. Desative para registrar só os e-mails de
									pessoas que já estão no CRM.
								</span>
							</Label>

							<Switch
								id={autoCreateId}
								checked={autoCreate}
								disabled={connect.isPending}
								onCheckedChange={setAutoCreate}
							/>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

export function ImapConnection({ slug }: { slug: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const autoCreateId = useId();
	const rounds = useRef(0);

	const status = useQuery({
		...trpc.imap.status.queryOptions(),
		refetchInterval: (query) =>
			isSyncing(query.state.data?.status ?? null) ? SYNC_POLL_MS : false,
	});

	const syncNow = useMutation(
		trpc.imap.syncNow.mutationOptions({
			onSuccess: async (result) => {
				await cache.imap();

				rounds.current += 1;

				if (canContinue(result) && rounds.current < IMPORT_MAX_ROUNDS) {
					syncNow.mutate();
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	function check() {
		rounds.current = 0;
		syncNow.mutate();
	}

	const reimport = useMutation(
		trpc.imap.reimport.mutationOptions({
			onSuccess: async () => {
				await cache.imap();
				check();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const purge = useMutation(
		trpc.imap.purgeSyncedData.mutationOptions({
			onSuccess: async (result) => {
				await cache.imap();
				toast.success(
					result.purged === 1
						? "1 item sincronizado removido."
						: `${result.purged} itens sincronizados removidos.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const disconnect = useMutation(
		trpc.imap.disconnect.mutationOptions({
			onSuccess: () => window.location.assign(`/${slug}/settings/connections`),
			onError: (error) => toast.error(error.message),
		}),
	);

	const setAutoCreate = useMutation(
		trpc.imap.setAutoCreate.mutationOptions({
			onSuccess: () => cache.imap({ settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!status.data) return null;

	const data = status.data;

	if (!data.configured) return <ImapUnavailable />;

	if (!data.connected) {
		return (
			<ConnectImap
				host={data.host}
				historyDays={data.historyDays}
				onConnected={check}
			/>
		);
	}

	const failing = data.status === "NEEDS_RECONNECT" || data.lastError !== null;
	const working = syncNow.isPending || reimport.isPending;
	const paused = !working && canContinue(data);

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>
						<div className="flex items-center gap-2">
							E-mail por IMAP
							<StatusIndicator
								size="sm"
								tone={failing ? "warning" : "success"}
								label={failing ? "Requer atenção" : "Conectado"}
							/>
						</div>
					</CardTitle>
					<CardDescription>
						{data.address} em {data.host}. As conversas de e-mail entram na
						empresa correspondente a cada verificação da caixa de e-mail.
					</CardDescription>

					<CardAction>
						<Button
							variant="contrast"
							size="sm"
							disabled={working}
							onClick={check}
						>
							{working ? "Verificando…" : "Verificar agora"}
						</Button>
					</CardAction>
				</CardHeader>

				<CardContent>
					{failing ? (
						<Alert variant="destructive">
							<Icon icon={Warning} />
							<AlertTitle>A sincronização de e-mails falhou</AlertTitle>
							<AlertDescription>
								{data.lastError ??
									"A caixa de e-mail precisa ser conectada de novo."}
							</AlertDescription>
						</Alert>
					) : (
						<p className="text-muted-foreground text-xs">
							{working && data.importing ? (
								`Importando os últimos ${data.historyDays} dias. Mantenha esta página aberta.`
							) : paused ? (
								`A importação dos últimos ${data.historyDays} dias não terminou. Verifique agora para continuar.`
							) : data.lastSyncedAt ? (
								<>
									Última verificação:{" "}
									<LocalRelativeTime date={data.lastSyncedAt} />
								</>
							) : (
								"Aguardando a primeira verificação"
							)}
						</p>
					)}

					<div className="flex items-center justify-between gap-6">
						<Label
							htmlFor={autoCreateId}
							className="flex flex-col items-start gap-1"
						>
							<span className="text-sm">E-mail</span>
							<span className="font-normal text-muted-foreground text-xs">
								{AUTO_CREATE}
							</span>
						</Label>

						<Switch
							id={autoCreateId}
							checked={data.autoCreate}
							disabled={setAutoCreate.isPending}
							onCheckedChange={(enabled) => setAutoCreate.mutate({ enabled })}
						/>
					</div>

					<CardFooter>
						<div className="-ml-2 flex flex-wrap items-center gap-1 text-muted-foreground">
							<Button
								variant="ghost"
								size="xs"
								disabled={working}
								onClick={() => reimport.mutate()}
							>
								Importar os últimos {data.historyDays} dias de novo
							</Button>

							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="ghost" size="xs" disabled={purge.isPending}>
										Excluir dados sincronizados
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Excluir dados sincronizados?
										</AlertDialogTitle>
										<AlertDialogDescription>
											Todos os e-mails trazidos desta caixa de e-mail saem do
											CRM. A caixa de e-mail em si não é alterada. Nada do que
											for excluído aqui volta, a menos que você importe os
											últimos {data.historyDays} dias de novo.
										</AlertDialogDescription>
									</AlertDialogHeader>

									<AlertDialogFooter>
										<AlertDialogCancel>Cancelar</AlertDialogCancel>
										<AlertDialogAction
											variant="destructive"
											onClick={() => purge.mutate()}
										>
											Excluir
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>

							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										variant="ghost"
										size="xs"
										disabled={disconnect.isPending}
									>
										Desconectar caixa de e-mail
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Desconectar esta caixa de e-mail?
										</AlertDialogTitle>
										<AlertDialogDescription>
											Novos e-mails param de chegar e a senha salva é excluída.
											Tudo o que já foi sincronizado fica, e você pode conectar
											a caixa de e-mail de novo por esta página.
										</AlertDialogDescription>
									</AlertDialogHeader>

									<AlertDialogFooter>
										<AlertDialogCancel>Cancelar</AlertDialogCancel>
										<AlertDialogAction
											variant="destructive"
											onClick={() => disconnect.mutate()}
										>
											Desconectar
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</CardFooter>
				</CardContent>
			</Card>

			{failing && data.status === "NEEDS_RECONNECT" ? (
				<ConnectImap
					host={data.host}
					historyDays={data.historyDays}
					reconnecting
					initialAutoCreate={data.autoCreate}
					onConnected={check}
				/>
			) : null}
		</>
	);
}
