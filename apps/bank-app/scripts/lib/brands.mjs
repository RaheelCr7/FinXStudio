import { readFileSync } from "node:fs";

const BRANDS = JSON.parse(readFileSync(new URL("../../brands.json", import.meta.url), "utf8"));

/** The bank apps this repo can build. Names, ids and colours live in brands.json, which app.config.ts also reads. */
export const brandIds = Object.keys(BRANDS);

export function brandConfig(id = "meezan") {
  const b = BRANDS[id];
  if (!b) throw new Error(`Unknown brand "${id}". Use one of: ${brandIds.join(", ")}`);
  return { id, ...b };
}
