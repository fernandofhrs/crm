"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { CURRENCIES, normalizeCurrency } from "@crm/db/currency";
import type { FieldValueJson } from "@crm/db/fields";
import { Button } from "@crm/ui/components/button";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@crm/ui/components/entity-logo";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import {
	formatDecimalInput,
	formatMoney,
	parseDecimal,
} from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AgentPanel } from "@/components/crm/agent-panel";
import { InlineCompanyField } from "@/components/crm/company-picker";
import { contactName } from "@/components/crm/contact-name";
import { FieldsCog, RecordFields } from "@/components/crm/fields/record-fields";
import {
	InlineDateField,
	InlineField,
	InlineSelectField,
	InlineTextArea,
	InlineTextCell,
	savingValue,
} from "@/components/crm/inline-field";
import { OwnerCell } from "@/components/crm/owner-cell";
import { DealStageMenu } from "@/components/crm/stage-change";
import { StageStepper } from "@/components/crm/stage-stepper";
import { Timeline } from "@/components/crm/timeline/timeline";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
	DetailSheetStat,
	DetailSheetStats,
	type DetailSheetTab,
} from "@/components/detail-sheet";
import {
	LocalDateTime,
	LocalDay,
	LocalRelativeTime,
} from "@/components/local-date-time";
import { savingField } from "@/lib/pending-field";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { AttachDealContact } from "./quick-add";
import { RecordActions } from "./record-actions";
import { AddRow, RecordSheetFrame } from "./record-parts";
import { useOpenRecord, useRecordSheetView } from "./record-stack";

type Deal = RouterOutputs["deals"]["byId"];

const CURRENCY_OPTIONS = CURRENCIES.map((entry) => ({
	value: entry.code,
	label: `${entry.code} · ${entry.name}`,
}));

function dealCurrency(currency: string) {
	return normalizeCurrency(currency) || currency;
}

function currencyOptions(currency: string) {
	if (CURRENCY_OPTIONS.some((option) => option.value === currency)) {
		return CURRENCY_OPTIONS;
	}

	return [
		{ value: currency, label: `${currency}: não é mais aceita` },
		...CURRENCY_OPTIONS,
	];
}

function ReportedValue({ deal }: { deal: Deal }) {
	const currency = dealCurrency(deal.currency);

	if (currency === deal.reportingCurrency) return null;
	if (deal.amountCents === null) return null;

	return (
		<DetailSheetProperty label={`Em ${deal.reportingCurrency}`}>
			{deal.baseAmountCents === null ? (
				<span className="text-muted-foreground">
					Sem taxa de câmbio para {currency}: fica fora dos totais
				</span>
			) : (
				<span className="tabular-nums text-muted-foreground">
					≈ {formatMoney(deal.baseAmountCents, deal.reportingCurrency)}
				</span>
			)}
		</DetailSheetProperty>
	);
}

const CONTACT_COLUMNS = [
	{ id: "name", header: "Nome", width: "w-[28%]", className: "pl-5" },
	{ id: "role", header: "Papel", width: "w-[20%]" },
	{ id: "title", header: "Cargo", width: "w-[22%]" },
	{ id: "email", header: "E-mail", width: "w-[22%]" },
	{ id: "remove", srLabel: "Remover", width: "w-10" },
];

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	year: "numeric",
};

