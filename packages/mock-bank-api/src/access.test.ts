import { describe, it, expect } from "vitest";
import { ACCESS, AccessDirectory, MockBank, SIGNED_OUT, personas, secretHash, sha256, type SandboxConditions } from "./index";

// Tuesday 3 November 2026, ten in the morning (UTC)
const NOW = Date.parse("2026-11-03T10:00:00Z");
const PW = "Bwx!Demo2026";
function make(opts: { persona?: string; conditions?: SandboxConditions; directory?: AccessDirectory; config?: Record<string, Record<string, unknown>> } = {}) {
  const b = new MockBank(opts.persona ?? SIGNED_OUT, { conditions: opts.conditions, directory: opts.directory, config: opts.config ? { options: opts.config } : undefined });
  let t = NOW; b.now = () => t;
  return { b, tick: (sec: number) => { t += sec * 1000; } };
}
const err = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const signIn = (b: MockBank, username = "alex.morgan", password = PW) => b.call("bank.auth.signIn", { username, password });
const code = async (b: MockBank, c = "482100") => { await b.call("bank.otp.send"); return b.call("bank.otp.verify", { code: c }); };
/** Sign in from a device the customer knows: no code. */
const known: SandboxConditions = { device: "known" };

describe("the sandbox's own hash", () => {
  it("is SHA-256: it matches the published test vectors", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("a".repeat(100))).toBe("2816597888e4a0d3a36b82b83316ab32680eb8f00f8cd3b904d681246d285a0e");
  });
  it("salts a secret by its owner and never returns it", () => {
    expect(secretHash("same", "a")).not.toBe(secretHash("same", "b"));
    expect(secretHash("same", "a")).not.toContain("same");
  });
});

describe("a bank nobody is signed in to", () => {
  it("answers only the sign-in and recovery adapters", async () => {
    const { b } = make();
    expect(b.signedIn).toBe(false);
    for (const a of ["bank.accounts.list", "bank.session.get", "bank.devices.list", "bank.password.change", "corp.payments.list"]) expect(await err(b.call(a))).toBe("NOT_SIGNED_IN");
    expect(await err(b.call("bank.app.config"))).toBe("no error");
    expect(await err(b.call("bank.otp.send"))).toBe("VERIFY_FIRST");
  });
  it("is not one of the customers the apps offer, and the new sign-in cast stays out of the picker", () => {
    expect(Object.keys(personas)).not.toContain(SIGNED_OUT);
    for (const id of ["demolocked", "demoexpired", "demoinactive", "demonew"]) expect(personas[id]!.testCast).toBe(true);
  });
});

