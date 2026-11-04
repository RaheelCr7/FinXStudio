import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { signSession, verifySession, cookieValue, anonymousMayCall } from "./session";
import { RateLimiter, bodyTooLarge, loginFailures } from "./limits";
import { securityHeaders } from "./security-headers";

const SECRET = "s".repeat(40), TOKEN = "t".repeat(40);
const env = { FINX_SESSION_SECRET: SECRET };

describe("signed sessions", () => {
  it("round-trips, and refuses a forged, edited, expired or foreign token", () => {
    const t = signSession("alex", 1000, env);
    expect(verifySession(t, 2000, env)).toBe("alex");
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "alex", exp: 9e15 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, 2000, env)).toBeNull();
    expect(verifySession(`${payload}.${sig}x`, 2000, env)).toBeNull();
    expect(verifySession(t, 1000 + 9 * 3_600_000, env)).toBeNull();
    expect(verifySession(t, 2000, { FINX_SESSION_SECRET: "o".repeat(40) } as Record<string, string>)).toBeNull();
    expect(verifySession(undefined, 0, env)).toBeNull();
    expect(verifySession("a.b.c", 0, env)).toBeNull();
  });
  it("will not run with a short secret", () => {
    expect(() => signSession("alex", 0, { FINX_SESSION_SECRET: "short" } as Record<string, string>)).toThrow(/32 characters/);
  });
  it("reads a cookie by name", () => expect(cookieValue("a=1; finx.session=x%2By; b=2", "finx.session")).toBe("x+y"));
});

describe("what a visitor who is not signed in may call", () => {
  const ok = (m: string, p: string, q = "") => anonymousMayCall(m, p, new URLSearchParams(q));
  it("allows sign-in and the reads apps need", () => {
    expect(ok("POST", "/api/auth/login")).toBe(true);
    expect(ok("GET", "/api/projects")).toBe(true);
    expect(ok("GET", "/api/journeys")).toBe(true);
    expect(ok("GET", "/api/journeys/send-money")).toBe(true);
    expect(ok("GET", "/api/journeys/send-money", "env=published")).toBe(true);
  });
  it("refuses drafts, writes and everything else", () => {
    expect(ok("GET", "/api/journeys/send-money", "env=draft")).toBe(false);
    expect(ok("PUT", "/api/journeys/send-money")).toBe(false);
    expect(ok("POST", "/api/journeys")).toBe(false);
    expect(ok("GET", "/api/people")).toBe(false);
    expect(ok("GET", "/api/audit")).toBe(false);
    expect(ok("GET", "/api/activity")).toBe(false);
    expect(ok("GET", "/api/journeys/send-money/analytics")).toBe(false);
    expect(ok("GET", "/api/analytics")).toBe(false);
  });
});

describe("limits and headers", () => {
  it("allows the first N calls in a window and then refuses until it ends", () => {
    const r = new RateLimiter(2, 1000);
    expect([r.take("k", 0), r.take("k", 1), r.take("k", 2), r.take("k", 1001)]).toEqual([true, true, false, true]);
  });
  it("blocks after the failures allowed, and a sign-in clears it", () => {
    const k = "1.2.3.4|alex";
    for (let i = 0; i < 5; i++) { expect(loginFailures.isBlocked(k)).toBe(false); loginFailures.take(k); }
    expect(loginFailures.isBlocked(k)).toBe(true);
    loginFailures.reset(k);
    expect(loginFailures.isBlocked(k)).toBe(false);
  });
  it("refuses oversized or unreadable lengths", () => {
    expect(bodyTooLarge("100")).toBe(false);
    expect(bodyTooLarge(String(3 * 1024 * 1024))).toBe(true);
    expect(bodyTooLarge("abc")).toBe(true);
    expect(bodyTooLarge(null)).toBe(false);
  });
  it("sets the headers a bank test looks for", () => {
    const h = securityHeaders();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Content-Security-Policy-Report-Only"]).toContain("frame-ancestors 'none'");
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
  });
});

