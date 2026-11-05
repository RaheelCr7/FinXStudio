import type { Block, Screen } from "../schema";
import { alert, button, go, route, set, text } from "./security-kit";

export { alert, button, go, route, set, text };

/** One tappable row in the flow of the screen (a button is drawn in the footer, away from what it belongs to): a label, a line under it, and what it does. */
export const row = (id: string, label: string, line: string, actions: any[], visibleWhen?: string): Block => ({ type: "menu", ...(visibleWhen ? { visibleWhen } : {}), items: [{ id, label, text: line, actions }] });

/**
 * The small pieces the Accounts journeys (accounts, account-details, statement, open-another-account, create-budget, budgets, transfer-types) are built
 * from, so each file says what is its own and they cannot drift apart on the permissions and the words of a failure.
 */

/** The place has no list of permissions (the picker, a bank without them) or it holds this one: the bank decides what a screen does not. */
export const holds = (permission: string) => `(isEmpty(session.permissions) || has(session.permissions, '${permission}'))`;
/** A place that has permissions but not this one is sent to `denied`. */
export const lacks = (permission: string) => `!isEmpty(session.permissions) && !has(session.permissions, '${permission}')`;

export const SORRY = "This isn’t available right now. Nothing was changed. Try again in a few minutes.";
export const SLOW = "This is taking longer than expected. Nothing was changed.";

/** The screen a person without the permission lands on. */
export const denied = (title: string): Screen => ({
  id: "denied", title, kind: "terminal",
  blocks: [{ type: "result", tone: "error", title: "Not available", text: "This isn’t available for your profile." }, button("Done", [{ type: "exit" }])],
});

/**
 * The words for a failed bank call that has no screen of its own: the bank did not answer, or it answered something unexpected. `retry` is the screen
 * "Try again" returns to. A journey that moves money says so; the rest only say nothing was changed.
 */
export const problem = (title: string, retry: string, money = false): Screen => ({
  id: "problem", title,
  blocks: [
    alert("error", SORRY, "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
    alert("error", SLOW, "ctx.error.code == 'TIMEOUT'"),
    alert("error", `Something went wrong. ${money ? "No money has left your account." : "Nothing was changed."}`, "ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'TIMEOUT'"),
    button("Try again", [go(retry)]),
    button("Done", [{ type: "exit" }], "ghost"),
  ],
});
