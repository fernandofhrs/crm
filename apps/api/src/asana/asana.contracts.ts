import { GoogleSyncStatus } from "@crm/db";
import { z } from "zod";

const TOKEN_MAX = 512;
const GID_MAX = 64;

export const connectAsanaInput = z.object({
	token: z.string().trim().min(1).max(TOKEN_MAX),
});

export const chooseAsanaProjectInput = z.object({
	projectGid: z.string().trim().min(1).max(GID_MAX).regex(/^\d+$/),
});

const asanaSyncStatusOutput = z.enum(
	Object.values(GoogleSyncStatus) as [GoogleSyncStatus, ...GoogleSyncStatus[]],
);

export const asanaConnectionStatusOutput = z.object({
	connected: z.boolean(),
	accountName: z.string().nullable(),
	project: z
		.object({ gid: z.string(), name: z.string().nullable() })
		.nullable(),
	status: asanaSyncStatusOutput.nullable(),
	lastSyncedAt: z.string().nullable(),
	lastError: z.string().nullable(),
	openTasks: z.number(),
	windowDays: z.object({ past: z.number(), future: z.number() }),
});

export const asanaProjectsOutput = z.object({
	projects: z.array(
		z.object({
			gid: z.string(),
			name: z.string(),
			workspace: z.string().nullable(),
		}),
	),
	truncated: z.boolean(),
});

export const purgeAsanaDataOutput = z.object({
	purged: z.number(),
});

export const disconnectAsanaOutput = z.object({
	disconnected: z.boolean(),
});

export type AsanaConnectionStatus = z.infer<typeof asanaConnectionStatusOutput>;
export type AsanaProjectsOutput = z.infer<typeof asanaProjectsOutput>;
export type PurgeAsanaDataOutput = z.infer<typeof purgeAsanaDataOutput>;
export type DisconnectAsanaOutput = z.infer<typeof disconnectAsanaOutput>;
