import type { Journey, Screen } from "../schema";
import { investAcceptance, investScenarios } from "./invest-tests";
import { alert, answerScreens, button, codeScreen, denied, go, lacks, lockedScreen, otpData, otpIntegrations, payIntegration, route, sendCode, set, text } from "./save-kit";

/** What this journey holds only while it is being sent: the code and the ticks. Cleared on every way out. */
const wipe = [set("otp.code", ""), set("inv.consent", false), set("inv.ack", false)];
const err = (e: string) => `inv.err == '${e}'`;
const TIMEOUT = "We didn’t get an answer in time. Check your investments before you try again, so you don’t invest twice.";
/** Which kind of problem a bank refusal is: the fund (or stock) cannot be bought, the amount or account is not right, or the code ran out. */
const KIND = "{{ctx.error.code == 'FUND_CLOSED' || ctx.error.code == 'FUND_NOT_FOUND' || ctx.error.code == 'INSTRUMENT_NOT_FOUND' ? 'fund' : ctx.error.code == 'OTP_REQUIRED' ? 'otp' : ctx.error.code == 'BELOW_MINIMUM' || ctx.error.code == 'AMOUNT_REQUIRED' || ctx.error.code == 'AMOUNT_DECIMALS' || ctx.error.code == 'INVALID_AMOUNT' || ctx.error.code == 'INSUFFICIENT_FUNDS' || ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'ACCOUNT_CANNOT_DEBIT' ? 'amount' : ''}}";
const FUND = "ctx.funds.funds.all[inv.fundId]";
const HIGH = `${FUND}.risk == 'high' && opt.riskAck != false`;
const summary = (rows: [string, string][]) => ({ type: "reviewSummary" as const, rows: rows.map(([label, value]) => ({ label, value })) });
const tick = (bind: string, t: string, visibleWhen?: string, message = "Tick the box to continue.") => ({ type: "consent" as const, bind, termsVersion: "invest-v1", text: t, validation: { mustBeTrue: true, messages: { mustBeTrue: message } }, ...(visibleWhen ? { visibleWhen } : {}) });
const RISK_NOTICE = "Investments can go down as well as up. This is a sandbox: no real money moves. This is not investment advice.";
const risks = (...ids: string[]) => ids.map((id) => ({ id, label: id === "all" ? "All" : id[0]!.toUpperCase() + id.slice(1) }));
/** The shelf for one risk: a list of the funds of that risk, shown only while that chip is chosen (all of them bind the choice). */
const shelf = (risk: string) => ({ type: "select" as const, bind: "inv.fundId", label: "Investment", source: `ctx.funds.funds.${risk}`, variant: "rows" as const, visibleWhen: `inv.risk == '${risk}'` });

/**
 * Invest (BankWorkx, Personal: Save & Borrow). A shelf of four funds: choose one (filtered by risk), see its charge and smallest amount, pay an amount from an
 * account, review with the risk, tick, and pay with a one-time code. A high-risk fund asks for a ticked risk box while the bank wants it.
 *
 * A stock opened from the Invest tab (launch value `symbol`) takes a second, smaller road with the older adapters (`bank.invest.buy`: 1 to 50,000, no fee, shares):
 * amount, review, tick, code, the same refusals. Built from the spec of the prototype with the blocks FinX has: the estimated units and charge are text that follows
 * the amount; the smallest amount and the account are checked by the bank when Continue is pressed; "Choose an investment." and an empty amount say "Required"
 * (the engine's word) except that a choice outside the chosen risk is refused with the spec's words.
 */
