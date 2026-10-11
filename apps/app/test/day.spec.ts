import { describe, expect, it } from "bun:test";
import {
	formatDay,
	formatDecimalInput,
	formatNumber,
	fromDay,
	parseDecimal,
	toDay,
} from "@crm/ui/lib/format";

describe("day strings", () => {
	it("round-trips a date through its local parts", () => {
		const date = new Date(2026, 11, 31, 23, 30);
		expect(toDay(date)).toBe("2026-12-31");
		expect(toDay(fromDay(toDay(date)) as Date)).toBe("2026-12-31");
	});

	it("pads single-digit months and days", () => {
		expect(toDay(new Date(2026, 0, 5))).toBe("2026-01-05");
	});

	it("reads the day the server stored, not the local rendering of it", () => {
		expect(formatDay("2026-12-31T00:00:00.000Z")).toBe("31 de dez. de 2026");
		expect(fromDay("2026-12-31T00:00:00.000Z")?.getDate()).toBe(31);
	});

	it("has nothing to show for nothing", () => {
		expect(fromDay(null)).toBeUndefined();
		expect(fromDay("")).toBeUndefined();
		expect(fromDay("someday")).toBeUndefined();
		expect(formatDay(null)).toBe("—");
	});
});

describe("numbers typed the Brazilian way", () => {
	it("reads a comma as the decimal mark and dots as thousands", () => {
		expect(parseDecimal("24.000,50")).toBe(24000.5);
		expect(parseDecimal("5,43")).toBe(5.43);
		expect(parseDecimal("24.000")).toBe(24000);
		expect(parseDecimal("1.250.000")).toBe(1250000);
	});

	it("still reads a plain dot decimal", () => {
		expect(parseDecimal("24000")).toBe(24000);
		expect(parseDecimal("5.43")).toBe(5.43);
		expect(parseDecimal("1234.56")).toBe(1234.56);
	});

	it("is not a number when it is not one", () => {
		expect(Number.isNaN(parseDecimal(""))).toBe(true);
		expect(Number.isNaN(parseDecimal("abc"))).toBe(true);
	});

	it("shows a number with a comma, for the field and for the screen", () => {
		expect(formatDecimalInput(12500.5)).toBe("12500,5");
		expect(formatNumber(6250.25)).toBe("6.250,25");
	});
});
