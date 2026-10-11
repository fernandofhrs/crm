import { Injectable, Logger } from "@nestjs/common";
import {
	ImapFlow,
	type MailboxLockObject,
	type MessageAddressObject,
	type MessageStructureObject,
} from "imapflow";
import { z } from "zod";
import { IMAP } from "./imap-config";

const imapFault = z.object({
	message: z.string().optional(),
	code: z.string().optional(),
	responseText: z.string().optional(),
	authenticationFailed: z.boolean().optional(),
	tlsFailed: z.boolean().optional(),
});

type ImapFault = z.infer<typeof imapFault>;

const UNKNOWN_FAULT = "The mail server connection failed.";

export type ImapCredentials = {
	host: string;
	port: number;
	username: string;
	password: string;
};

type ImapFolderRole = "inbox" | "sent";

export type ImapFolder = {
	path: string;
	role: ImapFolderRole;
};

export type ImapFolderState = {
	uidValidity: string;
	uidNext: number;
};

type ImapAddress = {
	email: string;
	name: string | null;
};

export type ImapTextPart = {
	part: string;
	html: boolean;
};

export type ImapMessage = {
	uid: number;
	messageId: string | null;
	inReplyTo: string | null;
	references: string | null;
	subject: string | null;
	from: ImapAddress | null;
	to: ImapAddress[];
	cc: ImapAddress[];
	sentAt: Date | null;
	textPart: ImapTextPart | null;
};

export type ImapFailure =
	| { outcome: "auth-failed"; reason: string }
	| { outcome: "unreachable"; reason: string }
	| { outcome: "failed"; reason: string };

export type ImapConnectResult =
	| { outcome: "ok"; session: ImapSession }
	| ImapFailure;

export interface ImapSession {
	folders(): Promise<ImapFolder[]>;
	open(path: string): Promise<ImapFolderState>;
	firstUidSince(since: Date): Promise<number | null>;
	listAfter(lastUid: number, limit: number): Promise<ImapMessage[]>;
	bodyOf(message: ImapMessage): Promise<string>;
	close(): Promise<void>;
}

const UNREACHABLE_CODES = new Set([
	"ECONNREFUSED",
	"ENOTFOUND",
	"EAI_AGAIN",
	"ETIMEDOUT",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ECONNRESET",
	"CONNECT_TIMEOUT",
	"GREETING_TIMEOUT",
	"UPGRADE_TIMEOUT",
]);

@Injectable()
export class ImapClient {
	private readonly logger = new Logger(ImapClient.name);

	async connect(credentials: ImapCredentials): Promise<ImapConnectResult> {
		const loopback = (IMAP.server.loopbackHosts as readonly string[]).includes(
			credentials.host,
		);
		const implicitTls = credentials.port === IMAP.server.implicitTlsPort;

		const flow = new ImapFlow({
			host: credentials.host,
			port: credentials.port,
			secure: implicitTls,
			doSTARTTLS: implicitTls || loopback ? undefined : true,
			auth: { user: credentials.username, pass: credentials.password },
			logger: false,
			disableAutoIdle: true,
			connectionTimeout: IMAP.timeouts.connectMs,
			greetingTimeout: IMAP.timeouts.greetingMs,
			socketTimeout: IMAP.timeouts.socketMs,
		});

		flow.on("error", (error: Error) => {
			this.logger.warn({
				message: "IMAP connection error",
				host: credentials.host,
				reason: error.message,
			});
		});

		try {
			await flow.connect();
		} catch (error) {
			flow.close();

			const fault = imapFault.safeParse(error);
			return failureOf(fault.success ? fault.data : {});
		}

		return { outcome: "ok", session: new FlowSession(flow) };
	}

	async verify(
		credentials: ImapCredentials,
	): Promise<{ outcome: "ok" } | ImapFailure> {
		const opened = await this.connect(credentials);
		if (opened.outcome !== "ok") return opened;

		await opened.session.close();
		return { outcome: "ok" };
	}
}

class FlowSession implements ImapSession {
	private lock: MailboxLockObject | null = null;

	constructor(private readonly flow: ImapFlow) {}

	async folders(): Promise<ImapFolder[]> {
		const listed = await this.flow.list();

		const sent =
			listed.find((box) => box.specialUse === IMAP.folders.sentFlag) ??
			listed.find((box) =>
				(IMAP.folders.sentNames as readonly string[]).includes(
					box.name.toLowerCase(),
				),
			);

		const folders: ImapFolder[] = [];
		if (sent) folders.push({ path: sent.path, role: "sent" });
		folders.push({ path: IMAP.folders.inbox, role: "inbox" });

		return folders;
	}

	async open(path: string): Promise<ImapFolderState> {
		this.release();
		this.lock = await this.flow.getMailboxLock(path, { readOnly: true });

		const mailbox = this.flow.mailbox;
		if (!mailbox) {
			throw new Error(`The mail server did not open ${path}.`);
		}

		return {
			uidValidity: mailbox.uidValidity.toString(),
			uidNext: mailbox.uidNext,
		};
	}

