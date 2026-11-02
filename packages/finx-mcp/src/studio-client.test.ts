import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpStudioClient, StudioError } from "./studio-client";

let server: Server; let base = ""; const seen: Array<{ method?: string; url?: string; auth?: string; body: string }> = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
      if (req.url === "/api/journeys" && req.method === "GET") { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify([{ slug: "a" }])); }
      if (req.url === "/api/journeys/bad" && req.method === "PUT") { res.statusCode = 422; res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ error: "Journey does not match the schema", issues: [{ code: "x" }] })); }
      res.statusCode = 404; res.setHeader("Content-Type", "text/html"); res.end("<!DOCTYPE html><html>not found</html>");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe("HttpStudioClient", () => {
  it("calls the Studio API and sends the bearer token when configured", async () => {
    const c = new HttpStudioClient(`${base}/`, "secret");
    expect(await c.listJourneys()).toEqual([{ slug: "a" }]);
    expect(seen.at(-1)).toMatchObject({ method: "GET", url: "/api/journeys", auth: "Bearer secret" });
  });
  it("turns Studio's JSON errors into StudioError with the issues", async () => {
    const c = new HttpStudioClient(base);
    const e: any = await c.saveDraft("bad", {} as any).catch((x) => x);
    expect(e).toBeInstanceOf(StudioError);
    expect(e).toMatchObject({ status: 422, message: "Journey does not match the schema", issues: [{ code: "x" }] });
  });
  it("explains an HTML 404, which means the endpoint does not exist on that server", async () => {
    const c = new HttpStudioClient(base);
    const e: any = await c.reportRun({ title: "x" }).catch((x) => x);
    expect(e.status).toBe(404);
    expect(e.message).toContain("POST /api/runs does not exist");
    expect(e.message).toContain("restart it");
  });
  it("says how to start Studio when nothing is listening", async () => {
    const e: any = await new HttpStudioClient("http://127.0.0.1:9", undefined, 1500).listJourneys().catch((x) => x);
    expect(e.status).toBe(0);
    expect(e.message).toContain("pnpm dev");
  });
});
