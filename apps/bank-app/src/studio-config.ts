import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeStudioUrl } from "./studio-url";

const KEY = "finx.studioUrl";

/** UAT and preview builds may point at another Studio. A production build always uses its built-in address. */
export const SERVER_CHANGE_ALLOWED = process.env.EXPO_PUBLIC_FINX_ENV !== "production";

/**
 * The Android emulator reaches the computer it runs on at 10.0.2.2; the iOS Simulator and the web use localhost.
 * A real phone needs the computer's network address (build with --studio-url, or change it in the app).
 */
export const DEFAULT_STUDIO_URL: string = process.env.EXPO_PUBLIC_STUDIO_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:3100" : "http://localhost:3100");

export async function loadStudioUrl(): Promise<string> {
  if (!SERVER_CHANGE_ALLOWED) return DEFAULT_STUDIO_URL;
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) { const n = normalizeStudioUrl(saved); if (n.ok) return n.url; }
  } catch { /* storage unavailable: use the default */ }
  return DEFAULT_STUDIO_URL;
}

export async function saveStudioUrl(url: string): Promise<void> {
  if (!SERVER_CHANGE_ALLOWED) return;
  try { await AsyncStorage.setItem(KEY, url); } catch { /* the address still applies for this session */ }
}

export async function resetStudioUrl(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* nothing to reset */ }
}
