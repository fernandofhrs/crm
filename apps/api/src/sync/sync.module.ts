import { Module } from "@nestjs/common";
import { AsanaModule } from "../asana/asana.module";
import { GoogleModule } from "../google/google.module";
import { ImapModule } from "../imap/imap.module";
import { MailboxModule } from "../mailbox/mailbox.module";
import { MicrosoftModule } from "../microsoft/microsoft.module";
import { MailboxSyncService } from "./mailbox-sync.service";
import { SyncController } from "./sync.controller";

@Module({
	imports: [
		MailboxModule,
		GoogleModule,
		MicrosoftModule,
		ImapModule,
		AsanaModule,
	],
	controllers: [SyncController],
	providers: [MailboxSyncService],
	exports: [MailboxSyncService],
})
export class SyncModule {}
