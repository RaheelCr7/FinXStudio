import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * The environment-dependent parts of the app configuration. app.json holds the static parts.
 *
 *   FINX_ENV                    "uat" (default) or "production". Production never lets the person change the server.
 *   FINX_ANDROID_CLEARTEXT=1    allow plain http, so a UAT build can reach a Studio on a laptop. Ignored for production.
 *   FINX_ANDROID_VERSION_CODE   whole number that must go up with every build uploaded to a store (default 1)
 *   FINX_ANDROID_ABIS           comma separated CPU types (default arm64-v8a: phones and Apple Silicon emulators)
 *   FINX_IOS_ALLOW_HTTP=1       iOS: allow plain http, so a UAT build can reach a Studio on a laptop. Ignored for production.
 *   FINX_IOS_BUILD_NUMBER       iOS build number (CFBundleVersion); must go up with every build uploaded to the App Store (default 1)
 */
const BRAND = "#0F6E56";
const BRAND_DARK = "#0A0D12";

export default ({ config }: ConfigContext): ExpoConfig => {
  const production = process.env.FINX_ENV === "production";
  const cleartext = !production && process.env.FINX_ANDROID_CLEARTEXT === "1";
  const abis = (process.env.FINX_ANDROID_ABIS ?? "arm64-v8a").split(",").map((s: string) => s.trim()).filter(Boolean);
  const versionCode = Number.parseInt(process.env.FINX_ANDROID_VERSION_CODE ?? "1", 10);
  if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error("FINX_ANDROID_VERSION_CODE must be a whole number of 1 or more");
  const buildNumber = process.env.FINX_IOS_BUILD_NUMBER ?? "1";
  if (!/^[1-9][0-9]*$/.test(buildNumber)) throw new Error("FINX_IOS_BUILD_NUMBER must be a whole number of 1 or more");

  // App Transport Security, written in full every time because prebuild merges Info.plist and never removes keys.
  // Production: https only. UAT: plain http too, to reach a Studio on a laptop (never add NSAllowsLocalNetworking
  // here: iOS then ignores NSAllowsArbitraryLoads). Neither (a development build): Expo's default, local network only.
  const ats = production ? { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: false }
    : process.env.FINX_IOS_ALLOW_HTTP === "1" ? { NSAllowsArbitraryLoads: true }
    : { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true };
  // A phone asks before the app may reach a Studio on the Wi-Fi. Production talks only to an https server.
  const localNetwork = production ? {} : { NSLocalNetworkUsageDescription: "Connects to FinX Studio on your Wi-Fi to load banking journeys." };

  return {
    ...config,
    name: config.name ?? "Meezan Digital",
    slug: config.slug ?? "meezan-digital",
    android: { ...config.android, versionCode },
    ios: { ...config.ios, buildNumber, infoPlist: { ...config.ios?.infoPlist, NSAppTransportSecurity: ats, ...localNetwork } },
    plugins: [
      ["expo-build-properties", { android: { usesCleartextTraffic: cleartext, buildArchs: abis } }],
      ["expo-splash-screen", {
        image: "./assets/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: BRAND,
        dark: { image: "./assets/splash-icon.png", backgroundColor: BRAND_DARK },
      }],
    ],
  };
};
