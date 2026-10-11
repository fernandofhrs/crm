import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppNav, AppNavFallback } from "@/components/app-nav";
import { QuickSwitcher } from "@/components/crm/quick-switcher";
import { RecordSheetHost } from "@/components/crm/record-sheet/record-sheet-host";
import { MobileNavProvider } from "@/components/mobile-nav";
import { requireMailboxAccess } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

export default function AppLayout({
	children,
	params,
}: LayoutProps<"/[slug]">) {
	return (
		<MobileNavProvider>
			<div className="isolate flex h-svh flex-col md:flex-row">
				<Suspense fallback={<AppNavFallback />}>
					<WorkspaceNav params={params} />
				</Suspense>

				<div className="flex min-h-0 min-w-0 flex-1">{children}</div>

				<Suspense fallback={null}>
					<RecordSheetHost />
				</Suspense>

				<Suspense fallback={null}>
					<QuickSwitcher />
				</Suspense>
			</div>
		</MobileNavProvider>
	);
}

async function loadWorkspace() {
	try {
		return await getServerQueryClient().fetchQuery(
			getServerTrpc().workspace.get.queryOptions(),
		);
	} catch (error) {
		unstable_rethrow(error);
		return null;
	}
}

async function WorkspaceNav({
	params,
}: Pick<LayoutProps<"/[slug]">, "params">) {
	await connection();
	const [{ user }, { slug }, workspace] = await Promise.all([
		requireMailboxAccess(),
		params,
		loadWorkspace(),
	]);

	if (workspace && workspace.slug !== slug) notFound();

	return (
		<HydrateClient>
			<AppNav
				user={{
					name: user.name,
					email: user.email,
					image: user.image ?? null,
				}}
			/>
		</HydrateClient>
	);
}
