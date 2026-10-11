import { cn } from "@crm/ui/lib/utils";
import type * as React from "react";

type TrendDirection = "up" | "down" | "neutral";

type StatDelta = {
	value: string;
	direction?: TrendDirection;
	label?: string;
};

const TREND_COLOR: Record<TrendDirection, string> = {
	up: "text-success",
	down: "text-destructive",
	neutral: "text-muted-foreground",
};

const TREND_GLYPH: Record<TrendDirection, string> = {
	up: "↑",
	down: "↓",
	neutral: "→",
};

function inferDirection(value: string): TrendDirection {
	if (value.trim().startsWith("-")) return "down";
	if (value.trim().startsWith("+")) return "up";
	return "neutral";
}

function StatDeltaText({
	delta,
	className,
}: {
	delta: StatDelta;
	className?: string;
}) {
	const direction = delta.direction ?? inferDirection(delta.value);
	return (
		<span className={cn("inline-flex items-baseline gap-1.5", className)}>
			<span
				className={cn(
					"inline-flex items-baseline gap-0.5 font-medium text-xs tabular-nums",
					TREND_COLOR[direction],
				)}
			>
				{direction !== "neutral" ? (
					<span aria-hidden>{TREND_GLYPH[direction]}</span>
				) : null}
				{delta.value}
			</span>
			{delta.label ? (
				<span className="text-muted-foreground text-xs">{delta.label}</span>
			) : null}
		</span>
	);
}

type StatTone = "neutral" | "primary" | "success" | "warning" | "info";

const TONE_SURFACE: Record<StatTone, string> = {
	neutral: "bg-card",
	primary: "bg-tint-primary",
	success: "bg-tint-success",
	warning: "bg-tint-warning",
	info: "bg-tint-info",
};

function StatCard({
	label,
	value,
	delta,
	description,
	tone = "neutral",
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	label?: React.ReactNode;
	value: React.ReactNode;
	delta?: StatDelta;
	description?: React.ReactNode;
	tone?: StatTone;
}) {
	return (
		<div
			data-slot="stat-card"
			data-tone={tone}
			className={cn(
				"flex min-w-0 flex-col gap-2 rounded-lg border border-foreground/5 p-4 md:p-5",
				TONE_SURFACE[tone],
				className,
			)}
			{...props}
		>
			{label != null ? (
				<span className="text-pretty font-semibold text-[13px] text-foreground/70 leading-snug">
					{label}
				</span>
			) : null}
			<div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
				<span className="font-bold text-2xl tracking-tight tabular-nums md:text-[1.75rem]">
					{value}
				</span>
				{delta ? <StatDeltaText delta={delta} /> : null}
			</div>
			{description ? (
				<p className="text-pretty text-foreground/65 text-xs/relaxed">
					{description}
				</p>
			) : null}
			{children}
		</div>
	);
}

export type { StatDelta, StatTone, TrendDirection };
export { StatCard, StatDeltaText };
