import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { CredentialVaultService } from "../mailbox/credential-vault.service";

export type AsanaLink = {
	id: string;
	accountName: string | null;
	projectGid: string | null;
	projectName: string | null;
	shared: boolean;
};

export type AsanaTeamLink = {
	userId: string;
	accountName: string | null;
	projectName: string | null;
};

const LINK = {
	id: true,
	accountName: true,
	projectGid: true,
	projectName: true,
	shared: true,
} as const;

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
			select: { secret: true, ...LINK },
		});

		if (!connection) {
			return {
				outcome: "not-connected",
				reason: "O Asana não está conectado.",
			};
		}

		const token = this.vault.open(connection.secret);

		if (token === null) {
			return {
				outcome: "needs-reconnect",
				reason:
					"Não é mais possível ler o token salvo do Asana. Conecte o Asana de novo.",
			};
		}

		return {
			outcome: "ok",
			token,
			link: {
				id: connection.id,
				accountName: connection.accountName,
				projectGid: connection.projectGid,
				projectName: connection.projectName,
				shared: connection.shared,
			},
		};
	}

	async linkOf(userId: string): Promise<AsanaLink | null> {
		return this.db.asanaConnection.findUnique({
			where: { userId },
			select: LINK,
		});
	}

	async team(): Promise<AsanaTeamLink | null> {
		return this.db.asanaConnection.findFirst({
			where: { shared: true, projectGid: { not: null } },
			select: { userId: true, accountName: true, projectName: true },
		});
	}

	async saveShared(userId: string, shared: boolean): Promise<void> {
		await this.db.asanaConnection.update({
			where: { userId },
			data: { shared },
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
