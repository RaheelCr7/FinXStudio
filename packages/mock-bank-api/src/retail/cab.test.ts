import { describe, it, expect } from "vitest";
import { BankError, MockBank, personasFor } from "../index";
import { passwordProblems, toIsoDate } from "./cab";

const captcha = async (b: MockBank) => (await b.call("cab.captcha.generate")) as { serviceKey: string; text: string };

describe("sandbox customers of the Cairo Amman Bank project", () => {
  it("belong to that project, and no other project or look picks them up", () => {
    expect(personasFor("meezan", "cab").map((p) => p.id)).toEqual(["nour", "sara", "yasmin", "lina", "omar"]);
    expect(personasFor("meezan").map((p) => p.id)).toEqual(["ayesha", "bilal", "zara", "hina", "acme"]);
    expect(personasFor("meezan", "unknown-project").map((p) => p.id)).toEqual(["ayesha", "bilal", "zara", "hina", "acme"]);
  });
});

describe("sign in", () => {
  it("accepts the right username and password and reports what the app shows next", async () => {
    const b = new MockBank("nour");
    const r = await b.call("cab.auth.signIn", { username: "Nour", password: "Cab@Secure123" });
    expect(r).toMatchObject({ ok: true, firstName: "Nour", accountCount: 3, currency: "JOD", defaultSignIn: "password" });
  });
  it("counts mistakes, then locks the profile on the third", async () => {
    const b = new MockBank("nour");
    expect(await b.call("cab.auth.signIn", { username: "nour", password: "nope" })).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS", errorCode: 10095, attemptsLeft: 2 });
    expect(await b.call("cab.auth.signIn", { username: "nour", password: "nope" })).toMatchObject({ code: "INVALID_CREDENTIALS", attemptsLeft: 1 });
    expect(await b.call("cab.auth.signIn", { username: "nour", password: "nope" })).toMatchObject({ code: "LOCKED", errorCode: 10088, lockMinutes: 30 });
  });
  it("treats an unknown user like a wrong password, so it does not reveal who has a profile", async () => {
    const b = new MockBank("nour");
    expect(await b.call("cab.auth.signIn", { username: "stranger", password: "x" })).toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("says so when the profile is locked, the password expired or the profile is not activated", async () => {
    expect(await new MockBank("lina").call("cab.auth.signIn", { username: "lina", password: "Cab@Secure123" })).toMatchObject({ code: "LOCKED" });
    expect(await new MockBank("omar").call("cab.auth.signIn", { username: "omar", password: "Cab@Secure123" })).toMatchObject({ code: "PASSWORD_EXPIRED", errorCode: 10135 });
    expect(await new MockBank("yasmin").call("cab.auth.signIn", { username: "yasmin", password: "anything" })).toMatchObject({ code: "INACTIVE", errorCode: 10092 });
  });
});

describe("picture code", () => {
  it("checks what was typed, ignoring case, and refuses a code that was never issued", async () => {
    const b = new MockBank("nour");
    const c = await captcha(b);
    expect(await b.call("cab.captcha.verify", { serviceKey: c.serviceKey, value: c.text.toUpperCase() })).toEqual({ ok: true });
    expect(await b.call("cab.captcha.verify", { serviceKey: c.serviceKey, value: "wrong" })).toEqual({ ok: false });
    expect(await b.call("cab.captcha.verify", { serviceKey: "never", value: c.text })).toEqual({ ok: false });
  });
});

describe("enrol", () => {
  const typed = (c: { serviceKey: string; text: string }, over = {}) => ({ captchaKey: c.serviceKey, captchaValue: c.text, lastName: "Hegazy", nationalId: "194324", dob: "01/01/2001", ...over });
  it("enrols a new customer whose details match the bank's records and sends an activation code", async () => {
    const b = new MockBank("sara");
    const r = await b.call("cab.enroll.retail", typed(await captcha(b)));
    expect(r).toMatchObject({ ok: true, firstName: "Sara", activationCodeSent: true, username: "sara" });
    expect(r.maskedEmail).toContain("@cab.com");
  });
  it("refuses a wrong picture code, details that do not match, and a customer who is already enrolled", async () => {
    const b = new MockBank("sara");
    expect(await b.call("cab.enroll.retail", { ...typed(await captcha(b)), captchaValue: "nope" })).toMatchObject({ code: "CAPTCHA_WRONG" });
    expect(await b.call("cab.enroll.retail", typed(await captcha(b), { lastName: "Someone" }))).toMatchObject({ code: "NOT_FOUND", errorCode: 10802 });
    const n = new MockBank("nour");
    expect(await n.call("cab.enroll.retail", typed(await captcha(n), { lastName: "Haddad", nationalId: "199012", dob: "01/01/2001" }))).toMatchObject({ code: "ALREADY_ENROLLED" });
  });
  it("accepts the date with spaces around the slashes, as the screen shows it", () => { expect(toIsoDate("01 / 01 / 2001")).toBe("2001-01-01"); });
});

describe("activate", () => {
  it("needs the code, blocks after three mistakes, and creates the password under the bank's rules", async () => {
    const b = new MockBank("yasmin");
    expect(await b.call("cab.activate.validate", { username: "yasmin", code: "wrong" })).toMatchObject({ code: "INVALID", errorCode: 10741, attemptsLeft: 2 });
    await expect(b.call("cab.activate.setPassword", { password: "Fresh#Pass1" })).rejects.toMatchObject({ code: "ACTIVATION_REQUIRED" });
    expect(await b.call("cab.activate.validate", { username: "Yasmin", code: "act-4821" })).toMatchObject({ ok: true });
    expect(await b.call("cab.activate.setPassword", { password: "short" })).toMatchObject({ ok: false, code: "POLICY", problems: expect.arrayContaining(["MIN_LENGTH"]) });
    expect(await b.call("cab.activate.setPassword", { password: "Fresh#Pass1", confirm: "Fresh#Pass2" })).toEqual({ ok: false, code: "MISMATCH" });
    expect(await b.call("cab.activate.setPassword", { password: "Fresh#Pass1" })).toMatchObject({ ok: true });
    expect(await b.call("cab.auth.signIn", { username: "yasmin", password: "Fresh#Pass1" })).toMatchObject({ ok: true, firstName: "Yasmin", accountCount: 0 });
  });
  it("blocks the code after three wrong attempts", async () => {
    const b = new MockBank("yasmin");
    await b.call("cab.activate.validate", { username: "yasmin", code: "x" });
    await b.call("cab.activate.validate", { username: "yasmin", code: "x" });
    expect(await b.call("cab.activate.validate", { username: "yasmin", code: "x" })).toMatchObject({ code: "BLOCKED", errorCode: 10747 });
    expect(await b.call("cab.activate.validate", { username: "yasmin", code: "ACT-4821" })).toMatchObject({ code: "BLOCKED" });
  });
  it("a customer who is not enrolled cannot activate", async () => {
    expect(await new MockBank("sara").call("cab.activate.validate", { username: "sara", code: "ACT-4821" })).toMatchObject({ ok: false });
  });
});

describe("password rules", () => {
  it("applies the four rules", () => {
    expect(passwordProblems("short", "nour")).toEqual(["MIN_LENGTH"]);
    expect(passwordProblems("aaaaaaaaaaaa", "nour")).toEqual(["DIFFERENT_CHARS"]);
    expect(passwordProblems("MyNour#2026", "nour")).toEqual(["CONTAINS_USERNAME"]);
    expect(passwordProblems("x".repeat(101), "nour")).toContain("MAX_LENGTH");
    expect(passwordProblems("Brand#New42", "nour")).toEqual([]);
  });
});

describe("can't sign in: find the customer, one-time code, new password", () => {
  const found = async (b: MockBank) => {
    const c = await captcha(b);
    return b.call("cab.recover.verifyUser", { captchaKey: c.serviceKey, captchaValue: c.text, email: "jeyose8168@cab.com", phone: "34 56 78 90", dob: "01/01/2001" });
  };
  it("finds the customer from email, phone and date of birth", async () => {
    expect(await found(new MockBank("nour"))).toMatchObject({ ok: true, username: "nour", status: "ACTIVE" });
  });
  it("does not say which detail was wrong", async () => {
    const b = new MockBank("nour"); const c = await captcha(b);
    expect(await b.call("cab.recover.verifyUser", { captchaKey: c.serviceKey, captchaValue: c.text, email: "wrong@cab.com", phone: "34 56 78 90", dob: "01/01/2001" })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await b.call("cab.recover.verifyUser", { captchaKey: "x", captchaValue: "x", email: "jeyose8168@cab.com", phone: "34 56 78 90", dob: "01/01/2001" })).toEqual({ ok: false, code: "CAPTCHA_WRONG" });
  });
  it("resets the password only after the one-time code is verified, then signs in with it", async () => {
    const b = new MockBank("nour");
    await found(b);
    await expect(b.call("cab.recover.resetPassword", { password: "Brand#New42" })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await b.call("bank.otp.send", { channel: "sms" });
    await expect(b.call("bank.otp.verify", { code: "000111" })).rejects.toMatchObject({ code: "OTP_INVALID" });
    await b.call("bank.otp.verify", { code: "482100" });
    expect(await b.call("cab.recover.resetPassword", { password: "short" })).toMatchObject({ code: "POLICY" });
    expect(await b.call("cab.recover.resetPassword", { password: "Brand#New42" })).toEqual({ ok: true });
    expect(await b.call("cab.auth.signIn", { username: "nour", password: "Brand#New42" })).toMatchObject({ ok: true });
    await expect(b.call("cab.recover.resetPassword", { password: "Another#Pass9" })).rejects.toMatchObject({ code: "OTP_REQUIRED" }); // the code is used up
  });
  it("must find the customer before resetting", async () => {
    await expect(new MockBank("nour").call("cab.recover.resetPassword", { password: "Brand#New42" })).rejects.toBeInstanceOf(BankError);
  });
});

describe("settings, language, locations", () => {
  it("sets the default sign-in, needing six digits for a PIN", async () => {
    const b = new MockBank("nour");
    await expect(b.call("cab.device.setDefault", { mode: "pin", pin: "12" })).rejects.toMatchObject({ code: "PIN_INVALID" });
    expect(await b.call("cab.device.setDefault", { mode: "pin", pin: "123456" })).toEqual({ ok: true, default: "pin" });
    expect(await b.call("cab.device.options")).toMatchObject({ default: "pin", pinSet: true });
    expect(await b.call("cab.device.verifyPin", { pin: "123456" })).toMatchObject({ ok: true, firstName: "Nour", accountCount: expect.any(Number), currency: "JOD" }); // a right PIN signs the remembered person in
    expect(await b.call("cab.device.verifyPin", { pin: "000000" })).toEqual({ ok: false });
  });
  it("switches account preview and shows the balances", async () => {
    const b = new MockBank("nour");
    expect(await b.call("cab.preview.set", { enabled: true })).toEqual({ ok: true, enabled: true });
    const p = await b.call("cab.preview.get");
    expect(p.enabled).toBe(true);
    expect(Object.keys(p.accounts)).toHaveLength(3);
    expect(p.accounts.cab_cur).toMatchObject({ name: "Kmart Corporation", maskedNumber: "••0375", type: "Current Account", note: "Available balance" });
  });
  it("changes language to one the app offers", async () => {
    const b = new MockBank("nour");
    expect(await b.call("cab.language.set", { code: "ar_AE" })).toMatchObject({ ok: true, name: "Arabic" });
    await expect(b.call("cab.language.set", { code: "xx" })).rejects.toMatchObject({ code: "LANGUAGE_UNSUPPORTED" });
    expect(await b.call("cab.language.selection", {})).toEqual({ code: "ar_AE", name: "Arabic" }); // the one in use
    expect(await b.call("cab.language.selection", { chosen: "fr_FR" })).toEqual({ code: "fr_FR", name: "French" }); // the one picked so far
    expect(await b.call("cab.language.selection", { chosen: "xx" })).toEqual({ code: "ar_AE", name: "Arabic" }); // an unknown pick falls back
  });
  it("finds branches and ATMs by kind, range and text, and gives the details of one", async () => {
    const b = new MockBank("nour");
    expect(Object.keys(await b.call("cab.locations.search", { kind: "branch", rangeMiles: 5 })).length).toBe(2);
    expect(Object.keys(await b.call("cab.locations.search", { kind: "atm", rangeMiles: 5 })).length).toBe(1);
    expect(Object.keys(await b.call("cab.locations.search", { kind: "all", rangeMiles: 100 })).length).toBe(5);
    expect(Object.keys(await b.call("cab.locations.search", { kind: "all", rangeMiles: 100, query: "irbid" })).length).toBe(1);
    expect(await b.call("cab.locations.details", { id: "loc_abdoun" })).toMatchObject({ type: "Branch", status: "Open", distanceKm: 2.2 });
    await expect(b.call("cab.locations.details", { id: "nope" })).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });
});

describe("remembered person and map pins", () => {
  it("greets an active profile by name, and nobody else", async () => {
    expect((await new MockBank("nour").call("cab.device.options", {})).firstName).toBe("Nour");
    expect((await new MockBank("yasmin").call("cab.device.options", {})).firstName).toBe(""); // not activated yet
  });
  it("a PIN does not sign in a profile that is locked", async () => {
    const b = new MockBank("lina"); await b.call("cab.device.setDefault", { mode: "pin", pin: "123456" });
    expect(await b.call("cab.device.verifyPin", { pin: "123456" })).toEqual({ ok: false });
  });
  it("every location in a search has a position for the map", async () => {
    const found = await new MockBank("nour").call("cab.locations.search", { kind: "all", rangeMiles: 100 });
    const places = Object.values(found) as any[];
    expect(places.length).toBeGreaterThan(3);
    for (const p of places) { expect(p.lat).toBeGreaterThan(31); expect(p.lat).toBeLessThan(33); expect(p.lng).toBeGreaterThan(35); expect(p.lng).toBeLessThan(37); }
  });
});
