import { describe, it, expect } from "vitest";
import { activateProfile, cantSignIn, corporateJourneys, enroll } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { simulate, type Step } from "./simulate";

const run = (journey: any, steps: Step[]) => simulate({ journey, persona: "john", lang: "en", steps });
const verifyFields = { "verify.email": "john.smith@acme-corp.example", "verify.mobile": "+44 7700 900123", "verify.dob": "1985-04-12", "captcha.value": "K7M2Q" };

describe("corporate sign-in journeys", () => {
  for (const j of corporateJourneys) it(`${j.slug} passes lint and is for the corporate app only`, () => {
    expect(lintAll(j)).toEqual([]);
    expect(j.apps).toEqual(["acme-corporate"]);
  });

  describe("can't sign in", () => {
    it("resets a password: verify, two usernames, set a password", async () => {
      const r = await run(cantSignIn, [
        { press: "Reset password" }, { expectScreen: "verify" }, { expectText: "K7M2Q" },
        { press: "Continue" }, { expectError: "verify.email" },
        { set: verifyFields }, { press: "Continue" }, { expectScreen: "username" }, { expectText: "Welcome back" },
        { press: "Continue" }, { expectScreen: "password" },
        { set: { "reset.password": "weakpass", "reset.confirm": "weakpass" } }, { press: "Set password" }, { expectError: "does not meet the required criteria" },
        { set: { "reset.password": "Abcdef1!", "reset.confirm": "Different1!" } }, { press: "Set password" }, { expectToast: "do not match" },
        { set: { "reset.confirm": "Abcdef1!" } }, { press: "Set password" }, { expectScreen: "done" }, { expectText: "successfully reset" },
      ]);
      expect(r.failures).toEqual([]);
      expect(r.finalKind).toBe("terminal");
    });
    it("says so when the details do not match, with a fresh captcha on the way back", async () => {
      const r = await run(cantSignIn, [
        { press: "Reset password" }, { set: { ...verifyFields, "verify.email": "nobody@acme-corp.example" } }, { press: "Continue" },
        { expectScreen: "nomatch" }, { expectText: "don't match our records" }, { press: "Try again" }, { expectScreen: "verify" }, { expectText: "R4T9X" },
      ]);
      expect(r.failures).toEqual([]);
    });
    it("refuses a wrong captcha and stays on the form", async () => {
      const r = await run(cantSignIn, [{ press: "Reset password" }, { set: { ...verifyFields, "captcha.value": "WRONG" } }, { press: "Continue" }, { expectToast: "Invalid captcha" }, { expectScreen: "verify" }]);
      expect(r.failures).toEqual([]);
    });
  });

  describe("enroll", () => {
    const pick = [{ expectScreen: "entity" }, { set: { "enroll.entity": "GB0010001" } }, { press: "Continue" }, { expectScreen: "details" }] as Step[];
    it("enrolls a new user", async () => {
      const r = await run(enroll, [...pick, { set: { "enroll.taxId": "123-45-6789", "enroll.lastName": "Smith", "enroll.dob": "1985-04-12", "captcha.value": "K7M2Q" } }, { press: "Proceed" }, { expectScreen: "done" }, { expectText: "activation code" }]);
      expect(r.failures).toEqual([]);
    });
    it("tells someone who is already enrolled", async () => {
      const r = await run(enroll, [...pick, { set: { "enroll.taxId": "111-11-1111", "enroll.lastName": "Brown", "enroll.dob": "1990-09-30", "captcha.value": "K7M2Q" } }, { press: "Proceed" }, { expectScreen: "already" }, { expectText: "already enrolled" }]);
      expect(r.failures).toEqual([]);
    });
    it("cannot enroll an unknown person, and refuses a wrong captcha", async () => {
      const a = await run(enroll, [...pick, { set: { "enroll.taxId": "000-00-0000", "enroll.lastName": "Nobody", "enroll.dob": "1970-01-01", "captcha.value": "K7M2Q" } }, { press: "Proceed" }, { expectScreen: "cant" }, { expectText: "contact the bank administrator" }]);
      expect(a.failures).toEqual([]);
      const b = await run(enroll, [...pick, { set: { "enroll.taxId": "123-45-6789", "enroll.lastName": "Smith", "enroll.dob": "1985-04-12", "captcha.value": "NOPE1" } }, { press: "Proceed" }, { expectToast: "incorrect captcha" }, { expectScreen: "details" }]);
      expect(b.failures).toEqual([]);
    });
  });

  describe("activate your profile", () => {
    it("activates and sets a password", async () => {
      const r = await run(activateProfile, [
        { set: { "activate.username": "jsmith", "activate.code": "ACT-4821" } }, { press: "Verify" }, { expectScreen: "password" },
        { set: { "reset.password": "Abcdef1!", "reset.confirm": "Abcdef1!" } }, { press: "Set password" }, { expectScreen: "done" }, { expectText: "activated your profile" },
      ]);
      expect(r.failures).toEqual([]);
    });
    it.each([["blocked.user", "ACT-0001", "blocked", "is blocked"], ["expired.user", "ACT-0002", "expired", "has expired"], ["jsmith", "wrong", "invalid", "incorrect username or activation code"]])(
      "%s: shows the %s message", async (user, code, screen, text) => {
        const r = await run(activateProfile, [{ set: { "activate.username": user, "activate.code": code } }, { press: "Verify" }, { expectScreen: screen }, { expectText: text }, { press: user === "jsmith" ? "Try again" : "Back" }, { expectScreen: "details" }]);
        expect(r.failures).toEqual([]);
      });
  });
});
