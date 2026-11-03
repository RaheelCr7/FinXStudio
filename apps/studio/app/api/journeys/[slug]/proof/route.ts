import { runScenarios, mutationCheck } from "@finx/mcp/proof";
import { PROVIDERS } from "@finx/mock-bank-api";
import { getRecord } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Runs the draft's own scenarios on every corporate bank API, and (when asked) the mutation check. Nothing is saved. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const denied = guardWrite(req); if (denied) return denied;
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => ({})) as { mutation?: boolean };
    const { draft } = await getRecord(slug);
    const banks = Object.fromEntries(await Promise.all(PROVIDERS.map(async (p) => [p, await runScenarios(draft, { provider: p })] as const)));
    return json(req, { banks, mutation: body.mutation ? await mutationCheck(draft) : null });
  } catch (e) { return fail(e, req); }
}
