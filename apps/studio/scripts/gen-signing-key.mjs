// Makes a journey signing key pair (Ed25519). Run: node scripts/gen-signing-key.mjs
// The private key goes only in Studio's environment (FINX_SIGNING_KEY). The public key goes into each app (FINX_TRUSTED_KEYS).
import { generateKeyPairSync, createHash } from "node:crypto";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const priv = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32).toString("hex");
const pubBytes = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
console.log(`FINX_SIGNING_KEY=${priv}   # secret: Studio only, never in the repo or an app`);
console.log(`FINX_TRUSTED_KEYS=${pubBytes.toString("hex")}   # public: ship in the apps`);
console.log(`key id: ${createHash("sha256").update(pubBytes).digest("hex").slice(0, 16)}`);
