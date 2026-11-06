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
    ["signInLock", "The bank never locks a profile after wrong passwords", uses(/^bank\.(auth\.signIn|password\.check)$/)],
    ["usernameHiding", "The bank answers differently for a username it does not know", uses(/^bank\.auth\.signIn$/)],
    ["newDeviceCode", "The bank signs in from a new device without a code", uses(/^bank\.auth\.signIn$/)],
    ["expiredPassword", "The bank lets an expired password sign in without a new one", uses(/^bank\.auth\.signIn$/)],
    ["codeExpiry", "The bank accepts a one-time code that has run out", uses(/^bank\.(auth\.signIn|recover\.verifyUser|password\.change|devices\.(remove|setQuickSignIn)|registration\.verify|onboarding\.start|applications\.find)$/)],
    ["codeLock", "The bank never locks a sign-in after wrong codes", uses(/^bank\.(auth\.signIn|password\.change|devices\.(remove|setQuickSignIn))$/)],
    ["resendLimit", "The bank sends as many codes as are asked for", uses(/^bank\.(auth\.signIn|recover\.verifyUser|password\.change|devices\.(remove|setQuickSignIn)|registration\.verify|onboarding\.start|applications\.find)$/)],
    ["recoveryLock", "The bank never locks a recovery after wrong tries", uses(/^bank\.recover\.verifyUser$/)],
    ["tokenExpiry", "The bank accepts a recovery or registration token that has run out", uses(/^bank\.(recover\.(sendUsername|resetPassword|unlock)|registration\.complete)$/)],
    ["resetNeedsCode", "The bank acts on a recovery without the one-time code", uses(/^bank\.recover\.(sendUsername|resetPassword|unlock)$/)],
    ["resetClearsLock", "A reset leaves the profile locked", uses(/^bank\.recover\.resetPassword$/)],
    ["passwordLength", "The bank takes a new password that is too short or too long", uses(/^bank\.(auth\.changePassword|recover\.resetPassword|password\.change|registration\.complete)$/)],
    ["passwordUsername", "The bank takes a new password that contains the username", uses(/^bank\.(auth\.changePassword|recover\.resetPassword|password\.change|registration\.complete)$/)],
    ["passwordCommon", "The bank takes a new password with a common word in it", uses(/^bank\.(auth\.changePassword|recover\.resetPassword|password\.change|registration\.complete)$/)],
    ["passwordBreach", "The bank takes a new password that is in a known breach", uses(/^bank\.(auth\.changePassword|recover\.resetPassword|password\.change|registration\.complete)$/)],
    ["passwordReuse", "The bank takes a new password the person used before", uses(/^bank\.(auth\.changePassword|recover\.resetPassword|password\.change|registration\.complete)$/)],
    ["deviceLimit", "The bank trusts more than five devices", uses(/^bank\.auth\.trustDevice$/)],
    ["pinRules", "The bank takes a quick PIN that is easy to guess or part of the phone number", uses(/^bank\.(auth\.setQuickSignIn|devices\.(setQuickSignIn|changePin))$/)],
    // Settings > Security: the step-up before a change, the code and the current password or PIN as proof, the device in hand, the PIN lock
    ["stepUpGate", "The bank lets a security change through without a recent step-up", uses(/^bank\.(password\.(check|change)|devices\.(remove|changePin|setQuickSignIn)|device\.setDefault)$/)],
    ["changeNeedsCode", "The bank changes the password without the one-time code", uses(/^bank\.password\.change$/)],
    ["currentPassword", "The bank changes the password without the current one having been checked", uses(/^bank\.password\.change$/)],
    ["passwordSame", "The bank takes the password the person has now as the new one", uses(/^bank\.password\.(change|policy)$/)],
    ["removeNeedsCode", "The bank removes a device without the one-time code", uses(/^bank\.devices\.remove$/)],
    ["currentDeviceKept", "The bank lets the device in hand be removed", uses(/^bank\.devices\.remove$/)],
    ["quickNeedsCode", "The bank turns quick sign-in on without the one-time code", uses(/^bank\.devices\.setQuickSignIn$/)],
    ["pinLockOff", "The bank never turns quick sign-in off after wrong PINs", uses(/^bank\.devices\.verifyPin$/)],
    ["currentPin", "The bank changes the PIN without the current one having been checked", uses(/^bank\.devices\.changePin$/)],
    ["pinSame", "The bank takes the PIN the person has now as the new one", uses(/^bank\.devices\.changePin$/)],
    // Personal: Accounts. The total and what leaves it, the names, hiding, closing, reporting a problem, the list of transactions, opening an account
    ["totalHidden", "The bank counts the accounts the customer hid in the total", uses(/^bank\.accounts\.overview$/)],
    ["totalFx", "The bank counts the foreign currency accounts in the total when the bank leaves them out", uses(/^bank\.accounts\.overview$/)],
    ["lastVisible", "The bank lets the last visible account be hidden", uses(/^bank\.accounts\.setHidden$/)],
    ["nameRules", "The bank takes an account name that is too short, too long or has odd characters", uses(/^bank\.accounts\.(rename|open)$/)],
    ["nameTaken", "The bank takes an account name another account already has", uses(/^bank\.accounts\.(rename|open)$/)],
    ["closeHolds", "The bank closes an account that has card payments on hold", uses(/^bank\.accounts\.requestClosure$/)],
    ["closeOverdrawn", "The bank closes an overdrawn account", uses(/^bank\.accounts\.requestClosure$/)],
    ["closeNeedsCode", "The bank takes a closure request without the one-time code", uses(/^bank\.accounts\.requestClosure$/)],
    ["reportPending", "The bank takes any reason on a payment that is still pending", uses(/^bank\.accounts\.reportProblem$/)],
    ["reportDuplicate", "The bank takes a second report on the same payment", uses(/^bank\.accounts\.reportProblem$/)],
    ["reportOutgoing", "The bank takes a report on a payment received", uses(/^bank\.accounts\.reportProblem$/)],
    ["txFilter", "The bank ignores the search and the direction of a list of transactions", uses(/^bank\.accounts\.transactions$/)],
    ["pendingFirst", "The bank lists pending items among the others", uses(/^bank\.accounts\.transactions$/)],
    ["accountLimit", "The bank lets a customer hold more than six accounts", uses(/^bank\.accounts\.open$/)],
    ["openNeedsCode", "The bank opens an account without the one-time code", uses(/^bank\.accounts\.open$/)],
    // statements, letters and certificates
    ["statementDates", "The bank takes dates that are the wrong way round, before the account opened or too far apart", uses(/^bank\.statements\.(prepare|deliver|issue)$/)],
    ["statementEmpty", "The bank issues a statement for a period with no transactions", uses(/^bank\.statements\.(prepare|deliver|issue)$/)],
    ["feeFunds", "The bank takes a fee the account cannot pay", uses(/^bank\.statements\.(prepare|issue)$/)],
    ["feeConvert", "The bank takes the fee in dollars from an account in another currency", uses(/^bank\.statements\.(prepare|issue)$/)],
    ["issueNeedsCode", "The bank issues an official document without the one-time code", uses(/^bank\.statements\.issue$/)],
    ["letterDormant", "The bank issues a proof of address letter for a dormant account", uses(/^bank\.statements\.(prepare|issue)$/)],
    // budgets
    ["budgetAmount", "The bank takes a budget below 10.00, above 100,000.00 or with odd decimals", uses(/^bank\.budgets\.(create|update)$/)],
    ["budgetDuplicate", "The bank takes a second budget for a category", uses(/^bank\.budgets\.create$/)],
    ["budgetChips", "The bank says On track whatever has been spent", uses(/^bank\.budgets\.list$/)],
    // Personal: Cards. What state a card has to be in, the code to loosen it, limits and trips, activation, virtual cards, replacing, the PIN, reporting a payment, saving another bank's card
    ["cardState", "The bank freezes, changes or gives a PIN to a card that is not active (not activated, blocked, expired)", uses(/^bank\.cards\.(freeze|block|controls\.update|pin\.set)$/)],
    ["unfreezeCode", "The bank unfreezes a card without the one-time code", uses(/^bank\.cards\.unfreeze$/)],
    ["loosenCode", "The bank loosens a card (unfreezing, a higher limit, a control turned on, a trip) without the one-time code", uses(/^bank\.cards\.controls\.update$/)],
    ["limitRules", "The bank takes a limit that is negative or has odd decimals, or out of order (per transaction above daily, daily above monthly)", uses(/^bank\.cards\.controls\.update$/)],
    ["limitCeiling", "The bank takes a limit above the ceiling of the card", uses(/^bank\.cards\.controls\.update$/)],
    ["tripRules", "The bank takes a trip with dates out of order, longer than 90 days or outside today to 120 days ahead", uses(/^bank\.cards\.controls\.update$/)],
    ["alertRules", "The bank takes an alert amount below 1.00 or above 100,000.00", uses(/^bank\.cards\.controls\.update$/)],
    ["activateMatch", "The bank activates a card whatever details are given", uses(/^bank\.cards\.(verifyActivation|activate)$/)],
    ["activateLock", "The bank never locks activation after three wrong tries", uses(/^bank\.cards\.(verifyActivation|activate)$/)],
    ["virtualCap", "The bank lets a card have more than five virtual cards", uses(/^bank\.cards\.virtual\.create$/)],
    ["virtualRange", "The bank takes a virtual card limit below 1.00, above 5,000.00 or with odd decimals", uses(/^bank\.cards\.virtual\.create$/)],
    ["virtualCode", "The bank makes a virtual card without the one-time code", uses(/^bank\.cards\.virtual\.create$/)],
    ["virtualParent", "The bank links a virtual card to a card that is not active or is itself virtual", uses(/^bank\.cards\.virtual\.create$/)],
    ["lostBlocked", "The bank orders a replacement for a lost or stolen card that is still working", uses(/^bank\.cards\.replace$/)],
    ["replaceFee", "The bank takes no fee for express delivery", uses(/^bank\.cards\.replace(\.check)?$/)],
    ["replaceCode", "The bank orders a replacement without the one-time code", uses(/^bank\.cards\.replace$/)],
    ["replaceFunds", "The bank takes the delivery fee from an account that cannot pay it", uses(/^bank\.cards\.replace(\.check)?$/)],
    ["replaceOnce", "The bank takes a second replacement order while one is on its way", uses(/^bank\.cards\.replace(\.check)?$/)],
    ["replaceEligible", "The bank replaces a card that was already replaced or never activated", uses(/^bank\.cards\.replace(\.check)?$/)],
    ["replaceExpired", "The bank takes Expired as a reason for a card that has not expired and has more than 60 days left", uses(/^bank\.cards\.replace(\.check)?$/)],
    ["replaceAddress", "The bank takes an address with no line, city or valid postcode", uses(/^bank\.cards\.replace(\.check)?$/)],
    ["pinCode", "The bank sets a PIN without the one-time code", uses(/^bank\.cards\.pin\.set$/)],
    ["pinStrength", "The bank takes a PIN that repeats a digit, runs, follows a pattern or is part of the card number or expiry", uses(/^bank\.cards\.(pin\.set|activate)$/)],
    ["disputeWindow", "The bank takes a report on a payment older than 120 days", uses(/^bank\.disputes\.(check|create)$/)],
    ["disputeOnce", "The bank takes a second report on the same payment", uses(/^bank\.disputes\.(check|create)$/)],
    ["disputeEligible", "The bank takes a report on a payment that is pending, was received or is not a card payment", uses(/^bank\.disputes\.(check|create)$/)],
    ["disputeDetails", "The bank takes a report without the details its reason asks for", uses(/^bank\.disputes\.create$/)],
    ["disputeBlock", "The bank does not block the card when the report asks it to", uses(/^bank\.disputes\.create$/)],
    ["cardNumber", "The bank takes a card number that is not digits, of a type it does not accept or the wrong length or check digit", uses(/^bank\.cards\.(check|add)$/)],
    ["cardExpiry", "The bank takes an expired card, a wrong format or an expiry too far ahead", uses(/^bank\.cards\.(check|add)$/)],
    ["cardCvv", "The bank takes a security code or a name on the card of the wrong form", uses(/^bank\.cards\.(check|add)$/)],
    ["cardPostcode", "The bank takes a billing postcode that does not follow the home market", uses(/^bank\.cards\.(check|add)$/)],
    ["cardDuplicate", "The bank saves the same card twice", uses(/^bank\.cards\.(check|add)$/)],
    ["cardLimit", "The bank lets a customer save more than five cards", uses(/^bank\.cards\.(check|add)$/)],
    ["cardVerify", "The bank saves a card before the code was right, and lets wrong codes go on after the third", uses(/^bank\.cards\.(verify|add)$/)],
    ["cardDecline", "The bank saves a card that the card network declined", uses(/^bank\.cards\.(check|add)$/)],
    // Personal: Save & Borrow. What pays and what receives, term deposits, goals, loans and their repayment, the funds, adding money from a card
    ["saveFunds", "The bank takes money from an account that does not hold it", uses(/^bank\.(deposits\.(quote|open)|goals\.contribute|loans\.(repay|settle)|funds\.buy)$/)],
    ["saveDebit", "The bank takes money from an account that is frozen", uses(/^bank\.(deposits\.(quote|open)|goals\.contribute|loans\.(repay|settle)|funds\.buy)$/)],
    ["saveCredit", "The bank pays money into an account that cannot receive it", uses(/^bank\.(deposits\.close|goals\.withdraw|loans\.apply|funds\.sell|deposit\.create)$/)],
    ["depositRange", "The bank takes a deposit below 1,000.00, above 250,000.00 or with odd decimals", uses(/^bank\.deposits\.(quote|open)$/)],
    ["depositTerm", "The bank takes a term that is not offered, a payout it does not know, and monthly interest when it is off", uses(/^bank\.deposits\.(quote|open|renew(\.quote)?)$/)],
    ["depositCode", "The bank opens, renews or closes a deposit without the one-time code", uses(/^bank\.deposits\.(open|renew|close)$/)],
    ["depositCharge", "The bank takes no early closure charge", uses(/^bank\.deposits\.close(\.quote)?$/)],
    ["depositEarly", "The bank closes a deposit early when early closure is off", uses(/^bank\.deposits\.close(\.quote)?$/)],
    ["goalLimit", "The bank lets a customer have more than ten goals", uses(/^bank\.goals\.(create|update)$/)],
    ["goalRules", "The bank takes a goal with a bad name, target, month or top-up", uses(/^bank\.goals\.(create|update)$/)],
    ["goalAmounts", "The bank takes less than 1.00 into or out of a goal, and more out than is saved", uses(/^bank\.goals\.(contribute|withdraw)$/)],
    ["withdrawOff", "The bank takes money out of a goal when that is off", uses(/^bank\.goals\.withdraw$/)],
    ["loanLimit", "The bank lets a customer have more than three loans", uses(/^bank\.loans\.(quote|eligibility|apply)$/)],
    ["loanRange", "The bank takes a loan amount out of range or step and a term it does not offer", uses(/^bank\.loans\.(quote|eligibility)$/)],
    ["loanIncome", "The bank lends to a student, someone not working, or income below 1,000.00", uses(/^bank\.loans\.eligibility$/)],
    ["loanAffordability", "The bank lends when payments are above 50% of income", uses(/^bank\.loans\.eligibility$/)],
    ["loanReferral", "The bank approves what should be reviewed (over 12 times income, self-employed or retired above the limit, payments above 40%), and declines nothing when referral is off", uses(/^bank\.loans\.eligibility$/)],
    ["loanRateRise", "The bank adds no point to the rate when payments are above 35% of income", uses(/^bank\.loans\.eligibility$/)],
    ["loanCode", "The bank makes a loan without the one-time code", uses(/^bank\.loans\.apply$/)],
    ["loanOffer", "The bank makes a loan that it did not offer", uses(/^bank\.loans\.apply$/)],
    ["repayRange", "The bank takes another amount below 10.00 or at the whole balance", uses(/^bank\.loans\.repay$/)],
    ["repayPrincipal", "The bank takes the whole instalment off the balance instead of its principal part", uses(/^bank\.loans\.repay$/)],
    ["repayDate", "The bank moves the due date for any payment, not only from one instalment", uses(/^bank\.loans\.repay$/)],
    ["settleFee", "The bank charges the settlement fee when fewer than 13 payments are left or it is off", uses(/^bank\.loans\.(get|settlement\.quote|settle)$/)],
    ["settleInterest", "The bank leaves the interest since the last payment out of the settlement", uses(/^bank\.loans\.(get|settlement\.quote|settle)$/)],
    ["repayCode", "The bank takes a loan payment without the one-time code", uses(/^bank\.loans\.(repay|settle)$/)],
    ["fundMinimum", "The bank takes less than the smallest amount of a fund", uses(/^bank\.funds\.buy$/)],
    ["fundHigh", "The bank sells high-risk funds when they are off", uses(/^bank\.funds\.buy$/)],
    ["investCode", "The bank buys a fund without the one-time code", uses(/^bank\.funds\.buy$/)],
    ["sellRange", "The bank takes a sale below 10.00 or above the value of the holding", uses(/^bank\.funds\.sell$/)],
    ["sellFee", "The bank takes no selling fee", uses(/^bank\.funds\.sell$/)],
    ["sellCode", "The bank sells a holding without the one-time code", uses(/^bank\.funds\.sell$/)],
    ["sellSettle", "The bank says the money arrives on the day of the sale instead of two business days later", uses(/^bank\.funds\.sell$/)],
    ["topupRange", "The bank takes a card top-up below 10.00, above 5,000.00 or with odd decimals", uses(/^bank\.deposit\.create$/)],
    ["topupCard", "The bank takes an expired card and one the network declined", uses(/^bank\.deposit\.create$/)],
    ["topupFee", "The bank takes no card fee", uses(/^bank\.deposit\.create$/)],
    ["topupCode", "The bank charges a card without the one-time code", uses(/^bank\.deposit\.create$/)],
    ["topupCvv", "The bank takes a security code that is not 3 digits", uses(/^bank\.deposit\.create$/)],
    // Personal: More. Contact details, secure messages, service requests and the banks a customer connects
    ["contactCode", "The bank changes a contact detail without the one-time code", uses(/^bank\.profile\.update$/)],
    ["contactRules", "The bank takes a mobile number, an email, a postal code or an address that does not follow the rules of its home market", uses(/^bank\.profile\.(update|sendContactCode|verifyContact)$/)],
    ["contactSame", "The bank takes the number or email the customer already has, an address that does not differ, or a number or email that belongs to someone else", uses(/^bank\.profile\.(update|sendContactCode)$/)],
    ["contactPending", "The bank takes a second change to an item that already waits to be confirmed", uses(/^bank\.profile\.update$/)],
    ["contactNewNumber", "The bank saves a new mobile number before the code sent to it was right, and lets wrong codes go on after the third", uses(/^bank\.profile\.(update|verifyContact)$/)],
    ["contactProof", "The bank takes an address change without the proof of address it asks for, or with a file that is not a PDF, JPG or PNG", uses(/^bank\.profile\.update$/)],
    ["contactNotify", "The bank tells neither the old contact nor the new one about a change", uses(/^bank\.profile\.update$/)],
    ["messageRules", "The bank takes a message without a topic, with a short subject or text, or with text that is too long", uses(/^bank\.messages\.send$/)],
    ["messageFile", "The bank takes an attachment that is not a PDF, JPG or PNG or is over 5 MB", uses(/^bank\.messages\.send$/)],
    ["replyRules", "The bank takes a reply that is empty or too long, and a reply to a conversation that is closed", uses(/^bank\.messages\.reply$/)],
    ["requestRules", "The bank takes a service request with the fields of its kind missing or wrong, and a lost card as a request", uses(/^bank\.requests\.create$/)],
    ["requestDuplicate", "The bank takes a second cheque book request for an account that has one open", uses(/^bank\.requests\.create$/)],
    ["requestTypeChange", "The bank offers, and takes, the account type the account already has", uses(/^bank\.requests\.(options|create)$/)],
    ["requestCancel", "The bank cancels a request that has already started", uses(/^bank\.requests\.cancel$/)],
    ["requestOptions", "The bank takes a kind of request that it switched off", uses(/^bank\.requests\.(options|create)$/)],
    ["connectConsent", "The bank connects accounts without the customer having agreed to share", uses(/^bank\.connections\.finish$/)],
    ["connectBank", "The bank connects a bank that is already connected, and one that is not answering", uses(/^bank\.connections\.(start|finish)$/)],
    ["connectPick", "The bank connects with no account chosen", uses(/^bank\.connections\.finish$/)],
    ["connectPeriod", "The bank shares for 365 days whatever the market, and shows every amount with the dollar sign", uses(/^bank\.connections\.(banks|start|finish)$/)],
    ["connectReadOnly", "The bank lets a connected account be one the customer can pay from", uses(/^bank\.connections\.finish$/)],
    // Before sign-in: the loan and deposit tables, the places, the ways to reach the bank, opening an account, tracking an application and registering for digital banking
    ["pubLoanRange", "The bank quotes a loan amount, step or term outside the table of its loan type", uses(/^bank\.rates\.loans$/)],
    ["pubLoanFormula", "The bank adds the interest of a loan in a lump (rate times years) instead of working it month by month", uses(/^bank\.rates\.loans$/)],
    ["pubDepositRate", "The bank pays the 12-month rate whatever the term", uses(/^bank\.rates\.deposits$/)],
    ["pubDepositRange", "The bank takes a deposit outside 500 to 100,000 or off the step of 500", uses(/^bank\.rates\.deposits$/)],
    ["pubDepositFormula", "The bank pays a full year of interest whatever the term", uses(/^bank\.rates\.deposits$/)],
    ["pubSymbol", "The bank shows every amount with the dollar sign whatever its home market", uses(/^bank\.rates\.(loans|deposits)$/)],
    ["pubTermText", "The bank writes every term in months", uses(/^bank\.rates\.(loans|deposits)$/)],
    ["pubPlaceHours", "The bank says every place is open, whatever its hours and the clock", uses(/^bank\.locations\.(search|details)$/)],
    ["pubPlaceSort", "The bank lists places by name, not nearest first", uses(/^bank\.locations\.search$/)],
    ["pubPlaceUnit", "The bank shows every distance in kilometres, whatever its market", uses(/^bank\.locations\.(search|details)$/)],
    ["pubPlaceAtm", "The bank lists cash machines when it shows none", uses(/^bank\.locations\.search$/)],
    ["pubPlaceOpen", "The bank lists places that are closed when only those open now are asked for", uses(/^bank\.locations\.search$/)],
    ["pubPlaceSearch", "The bank ignores the words typed in the search", uses(/^bank\.locations\.search$/)],
    ["pubSupportHours", "The bank says every way to reach it is open", uses(/^bank\.support\.hours$/)],
    ["pubSupportWays", "The bank offers chat and call when it switched them off", uses(/^bank\.support\.hours$/)],
    ["pubSupportRules", "The bank takes a chat or a message with no topic, a short text, a long text or an email that is not one", uses(/^bank\.support\.(openChat|sendMessage)$/)],
    ["pubSupportRate", "The bank takes any number of messages from one device in an hour", uses(/^bank\.support\.sendMessage$/)],
    ["pubOnbContact", "The bank starts an application with an email that is not an email", uses(/^bank\.onboarding\.start$/)],
    ["pubOnbDuplicate", "The bank starts a second application for a mobile or an email that has one", uses(/^bank\.onboarding\.start$/)],
    ["pubOnbVerified", "The bank checks, saves or sends an application before the mobile number was verified with the code", uses(/^bank\.onboarding\.(check|save|verifyIdentity|submit)$/)],
    ["pubOnbAge", "The bank takes a date of birth that is in the future, over 110 years ago or under 18", uses(/^bank\.onboarding\.(check|verifyIdentity|submit)$/)],
    ["pubOnbId", "The bank takes a national ID number that is not in the format of its market", uses(/^bank\.onboarding\.(check|submit)$/)],
    ["pubOnbPoa", "The bank takes a proof of address that is older than 3 months", uses(/^bank\.onboarding\.check$/)],
    ["pubOnbPhotos", "The bank takes an ID it cannot read or that has expired, and a selfie that is dark or not live", uses(/^bank\.onboarding\.(check|verifyIdentity)$/)],
    ["pubOnbMatch", "The bank takes an ID whose details do not match what was entered (the birth year of a Market D ID number)", uses(/^bank\.onboarding\.verifyIdentity$/)],
    ["pubOnbTax", "The bank takes a tax declaration without a country and a tax ID, or a tax ID in the wrong shape", uses(/^bank\.onboarding\.(check|submit)$/)],
    ["pubOnbPostcode", "The bank takes a postcode that is not in the right shape", uses(/^bank\.onboarding\.(check|submit)$/)],
    ["pubOnbConsent", "The bank takes an application without both ticks and the signature", uses(/^bank\.onboarding\.submit$/)],
    ["pubOnbReview", "The bank sends income over 1M to the checks like any other application", uses(/^bank\.onboarding\.submit$/)],
    ["pubOnbKeep", "The bank keeps the photos' references, the file and the code in a saved application", uses(/^bank\.onboarding\.save$/)],
    ["pubOnbExpiry", "The bank keeps a saved application for ever", uses(/^bank\.onboarding\.begin$/)],
    ["pubOnbProduct", "The bank takes an account it does not offer", uses(/^bank\.onboarding\.submit$/)],
    ["pubTrackMatch", "The bank finds an application by its number alone", uses(/^bank\.applications\.find$/)],
    ["pubTrackLock", "The bank never locks the tracker after wrong tries", uses(/^bank\.applications\.find$/)],
    ["pubTrackCode", "The bank shows the status of an application without the one-time code", uses(/^bank\.applications\.status$/)],
    ["pubRegMatch", "The bank finds a customer by the customer ID alone, whatever the date of birth", uses(/^bank\.registration\.verify$/)],
    ["pubRegAlready", "The bank registers a customer who is already registered", uses(/^bank\.registration\.verify$/)],
    ["pubRegLock", "The bank never locks the registration after wrong checks and codes", uses(/^bank\.registration\.verify$/)],
    ["pubRegCode", "The bank makes the profile before the one-time code was right", uses(/^bank\.registration\.complete$/)],
    ["pubRegUsername", "The bank takes a username that is taken or not in the shape", uses(/^bank\.registration\.complete$/)],
    ["pubRegCard", "The bank takes a card number when it switched that off", uses(/^bank\.registration\.verify$/)],
    ["pubRegTrust", "The bank trusts the device when it does not offer that", uses(/^bank\.registration\.complete$/)],
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
    // a journey that opens itself again (Continue now, in open-account) must meet its own broken copy there, not the shipped one
    const worlds = m.journey ? journeys.map((x) => (x.slug === journey.slug ? target! : x)) : journeys;
    try { report = await runScenarios(target, { flaws: m.flaws, journeys: worlds }); } catch { results.push({ id: m.id, what: m.what, kind: m.kind, killed: true, caughtBy: ["(the broken journey could not run)"] }); continue; }
    const caught = report.results.filter((r) => !r.ok).map((r) => r.id);
    results.push({ id: m.id, what: m.what, kind: m.kind, killed: caught.length > 0, caughtBy: caught });
  }
  const alive = results.filter((r) => !r.killed);
  const survived = alive.filter((r) => !(r.id in accepted));
  const ok = alive.filter((r) => r.id in accepted).map((r) => ({ ...r, reason: accepted[r.id]! }));
  return { ok: survived.length === 0, total: results.length, killed: results.length - alive.length, survived, accepted: ok, results };
}
