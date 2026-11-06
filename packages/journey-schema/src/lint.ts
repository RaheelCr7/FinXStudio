import type { Journey } from "./schema";

/**
 * The adapters that move money or commit the customer to a financial obligation. A journey that calls one needs a consent block and a
 * one-time code verified before the call (`consent_before_submit`, `otp_before_money`). An explicit list on purpose: a pattern would
 * either miss a new adapter silently or match one by accident, and the sandbox catalog test (renderer-core) fails when the two drift apart.
 */
export const MOVES_MONEY: ReadonlySet<string> = new Set([
  // payments and transfers
  "bank.transfers.create", "bank.transfers.own", "bank.payments.create", "bank.fx.convert", "bank.bills.pay", "bank.topup.create", "bank.subscriptions.pay",
  "bank.schedules.create", "bank.schedules.update",
  // statements that carry a fee, cards ordered for a fee
  "bank.statements.issue", "bank.cards.replace",
  // save, borrow and invest (term deposit open/renew/close, card top-up, loans, funds, stocks)
  "bank.deposit.create", "bank.deposits.open", "bank.deposits.renew", "bank.deposits.close",
  "bank.loans.apply", "bank.loans.repay", "bank.loans.settle",
  "bank.funds.buy", "bank.funds.sell", "bank.invest.buy", "bank.invest.sell",
  // business: a payment, a scheduled payment, an approval that releases money, a batch, a payroll run
  "corp.payments.initiate", "corp.payments.create", "corp.payments.approve", "corp.payments.approveMany",
  "corp.schedules.create", "corp.schedules.update", "corp.bulk.submit", "corp.payroll.submit",
]);

/**
 * The adapters that change how a customer or a business is protected: card controls and PIN, who may be paid, contact details,
 * passwords and devices, and the administration of a company (people, limits, approval groups). A journey that calls one needs a one-time
 * code verified before the call (`step_up_before_security_change`). It does not need a consent block unless it also moves money.
 */
export const CHANGES_SECURITY: ReadonlySet<string> = new Set([
  // cards: loosening a card (unfreeze, a higher limit, a control turned on), a PIN, a new virtual card number
  "bank.cards.unfreeze", "bank.cards.controls.update", "bank.cards.pin.set", "bank.cards.virtual.create",
  // who may be paid
  "bank.payees.save", "corp.suppliers.request",
  // how the person is reached and how they get in
  "bank.profile.update", "bank.password.change", "bank.recover.resetPassword", "cab.recover.resetPassword", "bank.recover.unlock",
  "bank.devices.remove", "bank.devices.setQuickSignIn", "bank.device.setDefault",
  // administration of a company: people, limits, approval groups, the decision on a waiting change, who approves in your place
  "corp.users.invite", "corp.users.update", "corp.users.disable", "corp.users.enable",
  "corp.limits.set", "corp.signatories.update", "corp.changes.decide", "corp.payments.delegate",
]);

/**
 * Adapters that only protect or only read, so they need no code: freezing or blocking a card has to be one tap in an emergency
 * (spec: freeze needs no code, unfreeze does), removing a virtual card only reduces risk. Not used by the lint; the sandbox catalog test
 * reads it to prove that every adapter that asks for a code is either gated or listed here with its reason.
 */
export const PROTECTIVE_ONLY: ReadonlySet<string> = new Set(["bank.cards.freeze", "bank.cards.block", "bank.cards.virtual.delete"]);

export const movesMoney = (adapter: string): boolean => MOVES_MONEY.has(adapter);
export const changesSecurity = (adapter: string): boolean => CHANGES_SECURITY.has(adapter);
export type LintIssue = { code: string; message: string; screen?: string };

