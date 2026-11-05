import type { Block, Journey, Screen } from "../schema";
import { openAnotherAccountAcceptance, openAnotherAccountScenarios } from "./open-another-account-tests";
import { alert, button, denied, go, lacks, route, set, text } from "./accounts-kit";

const choice = (id: string, label: string, t: string) => ({ id, label, text: t });
const CURRENT = choice("current", "Current account", "For everyday spending, with a debit card");
const SAVINGS = choice("savings", "Savings account", "Earn interest on money you set aside");
const CURRENCY = choice("currency", "Currency account", "Hold and spend in another currency");
const tiles = (choices: ReturnType<typeof choice>[], visibleWhen: string): Block => ({ type: "select", bind: "oa.product", label: "Account", variant: "tiles", choices, visibleWhen });
const FULL = "len(ctx.accounts) >= 6";
const err = (code: string) => `oa.err == '${code}'`;
const toFail = { navigate: "fail" };
const wipe = [set("otp.code", "")];
/** What the bank is asked, for the check before the code and for opening: the same. */
const wanted = { product: "{{oa.product}}", currency: "{{oa.currency}}", name: "{{oa.name}}" };

/**
 * Open another account (BankWorkx, Personal: Accounts). A customer who is already known opens a current, savings or currency account in a few steps: choose
 * it, the currency (a currency account), a name, a review with the key facts and the terms, and a one-time code. The account always opens empty. The bank
 * applies every rule (the name, the limit of six accounts) when the name is entered, before the code, and again when the account is opened.
 *
 * Built from the spec of the prototype with the blocks FinX has: the name is checked when Continue is pressed (the engine has no live redraw), the key facts
 * come from the bank's check, and an empty choice says "Required" (the engine's message). Opened with a product (launch.product) that product is ticked.
 */
