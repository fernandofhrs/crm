"use client";

import Asleep from "@carbon/icons-react/es/Asleep";
import Building from "@carbon/icons-react/es/Building";
import ChevronSort from "@carbon/icons-react/es/ChevronSort";
import Close from "@carbon/icons-react/es/Close";
import Home from "@carbon/icons-react/es/Home";
import Light from "@carbon/icons-react/es/Light";
import Logout from "@carbon/icons-react/es/Logout";
import Menu from "@carbon/icons-react/es/Menu";
import Partnership from "@carbon/icons-react/es/Partnership";
import Search from "@carbon/icons-react/es/Search";
import Settings from "@carbon/icons-react/es/Settings";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import Bot from "@crm/ui/components/icons/bot";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Skeleton } from "@crm/ui/components/skeleton";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useMemo } from "react";
import { toast } from "sonner";
import { AgentBuilderSidebar } from "@/components/agent-builder/agent-builder-sidebar";
import { usePrefetchSection } from "@/components/crm/section-prefetch";
import { EnrichmentQueue } from "@/components/enrichment-queue";
import { useMobileNav } from "@/components/mobile-nav";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { signOutAndRedirect } from "@/lib/sign-out";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { workspaceLabel } from "@/lib/workspace-label";

type User = { name: string; email: string; image: string | null };

type NavItem = {
	title: string;
	short: string;
	href: string;
	icon: CarbonIcon;
	iconClassName?: string;
	match: "exact" | "prefix";
	related?: string[];
	tab: boolean;
};

const CHAT_HREF = "/chat";

const ITEMS: NavItem[] = [
	{
		title: "Início",
		short: "Início",
		href: "/",
		icon: Home,
		match: "exact",
		tab: true,
	},
	{
		title: "Empresas",
		short: "Empresas",
		href: "/companies",
		icon: Building,
		match: "prefix",
		tab: true,
	},
	{
		title: "Contatos",
		short: "Contatos",
		href: "/contacts",
		icon: UserMultiple,
		match: "prefix",
		tab: true,
	},
	{
		title: "Negócios",
		short: "Negócios",
		href: "/deals",
		icon: Partnership,
		match: "prefix",
		tab: true,
	},
	{
		title: "Chat com o agente",
		short: "Chat",
		href: CHAT_HREF,
		icon: Bot,
		iconClassName: "size-5",
		match: "prefix",
		related: ["/agents"],
		tab: true,
	},
	{
		title: "Configurações",
		short: "Ajustes",
		href: "/settings",
		icon: Settings,
		match: "prefix",
		tab: false,
	},
];

type ResolvedItem = NavItem & { section: string };

function isActive(item: NavItem, pathname: string): boolean {
	return (
		pathname === item.href ||
		(item.match === "prefix" && pathname.startsWith(item.href)) ||
		Boolean(item.related?.some((prefix) => pathname.startsWith(prefix)))
	);
}

function initials(name: string): string {
	return (
		name
			.split(" ")
			.map((part) => part[0])
			.filter(Boolean)
			.slice(0, 2)
			.join("")
			.toUpperCase() || "?"
	);
}

function useNavItems(): { items: ResolvedItem[]; inChat: boolean } {
	const pathname = usePathname();
	const workspaceUrl = useWorkspaceUrl();

	return useMemo(() => {
		const items = ITEMS.map((item) => ({
			...item,
			section: item.href,
			href: workspaceUrl(item.href),
			related: item.related?.map((path) => workspaceUrl(path)),
		}));

		return {
			items,
			inChat: items.some(
				(item) => item.section === CHAT_HREF && isActive(item, pathname),
			),
		};
	}, [pathname, workspaceUrl]);
}

function useOpenSearch(): () => void {
	const [, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.switcher,
		parseAsBoolean.withDefault(false),
	);

	return () => {
		void setOpen(true);
	};
}

function signOut() {
	signOutAndRedirect().catch(() => toast.error("Não foi possível sair."));
}

