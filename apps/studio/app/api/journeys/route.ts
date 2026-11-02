import { createJourney, listJourneys } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(req: Request) { try { return json(req, await listJourneys()); } catch (e) { return fail(e, req); } }
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { name, apps } = await req.json();
    if (typeof name !== "string" || name.trim().length < 3) return json(req, { error: "Name must be at least 3 characters" }, 400);
    return json(req, await createJourney(name.trim(), apps), 201);
  } catch (e) { return fail(e, req); }
}