/** Every action a block can run: a button's, a code's resend, and those of menu rows, shortcut icons and a heading's link. */
export const blockActions = (b: any): any[] => {
  switch (b?.type) {
    case "button": return b.actions ?? [];
    case "otp": return b.onResend ?? [];
    case "menu": case "shortcuts": return [...(b.items ?? []).flatMap((i: any) => i.actions ?? []), ...(b.item?.actions ?? [])];
    case "sectionHeader": return b.action?.actions ?? [];
    case "toggle": return b.link?.actions ?? [];
    case "dialog": return [...(b.buttons ?? []).flatMap((x: any) => x.actions ?? []), ...(b.dismiss ?? [])];
    case "map": return b.onSelect ?? [];
    case "dataTable": return b.onRowPress ?? [];
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

/** The slugs of the journeys this one opens with `navigate.toJourney`. */
export const chainTargets = (j: Journey): string[] => {
  const out = new Set<string>();
  const walk = (a: any) => { if (a?.type === "navigate" && a.toJourney) out.add(a.toJourney); };
  for (const s of j.screens) { s.onEnter?.forEach(walk); s.blocks.forEach((b: any) => blockActions(b).forEach(walk)); }
  return [...out];
};

/** Non-blocking: a `toJourney` that is not in the list of journeys the apps know (a copy made for a bank keeps its name with the bank appended). */
export function chainWarnings(j: Journey, known: Iterable<string>): LintIssue[] {
  const slugs = [...known];
  return chainTargets(j).filter((t) => !slugs.some((k) => k === t || k.startsWith(`${t}-`)))
    .map((t) => ({ code: "unknown_journey", message: `navigate.toJourney "${t}" is not a journey in the catalog, so opening it will fail in the apps.` }));
}

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
  // the denied screen of a journey for one role is reached by the engine, not by a button
  const stack = [j.entryScreen, ...(j.authorisation ? [j.authorisation.deniedScreen] : [])];
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
  const moves = j.integrations.some((i) => movesMoney(i.adapter));
  if (moves && !hasConsent) issues.push({ code: "consent_before_submit", message: "Money-moving journey has no consent block" });

  // OTP before money moves, and before a change to how the customer or business is protected (that alone needs no consent)
  const otpScreen = j.screens.find((s) => s.blocks.some((b) => b.type === "otp"));
  const buttonCalls = (s: typeof j.screens[number]) => s.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : []));
  const verifyIdx = (s: typeof j.screens[number]) => buttonCalls(s).findIndex((a: any) => a.type === "callApi" && /otpVerify/.test(a.integration));
  const gatedIdx = (s: typeof j.screens[number], gated: (adapter: string) => boolean) =>
    buttonCalls(s).findIndex((a: any) => a.type === "callApi" && j.integrations.find((i) => i.id === a.integration && gated(i.adapter)));
  /** What is wrong with the code in front of a call, or undefined when it is checked first. */
  const codeProblem = (gated: (adapter: string) => boolean): { noScreen: boolean; screen?: string } | undefined => {
    if (!otpScreen) return { noScreen: true };
    const at = gatedIdx(otpScreen, gated);
    if (verifyIdx(otpScreen) < 0 || (at >= 0 && verifyIdx(otpScreen) > at)) return { noScreen: false, screen: otpScreen.id };
    return undefined;
  };
  const money = moves ? codeProblem(movesMoney) : undefined;
  if (money) issues.push(money.noScreen ? { code: "otp_before_money", message: "Money-moving journey has no OTP screen" } : { code: "otp_before_money", message: "OTP must be verified before the money-moving call", screen: money.screen });
  // a journey that also moves money was already told about its code
  if (!money && j.integrations.some((i) => changesSecurity(i.adapter))) {
    const step = codeProblem(changesSecurity);
    if (step) issues.push(step.noScreen
      ? { code: "step_up_before_security_change", message: "A journey that changes how the customer or business is protected has no OTP screen" }
      : { code: "step_up_before_security_change", message: "OTP must be verified before the call that changes security settings", screen: step.screen });
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

  // a journey for one role must be able to send everyone else somewhere
  if (j.authorisation) {
    const denied = j.screens.find((s) => s.id === j.authorisation!.deniedScreen);
    if (!denied) issues.push({ code: "authorisation_denied_missing", message: `authorisation.deniedScreen "${j.authorisation.deniedScreen}" is not a screen` });
    else if (denied.kind !== "terminal") issues.push({ code: "authorisation_denied_missing", message: `The denied screen "${denied.id}" must be a terminal screen`, screen: denied.id });
  } else if (j.integrations.some((i) => /^corp\.payments\.(initiate|approve)$/.test(i.adapter))) {
    issues.push({ code: "authorisation_missing", message: "A journey that starts or approves a company payment must say which role may use it (authorisation)" });
  }

  // acceptance criteria and the scenarios that prove them
  const criteria = new Set((j.acceptance ?? []).map((a) => a.id));
  const dupAc = (j.acceptance ?? []).map((a) => a.id).filter((id, i, all) => all.indexOf(id) !== i);
  for (const id of new Set(dupAc)) issues.push({ code: "acceptance_duplicate", message: `Acceptance criterion ${id} is used more than once` });
  const dupT = (j.scenarios ?? []).map((t) => t.id).filter((id, i, all) => all.indexOf(id) !== i);
  for (const id of new Set(dupT)) issues.push({ code: "scenario_duplicate", message: `Scenario ${id} is used more than once` });
  for (const t of j.scenarios ?? []) for (const c of t.covers) if (!criteria.has(c)) issues.push({ code: "scenario_unknown_criterion", message: `Scenario ${t.id} covers ${c}, which is not an acceptance criterion of this journey` });
  if (criteria.size) {
    const covered = new Set((j.scenarios ?? []).flatMap((t) => t.covers));
    for (const id of criteria) if (!covered.has(id)) issues.push({ code: "criterion_uncovered", message: `Acceptance criterion ${id} has no scenario that covers it` });
  }

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
