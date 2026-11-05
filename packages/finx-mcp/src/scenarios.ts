import { bankworkxJourneys, chainTargets, type Journey } from "@finx/journey-schema";
import type { Flaws, ProviderId } from "@finx/mock-bank-api";
import { simulate, type SimOptions, type Step } from "./simulate";

/**
 * The tests that travel with a journey (journey.scenarios) and what they prove: which acceptance criteria are covered by a
 * scenario that passes, and whether the tests would notice if the journey (or the bank's rules) were wrong. A mutation check
 * breaks the journey or the sandbox on purpose, one thing at a time, and expects at least one scenario to fail each time.
 */
export type ScenarioResult = { id: string; name: string; covers: string[]; ok: boolean; failures: string[]; finalScreen: string; /** the screens the scenario went through */ visited: string[] };
export type CoverageRow = { id: string; text: string; scenarios: string[]; passing: string[]; status: "proved" | "failing" | "uncovered" };
export type ScenarioReport = {
  ok: boolean; total: number; passed: number; results: ScenarioResult[];
  coverage: CoverageRow[]; uncovered: string[];
};

type Overrides = { flaws?: Flaws; provider?: ProviderId; /** Journeys that a scenario may be sent to by navigate.toJourney. Default: the shipped BankWorkx journeys. */ journeys?: Journey[] };

export async function runScenarios(journey: Journey, over: Overrides = {}): Promise<ScenarioReport> {
  const results: ScenarioResult[] = [];
  for (const t of journey.scenarios ?? []) {
    const opts: SimOptions = {
      journey, persona: t.persona, lang: t.lang ?? journey.locale.default, steps: t.steps as unknown as Step[],
      provider: (over.provider ?? (t.provider as ProviderId | undefined)), now: t.now ? Date.parse(t.now) : undefined,
      setup: t.setup as SimOptions["setup"], context: t.context, flaws: over.flaws, conditions: t.conditions, config: t.config as SimOptions["config"], launch: t.launch, journeys: over.journeys,
    };
    try {
      const r = await simulate(opts);
      results.push({ id: t.id, name: t.name, covers: t.covers, ok: r.ok, failures: r.failures, finalScreen: r.finalScreen, visited: r.visited });
    } catch (e) {
      results.push({ id: t.id, name: t.name, covers: t.covers, ok: false, failures: [(e as Error).message], finalScreen: "", visited: [] });
    }
  }
  const coverage: CoverageRow[] = (journey.acceptance ?? []).map((a) => {
    const mine = results.filter((r) => r.covers.includes(a.id));
    const passing = mine.filter((r) => r.ok);
    return { id: a.id, text: a.text, scenarios: mine.map((r) => r.id), passing: passing.map((r) => r.id), status: mine.length === 0 ? "uncovered" : passing.length === mine.length ? "proved" : "failing" };
  });
  const passed = results.filter((r) => r.ok).length;
  return { ok: results.length > 0 && passed === results.length && coverage.every((c) => c.status === "proved"), total: results.length, passed, results, coverage, uncovered: coverage.filter((c) => c.status !== "proved").map((c) => c.id) };
}

/* ------------------------------------------------------------------------------------------ mutation check */

export type Mutant = { id: string; what: string; kind: "journey" | "bank"; journey?: (j: Journey) => Journey | null; flaws?: Flaws };
export type MutantResult = { id: string; what: string; kind: Mutant["kind"]; killed: boolean; caughtBy: string[] };
export type MutationReport = { ok: boolean; total: number; killed: number; survived: MutantResult[]; /** survivors someone has explained, with the reason */ accepted: (MutantResult & { reason: string })[]; results: MutantResult[] };

const clone = <T,>(x: T): T => structuredClone(x);
const eachAction = (j: any, fn: (list: any[], i: number, where: string) => void) => {
  const walk = (list: any[] | undefined, where: string) => { if (!list) return; for (let i = list.length - 1; i >= 0; i--) fn(list, i, where); };
  for (const s of j.screens) {
    walk(s.onEnter, `${s.id} onEnter`);
    for (const b of s.blocks) {
      if (b.type === "button") walk(b.actions, `${s.id} "${typeof b.label === "string" ? b.label : b.label?.en}"`);
      if (b.type === "otp") walk(b.onResend, `${s.id} resend`);
      if (b.type === "dialog") { for (const x of b.buttons) walk(x.actions, `${s.id} dialog "${typeof x.label === "string" ? x.label : x.label?.en}"`); walk(b.dismiss, `${s.id} dialog dismiss`); }
      if (b.type === "map") walk(b.onSelect, `${s.id} map`);
      for (const it of b.items ?? []) walk(it.actions, `${s.id} row ${it.id}`);
      if (b.item) walk(b.item.actions, `${s.id} list row`);
    }
  }
};