describe("bank.auth.signIn", () => {
  it("a right password on a known device needs no code and signs in at the end", async () => {
    const { b } = make({ conditions: known });
    const r = await signIn(b);
    expect(r).toMatchObject({ ok: true, status: "ok", firstName: "Alex", deviceKnown: true });
    expect(b.signedIn).toBe(false); // the password alone has not opened a session yet
    const done = await b.call("bank.auth.completeSignIn", {});
    expect(done).toMatchObject({ ok: true, username: "alex.morgan", how: "password", deviceTrusted: true, passwordChanged: false });
    expect(b.signedIn).toBe(true);
    expect(b.persona.id).toBe("alex");
    expect((await b.call("bank.session.get")).identity).toMatchObject({ id: "alex" });
    expect(Object.keys((await b.call("bank.accounts.list")))).toContain("acc_main");
  });
  it("a new device asks for a code before the session opens; an unusual sign-in does too unless the bank switched that off", async () => {
    const a = make({ conditions: { device: "new" } });
    expect(await signIn(a.b)).toMatchObject({ ok: true, status: "otp", deviceKnown: false });
    expect(await err(a.b.call("bank.auth.completeSignIn", {}))).toBe("OTP_REQUIRED");
    const u = make({ conditions: { device: "unusual" } });
    expect(await signIn(u.b)).toMatchObject({ status: "otp", deviceKnown: true });
    const off = make({ conditions: { device: "unusual" }, config: { "sign-in": { riskStepUp: false } } });
    expect(await signIn(off.b)).toMatchObject({ status: "ok" });
  });
  it("a wrong password and an unknown username answer alike, count alike, and the fifth locks; the answer never contains the password", async () => {
    const { b } = make({ conditions: known });
    const wrong = await signIn(b, "alex.morgan", "nope-nope-nope");
    expect(wrong).toEqual({ ok: false, code: "INVALID_CREDENTIALS", attemptsLeft: 4 });
    const nobody = await signIn(b, "nobody", "nope-nope-nope");
    expect(nobody).toEqual({ ok: false, code: "INVALID_CREDENTIALS", attemptsLeft: 4 });
    for (const left of [3, 2, 1]) expect(await signIn(b, "alex.morgan", "x".repeat(12))).toMatchObject({ code: "INVALID_CREDENTIALS", attemptsLeft: left });
    expect(await signIn(b, "alex.morgan", "x".repeat(12))).toEqual({ ok: false, code: "LOCKED", lockMinutes: 30 });
    expect(await signIn(b, "alex.morgan")).toEqual({ ok: false, code: "LOCKED", lockMinutes: 30 }); // the right password no longer helps
    expect(JSON.stringify([wrong, nobody])).not.toContain("x".repeat(12));
    for (let i = 0; i < 4; i++) await signIn(b, "nobody", "x");
    expect(await signIn(b, "nobody", "x")).toEqual({ ok: false, code: "LOCKED", lockMinutes: 30 }); // an unknown name locks the same way
  });
  it("a right password sets the count back to zero", async () => {
    const { b } = make({ conditions: known });
    await signIn(b, "alex.morgan", "x"); await signIn(b, "alex.morgan", "x");
    await signIn(b);
    expect(await signIn(b, "alex.morgan", "x")).toMatchObject({ attemptsLeft: 4 });
  });
  it("a lock ends by itself after 30 minutes, but a seeded lock only by unlocking", async () => {
    const { b, tick } = make({ conditions: known });
    for (let i = 0; i < 5; i++) await signIn(b, "alex.morgan", "x");
    tick(29 * 60); expect(await signIn(b)).toMatchObject({ code: "LOCKED" });
    tick(61); expect(await signIn(b)).toMatchObject({ ok: true });
    const seeded = make({ conditions: known });
    seeded.tick(365 * 86400);
    expect(await signIn(seeded.b, "demo.locked")).toMatchObject({ code: "LOCKED" });
  });
  it("a profile that is not active cannot sign in; an expired one must choose a password, and so must a temporary one", async () => {
    const { b } = make({ conditions: { device: "new" } });
    expect(await signIn(b, "demo.inactive")).toEqual({ ok: false, code: "INACTIVE" });
    // these customers have no trusted device, so the code comes first and then the new password
    expect(await signIn(b, "demo.expired")).toMatchObject({ ok: true, status: "otp", reason: "expired" });
    await code(b);
    expect(await err(b.call("bank.auth.completeSignIn", {}))).toBe("PASSWORD_REQUIRED");
    expect(await signIn(b, "new.user")).toMatchObject({ status: "otp", reason: "temporary" });
    const off = make({ conditions: { device: "new" }, config: { "sign-in": { forceExpiry: false } } });
    expect(await signIn(off.b, "demo.expired")).toMatchObject({ reason: null });
    await code(off.b);
    expect(await off.b.call("bank.auth.completeSignIn", {})).toMatchObject({ ok: true, passwordChanged: false });
  });
  it("the demo password is not in any answer", async () => {
    const { b } = make({ conditions: { device: "new" } });
    const seen = [await signIn(b), await b.call("bank.device.options"), await code(b), await b.call("bank.password.policy", { password: "x" })];
    expect(JSON.stringify(seen)).not.toContain(PW);
    expect(JSON.stringify(seen)).not.toMatch(/hash|482100/i);
  });
});

