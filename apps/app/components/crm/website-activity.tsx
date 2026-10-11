"use client";

import { LOCALE } from "@crm/ui/lib/locale";
import { useQuery } from "@tanstack/react-query";
import {
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";

type Touch = {
	source: string;
	medium: string | null;
	campaign: string | null;
	at: string | null;
};

export function WebsiteActivity({
	companyId,
	contactId,
}: {
	companyId?: string;
	contactId?: string;
}) {
	const trpc = useTRPC();

	const company = useQuery({
		...trpc.tracking.companyActivity.queryOptions({
			companyId: companyId ?? "",
		}),
		enabled: Boolean(companyId),
	});

	const contact = useQuery({
		...trpc.tracking.contactActivity.queryOptions({
			contactId: contactId ?? "",
		}),
		enabled: Boolean(contactId) && !companyId,
	});

	const activity = companyId ? company.data : contact.data;

	if (!activity?.identified) return null;
	if (activity.pages.length === 0 && !activity.firstTouch) return null;

	const topPage = activity.pages[0];
	const first = activity.firstTouch;
	const last = activity.lastTouch;
	const channelChanged =
		first != null && last != null && channel(last) !== channel(first);
	const campaign = last?.campaign ?? first?.campaign ?? null;

	return (
		<DetailSheetSection title="Atividade no site">
			<DetailSheetProperties>
				<DetailSheetProperty label="Visualizações">
					<span className="tabular-nums">
						{activity.views.toLocaleString(LOCALE)}
					</span>
					{activity.lastSeenAt ? (
						<span className="text-muted-foreground">
							{" · última visita "}
							<LocalRelativeTime date={activity.lastSeenAt} />
						</span>
					) : null}
				</DetailSheetProperty>

				{first ? (
					<DetailSheetProperty label="Primeira origem">
						{channel(first)}
					</DetailSheetProperty>
				) : null}

				{topPage ? (
					<DetailSheetProperty label="Página mais vista">
						<span className="flex min-w-0 items-baseline gap-1">
							<span className="truncate font-mono" title={topPage.path}>
								{topPage.path}
							</span>
							<span className="shrink-0 text-muted-foreground">
								{"· "}
								<span className="tabular-nums">{topPage.views}</span>{" "}
								{topPage.views === 1 ? "visualização" : "visualizações"}
							</span>
						</span>
					</DetailSheetProperty>
				) : null}

				{channelChanged ? (
					<DetailSheetProperty label="Última origem">
						{channel(last)}
					</DetailSheetProperty>
				) : null}

				{first?.at ? (
					<DetailSheetProperty label="Primeira visita">
						<LocalRelativeTime date={first.at} />
					</DetailSheetProperty>
				) : null}

				{campaign ? (
					<DetailSheetProperty label="Campanha">{campaign}</DetailSheetProperty>
				) : null}
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function channel(touch: Touch | null): string {
	if (!touch) return "Desconhecida";
	if (!touch.medium || touch.medium === "direct") return touch.source;
	return `${touch.source} · ${touch.medium}`;
}
