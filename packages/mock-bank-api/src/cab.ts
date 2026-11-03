import { BankError } from "./index";

/**
 * Sandbox for the access journeys of Cairo Amman Bank (sign in, enrol, activate, recover, locate, support).
 * It follows the behaviour of the bank's digital banking platform as read from its mobile client: sign-in outcomes
 * (wrong password, locked, expired, not activated), a picture-code check, a one-time code for password reset, server-side
 * password rules, and an activation code that blocks after repeated mistakes. Business outcomes come back as data
 * ({ ok: false, code }) so a journey can route on them; only misuse throws.
 */
export type CabStatus = "ACTIVE" | "NEW" | "LOCKED" | "PASSWORD_EXPIRED";
export type CabProfile = {
  username: string; password: string; firstName: string; lastName: string;
  /** National ID, as the customer types it. */
  nationalId: string;
  /** YYYY-MM-DD */
  dob: string; email: string; phone: string;
  status: CabStatus;
  /** Whether the customer has already enrolled (a new customer has not). */
  enrolled: boolean;
  /** The code sent after enrolment, needed to activate. */
  activationCode?: string;
  lastLogin: string;
  /** Account preview shown before sign-in. */
  accounts: { id: string; name: string; type: string; masked: string; balance: number; note: string }[];
  netWorth: { assets: number; debt: number };
};

export const CAB_CURRENCY = "JOD";
export const MAX_FAILED_LOGINS = 3;
export const LOCK_MINUTES = 30;
export const MAX_ACTIVATION_ATTEMPTS = 3;

const NOUR_ACCOUNTS: CabProfile["accounts"] = [
  { id: "cab_cur", name: "Kmart Corporation", type: "Current Account", masked: "••0375", balance: 2173.42, note: "Available balance" },
  { id: "cab_sav", name: "Kmart Corporation", type: "Savings Account", masked: "••0375", balance: -3085.31, note: "Overdrawn" },
  { id: "cab_chk", name: "Kmart Corporation", type: "Checking", masked: "••0375", balance: 120199.8, note: "Available balance" },
];

export const CAB_PROFILES: Record<string, CabProfile> = {
  nour: {
    username: "nour", password: "Cab@Secure123", firstName: "Nour", lastName: "Haddad", nationalId: "199012", dob: "2001-01-01",
    email: "jeyose8168@cab.com", phone: "+962 34 56 78 90", status: "ACTIVE", enrolled: true, lastLogin: "2026-07-19T21:15:00Z",
    accounts: NOUR_ACCOUNTS, netWorth: { assets: 485458.83, debt: 0 },
  },
  sara: {
    username: "sara", password: "", firstName: "Sara", lastName: "Hegazy", nationalId: "194324", dob: "2001-01-01",
    email: "sara.hegazy@cab.com", phone: "+962 79 123 4567", status: "NEW", enrolled: false, activationCode: "ACT-4821", lastLogin: "",
    accounts: [], netWorth: { assets: 0, debt: 0 },
  },
  yasmin: {
    username: "yasmin", password: "", firstName: "Yasmin", lastName: "Khoury", nationalId: "199744", dob: "1997-08-09",
    email: "yasmin.khoury@cab.com", phone: "+962 79 333 0172", status: "NEW", enrolled: true, activationCode: "ACT-4821", lastLogin: "",
    accounts: [], netWorth: { assets: 0, debt: 0 },
  },
  lina: {
    username: "lina", password: "Cab@Secure123", firstName: "Lina", lastName: "Qasem", nationalId: "198877", dob: "1988-03-02",
    email: "lina.qasem@cab.com", phone: "+962 77 555 0188", status: "LOCKED", enrolled: true, lastLogin: "2026-07-01T08:00:00Z",
    accounts: NOUR_ACCOUNTS.slice(0, 1), netWorth: { assets: 2173.42, debt: 0 },
  },
  omar: {
    username: "omar", password: "Cab@Secure123", firstName: "Omar", lastName: "Nassar", nationalId: "199533", dob: "1995-11-20",
    email: "omar.nassar@cab.com", phone: "+962 78 222 0150", status: "PASSWORD_EXPIRED", enrolled: true, lastLogin: "2026-04-11T10:30:00Z",
    accounts: NOUR_ACCOUNTS.slice(0, 2), netWorth: { assets: 2173.42, debt: 3085.31 },
  },
};

