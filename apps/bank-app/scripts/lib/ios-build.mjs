/** Pure helpers for scripts/build-ios.mjs, kept separate so they can be tested. */

/** meezan-digital-0.1.0-1-uat-simulator */
export function iosArtifactName({ slug, version, buildNumber, env, target = "simulator" }) {
  return `${slug}-${version}-${buildNumber}-${env}-${target}`;
}

/** iOS Simulator devices from `xcrun simctl list devices available --json`, newest iOS first: [{ udid, name, state, os }] */
export function simulatorDevices(json) {
  const data = typeof json === "string" ? JSON.parse(json || "{}") : (json ?? {});
  const out = [];
  for (const [runtime, devices] of Object.entries(data.devices ?? {})) {
    const m = /SimRuntime\.iOS-(\d+)-(\d+)/.exec(runtime);
    if (!m || !Array.isArray(devices)) continue; // skip watchOS, tvOS and visionOS
    for (const d of devices) {
      if (d.isAvailable === false) continue;
      out.push({ udid: d.udid, name: d.name, state: d.state, os: `${m[1]}.${m[2]}`, rank: Number(m[1]) * 1000 + Number(m[2]) });
    }
  }
  return out.sort((a, b) => b.rank - a.rank).map(({ rank, ...d }) => d);
}

/** "16.4" -> 16004, so iOS versions compare as numbers. */
const osRank = (os) => { const [major = 0, minor = 0] = String(os).split(".").map(Number); return major * 1000 + minor; };

/**
 * The simulator to use: the one named (or its UDID), else a booted iPhone, else the newest iPhone Pro, else any iPhone.
 * Simulators older than the app's minimum iOS version are skipped.
 */
export function pickSimulator(devices, name, minOs = "0") {
  const usable = devices.filter((d) => osRank(d.os) >= osRank(minOs));
  if (name) return usable.find((d) => d.name === name || d.udid === name) ?? null;
  const phones = usable.filter((d) => d.name.startsWith("iPhone"));
  return phones.find((d) => d.state === "Booted") ?? phones.find((d) => / Pro$/.test(d.name)) ?? phones[0] ?? null;
}

/**
 * What an Info.plist allows over plain http (App Transport Security). iOS ignores NSAllowsArbitraryLoads when any of
 * the narrower NSAllowsLocalNetworking, ...ForMedia or ...InWebContent keys is present, so those switch it off here too.
 */
export function atsSummary(infoPlist) {
  const ats = infoPlist?.NSAppTransportSecurity ?? {};
  const narrowed = ["NSAllowsLocalNetworking", "NSAllowsArbitraryLoadsForMedia", "NSAllowsArbitraryLoadsInWebContent"].some((k) => k in ats);
  return {
    arbitraryLoads: ats.NSAllowsArbitraryLoads === true && !narrowed,
    localNetworking: ats.NSAllowsLocalNetworking === true,
    exceptionDomains: Object.keys(ats.NSExceptionDomains ?? {}),
  };
}

/** A production build allows no plain http at all. A UAT build must reach a Studio on a laptop over plain http. */
export function atsProblems(summary, env) {
  const problems = [];
  if (env === "production") {
    if (summary.arbitraryLoads) problems.push("it allows plain http to any server (NSAllowsArbitraryLoads)");
    if (summary.localNetworking) problems.push("it allows plain http on the local network (NSAllowsLocalNetworking)");
    if (summary.exceptionDomains.length) problems.push(`it has plain-http exceptions for ${summary.exceptionDomains.join(", ")}`);
  } else if (!summary.arbitraryLoads) {
    problems.push("it cannot reach a Studio on a laptop over plain http (NSAllowsArbitraryLoads is off)");
  }
  return problems;
}