export function AppNav({ user }: { user: User }) {
	const pathname = usePathname();
	const workspaceUrl = useWorkspaceUrl();
	const prefetchSection = usePrefetchSection();
	const openSearch = useOpenSearch();
	const { open, setOpen } = useMobileNav();
	const { items, inChat } = useNavItems();
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const label = workspaceLabel(workspace.data?.name);
	const wide = !inChat;

	return (
		<>
			<header className="flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar px-3 md:hidden in-data-embedded:hidden! [view-transition-name:app-header]">
				{inChat ? (
					<Button
						variant="ghost"
						size="icon"
						aria-label="Abrir a lista de conversas"
						onClick={() => setOpen(true)}
					>
						<Menu />
					</Button>
				) : null}
				<Link
					href={workspaceUrl()}
					aria-label="Início"
					className="flex min-w-0 items-center gap-2.5"
				>
					<BrandMark />
					<span className="min-w-0 truncate font-semibold text-sm">
						{label}
					</span>
				</Link>

				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Buscar"
						onClick={openSearch}
					>
						<Search />
					</Button>
					<EnrichmentQueue layout="compact" />
					<UserMenu user={user} settingsHref={workspaceUrl("/settings")}>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Menu da conta"
							className="hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent"
						>
							<UserFace user={user} />
						</Button>
					</UserMenu>
				</div>
			</header>

			<aside
				className={cn(
					"hidden w-[84px] shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex in-data-embedded:hidden! [view-transition-name:app-rail]",
					wide && "lg:w-[236px]",
				)}
			>
				<Link
					href={workspaceUrl()}
					aria-label="Início"
					className={cn(
						"flex h-[72px] shrink-0 items-center justify-center px-3",
						wide && "lg:justify-start lg:px-5",
					)}
				>
					<span className={cn(wide && "lg:hidden")}>
						<BrandMark />
					</span>
					<span className={cn("hidden", wide && "lg:block")}>
						<BrandLogo />
					</span>
				</Link>

				<div className={cn("px-3 pb-2", wide && "lg:px-3.5")}>
					<Button
						variant="outline"
						className={cn(
							"h-9 w-full justify-center gap-2 px-0 text-muted-foreground",
							wide && "lg:justify-start lg:px-3",
						)}
						aria-label="Buscar empresas, contatos e negócios"
						onClick={openSearch}
					>
						<Search />
						<span
							className={cn("hidden flex-1 text-left", wide && "lg:inline")}
						>
							Buscar
						</span>
						<kbd
							className={cn(
								"hidden rounded-sm border bg-muted px-1.5 font-sans text-[11px] text-muted-foreground",
								wide && "lg:inline",
							)}
						>
							⌘K
						</kbd>
					</Button>
				</div>

				<nav
					aria-label="Principal"
					className={cn(
						"flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2",
						wide && "lg:px-3.5",
					)}
				>
					{items.map((item) => (
						<SideLink
							key={item.href}
							item={item}
							wide={wide}
							active={isActive(item, pathname)}
							onPrefetch={() => prefetchSection(item.section)}
						/>
					))}
				</nav>

				<div
					className={cn(
						"flex shrink-0 flex-col items-center gap-2 border-t p-3",
						wide && "lg:items-stretch",
					)}
				>
					<span className={cn(wide && "lg:hidden")}>
						<EnrichmentQueue layout="compact" />
					</span>
					<span className={cn("hidden", wide && "lg:block")}>
						<EnrichmentQueue layout="row" />
					</span>

					<UserMenu user={user}>
						<button
							type="button"
							aria-label="Menu da conta"
							className={cn(
								"flex cursor-pointer items-center justify-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
								wide &&
									"lg:justify-start lg:border lg:bg-muted/50 lg:p-2 lg:pr-2.5 lg:hover:bg-muted",
							)}
						>
							<UserFace user={user} />
							<span
								className={cn(
									"hidden min-w-0 flex-1 flex-col text-left",
									wide && "lg:flex",
								)}
							>
								<span className="truncate font-semibold text-[13px] text-foreground">
									{user.name}
								</span>
								<span className="truncate text-[11.5px] text-muted-foreground">
									{user.email}
								</span>
							</span>
							<ChevronSort
								className={cn(
									"hidden size-4 shrink-0 text-muted-foreground",
									wide && "lg:block",
								)}
								aria-hidden="true"
							/>
						</button>
					</UserMenu>
				</div>
			</aside>

			<nav
				aria-label="Principal"
				className="order-1 grid shrink-0 grid-cols-5 border-t bg-sidebar px-1 pb-[env(safe-area-inset-bottom)] md:hidden in-data-embedded:hidden!"
			>
				{items
					.filter((item) => item.tab)
					.map((item) => (
						<TabLink
							key={item.href}
							item={item}
							active={isActive(item, pathname)}
							onPrefetch={() => prefetchSection(item.section)}
						/>
					))}
			</nav>

			<Sheet open={open && inChat} onOpenChange={setOpen}>
				<SheetContent
					side="left"
					showCloseButton={false}
					className="w-5/6 max-w-sm gap-0 p-0"
				>
					<SheetHeader className="flex-row items-center justify-between border-b px-3 py-2">
						<SheetTitle>Conversas com o agente</SheetTitle>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Fechar"
							onClick={() => setOpen(false)}
						>
							<Icon icon={Close} />
						</Button>
					</SheetHeader>
					<AgentBuilderSidebar
						className="flex flex-1"
						onNavigate={() => setOpen(false)}
					/>
				</SheetContent>
			</Sheet>
		</>
	);
}

