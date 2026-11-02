import { promises as fs } from "node:fs";
import path from "node:path";

/** Where the list of bank apps lives. Studio reads it on every call so a project added a moment ago is already known. */
export const brandsFile = () => process.env.FINX_BRANDS_FILE ?? path.resolve(process.cwd(), "../../packages/ui-kit/src/brands.json");

export async function appIds(): Promise<string[]> {
  return Object.keys(JSON.parse(await fs.readFile(brandsFile(), "utf8")));
}
