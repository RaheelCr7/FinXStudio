#!/usr/bin/env node
/**
 * Builds the app for the iOS Simulator on this Mac. No Expo account and no Apple developer account needed.
 *
 *   pnpm --filter @finx/bank-app build:ios
 *   pnpm --filter @finx/bank-app build:ios --install --device "iPhone 17 Pro"
 *
 * What it does: checks Xcode and CocoaPods, generates the native iOS project (expo prebuild), installs the native
 * libraries (pod install), builds a Release app for the Simulator with xcodebuild, zips it into apps/bank-app/dist, and
 * verifies it (bundle id, version, build number, plain-http policy, embedded JavaScript). A build for real iPhones needs
 * signing with an Apple developer account. See docs/IOS.md.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brandConfig, brandIds, ensureBrandAssets } from "./lib/brands.mjs";
import { formatDuration } from "./lib/common.mjs";
import { atsSummary, findPod, iosArtifactName, iosHintFor, isHermesBytecode, pickSimulator, plistProblems, simulatorDevices } from "./lib/ios-build.mjs";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(APP, "dist");
const IOS = join(APP, "ios");
const MARKER = join(IOS, ".finx-build.json");
const MIN_IOS = "16.4"; // Expo SDK 58's deployment target

const HELP = `Usage: build-ios.mjs [options]

  --brand meezan|bankworkx  Which bank this build is (name, ids, icons, look). Default meezan. See brands.json.
  --env uat|production    uat (default) allows changing the server inside the app and plain http.
                          production never does.
  --studio-url <url>      Studio address baked into the app as its default. The Simulator reaches this Mac at
                          http://localhost:3100 (the default); a phone needs the Mac's network address.
                          Required (https) for production, which cannot change it later.
  --build-number <n>      iOS build number (CFBundleVersion). Must go up with every store upload. Default 1.
  --clean                 Regenerate the native project from scratch (slow, fixes odd state)
  --install               Install and open the app on a Simulator when done
  --device <name|udid>    Which Simulator for --install, e.g. "iPhone 17 Pro". Default: the booted iPhone,
                          else the newest iPhone Pro
  -h, --help              This text
`;

// ---------- arguments ----------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = { brand: "meezan", env: "uat", studioUrl: undefined, buildNumber: "1", clean: false, install: false, device: undefined };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => { const v = args[++i]; if (v === undefined) fail(`${a} needs a value`); return v; };
  if (a === "-h" || a === "--help") { console.log(HELP); process.exit(0); }
  else if (a === "--brand") opt.brand = next();
  else if (a === "--env") opt.env = next();
  else if (a === "--studio-url") opt.studioUrl = next();
  else if (a === "--build-number") opt.buildNumber = next();
  else if (a === "--clean") opt.clean = true;
  else if (a === "--install") opt.install = true;
  else if (a === "--device") opt.device = next();
  else fail(`Unknown option ${a}\n\n${HELP}`);
}
if (!brandIds.includes(opt.brand)) fail(`--brand must be one of: ${brandIds.join(", ")}`);
const brand = brandConfig(opt.brand);
try { if (ensureBrandAssets(brand).made) console.log(`Made the app icons for ${brand.name}.`); } catch (e) { fail(e.message); }
if (!["uat", "production"].includes(opt.env)) fail("--env must be uat or production");
if (!/^[1-9][0-9]*$/.test(opt.buildNumber)) fail("--build-number must be a whole number of 1 or more");
if (opt.studioUrl && !/^https?:\/\/[^\s/]+/.test(opt.studioUrl)) fail("--studio-url must look like http://192.168.1.20:3100");
if (opt.env === "production" && !opt.studioUrl?.startsWith("https://")) fail("A production build cannot change its server and only talks https, so give it the real one: --studio-url https://...");

function fail(message) { console.error(`\nerror: ${message}`); process.exit(1); }
const step = (n, text) => console.log(`\n[${n}/7] ${text}`);
const run1 = (cmd, a, o = {}) => spawnSync(cmd, a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...o });

function freeGigabytes(dir) {
  const r = run1("df", ["-k", dir]);
  const cols = r.stdout.trim().split("\n").pop()?.split(/\s+/) ?? [];
  const kb = Number(cols[3]);
  return Number.isFinite(kb) ? kb / 1024 / 1024 : null;
}

// ---------- toolchain ------------------------------------------------------------------------------------------------
step(1, "Checking Xcode and CocoaPods");
if (platform() !== "darwin") fail("iOS apps can only be built on a Mac.");
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) fail(`Node 20 or newer is needed (this is ${process.versions.node}).`);
const xcode = run1("xcodebuild", ["-version"]);
if (xcode.status !== 0) fail(`Xcode was not found. Install it from the App Store, open it once, then run this again.\n${xcode.stderr.trim()}`);
if (run1("xcodebuild", ["-license", "check"]).status !== 0) fail("The Xcode licence has not been accepted. Accept it yourself (open Xcode, or run: sudo xcodebuild -license), then run this again.");
const sdks = run1("xcodebuild", ["-showsdks"]).stdout;
if (!/-sdk iphonesimulator/.test(sdks)) fail("Xcode has no iOS Simulator SDK. Install the iOS platform in Xcode > Settings > Components.");
const podDir = findPod(process.env.PATH, existsSync);
if (!podDir) fail("CocoaPods is not installed. On an Apple Silicon Mac: /opt/homebrew/bin/brew install cocoapods (see docs/IOS.md), then run this again.");
const pod = run1(join(podDir, "pod"), ["--version"], { env: { ...process.env, LANG: process.env.LANG ?? "en_US.UTF-8" } });
if (pod.status !== 0) fail(`CocoaPods in ${podDir} does not run: ${(pod.stderr || pod.stdout).trim()}\n${iosHintFor(pod.stderr)}`);
const free = freeGigabytes(APP);
if (free !== null && free < 5) fail(`Only ${free.toFixed(1)} GB of disk space is free. A first iOS build needs about 5 GB. Free some space and try again.`);
console.log(`  ${xcode.stdout.trim().split("\n").join(", ")}, CocoaPods ${pod.stdout.trim()}, Node ${process.versions.node}`);
if (free !== null) console.log(`  ${free.toFixed(1)} GB free`);

const childEnv = {
  ...process.env,
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  NODE_ENV: "production",
  LANG: process.env.LANG ?? "en_US.UTF-8", // CocoaPods needs a UTF-8 locale
  FINX_BRAND: opt.brand,
  EXPO_PUBLIC_FINX_BRAND: opt.brand,
  FINX_ENV: opt.env,
  EXPO_PUBLIC_FINX_ENV: opt.env,
  FINX_IOS_ALLOW_HTTP: opt.env === "production" ? "0" : "1",
  FINX_IOS_BUILD_NUMBER: opt.buildNumber,
  PATH: [podDir, process.env.PATH].join(delimiter),
  ...(opt.studioUrl ? { EXPO_PUBLIC_STUDIO_URL: opt.studioUrl.replace(/\/+$/, "") } : {}),
};
if (!opt.studioUrl) delete childEnv.EXPO_PUBLIC_STUDIO_URL; // only --studio-url may bake in an address
const studioUrl = childEnv.EXPO_PUBLIC_STUDIO_URL ?? "http://localhost:3100";

mkdirSync(DIST, { recursive: true });
const logPath = join(DIST, "build-ios.log");
const log = createWriteStream(logPath);

/** Runs a command, streaming its output to the console and to dist/build-ios.log. */
function run(cmd, a, cwd, { quiet = false } = {}) {
  return new Promise((done) => {
    log.write(`\n$ ${cmd} ${a.join(" ")}\n`);
    const p = spawn(cmd, a, { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const sink = (chunk) => { if (!quiet) process.stdout.write(chunk); log.write(chunk); tail = (tail + chunk.toString()).slice(-8000); };
    p.stdout.on("data", sink);
    p.stderr.on("data", sink);
    p.on("close", (code) => done({ code: code ?? 1, tail }));
  });
}

const started = Date.now();
const elapsed = () => formatDuration(Date.now() - started);

// ---------- build ------------------------------------------------------------------------------------------------------
// The generated project keeps its native libraries (Pods) and Xcode's build cache between runs, which saves minutes.
// It is regenerated from scratch when asked, or when the environment or server differs from the last build.
const wanted = JSON.stringify({ brand: opt.brand, env: opt.env, studioUrl });
const previous = existsSync(MARKER) ? readFileSync(MARKER, "utf8") : null;
const fresh = opt.clean || (existsSync(IOS) && previous !== wanted);
step(2, `Generating the native iOS project (${opt.env}${fresh ? ", from scratch" : ""})`);
if (fresh) rmSync(IOS, { recursive: true, force: true });
let r = await run("npx", ["expo", "prebuild", "--platform", "ios", "--no-install", "--no-clean"], APP);
if (r.code !== 0) fail(`expo prebuild failed. ${iosHintFor(r.tail)}`);

step(3, "Installing the native libraries (pod install; the first time downloads a few hundred MB)");
r = await run(join(podDir, "pod"), ["install"], IOS);
if (r.code !== 0) fail(`pod install failed after ${elapsed()}. ${iosHintFor(r.tail)}`);

const workspaceFile = readdirSync(IOS).find((f) => f.endsWith(".xcworkspace"));
if (!workspaceFile) fail(`No .xcworkspace was generated in ${IOS}.`);
const scheme = workspaceFile.replace(/\.xcworkspace$/, "");

step(4, `Building ${scheme} for the Simulator with Xcode (Release; the first build takes several minutes)`);
const derived = join(IOS, "build");
r = await run("xcodebuild", [
  "-workspace", workspaceFile, "-scheme", scheme, "-configuration", "Release",
  "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator",
  "-derivedDataPath", derived, "ARCHS=arm64", "ONLY_ACTIVE_ARCH=YES", "COMPILER_INDEX_STORE_ENABLE=NO", "build",
], IOS, { quiet: true });
if (r.code !== 0) {
  process.stdout.write(r.tail.split("\n").slice(-40).join("\n") + "\n");
  fail(`The Xcode build failed after ${elapsed()}. ${iosHintFor(r.tail)}`);
}
writeFileSync(MARKER, wanted);

// ---------- artifact ---------------------------------------------------------------------------------------------------
step(5, "Collecting the app");
const products = join(derived, "Build", "Products", "Release-iphonesimulator");
const appName = existsSync(products) ? readdirSync(products).find((f) => f.endsWith(".app")) : undefined;
if (!appName) fail(`The build finished but no .app was found in ${products}.`);
const appPath = join(products, appName);
const appJson = JSON.parse(readFileSync(join(APP, "app.json"), "utf8")).expo;
const base = iosArtifactName({ slug: brand.slug, version: appJson.version, buildNumber: opt.buildNumber, env: opt.env });
const zip = join(DIST, `${base}.app.zip`);
rmSync(zip, { force: true });
const z = run1("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zip]);
if (z.status !== 0) fail(`Could not zip the app: ${z.stderr}`);

step(6, "Verifying the app");
const plist = JSON.parse(run1("plutil", ["-convert", "json", "-o", "-", join(appPath, "Info.plist")]).stdout || "{}");
const problems = plistProblems(plist, { bundleId: brand.bundleId, version: appJson.version, buildNumber: opt.buildNumber, env: opt.env, minOs: MIN_IOS });
const jsBundle = join(appPath, "main.jsbundle");
if (!existsSync(jsBundle)) problems.push("main.jsbundle is missing, so the app would need a development server");
else if (!isHermesBytecode(firstBytes(jsBundle, 4))) problems.push("main.jsbundle is not precompiled (Hermes), so the app would start slowly");
if (problems.length) fail(`The app does not match what was asked for:\n  - ${problems.join("\n  - ")}`);
const urlBaked = existsSync(jsBundle) && readFileSync(jsBundle).includes(studioUrl);
const exe = join(appPath, plist.CFBundleExecutable ?? scheme);
const archs = run1("lipo", ["-archs", exe]).stdout.trim() || "unknown";
const ats = atsSummary(plist);
const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");
const mb = (statSync(zip).size / 1024 / 1024).toFixed(1);

step(7, `Done in ${elapsed()}`);
if (!urlBaked) console.log(`  warning: ${studioUrl} was not found in the app's JavaScript. Check the server shown on the sign-in screen.`);
console.log(`
  app      ${zip}
  size     ${mb} MB zipped
  sha256   ${sha}
  bundle   ${plist.CFBundleIdentifier}  version ${plist.CFBundleShortVersionString} (${plist.CFBundleVersion})  iOS ${plist.MinimumOSVersion}+
  name     ${plist.CFBundleDisplayName ?? plist.CFBundleName}
  CPU      ${archs} (Simulator)
  http     ${ats.arbitraryLoads ? "plain http allowed (UAT: reaches a Studio on a laptop)" : ats.localNetworking ? "plain http on the local network only" : "https only"}
  server   ${opt.studioUrl ?? "http://localhost:3100 (this Mac, as seen from the Simulator)"}${opt.env === "production" ? "" : "; can be changed inside the app"}
  log      ${logPath}
`);

// ---------- install --------------------------------------------------------------------------------------------------
if (opt.install) {
  const devices = simulatorDevices(run1("xcrun", ["simctl", "list", "devices", "available", "--json"]).stdout);
  const device = pickSimulator(devices, opt.device, MIN_IOS);
  if (!device) fail(opt.device ? `No Simulator called "${opt.device}" with iOS ${MIN_IOS} or newer. See: xcrun simctl list devices available` : `No iPhone Simulator with iOS ${MIN_IOS} or newer is available. Add one in Xcode > Window > Devices and Simulators.`);
  if (device.state !== "Booted") {
    console.log(`Booting ${device.name} (iOS ${device.os})…`);
    const b = run1("xcrun", ["simctl", "bootstatus", device.udid, "-b"]);
    if (b.status !== 0) fail(`Could not boot ${device.name}: ${b.stderr || b.stdout}`);
    run1("open", ["-a", "Simulator"]);
  }
  const i = run1("xcrun", ["simctl", "install", device.udid, appPath]);
  if (i.status !== 0) fail(`Install failed: ${i.stderr || i.stdout}`);
  const l = run1("xcrun", ["simctl", "launch", "--terminate-running-process", device.udid, plist.CFBundleIdentifier]);
  console.log(l.status === 0 ? `Installed and opened on ${device.name} (iOS ${device.os}).` : `Installed on ${device.name}, but it did not open: ${l.stderr || l.stdout}`);
} else {
  console.log(`Install it on a booted Simulator with:  xcrun simctl install booted "${appPath}"`);
}
log.end();

function firstBytes(file, n) {
  const fd = openSync(file, "r");
  try { const b = Buffer.alloc(n); readSync(fd, b, 0, n, 0); return b; } finally { closeSync(fd); }
}
