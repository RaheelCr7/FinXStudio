import type { Journey } from "../schema";
import { personalTransferAcceptance, personalTransferScenarios } from "./personal-transfer-tests";

const toRoute = { navigate: "route" };
const lockOnWrongCode = { showToast: "That code isn't right.", stay: true, lockAfter: 3, lockTo: "locked" };

/** The countries a payment can go to, and what each one asks for (the bank's country table). */
const COUNTRIES = [
  ["AU", "Australia"], ["CA", "Canada"], ["FR", "France"], ["DE", "Germany"], ["IN", "India"], ["IE", "Ireland"], ["IT", "Italy"], ["JP", "Japan"], ["JO", "Jordan"],
  ["MX", "Mexico"], ["NL", "Netherlands"], ["SA", "Saudi Arabia"], ["SG", "Singapore"], ["ES", "Spain"], ["CH", "Switzerland"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"],
] as const;
/** The country's name as an expression, so the review shows "Germany", not "DE". */
const COUNTRY_NAME = COUNTRIES.reduceRight<string>((rest, [id, label]) => `pt.country == '${id}' ? '${label}' : ${rest}`, "pt.country");
const is = (...codes: string[]) => codes.map((c) => `pt.country == '${c}'`).join(" || ");
const IBAN = `(${is("DE", "FR", "ES", "IT", "IE", "NL", "CH", "GB", "JO", "SA", "AE")})`;
const PLAIN = `(${is("AU", "CA", "IN", "JP", "SG")})`;
const MEXICO = "pt.country == 'MX'";

const DOMESTIC = "pt.type == 'domestic'", INTL = "pt.type == 'international'", INTERNAL = "pt.type == 'internal'";
const NEW_PAYEE = "pt.payeeId == ''";
const HOME = "ctx.accounts[pt.from].currency";
const ACCT = "{{ctx.accounts[pt.from].name}} {{ctx.accounts[pt.from].maskedNumber}}";
/** What the payee gets, as the hero and the code read it. */
const RECEIVE = "{{ctx.quote.receive.amount | money2:ctx.quote.receive.currency}}";
const LATER = "pt.when == 'later' && pt.type != 'internal'";

/** What the bank is told about the payment. The bank's options are plain data (on unless set to false; Priority and who pays the charges are off unless true). */
const QUOTE_INPUT = {
  fromAccountId: "{{pt.from}}", payeeId: "{{pt.payeeId}}", sendType: "{{pt.type}}", currency: "{{pt.ccy}}", country: "{{pt.country}}", payeeName: "{{pt.payeeName}}", payeeKey: "{{pt.key}}",
  receiveAmount: "{{pt.amount}}", speed: "{{pt.speed}}", standard: "{{opt.speedStandard != false}}", sameDay: "{{opt.speedSameDay != false}}", instant: "{{opt.speedInstant != false}}", priority: "{{opt.speedPriority == true}}",
  chargeChoice: "{{opt.chargeChoice == true}}", chargeBearer: "{{pt.charges}}", coolingOff: "{{opt.coolingOff != false}}", purpose: "{{pt.purpose}}",
  street: "{{pt.street}}", city: "{{pt.city}}", relationship: "{{pt.relationship}}",
};
/** What a new payee is checked and saved with. */
const PAYEE_FIELDS = {
  region: "{{pt.type == 'internal' ? 'bw' : (pt.type == 'domestic' ? 'us' : 'world')}}", country: "{{pt.country}}", name: "{{pt.name}}", customerNo: "{{pt.customerNo}}",
  routing: "{{pt.routing}}", account: "{{pt.account}}", accountType: "{{pt.acctType}}", swift: "{{pt.swift}}", bankCode: "{{pt.bankCode}}", strict: true,
};
const NAME_PATTERN = "^[A-Za-z0-9][A-Za-z0-9 .,'’&()/-]{1,69}$", NAME_MESSAGE = "Use letters, numbers and spaces in the name.";
const REF_CHARS = "A-Za-z0-9 .,'/()+:?-";
const PURPOSES = ["Family support", "Goods or services", "Salary", "Rent", "Education", "Savings or investment", "Other"];
const RELATIONSHIPS = ["Myself", "Family member", "Friend", "My employer", "Supplier or business", "Landlord", "School or university", "Other"];
const choices = (list: string[]) => list.map((l) => ({ id: l, label: l }));
/** The money that goes into a review or a receipt. */
const feeAndTotal = [{ label: "Fee", value: "{{ctx.quote.feeText}}" }, { label: "You pay", value: "{{ctx.quote.total | money2:ctx.quote.currency}}" }];

/**
 * Send money (BankWorkx, Payments). Money to a BankWorkx customer, to a person at another bank, or to another country: pick or add the payee, enter
 * the amount, choose how fast, see the fee, the rate and the arrival, confirm with a one-time code. A payee typed in the flow can be saved (new for
 * 24 hours: up to 500.00 USD). The bank's options are plain data (opt.*, on unless set to false): the three types, the three speeds, "Later", and the
 * new-payee limit; Priority and "who pays the charges" are off unless set to true.
 *
 * Built from the spec of the prototype with the blocks FinX has: "Between my accounts" stays its own journey (own-transfer), launch values, live
 * speed cards and per-field messages from the bank are not there, and only the first home market (routing number and account) is configured
 * (see docs/BANKWORKX.md).
 */
export const personalTransfer: Journey = {
  id: "jrn_personal_transfer",
  slug: "personal-transfer",
  name: "Send money",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: personalTransferAcceptance,
  scenarios: personalTransferScenarios,
  dataModel: {
    "pt.type": { type: "string" },
    "pt.payeeId": { type: "string" },
    "pt.payeeName": { type: "string" },
    "pt.mask": { type: "string" },
    "pt.bankName": { type: "string" },
    "pt.ccy": { type: "string" },
    "pt.country": { type: "string", required: true },
    "pt.key": { type: "string" },
    "pt.hours": { type: "number" },
    "pt.by": { type: "string" },
    "pt.mobile": { type: "string", required: true },
    "pt.email": { type: "string", required: true },
    "pt.bwid": { type: "string", required: true },
    "pt.customerNo": { type: "string" },
    "pt.name": { type: "string", required: true },
    "pt.routing": { type: "string", required: true },
    "pt.account": { type: "string", required: true },
    "pt.acctType": { type: "string" },
    "pt.swift": { type: "string", required: true },
    "pt.bankCode": { type: "string", required: true },
    "pt.from": { type: "string", required: true },
    "pt.amount": { type: "money", required: true, currency: "{{pt.ccy}}" },
    "pt.purpose": { type: "string" },
    "pt.charges": { type: "string" },
    "pt.reference": { type: "string" },
    "pt.street": { type: "string", required: true },
    "pt.city": { type: "string", required: true },
    "pt.postcode": { type: "string" },
    "pt.relationship": { type: "string", required: true },
    "pt.speed": { type: "string" },
    "pt.when": { type: "string" },
    "pt.sendOn": { type: "string", required: true },
    "pt.repeat": { type: "string" },
    "pt.save": { type: "boolean" },
    "pt.consent": { type: "boolean", required: true },
    "pt.moved": { type: "boolean" },
    // the bank's options, set by the bank: left alone they are on (Priority and who pays the charges: off)
    "opt.typeInternal": { type: "boolean" },
    "opt.typeDomestic": { type: "boolean" },
    "opt.typeIntl": { type: "boolean" },
    "opt.speedStandard": { type: "boolean" },
    "opt.speedSameDay": { type: "boolean" },
    "opt.speedInstant": { type: "boolean" },
    "opt.speedPriority": { type: "boolean" },
    "opt.chargeChoice": { type: "boolean" },
    "opt.allowLater": { type: "boolean" },
    "opt.coolingOff": { type: "boolean" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "payees", adapter: "bank.beneficiaries.list", mode: "sandbox" },
    { id: "lookup", adapter: "bank.payees.lookup", mode: "sandbox" },
    { id: "validate", adapter: "bank.payees.validate", mode: "sandbox" },
    { id: "quote", adapter: "bank.payments.quote", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "pay", adapter: "bank.payments.create", mode: "sandbox" },
  ],
  screens: [
    {
      // loads the accounts that can pay someone else and clears the form, then asks how to send. Start again and Send another come back here.
      id: "start", title: "Send money", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "accounts", input: { homeOnly: true }, saveAs: "ctx.accounts", onError: toRoute },
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "pt.from", value: "acc_main" },
        { type: "setData", path: "pt.type", value: "" },
        { type: "setData", path: "pt.payeeId", value: "" },
        { type: "setData", path: "pt.payeeName", value: "" },
        { type: "setData", path: "pt.mask", value: "" },
        { type: "setData", path: "pt.bankName", value: "" },
        { type: "setData", path: "pt.ccy", value: "" },
        { type: "setData", path: "pt.country", value: "" },
        { type: "setData", path: "pt.key", value: "" },
        { type: "setData", path: "pt.hours", value: 0 },
        { type: "setData", path: "pt.by", value: "mobile" },
        { type: "setData", path: "pt.mobile", value: "" },
        { type: "setData", path: "pt.email", value: "" },
        { type: "setData", path: "pt.bwid", value: "" },
        { type: "setData", path: "pt.customerNo", value: "" },
        { type: "setData", path: "pt.name", value: "" },
        { type: "setData", path: "pt.routing", value: "" },
        { type: "setData", path: "pt.account", value: "" },
        { type: "setData", path: "pt.acctType", value: "checking" },
        { type: "setData", path: "pt.swift", value: "" },
        { type: "setData", path: "pt.bankCode", value: "" },
        { type: "setData", path: "pt.amount", value: null },
        { type: "setData", path: "pt.purpose", value: "" },
        { type: "setData", path: "pt.charges", value: "shared" },
        { type: "setData", path: "pt.reference", value: "" },
        { type: "setData", path: "pt.street", value: "" },
        { type: "setData", path: "pt.city", value: "" },
        { type: "setData", path: "pt.postcode", value: "" },
        { type: "setData", path: "pt.relationship", value: "" },
        { type: "setData", path: "pt.speed", value: "" },
        { type: "setData", path: "pt.when", value: "now" },
        { type: "setData", path: "pt.sendOn", value: "" },
        { type: "setData", path: "pt.repeat", value: "none" },
        { type: "setData", path: "pt.save", value: true },
        { type: "setData", path: "pt.consent", value: false },
        { type: "setData", path: "pt.moved", value: false },
        { type: "setData", path: "otp.code", value: "" },
        { type: "navigate", to: "type" },
      ],
      blocks: [],
    },
    {
      id: "type", title: "Send money",
      blocks: [
        { type: "stepper", steps: ["type", "payee", "details", "amount", "options", "review", "otp"] },
        { type: "text", variant: "title", text: "Send money" },
        { type: "text", variant: "caption", text: "Choose how to send.", visibleWhen: "opt.typeInternal != false || opt.typeDomestic != false || opt.typeIntl != false" },
        // one row for each way to send that the bank has on
        {
          type: "menu", visibleWhen: "opt.typeInternal != false",
          items: [{ id: "internal", label: "To a BankWorkx® customer", text: "Free and instant", actions: [{ type: "setData", path: "pt.type", value: "internal" }, { type: "setData", path: "pt.when", value: "now" }, { type: "navigate", to: "payeeList" }] }],
        },
        {
          type: "menu", visibleWhen: "opt.typeDomestic != false",
          items: [{ id: "domestic", label: "To another bank", text: "A person or company at another bank", actions: [{ type: "setData", path: "pt.type", value: "domestic" }, { type: "navigate", to: "payeeList" }] }],
        },
        {
          type: "menu", visibleWhen: "opt.typeIntl != false",
          items: [{ id: "international", label: "To another country", text: "Over the international network", actions: [{ type: "setData", path: "pt.type", value: "international" }, { type: "navigate", to: "payeeList" }] }],
        },
        { type: "text", variant: "title", text: "Nothing to send with", visibleWhen: "opt.typeInternal == false && opt.typeDomestic == false && opt.typeIntl == false" },
        { type: "text", variant: "body", text: "Sending money isn’t available right now.", visibleWhen: "opt.typeInternal == false && opt.typeDomestic == false && opt.typeIntl == false" },
        { type: "button", label: "Continue", variant: "primary", visibleWhen: "opt.typeInternal == false && opt.typeDomestic == false && opt.typeIntl == false", actions: [{ type: "exit" }] },
      ],
    },
    {
      // the saved payees of this kind of payment; with none, straight to a new payee
      id: "payeeList", title: "Who are you paying?", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "payees", input: { sendType: "{{pt.type}}" }, saveAs: "ctx.payees", onError: toRoute },
        { type: "setData", path: "pt.payeeId", value: "" },
        { type: "setData", path: "ctx.error", value: null },
        { type: "navigate", to: "payee" },
      ],
      blocks: [],
      navigation: { rules: [{ when: "len(ctx.payees) == 0", to: "details" }] },
    },
    {
      id: "payee", title: "Who are you paying?",
      blocks: [
        { type: "text", variant: "title", text: "Who are you paying?" },
        {
          // one row per saved payee: pressing it chooses them. A payee added in the last 24 hours says how long it is new.
          type: "menu", source: "ctx.payees",
          item: {
            label: "{{item.nickname ? item.nickname + ' (' + item.displayName + ')' : item.displayName}}",
            text: "{{item.maskedNumber}} · {{item.bank}}{{item.ageHours < 24 ? ' · New · ' + item.coolingOffHoursLeft + ' hours left' : ''}}",
            actions: [
              { type: "setData", path: "pt.payeeId", value: "{{item.id}}" },
              { type: "setData", path: "pt.payeeName", value: "{{item.displayName}}" },
              { type: "setData", path: "pt.mask", value: "{{item.maskedNumber}}" },
              { type: "setData", path: "pt.bankName", value: "{{item.bank}}" },
              { type: "setData", path: "pt.ccy", value: `{{item.currency ? item.currency : ${HOME}}}` },
              { type: "setData", path: "pt.country", value: "{{item.country}}" },
              { type: "setData", path: "pt.hours", value: "{{item.coolingOffHoursLeft}}" },
              { type: "setData", path: "pt.key", value: "" },
              { type: "navigate", to: "amount" },
            ],
          },
        },
        { type: "button", label: "New payee", variant: "secondary", actions: [{ type: "setData", path: "pt.payeeId", value: "" }, { type: "navigate", to: "details" }] },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "type" }] },
      ],
    },
    {
      id: "details", title: "Payee details",
      blocks: [
        { type: "text", variant: "title", text: "Payee details" },
        // what the bank refused, in its own words: a customer it cannot find, a payee saved already, a field that is wrong
        { type: "alert", tone: "error", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.integration == 'lookup' || ctx.error.integration == 'validate'" },

        // a BankWorkx® customer, found by mobile number, email or BankWorkx ID
        { type: "select", bind: "pt.by", label: "Find them by", variant: "chips", visibleWhen: INTERNAL, choices: [{ id: "mobile", label: "Mobile" }, { id: "email", label: "Email" }, { id: "id", label: "BankWorkx ID" }] },
        { type: "textInput", bind: "pt.mobile", label: "Mobile number", keyboard: "phone", placeholder: "+1 202 555 0100", visibleWhen: `${INTERNAL} && pt.by == 'mobile'`, pattern: "^\\+?[\\d\\s()-]{8,20}$", patternMessage: "Enter the mobile number with its country code." },
        { type: "textInput", bind: "pt.email", label: "Email", keyboard: "email", visibleWhen: `${INTERNAL} && pt.by == 'email'`, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", patternMessage: "Enter a full email address." },
        { type: "textInput", bind: "pt.bwid", label: "BankWorkx ID", visibleWhen: `${INTERNAL} && pt.by == 'id'`, pattern: "^[A-Za-z0-9._-]{3,24}$", patternMessage: "A BankWorkx ID has 3 to 24 letters, numbers, dots or dashes." },

        // another bank (the first home market: routing number and account)
        { type: "textInput", bind: "pt.name", label: "Name", visibleWhen: "pt.type != 'internal'", pattern: NAME_PATTERN, patternMessage: NAME_MESSAGE },
        { type: "textInput", bind: "pt.routing", label: "Routing number", placeholder: "9 digits", keyboard: "number", visibleWhen: DOMESTIC, pattern: "^[0-9]{9}$", patternMessage: "That routing number isn’t valid. Check the 9 digits." },
        { type: "textInput", bind: "pt.account", label: "Account number", keyboard: "number", visibleWhen: DOMESTIC, pattern: "^[0-9]{4,17}$", patternMessage: "An account number has 4 to 17 digits." },
        { type: "select", bind: "pt.acctType", label: "Account type", variant: "chips", visibleWhen: DOMESTIC, choices: [{ id: "checking", label: "Checking" }, { id: "savings", label: "Savings" }] },

        // another country
        { type: "select", bind: "pt.country", label: "Country", variant: "dropdown", visibleWhen: INTL, choices: COUNTRIES.map(([id, label]) => ({ id, label })) },
        { type: "textInput", bind: "pt.account", label: "IBAN", visibleWhen: `${INTL} && ${IBAN}`, pattern: "^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9 ]{10,32}$", patternMessage: "That IBAN doesn’t look right. Check each character." },
        { type: "textInput", bind: "pt.account", label: "Account number", visibleWhen: `${INTL} && ${PLAIN}`, pattern: "^[A-Za-z0-9 -]{6,34}$", patternMessage: "That account number looks too short or too long." },
        { type: "textInput", bind: "pt.account", label: "Account number", keyboard: "number", visibleWhen: `${INTL} && ${MEXICO}`, pattern: "^[0-9]{18}$", patternMessage: "An account number has 18 digits." },
        { type: "textInput", bind: "pt.bankCode", label: "Transit and institution number", placeholder: "00012-003", visibleWhen: `${INTL} && pt.country == 'CA'`, pattern: "^[0-9]{5}-?[0-9]{3}$", patternMessage: "Use the 5-digit transit number and 3-digit institution number, like 00012-003." },
        { type: "textInput", bind: "pt.bankCode", label: "IFSC code", placeholder: "HDFC0000001", visibleWhen: `${INTL} && pt.country == 'IN'`, pattern: "^[A-Za-z]{4}0[A-Za-z0-9]{6}$", patternMessage: "An IFSC has 11 characters: 4 letters, a zero, then 6 letters or numbers." },
        { type: "textInput", bind: "pt.bankCode", label: "BSB", placeholder: "062-000", visibleWhen: `${INTL} && pt.country == 'AU'`, pattern: "^[0-9]{3}-?[0-9]{3}$", patternMessage: "A BSB has 6 digits, like 062-000." },
        { type: "textInput", bind: "pt.swift", label: "SWIFT / BIC code", placeholder: "8 or 11 characters", visibleWhen: INTL, pattern: "^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$", patternMessage: "A SWIFT/BIC has 8 or 11 letters and numbers." },

        {
          type: "button", label: "Continue", variant: "primary", visibleWhen: INTERNAL,
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "lookup", input: { by: "{{pt.by}}", value: "{{pt.by == 'mobile' ? pt.mobile : (pt.by == 'email' ? pt.email : pt.bwid)}}" }, saveAs: "ctx.found", onError: toRoute },
            { type: "setData", path: "pt.payeeName", value: "{{ctx.found.name}}" },
            { type: "setData", path: "pt.mask", value: "{{ctx.found.maskedAccount}}" },
            { type: "setData", path: "pt.bankName", value: "BankWorkx® customer" },
            { type: "setData", path: "pt.ccy", value: "{{ctx.found.currency}}" },
            { type: "setData", path: "pt.key", value: "{{ctx.found.key}}" },
            { type: "setData", path: "pt.customerNo", value: "{{ctx.found.customerNumber}}" },
            { type: "setData", path: "pt.country", value: "US" },
            { type: "setData", path: "pt.hours", value: 24 },
            { type: "navigate", to: "amount" },
          ],
        },
        {
          type: "button", label: "Continue", variant: "primary", visibleWhen: "pt.type != 'internal'",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "validate", input: { ...PAYEE_FIELDS }, saveAs: "ctx.v", onError: toRoute },
            { type: "setData", path: "pt.payeeName", value: "{{pt.name}}" },
            { type: "setData", path: "pt.mask", value: "{{ctx.v.maskedNumber}}" },
            { type: "setData", path: "pt.bankName", value: "{{ctx.v.bankName}}" },
            { type: "setData", path: "pt.ccy", value: "{{ctx.v.currency}}" },
            { type: "setData", path: "pt.key", value: "{{ctx.v.key}}" },
            { type: "setData", path: "pt.hours", value: 24 },
            { type: "navigate", to: "amount" },
          ],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "type" }] },
      ],
    },
    {
      id: "amount", title: "Amount",
      blocks: [
        { type: "avatar", name: "{{pt.payeeName}}", text: "{{pt.mask}} · {{pt.bankName}}" },
        { type: "alert", tone: "info", visibleWhen: "opt.coolingOff != false && pt.hours > 0", text: "{{pt.payeeName}} is a new payee. For your security you can send up to $500.00 in their first 24 hours." },
        { type: "sectionHeader", title: "From" },
        { type: "accountPicker", bind: "pt.from", source: "ctx.accounts", showBalance: true },
        {
          type: "amountInput", bind: "pt.amount", currency: "{{pt.ccy}}", label: `{{pt.ccy == ${HOME} ? 'Amount' : 'They receive (' + pt.ccy + ')'}}`,
          helper: `Available in {{ctx.accounts[pt.from].name}}: {{ctx.accounts[pt.from].balance | money2:${HOME}}}.`,
        },
        { type: "select", bind: "pt.purpose", label: "Purpose", variant: "dropdown", visibleWhen: INTL, choices: choices(PURPOSES) },
        {
          type: "select", bind: "pt.charges", label: "Who pays the bank charges?", variant: "chips", visibleWhen: `${INTL} && opt.chargeChoice == true`,
          choices: [{ id: "shared", label: "Shared" }, { id: "ours", label: "I pay all (+$15.00)" }, { id: "theirs", label: "They pay" }],
        },
        { type: "textInput", bind: "pt.reference", label: "Reference", placeholder: "Optional", visibleWhen: "pt.type == 'domestic'", pattern: `^[${REF_CHARS}]{0,80}$`, patternMessage: "Use up to 80 letters, numbers, spaces and . , ' - / ( ) + : ? only." },
        { type: "textInput", bind: "pt.reference", label: "Reference", placeholder: "Optional", visibleWhen: "pt.type != 'domestic'", pattern: `^[${REF_CHARS}]{0,140}$`, patternMessage: "Use up to 140 letters, numbers, spaces and . , ' - / ( ) + : ? only." },
        // the first quote chooses the first speed that fits; the person can change it on the next step. A BankWorkx® customer has one speed: straight to the review.
        ...[["pt.type != 'internal'", "options"], [INTERNAL, "review"]].map(([when, to]) => ({
          type: "button" as const, label: "Continue", variant: "primary" as const, visibleWhen: when,
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "pt.speed", value: "" },
            { type: "setData", path: "pt.consent", value: false },
            { type: "setData", path: "pt.moved", value: false },
            { type: "callApi", integration: "quote", input: { ...QUOTE_INPUT }, saveAs: "ctx.quote", onError: toRoute },
            { type: "setData", path: "pt.speed", value: "{{ctx.quote.speed}}" },
            { type: "navigate", to },
          ],
        })),
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "payeeList" }] },
      ],
    },
    {
      // the bank asks for the payee's address (some countries, and payments of 10,000 US dollars or more)
      id: "address", title: "Their address",
      blocks: [
        { type: "text", variant: "title", text: "Their address" },
        { type: "text", variant: "body", text: "We need the payee’s address for this payment." },
        { type: "textInput", bind: "pt.street", label: "Their street and number", pattern: "^[A-Za-z0-9 .,'’#&()/-]{1,70}$", patternMessage: "Use letters, numbers and spaces." },
        { type: "textInput", bind: "pt.city", label: "Town or city", pattern: "^[A-Za-z0-9 .,'’#&()/-]{1,35}$", patternMessage: "Use letters, numbers and spaces." },
        { type: "textInput", bind: "pt.postcode", label: "Postcode", pattern: "^[A-Za-z0-9 .,'’#&()/-]{0,16}$", patternMessage: "Use letters, numbers and spaces." },
        { type: "select", bind: "pt.relationship", label: "Your relationship to them", variant: "dropdown", choices: choices(RELATIONSHIPS) },
        {
          type: "button", label: "Continue", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "pt.speed", value: "" },
            { type: "callApi", integration: "quote", input: { ...QUOTE_INPUT }, saveAs: "ctx.quote", onError: toRoute },
            { type: "setData", path: "pt.speed", value: "{{ctx.quote.speed}}" },
            { type: "navigate", to: "options" },
          ],
        },
        { type: "button", label: "Change amount", variant: "ghost", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      // how fast, and when (another bank and another country). The bank says which speeds fit the amount.
      id: "options", title: "Speed and date",
      blocks: [
        { type: "text", variant: "title", text: "How fast?" },
        { type: "select", bind: "pt.speed", label: "Speed", variant: "rows", source: "ctx.quote.speeds" },
        { type: "text", variant: "caption", text: "A speed that is over the limit for this amount is marked, and the bank will not use it." },
        { type: "select", bind: "pt.when", label: "When", variant: "chips", visibleWhen: "opt.allowLater != false", choices: [{ id: "now", label: "Now" }, { id: "later", label: "Later" }] },
        { type: "select", bind: "pt.sendOn", label: "Send on", variant: "dropdown", visibleWhen: LATER, source: "ctx.quote.sendDates" },
        { type: "select", bind: "pt.repeat", label: "Repeat", variant: "chips", visibleWhen: LATER, choices: [{ id: "none", label: "Doesn’t repeat" }, { id: "weekly", label: "Every week" }, { id: "monthly", label: "Every month" }] },
        {
          type: "button", label: "Review", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "pt.consent", value: false },
            { type: "callApi", integration: "quote", input: { ...QUOTE_INPUT }, saveAs: "ctx.quote", onError: toRoute },
            { type: "navigate", to: "review" },
          ],
        },
        { type: "button", label: "Change amount", variant: "ghost", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "review", title: "Review payment",
      blocks: [
        { type: "alert", tone: "warning", visibleWhen: "pt.moved", text: "The exchange rate changed. Check the new amount and confirm again." },
        { type: "text", variant: "title", text: `You’re sending ${RECEIVE} to {{pt.payeeName}}`, visibleWhen: `!(${LATER})` },
        { type: "text", variant: "title", text: `Scheduled for {{ctx.quote.sendDates[pt.sendOn].name}}: ${RECEIVE} to {{pt.payeeName}}`, visibleWhen: LATER },
        {
          type: "reviewSummary",
          rows: [
            { label: "From", value: ACCT },
            { label: "To", value: "{{pt.payeeName}} {{pt.mask}}" },
            { label: "Speed", value: "{{ctx.quote.speedName}}" },
            { label: "Arrives", value: "{{ctx.quote.arrives}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: INTL, rows: [{ label: "Country", value: `{{ ${COUNTRY_NAME} }}` }, { label: "Purpose", value: "{{pt.purpose}}" }] },
        {
          type: "reviewSummary", visibleWhen: "ctx.quote.converted",
          rows: [
            { label: "They receive", value: RECEIVE },
            { label: "Rate", value: "1 {{ctx.quote.currency}} = {{ctx.quote.rate}} {{ctx.quote.receive.currency}}" },
          ],
        },
        { type: "reviewSummary", rows: feeAndTotal },
        { type: "reviewSummary", visibleWhen: LATER, rows: [{ label: "First payment", value: "{{ctx.quote.sendDates[pt.sendOn].name}}" }, { label: "Repeats", value: "{{pt.repeat == 'weekly' ? 'Every week' : (pt.repeat == 'monthly' ? 'Every month' : 'Doesn’t repeat')}}" }] },
        { type: "reviewSummary", visibleWhen: "pt.reference", rows: [{ label: "Reference", value: "{{pt.reference}}" }] },
        { type: "toggle", bind: "pt.save", label: "Save this payee", helper: "They will be new for 24 hours: you can send them up to $500.00 in that time.", visibleWhen: NEW_PAYEE },
        {
          type: "consent", bind: "pt.consent", termsVersion: "personal-transfer-v1", text: "I confirm the details are correct",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } },
        },
        {
          type: "button", label: "Confirm and send code", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "otp.code", value: "" },
            { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
            { type: "navigate", to: "otp" },
          ],
        },
        { type: "button", label: "Change amount", variant: "ghost", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: `Authorise ${RECEIVE} to {{pt.payeeName}}` },
        { type: "text", variant: "caption", text: "It only works for this payment." },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        ...[["Send", `!(${LATER})`], ["Schedule", LATER]].map(([verb, when]) => ({
          type: "button" as const, variant: "primary" as const, visibleWhen: when, label: `${verb} ${RECEIVE}`,
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            // a rate that ran out while the person typed the code ends in route: a new rate, nothing sent
            { type: "callApi", integration: "pay", input: { quoteId: "{{ctx.quote.quoteId}}", when: "{{pt.type == 'internal' ? 'now' : pt.when}}", sendOn: "{{pt.sendOn}}", repeat: "{{pt.repeat}}", save: "{{pt.save}}", reference: "{{pt.reference}}", ...PAYEE_FIELDS }, saveAs: "pt.result", onError: toRoute },
            { type: "navigate", to: "result" },
          ],
        })),
      ],
    },
    {
      // after a failed bank call: where to go depends on what the bank said (ctx.error)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.code == 'TIMEOUT' && ctx.error.integration == 'pay'", to: "timeout" },
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: "ctx.error.code == 'QUOTE_EXPIRED'", to: "requote" },
          { when: "ctx.error.code == 'ADDRESS_REQUIRED'", to: "address" },
          { when: "ctx.error.integration == 'lookup' || ctx.error.integration == 'validate'", to: "details" },
          {
            when: "ctx.error.code == 'INVALID_AMOUNT' || ctx.error.code == 'INSUFFICIENT_FUNDS' || ctx.error.code == 'DAILY_LIMIT_EXCEEDED' || ctx.error.code == 'BENEFICIARY_COOLING_OFF' || ctx.error.code == 'RAIL_LIMIT' || ctx.error.code == 'RAIL_NOT_AVAILABLE' || ctx.error.code == 'PURPOSE_REQUIRED' || ctx.error.code == 'ACCOUNT_CANNOT_DEBIT' || ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'CURRENCY_NOT_SUPPORTED' || ctx.error.code == 'PAYEE_NOT_CHECKED' || ctx.error.code == 'INVALID_DATE'",
            to: "problem",
          },
        ],
      },
    },
    {
      // the rate ran out: ask for a new one, and the person confirms the new amount
      id: "requote", title: "New rate", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "quote", input: { ...QUOTE_INPUT }, saveAs: "ctx.quote", onError: toRoute },
        { type: "setData", path: "pt.moved", value: true },
        { type: "setData", path: "pt.consent", value: false },
        { type: "navigate", to: "review" },
      ],
      blocks: [],
    },
    {
      // why the payment cannot go ahead, in the bank's own words, and where to fix it
      id: "problem", title: "Check the payment",
      blocks: [
        { type: "result", tone: "error", title: "We can’t send this payment yet", text: "{{ctx.error.message}} No money has left your account." },
        { type: "button", label: "Change amount", variant: "primary", visibleWhen: "ctx.error.code == 'INVALID_AMOUNT' || ctx.error.code == 'INSUFFICIENT_FUNDS' || ctx.error.code == 'DAILY_LIMIT_EXCEEDED' || ctx.error.code == 'BENEFICIARY_COOLING_OFF' || (ctx.error.code == 'RAIL_LIMIT' && pt.type == 'internal')", actions: [{ type: "navigate", to: "amount" }] },
        { type: "button", label: "Change speed", variant: "primary", visibleWhen: "(ctx.error.code == 'RAIL_LIMIT' || ctx.error.code == 'RAIL_NOT_AVAILABLE') && pt.type != 'internal'", actions: [{ type: "navigate", to: "options" }] },
        { type: "button", label: "Change amount", variant: "secondary", visibleWhen: "(ctx.error.code == 'RAIL_LIMIT' || ctx.error.code == 'RAIL_NOT_AVAILABLE') && pt.type != 'internal'", actions: [{ type: "navigate", to: "amount" }] },
        { type: "button", label: "Edit", variant: "primary", visibleWhen: "ctx.error.code == 'PURPOSE_REQUIRED' || ctx.error.code == 'CURRENCY_NOT_SUPPORTED'", actions: [{ type: "navigate", to: "amount" }] },
        { type: "button", label: "Choose account", variant: "primary", visibleWhen: "ctx.error.code == 'ACCOUNT_CANNOT_DEBIT' || ctx.error.code == 'ACCOUNT_NOT_FOUND'", actions: [{ type: "navigate", to: "amount" }] },
        { type: "button", label: "Edit", variant: "primary", visibleWhen: "ctx.error.code == 'INVALID_DATE'", actions: [{ type: "navigate", to: "options" }] },
        { type: "button", label: "Back", variant: "primary", visibleWhen: "ctx.error.code == 'PAYEE_NOT_CHECKED'", actions: [{ type: "navigate", to: "details" }] },
      ],
    },
    {
      // Try again after a slow or unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "review" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'accounts'", to: "start" },
          { when: "ctx.error.integration == 'payees'", to: "type" },
          { when: "ctx.error.integration == 'lookup' || ctx.error.integration == 'validate'", to: "details" },
          { when: "ctx.error.integration == 'quote'", to: "amount" },
        ],
      },
    },
    {
      id: "result", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent", text: `${RECEIVE} to {{pt.payeeName}}`, meta: "Delivered · Ref {{pt.result.reference}}", visibleWhen: "pt.result.status == 'settled'" },
        { type: "result", tone: "success", title: "On its way", text: `${RECEIVE} to {{pt.payeeName}}`, meta: "Arrives: {{pt.result.arrives}} · Ref {{pt.result.reference}}", visibleWhen: "pt.result.status == 'processing'" },
        { type: "result", tone: "success", title: "Scheduled", text: `${RECEIVE} to {{pt.payeeName}}`, meta: "Scheduled for {{ctx.quote.sendDates[pt.sendOn].name}} · Ref {{pt.result.reference}}", visibleWhen: "pt.result.status == 'scheduled'" },
        { type: "text", variant: "title", text: "Held for review", visibleWhen: "pt.result.status == 'held'" },
        { type: "alert", tone: "warning", text: "We’re checking this payment and will tell you within one working day. You don’t need to do anything.", visibleWhen: "pt.result.status == 'held'" },
        {
          type: "reviewSummary", visibleWhen: "pt.result.status != 'held'",
          rows: [
            { label: "Amount", value: RECEIVE },
            { label: "To", value: "{{pt.payeeName}} {{pt.mask}}" },
            { label: "Speed", value: "{{pt.result.speedName}}" },
            { label: "{{pt.result.status == 'scheduled' ? 'First payment' : 'Arrives'}}", value: "{{pt.result.status == 'scheduled' ? ctx.quote.sendDates[pt.sendOn].name : pt.result.arrives}}" },
            { label: "Fee", value: "{{ctx.quote.feeText}}" },
            { label: "Total", value: "{{pt.result.total | money2:pt.result.currency}}" },
          ],
        },
        { type: "text", variant: "caption", text: "{{pt.payeeName}} is saved. In their first 24 hours you can send them up to $500.00 in total.", visibleWhen: "pt.result.payeeId && pt.payeeId == ''" },
        { type: "button", label: "Track payment", variant: "primary", visibleWhen: "pt.result.status == 'settled' || pt.result.status == 'processing'", actions: [{ type: "exit" }] },
        { type: "button", label: "See scheduled payments", variant: "primary", visibleWhen: "pt.result.status == 'scheduled'", actions: [{ type: "exit" }] },
        { type: "button", label: "Back to Payments", variant: "primary", visibleWhen: "pt.result.status == 'held'", actions: [{ type: "exit" }] },
        { type: "button", label: "Send another", variant: "secondary", visibleWhen: "pt.result.status != 'held'", actions: [{ type: "navigate", to: "start" }] },
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "You entered the wrong code 3 times, so we stopped. No money has left your account." },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." },
        // Activity is a screen of the app, not of this journey: leaving the journey takes the person back to the app
        { type: "button", label: "Check Activity", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // a slow answer to a question that moves no money (the payee, the price): nothing changed, so it is safe to ask again
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
        { type: "result", tone: "error", title: "Service not available", text: "This service is not available right now. Nothing was changed. Please try again in a few minutes." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Back", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not sent", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't complete this right now.", text: "No money has left your account.", visibleWhen: "ctx.error.code == 'CORE_UNAVAILABLE'" },
        { type: "result", tone: "error", title: "We couldn’t confirm this payment.", text: "Nothing was sent. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID'" },
        { type: "result", tone: "error", title: "This payment was already handled.", text: "Check Activity before you try again. Nothing more was sent.", visibleWhen: "ctx.error.code == 'QUOTE_USED' || ctx.error.code == 'QUOTE_NOT_FOUND'" },
        { type: "result", tone: "error", title: "{{ctx.error.message}}", text: "Nothing was sent.", visibleWhen: "ctx.error.code == 'BENEFICIARY_EXISTS' || ctx.error.code == 'BENEFICIARY_LIMIT'" },
        {
          type: "result", tone: "error", title: "Something went wrong.", text: "No money has left your account.",
          visibleWhen: "ctx.error.code != 'CORE_UNAVAILABLE' && ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'QUOTE_USED' && ctx.error.code != 'QUOTE_NOT_FOUND' && ctx.error.code != 'BENEFICIARY_EXISTS' && ctx.error.code != 'BENEFICIARY_LIMIT'",
        },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
