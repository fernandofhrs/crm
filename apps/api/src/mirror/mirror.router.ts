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
	mirrorPushInput,
	mirrorPushOutput,
	mirrorStatusOutput,
} from "./mirror.contracts";
import { MirrorService } from "./mirror.service";

@Router({ alias: "mirror" })
@UseMiddlewares(AuthMiddleware)
export class MirrorRouter {
	constructor(@Inject(MirrorService) private readonly mirror: MirrorService) {}

	@Query({
		output: mirrorStatusOutput,
		meta: restMeta("GET", "/mirror/status", ["Mirror"]),
	})
	async status(@Ctx() ctx: AuthedTrpcContext) {
		return this.mirror.status(ctx.user.id);
	}

	@Mutation({
		input: mirrorPushInput,
		output: mirrorPushOutput,
		meta: restMeta("POST", "/mirror/push", ["Mirror"]),
	})
	async push(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof mirrorPushInput>,
	) {
		return this.mirror.push(ctx.user.id, input);
	}
}
