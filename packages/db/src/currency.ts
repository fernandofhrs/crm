export interface CurrencyMeta {
	code: string;
	name: string;
	minorUnits: number;
}

export const DEFAULT_REPORTING_CURRENCY = "USD";

const CURRENCY_LIST: readonly CurrencyMeta[] = [
	{ code: "USD", name: "Dólar americano", minorUnits: 2 },
	{ code: "EUR", name: "Euro", minorUnits: 2 },
	{ code: "JPY", name: "Iene japonês", minorUnits: 0 },
	{ code: "GBP", name: "Libra esterlina", minorUnits: 2 },
	{ code: "CNY", name: "Yuan chinês", minorUnits: 2 },
	{ code: "AUD", name: "Dólar australiano", minorUnits: 2 },
	{ code: "CAD", name: "Dólar canadense", minorUnits: 2 },
	{ code: "CHF", name: "Franco suíço", minorUnits: 2 },
	{ code: "HKD", name: "Dólar de Hong Kong", minorUnits: 2 },
	{ code: "SGD", name: "Dólar de Singapura", minorUnits: 2 },
	{ code: "ZAR", name: "Rand sul-africano", minorUnits: 2 },
	{ code: "BRL", name: "Real brasileiro", minorUnits: 2 },
] as const;

export const CURRENCIES = CURRENCY_LIST;

const BY_CODE = new Map(CURRENCY_LIST.map((entry) => [entry.code, entry]));

export const CURRENCY_CODES: readonly string[] = CURRENCY_LIST.map(
	(entry) => entry.code,
);

const SHAPE = /^[A-Za-z]{3}$/;

export function normalizeCurrency(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}

export function isCurrencyCode(value: string | null | undefined): boolean {
	return BY_CODE.has(normalizeCurrency(value));
}

export function currencyMeta(
	value: string | null | undefined,
): CurrencyMeta | null {
	return BY_CODE.get(normalizeCurrency(value)) ?? null;
}

export function currencyName(value: string | null | undefined): string | null {
	return currencyMeta(value)?.name ?? null;
}

export function minorUnitsOf(value: string | null | undefined): number {
	return currencyMeta(value)?.minorUnits ?? 2;
}

export function isWellFormedCurrency(
	value: string | null | undefined,
): boolean {
	return SHAPE.test((value ?? "").trim());
}
