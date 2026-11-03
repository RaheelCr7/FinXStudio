import { COUNTRIES, countryByCode, countryOfLocale } from "./countries";
import { LANGUAGE_CODE, languageInfo, type Direction } from "./languages";
import { validateCustomCurrency, CURRENCY_LIST, type CurrencyInfo } from "./currency";

/** Where a project's journeys run. Tablet and watch are accepted and stored but not built yet. */
export const CHANNELS = ["web", "mobile", "tablet", "watch"] as const;
export type Channel = (typeof CHANNELS)[number];
export const BUILT_CHANNELS: Channel[] = ["web", "mobile"];

/** A language the project offers that is not in the built-in list. */
export type ProjectLanguage = { code: string; name: string; dir: Direction; native?: string };

/** One legal entity of a bank group: its own country, currencies, languages and sandbox customers. A single bank is a group of one. */
export type Entity = { id: string; name: string; country: string; currency: string; currencies?: string[]; languages: string[] };

export type ProjectShape = {
  channels: Channel[];
  /** Language codes the project offers; the first is the default. */
  languages: string[];
  /** Languages added by this project (code, name, direction). */
  customLanguages: ProjectLanguage[];
  entities: Entity[];
  /** The currency amounts are shown in unless a journey or account says otherwise. */
  baseCurrency: string;
  /** Every currency the project offers, the base one included. */
  currencies: string[];
  /** Currencies added by this project (code, name, symbol, decimals). */
  customCurrencies: CurrencyInfo[];
};

type Def = { name: string; currency: string; locale: string; channels?: Channel[]; languages?: string[]; customLanguages?: ProjectLanguage[]; entities?: Entity[]; currencies?: string[]; customCurrencies?: CurrencyInfo[] };

/** What a project offers, with today's single-bank settings filling anything it has not set. Existing projects need no migration. */
export function projectShape(def: Def): ProjectShape {
  const country = countryOfLocale(def.locale);
  const languages = def.languages?.length ? def.languages : country?.languages ?? [def.locale.split(/[-_]/)[0] ?? "en"];
  const entities = def.entities?.length ? def.entities : [{ id: "main", name: def.name, country: country?.code ?? "", currency: def.currency, languages }];
  const currencies = def.currencies?.length ? def.currencies : [...new Set([def.currency, ...entities.flatMap((e) => [e.currency, ...(e.currencies ?? [])])])];
  return { channels: def.channels?.length ? def.channels : ["web", "mobile"], languages, customLanguages: def.customLanguages ?? [], entities, baseCurrency: def.currency, currencies, customCurrencies: def.customCurrencies ?? [] };
}

/** Is this language known: built in, or added by the project? */
export const knownLanguage = (code: string, custom: ProjectLanguage[] = []) => !!languageInfo(code) || custom.some((l) => l.code === code);
export const directionOf = (code: string, custom: ProjectLanguage[] = []): Direction => custom.find((l) => l.code === code)?.dir ?? languageInfo(code)?.dir ?? "ltr";

const ID = /^[a-z][a-z0-9-]{0,29}$/;
const CURRENCY = /^[A-Z]{3,4}$/;
/** Is this currency known: built in, or added by the project? */
export const knownCurrency = (code: string, custom: CurrencyInfo[] = []) => CURRENCY_LIST.some((c) => c.code === code) || custom.some((c) => c.code === code);

