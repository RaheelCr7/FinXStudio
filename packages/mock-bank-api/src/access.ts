import { BankError } from "./errors";
import type { Flaws } from "./business/corporate";
import type { BankConfig } from "./config";
import { secretHash } from "./hash";
import { maskPhone } from "./retail/phone";
import { PublicDirectory } from "./retail/public-data";

/**
 * Signing in, recovering and the devices a customer uses, as a bank holds them (docs/BANKWORKX.md, "Signing in and security").
 *
 * The directory (`AccessDirectory`) is what the bank remembers: usernames with a password that is kept only as a hash, a status, the
 * devices (trusted or not, a quick PIN, biometrics) and a login history. An `AccessSandbox` is one bank session working on that
 * directory: the sign-in in progress, a recovery in progress, the one-time code, the reset token. Business outcomes come back as data
 * ({ ok: false, code }) so a journey can route on them, as the CAB sandbox does; the misuse and the failures of the service throw.
 *
 * Nothing here answers with a password, a PIN, a hash or a code. The demo password lives only in the seed below.
 */

/** The numbers of the specification (screens "Sign in" and "Reset password"); the demo shortens nothing except by the sandbox clock. */
export const ACCESS = {
  /** Wrong passwords (or quick PINs) that lock a profile. The fifth already answers LOCKED. */
  maxFailedSignIns: 5,
  lockMinutes: 30,
  /** Wrong one-time codes that lock a sign-in; wrong identity checks or codes that lock a recovery. */
  maxWrongCodes: 5,
  maxRecoveryFails: 3,
  /** A one-time code works for 5 minutes and once; 3 more can be asked for after the first. */
  codeSeconds: 300,
  maxResends: 3,
  /** The token a recovery hands out lives for 10 minutes. */
  tokenSeconds: 600,
  trustDays: 90,
  maxTrustedDevices: 5,
  /** The shell signs a person out after 5 quiet minutes (the sandbox applies it when a scenario asks for it). */
  idleSeconds: 300,
  /** Wrong quick PINs that turn quick sign-in off for a device. */
  maxWrongPins: 3,
  usedPasswordsKept: 12,
  /** Settings > Security: wrong codes that end one attempt, and how long a checked current password or PIN counts as proof. */
  maxSecurityCodes: 3,
  proofSeconds: 300,
} as const;
export const FIXED_CODE = "482100";
/** The code that is always expired, the way 000000 is always wrong. */
export const EXPIRED_CODE = "999999";
const DAY = 86_400_000, MINUTE = 60_000;
/** One one-time code in progress: how many were sent, when the last went out, whether it was right, and how many wrong ones were tried. */
export type Otp = { sends: number; sentAt: number; verified: boolean; wrong: number };
export const freshOtp = (): Otp => ({ sends: 0, sentAt: 0, verified: false, wrong: 0 });
/**
 * Sending a code, or sending it again: at most `ACCESS.maxResends` more after the first, and the new code makes the old one useless. Shared by the sign-in, the recovery and the public
 * journeys (registering, opening an account, tracking an application), so a code behaves the same everywhere.
 */
export function sendCode(otp: Otp, now: number, f: Flaws, after = "Try again later."): Otp {
  if (otp.sends >= 1 + ACCESS.maxResends && f.resendLimit !== false) throw new BankError("OTP_RESEND_LIMIT", `You have asked for the maximum number of codes. ${after}`);
  return { sends: otp.sends + 1, sentAt: now, verified: false, wrong: otp.wrong };
}
/** Checks a code: 482100 for the first send, 482101 for the next ..., 000000 is wrong, 999999 is expired and so is a code older than five minutes. Throws OTP_REQUIRED / OTP_EXPIRED; a wrong one is counted and returned. */
export function judgeCode(otp: Otp, code: string, now: number, f: Flaws): "ok" | "wrong" {
  if (otp.sends === 0) throw new BankError("OTP_REQUIRED", "Ask for a code first.");
  if (f.codeExpiry !== false && (code === EXPIRED_CODE || now - otp.sentAt > ACCESS.codeSeconds * 1000)) throw new BankError("OTP_EXPIRED", "That code has expired. Ask for a new one.");
  if (code !== String(Number(FIXED_CODE) + otp.sends - 1)) { otp.wrong += 1; return "wrong"; }
  otp.verified = true;
  return "ok";
}


export type DeviceKind = "phone" | "tablet" | "laptop" | "browser";
/** The device a session is on (the apps tell the sandbox which one they are). */
export type DeviceInfo = { id: string; name: string; kind: DeviceKind };
export const KNOWN_DEVICE: DeviceInfo = { id: "dev_iphone15", name: "iPhone 15", kind: "phone" };
export const NEW_DEVICE: DeviceInfo = { id: "dev_new", name: "This device", kind: "browser" };
export type QuickMethod = "pin" | "biometric" | "passkey";

export type AccessDevice = {
  id: string; name: string; kind: DeviceKind;
  trusted: boolean; /** ms since 1970; after it the device asks for a code again */ trustedUntil: number;
  lastUsed: number;
  /** The quick sign-in turned on for this device, and the method used by default. */
  quick?: QuickMethod; default: "password" | QuickMethod;
  pinHash?: string; pinFails: number;
  /** The device has fingerprint or face sign-in set up (a phone does). */
  biometricAvailable: boolean;
  /** The username is remembered on this device for the greeting. */
  remembered: boolean;
};
export type LoginResult = "ok" | "wrong-password" | "locked" | "new-device-code" | "inactivity";
export type LoginRecord = { at: number; result: LoginResult; method: "password" | "pin" | "biometric"; deviceId: string; deviceName: string; place: string; ip: string };
export type AccessStatus = "active" | "locked" | "expired" | "inactive";
export type AccessUser = {
  username: string; personaId: string; firstName: string; lastName: string; email: string; phone: string; dob: string;
  status: AccessStatus;
  /** A temporary password: the first sign-in must choose a new one. */
  mustChange?: boolean;
  passwordHash: string; passwordChangedAt: number; usedHashes: string[];
  failedSignIns: number;
  /** Set when a lock ends by itself (a natural lock lasts 30 minutes). A seeded lock has none: only unlocking ends it. */
  lockedUntil?: number;
  devices: AccessDevice[];
  history: LoginRecord[];
};

/* ---------------------------------------------------------------------------------------------------- the rules */

export const PASSWORD_RULES_BWX = { minLength: 12, maxLength: 64 };
/** A short sandbox sample of what a bank would check against. The common words are matched inside the password; the breached ones whole. */
const COMMON_WORDS = ["password", "qwerty", "letmein", "welcome", "iloveyou", "admin", "123456"];
const BREACHED = ["winter2024!winter", "sunshine!2020abc", "spring2023!spring", "football!2019abc"];
/** The usernames nobody can register, whatever the directory holds, and the shape of one. */
const RESERVED_USERNAMES = ["admin", "administrator", "bankworkx", "jordan.lee", "alex.morgan", "sam.rivera", "customer", "support"];
export const USERNAME_FORMAT = /^[A-Za-z0-9._-]{6,30}$/;
export type PasswordProblem = "PASSWORD_SAME" | "MIN_LENGTH" | "MAX_LENGTH" | "PASSWORD_CONTAINS_USERNAME" | "PASSWORD_COMMON" | "PASSWORD_BREACHED" | "PASSWORD_REUSED";

