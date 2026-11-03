import { describe, expect, it } from "vitest";
import { brandDefs } from "./tokens";
import { COUNTRIES, countryByCode, countryOfLocale } from "./countries";
import { LANGUAGES, isRtlLanguage, languageInfo } from "./languages";
import { directionOf, projectShape, validateShape } from "./project";

describe("project shape of existing projects (no migration)", () => {
  it("every project in brands.json gets one entity, both built channels and its country's languages", () => {
    for (const [id, def] of Object.entries(brandDefs)) {
      const s = projectShape(def);
      expect(s.entities, id).toHaveLength(1);
      expect(s.entities[0]!.currency, id).toBe(def.currency);
      expect(s.channels, id).toEqual(["web", "mobile"]);
      expect(s.languages.length, id).toBeGreaterThan(0);
    }
  });
  it("derives Jordan's CAB as English and Arabic, and Meezan as English and Urdu", () => {
    expect(projectShape(brandDefs.cab!).languages).toEqual(["en", "ar"]);
    expect(projectShape(brandDefs.cab!).entities[0]!.country).toBe("JO");
    expect(projectShape(brandDefs.meezan!).languages).toEqual(["en", "ur"]);
  });
  it("keeps what a project sets itself", () => {
    const s = projectShape({ name: "G", currency: "JOD", locale: "en-JO", channels: ["web"], languages: ["ar"], entities: [{ id: "jo", name: "G Jordan", country: "JO", currency: "JOD", languages: ["ar"] }] });
    expect(s.channels).toEqual(["web"]);
    expect(s.languages).toEqual(["ar"]);
  });
});

describe("registries", () => {
  it("knows direction by language, ignoring the region", () => {
    expect(isRtlLanguage("ar")).toBe(true);
    expect(isRtlLanguage("ur-PK")).toBe(true);
    expect(isRtlLanguage("en")).toBe(false);
    expect(isRtlLanguage("zz")).toBe(false);
    expect(languageInfo("AR")?.name).toBe("Arabic");
    expect(LANGUAGES.map((l) => l.code)).toEqual([...new Set(LANGUAGES.map((l) => l.code))]);
  });
  it("has draft country profiles with a regulator link, a locale that names the country, and known languages", () => {
    for (const c of COUNTRIES) {
      expect(c.status, c.code).toBe("draft");
      expect(c.regulator.url, c.code).toMatch(/^https:\/\//);
      expect(c.locale.endsWith("-" + c.code) || c.code === "DE" || c.code === "FR", c.code).toBe(true);
      for (const l of c.languages) expect(languageInfo(l), `${c.code} ${l}`).toBeTruthy();
    }
    expect(countryByCode("jo")?.currency).toBe("JOD");
    expect(countryOfLocale("en-PK")?.name).toBe("Pakistan");
    expect(countryOfLocale("en-ZZ")).toBeUndefined();
  });
});

describe("validateShape", () => {
  const ent = { id: "jo", name: "CAB Jordan", country: "JO", currency: "JOD", languages: ["en", "ar"] };
  it("accepts a good shape and cleans it", () => {
    const r = validateShape({ channels: ["web", "mobile", "web"], languages: ["ar", "en"], entities: [ent, { ...ent, id: "ps", name: "CAB Palestine", country: "EG" }] });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.shape.channels).toEqual(["web", "mobile"]); expect(r.shape.entities).toHaveLength(2); }
  });
  it("stores tablet and watch, but needs a built channel too", () => {
    expect(validateShape({ channels: ["web", "tablet", "watch"] }).ok).toBe(true);
    expect(validateShape({ channels: ["tablet"] })).toEqual({ ok: false, errors: ["Choose web or mobile: tablet and watch are not built yet"] });
    expect(validateShape({ channels: [] }).ok).toBe(false);
    expect(validateShape({ channels: ["tv"] }).ok).toBe(false);
  });
  it("lets a project add a language, then use it", () => {
    const r = validateShape({ customLanguages: [{ code: "ku", name: "Kurdish", dir: "rtl" }], languages: ["en", "ku"] });
    expect(r.ok).toBe(true);
    expect(validateShape({ languages: ["en", "ku"] }).ok).toBe(false);
    expect(validateShape({ languages: ["ku"] }, [{ code: "ku", name: "Kurdish", dir: "rtl" }]).ok).toBe(true);
    expect(directionOf("ku", [{ code: "ku", name: "Kurdish", dir: "rtl" }])).toBe("rtl");
  });
  it("refuses bad custom languages", () => {
    const bad = (l: object) => validateShape({ customLanguages: [l] });
    expect(bad({ code: "ar", name: "Arabic", dir: "rtl" }).ok).toBe(false);
    expect(bad({ code: "Klingon!", name: "Klingon", dir: "ltr" }).ok).toBe(false);
    expect(bad({ code: "ku", name: "K", dir: "rtl" }).ok).toBe(false);
    expect(bad({ code: "ku", name: "Kurdish", dir: "up" }).ok).toBe(false);
  });
  it("refuses bad entities: duplicate ids, unknown country, bad currency, no or unknown languages", () => {
    const errs = (e: object[]) => { const r = validateShape({ entities: e }); return r.ok ? [] : r.errors; };
    expect(errs([ent, ent])[0]).toMatch(/share the id/);
    expect(errs([{ ...ent, country: "ZZ" }])[0]).toMatch(/country/);
    expect(errs([{ ...ent, currency: "jod" }])[0]).toMatch(/currency/);
    expect(errs([{ ...ent, languages: [] }])[0]).toMatch(/at least one language/);
    expect(errs([{ ...ent, languages: ["en", "qq"] }])[0]).toMatch(/unknown language qq/);
    expect(errs([{ ...ent, id: "Bad Id" }])[0]).toMatch(/lowercase/);
    expect(validateShape({ entities: [] }).ok).toBe(false);
  });
});

describe("currencies of a project", () => {
  it("default to the base currency and every entity's, with nothing stored", () => {
    for (const [id, def] of Object.entries(brandDefs)) {
      const s = projectShape(def);
      expect(s.baseCurrency, id).toBe(def.currency);
      expect(s.currencies[0], id).toBe(def.currency);
      expect(s.customCurrencies, id).toEqual([]);
    }
  });
  it("validates the offered list, the base and a bank's own currencies", () => {
    const r = validateShape({ currencies: ["JOD", "GLD"], customCurrencies: [{ code: "GLD", name: "Gold coin", symbol: "◎", decimals: 3 }], baseCurrency: "GLD" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.shape.currencies).toEqual(["JOD", "GLD"]); expect(r.shape.baseCurrency).toBe("GLD"); }
    expect(validateShape({ currencies: ["JOD", "GLD"] })).toEqual({ ok: false, errors: ["Unknown currency: GLD. Add it first with a name, symbol and decimals."] });
    expect(validateShape({ currencies: [] })).toEqual({ ok: false, errors: ["Offer at least one currency"] });
    expect(validateShape({ baseCurrency: "NOPE" })).toEqual({ ok: false, errors: ["Unknown base currency: NOPE"] });
    expect(validateShape({ entities: [{ id: "a", name: "Ab", country: "JO", currency: "ZZZ", languages: ["en"] }] })).toEqual({ ok: false, errors: ["Entity a: choose a currency the project knows, like JOD"] });
  });
});
