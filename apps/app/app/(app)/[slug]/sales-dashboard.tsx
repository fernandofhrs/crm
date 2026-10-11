"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import type { ChartConfig } from "@crm/ui/components/chart";
import { DashboardRow, StatGroup } from "@crm/ui/components/dashboard";
import { StatCard, type StatDelta } from "@crm/ui/components/stat-card";
import {
	formatCount,
	formatMoney,
	formatMoneyCompact,
	formatPercent,
} from "@crm/ui/lib/format";
import Link from "next/link";
import type { ReactNode } from "react";
import { AreaTrend, DonutStat } from "@/components/dashboard-charts";
import { dealStageColor, dealStageLabel } from "@/lib/deal-stage";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Summary = RouterOutputs["dashboard"]["summary"];

const TREND_CONFIG: ChartConfig = {
	won: { label: "Ganhos", color: "var(--success)" },
	created: { label: "Novos no funil", color: "var(--chart-1)" },
};

function changeDelta(
	current: number,
	previous: number,
	label: string,
): StatDelta | undefined {
	if (previous === 0) return undefined;
	const change = Math.round(((current - previous) / previous) * 100);
	return {
		value: `${change >= 0 ? "+" : ""}${change}%`,
		direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
		label,
	};
}

export function SalesDashboard({ summary }: { summary: Summary }) {
	const workspaceUrl = useWorkspaceUrl();

	const {
		pipeline,
		wonThisMonth,
		wonPrevMonth,
		performance,
		trend,
		closingThisMonthTotal,
		reportingCurrency,
		unconverted,
	} = summary;

	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);
	const exact = (value: number | string) =>
		formatMoney(Number(value), reportingCurrency);

	const hasTrend = trend.some((point) => point.won > 0 || point.created > 0);

	const stageSlices = pipeline.stages.flatMap((stage) =>
		stage.valueCents > 0
			? [
					{
						key: stage.stage,
						label: dealStageLabel(stage.stage),
						value: stage.valueCents,
						color: dealStageColor(stage.stage),
						count: stage.count,
					},
				]
			: [],
	);

	return (
		<div className="flex flex-col gap-6">
			<StatGroup>
				<StatCard
					tone="success"
					label="Ganho no mês"
					value={money(wonThisMonth.valueCents)}
					delta={changeDelta(
						wonThisMonth.valueCents,
						wonPrevMonth.valueCents,
						"vs. mês passado",
					)}
					description={`${formatCount(wonThisMonth.count, "negócio")} · ${money(wonPrevMonth.valueCents)} no mês passado`}
				/>
				<StatCard
					tone="primary"
					label="Funil em aberto"
					value={money(pipeline.totalCents)}
					description={`${formatCount(pipeline.totalDeals, "negócio")} em andamento · ${money(closingThisMonthTotal.valueCents)} com fechamento neste mês`}
				/>
				<StatCard
					tone="info"
					label={`Taxa de ganho (${performance.windowDays} dias)`}
					value={
						performance.winRate === null
							? "—"
							: formatPercent(performance.winRate)
					}
					description={
						performance.wins + performance.losses === 0
							? "Nenhum negócio fechado ainda"
							: `${formatCount(performance.wins, "ganho")} · ${formatCount(performance.losses, "perdido")}`
					}
				/>
				<StatCard
					tone="warning"
					label={`Ticket médio (${performance.windowDays} dias)`}
					value={
						performance.avgDealCents === null
							? "—"
							: money(performance.avgDealCents)
					}
					description={
						performance.avgCycleDays === null
							? "Sem ganhos para medir"
							: `Ciclo médio de ${formatCount(performance.avgCycleDays, "dia")}`
					}
				/>
			</StatGroup>

			{unconverted.count > 0 ? (
				<p className="text-muted-foreground text-xs">
					Os valores acima estão em {reportingCurrency}.{" "}
					{unconverted.count === 1
						? `1 negócio em ${unconverted.currencies.join(", ")} ficou de fora`
						: `${unconverted.count} negócios em ${unconverted.currencies.join(", ")} ficaram de fora`}
					: falta a taxa de câmbio.{" "}
					<Link
						href={workspaceUrl("/settings/currencies")}
						className="underline hover:no-underline"
					>
						Definir a taxa
					</Link>
					.
				</p>
			) : null}

			<DashboardRow split="hero">
				<ChartPanel
					title="Ganhos e novos negócios"
					description="Últimos seis meses, pelo mês em que o negócio foi ganho ou criado"
				>
					{hasTrend ? (
						<div className="flex flex-1 flex-col justify-center py-4">
							<AreaTrend
								data={trend}
								config={TREND_CONFIG}
								xKey="month"
								height={196}
								variant="gradient"
								bloom="high"
								showLegend
								formatValue={exact}
							/>
						</div>
					) : (
						<EmptyChart label="Nenhum negócio ganho ou criado ainda" />
					)}
				</ChartPanel>

				<ChartPanel
					title="Funil em aberto por etapa"
					description="Onde o valor está agora"
				>
					{stageSlices.length > 0 ? (
						<div className="flex flex-1 flex-col justify-between gap-1 pt-4">
							<DonutStat
								data={stageSlices}
								height={168}
								centerValue={money(pipeline.totalCents)}
								centerLabel="em aberto"
								formatValue={exact}
							/>
							<ul className="flex flex-col px-5 pb-1 md:px-6">
								{stageSlices.map((slice) => (
									<li key={slice.key} className="border-t first:border-t-0">
										<Link
											href={`${workspaceUrl("/deals")}?view=list&stage=${slice.key}`}
											className="flex items-center gap-2.5 py-2 text-xs hover:underline"
										>
											<span
												aria-hidden
												className="size-2 shrink-0 rounded-full"
												style={{ backgroundColor: slice.color }}
											/>
											<span className="min-w-0 flex-1 truncate">
												{slice.label}
											</span>
											<span className="shrink-0 text-muted-foreground tabular-nums">
												{slice.count}
											</span>
											<span className="w-14 shrink-0 text-right font-medium tabular-nums">
												{money(slice.value)}
											</span>
										</Link>
									</li>
								))}
							</ul>
						</div>
					) : (
						<EmptyChart label="Nada em aberto" />
					)}
				</ChartPanel>
			</DashboardRow>
		</div>
	);
}

function ChartPanel({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardHeader>
			<div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-xs">
				{children}
			</div>
		</Card>
	);
}

function EmptyChart({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
			{label}
		</div>
	);
}
