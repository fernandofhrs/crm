import { defineTool } from "eve/tools";
import { z } from "zod";
import { countRecords } from "../lib/lookup";

export default defineTool({
	description:
		"Count what the CRM holds: companies, contacts and deals, with deals split into open, won and lost and by stage with the summed amount per currency. Each stage row carries `name`, the name the CRM shows; write that name and never the `stage` key. Archived records are left out. Use it for any how-many or how-much question about the whole CRM. search_crm finds records by name and cannot count. Free.",
	inputSchema: z.object({}),
	async execute() {
		return countRecords();
	},
});
