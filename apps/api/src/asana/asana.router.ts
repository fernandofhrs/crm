import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	asanaConnectionStatusOutput,
	asanaPeopleOutput,
	asanaProjectsOutput,
	assignAsanaPersonInput,
	chooseAsanaProjectInput,
	connectAsanaInput,
	disconnectAsanaOutput,
	purgeAsanaDataOutput,
	shareAsanaProjectInput,
} from "./asana.contracts";
import { AsanaConnectionService } from "./asana-connection.service";
import { AsanaSyncService } from "./asana-sync.service";

@Router({ alias: "asana" })
@UseMiddlewares(AuthMiddleware)
export class AsanaRouter {
	constructor(
		@Inject(AsanaConnectionService)
		private readonly connection: AsanaConnectionService,
		@Inject(AsanaSyncService)
		private readonly sync: AsanaSyncService,
	) {}

	@Query({
		output: asanaConnectionStatusOutput,
		meta: restMeta("GET", "/asana/status", ["Asana"]),
	})
	async status(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.status(ctx.user.id);
	}

	@Query({
		output: asanaProjectsOutput,
		meta: restMeta("GET", "/asana/projects", ["Asana"]),
	})
	async projects(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.projects(ctx.user.id);
	}

	@Mutation({
		input: connectAsanaInput,
		output: asanaConnectionStatusOutput,
		meta: restMeta("POST", "/asana/connect", ["Asana"]),
	})
	async connect(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof connectAsanaInput>,
	) {
		await this.connection.connect(ctx.user.id, input.token);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({
		input: chooseAsanaProjectInput,
		output: asanaConnectionStatusOutput,
		meta: restMeta("POST", "/asana/project", ["Asana"]),
	})
	async chooseProject(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof chooseAsanaProjectInput>,
	) {
		await this.connection.chooseProject(ctx.user.id, input.projectGid);
		await this.sync.runOne(ctx.user.id);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({
		input: shareAsanaProjectInput,
		output: asanaConnectionStatusOutput,
		meta: restMeta("POST", "/asana/share", ["Asana"]),
	})
	async share(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof shareAsanaProjectInput>,
	) {
		await this.connection.share(ctx.user.id, input.shared);
		await this.sync.runOne(ctx.user.id);
		return this.connection.status(ctx.user.id);
	}

	@Query({
		output: asanaPeopleOutput,
		meta: restMeta("GET", "/asana/people", ["Asana"]),
	})
	async people(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.people(ctx.user.id);
	}

	@Mutation({
		input: assignAsanaPersonInput,
		output: asanaPeopleOutput,
		meta: restMeta("POST", "/asana/people", ["Asana"]),
	})
	async assign(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof assignAsanaPersonInput>,
	) {
		await this.connection.assign(ctx.user.id, input.gid, input.userId);
		await this.sync.runOne(ctx.user.id);
		return this.connection.people(ctx.user.id);
	}

	@Mutation({
		output: asanaConnectionStatusOutput,
		meta: restMeta("POST", "/asana/sync", ["Asana"]),
	})
	async syncNow(@Ctx() ctx: AuthedTrpcContext) {
		await this.sync.runOne(ctx.user.id);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({
		output: purgeAsanaDataOutput,
		meta: restMeta("POST", "/asana/purge-synced-data", ["Asana"]),
	})
	async purgeSyncedData(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.purgeSyncedData(ctx.user.id);
	}

	@Mutation({
		output: disconnectAsanaOutput,
		meta: restMeta("POST", "/asana/disconnect", ["Asana"]),
	})
	async disconnect(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.disconnect(ctx.user.id);
	}
}
