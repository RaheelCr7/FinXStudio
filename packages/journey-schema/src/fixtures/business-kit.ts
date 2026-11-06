import type { Block, Screen } from "../schema";
import { alert, button, go, route, set, text } from "./security-kit";
import { holds, lacks, row } from "./accounts-kit";

export { alert, button, go, route, set, text, holds, lacks, row };

/**
 * The small pieces the Business journeys of the Accounts and Payments tabs (business-accounts, business-statement, add-supplier, payment-template,
 * templates, schedule-business-payment, business-schedules, withdraw-payment, payment-tracker) are built from, so each file says what is its own and the
 * nine cannot drift apart on the permissions and the words of a failure.
 */
export const toRoute = { navigate: "route" };
export const is = (...codes: string[]) => codes.map((c) => `ctx.error.code == '${c}'`).join(" || ");
export const NOW_DENIED = "ctx.error.code == 'PERMISSION_DENIED' || ctx.error.code == 'WRONG_CONTEXT'";

/** What a person reads when the bank did not answer or said no, in the words of the spec. */
export const WORDS = {
  slow: "This is taking longer than expected. Nothing was changed.",
  unavailable: "Nothing was sent and you haven’t been charged. Try again in a moment.",
  noAnswer: "We didn’t get an answer in time. Nothing was changed.",
};

export type FailOptions = {
  title: string;
  /** The integrations whose slow answer may mean the thing was done: they get the `timeout` screen with `timeoutText`; every other slow answer is `slow`. */
  effects?: string[];
  timeoutText?: string;
  /** Screens to send a person to for particular codes, before the generic `failed`: [when, screen]. */
  routes?: [string, string][];
  /** Where Try again goes for each integration (the screen it was called from); everything else goes to `start`. */
  retry?: [string, string][];
  /** Text of the unavailable sheet; the default says nothing was sent. */
  unavailable?: string;
  /** The `denied` words for a role without the permission. */
  denied?: string;
};

/** The screens every Business journey ends in when a bank call fails: route (the branch that picks), slow, timeout, unavailable, denied, failed and retry. */
export function failScreens(o: FailOptions): Screen[] {
  const effects = o.effects ?? [];
  const timeout: Screen[] = effects.length ? [    {
      // the thing may or may not have been done: say so, and send the person to check
      id: "timeout", title: o.title, kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn’t get an answer in time", text: o.timeoutText ?? WORDS.noAnswer },
        button("Close", [{ type: "exit" }]),
      ],
    }] : [];
  const when = effects.length ? effects.map((e) => `ctx.error.integration == '${e}'`).join(" || ") : "false";
  return [
    {
      id: "route", title: "One moment", kind: "branch",
      onEnter: [go("failed")],
      blocks: [],
      navigation: {
        rules: [
          ...(effects.length ? [{ when: `ctx.error.code == 'TIMEOUT' && (${when})`, to: "timeout" }] : []),
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: NOW_DENIED, to: "denied" },
          ...(o.routes ?? []).map(([w, to]) => ({ when: w, to })),
        ],
      },
    },
    ...timeout,
    {
      // a slow answer to a question that changes nothing: it is safe to ask again
      id: "slow", title: o.title, kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn’t get an answer in time", text: WORDS.slow },
        button("Try again", [go("retry")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "unavailable", title: "We couldn’t reach the bank", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t reach the bank", text: o.unavailable ?? WORDS.unavailable },
        button("Try again", [go("retry")]),
        button("Cancel", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "denied", title: o.title, kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: o.denied ?? "You can’t do this at this company", text: "Your role at this company doesn’t include it. The bank checks this on its side too, so hiding the button isn’t the only guard.", visibleWhen: "ctx.error.code != 'WRONG_CONTEXT'" },
        { type: "result", tone: "error", title: "Switch to your business first", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.code == 'WRONG_CONTEXT'" },
        button("Close", [{ type: "exit" }]),
      ],
    },
    {
      id: "failed", title: o.title, kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was changed." },
        button("Start again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      // Try again after a slow or unavailable answer: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [go("start")],
      blocks: [],
      navigation: { rules: (o.retry ?? []).map(([integration, to]) => ({ when: `ctx.error.integration == '${integration}'`, to })) },
    },
  ];
}

/** A screen the person without the permission lands on (the bank refuses the same calls). */
export const denyScreen = (title: string, what: string): Screen => ({
  id: "denied", title, kind: "terminal",
  blocks: [
    { type: "result", tone: "error", title: `You can’t ${what} at this company`, text: "Your role at this company doesn’t include it. The bank checks this on its side too, so hiding the button isn’t the only guard.", visibleWhen: "ctx.error.code != 'WRONG_CONTEXT'" },
    { type: "result", tone: "error", title: "Switch to your business first", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.code == 'WRONG_CONTEXT'" },
    button("Close", [{ type: "exit" }]),
  ],
});

/** The wrong-code lock: three wrong codes stop the request (the engine counts the failures of the integration named otpVerify). */
export const lockOnWrongCode = { showToast: "That code isn't right.", stay: true, lockAfter: 3, lockTo: "locked" };
export const lockedScreen = (what: string, nothing = "Nothing was sent."): Screen => ({
  id: "locked", title: "Too many wrong codes", kind: "terminal",
  blocks: [{ type: "result", tone: "error", title: `We couldn’t confirm this ${what}.`, text: `${nothing} Start again.` }, button("Start again", [go("start")]), button("Close", [{ type: "exit" }], "secondary")],
});

export const REFERENCE = "^[A-Za-z0-9 .,'\\-/()+:#]{1,35}$";
export const PURPOSES = ["Goods", "Services", "Rent", "Utilities", "Taxes and duties", "Other"];

/** Steps a scenario takes, as the shorthand every test file uses. */
export type Step = Record<string, unknown>;
export const steps = {
  set: (v: Record<string, unknown>): Step => ({ set: v }),
  press: (label: string): Step => ({ press: label }),
  text: (t: string): Step => ({ expectText: t }),
  noText: (t: string): Step => ({ expectNoText: t }),
  screen: (s: string): Step => ({ expectScreen: s }),
  error: (e: string): Step => ({ expectError: e }),
  opens: (journey: string, w?: Record<string, unknown>): Step => ({ expectOpens: { journey, ...(w ? { with: w } : {}) } }),
  bank: (adapter: string, path: string, equals: unknown, input?: Record<string, unknown>): Step => ({ expectBank: { adapter, path, equals, ...(input ? { input } : {}) } }),
  refuses: (adapter: string, code: string, input?: Record<string, unknown>): Step => ({ expectBankError: { adapter, code, ...(input ? { input } : {}) } }),
};
export type { Block };
