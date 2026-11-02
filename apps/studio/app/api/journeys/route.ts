import { createJourney, listJourneys } from "@/lib/store";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET() { try { return json(await listJourneys()); } catch (e) { return fail(e); } }
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (typeof name !== "string" || name.trim().length < 3) return json({ error: "Name must be at least 3 characters" }, 400);
    return json(await createJourney(name.trim()), 201);
  } catch (e) { return fail(e); }
}
