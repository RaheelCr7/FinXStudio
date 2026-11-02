import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The bank apps this repo can build live in one file, shared with the design system and Studio. */
export const BRANDS_FILE = fileURLToPath(new URL("../../../../packages/ui-kit/src/brands.json", import.meta.url));
const APP = fileURLToPath(new URL("../../", import.meta.url));
const load = () => JSON.parse(readFileSync(BRANDS_FILE, "utf8"));

export const brandIds = Object.keys(load());

export function brandConfig(id = "meezan") {
  const b = load()[id];
  if (!b) throw new Error(`Unknown brand "${id}". Use one of: ${Object.keys(load()).join(", ")}`);
  return { id, ...b };
}

/** Makes the app icons for a bank that has none yet (a bank added in Studio), from its accent colour. Needs Python with Pillow. */
export function ensureBrandAssets(brand) {
  const dir = join(APP, brand.assets);
  if (existsSync(join(dir, "icon.png"))) return { made: false };
  const r = spawnSync("python3", [join(APP, "scripts", "generate-brand-assets.py"), "--accent", brand.accent, "--out", dir], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${brand.name} has no icons yet and they could not be made:\n${(r.stderr || r.stdout).trim()}`);
  return { made: true, dir };
}
