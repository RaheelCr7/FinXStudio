import { describe, expect, it } from "vitest";
import { signIn, resetPassword, Journey } from "@finx/journey-schema";
import { JourneyRunner, type RunEvent } from "@finx/renderer-core";
import { MockBank, SIGNED_OUT } from "@finx/mock-bank-api";
import { simulate } from "./simulate";

// the sandbox clock is pinned: the seeded sign-in dates and the password's age are read against it, not against the day the test runs
const NOW = Date.parse("2026-11-03T10:00:00Z");
const PW = "Bwx!Demo2026";
const NEW_PW = "Granite-Lemon-92-River";
const PIN = "504719";
const secrets = [PW, NEW_PW, PIN];
const hasSecret = (x: unknown) => secrets.filter((s) => JSON.stringify(x).includes(s));

/** The whole sign-in on a new device: the code, a new password, trusting the device, a quick PIN. */
const walk = [
  { set: { "login.username": "demo.expired", "login.password": PW } }, { press: "Continue" }, { set: { "login.code": "482100" } }, { press: "Continue" },
  { set: { "login.newPassword": NEW_PW, "login.confirm": NEW_PW } }, { press: "Continue" },
  { set: { "login.trust": "trust", "login.deviceName": "My phone" } }, { press: "Continue" },
  { press: "6-digit quick PIN" }, { set: { "login.pin": PIN, "login.pinConfirm": PIN } }, { press: "Continue" }, { expectScreen: "signedIn" },
];

describe("what a sign-in leaves behind", () => {
  it("the journey's answers, the transcript and the events hold no password, new password or PIN", async () => {
    const j = Journey.parse(signIn);
    const r = await simulate({ journey: j, persona: SIGNED_OUT, lang: "en", conditions: { device: "new" }, steps: walk as any });
    expect(r.failures).toEqual([]);
    expect(r.finalScreen).toBe("signedIn");
    expect(hasSecret(r.data)).toEqual([]);
    expect(hasSecret(r.frames)).toEqual([]);
    // the fields are hidden in the transcript: a typed password shows only how long it is
    expect(JSON.stringify(r.frames)).toContain('input[login.password]=\\"••••••••••••\\"');
  });

  it("the events of a run carry only where the person was, never what they typed", async () => {
    const bank = new MockBank(SIGNED_OUT, { now: NOW, conditions: { device: "new" } });
    const events: RunEvent[] = [];
    const runner = new JourneyRunner(Journey.parse(signIn), { adapter: (id, input) => bank.call(id, input), lang: "en", onEvent: (e) => events.push(e) });
    await runner.start();
    runner.set("login.username", "alex.morgan"); runner.set("login.password", "wrong-password-xyz");
    await runner.press((runner.view().blocks as any[]).find((b) => b.type === "button" && b.label === "Continue").actions);
    runner.set("login.password", PW);
    await runner.press((runner.view().blocks as any[]).find((b) => b.type === "button" && b.label === "Continue").actions);
    expect(runner.current).toBe("code");
    expect(events.length).toBeGreaterThan(3);
    expect(JSON.stringify(events)).not.toMatch(/wrong-password-xyz|Bwx!Demo2026|482100|alex\.morgan/);
    // and the journey does not keep the password after the bank has it
    expect(JSON.stringify(runner.state)).not.toContain(PW);
  });

  it("a recovery token is not kept after use, and the new password never is", async () => {
    const r = await simulate({
      journey: Journey.parse(resetPassword), persona: SIGNED_OUT, lang: "en",
      steps: [{ set: { "rp.user": "alex.morgan" } }, { press: "Continue" }, { set: { "rp.code": "482100" } }, { press: "Continue" }, { set: { "rp.password": NEW_PW, "rp.confirm": NEW_PW } }, { press: "Finish" }, { expectScreen: "resetDone" }] as any,
    });
    expect(r.failures).toEqual([]);
    expect(hasSecret(r.data)).toEqual([]);
    expect(JSON.stringify(r.data)).not.toMatch(/rt_\d/);
  });

  it("the bank never answers with a password, a PIN, a hash or the one-time code", async () => {
    const bank = new MockBank(SIGNED_OUT, { now: NOW, conditions: { device: "known" } });
    const seen: unknown[] = [];
    for (const [a, i] of [
      ["bank.device.options", {}], ["bank.auth.signIn", { username: "alex.morgan", password: PW }], ["bank.auth.setQuickSignIn", { method: "pin", pin: PIN }],
      ["bank.auth.completeSignIn", { remember: true }], ["bank.devices.list", {}], ["bank.loginHistory.list", {}], ["bank.password.policy", { password: NEW_PW }], ["sandbox.access.inspect", { username: "alex.morgan" }],
    ] as [string, Record<string, unknown>][]) seen.push(await bank.call(a, i));
    expect(hasSecret(seen)).toEqual([]);
    expect(JSON.stringify(seen)).not.toMatch(/[0-9a-f]{64}|482100/);
  });
});

describe("the simulator starts with nobody signed in", () => {
  it("accepts the persona signed-out, and still refuses a persona that does not exist", async () => {
    const r = await simulate({ journey: Journey.parse(signIn), persona: SIGNED_OUT, lang: "en", steps: [{ expectScreen: "credentials" }] });
    expect(r.ok).toBe(true);
    expect(r.persona).toBe(SIGNED_OUT);
    await expect(simulate({ journey: Journey.parse(signIn), persona: "nobody", lang: "en", steps: [] })).rejects.toThrow(/signed-out/);
  });
  it("a scenario can set the bank's options and the device", async () => {
    const r = await simulate({
      journey: Journey.parse(signIn), persona: SIGNED_OUT, lang: "en", conditions: { device: "new" }, config: { options: { "sign-in": { forceExpiry: false } } },
      steps: [{ set: { "login.username": "demo.expired", "login.password": PW } }, { press: "Continue" }, { expectScreen: "code" }, { set: { "login.code": "482100" } }, { press: "Continue" }, { expectScreen: "trust" }, { expectNoText: "Choose a new password" }] as any,
    });
    expect(r.failures).toEqual([]);
  });
});
