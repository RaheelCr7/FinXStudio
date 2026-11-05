import { describe, it, expect } from "vitest";
import { normalisePerson, rememberPerson, rememberedPerson, REMEMBER_KEY, signInOutcome, validateSignIn } from "./signin";

/** the message of an answer that is an error (the tests below only ask this of errors) */
const said = (status: number, body: unknown, retry?: number) => { const o = signInOutcome(status, body, retry); return o.kind === "error" ? o.message : ""; };

describe("sign-in form checks", () => {
  it("needs a person id and a password", () => {
    expect(validateSignIn({ person: "", password: "" })).toEqual({ person: "Enter your person id", password: "Enter your password" });
    expect(validateSignIn({ person: "   ", password: "x" })).toEqual({ person: "Enter your person id" });
    expect(validateSignIn({ person: "alex", password: "" })).toEqual({ password: "Enter your password" });
    expect(validateSignIn({ person: "alex", password: "correct horse" })).toEqual({});
  });
  it("refuses spaces inside an id and very long ids, and lower-cases like the API", () => {
    expect(validateSignIn({ person: "alex morgan", password: "x" }).person).toMatch(/no spaces/);
    expect(validateSignIn({ person: "a".repeat(65), password: "x" }).person).toMatch(/too long/);
    expect(normalisePerson("  Alex ")).toBe("alex");
  });
});

describe("the words for each sign-in answer", () => {
  it("passes a success through", () => expect(signInOutcome(200, { id: "alex" })).toEqual({ kind: "ok" }));
  it("shows the server's words for a wrong password", () => {
    expect(signInOutcome(401, { error: "That name or password is not right" })).toEqual({ kind: "error", locked: false, message: "That name or password is not right" });
    expect(said(401, null)).toBe("That name or password is not right");
  });
  it("says how long a lockout lasts, rounded up to whole minutes, defaulting to the 15-minute window", () => {
    expect(signInOutcome(429, { error: "Too many attempts. Try again later." }, 61)).toEqual({ kind: "error", locked: true, message: "Too many attempts. Try again in 2 minutes." });
    expect(said(429, null, 30)).toBe("Too many attempts. Try again in 1 minute.");
    expect(said(429, null)).toBe("Too many attempts. Try again in 15 minutes.");
  });
  it("explains the demo profile and falls back to a plain message", () => {
    expect(said(404, { error: "Sign-in is only used in the production profile" })).toMatch(/production profile/);
    expect(said(500, "not json")).toBe("Could not sign in. Try again.");
    expect(said(403, { error: "Origin not allowed" })).toBe("Origin not allowed");
  });
});

describe("remember me", () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
  it("keeps only the person id, and forgets it when unticked", () => {
    const s = store();
    rememberPerson(s, " Alex ", true);
    expect(s.m.get(REMEMBER_KEY)).toBe("alex");
    expect(rememberedPerson(s)).toBe("alex");
    rememberPerson(s, "alex", false);
    expect(rememberedPerson(s)).toBe("");
  });
  it("survives storage that is missing or throws", () => {
    expect(rememberedPerson(null)).toBe("");
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); }, removeItem: () => { throw new Error("no"); } };
    expect(() => rememberPerson(broken, "alex", true)).not.toThrow();
    expect(rememberedPerson(broken)).toBe("");
  });
});