/** Checks what a person sent for a project's channels, languages and entities. Returns the cleaned shape, or every problem found. */
export function validateShape(input: unknown, existingCustom: ProjectLanguage[] = [], existingCurrencies: CurrencyInfo[] = []): { ok: true; shape: Partial<ProjectShape> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Partial<ProjectShape> = {};

  if (src.channels !== undefined) {
    const ch = src.channels;
    if (!Array.isArray(ch) || ch.length === 0) errors.push("Choose at least one channel");
    else if (ch.some((c) => !CHANNELS.includes(c as Channel))) errors.push(`Channels can be ${CHANNELS.join(", ")}`);
    else if (!ch.some((c) => BUILT_CHANNELS.includes(c as Channel))) errors.push("Choose web or mobile: tablet and watch are not built yet");
    else out.channels = [...new Set(ch as Channel[])];
  }

  let custom: ProjectLanguage[] = existingCustom;
  if (src.customLanguages !== undefined) {
    custom = [];
    if (!Array.isArray(src.customLanguages)) errors.push("customLanguages must be a list");
    else {
      for (const l of src.customLanguages as Record<string, unknown>[]) {
        if (typeof l?.code !== "string" || !LANGUAGE_CODE.test(l.code)) errors.push(`"${String(l?.code)}" is not a language code like pt or pt-BR`);
        else if (languageInfo(l.code)) errors.push(`${l.code} is already in the built-in list`);
        else if (typeof l.name !== "string" || l.name.trim().length < 2) errors.push(`Give ${l.code} a name`);
        else if (l.dir !== "ltr" && l.dir !== "rtl") errors.push(`Say whether ${l.code} reads left to right or right to left`);
        else custom.push({ code: l.code, name: l.name.trim(), dir: l.dir, ...(typeof l.native === "string" && l.native ? { native: l.native } : {}) });
      }
      out.customLanguages = custom;
    }
  }

  let customCur: CurrencyInfo[] = existingCurrencies;
  if (src.customCurrencies !== undefined) {
    customCur = [];
    if (!Array.isArray(src.customCurrencies)) errors.push("customCurrencies must be a list");
    else {
      for (const c of src.customCurrencies as Record<string, unknown>[]) {
        const entry = { code: String(c?.code ?? ""), name: String(c?.name ?? "").trim(), symbol: String(c?.symbol ?? "").trim(), decimals: Number(c?.decimals) };
        const problem = validateCustomCurrency(entry, customCur);
        if (problem) errors.push(problem); else customCur.push({ ...entry, custom: true });
      }
      out.customCurrencies = customCur;
    }
  }
  if (src.currencies !== undefined) {
    const cur = src.currencies;
    if (!Array.isArray(cur) || cur.length === 0) errors.push("Offer at least one currency");
    else if (cur.some((c) => typeof c !== "string" || !knownCurrency(c, customCur))) errors.push(`Unknown currency: ${cur.filter((c) => typeof c !== "string" || !knownCurrency(c, customCur)).join(", ")}. Add it first with a name, symbol and decimals.`);
    else out.currencies = [...new Set(cur as string[])];
  }
  if (src.baseCurrency !== undefined) {
    if (typeof src.baseCurrency !== "string" || !knownCurrency(src.baseCurrency, customCur)) errors.push(`Unknown base currency: ${String(src.baseCurrency)}`);
    else out.baseCurrency = src.baseCurrency;
  }

  const known = (c: unknown) => typeof c === "string" && knownLanguage(c, custom);
  if (src.languages !== undefined) {
    const langs = src.languages;
    if (!Array.isArray(langs) || langs.length === 0) errors.push("Choose at least one language");
    else if (langs.some((c) => !known(c))) errors.push(`Unknown language: ${langs.filter((c) => !known(c)).join(", ")}. Add it first with a name and direction.`);
    else out.languages = [...new Set(langs as string[])];
  }

  if (src.entities !== undefined) {
    const ents = src.entities;
    if (!Array.isArray(ents) || ents.length === 0) errors.push("A project needs at least one entity");
    else {
      const seen = new Set<string>(), list: Entity[] = [];
      for (const e of ents as Record<string, unknown>[]) {
        const id = String(e?.id ?? "");
        if (!ID.test(id)) errors.push(`Entity id "${id}" must be lowercase letters, numbers and dashes`);
        else if (seen.has(id)) errors.push(`Two entities share the id ${id}`);
        else if (typeof e.name !== "string" || e.name.trim().length < 2) errors.push(`Give entity ${id} a name`);
        else if (typeof e.country !== "string" || !countryByCode(e.country)) errors.push(`Entity ${id}: choose a country from the list (${COUNTRIES.map((c) => c.code).join(", ")})`);
        else if (typeof e.currency !== "string" || !CURRENCY.test(e.currency) || !knownCurrency(e.currency, customCur)) errors.push(`Entity ${id}: choose a currency the project knows, like JOD`);
        else if (!Array.isArray(e.languages) || e.languages.length === 0) errors.push(`Entity ${id}: choose at least one language`);
        else if (e.languages.some((c) => !known(c))) errors.push(`Entity ${id}: unknown language ${e.languages.filter((c) => !known(c)).join(", ")}`);
        else {
          seen.add(id);
          list.push({ id, name: e.name.trim(), country: e.country.toUpperCase(), currency: e.currency, languages: [...new Set(e.languages as string[])],
            ...(Array.isArray(e.currencies) && e.currencies.every((c) => typeof c === "string" && CURRENCY.test(c) && knownCurrency(c, customCur)) ? { currencies: [...new Set(e.currencies as string[])] } : {}) });
        }
      }
      if (list.length === (ents as unknown[]).length) out.entities = list;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, shape: out };
}
