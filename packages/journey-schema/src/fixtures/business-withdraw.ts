import type { Journey, Screen } from "../schema";
import { businessWithdrawAcceptance, businessWithdrawScenarios } from "./business-withdraw-tests";
import { alert, button, denyScreen, failScreens, go, is, lacks, route, set, text, toRoute } from "./business-kit";

const REASONS = ["Wrong amount", "Wrong supplier", "Wrong reference", "Not needed any more", "Other"];
const REFUSALS = ["NOT_YOUR_PAYMENT", "PAYMENT_RELEASED", "PAYMENT_NOT_PENDING", "PAYMENT_NOT_FOUND", "INVALID_REASON"];

/**
 * Withdraw a payment (BankWorkx Business, Payments). A Maker takes back a payment they started while it still waits for approval. Nothing was sent, so no code is asked; the payment
 * becomes Withdrawn, leaves the approvers' inbox and gives its amount back to the person's daily limit. Only the Maker's own pending payments can be withdrawn (the bank refuses
 * another person's, one that was released, and one that is no longer waiting). With a payment (`launch.paymentId`, from the Payment tracker) the pick step is skipped; the reason
 * is optional (`opt.askReason`) and "Other" adds a note of up to 100 characters.
 *
 * Replaces, for BankWorkx, the Meezan journey withdraw-a-payment (its older name opens this one). Built from the spec with the blocks FinX has (docs/BANKWORKX.md).
 */
export const businessWithdraw: Journey = {
  id: "jrn_withdraw_payment",
  slug: "withdraw-payment",
  name: "Withdraw a payment",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessWithdrawAcceptance,
  scenarios: businessWithdrawScenarios,
  dataModel: {
    "launch.paymentId": { type: "string" }, "opt.askReason": { type: "boolean" },
    "wd.id": { type: "string", required: true }, "wd.reason": { type: "string" }, "wd.note": { type: "string", pattern: "^.{0,100}$" }, "wd.res": { type: "object" },
  },
  integrations: [
    { id: "pending", adapter: "corp.payments.pending", mode: "sandbox" },
    { id: "get", adapter: "corp.payments.track", mode: "sandbox" },
    { id: "withdraw", adapter: "corp.payments.withdraw", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Withdraw a payment", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.p", null), set("wd.id", "{{launch.paymentId}}"), set("launch.paymentId", ""), set("wd.reason", ""), set("wd.note", ""), set("wd.res", null),
        { type: "callApi", integration: "pending", input: { as: "initiator" }, saveAs: "ctx.pend", onError: toRoute },
        go("pick"),
      ],
      navigation: route([lacks("biz.payments.withdraw"), "denied"], ["!isEmpty(wd.id)", "chosen"]),
      blocks: [],
    },
    {
      id: "pick", title: "Withdraw a payment",
      blocks: [
        { type: "stepper", steps: ["payment", "confirm"] },
        text("Step 1 of 2 · Withdraw a payment", "caption"),
        text("Withdraw a payment", "title"),
        { type: "menu", source: "ctx.pend", item: { label: "{{item.amount | money2:item.currency}} to {{item.payee}}", text: "{{item.id}} · {{item.progress}}", actions: [set("wd.id", "{{item.id}}"), go("chosen")] } },
        text("Nothing to withdraw", "title", "len(ctx.pend) == 0"),
        text("Only payments waiting for approval can be withdrawn.", "body", "len(ctx.pend) == 0"),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "chosen", title: "Withdraw a payment", kind: "branch",
      onEnter: [set("ctx.error", null), set("ctx.p", null), { type: "callApi", integration: "get", input: { paymentId: "{{wd.id}}" }, saveAs: "ctx.p", onError: toRoute }, go("confirm")],
      blocks: [],
    },
    {
      id: "confirm", title: "Withdraw this payment?",
      blocks: [
        { type: "stepper", steps: ["payment", "confirm"] },
        text("Step 2 of 2 · Withdraw a payment", "caption"),
        text("Withdraw this payment?", "title"),
        alert("error", "We can’t find that payment.", is("PAYMENT_NOT_FOUND")),
        alert("error", "You can only withdraw payments you started.", is("NOT_YOUR_PAYMENT")),
        alert("error", "This payment has already been released to the bank. It can’t be withdrawn.", is("PAYMENT_RELEASED")),
        alert("error", "This payment is no longer waiting for approval.", is("PAYMENT_NOT_PENDING")),
        alert("error", "{{ctx.error.message}}", is("INVALID_REASON")),
        { type: "reviewSummary", visibleWhen: "!isEmpty(ctx.p)", rows: [{ label: "Payment", value: "{{ctx.p.amountText}} to {{ctx.p.to}}" }, { label: "Reference", value: "{{ctx.p.id}} · Ref {{ctx.p.reference}}" }, { label: "Status", value: "{{ctx.p.statusText}}" }] },
        { type: "select", bind: "wd.reason", label: "Reason (optional)", variant: "dropdown", options: REASONS, visibleWhen: "opt.askReason != false && !isEmpty(ctx.p)" },
        { type: "textInput", bind: "wd.note", label: "Note", placeholder: "What was wrong?", visibleWhen: "opt.askReason != false && wd.reason == 'Other' && !isEmpty(ctx.p)", pattern: "^.{0,100}$", patternMessage: "Use up to 100 characters." },
        button("Withdraw payment", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "withdraw", input: { paymentId: "{{wd.id}}", reason: "{{opt.askReason != false ? wd.reason : ''}}", note: "{{opt.askReason != false && wd.reason == 'Other' ? wd.note : ''}}" }, saveAs: "wd.res", onError: toRoute },
          go("done"),
        ], "primary", "!isEmpty(ctx.p)"),
        button("Back", [set("ctx.error", null), go("start")], "ghost"),
      ],
    },
    {
      id: "done", title: "Payment withdrawn", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment withdrawn", text: "Nothing was sent to {{wd.res.to}}.", meta: "Payment {{wd.res.id}}" },
        { type: "statusChip", status: "withdrawn", label: "Withdrawn", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Payment", value: "{{wd.res.id}}" }, { label: "To", value: "{{wd.res.to}}" }, { label: "Amount", value: "{{wd.res.amountText}}" }] },
        { type: "reviewSummary", visibleWhen: "!isEmpty(wd.res.withdrawReason)", rows: [{ label: "Reason", value: "{{wd.res.withdrawReason}}" }] },
        button("Back to payments", [{ type: "navigate", toJourney: "payment-tracker" }]),
        button("New supplier payment", [{ type: "navigate", toJourney: "supplier-payment" }], "secondary"),
      ],
    },
    ...withdrawFailures(),
  ] as Screen[],
};

function withdrawFailures(): Screen[] {
  const base = failScreens({
    title: "Withdraw a payment", effects: ["withdraw"], timeoutText: "We didn’t get an answer in time. Check Payments before you try again.",
    retry: [["get", "chosen"], ["withdraw", "confirm"]],
    routes: [[is(...REFUSALS), "confirm"]],
  });
  return base.filter((s) => s.id !== "denied").concat([denyScreen("Withdraw a payment", "withdraw payments")]);
}
