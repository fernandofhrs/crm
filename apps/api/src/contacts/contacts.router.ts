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
	bulkResultOutput,
	contactBasicOutput,
	contactBulkCompanyInput,
	contactBulkInput,
	contactBulkOwnerInput,
	contactByIdOutput,
	contactCreateInput,
	contactEnrichOutput,
	contactIdInput,
	contactListInput,
	contactListOutput,
	contactNameOutput,
	contactUpdateArgs,
	decideFactOutput,
	factDecisionInput,
} from "./contacts.contracts";
import { ContactsService } from "./contacts.service";

@Router({ alias: "contacts" })
@UseMiddlewares(AuthMiddleware)
export class ContactsRouter {
	constructor(
		@Inject(ContactsService) private readonly contacts: ContactsService,
	) {}

	@Query({
		input: contactListInput,
		output: contactListOutput,
		meta: restMeta("POST", "/contacts/search", ["Contacts"]),
	})
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactListInput>,
	) {
		return this.contacts.list(input, ctx.viewer);
	}

	@Query({
		input: contactIdInput,
		output: contactByIdOutput,
		meta: restMeta("GET", "/contacts/{id}", ["Contacts"]),
	})
	async byId(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.contacts.byId(id, ctx.viewer);
	}

	@Mutation({
		input: contactCreateInput,
		output: contactBasicOutput,
		meta: restMeta("POST", "/contacts", ["Contacts"]),
	})
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactCreateInput>,
	) {
		return this.contacts.create(input, ctx.viewer);
	}

	@Mutation({
		input: contactUpdateArgs,
		output: contactBasicOutput,
		meta: restMeta("PATCH", "/contacts/{id}", ["Contacts"]),
	})
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactUpdateArgs>,
	) {
		return this.contacts.update(input.id, input.data, ctx.viewer);
	}

	@Mutation({
		input: contactIdInput,
		output: contactNameOutput,
		meta: restMeta("POST", "/contacts/{id}/archive", ["Contacts"]),
	})
	async archive(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.contacts.archive(id, ctx.viewer);
	}

	@Mutation({
		input: contactIdInput,
		output: contactNameOutput,
		meta: restMeta("POST", "/contacts/{id}/restore", ["Contacts"]),
	})
	async restore(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.contacts.restore(id, ctx.viewer);
	}

	@Mutation({
		input: contactIdInput,
		output: contactNameOutput,
		meta: restMeta("DELETE", "/contacts/{id}", ["Contacts"]),
	})
	async purge(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.contacts.purge(id, ctx.viewer);
	}

	@Mutation({
		input: contactIdInput,
		output: contactEnrichOutput,
		meta: restMeta("POST", "/contacts/{id}/enrich", ["Contacts"]),
	})
	async enrich(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.contacts.enrich(id, ctx.viewer);
	}

	@Mutation({
		input: contactBulkOwnerInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/contacts/bulk-assign-owner", ["Contacts"]),
	})
	async bulkAssignOwner(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactBulkOwnerInput>,
	) {
		return this.contacts.bulkAssignOwner(input, ctx.viewer);
	}

	@Mutation({
		input: contactBulkCompanyInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/contacts/bulk-set-company", ["Contacts"]),
	})
	async bulkSetCompany(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactBulkCompanyInput>,
	) {
		return this.contacts.bulkSetCompany(input, ctx.viewer);
	}

	@Mutation({
		input: contactBulkInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/contacts/bulk-enrich", ["Contacts"]),
	})
	async bulkEnrich(@Ctx() ctx: AuthedTrpcContext, @Input("ids") ids: string[]) {
		return this.contacts.bulkEnrich(ids, ctx.viewer);
	}

	@Mutation({
		input: contactBulkInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/contacts/bulk-archive", ["Contacts"]),
	})
	async bulkArchive(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.contacts.bulkArchive(ids, ctx.viewer);
	}

	@Mutation({
		input: contactBulkInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/contacts/bulk-restore", ["Contacts"]),
	})
	async bulkRestore(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.contacts.bulkRestore(ids, ctx.viewer);
	}

	@Mutation({
		input: contactBulkInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/contacts/bulk-purge", ["Contacts"]),
	})
	async bulkPurge(@Ctx() ctx: AuthedTrpcContext, @Input("ids") ids: string[]) {
		return this.contacts.bulkPurge(ids, ctx.viewer);
	}

	@Mutation({
		input: factDecisionInput,
		output: decideFactOutput,
		meta: restMeta("POST", "/contacts/decide-fact", ["Contacts"]),
	})
	async decideFact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof factDecisionInput>,
	) {
		return this.contacts.decideFact(input, ctx.user.id, ctx.viewer);
	}
}
