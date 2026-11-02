import type { Journey, LintIssue } from "@finx/journey-schema";
import { ADAPTER_CATALOG } from "@finx/mock-bank-api";
import { lintAll } from "@finx/renderer-core";

const KNOWN = new Set(ADAPTER_CATALOG.map((a) => a.adapter));

/** Blocking problems: everything Studio refuses to publish on, plus integrations that do not exist in the sandbox. */
export function lintForAgent(j: Journey): LintIssue[] {
  const issues = lintAll(j);
  for (const i of j.integrations) {
    if (!KNOWN.has(i.adapter)) issues.push({ code: "unknown_adapter", message: `Integration "${i.id}" uses adapter "${i.adapter}", which does not exist. Use one from finx_get_catalog (adapters).` });
    if (i.adapter === "bank.otp.verify" && i.id !== "otpVerify") issues.push({ code: "otp_verify_name", message: `The integration for bank.otp.verify must be named "otpVerify". The engine only counts failed OTP attempts (lockAfter) for that name.` });
  }
  return issues;
}

/** Non-blocking suggestions that make a journey safer or nicer. */
export function adviceFor(j: Journey): string[] {
  const out: string[] = [];
  for (const s of j.screens) {
    const actions: any[] = [...(s.onEnter ?? [])];
    for (const b of s.blocks as any[]) if (b.type === "button") actions.push(...b.actions);
    for (const a of actions) if (a.type === "callApi" && !a.onError) out.push(`Screen "${s.id}": callApi "${a.integration}" has no onError, so a failure would break the journey. Add onError (show a message, or navigate to a failed screen).`);
    if (s.kind !== "terminal" && !(s.blocks as any[]).some((b) => b.type === "button")) out.push(`Screen "${s.id}" has no button, so the customer cannot leave it.`);
  }
  if (j.screens.length > 10) out.push(`The journey has ${j.screens.length} screens. Aim for 3 to 8 so customers finish it.`);
  const moves = j.integrations.some((i) => ADAPTER_CATALOG.find((a) => a.adapter === i.adapter)?.moneyMoving);
  if (moves && !j.screens.some((s) => s.kind === "terminal" && (s.blocks as any[]).some((b) => b.type === "result" && b.tone === "error"))) out.push("A money-moving journey should end in a failed screen (terminal, with an error result) that says no money has left the account.");
  for (const s of j.screens) for (const b of s.blocks as any[]) {
    if (b.type === "textInput" && b.pattern && !b.patternMessage) out.push(`Screen "${s.id}": text input "${b.bind}" has a format but no patternMessage, so customers only see a generic "Invalid format". Add a patternMessage in English and Urdu.`);
  }
  const dm = j.dataModel ?? {};
  for (const s of j.screens) for (const b of s.blocks as any[]) {
    if (b.bind && ["amountInput", "textInput", "select", "accountPicker", "beneficiaryPicker", "otp"].includes(b.type) && dm[b.bind] && !dm[b.bind]!.required) out.push(`Screen "${s.id}": "${b.bind}" is not marked required in dataModel, so an empty value is accepted.`);
  }
  return [...new Set(out)];
}

/** Same journey apart from status and version. */
export function sameContent(a?: Journey, b?: Journey): boolean {
  if (!a || !b) return false;
  const strip = ({ status: _s, version: _v, ...rest }: Journey) => JSON.stringify(rest);
  return strip(a) === strip(b);
}
