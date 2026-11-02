import type { Journey } from "../schema";

const t = (en: string, ur: string) => ({ en, ur });

export const payBill: Journey = {
  id: "jrn_pay_bill",
  slug: "pay-a-bill",
  name: t("Pay a bill", "بل ادا کریں"),
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  locale: { default: "en", supported: ["en", "ur"], rtl: ["ur"] },
  entryScreen: "bill",
  dataModel: {
    "bill.billerId": { type: "string", required: true },
    "bill.reference": { type: "string", required: true, pattern: "^[0-9]{10,14}$" },
    "bill.fromAccountId": { type: "string", required: true },
    "bill.consent": { type: "boolean", required: true },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "billers", adapter: "bank.billers.list", mode: "sandbox" },
    { id: "billLookup", adapter: "bank.bills.lookup", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "billPay", adapter: "bank.bills.pay", mode: "sandbox" },
  ],
  screens: [
    {
      id: "bill",
      title: t("Pay a bill", "بل ادا کریں"),
      onEnter: [
        { type: "callApi", integration: "accounts", saveAs: "ctx.accounts" },
        { type: "callApi", integration: "billers", saveAs: "ctx.billers" },
      ],
      blocks: [
        { type: "stepper", steps: ["bill", "review", "otp"] },
        { type: "select", bind: "bill.billerId", label: t("Biller", "بل جاری کرنے والا"), source: "ctx.billers" },
        {
          type: "textInput", bind: "bill.reference", label: t("Consumer number", "کنزیومر نمبر"), placeholder: t("10 to 14 digits", "10 سے 14 ہندسے"), keyboard: "number",
          pattern: "^[0-9]{10,14}$", patternMessage: t("Enter 10 to 14 digits", "10 سے 14 ہندسے درج کریں"),
        },
        { type: "accountPicker", bind: "bill.fromAccountId", source: "ctx.accounts", showBalance: true },
        {
          type: "button", label: t("Find my bill", "میرا بل تلاش کریں"), variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "billLookup", input: { billerId: "{{bill.billerId}}", reference: "{{bill.reference}}" }, saveAs: "ctx.bill", onError: { showToast: t("We couldn't find that bill. Check the number and try again.", "یہ بل نہیں ملا۔ نمبر چیک کر کے دوبارہ کوشش کریں۔"), stay: true } },
            { type: "navigate", to: "review" },
          ],
        },
      ],
    },
    {
      id: "review",
      title: t("Review bill", "بل کا جائزہ"),
      blocks: [
        {
          type: "reviewSummary",
          rows: [
            { label: t("Biller", "بل جاری کرنے والا"), value: "{{ctx.bill.billerName}}" },
            { label: t("Consumer number", "کنزیومر نمبر"), value: "{{bill.reference}}" },
            { label: t("Due date", "آخری تاریخ"), value: "{{ctx.bill.dueDate}}" },
            { label: t("Amount due", "واجب الادا رقم"), value: "PKR {{ctx.bill.amount | money}}" },
          ],
        },
        {
          type: "consent", bind: "bill.consent", termsVersion: "bills-v2", text: t("I confirm I want to pay this bill", "میں اس بل کی ادائیگی کی تصدیق کرتا/کرتی ہوں"),
          validation: { mustBeTrue: true, messages: { mustBeTrue: t("Tick the confirmation first", "پہلے تصدیق کریں") } },
        },
        { type: "button", label: t("Confirm and send OTP", "تصدیق کریں اور OTP بھیجیں"), variant: "primary", actions: [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp" }, { type: "navigate", to: "otp" }] },
      ],
    },
    {
      id: "otp",
      title: t("Verify", "تصدیق"),
      blocks: [
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 60, hint: t("Enter the code sent to {{ctx.otp.maskedPhone}}", "{{ctx.otp.maskedPhone}} پر بھیجا گیا کوڈ درج کریں") },
        {
          type: "button", label: t("Pay now", "ابھی ادا کریں"), variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: t("Incorrect code", "غلط کوڈ"), stay: true, lockAfter: 3, lockTo: "failed" } },
            { type: "callApi", integration: "billPay", input: { billerId: "{{bill.billerId}}", reference: "{{bill.reference}}", amount: "{{ctx.bill.amount}}", fromAccountId: "{{bill.fromAccountId}}" }, saveAs: "result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: t("Bill paid", "بل ادا ہو گیا"), kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: t("Bill paid", "بل ادا ہو گیا"), text: t("PKR {{ctx.bill.amount | money}} to {{ctx.bill.billerName}}", "PKR {{ctx.bill.amount | money}} بنام {{ctx.bill.billerName}}"), meta: t("Ref {{result.reference}}", "حوالہ {{result.reference}}") },
        { type: "button", label: t("Done", "مکمل"), variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: t("Payment not completed", "ادائیگی مکمل نہیں ہوئی"), kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: t("Payment not completed", "ادائیگی مکمل نہیں ہوئی"), text: t("No money has left your account. Try again or contact support.", "آپ کے اکاؤنٹ سے کوئی رقم نہیں کٹی۔ دوبارہ کوشش کریں یا سپورٹ سے رابطہ کریں۔") },
        { type: "button", label: t("Try again", "دوبارہ کوشش کریں"), variant: "primary", actions: [{ type: "navigate", to: "bill" }] },
      ],
    },
  ],
};
