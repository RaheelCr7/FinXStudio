import { answerQuestion, askQuestion, getRequirement, withReadiness } from "@/lib/requirements";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ id: string }> };

/** Body: { text }. Asks about something missing; the requirement waits for the answer. Claude Code uses this through the FinX tools. */
export async function POST(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { id } = await params;
    const cur = await getRequirement(id);
    const who = await requireCan(req, "edit", cur.projectId ? [cur.projectId] : undefined);
    const body = await req.json().catch(() => ({}));
    const r = await askQuestion(id, body?.text, who.name);
    await record({ actor: { id: who.id, name: who.name }, action: "requirement.ask", target: r.title, detail: r.questions.at(-1)!.text.slice(0, 120), projectIds: r.projectId ? [r.projectId] : undefined });
    return json(req, withReadiness(r), 201);
  } catch (e) { return fail(e, req); }
}

/** Body: { questionId, answer }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { id } = await params;
    const cur = await getRequirement(id);
    const who = await requireCan(req, "edit", cur.projectId ? [cur.projectId] : undefined);
    const body = await req.json().catch(() => ({}));
    const r = await answerQuestion(id, String(body?.questionId ?? ""), body?.answer, who.name);
    await record({ actor: { id: who.id, name: who.name }, action: "requirement.answer", target: r.title, detail: `Answered ${body.questionId}`, projectIds: r.projectId ? [r.projectId] : undefined });
    return json(req, withReadiness(r));
  } catch (e) { return fail(e, req); }
}
