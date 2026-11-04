import { describe, it, expect } from "vitest";
import { hardeningFor, integrityVerdict, isHttps, startBlock } from "./policy";

const prod = hardeningFor({ EXPO_PUBLIC_FINX_ENV: "production" });
const demo = hardeningFor({});

describe("hardening policy", () => {
  it("is entirely off outside production", () => {
    expect(demo).toEqual({ enabled: false, blockCapture: false, integrity: "off", httpsOnly: false });
    expect(hardeningFor({ EXPO_PUBLIC_FINX_ENV: "uat" }).enabled).toBe(false);
    expect(startBlock(demo, "http://10.0.2.2:3100", "compromised")).toBeNull();
  });
  it("turns capture blocking, https only and device checks on in production", () => {
    expect(prod).toEqual({ enabled: true, blockCapture: true, integrity: "block", httpsOnly: true });
  });
  it("lets a bank choose to warn or switch the device check off, but nothing else weakens production", () => {
    expect(hardeningFor({ EXPO_PUBLIC_FINX_ENV: "production", EXPO_PUBLIC_FINX_INTEGRITY: "warn" }).integrity).toBe("warn");
    expect(hardeningFor({ EXPO_PUBLIC_FINX_ENV: "production", EXPO_PUBLIC_FINX_INTEGRITY: "off" }).integrity).toBe("off");
    expect(hardeningFor({ EXPO_PUBLIC_FINX_ENV: "production", EXPO_PUBLIC_FINX_INTEGRITY: "banana" }).integrity).toBe("block");
    expect(hardeningFor({ EXPO_PUBLIC_FINX_ENV: "production", EXPO_PUBLIC_FINX_INTEGRITY: "warn" }).httpsOnly).toBe(true);
  });
  it("accepts only real https addresses", () => {
    expect(isHttps("https://studio.bank.example")).toBe(true);
    expect(isHttps("HTTPS://studio.bank.example/x")).toBe(true);
    for (const bad of ["http://studio.bank.example", "https://", "ftp://x", "https:/x", " https://x", "javascript:alert(1)", ""]) expect(isHttps(bad), bad).toBe(false);
  });
  it("blocks a rooted device by default, warns when told to, and allows what it cannot check", () => {
    expect(integrityVerdict(prod, "compromised")).toBe("block");
    expect(integrityVerdict(prod, "ok")).toBe("allow");
    expect(integrityVerdict(prod, "unknown")).toBe("allow");
    expect(integrityVerdict({ ...prod, integrity: "warn" }, "compromised")).toBe("warn");
    expect(integrityVerdict({ ...prod, integrity: "off" }, "compromised")).toBe("allow");
  });
  it("refuses to start on a plain-http server or a compromised device, with a plain message", () => {
    expect(startBlock(prod, "http://studio.bank.example", "ok")).toMatchObject({ kind: "insecure_server" });
    expect(startBlock(prod, "https://studio.bank.example", "compromised")).toMatchObject({ kind: "compromised_device" });
    expect(startBlock(prod, "https://studio.bank.example", "ok")).toBeNull();
    expect(startBlock(prod, "https://studio.bank.example", "unknown")).toBeNull();
  });
});
