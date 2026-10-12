"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const BY_EMAIL = "auto";

export function AsanaPeople() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();

	const people = useQuery(trpc.asana.people.queryOptions());

	const assign = useMutation(
		trpc.asana.assign.mutationOptions({
			onSuccess: async (result) => {
				queryClient.setQueryData(trpc.asana.people.queryKey(), result);
				await cache.asana();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!people.data) return null;

	const { people: met, members } = people.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Quem é quem</CardTitle>
				<CardDescription>
					As pessoas com tarefa no projeto e quem cada uma é no CRM. Sem
					escolha, vale o e-mail igual.
				</CardDescription>
			</CardHeader>

			<CardContent>
				{met.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						Nenhuma tarefa com data tem responsável no Asana. Atribua as tarefas
						lá e clique em Verificar agora.
					</p>
				) : (
					met.map((person) => (
						<div
							key={person.gid}
							className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
						>
							<div className="flex min-w-0 flex-col">
								<span className="truncate font-medium text-sm">
									{person.name ?? person.email ?? "Pessoa sem nome"}
								</span>
								{person.name && person.email ? (
									<span className="truncate text-muted-foreground text-xs">
										{person.email}
									</span>
								) : null}
							</div>

							<div className="sm:w-64">
								<Select
									value={person.chosenUserId ?? BY_EMAIL}
									disabled={assign.isPending}
									onValueChange={(value) =>
										assign.mutate({
											gid: person.gid,
											userId: value === BY_EMAIL ? null : value,
										})
									}
								>
									<SelectTrigger
										aria-label={`Quem é ${person.name ?? person.email ?? "esta pessoa"} no CRM`}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={BY_EMAIL}>
											{person.emailMatchName
												? `Mesmo e-mail: ${person.emailMatchName}`
												: "Ninguém, fica com você"}
										</SelectItem>
										{members.map((member) => (
											<SelectItem key={member.id} value={member.id}>
												{member.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
