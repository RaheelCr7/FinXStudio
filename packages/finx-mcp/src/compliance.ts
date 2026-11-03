import { MOVES_MONEY, type Journey } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import type { ProviderId } from "@finx/mock-bank-api";
import { runScenarios, type ScenarioReport } from "./scenarios";

/**
 * The compliance panel's evidence for one journey, computed from the journey itself: the rules a bank's reviewers ask about money
 * (consent, one-time code, who may use it, failure messages, translations), and the trace from each acceptance criterion to the
 * scenarios that prove it and the screens they go through. It is evidence for a person to review, not a certification.
 */
export type CheckStatus = "pass" | "fail" | "n/a";
export type ComplianceCheck = { id: string; title: string; status: CheckStatus; detail: string; screens: string[] };
export type TraceRow = {
  id: string; text: string; scenarios: string[];
  /** per bank API: proved, failing or uncovered */
  banks: Record<string, "proved" | "failing" | "uncovered">;
  screens: { id: string; title: string }[];
};
export type ComplianceReport = {
  slug: string; version: number;
  movesMoney: boolean;
  checks: ComplianceCheck[];
  trace: TraceRow[];
  /** screens no acceptance criterion's scenarios ever reach: behaviour nobody asked for or nothing proves */
  untraced: { id: string; title: string }[];
  summary: { pass: number; fail: number; na: number; criteria: number; proved: number };
};

const titleOf = (s: any): string => (typeof s.title === "string" ? s.title : s.title?.en ?? s.id);
const eachAction = (j: Journey, fn: (a: any, screen: string) => void) => {
  for (const s of j.screens as any[]) {
    for (const a of s.onEnter ?? []) fn(a, s.id);
    for (const b of s.blocks) {
      for (const a of b.actions ?? []) fn(a, s.id);
      for (const a of b.onResend ?? []) fn(a, s.id);
      for (const it of b.items ?? []) for (const a of it.actions ?? []) fn(a, s.id);
      for (const a of b.item?.actions ?? []) fn(a, s.id);
    }
  }
};

export async function complianceReport(journey: Journey, banks: ProviderId[] = ["reference", "bank-b"]): Promise<ComplianceReport> {
  const issues = lintAll(journey);
  const by = (...codes: string[]) => issues.filter((i) => codes.includes(i.code));
  const movesMoney = journey.integrations.some((i) => MOVES_MONEY.test(i.adapter));
  const corporate = journey.integrations.some((i) => i.adapter.startsWith("corp."));
  const checks: ComplianceCheck[] = [];
  const add = (id: string, title: string, applies: boolean, bad: { message: string; screen?: string }[], ok: string) =>
    checks.push({ id, title, status: !applies ? "n/a" : bad.length ? "fail" : "pass", detail: !applies ? "Does not apply to this journey" : bad.length ? bad.map((b) => b.message).join("; ") : ok, screens: [...new Set(bad.flatMap((b) => (b.screen ? [b.screen] : [])))] });

  add("consent", "The customer confirms before money moves", movesMoney, by("consent_before_submit"), "A confirmation block is on the way to the money-moving call");
  add("otp", "A one-time code is verified before money moves", movesMoney, by("otp_before_money"), "The code is checked before the money-moving call");

  // a money-moving call with no error path leaves the customer on a screen that does nothing when the bank refuses
  const silent: { message: string; screen?: string }[] = [];
  eachAction(journey, (a, screen) => {
    const integ = journey.integrations.find((i) => i.id === a.integration);
    if (a.type === "callApi" && integ && MOVES_MONEY.test(integ.adapter) && !a.onError) silent.push({ message: `${integ.adapter} has no error path`, screen });
  });
  add("failure-paths", "A refusal from the bank is explained to the customer", movesMoney, silent, "Every money-moving call has an error path");

  add("authorisation", "Only the right role can use it", corporate, by("authorisation_missing", "authorisation_denied_missing"), "The journey names the role and sends everyone else to a denied screen");
  add("currency", "Every amount has a currency", true, by("amount_no_currency", "amount_currency_invalid", "currency_mismatch", "mixed_currency"), "Amounts carry one declared currency");
  add("translations", "Every text is translated", true, by("translation_gap"), `All texts exist in ${journey.locale.supported.join(", ")}`);
  const other = issues.filter((i) => !["consent_before_submit", "otp_before_money", "authorisation_missing", "authorisation_denied_missing", "amount_no_currency", "amount_currency_invalid", "currency_mismatch", "mixed_currency", "translation_gap"].includes(i.code));
  add("lint", "No other lint findings (reachability, data, references)", true, other, "The journey is lint clean");

  // the trace: criteria to scenarios to screens, on every bank API the journey runs on
  const reports: Record<string, ScenarioReport> = {};
  for (const p of corporate ? banks : [banks[0]!]) reports[p] = await runScenarios(journey, { provider: p });
  const criteria = journey.acceptance ?? [];
  const screenOf = new Map((journey.screens as any[]).map((s) => [s.id, titleOf(s)]));
  const first = Object.values(reports)[0];
  const trace: TraceRow[] = criteria.map((c) => {
    const mine = (first?.results ?? []).filter((r) => r.covers.includes(c.id));
    const visited = [...new Set(mine.flatMap((r) => r.visited))];
    return {
      id: c.id, text: c.text, scenarios: mine.map((r) => r.id),
      banks: Object.fromEntries(Object.entries(reports).map(([p, r]) => [p, r.coverage.find((x) => x.id === c.id)?.status ?? "uncovered"])),
      screens: visited.map((id) => ({ id, title: screenOf.get(id) ?? id })),
    };
  });
  const touched = new Set(trace.flatMap((t) => t.screens.map((s) => s.id)));
  const untraced = journey.screens.filter((s) => !touched.has(s.id)).map((s) => ({ id: s.id, title: titleOf(s) }));
  const proved = trace.filter((t) => Object.values(t.banks).every((b) => b === "proved")).length;
  checks.push({
    id: "proof", title: "Every acceptance criterion is proved by a passing test", status: !criteria.length ? "n/a" : proved === criteria.length ? "pass" : "fail",
    detail: !criteria.length ? "The journey carries no acceptance criteria" : `${proved} of ${criteria.length} criteria proved on ${Object.keys(reports).join(" and ")}`,
    screens: [],
  });
  return {
    slug: journey.slug, version: journey.version, movesMoney, checks, trace, untraced,
    summary: { pass: checks.filter((c) => c.status === "pass").length, fail: checks.filter((c) => c.status === "fail").length, na: checks.filter((c) => c.status === "n/a").length, criteria: criteria.length, proved },
  };
}
