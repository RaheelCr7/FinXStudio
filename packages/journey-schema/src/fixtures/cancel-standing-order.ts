import type { Journey } from "../schema";
import { cancelStandingOrderAcceptance, cancelStandingOrderScenarios } from "./cancel-standing-order-tests";

const toRoute = { navigate: "route" };
/** The bank's closing rule for changes is an option of the bank (opt.strictCutoff: 09:00 instead of 18:00 the business day before). */
const STRICT = "{{opt.strictCutoff == true}}";
/** The scope card is offered only when the bank allows skipping, the payment repeats and more than one payment is left. */
const OFFER_SKIP = "opt.allowSkip != false && ctx.cur.canSkip == true";
const isCode = (codes: string[]) => codes.map((c) => `ctx.error.code == '${c}'`).join(" || ");
const GONE_CODES = ["SCHEDULE_NOT_FOUND", "SCHEDULE_NOT_ACTIVE", "SCHEDULE_RUNNING", "SCHEDULE_CUTOFF_PASSED"];

/**
 * Cancel a standing order (BankWorkx, Payments): what the spec calls an alias of `schedule-payment` opened in its cancel mode. The engine
 * cannot open one journey from another with a value (`toJourney` exists in the schema but no runtime follows it), so it is a journey of its
 * own that starts at the list of what is scheduled: pick a payment, then one screen, then the result. No code is asked, because
 * cancelling can only reduce what leaves the account. With `allowSkip` the person can skip only the next payment instead.
 */
