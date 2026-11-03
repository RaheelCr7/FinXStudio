import type { Journey } from "./schema";

export type LintIssue = { code: string; message: string; screen?: string };

/** Every action a block can run: a button's, a code's resend, and those of menu rows, shortcut icons and a heading's link. */
export const blockActions = (b: any): any[] => {
  switch (b?.type) {
    case "button": return b.actions ?? [];
    case "otp": return b.onResend ?? [];
    case "menu": case "shortcuts": return (b.items ?? []).flatMap((i: any) => i.actions ?? []);
    case "sectionHeader": return b.action?.actions ?? [];
    case "toggle": return b.link?.actions ?? [];
    default: return [];
  }
};

const collectNav = (j: Journey, id: string): string[] => {
  const s = j.screens.find((x) => x.id === id);
  if (!s) return [];
  const out: string[] = [];
  s.navigation?.rules?.forEach((r) => out.push(r.to));
  if (s.navigation?.default) out.push(s.navigation.default);
  const walk = (a: any) => {
    if (a?.type === "navigate" && a.to) out.push(a.to);
    if (a?.type === "callApi" && a.onError) {
      if (a.onError.navigate) out.push(a.onError.navigate);
      if (a.onError.lockTo) out.push(a.onError.lockTo);
    }
  };
  s.onEnter?.forEach(walk);
  s.blocks.forEach((b: any) => blockActions(b).forEach(walk));
  return out;
};

export function lintJourney(j: Journey): LintIssue[] {
  const issues: LintIssue[] = [];
  const ids = new Set(j.screens.map((s) => s.id));
  const dupScreens = j.screens.map((s) => s.id).filter((id, i, all) => all.indexOf(id) !== i);
  for (const id of new Set(dupScreens)) issues.push({ code: "duplicate_screen_id", message: `Screen id "${id}" is used more than once`, screen: id });
  const dupInteg = j.integrations.map((i) => i.id).filter((id, i, all) => all.indexOf(id) !== i);
  for (const id of new Set(dupInteg)) issues.push({ code: "duplicate_integration_id", message: `Integration id "${id}" is declared more than once` });
  if (!ids.has(j.entryScreen)) issues.push({ code: "entry_missing", message: `Entry screen ${j.entryScreen} does not exist` });

  // reachability
  const seen = new Set<string>();
  const stack = [j.entryScreen];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of collectNav(j, id)) {
      if (!ids.has(n)) issues.push({ code: "dangling_target", message: `Navigation to unknown screen ${n}`, screen: id });
      else stack.push(n);
    }
  }
  for (const s of j.screens) if (!seen.has(s.id)) issues.push({ code: "unreachable", message: `Screen ${s.id} is not reachable`, screen: s.id });

  // integrations declared
  const integ = new Set(j.integrations.map((i) => i.id));
  for (const s of j.screens) {
    const acts: any[] = [...(s.onEnter ?? [])];
    s.blocks.forEach((b: any) => acts.push(...blockActions(b)));
    for (const a of acts) if (a.type === "callApi" && !integ.has(a.integration)) issues.push({ code: "unknown_integration", message: `Integration ${a.integration} not declared`, screen: s.id });
  }

  // terminal screens
  if (!j.screens.some((s) => s.kind === "terminal")) issues.push({ code: "no_terminal", message: "Journey has no terminal screen" });

  // consent before submit: any screen that calls a money-moving integration must be preceded by a screen with consent
  const hasConsent = j.screens.some((s) => s.blocks.some((b) => b.type === "consent"));
  const moves = j.integrations.some((i) => /transfers\.create|payments\.create|bills\.pay|topup\.create/.test(i.adapter));
  if (moves && !hasConsent) issues.push({ code: "consent_before_submit", message: "Money-moving journey has no consent block" });

  // OTP before money moves
  const otpScreen = j.screens.find((s) => s.blocks.some((b) => b.type === "otp"));
  const verifyIdx = (s: typeof j.screens[number]) =>
    s.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).findIndex((a: any) => a.type === "callApi" && /otpVerify/.test(a.integration));
  const moveIdx = (s: typeof j.screens[number]) =>
    s.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).findIndex((a: any) => a.type === "callApi" && j.integrations.find((i) => i.id === a.integration && /transfers\.create|payments\.create|bills\.pay|topup\.create/.test(i.adapter)));
  if (moves) {
    if (!otpScreen) issues.push({ code: "otp_before_money", message: "Money-moving journey has no OTP screen" });
    else if (verifyIdx(otpScreen) < 0 || (moveIdx(otpScreen) >= 0 && verifyIdx(otpScreen) > moveIdx(otpScreen))) {
      issues.push({ code: "otp_before_money", message: "OTP must be verified before the money-moving call", screen: otpScreen.id });
    }
  }

  // inputs bound to dataModel
  if (j.dataModel) {
    for (const s of j.screens) for (const b of s.blocks as any[]) {
      if (b.bind && !(b.bind in j.dataModel)) issues.push({ code: "unbound_input", message: `Block binds ${b.bind} which is not in dataModel`, screen: s.id });
    }
  }

  // amounts: each names a currency (a code, or a path to one in the data), the same one the data model says, and a journey does not mix currencies by accident
  const literal = new Set<string>();
  for (const s of j.screens) for (const b of s.blocks as any[]) {
    if (b.type !== "amountInput") continue;
    const c = String(b.currency ?? "").trim();
    if (!c) { issues.push({ code: "amount_no_currency", message: `Amount ${b.bind} has no currency`, screen: s.id }); continue; }
    if (c.includes("{{")) continue;
    if (!/^[A-Z]{3,4}$/.test(c)) { issues.push({ code: "amount_currency_invalid", message: `Amount ${b.bind} has currency "${c}": use a code like JOD or a path like {{account.currency}}`, screen: s.id }); continue; }
    literal.add(c);
    const declared = j.dataModel?.[b.bind]?.currency;
    if (declared && !declared.includes("{{") && declared !== c) issues.push({ code: "currency_mismatch", message: `Amount ${b.bind} is in ${c} but dataModel says ${declared}`, screen: s.id });
  }
  if (literal.size > 1) issues.push({ code: "mixed_currency", message: `Amounts in ${[...literal].join(" and ")} in one journey. Fine for a conversion; otherwise use one currency.` });

  // translations complete
  const langs = j.locale.supported.filter((l) => l !== j.locale.default);
  const missing = new Set<string>();
  const check = (t: any, where: string) => {
    if (t && typeof t === "object") for (const l of langs) if (!(l in t)) missing.add(`${where}:${l}`);
  };
  for (const s of j.screens) {
    check(s.title, s.id);
    s.blocks.forEach((b: any) => { ["label", "text", "title", "hint", "helper", "placeholder"].forEach((k) => check(b[k], s.id)); });
  }
  if (missing.size) issues.push({ code: "translation_gap", message: `${missing.size} strings missing translations (${[...missing].slice(0, 3).join(", ")}…)` });
  return issues;
}
