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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { isSyncing, SYNC_POLL_MS } from "@/lib/sync-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const TOKEN_URL = "https://app.asana.com/0/my-apps";

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
				toast.success("Asana connected. Choose the project to follow.");
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
						<StatusIndicator size="sm" tone="neutral" label="Not connected" />
					</div>
				</CardTitle>
				<CardDescription>
					Brings the dated tasks of one Asana project into the CRM as your
					tasks. Nothing is sent, so nothing here can change Asana.
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
						Connect
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
							<FieldLabel htmlFor={tokenId}>Personal access token</FieldLabel>
							<Input
								id={tokenId}
								type="password"
								value={token}
								onChange={(event) => setToken(event.target.value)}
								placeholder="Paste the token"
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={connect.isPending}
							/>
							<FieldDescription>
								Create one in the{" "}
								<a
									href={TOKEN_URL}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-4 hover:text-foreground"
								>
									Asana developer console
								</a>
								. It is stored encrypted and never shown again.
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
				<CardTitle>Which project is your agenda?</CardTitle>
				<CardDescription>
					Asana cannot tell the CRM which project holds your commitments, so
					this is asked once. Tasks with a due date in that project become your
					tasks here.
				</CardDescription>

				<CardAction>
					<div className="flex items-center gap-2">
						{onCancel ? (
							<Button size="sm" variant="ghost" onClick={onCancel}>
								Cancel
							</Button>
						) : null}
						<Button
							size="sm"
							disabled={choose.isPending || !picked}
							onClick={() => choose.mutate({ projectGid: chosen })}
						>
							{choose.isPending ? <Spinner data-icon="inline-start" /> : null}
							{picked ? `Use ${picked.name}` : "Choose a project"}
						</Button>
					</div>
				</CardAction>
			</CardHeader>

			<CardContent>
				{projects.isError ? (
					<Alert variant="destructive">
						<Icon icon={Warning} />
						<AlertTitle>The project list could not be read</AlertTitle>
						<AlertDescription>{projects.error.message}</AlertDescription>
					</Alert>
				) : (
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={projectId}>Asana project</FieldLabel>
							<Select
								value={chosen}
								onValueChange={setChosen}
								disabled={projects.isPending || choose.isPending}
							>
								<SelectTrigger id={projectId}>
									<SelectValue
										placeholder={
											projects.isPending ? "Reading Asana…" : "Choose a project"
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
									? "Only the first projects the token can see are listed."
									: "Only projects the token can see are listed."}
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

	const [changing, setChanging] = useState(false);

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

	const purge = useMutation(
		trpc.asana.purgeSyncedData.mutationOptions({
			onSuccess: async (result) => {
				await cache.asana();
				toast.success(`Removed ${result.purged} synced tasks.`);
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
								label={failing ? "Needs attention" : "Connected"}
							/>
						</div>
					</CardTitle>
					<CardDescription>
						{data.project.name ?? "The chosen project"}
						{data.accountName ? `, read as ${data.accountName}` : ""}. Tasks due
						from {data.windowDays.past} days ago to {data.windowDays.future}{" "}
						days ahead are kept as your CRM tasks.
					</CardDescription>

					<CardAction>
						<Button
							variant="contrast"
							size="sm"
							disabled={syncNow.isPending}
							onClick={() => syncNow.mutate()}
						>
							{syncNow.isPending ? "Checking…" : "Check now"}
						</Button>
					</CardAction>
				</CardHeader>

				<CardContent>
					{failing ? (
						<Alert variant="destructive">
							<Icon icon={Warning} />
							<AlertTitle>The agenda sync failed</AlertTitle>
							<AlertDescription>
								{data.lastError ?? "Asana needs connecting again."}
							</AlertDescription>
						</Alert>
					) : (
						<p className="text-muted-foreground text-xs">
							{data.lastSyncedAt ? (
								<>
									Last checked <LocalRelativeTime date={data.lastSyncedAt} />,{" "}
									{data.openTasks} open{" "}
									{data.openTasks === 1 ? "task" : "tasks"}
								</>
							) : (
								"Waiting for the first check"
							)}
						</p>
					)}

					<CardFooter>
						<div className="-ml-2 flex flex-wrap items-center gap-1 text-muted-foreground">
							<Button
								variant="ghost"
								size="xs"
								onClick={() => setChanging(true)}
							>
								Change project
							</Button>

							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="ghost" size="xs" disabled={purge.isPending}>
										Delete synced tasks
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Delete synced tasks?</AlertDialogTitle>
										<AlertDialogDescription>
											Every task brought in from Asana is removed from the CRM.
											Asana itself is not touched, and the next check brings the
											open ones back.
										</AlertDialogDescription>
									</AlertDialogHeader>

									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											variant="destructive"
											onClick={() => purge.mutate()}
										>
											Delete
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
										Disconnect Asana
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Disconnect Asana?</AlertDialogTitle>
										<AlertDialogDescription>
											The agenda stops updating and the saved token is deleted.
											Tasks already synced stay. To withdraw the token itself,
											delete it in the Asana developer console.
										</AlertDialogDescription>
									</AlertDialogHeader>

									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											variant="destructive"
											onClick={() => disconnect.mutate()}
										>
											Disconnect
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</CardFooter>
				</CardContent>
			</Card>

			{data.status === "NEEDS_RECONNECT" ? <ConnectAsana /> : null}
		</>
	);
}