/** Everything one mutation operator could break in this journey, as a list of named mutants. */
export function journeyMutants(journey: Journey): Mutant[] {
  const out: Mutant[] = [];
  const add = (id: string, what: string, apply: (j: any) => boolean) => out.push({ id, what, kind: "journey", journey: (j) => { const c: any = clone(j); return apply(c) ? c : null; } });

  // every validate action, every one-time-code check, every onError, every callApi: remove it
  let n = 0;
  eachAction(clone(journey), (list, i, where) => {
    const a = list[i];
    const k = ++n; // ids follow the order found (reverse), stable for a given journey
    const nth = (j: any) => { let c = 0, hit: any = null; eachAction(j, (l, ix) => { if (++c === k) hit = { l, ix }; }); return hit; };
    if (a.type === "validate") add(`no-validate-${k}`, `Remove the validation step on ${where}`, (j) => { const h = nth(j); if (!h || h.l[h.ix].type !== "validate") return false; h.l.splice(h.ix, 1); return true; });
    if (a.type === "callApi" && /otp\.verify|otpVerify/.test(a.integration)) add(`no-otp-check-${k}`, `Skip the one-time code check on ${where}`, (j) => { const h = nth(j); if (!h || h.l[h.ix].type !== "callApi") return false; h.l.splice(h.ix, 1); return true; });
    if (a.type === "navigate" && a.toJourney) {
      add(`no-chain-${k}`, `Do not open ${a.toJourney} from ${where}`, (j) => { const h = nth(j); if (!h || !h.l[h.ix].toJourney) return false; h.l.splice(h.ix, 1); return true; });
      for (const key of Object.keys(a.with ?? {})) add(`no-launch-value-${k}-${key}`, `Open ${a.toJourney} from ${where} without the value ${key}`, (j) => { const h = nth(j); if (!h || !h.l[h.ix].with || !(key in h.l[h.ix].with)) return false; delete h.l[h.ix].with[key]; return true; });
    }
    if (a.type === "callApi" && a.onError) add(`no-error-path-${k}`, `Remove the error path of ${a.integration} on ${where}`, (j) => { const h = nth(j); if (!h || !h.l[h.ix].onError) return false; delete h.l[h.ix].onError; return true; });
  });

  // consent that must be ticked, limits on amounts, navigation rules, the role check
  journey.screens.forEach((s, si) => s.blocks.forEach((b: any, bi) => {
    if (b.type === "consent" && b.validation?.mustBeTrue) add(`consent-optional-${s.id}`, `Make the confirmation on ${s.id} optional`, (j) => { j.screens[si].blocks[bi].validation.mustBeTrue = false; return true; });
    if (b.type === "amountInput" && b.validation?.max !== undefined) add(`no-max-${s.id}`, `Remove the maximum amount on ${s.id}`, (j) => { delete j.screens[si].blocks[bi].validation.max; return true; });
    if (b.type === "amountInput" && typeof b.validation?.min === "number") add(`no-min-${s.id}`, `Remove the minimum amount on ${s.id}`, (j) => { delete j.screens[si].blocks[bi].validation.min; return true; });
  }));
  journey.screens.forEach((s, si) => (s.navigation?.rules ?? []).forEach((r, ri) => add(`no-rule-${s.id}-${ri}`, `Remove the navigation rule "${r.when}" on ${s.id}`, (j) => { j.screens[si].navigation.rules.splice(ri, 1); return true; })));
  if (journey.authorisation) add("no-authorisation", `Let any role use the journey`, (j) => { delete j.authorisation; return true; });
  return out;
}

