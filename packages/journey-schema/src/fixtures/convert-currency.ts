import type { Journey } from "../schema";

const t = (en: string, ur: string) => ({ en, ur });
const acct = (id: string) => `{{ctx.accounts[${id}].name}} {{ctx.accounts[${id}].maskedNumber}}`;

/**
 * Convert money between two of the customer's own accounts in different currencies. The amount is in the currency of the
 * account it leaves, the rate and fee are shown on the review screen, and the rate is only good for a short time:
 * if it runs out the customer starts again and gets a new one. Urdu copy needs the bank's review.
 */
export const convertCurrency: Journey = {
  id: "jrn_convert_currency",
  slug: "convert-currency",
  name: t("Convert between my accounts", "اپنے اکاؤنٹس کے درمیان تبدیل کریں"),
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  locale: { default: "en", supported: ["en", "ur"], rtl: ["ur"] },
  entryScreen: "from",
  dataModel: {
    "conv.from": { type: "string", required: true },
    "conv.to": { type: "string", required: true },
    "conv.amount": { type: "money", required: true },
    "conv.consent": { type: "boolean", required: true },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "quote", adapter: "bank.fx.quote", mode: "sandbox" },
    { id: "convert", adapter: "bank.fx.convert", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
  ],
  screens: [
    {
      id: "from", title: t("Convert from", "کس اکاؤنٹ سے"),
      onEnter: [{ type: "callApi", integration: "accounts", saveAs: "ctx.accounts" }],
      blocks: [
        { type: "text", variant: "title", text: t("Which account do you convert from?", "کس اکاؤنٹ سے تبدیل کریں؟") },
        { type: "accountPicker", bind: "conv.from", source: "ctx.accounts", showBalance: true },
        { type: "button", label: t("Continue", "جاری رکھیں"), variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "to" }] },
      ],
    },
    {
      id: "to", title: t("Convert to", "کس اکاؤنٹ میں"),
      blocks: [
        { type: "text", variant: "title", text: t("Which account do you convert to?", "کس اکاؤنٹ میں تبدیل کریں؟") },
        { type: "text", variant: "caption", text: t("Choose an account in a different currency.", "مختلف کرنسی کا اکاؤنٹ منتخب کریں۔") },
        { type: "accountPicker", bind: "conv.to", source: "ctx.accounts", showBalance: true },
        { type: "button", label: t("Continue", "جاری رکھیں"), variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "amount", title: t("Amount", "رقم"),
      blocks: [
        {
          // the amount is in the currency of the account it leaves, read from that account
          type: "amountInput", bind: "conv.amount", currency: "{{ctx.accounts[conv.from].currency}}", label: t("Amount to convert", "تبدیل کرنے کی رقم"),
          helper: t("Available: {{ctx.accounts[conv.from].balance | money:ctx.accounts[conv.from].currency}}", "دستیاب: {{ctx.accounts[conv.from].balance | money:ctx.accounts[conv.from].currency}}"),
        },
        {
          type: "button", label: t("See the rate", "ریٹ دیکھیں"), variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "quote", input: { fromAccountId: "{{conv.from}}", toAccountId: "{{conv.to}}", amount: "{{conv.amount}}" }, saveAs: "ctx.quote",
              onError: { showToast: t("We couldn't price this. Check that the accounts are in different currencies and you have enough money.", "قیمت معلوم نہیں ہو سکی۔ دیکھیں کہ اکاؤنٹس مختلف کرنسی کے ہیں اور رقم کافی ہے۔"), stay: true } },
            { type: "navigate", to: "review" },
          ],
        },
      ],
    },
    {
      id: "review", title: t("Review conversion", "تبدیلی کا جائزہ"),
      blocks: [
        {
          type: "reviewSummary",
          rows: [
            { label: t("From", "سے"), value: acct("conv.from") },
            { label: t("To", "کو"), value: acct("conv.to") },
            { label: t("You convert", "آپ تبدیل کرتے ہیں"), value: "{{ctx.quote.from.amount | money:ctx.quote.from.currency}}" },
            { label: t("Rate", "ریٹ"), value: "1 {{ctx.quote.from.currency}} = {{ctx.quote.rate}} {{ctx.quote.to.currency}}" },
            { label: t("Fee", "فیس"), value: "{{ctx.quote.fee | money:ctx.quote.from.currency}}" },
            { label: t("You get", "آپ کو ملے گا"), value: "{{ctx.quote.to.amount | money:ctx.quote.to.currency}}" },
          ],
        },
        { type: "alert", tone: "info", text: t("This rate is valid for {{ctx.quote.ttlSeconds}} seconds. If it runs out you will be shown a new one.", "یہ ریٹ {{ctx.quote.ttlSeconds}} سیکنڈ کے لیے ہے۔ ختم ہونے پر نیا ریٹ دکھایا جائے گا۔") },
        {
          type: "consent", bind: "conv.consent", termsVersion: "fx-v1",
          text: t("I confirm the details and the rate are correct", "میں تصدیق کرتا/کرتی ہوں کہ تفصیلات اور ریٹ درست ہیں"),
          validation: { mustBeTrue: true, messages: { mustBeTrue: t("Tick the confirmation first", "پہلے تصدیق کریں") } },
        },
        {
          type: "button", label: t("Confirm and send OTP", "تصدیق کریں اور OTP بھیجیں"), variant: "primary",
          actions: [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp" }, { type: "navigate", to: "otp" }],
        },
      ],
    },
    {
      id: "otp", title: t("Verify", "تصدیق"),
      blocks: [
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 60, hint: t("Enter the code sent to {{ctx.otp.maskedPhone}}", "{{ctx.otp.maskedPhone}} پر بھیجا گیا کوڈ درج کریں"), onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp" }] },
        {
          type: "button", label: t("Verify and convert", "تصدیق کریں اور تبدیل کریں"), variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: t("Incorrect code", "غلط کوڈ"), stay: true, lockAfter: 3, lockTo: "failed" } },
            // a rate that ran out while the customer was typing the code ends here, with nothing converted
            { type: "callApi", integration: "convert", input: { quoteId: "{{ctx.quote.quoteId}}" }, saveAs: "conv.result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: t("Converted", "تبدیل ہو گیا"), kind: "terminal",
      blocks: [
        {
          type: "result", tone: "success", title: t("Converted", "تبدیل ہو گیا"),
          text: t("{{ctx.quote.from.amount | money:ctx.quote.from.currency}} became {{ctx.quote.to.amount | money:ctx.quote.to.currency}}.", "{{ctx.quote.from.amount | money:ctx.quote.from.currency}} کے بدلے {{ctx.quote.to.amount | money:ctx.quote.to.currency}} ملے۔"),
          meta: t("Ref {{conv.result.reference}}", "حوالہ {{conv.result.reference}}"),
        },
        { type: "button", label: t("Done", "مکمل"), variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: t("Not converted", "تبدیل نہیں ہوا"), kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: t("Not converted", "تبدیل نہیں ہوا"), text: t("No money has left your account. The rate may have run out: try again to get a new one.", "آپ کے اکاؤنٹ سے کوئی رقم نہیں کٹی۔ ہو سکتا ہے ریٹ ختم ہو گیا ہو: نیا ریٹ لینے کے لیے دوبارہ کوشش کریں۔") },
        { type: "button", label: t("Try again", "دوبارہ کوشش کریں"), variant: "primary", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
  ],
};
