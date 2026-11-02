import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as studio } from "../app/api/studio/[...path]/route";
import { GET as theme } from "../app/api/theme/[project]/route";
import { resetProjectsCache } from "./projects";

const call = (path: string[], query = "") => studio(new Request(`http://web/api/studio/${path.join("/")}${query}`), { params: Promise.resolve({ path }) });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.FINX_STUDIO_URL; });

describe("Studio window", () => {
  it("passes on the list of journeys and one published journey, from the address in the environment", async () => {
    process.env.FINX_STUDIO_URL = "http://studio.internal:3100/";
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { seen.push(url); return new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { "content-type": "application/json" } }); }));
    expect((await call(["api", "journeys"])).status).toBe(200);
    const one = await call(["api", "journeys", "pay-a-bill"], "?env=published");
    expect(await one.json()).toEqual({ ok: 1 });
    expect(seen).toEqual(["http://studio.internal:3100/api/journeys", "http://studio.internal:3100/api/journeys/pay-a-bill?env=published"]);
  });

  it("refuses everything else: other paths, drafts, odd slugs, traversal", async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    for (const path of [["api", "projects"], ["api", "runs"], ["api", "journeys", "a", "publish"], ["api", "journeys", "Bad_Slug"], ["api", "journeys", ".."], ["..", "etc"], [""], ["api", "journeys", "x?y"]]) {
      expect((await call(path)).status, path.join("/")).toBe(404);
    }
    expect((await call(["api", "journeys", "pay-a-bill"], "?env=draft")).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers 502 when Studio is down or slow", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const res = await call(["api", "journeys"]);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Studio is not reachable" });
  });
});

describe("theme stylesheet route", () => {
  afterEach(() => resetProjectsCache());
  const get = (project: string) => theme(new Request("http://web/x"), { params: Promise.resolve({ project }) });
  it("serves a bank's colours as CSS, and 404s an unknown bank", async () => {
    const ok = await get("bankworkx");
    expect(ok.headers.get("content-type")).toContain("text/css");
    expect(await ok.text()).toContain(':root[data-brand="bankworkx"]');
    expect((await get("nobank")).status).toBe(404);
    expect((await get("x\"]{}")).status).toBe(404);
  });
});

import { GET as manifest } from "../app/[project]/manifest.webmanifest/route";
import { GET as icon } from "../app/api/icon/[project]/route";
describe("installable app", () => {
  afterEach(() => resetProjectsCache());
  it("gives each bank a manifest with its name, address, colour and icons", async () => {
    const res = await manifest(new Request("http://web/x"), { params: Promise.resolve({ project: "bankworkx" }) });
    expect(res.headers.get("content-type")).toBe("application/manifest+json");
    const m = await res.json();
    expect(m).toMatchObject({ short_name: "BankWorkx", start_url: "/bankworkx/login", scope: "/bankworkx/", display: "standalone", theme_color: "#3155CE" });
    expect(m.icons.map((i: any) => i.purpose)).toEqual(["any", "maskable"]);
    expect((await manifest(new Request("http://web/x"), { params: Promise.resolve({ project: "nobank" }) })).status).toBe(404);
  });
  it("draws an icon in the bank's colour with its first letter, and escapes the name", async () => {
    const svg = await (await icon(new Request("http://web/x"), { params: Promise.resolve({ project: "meezan" }) })).text();
    expect(svg).toContain('fill="#0F6E56"'); expect(svg).toContain(">M</text>");
    const wide = await (await icon(new Request("http://web/x?maskable=1"), { params: Promise.resolve({ project: "meezan" }) })).text();
    expect(wide).toContain('rx="0"');
    expect((await icon(new Request("http://web/x"), { params: Promise.resolve({ project: "nobank" }) })).status).toBe(404);
  });
});