export function DealSheet({ dealId }: { dealId: string }) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const {
		tab,
		setTab,
		form: adding,
		setForm: setAdding,
	} = useRecordSheetView("overview");

	const query = useQuery(trpc.deals.byId.queryOptions({ id: dealId }));
	const deal = query.data;

	const tabs: DetailSheetTab[] = deal
		? [
				{
					value: "overview",
					label: "Visão geral",
					content: <DealOverview deal={deal} />,
				},
				{
					value: "contacts",
					label: "Contatos",
					count: deal.contacts.length,
					content: (
						<DealContacts
							deal={deal}
							adding={adding === "contact"}
							onAdd={() => setAdding("contact")}
							onDone={() => setAdding(null)}
						/>
					),
				},
				{
					value: "activity",
					label: "Atividade",
					content: <Timeline anchor={{ dealId: deal.id }} />,
				},
				{
					value: "agent",
					label: "Agente",
					content: <AgentPanel record={{ kind: "deal", id: deal.id }} />,
					keepMounted: true,
				},
			]
		: [];

	return (
		<RecordSheetFrame
			loading={query.isPending}
			error={query.error?.message ?? null}
			title={deal?.name ?? "Negócio"}
			description={
				deal ? (
					<button
						type="button"
						onClick={() => openRecord({ kind: "company", id: deal.company.id })}
						className="text-foreground underline-offset-2 hover:underline"
					>
						{deal.company.name}
					</button>
				) : undefined
			}
			media={
				deal ? (
					<EntityLogo
						src={deal.company.iconUrl}
						darkSrc={deal.company.iconDarkUrl}
						tone={deal.company.iconTone as EntityLogoTone | null | undefined}
						name={deal.company.name}
						size="lg"
					/>
				) : null
			}
			actions={
				deal ? (
					<>
						<DealStageMenu
							dealId={deal.id}
							stage={deal.stage}
							variant="control"
						/>
						<RecordActions
							record={{ kind: "deal", id: deal.id }}
							name={deal.name}
							consequence={`O histórico de etapas, as notas e as conversas com o agente também são excluídos. ${deal.company.name} e ${deal.contacts.length === 1 ? "a pessoa ligada" : "as pessoas ligadas"} ao negócio continuam no CRM.`}
							archivedAt={deal.archivedAt}
						/>
					</>
				) : null
			}
			stats={
				deal ? (
					<DetailSheetStats>
						<DetailSheetStat label="Valor">
							{deal.amountCents === null ? (
								<EmptyCellValue />
							) : (
								<span className="tabular-nums">
									{formatMoney(deal.amountCents, dealCurrency(deal.currency))}
								</span>
							)}
						</DetailSheetStat>
						<DetailSheetStat label="Previsão de fechamento">
							{deal.expectedCloseDate ? (
								<LocalDay date={deal.expectedCloseDate} />
							) : (
								<EmptyCellValue />
							)}
						</DetailSheetStat>
						<DetailSheetStat label="Na etapa">
							<LocalRelativeTime date={deal.stageChangedAt} />
						</DetailSheetStat>
						<DetailSheetStat label="Responsável">
							<OwnerCell owner={deal.owner} />
						</DetailSheetStat>
					</DetailSheetStats>
				) : null
			}
			tabs={tabs}
			tab={tab}
			onTabChange={setTab}
		/>
	);
}

