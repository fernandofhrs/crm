import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { ImapClient } from "./imap.client";
import { ImapRouter } from "./imap.router";
import { ImapConnectionService } from "./imap-connection.service";
import { ImapCredentialsService } from "./imap-credentials.service";
import { ImapSignInService } from "./imap-sign-in.service";
import { ImapSyncService } from "./imap-sync.service";

@Module({
	imports: [TrpcModule, MailboxModule],
	providers: [
		ImapClient,
		ImapCredentialsService,
		ImapSyncService,
		ImapConnectionService,
		ImapSignInService,
		ImapRouter,
	],
	exports: [ImapSyncService],
})
export class ImapModule {}