/** The problems of a new password, in the order the screen reports them (the first is the one it shows). `used` says whether the person had it before. */
export function bwxPasswordProblems(password: string, username: string, used: boolean, flaws: Flaws = {}): PasswordProblem[] {
  const out: PasswordProblem[] = [], lower = password.toLowerCase();
  if (flaws.passwordLength !== false && password.length < PASSWORD_RULES_BWX.minLength) out.push("MIN_LENGTH");
  if (flaws.passwordLength !== false && password.length > PASSWORD_RULES_BWX.maxLength) out.push("MAX_LENGTH");
  if (flaws.passwordUsername !== false && username && lower.includes(username.toLowerCase())) out.push("PASSWORD_CONTAINS_USERNAME");
  if (flaws.passwordCommon !== false && COMMON_WORDS.some((w) => lower.includes(w))) out.push("PASSWORD_COMMON");
  if (flaws.passwordBreach !== false && BREACHED.includes(lower)) out.push("PASSWORD_BREACHED");
  if (flaws.passwordReuse !== false && used) out.push("PASSWORD_REUSED");
  return out;
}

/** The PINs that are too easy: six equal digits, runs up or down, three repeated pairs, and a few that everyone tries. */
const WEAK_PINS = ["112233", "123123", "696969", "000111"];
export function pinProblem(pin: string, phone: string, flaws: Flaws = {}): "PIN_INVALID" | "PIN_WEAK" | "PIN_PHONE" | null {
  if (!/^[0-9]{6}$/.test(pin)) return "PIN_INVALID";
  if (flaws.pinRules === false) return null;
  const d = [...pin].map(Number), step = (n: number) => d.every((x, i) => i === 0 || x - d[i - 1]! === n);
  const weak = d.every((x) => x === d[0]) || step(1) || step(-1) || (pin.slice(0, 2) === pin.slice(2, 4) && pin.slice(2, 4) === pin.slice(4)) || WEAK_PINS.includes(pin);
  if (weak) return "PIN_WEAK";
  if (pin.includes(phone.replace(/\D/g, "").slice(-4))) return "PIN_PHONE";
  return null;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const toIso = (s: unknown) => { const t = String(s ?? "").replace(/\s+/g, ""); const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : t; };
const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2");
const maskLast4 = (p: string) => `••• ${digits(p).slice(-4)}`;
const hashOf = (secret: string, username: string) => secretHash(secret, `bwx:${username}`);
const hashPin = (pin: string, deviceId: string) => secretHash(pin, `pin:${deviceId}`);
const iso = (s: string) => Date.parse(s);

/* ------------------------------------------------------------------------------------------------------- the seed */

/** The demo password, in the seed only. Every sandbox user has it; the one-time code is 482100. */
const DEMO_PASSWORD = "Bwx!Demo2026";
const PLACE: Record<string, string> = { dev_iphone15: "San Francisco, US", dev_laptop: "San Francisco, US", dev_tablet: "Oakland, US" };
const device = (id: string, name: string, kind: DeviceKind, lastUsed: string, extra: Partial<AccessDevice> = {}): AccessDevice => ({
  id, name, kind, trusted: true, trustedUntil: iso("2027-01-31T00:00:00Z"), lastUsed: iso(lastUsed), default: "password", pinFails: 0, biometricAvailable: kind === "phone" || kind === "tablet", remembered: false, ...extra,
});
const rec = (at: string, result: LoginResult, method: LoginRecord["method"], d: { id: string; name: string }, place?: string, ip = "203.0.113.•"): LoginRecord => ({ at: iso(at), result, method, deviceId: d.id, deviceName: d.name, place: place ?? PLACE[d.id] ?? "Unknown", ip });

type Seed = { username: string; personaId: string; firstName: string; lastName: string; email: string; phone: string; dob: string; status: AccessStatus; mustChange?: boolean; changed: string; devices?: AccessDevice[]; history?: LoginRecord[] };
function userOf(s: Seed): AccessUser {
  const h = hashOf(DEMO_PASSWORD, s.username);
  return { username: s.username, personaId: s.personaId, firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone, dob: s.dob, status: s.status, ...(s.mustChange ? { mustChange: true } : {}), passwordHash: h, passwordChangedAt: iso(s.changed), usedHashes: [h], failedSignIns: 0, devices: structuredClone(s.devices ?? []), history: structuredClone(s.history ?? []) };
}
const alexDevices = () => [
  device("dev_iphone15", "iPhone 15", "phone", "2026-11-03T08:00:00Z"),
  device("dev_laptop", "Work laptop, Chrome", "laptop", "2026-11-02T18:20:00Z"),
  device("dev_tablet", "Android tablet", "tablet", "2026-10-12T09:00:00Z"),
];
/** Alex's last 30 days: ten sign-ins, one wrong password from London on a device nobody knows, one new-device code. */
const alexHistory = (): LoginRecord[] => {
  const p = { id: "dev_iphone15", name: "iPhone 15" }, l = { id: "dev_laptop", name: "Work laptop, Chrome" }, t = { id: "dev_tablet", name: "Android tablet" };
  const unknown = { id: "dev_unknown", name: "Unknown device" };
  return [
    rec("2026-11-03T08:00:00Z", "ok", "password", p), rec("2026-11-02T18:20:00Z", "ok", "password", l), rec("2026-11-01T07:45:00Z", "ok", "password", p),
    rec("2026-10-30T19:05:00Z", "ok", "password", l), rec("2026-10-28T08:10:00Z", "ok", "password", p), rec("2026-10-25T21:30:00Z", "wrong-password", "password", unknown, "London, GB", "198.51.100.•"),
    rec("2026-10-24T08:02:00Z", "ok", "password", p), rec("2026-10-21T12:40:00Z", "ok", "password", l), rec("2026-10-18T16:15:00Z", "new-device-code", "password", { id: "dev_tablet", name: "Android tablet" }),
    rec("2026-10-18T16:16:00Z", "ok", "password", t), rec("2026-10-15T07:59:00Z", "ok", "password", p), rec("2026-10-12T09:00:00Z", "ok", "password", t),
  ];
};
const SEEDS: Seed[] = [
  { username: "alex.morgan", personaId: "alex", firstName: "Alex", lastName: "Morgan", email: "alex.morgan@example.com", phone: "+1 415 555 0142", dob: "1988-03-14", status: "active", changed: "2026-05-02T00:00:00Z" },
  { username: "sam.rivera", personaId: "sam", firstName: "Sam", lastName: "Rivera", email: "sam.rivera@example.com", phone: "+1 415 555 0199", dob: "1992-07-21", status: "active", changed: "2026-08-12T00:00:00Z" },
  { username: "demo.locked", personaId: "demolocked", firstName: "Jamie", lastName: "Locke", email: "jamie.locke@example.com", phone: "+1 415 555 0177", dob: "1990-03-02", status: "locked", changed: "2026-06-01T00:00:00Z" },
  { username: "demo.expired", personaId: "demoexpired", firstName: "Omar", lastName: "Nassar", email: "omar.nassar@example.com", phone: "+1 415 555 0150", dob: "1995-11-20", status: "expired", changed: "2025-09-01T00:00:00Z" },
  { username: "demo.inactive", personaId: "demoinactive", firstName: "Yasmin", lastName: "Khoury", email: "yasmin.khoury@example.com", phone: "+1 415 555 0163", dob: "1997-08-09", status: "inactive", changed: "2026-10-30T00:00:00Z" },
  /** A customer who already trusts five devices: the sixth is refused. */
  { username: "device.limit", personaId: "demolimit", firstName: "Riley", lastName: "Park", email: "riley.park@example.com", phone: "+1 415 555 0188", dob: "1991-05-30", status: "active", changed: "2026-07-01T00:00:00Z", devices: [1, 2, 3, 4, 5].map((n) => device(`dev_d${n}`, `Device ${n}`, "phone", "2026-10-01T09:00:00Z")) },
  /** A customer who has just been given a temporary password: the first sign-in must choose a new one. */
  { username: "new.user", personaId: "demonew", firstName: "Noor", lastName: "Hayes", email: "noor.hayes@example.com", phone: "+1 415 555 0121", dob: "1999-01-09", status: "active", mustChange: true, changed: "2026-11-02T00:00:00Z" },
];

/** What the bank remembers about every customer who can sign in. One per sandbox (the apps keep it for as long as they run). */
export class AccessDirectory {
  readonly users = new Map<string, AccessUser>();
  /** What the bank sent to a customer (the message that carries a recovered username). For tests: the apps never read it. */
  readonly outbox: { to: string; kind: "username"; text: string }[] = [];
  /** What the bank remembers before anyone signs in (applications, customers who may register): kept here so it outlasts the bank made for one sign-in. */
  readonly pub = new PublicDirectory();
  constructor() {
    for (const s of SEEDS) this.users.set(s.username, userOf(s));
    const alex = this.users.get("alex.morgan")!;
    alex.devices = alexDevices(); alex.history = alexHistory();
  }
  find(username: unknown) { return this.users.get(norm(username)); }
  byPersona(id: string) { return [...this.users.values()].find((u) => u.personaId === id); }
  byEmail(email: unknown) { return [...this.users.values()].find((u) => u.email.toLowerCase() === norm(email)); }
}

/* --------------------------------------------------------------------------------------------------- the session */

export type AccessHost = {
  now: () => number; flaws: () => Flaws; config: () => BankConfig;
  /** What a scenario says about this device, if anything ("known", "new", "unusual"). */
  deviceKind: () => "known" | "new" | "unusual" | "browser" | undefined;
  /** The device the apps told the sandbox they are, if they did. */
  appDevice: () => DeviceInfo | undefined;
  /** Whether a call asked a customer who is already signed in (the persona's own one-time code is then in force). */
  signedIn: () => boolean;
};
type SignInFlow = { username: string; how: "password" | "pin" | "biometric"; needsCode: boolean; needsPassword: boolean; reason?: "expired" | "temporary"; changed: boolean; trusted: boolean; quick?: QuickMethod | "off"; remember: boolean };
type RecoverFlow = { username: string; purpose: "username" | "password"; contact: "mobile" | "email"; token: string; expiresAt: number; used: boolean };

/** One bank session's view of the directory: who is signed in, the sign-in or recovery in progress, and the codes. */
export class AccessSandbox {
  /** The username the session belongs to once signed in (or the customer a persona stands for). */
  user?: string;
  private signin?: SignInFlow;
  private recover?: RecoverFlow;
  private otp: Otp = { sends: 0, sentAt: 0, verified: false, wrong: 0 };
  private otpFor?: "signin" | "recover";
  /** Wrong tries at a recovery (identity checks and codes together) and when it can be tried again. */
  private recoverFails = 0;
  private recoverLockedUntil = 0;
  /** Wrong tries at signing in, by username (an unknown name counts too, so the screen never says whether a name exists). */
  private failed = new Map<string, number>();
  private seq = 0;
  /** The persona to load once `completeSignIn` has answered; the bank takes it. */
  private persona?: string;
  /** Settings > Security: the one-time code of a signed-in customer's own changes (asked for with `strict`), and the current password or PIN once checked. */
  private sec: Otp = { sends: 0, sentAt: 0, verified: false, wrong: 0 };
  private proof: { password?: number; pin?: number } = {};

  constructor(readonly dir: AccessDirectory, private host: AccessHost) {}

  private get now() { return this.host.now(); }
  private flaws() { return this.host.flaws(); }
  private opt(name: "forceExpiry" | "riskStepUp") { const o = this.host.config().options["sign-in"]?.[name]; return o !== false; }

  /** The device this session is on. */
  thisDevice(): DeviceInfo {
    const k = this.host.deviceKind();
    if (k === "known" || k === "unusual") return KNOWN_DEVICE;
    if (k === "browser") return { id: "dev_laptop", name: "Work laptop, Chrome", kind: "laptop" };
    if (k === "new") return NEW_DEVICE;
    const own = this.host.appDevice(); if (own) return own;
    const u = this.me(); return u?.devices[0] ? { id: u.devices[0].id, name: u.devices[0].name, kind: u.devices[0].kind } : NEW_DEVICE;
  }
  /** Whether this is the signed-in customer's password (the demo password of the seed until they change it); a customer without a username here keeps `fallback`. */
  passwordIs(secret: unknown, fallback: string) {
    const u = this.me();
    return typeof secret === "string" && (u ? hashOf(secret, u.username) === u.passwordHash : secret === fallback);
  }
  /** Whether this is the quick PIN of the device in hand (false when none is set). */
  pinIs(secret: unknown) { const u = this.me(), dev = u?.devices.find((x) => x.id === this.thisDevice().id); return !!dev?.pinHash && typeof secret === "string" && hashPin(secret, dev.id) === dev.pinHash; }
  /** A wrong password or PIN at the step-up counts with the sign-in's tries; the fifth locks the profile. Nothing for a customer without a username here. */
  stepUpMistake(): { left: number; locked: boolean } | undefined {
    const u = this.me(); if (!u) return undefined;
    u.failedSignIns += 1; this.log(u, "wrong-password");
    if (u.failedSignIns >= ACCESS.maxFailedSignIns && this.flaws().signInLock !== false) { this.lock(u); this.log(u, "locked"); return { left: 0, locked: true }; }
    return { left: Math.max(0, ACCESS.maxFailedSignIns - u.failedSignIns), locked: false };
  }
  /** A right password or PIN at the step-up sets the count back to zero. */
  stepUpRight() { const u = this.me(); if (u) u.failedSignIns = 0; }
  /** The session ended for lack of use: the history says so. */
  noteInactivity() { const u = this.me(); if (u) this.log(u, "inactivity"); }
  /** The signed-in customer, if the session has one. */
  me(): AccessUser | undefined { return this.user ? this.dir.find(this.user) : undefined; }
  private requireMe(): AccessUser { const u = this.me(); if (!u) throw new BankError("NOT_SUPPORTED", "Not available for this customer"); return u; }
  /** Takes the persona a finished sign-in asked the bank to load. */
  takePersona(): string | undefined { const p = this.persona; this.persona = undefined; return p; }

  private known(u: AccessUser, d: DeviceInfo) { return u.devices.find((x) => x.id === d.id && x.trusted && x.trustedUntil > this.now); }
  private isLocked(u: AccessUser) {
    if (u.status !== "locked") return false;
    if (u.lockedUntil !== undefined && this.now >= u.lockedUntil) { u.status = "active"; u.failedSignIns = 0; u.lockedUntil = undefined; this.failed.delete(u.username); return false; }
    return true;
  }
  private lock(u: AccessUser) { u.status = "locked"; u.lockedUntil = this.now + ACCESS.lockMinutes * MINUTE; }
  private log(u: AccessUser, result: LoginResult, method: LoginRecord["method"] = "password") {
    const d = this.thisDevice();
    u.history.unshift({ at: this.now, result, method, deviceId: d.id, deviceName: d.name, place: PLACE[d.id] ?? "Unknown", ip: "203.0.113.•" });
    u.history.length = Math.min(u.history.length, 100);
  }
  private locked() { return { ok: false as const, code: "LOCKED", lockMinutes: ACCESS.lockMinutes }; }

  /* --------------------------------------------------------------------------------------------- one-time codes */

  /** Whether the one-time code calls belong to a sign-in or a recovery (and not to the signed-in customer's own code). */
  get ownsCodes() { return !!this.signin || !!this.recover || !this.host.signedIn(); }
  /** `bank.otp.send` and `bank.otp.verify` while nobody is signed in: the code goes to the customer who is signing in or recovering. */
  codeCall(adapter: "bank.otp.send" | "bank.otp.verify", input: Record<string, any>) {
    const f = this.flaws();
    const who = this.otpFor === "recover" && this.recover ? this.dir.find(this.recover.username) : this.signin ? this.dir.find(this.signin.username) : undefined;
    const kind: "signin" | "recover" | undefined = this.otpFor ?? (this.signin ? "signin" : this.recover ? "recover" : undefined);
    if (!who || !kind) throw new BankError("VERIFY_FIRST", "Start with your username first.");
    if (kind === "recover") this.recoveryToken(this.recover!.token, false);
    if (adapter === "bank.otp.send") {
      this.otp = sendCode(this.otp, this.now, f, "Wait 15 minutes or choose another way.");
      const where = kind === "recover" && this.recover!.contact === "email" ? maskEmail(who.email) : kind === "recover" ? maskLast4(who.phone) : maskPhone(who.phone);
      return { sent: true, maskedPhone: where, channel: input.channel ?? "sms", resendsLeft: Math.max(0, ACCESS.maxResends + 1 - this.otp.sends) };
    }
    // a resend gives a new code, and the one before is useless: 482100, then 482101, 482102, 482103
    if (judgeCode(this.otp, String(input.code ?? ""), this.now, f) === "wrong") {
      if (kind === "signin") {
        if (this.otp.wrong >= ACCESS.maxWrongCodes && f.codeLock !== false) { this.lock(who); this.log(who, "locked"); this.signin = undefined; throw new BankError("ACCOUNT_LOCKED", "Too many wrong codes.", this.otp.wrong); }
      } else if (this.recoverFail(who.username) === "locked") throw new BankError("ID_LOCKED", "Too many tries.", this.otp.wrong);
      throw new BankError("OTP_INVALID", "That code isn't right.", this.otp.wrong);
    }
    this.otp.verified = true;
    return { verified: true };
  }
  private recoverFail(_username: string): "locked" | "left" {
    this.recoverFails += 1;
    if (this.recoverFails >= ACCESS.maxRecoveryFails && this.flaws().recoveryLock !== false) { this.recoverLockedUntil = this.now + ACCESS.lockMinutes * MINUTE; this.recover = undefined; return "locked"; }
    return "left";
  }
  private codeOk(kind: "signin" | "recover") { return this.otpFor === kind && this.otp.verified; }

  /* ------------------------------------------------------------------------------------------------- sign in */

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.auth.signIn": return this.signIn(input);
      case "bank.auth.quickSignIn": return this.quickSignIn(input);
      case "bank.auth.changePassword": return this.changePasswordInFlow(input);
      case "bank.auth.trustDevice": return this.trustDevice(input);
      case "bank.auth.setQuickSignIn": return this.setQuickInFlow(input);
      case "bank.auth.completeSignIn": return this.completeSignIn(input);
      case "bank.auth.signOut": this.signin = undefined; this.recover = undefined; this.user = undefined; return { ok: true };
      case "bank.device.options": return this.options();
      case "bank.recover.verifyUser": return this.verifyUser(input);
      case "bank.recover.sendUsername": return this.sendUsername(input);
      case "bank.recover.resetPassword": return this.resetPassword(input);
      case "bank.recover.unlock": return this.unlock(input);
      case "bank.password.policy": return this.policy(input);
      case "sandbox.access.inspect": return this.inspect(input);
      default: return undefined;
    }
  }

  private signIn(input: Record<string, any>) {
    const f = this.flaws(), key = norm(input.username), u = this.dir.find(key);
    this.signin = undefined; this.recover = undefined; this.otp = { sends: 0, sentAt: 0, verified: false, wrong: 0 }; this.otpFor = undefined;
    if (u && this.isLocked(u)) return this.locked();
    if (u?.status === "inactive") return { ok: false as const, code: "INACTIVE" };
    const right = !!u && typeof input.password === "string" && (f.credentials === false || hashOf(input.password, u.username) === u.passwordHash);
    if (!right) {
      // wrong passwords and wrong quick PINs share one count on a profile; a name nobody has is counted here so it looks the same
      const n = (u ? u.failedSignIns : this.failed.get(key) ?? 0) + 1; this.failed.set(key, n);
      if (u) { u.failedSignIns = n; this.log(u, "wrong-password"); }
      if (n >= ACCESS.maxFailedSignIns && f.signInLock !== false) { if (u) { this.lock(u); this.log(u, "locked"); } return this.locked(); }
      if (f.usernameHiding === false && !u) return { ok: false as const, code: "USERNAME_UNKNOWN" };
      return { ok: false as const, code: "INVALID_CREDENTIALS", attemptsLeft: ACCESS.maxFailedSignIns - n };
    }
    this.failed.delete(key); u.failedSignIns = 0;
    const d = this.thisDevice();
    const unusual = this.host.deviceKind() === "unusual" && this.opt("riskStepUp");
    const needsCode = f.newDeviceCode !== false && (!this.known(u, d) || unusual);
    const reason = f.expiredPassword !== false && u.status === "expired" && this.opt("forceExpiry") ? "expired" : u.mustChange ? "temporary" : undefined;
    this.signin = { username: u.username, how: "password", needsCode, needsPassword: !!reason, ...(reason ? { reason } : {}), changed: false, trusted: !!this.known(u, d), remember: false };
    this.otpFor = "signin";
    return { ok: true as const, status: needsCode ? "otp" : reason ? "change-password" : "ok", firstName: u.firstName, maskedPhone: maskPhone(u.phone), reason: reason ?? null, deviceKnown: !!this.known(u, d), device: { id: d.id, name: d.name, kind: d.kind } };
  }

  /** A quick PIN or biometric on a device that remembers the person: no password, no code. */
  private quickSignIn(input: Record<string, any>) {
    const f = this.flaws(), d = this.thisDevice(), u = [...this.dir.users.values()].find((x) => x.devices.some((v) => v.id === d.id && v.remembered && v.quick));
    const dev = u?.devices.find((v) => v.id === d.id);
    if (!u || !dev?.quick) return { ok: false as const, code: "QUICK_OFF" };
    if (this.isLocked(u)) return this.locked();
    if (u.status === "inactive") return { ok: false as const, code: "INACTIVE" };
    if (u.status === "expired" || u.mustChange) return { ok: false as const, code: "PASSWORD_EXPIRED" };
    const method = String(input.method ?? "pin");
    const right = method === "pin" ? dev.quick === "pin" && !!dev.pinHash && typeof input.pin === "string" && hashPin(input.pin, dev.id) === dev.pinHash : dev.quick === method;
    if (!right) {
      dev.pinFails += 1; u.failedSignIns += 1; this.log(u, "wrong-password", method === "pin" ? "pin" : "biometric");
      if (u.failedSignIns >= ACCESS.maxFailedSignIns && f.signInLock !== false) { this.lock(u); this.log(u, "locked", "pin"); return this.locked(); }
      if (dev.pinFails >= ACCESS.maxWrongPins) { dev.quick = undefined; dev.default = "password"; dev.pinHash = undefined; dev.pinFails = 0; return { ok: false as const, code: "QUICK_OFF" }; }
      return { ok: false as const, code: "QUICK_PIN_INVALID", attemptsLeft: ACCESS.maxFailedSignIns - u.failedSignIns };
    }
    dev.pinFails = 0; u.failedSignIns = 0;
    this.signin = { username: u.username, how: method === "pin" ? "pin" : "biometric", needsCode: false, needsPassword: false, changed: false, trusted: true, quick: dev.quick, remember: true };
    return { ok: true as const, status: "ok", firstName: u.firstName };
  }

  private flow(): SignInFlow & { user: AccessUser } {
    const s = this.signin, u = s && this.dir.find(s.username);
    if (!s || !u) throw new BankError("SIGNIN_REQUIRED", "Sign in with your username and password first.");
    return { ...s, user: u };
  }
  /** A step after the password needs the code first, when the sign-in asked for one. */
  private ready(s: SignInFlow) {
    if (s.needsCode && !this.codeOk("signin")) throw new BankError("OTP_REQUIRED", "Enter the code we sent you first.");
  }

  private changePasswordInFlow(input: Record<string, any>) {
    const s = this.flow(); this.ready(s);
    if (!s.needsPassword) throw new BankError("NOT_REQUIRED", "You don't need to choose a new password.");
    const out = this.setPassword(s.user, input);
    if (out.ok) this.signin!.changed = true;
    return out;
  }
  /** Checks a new password against the rules and, when it passes, keeps it (as a hash) and forgets what made the profile expire. */
  private setPassword(u: AccessUser, input: Record<string, any>) {
    const pw = String(input.newPassword ?? input.password ?? "");
    if (input.confirm !== undefined && input.confirm !== pw) return { ok: false as const, code: "MISMATCH" };
    const problems = bwxPasswordProblems(pw, u.username, u.usedHashes.includes(hashOf(pw, u.username)), this.flaws());
    if (problems.length) return { ok: false as const, code: problems[0]!, problems };
    const h = hashOf(pw, u.username);
    u.passwordHash = h; u.usedHashes = [...u.usedHashes, h].slice(-ACCESS.usedPasswordsKept); u.passwordChangedAt = this.now;
    if (u.status === "expired") u.status = "active";
    u.mustChange = undefined;
    const at = new Date(this.now).toISOString();
    return { ok: true as const, changedAt: at, changedOn: at.slice(0, 10) };
  }

  private trustDevice(input: Record<string, any>) {
    const s = this.flow(); this.ready(s);
    if (s.needsPassword && !s.changed) throw new BankError("PASSWORD_REQUIRED", "Choose a new password first.");
    const name = String(input.name ?? "").trim();
    if (name.length < 1 || name.length > 30) return { ok: false as const, code: "NAME_REQUIRED" };
    const d = this.thisDevice(), u = s.user, have = u.devices.find((x) => x.id === d.id);
    if (!have && u.devices.filter((x) => x.trusted).length >= ACCESS.maxTrustedDevices && this.flaws().deviceLimit !== false) return { ok: false as const, code: "DEVICE_LIMIT", max: ACCESS.maxTrustedDevices };
    const until = this.now + ACCESS.trustDays * DAY;
    if (have) Object.assign(have, { name, trusted: true, trustedUntil: until });
    else u.devices.push({ id: d.id, name, kind: d.kind, trusted: true, trustedUntil: until, lastUsed: this.now, default: "password", pinFails: 0, biometricAvailable: d.kind === "phone" || d.kind === "tablet", remembered: false });
    this.signin!.trusted = true;
    return { ok: true as const, deviceId: d.id, expiresInDays: ACCESS.trustDays };
  }

  private setQuickInFlow(input: Record<string, any>) {
    const s = this.flow(); this.ready(s);
    if (s.needsPassword && !s.changed) throw new BankError("PASSWORD_REQUIRED", "Choose a new password first.");
    const out = this.setQuick(s.user, input);
    if (out.ok) this.signin!.quick = out.method;
    return out;
  }
  /** Turns a quick sign-in method on for this device, or off. Needs a trusted device. Shared by the sign-in and by Security. */
  setQuick(u: AccessUser, input: Record<string, any>) {
    const d = this.thisDevice(), dev = u.devices.find((x) => x.id === d.id && x.trusted);
    if (!dev) return { ok: false as const, code: "DEVICE_NOT_TRUSTED" };
    const method = String(input.method ?? "");
    if (method === "off") { dev.quick = undefined; dev.default = "password"; dev.pinHash = undefined; dev.pinFails = 0; return { ok: true as const, method: "off" as const, device: dev.name }; }
    if (method === "pin") {
      const problem = pinProblem(String(input.pin ?? ""), u.phone, this.flaws());
      if (problem) return { ok: false as const, code: problem };
      dev.pinHash = hashPin(String(input.pin), dev.id); dev.pinFails = 0;
    } else if (method === "biometric") {
      if (!dev.biometricAvailable) return { ok: false as const, code: "BIOMETRIC_UNAVAILABLE" };
    } else if (method !== "passkey") return { ok: false as const, code: "INVALID_MODE" };
    // one method per device: turning another on replaces the PIN
    if (method !== "pin") { dev.pinHash = undefined; dev.pinFails = 0; }
    dev.quick = method as QuickMethod; dev.default = method as QuickMethod;
    return { ok: true as const, method: method as QuickMethod, device: dev.name };
  }

  private completeSignIn(input: Record<string, any>) {
    const s = this.flow(); this.ready(s);
    if (s.needsPassword && !s.changed) throw new BankError("PASSWORD_REQUIRED", "Choose a new password first.");
    const u = s.user, d = this.thisDevice(), dev = u.devices.find((x) => x.id === d.id), prior = u.history.find((h) => h.result === "ok");
    // the username is remembered on this device when the person ticked "Remember my username" (an untrusted device is only noted, not trusted)
    if (s.how === "password" && typeof input.remember === "boolean") {
      if (dev) dev.remembered = input.remember;
      else if (input.remember) u.devices.push({ id: d.id, name: d.name, kind: d.kind, trusted: false, trustedUntil: 0, lastUsed: this.now, default: "password", pinFails: 0, biometricAvailable: d.kind === "phone" || d.kind === "tablet", remembered: true });
    }
    if (dev) dev.lastUsed = this.now;
    this.log(u, s.needsCode ? "new-device-code" : "ok", s.how);
    if (s.needsCode) this.log(u, "ok", s.how);
    this.user = u.username; this.persona = u.personaId;
    const quick = u.devices.find((x) => x.id === d.id)?.quick ?? "off";
    this.signin = undefined; this.otpFor = undefined; this.otp = { sends: 0, sentAt: 0, verified: false, wrong: 0 };
    return {
      ok: true as const, username: u.username, firstName: u.firstName,
      how: s.how === "password" ? (s.needsCode ? "password+code" : "password") : s.how === "pin" ? "quick-pin" : "quick-biometric",
      deviceTrusted: s.trusted, deviceTrustedDays: s.trusted && dev ? Math.max(0, Math.round((dev.trustedUntil - this.now) / DAY)) : 0, quick,
      passwordChanged: s.changed, idleTimeoutSeconds: ACCESS.idleSeconds,
      lastSignIn: prior ? { at: new Date(prior.at).toISOString(), place: prior.place } : null,
    };
  }

  /** `bank.device.options`: what this device remembers, for the greeting and the quick sign-in. */
  private options() {
    const d = this.thisDevice(), remembered = [...this.dir.users.values()].find((x) => x.devices.some((v) => v.id === d.id && v.remembered));
    const u = remembered ?? this.me(), dev = u?.devices.find((v) => v.id === d.id);
    return {
      mode: dev?.default ?? "password", default: dev?.default ?? "password", pinSet: !!dev?.pinHash, biometricAvailable: dev ? dev.biometricAvailable : d.kind === "phone" || d.kind === "tablet",
      // the greeting and the remembered username only for a person this device was told to remember
      firstName: remembered?.firstName ?? "", username: remembered?.username ?? "", device: { id: d.id, name: d.name, kind: d.kind },
      trusted: !!dev?.trusted && dev.trustedUntil > this.now, quick: dev?.quick ?? "off",
      // for Settings > Security, only for the customer who is signed in
      ...(this.me() ? { passwordChangedAt: new Date(this.me()!.passwordChangedAt).toISOString() } : {}),
    };
  }

  /* ---------------------------------------------------------------------------------------------- recovery */

  /**
   * The first step of forgot username (a mobile number or an email and a date of birth) and of reset or unlock (a username or an email).
   * A miss never says which part did not match; the third miss locks the recovery for 30 minutes.
   */
  private verifyUser(input: Record<string, any>) {
    if (this.now < this.recoverLockedUntil) return { ok: false as const, code: "ID_LOCKED", lockMinutes: ACCESS.lockMinutes };
    this.recover = undefined; this.signin = undefined; this.otp = { sends: 0, sentAt: 0, verified: false, wrong: 0 }; this.otpFor = undefined;
    let u: AccessUser | undefined, purpose: RecoverFlow["purpose"] = "password", contact: RecoverFlow["contact"] = "mobile";
    if (input.dateOfBirth !== undefined) {
      purpose = "username";
      const mobile = digits(input.mobile), email = norm(input.email);
      contact = email ? "email" : "mobile";
      u = [...this.dir.users.values()].find((x) => (email ? x.email.toLowerCase() === email : mobile.length >= 7 && digits(x.phone).endsWith(mobile.slice(-10))) && x.dob === toIso(input.dateOfBirth));
    } else {
      const q = norm(input.usernameOrEmail);
      u = this.dir.find(q) ?? this.dir.byEmail(q);
    }
    if (!u || u.status === "inactive") {
      if (this.recoverFail(String(input.usernameOrEmail ?? "")) === "locked") return { ok: false as const, code: "ID_LOCKED", lockMinutes: ACCESS.lockMinutes };
      return { ok: false as const, code: "NOT_FOUND", attemptsLeft: ACCESS.maxRecoveryFails - this.recoverFails };
    }
    const token = `rt_${++this.seq}_${secretHash(`${u.username}:${this.now}:${this.seq}`, "token", 4).slice(0, 12)}`;
    this.recover = { username: u.username, purpose, contact, token, expiresAt: this.now + ACCESS.tokenSeconds * 1000, used: false };
    this.otpFor = "recover";
    return { ok: true as const, recoveryToken: token, maskedContact: contact === "email" ? maskEmail(u.email) : maskLast4(u.phone), maskedMobile: maskLast4(u.phone) };
  }
  /** The recovery a token belongs to, or an error: a token that is not the current one, was used, or has expired. */
  private recoveryToken(token: unknown, needCode: boolean): RecoverFlow & { user: AccessUser } {
    const r = this.recover, u = r && this.dir.find(r.username);
    if (!r || !u || r.used || String(token ?? "") !== r.token) throw new BankError("TOKEN_INVALID", "Start again from the beginning.");
    if (this.flaws().tokenExpiry !== false && this.now > r.expiresAt) { this.recover = undefined; throw new BankError("TOKEN_EXPIRED", "That took too long. Start again."); }
    if (needCode && this.flaws().resetNeedsCode !== false && !this.codeOk("recover")) throw new BankError("OTP_REQUIRED", "Enter the code we sent you first.");
    return { ...r, user: u };
  }
  private done() { this.recover = undefined; this.otpFor = undefined; this.otp = { sends: 0, sentAt: 0, verified: false, wrong: 0 }; this.recoverFails = 0; }

  private sendUsername(input: Record<string, any>) {
    const r = this.recoveryToken(input.recoveryToken, true);
    if (r.purpose !== "username") throw new BankError("TOKEN_INVALID", "Start again from the beginning.");
    // the username goes only to the contact the bank already holds, never to one typed in the journey
    const to = r.contact === "email" ? maskEmail(r.user.email) : maskLast4(r.user.phone);
    this.dir.outbox.push({ to, kind: "username", text: `Your BankWorkx® username is ${r.user.username}. If you didn't ask for this, call us.` });
    this.done();
    return { sent: true, maskedContact: to };
  }
  private resetPassword(input: Record<string, any>) {
    const r = this.recoveryToken(input.recoveryToken, true);
    if (r.purpose !== "password") throw new BankError("TOKEN_INVALID", "Start again from the beginning.");
    const out = this.setPassword(r.user, input);
    if (!out.ok) return out;
    if (this.flaws().resetClearsLock !== false) { r.user.failedSignIns = 0; r.user.lockedUntil = undefined; if (r.user.status === "locked") r.user.status = "active"; this.failed.delete(r.user.username); }
    this.done();
    return { ok: true as const, changedAt: out.changedAt, changedOn: out.changedOn, username: r.user.username };
  }
  private unlock(input: Record<string, any>) {
    const r = this.recoveryToken(input.recoveryToken, true);
    if (r.purpose !== "password") throw new BankError("TOKEN_INVALID", "Start again from the beginning.");
    const wasLocked = this.isLocked(r.user);
    r.user.failedSignIns = 0; r.user.lockedUntil = undefined; if (r.user.status === "locked") r.user.status = "active"; this.failed.delete(r.user.username);
    this.done();
    return { ok: true as const, wasLocked, username: r.user.username };
  }

  /* ---------------------------------------------------------------------------------------- registering */

  /**
   * The rules for the sign-in details of a customer who registers for digital banking, with nothing saved: the username (6 to 30 letters, numbers, dots, dashes or underscores, not one that is
   * taken), the two passwords the same, and the password rules of every other place (length, not the username, not common, not breached). Outcomes are data, as at sign-in.
   */
  checkRegistration(input: { username: string; password: string; confirm?: string }) {
    const f = this.flaws(), username = String(input.username ?? "").trim(), pw = String(input.password ?? "");
    // a name that is taken says so first (the reserved ones are short, so a screen that checked the shape first would never say it)
    if (f.pubRegUsername !== false) {
      if (RESERVED_USERNAMES.includes(username.toLowerCase()) || this.dir.find(username)) return { ok: false as const, code: "USERNAME_TAKEN" };
      if (!USERNAME_FORMAT.test(username)) return { ok: false as const, code: "USERNAME_INVALID" };
    }
    if (input.confirm !== undefined && input.confirm !== pw) return { ok: false as const, code: "MISMATCH" };
    const problems = bwxPasswordProblems(pw, username, false, f);
    if (problems.length) return { ok: false as const, code: problems[0]!, problems };
    return { ok: true as const };
  }
  /**
   * Makes the profile of a customer who registered: the same record sign-in reads (the password as a salted hash, the one it had kept so it cannot come back later, status active) and,
   * when asked, this device trusted for 90 days under the name given. Call `checkRegistration` first.
   */
  registerUser(r: { username: string; password: string; personaId: string; firstName: string; lastName: string; email: string; phone: string; dob: string; trustDevice: boolean; deviceName: string }) {
    const username = r.username.trim(), h = hashOf(r.password, username), d = this.thisDevice();
    const u: AccessUser = {
      username, personaId: r.personaId, firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, dob: r.dob, status: "active", passwordHash: h, passwordChangedAt: this.now,
      usedHashes: [h], failedSignIns: 0, devices: [], history: [],
    };
    if (r.trustDevice) u.devices.push({ id: d.id, name: r.deviceName.trim(), kind: d.kind, trusted: true, trustedUntil: this.now + ACCESS.trustDays * DAY, lastUsed: this.now, default: "password", pinFails: 0, biometricAvailable: d.kind === "phone" || d.kind === "tablet", remembered: false });
    this.dir.users.set(norm(username), u);
    return { deviceTrusted: r.trustDevice };
  }

  /* ---------------------------------------------------------------------------------------------- passwords */

  /**
   * The rules a new password has to meet, as a list a screen can tick off. Whether the person used it before is only checked for someone
   * the bank knows here (signed in, or holding a recovery token): asked of anyone, it would let a stranger try a person's old passwords.
   */
  private policy(input: Record<string, any>) {
    let u = this.me();
    if (!u && input.recoveryToken !== undefined && this.recover && String(input.recoveryToken) === this.recover.token) u = this.dir.find(this.recover.username);
    const username = u?.username ?? String(input.username ?? ""), pw = String(input.password ?? "");
    let problems: PasswordProblem[] = bwxPasswordProblems(pw, username, !!u && u.usedHashes.includes(hashOf(pw, u.username)), this.flaws());
    // a signed-in customer who types the password they have now is told to choose a different one (a recovery token holder is told it was used before)
    const same = !!this.me() && !!u && this.flaws().passwordSame !== false && hashOf(pw, u.username) === u.passwordHash;
    if (same) problems = ["PASSWORD_SAME", ...problems.filter((p) => p !== "PASSWORD_REUSED")];
    const rules = [["length", "MIN_LENGTH", "MAX_LENGTH"], ["username", "PASSWORD_CONTAINS_USERNAME"], ["common", "PASSWORD_COMMON"], ["breach", "PASSWORD_BREACHED"], ["used", "PASSWORD_REUSED"]] as const;
    return { ...PASSWORD_RULES_BWX, ok: problems.length === 0, problems, code: problems[0] ?? null, rules: rules.map(([id, ...codes]) => ({ id, ok: !codes.some((c) => (problems as string[]).includes(c)) && !(id === "used" && same), checked: id !== "used" || !!u })) };
  }

  /* ------------------------------------------------------------------------ what a signed-in customer manages */

  /** Whether the current password (`kind` password) or quick PIN was checked in the last five minutes: the proof the next change builds on, so a journey need not keep the secret. */
  private proven(kind: "password" | "pin") { const t = this.proof[kind]; return t !== undefined && this.now - t <= ACCESS.proofSeconds * 1000; }

  /**
   * The one-time code of a signed-in customer's own change (`bank.otp.send` / `verify` with `strict: true`): 000000 is wrong, 999999 is expired, a code
   * runs out after five minutes, a new one makes the old one useless, and the third wrong code ends the attempt (the person asks for a new one).
   * Without `strict` the persona's code keeps working as it always has (000000 is accepted).
   */
  securityCode(adapter: "bank.otp.send" | "bank.otp.verify", input: Record<string, any>, otp: { attempts: number; verified: boolean }) {
    const f = this.flaws(), u = this.requireMe();
    if (adapter === "bank.otp.send") {
      // a code asked for again (`resend`) replaces the last and counts toward the limit; a new attempt starts from the first code
      const again = input.resend === true;
      if (again && this.sec.sends >= 1 + ACCESS.maxResends && f.resendLimit !== false) throw new BankError("OTP_RESEND_LIMIT", "You have asked for the maximum number of codes. Try again later.");
      this.sec = { sends: again ? this.sec.sends + 1 : 1, sentAt: this.now, verified: false, wrong: 0 };
      otp.verified = false; otp.attempts = 0;
      return { sent: true, maskedPhone: maskPhone(u.phone), last4: digits(u.phone).slice(-4), channel: input.channel ?? "sms" };
    }
    if (this.sec.sends === 0) throw new BankError("OTP_REQUIRED", "Ask for a code first.");
    if (this.sec.wrong >= ACCESS.maxSecurityCodes && f.codeLock !== false) throw new BankError("OTP_LOCKED", "Too many wrong codes.", this.sec.wrong);
    const code = String(input.code ?? "");
    if (f.codeExpiry !== false && (code === EXPIRED_CODE || this.now - this.sec.sentAt > ACCESS.codeSeconds * 1000)) throw new BankError("OTP_EXPIRED", "That code has expired. Ask for a new one.");
    if (code !== String(Number(FIXED_CODE) + this.sec.sends - 1)) {
      this.sec.wrong += 1; otp.verified = false;
      if (this.sec.wrong >= ACCESS.maxSecurityCodes && f.codeLock !== false) throw new BankError("OTP_LOCKED", "Too many wrong codes.", this.sec.wrong);
      throw new BankError("OTP_INVALID", "That code isn't right.", this.sec.wrong);
    }
    // the code is used: the next change asks for a new one, and counts its resends from the start
    this.sec = { sends: 0, sentAt: 0, verified: false, wrong: 0 }; otp.verified = true;
    return { verified: true };
  }

  private dayText(at: number) { const d = new Date(at); return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
  private whenText(at: number, current: boolean) {
    if (current) return "Now";
    const today = Math.floor(this.now / DAY), day = Math.floor(at / DAY), hm = new Date(at).toISOString().slice(11, 16);
    if (day === today) return `Today, ${hm}`;
    if (day === today - 1) return `Yesterday, ${hm}`;
    return this.dayText(at);
  }
  private turnQuickOff(dev: AccessDevice) { dev.quick = undefined; dev.default = "password"; dev.pinHash = undefined; dev.pinFails = 0; }

  /** The signed-in adapters: devices, quick sign-in and the PIN, the password, the login history. Part of "Settings > Security". */
  security(adapter: string, input: Record<string, any>, ctx: { codeVerified: () => boolean; clearCode: () => void }): any {
    const f = this.flaws();
    switch (adapter) {
      case "bank.devices.list": {
        const u = this.requireMe(), me = this.thisDevice().id;
        const list = u.devices.filter((d) => d.trusted && d.trustedUntil > this.now && (input.scope === "current" ? d.id === me : input.scope === "others" ? d.id !== me : true)).sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : b.lastUsed - a.lastUsed));
        const count = u.devices.filter((d) => d.trusted && d.trustedUntil > this.now).length;
        return { max: ACCESS.maxTrustedDevices, count, others: u.devices.filter((d) => d.trusted && d.trustedUntil > this.now && d.id !== me).length, items: list.map((d) => ({ id: d.id, name: d.name, kind: d.kind, lastUsed: new Date(d.lastUsed).toISOString(), lastUsedText: this.whenText(d.lastUsed, d.id === me), current: d.id === me, quick: d.quick ?? "off" })) };
      }
      case "bank.devices.rename": {
        const u = this.requireMe(), d = u.devices.find((x) => x.id === input.deviceId), name = String(input.name ?? "").trim();
        if (!d) throw new BankError("DEVICE_NOT_FOUND", "That device is already gone.");
        if (name.length < 1 || name.length > 30) return { ok: false as const, code: "NAME_REQUIRED" };
        d.name = name; return { ok: true as const };
      }
      case "bank.devices.remove": {
        const u = this.requireMe(), me = this.thisDevice().id;
        if (f.removeNeedsCode !== false && !ctx.codeVerified()) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (input.all === true) { const gone = u.devices.filter((d) => d.id !== me && d.trusted); for (const d of gone) { d.trusted = false; d.quick = undefined; d.remembered = false; } ctx.clearCode(); return { removed: gone.length }; }
        const d = u.devices.find((x) => x.id === input.deviceId && x.trusted);
        if (!d) throw new BankError("DEVICE_NOT_FOUND", "That device is already gone.");
        if (d.id === me && f.currentDeviceKept !== false) throw new BankError("CURRENT_DEVICE", "This is the device you are using.");
        d.trusted = false; d.quick = undefined; d.remembered = false; ctx.clearCode();
        return { removed: 1 };
      }
      case "bank.devices.setQuickSignIn": {
        const u = this.requireMe();
        if (input.method !== "off" && f.quickNeedsCode !== false && !ctx.codeVerified()) throw new BankError("OTP_REQUIRED", "OTP not verified");
        const out = this.setQuick(u, input);
        if (out.ok && input.method !== "off") ctx.clearCode();
        return out;
      }
      case "bank.device.setDefault": {
        const u = this.requireMe(), dev = u.devices.find((x) => x.id === this.thisDevice().id && x.trusted), mode = String(input.mode ?? "");
        if (!dev) return { ok: false as const, code: "DEVICE_NOT_TRUSTED" };
        if (!["password", "pin", "biometric"].includes(mode)) throw new BankError("INVALID_MODE", "Choose password, pin or biometric");
        if (mode === "pin" && !dev.pinHash) return { ok: false as const, code: "PIN_NOT_SET" };
        if (mode === "biometric" && !dev.biometricAvailable) return { ok: false as const, code: "BIOMETRIC_UNAVAILABLE" };
        dev.default = mode as AccessDevice["default"]; if (mode !== "password") dev.quick = mode as QuickMethod;
        return { ok: true as const, default: mode };
      }
      case "bank.devices.checkPin": {
        // the rules a new PIN has to meet, before the code is asked for (nothing is changed)
        const u = this.requireMe(), problem = pinProblem(String(input.pin ?? ""), u.phone, f);
        return problem ? { ok: false as const, code: problem } : { ok: true as const };
      }
      case "bank.devices.verifyPin": {
        const u = this.requireMe(), dev = u.devices.find((x) => x.id === this.thisDevice().id);
        if (!dev?.pinHash) return { ok: false as const, code: "PIN_NOT_SET" };
        if (String(input.pin ?? "") && hashPin(String(input.pin), dev.id) === dev.pinHash) { dev.pinFails = 0; this.proof.pin = this.now; return { ok: true as const }; }
        this.proof.pin = undefined; dev.pinFails += 1;
        if (dev.pinFails >= ACCESS.maxWrongPins && f.pinLockOff !== false) { this.turnQuickOff(dev); return { ok: false as const, code: "PIN_LOCKED" }; }
        return { ok: false as const, code: "PIN_WRONG", triesLeft: Math.max(0, ACCESS.maxWrongPins - dev.pinFails) };
      }
      case "bank.devices.changePin": {
        const u = this.requireMe(), dev = u.devices.find((x) => x.id === this.thisDevice().id);
        if (!dev?.pinHash) return { ok: false as const, code: "PIN_NOT_SET" };
        // the current PIN comes with the call, or was checked just before (so a journey need not keep it)
        if (input.current !== undefined) { if (hashPin(String(input.current), dev.id) !== dev.pinHash) throw new BankError("PIN_WRONG", "That PIN isn't right."); }
        else if (f.currentPin !== false && !this.proven("pin")) throw new BankError("PIN_NOT_VERIFIED", "Confirm your current PIN first.");
        if (f.pinSame !== false && hashPin(String(input.new ?? ""), dev.id) === dev.pinHash) return { ok: false as const, code: "PIN_SAME" };
        const problem = pinProblem(String(input.new ?? ""), u.phone, f);
        if (problem) return { ok: false as const, code: problem };
        dev.pinHash = hashPin(String(input.new), dev.id); dev.pinFails = 0; this.proof.pin = undefined;
        return { ok: true as const, changedAt: new Date(this.now).toISOString(), device: dev.name };
      }
      case "bank.password.check": {
        const u = this.requireMe();
        if (this.isLocked(u)) return { ok: false as const, code: "ACCOUNT_LOCKED" };
        if (hashOf(String(input.current ?? ""), u.username) !== u.passwordHash) {
          this.proof.password = undefined; u.failedSignIns += 1;
          if (u.failedSignIns >= ACCESS.maxFailedSignIns && f.signInLock !== false) { this.lock(u); return { ok: false as const, code: "ACCOUNT_LOCKED" }; }
          return { ok: false as const, code: "INVALID_PASSWORD", attemptsLeft: Math.max(0, ACCESS.maxFailedSignIns - u.failedSignIns) };
        }
        u.failedSignIns = 0; this.proof.password = this.now; return { ok: true as const };
      }
      case "bank.password.change": {
        const u = this.requireMe();
        if (f.changeNeedsCode !== false && !ctx.codeVerified()) throw new BankError("OTP_REQUIRED", "OTP not verified");
        // the current password comes with the call, or was checked just before (so a journey need not keep it)
        if (input.current !== undefined) { if (hashOf(String(input.current), u.username) !== u.passwordHash) throw new BankError("INVALID_PASSWORD", "That isn't your current password."); }
        else if (f.currentPassword !== false && !this.proven("password")) throw new BankError("PASSWORD_NOT_VERIFIED", "Confirm your current password first.");
        if (f.passwordSame !== false && hashOf(String(input.new ?? ""), u.username) === u.passwordHash) return { ok: false as const, code: "PASSWORD_SAME" };
        const out = this.setPassword(u, { newPassword: input.new, confirm: input.confirm });
        if (!out.ok) return out;
        this.proof.password = undefined; ctx.clearCode();
        return { ...out, changedText: this.dayText(this.now), otherDevicesSignedOut: input.signOutOthers !== false };
      }
      case "bank.loginHistory.list": {
        const u = this.requireMe(), page = Math.max(1, Number(input.page) || 1), size = Math.min(50, Math.max(1, Number(input.pageSize) || 20));
        const horizon = this.now - 90 * DAY;
        const rows = u.history.filter((h) => h.at >= horizon && (input.result === "ok" ? h.result === "ok" : input.result === "failed" ? h.result !== "ok" : true) && (!input.deviceId || h.deviceId === input.deviceId) && (!input.from || h.at >= Date.parse(String(input.from))) && (!input.to || h.at <= Date.parse(String(input.to))));
        if (input.order === "oldest") rows.reverse();
        return { total: rows.length, items: rows.slice((page - 1) * size, page * size).map((h) => ({ at: new Date(h.at).toISOString(), result: h.result, method: h.method, deviceId: h.deviceId, deviceName: h.deviceName, place: h.place, ipMasked: h.ip })) };
      }
      default: return undefined;
    }
  }

  /** `sandbox.access.inspect`: what the bank holds about one username, for a scenario to check. Never a secret, never part of a journey. */
  private inspect(input: Record<string, any>) {
    const u = this.dir.find(input.username);
    if (!u) return { found: false };
    this.isLocked(u);
    const dev = (id: string) => u.devices.find((d) => d.id === id);
    return {
      found: true, status: u.status, locked: u.status === "locked", failedSignIns: u.failedSignIns, mustChange: !!u.mustChange, passwordsKept: u.usedHashes.length,
      trustedDevices: u.devices.filter((d) => d.trusted).map((d) => d.id), remembered: u.devices.filter((d) => d.remembered).map((d) => d.id),
      quick: Object.fromEntries(u.devices.filter((d) => d.quick).map((d) => [d.id, d.quick])), pinSet: Object.fromEntries(u.devices.map((d) => [d.id, !!d.pinHash])),
      lastResult: u.history[0]?.result ?? null, outbox: this.dir.outbox.filter((m) => m.text.includes(`username is ${u.username}.`)).map((m) => ({ to: m.to, kind: m.kind })), thisDevice: dev(this.thisDevice().id)?.name ?? null,
      sessionOpen: this.user === u.username,
    };
  }
}
