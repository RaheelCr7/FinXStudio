import { afterEach, describe, expect, it } from "vitest";
import { MockBank, SANDBOX_MARKER, SandboxNotAllowedError, sandboxAllowed, sandboxAllowedFor, setSandboxPolicy } from "./index";

afterEach(() => setSandboxPolicy({ allowed: true }));

describe("sandbox policy", () => {
  it("is allowed by default, so demo, UAT, Studio and tests are unchanged", () => {
    expect(sandboxAllowed()).toBe(true);
    expect(() => new MockBank()).not.toThrow();
  });
  it("refuses to create a bank once a build has switched it off", () => {
    setSandboxPolicy({ allowed: false });
    expect(() => new MockBank()).toThrow(SandboxNotAllowedError);
    expect(() => new MockBank()).toThrow(SANDBOX_MARKER);
    setSandboxPolicy({ allowed: true });
    expect(() => new MockBank()).not.toThrow();
  });
  it("lets a production build use the sandbox only with an explicit 1", () => {
    expect(sandboxAllowedFor(undefined, undefined)).toBe(true);
    expect(sandboxAllowedFor("uat", undefined)).toBe(true);
    expect(sandboxAllowedFor("production", undefined)).toBe(false);
    expect(sandboxAllowedFor("production", "true")).toBe(false);
    expect(sandboxAllowedFor("production", "1")).toBe(true);
  });
});
