import { describe, it, expect } from "vitest";
import { canonicalJson, generateKeyPair, keyIdOf, parseTrustedKeys, signJourney, verifyJourney } from "./signing";
import { localTransfer } from "./index";

const A = generateKeyPair(), B = generateKeyPair();
const signed = (j: unknown = localTransfer, k = A.privateKey) => ({ ...(j as object), signature: signJourney(j, k) });

describe("canonical JSON", () => {
  it("does not depend on key order or undefined fields", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe(canonicalJson({ a: { c: undefined, d: [1, { y: 2, z: 1 }] }, b: 1 }));
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });
});

describe("signed journeys", () => {
  it("verifies a journey signed by a trusted key, even after a JSON round trip with keys reordered", () => {
    const s = signed();
    expect(verifyJourney(s, [A.publicKey])).toEqual({ ok: true, keyId: A.keyId });
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(s).reverse())));
    expect(verifyJourney(reordered, [A.publicKey]).ok).toBe(true);
  });
  it("refuses any change to the journey", () => {
    const s: any = structuredClone(signed());
    s.screens[0].title = "Send all your money to me";
    expect(verifyJourney(s, [A.publicKey])).toEqual({ ok: false, reason: "bad_signature" });
    const t: any = structuredClone(signed()); t.version += 1;
    expect(verifyJourney(t, [A.publicKey])).toEqual({ ok: false, reason: "bad_signature" });
    const u: any = structuredClone(signed()); u.integrations[0].mode = "live";
    expect(verifyJourney(u, [A.publicKey]).ok).toBe(false);
  });
  it("refuses unsigned journeys, unknown keys and a signature copied from another journey", () => {
    expect(verifyJourney(localTransfer, [A.publicKey])).toEqual({ ok: false, reason: "unsigned" });
    expect(verifyJourney(signed(localTransfer, B.privateKey), [A.publicKey])).toEqual({ ok: false, reason: "unknown_key" });
    const other = { ...structuredClone(localTransfer), slug: "other", signature: signJourney(localTransfer, A.privateKey) };
    expect(verifyJourney(other, [A.publicKey]).ok).toBe(false);
    expect(verifyJourney({ ...signed(), signature: { ...signed().signature, value: "00" } }, [A.publicKey]).ok).toBe(false);
  });
  it("trusts several keys, so a key can be rotated", () => {
    expect(verifyJourney(signed(localTransfer, B.privateKey), [A.publicKey, B.publicKey]).ok).toBe(true);
  });
  it("parses a list of keys and ignores junk", () => {
    expect(parseTrustedKeys(` ${A.publicKey.toUpperCase()}, nope ,${B.publicKey}`)).toEqual([A.publicKey, B.publicKey]);
    expect(parseTrustedKeys(undefined)).toEqual([]);
    expect(keyIdOf(A.publicKey)).toBe(A.keyId);
  });
  it("will not sign with a malformed key", () => expect(() => signJourney(localTransfer, "abc")).toThrow(/64 hex/));
});
