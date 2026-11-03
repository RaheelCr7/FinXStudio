import type { Block, Journey, Screen } from "@finx/journey-schema";

export const BLOCK_LABELS: Record<string, string> = {
  text: "Text", alert: "Alert", button: "Button", result: "Result", reviewSummary: "Review summary", consent: "Consent",
  otp: "OTP", stepper: "Progress steps", amountInput: "Amount", select: "Select", textInput: "Text input", accountPicker: "Account picker", beneficiaryPicker: "Beneficiary picker",
  toggle: "Switch", cardForm: "Card form",
  hero: "Bank banner", sectionHeader: "Section heading", shortcuts: "Shortcuts", menu: "Menu", divider: "Divider", accordion: "Accordion", balanceList: "Balance list",
};
export const BLOCK_GROUPS: Array<{ name: string; types: string[] }> = [
  { name: "Content", types: ["text", "alert", "result", "hero", "sectionHeader", "divider", "accordion"] },
  { name: "Inputs", types: ["textInput", "amountInput", "select", "toggle", "consent"] },
  { name: "Banking", types: ["accountPicker", "beneficiaryPicker", "cardForm", "reviewSummary", "balanceList"] },
  { name: "Verification", types: ["otp"] },
  { name: "Actions", types: ["button", "shortcuts", "menu"] },
];

export function newBlock(type: string, j: Journey): Block {
  switch (type) {
    case "text": return { type: "text", text: "New text" };
    case "alert": return { type: "alert", tone: "info", text: "Important information" };
    case "result": return { type: "result", tone: "success", title: "Done" };
    case "amountInput": return { type: "amountInput", bind: "amount", currency: j.apps?.includes("bankworkx") ? "USD" : "PKR", label: "Amount", validation: { min: 1 } };
    case "select": return { type: "select", bind: "choice", label: "Choose one", options: ["Option 1", "Option 2"] };
    case "textInput": return { type: "textInput", bind: "reference", label: "Reference number", placeholder: "Enter a value", keyboard: "default" };
    case "hero": return { type: "hero" };
    case "sectionHeader": return { type: "sectionHeader", title: "Heading" };
    case "balanceList": return { type: "balanceList", source: "ctx.accounts" };
    case "divider": return { type: "divider", label: "OR" };
    case "accordion": return { type: "accordion", items: [{ id: "one", title: "A question", text: "Its answer" }] };
    case "shortcuts": return { type: "shortcuts", items: [{ id: "one", label: "Shortcut", icon: "help", actions: [{ type: "navigate", to: firstTerminal(j) ?? j.entryScreen }] }] };
    case "menu": return { type: "menu", items: [{ id: "one", label: "Menu item", actions: [{ type: "navigate", to: firstTerminal(j) ?? j.entryScreen }] }] };
    case "toggle": return { type: "toggle", bind: "option", label: "Turn this on" };
    case "cardForm": return { type: "cardForm", bind: "card" };
    case "consent": return { type: "consent", bind: "consent", termsVersion: "v1", text: "I agree to the terms", validation: { mustBeTrue: true } };
    case "accountPicker": return { type: "accountPicker", bind: "accountId", source: "ctx.accounts", showBalance: true };
    case "beneficiaryPicker": return { type: "beneficiaryPicker", bind: "beneficiaryId", source: "ctx.beneficiaries", allowAddNew: true };
    case "reviewSummary": return { type: "reviewSummary", rows: [{ label: "Item", value: "Value" }] };
    case "otp": return { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 60, hint: "Enter the code we sent you" };
    case "button": return { type: "button", label: "Continue", variant: "primary", actions: [{ type: "navigate", to: firstTerminal(j) ?? j.entryScreen }] };
    default: throw new Error(`Unknown block type ${type}`);
  }
}

export const firstTerminal = (j: Journey) => j.screens.find((s) => s.kind === "terminal")?.id;
const clone = <T,>(x: T): T => structuredClone(x);

