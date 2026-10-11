import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { AsanaClient } from "./asana.client";
import { AsanaRouter } from "./asana.router";
import { AsanaConnectionService } from "./asana-connection.service";
import { AsanaCredentialsService } from "./asana-credentials.service";
import { AsanaSyncService } from "./asana-sync.service";

@Module({
	imports: [TrpcModule, MailboxModule],
	providers: [
		AsanaClient,
		AsanaCredentialsService,
		AsanaSyncService,
		AsanaConnectionService,
		AsanaRouter,
	],
	exports: [AsanaSyncService],
})
export class AsanaModule {}