/** The sandbox bank's rules, one at a time switched off. Only meaningful for journeys that call the corporate adapters. */
export function bankMutants(journey: Journey): Mutant[] {
  // starting a payment is also pricing it and creating it (the combined demo's companies); approving is also approving several at once
  const calls = (name: string) => journey.integrations.some((i) => i.adapter === `corp.payments.${name}` || (name === "initiate" && (/^corp\.(bulk|payroll)\.(check|submit)$/.test(i.adapter) || /^corp\.payments\.(quote|create)$/.test(i.adapter))) || (name === "approve" && i.adapter === "corp.payments.approveMany"));
  // a journey for the combined demo's companies (one login, several places): the permissions of the context and the approval rules of those companies apply
  const demo = journey.integrations.some((i) => /^corp\.payments\.(quote|create|approveMany|delegate|list)$/.test(i.adapter));
  const bulk = journey.integrations.some((i) => /^corp\.(bulk|payroll)\./.test(i.adapter));
  const payroll = journey.integrations.some((i) => /^corp\.payroll\./.test(i.adapter));
  const uses = (re: RegExp) => journey.integrations.some((i) => re.test(i.adapter));
  // only the rules this journey can reach: starting a payment, or approving and rejecting one
  const all: [keyof Flaws, string, boolean][] = [
    ["roles", "The bank ignores who may start and who may approve", calls("initiate") || calls("approve")],
    ["whitelist", "The bank pays beneficiaries that are not on the approved list", calls("initiate")],
    ["userLimit", "The bank ignores a person's daily limit", calls("initiate")],
    ["companyLimit", "The bank ignores the company's daily limit", calls("initiate") || calls("approve")],
    ["dualApproval", "The bank never asks for a second approver", calls("initiate") || calls("approve")],
    ["fourEyes", "The bank lets people approve their own payments", calls("approve")],
    ["cutoff", "The bank ignores the cut-off time", calls("initiate")],
    // the companies of the combined demo: what the context allows, the order of approvers, the approval cut-off, the name tick, passing a payment on
    ["permissions", "The bank lets a role use an adapter its permissions do not allow", demo],
    ["sequence", "The bank lets an approver go before the one whose turn it is", demo && calls("approve")],
    ["approvalCutoff", "The bank lets a payment be approved after the cut-off", demo && calls("approve")],
    ["nameAck", "The bank approves a payment whose name check was flagged without the approver saying they checked it", demo && calls("approve")],
    ["delegation", "The bank lets a payment be passed to the person who started it or who already approved it, and lets others approve it after", demo && uses(/^corp\.payments\.delegate$/)],
    ["lineChecks", "The bank accepts every row of a bulk file without checking it", bulk],
    ["employeeChecks", "The bank pays anyone, and any amount, on a payroll file", payroll],
    ["payrollPeriod", "The bank takes any pay period and lets a period be paid twice", payroll],
    // a retail customer's own accounts: the rules of moving and converting money between them
    ["sameAccount", "The bank lets money move from an account to itself", uses(/^bank\.(transfers\.own|schedules\.(check|create))$/)],
    ["canDebit", "The bank lets an account that is frozen send money", uses(/^bank\.(transfers\.own|fx\.quote|payments\.(quote|create)|bills\.(quote|pay)|topup\.(check|create)|schedules\.(check|create))$/)],
    ["funds", "The bank lets an account send more than it has", uses(/^bank\.(transfers\.own|fx\.(quote|convert)|payments\.(quote|create)|bills\.(quote|pay)|topup\.(check|create))$/)],
    ["quoteExpiry", "The bank converts at a rate that has run out", uses(/^bank\.(fx\.convert|payments\.create)$/)],
    ["quoteReplay", "The bank lets one rate be used twice", uses(/^bank\.(fx\.convert|payments\.create)$/)],
    // sending money to someone else: the speeds and their limits, the daily limit, the new-payee allowance, screening, purpose and address
    ["railLimit", "The bank sends a payment that is over the limit of its speed", uses(/^bank\.payments\.quote$/)],
    ["dailyLimit", "The bank ignores the customer's daily limit", uses(/^bank\.(payments\.(quote|create)|bills\.(quote|pay)|topup\.(check|create)|schedules\.(check|create))$/)],
    ["coolingOff", "The bank ignores the allowance of a payee added in the last 24 hours", uses(/^bank\.(payments\.(quote|create)|schedules\.(check|create))$/)],
    ["sanctions", "The bank sends a payment to a payee that screening holds", uses(/^bank\.payments\.create$/)],
    ["purposeRule", "The bank takes a payment abroad without a purpose", uses(/^bank\.payments\.quote$/)],
    ["addressRule", "The bank takes a payment abroad without the payee's address when the rules ask for it", uses(/^bank\.payments\.quote$/)],
    ["bankCode", "The bank accepts a transit number, IFSC or BSB in the wrong format", uses(/^bank\.payments\.quote$/) && uses(/^bank\.payees\.validate$/)],
    // paying a bill: the smallest and the largest payment, what was already paid, an amount due that changed, and the currency of the bill
    ["billMinimum", "The bank takes a bill payment below the minimum", uses(/^bank\.bills\.(quote|pay)$/)],
    ["billMaximum", "The bank takes a bill payment above the amount due", uses(/^bank\.bills\.(quote|pay)$/)],
    ["billMemory", "The bank forgets what was already paid on a bill", uses(/^bank\.bills\.(lookup|quote|pay)$/)],
    ["billChanged", "The bank pays a bill whose amount due changed since the person saw it", uses(/^bank\.bills\.pay$/)],
    ["billCurrency", "The bank pays a bill from an account in another currency when that is switched off", uses(/^bank\.bills\.(quote|pay)$/)],
    // scheduled payments: how many, the first date, the end, and when a payment can still be changed
    ["scheduleLimit", "The bank lets a customer have more than 20 scheduled payments", uses(/^bank\.schedules\.(check|create)$/)],
    ["scheduleDates", "The bank takes a first date that is today, more than 12 months away or not a business day", uses(/^bank\.schedules\.(check|create|update)$/)],
    ["scheduleEnd", "The bank takes an end date before the start, one off the list, or a number of payments out of range", uses(/^bank\.schedules\.(check|create|update)$/)],
    ["scheduleCutoff", "The bank changes or cancels a payment after changes closed", uses(/^bank\.schedules\.(get|check|update|cancel)$/)],
    ["scheduleRunning", "The bank changes or cancels a payment on the day it runs", uses(/^bank\.schedules\.(get|check|update|cancel)$/)],
    // topping up a mobile number: the operator's own amounts, the numbers the operator cannot top up, and the day's allowance of one number
    ["topupAmount", "The bank tops up an amount that is not one the operator offers", uses(/^bank\.topup\.(check|create)$/)],
    ["topupNumber", "The bank tops up a number the operator cannot top up or cannot reach", uses(/^bank\.topup\.(check|create)$/)],
    ["topupLimit", "The bank lets one number be topped up above 300.00 in a day", uses(/^bank\.topup\.(check|create)$/)],
    // the payees a customer saves: what the bank checks about them
    ["payeeLimit", "The bank lets a customer save more than 50 payees", uses(/^bank\.payees\.(validate|save)$/)],
    ["payeeDuplicate", "The bank lets the same payee be saved twice", uses(/^bank\.payees\.(validate|save|update)$/)],
    ["payeeInUse", "The bank deletes a payee that a scheduled payment uses", uses(/^bank\.payees\.delete$/)],
    ["ibanChecksum", "The bank accepts an IBAN whose check digits are wrong", uses(/^bank\.payees\.validate$/)],
    ["sepa", "The bank accepts an IBAN from outside the SEPA area as a European payee", uses(/^bank\.payees\.validate$/)],
    ["countryMatch", "The bank accepts an IBAN from another country than the one chosen", uses(/^bank\.payees\.validate$/)],
    ["routingChecksum", "The bank accepts a routing number whose checksum is wrong", uses(/^bank\.payees\.validate$/)],
    ["sortCode", "The bank accepts a sort code that is not 6 digits", uses(/^bank\.payees\.validate$/)],
    ["bic", "The bank accepts a SWIFT/BIC of the wrong length", uses(/^bank\.payees\.validate$/)],
    ["nameCheck", "The name check says every name matches", uses(/^bank\.payees\.check$/)],
    ["verifiedOnMatch", "The bank marks a payee Verified whether or not the name matched", uses(/^bank\.payees\.(save|update)$/)],
    ["clockOnDetails", "Changing the bank details of a payee does not start its 24 hours again", uses(/^bank\.payees\.update$/)],
    ["nameKeepsClock", "Changing only the name of a payee starts its 24 hours again", uses(/^bank\.payees\.update$/)],
    // signing in: the password, the lock, the code on a new device, the expired password, the one-time codes and the recovery
    ["credentials", "The bank accepts any password", uses(/^bank\.auth\.signIn$/)],
    ["signInLock", "The bank never locks a profile after wrong passwords", uses(/^bank\.auth\.signIn$/)],
    ["usernameHiding", "The bank answers differently for a username it does not know", uses(/^bank\.auth\.signIn$/)],
    ["newDeviceCode", "The bank signs in from a new device without a code", uses(/^bank\.auth\.signIn$/)],
    ["expiredPassword", "The bank lets an expired password sign in without a new one", uses(/^bank\.auth\.signIn$/)],
    ["codeExpiry", "The bank accepts a one-time code that has run out", uses(/^bank\.(auth\.signIn|recover\.verifyUser)$/)],
    ["codeLock", "The bank never locks a sign-in after wrong codes", uses(/^bank\.auth\.signIn$/)],
    ["resendLimit", "The bank sends as many codes as are asked for", uses(/^bank\.(auth\.signIn|recover\.verifyUser)$/)],
    ["recoveryLock", "The bank never locks a recovery after wrong tries", uses(/^bank\.recover\.verifyUser$/)],
    ["tokenExpiry", "The bank accepts a recovery token that has run out", uses(/^bank\.recover\.(sendUsername|resetPassword|unlock)$/)],
    ["resetNeedsCode", "The bank acts on a recovery without the one-time code", uses(/^bank\.recover\.(sendUsername|resetPassword|unlock)$/)],
    ["resetClearsLock", "A reset leaves the profile locked", uses(/^bank\.recover\.resetPassword$/)],
    ["passwordLength", "The bank takes a new password that is too short or too long", uses(/^bank\.(auth\.changePassword|recover\.resetPassword)$/)],
    ["passwordUsername", "The bank takes a new password that contains the username", uses(/^bank\.(auth\.changePassword|recover\.resetPassword)$/)],
    ["passwordCommon", "The bank takes a new password with a common word in it", uses(/^bank\.(auth\.changePassword|recover\.resetPassword)$/)],
    ["passwordBreach", "The bank takes a new password that is in a known breach", uses(/^bank\.(auth\.changePassword|recover\.resetPassword)$/)],
    ["passwordReuse", "The bank takes a new password the person used before", uses(/^bank\.(auth\.changePassword|recover\.resetPassword)$/)],
    ["deviceLimit", "The bank trusts more than five devices", uses(/^bank\.auth\.trustDevice$/)],
    ["pinRules", "The bank takes a quick PIN that is easy to guess or part of the phone number", uses(/^bank\.auth\.setQuickSignIn$/)],
  ];
  const rules = all.filter(([, , reachable]) => reachable).map(([k, what]) => [k, what] as [keyof Flaws, string]);
  return rules.map(([k, what]) => ({ id: `bank-${k}`, what, kind: "bank" as const, flaws: { [k]: false } as Flaws }));
}

