/** Create (if needed), save and publish a journey fixture through the Studio API. Usage: tsx scripts/seed-journey.ts <fixture-name> */
import { payBill } from "@finx/journey-schema";

const FIXTURES = { "pay-a-bill": payBill } as const;
const BASE = process.env.STUDIO_URL ?? "http://localhost:3100";
const name = process.argv[2] as keyof typeof FIXTURES;
const journey = FIXTURES[name];
if (!journey) { console.error(`Unknown fixture. Choose one of: ${Object.keys(FIXTURES).join(", ")}`); process.exit(1); }

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const created = await call("POST", "/api/journeys", { name: "Pay a bill" });
  if (![201, 409].includes(created.status)) { console.error("create failed", created); process.exit(1); }
  const saved = await call("PUT", `/api/journeys/${journey.slug}`, { ...journey, version: 0, status: "draft" });
  if (saved.status !== 200) { console.error("save failed", saved); process.exit(1); }
  console.log("saved draft; lint issues:", saved.data.issues?.length ?? 0);
  const pub = await call("POST", `/api/journeys/${journey.slug}/publish`);
  console.log(pub.status === 200 ? `published v${pub.data.version}` : `publish failed: ${JSON.stringify(pub.data)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
