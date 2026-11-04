#!/usr/bin/env node
// Looks for the sandbox bank in a built bundle. Usage: node scripts/audit-bundle.mjs <folder> [--strict]
// The sandbox carries a fixed marker string (SANDBOX_MARKER in packages/mock-bank-api/src/policy.ts). A bundle that contains it
// contains the sandbox. Without --strict this only reports (exit 0); with --strict a hit fails (exit 1), which is what a production
// release of a bank connected to a real API must pass.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MARKER = "finx-sandbox-bank: never ship in a production build";
const [dir, ...flags] = process.argv.slice(2);
if (!dir) { console.error("Usage: node scripts/audit-bundle.mjs <folder> [--strict]"); process.exit(2); }

const hits = [];
let scanned = 0;
(function walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name), st = statSync(p);
    if (st.isDirectory()) { if (name !== "node_modules") walk(p); continue; }
    if (!/\.(js|mjs|cjs|hbc|bundle|html|json|map)$/.test(name) || st.size > 60_000_000) continue;
    scanned++;
    if (readFileSync(p).includes(MARKER)) hits.push(p);
  }
})(dir);

console.log(`Scanned ${scanned} files in ${dir}.`);
if (!hits.length) { console.log("The sandbox bank is not in this bundle."); process.exit(0); }
console.log(`The sandbox bank IS in this bundle (${hits.length} files):`);
for (const h of hits.slice(0, 10)) console.log(`  ${h}`);
if (flags.includes("--strict")) { console.error("Failing: a production release must not contain the sandbox."); process.exit(1); }
console.log("Report only. Pass --strict to fail on this.");