describe("the one-time code of a sign-in", () => {
  it("goes to the customer who is signing in, masked; 000000 is wrong and 999999 expired", async () => {
    const { b } = make({ conditions: { device: "new" } });
    await signIn(b);
    expect(await b.call("bank.otp.send")).toMatchObject({ sent: true, maskedPhone: "+1 ••• ••• 0142" });
    expect(await err(b.call("bank.otp.verify", { code: "000000" }))).toBe("OTP_INVALID");
    expect(await err(b.call("bank.otp.verify", { code: "999999" }))).toBe("OTP_EXPIRED");
    expect(await b.call("bank.otp.verify", { code: "482100" })).toEqual({ verified: true });
  });
  it("runs out after five minutes on the sandbox clock", async () => {
    const { b, tick } = make({ conditions: { device: "new" } });
    await signIn(b); await b.call("bank.otp.send"); tick(301);
    expect(await err(b.call("bank.otp.verify", { code: "482100" }))).toBe("OTP_EXPIRED");
    await b.call("bank.otp.send");
    expect(await b.call("bank.otp.verify", { code: "482101" })).toEqual({ verified: true });
  });
  it("a new code makes the old one useless, and a fourth resend is refused", async () => {
    const { b } = make({ conditions: { device: "new" } });
    await signIn(b); await b.call("bank.otp.send"); await b.call("bank.otp.send");
    expect(await err(b.call("bank.otp.verify", { code: "482100" }))).toBe("OTP_INVALID");
    expect(await b.call("bank.otp.send")).toMatchObject({ resendsLeft: 1 });
    await b.call("bank.otp.send");
    expect(await err(b.call("bank.otp.send"))).toBe("OTP_RESEND_LIMIT");
  });
  it("five wrong codes lock the profile", async () => {
    const { b } = make({ conditions: { device: "new" } });
    await signIn(b); await b.call("bank.otp.send");
    for (let i = 1; i <= 4; i++) expect(await err(b.call("bank.otp.verify", { code: "111111" }))).toBe("OTP_INVALID");
    expect(await err(b.call("bank.otp.verify", { code: "111111" }))).toBe("ACCOUNT_LOCKED");
    expect(await signIn(b)).toMatchObject({ code: "LOCKED" });
  });
});

