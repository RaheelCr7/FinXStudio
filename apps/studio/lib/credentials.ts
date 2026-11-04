import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { StoreError } from "./store";

/** Passwords for the production profile: scrypt hashes in credentials.json, kept apart from people.json. Never returned by any API. */
const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "credentials.json");
export const MIN_PASSWORD = 12;
const COST = 16384;

const derive = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) => scrypt(pw, salt, 32, { N: COST }, (e, k) => (e ? rej(e) : res(k))));
async function read(): Promise<Record<string, string>> { try { return JSON.parse(await fs.readFile(file(), "utf8")); } catch { return {}; } }

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${COST}$${salt.toString("base64url")}$${(await derive(pw, salt)).toString("base64url")}`;
}
export async function checkHash(pw: string, stored: string | undefined): Promise<boolean> {
  // an unknown person costs the same time as a wrong password
  const [alg, , s, h] = (stored ?? "scrypt$0$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").split("$");
  const want = Buffer.from(h ?? "", "base64url"), got = await derive(pw, Buffer.from(s ?? "", "base64url"));
  return Boolean(stored) && alg === "scrypt" && want.length === got.length && timingSafeEqual(want, got);
}

export async function setPassword(personId: string, pw: unknown): Promise<void> {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD || pw.length > 200) throw new StoreError(400, `A password must be ${MIN_PASSWORD} to 200 characters`);
  const all = await read();
  all[personId] = await hashPassword(pw);
  await fs.mkdir(path.dirname(file()), { recursive: true });
  await fs.writeFile(file(), JSON.stringify(all, null, 1), { mode: 0o600 });
}
export async function verifyPassword(personId: string, pw: string): Promise<boolean> { return checkHash(pw, (await read())[personId]); }
export const hasAnyPassword = async () => Object.keys(await read()).length > 0;
export const hasPassword = async (personId: string) => personId in (await read());
