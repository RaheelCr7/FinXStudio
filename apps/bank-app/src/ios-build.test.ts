import { describe, expect, it } from "vitest";
import { atsProblems, atsSummary, findPod, iosArtifactName, iosHintFor, isHermesBytecode, pickSimulator, plistProblems, simulatorDevices } from "../scripts/lib/ios-build.mjs";
import { formatDuration } from "../scripts/lib/common.mjs";

const SIMCTL = {
  devices: {
    "com.apple.CoreSimulator.SimRuntime.iOS-17-0": [
      { udid: "A", name: "iPhone 15 Pro", state: "Shutdown", isAvailable: true },
    ],
    "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
      { udid: "B", name: "iPhone 17", state: "Shutdown", isAvailable: true },
      { udid: "C", name: "iPhone 17 Pro", state: "Shutdown", isAvailable: true },
      { udid: "D", name: "iPhone Air", state: "Shutdown", isAvailable: false },
      { udid: "E", name: "iPad Pro 13-inch (M5)", state: "Shutdown", isAvailable: true },
    ],
    "com.apple.CoreSimulator.SimRuntime.watchOS-26-0": [{ udid: "W", name: "Apple Watch", state: "Shutdown", isAvailable: true }],
  },
};

describe("build-ios helpers", () => {
  it("names the artifact from app, version, build and target", () => {
    expect(iosArtifactName({ slug: "meezan-digital", version: "0.1.0", buildNumber: "1", env: "uat" })).toBe("meezan-digital-0.1.0-1-uat-simulator");
    expect(iosArtifactName({ slug: "meezan-digital", version: "1.2.0", buildNumber: "12", env: "production", target: "device" })).toBe("meezan-digital-1.2.0-12-production-device");
  });

  it("lists available iOS simulators, newest iOS first, without watches or unavailable ones", () => {
    const devices = simulatorDevices(JSON.stringify(SIMCTL));
    expect(devices.map((d) => d.udid)).toEqual(["B", "C", "E", "A"]);
    expect(devices[0]).toEqual({ udid: "B", name: "iPhone 17", state: "Shutdown", os: "26.5" });
    expect(simulatorDevices("")).toEqual([]);
  });

  it("picks the named simulator, else a booted iPhone, else the newest iPhone Pro", () => {
    const devices = simulatorDevices(SIMCTL);
    expect(pickSimulator(devices, "iPhone 15 Pro")?.udid).toBe("A");
    expect(pickSimulator(devices, "B")?.udid).toBe("B");
    expect(pickSimulator(devices, "iPhone 99")).toBeNull();
    expect(pickSimulator(devices)?.udid).toBe("C");
    const booted = devices.map((d) => (d.udid === "A" ? { ...d, state: "Booted" } : d));
    expect(pickSimulator(booted)?.udid).toBe("A");
    expect(pickSimulator([])).toBeNull();
    // the iOS 17.0 phone is too old for an app that needs 26.0
    expect(pickSimulator(booted, undefined, "26.0")?.udid).toBe("C");
    expect(pickSimulator(devices, "iPhone 15 Pro", "16.4")?.udid).toBe("A");
    expect(pickSimulator(devices, "iPhone 15 Pro", "17.1")).toBeNull();
  });

  it("keeps production strict about plain http and lets UAT reach a laptop", () => {
    const open = atsSummary({ NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } });
    const local = atsSummary({ NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true } });
    const strict = atsSummary({});
    const excepted = atsSummary({ NSAppTransportSecurity: { NSExceptionDomains: { "studio.example": {} } } });
    expect(atsProblems(open, "uat")).toEqual([]);
    expect(atsProblems(local, "uat")).toHaveLength(1);
    expect(atsProblems(strict, "production")).toEqual([]);
    expect(atsProblems(open, "production")).toHaveLength(1);
    expect(atsProblems(local, "production")).toHaveLength(1);
    expect(atsProblems(excepted, "production")[0]).toContain("studio.example");
    // iOS ignores NSAllowsArbitraryLoads next to NSAllowsLocalNetworking, so that is not open
    const both = atsSummary({ NSAppTransportSecurity: { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true } });
    expect(both.arbitraryLoads).toBe(false);
    expect(atsProblems(both, "uat")).toHaveLength(1);
  });

  it("checks the built Info.plist against what was asked for", () => {
    const plist = {
      CFBundleIdentifier: "pk.meezan.digital", CFBundleShortVersionString: "0.1.0", CFBundleVersion: "1", MinimumOSVersion: "16.4",
      NSLocalNetworkUsageDescription: "Connects to FinX Studio", NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
    };
    const expected = { bundleId: "pk.meezan.digital", version: "0.1.0", buildNumber: "1", env: "uat", minOs: "16.4" };
    expect(plistProblems(plist, expected)).toEqual([]);
    expect(plistProblems({ ...plist, CFBundleVersion: "2" }, expected)).toEqual(['CFBundleVersion is "2", expected "1"']);
    expect(plistProblems(plist, { ...expected, env: "production" })).toHaveLength(1);
    expect(plistProblems({ ...plist, MinimumOSVersion: "15.1" }, expected)[0]).toContain("MinimumOSVersion");
    const { NSLocalNetworkUsageDescription, ...silent } = plist;
    expect(plistProblems(silent, expected)[0]).toContain("NSLocalNetworkUsageDescription");
  });

  it("recognises precompiled Hermes JavaScript", () => {
    expect(isHermesBytecode(Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0x00]))).toBe(true);
    expect(isHermesBytecode(Buffer.from("var __BUNDLE"))).toBe(false);
    expect(isHermesBytecode(Buffer.alloc(0))).toBe(false);
  });

  it("finds CocoaPods on PATH or in the Apple Silicon Homebrew, never the Intel one", () => {
    const has = (...files: string[]) => (f: string) => files.includes(f);
    expect(findPod("/usr/bin:/Users/me/.gem/bin", has("/Users/me/.gem/bin/pod"))).toBe("/Users/me/.gem/bin");
    expect(findPod("/usr/local/bin:/usr/bin", has("/usr/local/bin/pod", "/opt/homebrew/bin/pod"))).toBe("/opt/homebrew/bin");
    expect(findPod("/usr/local/bin:/usr/bin", has("/usr/local/bin/pod"))).toBeNull();
    expect(findPod(undefined, has())).toBeNull();
  });

  it("explains the common iOS build failures", () => {
    expect(iosHintFor("zsh: pod: command not found")).toContain("CocoaPods is not installed");
    expect(iosHintFor("[!] CocoaPods could not find compatible versions for pod \"hermes-engine\"")).toContain("pod repo update");
    expect(iosHintFor("xcodebuild: error: SDK \"iphonesimulator\" cannot be located.")).toContain("xcode-select");
    expect(iosHintFor("Signing for \"MeezanDigital\" requires a development team.")).toContain("Simulator builds do not");
    expect(iosHintFor("Command PhaseScriptExecution failed with a nonzero exit code")).toContain("build-ios.log");
    expect(iosHintFor("error: No space left on device")).toContain("disk is full");
    expect(iosHintFor("something unexpected")).toContain("build-ios.log");
  });

  it("shares the duration format with the Android script", () => {
    expect(formatDuration(125_000)).toBe("2 min 5 s");
  });
});
