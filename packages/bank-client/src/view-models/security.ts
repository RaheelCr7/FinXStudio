import type { Call } from "./screens";

/**
 * Settings > Security as plain data (docs: Signing in and security, "Settings > Security"): the password row, the sign-in methods, the trusted
 * devices and the login history. Web and phone draw the same thing. Nothing here holds a secret: the bank answers with none.
 */
export type SecurityVm = {
  password: string;
  quickPin: { set: boolean; label: "Set" | "Not set"; action: "Set up" | "Change" };
  defaultSignIn: { mode: "password" | "pin" | "biometric"; label: string };
  devices: { count: number; max: number; text: string };
  /** The device in hand can do fingerprint or face sign-in (a flag the bank holds for the device; the browser cannot, the phone can). */
  biometrics: { available: boolean; on: boolean; helper?: string };
  device: { id: string; name: string };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");
/** "12 Nov 2026" in UTC (the bank's time zone). */
export const dayText = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
/** "12 Nov 2026 09:14 UTC". */
export const whenText = (iso: string) => { const d = new Date(iso); return `${dayText(iso)} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`; };

export const NO_BIOMETRICS = "This device doesn’t have fingerprint or face sign-in set up. Turn it on in your device settings, then come back.";
const DEFAULTS = { password: "Username & password", pin: "PIN", biometric: "Biometric" } as const;

export async function loadSecurity(call: Call): Promise<SecurityVm> {
  const [opt, list] = await Promise.all([call("bank.device.options"), call("bank.devices.list")]);
  const mode: SecurityVm["defaultSignIn"]["mode"] = opt.default === "pin" || opt.default === "biometric" ? opt.default : "password";
  const available = !!opt.biometricAvailable;
  return {
    password: opt.passwordChangedAt ? `Last changed ${dayText(opt.passwordChangedAt)}` : "Never changed",
    quickPin: { set: !!opt.pinSet, label: opt.pinSet ? "Set" : "Not set", action: opt.pinSet ? "Change" : "Set up" },
    defaultSignIn: { mode, label: DEFAULTS[mode] },
    devices: { count: list.count, max: list.max, text: `${list.count} of ${list.max}` },
    biometrics: { available, on: opt.quick === "biometric" && mode === "biometric", ...(available ? {} : { helper: NO_BIOMETRICS }) },
    device: { id: opt.device?.id ?? "", name: opt.device?.name ?? "" },
  };
}

export type HistoryQuery = { result: "all" | "ok" | "failed"; days: 7 | 30 | 90; deviceId: string; order: "newest" | "oldest"; page: number };
export const HISTORY_PAGE = 20;
export const NO_FILTERS: HistoryQuery = { result: "all", days: 90, deviceId: "", order: "newest", page: 1 };
/** A "Clear filters" link shows when any filter is on (the sort and the page are not filters). */
export const filtersOn = (q: HistoryQuery) => q.result !== "all" || q.days !== 90 || q.deviceId !== "";

export type HistoryRow = { id: string; when: string; result: { label: string; tone: "positive" | "warning" | "negative" | "info" | "neutral" }; method: string; device: string; thisDevice: boolean; place: string; ip: string; how: string };
export type History = { rows: HistoryRow[]; total: number; page: number; pages: number; /** Nothing at all (with no filter on) rather than nothing for these filters. */ none: boolean };

const RESULT: Record<string, HistoryRow["result"]> = {
  ok: { label: "Signed in", tone: "positive" }, "wrong-password": { label: "Wrong password", tone: "warning" }, locked: { label: "Locked", tone: "negative" },
  "new-device-code": { label: "New device code", tone: "info" }, inactivity: { label: "Signed out for inactivity", tone: "neutral" },
};
const METHOD: Record<string, string> = { password: "Password", pin: "Quick PIN", biometric: "Biometrics" };
const HOW: Record<string, string> = { password: "Username and password", pin: "Quick PIN on this device", biometric: "Fingerprint or face on this device" };

export async function loadHistory(call: Call, q: HistoryQuery, currentDeviceId: string, nowMs: number): Promise<History> {
  const from = new Date(nowMs - q.days * 86_400_000).toISOString();
  const a = await call("bank.loginHistory.list", { ...(q.result === "all" ? {} : { result: q.result }), from, ...(q.deviceId ? { deviceId: q.deviceId } : {}), order: q.order, page: q.page, pageSize: HISTORY_PAGE });
  const rows: HistoryRow[] = (a.items ?? []).map((h: any, i: number) => ({
    id: `${h.at}-${i}`, when: whenText(h.at), result: RESULT[h.result] ?? { label: String(h.result), tone: "neutral" }, method: METHOD[h.method] ?? h.method, device: h.deviceName,
    thisDevice: h.deviceId === currentDeviceId, place: h.place, ip: h.ipMasked, how: HOW[h.method] ?? h.method,
  }));
  return { rows, total: a.total, page: q.page, pages: Math.max(1, Math.ceil(a.total / HISTORY_PAGE)), none: a.total === 0 && !filtersOn(q) };
}

/** The devices to choose in the Device filter: the trusted ones and any the history mentions. */
export async function loadHistoryDevices(call: Call): Promise<{ id: string; name: string }[]> {
  const list = await call("bank.devices.list");
  return (list.items ?? []).map((d: any) => ({ id: d.id, name: d.name }));
}
