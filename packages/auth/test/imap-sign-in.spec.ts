import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	acceptsImapSignIn,
	imapSignInDomains,
	isImapSignInEnabled,
	nameFromAddress,
} from "../src/imap-sign-in";

const MANAGED = ["IMAP_HOST", "IMAP_SIGN_IN", "ALLOWED_SIGN_IN"] as const;
const before = new Map<string, string | undefined>();

beforeEach(() => {
	for (const key of MANAGED) before.set(key, process.env[key]);

	process.env.IMAP_HOST = "imap.mail.test";
	process.env.IMAP_SIGN_IN = " Hosted.test , @second.test ";
	process.env.ALLOWED_SIGN_IN = "hosted.test,second.test,elsewhere.test";
});

afterEach(() => {
	for (const key of MANAGED) {
		const value = before.get(key);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("which mailboxes may sign in", () => {
	it("reads the domains the install listed", () => {
		expect(imapSignInDomains()).toEqual(["hosted.test", "second.test"]);
		expect(isImapSignInEnabled()).toBe(true);
	});

	it("is off without a mail server to check against", () => {
		delete process.env.IMAP_HOST;

		expect(imapSignInDomains()).toEqual([]);
		expect(isImapSignInEnabled()).toBe(false);
		expect(acceptsImapSignIn("rep@hosted.test")).toBe(false);
	});

	it("is off until a domain is listed", () => {
		delete process.env.IMAP_SIGN_IN;

		expect(isImapSignInEnabled()).toBe(false);
		expect(acceptsImapSignIn("rep@hosted.test")).toBe(false);
	});

	it("accepts an address at a listed domain", () => {
		expect(acceptsImapSignIn("rep@hosted.test")).toBe(true);
		expect(acceptsImapSignIn(" Rep@Second.Test ")).toBe(true);
	});

	it("refuses an allowed address whose mail is hosted somewhere else", () => {
		expect(acceptsImapSignIn("rep@elsewhere.test")).toBe(false);
	});

	it("refuses a subdomain of a listed domain", () => {
		expect(acceptsImapSignIn("rep@mail.hosted.test")).toBe(false);
	});

	it("refuses a listed domain the allow-list does not hold", () => {
		process.env.ALLOWED_SIGN_IN = "second.test";

		expect(acceptsImapSignIn("rep@hosted.test")).toBe(false);
	});

	it("refuses anything that is not one address", () => {
		expect(acceptsImapSignIn("hosted.test")).toBe(false);
		expect(acceptsImapSignIn("@hosted.test")).toBe(false);
		expect(acceptsImapSignIn("a@b@hosted.test")).toBe(false);
	});
});

describe("the name a new account starts with", () => {
	it("is read from the address", () => {
		expect(nameFromAddress("thais@hosted.test")).toBe("Thais");
		expect(nameFromAddress("maria.silva@hosted.test")).toBe("Maria Silva");
		expect(nameFromAddress("comercial-sul@hosted.test")).toBe("Comercial Sul");
	});
});