export const cancelStandingOrder: Journey = {
  id: "jrn_cancel_standing_order",
  slug: "cancel-standing-order",
  name: "Cancel a standing order",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: cancelStandingOrderAcceptance,
  scenarios: cancelStandingOrderScenarios,
  dataModel: {
    "sc.id": { type: "string" },
    "sc.scope": { type: "string", required: true },
    // the bank's option, set by the bank: left alone skipping only the next payment is offered
    "opt.allowSkip": { type: "boolean" },
    "opt.strictCutoff": { type: "boolean" },
  },
  integrations: [
    { id: "schedules", adapter: "bank.schedules.list", mode: "sandbox" },
    { id: "scheduleGet", adapter: "bank.schedules.get", mode: "sandbox" },
    { id: "scheduleCancel", adapter: "bank.schedules.cancel", mode: "sandbox" },
  ],
  screens: [
    {
      // loads what is scheduled and clears the choice, then shows the list. Cancel another comes back here.
      id: "start", title: "Cancel a payment", kind: "branch",
      onEnter: [
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "sc.id", value: "" },
        { type: "setData", path: "sc.scope", value: "all" },
        { type: "callApi", integration: "schedules", input: { status: "live", strictCutoff: STRICT }, saveAs: "ctx.sched", onError: toRoute },
        { type: "navigate", to: "pick" },
      ],
      blocks: [],
    },
    {
      // the payments that are active or paused, soonest first. One that cannot be cancelled now says why when it is picked.
      id: "pick", title: "Cancel a payment",
      blocks: [
        { type: "text", variant: "title", text: "Which payment do you want to cancel?" },
        {
          type: "menu", source: "ctx.sched", visibleWhen: "len(ctx.sched) > 0",
          item: {
            label: "{{item.name}}", text: "{{item.sub}}",
            actions: [
              { type: "setData", path: "ctx.error", value: null },
              { type: "setData", path: "sc.id", value: "{{item.id}}" },
              { type: "setData", path: "sc.scope", value: "all" },
              { type: "callApi", integration: "scheduleGet", input: { scheduleId: "{{sc.id}}", for: "cancel", strictCutoff: STRICT }, saveAs: "ctx.cur", onError: toRoute },
              { type: "navigate", to: "cancel" },
            ],
          },
        },
        { type: "text", variant: "body", text: "Nothing scheduled. Set up a payment once and we’ll send it on time.", visibleWhen: "len(ctx.sched) == 0" },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "cancel", title: "Cancel this payment?",
      blocks: [
        { type: "text", variant: "title", text: "Cancel this payment?" },
        {
          type: "reviewSummary",
          rows: [
            { label: "To", value: "{{ctx.cur.toText}}" },
            { label: "Amount", value: "{{ctx.cur.amountText}}" },
            { label: "How often", value: "{{ctx.cur.frequencyName}}" },
            { label: "Next payment", value: "{{ctx.cur.nextLong}}" },
            { label: "Ends", value: "{{ctx.cur.endsText}}" },
          ],
        },
        { type: "text", variant: "caption", text: "Paused: the last two attempts failed.", visibleWhen: "ctx.cur.status == 'paused'" },
        {
          type: "select", bind: "sc.scope", label: "What should happen?", variant: "rows", visibleWhen: OFFER_SKIP,
          choices: [{ id: "all", label: "All future payments", text: "No more payments will go" }, { id: "next", label: "Only the next payment", text: "Skip it and carry on after it" }],
        },
        {
          // with skipping off, a single payment left or a payment that does not repeat, cancelling always ends the schedule
          type: "button", label: "Cancel payment", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "scheduleCancel", input: { scheduleId: "{{sc.id}}", scope: `{{${OFFER_SKIP} ? sc.scope : 'all'}}`, strictCutoff: STRICT }, saveAs: "sc.result", onError: toRoute },
            { type: "navigate", to: "success" },
          ],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "pick" }] },
      ],
    },
    {
      id: "success", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment cancelled", text: "No more payments will go to {{sc.result.name}}.", meta: "Cancelled", visibleWhen: "sc.result.status == 'cancelled'" },
        { type: "result", tone: "success", title: "Next payment skipped", text: "The {{sc.result.skippedOn}} payment to {{sc.result.name}} won’t go.", meta: "Skipped", visibleWhen: "sc.result.status == 'skipped'" },
        {
          type: "reviewSummary", visibleWhen: "sc.result.status == 'cancelled'",
          rows: [
            { label: "To", value: "{{sc.result.name}}" },
            { label: "Amount", value: "{{sc.result.amountText}}" },
            { label: "How often", value: "{{sc.result.frequencyName}}" },
            { label: "Cancelled on", value: "{{sc.result.cancelledOn}}" },
          ],
        },
        {
          type: "reviewSummary", visibleWhen: "sc.result.status == 'skipped'",
          rows: [
            { label: "To", value: "{{sc.result.name}}" },
            { label: "Amount", value: "{{sc.result.amountText}}" },
            { label: "Skipped", value: "{{sc.result.skippedOn}}" },
            { label: "Next payment", value: "{{sc.result.next}}" },
          ],
        },
        { type: "button", label: "Back to scheduled", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Cancel another", variant: "secondary", actions: [{ type: "navigate", to: "start" }] },
      ],
    },
    {
      // after a failed bank call: where to go depends on what the bank said (ctx.error)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.code == 'TIMEOUT' && ctx.error.integration == 'scheduleCancel'", to: "timeout" },
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: isCode([...GONE_CODES, "NOT_SUPPORTED"]), to: "problem" },
        ],
      },
    },
    {
      // why the payment cannot be cancelled now, in the bank's words (nothing was changed)
      id: "problem", title: "Check the payment",
      blocks: [
        { type: "result", tone: "error", title: "We can’t cancel this payment", text: "{{ctx.error.message}} Nothing was changed." },
        { type: "button", label: "Back to scheduled", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Choose another", variant: "secondary", actions: [{ type: "navigate", to: "start" }] },
      ],
    },
    {
      // Try again after a slow or unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "cancel" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'schedules'", to: "start" },
          { when: "ctx.error.integration == 'scheduleGet'", to: "pick" },
        ],
      },
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "We didn’t get an answer in time. Check your scheduled payments before you try again." },
        // the list of scheduled payments is a screen of the app, not of this journey: leaving the journey takes the person back to it
        { type: "button", label: "Check scheduled", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // a slow answer to a question that changes nothing (the list, one schedule): safe to ask again
      id: "slow", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "This is taking longer than expected. Nothing was changed." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Service not available", text: "We couldn’t reach the bank. Nothing was changed." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Back", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not cancelled", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was changed." },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
