import { GoogleSyncStatus } from "@crm/db";
import { z } from "zod";

const ADDRESS_MAX = 320;
const SECRET_MAX = 1_024;

export const connectImapInput = z.object({
	address: z
		.string()
		.trim()
		.toLowerCase()
		.max(ADDRESS_MAX)
		.pipe(z.email("That is not an email address.")),
	username: z.string().trim().max(ADDRESS_MAX).optional(),
	password: z.string().min(1).max(SECRET_MAX),
	autoCreate: z.boolean(),
});

export const setImapAutoCreateInput = z.object({
	enabled: z.boolean(),
});

const imapSyncStatusOutput = z.enum(
	Object.values(GoogleSyncStatus) as [GoogleSyncStatus, ...GoogleSyncStatus[]],
);

export const imapConnectionStatusOutput = z.object({
	configured: z.boolean(),
	host: z.string().nullable(),
	connected: z.boolean(),
	address: z.string().nullable(),
	status: imapSyncStatusOutput.nullable(),
	lastSyncedAt: z.string().nullable(),
	lastError: z.string().nullable(),
	autoCreate: z.boolean(),
	importing: z.boolean(),
	historyDays: z.number(),
});

export const purgeImapDataOutput = z.object({
	purged: z.number(),
});

export const disconnectImapOutput = z.object({
	disconnected: z.boolean(),
});

export type ConnectImapInput = z.infer<typeof connectImapInput>;
export type ImapConnectionStatus = z.infer<typeof imapConnectionStatusOutput>;
export type PurgeImapDataOutput = z.infer<typeof purgeImapDataOutput>;
export type DisconnectImapOutput = z.infer<typeof disconnectImapOutput>;