export const invest: Journey = {
  id: "jrn_invest",
  slug: "invest",
  name: "Invest",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: investAcceptance,
  scenarios: investScenarios,
  dataModel: {
    "launch.fundId": { type: "string" },
    "launch.symbol": { type: "string" },
    "opt.allowHigh": { type: "boolean" },
    "opt.riskAck": { type: "boolean" },
    "inv.kind": { type: "string" },
    "inv.risk": { type: "string" },
    "inv.fundId": { type: "string", required: true },
    "inv.symbol": { type: "string" },
    "inv.amount": { type: "money", currency: "USD", required: true },
    "inv.from": { type: "string", required: true },
    "inv.ack": { type: "boolean", required: true },
    "inv.consent": { type: "boolean", required: true },
    "inv.ok": { type: "boolean" },
    "inv.err": { type: "string" },
    "inv.msg": { type: "string" },
    ...otpData,
  },
  integrations: [
    payIntegration,
    { id: "funds", adapter: "bank.funds.list", mode: "sandbox" },
    { id: "stocks", adapter: "bank.invest.instruments", mode: "sandbox" },
    { id: "check", adapter: "bank.funds.get", mode: "sandbox" },
    ...otpIntegrations,
    { id: "buy", adapter: "bank.funds.buy", mode: "sandbox" },
    { id: "buyStock", adapter: "bank.invest.buy", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Invest", kind: "branch",
      onEnter: [
        ...wipe, set("inv.err", ""), set("inv.msg", ""), set("inv.risk", "all"), set("inv.amount", null), set("inv.fundId", ""), set("ctx.error", null),
        set("inv.kind", "{{isEmpty(launch.symbol) ? 'fund' : 'stock'}}"), set("inv.symbol", "{{launch.symbol}}"),
        { type: "callApi", integration: "pay", saveAs: "ctx.pay", onError: { navigate: "fail" } },
        set("inv.from", "{{ctx.pay.defaultId}}"),
        go("loadFunds"),
      ],
      navigation: route([lacks("payments.create"), "denied"], ["inv.kind == 'stock'", "loadStock"]),
      blocks: [],
    },
    {
      id: "loadFunds", title: "Invest", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "funds", input: { allowHigh: "{{opt.allowHigh != false}}" }, saveAs: "ctx.funds", onError: { navigate: "fail" } },
        // a fund passed in is used when it is on the shelf; otherwise the person chooses
        set("inv.fundId", "{{has(ctx.funds.funds.all, launch.fundId) ? launch.fundId : ''}}"),
        go("fund"),
      ],
      navigation: route(["!isEmpty(inv.fundId)", "amount"]),
      blocks: [],
    },
    {
      id: "fund", title: "Choose an investment",
      blocks: [
        text("Choose an investment", "title"),
        alert("error", "Choose an investment.", err("fund")),
        alert("error", "{{inv.msg}}", err("closed")),
        { type: "select", bind: "inv.risk", label: "Risk", variant: "chips", choices: risks("all", "low", "medium", "high"), visibleWhen: "opt.allowHigh != false" },
        { type: "select", bind: "inv.risk", label: "Risk", variant: "chips", choices: risks("all", "low", "medium"), visibleWhen: "opt.allowHigh == false" },
        shelf("all"), shelf("low"), shelf("medium"), shelf("high"),
        // a choice made under another risk is not the choice: the person is asked again
        button("Continue", [{ type: "validate" }, set("inv.ok", "{{has(get(ctx.funds.funds, inv.risk), inv.fundId)}}"), set("inv.err", "{{inv.ok ? '' : 'fund'}}"), { type: "navigate" }]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
      navigation: route(["inv.ok", "amount"]),
    },
    {
      id: "amount", title: "How much?",
      blocks: [
        text("How much?", "title"),
        text(`{{${FUND}.name}}`, "caption"),
        alert("error", "{{inv.msg}}", err("amount")),
        { type: "amountInput", bind: "inv.amount", currency: "USD", label: "Amount", helper: `Smallest amount: {{${FUND}.minText}}` },
        text("Estimated units", "caption"),
        text(`{{inv.amount > 0 ? round(inv.amount / ${FUND}.price * 1000) / 1000 : 0}}`, "title"),
        text("Ongoing charge", "caption"),
        text(`{{${FUND}.chargeText}} (about $\{{round(inv.amount * ${FUND}.charge) / 100 | money2}})`, "body", "inv.amount > 0"),
        text(`{{${FUND}.chargeText}}`, "body", "!(inv.amount > 0)"),
        { type: "select", bind: "inv.from", label: "From", source: "ctx.pay.accounts", variant: "rows" },
        tick("inv.ack", "I understand I could lose some or all of the money I invest.", HIGH, "Please confirm to continue."),
        // the bank applies the smallest amount of the fund and the rules of the account that pays before the person goes on
        button("Continue", [
          { type: "validate" }, set("inv.err", ""),
          { type: "callApi", integration: "check", input: { fundId: "{{inv.fundId}}", amount: "{{inv.amount}}", fromAccountId: "{{inv.from}}", allowHigh: "{{opt.allowHigh != false}}" }, saveAs: "ctx.sum", onError: { navigate: "fail" } },
          go("review"),
        ]),
        button("Back", [set("inv.err", ""), go("fund")], "ghost", "isEmpty(launch.fundId)"),
        button("Cancel", [{ type: "exit" }], "ghost", "!isEmpty(launch.fundId)"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        text("Review", "title"),
        summary([
          ["Investment", "{{ctx.sum.name}}"], ["Risk", "{{ctx.sum.riskText}}"], ["From", "{{ctx.sum.fromName}}"], ["Amount", "{{ctx.sum.amountText}}"], ["Estimated units", "{{ctx.sum.unitsText}}"],
          ["Ongoing charge", "{{ctx.sum.chargeText}}"], ["Price", "{{ctx.sum.priceText}}"],
        ]),
        text(RISK_NOTICE, "caption"),
        tick("inv.consent", "I understand the charge and that the value can go down as well as up."),
        button("Invest", [{ type: "validate" }, sendCode(), go("code")]),
        button("Back", [go("amount")], "ghost"),
      ],
    },
    // the stock of the older Invest tab: amount, review, the same tick and code
    {
      id: "loadStock", title: "Invest", kind: "branch",
      onEnter: [{ type: "callApi", integration: "stocks", saveAs: "ctx.inst", onError: { navigate: "fail" } }, go("stockAmount")],
      navigation: route(["!has(ctx.inst, inv.symbol)", "gone"]),
      blocks: [],
    },
    {
      id: "stockAmount", title: "How much?",
      blocks: [
        text("How much?", "title"),
        text("{{ctx.inst[inv.symbol].name}}", "caption"),
        alert("error", "{{inv.msg}}", err("amount")),
        {
          type: "amountInput", bind: "inv.amount", currency: "USD", label: "Amount to invest", helper: "From $1 to $50,000. You buy part of a share if the amount is smaller than its price.", quickAmounts: [25, 50, 100, 250],
          validation: { min: 1, max: 50000, messages: { min: "The smallest amount is $1", max: "The most you can invest at once is $50,000" } },
        },
        { type: "select", bind: "inv.from", label: "From", source: "ctx.pay.accounts", variant: "rows" },
        button("Continue", [{ type: "validate" }, set("inv.err", ""), go("stockReview")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "stockReview", title: "Review order",
      blocks: [
        text("Review order", "title"),
        summary([["Buying", "{{ctx.inst[inv.symbol].name}}"], ["Amount", "${{inv.amount | money}}"], ["Order type", "Market order at today's price"], ["Fee", "$0"]]),
        text(RISK_NOTICE, "caption"),
        tick("inv.consent", "I understand the value can go down as well as up."),
        button("Invest", [{ type: "validate" }, sendCode(), go("code")]),
        button("Back", [go("stockAmount")], "ghost"),
      ],
    },
    codeScreen({
      title: "Confirm with your code", submit: "Confirm", after: [set("otp.code", ""), go("submit")], back: "start", wipe,
      heading: [
        text("Authorise {{ctx.sum.amountText}} into {{ctx.sum.name}}", "title", "inv.kind == 'fund'"),
        text("Authorise ${{inv.amount | money}} into {{inv.symbol}}", "title", "inv.kind == 'stock'"),
      ],
    }),
    {
      id: "submit", title: "Invest", kind: "branch",
      onEnter: [go("doBuy")],
      navigation: route(["inv.kind == 'stock'", "doBuyStock"]),
      blocks: [],
    },
    {
      id: "doBuy", title: "Invest", kind: "branch",
      onEnter: [{ type: "callApi", integration: "buy", input: { fundId: "{{inv.fundId}}", amount: "{{inv.amount}}", fromAccountId: "{{inv.from}}", allowHigh: "{{opt.allowHigh != false}}" }, saveAs: "inv.res", onError: { navigate: "fail" } }, set("inv.consent", false), set("inv.ack", false), go("done")],
      blocks: [],
    },
    {
      id: "doBuyStock", title: "Invest", kind: "branch",
      onEnter: [{ type: "callApi", integration: "buyStock", input: { symbol: "{{inv.symbol}}", fromAccountId: "{{inv.from}}", amount: "{{inv.amount}}" }, saveAs: "inv.res", onError: { navigate: "fail" } }, set("inv.consent", false), go("doneStock")],
      blocks: [],
    },
    {
      id: "done", title: "Investment made", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Investment made", text: "{{inv.res.amountText}} is invested in {{inv.res.name}}.", meta: "Reference {{inv.res.reference}}" },
        summary([["Investment", "{{inv.res.name}}"], ["From", "{{inv.res.fromName}}"], ["Amount", "{{inv.res.amountText}}"], ["Units", "{{inv.res.unitsText}}"], ["Ongoing charge", "{{inv.res.chargeText}}"]]),
        button("View investments", [{ type: "navigate", toJourney: "save-borrow" }], "secondary"),
        button("Invest more", [set("launch.fundId", ""), go("start")], "secondary"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneStock", title: "Order placed", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Order placed", text: "You bought {{inv.res.shares}} of {{inv.res.symbol}} at ${{inv.res.price | money2}}.", meta: "Ref {{inv.res.reference}}" },
        button("Done", [{ type: "exit" }]),
      ],
    },
    lockedScreen("Too many wrong codes. Nothing was invested. Start again when you’re ready.", "start", wipe),
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Invest", kind: "branch",
      onEnter: [set("otp.code", ""), set("inv.err", KIND), set("inv.msg", "{{ctx.error.message}}"), set("inv.err", "{{inv.err == 'fund' && inv.kind == 'fund' ? 'closed' : inv.err}}"), go("problem")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["inv.err == 'fund'", "gone"], ["inv.err == 'closed'", "fund"],
        ["inv.err == 'amount' && inv.kind == 'stock'", "stockAmount"], ["inv.err == 'amount'", "amount"], ["inv.err == 'otp'", "start"],
      ),
      blocks: [],
    },
    {
      id: "gone", title: "Invest", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We can’t find that investment.", text: "Nothing was bought and you haven’t been charged." },
        button("Back", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    ...answerScreens("start", TIMEOUT, wipe),
    {
      id: "problem", title: "Invest", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t invest", text: "Something went wrong. Nothing was bought and no money has left your account." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Invest"),
  ] as Screen[],
};
