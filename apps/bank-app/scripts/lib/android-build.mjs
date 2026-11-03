/** Pure helpers for scripts/build-android.mjs, kept separate so they can be tested. */

/** A short, actionable explanation for the most common Gradle failures, from the end of its output. */
export function hintFor(tail) {
  const t = String(tail).toLowerCase();
  if (t.includes("no space left on device")) return "The disk is full. Free some space (Gradle caches live in ~/.gradle) and run again.";
  if (t.includes("licences have not been accepted") || t.includes("licenses have not been accepted")) return "Some Android SDK licences are not accepted. Accept them with sdkmanager --licenses, then run again.";
  if (t.includes("sdk location not found")) return "Gradle cannot find the Android SDK. Set ANDROID_HOME.";
  if (t.includes("unsupported class file major version") || t.includes("requires java") || t.includes("incompatible with java")) return "Gradle and the JDK do not match. Use JDK 17.";
  if (t.includes("could not resolve") || t.includes("unknownhost") || t.includes("connect timed out") || t.includes("could not get resource")) return "A download failed. Check the network and run again; finished downloads are kept.";
  if (t.includes("ndk") && (t.includes("not found") || t.includes("did not have a source.properties"))) return "The Android NDK is missing or damaged. Check the network, delete the broken folder under the SDK's ndk directory, then run again.";
  if (t.includes("java.lang.outofmemoryerror") || t.includes("gc overhead limit")) return "Gradle ran out of memory. Close other programs and run again.";
  return "See dist/build-android.log for the full output.";
}

/** Reads the useful fields from the text of `aapt2 dump badging`. */
export function parseBadging(text) {
  const g = (re) => re.exec(text)?.[1] ?? "";
  return {
    package: g(/package: name='([^']+)'/),
    versionName: g(/versionName='([^']+)'/),
    versionCode: g(/versionCode='([^']+)'/),
    launchable: g(/launchable-activity: name='([^']+)'/),
    label: g(/application-label:'([^']*)'/),
    minSdk: g(/^(?:minSdkVersion|sdkVersion):'(\d+)'/m),
    targetSdk: g(/targetSdkVersion:'(\d+)'/),
    nativeCode: g(/native-code: ([^\n]+)/).replaceAll("'", "").trim(),
    permissions: [...String(text).matchAll(/^uses-permission: name='([^']+)'/gm)].map((m) => m[1]),
  };
}

const ABI_SHORT = { "arm64-v8a": "arm64", "armeabi-v7a": "arm32", x86_64: "x86_64", x86: "x86" };

/** meezan-digital-0.1.0-1-uat-arm64 */
export function artifactName({ slug, version, versionCode, env, abis }) {
  const tag = String(abis).split(",").map((s) => s.trim()).filter(Boolean).map((a) => ABI_SHORT[a] ?? a).join("+");
  return `${slug}-${version}-${versionCode}-${env}-${tag}`;
}

/** Lines of `adb devices` output that are ready devices: ["emulator-5554", ...] */
export function readyDevices(adbDevicesOutput) {
  return String(adbDevicesOutput).split("\n").slice(1).map((l) => l.split("\t")).filter((c) => c[1]?.trim() === "device").map((c) => c[0]);
}

/** The signer's name and certificate fingerprint from `apksigner verify --print-certs` (both output styles). */
export function parseSigner(text) {
  const t = String(text);
  return {
    dn: /certificate DN: (.+)/.exec(t)?.[1]?.trim() ?? "",
    sha256: /certificate SHA-256 digest: ([0-9a-f]+)/i.exec(t)?.[1] ?? "",
  };
}

/** True for the public key every Android SDK creates for debug builds. Anyone can sign with it. */
export const isDebugSigner = (dn) => /CN=Android Debug\b/.test(String(dn));

export { formatDuration } from "./common.mjs";
