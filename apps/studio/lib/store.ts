import { promises as fs } from "node:fs";
import path from "node:path";
import { Journey, lintJourney, localTransfer, type LintIssue } from "@finx/journey-schema";
import { sameContent } from "./edit";

export type HistoryEntry = { version: number; publishedAt: string; by: string };
export type JourneyRecord = { slug: string; draft: Journey; published?: Journey; history: HistoryEntry[]; updatedAt: string };
type Db = { journeys: Record<string, JourneyRecord> };

const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "journeys.json");
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

async function read(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(file(), "utf8")) as Db;
  } catch {
    const now = new Date().toISOString();
    const db: Db = {
      journeys: {
        [localTransfer.slug]: {
          slug: localTransfer.slug,
          draft: structuredClone(localTransfer),
          published: structuredClone(localTransfer),
          history: [{ version: localTransfer.version, publishedAt: now, by: "seed" }],
          updatedAt: now,
        },
      },
    };
    await write(db);
    return db;
  }
}
async function write(db: Db) {
  await fs.mkdir(path.dirname(file()), { recursive: true });
  await fs.writeFile(file(), JSON.stringify(db, null, 2));
}

export class StoreError extends Error {
  constructor(public status: number, message: string, public issues?: LintIssue[]) { super(message); }
}
export const assertSlug = (slug: string) => { if (!SLUG.test(slug)) throw new StoreError(400, "Invalid journey slug"); };

export async function listJourneys() {
  const db = await read();
  return Object.values(db.journeys).map((r) => ({
    slug: r.slug,
    name: r.draft.name,
    publishedVersion: r.published?.version ?? null,
    draftDiffers: !sameContent(r.draft, r.published),
    screens: r.draft.screens.length,
    channels: r.draft.channels,
    updatedAt: r.updatedAt,
    issues: lintJourney(r.draft).length,
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRecord(slug: string): Promise<JourneyRecord> {
  assertSlug(slug);
  const r = (await read()).journeys[slug];
  if (!r) throw new StoreError(404, "Journey not found");
  return r;
}

export async function saveDraft(slug: string, body: unknown) {
  assertSlug(slug);
  const parsed = Journey.safeParse(body);
  if (!parsed.success) throw new StoreError(422, "Journey does not match the schema: " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
  if (parsed.data.slug !== slug) throw new StoreError(422, "Slug cannot be changed");
  const db = await read();
  const rec = db.journeys[slug];
  if (!rec) throw new StoreError(404, "Journey not found");
  rec.draft = { ...parsed.data, status: "draft" };
  rec.updatedAt = new Date().toISOString();
  await write(db);
  return { record: rec, issues: lintJourney(rec.draft) };
}

export async function publish(slug: string, by = "studio") {
  assertSlug(slug);
  const db = await read();
  const rec = db.journeys[slug];
  if (!rec) throw new StoreError(404, "Journey not found");
  const issues = lintJourney(rec.draft);
  if (issues.length) throw new StoreError(422, `Cannot publish: ${issues.length} lint issue(s)`, issues);
  const version = (rec.published?.version ?? 0) + 1;
  rec.published = { ...structuredClone(rec.draft), version, status: "published" };
  rec.draft = structuredClone(rec.published);
  rec.history.push({ version, publishedAt: new Date().toISOString(), by });
  rec.updatedAt = new Date().toISOString();
  await write(db);
  return rec;
}

export async function createJourney(name: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  assertSlug(slug || "x");
  const db = await read();
  if (db.journeys[slug]) throw new StoreError(409, "A journey with this name already exists");
  const j: Journey = {
    id: `jrn_${slug.replace(/-/g, "_")}`, slug, name, version: 0, status: "draft", channels: ["web", "mobile"],
    locale: { default: "en", supported: ["en", "ur"], rtl: ["ur"] }, entryScreen: "welcome", integrations: [],
    screens: [
      { id: "welcome", title: name, blocks: [
        { type: "text", variant: "title", text: name },
        { type: "text", text: "Describe this step for your customer." },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "navigate", to: "done" }] },
      ] },
      { id: "done", title: "Done", kind: "terminal", blocks: [
        { type: "result", tone: "success", title: "All done" },
        { type: "button", label: "Close", variant: "primary", actions: [{ type: "exit" }] },
      ] },
    ],
  };
  const now = new Date().toISOString();
  db.journeys[slug] = { slug, draft: j, history: [], updatedAt: now };
  await write(db);
  return db.journeys[slug]!;
}