/**
 * `accepted` lists mutants the tests do not catch on purpose, each with the reason (for example another layer already stops it,
 * so the screen can never reach the broken rule). A survivor that is not accepted fails the check.
 */
export async function mutationCheck(journey: Journey, accepted: Record<string, string> = {}, journeys: Journey[] = bankworkxJourneys): Promise<MutationReport> {
  // a journey that opens others meets the bank rules of the journeys it opens, so those rules are mutated too
  const opened = chainTargets(journey).flatMap((t) => journeys.find((x) => x.slug === t || x.slug.startsWith(`${t}-`))?.integrations ?? []);
  const mutants = [...journeyMutants(journey), ...bankMutants(opened.length ? { ...journey, integrations: [...journey.integrations, ...opened] } : journey)];
  const results: MutantResult[] = [];
  for (const m of mutants) {
    let target: Journey | null = journey;
    if (m.journey) target = m.journey(journey);
    if (!target) continue;
    let report;
    try { report = await runScenarios(target, { flaws: m.flaws, journeys }); } catch { results.push({ id: m.id, what: m.what, kind: m.kind, killed: true, caughtBy: ["(the broken journey could not run)"] }); continue; }
    const caught = report.results.filter((r) => !r.ok).map((r) => r.id);
    results.push({ id: m.id, what: m.what, kind: m.kind, killed: caught.length > 0, caughtBy: caught });
  }
  const alive = results.filter((r) => !r.killed);
  const survived = alive.filter((r) => !(r.id in accepted));
  const ok = alive.filter((r) => r.id in accepted).map((r) => ({ ...r, reason: accepted[r.id]! }));
  return { ok: survived.length === 0, total: results.length, killed: results.length - alive.length, survived, accepted: ok, results };
}
