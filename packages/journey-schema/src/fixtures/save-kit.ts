import type { Block, Screen } from "../schema";
import { alert, button, denied, go, holds, lacks, route, row, set, text } from "./accounts-kit";

export { alert, button, denied, go, holds, lacks, route, row, set, text };

/**
 * The small pieces the Save & Borrow journeys (save-borrow, term-deposit, savings-goal, apply-loan, repay-loan, invest, sell-investment, add-money) are built
 * from, so each file says what is its own and they cannot drift apart on the words of a failure, the one-time code and the account that pays.
 */

/** The accounts that can pay (or receive): the home currency, each with what is available, and the one to start with. Save as ctx.pay; use `source: "ctx.pay.accounts"`. */
export const payIntegration = { id: "pay", adapter: "bank.accounts.payFrom", mode: "sandbox" as const };
export const otpIntegrations = [
  { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" as const },
  { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" as const },
];
export const otpData = { "otp.code": { type: "string" as const, required: true, pattern: "^[0-9]{6}$" } };

/** What the bank says it did not do when it did not answer or was not there: nothing was sent and nothing was charged. */
export const NOT_REACHED = "Nothing was sent and you haven’t been charged. Try again in a moment.";

/** The two answers no person can fix. `slow` is the journey's own words for no answer in time; `retry` is the screen "Try again" returns to; `wipe` clears what is held for the bank. */
export function answerScreens(retry: string, slow: string, wipe: any[] = [], reached: string = NOT_REACHED): Screen[] {
  return [
    {
      id: "timeout", title: "No answer in time", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "This is taking longer than expected", text: slow },
        button("Try again", [go(retry)]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t reach the bank", text: reached },
        button("Try again", [go(retry)]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
  ] as Screen[];
}

/**
 * The sheet that asks for the one-time code. `after` is what runs once the code was right (the bank's call, then the way on); a wrong code is a toast and the
 * third ends the attempt on `locked`. The caller sends the code before it opens this screen (`sendCode`).
 */
export const sendCode = (onFail = "fail") => ({ type: "callApi" as const, integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: onFail } });
export function codeScreen(o: { title: string; /** the heading when it is not the title: a text with {{values}} such as "Authorise a deposit of $5,000.00", or blocks that each show for one case */ heading?: string | Block[]; submit: string; after: any[]; back: string; wipe: any[]; fail?: string; caption?: string }): Screen {
  const fail = o.fail ?? "fail";
  return {
    id: "code", title: o.title,
    blocks: [
      ...(Array.isArray(o.heading) ? o.heading : [text(o.heading ?? o.title, "title")]),
      text(o.caption ?? "Code sent to {{ctx.otp.maskedPhone}}.", "caption"),
      {
        type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
        hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
        onResend: [sendCode(fail)],
      },
      button(o.submit, [
        { type: "validate" },
        { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" } },
        ...o.after,
      ]),
      button("Back", [...o.wipe, go(o.back)], "ghost"),
    ],
  } as Screen;
}
export const lockedScreen = (nothing: string, restart: string, wipe: any[]): Screen => ({
  id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wipe,
  blocks: [
    { type: "result", tone: "error", title: "Too many wrong codes", text: nothing },
    button("Start again", [go(restart)]),
    button("Close", [{ type: "exit" }], "ghost"),
  ],
}) as Screen;
