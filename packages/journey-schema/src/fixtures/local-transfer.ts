import type { Journey } from "../schema";

const t = (en: string, ur: string) => ({ en, ur });

export const localTransfer: Journey = {
  id: "jrn_fund_transfer_local",
  slug: "fund-transfer-local",
  name: t("Send to beneficiary", "وصول کنندہ کو بھیجیں"),
  version: 5,
  status: "published",
  channels: ["web", "mobile"],
  locale: { default: "en", supported: ["en", "ur"], rtl: ["ur"] },
  entryScreen: "account",
  dataModel: {
    "transfer.fromAccountId": { type: "string", required: true },
    "transfer.beneficiaryId": { type: "string", required: true },
    "transfer.amount": { type: "money", currency: "PKR", required: true },
    "transfer.purpose": { type: "string", required: true },
    "transfer.consent": { type: "boolean", required: true },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "beneficiaries", adapter: "bank.beneficiaries.list", mode: "sandbox" },
    { id: "limits", adapter: "bank.limits.get", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "transfer", adapter: "bank.transfers.create", mode: "sandbox" },
  ],
  screens: [
    {
      id: "account",
      title: t("From account", "کس اکاؤنٹ سے"),
      onEnter: [
        { type: "callApi", integration: "accounts", saveAs: "ctx.accounts" },
        { type: "callApi", integration: "limits", saveAs: "ctx.limits" },
      ],
      blocks: [
        { type: "stepper", steps: ["account", "beneficiary", "amount", "review", "otp"] },
        { type: "accountPicker", bind: "transfer.fromAccountId", source: "ctx.accounts", showBalance: true },
        { type: "button", label: t("Continue", "جاری رکھیں"), variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "beneficiary" }] },
      ],
    },
    {
      id: "beneficiary",
      title: t("Beneficiary", "وصول کنندہ"),
      onEnter: [{ type: "callApi", integration: "beneficiaries", saveAs: "ctx.beneficiaries" }],
      blocks: [
        { type: "beneficiaryPicker", bind: "transfer.beneficiaryId", source: "ctx.beneficiaries", allowAddNew: true },
        { type: "button", label: t("Continue", "جاری رکھیں"), variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "amount",
      title: t("Amount", "رقم"),
      blocks: [
        {
          type: "amountInput", bind: "transfer.amount", currency: "PKR", label: t("Amount", "رقم"),
          helper: t("Daily limit PKR {{ctx.limits.daily | money}} · used PKR {{ctx.limits.usedToday | money}}", "یومیہ حد PKR {{ctx.limits.daily | money}} · استعمال PKR {{ctx.limits.usedToday | money}}"),
          validation: { min: 1, max: "ctx.accounts[transfer.fromAccountId].balance", messages: { max: t("Amount is more than your available balance", "رقم آپ کے دستیاب بیلنس سے زیادہ ہے") } },
        },
        { type: "select", bind: "transfer.purpose", label: t("Purpose", "مقصد"), options: ["Family support", "Rent", "Education", "Business", "Other"] },
        { type: "button", label: t("Continue", "جاری رکھیں"), variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
      navigation: { rules: [{ when: "transfer.amount > (ctx.limits.daily - ctx.limits.usedToday)", to: "limitExceeded" }], default: "review" },
    },
    {
      id: "limitExceeded",
      title: t("Limit exceeded", "حد سے زیادہ"),
      kind: "branch",
      blocks: [
        { type: "alert", tone: "warning", text: t("PKR {{transfer.amount | money}} is above your remaining daily limit.", "PKR {{transfer.amount | money}} آپ کی بقیہ یومیہ حد سے زیادہ ہے۔") },
        { type: "button", label: t("Change amount", "رقم تبدیل کریں"), variant: "primary", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "review",
      title: t("Review transfer", "ٹرانسفر کا جائزہ"),
      blocks: [
        {
          type: "reviewSummary",
          rows: [
            { label: t("From", "سے"), value: "{{ctx.accounts[transfer.fromAccountId].maskedNumber}}" },
            { label: t("To", "کو"), value: "{{ctx.beneficiaries[transfer.beneficiaryId].displayName}}" },
            { label: t("Amount", "رقم"), value: "PKR {{transfer.amount | money}}" },
            { label: t("Fee", "فیس"), value: "PKR 0" },
          ],
        },
        {
          type: "consent", bind: "transfer.consent", termsVersion: "transfers-v3",
          text: t("I confirm the details are correct", "میں تصدیق کرتا/کرتی ہوں کہ تفصیلات درست ہیں"),
          validation: { mustBeTrue: true, messages: { mustBeTrue: t("Tick the confirmation first", "پہلے تصدیق کریں") } },
        },
        {
          type: "button", label: t("Confirm and send OTP", "تصدیق کریں اور OTP بھیجیں"), variant: "primary",
          actions: [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp" }, { type: "navigate", to: "otp" }],
        },
      ],
    },
    {
      id: "otp",
      title: t("Verify", "تصدیق"),
      blocks: [
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 60, hint: t("Enter the code sent to {{ctx.otp.maskedPhone}}", "{{ctx.otp.maskedPhone}} پر بھیجا گیا کوڈ درج کریں"), onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" } }] },
        {
          type: "button", label: t("Verify and send", "تصدیق کریں اور بھیجیں"), variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: t("Incorrect code", "غلط کوڈ"), stay: true, lockAfter: 3, lockTo: "failed" } },
            { type: "callApi", integration: "transfer", input: { fromAccountId: "{{transfer.fromAccountId}}", beneficiaryId: "{{transfer.beneficiaryId}}", amount: "{{transfer.amount}}", purpose: "{{transfer.purpose}}" }, saveAs: "result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success",
      title: t("Transfer sent", "ٹرانسفر بھیج دیا گیا"),
      kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: t("Transfer sent", "ٹرانسفر بھیج دیا گیا"), text: t("PKR {{transfer.amount | money}} to {{ctx.beneficiaries[transfer.beneficiaryId].displayName}}", "PKR {{transfer.amount | money}} بنام {{ctx.beneficiaries[transfer.beneficiaryId].displayName}}"), meta: t("Ref {{result.reference}}", "حوالہ {{result.reference}}") },
        { type: "button", label: t("Done", "مکمل"), variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed",
      title: t("Transfer not completed", "ٹرانسفر مکمل نہیں ہوا"),
      kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: t("Transfer not completed", "ٹرانسفر مکمل نہیں ہوا"), text: t("No money has left your account. Try again or contact support.", "آپ کے اکاؤنٹ سے کوئی رقم نہیں کٹی۔ دوبارہ کوشش کریں یا سپورٹ سے رابطہ کریں۔") },
        { type: "button", label: t("Try again", "دوبارہ کوشش کریں"), variant: "primary", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
  ],
};
