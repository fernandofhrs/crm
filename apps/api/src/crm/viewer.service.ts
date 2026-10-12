import type { Db } from "@crm/db";
import {
	isVisibleTo,
	type RecordKind,
	type RecordRef,
	type Viewer,
	viewerOf,
} from "@crm/db/visibility";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export type { RecordRef };

const MISSING = {
	company: (id: string) => `Nenhuma empresa com o id ${id}.`,
	contact: (id: string) => `Nenhum contato com o id ${id}.`,
	deal: (id: string) => `Nenhum negócio com o id ${id}.`,
} as const satisfies Record<RecordKind, (id: string) => string>;

@Injectable()
export class ViewerService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async of(userId: string): Promise<Viewer> {
		return viewerOf(this.db, userId);
	}

	async sees(viewer: Viewer, record: RecordRef): Promise<boolean> {
		return isVisibleTo(this.db, viewer, record);
	}

	async assertSees(viewer: Viewer, record: RecordRef): Promise<void> {
		if (await this.sees(viewer, record)) return;

		throw new NotFoundException(MISSING[record.kind](record.id));
	}
}
