#!/usr/bin/env node
/**
 * A small helper to run the app on an Android emulator, without Android Studio.
 *
 *   node scripts/android-emulator.mjs create            make a virtual phone from the installed system image
 *   node scripts/android-emulator.mjs start [--window]  boot it (headless unless --window) and wait until ready
 *   node scripts/android-emulator.mjs install <apk>     install an APK
 *   node scripts/android-emulator.mjs launch            open the app and print how long the cold start took
 *   node scripts/android-emulator.mjs shot <file.png>   save a screenshot
 *   node scripts/android-emulator.mjs ui                list what is on screen (text and tappable things)
 *   node scripts/android-emulator.mjs wait "<label>" [s]  wait up to s seconds (default 30) for that text to appear
 *   node scripts/android-emulator.mjs tap "<label>"     tap the element with that text or accessibility label
 *   node scripts/android-emulator.mjs tapxy <x> <y>     tap a point (device pixels, as in a screenshot)
 *   node scripts/android-emulator.mjs swipe <x1> <y1> <x2> <y2> [ms]   drag, for scrolling
 *   node scripts/android-emulator.mjs type "<text>"     type into the focused field
 *   node scripts/android-emulator.mjs key back|home|enter|delete   press a key
 *   node scripts/android-emulator.mjs logs              app crashes and JavaScript console output
 *   node scripts/android-emulator.mjs stop              shut it down
 *
 * The emulator reaches the computer it runs on at 10.0.2.2, which is why the app's default Studio address works.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const NAME = "FinX_Pixel";
const PACKAGE = "pk.meezan.digital";
const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), "Library", "Android", "sdk"), join(homedir(), "Android", "Sdk")].filter(Boolean).find((d) => existsSync(d));
if (!sdk) die("The Android SDK was not found. Set ANDROID_HOME.");
const adb = join(sdk, "platform-tools", "adb");
const emulator = join(sdk, "emulator", "emulator");
const avdHome = process.env.ANDROID_AVD_HOME ?? join(homedir(), ".android", "avd");

function die(message) { console.error(`error: ${message}`); process.exit(1); }
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: "utf8", ...o });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [command, ...rest] = process.argv.slice(2);

/** The newest installed Google APIs image that matches this computer's CPU. */
function findImage() {
  const abi = platform() === "darwin" && process.arch === "arm64" ? "arm64-v8a" : "x86_64";
  const root = join(sdk, "system-images");
  if (!existsSync(root)) return null;
  const levels = readdirSync(root).filter((d) => /^android-\d+$/.test(d)).sort((a, b) => Number(b.slice(8)) - Number(a.slice(8)));
  for (const level of levels) for (const tag of ["google_apis", "google_apis_playstore", "default"]) {
    if (existsSync(join(root, level, tag, abi))) return { level, tag, abi, sysdir: `system-images/${level}/${tag}/${abi}/` };
  }
  return null;
}

const bootedSerial = () => sh(adb, ["devices"]).stdout.split("\n").map((l) => l.split("\t")).find((c) => /^emulator-\d+$/.test(c[0] ?? "") && c[1]?.trim() === "device")?.[0];

async function create() {
  const img = findImage();
  if (!img) die(`No system image for this computer was found in ${join(sdk, "system-images")}. Install one with the SDK Manager (a Google APIs image for ${process.arch}).`);
  const dir = join(avdHome, `${NAME}.avd`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(avdHome, `${NAME}.ini`), `avd.ini.encoding=UTF-8\npath=${dir}\npath.rel=avd/${NAME}.avd\ntarget=${img.level}\n`);
  writeFileSync(join(dir, "config.ini"), [
    `AvdId=${NAME}`, "PlayStore.enabled=false", `abi.type=${img.abi}`, "avd.ini.displayname=FinX Pixel", "avd.ini.encoding=UTF-8",
    "disk.dataPartition.size=3G", "fastboot.forceColdBoot=yes", "hw.accelerometer=yes", "hw.audioInput=no", "hw.audioOutput=no", "hw.battery=yes",
    "hw.camera.back=none", "hw.camera.front=none", `hw.cpu.arch=${img.abi === "arm64-v8a" ? "arm64" : "x86_64"}`, "hw.cpu.ncore=4",
    "hw.device.manufacturer=Google", "hw.device.name=pixel_7", "hw.gps=no", "hw.gpu.enabled=yes", "hw.gpu.mode=auto", "hw.initialOrientation=portrait",
    "hw.keyboard=yes", "hw.lcd.density=420", "hw.lcd.height=2400", "hw.lcd.width=1080", "hw.mainKeys=no", "hw.ramSize=3072", "hw.sdCard=no",
    `image.sysdir.1=${img.sysdir}`, "runtime.network.latency=none", "runtime.network.speed=full", "showDeviceFrame=no",
    `tag.display=${img.tag === "default" ? "Default Android System Image" : "Google APIs"}`, `tag.id=${img.tag}`, "vm.heapSize=256", "",
  ].join("\n"));
  console.log(`Created ${NAME} (${img.level}, ${img.tag}, ${img.abi}) in ${dir}`);
}

