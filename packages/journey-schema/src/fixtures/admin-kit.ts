import type { Journey } from "../schema";
import { steps } from "./business-kit";

/**
 * What the scenarios of the Business Admin journeys (admin, manage-user, change-limits, edit-signatory-group) share: the clock the spec pins (Tuesday 3 November 2026, 10:42 UTC), Alex at a
 * company with the administrator preview on (Ravi at Alpha, Noor at Beta: Alex is never an administrator himself), a wrong code, and the steps every scenario is written with.
 */
export const NOW = "2026-11-03T10:42:00Z";
export const PREVIEW = { adapter: "bank.session.preview", input: { on: true } };
/** Alex at Alpha as its administrator (the preview), and at Beta; and Alex with no preview: a Maker at Alpha, an Approver at Beta. */
export const ravi = { persona: "alex", context: "alpha", now: NOW, setup: [PREVIEW] };
export const noor = { persona: "alex", context: "beta", now: NOW, setup: [PREVIEW] };
export const maker = { persona: "alex", context: "alpha", now: NOW };
export const approver = { persona: "alex", context: "beta", now: NOW };
/** The sandbox's one-time code, and a code that is wrong. */
export const CODE = "482100";
export const WRONG = "111111";

export type Scenario = NonNullable<Journey["scenarios"]>[number];
export const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
export const { press, text, noText, screen, set, error, opens, refuses, bank } = steps;
/** What the bank holds about the company's people, limits, groups and waiting changes, read as the administrator. */
export const view = (path: string, equals: unknown) => bank("corp.admin.get", path, equals);
export const limits = (path: string, equals: unknown) => bank("corp.limits.get", path, equals);
export const group = (g: "over" | "upto", path: string, equals: unknown) => bank("corp.signatories.get", path, equals, { group: g });
/** What was sent and written (never a value), read by the sandbox for scenarios. */
export const inspect = (path: string, equals: unknown) => bank("corp.sandbox.arrange", path, equals, { op: "admInspect" });
export const wrongCodes = (button: string): Record<string, unknown>[] => [set({ "otp.code": WRONG }), press(button), set({ "otp.code": WRONG }), press(button), set({ "otp.code": WRONG }), press(button)];
