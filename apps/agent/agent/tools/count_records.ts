import { seesEverything } from "@crm/db/visibility";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { countRecords } from "../lib/lookup";
import { viewerFor } from "../lib/viewer";

const COUNT_SCOPE = {
	everything: "the whole CRM",
	own: "only the records this person is allowed to see",
} as const;

export default defineTool({
	description:
		"Count what the CRM holds: companies, contacts and deals, with deals split into open, won and lost and by stage with the summed amount per currency. Each stage row carries `name`, the name the CRM shows; write that name and never the `stage` key. Archived records are left out. `scope` says what the count covers: the whole CRM, or only the records the person you work for is allowed to see; say which when it is not the whole CRM. Use it for any how-many or how-much question about the whole CRM. search_crm finds records by name and cannot count. Free.",
	inputSchema: z.object({}),
	async execute(_input, ctx) {
		const viewer = await viewerFor(ctx);

		return {
			scope: seesEverything(viewer) ? COUNT_SCOPE.everything : COUNT_SCOPE.own,
			...(await countRecords(viewer)),
		};
	},
});
