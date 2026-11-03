/** Sandbox identity services for the corporate web sign-in journeys: can't sign in, enroll, activate. No real people. */
import { BankError } from "./index";

export type AuthUser = {
  username: string; name: string; email: string; mobile: string; dob: string; taxId: string; lastName: string;
  legalEntityId: string; enrolled: boolean; activation: "valid" | "blocked" | "expired" | "none"; activationCode: string;
};

export const AUTH_USERS: AuthUser[] = [
  { username: "jsmith", name: "John Smith", email: "john.smith@acme-corp.example", mobile: "+44 7700 900123", dob: "1985-04-12", taxId: "123-45-6789", lastName: "Smith", legalEntityId: "GB0010001", enrolled: false, activation: "valid", activationCode: "ACT-4821" },
  { username: "jsmith.fin", name: "John Smith (Finance)", email: "john.smith@acme-corp.example", mobile: "+44 7700 900123", dob: "1985-04-12", taxId: "123-45-6789", lastName: "Smith", legalEntityId: "NL0020001", enrolled: true, activation: "none", activationCode: "" },
  { username: "jsmith.ops", name: "John Smith (Operations)", email: "john.smith@acme-corp.example", mobile: "+44 7700 900123", dob: "1985-04-12", taxId: "123-45-6789", lastName: "Smith", legalEntityId: "GB0010001", enrolled: true, activation: "none", activationCode: "" },
  { username: "locked.user", name: "Locked User", email: "locked@acme-corp.example", mobile: "+44 7700 900654", dob: "1982-03-03", taxId: "444-44-4444", lastName: "Locked", legalEntityId: "GB0010001", enrolled: true, activation: "none", activationCode: "" },
  { username: "mbrown", name: "Maria Brown", email: "maria.brown@acme-corp.example", mobile: "+44 7700 900456", dob: "1990-09-30", taxId: "111-11-1111", lastName: "Brown", legalEntityId: "GB0010001", enrolled: true, activation: "none", activationCode: "" },
  { username: "blocked.user", name: "Blocked User", email: "blocked@acme-corp.example", mobile: "+44 7700 900789", dob: "1980-01-01", taxId: "222-22-2222", lastName: "Blocked", legalEntityId: "GB0010001", enrolled: false, activation: "blocked", activationCode: "ACT-0001" },
  { username: "expired.user", name: "Expired User", email: "expired@acme-corp.example", mobile: "+44 7700 900987", dob: "1980-02-02", taxId: "333-33-3333", lastName: "Expired", legalEntityId: "GB0010001", enrolled: false, activation: "expired", activationCode: "ACT-0002" },
];

export const LEGAL_ENTITIES = [
  { id: "GB0010001", name: "Acme Corporate UK" },
  { id: "NL0020001", name: "Acme Corporate Netherlands" },
];

export const PASSWORD_RULES = { minLength: 8, maxLength: 20, atLeastNumber: true, atLeastUpper: true, atLeastLower: true, atLeastSymbol: true, maxRepeat: 3 };
/** The rules above as one regular expression, for a textInput pattern. */
export const PASSWORD_PATTERN = "^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{8,20}$";
const CAPTCHAS = ["K7M2Q", "R4T9X", "B6W3N"];

export const passwordProblem = (pw: string): string | null => {
  const r = PASSWORD_RULES;
  if (pw.length < r.minLength || pw.length > r.maxLength) return "length";
  if (!/[0-9]/.test(pw) || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) return "composition";
  if (new RegExp(`(.)\\1{${r.maxRepeat},}`).test(pw)) return "repeat";
  return null;
};

export class AuthSandbox {
  private captchaIx = 0;
  private serviceKey: string | null = null;
  private forUser: string | null = null;
  private keySeq = 0;
  /** Chosen by a person while the journey runs; passwords are not stored, only that one was set. */
  readonly passwordSet = new Set<string>();
  /** Sandbox passwords. A password set through can't-sign-in or activation works for sign-in afterwards. */
  private passwords = new Map<string, string>([["jsmith.ops", "Passw0rd!"], ["mbrown", "Passw0rd!"], ["locked.user", "Passw0rd!"]]);
  private setPassword(username: string | null, password: string) { if (username) { this.passwordSet.add(username); this.passwords.set(username, password); } }
  /** Corporate web sign-in. The bank decides what the message says; the page shows it. */
  signIn(username: string, password: string): { personaId: string; username: string } {
    const user = AUTH_USERS.find((u) => u.username === username.trim());
    if (user?.username === "locked.user") throw new BankError("USER_LOCKED", "Your profile is locked");
    if (!user || this.passwords.get(user.username) !== password) throw new BankError("INVALID_CREDENTIALS", "Incorrect username or password");
    return { personaId: "john", username: user.username };
  }