/** Make sure every bound input exists in the data model (lint requires it). */
export function ensureDataModel(j: Journey): Journey {
  const out = clone(j);
  out.dataModel ??= {};
  for (const s of out.screens) for (const b of s.blocks as any[]) {
    if (b.type === "cardForm") for (const k of ["number", "holder", "expiry", "cvv"]) if (!(`${b.bind}.${k}` in out.dataModel)) out.dataModel[`${b.bind}.${k}`] = { type: "string" };
    if (b.bind && !(b.bind in out.dataModel)) {
      out.dataModel[b.bind] = b.type === "amountInput" ? { type: "money", currency: b.currency, required: true } : b.type === "consent" ? { type: "boolean", required: true } : b.type === "toggle" ? { type: "boolean" } : b.type === "cardForm" ? { type: "object", required: true } : { type: "string", required: b.type !== "otp" };
    }
  }
  return out;
}

export function updateScreen(j: Journey, id: string, fn: (s: Screen) => void): Journey {
  const out = clone(j);
  const s = out.screens.find((x) => x.id === id);
  if (s) fn(s);
  return ensureDataModel(out);
}

export function addBlock(j: Journey, screenId: string, type: string): { journey: Journey; index: number } {
  let index = 0;
  const journey = updateScreen(j, screenId, (s) => {
    // keep buttons last: insert before the first button, else append
    const firstBtn = s.blocks.findIndex((b) => b.type === "button");
    index = type === "button" || firstBtn < 0 ? s.blocks.length : firstBtn;
    s.blocks.splice(index, 0, newBlock(type, j));
  });
  return { journey, index };
}
export const removeBlock = (j: Journey, screenId: string, index: number) => updateScreen(j, screenId, (s) => { s.blocks.splice(index, 1); });
export const moveBlock = (j: Journey, screenId: string, index: number, dir: -1 | 1) =>
  updateScreen(j, screenId, (s) => { const t = index + dir; if (t < 0 || t >= s.blocks.length) return; const [b] = s.blocks.splice(index, 1); s.blocks.splice(t, 0, b!); });

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "screen";
export function uniqueScreenId(j: Journey, name: string) {
  const base = slug(name); let id = base; let n = 2;
  while (j.screens.some((s) => s.id === id)) id = `${base}_${n++}`;
  return id;
}

/** Find the first `navigate` action (with a target) on a screen, to splice a new step after it. */
function firstNav(s: Screen): any | undefined {
  for (const b of s.blocks as any[]) if (b.type === "button") for (const a of b.actions) if (a.type === "navigate" && a.to) return a;
  return undefined;
}

/** Add a screen; with `afterId`, rewire so it sits between that screen and its current next screen. */
export function addScreen(j: Journey, name: string, afterId?: string): { journey: Journey; id: string } {
  const out = clone(j);
  const id = uniqueScreenId(out, name);
  let next: string | undefined = firstTerminal(out);
  const after = afterId ? out.screens.find((s) => s.id === afterId) : undefined;
  const nav = after ? firstNav(after) : undefined;
  if (nav) { next = nav.to; nav.to = id; }
  const screen: Screen = { id, title: name, blocks: [{ type: "text", variant: "title", text: name }, newBlock("button", out)] };
  (screen.blocks[1] as any).actions = next ? [{ type: "navigate", to: next }] : [];
  const insertAt = after ? out.screens.indexOf(after) + 1 : Math.max(0, out.screens.findIndex((s) => s.kind === "terminal"));
  out.screens.splice(insertAt < 0 ? out.screens.length : insertAt, 0, screen);
  return { journey: ensureDataModel(out), id };
}

/** Delete a screen and bypass it: references move to the first place the deleted screen navigated to. */
export function deleteScreen(j: Journey, id: string): Journey | null {
  if (j.screens.length <= 1) return null;
  const target = j.screens.find((s) => s.id === id);
  if (!target) return j;
  const bypass = firstNav(target)?.to ?? target.navigation?.default ?? (id === j.entryScreen ? j.screens.find((s) => s.id !== id)!.id : undefined);
  const out = clone(j);
  out.screens = out.screens.filter((s) => s.id !== id);
  if (out.entryScreen === id) out.entryScreen = bypass ?? out.screens[0]!.id;
  const fix = (a: any) => {
    if (a?.type === "navigate" && a.to === id) a.to = bypass ?? out.entryScreen;
    if (a?.type === "callApi" && a.onError) { if (a.onError.navigate === id) a.onError.navigate = bypass ?? out.entryScreen; if (a.onError.lockTo === id) a.onError.lockTo = bypass ?? out.entryScreen; }
  };
  for (const s of out.screens) {
    s.onEnter?.forEach(fix);
    s.blocks.forEach((b: any) => { if (b.type === "button") b.actions.forEach(fix); if (b.type === "otp") b.onResend?.forEach(fix); });
    if (s.navigation) {
      s.navigation.rules = s.navigation.rules?.map((r) => (r.to === id ? { ...r, to: bypass ?? out.entryScreen } : r));
      if (s.navigation.default === id) s.navigation.default = bypass;
    }
  }
  return out;
}