	async firstUidSince(since: Date): Promise<number | null> {
		const found = await this.flow.search({ since }, { uid: true });
		if (!found || found.length === 0) return null;

		return found.reduce((lowest, uid) => (uid < lowest ? uid : lowest));
	}

	async listAfter(lastUid: number, limit: number): Promise<ImapMessage[]> {
		const found = await this.flow.search(
			{ uid: `${lastUid + 1}:*` },
			{ uid: true },
		);

		const uids = (found || [])
			.filter((uid) => uid > lastUid)
			.sort((a, b) => a - b)
			.slice(0, limit);

		if (uids.length === 0) return [];

		const fetched = await this.flow.fetchAll(
			uids,
			{
				uid: true,
				envelope: true,
				internalDate: true,
				bodyStructure: true,
				headers: ["references"],
			},
			{ uid: true },
		);

		return fetched
			.sort((a, b) => a.uid - b.uid)
			.map((message) => ({
				uid: message.uid,
				messageId: message.envelope?.messageId?.trim() || null,
				inReplyTo: message.envelope?.inReplyTo?.trim() || null,
				references: headerValue(message.headers, "references"),
				subject: message.envelope?.subject?.trim() || null,
				from: addressOf(message.envelope?.from?.at(0)),
				to: addressesOf(message.envelope?.to),
				cc: addressesOf(message.envelope?.cc),
				sentAt: dateOf(message.envelope?.date) ?? dateOf(message.internalDate),
				textPart: textPartOf(message.bodyStructure),
			}));
	}

	async bodyOf(message: ImapMessage): Promise<string> {
		if (!message.textPart) return "";

		const download = await this.flow.download(
			String(message.uid),
			message.textPart.part,
			{ uid: true, maxBytes: IMAP.body.maxBytes },
		);

		if (!download.content) return "";

		const chunks: Buffer[] = [];
		for await (const chunk of download.content) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}

		return Buffer.concat(chunks).toString("utf8");
	}

	async close(): Promise<void> {
		this.release();

		try {
			await this.flow.logout();
		} catch {
			this.flow.close();
		}
	}

	private release(): void {
		this.lock?.release();
		this.lock = null;
	}
}

function failureOf(cause: ImapFault): ImapFailure {
	const reason = cause.responseText || cause.message || UNKNOWN_FAULT;

	if (cause.authenticationFailed) {
		return {
			outcome: "auth-failed",
			reason: "The mail server refused that address and password.",
		};
	}

	if (cause.code && UNREACHABLE_CODES.has(cause.code)) {
		return {
			outcome: "unreachable",
			reason: `The mail server could not be reached (${cause.code}).`,
		};
	}

	if (cause.tlsFailed) {
		return {
			outcome: "failed",
			reason: "The mail server did not offer an encrypted connection.",
		};
	}

	return { outcome: "failed", reason };
}

function addressOf(
	address: MessageAddressObject | undefined,
): ImapAddress | null {
	const email = address?.address?.trim().toLowerCase();
	if (!email?.includes("@")) return null;

	return { email, name: address?.name?.trim() || null };
}

function addressesOf(
	addresses: MessageAddressObject[] | undefined,
): ImapAddress[] {
	return (addresses ?? [])
		.map(addressOf)
		.filter((address): address is ImapAddress => address !== null);
}

function dateOf(value: Date | string | undefined): Date | null {
	if (!value) return null;

	const at = value instanceof Date ? value : new Date(value);
	return Number.isNaN(at.getTime()) ? null : at;
}

export function headerValue(
	headers: Buffer | undefined,
	name: string,
): string | null {
	if (!headers) return null;

	const unfolded = headers.toString("utf8").replace(/\r?\n[ \t]+/g, " ");
	const prefix = `${name.toLowerCase()}:`;

	for (const line of unfolded.split(/\r?\n/)) {
		if (line.toLowerCase().startsWith(prefix)) {
			return line.slice(prefix.length).trim() || null;
		}
	}

	return null;
}

export function textPartOf(
	structure: MessageStructureObject | undefined,
): ImapTextPart | null {
	if (!structure) return null;

	const leaves: MessageStructureObject[] = [];
	const pending = [structure];

	while (pending.length > 0) {
		const node = pending.shift();
		if (!node) continue;

		if (node.childNodes?.length) {
			pending.unshift(...node.childNodes);
			continue;
		}

		if (node.disposition?.toLowerCase() === "attachment") continue;
		leaves.push(node);
	}

	const plain = leaves.find((node) => node.type.toLowerCase() === "text/plain");
	const html = leaves.find((node) => node.type.toLowerCase() === "text/html");
	const chosen = plain ?? html;

	if (!chosen) return null;

	return {
		part: chosen.part ?? IMAP.body.rootPart,
		html: chosen === html && !plain,
	};
}
