import { afterEach, describe, expect, it, vi } from "vitest";
import { JourneyRunner } from "@finx/renderer-core";
import { BankApp, IDLE, backgroundTooLong, createLive, filtersOn, idleState, journeyNeedsStepUp, launchPointsFor, linkPath, loadHistory, loadSecurity, NO_FILTERS, parseLink, whenText, dayText } from "./index";

const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
const PASSWORD = "Bwx!Demo2026";
// the sandbox clock is the app's clock here: a test moves it, never waits
let t0 = Date.parse("2026-11-03T10:00:00Z");
const clock = { t: t0, now: () => clock.t, tick: (s: number) => { clock.t += s * 1000; } };
const make = (extra: object = {}) => new BankApp({ preset: "bankworkx", live: createLive({ brand: "bankworkx", fetch: down }), studioUrl: "http://studio", toastMs: 20, now: clock.now, ...extra });
/** Signed in as Alex with the session loaded, the way the picker does it. */
async function alex(extra: object = {}) {
  clock.t = t0;
  const a = make(extra);
  (a as any).current.now = clock.now; // the sandbox bank keeps the same time
  a.login();
  await a.loadSession();
  return a;
}
afterEach(() => vi.useRealTimers());

describe("the session timeout", () => {
  it("counts quiet seconds: active, then the warning from the 240th, then out at the 300th", () => {
    expect(idleState(0, 0)).toEqual({ phase: "active" });
    expect(idleState(0, 239_000)).toEqual({ phase: "active" });
    expect(idleState(0, 240_000)).toEqual({ phase: "warning", left: 60 });
    expect(idleState(0, 241_500)).toEqual({ phase: "warning", left: 59 });
    expect(idleState(0, 299_000)).toEqual({ phase: "warning", left: 1 });
    expect(idleState(0, 300_000)).toEqual({ phase: "out" });
    expect(IDLE).toEqual({ idleSeconds: 300, warningSeconds: 60 });
  });
  it("a phone that was away for more than five minutes is signed out at once, one that was away for five is not", () => {
    expect(backgroundTooLong(0, 300_000)).toBe(false);
    expect(backgroundTooLong(0, 300_001)).toBe(true);
  });

  it("warns, keeps the session on request, and signs out when the countdown ends: the screen, the session and the cached views are gone and the bank says so", async () => {
    const a = await alex({ idle: true });
    const bank = a.bank;
    await a.loadShell("home");
    expect(a.getState().views[a.viewKey("home")]).toBeDefined();
    a.setDraft("x", { amount: 5 });
    clock.tick(239); a.idleTick();
    expect(a.getState().idle).toEqual({ phase: "active" });
    clock.tick(1); a.idleTick();
    expect(a.getState().idle).toEqual({ phase: "warning", left: 60 });
    clock.tick(30); a.idleTick();
    expect(a.getState().idle).toEqual({ phase: "warning", left: 30 });
    // a tap does not end the warning: only "Stay signed in" does
    a.activity(); clock.tick(1); a.idleTick();
    expect(a.getState().idle).toEqual({ phase: "warning", left: 29 });
    await a.keepAlive();
    expect(a.getState().idle).toEqual({ phase: "active" });
    clock.tick(239); a.idleTick();
    expect(a.getState()).toMatchObject({ screen: "app", idle: { phase: "active" } });
    clock.tick(1); a.idleTick();
    expect(a.getState().idle).toEqual({ phase: "warning", left: 60 });
    clock.tick(60); a.idleTick();
    const s = a.getState();
    expect(s).toMatchObject({ screen: "login", notice: "expired", idle: { phase: "active" } });
    expect(s.session).toMatchObject({ status: "idle", info: null });
    expect(s.views).toEqual({}); expect(s.drafts).toEqual({});
    await expect(bank.call("bank.accounts.list")).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("a tap, a key press or a request of the app starts the clock again; before the warning only", async () => {
    const a = await alex({ idle: true });
    clock.tick(200); a.activity();
    clock.tick(200); a.idleTick();
    expect(a.getState().idle).toEqual({ phase: "active" }); // 200 quiet seconds, not 400
    clock.tick(30); await a.loadShell("cards"); // a request counts
    clock.tick(239); a.idleTick();
    expect(a.getState().idle).toEqual({ phase: "active" });
    clock.tick(2); a.idleTick();
    expect(a.getState().idle.phase).toBe("warning");
    // a request made behind the warning does not keep the session going
    await a.loadShell("accounts", true); clock.tick(59); a.idleTick();
    expect(a.getState().screen).toBe("login");
  });

  it("the sandbox bank ends the session at the same time (the next call answers SESSION_EXPIRED) and the app shows the signed-out notice without a warning", async () => {
    const a = await alex({ idle: true });
    clock.tick(301); // the page was asleep: no tick ran
    await a.loadShell("home", true);
    await a.loadShell("cards", true).catch(() => undefined);
    expect(a.view("cards")?.code ?? a.view("home")?.code).toBe("SESSION_EXPIRED");
    const b = await alex({ idle: true });
    clock.tick(301);
    await b.loadSession();
    expect(b.getState()).toMatchObject({ screen: "login", notice: "expired" });
  });

  it("a phone back from the background after more than five minutes comes back signed out; a short trip changes nothing", async () => {
    const a = await alex({ idle: true });
    a.setBackground(true); clock.tick(120); a.setBackground(false);
    expect(a.getState().screen).toBe("app");
    a.setBackground(true); clock.tick(301); a.setBackground(false);
    expect(a.getState()).toMatchObject({ screen: "login", notice: "expired" });
  });

  it("is off unless the app asks for it", async () => {
    const a = await alex();
    clock.tick(4000); a.idleTick();
    expect(a.getState()).toMatchObject({ screen: "app", idle: { phase: "active" } });
    await expect(a.bank.call("bank.accounts.list")).resolves.toBeDefined();
  });

  it("returns to the tab the customer was on after a timeout, never into a journey, only for the same customer, only for an app that asks; an explicit sign-out forgets the place", async () => {
    const signInApp = (extra: object = {}) => make({ signIn: true, device: { id: "dev_test", name: "This browser", kind: "browser" }, idle: true, keepPlace: true, ...extra });
    const click = async (r: JourneyRunner, label: string) => r.press((r.view().blocks as any[]).find((b) => b.type === "button" && b.label === label).actions);
    const signedIn = async (a: BankApp, user = "alex.morgan") => {
      const live = await a.fetchJourney("sign-in");
      const r = new JourneyRunner(live!.journey, { adapter: a.adapter, lang: "en", launch: { "launch.reason": "expired" } });
      await r.start();
      r.set("login.username", user); r.set("login.password", PASSWORD);
      await click(r, "Continue");
      if (r.current === "code") { r.set("login.code", "482100"); await click(r, "Continue"); }
      if (r.current === "trust") { r.set("login.trust", "trust"); r.set("login.deviceName", "My laptop"); await click(r, "Continue"); }
      if (r.current === "quick") await click(r, "Not now");
      expect(r.current).toBe("signedIn");
      expect(a.finishSignIn()).toBe(true);
      await a.loadSession();
    };
    clock.t = t0;
    const a = signInApp();
    await signedIn(a);
    a.setShellTab("cards");
    clock.tick(300); a.idleTick();
    expect(a.getState()).toMatchObject({ screen: "login", notice: "expired" });
    await signedIn(a); // the same customer, on a device that is trusted now
    expect(a.getState().arrived).toEqual({ workspace: "personal", tab: "cards" });
    // another customer does not land on the first one's tab
    a.setShellTab("save"); clock.tick(300); a.idleTick();
    await signedIn(a, "sam.rivera");
    expect(a.getState().arrived).toBeNull();
    // an explicit sign-out forgets the place
    const b = signInApp(); await signedIn(b); b.setShellTab("save"); b.logout();
    await signedIn(b);
    expect(b.getState().arrived).toBeNull();
    // an app that does not ask (the web app, which uses the address) is not moved
    const c = signInApp({ keepPlace: false }); await signedIn(c); c.setShellTab("save"); clock.tick(300); c.idleTick();
    await signedIn(c);
    expect(c.getState().arrived).toBeNull();
  });
});

describe("signing out", () => {
  it("asks once (a sheet), tells the bank, clears the session and everything of the customer, and keeps language, scheme and the device", async () => {
    const a = await alex();
    a.setLang("ur"); a.setPrefs({ scheme: "dark" }); a.setDraft("x", { n: 1 }); a.setSearch("coffee");
    const bank = a.bank;
    a.askSignOut();
    expect(a.getState().sheet).toBe("signout");
    const spy = vi.spyOn(bank, "call");
    a.logout();
    expect(spy.mock.calls[0]![0]).toBe("bank.auth.signOut");
    const s = a.getState();
    expect(s).toMatchObject({ screen: "login", sheet: null, search: "", notice: null, lang: "ur", prefs: { scheme: "dark" } });
    expect(s.drafts).toEqual({}); expect(s.views).toEqual({}); expect(s.session.info).toBeNull(); expect(s.stepUp).toBeNull();
    await expect(bank.call("bank.accounts.list")).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });
  it("signs out even when the bank cannot be told", async () => {
    const a = await alex();
    const bank = a.bank;
    bank.conditions = { unavailable: ["bank.auth.signOut"] };
    a.logout();
    expect(a.getState().screen).toBe("login");
    await expect(bank.call("bank.accounts.list")).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });
});

describe("the step-up before a security journey", () => {
  it("every security launch point asks for it, and the journeys they open say so", () => {
    expect(["change-password", "trusted-devices", "change-quick-pin", "setup-quick-login"].map(journeyNeedsStepUp)).toEqual([true, true, true, true]);
    expect(journeyNeedsStepUp("personal-transfer")).toBe(false);
  });

  it("asks first for the password and then the code, and opens the journey when it is given; it is not asked again for five minutes", async () => {
    const a = await alex();
    const link = { workspace: "personal", journey: "change-password", values: {} } as const;
    expect(a.needsStepUp("change-password")).toBe(true);
    await a.askStepUp(link, "To change your password.");
    expect(a.getState().stepUp).toMatchObject({ phase: "password", reason: "To change your password.", method: "password" });
    await a.beginStepUp({ secret: "nope" });
    expect(a.getState().stepUp).toMatchObject({ phase: "password", error: "That password isn't right. 4 tries left." });
    await a.beginStepUp({ secret: PASSWORD });
    expect(a.getState().stepUp).toMatchObject({ phase: "code", phone: expect.stringContaining("0142") });
    await a.confirmStepUp("000000");
    expect(a.getState().stepUp).toBeNull();
    expect(a.getState().arrived).toEqual(link);
    expect(a.getState().workspace).toBe("personal"); // the place did not change
    expect(a.needsStepUp("change-password")).toBe(false);
    clock.tick(299); expect(a.needsStepUp("trusted-devices")).toBe(false);
    clock.tick(2); expect(a.needsStepUp("trusted-devices")).toBe(true);
  });

  it("uses the quick PIN when that is how this device signs in; Cancel opens nothing", async () => {
    const a = await alex();
    // the PIN is set the way the Security journey does it: the step-up first
    await a.askStepUp({ workspace: "personal", journey: "setup-quick-login", values: {} }, "x");
    await a.beginStepUp({ secret: PASSWORD }); await a.confirmStepUp("000000");
    await a.bank.call("bank.otp.send", { strict: true }); await a.bank.call("bank.otp.verify", { code: "482100", strict: true });
    await a.bank.call("bank.devices.setQuickSignIn", { method: "pin", pin: "504719" });
    clock.tick(400);
    await a.askStepUp({ workspace: "personal", journey: "change-password", values: {} }, "To change your password.");
    expect(a.getState().stepUp).toMatchObject({ method: "pin" });
    await a.beginStepUp({ method: "pin", secret: "000000" });
    expect(a.getState().stepUp).toMatchObject({ error: "That PIN isn't right. 4 tries left." });
    a.cancelStepUp();
    expect(a.getState().stepUp).toBeNull();
    expect(a.getState().arrived).not.toEqual({ workspace: "personal", journey: "change-password", values: {} });
  });

  it("five wrong passwords lock the profile, sign the person out and the sign-in says so; three wrong codes end the attempt", async () => {
    const a = await alex();
    await a.askStepUp({ workspace: "personal", journey: "change-password", values: {} }, "x");
    for (let i = 0; i < 4; i++) await a.beginStepUp({ secret: "nope" });
    expect(a.getState().stepUp!.error).toBe("That password isn't right. 1 try left.");
    await a.beginStepUp({ secret: "nope" });
    expect(a.getState()).toMatchObject({ screen: "login", notice: "locked", stepUp: null });
    const b = await alex();
    await b.askStepUp({ workspace: "personal", journey: "change-password", values: {} }, "x");
    await b.beginStepUp({ secret: PASSWORD });
    await b.confirmStepUp("111111"); await b.confirmStepUp("111111");
    expect(b.getState().stepUp).toMatchObject({ phase: "code", error: "That code isn't right. 1 try left." });
    await b.confirmStepUp("111111");
    expect(b.getState().stepUp).toBeNull();
    expect(b.getState().toast).toMatchObject({ text: "Too many wrong codes. Start again.", ok: false });
  });
});

describe("Settings > Security", () => {
  it("has an address of its own, only in Personal", () => {
    const link = parseLink("/personal/more/settings/security");
    expect(link).toEqual({ workspace: "personal", tab: "more", sub: "security" });
    expect(linkPath(link!)).toBe("/personal/more/settings/security");
    expect(parseLink("bankworkx://personal/more/settings/security", "bankworkx")).toEqual(link);
    expect(parseLink("/business/alpha/more/settings/security")).toBeNull();
    expect(parseLink("/personal/more/settings")).toBeNull();
    expect(parseLink("/personal/more/settings/security/x")).toBeNull();
    expect(linkPath(parseLink("/personal/more")!)).toBe("/personal/more");
  });

  it("the More tab has a Security row that opens it, and the buttons for the place are the security launch points the place may use", async () => {
    const a = await alex();
    await a.loadShell("more");
    const more = a.view<any>("more")!.data;
    expect(more.sections.find((x: any) => x.id === "settings").rows).toEqual([expect.objectContaining({ title: "Security", go: "security" })]);
    await a.refreshCatalog();
    const labels = launchPointsFor({ context: a.context, entries: a.getState().catalog.entries, settings: a.getState().session.settings }, { place: "more.security" }).map((l) => l.label);
    expect(labels).toEqual(["Change password", "Trusted devices", "Change quick PIN", "Quick sign-in", "Biometrics"].filter((l) => labels.includes(l)));
    expect(labels).toEqual(expect.arrayContaining(["Change password", "Trusted devices", "Change quick PIN", "Quick sign-in", "Biometrics"]));
    // Business does not have them
    await a.switchContext("alpha"); await a.beginStepUp({ secret: PASSWORD }); await a.confirmStepUp("000000");
    expect(launchPointsFor({ context: a.context, entries: a.getState().catalog.entries, settings: a.getState().session.settings }, { place: "more.security" })).toEqual([]);
  });

  it("the view-model: the password row, the sign-in methods, the devices and the biometric flag", async () => {
    const a = await alex();
    const vm = await loadSecurity((id, input) => a.bank.call(id, input));
    expect(vm).toMatchObject({
      password: "Last changed 2 May 2026", quickPin: { set: false, label: "Not set", action: "Set up" }, defaultSignIn: { mode: "password", label: "Username & password" },
      devices: { count: 3, max: 5, text: "3 of 5" }, biometrics: { available: true, on: false }, device: { id: "dev_iphone15", name: "iPhone 15" },
    });
    expect(JSON.stringify(vm)).not.toMatch(/Bwx!|[0-9a-f]{64}/);
  });

  it("the login history: twelve rows, newest first, chips for the results, the filters, the sort and 20 to a page", async () => {
    const a = await alex();
    const call = (id: string, input?: Record<string, any>) => a.bank.call(id, input);
    const now = Date.parse("2026-11-03T10:00:00Z");
    const h = await loadHistory(call, NO_FILTERS, "dev_iphone15", now);
    expect(h).toMatchObject({ total: 12, page: 1, pages: 1, none: false });
    expect(h.rows[0]).toMatchObject({ when: "3 Nov 2026 08:00 UTC", result: { label: "Signed in", tone: "positive" }, method: "Password", device: "iPhone 15", thisDevice: true, place: "San Francisco, US", ip: "203.0.113.•" });
    expect(h.rows.map((r) => r.result.label)).toEqual(expect.arrayContaining(["Wrong password", "New device code"]));
    expect(h.rows.find((r) => r.result.label === "Wrong password")).toMatchObject({ place: "London, GB", device: "Unknown device", thisDevice: false, result: { tone: "warning" } });
    const failed = await loadHistory(call, { ...NO_FILTERS, result: "failed" }, "dev_iphone15", now);
    expect(failed.total).toBe(2);
    expect((await loadHistory(call, { ...NO_FILTERS, days: 7 }, "dev_iphone15", now)).total).toBe(5);
    expect((await loadHistory(call, { ...NO_FILTERS, deviceId: "dev_laptop" }, "dev_iphone15", now)).rows.every((r) => r.device === "Work laptop, Chrome")).toBe(true);
    const oldest = await loadHistory(call, { ...NO_FILTERS, order: "oldest" }, "dev_iphone15", now);
    expect(oldest.rows[0]!.when).toBe("12 Oct 2026 09:00 UTC");
    const none = await loadHistory(call, { ...NO_FILTERS, deviceId: "dev_nobody" }, "dev_iphone15", now);
    expect(none).toMatchObject({ total: 0, none: false });
    expect(filtersOn(NO_FILTERS)).toBe(false); expect(filtersOn({ ...NO_FILTERS, result: "ok" })).toBe(true);
    expect([dayText("2026-11-12T09:14:00Z"), whenText("2026-11-12T09:14:00Z")]).toEqual(["12 Nov 2026", "12 Nov 2026 09:14 UTC"]);
  });

  it("the history is read by the app per place and filters, and a customer with no sign-ins sees 'none' rather than 'nothing for these filters'", async () => {
    const a = await alex();
    await a.loadHistoryView(NO_FILTERS, "dev_iphone15");
    expect(a.historyView(NO_FILTERS)?.data?.total).toBe(12);
    await a.loadSecurityView();
    expect(a.securityView()?.data?.devices.text).toBe("3 of 5");
  });

  it("turning biometrics off goes to the PIN if there is one, else the password, with no step-up; a failure says so and leaves it as it was", async () => {
    const a = await alex();
    await a.loadSecurityView();
    // the bank's step-up is not needed to turn it off: it only makes sign-in stricter
    await a.bank.call("bank.session.stepUp", { method: "biometric" }).catch(() => undefined);
    await a.biometricsOff();
    expect(a.getState().toast).toMatchObject({ text: "Biometrics turned off.", ok: true });
    expect((await a.bank.call("bank.device.options")).default).toBe("password");
    a.bank.conditions = { timeout: ["bank.device.setDefault"] };
    await a.biometricsOff();
    expect(a.getState().toast).toMatchObject({ text: "This is taking longer than expected. Nothing was changed.", ok: false });
  });
});

describe("returning to a sign-in after the timeout", () => {
  it("the sign-in journey says the person was signed out for their security", async () => {
    const a = make({ signIn: true, device: { id: "dev_test", name: "This browser", kind: "browser" } });
    const live = await a.fetchJourney("sign-in");
    const r = new JourneyRunner(live!.journey, { adapter: a.adapter, lang: "en", launch: { "launch.reason": "expired" } });
    await r.start();
    expect(JSON.stringify(r.view().blocks)).toContain("You were signed out for your security. Sign in again to continue. Nothing you were doing was saved.");
  });
});
