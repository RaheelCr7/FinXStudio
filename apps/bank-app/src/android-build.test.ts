import { describe, expect, it } from "vitest";
import { artifactName, formatDuration, hintFor, isDebugSigner, parseBadging, parseSigner, readyDevices } from "../scripts/lib/android-build.mjs";

describe("build-android helpers", () => {
  it("explains the common Gradle failures", () => {
    expect(hintFor("java.io.IOException: No space left on device")).toContain("disk is full");
    expect(hintFor("Failed to install the following Android SDK packages as some licences have not been accepted.")).toContain("sdkmanager --licenses");
    expect(hintFor("SDK location not found. Define a valid SDK location")).toContain("ANDROID_HOME");
    expect(hintFor("Unsupported class file major version 65")).toContain("JDK 17");
    expect(hintFor("Could not resolve com.facebook.react:react-android:0.88.1")).toContain("network");
    expect(hintFor("java.lang.OutOfMemoryError: Java heap space")).toContain("out of memory");
    expect(hintFor("something unexpected")).toContain("build-android.log");
  });

  it("reads package, version, launcher, SDK levels and CPU types from aapt2 badging output", () => {
    const badging = [
      "package: name='pk.meezan.digital' versionCode='7' versionName='0.1.0' platformBuildVersionName='16' compileSdkVersion='36'",
      "sdkVersion:'24'", "targetSdkVersion:'36'", "application-label:'Meezan Digital'",
      "launchable-activity: name='pk.meezan.digital.MainActivity'  label='' icon=''", "native-code: 'arm64-v8a'",
    ].join("\n");
    expect(parseBadging(badging)).toEqual({
      package: "pk.meezan.digital", versionName: "0.1.0", versionCode: "7", launchable: "pk.meezan.digital.MainActivity",
      label: "Meezan Digital", minSdk: "24", targetSdk: "36", nativeCode: "arm64-v8a", permissions: [],
    });
    expect(parseBadging("").package).toBe("");
    // aapt2 from build-tools 37 says minSdkVersion, and lists permissions
    const newer = [
      "package: name='pk.meezan.digital' versionCode='1' versionName='0.1.0' compileSdkVersion='37'", "minSdkVersion:'24'", "targetSdkVersion:'36'",
      "uses-permission: name='android.permission.INTERNET'", "uses-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32'",
    ].join("\n");
    expect(parseBadging(newer).minSdk).toBe("24");
    expect(parseBadging(newer).targetSdk).toBe("36");
    expect(parseBadging(newer).permissions).toEqual(["android.permission.INTERNET", "android.permission.READ_EXTERNAL_STORAGE"]);
  });

  it("names the artifact from app, version, build and CPU types", () => {
    expect(artifactName({ slug: "meezan-digital", version: "0.1.0", versionCode: "1", env: "uat", abis: "arm64-v8a" })).toBe("meezan-digital-0.1.0-1-uat-arm64");
    expect(artifactName({ slug: "meezan-digital", version: "1.2.0", versionCode: "12", env: "production", abis: "arm64-v8a, x86_64" })).toBe("meezan-digital-1.2.0-12-production-arm64+x86_64");
  });

  it("reads the signer from apksigner output in either style and spots the debug key", () => {
    const sha = "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c";
    const newer = `V2 Signer: certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US\nV2 Signer: certificate SHA-256 digest: ${sha}\n`;
    const older = `Signer #1 certificate DN: CN=Bank Upload Key, O=Example Bank\nSigner #1 certificate SHA-256 digest: ${sha}\n`;
    expect(parseSigner(newer)).toEqual({ dn: "CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US", sha256: sha });
    expect(parseSigner(older)).toEqual({ dn: "CN=Bank Upload Key, O=Example Bank", sha256: sha });
    expect(parseSigner("")).toEqual({ dn: "", sha256: "" });
    expect(isDebugSigner(parseSigner(newer).dn)).toBe(true);
    expect(isDebugSigner(parseSigner(older).dn)).toBe(false);
    expect(isDebugSigner("")).toBe(false);
  });

  it("writes durations people can read", () => {
    expect(formatDuration(887_000)).toBe("14 min 47 s");
    expect(formatDuration(42_400)).toBe("42 s");
    expect(formatDuration(60_000)).toBe("1 min 0 s");
    expect(formatDuration(-5)).toBe("0 s");
  });

  it("lists only devices that are ready", () => {
    const out = "List of devices attached\nemulator-5554\tdevice\nR58M123\toffline\nABC123\tunauthorized\nXYZ789\tdevice\n\n";
    expect(readyDevices(out)).toEqual(["emulator-5554", "XYZ789"]);
    expect(readyDevices("List of devices attached\n\n")).toEqual([]);
  });
});
