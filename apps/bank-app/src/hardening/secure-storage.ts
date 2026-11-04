import { Platform } from "react-native";

/**
 * Where anything secret goes (a session token, a device binding): the iOS Keychain or Android Keystore through expo-secure-store.
 * Never AsyncStorage, which is plain text on the device. Where secure storage is missing (the web, or a binary without the module) the
 * value is kept in memory only, so it is lost on restart but never written somewhere readable.
 */
const memory = new Map<string, string>();
type Store = typeof import("expo-secure-store");
const store = (): Store | null => {
  if (Platform.OS === "web") return null;
  try { return require("expo-secure-store") as Store; } catch { return null; }
};
const ok = (k: string) => /^[A-Za-z0-9._-]{1,100}$/.test(k); // SecureStore keys allow only these characters

export async function setSecret(key: string, value: string): Promise<void> {
  if (!ok(key)) throw new Error("A secret's name may only use letters, digits, '.', '-' and '_'");
  const s = store();
  if (!s) { memory.set(key, value); return; }
  await s.setItemAsync(key, value, { keychainAccessible: s.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function getSecret(key: string): Promise<string | null> {
  if (!ok(key)) return null;
  const s = store();
  return s ? s.getItemAsync(key) : memory.get(key) ?? null;
}
export async function deleteSecret(key: string): Promise<void> {
  memory.delete(key);
  const s = store();
  if (s && ok(key)) await s.deleteItemAsync(key);
}
