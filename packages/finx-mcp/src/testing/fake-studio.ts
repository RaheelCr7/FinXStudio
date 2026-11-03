import { catalog, catalogEntry, corporatePayment, localTransfer, payBill, validateJourney, type Journey } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { StudioError, type CatalogSummary, type JourneyRecord, type JourneySummary, type ProjectSummary, type RunInput, type RunRecord, type StudioClient } from "../studio-client";
import { SKELETON } from "../catalog";
import { sameContent } from "../advice";

/** An in-memory Studio with the same rules as the real one (schema on save, lint on publish, runs). For tests. */
export class FakeStudio implements StudioClient {
  readonly baseUrl = "http://studio.test";
  records = new Map<string, JourneyRecord>();
  runs = new Map<string, RunRecord & Record<string, unknown>>();
  calls: string[] = [];

  constructor(seed: Array<"fund-transfer-local" | "pay-a-bill" | "corporate-payment"> = ["fund-transfer-local"]) {
    const now = new Date().toISOString();
    for (const name of seed) {
      const j = structuredClone(name === "pay-a-bill" ? payBill : name === "corporate-payment" ? corporatePayment : localTransfer);
      this.records.set(j.slug, { slug: j.slug, draft: structuredClone(j), published: structuredClone(j), history: [{ version: j.version, publishedAt: now, by: "seed" }], updatedAt: now });
    }
  }

  async listJourneys(): Promise<JourneySummary[]> {
    this.calls.push("list");
    return [...this.records.values()].map((r) => ({ slug: r.slug, name: r.draft.name, publishedVersion: r.published?.version ?? null, draftDiffers: !sameContent(r.draft, r.published), screens: r.draft.screens.length, issues: lintAll(r.draft).length, updatedAt: r.updatedAt }));
  }
  async getRecord(slug: string) {
    this.calls.push(`get ${slug}`);
    const r = this.records.get(slug);
    if (!r) throw new StudioError(404, "Journey not found");
    return structuredClone(r);
  }
  projects: ProjectSummary[] = [
    { id: "meezan", name: "Meezan Digital", preset: "meezan", currency: "PKR", bundleId: "pk.meezan.digital", journeys: 1 },
    { id: "bankworkx", name: "BankWorkx", preset: "bankworkx", currency: "USD", bundleId: "com.bankworkx.app", journeys: 0 },
  ];
  async listCatalog(project = "meezan"): Promise<CatalogSummary[]> {
    this.calls.push(`catalog ${project}`);
    return catalog.map((e) => ({
      id: e.id, name: String(e.journey.name), category: e.category, summary: e.summary, highlights: e.highlights, screens: e.journey.screens.length,
      languages: e.journey.locale.supported, currencies: [], madeFor: e.madeFor, added: this.records.has(`${e.id}-${project}`) ? `${e.id}-${project}` : null,
    }));
  }
  async addFromCatalog(id: string, project: string) {
    this.calls.push(`add ${id} to ${project}`);
    const entry = catalogEntry(id);
    if (!entry) throw new StudioError(404, `No catalog journey called ${id}`);
    if (!this.projects.some((p) => p.id === project)) throw new StudioError(404, `No project called ${project}`);
    const slug = `${id}-${project}`;
    if (this.records.has(slug)) throw new StudioError(409, `This project already has it: ${slug}`);
    this.records.set(slug, { slug, draft: { ...structuredClone(entry.journey), slug, id: `jrn_${slug.replace(/-/g, "_")}`, version: 0, status: "draft", apps: [project] }, history: [], updatedAt: new Date().toISOString() });
    return { slug };
  }
  async listProjects() { this.calls.push("projects"); return structuredClone(this.projects); }
  async createJourney(name: string, project?: string) {
    this.calls.push(`create ${name}${project ? ` in ${project}` : ""}`);
    if (project && !this.projects.some((p) => p.id === project)) throw new StudioError(400, `Unknown app ${project}`);
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (this.records.has(slug)) throw new StudioError(409, "A journey with this name already exists");
    const draft = { ...structuredClone(SKELETON), id: `jrn_${slug.replace(/-/g, "_")}`, slug, name, ...(project ? { apps: [project] } : {}) } as unknown as Journey;
    const rec: JourneyRecord = { slug, draft, history: [], updatedAt: new Date().toISOString() };
    this.records.set(slug, rec);
    return structuredClone(rec);
  }
  async saveDraft(slug: string, journey: Journey) {
    this.calls.push(`save ${slug}`);
    const r = this.records.get(slug);
    if (!r) throw new StudioError(404, "Journey not found");
    const v = validateJourney(journey);
    if (!v.ok) throw new StudioError(422, v.errors.join("; "));
    if (v.journey.slug !== slug) throw new StudioError(422, "Slug cannot be changed");
    r.draft = { ...v.journey, status: "draft" };
    r.updatedAt = new Date().toISOString();
  }
  async publish(slug: string) {
    this.calls.push(`publish ${slug}`);
    const r = this.records.get(slug);
    if (!r) throw new StudioError(404, "Journey not found");
    const issues = lintAll(r.draft);
    if (issues.length) throw new StudioError(422, `Cannot publish: ${issues.length} lint issue(s)`, issues);
    const version = (r.published?.version ?? 0) + 1;
    r.published = { ...structuredClone(r.draft), version, status: "published" };
    r.draft = structuredClone(r.published);
    r.history.push({ version, publishedAt: new Date().toISOString(), by: "fake" });
    return { version };
  }
  async reportRun(input: RunInput) {
    this.calls.push(`run ${input.id ?? "new"} ${input.status ?? ""}`.trim());
    if (input.id) {
      const run = this.runs.get(input.id);
      if (!run) throw new StudioError(404, "Run not found");
      Object.assign(run, Object.fromEntries(Object.entries(input).filter(([k, v]) => v !== undefined && k !== "id" && k !== "note")));
      if (input.note) (run.steps as string[]).push(input.note);
      return run as RunRecord;
    }
    const { id: _id, note: _note, ...fields } = input;
    const run = { ...fields, id: `run_${this.runs.size + 1}`, status: input.status ?? "running", title: input.title ?? "", steps: input.note ? [input.note] : ["Started"] } as RunRecord & Record<string, unknown>;
    this.runs.set(run.id, run);
    return run as RunRecord;
  }
}
