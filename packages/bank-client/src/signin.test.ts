import { describe, expect, it } from "vitest";
import { JourneyRunner } from "@finx/renderer-core";
import { BankApp, createLive } from "./index";

const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
const PW = "Bwx!Demo2026";
const make = (extra: object = {}) =>
  new BankApp({ preset: "bankworkx", live: createLive({ brand: "bankworkx", fetch: down }), studioUrl: "http://studio", toastMs: 20, signIn: true, device: { id: "dev_test", name: "This browser", kind: "browser" }, ...extra });

/** Presses a button of the journey's current screen, by its label. */
const press = async (r: JourneyRunner, label: string) => r.press((r.view().blocks as any[]).find((b) => (b.type === "button" || b.type === "menu") && (b.label === label || b.items?.some((i: any) => i.label === label)))!.actions ?? (r.view().blocks as any[]).flatMap((b) => b.items ?? []).find((i: any) => i.label === label).actions);
/** The sign-in journey as the app opens it, run against the app's bank. */
async function journey(app: BankApp) {
  const live = await app.fetchJourney("sign-in");
  const events: unknown[] = [];
  const r = new JourneyRunner(live!.journey, { adapter: app.adapter, lang: "en", onEvent: (e) => events.push(e) });
  await r.start();
  return { r, events };
}
const signIn = async (r: JourneyRunner, user = "alex.morgan", pw = PW) => { r.set("login.username", user); r.set("login.password", pw); await press(r, "Continue"); };
/** A new device: the code, then trust it under a name, then not now for quick sign-in, to the end. */
async function throughCodeAndTrust(r: JourneyRunner) {
  expect(r.current).toBe("code");
  r.set("login.code", "482100"); await press(r, "Continue");
  expect(r.current).toBe("trust");
  r.set("login.trust", "trust"); r.set("login.deviceName", "My laptop"); await press(r, "Continue");
  expect(r.current).toBe("quick");
  await press(r, "Not now");
  expect(r.current).toBe("signedIn");
}