  private checkCaptcha(value: unknown) {
    if (String(value ?? "").trim().toUpperCase() !== CAPTCHAS[this.captchaIx]) {
      throw new BankError("CAPTCHA_INVALID", "Invalid captcha");
    }
  }
  private newKey(username: string) { this.keySeq += 1; this.serviceKey = `sk-${this.keySeq}`; this.forUser = username; return this.serviceKey; }
  private digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "auth.legalEntities.list":
        return Object.fromEntries(LEGAL_ENTITIES.map((e) => [e.id, e]));
      case "auth.captcha.new":
        this.captchaIx = (this.captchaIx + 1) % CAPTCHAS.length;
        return { text: CAPTCHAS[this.captchaIx] };
      case "auth.captcha.current":
        return { text: CAPTCHAS[this.captchaIx] };
      case "auth.passwordRules.get":
        return { ...PASSWORD_RULES, pattern: PASSWORD_PATTERN };
      case "auth.user.verify": {
        this.checkCaptcha(input.captcha);
        const hits = AUTH_USERS.filter((u) => u.enrolled && u.email.toLowerCase() === String(input.email ?? "").trim().toLowerCase() && this.digits(u.mobile) === this.digits(input.mobile) && u.dob === String(input.dob ?? "").trim());
        if (hits.length === 0) { this.captchaIx = (this.captchaIx + 1) % CAPTCHAS.length; return { outcome: "notfound", count: 0 }; }
        const key = this.newKey(hits[0]!.username);
        return { outcome: "found", serviceKey: key, usernames: Object.fromEntries(hits.map((u) => [u.username, { id: u.username, name: u.username }])), count: hits.length, username: hits[0]!.username };
      }
      case "auth.user.usernames":
        return Object.fromEntries(AUTH_USERS.filter((u) => u.username === this.forUser || (this.forUser && AUTH_USERS.find((x) => x.username === this.forUser)?.email === u.email && u.enrolled)).map((u) => [u.username, { id: u.username, name: u.username }]));
      case "auth.password.reset": {
        if (!this.serviceKey || input.serviceKey !== this.serviceKey) throw new BankError("SESSION_EXPIRED", "Start again");
        if (String(input.password) !== String(input.confirm)) throw new BankError("PASSWORD_MISMATCH", "Passwords do not match");
        if (passwordProblem(String(input.password))) throw new BankError("PASSWORD_INVALID", "Password does not meet the rules");
        // someone with several usernames picks which one to reset; anything not on the verified profile is ignored
        const picked = String(input.username ?? "");
        const sameProfile = AUTH_USERS.find((u) => u.username === picked)?.email === AUTH_USERS.find((u) => u.username === this.forUser)?.email;
        this.setPassword(picked && sameProfile ? picked : this.forUser, String(input.password));
        this.serviceKey = null;
        return { reset: true };
      }
      case "auth.enroll.verify": {
        this.checkCaptcha(input.captcha);
        const u = AUTH_USERS.find((x) => x.taxId === String(input.taxId ?? "").trim() && x.lastName.toLowerCase() === String(input.lastName ?? "").trim().toLowerCase() && x.dob === String(input.dob ?? "").trim());
        // A wrong captcha is an error (the person retypes it); the three outcomes below are answers the journey branches on.
        if (!u) { this.captchaIx = (this.captchaIx + 1) % CAPTCHAS.length; return { outcome: "notfound" }; }
        if (u.enrolled) return { outcome: "already", name: u.name };
        return { outcome: "enrolled", name: u.name };
      }
      case "auth.activation.verify": {
        const u = AUTH_USERS.find((x) => x.username === String(input.username ?? "").trim());
        const right = !!u && u.activationCode !== "" && u.activationCode === String(input.code);
        if (right && u!.activation === "blocked") return { outcome: "blocked" };
        if (right && u!.activation === "expired") return { outcome: "expired" };
        if (!right || u!.activation !== "valid") return { outcome: "invalid" };
        return { outcome: "ok", serviceKey: this.newKey(u!.username), name: u!.name };
      }
      case "auth.activation.setPassword": {
        if (!this.serviceKey || input.serviceKey !== this.serviceKey) throw new BankError("SESSION_EXPIRED", "Start again");
        if (String(input.password) !== String(input.confirm)) throw new BankError("PASSWORD_MISMATCH", "Passwords do not match");
        if (passwordProblem(String(input.password))) throw new BankError("PASSWORD_INVALID", "Password does not meet the rules");
        this.setPassword(this.forUser, String(input.password));
        this.serviceKey = null;
        return { activated: true };
      }
      default:
        throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
    }
  }
}
