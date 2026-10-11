import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { CredentialVaultService } from "../mailbox/credential-vault.service";

export type AsanaLink = {
	accountName: string | null;
	projectGid: string | null;
	projectName: string | null;
};

export type StoredAsanaToken =
	| { outcome: "ok"; token: string; link: AsanaLink }
	| { outcome: "not-connected"; reason: string }
	| { outcome: "needs-reconnect"; reason: string };

@Injectable()
export class AsanaCredentialsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly vault: CredentialVaultService,
	) {}

	async forUser(userId: string): Promise<StoredAsanaToken> {
		const connection = await this.db.asanaConnection.findUnique({
			where: { userId },
			select: {
				secret: true,
				accountName: true,
				projectGid: true,
				projectName: true,
			},
		});

		if (!connection) {
			return { outcome: "not-connected", reason: "Asana is not connected." };
		}

		const token = this.vault.open(connection.secret);

		if (token === null) {
			return {
				outcome: "needs-reconnect",
				reason:
					"The saved Asana token can no longer be read. Connect Asana again.",
			};
		}

		return {
			outcome: "ok",
			token,
			link: {
				accountName: connection.accountName,
				projectGid: connection.projectGid,
				projectName: connection.projectName,
			},
		};
	}

	async linkOf(userId: string): Promise<AsanaLink | null> {
		return this.db.asanaConnection.findUnique({
			where: { userId },
			select: { accountName: true, projectGid: true, projectName: true },
		});
	}

	async saveToken(
		userId: string,
		input: { token: string; accountName: string | null },
	): Promise<void> {
		const data = {
			secret: this.vault.seal(input.token),
			accountName: input.accountName,
		};

		await this.db.asanaConnection.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
		});
	}

	async saveProject(
		userId: string,
		project: { gid: string; name: string | null },
	): Promise<void> {
		await this.db.asanaConnection.update({
			where: { userId },
			data: { projectGid: project.gid, projectName: project.name },
		});
	}

	async remove(userId: string): Promise<boolean> {
		const removed = await this.db.asanaConnection.deleteMany({
			where: { userId },
		});

		return removed.count > 0;
	}
}
