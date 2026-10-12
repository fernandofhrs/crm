import { Inject, Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type {
	MiddlewareOptions,
	MiddlewareResponse,
	TRPCMiddleware,
} from "nestjs-trpc";
import { ViewerService } from "../../crm/viewer.service";
import { setRequestUserId } from "../../logging/request-context";
import type { AuthedTrpcContext, BaseTrpcContext } from "../context.types";

@Injectable()
export class AuthMiddleware implements TRPCMiddleware {
	constructor(@Inject(ViewerService) private readonly viewers: ViewerService) {}

	async use(opts: MiddlewareOptions): Promise<MiddlewareResponse> {
		const ctx = opts.ctx as BaseTrpcContext;
		const user = ctx.session?.user;

		if (!user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		setRequestUserId(user.id);

		const viewer = await this.viewers.of(user.id);
		const nextCtx: AuthedTrpcContext = { ...ctx, user, viewer };
		return opts.next({ ctx: nextCtx });
	}
}