function SideLink({
	item,
	wide,
	active,
	onPrefetch,
}: {
	item: ResolvedItem;
	wide: boolean;
	active: boolean;
	onPrefetch: () => void;
}) {
	return (
		<Link
			href={item.href}
			prefetch
			onMouseEnter={onPrefetch}
			onFocus={onPrefetch}
			aria-current={active ? "page" : undefined}
			transitionTypes={[
				item.section === CHAT_HREF ? "nav-forward" : "nav-lateral",
			]}
			className={cn(
				"flex flex-col items-center gap-1 rounded-md px-1 py-2 font-medium text-[11px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
				wide && "lg:flex-row lg:gap-2.5 lg:px-2.5 lg:text-[13.5px]",
				active &&
					"bg-sidebar-accent font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
			)}
		>
			<Icon icon={item.icon} className={item.iconClassName} />
			<span className={cn(wide && "lg:hidden")}>{item.short}</span>
			<span className={cn("hidden", wide && "lg:inline")}>{item.title}</span>
		</Link>
	);
}

function TabLink({
	item,
	active,
	onPrefetch,
}: {
	item: ResolvedItem;
	active: boolean;
	onPrefetch: () => void;
}) {
	return (
		<Link
			href={item.href}
			prefetch
			onMouseEnter={onPrefetch}
			onFocus={onPrefetch}
			aria-current={active ? "page" : undefined}
			className={cn(
				"flex min-w-0 flex-col items-center gap-1 px-1 pt-2 pb-2.5 font-medium text-[11px] text-muted-foreground outline-none",
				active && "font-semibold text-sidebar-accent-foreground",
			)}
		>
			<span
				className={cn(
					"flex h-7 w-12 items-center justify-center rounded-full transition-colors",
					active && "bg-sidebar-accent",
				)}
			>
				<Icon icon={item.icon} className={item.iconClassName} />
			</span>
			<span className="max-w-full truncate">{item.short}</span>
		</Link>
	);
}

function BrandMark() {
	return (
		<Image
			src="/moulin-mark.png"
			alt=""
			width={32}
			height={32}
			className="size-8 shrink-0"
			priority
		/>
	);
}

function BrandLogo() {
	return (
		<>
			<Image
				src="/moulin-logo.png"
				alt="Moulin"
				width={115}
				height={36}
				className="h-9 w-auto dark:hidden"
				priority
			/>
			<Image
				src="/moulin-logo-branco.png"
				alt="Moulin"
				width={115}
				height={36}
				className="hidden h-9 w-auto dark:block"
				priority
			/>
		</>
	);
}

function UserFace({ user }: { user: User }) {
	return (
		<Avatar className="size-8">
			{user.image && <AvatarImage alt={user.name} src={user.image} />}
			<AvatarFallback className="bg-primary font-semibold text-primary-foreground text-xs">
				{initials(user.name)}
			</AvatarFallback>
		</Avatar>
	);
}

function UserMenu({
	user,
	settingsHref,
	children,
}: {
	user: User;
	settingsHref?: string;
	children: React.ReactNode;
}) {
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent align="end" side="top" className="min-w-56">
				<DropdownMenuLabel className="flex flex-col gap-0.5">
					<span className="truncate font-semibold text-foreground">
						{user.name}
					</span>
					<span className="truncate font-normal">{user.email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{settingsHref ? (
					<DropdownMenuItem asChild>
						<Link href={settingsHref}>
							<Settings />
							Configurações
						</Link>
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					onSelect={(event) => {
						event.preventDefault();
						setTheme(isDark ? "light" : "dark");
					}}
				>
					{isDark ? <Light /> : <Asleep />}
					{isDark ? "Tema claro" : "Tema escuro"}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={signOut}>
					<Logout />
					Sair
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function AppNavFallback() {
	return (
		<>
			<header
				className="flex h-14 shrink-0 items-center gap-2.5 border-b bg-sidebar px-3 md:hidden in-data-embedded:hidden!"
				aria-busy="true"
			>
				<BrandMark />
				<Skeleton className="h-4 w-28" />
				<span role="status" className="sr-only">
					Carregando o menu…
				</span>
			</header>

			<aside
				className="hidden w-[84px] shrink-0 flex-col border-r bg-sidebar md:flex lg:w-[236px] in-data-embedded:hidden!"
				aria-busy="true"
			>
				<div className="flex h-[72px] shrink-0 items-center justify-center px-3 lg:justify-start lg:px-5">
					<span className="lg:hidden">
						<BrandMark />
					</span>
					<span className="hidden lg:block">
						<BrandLogo />
					</span>
				</div>
				<div className="flex flex-col gap-2 px-3 py-2 lg:px-3.5" aria-hidden>
					{ITEMS.map((item) => (
						<Skeleton key={item.href} className="h-9 w-full" />
					))}
				</div>
			</aside>

			<nav
				aria-hidden="true"
				className="order-1 grid h-[62px] shrink-0 grid-cols-5 border-t bg-sidebar md:hidden in-data-embedded:hidden!"
			/>
		</>
	);
}
