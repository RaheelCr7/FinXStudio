import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateKeyPair, verifyJourney } from "@finx/journey-schema";

const KEY = generateKeyPair();
let store: typeof import("./store");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-sign-"));
  store = await import("./store");
});
afterEach(() => { delete process.env.FINX_SIGNING_KEY; delete process.env.FINX_PROFILE; });

describe("signing on publish", () => {
  it("signs what a person publishes, and the signature checks out against the public key", async () => {
    process.env.FINX_SIGNING_KEY = KEY.privateKey;
    const rec = await store.publish("fund-transfer-local", "alex");
    expect(rec.publishedSignature).toMatchObject({ alg: "ed25519", keyId: KEY.keyId });
    const served = JSON.parse(JSON.stringify({ ...rec.published, signature: rec.publishedSignature }));
    expect(verifyJourney(served, [KEY.publicKey]).ok).toBe(true);
    served.screens[0].title = "changed on the server";
    expect(verifyJourney(served, [KEY.publicKey]).ok).toBe(false);
  });
  it("signs again for each new version, so an old signature does not fit a new journey", async () => {
    process.env.FINX_SIGNING_KEY = KEY.privateKey;
    const a = await store.publish("fund-transfer-local", "alex");
    const sigA = a.publishedSignature!.value;
    const b = await store.publish("fund-transfer-local", "alex");
    expect(b.publishedSignature!.value).not.toBe(sigA);
    expect(verifyJourney({ ...b.published, signature: a.publishedSignature }, [KEY.publicKey]).ok).toBe(false);
  });
  it("publishes unsigned in the demo when no key is set", async () => {
    const rec = await store.publish("fund-transfer-local", "alex");
    expect(rec.publishedSignature).toBeUndefined();
  });
  it("refuses to publish in production without a key, and leaves the journey as it was", async () => {
    process.env.FINX_PROFILE = "production";
    await expect(store.publish("fund-transfer-local", "alex")).rejects.toMatchObject({ status: 409 });
    expect((await store.getRecord("fund-transfer-local")).published?.version).toBe(5);
    process.env.FINX_SIGNING_KEY = "not a key";
    await expect(store.publish("fund-transfer-local", "alex")).rejects.toMatchObject({ status: 409 });
  });
});
