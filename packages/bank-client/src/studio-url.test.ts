import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { checkStudio, normalizeStudioUrl } from "./studio-url";

describe("normalizeStudioUrl", () => {
  it("adds http, trims, and removes trailing slashes", () => {
    expect(normalizeStudioUrl("  192.168.1.20:3100/ ")).toEqual({ ok: true, url: "http://192.168.1.20:3100" });
    expect(normalizeStudioUrl("http://10.0.2.2:3100///")).toEqual({ ok: true, url: "http://10.0.2.2:3100" });
    expect(normalizeStudioUrl("https://studio.bank.example")).toEqual({ ok: true, url: "https://studio.bank.example" });
    expect(normalizeStudioUrl("HTTP://Localhost:3100")).toEqual({ ok: true, url: "http://localhost:3100" });
  });
  it("keeps a path prefix when Studio sits behind one", () => {
    expect(normalizeStudioUrl("https://bank.example/studio/")).toEqual({ ok: true, url: "https://bank.example/studio" });
  });
  it("refuses empty input, spaces, other schemes, credentials and nonsense", () => {
    for (const bad of ["", "   ", "my studio", "ftp://x.example", "javascript:alert(1)", "file:///etc/passwd", "http://user:pw@host:3100", "http://", "://"]) {
      const r = normalizeStudioUrl(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(10);
    }
  });
});

describe("checkStudio", () => {
  let server: Server; let base = "";
  beforeAll(async () => {
    server = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/journeys") return void res.end(JSON.stringify([{ slug: "a", publishedVersion: 1 }, { slug: "b", publishedVersion: null }, { slug: "c", publishedVersion: 3 }]));
      res.statusCode = 404; res.end("{}");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("counts the published journeys of a real Studio", async () => {
    expect(await checkStudio(base)).toEqual({ ok: true, journeys: 2 });
  });
  it("recognises a server that is not Studio", async () => {
    const r = await checkStudio(`${base}/nope`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Is this FinX Studio?");
  });
  it("explains an unreachable server with what to check", async () => {
    const r = await checkStudio("http://127.0.0.1:9", 1500);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error).toContain("could not be reached"); expect(r.error).toContain("same Wi-Fi"); }
  });
});