async function start() {
  if (bootedSerial()) { console.log(`Already running: ${bootedSerial()}`); return; }
  if (!existsSync(join(avdHome, `${NAME}.ini`))) await create();
  const windowed = rest.includes("--window");
  const logFile = join(avdHome, `${NAME}.log`);
  const fd = openSync(logFile, "w");
  const flags = ["-avd", NAME, "-no-audio", "-no-boot-anim", "-no-snapshot", "-netdelay", "none", "-netspeed", "full", ...(windowed ? ["-gpu", "host"] : ["-no-window", "-gpu", "swiftshader_indirect"])];
  const child = spawn(emulator, flags, { detached: true, stdio: ["ignore", fd, fd], env: { ...process.env, ANDROID_SDK_ROOT: sdk, ANDROID_HOME: sdk } });
  child.unref();
  console.log(`Booting ${NAME}${windowed ? " with a window" : " without a window"}… (log: ${logFile})`);
  sh(adb, ["start-server"]);
  const deadline = Date.now() + 6 * 60_000;
  while (Date.now() < deadline) {
    await sleep(3000);
    const serial = bootedSerial();
    if (serial && sh(adb, ["-s", serial, "shell", "getprop", "sys.boot_completed"]).stdout.trim() === "1") {
      sh(adb, ["-s", serial, "shell", "settings", "put", "global", "window_animation_scale", "0"]);
      sh(adb, ["-s", serial, "shell", "settings", "put", "global", "transition_animation_scale", "0"]);
      sh(adb, ["-s", serial, "shell", "settings", "put", "global", "animator_duration_scale", "0"]);
      // Show the on-screen keyboard even though the virtual phone has a hardware keyboard, as on a real phone
      sh(adb, ["-s", serial, "shell", "settings", "put", "secure", "show_ime_with_hard_keyboard", "1"]);
      console.log(`Ready: ${serial}`);
      return;
    }
  }
  die(`The emulator did not finish booting in 6 minutes. See ${logFile}`);
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#10;": "\n" };
const decode = (t) => t.replace(/&(amp|lt|gt|quot|apos|#10);/g, (m) => ENTITIES[m] ?? m);

/** What is on screen right now, from uiautomator: [{ text, desc, clickable, x, y, w, h }] */
function screenNodes(serial) {
  sh(adb, ["-s", serial, "shell", "uiautomator", "dump", "/sdcard/finx-ui.xml"]);
  const xml = sh(adb, ["-s", serial, "exec-out", "cat", "/sdcard/finx-ui.xml"], { maxBuffer: 16 * 1024 * 1024 }).stdout;
  const nodes = [];
  for (const m of xml.matchAll(/<node [^>]*>/g)) {
    const attr = (name) => new RegExp(`${name}="([^"]*)"`).exec(m[0])?.[1] ?? "";
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attr("bounds"));
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    nodes.push({ text: decode(attr("text")), desc: decode(attr("content-desc")), clickable: attr("clickable") === "true", x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2), w: x2 - x1, h: y2 - y1 });
  }
  return nodes;
}

/** The best element for a label: exact text or description, then a case-insensitive contains. */
function findNode(nodes, label) {
  const l = label.toLowerCase();
  const labelled = nodes.filter((n) => n.text || n.desc);
  return labelled.find((n) => n.text === label || n.desc === label)
    ?? labelled.find((n) => n.text.toLowerCase().includes(l) || n.desc.toLowerCase().includes(l));
}

function needDevice() { const s = bootedSerial(); if (!s) die("No emulator is running. Start one with: node scripts/android-emulator.mjs start"); return s; }

switch (command) {
  case "create": await create(); break;
  case "start": await start(); break;
  case "install": {
    const apk = rest[0]; if (!apk || !existsSync(apk)) die("Give the path of an APK: install <file.apk>");
    const r = sh(adb, ["-s", needDevice(), "install", "-r", apk]); process.stdout.write(r.stdout + r.stderr); process.exit(r.status ?? 1);
  }
  case "launch": {
    const serial = needDevice();
    sh(adb, ["-s", serial, "shell", "am", "force-stop", PACKAGE]);
    const r = sh(adb, ["-s", serial, "shell", "am", "start", "-W", "-n", `${PACKAGE}/.MainActivity`]);
    process.stdout.write(r.stdout + r.stderr);
    process.exit(r.status === 0 && /Status: ok/i.test(r.stdout) ? 0 : 1);
  }
  case "shot": {
    const out = rest[0]; if (!out) die("Give a file name: shot <file.png>");
    const r = spawnSync(adb, ["-s", needDevice(), "exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) die("Could not take a screenshot");
    writeFileSync(out, r.stdout); console.log(`Saved ${out}`); break;
  }
  case "ui": {
    for (const n of screenNodes(needDevice())) if (n.text || n.desc) console.log(`${n.clickable ? "[tap] " : "      "}${(n.text || n.desc).replaceAll("\n", " ")}${n.text && n.desc && n.text !== n.desc ? `  (${n.desc})` : ""}  @${n.x},${n.y}`);
    break;
  }
  case "wait": {
    const label = rest[0]; const seconds = Number(rest[1] ?? 30);
    if (!label || !Number.isFinite(seconds)) die('Give a label and optionally seconds: wait "Log in" 30');
    const serial = needDevice(); const deadline = Date.now() + seconds * 1000;
    let node;
    for (;;) { node = findNode(screenNodes(serial), label); if (node || Date.now() > deadline) break; await sleep(1500); }
    if (!node) die(`"${label}" did not appear within ${seconds} seconds. On screen: ${screenNodes(serial).filter((n) => n.text || n.desc).map((n) => n.text || n.desc).slice(0, 12).join(" | ") || "(nothing readable)"}`);
    console.log(`Found "${node.text || node.desc}"`); break;
  }
  case "tapxy": {
    const [x, y] = rest.map(Number); if (!Number.isFinite(x) || !Number.isFinite(y)) die("Give two numbers: tapxy 540 1200");
    sh(adb, ["-s", needDevice(), "shell", "input", "tap", String(x), String(y)]); console.log(`Tapped ${x},${y}`); break;
  }
  case "swipe": {
    const n = rest.map(Number); if (n.length < 4 || n.some((v) => !Number.isFinite(v))) die("Give x1 y1 x2 y2 and optionally milliseconds: swipe 540 1800 540 600");
    sh(adb, ["-s", needDevice(), "shell", "input", "swipe", ...n.slice(0, 4).map(String), String(n[4] ?? 300)]); console.log("Swiped"); break;
  }
  case "logs": {
    const serial = needDevice();
    const crash = sh(adb, ["-s", serial, "logcat", "-d", "-b", "crash", "-v", "time"], { maxBuffer: 16 * 1024 * 1024 }).stdout.trim();
    const main = sh(adb, ["-s", serial, "logcat", "-d", "-v", "time"], { maxBuffer: 64 * 1024 * 1024 }).stdout.split("\n")
      .filter((l) => /ReactNativeJS|E\/AndroidRuntime|FATAL EXCEPTION|ANR in|pk\.meezan\.digital.*(died|crash)|cleartext/i.test(l)).slice(-60);
    console.log(crash ? `--- crash buffer\n${crash}` : "--- crash buffer: empty");
    console.log(main.length ? `--- app log (last ${main.length} relevant lines)\n${main.join("\n")}` : "--- app log: nothing relevant");
    break;
  }
  case "tap": {
    const label = rest.join(" "); if (!label) die('Give a label: tap "Log in"');
    const serial = needDevice(); const node = findNode(screenNodes(serial), label);
    if (!node) die(`Nothing on screen is labelled "${label}". Run: ui`);
    sh(adb, ["-s", serial, "shell", "input", "tap", String(node.x), String(node.y)]); console.log(`Tapped "${node.text || node.desc}" at ${node.x},${node.y}`); break;
  }
  case "type": {
    const text = rest.join(" "); if (!text) die('Give some text: type "hello"');
    // adb's input command treats spaces as %s and needs shell-safe text
    const r = sh(adb, ["-s", needDevice(), "shell", "input", "text", text.replace(/ /g, "%s").replace(/(["'\\&|;<>()$`!*?\[\]{}~#])/g, "\\$1")]); process.stdout.write(r.stderr); break;
  }
  case "key": {
    const keys = { back: "KEYCODE_BACK", home: "KEYCODE_HOME", enter: "KEYCODE_ENTER", delete: "KEYCODE_DEL", tab: "KEYCODE_TAB" };
    const code = keys[rest[0] ?? ""]; if (!code) die(`Use one of: ${Object.keys(keys).join(", ")}`);
    sh(adb, ["-s", needDevice(), "shell", "input", "keyevent", code]); console.log(`Pressed ${rest[0]}`); break;
  }
  case "stop": { const s = bootedSerial(); if (s) sh(adb, ["-s", s, "emu", "kill"]); console.log(s ? `Stopped ${s}` : "Nothing was running"); break; }
  default: console.log("Usage: android-emulator.mjs create | start [--window] | install <apk> | launch | shot <file.png> | ui | wait <label> [s] | tap <label> | tapxy <x> <y> | swipe <x1> <y1> <x2> <y2> | type <text> | key <name> | logs | stop");
}
