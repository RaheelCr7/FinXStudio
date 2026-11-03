import { recordEvents } from "@/lib/analytics";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Players report what happened in a run: `{ events: [...], source: "preview" | "uat" | ... }`. Answers are never part of an event. */
export async function POST(req: Request) {
  const denied = guardWrite(req); if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({})) as { events?: unknown[]; source?: string };
    const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
    return json(req, { recorded: await recordEvents(events, typeof body.source === "string" ? body.source : "preview") });
  } catch (e) { return fail(e, req); }
}