describe("production profile", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "finx-prod-"));
    process.env.FINX_DATA_DIR = dir; process.env.FINX_PROFILE = "production";
    process.env.FINX_SESSION_SECRET = SECRET; process.env.FINX_SERVICE_TOKEN = TOKEN; process.env.FINX_SERVICE_PERSON = "sam";
  });
  afterEach(() => { for (const k of ["FINX_PROFILE", "FINX_SESSION_SECRET", "FINX_SERVICE_TOKEN", "FINX_SERVICE_PERSON"]) delete process.env[k]; });
  const req = (h: Record<string, string> = {}) => new Request("http://x/api", { headers: h });

  it("does not accept the demo cookie, only a signed session", async () => {
    const { actorOf } = await import("./people");
    await expect(actorOf(req({ cookie: "finx.user=alex" }))).rejects.toMatchObject({ status: 401 });
    await expect(actorOf(req())).rejects.toMatchObject({ status: 401 });
    await expect(actorOf(req({ cookie: `finx.session=${signSession("alex", Date.now(), process.env)}` }))).resolves.toMatchObject({ id: "alex" });
    await expect(actorOf(req({ cookie: `finx.session=${signSession("ghost", Date.now(), process.env)}` }))).rejects.toMatchObject({ status: 401 });
  });
  it("lets the service token act as its person, but never publish", async () => {
    const { actorOf, requireCan } = await import("./people");
    const h = { authorization: `Bearer ${TOKEN}` };
    await expect(actorOf(req(h))).resolves.toMatchObject({ id: "sam" });
    await expect(actorOf(req({ authorization: `Bearer ${"x".repeat(40)}` }))).rejects.toMatchObject({ status: 401 });
    await expect(requireCan(req(h), "edit")).resolves.toMatchObject({ id: "sam" });
    await expect(requireCan(req(h), "publish")).rejects.toMatchObject({ status: 403 });
  });
  it("needs an Origin on a browser write and only the listed origins", async () => {
    const { guardWrite } = await import("./http");
    const cookie = `finx.session=x`;
    expect(guardWrite(req({ cookie }))?.status).toBe(403);
    expect(guardWrite(req({ cookie, origin: "http://localhost:3100" }))?.status).toBe(403);
    process.env.FINX_STUDIO_ALLOWED_ORIGINS = "https://studio.bank.example";
    expect(guardWrite(req({ cookie, origin: "https://studio.bank.example" }))).toBeNull();
    delete process.env.FINX_STUDIO_ALLOWED_ORIGINS;
  });
  it("makes four-eyes the default for a project nobody configured", async () => {
    const { selfPublishFor } = await import("./access");
    expect(await selfPublishFor(["meezan"])).toBe("never");
    delete process.env.FINX_PROFILE;
    expect(await selfPublishFor(["meezan"])).toBe("admin");
  });
  it("hashes passwords and checks them", async () => {
    const c = await import("./credentials");
    await c.setPassword("alex", "correct horse battery");
    expect(readFileSync(path.join(dir, "credentials.json"), "utf8")).not.toContain("correct horse");
    expect(await c.verifyPassword("alex", "correct horse battery")).toBe(true);
    expect(await c.verifyPassword("alex", "wrong horse battery!")).toBe(false);
    expect(await c.verifyPassword("nobody", "correct horse battery")).toBe(false);
    await expect(c.setPassword("alex", "short")).rejects.toMatchObject({ status: 400 });
  });
  it("chains the audit log and notices an edited or removed line", async () => {
    const a = await import("./audit");
    await a.appendAudit({ actor: "alex", action: "journey.publish", target: "Send money" });
    await a.appendAudit({ actor: "alex", action: "person.role", target: "Dana" });
    await a.appendAudit({ actor: "dana", action: "auth.login", target: "sign-in" });
    expect(await a.verifyAudit()).toEqual({ ok: true, entries: 3 });
    const f = path.join(dir, "audit.log"), lines = readFileSync(f, "utf8").trimEnd().split("\n");
    writeFileSync(f, [lines[0], lines[1]!.replace("Dana", "Mallory"), lines[2]].join("\n") + "\n");
    expect(await a.verifyAudit()).toEqual({ ok: false, brokenAt: 2 });
    writeFileSync(f, [lines[0], lines[2]].join("\n") + "\n");
    expect(await a.verifyAudit()).toEqual({ ok: false, brokenAt: 2 });
  });
  it("copies every activity entry into the audit log", async () => {
    const { record } = await import("./activity");
    const a = await import("./audit");
    await record({ actor: { id: "alex", name: "Alex" }, action: "journey.publish", target: "Send money", detail: "v3" });
    expect((await a.listAudit())[0]).toMatchObject({ actor: "alex", action: "journey.publish", detail: "v3" });
    expect(await a.verifyAudit()).toMatchObject({ ok: true, entries: 1 });
  });
});
