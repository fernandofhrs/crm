import type { Db } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type { AsanaTask } from "./asana.client";
import type { AsanaPeopleOutput } from "./asana.contracts";

type Person = { name: string | null; email: string | null };

type Member = { id: string; name: string; email: string };

@Injectable()
export class AsanaAssigneesService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async resolve(
		connectionId: string,
		tasks: AsanaTask[],
	): Promise<Map<string, string>> {
		const seen = new Map<string, Person>();

		for (const task of tasks) {
			if (!task.assignee) continue;

			seen.set(task.assignee.gid, {
				name: task.assignee.name?.trim() || null,
				email: task.assignee.email?.trim().toLowerCase() || null,
			});
		}

		const [known, members] = await Promise.all([
			this.db.asanaAssignee.findMany({
				where: { connectionId },
				select: {
					id: true,
					asanaUserGid: true,
					name: true,
					email: true,
					userId: true,
				},
			}),
			this.members(),
		]);

		const byGid = new Map(known.map((row) => [row.asanaUserGid, row]));
		const byEmail = new Map(members.map((member) => [member.email, member.id]));
		const enrolled = new Set(members.map((member) => member.id));

		await this.db.asanaAssignee.createMany({
			data: [...seen]
				.filter(([gid]) => !byGid.has(gid))
				.map(([gid, person]) => ({
					connectionId,
					asanaUserGid: gid,
					...person,
				})),
			skipDuplicates: true,
		});

		const owners = new Map<string, string>();

		for (const [gid, person] of seen) {
			const row = byGid.get(gid);

			if (row && (row.name !== person.name || row.email !== person.email)) {
				await this.db.asanaAssignee.update({
					where: { id: row.id },
					data: person,
				});
			}

			const chosen =
				row?.userId && enrolled.has(row.userId) ? row.userId : null;
			const owner = chosen ?? (person.email ? byEmail.get(person.email) : null);

			if (owner) owners.set(gid, owner);
		}

		return owners;
	}

	async list(connectionId: string | null): Promise<AsanaPeopleOutput> {
		if (!connectionId) return { people: [], members: [] };

		const [rows, members] = await Promise.all([
			this.db.asanaAssignee.findMany({
				where: { connectionId },
				orderBy: [{ name: "asc" }, { asanaUserGid: "asc" }],
				select: { asanaUserGid: true, name: true, email: true, userId: true },
			}),
			this.members(),
		]);

		const enrolled = new Set(members.map((member) => member.id));

		return {
			people: rows.map((row) => ({
				gid: row.asanaUserGid,
				name: row.name,
				email: row.email,
				chosenUserId:
					row.userId && enrolled.has(row.userId) ? row.userId : null,
				emailMatchName:
					members.find((member) => member.email === row.email)?.name ?? null,
			})),
			members: members.map((member) => ({ id: member.id, name: member.name })),
		};
	}

	async assign(
		connectionId: string,
		gid: string,
		userId: string | null,
	): Promise<void> {
		if (userId !== null) {
			const member = await this.db.member.findUnique({
				where: {
					organizationId_userId: { organizationId: WORKSPACE_ID, userId },
				},
				select: { id: true },
			});

			if (!member) {
				throw new BadRequestException("Essa pessoa não faz parte do CRM.");
			}
		}

		const changed = await this.db.asanaAssignee.updateMany({
			where: { connectionId, asanaUserGid: gid },
			data: { userId },
		});

		if (changed.count === 0) {
			throw new NotFoundException(
				"O projeto do time não tem tarefa com esse responsável.",
			);
		}
	}

	private async members(): Promise<Member[]> {
		const members = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			orderBy: { user: { name: "asc" } },
			select: { user: { select: { id: true, name: true, email: true } } },
		});

		return members.map((member) => ({
			id: member.user.id,
			name: member.user.name.trim() || member.user.email,
			email: member.user.email.trim().toLowerCase(),
		}));
	}
}
