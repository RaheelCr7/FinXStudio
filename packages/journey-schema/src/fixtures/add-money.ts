import type { Journey, Screen } from "../schema";
import { addMoneyAcceptance, addMoneyScenarios } from "./add-money-tests";
import { alert, answerScreens, button, codeScreen, denied, go, lacks, lockedScreen, otpData, otpIntegrations, payIntegration, route, sendCode, set, text } from "./save-kit";

/** What this journey holds only while it is being sent: the security code, the one-time code and the tick. Cleared on every way out. */
const clear = [set("otp.code", ""), set("am.cvv", ""), set("am.consent", false)];
const err = (e: string) => `am.err == '${e}'`;
const TIMEOUT = "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice.";
/** What a refusal of the bank is: what the person can put right on a screen (the amount, the card, the account), the code that ran out, or a plain failure. */
const KIND = "{{ctx.error.code == 'OTP_REQUIRED' ? 'otp' : ctx.error.code == 'INVALID_AMOUNT' || ctx.error.code == 'LIMIT_EXCEEDED' || ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'ACCOUNT_CANNOT_CREDIT' || ctx.error.code == 'CARD_NOT_FOUND' || ctx.error.code == 'CARD_EXPIRED' || ctx.error.code == 'CARD_DECLINED' || ctx.error.code == 'CVV_INVALID' || ctx.error.code == 'CARD_OFF' ? 'fix' : ''}}";
const summary = (rows: [string, string][], visibleWhen: string) => ({ type: "reviewSummary" as const, visibleWhen, rows: rows.map(([label, value]) => ({ label, value })) });
const CARD_ON = "opt.allowCard != false", BANK_ON = "opt.allowTransfer != false";
const choice = (id: string, label: string, t: string) => ({ id, label, text: t });
const WAYS = { card: choice("card", "From a card", "Usually instant"), bank: choice("bank", "By bank transfer", "From an account at another bank") };

/**
 * Add money (BankWorkx, Personal: Save & Borrow). Two ways to put money into an account: from a saved card (an account, an amount from 10.00 to 5,000.00, a card that
 * has not expired and its 3-digit security code; a review with the card fee and what the card is charged; a tick; a one-time code; the account is credited with
 * the amount, not the fee) or by bank transfer (the account's numbers for the bank's home market, the account name and where to use it as the reference; no code,
 * no money moves).
 *
 * Built from the spec of the prototype with the blocks FinX has: the card fee and the total cannot redraw while the amount is typed, so they are on the review
 * after the bank has applied every rule; a way the bank has switched off is not offered (the engine cannot dim a choice) and a line says so; an expired card is
 * listed apart and cannot be chosen; the bank checks the card and the security code, so an empty one is "Choose a card." and the engine's "Required" is not
 * used; there are no Copy buttons (the engine has no clipboard); the review carries the tick the money rules ask for (the spec has none).
 */
