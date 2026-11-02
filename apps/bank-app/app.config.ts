import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * The environment-dependent parts of the app configuration. app.json holds the static parts.
 *
 *   FINX_ENV                    "uat" (default) or "production". Production never lets the person change the server.
 *   FINX_ANDROID_CLEARTEXT=1    allow plain http, so a UAT build can reach a Studio on a laptop. Ignored for production.
 *   FINX_ANDROID_VERSION_CODE   whole number that must go up with every build uploaded to a store (default 1)
 *   FINX_ANDROID_ABIS           comma separated CPU types (default arm64-v8a: phones and Apple Silicon emulators)
 */
const BRAND = "#0F6E56";
const BRAND_DARK = "#0A0D12";

export default ({ config }: ConfigContext): ExpoConfig => {
  const production = process.env.FINX_ENV === "production";
  const cleartext = !production && process.env.FINX_ANDROID_CLEARTEXT === "1";
  const abis = (process.env.FINX_ANDROID_ABIS ?? "arm64-v8a").split(",").map((s: string) => s.trim()).filter(Boolean);
  const versionCode = Number.parseInt(process.env.FINX_ANDROID_VERSION_CODE ?? "1", 10);
  if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error("FINX_ANDROID_VERSION_CODE must be a whole number of 1 or more");

  return {
    ...config,
    name: config.name ?? "Meezan Digital",
    slug: config.slug ?? "meezan-digital",
    android: { ...config.android, versionCode },
    plugins: [
      ["expo-build-properties", { android: { usesCleartextTraffic: cleartext, buildArchs: abis } }],
      ["expo-splash-screen", {
        image: "./assets/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: BRAND,
        dark: { image: "./assets/splash-icon.png", backgroundColor: BRAND_DARK },
      }],
    ],
  };
};
