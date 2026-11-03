import { createRole, listRoles } from "@/lib/access";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { ACTION_LABEL } from "@/lib/roles";
import { requireCan } from "@/lib/people";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: Request) { try { return json(req, { roles: await listRoles() }); } catch (e) { return fail(e, req); } }

/** Body: { label, blurb?, actions }. Adds a role of your own (needs the people permission). */
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "people");
    const role = await createRole(await req.json());
    await record({ actor: { id: who.id, name: who.name }, action: "role.create", target: role.label, detail: `Can: ${role.actions.map((a) => ACTION_LABEL[a]).join(", ")}` });
    return json(req, role, 201);
  } catch (e) { return fail(e, req); }
}
