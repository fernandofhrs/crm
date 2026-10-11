import {
	normaliseMessageId,
	rootMessageIdFrom,
	stripHtml,
	stripQuotedHistory,
} from "../mailbox/message-text";
import type { IncomingMessage } from "../mailbox/thread-writer.service";
import type { ImapFolder, ImapMessage } from "./imap.client";

export function toIncomingMessage(
	message: ImapMessage,
	folder: ImapFolder,
	body: string,
): IncomingMessage | null {
	if (!message.messageId || !message.from || !message.sentAt) return null;

	const rfcMessageId = normaliseMessageId(message.messageId);
	if (!rfcMessageId) return null;

	const rootId =
		rootMessageIdFrom({
			references: message.references,
			inReplyTo: message.inReplyTo,
			messageId: message.messageId,
		}) ?? rfcMessageId;

	const text = message.textPart?.html ? stripHtml(body) : body;

	return {
		rfcMessageId,
		rootId,
		subject: message.subject,
		from: message.from,
		recipients: [
			...message.to.map((address) => ({ ...address, kind: "to" as const })),
			...message.cc.map((address) => ({ ...address, kind: "cc" as const })),
		],
		body: stripQuotedHistory(text),
		sentAt: message.sentAt,
		imapMessageRef: `${folder.path}:${message.uid}`,
	};
}
