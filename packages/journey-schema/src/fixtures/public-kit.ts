import type { Block, Screen } from "../schema";
import { alert, button, go, route, row, set, text } from "./accounts-kit";

export { alert, button, go, route, row, set, text };

/**
 * The small pieces the Public journeys (loan-calculator, deposit-calculator, find-branch-atm, contact-support, open-account, track-application, register-digital-banking) are
 * built from, so each file says what is its own and they cannot drift apart on the words of a failure. These journeys run before anyone signs in: none asks for a permission,
 * none moves money, and what a person types is data (a name, an ID number, an address, a message): every screen shows it as text and the bank keeps masks and hashes only.
 */

/** A row of a `menu` that is drawn only when a condition holds. */
export const note = (t: string, visibleWhen?: string): Block => text(t, "caption", visibleWhen);

/**
 * The two screens every Public journey has for a bank that did not answer: `timeout` (after 10 seconds) and `unavailable`. "Try again" goes back to where the person was:
 * `retry` is a screen, or a list of rules ([when, screen]) when it depends on what they were doing (the last rule is the fallback). `wipe` clears what the journey holds only for
 * the bank (a code, a password) on the way out.
 */
export function downScreens(opts: { retry: string | [string, string][]; unavailable: { title: string; text: string }; timeout: { title?: string; text: string }; wipe?: any[] }): Screen[] {
  const rules = Array.isArray(opts.retry) ? opts.retry : undefined;
  const again = button("Try again", rules ? [{ type: "navigate" }] : [go(opts.retry as string)]);
  const nav = rules ? { navigation: route(...rules.slice(0, -1).map(([when, to]) => [when, to] as [string, string]), ["true", rules[rules.length - 1]![1]]) } : {};
  const make = (id: "timeout" | "unavailable", title: string, body: string, heading: string): Screen => ({
    id, title, ...(opts.wipe ? { onEnter: opts.wipe } : {}), ...nav,
    blocks: [{ type: "result", tone: "error", title: heading, text: body }, again, button("Close", [{ type: "exit" }], "secondary")],
  } as Screen);
  return [
    make("timeout", "No answer in time", opts.timeout.text, opts.timeout.title ?? "This is taking longer than expected"),
    make("unavailable", "Service not available", opts.unavailable.text, opts.unavailable.title),
  ];
}

/** Where a failed bank call goes first: the bank did not answer in time, or it is not there. A journey adds its own codes before these. */
export const answerRules: [string, string][] = [["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"]];

/** The words of the sandbox's one-time code for every Public journey that asks for one: what a wrong, an expired and a spent code say. */
export const CODE_WORDS = {
  wrong: "That code isn’t right. Check the latest message and try again.",
  expired: "That code has expired. Ask for a new one.",
  limit: "You have asked for the maximum number of codes. Try again later.",
  resent: "New code sent. The old code no longer works.",
};

/** A day of the week row for an opening-hours card: label and the bank's own text for it. */
export const WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export const weekRows = (path: string) => WEEK.map((d) => ({ label: d[0]!.toUpperCase() + d.slice(1), value: `{{${path}.${d}}}` }));

/** The checklist line under a password: only the length can follow the typing (the engine cannot ask the bank on every key press); the other rules are checked by the bank. */
export const lengthLine = (path: string) => text(`{{len(${path}) >= 12 ? '✓' : '○'}} At least 12 characters`, "caption");