/** Compares the built app's Info.plist with what was asked for, including the plain-http policy. */
export function plistProblems(infoPlist, expected) {
  const problems = [];
  const check = (key, want) => {
    if (infoPlist?.[key] !== want) problems.push(`${key} is ${JSON.stringify(infoPlist?.[key])}, expected ${JSON.stringify(want)}`);
  };
  check("CFBundleIdentifier", expected.bundleId);
  check("CFBundleShortVersionString", expected.version);
  check("CFBundleVersion", expected.buildNumber);
  if (expected.minOs && osRank(infoPlist?.MinimumOSVersion ?? "0") < osRank(expected.minOs)) problems.push(`MinimumOSVersion is ${JSON.stringify(infoPlist?.MinimumOSVersion)}, expected ${expected.minOs} or newer`);
  if (expected.env !== "production" && !infoPlist?.NSLocalNetworkUsageDescription) problems.push("NSLocalNetworkUsageDescription is missing, so a phone could not ask to reach Studio on the Wi-Fi");
  return [...problems, ...atsProblems(atsSummary(infoPlist), expected.env)];
}

/** True when the first bytes are Hermes bytecode, the precompiled JavaScript a Release build embeds. */
export function isHermesBytecode(bytes) {
  return bytes?.length >= 4 && bytes[0] === 0xc6 && bytes[1] === 0x1f && bytes[2] === 0xbc && bytes[3] === 0x03;
}

/**
 * Where CocoaPods is: on PATH, else in the Apple Silicon Homebrew. The Intel Homebrew in /usr/local is not used,
 * because React Native warns against running pod install under Rosetta.
 */
export function findPod(pathEnv, exists) {
  for (const dir of String(pathEnv ?? "").split(":").filter(Boolean)) if (exists(`${dir}/pod`) && dir !== "/usr/local/bin") return dir;
  return exists("/opt/homebrew/bin/pod") ? "/opt/homebrew/bin" : null;
}

/** A short, actionable explanation for the most common iOS build failures, from the end of the output. */
export function iosHintFor(tail) {
  const t = String(tail).toLowerCase();
  if (t.includes("no space left on device")) return "The disk is full. Free some space (Xcode's DerivedData and CocoaPods caches can be large) and run again.";
  if (t.includes("pod: command not found") || t.includes("cocoapods is not installed") || t.includes("command `pod` not found")) return "CocoaPods is not installed. On an Apple Silicon Mac: /opt/homebrew/bin/brew install cocoapods (see docs/IOS.md), then run again.";
  if (t.includes("ffi") && (t.includes("x86_64") || t.includes("incompatible architecture"))) return "CocoaPods is running under Rosetta (Intel). Use the Apple Silicon one: /opt/homebrew/bin/brew install cocoapods, then run again.";
  if (t.includes("sandbox") && t.includes("deny") && t.includes("file-write")) return "Xcode's script sandbox blocked a build step. Run again with --clean; if it persists, see docs/IOS.md.";
  if (t.includes("could not find compatible versions for pod") || t.includes("out-of-date source repos")) return "CocoaPods' list of libraries is out of date. Run: pod repo update, then run again.";
  if (t.includes("xcode-select") || t.includes("requires xcode") || t.includes("sdk \"iphonesimulator\" cannot be located")) return "Xcode is not set up. Install Xcode, open it once, then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer";
  if (t.includes("unable to find a destination") || t.includes("no simulator runtime")) return "No iOS Simulator runtime matches. Install one in Xcode > Settings > Components, then run again.";
  if (t.includes("requires a development team") || t.includes("no signing certificate") || t.includes("provisioning profile")) return "This needs code signing. Simulator builds do not: build for the Simulator, or add an Apple developer account for a phone build.";
  if (t.includes("unable to resolve module") || t.includes("cannot find module")) return "A JavaScript dependency is missing. Run pnpm install at the repo root, then run again.";
  if (t.includes("command phasescriptexecution failed") || t.includes("bundle react native code and images")) return "Bundling the JavaScript failed. The real error is a few lines above this one in dist/build-ios.log.";
  return "See dist/build-ios.log for the full output.";
}
