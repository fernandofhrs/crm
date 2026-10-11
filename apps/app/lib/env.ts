export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function isMarketing(): boolean {
	return process.env.IS_MARKETING === "true";
}

export function isResearchKeyOptional(): boolean {
	return process.env.RESEARCH_KEY_OPTIONAL === "true";
}
