import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import { CredentialVaultService } from "../mailbox/credential-vault.service";
import type { ImapCredentials } from "./imap.client";
import { IMAP } from "./imap-config";

export type ImapServer = {
	host: string;
	port: number;
};

export type StoredCredentials =
	| { outcome: "ok"; credentials: ImapCredentials; address: string }
	| { outcome: "not-connected"; reason: string }
	| { outcome: "needs-reconnect"; reason: string };

@Injectable()
export class ImapCredentialsService {
	private readonly host: string | undefined;
	private readonly port: number;

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly vault: CredentialVaultService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.host = config.get("IMAP_HOST", { infer: true })?.trim() || undefined;
		this.port = portOf(config.get("IMAP_PORT", { infer: true }));
	}

	server(): ImapServer | null {
		return this.host ? { host: this.host, port: this.port } : null;
	}

	async forUser(userId: string): Promise<StoredCredentials> {
		const server = this.server();

		if (!server) {
			return { outcome: "not-connected", reason: "IMAP_HOST is not set." };
		}

		const connection = await this.db.imapConnection.findUnique({
			where: { userId },
			select: { address: true, username: true, secret: true },
		});

		if (!connection) {
			return { outcome: "not-connected", reason: "No mailbox is connected." };
		}

		const password = this.vault.open(connection.secret);

		if (password === null) {
			return {
				outcome: "needs-reconnect",
				reason:
					"The saved mailbox password can no longer be read. Connect the mailbox again.",
			};
		}

		return {
			outcome: "ok",
			address: connection.address,
			credentials: { ...server, username: connection.username, password },
		};
	}

	async save(
		userId: string,
		input: { address: string; username: string; password: string },
	): Promise<void> {
		const data = {
			address: input.address,
			username: input.username,
			secret: this.vault.seal(input.password),
		};

		await this.db.imapConnection.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
		});
	}

	async addressOf(userId: string): Promise<string | null> {
		const connection = await this.db.imapConnection.findUnique({
			where: { userId },
			select: { address: true },
		});

		return connection?.address ?? null;
	}

	async remove(userId: string): Promise<boolean> {
		const removed = await this.db.imapConnection.deleteMany({
			where: { userId },
		});

		return removed.count > 0;
	}
}

function portOf(raw: string | undefined): number {
	const port = Number.parseInt(raw ?? "", 10);
	const valid =
		Number.isInteger(port) && port >= 1 && port <= IMAP.server.maxPort;

	return valid ? port : IMAP.server.defaultPort;
}
