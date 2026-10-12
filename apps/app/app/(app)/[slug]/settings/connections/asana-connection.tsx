"use client";

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
import AsanaLogo from "@crm/ui/components/brand-logos/asana";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { isSyncing, SYNC_POLL_MS } from "@/lib/sync-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { AsanaPeople } from "./asana-people";

const TOKEN_URL = "https://app.asana.com/0/my-apps";

type TeamProject = {
	projectName: string | null;
	connectedBy: string | null;
	lastSyncedAt: string | null;
	failing: boolean;
};

function openTasksLabel(count: number): string {
	return count === 1 ? "1 tarefa em aberto" : `${count} tarefas em aberto`;
}

function TeamAsana({
	team,
	openTasks,
}: {
	team: TeamProject;
	openTasks: number;
}) {
	const reader = team.connectedBy ?? "quem conectou o projeto";

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Asana
						<StatusIndicator
							size="sm"
							tone={team.failing ? "warning" : "success"}
							label={team.failing ? "Requer atenção" : "Projeto do time"}
						/>
					</div>
				</CardTitle>
				<CardDescription>
					A agenda do time vem de um projeto do Asana. Você não precisa conectar
					nada.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<p className="text-sm">
					{team.projectName ?? "O projeto do time"}, lido pela conta de {reader}
					. As tarefas com data atribuídas a você no Asana ficam como suas
					tarefas no CRM.
				</p>

				{team.failing ? (
					<Alert variant="destructive">
						<Icon icon={Warning} />
						<AlertTitle>A sincronização da agenda falhou</AlertTitle>
						<AlertDescription>
							Peça para {reader} conectar o Asana de novo.
						</AlertDescription>
					</Alert>
				) : (
					<p className="text-muted-foreground text-xs">
						{team.lastSyncedAt ? (
							<>
								Última verificação:{" "}
								<LocalRelativeTime date={team.lastSyncedAt} />,{" "}
								{openTasksLabel(openTasks)} com você
							</>
						) : (
							"Aguardando a primeira verificação"
						)}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function ConnectAsana() {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const tokenId = useId();
	const [token, setToken] = useState("");

	const connect = useMutation(
		trpc.asana.connect.mutationOptions({
			onSuccess: async () => {
				setToken("");
				await cache.asana();
				toast.success("Asana conectado. Escolha o projeto a acompanhar.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Asana
						<StatusIndicator size="sm" tone="neutral" label="Não conectado" />
					</div>
				</CardTitle>
				<CardDescription>
					Traz para o CRM, como suas tarefas, as tarefas com data de um projeto
					do Asana. Nada é enviado. Por isso, nada aqui altera o Asana.
				</CardDescription>

				<CardAction>
					<Button
						size="sm"
						type="submit"
						form="connect-asana"
						disabled={connect.isPending || token.trim() === ""}
					>
						{connect.isPending ? (
							<Spinner data-icon="inline-start" />
						) : (
							<AsanaLogo data-icon="inline-start" className="size-4" />
						)}
						Conectar
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="connect-asana"
					onSubmit={(event) => {
						event.preventDefault();
						connect.mutate({ token: token.trim() });
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={tokenId}>Token de acesso pessoal</FieldLabel>
							<Input
								id={tokenId}
								type="password"
								value={token}
								onChange={(event) => setToken(event.target.value)}
								placeholder="Cole o token"
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={connect.isPending}
							/>
							<FieldDescription>
								Crie um no{" "}
								<a
									href={TOKEN_URL}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-4 hover:text-foreground"
								>
									console de desenvolvedor do Asana
								</a>
								. Ele fica guardado com criptografia e nunca mais é exibido.
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function ChooseProject({
	current,
	onCancel,
}: {
	current: string | null;
	onCancel?: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const projectId = useId();
	const [chosen, setChosen] = useState(current ?? "");

	const projects = useQuery(trpc.asana.projects.queryOptions());

	const choose = useMutation(
		trpc.asana.chooseProject.mutationOptions({
			onSuccess: async () => {
				await cache.asana();
				onCancel?.();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const options = projects.data?.projects ?? [];
	const picked = options.find((project) => project.gid === chosen);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Qual projeto é a sua agenda?</CardTitle>
				<CardDescription>
					O Asana não informa ao CRM qual projeto guarda seus compromissos. Por
					isso, a pergunta é feita uma vez. As tarefas com data de vencimento
					nesse projeto viram suas tarefas aqui.
				</CardDescription>

				<CardAction>
					<div className="flex items-center gap-2">
						{onCancel ? (
							<Button size="sm" variant="ghost" onClick={onCancel}>
								Cancelar
							</Button>
						) : null}
						<Button
							size="sm"
							disabled={choose.isPending || !picked}
							onClick={() => choose.mutate({ projectGid: chosen })}
						>
							{choose.isPending ? <Spinner data-icon="inline-start" /> : null}
							{picked ? `Usar ${picked.name}` : "Escolher um projeto"}
						</Button>
					</div>
				</CardAction>
			</CardHeader>

			<CardContent>
				{projects.isError ? (
					<Alert variant="destructive">
						<Icon icon={Warning} />
						<AlertTitle>Não foi possível ler a lista de projetos</AlertTitle>
						<AlertDescription>{projects.error.message}</AlertDescription>
					</Alert>
				) : (
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={projectId}>Projeto do Asana</FieldLabel>
							<Select
								value={chosen}
								onValueChange={setChosen}
								disabled={projects.isPending || choose.isPending}
							>
								<SelectTrigger id={projectId}>
									<SelectValue
										placeholder={
											projects.isPending
												? "Lendo o Asana…"
												: "Escolha um projeto"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{options.map((project) => (
										<SelectItem key={project.gid} value={project.gid}>
											{project.workspace
												? `${project.name} · ${project.workspace}`
												: project.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								{projects.data?.truncated
									? "A lista mostra só os primeiros projetos que o token enxerga."
									: "A lista mostra só os projetos que o token enxerga."}
							</FieldDescription>
						</Field>
					</FieldGroup>
				)}
			</CardContent>
		</Card>
	);
}

export function AsanaConnection({ slug }: { slug: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const shareId = useId();
	const [changing, setChanging] = useState(false);
	const [personal, setPersonal] = useState(false);

	const status = useQuery({
		...trpc.asana.status.queryOptions(),
		refetchInterval: (query) =>
			isSyncing(query.state.data?.status ?? null) ? SYNC_POLL_MS : false,
	});

	const syncNow = useMutation(
		trpc.asana.syncNow.mutationOptions({
			onSuccess: () => cache.asana(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const share = useMutation(
		trpc.asana.share.mutationOptions({
			onSuccess: async (result) => {
				await cache.asana();
				toast.success(
					result.shared
						? "O projeto agora é a agenda do time."
						: "O projeto voltou a ser só seu.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const purge = useMutation(
		trpc.asana.purgeSyncedData.mutationOptions({
			onSuccess: async (result) => {
				await cache.asana();
				toast.success(
					result.purged === 1
						? "1 tarefa sincronizada removida."
						: `${result.purged} tarefas sincronizadas removidas.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const disconnect = useMutation(
		trpc.asana.disconnect.mutationOptions({
			onSuccess: () => window.location.assign(`/${slug}/settings/connections`),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!status.data) return null;

	const data = status.data;

	if (!data.connected && data.team) {
		return (
			<>
				<TeamAsana team={data.team} openTasks={data.openTasks} />

				{personal ? (
					<ConnectAsana />
				) : (
					<div className="-ml-2">
						<Button variant="ghost" size="xs" onClick={() => setPersonal(true)}>
							Conectar também um projeto só meu
						</Button>
					</div>
				)}
			</>
		);
	}

	if (!data.connected) return <ConnectAsana />;

	if (!data.project) return <ChooseProject current={null} />;

	if (changing) {
		return (
			<ChooseProject
				current={data.project.gid}
				onCancel={() => setChanging(false)}
			/>
		);
	}

	const failing = data.status === "NEEDS_RECONNECT" || data.lastError !== null;
	const taken = data.team !== null && !data.team.yours;

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>
						<div className="flex items-center gap-2">
							Asana
							<StatusIndicator
								size="sm"
								tone={failing ? "warning" : "success"}
								label={failing ? "Requer atenção" : "Conectado"}
							/>
						</div>
					</CardTitle>
					<CardDescription>
						{data.project.name ?? "O projeto escolhido"}
						{data.accountName ? `, lido pela conta de ${data.accountName}` : ""}
						. Tarefas com vencimento entre {data.windowDays.past} dias atrás e{" "}
						{data.windowDays.future} dias à frente{" "}
						{data.shared
							? "ficam no CRM como tarefas do responsável de cada uma."
							: "ficam como suas tarefas no CRM."}
					</CardDescription>

					<CardAction>
						<Button
							variant="contrast"
							size="sm"
							disabled={syncNow.isPending}
							onClick={() => syncNow.mutate()}
						>
							{syncNow.isPending ? "Verificando…" : "Verificar agora"}
						</Button>
					</CardAction>
				</CardHeader>

				<CardContent>
					{failing ? (
						<Alert variant="destructive">
							<Icon icon={Warning} />
							<AlertTitle>A sincronização da agenda falhou</AlertTitle>
							<AlertDescription>
								{data.lastError ?? "O Asana precisa ser conectado de novo."}
							</AlertDescription>
						</Alert>
					) : (
						<p className="text-muted-foreground text-xs">
							{data.lastSyncedAt ? (
								<>
									Última verificação:{" "}
									<LocalRelativeTime date={data.lastSyncedAt} />,{" "}
									{openTasksLabel(data.openTasks)}
									{data.shared ? " com você" : ""}
								</>
							) : (
								"Aguardando a primeira verificação"
							)}
						</p>
					)}

					{data.canShare ? (
						<div className="flex items-start gap-3">
							<Switch
								id={shareId}
								checked={data.shared}
								disabled={share.isPending || (taken && !data.shared)}
								onCheckedChange={(shared) => share.mutate({ shared })}
							/>
							<div className="flex flex-col gap-1">
								<Label htmlFor={shareId}>Projeto do time</Label>
								<p className="text-muted-foreground text-xs">
									{taken
										? `O time já usa ${data.team?.projectName ?? "outro projeto"}, conectado por ${data.team?.connectedBy ?? "outra pessoa"}.`
										: "Cada tarefa vai para quem é o responsável dela no Asana. Tarefa sem responsável, ou de alguém que não está no CRM, fica com você."}
								</p>
							</div>
						</div>
					) : null}

					<CardFooter>
						<div className="-ml-2 flex flex-wrap items-center gap-1 text-muted-foreground">
							<Button
								variant="ghost"
								size="xs"
								onClick={() => setChanging(true)}
							>
								Trocar de projeto
							</Button>

							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="ghost" size="xs" disabled={purge.isPending}>
										Excluir tarefas sincronizadas
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Excluir tarefas sincronizadas?
										</AlertDialogTitle>
										<AlertDialogDescription>
											Todas as tarefas trazidas do Asana saem do CRM. O Asana em
											si não é alterado, e a próxima verificação traz de volta
											as que estão em aberto.
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
										Desconectar o Asana
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Desconectar o Asana?</AlertDialogTitle>
										<AlertDialogDescription>
											A agenda para de ser atualizada e o token salvo é
											excluído. As tarefas já sincronizadas ficam. Para
											invalidar o token em si, exclua-o no console de
											desenvolvedor do Asana.
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

			{data.shared ? <AsanaPeople /> : null}

			{data.status === "NEEDS_RECONNECT" ? <ConnectAsana /> : null}
		</>
	);
}
