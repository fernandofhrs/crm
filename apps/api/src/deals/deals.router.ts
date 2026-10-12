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
	dealAttachContactInput,
	dealBulkInput,
	dealBulkOwnerInput,
	dealBulkResultOutput,
	dealBulkStageInput,
	dealContactLinkOutput,
	dealContactOptionsOutput,
	dealContactRoleInput,
	dealContactRoleOutput,
	dealContactsInput,
	dealCreateInput,
	dealCreateOutput,
	dealDetachContactInput,
	dealDetailOutput,
	dealIdInput,
	dealListInput,
	dealListOutput,
	dealMutateOutput,
	dealSetStageOutput,
	dealUpdateArgs,
	setStageInput,
} from "./deals.contracts";
import { DealsService } from "./deals.service";

@Router({ alias: "deals" })
@UseMiddlewares(AuthMiddleware)
export class DealsRouter {
	constructor(@Inject(DealsService) private readonly deals: DealsService) {}

	@Query({
		input: dealListInput,
		output: dealListOutput,
		meta: restMeta("POST", "/deals/search", ["Deals"]),
	})
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealListInput>,
	) {
		return this.deals.list(input, ctx.viewer);
	}

	@Query({
		input: dealIdInput,
		output: dealDetailOutput,
		meta: restMeta("GET", "/deals/{id}", ["Deals"]),
	})
	async byId(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.deals.byId(id, ctx.viewer);
	}

	@Mutation({
		input: dealCreateInput,
		output: dealCreateOutput,
		meta: restMeta("POST", "/deals", ["Deals"]),
	})
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealCreateInput>,
	) {
		return this.deals.create(input, ctx.viewer);
	}

	@Mutation({
		input: dealUpdateArgs,
		output: dealMutateOutput,
		meta: restMeta("PATCH", "/deals/{id}", ["Deals"]),
	})
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealUpdateArgs>,
	) {
		return this.deals.update(input.id, input.data, ctx.viewer);
	}

	@Mutation({
		input: dealIdInput,
		output: dealMutateOutput,
		meta: restMeta("POST", "/deals/{id}/archive", ["Deals"]),
	})
	async archive(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.deals.archive(id, ctx.viewer);
	}

	@Mutation({
		input: dealIdInput,
		output: dealMutateOutput,
		meta: restMeta("POST", "/deals/{id}/restore", ["Deals"]),
	})
	async restore(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.deals.restore(id, ctx.viewer);
	}

	@Mutation({
		input: dealIdInput,
		output: dealMutateOutput,
		meta: restMeta("DELETE", "/deals/{id}", ["Deals"]),
	})
	async purge(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.deals.purge(id, ctx.viewer);
	}

	@Mutation({
		input: setStageInput,
		output: dealSetStageOutput,
		meta: restMeta("PATCH", "/deals/{id}/stage", ["Deals"]),
	})
	async setStage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setStageInput>,
	) {
		return this.deals.setStage(input, ctx.user.id, ctx.viewer);
	}

	@Query({
		input: dealContactsInput,
		output: dealContactOptionsOutput,
		meta: restMeta("GET", "/deals/{dealId}/contact-options", ["Deals"]),
	})
	async contactOptions(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("dealId") dealId: string,
	) {
		return this.deals.contactOptions(dealId, ctx.viewer);
	}

	@Mutation({
		input: dealAttachContactInput,
		output: dealContactLinkOutput,
		meta: restMeta("POST", "/deals/{dealId}/contacts", ["Deals"]),
	})
	async attachContact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealAttachContactInput>,
	) {
		return this.deals.attachContact(input, ctx.viewer);
	}

	@Mutation({
		input: dealDetachContactInput,
		output: dealContactLinkOutput,
		meta: restMeta("DELETE", "/deals/{dealId}/contacts/{contactId}", ["Deals"]),
	})
	async detachContact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealDetachContactInput>,
	) {
		return this.deals.detachContact(input, ctx.viewer);
	}

	@Mutation({
		input: dealContactRoleInput,
		output: dealContactRoleOutput,
		meta: restMeta("PATCH", "/deals/{dealId}/contacts/{contactId}/role", [
			"Deals",
		]),
	})
	async setContactRole(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealContactRoleInput>,
	) {
		return this.deals.setContactRole(input, ctx.viewer);
	}

	@Mutation({
		input: dealBulkOwnerInput,
		output: dealBulkResultOutput,
		meta: restMeta("POST", "/deals/bulk-assign-owner", ["Deals"]),
	})
	async bulkAssignOwner(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealBulkOwnerInput>,
	) {
		return this.deals.bulkAssignOwner(input, ctx.viewer);
	}

	@Mutation({
		input: dealBulkStageInput,
		output: dealBulkResultOutput,
		meta: restMeta("POST", "/deals/bulk-set-stage", ["Deals"]),
	})
	async bulkSetStage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealBulkStageInput>,
	) {
		return this.deals.bulkSetStage(input, ctx.user.id, ctx.viewer);
	}

	@Mutation({
		input: dealBulkInput,
		output: dealBulkResultOutput,
		meta: restMeta("POST", "/deals/bulk-archive", ["Deals"]),
	})
	async bulkArchive(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.deals.bulkArchive(ids, ctx.viewer);
	}

	@Mutation({
		input: dealBulkInput,
		output: dealBulkResultOutput,
		meta: restMeta("POST", "/deals/bulk-restore", ["Deals"]),
	})
	async bulkRestore(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.deals.bulkRestore(ids, ctx.viewer);
	}

	@Mutation({
		input: dealBulkInput,
		output: dealBulkResultOutput,
		meta: restMeta("POST", "/deals/bulk-purge", ["Deals"]),
	})
	async bulkPurge(@Ctx() ctx: AuthedTrpcContext, @Input("ids") ids: string[]) {
		return this.deals.bulkPurge(ids, ctx.viewer);
	}
}
