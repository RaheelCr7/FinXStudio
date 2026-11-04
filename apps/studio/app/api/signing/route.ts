import { publicKeyOf, keyIdOf } from "@finx/journey-schema";
import { fail, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Which key Studio signs with (public half and id only), for checking that the apps trust the right one. Admins only. */
export async function GET(req: Request) {
  try {
    await requireCan(req, "people");
    const k = process.env.FINX_SIGNING_KEY?.trim();
    if (!k) return json(req, { signing: false });
    const publicKey = publicKeyOf(k);
    return json(req, { signing: true, alg: "ed25519", keyId: keyIdOf(publicKey), publicKey });
  } catch (e) { return fail(e, req); }
}
