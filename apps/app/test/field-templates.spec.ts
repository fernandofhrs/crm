import { describe, expect, it } from "bun:test";
import { fieldKeyFromLabel } from "@crm/db/fields-shape";
import { FIELD_TEMPLATES } from "@crm/validation/field-templates";

describe("the suggested company fields", () => {
	it("carry a label that makes a whole key, with no letter lost to an accent", () => {
		for (const template of FIELD_TEMPLATES.COMPANY) {
			const spelled = template.label.toLowerCase().split(" ").join("_");
			expect(fieldKeyFromLabel(template.label)).toBe(spelled);
		}
	});

	it("still answer to the key the seed and the English label made", () => {
		expect(FIELD_TEMPLATES.COMPANY.map((template) => template.legacyKey)).toEqual(
			[
				"account_type",
				"segment",
				"territory",
				"lifecycle_stage",
				"lead_source",
				"icp_fit_score",
				"bdr_owner",
			],
		);
	});
});