describe("the steps after the password", () => {
  it("a new password is checked against the rules, the first problem is the code, and a good one signs in with the old one gone", async () => {
    const dir = new AccessDirectory();
    const { b } = make({ conditions: { device: "new" }, directory: dir });
    await signIn(b, "demo.expired"); await code(b);
    const bad: [string, string][] = [["short", "MIN_LENGTH"], ["x".repeat(65), "MAX_LENGTH"], ["my-demo.expired-pass-1", "PASSWORD_CONTAINS_USERNAME"], ["Password123!Password", "PASSWORD_COMMON"], ["Winter2024!Winter", "PASSWORD_BREACHED"], [PW, "PASSWORD_REUSED"]];
    for (const [pw, c] of bad) expect(await b.call("bank.auth.changePassword", { newPassword: pw, confirm: pw })).toMatchObject({ ok: false, code: c });
    expect(await b.call("bank.auth.changePassword", { newPassword: "Granite-Lemon-92-River", confirm: "other" })).toEqual({ ok: false, code: "MISMATCH" });
    expect(await b.call("bank.auth.changePassword", { newPassword: "Granite-Lemon-92-River", confirm: "Granite-Lemon-92-River" })).toMatchObject({ ok: true });
    expect(await b.call("bank.auth.completeSignIn", {})).toMatchObject({ ok: true, passwordChanged: true, username: "demo.expired" });
    // the new password works, the old one does not
    const again = make({ conditions: { device: "new" }, directory: dir });
    expect(await signIn(again.b, "demo.expired", "Granite-Lemon-92-River")).toMatchObject({ ok: true, reason: null });
    expect(await signIn(again.b, "demo.expired", PW)).toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("a change of password is not allowed to someone who does not have to choose one, or before the code", async () => {
    const { b } = make({ conditions: known });
    await signIn(b);
    expect(await err(b.call("bank.auth.changePassword", { newPassword: "Granite-Lemon-92-River" }))).toBe("NOT_REQUIRED");
    const n = make({ conditions: { device: "new" } });
    await signIn(n.b, "demo.expired");
    expect(await err(n.b.call("bank.auth.changePassword", { newPassword: "Granite-Lemon-92-River" }))).toBe("OTP_REQUIRED");
  });
  it("trusting a device needs a name and keeps it for 90 days; not trusting it leaves nothing behind", async () => {
    const dir = new AccessDirectory();
    const first = make({ conditions: { device: "new" }, directory: dir });
    await signIn(first.b); await code(first.b);
    expect(await first.b.call("bank.auth.trustDevice", { name: "" })).toEqual({ ok: false, code: "NAME_REQUIRED" });
    expect(await first.b.call("bank.auth.trustDevice", { name: "Spare" })).toMatchObject({ ok: true, expiresInDays: 90 });
    expect(await first.b.call("bank.auth.completeSignIn", {})).toMatchObject({ deviceTrusted: true, deviceTrustedDays: 90 });
    expect(dir.find("alex.morgan")!.devices.map((d) => d.name)).toContain("Spare");
    const second = make({ conditions: { device: "new" }, directory: new AccessDirectory() });
    await signIn(second.b); await code(second.b);
    expect(await second.b.call("bank.auth.completeSignIn", {})).toMatchObject({ deviceTrusted: false, deviceTrustedDays: 0 });
  });
  it("the device limit stops a sixth trusted device", async () => {
    const dir = new AccessDirectory();
    const user = dir.find("sam.rivera")!;
    for (let i = 0; i < 5; i++) user.devices.push({ id: `dev_s${i}`, name: `s${i}`, kind: "phone", trusted: true, trustedUntil: NOW + 86400000 * 30, lastUsed: NOW, default: "password", pinFails: 0, biometricAvailable: true, remembered: false });
    const { b } = make({ conditions: { device: "new" }, directory: dir });
    await signIn(b, "sam.rivera"); await code(b);
    expect(await b.call("bank.auth.trustDevice", { name: "Sixth" })).toMatchObject({ ok: false, code: "DEVICE_LIMIT", max: 5 });
  });
  it("trusted for 90 days, then it asks for a code again", async () => {
    const dir = new AccessDirectory();
    const a = make({ conditions: { device: "new" }, directory: dir });
    await signIn(a.b); await code(a.b); await a.b.call("bank.auth.trustDevice", { name: "My phone" }); await a.b.call("bank.auth.completeSignIn", {});
    // the same device on the next visit (the app tells the sandbox which device it is)
    const same = new MockBank(SIGNED_OUT, { directory: dir, device: { id: "dev_new", name: "This device", kind: "browser" } });
    let t = NOW + 89 * 86400000; same.now = () => t;
    expect(await signIn(same)).toMatchObject({ status: "ok", deviceKnown: true });
    t = NOW + 91 * 86400000;
    expect(await signIn(same)).toMatchObject({ status: "otp", deviceKnown: false });
  });
  it("quick sign-in: a PIN is six digits, not weak and not part of the phone number; it needs a trusted device", async () => {
    const { b } = make({ conditions: known });
    await signIn(b);
    const pin = (p: string) => b.call("bank.auth.setQuickSignIn", { method: "pin", pin: p });
    for (const [p, c] of [["12345", "PIN_INVALID"], ["111111", "PIN_WEAK"], ["123456", "PIN_WEAK"], ["654321", "PIN_WEAK"], ["121212", "PIN_WEAK"], ["112233", "PIN_WEAK"], ["014204", "PIN_PHONE"]] as const) expect(await pin(p), p).toMatchObject({ ok: false, code: c });
    expect(await pin("504719")).toMatchObject({ ok: true, method: "pin", device: "iPhone 15" });
    expect(await b.call("bank.auth.setQuickSignIn", { method: "passkey" })).toMatchObject({ ok: true, method: "passkey" });
    const n = make({ conditions: { device: "new" } });
    await signIn(n.b); await code(n.b);
    expect(await n.b.call("bank.auth.setQuickSignIn", { method: "pin", pin: "504719" })).toEqual({ ok: false, code: "DEVICE_NOT_TRUSTED" });
  });
  it("a remembered username greets the person, and a quick PIN signs in without the password; wrong PINs share the lock", async () => {
    const dir = new AccessDirectory();
    const a = make({ conditions: known, directory: dir });
    await signIn(a.b); await a.b.call("bank.auth.setQuickSignIn", { method: "pin", pin: "504719" }); await a.b.call("bank.auth.completeSignIn", { remember: true });
    const next = make({ conditions: known, directory: dir });
    expect(await next.b.call("bank.device.options")).toMatchObject({ default: "pin", pinSet: true, firstName: "Alex", username: "alex.morgan" });
    expect(await next.b.call("bank.auth.quickSignIn", { method: "pin", pin: "111111" })).toEqual({ ok: false, code: "QUICK_PIN_INVALID", attemptsLeft: 4 });
    expect(await next.b.call("bank.auth.quickSignIn", { method: "pin", pin: "504719" })).toMatchObject({ ok: true });
    expect(await next.b.call("bank.auth.completeSignIn", {})).toMatchObject({ ok: true, how: "quick-pin" });
    expect(next.b.signedIn).toBe(true);
  });
  it("three wrong quick PINs turn quick sign-in off on that device", async () => {
    const dir = new AccessDirectory();
    const a = make({ conditions: known, directory: dir });
    await signIn(a.b); await a.b.call("bank.auth.setQuickSignIn", { method: "pin", pin: "504719" }); await a.b.call("bank.auth.completeSignIn", { remember: true });
    const n = make({ conditions: known, directory: dir });
    await n.b.call("bank.auth.quickSignIn", { method: "pin", pin: "111111" }); await n.b.call("bank.auth.quickSignIn", { method: "pin", pin: "111111" });
    expect(await n.b.call("bank.auth.quickSignIn", { method: "pin", pin: "111111" })).toEqual({ ok: false, code: "QUICK_OFF" });
    expect(await n.b.call("bank.device.options")).toMatchObject({ default: "password", pinSet: false });
  });
  it("a person who did not tick \"remember\" is not greeted by name", async () => {
    const dir = new AccessDirectory();
    const a = make({ conditions: known, directory: dir });
    await signIn(a.b); await a.b.call("bank.auth.completeSignIn", { remember: false });
    expect(await make({ conditions: known, directory: dir }).b.call("bank.device.options")).toMatchObject({ firstName: "", username: "" });
  });
});

describe("recovering a username or a password", () => {
  const start = async (b: MockBank, input: Record<string, unknown>) => b.call("bank.recover.verifyUser", input);
  it("forgot username: the contact and the date of birth together; a miss never says which part failed; the third locks", async () => {
    const { b } = make();
    expect(await start(b, { mobile: "(415) 555-0142", dateOfBirth: "1988-03-14" })).toMatchObject({ ok: true, maskedContact: "••• 0142" });
    expect(await start(b, { email: "alex.morgan@example.com", dateOfBirth: "14/03/1988" })).toMatchObject({ ok: true, maskedContact: "a•••@example.com" });
    expect(await start(b, { mobile: "4155550142", dateOfBirth: "1990-01-01" })).toEqual({ ok: false, code: "NOT_FOUND", attemptsLeft: 2 });
    expect(await start(b, { mobile: "4155550000", dateOfBirth: "1988-03-14" })).toEqual({ ok: false, code: "NOT_FOUND", attemptsLeft: 1 });
    expect(await start(b, { mobile: "4155550142", dateOfBirth: "1990-01-01" })).toEqual({ ok: false, code: "ID_LOCKED", lockMinutes: 30 });
    expect(await start(b, { mobile: "(415) 555-0142", dateOfBirth: "1988-03-14" })).toMatchObject({ code: "ID_LOCKED" });
  });
  it("sends the username to the contact on file, not to the answer; the answer carries no username", async () => {
    const dir = new AccessDirectory();
    const { b } = make({ directory: dir });
    const found = await start(b, { mobile: "4155550142", dateOfBirth: "1988-03-14" });
    expect(await err(b.call("bank.recover.sendUsername", { recoveryToken: found.recoveryToken }))).toBe("OTP_REQUIRED");
    await code(b);
    const sent = await b.call("bank.recover.sendUsername", { recoveryToken: found.recoveryToken });
    expect(sent).toEqual({ sent: true, maskedContact: "••• 0142" });
    expect(JSON.stringify([found, sent])).not.toContain("alex.morgan");
    expect(dir.outbox).toHaveLength(1);
    // used once
    expect(await err(b.call("bank.recover.sendUsername", { recoveryToken: found.recoveryToken }))).toBe("TOKEN_INVALID");
  });
  it("reset: by username or email; the code goes to the mobile on file; a reset clears the lock, works at sign-in, and the old password does not", async () => {
    const dir = new AccessDirectory();
    const { b } = make({ directory: dir, conditions: known });
    for (let i = 0; i < 5; i++) await signIn(b, "alex.morgan", "x");
    expect(await signIn(b)).toMatchObject({ code: "LOCKED" });
    const found = await start(b, { usernameOrEmail: "alex.morgan@example.com" });
    expect(found).toMatchObject({ ok: true, maskedMobile: "••• 0142" });
    expect(await b.call("bank.otp.send")).toMatchObject({ maskedPhone: "••• 0142" });
    expect(await err(b.call("bank.recover.resetPassword", { recoveryToken: found.recoveryToken, password: "Granite-Lemon-92-River" }))).toBe("OTP_REQUIRED");
    await b.call("bank.otp.verify", { code: "482100" });
    expect(await b.call("bank.recover.resetPassword", { recoveryToken: found.recoveryToken, password: "short", confirm: "short" })).toMatchObject({ ok: false, code: "MIN_LENGTH" });
    expect(await b.call("bank.recover.resetPassword", { recoveryToken: found.recoveryToken, password: PW, confirm: PW })).toMatchObject({ ok: false, code: "PASSWORD_REUSED" });
    expect(await b.call("bank.recover.resetPassword", { recoveryToken: found.recoveryToken, password: "Granite-Lemon-92-River", confirm: "Granite-Lemon-92-River" })).toMatchObject({ ok: true, username: "alex.morgan" });
    const after = make({ directory: dir, conditions: known });
    expect(await signIn(after.b, "alex.morgan", "Granite-Lemon-92-River")).toMatchObject({ ok: true });
    expect(await signIn(after.b, "alex.morgan", PW)).toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("unlock keeps the password, says whether the profile was locked, and a token is used once", async () => {
    const dir = new AccessDirectory();
    const a = make({ directory: dir, conditions: known });
    const found = await start(a.b, { usernameOrEmail: "demo.locked" }); await code(a.b);
    expect(await a.b.call("bank.recover.unlock", { recoveryToken: found.recoveryToken })).toEqual({ ok: true, wasLocked: true, username: "demo.locked" });
    expect(await err(a.b.call("bank.recover.unlock", { recoveryToken: found.recoveryToken }))).toBe("TOKEN_INVALID");
    expect(await signIn(a.b, "demo.locked")).toMatchObject({ ok: true }); // the old password works
    const n = make({ directory: dir, conditions: known });
    const again = await start(n.b, { usernameOrEmail: "sam.rivera" }); await code(n.b);
    expect(await n.b.call("bank.recover.unlock", { recoveryToken: again.recoveryToken })).toMatchObject({ wasLocked: false });
  });
  it("the reset token runs out after ten minutes, and a token that is not the current one is refused", async () => {
    const { b, tick } = make();
    const found = await start(b, { usernameOrEmail: "alex.morgan" }); await code(b);
    expect(await err(b.call("bank.recover.resetPassword", { recoveryToken: "rt_other", password: "Granite-Lemon-92-River" }))).toBe("TOKEN_INVALID");
    tick(ACCESS.tokenSeconds + 1);
    expect(await err(b.call("bank.recover.resetPassword", { recoveryToken: found.recoveryToken, password: "Granite-Lemon-92-River" }))).toBe("TOKEN_EXPIRED");
    expect(await err(b.call("bank.recover.resetPassword", { recoveryToken: found.recoveryToken, password: "Granite-Lemon-92-River" }))).toBe("TOKEN_INVALID");
  });
  it("three wrong identity checks or codes lock the recovery", async () => {
    const { b } = make();
    await start(b, { usernameOrEmail: "nobody" }); await start(b, { usernameOrEmail: "nobody" });
    expect(await start(b, { usernameOrEmail: "nobody" })).toMatchObject({ code: "ID_LOCKED" });
    const c = make();
    await start(c.b, { usernameOrEmail: "alex.morgan" }); await c.b.call("bank.otp.send");
    await err(c.b.call("bank.otp.verify", { code: "111111" })); await err(c.b.call("bank.otp.verify", { code: "111111" }));
    expect(await err(c.b.call("bank.otp.verify", { code: "111111" }))).toBe("ID_LOCKED");
  });
  it("the used-before rule is only checked for someone the bank knows, so a stranger cannot try a person's old passwords", async () => {
    const { b } = make();
    expect(await b.call("bank.password.policy", { username: "alex.morgan", password: PW })).toMatchObject({ ok: true });
    const found = await start(b, { usernameOrEmail: "alex.morgan" });
    expect(await b.call("bank.password.policy", { password: PW, recoveryToken: found.recoveryToken })).toMatchObject({ ok: false, problems: ["PASSWORD_REUSED"] });
  });
});

describe("what a signed-in customer manages", () => {
  const alex = () => make({ persona: "alex" });
  it("lists the trusted devices, this one first, and removes one after a code", async () => {
    const { b } = alex();
    const list = await b.call("bank.devices.list");
    expect(list.max).toBe(5);
    expect(list.items.map((d: any) => [d.name, d.current])).toEqual([["iPhone 15", true], ["Work laptop, Chrome", false], ["Android tablet", false]]);
    expect(await err(b.call("bank.devices.remove", { deviceId: "dev_laptop" }))).toBe("OTP_REQUIRED");
    await code(b);
    expect(await b.call("bank.devices.remove", { deviceId: "dev_laptop" })).toEqual({ removed: 1 });
    expect((await b.call("bank.devices.list")).items).toHaveLength(2);
    expect(await err(b.call("bank.devices.remove", { deviceId: "dev_laptop" }))).toBe("OTP_REQUIRED"); // the code works once
    await code(b);
    expect(await err(b.call("bank.devices.remove", { deviceId: "dev_laptop" }))).toBe("DEVICE_NOT_FOUND");
    expect(await err(b.call("bank.devices.remove", { deviceId: "dev_iphone15" }))).toBe("CURRENT_DEVICE"); // the device in hand is never removed here
  });
  it("signs every other device out, and renames one", async () => {
    const { b } = alex();
    await code(b);
    expect(await b.call("bank.devices.remove", { all: true })).toEqual({ removed: 2 });
    expect((await b.call("bank.devices.list")).items.map((d: any) => d.id)).toEqual(["dev_iphone15"]);
    expect(await b.call("bank.devices.rename", { deviceId: "dev_iphone15", name: "Alex's phone" })).toEqual({ ok: true });
  });
  it("turns a quick PIN on with a code and off without, and changes it with the current one; three wrong PINs turn it off", async () => {
    const { b } = alex();
    expect(await err(b.call("bank.devices.setQuickSignIn", { method: "pin", pin: "504719" }))).toBe("OTP_REQUIRED");
    await code(b);
    expect(await b.call("bank.devices.setQuickSignIn", { method: "pin", pin: "504719" })).toMatchObject({ ok: true, method: "pin", device: "iPhone 15" });
    expect(await b.call("bank.device.options")).toMatchObject({ default: "pin", pinSet: true });
    expect(await b.call("bank.devices.verifyPin", { pin: "504719" })).toEqual({ ok: true });
    expect(await b.call("bank.devices.changePin", { current: "504719", new: "504719" })).toEqual({ ok: false, code: "PIN_SAME" });
    expect(await b.call("bank.devices.changePin", { current: "504719", new: "111111" })).toEqual({ ok: false, code: "PIN_WEAK" });
    expect(await b.call("bank.devices.changePin", { current: "504719", new: "837215" })).toMatchObject({ ok: true });
    expect(await b.call("bank.devices.verifyPin", { pin: "504719" }).catch((e) => e.code)).toBe("PIN_WRONG");
    expect(await b.call("bank.devices.verifyPin", { pin: "504719" }).catch((e) => e.code)).toBe("PIN_WRONG");
    expect(await b.call("bank.devices.verifyPin", { pin: "504719" }).catch((e) => e.code)).toBe("PIN_LOCKED");
    expect(await b.call("bank.device.options")).toMatchObject({ default: "password", pinSet: false });
    await code(b);
    await b.call("bank.devices.setQuickSignIn", { method: "pin", pin: "504719" });
    expect(await b.call("bank.devices.setQuickSignIn", { method: "off" })).toMatchObject({ ok: true, method: "off" }); // off needs no code
  });
  it("sets the default sign-in and refuses a PIN that is not set", async () => {
    const { b } = alex();
    expect(await b.call("bank.device.setDefault", { mode: "pin" })).toEqual({ ok: false, code: "PIN_NOT_SET" });
    expect(await b.call("bank.device.setDefault", { mode: "biometric" })).toEqual({ ok: true, default: "biometric" });
    expect(await err(b.call("bank.device.setDefault", { mode: "face" }))).toBe("INVALID_MODE");
  });
  it("checks the current password with the shared count, and changes it after a code", async () => {
    const { b } = alex();
    expect(await b.call("bank.password.check", { current: PW })).toEqual({ ok: true });
    for (let i = 1; i <= 4; i++) expect(await err(b.call("bank.password.check", { current: "wrong-wrong-12" }))).toBe("INVALID_PASSWORD");
    expect(await err(b.call("bank.password.check", { current: "wrong-wrong-12" }))).toBe("ACCOUNT_LOCKED");
    const c = alex();
    expect(await err(c.b.call("bank.password.change", { current: PW, new: "Harbour-Maple-47-Tide" }))).toBe("OTP_REQUIRED");
    await code(c.b);
    expect(await c.b.call("bank.password.change", { current: PW, new: PW })).toEqual({ ok: false, code: "PASSWORD_SAME" });
    expect(await c.b.call("bank.password.change", { current: PW, new: "Harbour-Maple-47-Tide", confirm: "Harbour-Maple-47-Tide", signOutOthers: true })).toMatchObject({ ok: true, otherDevicesSignedOut: true });
    // the step-up of the shell now asks for the new password
    expect(await err(c.b.call("bank.session.stepUp", { method: "password", secret: PW }))).toBe("STEP_UP_FAILED");
    expect(await err(c.b.call("bank.session.stepUp", { method: "password", secret: "Harbour-Maple-47-Tide" }))).toBe("OTP_REQUIRED");
  });
  it("the login history: twelve rows over the last 30 days with a wrong password from London and a new-device code; filters and pages", async () => {
    const { b } = alex();
    const all = await b.call("bank.loginHistory.list", { page: 1, pageSize: 20 });
    expect(all.total).toBe(12);
    expect(all.items.some((r: any) => r.result === "wrong-password" && r.place === "London, GB")).toBe(true);
    expect(all.items.some((r: any) => r.result === "new-device-code")).toBe(true);
    expect((await b.call("bank.loginHistory.list", { result: "failed" })).total).toBe(2);
    expect((await b.call("bank.loginHistory.list", { page: 2, pageSize: 5 })).items).toHaveLength(5);
    expect(JSON.stringify(all)).not.toMatch(/\d+\.\d+\.\d+\.\d+/); // the network address is only ever partly shown
  });
  it("a customer without a username has none of it", async () => {
    expect(await err(make({ persona: "ayesha" }).b.call("bank.devices.list"))).toBe("NOT_SUPPORTED");
  });
});

describe("the session", () => {
  it("ends after the idle time on the sandbox clock when a scenario asks for it, and a call in time keeps it going", async () => {
    const { b, tick } = make({ persona: "alex", conditions: { idleTimeoutSeconds: 300 } });
    await b.call("bank.accounts.list"); tick(299); await b.call("bank.accounts.list");
    tick(299); expect((await b.call("bank.session.keepAlive")).expiresAt).toBe(new Date(NOW + 598_000 + 300_000).toISOString());
    tick(301);
    expect(await err(b.call("bank.accounts.list"))).toBe("SESSION_EXPIRED");
    expect(await err(b.call("bank.session.keepAlive"))).toBe("SESSION_EXPIRED");
    expect((new MockBank("alex") as any).access.dir.find("alex.morgan").history[0].result).not.toBe("inactivity");
  });
  it("without the condition a session does not time out, as before", async () => {
    const { b, tick } = make({ persona: "alex" });
    tick(3600);
    expect(Object.keys(await b.call("bank.accounts.list"))).toContain("acc_main");
  });
  it("signing out ends the session; the history says an idle session was signed out for inactivity", async () => {
    const { b } = make({ persona: "alex" });
    await b.call("bank.auth.signOut");
    expect(await err(b.call("bank.accounts.list"))).toBe("SESSION_EXPIRED");
    const dir = new AccessDirectory();
    const i = make({ persona: "alex", conditions: { idleTimeoutSeconds: 60 }, directory: dir });
    await i.b.call("bank.accounts.list"); i.tick(61); await err(i.b.call("bank.accounts.list"));
    expect(dir.find("alex.morgan")!.history[0]!.result).toBe("inactivity");
  });
  it("a customer who signed in through the sign-in has the same session as the one made for the customer (the combined demo's)", async () => {
    const { b } = make({ conditions: known });
    await signIn(b); await b.call("bank.auth.completeSignIn", {});
    const s = await b.call("bank.session.get");
    expect(s.contexts.map((c: any) => c.id)).toEqual(["personal", "alpha", "beta"]);
    // the password of the step-up is the one the person signed in with
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    expect(await b.call("bank.session.stepUp", { method: "password", secret: PW })).toHaveProperty("stepUpUntil");
  });
  it("the personas that existed keep working as they did: a one-time code of 000000 still works for them", async () => {
    const b = new MockBank("alex");
    await b.call("bank.otp.send");
    expect(await b.call("bank.otp.verify", { code: "000000" })).toEqual({ verified: true });
  });
});