export const openAnotherAccount: Journey = {
  id: "jrn_bankworkx_open_another_account",
  slug: "open-another-account",
  name: "Open another account",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: openAnotherAccountAcceptance,
  scenarios: openAnotherAccountScenarios,
  dataModel: {
    "launch.product": { type: "string" },
    "opt.offerSavings": { type: "boolean" },
    "opt.offerCurrency": { type: "boolean" },
    "oa.product": { type: "string", required: true },
    "oa.currency": { type: "string", required: true },
    "oa.name": { type: "string", required: true },
    "oa.consent": { type: "boolean", required: true },
    "otp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "check", adapter: "bank.accounts.open", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "open", adapter: "bank.accounts.open", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Open another account", kind: "branch",
      onEnter: [
        set("oa.product", "{{launch.product == 'current' || launch.product == 'savings' || launch.product == 'currency' ? launch.product : ''}}"),
        set("oa.currency", ""), set("oa.name", ""), set("oa.consent", false), set("oa.err", ""), set("ctx.error", null), ...wipe,
        { type: "callApi", integration: "accounts", saveAs: "ctx.accounts", onError: toFail },
        go("product"),
      ],
      navigation: route([lacks("accounts.manage"), "denied"]),
      blocks: [],
    },
    {
      id: "product", title: "Choose an account",
      blocks: [
        text("Choose an account", "title"),
        alert("warning", "You already have 6 accounts, the most you can hold. Close one to open another.", FULL),
        alert("error", "You already have 6 accounts, the most you can hold.", err("ACCOUNT_LIMIT")),
        alert("error", "This account isn’t available right now.", err("PRODUCT_UNAVAILABLE")),
        tiles([CURRENT, SAVINGS, CURRENCY], "opt.offerSavings != false && opt.offerCurrency != false"),
        tiles([CURRENT, SAVINGS], "opt.offerSavings != false && opt.offerCurrency == false"),
        tiles([CURRENT, CURRENCY], "opt.offerSavings == false && opt.offerCurrency != false"),
        tiles([CURRENT], "opt.offerSavings == false && opt.offerCurrency == false"),
        button("Continue", [{ type: "validate" }, set("oa.err", ""), go("name")], "primary", `!(${FULL})`),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
      // a currency account asks for its currency first
      navigation: route(["oa.product == 'currency'", "currency"]),
    },
    {
      id: "currency", title: "Which currency?",
      blocks: [
        text("Which currency?", "title"),
        alert("error", "Choose a currency.", err("CURRENCY_REQUIRED")),
        { type: "select", bind: "oa.currency", label: "Currency", choices: [{ id: "EUR", label: "Euro (EUR)" }, { id: "GBP", label: "Pound (GBP)" }, { id: "AED", label: "Dirham (AED)" }] },
        button("Continue", [{ type: "validate" }, set("oa.err", ""), go("name")]),
        button("Back", [go("product")], "ghost"),
      ],
      // (the product screen routes a currency account here; from here Continue goes on to the name)
    },
    {
      id: "name", title: "Name your account",
      blocks: [
        text("Name your account", "title"),
        text("You can change it later.", "caption"),
        alert("error", "Use 2 to 24 characters.", err("INVALID_NICKNAME")),
        alert("error", "Use letters, numbers and spaces only.", err("NAME_CHARS")),
        alert("error", "You already have an account with that name.", err("NAME_TAKEN")),
        { type: "textInput", bind: "oa.name", label: "Account name", placeholder: "Holiday fund" },
        button("Continue", [
          { type: "validate" }, set("oa.err", ""),
          { type: "callApi", integration: "check", input: { ...wanted, dryRun: true }, saveAs: "ctx.check", onError: toFail },
          set("oa.consent", false), go("review"),
        ]),
        button("Back", [go("product")], "ghost"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        text("Review", "title"),
        { type: "reviewSummary", rows: [{ label: "Account", value: "{{ctx.check.productName}}" }, { label: "Name", value: "{{ctx.check.name}}" }] },
        { type: "reviewSummary", visibleWhen: "oa.product == 'currency'", rows: [{ label: "Currency", value: "{{ctx.check.currency}}" }] },
        { type: "sectionHeader", title: "Key facts" },
        { type: "reviewSummary", rows: [{ label: "Interest rate", value: "{{ctx.check.interest}}" }, { label: "Monthly fee", value: "{{ctx.check.monthlyFee}}" }, { label: "Minimum balance", value: "{{ctx.check.minimumBalance}}" }] },
        {
          type: "consent", bind: "oa.consent", termsVersion: "open-account-v1", text: "I agree to the account terms.",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Please agree to continue." } },
        },
        button("Continue", [
          { type: "validate" }, ...wipe,
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toFail },
          go("code"),
        ]),
        button("Back", [go("name")], "ghost"),
      ],
    },
    {
      id: "code", title: "Open {{ctx.check.name}}",
      blocks: [
        text("Open {{ctx.check.name}}", "title"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toFail }],
        },
        button("Open account", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" } },
          { type: "callApi", integration: "open", input: wanted, saveAs: "oa.res", onError: toFail },
          ...wipe, go("done"),
        ]),
        button("Back", [go("review")], "ghost"),
      ],
    },
    {
      id: "done", title: "Account opened", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Account opened", text: "It’s ready to use.", meta: "Active" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Account", value: "{{oa.res.name}}" }, { label: "Type", value: "{{oa.res.productName}}" }, { label: "Currency", value: "{{oa.res.currency}}" },
            { label: "Account number", value: "{{oa.res.maskedNumber}}" }, { label: "Opened", value: "{{oa.res.openedOn}}" },
          ],
        },
        button("Go to accounts", [{ type: "navigate", toJourney: "accounts" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "You entered the wrong code 3 times, so we stopped. No account was opened." },
        button("Start again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      // where a refusal goes: the form it belongs to says it; the bank not answering has a screen
      id: "fail", title: "Open another account", kind: "branch",
      onEnter: [set("oa.err", "{{ctx.error.code}}"), ...wipe, go("failed")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["ctx.error.code == 'ACCOUNT_LIMIT' || ctx.error.code == 'PRODUCT_UNAVAILABLE'", "product"],
        ["ctx.error.code == 'CURRENCY_REQUIRED'", "currency"],
        ["ctx.error.code == 'INVALID_NICKNAME' || ctx.error.code == 'NAME_CHARS' || ctx.error.code == 'NAME_TAKEN'", "name"],
      ),
      blocks: [],
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "This is taking longer than expected", text: "This is taking longer than expected. Nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Not available right now", text: "This isn’t available right now. Nothing was changed. Try again in a few minutes." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "failed", title: "Not opened", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t open it", text: "No account was opened. Start again." },
        button("Start again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    denied("Open another account"),
  ] as Screen[],
};
