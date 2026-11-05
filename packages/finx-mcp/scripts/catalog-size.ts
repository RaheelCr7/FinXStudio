/** Prints the size of each part of the AI catalog (characters, as finx_get_catalog returns it), largest first, to find what grew.
 *   pnpm --filter @finx/mcp catalog-size */
import { CATALOG_MAX_CHARS, catalogSizes } from "../src/catalog";

const { all, ...sections } = catalogSizes();
for (const [name, size] of Object.entries(sections).sort((a, b) => b[1] - a[1])) console.log(`${String(size).padStart(7)}  ${name}`);
console.log(`${String(all).padStart(7)}  all (limit ${CATALOG_MAX_CHARS})`);