const CAPTCHAS = ["b5jz5", "k8m2q", "x4p7w", "t9r3d", "m6v8n"];
const LEGAL_ENTITIES = { mb: { id: "mb", name: "Model Bank" }, cab: { id: "cab", name: "Cairo Amman Bank" } };
const LANGUAGES = {
  en_US: { id: "en_US", name: "US English", sub: "English" }, en_GB: { id: "en_GB", name: "UK English", sub: "English" },
  fr_FR: { id: "fr_FR", name: "French", sub: "Français" }, ar_AE: { id: "ar_AE", name: "Arabic", sub: "عربي" },
};

type Place = { id: string; kind: "branch" | "atm"; name: string; address: string; km: number; open: boolean; hours: string; phone: string; services: string[] };
const PLACES: Place[] = [
  { id: "loc_abdoun", kind: "branch", name: "Abdoun Branch – Signature", address: "Amman – Abdoun – Cairo Street – Next to Citi Bank", km: 2.2, open: true, hours: "Monday – Friday, 8 am to 10 pm", phone: "+962 6 5200 000", services: ["Make an Appointment", "Safe Deposit"] },
  { id: "loc_abdoun_atm", kind: "atm", name: "Abdoun Branch ATM – Signature", address: "Amman – Abdoun – Cairo Street – Next to Citi Bank", km: 2.2, open: true, hours: "24 hours", phone: "+962 6 5200 000", services: ["ATM – Drive Up"] },
  { id: "loc_alalbayt_atm", kind: "atm", name: "Al al-Bayt University Branch ATM – Blind", address: "Al al-Bayt University – Mafraq", km: 61, open: true, hours: "24 hours", phone: "+962 6 5200 000", services: ["ATM – Drive Up"] },
  { id: "loc_sweifieh", kind: "branch", name: "Sweifieh Branch", address: "Amman – Sweifieh – Wasfi Al Tal Street", km: 6.8, open: false, hours: "Sunday – Thursday, 8:30 am to 3:30 pm", phone: "+962 6 5200 000", services: ["Make an Appointment"] },
  { id: "loc_irbid", kind: "branch", name: "Irbid Main Branch", address: "Irbid – University Street", km: 74, open: true, hours: "Sunday – Thursday, 8:30 am to 3:30 pm", phone: "+962 2 7200 000", services: ["Make an Appointment", "Safe Deposit"] },
];

