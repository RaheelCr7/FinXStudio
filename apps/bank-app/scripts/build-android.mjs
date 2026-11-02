#!/usr/bin/env node
/**
 * Builds an installable Android APK of the app on this computer. No Expo account needed.
 *
 *   pnpm --filter @finx/bank-app build:android
 *   pnpm --filter @finx/bank-app build:android --studio-url http://192.168.1.20:3100 --install
 *
 * What it does: checks the toolchain, generates the native Android project (expo prebuild), builds the release
 * APK with Gradle, copies it to apps/bank-app/dist, and verifies it (signature, package, version, CPU types).
 * UAT builds are signed with the standard debug key: fine for testers, not for a store. See docs/ANDROID.md.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactName, formatDuration, hintFor, isDebugSigner, parseBadging, parseSigner, readyDevices } from "./lib/android-build.mjs";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(APP, "dist");
const ANDROID = join(APP, "android");

const HELP = `Usage: build-android.mjs [options]

  --env uat|production    uat (default) allows changing the server inside the app and plain http.
                          production never does. A store build also needs your own signing key (docs/ANDROID.md).
  --studio-url <url>      Studio address baked into the app as its default, e.g. http://192.168.1.20:3100
  --abis <list>           CPU types, comma separated. Default arm64-v8a (phones, Apple Silicon emulators).
                          Add x86_64 for Intel emulators.
  --version-code <n>      Android versionCode. Must go up with every store upload. Default 1.
  --aab                   Also build the Play Store bundle (.aab)
  --clean                 Regenerate the native project from scratch (slow, fixes odd state)
  --install               Install on the connected device or emulator when done
  -h, --help              This text
`;

// ---------- arguments ----------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = { env: "uat", studioUrl: undefined, abis: "arm64-v8a", versionCode: "1", aab: false, clean: false, install: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => { const v = args[++i]; if (v === undefined) fail(`${a} needs a value`); return v; };
  if (a === "-h" || a === "--help") { console.log(HELP); process.exit(0); }
  else if (a === "--env") opt.env = next();
  else if (a === "--studio-url") opt.studioUrl = next();
  else if (a === "--abis") opt.abis = next();
  else if (a === "--version-code") opt.versionCode = next();
  else if (a === "--aab") opt.aab = true;
  else if (a === "--clean") opt.clean = true;
  else if (a === "--install") opt.install = true;
  else fail(`Unknown option ${a}\n\n${HELP}`);
}
if (!["uat", "production"].includes(opt.env)) fail("--env must be uat or production");
if (!/^[1-9][0-9]*$/.test(opt.versionCode)) fail("--version-code must be a whole number of 1 or more");
if (opt.studioUrl && !/^https?:\/\/[^\s/]+/.test(opt.studioUrl)) fail("--studio-url must look like http://192.168.1.20:3100");
if (opt.env === "production" && !opt.studioUrl?.startsWith("https://")) fail("A production build cannot change its server, so give it the real one: --studio-url https://...");

function fail(message) { console.error(`\nerror: ${message}`); process.exit(1); }
const step = (n, text) => console.log(`\n[${n}/6] ${text}`);
const run1 = (cmd, a, o = {}) => spawnSync(cmd, a, { encoding: "utf8", ...o });

// ---------- toolchain ------------------------------------------------------------------------------------------------
function findJava() {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME);
  if (platform() === "darwin") for (const v of ["21", "17"]) { const r = run1("/usr/libexec/java_home", ["-v", v]); if (r.status === 0) candidates.push(r.stdout.trim()); }
  for (const home of candidates) {
    const bin = join(home, "bin", "java");
    if (!existsSync(bin)) continue;
    const r = run1(bin, ["-version"]);
    const m = /version "(\d+)/.exec(`${r.stderr}${r.stdout}`);
    if (m && Number(m[1]) >= 17) return { home, major: Number(m[1]) };
  }
  return null;
}

function findSdk() {
  const dirs = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), "Library", "Android", "sdk"), join(homedir(), "Android", "Sdk")].filter(Boolean);
  return dirs.find((d) => existsSync(join(d, "licenses"))) ?? dirs.find((d) => existsSync(d)) ?? null;
}

function freeGigabytes(dir) {
  const r = run1("df", ["-k", dir]);
  const cols = r.stdout.trim().split("\n").pop()?.split(/\s+/) ?? [];
  const kb = Number(cols[3]);
  return Number.isFinite(kb) ? kb / 1024 / 1024 : null;
}

step(1, "Checking the toolchain");
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) fail(`Node 20 or newer is needed (this is ${process.versions.node}).`);
const java = findJava();
if (!java) fail("JDK 17 or newer was not found. Install one (for example Amazon Corretto 17) or set JAVA_HOME.");
const sdk = findSdk();
if (!sdk) fail("The Android SDK was not found. Install it and set ANDROID_HOME (default location: ~/Library/Android/sdk).");
if (!existsSync(join(sdk, "licenses", "android-sdk-license"))) {
  fail(`The Android SDK licenses have not been accepted in ${sdk}.\nAccept them yourself (sdkmanager --licenses, or open the SDK Manager in Android Studio), then run this again.`);
}
const free = freeGigabytes(APP);
if (free !== null && free < 4) fail(`Only ${free.toFixed(1)} GB of disk space is free. A first build needs about 8 GB (Gradle, the NDK, build output) and later builds about 1 GB. Free some space and try again.`);
console.log(`  Node ${process.versions.node}, JDK ${java.major} (${java.home})`);
console.log(`  Android SDK ${sdk}`);
if (free !== null) console.log(`  ${free.toFixed(1)} GB free${free < 10 ? " (tight: a first build needs about 8 GB, later ones about 1 GB)" : ""}`);

const childEnv = {
  ...process.env,
  JAVA_HOME: java.home,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  PATH: [join(java.home, "bin"), join(sdk, "platform-tools"), process.env.PATH].join(delimiter),
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  NODE_ENV: "production",
  FINX_ENV: opt.env,
  EXPO_PUBLIC_FINX_ENV: opt.env,
  FINX_ANDROID_CLEARTEXT: opt.env === "production" ? "0" : "1",
  FINX_ANDROID_ABIS: opt.abis,
  FINX_ANDROID_VERSION_CODE: opt.versionCode,
  ...(opt.studioUrl ? { EXPO_PUBLIC_STUDIO_URL: opt.studioUrl.replace(/\/+$/, "") } : {}),
};
if (!opt.studioUrl) delete childEnv.EXPO_PUBLIC_STUDIO_URL; // only --studio-url may bake in an address

mkdirSync(DIST, { recursive: true });
const logPath = join(DIST, "build-android.log");
const log = createWriteStream(logPath);

/** Runs a command, streaming its output to the console and to dist/build-android.log. */
function run(cmd, a, cwd) {
  return new Promise((done) => {
    log.write(`\n$ ${cmd} ${a.join(" ")}\n`);
    const p = spawn(cmd, a, { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const sink = (chunk) => { process.stdout.write(chunk); log.write(chunk); tail = (tail + chunk.toString()).slice(-6000); };
    p.stdout.on("data", sink);
    p.stderr.on("data", sink);
    p.on("close", (code) => done({ code: code ?? 1, tail }));
  });
}

const started = Date.now();
const elapsed = () => formatDuration(Date.now() - started);

// ---------- build ------------------------------------------------------------------------------------------------------
step(2, `Generating the native Android project (${opt.env}${opt.clean ? ", clean" : ""})`);
if (opt.clean && existsSync(ANDROID)) rmSync(ANDROID, { recursive: true, force: true });
let r = await run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"], APP);
if (r.code !== 0) fail(`expo prebuild failed. ${hintFor(r.tail)}`);

step(3, "Building with Gradle (the first build downloads the NDK and takes a while)");
const gradleTasks = [":app:assembleRelease", ...(opt.aab ? [":app:bundleRelease"] : [])];
r = await run("./gradlew", [...gradleTasks, "--console=plain", "-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g"], ANDROID);
if (r.code !== 0) fail(`The Gradle build failed after ${elapsed()}. ${hintFor(r.tail)}`);

// ---------- artifact ---------------------------------------------------------------------------------------------------
step(4, "Collecting the APK");
const built = join(ANDROID, "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(built)) fail(`The build finished but ${built} does not exist.`);
const appJson = JSON.parse(readFileSync(join(APP, "app.json"), "utf8")).expo;
const base = artifactName({ slug: appJson.slug, version: appJson.version, versionCode: opt.versionCode, env: opt.env, abis: opt.abis });
const apk = join(DIST, `${base}.apk`);
copyFileSync(built, apk);
if (opt.aab) {
  const bundle = join(ANDROID, "app", "build", "outputs", "bundle", "release", "app-release.aab");
  if (existsSync(bundle)) copyFileSync(bundle, join(DIST, `${base}.aab`));
}

step(5, "Verifying the APK");
const buildTools = join(sdk, "build-tools");
const newest = existsSync(buildTools) ? readdirSync(buildTools).filter((d) => /^\d/.test(d)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop() : undefined;
let info = { package: "", versionName: "", versionCode: "", launchable: "", label: "", minSdk: "", targetSdk: "", nativeCode: "", permissions: [] };
let signer = { dn: "", sha256: "" };
if (newest) {
  const aapt2 = join(buildTools, newest, "aapt2");
  if (existsSync(aapt2)) info = parseBadging(run1(aapt2, ["dump", "badging", apk]).stdout);
  const apksigner = join(buildTools, newest, "apksigner");
  if (existsSync(apksigner)) {
    const v = run1(apksigner, ["verify", "--print-certs", apk]);
    if (v.status !== 0) fail(`The APK signature did not verify:\n${v.stderr || v.stdout}`);
    signer = parseSigner(v.stdout);
    console.log(`  signature verified (${signer.dn || "unknown signer"})`);
  }
}
if (info.package && info.package !== appJson.android.package) fail(`The APK has package ${info.package}, expected ${appJson.android.package}.`);
if (info.versionCode && info.versionCode !== opt.versionCode) fail(`The APK has versionCode ${info.versionCode}, expected ${opt.versionCode}.`);
const sha = createHash("sha256").update(readFileSync(apk)).digest("hex");
const mb = (statSync(apk).size / 1024 / 1024).toFixed(1);

step(6, `Done in ${elapsed()}`);
console.log(`
  APK      ${apk}
  size     ${mb} MB
  sha256   ${sha}
  package  ${info.package || "(aapt2 not found)"}  version ${info.versionName} (${info.versionCode})  Android ${info.minSdk}+ (target ${info.targetSdk})
  name     ${info.label}
  starts   ${info.launchable}
  CPU      ${info.nativeCode}
  asks for ${info.permissions.filter((p) => !p.endsWith(".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION")).map((p) => p.replace(/^android\.permission\./, "")).join(", ") || "(none)"}
  signed   ${isDebugSigner(signer.dn) ? "with the Android debug key: fine for testing, not for the Play Store" : signer.dn || "(apksigner not found)"}
  server   ${opt.studioUrl ?? "http://10.0.2.2:3100 (the emulator's address for this computer; change it inside the app)"}
  log      ${logPath}
`);

if (opt.install) {
  const adb = join(sdk, "platform-tools", "adb");
  const devices = readyDevices(run1(adb, ["devices"]).stdout);
  if (!devices.length) console.log("No device or emulator is connected, so nothing was installed. Connect one and run: adb install -r " + apk);
  else {
    const i = run1(adb, ["-s", devices[0], "install", "-r", apk]);
    console.log(i.status === 0 ? `Installed on ${devices[0]}${devices.length > 1 ? ` (the first of ${devices.length} connected devices)` : ""}.` : `Install failed: ${i.stderr || i.stdout}`);
    if (i.status !== 0) process.exit(1);
  }
} else {
  console.log(`Install it with:  ${join(sdk, "platform-tools", "adb")} install -r "${apk}"`);
}
log.end();