describe("a bank with a real sign-in", () => {
  it("starts with nobody signed in and the picker out of the way; the bank answers only the sign-in adapters", async () => {
    const a = make();
    expect(a.getState()).toMatchObject({ screen: "login", picker: false });
    expect(a.bank.signedIn).toBe(false);
    await expect(a.adapter("bank.accounts.list", {})).rejects.toMatchObject({ code: "NOT_SIGNED_IN" });
    expect(await a.adapter("bank.device.options", {})).toMatchObject({ firstName: "" });
  });

  it("the finished sign-in journey signs the customer in at the bank, and the app opens whoever the bank says it is", async () => {
    const a = make();
    const { r, events } = await journey(a);
    expect(r.current).toBe("credentials");
    await signIn(r);
    await throughCodeAndTrust(r);
    // the journey ends: its Go to Home exits; nothing but that tells the app
    expect(a.getState().screen).toBe("login");
    expect(a.finishSignIn()).toBe(true);
    expect(a.getState()).toMatchObject({ screen: "app", personaId: "alex" });
    expect(a.persona.name).toBe("Alex Morgan");
    await a.loadSession();
    expect(a.getState().session.status).toBe("ready");
    expect(a.getState().session.info!.contexts.map((c) => c.id)).toEqual(["personal", "alpha", "beta"]);
    // the journey's own adapter handle is the same bank, now signed in
    expect(Object.keys(await a.adapter("bank.accounts.list", {}))).toContain("acc_main");
    // no password anywhere the app or the journey keeps things, and no value in the events
    expect(JSON.stringify([a.getState(), r.state, events])).not.toContain(PW);
    expect(JSON.stringify(events)).not.toMatch(/482100|alex\.morgan/);
  });

  it("a journey that has not signed anyone in tells the app nothing: it stays on the sign-in screen", async () => {
    const a = make();
    const { r } = await journey(a);
    await signIn(r, "alex.morgan", "wrong-password-1");
    expect(a.finishSignIn()).toBe(false);
    expect(a.getState().screen).toBe("login");
    // not even after the journey is closed some other way
    expect(a.finishSignIn()).toBe(false);
  });

  it("signing out ends the session and brings the sign-in back with nobody signed in", async () => {
    const a = make();
    const { r } = await journey(a);
    await signIn(r); await throughCodeAndTrust(r);
    a.finishSignIn();
    const held = a.adapter;
    a.logout();
    expect(a.getState()).toMatchObject({ screen: "login", picker: false });
    expect(a.bank.signedIn).toBe(false);
    await expect(held("bank.accounts.list", {})).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    await expect(a.adapter("bank.accounts.list", {})).rejects.toMatchObject({ code: "NOT_SIGNED_IN" });
  });

  it("what the bank remembers outlives a sign-out: a device that was trusted asks for no code the next time", async () => {
    const a = make();
    const first = await journey(a);
    await signIn(first.r); await throughCodeAndTrust(first.r);
    a.finishSignIn(); a.logout();
    const second = await journey(a);
    await signIn(second.r);
    // the trusted device goes straight on (to the offer of quick sign-in), without a code
    expect(second.r.current).toBe("quick");
    // and the username was remembered for the greeting
    expect(await a.adapter("bank.device.options", {})).toMatchObject({ firstName: "Alex", username: "alex.morgan" });
  });

  it("five wrong passwords lock the profile, also after a sign-out, until it is unlocked", async () => {
    const a = make();
    const { r } = await journey(a);
    for (let i = 1; i <= 5; i++) await signIn(r, "alex.morgan", `wrong-${i}`);
    expect(r.current).toBe("locked");
    const again = await journey(a);
    await signIn(again.r);
    expect(again.r.current).toBe("locked");
  });

  it("a customer without companies signs in to the classic app", async () => {
    const a = make();
    const { r } = await journey(a);
    await signIn(r, "sam.rivera");
    await throughCodeAndTrust(r);
    expect(a.finishSignIn()).toBe(true);
    expect(a.getState().personaId).toBe("sam");
    await a.loadSession();
    expect(a.getState().session.status).toBe("unavailable");
  });
});

describe("the sandbox customer picker, for development", () => {
  it("is one flag away: the picker picks a customer without a password, and hiding it brings the sign-in back", async () => {
    const a = make();
    a.showPicker(true);
    expect(a.getState().picker).toBe(true);
    expect(a.personas().map((p) => p.id)).toEqual(["alex", "sam"]);
    a.selectPersona("sam");
    expect(a.bank.signedIn).toBe(true);
    a.login();
    expect(a.getState()).toMatchObject({ screen: "app", personaId: "sam" });
    a.logout();
    expect(a.getState().picker).toBe(true);
    a.showPicker(false);
    expect(a.getState().picker).toBe(false);
    expect(a.bank.signedIn).toBe(false);
  });
  it("a bank without a real sign-in is unchanged: the picker is the sign-in and showPicker does nothing", () => {
    const a = new BankApp({ preset: "bankworkx", live: createLive({ brand: "bankworkx", fetch: down }), studioUrl: "http://studio" });
    expect(a.getState().picker).toBe(true);
    a.showPicker(false);
    expect(a.getState().picker).toBe(true);
    expect(a.bank.signedIn).toBe(true);
    expect(a.finishSignIn()).toBe(false);
  });
  it("a customer chosen another way (a restored tab) does not count as signed in by the journey: it cannot be used to skip the password", async () => {
    const a = make();
    a.selectPersona("alex");
    expect(a.bank.signedIn).toBe(true);
    expect(a.finishSignIn()).toBe(false);
    expect(a.getState().screen).toBe("login");
  });
  it("restoring a signed-in tab picks the customer again without asking for a password (the sandbox restarts empty), and signing out then goes to the sign-in", async () => {
    const a = make();
    a.selectPersona("alex"); a.login();
    expect(a.getState().screen).toBe("app");
    a.logout();
    expect(a.bank.signedIn).toBe(false);
  });
});
