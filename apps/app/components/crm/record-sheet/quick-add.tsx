"use client";

import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { parseDecimal } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function QuickAddForm({
	submitLabel,
	pending,
	ready,
	onSubmit,
	onCancel,
	children,
}: {
	submitLabel: string;
	pending: boolean;
	ready: boolean;
	onSubmit: () => void;
	onCancel: () => void;
	children: React.ReactNode;
}) {
	return (
		<form
			className="flex shrink-0 flex-col gap-4 border-b px-5 py-4"
			action={onSubmit}
		>
			<div className="grid gap-4 sm:grid-cols-2">{children}</div>
			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={pending}
					onClick={onCancel}
				>
					Cancelar
				</Button>
				<Button type="submit" size="sm" disabled={pending || !ready}>
					{pending ? <Spinner /> : null}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}

export function QuickAddContact({
	companyId,
	ownerId,
	onDone,
}: {
	companyId: string;
	ownerId: string | null;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [title, setTitle] = useState("");

	const firstNameId = useId();
	const lastNameId = useId();
	const emailId = useId();
	const titleId = useId();

	const create = useMutation(
		trpc.contacts.create.mutationOptions({
			onSuccess: async (contact) => {
				await cache.contact(contact.id);
				toast.success(`Você adicionou ${contact.firstName}.`);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel="Adicionar contato"
			pending={create.isPending}
			ready={firstName.trim() !== ""}
			onCancel={onDone}
			onSubmit={() =>
				create.mutate({
					firstName,
					lastName: lastName || undefined,
					email: email || undefined,
					title: title || undefined,
					companyId,
					ownerId,
				})
			}
		>
			<Field>
				<FieldLabel htmlFor={firstNameId}>Nome</FieldLabel>
				<Input
					id={firstNameId}
					autoFocus
					value={firstName}
					onChange={(event) => setFirstName(event.target.value)}
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={lastNameId}>Sobrenome</FieldLabel>
				<Input
					id={lastNameId}
					value={lastName}
					onChange={(event) => setLastName(event.target.value)}
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={emailId}>E-mail</FieldLabel>
				<Input
					id={emailId}
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={titleId}>Cargo</FieldLabel>
				<Input
					id={titleId}
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					placeholder="Gerente de compras"
					autoComplete="off"
				/>
			</Field>
		</QuickAddForm>
	);
}

export function AttachDealContact({
	dealId,
	companyName,
	onDone,
}: {
	dealId: string;
	companyName: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [contactId, setContactId] = useState("");
	const [role, setRole] = useState("");

	const personId = useId();
	const roleId = useId();

	const options = useQuery(trpc.deals.contactOptions.queryOptions({ dealId }));
	const candidates = options.data ?? [];

	const attach = useMutation(
		trpc.deals.attachContact.mutationOptions({
			onSuccess: async (attached) => {
				const person = candidates.find(
					(candidate) => candidate.id === attached.contactId,
				);
				await cache.deal(dealId);
				toast.success(
					person
						? `${contactName(person)} está no negócio.`
						: "Contato adicionado ao negócio.",
				);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const nobody = !options.isPending && candidates.length === 0;

	const placeholder = options.isPending
		? "Carregando…"
		: nobody
			? `Todos os contatos de ${companyName} já estão no negócio`
			: "Escolha alguém";

	return (
		<QuickAddForm
			submitLabel="Adicionar ao negócio"
			pending={attach.isPending}
			ready={contactId !== ""}
			onCancel={onDone}
			onSubmit={() =>
				attach.mutate({ dealId, contactId, role: role.trim() || null })
			}
		>
			<Field>
				<FieldLabel htmlFor={personId}>Pessoa</FieldLabel>
				<Select value={contactId} onValueChange={setContactId}>
					<SelectTrigger id={personId} className="w-full" disabled={nobody}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>
						{candidates.map((candidate) => (
							<SelectItem key={candidate.id} value={candidate.id}>
								{contactName(candidate)}
								{candidate.title ? ` · ${candidate.title}` : ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor={roleId}>Papel</FieldLabel>
				<Input
					id={roleId}
					value={role}
					onChange={(event) => setRole(event.target.value)}
					placeholder="Decisor"
					autoComplete="off"
				/>
			</Field>
		</QuickAddForm>
	);
}

export function QuickAddDeal({
	companyId,
	companyName,
	ownerId,
	onDone,
}: {
	companyId: string;
	companyName: string;
	ownerId: string | null;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [closeDate, setCloseDate] = useState("");

	const nameId = useId();
	const amountId = useId();
	const closeId = useId();

	const me = useQuery(trpc.users.me.queryOptions());
	const owner = ownerId ?? me.data?.id ?? null;

	const create = useMutation(
		trpc.deals.create.mutationOptions({
			onSuccess: async (deal) => {
				await cache.deal(deal.id);
				toast.success(`Você criou ${deal.name}.`);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		if (!owner) {
			toast.error(
				"Não foi possível definir quem é responsável por este negócio.",
			);
			return;
		}

		let amountCents: number | null = null;
		if (amount.trim() !== "") {
			const parsed = parseDecimal(amount);
			if (!Number.isFinite(parsed) || parsed < 0) {
				toast.error("O valor precisa ser um número.");
				return;
			}
			amountCents = Math.round(parsed * 100);
		}

		create.mutate({
			name,
			companyId,
			ownerId: owner,
			amountCents,
			expectedCloseDate: closeDate || null,
		});
	};

	return (
		<QuickAddForm
			submitLabel="Criar negócio"
			pending={create.isPending}
			ready={name.trim() !== ""}
			onCancel={onDone}
			onSubmit={submit}
		>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={nameId}>Nome</FieldLabel>
				<Input
					id={nameId}
					autoFocus
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder={`${companyName}: primeiro pedido`}
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={amountId}>Valor</FieldLabel>
				<Input
					id={amountId}
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					placeholder="24.000,00"
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={closeId}>Previsão de fechamento</FieldLabel>
				<DatePicker
					id={closeId}
					value={closeDate}
					onChange={setCloseDate}
					placeholder="Sem data ainda"
				/>
			</Field>
		</QuickAddForm>
	);
}
