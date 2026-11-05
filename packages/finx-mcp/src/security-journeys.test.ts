import { describe, expect, it } from "vitest";
import { changePassword, changeQuickPin, setupQuickLogin, trustedDevices, Journey } from "@finx/journey-schema";
import { JourneyRunner, type RunEvent } from "@finx/renderer-core";
import { MockBank } from "@finx/mock-bank-api";
import { simulate } from "./simulate";

// The Security journeys (Settings > Security) and what they leave behind. The values are made up for this test.
const PW = "Bwx!Demo2026";
const NEW_PW = "Harbour-Maple-47-Tide";
const OLD_PIN = "837215";
const PIN = "504719";
const NOW = Date.parse("2026-11-03T10:00:00Z");
const secrets = [PW, NEW_PW, OLD_PIN, PIN];
const hasSecret = (x: unknown) => secrets.filter((s) => JSON.stringify(x).includes(s));
const base = { persona: "alex", lang: "en", context: "personal", now: NOW } as const;
const pinOn = [{ adapter: "bank.otp.send", input: { strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } }, { adapter: "bank.devices.setQuickSignIn", input: { method: "pin", pin: OLD_PIN } }];

describe("what the Security journeys leave behind", () => {
  it("change password: the answers, the transcript and the screens hold no password at the end, nor on any way out", async () => {
    const j = Journey.parse(changePassword);
    const ok = [
      { set: { "cp.current": PW } }, { press: "Continue" }, { set: { "cp.new": NEW_PW, "cp.confirm": NEW_PW } }, { press: "Continue" }, { set: { "cp.code": "482100" } }, { press: "Confirm" }, { expectScreen: "done" },
    ];
    const done = await simulate({ ...base, journey: j, steps: ok as any });
    expect(done.failures).toEqual([]);
    expect(hasSecret(done.data)).toEqual([]);
    expect(hasSecret(done.frames)).toEqual([]);
    // the fields are hidden in the transcript: a typed password shows only how long it is
    expect(JSON.stringify(done.frames)).toContain('input[cp.current]=\\"••••••••••••\\"');
    // the same on the ways out: the bank did not answer, the third wrong code, an expired code, a step-up that ran out, the person leaving the new password screen
    for (const [name, opts, steps] of [
      ["unavailable", { conditions: { unavailable: ["bank.password.change"] } }, ok.slice(0, 6)],
      ["timeout when the rules are checked", { conditions: { timeout: ["bank.password.policy"] } }, ok.slice(0, 4)],
      ["wrong codes", {}, [...ok.slice(0, 4), ...["000000", "000000", "000000"].flatMap((c) => [{ set: { "cp.code": c } }, { press: "Confirm" }])]],
      ["expired code", {}, [...ok.slice(0, 4), { set: { "cp.code": "999999" } }, { press: "Confirm" }, { press: "Back" }]],
      ["a step-up that ran out", {}, [ok[0]!, ok[1]!, { advance: 301 }, ...ok.slice(2, 6)]],
      ["left on the new password screen", {}, ok.slice(0, 4)],
    ] as [string, Record<string, unknown>, unknown[]][]) {
      const r = await simulate({ ...base, journey: j, ...opts, steps: steps as any });
      // (the new password is held only while the person is on the screens that need it: it is gone once they leave through a failure)
      if (name !== "left on the new password screen") expect(hasSecret(r.data), name).toEqual([]);
      expect(hasSecret(r.frames), name).toEqual([]);
    }
  });

  it("change quick PIN: neither the old nor the new PIN is kept, and the bank never answers with one", async () => {
    const j = Journey.parse(changeQuickPin);
    const r = await simulate({ ...base, journey: j, setup: pinOn, steps: [{ set: { "cq.cur": OLD_PIN } }, { press: "Continue" }, { set: { "cq.new": PIN, "cq.confirm": PIN } }, { press: "Change PIN" }, { expectScreen: "done" }] as any });
    expect(r.failures).toEqual([]);
    expect(hasSecret(r.data)).toEqual([]);
    expect(hasSecret(r.frames)).toEqual([]);
    const wrong = await simulate({ ...base, journey: j, setup: pinOn, steps: [{ set: { "cq.cur": "000000" } }, { press: "Continue" }, { expectText: "2 tries left." }] as any });
    expect(wrong.failures).toEqual([]);
    expect(hasSecret(wrong.data)).toEqual([]);
  });

  it("set up quick sign-in: the PIN is gone once the bank has it, on a failure and when the attempt ends", async () => {
    const j = Journey.parse(setupQuickLogin);
    const walk = [{ press: "6-digit PIN" }, { press: "Continue" }, { set: { "sq.pin": PIN, "sq.confirm": PIN } }, { press: "Continue" }];
    const r = await simulate({ ...base, journey: j, steps: [...walk, { set: { "sq.code": "482100" } }, { press: "Turn on" }, { expectScreen: "done" }] as any });
    expect(r.failures).toEqual([]);
    expect(hasSecret(r.data)).toEqual([]);
    expect(hasSecret(r.frames)).toEqual([]);
    for (const opts of [{ conditions: { unavailable: ["bank.devices.setQuickSignIn"] } }, {}]) {
      const w = opts.conditions ? [{ set: { "sq.code": "482100" } }, { press: "Turn on" }] : ["000000", "000000", "000000"].flatMap((c) => [{ set: { "sq.code": c } }, { press: "Turn on" }]);
      const f = await simulate({ ...base, journey: j, ...opts, steps: [...walk, ...w] as any });
      expect(hasSecret(f.data)).toEqual([]);
    }
  });

  it("the events of a run carry only where the person was, never what they typed or the code", async () => {
    const bank = new MockBank("alex");
    bank.now = () => NOW;
    await bank.call("bank.otp.send", {}); await bank.call("bank.otp.verify", { code: "482100" });
    await bank.call("bank.session.stepUp", { method: "password", secret: PW });
    const events: RunEvent[] = [];
    const runner = new JourneyRunner(Journey.parse(changePassword), { adapter: (id, input) => bank.call(id, input), lang: "en", onEvent: (e) => events.push(e) });
    await runner.start();
    for (const [path, value, button] of [["cp.current", "wrong-wrong-12", "Continue"], ["cp.current", PW, "Continue"], ["cp.new", NEW_PW, ""], ["cp.confirm", NEW_PW, "Continue"], ["cp.code", "482100", "Confirm"]] as const) {
      runner.set(path, value);
      if (button) await runner.press((runner.view().blocks as any[]).find((b) => b.type === "button" && b.label === button).actions);
    }
    expect(runner.current).toBe("done");
    expect(events.length).toBeGreaterThan(5);
    expect(JSON.stringify(events)).not.toMatch(/wrong-wrong-12|Bwx!Demo2026|Harbour-Maple|482100/);
    expect(JSON.stringify(runner.state)).not.toMatch(/wrong-wrong-12|Bwx!Demo2026|Harbour-Maple|482100/);
  });

  it("trusted devices: the code is not kept and no answer of the bank carries a secret", async () => {
    const r = await simulate({ ...base, journey: Journey.parse(trustedDevices), steps: [{ press: "Work laptop, Chrome" }, { set: { "td.code": "482100" } }, { press: "Remove" }, { expectScreen: "list" }] as any });
    expect(r.failures).toEqual([]);
    expect(JSON.stringify(r.data)).not.toContain("482100");
    expect(JSON.stringify(r.frames)).not.toMatch(/Bwx!|[0-9a-f]{64}/);
  });

  it("the sandbox keeps hashes only: a changed password and a new PIN are in no answer and no dump of the customer's record", async () => {
    const bank = new MockBank("alex");
    bank.now = () => NOW;
    await bank.call("bank.otp.send", {}); await bank.call("bank.otp.verify", { code: "482100" });
    await bank.call("bank.session.stepUp", { method: "password", secret: PW });
    await bank.call("bank.otp.send", { strict: true }); await bank.call("bank.otp.verify", { code: "482100", strict: true });
    await bank.call("bank.devices.setQuickSignIn", { method: "pin", pin: PIN });
    await bank.call("bank.otp.send", { strict: true }); await bank.call("bank.otp.verify", { code: "482100", strict: true });
    const answer = await bank.call("bank.password.change", { current: PW, new: NEW_PW, confirm: NEW_PW });
    const user = bank.access.dir.find("alex.morgan");
    expect(JSON.stringify(user)).not.toMatch(new RegExp(`${NEW_PW}|${PIN}|${PW.replace(/[!]/g, ".")}`));
    expect(hasSecret([answer, await bank.call("bank.devices.list"), await bank.call("bank.device.options"), await bank.call("sandbox.access.inspect", { username: "alex.morgan" })])).toEqual([]);
  });
});