function DealOverview({ deal }: { deal: Deal }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const users = useQuery(trpc.users.list.queryOptions());

	const update = useMutation(
		trpc.deals.update.mutationOptions({
			onSuccess: () => cache.deal(deal.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const saveFields = (fields: Record<string, FieldValueJson>) =>
		update.mutate({ id: deal.id, data: { fields } });

	const isSavingField = savingValue(update);

	const save = (data: Parameters<typeof update.mutate>[0]["data"]) =>
		update.mutate({ id: deal.id, data });

	const currency = dealCurrency(deal.currency);

	const isSaving = savingField(update);

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Etapa">
				<StageStepper dealId={deal.id} stage={deal.stage} />

				{deal.closedReason ? (
					<DetailSheetProperties>
						<DetailSheetProperty label="Fechado em">
							{deal.closedAt ? (
								<LocalDateTime date={deal.closedAt} options={DATE_OPTIONS} />
							) : (
								<EmptyCellValue />
							)}
						</DetailSheetProperty>
						<DetailSheetProperty label="Motivo" wide>
							{deal.closedReason}
						</DetailSheetProperty>
					</DetailSheetProperties>
				) : null}
			</DetailSheetSection>

			<DetailSheetSection title="Detalhes" action={<FieldsCog kind="deal" />}>
				<DetailSheetProperties>
					<InlineField
						label="Nome"
						value={deal.name}
						saving={isSaving("name")}
						onSave={(name) => name && save({ name })}
					/>
					<InlineField
						label="Valor"
						value={
							deal.amountCents === null
								? null
								: formatDecimalInput(deal.amountCents / 100)
						}
						placeholder="24.000,00"
						saving={isSaving("amountCents")}
						onSave={(next) => {
							if (next === "") return save({ amountCents: null });
							const parsed = parseDecimal(next);
							if (!Number.isFinite(parsed) || parsed < 0) {
								toast.error("O valor precisa ser um número.");
								return;
							}
							save({ amountCents: Math.round(parsed * 100) });
						}}
						render={(value) =>
							formatMoney(Math.round(parseDecimal(value) * 100), currency)
						}
					/>
					<InlineSelectField
						label="Moeda"
						value={currency}
						options={currencyOptions(currency)}
						onSave={(currency) => save({ currency })}
					/>
					<ReportedValue deal={deal} />
					<InlineDateField
						label="Fechamento"
						value={deal.expectedCloseDate}
						saving={isSaving("expectedCloseDate")}
						onSave={(next) => save({ expectedCloseDate: next || null })}
					/>
					<InlineCompanyField
						value={deal.company.id}
						company={deal.company}
						saving={isSaving("companyId")}
						onSave={(companyId) => save({ companyId })}
					/>
					<InlineSelectField
						label="Responsável"
						value={deal.owner.id}
						options={(users.data ?? []).map((user) => ({
							value: user.id,
							label: user.name,
						}))}
						onSave={(ownerId) => save({ ownerId })}
					/>
					<RecordFields
						fields={deal.fields}
						saving={isSavingField}
						onSave={saveFields}
					/>
				</DetailSheetProperties>
			</DetailSheetSection>

			<DetailSheetSection title="Descrição">
				<InlineTextArea
					label="Descrição"
					value={deal.description}
					placeholder={`O que ${deal.company.name} está comprando, por que agora e o que está no caminho.`}
					saving={isSaving("description")}
					onSave={(description) => save({ description })}
				/>
			</DetailSheetSection>

			<WhereItStands deal={deal} />
		</DetailSheetBody>
	);
}

function WhereItStands({ deal }: { deal: Deal }) {
	const openRecord = useOpenRecord();

	return (
		<DetailSheetSection title="Situação">
			<DetailSheetProperties>
				<DetailSheetProperty label="Aberto em">
					<LocalDateTime date={deal.createdAt} options={DATE_OPTIONS} />
				</DetailSheetProperty>

				<DetailSheetProperty label="Na etapa desde">
					<LocalDateTime date={deal.stageChangedAt} options={DATE_OPTIONS} />
				</DetailSheetProperty>

				{deal.closedAt ? (
					<DetailSheetProperty label="Fechado em">
						<LocalDateTime date={deal.closedAt} options={DATE_OPTIONS} />
					</DetailSheetProperty>
				) : null}

				{deal.closedReason ? (
					<DetailSheetProperty label="Motivo" wide>
						{deal.closedReason}
					</DetailSheetProperty>
				) : null}

				<DetailSheetProperty label="Contatos" wide>
					{deal.contacts.length === 0 ? (
						<span className="text-muted-foreground">
							Nenhum contato de {deal.company.name} neste negócio ainda.
						</span>
					) : (
						<span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
							{deal.contacts.map((contact) => {
								const aside = contact.role ?? contact.title;
								return (
									<button
										key={contact.id}
										type="button"
										onClick={() =>
											openRecord({ kind: "contact", id: contact.id })
										}
										className="min-w-0 truncate underline-offset-2 hover:underline"
									>
										{contactName(contact)}
										{aside ? (
											<span className="text-muted-foreground"> ({aside})</span>
										) : null}
									</button>
								);
							})}
						</span>
					)}
				</DetailSheetProperty>
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function DealContacts({
	deal,
	adding,
	onAdd,
	onDone,
}: {
	deal: Deal;
	adding: boolean;
	onAdd: () => void;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();

	const detach = useMutation(
		trpc.deals.detachContact.mutationOptions({
			onSuccess: () => cache.deal(deal.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const setRole = useMutation(
		trpc.deals.setContactRole.mutationOptions({
			onSuccess: () => cache.deal(deal.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const form = adding ? (
		<AttachDealContact
			dealId={deal.id}
			companyName={deal.company.name}
			onDone={onDone}
		/>
	) : null;

	if (deal.contacts.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={UserMultiple}
						title="Nenhum contato neste negócio"
						description={`Ninguém de ${deal.company.name} foi adicionado ainda. Traga para o negócio as pessoas para quem você está vendendo e ele mostra quem acionar.`}
						action={
							<Button variant="outline" size="sm" onClick={onAdd}>
								<Icon icon={Add} data-icon="inline-start" />
								Adicionar contato
							</Button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={CONTACT_COLUMNS}>
				{deal.contacts.map((contact) => (
					<SimpleTableRow
						key={contact.id}
						clickable
						onClick={() => openRecord({ kind: "contact", id: contact.id })}
					>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							<span className="flex min-w-0 items-center gap-2">
								<PersonAvatar
									src={contact.imageUrl}
									name={contactName(contact)}
									email={contact.email}
									size="sm"
								/>
								<span className="truncate">{contactName(contact)}</span>
							</span>
						</TableCell>
						<TableCell className="truncate px-1 py-2.5">
							<InlineTextCell
								label={`Papel de ${contactName(contact)} neste negócio`}
								value={contact.role}
								placeholder="Decisor"
								saving={
									setRole.isPending &&
									setRole.variables?.contactId === contact.id
								}
								onSave={(role) =>
									setRole.mutate({
										dealId: deal.id,
										contactId: contact.id,
										role: role || null,
									})
								}
							/>
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{contact.title ?? <EmptyCellValue />}
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{contact.email ?? <EmptyCellValue />}
						</TableCell>
						<TableCell className="px-3 py-2.5">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										disabled={detach.isPending}
										onClick={(event) => {
											event.stopPropagation();
											detach.mutate({
												dealId: deal.id,
												contactId: contact.id,
											});
										}}
									>
										<Icon icon={Close} />
										<span className="sr-only">
											Tirar {contactName(contact)} deste negócio
										</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>Tirar deste negócio</TooltipContent>
							</Tooltip>
						</TableCell>
					</SimpleTableRow>
				))}

				<AddRow
					label="Adicionar contato"
					columns={CONTACT_COLUMNS.length}
					onClick={onAdd}
				/>
			</SimpleTable>
		</>
	);
}
