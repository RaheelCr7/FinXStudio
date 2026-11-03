import { COUNTRIES, countryByCode, countryOfLocale } from "./countries";
import { LANGUAGE_CODE, languageInfo, type Direction } from "./languages";

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
};

type Def = { name: string; currency: string; locale: string; channels?: Channel[]; languages?: string[]; customLanguages?: ProjectLanguage[]; entities?: Entity[] };

/** What a project offers, with today's single-bank settings filling anything it has not set. Existing projects need no migration. */
export function projectShape(def: Def): ProjectShape {
  const country = countryOfLocale(def.locale);
  const languages = def.languages?.length ? def.languages : country?.languages ?? [def.locale.split(/[-_]/)[0] ?? "en"];
  const entities = def.entities?.length ? def.entities : [{ id: "main", name: def.name, country: country?.code ?? "", currency: def.currency, languages }];
  return { channels: def.channels?.length ? def.channels : ["web", "mobile"], languages, customLanguages: def.customLanguages ?? [], entities };
}

/** Is this language known: built in, or added by the project? */
export const knownLanguage = (code: string, custom: ProjectLanguage[] = []) => !!languageInfo(code) || custom.some((l) => l.code === code);
export const directionOf = (code: string, custom: ProjectLanguage[] = []): Direction => custom.find((l) => l.code === code)?.dir ?? languageInfo(code)?.dir ?? "ltr";

const ID = /^[a-z][a-z0-9-]{0,29}$/;
const CURRENCY = /^[A-Z]{3}$/;

/** Checks what a person sent for a project's channels, languages and entities. Returns the cleaned shape, or every problem found. */
export function validateShape(input: unknown, existingCustom: ProjectLanguage[] = []): { ok: true; shape: Partial<ProjectShape> } | { ok: false; errors: string[] } {
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
        else if (typeof e.currency !== "string" || !CURRENCY.test(e.currency)) errors.push(`Entity ${id}: the currency must be a 3-letter code like JOD`);
        else if (!Array.isArray(e.languages) || e.languages.length === 0) errors.push(`Entity ${id}: choose at least one language`);
        else if (e.languages.some((c) => !known(c))) errors.push(`Entity ${id}: unknown language ${e.languages.filter((c) => !known(c)).join(", ")}`);
        else {
          seen.add(id);
          list.push({ id, name: e.name.trim(), country: e.country.toUpperCase(), currency: e.currency, languages: [...new Set(e.languages as string[])],
            ...(Array.isArray(e.currencies) && e.currencies.every((c) => typeof c === "string" && CURRENCY.test(c)) ? { currencies: [...new Set(e.currencies as string[])] } : {}) });
        }
      }
      if (list.length === (ents as unknown[]).length) out.entities = list;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, shape: out };
}
