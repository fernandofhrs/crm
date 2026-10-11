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
	connectImapInput,
	disconnectImapOutput,
	imapConnectionStatusOutput,
	purgeImapDataOutput,
	setImapAutoCreateInput,
} from "./imap.contracts";
import { ImapConnectionService } from "./imap-connection.service";
import { ImapSyncService } from "./imap-sync.service";

@Router({ alias: "imap" })
@UseMiddlewares(AuthMiddleware)
export class ImapRouter {
	constructor(
		@Inject(ImapConnectionService)
		private readonly connection: ImapConnectionService,
		@Inject(ImapSyncService)
		private readonly sync: ImapSyncService,
	) {}

	@Query({
		output: imapConnectionStatusOutput,
		meta: restMeta("GET", "/imap/status", ["IMAP"]),
	})
	async status(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.status(ctx.user.id);
	}

	@Mutation({
		input: connectImapInput,
		output: imapConnectionStatusOutput,
		meta: restMeta("POST", "/imap/connect", ["IMAP"]),
	})
	async connect(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof connectImapInput>,
	) {
		await this.connection.connect(ctx.user.id, input);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({
		output: disconnectImapOutput,
		meta: restMeta("POST", "/imap/disconnect", ["IMAP"]),
	})
	async disconnect(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.disconnect(ctx.user.id);
	}

	@Mutation({
		output: purgeImapDataOutput,
		meta: restMeta("POST", "/imap/purge-synced-data", ["IMAP"]),
	})
	async purgeSyncedData(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.purgeSyncedData(ctx.user.id);
	}

	@Mutation({
		output: imapConnectionStatusOutput,
		meta: restMeta("POST", "/imap/sync", ["IMAP"]),
	})
	async syncNow(@Ctx() ctx: AuthedTrpcContext) {
		await this.sync.runOne(ctx.user.id);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({
		output: imapConnectionStatusOutput,
		meta: restMeta("POST", "/imap/reimport", ["IMAP"]),
	})
	async reimport(@Ctx() ctx: AuthedTrpcContext) {
		await this.connection.reimport(ctx.user.id);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({
		input: setImapAutoCreateInput,
		output: imapConnectionStatusOutput,
		meta: restMeta("PATCH", "/imap/auto-create", ["IMAP"]),
	})
	async setAutoCreate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setImapAutoCreateInput>,
	) {
		await this.connection.setAutoCreate(ctx.user.id, input.enabled);
		return this.connection.status(ctx.user.id);
	}
}