export const textOf = (t: any): string => (typeof t === "string" ? t : t?.en ?? Object.values(t ?? {})[0] ?? "");

/** Set a localized string: keeps a plain string until a translation is typed; empty translations are removed. */
export function setLoc(current: any, lang: string, value: string, supported: string[]): any {
  const defLang = "en";
  const obj: Record<string, string> = typeof current === "string" ? { [defLang]: current } : { ...(current ?? {}) };
  if (value === "" && lang !== defLang) delete obj[lang]; else obj[lang] = value;
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === defLang && typeof current === "string") return obj[defLang];
  if (!supported.includes("ur") && keys.length === 1) return obj[defLang] ?? "";
  return obj;
}

export function blockSummary(b: any): string {
  switch (b.type) {
    case "text": case "alert": return textOf(b.text);
    case "button": return textOf(b.label);
    case "result": return textOf(b.title);
    case "amountInput": case "select": case "textInput": return `${textOf(b.label)} → ${b.bind}`;
    case "consent": return textOf(b.text);
    case "toggle": return textOf(b.label);
    case "cardForm": return "Number, name, expiry, code";
    case "otp": return `${b.length} digits → ${b.bind}`;
    case "accountPicker": case "beneficiaryPicker": return b.bind;
    case "reviewSummary": return `${b.rows.length} rows`;
    default: return "";
  }
}

/** Journeys are "the same" for publishing purposes when everything except status and version matches. */
export function sameContent(a?: Journey | null, b?: Journey | null): boolean {
  if (!a || !b) return false;
  const strip = ({ status: _s, version: _v, ...rest }: Journey) => JSON.stringify(rest);
  return strip(a) === strip(b);
}

export const KNOWN_ADAPTERS: Array<{ id: string; adapter: string }> = [
  { id: "accounts", adapter: "bank.accounts.list" }, { id: "beneficiaries", adapter: "bank.beneficiaries.list" },
  { id: "limits", adapter: "bank.limits.get" }, { id: "otpSend", adapter: "bank.otp.send" }, { id: "otpVerify", adapter: "bank.otp.verify" },
  { id: "transfer", adapter: "bank.transfers.create" }, { id: "billers", adapter: "bank.billers.list" }, { id: "billLookup", adapter: "bank.bills.lookup" },
  { id: "billPay", adapter: "bank.bills.pay" }, { id: "carriers", adapter: "bank.carriers.list" }, { id: "topup", adapter: "bank.topup.create" },
  { id: "legalEntities", adapter: "cab.legalEntities.list" }, { id: "captcha", adapter: "cab.captcha.generate" }, { id: "captchaCheck", adapter: "cab.captcha.verify" }, { id: "signIn", adapter: "cab.auth.signIn" }, { id: "deviceOptions", adapter: "cab.device.options" }, { id: "setDefault", adapter: "cab.device.setDefault" }, { id: "verifyPin", adapter: "cab.device.verifyPin" }, { id: "preview", adapter: "cab.preview.get" }, { id: "previewAccounts", adapter: "cab.preview.accounts" }, { id: "previewSet", adapter: "cab.preview.set" }, { id: "languages", adapter: "cab.language.list" }, { id: "currentLanguage", adapter: "cab.language.current" }, { id: "setLanguage", adapter: "cab.language.set" }, { id: "enroll", adapter: "cab.enroll.retail" }, { id: "activate", adapter: "cab.activate.validate" }, { id: "regenerate", adapter: "cab.activate.regenerate" }, { id: "policy", adapter: "cab.password.policy" }, { id: "setPassword", adapter: "cab.activate.setPassword" }, { id: "verifyUser", adapter: "cab.recover.verifyUser" }, { id: "resetPassword", adapter: "cab.recover.resetPassword" }, { id: "locations", adapter: "cab.locations.search" }, { id: "locationDetail", adapter: "cab.locations.details" },
];
