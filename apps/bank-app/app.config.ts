import type { ConfigContext, ExpoConfig } from "expo/config";
import brands from "../../packages/ui-kit/src/brands.json";

/**
 * The environment-dependent parts of the app configuration. app.json holds the static parts.
 *
 *   FINX_BRAND                  "meezan" (default) or "bankworkx": which bank this build is (name, ids, icons, colours: see brands.json)
 *   FINX_ENV                    "uat" (default) or "production". Production never lets the person change the server.
 *   FINX_ANDROID_CLEARTEXT=1    allow plain http, so a UAT build can reach a Studio on a laptop. Ignored for production.
 *   FINX_ANDROID_VERSION_CODE   whole number that must go up with every build uploaded to a store (default 1)
 *   FINX_ANDROID_ABIS           comma separated CPU types (default arm64-v8a: phones and Apple Silicon emulators)
 *   FINX_IOS_ALLOW_HTTP=1       iOS: allow plain http, so a UAT build can reach a Studio on a laptop. Ignored for production.
 *   FINX_IOS_BUILD_NUMBER       iOS build number (CFBundleVersion); must go up with every build uploaded to the App Store (default 1)
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const brandId = (process.env.FINX_BRAND ?? "meezan") as keyof typeof brands;
  const brand = brands[brandId];
  if (!brand) throw new Error(`FINX_BRAND must be one of: ${Object.keys(brands).join(", ")}`);
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

  const a = brand.assets;
  return {
    ...config,
    name: brand.name,
    slug: brand.slug,
    scheme: brand.scheme,
    icon: `${a}/icon.png`,
    android: {
      ...config.android, package: brand.bundleId, versionCode,
      adaptiveIcon: { backgroundColor: brand.accent, foregroundImage: `${a}/android-icon-foreground.png`, backgroundImage: `${a}/android-icon-background.png`, monochromeImage: `${a}/android-icon-monochrome.png` },
    },
    ios: { ...config.ios, bundleIdentifier: brand.bundleId, buildNumber, infoPlist: { ...config.ios?.infoPlist, NSAppTransportSecurity: ats, ...localNetwork } },
    web: { ...config.web, favicon: `${a}/favicon.png`, name: brand.name, shortName: brand.shortName, themeColor: brand.accent, backgroundColor: brand.background },
    plugins: [
      ["expo-build-properties", { android: { usesCleartextTraffic: cleartext, buildArchs: abis } }],
      ["expo-splash-screen", {
        image: `${a}/splash-icon.png`, imageWidth: 200, resizeMode: "contain", backgroundColor: brand.accent,
        dark: { image: `${a}/splash-icon.png`, backgroundColor: brand.splashDark },
      }],
    ],
  };
};
