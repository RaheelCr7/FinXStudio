/** Pure helpers for the Studio server address. No React Native imports, so they are easy to test. */

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Turns what a person typed into a clean base URL, or explains what is wrong. */
export function normalizeStudioUrl(input: string): UrlCheck {
  let text = input.trim();
  if (!text) return { ok: false, error: "Enter the address of your Studio, for example 192.168.1.20:3100" };
  if (/\s/.test(text)) return { ok: false, error: "The address cannot contain spaces" };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `http://${text}`;
  let u: URL;
  try { u = new URL(text); } catch { return { ok: false, error: "That does not look like a web address" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Use an http:// or https:// address" };
  if (u.username || u.password) return { ok: false, error: "Do not put a user name or password in the address" };
  if (!u.hostname) return { ok: false, error: "The address needs a host name or IP address" };
  return { ok: true, url: `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}` };
}

export type StudioCheck = { ok: true; journeys: number } | { ok: false; error: string };

/** Asks the server for its journeys, to confirm it really is a FinX Studio and that the phone can reach it. */
export async function checkStudio(baseUrl: string, timeoutMs = 4000): Promise<StudioCheck> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/journeys`, { signal: ctl.signal });
    if (!res.ok) return { ok: false, error: `The server answered with an error (${res.status}). Is this FinX Studio?` };
    const body = await res.json().catch(() => null);
    if (!Array.isArray(body)) return { ok: false, error: "The server answered, but it does not look like FinX Studio" };
    return { ok: true, journeys: body.filter((j: any) => j && j.publishedVersion != null).length };
  } catch (e: any) {
    const reason = e?.name === "AbortError" ? "It took too long to answer." : "It could not be reached.";
    return { ok: false, error: `${reason} Check the address, that Studio is running (pnpm dev:lan on a laptop), and that this phone is on the same Wi-Fi.` };
  } finally {
    clearTimeout(timer);
  }
}
