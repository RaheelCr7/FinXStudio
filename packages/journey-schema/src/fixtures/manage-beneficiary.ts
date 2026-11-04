import type { Journey } from "../schema";
import { manageBeneficiaryAcceptance, manageBeneficiaryScenarios } from "./manage-beneficiary-tests";

const toRoute = { navigate: "route" };
/** The kind of payee and where its account is, as a person reads them. */
const KIND = "{{ben.kind == 'internal' ? 'BankWorkx® customer' : (ben.kind == 'international' ? 'Abroad' : 'Another bank')}}";
const REGION = "{{ben.region == 'bw' ? 'BankWorkx®' : (ben.region == 'us' ? 'United States' : (ben.region == 'eu' ? 'Europe (SEPA)' : (ben.region == 'uk' ? 'United Kingdom' : (ben.region == 'me' ? 'Middle East' : 'Other countries (SWIFT)'))))}}";
/** Who the payee is: a customer of the bank is known by the name on its record, anyone else by what was typed. */
const WHO = "ben.kind == 'internal' ? ctx.v.registeredName : ben.name";
/** What the name check found, in the words of the review. A change of nickname or label alone does not repeat the check. */
const CHECKED = "{{ben.mode == 'edit' && ctx.v.sensitive == false ? 'Not repeated' : (ctx.check.result == 'match' ? 'Matches' : (ctx.check.result == 'close' ? 'Close, you continued' : (ctx.check.result == 'none' ? 'Does not match, you continued' : 'Could not be checked')))}}";

/** What a person typed, for the bank's checks. The bank decides what each region needs; the journey sends them all. */
const FIELDS = {
  payeeId: "{{ben.id}}", region: "{{ben.region}}", country: "{{ben.country}}", name: "{{ben.name}}", nickname: "{{ben.nickname}}", label: "{{ben.label}}",
  customerNo: "{{ben.customerNo}}", routing: "{{ben.routing}}", account: "{{ben.account}}", accountType: "{{ben.acctType}}", iban: "{{ben.iban}}", sort: "{{ben.sort}}", swift: "{{ben.swift}}",
};
/** The bank's option to switch the name check off, for the calls that check or save. */
const CHECK_INPUT = { ...FIELDS, skip: "{{opt.nameCheck == false}}" };
const SAVE_INPUT = { ...CHECK_INPUT, acknowledged: "{{ben.ack}}" };
const lockOnWrongCode = { showToast: "That code isn't right.", stay: true, lockAfter: 3, lockTo: "locked" };

/** Fills the form from a saved payee (a row of the list): the fields, and what the delete screen shows. */
const pickPayee = [
  { type: "setData", path: "ben.id", value: "{{item.id}}" },
  { type: "setData", path: "ben.kind", value: "{{item.kind}}" },
  { type: "setData", path: "ben.region", value: "{{item.region}}" },
  { type: "setData", path: "ben.country", value: "{{item.country}}" },
  { type: "setData", path: "ben.name", value: "{{item.displayName}}" },
  { type: "setData", path: "ben.nickname", value: "{{item.nickname}}" },
  { type: "setData", path: "ben.label", value: "{{item.label}}" },
  { type: "setData", path: "ben.customerNo", value: "{{item.customerNumber}}" },
  { type: "setData", path: "ben.routing", value: "{{item.routing}}" },
  { type: "setData", path: "ben.account", value: "{{item.accountNumber}}" },
  { type: "setData", path: "ben.acctType", value: "{{item.accountType ? item.accountType : 'checking'}}" },
  { type: "setData", path: "ben.iban", value: "{{item.iban}}" },
  { type: "setData", path: "ben.sort", value: "{{item.sortCode}}" },
  { type: "setData", path: "ben.swift", value: "{{item.swift}}" },
  { type: "setData", path: "ben.mask", value: "{{item.maskedNumber}}" },
  { type: "setData", path: "ben.bankName", value: "{{item.bank}}" },
  { type: "setData", path: "ben.nSched", value: "{{item.scheduledCount}}" },
  { type: "setData", path: "ben.schedText", value: "{{item.scheduledText}}" },
  { type: "setData", path: "ctx.error", value: null },
  { type: "navigate", to: "details" },
] as const;

