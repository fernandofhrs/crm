"use client";

import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Spinner } from "@crm/ui/components/spinner";
import { IndicatorDot } from "@crm/ui/components/status-indicator";
import { formatMoney, formatMoneyCompact } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CompanyCell } from "@/components/crm/company-cell";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { dealStagePresentation, isClosedStage } from "@/lib/deal-stage";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { DEALS_BOARD } from "./deals-board-config";
import { dealsSearchParams } from "./deals-search-params";
import { DealsViewToggle } from "./deals-view-toggle";

type DealRow = RouterOutputs["deals"]["list"]["rows"][number];

type BoardColumn = (typeof DEALS_BOARD.columns)[number];

export function DealsBoard() {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<ListSearch placeholder="Buscar negócios por nome ou empresa…" />
				<DealsViewToggle />
			</div>

			<div className="-mx-4 flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:snap-none md:px-0">
				{DEALS_BOARD.columns.map((column) => (
					<StageColumn key={column.stage} column={column} />
				))}
			</div>
		</div>
	);
}

function StageColumn({ column }: { column: BoardColumn }) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();
	const { input } = useTableQuery(dealsSearchParams);
	const { label, tone } = dealStagePresentation(column.stage);
	const won = isClosedStage(column.stage);

	const deals = useQuery({
		...trpc.deals.list.queryOptions({
			...input,
			archived: false,
			status: "all",
			stage: [column.stage],
			sort: column.sort,
			dir: "desc",
			page: 1,
			pageSize: DEALS_BOARD.pageSize,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = deals.data?.rows ?? [];
	const total = deals.data?.total ?? 0;
	const valueCents = deals.data?.openValueCents ?? null;
	const currency = deals.data?.reportingCurrency;
	const hidden = total - rows.length;

	return (
		<section
			aria-label={label}
			className={cn(
				"w-[84vw] max-w-[340px] shrink-0 snap-center flex-col rounded-lg border border-foreground/5 md:flex md:w-[260px] md:max-w-none xl:w-auto xl:min-w-[200px] xl:flex-1",
				deals.data && total === 0 ? "hidden" : "flex",
				won ? "bg-tint-success" : "bg-tint-neutral",
			)}
		>
			<header className="flex flex-col gap-0.5 px-3.5 pt-3 pb-2">
				<div className="flex items-center gap-2">
					<IndicatorDot tone={tone} bloom="off" aria-hidden="true" />
					<h2 className="min-w-0 flex-1 truncate font-semibold text-sm">
						{label}
					</h2>
					<span className="rounded-full bg-card px-2 py-0.5 font-semibold text-[11px] tabular-nums">
						{deals.data ? total : "…"}
					</span>
				</div>
				<p className="h-4 text-[12px] text-foreground/65 tabular-nums">
					{valueCents !== null && currency && !won
						? formatMoneyCompact(valueCents, currency)
						: won
							? "Mais recentes primeiro"
							: null}
				</p>
			</header>

			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
				{deals.isPending ? (
					<div className="flex justify-center py-8">
						<Spinner />
					</div>
				) : rows.length === 0 ? (
					<p className="px-2 py-6 text-center text-[12.5px] text-foreground/55">
						Nenhum negócio nesta etapa.
					</p>
				) : (
					rows.map((deal) => (
						<DealCard
							key={deal.id}
							deal={deal}
							onOpen={() => openRecord({ kind: "deal", id: deal.id })}
							onHover={() => prefetchRecord({ kind: "deal", id: deal.id })}
						/>
					))
				)}

				{hidden > 0 ? (
					<p className="px-2 py-1 text-center text-[12px] text-foreground/60">
						{hidden === 1
							? "Mais 1 negócio na lista."
							: `Mais ${hidden} negócios na lista.`}
					</p>
				) : null}
			</div>
		</section>
	);
}

function DealCard({
	deal,
	onOpen,
	onHover,
}: {
	deal: DealRow;
	onOpen: () => void;
	onHover: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onOpen}
			onMouseEnter={onHover}
			onFocus={onHover}
			className="flex shrink-0 cursor-pointer flex-col gap-2.5 rounded-md border bg-card p-3 text-left shadow-xs outline-none transition-[border-color,box-shadow] hover:border-ring/50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/60"
		>
			<span className="line-clamp-2 font-semibold text-[13px] leading-snug">
				{deal.name}
			</span>

			<span className="text-[12.5px] text-muted-foreground">
				<CompanyCell company={deal.company} />
			</span>

			<span className="flex items-center justify-between gap-2">
				<span className="font-bold text-sm tabular-nums">
					{deal.amountCents === null ? (
						<EmptyCellValue />
					) : (
						formatMoney(deal.amountCents, deal.currency)
					)}
				</span>
				{deal.expectedCloseDate ? (
					<span className="rounded-sm border px-1.5 py-0.5 text-[11px] text-muted-foreground">
						<LocalDay date={deal.expectedCloseDate} />
					</span>
				) : null}
			</span>

			<span className="flex items-center justify-between gap-2 border-t pt-2 text-[12px] text-muted-foreground">
				<OwnerCell owner={deal.owner} />
				{deal.lastActivityAt ? (
					<span className="shrink-0">
						<LocalRelativeTime date={deal.lastActivityAt} />
					</span>
				) : null}
			</span>
		</button>
	);
}
