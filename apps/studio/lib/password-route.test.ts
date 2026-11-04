import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { signSession } from "./session";

const SECRET = "s".repeat(40);
let PUT: typeof import("../app/api/people/[id]/password/route").PUT;
let creds: typeof import("./credentials");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-pw-"));
  process.env.FINX_PROFILE = "production"; process.env.FINX_SESSION_SECRET = SECRET;
  process.env.FINX_STUDIO_ALLOWED_ORIGINS = "https://studio.test";
  ({ PUT } = await import("../app/api/people/[id]/password/route"));
  creds = await import("./credentials");
});
afterEach(() => { for (const k of ["FINX_PROFILE", "FINX_SESSION_SECRET", "FINX_STUDIO_ALLOWED_ORIGINS"]) delete process.env[k]; });

const as = (who: string) => (body: unknown, id: string) => PUT(
  new Request("http://x/api", { method: "PUT", headers: { cookie: `finx.session=${signSession(who, Date.now(), process.env)}`, origin: "https://studio.test", "content-type": "application/json" }, body: JSON.stringify(body) }),
  { params: Promise.resolve({ id }) });

describe("password form API", () => {
  it("lets an admin set someone's first password, without asking for an old one", async () => {
    const res = await as("alex")({ password: "first long password" }, "dana");
    expect(res.status).toBe(200);
    expect(await creds.verifyPassword("dana", "first long password")).toBe(true);
  });
  it("makes you give your current password to change your own, and a new one", async () => {
    await creds.setPassword("dana", "old long password");
    expect((await as("dana")({ password: "brand new password" }, "dana")).status).toBe(403);
    expect((await as("dana")({ current: "wrong long password", password: "brand new password" }, "dana")).status).toBe(403);
    expect((await as("dana")({ current: "old long password", password: "old long password" }, "dana")).status).toBe(400);
    expect((await as("dana")({ current: "old long password", password: "brand new password" }, "dana")).status).toBe(200);
    expect(await creds.verifyPassword("dana", "old long password")).toBe(false);
    expect(await creds.verifyPassword("dana", "brand new password")).toBe(true);
  });
  it("lets an admin reset someone else's password without the old one", async () => {
    await creds.setPassword("dana", "old long password");
    expect((await as("alex")({ password: "reset by an admin" }, "dana")).status).toBe(200);
    expect(await creds.verifyPassword("dana", "reset by an admin")).toBe(true);
  });
  it("refuses someone without the people permission setting another person's password", async () => {
    const res = await as("dana")({ password: "sneaky long password" }, "sam");
    expect(res.status).toBe(403);
    expect(await creds.verifyPassword("sam", "sneaky long password")).toBe(false);
  });
  it("refuses a short password", async () => {
    expect((await as("alex")({ password: "short" }, "dana")).status).toBe(400);
  });
});
