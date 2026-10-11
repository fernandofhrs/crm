import { z } from "zod";
import { IMAP } from "./imap-config";

const folderCursor = z.object({
	uidValidity: z.string().min(1),
	lastUid: z.number().int().nonnegative(),
});

const imapCursor = z.object({
	version: z.literal(IMAP.cursor.version),
	importing: z.boolean(),
	folders: z.record(z.string(), folderCursor),
});

export type ImapCursor = z.infer<typeof imapCursor>;

export function emptyImapCursor(): ImapCursor {
	return { version: IMAP.cursor.version, importing: true, folders: {} };
}

export function parseImapCursor(raw: string | null): ImapCursor | null {
	if (!raw) return null;

	try {
		const parsed = imapCursor.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function isImporting(raw: string | null): boolean {
	return parseImapCursor(raw)?.importing ?? true;
}
