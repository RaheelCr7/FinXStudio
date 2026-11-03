/**
 * A narrow window onto FinX Studio for the browser. The app asks its own address, and the server asks Studio, so the browser never
 * talks to Studio directly (no cross-origin rules to bend, and the Studio address stays on the server).
 * Only reading published journeys is allowed; the Studio address comes from the environment, never from the request.
 */
const STUDIO = () => (process.env.FINX_STUDIO_URL ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
const ALLOWED = /^api\/journeys(?:\/[a-z0-9][a-z0-9-]{0,62})?$/;

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!ALLOWED.test(path)) return Response.json({ error: "Not available" }, { status: 404 });
  const env = new URL(req.url).searchParams.get("env");
  if (env !== null && env !== "published") return Response.json({ error: "Only published journeys are available" }, { status: 400 });
  try {
    const res = await fetch(`${STUDIO()}/${path}${env ? "?env=published" : ""}`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { "Content-Type": res.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Studio is not reachable" }, { status: 502 });
  }
}
