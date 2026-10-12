import "@crm/ui/globals.css";
import { Toaster } from "@crm/ui/components/sonner";
import { TooltipProvider } from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { LocalDateTimeHydrator } from "@/components/local-date-time";
import { ThemeProvider } from "@/components/theme-provider";
import { EMBEDDED_FRAME } from "@/lib/embedded-frame";
import { TRPCReactProvider } from "@/lib/trpc/client";

const fontSans = localFont({
	src: "./fonts/manrope.woff2",
	variable: "--font-manrope",
	weight: "200 800",
	display: "swap",
});

export const metadata: Metadata = {
	title: {
		default: "Moulin CRM",
		template: "%s · Moulin CRM",
	},
	description: "CRM do time comercial da Moulin",
	icons: {
		icon: [
			{ url: "/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
		],
		apple: "/apple-touch-icon.png",
	},
	manifest: "/site.webmanifest",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="pt-BR"
			suppressHydrationWarning
			className={cn(fontSans.variable, "h-full antialiased")}
		>
			<body className="flex min-h-full flex-col font-sans">
				<NuqsAdapter>
					<TRPCReactProvider>
						<ThemeProvider>
							<TooltipProvider>{children}</TooltipProvider>
							<Toaster richColors />
						</ThemeProvider>
					</TRPCReactProvider>
				</NuqsAdapter>
				<LocalDateTimeHydrator />
				<Script id={EMBEDDED_FRAME.scriptId} strategy="beforeInteractive">
					{EMBEDDED_FRAME.script}
				</Script>
			</body>
		</html>
	);
}
