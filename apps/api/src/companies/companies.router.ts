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
	companyArchiveResultOutput,
	companyBulkInput,
	companyBulkOwnerInput,
	companyBulkResultOutput,
	companyCreateInput,
	companyDetailOutput,
	companyEnrichOutput,
	companyIdInput,
	companyListInput,
	companyListOutput,
	companyOptionOutput,
	companyOptionsInput,
	companyResearchOutput,
	companySetPrimaryContactOutput,
	companySummaryOutput,
	companyUpdateArgs,
	setPrimaryContactInput,
} from "./companies.contracts";
import { CompaniesService } from "./companies.service";

@Router({ alias: "companies" })
@UseMiddlewares(AuthMiddleware)
export class CompaniesRouter {
	constructor(
		@Inject(CompaniesService) private readonly companies: CompaniesService,
	) {}

	@Query({
		input: companyListInput,
		output: companyListOutput,
		meta: restMeta("POST", "/companies/search", ["Companies"]),
	})
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof companyListInput>,
	) {
		return this.companies.list(input, ctx.viewer);
	}

	@Query({
		input: companyIdInput,
		output: companyDetailOutput,
		meta: restMeta("GET", "/companies/{id}", ["Companies"]),
	})
	async byId(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.companies.byId(id, ctx.viewer);
	}

	@Query({
		input: companyOptionsInput,
		output: companyOptionOutput,
		meta: restMeta("GET", "/companies/options", ["Companies"]),
	})
	async options(@Ctx() ctx: AuthedTrpcContext, @Input("q") q: string) {
		return this.companies.options(q, ctx.viewer);
	}

	@Mutation({
		input: companyCreateInput,
		output: companySummaryOutput,
		meta: restMeta("POST", "/companies", ["Companies"]),
	})
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof companyCreateInput>,
	) {
		return this.companies.create(input, ctx.viewer);
	}

	@Mutation({
		input: companyUpdateArgs,
		output: companySummaryOutput,
		meta: restMeta("PATCH", "/companies/{id}", ["Companies"]),
	})
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof companyUpdateArgs>,
	) {
		return this.companies.update(input.id, input.data, ctx.viewer);
	}

	@Mutation({
		input: companyIdInput,
		output: companyArchiveResultOutput,
		meta: restMeta("POST", "/companies/{id}/archive", ["Companies"]),
	})
	async archive(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.companies.archive(id, ctx.viewer);
	}

	@Mutation({
		input: companyIdInput,
		output: companyArchiveResultOutput,
		meta: restMeta("POST", "/companies/{id}/restore", ["Companies"]),
	})
	async restore(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.companies.restore(id, ctx.viewer);
	}

	@Mutation({
		input: companyIdInput,
		output: companyArchiveResultOutput,
		meta: restMeta("DELETE", "/companies/{id}", ["Companies"]),
	})
	async purge(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.companies.purge(id, ctx.viewer);
	}

	@Mutation({
		input: companyBulkOwnerInput,
		output: companyBulkResultOutput,
		meta: restMeta("POST", "/companies/bulk-assign-owner", ["Companies"]),
	})
	async bulkAssignOwner(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof companyBulkOwnerInput>,
	) {
		return this.companies.bulkAssignOwner(input, ctx.viewer);
	}

	@Mutation({
		input: companyBulkInput,
		output: companyBulkResultOutput,
		meta: restMeta("POST", "/companies/bulk-enrich", ["Companies"]),
	})
	async bulkEnrich(@Ctx() ctx: AuthedTrpcContext, @Input("ids") ids: string[]) {
		return this.companies.bulkEnrich(ids, ctx.viewer);
	}

	@Mutation({
		input: companyBulkInput,
		output: companyBulkResultOutput,
		meta: restMeta("POST", "/companies/bulk-archive", ["Companies"]),
	})
	async bulkArchive(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.companies.bulkArchive(ids, ctx.viewer);
	}

	@Mutation({
		input: companyBulkInput,
		output: companyBulkResultOutput,
		meta: restMeta("POST", "/companies/bulk-restore", ["Companies"]),
	})
	async bulkRestore(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.companies.bulkRestore(ids, ctx.viewer);
	}

	@Mutation({
		input: companyBulkInput,
		output: companyBulkResultOutput,
		meta: restMeta("POST", "/companies/bulk-purge", ["Companies"]),
	})
	async bulkPurge(@Ctx() ctx: AuthedTrpcContext, @Input("ids") ids: string[]) {
		return this.companies.bulkPurge(ids, ctx.viewer);
	}

	@Mutation({
		input: companyIdInput,
		output: companyEnrichOutput,
		meta: restMeta("POST", "/companies/{id}/enrich", ["Companies"]),
	})
	async enrich(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.companies.enrich(id, ctx.viewer);
	}

	@Mutation({
		input: companyIdInput,
		output: companyResearchOutput,
		meta: restMeta("POST", "/companies/{id}/research", ["Companies"]),
	})
	async research(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.companies.research(id, ctx.user.id, ctx.viewer);
	}

	@Mutation({
		input: setPrimaryContactInput,
		output: companySetPrimaryContactOutput,
		meta: restMeta("POST", "/companies/{companyId}/set-primary-contact", [
			"Companies",
		]),
	})
	async setPrimaryContact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setPrimaryContactInput>,
	) {
		return this.companies.setPrimaryContact(
			input.companyId,
			input.contactId,
			ctx.viewer,
		);
	}
}
