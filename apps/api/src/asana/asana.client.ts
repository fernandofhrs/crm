import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
	MailboxApiClient,
	type MailboxResult,
} from "../mailbox/mailbox-api.client";
import { ASANA } from "./asana-config";

const nextPage = z
	.object({ offset: z.string().nullish() })
	.nullish()
	.transform((page) => page?.offset ?? null);

const asanaWorkspace = z.object({
	gid: z.string().min(1),
	name: z.string().nullish(),
});

const asanaUser = z.object({
	gid: z.string().min(1),
	name: z.string().nullish(),
	email: z.string().nullish(),
	workspaces: z.array(asanaWorkspace).default([]),
});

const asanaProject = z.object({
	gid: z.string().min(1),
	name: z.string().nullish(),
});

const asanaTask = z.object({
	gid: z.string().min(1),
	name: z.string().nullish(),
	notes: z.string().nullish(),
	due_on: z.string().nullish(),
	due_at: z.string().nullish(),
	created_at: z.string().nullish(),
	permalink_url: z.string().nullish(),
});

const userEnvelope = z.object({ data: asanaUser });
const projectEnvelope = z.object({ data: asanaProject });
const projectPage = z.object({
	data: z.array(asanaProject),
	next_page: nextPage,
});
const taskPage = z.object({ data: z.array(asanaTask), next_page: nextPage });

export type AsanaUser = z.infer<typeof asanaUser>;
export type AsanaProject = z.infer<typeof asanaProject>;
export type AsanaTask = z.infer<typeof asanaTask>;
export type AsanaProjectPage = z.infer<typeof projectPage>;
export type AsanaTaskPage = z.infer<typeof taskPage>;

const TASK_FIELDS = [
	"name",
	"notes",
	"due_on",
	"due_at",
	"created_at",
	"permalink_url",
].join(",");

const UNEXPECTED =
	"O Asana devolveu uma resposta que este CRM não conseguiu ler.";

@Injectable()
export class AsanaClient {
	constructor(private readonly api: MailboxApiClient) {}

	async me(token: string): Promise<MailboxResult<AsanaUser>> {
		const result = await this.api.get<unknown>(
			`${ASANA.api.baseUrl}/users/me`,
			token,
			{ opt_fields: "name,email,workspaces.name" },
		);

		return parsed(result, userEnvelope, (body) => body.data);
	}

	async project(
		token: string,
		projectGid: string,
	): Promise<MailboxResult<AsanaProject>> {
		const result = await this.api.get<unknown>(
			`${ASANA.api.baseUrl}/projects/${encodeURIComponent(projectGid)}`,
			token,
			{ opt_fields: "name" },
		);

		return parsed(result, projectEnvelope, (body) => body.data);
	}

	async projects(
		token: string,
		workspaceGid: string,
		offset?: string,
	): Promise<MailboxResult<AsanaProjectPage>> {
		const result = await this.api.get<unknown>(
			`${ASANA.api.baseUrl}/projects`,
			token,
			{
				workspace: workspaceGid,
				archived: false,
				limit: ASANA.api.pageSize,
				opt_fields: "name",
				offset,
			},
		);

		return parsed(result, projectPage, (body) => body);
	}

	async openTasks(
		token: string,
		projectGid: string,
		offset?: string,
	): Promise<MailboxResult<AsanaTaskPage>> {
		const result = await this.api.get<unknown>(
			`${ASANA.api.baseUrl}/tasks`,
			token,
			{
				project: projectGid,
				completed_since: "now",
				limit: ASANA.api.pageSize,
				opt_fields: TASK_FIELDS,
				offset,
			},
		);

		return parsed(result, taskPage, (body) => body);
	}
}

function parsed<Schema extends z.ZodType, Out>(
	result: MailboxResult<unknown>,
	schema: Schema,
	pick: (body: z.infer<Schema>) => Out,
): MailboxResult<Out> {
	if (result.outcome !== "ok") return result;

	const body = schema.safeParse(result.data);

	if (!body.success) {
		return { outcome: "failed", reason: UNEXPECTED, retryable: false };
	}

	return { outcome: "ok", data: pick(body.data) };
}
