import type { Journey, LintIssue } from "@finx/journey-schema";

export class StudioError extends Error {
  constructor(public status: number, message: string, public issues?: unknown) { super(message); this.name = "StudioError"; }
}

export type JourneySummary = { slug: string; name: unknown; publishedVersion: number | null; draftDiffers: boolean; screens: number; issues: number; updatedAt: string };
export type JourneyRecord = { slug: string; draft: Journey; published?: Journey; history: { version: number; publishedAt: string; by: string }[]; updatedAt: string };
export type RunInput = { id?: string; agent?: string; title?: string; brief?: string; status?: string; summary?: string; journeySlug?: string; note?: string };
export type RunRecord = { id: string; status: string; title: string };
/** A bank app in Studio. Journeys belong to one or more of these. */
export type ProjectSummary = { id: string; name: string; preset: string; currency: string; bundleId: string; journeys: number };

/** Everything the tools need from FinX Studio. The HTTP client implements it; tests use an in-memory one. */
export interface StudioClient {
  readonly baseUrl: string;
  listJourneys(): Promise<JourneySummary[]>;
  getRecord(slug: string): Promise<JourneyRecord>;
  listProjects(): Promise<ProjectSummary[]>;
  createJourney(name: string, project?: string): Promise<JourneyRecord>;
  saveDraft(slug: string, journey: Journey): Promise<void>;
  publish(slug: string): Promise<{ version: number }>;
  reportRun(input: RunInput): Promise<RunRecord>;
}

export class HttpStudioClient implements StudioClient {
  constructor(readonly baseUrl: string, private token?: string, private timeoutMs = 10_000) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method, signal: ctl.signal,
        headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = res.status === 404 && !data.error ? ` ${method} ${path} does not exist on ${this.baseUrl}. Check that this is FinX Studio, and restart it (cd apps/studio && pnpm dev) so it has the latest code.` : "";
        throw new StudioError(res.status, data.error ?? `Studio returned HTTP ${res.status}.${hint}`, data.issues);
      }
      return data as T;
    } catch (e) {
      if (e instanceof StudioError) throw e;
      throw new StudioError(0, `Cannot reach FinX Studio at ${this.baseUrl}. Start it with "cd apps/studio && pnpm dev" or set FINX_STUDIO_URL.`);
    } finally {
      clearTimeout(timer);
    }
  }

  listJourneys() { return this.request<JourneySummary[]>("GET", "/api/journeys"); }
  getRecord(slug: string) { return this.request<JourneyRecord & { issues: LintIssue[] }>("GET", `/api/journeys/${encodeURIComponent(slug)}?env=draft`); }
  async listProjects() { return (await this.request<{ projects: ProjectSummary[] }>("GET", "/api/projects")).projects.map(({ id, name, preset, currency, bundleId, journeys }) => ({ id, name, preset, currency, bundleId, journeys })); }
  createJourney(name: string, project?: string) { return this.request<JourneyRecord>("POST", "/api/journeys", { name, ...(project ? { apps: [project] } : {}) }); }
  async saveDraft(slug: string, journey: Journey) { await this.request("PUT", `/api/journeys/${encodeURIComponent(slug)}`, journey); }
  publish(slug: string) { return this.request<{ version: number }>("POST", `/api/journeys/${encodeURIComponent(slug)}/publish`); }
  reportRun(input: RunInput) { return this.request<RunRecord>("POST", "/api/runs", input); }
}
