import { Platform } from "react-native";
import type { Integrity } from "./policy";

/**
 * The parts that need native modules. They are loaded with require inside functions, and only when the production profile asks, so a
 * demo build (or a binary built before these modules were added) never touches them. Every function fails safe: if a module is not there,
 * the result is "unknown" or false, and the caller decides what that means.
 */

/** Android root and iOS jailbreak signals from expo-device. Not available on the web. It is a hint, not proof: a determined attacker can hide a root. */
export async function checkIntegrity(): Promise<Integrity> {
  if (Platform.OS === "web") return "unknown";
  try {
    const Device = require("expo-device") as typeof import("expo-device");
    return (await Device.isRootedExperimentalAsync()) ? "compromised" : "ok";
  } catch { return "unknown"; }
}

/**
 * Android: sets FLAG_SECURE (no screenshots, no recording, blank thumbnail in the app switcher). iOS: hides the app while the screen is
 * recorded or mirrored; iOS does not let an app block the screenshot button. Returns whether protection is on.
 */
export async function protectScreen(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const Capture = require("expo-screen-capture") as typeof import("expo-screen-capture");
    await Capture.preventScreenCaptureAsync("finx");
    return true;
  } catch { return false; }
}
