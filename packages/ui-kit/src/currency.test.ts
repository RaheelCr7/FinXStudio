import { describe, expect, it } from "vitest";
import { CURRENCY_LIST, currencyInfo, formatMoney, fromMinor, prefixOf, roundMoney, toMinor, validateCustomCurrency } from "./index";

describe("currency registry", () => {
  it("has unique codes and only 0, 2 or 3 decimals", () => {
    expect(new Set(CURRENCY_LIST.map((c) => c.code)).size).toBe(CURRENCY_LIST.length);
    for (const c of CURRENCY_LIST) { expect([0, 2, 3], c.code).toContain(c.decimals); expect(c.code).toMatch(/^[A-Z]{3}$/); }
  });
  it("knows the decimals of the main currencies", () => {
    expect(["JPY", "KRW", "VND"].map((c) => currencyInfo(c).decimals)).toEqual([0, 0, 0]);
    expect(["USD", "EUR", "PKR", "AED", "SAR", "EGP"].map((c) => currencyInfo(c).decimals)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(["KWD", "BHD", "OMR", "JOD"].map((c) => currencyInfo(c).decimals)).toEqual([3, 3, 3, 3]);
  });
  it("treats an unknown code as itself with two decimals, and prefers a bank's own entry", () => {
    expect(currencyInfo("XYZ")).toEqual({ code: "XYZ", name: "XYZ", symbol: "XYZ", decimals: 2 });
    expect(currencyInfo("GLD", [{ code: "GLD", name: "Gold coin", symbol: "◎", decimals: 3, custom: true }]).decimals).toBe(3);
  });
});

describe("formatMoney", () => {
  it("puts a one-character symbol tight and a code after a space", () => {
    expect(formatMoney(50, "USD")).toBe("$50");
    expect(formatMoney(184250, "PKR")).toBe("PKR 184,250");
    expect(formatMoney(1200, "EUR")).toBe("€1,200");
    expect(prefixOf("AED")).toBe("AED ");
    expect(prefixOf("CAD")).toBe("CA$");
  });
  it("shows each currency's own decimals for part amounts", () => {
    expect(formatMoney(86.5, "USD")).toBe("$86.50");
    expect(formatMoney(12.5, "JOD")).toBe("JOD 12.500");
    expect(formatMoney(0.25, "KWD")).toBe("KWD 0.250");
    expect(formatMoney(1234.567, "JPY")).toBe("¥1,235");
  });
  it("rounds to the currency, half away from zero", () => {
    expect(formatMoney(2.675, "USD")).toBe("$2.68");
    expect(formatMoney(-2.675, "USD")).toBe("-$2.68");
    expect(formatMoney(0.0005, "JOD")).toBe("JOD 0.001");
  });
  it("shows a negative amount with the sign first and zero as 0", () => {
    expect(formatMoney(-86.5, "USD")).toBe("-$86.50");
    expect(formatMoney(0, "USD")).toBe("$0");
  });
  it("uses native digits for an Arabic or Urdu locale", () => {
    expect(formatMoney(1250, "JOD", "ar-EG")).toBe("JOD ١٬٢٥٠");
    expect(formatMoney(12.5, "JOD", "ar-EG")).toBe("JOD ١٢٫٥٠٠");
  });
  it("falls back for a locale the device does not know", () => {
    expect(formatMoney(1500, "USD", "not a locale")).toBe("$1,500");
  });
});

describe("minor units", () => {
  it("converts to whole minor units and back without float drift", () => {
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(12.5, "JOD")).toBe(12500);
    expect(toMinor(5000, "JPY")).toBe(5000);
    expect(toMinor(-2.675, "USD")).toBe(-268);
    expect(fromMinor(12500, "JOD")).toBe(12.5);
    expect(fromMinor(30, "USD")).toBe(0.3);
  });
  it("rounds to the currency", () => {
    expect(roundMoney(1.005, "USD")).toBe(1.01);
    expect(roundMoney(1.0004, "JOD")).toBe(1);
    expect(roundMoney(1234.5, "JPY")).toBe(1235);
  });
});

describe("a bank's own currency", () => {
  it("accepts a good one and says what is wrong with a bad one", () => {
    expect(validateCustomCurrency({ code: "GLD", name: "Gold coin", symbol: "◎", decimals: 3 })).toBeNull();
    expect(validateCustomCurrency({ code: "gld", name: "x", symbol: "x", decimals: 2 })).toMatch(/capital letters/);
    expect(validateCustomCurrency({ code: "USD", name: "x", symbol: "x", decimals: 2 })).toMatch(/already built in/);
    expect(validateCustomCurrency({ code: "GLD", name: "x", symbol: "x", decimals: 2 }, [{ code: "GLD", name: "x", symbol: "x", decimals: 2 }])).toMatch(/already been added/);
    expect(validateCustomCurrency({ code: "GLD", name: "", symbol: "x", decimals: 2 })).toMatch(/name/);
    expect(validateCustomCurrency({ code: "GLD", name: "x", symbol: "", decimals: 2 })).toMatch(/symbol/);
    expect(validateCustomCurrency({ code: "GLD", name: "x", symbol: "x", decimals: 4 })).toMatch(/Decimals/);
  });
});
