import { createJourney, listJourneys } from "@/lib/store";
import { fail, guardWrite, json, preflight, runIdOf } from "@/lib/http";
import { actorOf, requireCan } from "@/lib/people";
import { isProduction } from "@/lib/profile";
import { nameOf, record } from "@/lib/activity";
import { appsOfJourney } from "@/lib/project-utils";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(req: Request) {
  try {
    const all = await listJourneys();
    // production: a caller who is not signed in (an app) sees published journeys only, never drafts
    const signedIn = !isProduction() || await actorOf(req).then(() => true, () => false);
    return json(req, signedIn ? all : all.filter((j) => j.publishedVersion != null).map((j) => ({ ...j, draftDiffers: false })));
  } catch (e) { return fail(e, req); }
}
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { name, apps } = await req.json();
    const who = await requireCan(req, "edit", Array.isArray(apps) && apps.length ? apps.filter((a): a is string => typeof a === "string") : undefined);
    if (typeof name !== "string" || name.trim().length < 3) return json(req, { error: "Name must be at least 3 characters" }, 400);
    const rec = await createJourney(name.trim(), apps, { id: who.id, name: who.name }, runIdOf(req));
    await record({ actor: { id: who.id, name: who.name }, action: "journey.create", target: nameOf(rec.draft.name), projectIds: appsOfJourney(rec.draft) });
    return json(req, rec, 201);
  } catch (e) { return fail(e, req); }
}