/**
 * Add, edit or delete a payee (BankWorkx, Payments). A payee is a person or company the customer pays: another BankWorkx customer,
 * someone at another bank (United States, Europe, United Kingdom, Middle East) or abroad over SWIFT. The bank checks the details
 * and, for a bank payee, the name against the owner of the account. A new payee, or one whose bank details change, is limited to
 * 500.00 USD for 24 hours. Three options of the bank are plain data: opt.nameCheck, opt.allowCancelSchedules and opt.labels (on unless set to false).
 *
 * Built from the spec of the prototype with the blocks FinX has: launch values (a mode, a kind, a payee, a screen to return to)
 * cannot be passed in, so the journey always starts by asking what to do; the screen to return to and the Send money button
 * are not there (see docs/BANKWORKX.md).
 */
export const manageBeneficiary: Journey = {
  id: "jrn_manage_beneficiary",
  slug: "manage-beneficiary",
  name: "Add, edit or delete a payee",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: manageBeneficiaryAcceptance,
  scenarios: manageBeneficiaryScenarios,
  dataModel: {
    "ben.mode": { type: "string", required: true },
    "ben.kind": { type: "string", required: true },
    "ben.region": { type: "string" },
    "ben.country": { type: "string" },
    "ben.customerNo": { type: "string" },
    "ben.name": { type: "string" },
    "ben.nickname": { type: "string" },
    "ben.label": { type: "string" },
    "ben.routing": { type: "string" },
    "ben.account": { type: "string" },
    "ben.acctType": { type: "string" },
    "ben.iban": { type: "string" },
    "ben.sort": { type: "string" },
    "ben.swift": { type: "string" },
    "ben.ack": { type: "boolean" },
    "ben.consent": { type: "boolean", required: true },
    "ben.cancelSchedules": { type: "boolean" },
    // the bank's options, set by the bank: left alone they are on
    "opt.nameCheck": { type: "boolean" },
    "opt.allowCancelSchedules": { type: "boolean" },
    "opt.labels": { type: "boolean" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "payees", adapter: "bank.beneficiaries.list", mode: "sandbox" },
    { id: "validate", adapter: "bank.payees.validate", mode: "sandbox" },
    { id: "check", adapter: "bank.payees.check", mode: "sandbox" },
    { id: "save", adapter: "bank.payees.save", mode: "sandbox" },
    { id: "update", adapter: "bank.payees.update", mode: "sandbox" },
    { id: "remove", adapter: "bank.payees.delete", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
  ],
  screens: [
    {
      // loads the saved payees and clears the form, then asks what to do. Start again and Manage more come back here.
      id: "start", title: "Payees", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "payees", saveAs: "ctx.payees", onError: toRoute },
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "ben.mode", value: "" },
        { type: "setData", path: "ben.kind", value: "" },
        { type: "setData", path: "ben.region", value: "us" },
        { type: "setData", path: "ben.id", value: "" },
        { type: "setData", path: "ben.country", value: "" },
        { type: "setData", path: "ben.customerNo", value: "" },
        { type: "setData", path: "ben.name", value: "" },
        { type: "setData", path: "ben.nickname", value: "" },
        { type: "setData", path: "ben.label", value: "" },
        { type: "setData", path: "ben.routing", value: "" },
        { type: "setData", path: "ben.account", value: "" },
        { type: "setData", path: "ben.acctType", value: "checking" },
        { type: "setData", path: "ben.iban", value: "" },
        { type: "setData", path: "ben.sort", value: "" },
        { type: "setData", path: "ben.swift", value: "" },
        { type: "setData", path: "ben.ack", value: false },
        { type: "setData", path: "ben.consent", value: false },
        { type: "setData", path: "ben.cancelSchedules", value: false },
        { type: "setData", path: "otp.code", value: "" },
        { type: "navigate", to: "mode" },
      ],
      blocks: [],
    },
    {
      id: "mode", title: "Payees",
      blocks: [
        { type: "stepper", steps: ["mode", "pick", "type", "details", "check", "review", "otp"] },
        { type: "text", variant: "title", text: "What would you like to do?" },
        {
          type: "select", bind: "ben.mode", label: "I want to", variant: "chips",
          choices: [{ id: "add", label: "Add a payee" }, { id: "edit", label: "Edit a payee" }, { id: "delete", label: "Delete a payee" }],
        },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "pick" }] },
      ],
      navigation: { rules: [{ when: "ben.mode == 'add'", to: "type" }] },
    },
    {
      id: "pick", title: "Choose a payee",
      blocks: [
        { type: "text", variant: "title", text: "Choose a payee" },
        { type: "text", variant: "caption", text: "Pick the person you want to change.", visibleWhen: "ben.mode == 'edit'" },
        { type: "text", variant: "caption", text: "Pick the person you want to remove.", visibleWhen: "ben.mode == 'delete'" },
        { type: "text", variant: "title", text: "You haven't saved anyone yet", visibleWhen: "len(ctx.payees) == 0" },
        { type: "text", variant: "caption", text: "Add someone to pay them in two taps.", visibleWhen: "len(ctx.payees) == 0" },
        {
          type: "button", label: "Add a beneficiary", variant: "primary", visibleWhen: "len(ctx.payees) == 0",
          actions: [{ type: "setData", path: "ben.mode", value: "add" }, { type: "navigate", to: "type" }],
        },
        {
          // one row per saved payee: pressing it fills the form with that payee. The chip is Verified, Saved or New with the hours left.
          type: "menu", source: "ctx.payees", visibleWhen: "len(ctx.payees) > 0",
          item: {
            label: "{{item.nickname ? item.nickname + ' (' + item.displayName + ')' : item.displayName}}",
            text: "{{item.kind == 'internal' ? 'BankWorkx customer' : (item.kind == 'international' ? 'Abroad' : 'Another bank')}} · {{item.maskedNumber}}{{item.label ? ' · ' + item.label : ''}} · {{item.ageHours < 24 ? 'New · ' + item.coolingOffHoursLeft + ' hours left' : (item.verified ? 'Verified' : 'Saved')}}",
            actions: [...pickPayee],
          },
        },
      ],
      navigation: { rules: [{ when: "ben.mode == 'delete'", to: "delete" }] },
    },
    {
      id: "type", title: "Who do you want to pay?",
      blocks: [
        { type: "text", variant: "title", text: "Who do you want to pay?" },
        {
          type: "select", bind: "ben.kind", label: "Type of payee", variant: "tiles",
          choices: [
            { id: "internal", label: "BankWorkx® customer", text: "Free and instant" },
            { id: "domestic", label: "Another bank", text: "US, Europe, UK or Middle East" },
            { id: "international", label: "Abroad", text: "Other countries, over SWIFT" },
          ],
        },
        {
          type: "button", label: "Continue", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ben.region", value: "{{ben.kind == 'internal' ? 'bw' : (ben.kind == 'international' ? 'world' : 'us')}}" },
            { type: "setData", path: "ben.country", value: "" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "navigate", to: "details" },
          ],
        },
      ],
    },
    {
      id: "details", title: "Their details",
      blocks: [
        { type: "text", variant: "title", text: "Their details" },
        {
          type: "alert", tone: "info", visibleWhen: "ben.mode == 'edit'",
          text: "If you change the account details, we check the payee again and ask for a code, and {{ben.name}} counts as a new payee for 24 hours. You can send up to $500.00 in that time. If you change only the name, we check it again and ask for a code. Changing only the nickname or label does none of this.",
        },
        // what the bank refused, in its own words: a field that is wrong, a payee saved already, the limit of 50
        { type: "alert", tone: "error", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.integration == 'validate'" },
        {
          type: "select", bind: "ben.region", label: "Where is the account?", variant: "chips", visibleWhen: "ben.kind == 'domestic' && ben.mode == 'add'",
          choices: [{ id: "us", label: "United States" }, { id: "eu", label: "Europe (SEPA)" }, { id: "uk", label: "United Kingdom" }, { id: "me", label: "Middle East" }],
        },
        {
          type: "select", bind: "ben.country", label: "Country", variant: "dropdown", visibleWhen: "ben.region == 'me'",
          choices: [{ id: "AE", label: "United Arab Emirates" }, { id: "SA", label: "Saudi Arabia" }, { id: "JO", label: "Jordan" }],
        },
        {
          type: "select", bind: "ben.country", label: "Country", variant: "dropdown", visibleWhen: "ben.region == 'world'",
          choices: [
            { id: "DE", label: "Germany" }, { id: "CA", label: "Canada" }, { id: "IN", label: "India" }, { id: "JP", label: "Japan" }, { id: "AU", label: "Australia" },
            { id: "CH", label: "Switzerland" }, { id: "SG", label: "Singapore" }, { id: "MX", label: "Mexico" },
          ],
        },
        { type: "textInput", bind: "ben.customerNo", label: "BankWorkx® account number", placeholder: "Try 3301123308 or 3301554412", keyboard: "number", visibleWhen: "ben.region == 'bw'" },
        { type: "textInput", bind: "ben.name", label: "Name on the account", visibleWhen: "ben.region != 'bw'", pattern: "^.{0,70}$", patternMessage: "Use 70 characters or fewer." },
        { type: "textInput", bind: "ben.routing", label: "Routing number (ABA)", keyboard: "number", visibleWhen: "ben.region == 'us'" },
        { type: "textInput", bind: "ben.account", label: "Account number", keyboard: "number", visibleWhen: "ben.region == 'us'" },
        {
          type: "select", bind: "ben.acctType", label: "Account type", variant: "chips", visibleWhen: "ben.region == 'us'",
          choices: [{ id: "checking", label: "Checking" }, { id: "savings", label: "Savings" }],
        },
        { type: "textInput", bind: "ben.iban", label: "IBAN", visibleWhen: "ben.region == 'eu' || ben.region == 'me'" },
        { type: "text", variant: "caption", text: "Spaces are fine.", visibleWhen: "ben.region == 'eu' || ben.region == 'me'" },
        { type: "textInput", bind: "ben.sort", label: "Sort code", placeholder: "20-00-00", keyboard: "number", visibleWhen: "ben.region == 'uk'" },
        { type: "textInput", bind: "ben.account", label: "Account number", keyboard: "number", visibleWhen: "ben.region == 'uk'" },
        { type: "textInput", bind: "ben.swift", label: "SWIFT / BIC", visibleWhen: "ben.region == 'world'" },
        { type: "textInput", bind: "ben.account", label: "Account number or IBAN", visibleWhen: "ben.region == 'world'" },
        { type: "textInput", bind: "ben.nickname", label: "Nickname", placeholder: "Optional, for example “Mum”", pattern: "^.{0,24}$", patternMessage: "Use 24 characters or fewer." },
        { type: "text", variant: "caption", text: "Up to 24 characters. Only you see it." },
        {
          type: "select", bind: "ben.label", label: "Label", variant: "chips", visibleWhen: "opt.labels != false",
          choices: [{ id: "Family", label: "Family" }, { id: "Friend", label: "Friend" }, { id: "Landlord", label: "Landlord" }, { id: "Business", label: "Business" }, { id: "Other", label: "Other" }],
        },
        {
          type: "button", label: "Check details", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "validate", input: { ...FIELDS }, saveAs: "ctx.v", onError: toRoute },
            { type: "navigate", to: "check" },
          ],
        },
      ],
      // a change of nickname or label alone is saved without the name check and without a code
      navigation: { rules: [{ when: "ben.mode == 'edit' && ctx.v.sensitive == false", to: "review" }] },
    },
    {
      id: "check", title: "Check the payee",
      onEnter: [
        { type: "setData", path: "ben.ack", value: false },
        { type: "callApi", integration: "check", input: { ...CHECK_INPUT }, saveAs: "ctx.check", onError: toRoute },
      ],
      blocks: [
        { type: "text", variant: "title", text: "Check the payee" },
        { type: "text", variant: "caption", text: "{{ctx.check.label}}" },
        { type: "alert", tone: "success", text: "✓ Found: {{ctx.v.found}}", visibleWhen: "ctx.check.result == 'match' && ben.kind == 'internal'" },
        { type: "alert", tone: "success", text: "The name matches the account: {{ctx.check.registeredName}}.", visibleWhen: "ctx.check.result == 'match' && ben.kind != 'internal'" },
        {
          type: "alert", tone: "warning", visibleWhen: "ctx.check.result == 'close'",
          text: "The name is close to the one on the account: “{{ctx.check.registeredName}}”. Use the name on the account, or continue with the name you typed.",
        },
        { type: "alert", tone: "error", visibleWhen: "ctx.check.result == 'none'", text: "The name you typed does not match the account holder. Check it before you send money to this payee." },
        { type: "alert", tone: "info", visibleWhen: "ctx.check.result == 'na'", text: "We couldn't check the name for this account. Make sure you know and trust this person." },
        {
          type: "button", label: "Use “{{ctx.check.registeredName}}”", variant: "secondary", visibleWhen: "ctx.check.result == 'close'",
          // the check runs again with the name on the account, so the answer shown is the bank's, not ours
          actions: [{ type: "setData", path: "ben.name", value: "{{ctx.check.registeredName}}" }, { type: "navigate", to: "check" }],
        },
        {
          type: "consent", bind: "ben.ack", termsVersion: "manage-beneficiary-v1", text: "I understand and want to continue", visibleWhen: "ctx.check.result != 'match'",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Check the payee before you continue." } },
        },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
    },
    {
      id: "review", title: "Check before you save",
      blocks: [
        { type: "text", variant: "title", text: "Check before you save" },
        {
          type: "alert", tone: "warning", visibleWhen: "ben.mode == 'add' || ctx.v.restartsClock == true",
          text: "For your security, you can send up to $500.00 to a new payee in the first 24 hours.",
        },
        {
          type: "reviewSummary",
          rows: [
            { label: "Type", value: KIND },
            { label: "Region", value: REGION },
            { label: "Name", value: `{{${WHO}}}` },
            { label: "Nickname", value: "{{ben.nickname ? ben.nickname : '-'}}" },
            { label: "Label", value: "{{ben.label ? ben.label : '-'}}" },
            { label: "Account", value: "{{ctx.v.maskedNumber}}" },
            { label: "Bank", value: "{{ctx.v.bankName}}" },
            { label: "Name check", value: CHECKED },
          ],
        },
        {
          type: "consent", bind: "ben.consent", termsVersion: "manage-beneficiary-v1", text: "I confirm these details are correct and I know this person",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick to confirm." } },
        },
        {
          type: "button", label: "Save and send code", variant: "primary", visibleWhen: "ben.mode == 'add' || ctx.v.sensitive == true",
          actions: [
            { type: "validate" },
            { type: "setData", path: "otp.code", value: "" },
            { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
            { type: "navigate", to: "otp" },
          ],
        },
        {
          // only a nickname or a label changed: no code
          type: "button", label: "Save changes", variant: "primary", visibleWhen: "ben.mode == 'edit' && ctx.v.sensitive == false",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "update", input: { ...SAVE_INPUT }, saveAs: "ben.result", onError: toRoute },
            { type: "navigate", to: "result" },
          ],
        },
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: `Authorise saving {{${WHO}}}` },
        { type: "text", variant: "caption", text: "It only works for this change." },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        {
          type: "button", variant: "primary", label: "Save payee", visibleWhen: "ben.mode == 'add'",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            { type: "callApi", integration: "save", input: { ...SAVE_INPUT }, saveAs: "ben.result", onError: toRoute },
            { type: "navigate", to: "result" },
          ],
        },
        {
          type: "button", variant: "primary", label: "Save the changes", visibleWhen: "ben.mode == 'edit'",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            { type: "callApi", integration: "update", input: { ...SAVE_INPUT }, saveAs: "ben.result", onError: toRoute },
            { type: "navigate", to: "result" },
          ],
        },
      ],
    },
    {
      id: "delete", title: "Delete payee",
      blocks: [
        { type: "text", variant: "title", text: "Delete payee" },
        { type: "alert", tone: "error", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.code == 'BENEFICIARY_IN_USE'" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Payee", value: "{{ben.nickname ? ben.nickname + ' (' + ben.name + ')' : ben.name}}" },
            { label: "Account", value: "{{ben.mask}}" },
            { label: "Bank", value: "{{ben.bankName}}" },
          ],
        },
        { type: "text", variant: "body", text: "You won't be able to send money to {{ben.name}} from your saved list. Payments already sent are not affected." },
        { type: "text", variant: "body", text: "Used by: {{ben.schedText}}", visibleWhen: "ben.nSched > 0" },
        {
          type: "toggle", bind: "ben.cancelSchedules", label: "Also cancel these scheduled payments", helper: "They will not run again. Payments already sent are not affected.",
          visibleWhen: "ben.nSched > 0 && opt.allowCancelSchedules != false",
        },
        { type: "text", variant: "caption", text: "Cancel these in Payments › Scheduled first.", visibleWhen: "ben.nSched > 0 && opt.allowCancelSchedules == false" },
        {
          type: "button", label: "Delete payee", variant: "primary",
          actions: [
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "remove", input: { payeeId: "{{ben.id}}", cancelSchedules: "{{ben.cancelSchedules}}" }, saveAs: "ben.result", onError: toRoute },
            { type: "navigate", to: "result" },
          ],
        },
        { type: "button", label: "Choose another payee", variant: "ghost", actions: [{ type: "navigate", to: "pick" }] },
      ],
    },
    {
      // after a failed bank call: where to go depends on what the bank said (ctx.error)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.code == 'TIMEOUT'", to: "timeout" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: "ctx.error.code == 'BENEFICIARY_NOT_FOUND'", to: "failed" },
          { when: "ctx.error.code == 'BENEFICIARY_IN_USE'", to: "delete" },
          { when: "ctx.error.integration == 'validate'", to: "details" },
        ],
      },
    },
    {
      // Try again after a timeout or an unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "review" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'payees'", to: "start" },
          { when: "ctx.error.integration == 'validate' || ctx.error.integration == 'check'", to: "details" },
          { when: "ctx.error.integration == 'remove'", to: "delete" },
        ],
      },
    },
    {
      id: "result", title: "Done", kind: "terminal",
      blocks: [
        {
          type: "result", tone: "success", title: "Saved", visibleWhen: "ben.mode == 'add'",
          text: "{{ben.result.displayName}} is saved as {{ben.result.verified ? 'Verified' : 'Saved'}}. For your security you can send up to $500.00 in the first 24 hours.",
        },
        {
          type: "reviewSummary", visibleWhen: "ben.mode == 'add'",
          rows: [
            { label: "Payee", value: "{{ben.result.displayName}}" },
            { label: "Account", value: "{{ben.result.maskedNumber}}" },
            { label: "Bank", value: "{{ben.result.bank}}" },
            { label: "Name check", value: "{{ben.result.nameCheck == 'match' ? 'Matches' : (ben.result.nameCheck == 'close' ? 'Close, you continued' : (ben.result.nameCheck == 'none' ? 'Does not match, you continued' : 'Could not be checked'))}}" },
            { label: "Limit", value: "$500.00 for 24 hours" },
          ],
        },
        {
          type: "result", tone: "success", title: "Changes saved", visibleWhen: "ben.mode == 'edit'",
          text: "{{ben.result.restarted ? ben.result.displayName + ' is a new payee again for 24 hours. You can send up to $500.00 in that time.' : ben.result.displayName + ' was updated.'}}",
          meta: "{{ben.result.sensitive ? 'Checked again' : ''}}",
        },
        { type: "result", tone: "success", title: "Payee deleted", visibleWhen: "ben.mode == 'delete'", text: "{{ben.result.displayName}} was removed from your payees." },
        {
          type: "reviewSummary", visibleWhen: "ben.mode == 'delete'",
          rows: [
            { label: "Payee", value: "{{ben.result.displayName}}" },
            { label: "Account", value: "{{ben.result.maskedNumber}}" },
            { label: "Scheduled payments cancelled", value: "{{ben.result.schedulesCancelled}}" },
          ],
        },
        // Payments is a screen of the app, not of this journey: leaving the journey takes the person back to the app
        { type: "button", label: "Payments", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Manage more payees", variant: "secondary", actions: [{ type: "navigate", to: "start" }] },
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "You entered the wrong code 3 times, so we stopped. Nothing was saved." },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "This is taking longer than expected. Nothing was changed." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Service not available", text: "We couldn't reach the bank. Nothing was changed." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Back", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not saved", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We can't find that payee.", text: "Nothing was changed.", visibleWhen: "ctx.error.code == 'BENEFICIARY_NOT_FOUND'" },
        { type: "result", tone: "error", title: "We couldn't confirm this change.", text: "Nothing was saved. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID'" },
        {
          type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was changed.",
          visibleWhen: "ctx.error.code != 'BENEFICIARY_NOT_FOUND' && ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID'",
        },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
