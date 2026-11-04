import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

/**
 * Signed journeys. Studio signs a journey when a person publishes it; an app that has been given the bank's public key(s)
 * refuses a journey whose signature is missing or does not match, and falls back to the copy bundled with the app. A tampered
 * server, proxy or data folder therefore cannot change what customers see. Pure JS (noble), so it runs on phones, browsers and servers.
 *
 * What is signed: "finx-journey-v1\n" + the journey as canonical JSON (keys sorted, no `signature` field).
 * Keys are Ed25519: the private key is 32 random bytes as hex (FINX_SIGNING_KEY, kept only on the server); the public key is
 * 32 bytes as hex, safe to ship in the app. A key's id is the first 16 hex characters of the SHA-256 of its public key.
 */
export type JourneySignature = { alg: "ed25519"; keyId: string; value: string; signedAt: string };

/** JSON with object keys in a fixed order, so the same journey always yields the same bytes. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : canonicalJson(x))).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

const message = (journey: unknown) => {
  const { signature: _drop, ...rest } = (journey ?? {}) as Record<string, unknown>;
  return utf8ToBytes(`finx-journey-v1\n${canonicalJson(rest)}`);
};
const HEX64 = /^[0-9a-f]{64}$/i;

export const publicKeyOf = (privateKeyHex: string) => bytesToHex(ed25519.getPublicKey(hexToBytes(privateKeyHex)));
export const keyIdOf = (publicKeyHex: string) => bytesToHex(sha256(hexToBytes(publicKeyHex))).slice(0, 16);
export function generateKeyPair(): { privateKey: string; publicKey: string; keyId: string } {
  const privateKey = bytesToHex(ed25519.utils.randomPrivateKey()), publicKey = publicKeyOf(privateKey);
  return { privateKey, publicKey, keyId: keyIdOf(publicKey) };
}

export function signJourney(journey: unknown, privateKeyHex: string, now: Date = new Date()): JourneySignature {
  if (!HEX64.test(privateKeyHex)) throw new Error("The signing key must be 64 hex characters");
  return { alg: "ed25519", keyId: keyIdOf(publicKeyOf(privateKeyHex)), value: bytesToHex(ed25519.sign(message(journey), hexToBytes(privateKeyHex))), signedAt: now.toISOString() };
}

/** Reads a comma- or space-separated list of public keys (hex). Anything that is not a 64-character hex key is ignored. */
export function parseTrustedKeys(list: string | undefined | null): string[] {
  return (list ?? "").split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter((s) => HEX64.test(s));
}

export type SignatureCheck = { ok: true; keyId: string } | { ok: false; reason: "unsigned" | "unknown_key" | "bad_signature" };

/** Checks a journey as received (with its `signature` field) against the public keys this app trusts. */
export function verifyJourney(received: unknown, trustedPublicKeys: string[]): SignatureCheck {
  const sig = (received as { signature?: Partial<JourneySignature> } | null)?.signature;
  if (!sig || sig.alg !== "ed25519" || typeof sig.value !== "string" || typeof sig.keyId !== "string") return { ok: false, reason: "unsigned" };
  const key = trustedPublicKeys.find((k) => keyIdOf(k) === sig.keyId);
  if (!key) return { ok: false, reason: "unknown_key" };
  try { return ed25519.verify(hexToBytes(sig.value), message(received), hexToBytes(key)) ? { ok: true, keyId: sig.keyId } : { ok: false, reason: "bad_signature" }; }
  catch { return { ok: false, reason: "bad_signature" }; }
}