/** The password rules, checked on the server as the platform does. */
export const PASSWORD_RULES = { minLength: 8, maxLength: 100, differentChars: 5 };
export function passwordProblems(password: string, username: string): string[] {
  const out: string[] = [];
  if (password.length < PASSWORD_RULES.minLength) out.push("MIN_LENGTH");
  if (password.length > PASSWORD_RULES.maxLength) out.push("MAX_LENGTH");
  if (new Set(password).size < PASSWORD_RULES.differentChars) out.push("DIFFERENT_CHARS");
  if (username && password.toLowerCase().includes(username.toLowerCase())) out.push("CONTAINS_USERNAME");
  return out;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
/** DD/MM/YYYY or YYYY-MM-DD, with spaces allowed around the slashes, to YYYY-MM-DD. */
export function toIsoDate(s: unknown): string {
  const t = String(s ?? "").replace(/\s+/g, "");
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : t;
}

type Ctx = { otpVerified: () => boolean; clearOtp: () => void };

export class CabSandbox {
  private profile?: CabProfile;
  private failedLogins = 0;
  private activationAttempts = 0;
  private captchaSeq = 0;
  private captchas: Record<string, string> = {};
  private recovered?: { username: string };
  private activated = false;
  private enrolledNow = false;
  private device = { default: "password" as "password" | "pin" | "biometric", pin: "", biometric: true };
  private preview = false;
  private language = "en_US";
  private activationVerified = false;

  constructor(persona: { id: string; cab?: CabProfile }, private ctx: Ctx) { this.profile = persona.cab ? structuredClone(persona.cab) : undefined; }

  /** What the sign-in screen shows before sign in: each account's name, number, type, balance and a note under it. */
  private previewAccounts() {
    return Object.fromEntries((this.profile?.accounts ?? []).map((a) => [a.id, { id: a.id, name: a.name, balance: a.balance, currency: CAB_CURRENCY, maskedNumber: a.masked, type: a.type, note: a.note }]));
  }

  handles(adapter: string) { return adapter.startsWith("cab."); }

  call(adapter: string, input: Record<string, any>): any {
    const p = this.profile;
    switch (adapter) {
      case "cab.legalEntities.list": return LEGAL_ENTITIES;

      case "cab.captcha.generate": {
        const text = CAPTCHAS[this.captchaSeq % CAPTCHAS.length]!; this.captchaSeq += 1;
        const serviceKey = `cap_${this.captchaSeq}`; this.captchas[serviceKey] = text;
        return { serviceKey, text };
      }
      case "cab.captcha.verify": return { ok: this.captchaOk(input) };

      case "cab.auth.signIn": {
        if (!p || norm(input.username) !== p.username) return this.badLogin();
        if (p.status === "LOCKED") return { ok: false, code: "LOCKED", errorCode: 10088, lockMinutes: LOCK_MINUTES };
        if (p.status === "NEW") return { ok: false, code: "INACTIVE", errorCode: 10092 };
        if (!p.password || input.password !== p.password) return this.badLogin();
        if (p.status === "PASSWORD_EXPIRED") return { ok: false, code: "PASSWORD_EXPIRED", errorCode: 10135 };
        this.failedLogins = 0;
        return {
          ok: true, firstName: p.firstName, lastLogin: p.lastLogin, defaultSignIn: this.device.default, accountCount: p.accounts.length,
          netWorth: p.netWorth.assets - p.netWorth.debt, currency: CAB_CURRENCY,
        };
      }

      case "cab.device.options": return { default: this.device.default, pinSet: !!this.device.pin, biometricAvailable: this.device.biometric };
      case "cab.device.setDefault": {
        const mode = String(input.mode ?? "");
        if (!["password", "pin", "biometric"].includes(mode)) throw new BankError("INVALID_MODE", "Choose password, pin or biometric");
        if (mode === "pin") {
          if (!/^[0-9]{6}$/.test(String(input.pin ?? ""))) throw new BankError("PIN_INVALID", "A PIN is six digits");
          this.device.pin = String(input.pin);
        }
        this.device.default = mode as "password" | "pin" | "biometric";
        return { ok: true, default: mode };
      }
      case "cab.device.verifyPin": return { ok: !!this.device.pin && String(input.pin) === this.device.pin };

      case "cab.preview.get": return { enabled: this.preview, accounts: this.previewAccounts(), asOf: new Date().toISOString() };
      case "cab.preview.accounts": return this.previewAccounts();
      case "cab.preview.set": { this.preview = input.enabled === true || input.enabled === "true"; return { ok: true, enabled: this.preview }; }

      case "cab.language.list": return LANGUAGES;
      case "cab.language.current": return { current: this.language, name: LANGUAGES[this.language as keyof typeof LANGUAGES].name };
      case "cab.language.selection": {
        // the language to show as selected: the one the person already picked on this screen, else the one in use
        const code = typeof input.chosen === "string" && input.chosen in LANGUAGES ? input.chosen : this.language;
        return { code, name: LANGUAGES[code as keyof typeof LANGUAGES].name };
      }
      case "cab.language.set": {
        const code = String(input.code ?? "");
        if (!(code in LANGUAGES)) throw new BankError("LANGUAGE_UNSUPPORTED", "That language is not available");
        this.language = code; return { ok: true, current: code, name: LANGUAGES[code as keyof typeof LANGUAGES].name };
      }

      case "cab.enroll.retail": {
        if (!this.captchaOk(input)) return { ok: false, code: "CAPTCHA_WRONG" };
        if (!p || norm(input.lastName) !== norm(p.lastName) || digits(input.nationalId) !== digits(p.nationalId) || toIsoDate(input.dob) !== p.dob) return { ok: false, code: "NOT_FOUND", errorCode: 10802 };
        if (p.enrolled || this.enrolledNow) return { ok: false, code: "ALREADY_ENROLLED", firstName: p.firstName };
        this.enrolledNow = true;
        return { ok: true, firstName: p.firstName, username: p.username, activationCodeSent: true, maskedEmail: maskEmail(p.email), maskedPhone: maskPhone(p.phone) };
      }

      case "cab.activate.validate": {
        if (!p || norm(input.username) !== p.username || !(p.status === "NEW" && (p.enrolled || this.enrolledNow))) return this.badActivation();
        if (this.activationAttempts >= MAX_ACTIVATION_ATTEMPTS) return { ok: false, code: "BLOCKED", errorCode: 10747 };
        if (String(input.code ?? "").trim().toUpperCase() !== p.activationCode) return this.badActivation();
        this.activationVerified = true; return { ok: true, username: p.username };
      }
      case "cab.activate.regenerate": {
        if (!this.recovered) throw new BankError("VERIFY_FIRST", "Verify the customer first");
        this.activationAttempts = 0; return { ok: true, sent: true, maskedEmail: p ? maskEmail(p.email) : "", maskedPhone: p ? maskPhone(p.phone) : "" };
      }
      case "cab.password.policy": return { ...PASSWORD_RULES, notContainUsername: true };
      case "cab.activate.setPassword": {
        if (!p || !this.activationVerified) throw new BankError("ACTIVATION_REQUIRED", "Verify the activation code first");
        if (input.confirm !== undefined && input.confirm !== input.password) return { ok: false, code: "MISMATCH" };
        const problems = passwordProblems(String(input.password ?? ""), p.username);
        if (problems.length) return { ok: false, code: "POLICY", problems };
        this.profile = { ...p, password: String(input.password), status: "ACTIVE" }; this.activated = true;
        return { ok: true, username: p.username };
      }

      case "cab.recover.verifyUser": {
        if (!this.captchaOk(input)) return { ok: false, code: "CAPTCHA_WRONG" };
        const typed = digits(input.phone);
        if (!p || norm(input.email) !== norm(p.email) || typed.length < 7 || !digits(p.phone).endsWith(typed.slice(-8)) || toIsoDate(input.dob) !== p.dob) return { ok: false, code: "NOT_FOUND" };
        this.recovered = { username: p.username };
        return { ok: true, username: p.username, firstName: p.firstName, status: p.status === "NEW" ? "NEW" : "ACTIVE", maskedEmail: maskEmail(p.email), maskedPhone: maskPhone(p.phone) };
      }
      case "cab.recover.resetPassword": {
        if (!p || !this.recovered) throw new BankError("VERIFY_FIRST", "Verify the customer first");
        if (!this.ctx.otpVerified()) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (input.confirm !== undefined && input.confirm !== input.password) return { ok: false, code: "MISMATCH" };
        const problems = passwordProblems(String(input.password ?? ""), p.username);
        if (problems.length) return { ok: false, code: "POLICY", problems };
        this.profile = { ...p, password: String(input.password), status: p.status === "NEW" ? "NEW" : "ACTIVE" };
        this.failedLogins = 0; this.ctx.clearOtp();
        return { ok: true };
      }

      case "cab.locations.search": {
        const kind = ["branch", "atm", "all"].includes(String(input.kind)) ? String(input.kind) : "all";
        const miles = Number(input.rangeMiles) > 0 ? Number(input.rangeMiles) : 5;
        const q = norm(input.query);
        const items = PLACES.filter((x) => (kind === "all" || x.kind === kind) && x.km <= miles * 1.609 && (!q || `${x.name} ${x.address}`.toLowerCase().includes(q)));
        return Object.fromEntries(items.map((x) => [x.id, { id: x.id, name: x.name, sub: `${x.address} · ${x.km} km` }]));
      }
      case "cab.locations.details": {
        const x = PLACES.find((l) => l.id === input.id);
        if (!x) throw new BankError("LOCATION_NOT_FOUND", "Location not found");
        return { ...x, status: x.open ? "Open" : "Closed", type: x.kind === "atm" ? "ATM" : "Branch", distanceKm: x.km, country: "Jordan", services: x.services.join(", ") };
      }

      default: return undefined;
    }
  }

  private captchaOk(input: Record<string, any>): boolean {
    const text = this.captchas[String(input.captchaKey ?? input.serviceKey ?? "")];
    return !!text && norm(input.captchaValue ?? input.value) === text;
  }
  private badLogin() {
    this.failedLogins += 1;
    if (this.failedLogins >= MAX_FAILED_LOGINS) return { ok: false, code: "LOCKED", errorCode: 10088, lockMinutes: LOCK_MINUTES };
    return { ok: false, code: "INVALID_CREDENTIALS", errorCode: 10095, attemptsLeft: MAX_FAILED_LOGINS - this.failedLogins };
  }
  private badActivation() {
    this.activationAttempts += 1;
    if (this.activationAttempts >= MAX_ACTIVATION_ATTEMPTS) return { ok: false, code: "BLOCKED", errorCode: 10747 };
    return { ok: false, code: "INVALID", errorCode: 10741, attemptsLeft: MAX_ACTIVATION_ATTEMPTS - this.activationAttempts };
  }
}

const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2");
const maskPhone = (p: string) => p.replace(/\d(?=\d{2})/g, "•");
