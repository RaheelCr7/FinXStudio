import { describe, expect, it } from "vitest";
import { localTransfer } from "@finx/journey-schema";
import { createLive, forBrand, slugIs } from "./live";
import { resolveBrandId } from "./brand";

const json = (body: unknown, ok = true) => (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

describe("journeys over the air", () => {
  it("lists the published journeys of this bank from Studio", async () => {
    const live = createLive({ brand: "meezan", fetch: json([
      { slug: "fund-transfer-local", name: "Send", publishedVersion: 5 }, { slug: "draft-one", name: "Draft", publishedVersion: null },
      { slug: "add-money", name: "Add money", publishedVersion: 1, apps: ["bankworkx"] },
    ]) });
    expect(await live.loadCatalog("http://studio")).toEqual({ source: "studio", entries: [{ slug: "fund-transfer-local", name: "Send", version: 5 }] });
  });

  it("falls back to the bundled copies when Studio is down, and only shows this bank's", async () => {
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const meezan = await createLive({ brand: "meezan", fetch: down }).loadCatalog("http://x");
    expect(meezan.source).toBe("bundled");
    expect(meezan.entries.map((e) => e.slug).sort()).toEqual(["fund-transfer-local", "pay-a-bill"]);
    const bw = await createLive({ brand: "bankworkx", fetch: down }).loadCatalog("http://x");
    expect(bw.entries.map((e) => e.slug)).toContain("invest");
    expect(bw.entries.map((e) => e.slug)).not.toContain("pay-a-bill");
  });

  it("loads a valid published journey, and refuses one that does not validate or lint", async () => {
    expect((await createLive({ brand: "meezan", fetch: json(localTransfer) }).loadJourney("http://x", "fund-transfer-local"))!.source).toBe("studio");
    const broken = { ...localTransfer, entryScreen: "nowhere" };
    const r = await createLive({ brand: "meezan", fetch: json(broken) }).loadJourney("http://x", "fund-transfer-local");
    expect(r!.source).toBe("bundled");
    expect(await createLive({ brand: "meezan", fetch: json({}, false) }).loadJourney("http://x", "no-such-journey")).toBeNull();
  });

  it("matches copied journeys and defaults to Meezan", () => {
    expect(slugIs("add-money-acme", "add-money")).toBe(true);
    expect(forBrand("meezan")({})).toBe(true);
    expect(forBrand("bankworkx")({})).toBe(false);
    expect(forBrand("bankworkx")({ apps: ["bankworkx"] })).toBe(true);
    expect(resolveBrandId("bankworkx")).toBe("bankworkx");
    expect(resolveBrandId("unknown")).toBe("meezan");
    expect(resolveBrandId(undefined)).toBe("meezan");
  });
});
