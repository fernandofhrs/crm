import { describe, expect, it } from "bun:test";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../src/config/env.validation";
import { CredentialVaultService } from "../src/mailbox/credential-vault.service";

function vault(secret: string): CredentialVaultService {
	const config = {
		get: () => secret,
	} as unknown as ConfigService<EnvironmentVariables, true>;

	return new CredentialVaultService(config);
}

const first = vault("first-secret-first-secret-first-secret");

describe("the credential vault", () => {
	it("returns what was sealed", () => {
		const sealed = first.seal("correct horse battery staple");

		expect(sealed).not.toContain("correct horse");
		expect(first.open(sealed)).toBe("correct horse battery staple");
	});

	it("seals the same value differently each time", () => {
		expect(first.seal("same")).not.toBe(first.seal("same"));
	});

	it("keeps an empty value apart from an unreadable one", () => {
		expect(first.open(first.seal(""))).toBe("");
	});

	it("refuses a value sealed under another secret", () => {
		const other = vault("second-secret-second-secret-second-secret");

		expect(other.open(first.seal("mine"))).toBeNull();
	});

	it("refuses a value that was altered", () => {
		const sealed = first.seal("untouched");
		const parts = sealed.split(".");
		const data = parts[3] ?? "";
		const flipped = `${data.startsWith("A") ? "B" : "A"}${data.slice(1)}`;

		expect(first.open([...parts.slice(0, 3), flipped].join("."))).toBeNull();
	});

	it("refuses anything that is not a sealed value", () => {
		expect(first.open("plain text")).toBeNull();
		expect(first.open("v0.a.b.c")).toBeNull();
	});
});