export const addMoney: Journey = {
  id: "jrn_add_money",
  slug: "add-money",
  name: "Add money",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: addMoneyAcceptance,
  scenarios: addMoneyScenarios,
  dataModel: {
    "launch.accountId": { type: "string" },
    "launch.amount": { type: "number" },
    "opt.allowCard": { type: "boolean" },
    "opt.allowTransfer": { type: "boolean" },
    "opt.cardFee": { type: "boolean" },
    "am.method": { type: "string" },
    "am.to": { type: "string", required: true },
    "am.amount": { type: "money", currency: "USD", required: true },
    "am.cardId": { type: "string" },
    "am.cvv": { type: "string" },
    "am.consent": { type: "boolean", required: true },
    "am.err": { type: "string" },
    "am.msg": { type: "string" },
    ...otpData,
  },
  integrations: [
    payIntegration,
    { id: "cards", adapter: "bank.deposit.cards", mode: "sandbox" },
    { id: "check", adapter: "bank.deposit.create", mode: "sandbox" },
    ...otpIntegrations,
    { id: "add", adapter: "bank.deposit.create", mode: "sandbox" },
    { id: "details", adapter: "bank.accounts.get", mode: "sandbox" },
    { id: "profile", adapter: "bank.profile.get", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Add money", kind: "branch",
      onEnter: [
        ...clear, set("am.err", ""), set("am.msg", ""), set("am.cardId", ""), set("ctx.error", null),
        { type: "callApi", integration: "pay", saveAs: "ctx.pay", onError: { navigate: "fail" } },
        { type: "callApi", integration: "cards", saveAs: "ctx.cards", onError: { navigate: "fail" } },
        // an account passed in is used when it is one of the person's; an amount passed in is filled in
        set("am.to", "{{has(ctx.pay.accounts, launch.accountId) ? launch.accountId : ctx.pay.defaultId}}"),
        set("am.amount", "{{launch.amount > 0 ? launch.amount : null}}"),
        set("am.method", "{{opt.allowCard == false ? 'bank' : 'card'}}"),
        go("method"),
      ],
      navigation: route([lacks("payments.create"), "denied"]),
      blocks: [],
    },
    {
      id: "method", title: "Add money",
      blocks: [
        text("Add money", "title"),
        { type: "select", bind: "am.method", label: "How", variant: "tiles", choices: [WAYS.card, WAYS.bank], visibleWhen: `${CARD_ON} && ${BANK_ON}` },
        { type: "select", bind: "am.method", label: "How", variant: "tiles", choices: [WAYS.card], visibleWhen: `${CARD_ON} && !(${BANK_ON})` },
        { type: "select", bind: "am.method", label: "How", variant: "tiles", choices: [WAYS.bank], visibleWhen: `!(${CARD_ON}) && ${BANK_ON}` },
        text("From a card isn’t available at your bank.", "body", "opt.allowCard == false"),
        text("By bank transfer isn’t available at your bank.", "body", "opt.allowTransfer == false"),
        button("Continue", [{ type: "navigate" }], "primary", `${CARD_ON} || ${BANK_ON}`),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
      navigation: route(["am.method == 'bank'", "bank"], ["am.method != 'bank'", "card"]),
    },
    {
      id: "card", title: "From a card",
      blocks: [
        text("From a card", "title"),
        alert("error", "{{am.msg}}", err("fix")),
        { type: "select", bind: "am.to", label: "Add to", source: "ctx.pay.accounts", variant: "rows" },
        {
          type: "amountInput", bind: "am.amount", currency: "USD", label: "Amount", helper: "From $10.00 to $5,000.00",
          validation: { min: 10, max: 5000, messages: { min: "The smallest amount is $10.00.", max: "The most you can add at once is $5,000.00." } },
        },
        { type: "select", bind: "am.cardId", label: "Card", source: "ctx.cards.cards", variant: "rows", visibleWhen: "ctx.cards.count > 0" },
        text("{{ctx.cards.expiredText}}", "caption", "ctx.cards.hasExpired"),
        text("You have no saved card that can be used.", "body", "ctx.cards.count == 0"),
        button("Add a card", [{ type: "navigate", toJourney: "add-card" }], "secondary", "ctx.cards.count == 0"),
        { type: "textInput", bind: "am.cvv", label: "Security code", placeholder: "3 digits", keyboard: "number", secure: true, pattern: "^[0-9]{3}$", patternMessage: "Enter the 3 digits on the back of the card." },
        // the bank applies every rule (the amount, the card, the code on the back, the account) before the review, and says what the card will be charged
        button("Continue", [
          { type: "validate" }, set("am.err", ""),
          { type: "callApi", integration: "check", input: { toAccountId: "{{am.to}}", fromCardId: "{{am.cardId}}", amount: "{{am.amount}}", securityCode: "{{am.cvv}}", fee: "{{opt.cardFee != false}}", allowCard: "{{opt.allowCard != false}}", dryRun: true }, saveAs: "ctx.sum", onError: { navigate: "fail" } },
          go("review"),
        ]),
        button("Back", [go("method")], "ghost"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        text("Review", "title"),
        summary([["Added to", "{{ctx.sum.toName}}"], ["Card", "{{ctx.sum.cardName}}"], ["Amount", "{{ctx.sum.amountText}}"], ["Card fee", "{{ctx.sum.feeText}}"], ["Charged to your card", "{{ctx.sum.chargedText}}"]], "ctx.sum.fee > 0"),
        summary([["Added to", "{{ctx.sum.toName}}"], ["Card", "{{ctx.sum.cardName}}"], ["Amount", "{{ctx.sum.amountText}}"], ["Charged to your card", "{{ctx.sum.chargedText}}"]], "!(ctx.sum.fee > 0)"),
        { type: "consent", bind: "am.consent", termsVersion: "add-money-v1", text: "I authorise this charge to my card.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue." } } },
        button("Confirm", [{ type: "validate" }, sendCode(), go("code")]),
        button("Back", [go("card")], "ghost"),
      ],
    },
    codeScreen({
      title: "Confirm with your code", heading: "Authorise {{ctx.sum.chargedText}} from {{ctx.sum.cardName}}", submit: "Add money", back: "review", wipe: [set("otp.code", "")],
      after: [
        { type: "callApi", integration: "add", input: { toAccountId: "{{am.to}}", fromCardId: "{{am.cardId}}", amount: "{{am.amount}}", securityCode: "{{am.cvv}}", fee: "{{opt.cardFee != false}}", allowCard: "{{opt.allowCard != false}}" }, saveAs: "am.res", onError: { navigate: "fail" } },
        ...clear, go("done"),
      ],
    }),
    {
      id: "done", title: "Money added", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Money added", text: "{{am.res.amountText}} is in {{am.res.toName}}.", meta: "Reference {{am.res.reference}}" },
        summary([["Added to", "{{am.res.toName}}"], ["Card", "{{am.res.cardName}}"], ["Amount", "{{am.res.amountText}}"], ["Card fee", "{{am.res.feeText}}"], ["Charged to your card", "{{am.res.chargedText}}"]], "am.res.fee > 0"),
        summary([["Added to", "{{am.res.toName}}"], ["Card", "{{am.res.cardName}}"], ["Amount", "{{am.res.amountText}}"], ["Charged to your card", "{{am.res.chargedText}}"]], "!(am.res.fee > 0)"),
        button("View accounts", [{ type: "navigate", toJourney: "accounts" }], "secondary"),
        button("Add more", [go("start")], "secondary"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "bank", title: "By bank transfer",
      blocks: [
        text("By bank transfer", "title"),
        alert("error", "{{am.msg}}", err("fix")),
        { type: "select", bind: "am.to", label: "Add to", source: "ctx.pay.accounts", variant: "rows" },
        // the details of the account chosen, and the name on it
        button("Show details", [
          set("am.err", ""),
          { type: "callApi", integration: "details", input: { accountId: "{{am.to}}" }, saveAs: "ctx.det", onError: { navigate: "fail" } },
          { type: "callApi", integration: "profile", saveAs: "ctx.prof", onError: { navigate: "fail" } },
          go("details"),
        ]),
        button("Back", [go("method")], "ghost"),
      ],
    },
    {
      id: "details", title: "Details ready", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Details ready", text: "Send money to this account from your other bank." },
        {
          type: "reviewSummary",
          rows: [
            { label: "Account", value: "{{ctx.det.name}} {{ctx.det.maskedNumber}}" }, { label: "{{ctx.det.rows[0].label}}", value: "{{ctx.det.rows[0].value}}" },
            { label: "{{ctx.det.rows[1].label}}", value: "{{ctx.det.rows[1].value}}" }, { label: "Account name", value: "{{ctx.prof.name}}" },
          ],
        },
        text("Money usually arrives the same day. Use your name as the reference.", "body"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    lockedScreen("Too many wrong codes. Nothing was charged. Start again when you’re ready.", "start", clear),
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Add money", kind: "branch",
      onEnter: [...clear, set("am.err", KIND), set("am.msg", "{{ctx.error.message}}"), go("problem")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["am.err == 'fix' && am.method == 'bank'", "bank"], ["am.err == 'fix'", "card"], ["am.err == 'otp'", "start"],
      ),
      blocks: [],
    },
    ...answerScreens("start", TIMEOUT, clear),
    {
      id: "problem", title: "Add money", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t add the money", text: "Something went wrong. Your card was not charged." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Add money"),
  ] as Screen[],
};
