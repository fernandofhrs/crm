export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function isMarketing(): boolean {
	return process.env.IS_MARKETING === "true";
}

export function isResearchKeyOptional(): boolean {
	return process.env.RESEARCH_KEY_OPTIONAL === "true";
}

export function embedOrigins(): readonly string[] {
	return (process.env.EMBED_ORIGINS ?? "").split(",").flatMap((entry) => {
		try {
			const url = new URL(entry.trim());
			return url.protocol === "https:" || url.hostname === "localhost"
				? [url.origin]
				: [];
		} catch {
			return [];
		}
	});
}

export function frameAncestors(): string {
	return ["frame-ancestors", "'self'", ...embedOrigins()].join(" ");
}
