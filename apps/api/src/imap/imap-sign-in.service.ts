import {
	hostImapSignIn,
	type ImapSignInCredentials,
	type ImapSignInVerdict,
} from "@crm/auth";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ImapClient } from "./imap.client";
import { ImapConnectionService } from "./imap-connection.service";
import { ImapCredentialsService } from "./imap-credentials.service";

@Injectable()
export class ImapSignInService implements OnModuleInit {
	private readonly logger = new Logger(ImapSignInService.name);

	constructor(
		private readonly client: ImapClient,
		private readonly credentials: ImapCredentialsService,
		private readonly connections: ImapConnectionService,
	) {}

	onModuleInit(): void {
		hostImapSignIn({
			verify: (credentials) => this.verify(credentials),
			connect: (userId, credentials) => this.connect(userId, credentials),
		});
	}

	async verify(credentials: ImapSignInCredentials): Promise<ImapSignInVerdict> {
		const server = this.credentials.server();
		if (!server) return "unavailable";

		const verified = await this.client.verify({
			...server,
			username: credentials.address,
			password: credentials.password,
		});

		if (verified.outcome === "ok") return "accepted";
		if (verified.outcome === "auth-failed") return "refused";

		this.logger.warn({
			message: "IMAP sign-in could not check the mailbox",
			outcome: verified.outcome,
			reason: verified.reason,
		});

		return "unavailable";
	}

	async connect(
		userId: string,
		credentials: ImapSignInCredentials,
	): Promise<void> {
		try {
			await this.connections.remember(userId, credentials);
		} catch (error) {
			this.logger.error(
				{ message: "The mailbox was not connected at sign-in", userId },
				error instanceof Error ? error.stack : String(error),
			);
		}
	}
}
