import type { AsanaTask } from "./asana.client";
import { ASANA } from "./asana-config";

const ADDRESS = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export type AgendaTask = {
	gid: string;
	subject: string;
	body: string | null;
	dueAt: Date;
	createdAt: Date | null;
	url: string | null;
	addresses: string[];
};

export function dueDateOf(task: AsanaTask): Date | null {
	const raw = task.due_at ?? dateOnly(task.due_on);
	if (!raw) return null;

	const at = new Date(raw);
	return Number.isNaN(at.getTime()) ? null : at;
}

export function toAgendaTask(task: AsanaTask): AgendaTask | null {
	const dueAt = dueDateOf(task);
	if (!dueAt) return null;

	const notes = task.notes?.trim() ?? "";
	const name = task.name?.trim() ?? "";

	return {
		gid: task.gid,
		subject: name || ASANA.task.untitled,
		body: notes ? notes.slice(0, ASANA.task.bodyMax) : null,
		dueAt,
		createdAt: validDate(task.created_at),
		url: task.permalink_url ?? null,
		addresses: addressesIn(`${name}\n${notes}`),
	};
}

export function isInWindow(dueAt: Date, now: Date): boolean {
	const earliest = now.getTime() - ASANA.window.pastMs;
	const latest = now.getTime() + ASANA.window.futureMs;
	const at = dueAt.getTime();

	return at >= earliest && at <= latest;
}

export function addressesIn(text: string): string[] {
	const found = text.match(ADDRESS) ?? [];
	const unique = new Set(found.map((address) => address.toLowerCase()));

	return [...unique].slice(0, ASANA.match.maxAddresses);
}

function dateOnly(day: string | null | undefined): string | null {
	return day ? `${day}${ASANA.task.dateOnlyDueTime}` : null;
}

function validDate(raw: string | null | undefined): Date | null {
	if (!raw) return null;

	const at = new Date(raw);
	return Number.isNaN(at.getTime()) ? null : at;
}
