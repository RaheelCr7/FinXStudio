/**
 * Create (if needed), save and publish journey fixtures through the Studio API.
 * Usage: tsx scripts/seed-journey.ts <fixture-name | all>   (all = the BankWorkx journeys)
 */
import { addCard, addMoney, connectAccount, createBudget, payBill, type Journey } from "@finx/journey-schema";

const FIXTURES: Record<string, Journey> = {
  "pay-a-bill": payBill, "add-money": addMoney, "add-card": addCard, "connect-account": connectAccount, "create-budget": createBudget,
};
const BASE = process.env.STUDIO_URL ?? "http://localhost:3100";
const arg = process.argv[2] ?? "";
// "all" means the BankWorkx set. Existing journeys such as pay-a-bill are only re-seeded when named, because seeding overwrites their draft.
const BANKWORKX = ["add-money", "add-card", "connect-account", "create-budget"];
const names = arg === "all" ? BANKWORKX : [arg];
if (names.some((n) => !FIXTURES[n])) { console.error(`Unknown fixture. Choose one of: all, ${Object.keys(FIXTURES).join(", ")}`); process.exit(1); }

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function seed(journey: Journey) {
  const display = typeof journey.name === "string" ? journey.name : journey.name.en ?? journey.slug;
  const created = await call("POST", "/api/journeys", { name: display });
  if (![201, 409].includes(created.status)) { console.error(`${journey.slug}: create failed`, created); process.exit(1); }
  const saved = await call("PUT", `/api/journeys/${journey.slug}`, { ...journey, version: 0, status: "draft" });
  if (saved.status !== 200) { console.error(`${journey.slug}: save failed`, saved); process.exit(1); }
  const pub = await call("POST", `/api/journeys/${journey.slug}/publish`);
  console.log(`${journey.slug}: lint issues ${saved.data.issues?.length ?? 0}; ${pub.status === 200 ? `published v${pub.data.version}` : `publish failed: ${JSON.stringify(pub.data)}`}`);
}
(async () => { for (const n of names) await seed(FIXTURES[n]!); })().catch((e) => { console.error(e); process.exit(1); });
