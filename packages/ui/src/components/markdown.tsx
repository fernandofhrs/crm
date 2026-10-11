"use client";

import { cn } from "@crm/ui/lib/utils";
import { Streamdown } from "streamdown";

const MARKDOWN_TRANSLATIONS = {
	close: "Fechar",
	copied: "Copiado",
	copyCode: "Copiar código",
	copyLink: "Copiar link",
	copyTable: "Copiar tabela",
	copyTableAsCsv: "Copiar tabela como CSV",
	copyTableAsMarkdown: "Copiar tabela como Markdown",
	copyTableAsTsv: "Copiar tabela como TSV",
	downloadDiagram: "Baixar diagrama",
	downloadDiagramAsMmd: "Baixar diagrama como MMD",
	downloadDiagramAsPng: "Baixar diagrama como PNG",
	downloadDiagramAsSvg: "Baixar diagrama como SVG",
	downloadFile: "Baixar arquivo",
	downloadImage: "Baixar imagem",
	downloadTable: "Baixar tabela",
	downloadTableAsCsv: "Baixar tabela como CSV",
	downloadTableAsMarkdown: "Baixar tabela como Markdown",
	exitFullscreen: "Sair da tela cheia",
	externalLinkWarning: "Você vai abrir um site externo.",
	imageNotAvailable: "Imagem indisponível",
	openExternalLink: "Abrir link externo?",
	openLink: "Abrir link",
	viewFullscreen: "Ver em tela cheia",
} as const;

export function Markdown({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<Streamdown
			shikiTheme={["github-light", "github-dark"]}
			translations={MARKDOWN_TRANSLATIONS}
			className={cn(
				"min-w-0 space-y-2.5 text-xs/5 wrap-break-word",
				"[&_h1]:font-medium [&_h1]:text-xs [&_h2]:font-medium [&_h2]:text-xs [&_h3]:font-medium [&_h3]:text-xs",
				"[&_p]:text-pretty",
				"[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5",
				"[&_a]:underline [&_a]:underline-offset-2",
				"[&_strong]:font-medium",
				"[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
				"[&_pre]:overflow-x-auto [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
				"[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
				"[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium [&_td]:border [&_td]:px-2 [&_td]:py-1",
				"[&_hr]:border-border",
				className,
			)}
		>
			{children}
		</Streamdown>
	);
}
