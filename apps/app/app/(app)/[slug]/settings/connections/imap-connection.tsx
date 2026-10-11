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

const AUTO_CREATE = "Add the company and contact when you reply to someone new";

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
						Email by IMAP
						<StatusIndicator size="sm" tone="neutral" label="Not configured" />
					</div>
				</CardTitle>
				<CardDescription>
					Set IMAP_HOST in the root .env file to your mail server, for example
					imap.hostinger.com, and restart.
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
				toast.success("Mailbox connected.");
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
						{reconnecting ? "Connect the mailbox again" : "Email by IMAP"}
						{reconnecting ? null : (
							<StatusIndicator size="sm" tone="neutral" label="Not connected" />
						)}
					</div>
				</CardTitle>
				<CardDescription>
					Read-only mail from {host ?? "your mail server"}. Only conversations
					with companies in the CRM are stored.
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
						Connect
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
							<FieldLabel htmlFor={addressId}>Email address</FieldLabel>
							<Input
								id={addressId}
								type="email"
								value={address}
								onChange={(event) => setAddress(event.target.value)}
								placeholder="you@company.com"
								autoComplete="username"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={connect.isPending}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={passwordId}>Mailbox password</FieldLabel>
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
								Checked against the mail server, then stored encrypted. It is
								never shown again and nothing is ever sent from this mailbox.
							</FieldDescription>
						</Field>

						<div className="flex items-center justify-between gap-6">
							<Label
								htmlFor={autoCreateId}
								className="flex flex-col items-start gap-1"
							>
								<span className="text-sm">
									Import the last {historyDays} days
								</span>
								<span className="font-normal text-muted-foreground text-xs">
									{AUTO_CREATE}. Turn this off to file only mail from people
									already in the CRM.
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
				toast.success(`Removed ${result.purged} synced items.`);
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
							Email by IMAP
							<StatusIndicator
								size="sm"
								tone={failing ? "warning" : "success"}
								label={failing ? "Needs attention" : "Connected"}
							/>
						</div>
					</CardTitle>
					<CardDescription>
						{data.address} on {data.host}. Email threads land on the matching
						company each time the mailbox is checked.
					</CardDescription>

					<CardAction>
						<Button
							variant="contrast"
							size="sm"
							disabled={working}
							onClick={check}
						>
							{working ? "Checking…" : "Check now"}
						</Button>
					</CardAction>
				</CardHeader>

				<CardContent>
					{failing ? (
						<Alert variant="destructive">
							<Icon icon={Warning} />
							<AlertTitle>Email sync failed</AlertTitle>
							<AlertDescription>
								{data.lastError ?? "The mailbox needs connecting again."}
							</AlertDescription>
						</Alert>
					) : (
						<p className="text-muted-foreground text-xs">
							{working && data.importing ? (
								`Importing the last ${data.historyDays} days. Keep this page open.`
							) : paused ? (
								`The import of the last ${data.historyDays} days is not finished. Check now to continue.`
							) : data.lastSyncedAt ? (
								<>
									Last checked <LocalRelativeTime date={data.lastSyncedAt} />
								</>
							) : (
								"Waiting for the first check"
							)}
						</p>
					)}

					<div className="flex items-center justify-between gap-6">
						<Label
							htmlFor={autoCreateId}
							className="flex flex-col items-start gap-1"
						>
							<span className="text-sm">Email</span>
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
								Import the last {data.historyDays} days again
							</Button>

							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="ghost" size="xs" disabled={purge.isPending}>
										Delete synced data
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Delete synced data?</AlertDialogTitle>
										<AlertDialogDescription>
											Every email brought in from this mailbox is removed from
											the CRM. The mailbox itself is not touched. Nothing
											deleted here comes back unless you import the last{" "}
											{data.historyDays} days again.
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
										Disconnect mailbox
									</Button>
								</AlertDialogTrigger>

								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Disconnect this mailbox?
										</AlertDialogTitle>
										<AlertDialogDescription>
											New email stops arriving and the saved password is
											deleted. Everything already synced stays, and you can
											connect the mailbox again from this page.
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
