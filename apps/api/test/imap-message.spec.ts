import { describe, expect, it } from "bun:test";
import {
	headerValue,
	type ImapFolder,
	type ImapMessage,
	textPartOf,
} from "../src/imap/imap.client";
import {
	emptyImapCursor,
	isImporting,
	parseImapCursor,
} from "../src/imap/imap-cursor";
import { toIncomingMessage } from "../src/imap/imap-message";

const inbox: ImapFolder = { path: "INBOX", role: "inbox" };

function message(patch: Partial<ImapMessage> = {}): ImapMessage {
	return {
		uid: 7,
		messageId: "<Reply@Mail.Test>",
		inReplyTo: "<first@mail.test>",
		references: "<root@mail.test> <first@mail.test>",
		subject: "Re: Pricing",
		from: { email: "buyer@acme.test", name: "A Buyer" },
		to: [{ email: "rep@us.test", name: null }],
		cc: [{ email: "boss@acme.test", name: "The Boss" }],
		sentAt: new Date("2026-01-02T10:00:00Z"),
		textPart: { part: "1", html: false },
		...patch,
	};
}

describe("turning an IMAP message into a stored email", () => {
	it("keys the message and the thread by RFC message id", () => {
		const parsed = toIncomingMessage(message(), inbox, "Sounds good.");

		expect(parsed?.rfcMessageId).toBe("reply@mail.test");
		expect(parsed?.rootId).toBe("root@mail.test");
		expect(parsed?.imapMessageRef).toBe("INBOX:7");
	});

	it("falls back to In-Reply-To, then to the message itself", () => {
		const replied = toIncomingMessage(message({ references: null }), inbox, "");
		const alone = toIncomingMessage(
			message({ references: null, inReplyTo: null }),
			inbox,
			"",
		);

		expect(replied?.rootId).toBe("first@mail.test");
		expect(alone?.rootId).toBe("reply@mail.test");
	});

	it("keeps To and Cc apart", () => {
		const parsed = toIncomingMessage(message(), inbox, "");

		expect(parsed?.recipients).toEqual([
			{ email: "rep@us.test", name: null, kind: "to" },
			{ email: "boss@acme.test", name: "The Boss", kind: "cc" },
		]);
	});

	it("drops the quoted history and strips an HTML-only body", () => {
		const plain = toIncomingMessage(
			message(),
			inbox,
			"Yes please.\n\nOn Mon, someone wrote:\n> the old text",
		);
		const html = toIncomingMessage(
			message({ textPart: { part: "1", html: true } }),
			inbox,
			"<p>Yes <b>please</b>.</p>",
		);

		expect(plain?.body).toBe("Yes please.");
		expect(html?.body).toBe("Yes please.");
	});

	it("drops history quoted by a Portuguese mail client", () => {
		const replied = toIncomingMessage(
			message(),
			inbox,
			"Fechado.\n\nEm seg., 5 de out. de 2026 às 10:00, A Buyer <buyer@acme.test> escreveu:\n> o texto antigo",
		);
		const forwarded = toIncomingMessage(
			message(),
			inbox,
			"Segue.\n\n---------- Mensagem encaminhada ----------\nDe: Alguém <a@b.test>\nAssunto: velas",
		);

		expect(replied?.body).toBe("Fechado.");
		expect(forwarded?.body).toBe("Segue.");
	});

	it("ignores a message with no id, no sender or no date", () => {
		expect(
			toIncomingMessage(message({ messageId: null }), inbox, ""),
		).toBeNull();
		expect(toIncomingMessage(message({ from: null }), inbox, "")).toBeNull();
		expect(toIncomingMessage(message({ sentAt: null }), inbox, "")).toBeNull();
	});
});

describe("reading the References header", () => {
	it("unfolds a header that wraps onto more lines", () => {
		const headers = Buffer.from(
			"References: <root@mail.test>\r\n\t<first@mail.test>\r\n\r\n",
		);

		expect(headerValue(headers, "references")).toBe(
			"<root@mail.test> <first@mail.test>",
		);
	});

	it("answers null when the header is absent", () => {
		expect(headerValue(Buffer.from("\r\n"), "references")).toBeNull();
		expect(headerValue(undefined, "references")).toBeNull();
	});
});

describe("choosing the body part", () => {
	it("prefers plain text over HTML and skips attachments", () => {
		const chosen = textPartOf({
			type: "multipart/mixed",
			childNodes: [
				{
					part: "1",
					type: "multipart/alternative",
					childNodes: [
						{ part: "1.1", type: "text/plain" },
						{ part: "1.2", type: "text/html" },
					],
				},
				{ part: "2", type: "text/plain", disposition: "attachment" },
			],
		});

		expect(chosen).toEqual({ part: "1.1", html: false });
	});

	it("takes HTML when there is nothing else", () => {
		expect(textPartOf({ type: "text/html" })).toEqual({
			part: "1",
			html: true,
		});
	});

	it("answers null for a message with no text", () => {
		expect(textPartOf({ type: "application/pdf" })).toBeNull();
		expect(textPartOf(undefined)).toBeNull();
	});
});

describe("the IMAP cursor", () => {
	it("round-trips through the stored string", () => {
		const cursor = emptyImapCursor();
		cursor.folders.INBOX = { uidValidity: "9", lastUid: 41 };
		cursor.importing = false;

		expect(parseImapCursor(JSON.stringify(cursor))).toEqual(cursor);
		expect(isImporting(JSON.stringify(cursor))).toBe(false);
	});

	it("treats a missing or unreadable cursor as an import still to run", () => {
		expect(parseImapCursor(null)).toBeNull();
		expect(parseImapCursor("2026-01-01T00:00:00.000Z")).toBeNull();
		expect(parseImapCursor('{"version":2}')).toBeNull();
		expect(isImporting(null)).toBe(true);
	});
});
