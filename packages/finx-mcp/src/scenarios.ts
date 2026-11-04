import type { Journey } from "@finx/journey-schema";
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

type Overrides = { flaws?: Flaws; provider?: ProviderId };

export async function runScenarios(journey: Journey, over: Overrides = {}): Promise<ScenarioReport> {
  const results: ScenarioResult[] = [];
  for (const t of journey.scenarios ?? []) {
    const opts: SimOptions = {
      journey, persona: t.persona, lang: t.lang ?? journey.locale.default, steps: t.steps as unknown as Step[],
      provider: (over.provider ?? (t.provider as ProviderId | undefined)), now: t.now ? Date.parse(t.now) : undefined,
      setup: t.setup as SimOptions["setup"], flaws: over.flaws, conditions: t.conditions,
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
  const calls = (name: string) => journey.integrations.some((i) => i.adapter === `corp.payments.${name}` || (name === "initiate" && /^corp\.(bulk|payroll)\.(check|submit)$/.test(i.adapter)));
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
    ["lineChecks", "The bank accepts every row of a bulk file without checking it", bulk],
    ["employeeChecks", "The bank pays anyone, and any amount, on a payroll file", payroll],
    ["payrollPeriod", "The bank takes any pay period and lets a period be paid twice", payroll],
    // a retail customer's own accounts: the rules of moving and converting money between them
    ["sameAccount", "The bank lets money move from an account to itself", uses(/^bank\.transfers\.own$/)],
    ["canDebit", "The bank lets an account that is frozen send money", uses(/^bank\.(transfers\.own|fx\.quote)$/)],
    ["funds", "The bank lets an account send more than it has", uses(/^bank\.(transfers\.own|fx\.(quote|convert))$/)],
    ["quoteExpiry", "The bank converts at a rate that has run out", uses(/^bank\.fx\.convert$/)],
    ["quoteReplay", "The bank lets one rate be used twice", uses(/^bank\.fx\.convert$/)],
  ];
  const rules = all.filter(([, , reachable]) => reachable).map(([k, what]) => [k, what] as [keyof Flaws, string]);
  return rules.map(([k, what]) => ({ id: `bank-${k}`, what, kind: "bank" as const, flaws: { [k]: false } as Flaws }));
}

/**
 * `accepted` lists mutants the tests do not catch on purpose, each with the reason (for example another layer already stops it,
 * so the screen can never reach the broken rule). A survivor that is not accepted fails the check.
 */
export async function mutationCheck(journey: Journey, accepted: Record<string, string> = {}): Promise<MutationReport> {
  const mutants = [...journeyMutants(journey), ...bankMutants(journey)];
  const results: MutantResult[] = [];
  for (const m of mutants) {
    let target: Journey | null = journey;
    if (m.journey) target = m.journey(journey);
    if (!target) continue;
    let report;
    try { report = await runScenarios(target, { flaws: m.flaws }); } catch { results.push({ id: m.id, what: m.what, kind: m.kind, killed: true, caughtBy: ["(the broken journey could not run)"] }); continue; }
    const caught = report.results.filter((r) => !r.ok).map((r) => r.id);
    results.push({ id: m.id, what: m.what, kind: m.kind, killed: caught.length > 0, caughtBy: caught });
  }
  const alive = results.filter((r) => !r.killed);
  const survived = alive.filter((r) => !(r.id in accepted));
  const ok = alive.filter((r) => r.id in accepted).map((r) => ({ ...r, reason: accepted[r.id]! }));
  return { ok: survived.length === 0, total: results.length, killed: results.length - alive.length, survived, accepted: ok, results };
}
