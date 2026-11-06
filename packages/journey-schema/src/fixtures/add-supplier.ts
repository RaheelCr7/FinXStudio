import type { Journey, Screen } from "../schema";
import { addSupplierAcceptance, addSupplierScenarios } from "./add-supplier-tests";
import { alert, button, denyScreen, failScreens, go, is, lacks, lockOnWrongCode, lockedScreen, NOW_DENIED, route, set, text, toRoute } from "./business-kit";

const IBAN_COUNTRIES = ["DE", "FR", "ES", "IT", "IE", "NL", "GB", "JO", "SA", "AE", "CH"];
const COUNTRIES: [string, string][] = [["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["IE", "Ireland"], ["NL", "Netherlands"], ["GB", "United Kingdom"], ["CH", "Switzerland"], ["CA", "Canada"], ["IN", "India"], ["JP", "Japan"], ["AU", "Australia"], ["SG", "Singapore"], ["MX", "Mexico"], ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["JO", "Jordan"]];
const anyOf = (path: string, list: string[]) => `(${list.map((c) => `${path} == '${c}'`).join(" || ")})`;
const HOME = "ctx.cfg.homeMarket";
const SAME = "as.where != 'abroad'";
const ABROAD = "as.where == 'abroad'";
/** Market A (US-style routing number and account), B (sort code), C and D (IBAN). */
const MARKET_A = `${SAME} && ${HOME} == 'us'`;
const MARKET_B = `${SAME} && ${HOME} == 'uk'`;
const MARKET_IBAN = `${SAME} && ${HOME} != 'us' && ${HOME} != 'uk'`;
const ABROAD_IBAN = `${ABROAD} && ${anyOf("as.country", IBAN_COUNTRIES)}`;
const ABROAD_ACCOUNT = `${ABROAD} && !isEmpty(as.country) && !${anyOf("as.country", IBAN_COUNTRIES)}`;
const BANK_CODE = `${ABROAD} && ${anyOf("as.country", ["CA", "IN", "AU"])}`;

/** What the person typed, as the bank's checks take it. */
const FORM = {
  name: "{{as.name}}", type: "{{as.type}}", where: "{{as.where}}", country: "{{as.country}}", accountName: "{{as.accountName}}", routing: "{{as.routing}}", account: "{{as.account}}", accountType: "{{as.accountType}}",
  sort: "{{as.sort}}", iban: "{{as.iban}}", swift: "{{as.swift}}", bankCode: "{{as.bankCode}}", street: "{{as.street}}", city: "{{as.city}}", postcode: "{{as.postcode}}",
  allowPerson: "{{opt.allowPerson != false}}", allowAbroad: "{{opt.allowAbroad != false}}", acknowledged: "{{as.ack}}",
};
const STEPPER = { type: "stepper" as const, steps: ["supplier", "bank", "review"] };
const FIELD_CODES = ["INVALID_ROUTING", "INVALID_ACCOUNT", "INVALID_SORT_CODE", "INVALID_IBAN", "NOT_SEPA", "COUNTRY_MISMATCH", "COUNTRY_REQUIRED", "INVALID_BIC", "INVALID_BANK_CODE", "PAYEE_NAME_REQUIRED", "INVALID_REGION"];

/**
 * Add a supplier (BankWorkx Business, Payments). A Maker asks for a supplier to be added to the company's approved list; an administrator approves it before it can be paid.
 * The supplier's name, the bank details for the bank's home market (a routing number and account, a sort code and account, or an IBAN; for a bank in another country the country,
 * an IBAN or account number, the bank code the country asks for and the SWIFT/BIC and an address), the bank's name check, a review, and always a one-time code that names the supplier.
 * Nothing is paid and nothing is added to the approved list: the request waits for an administrator.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the bank's checks and the name check come when Continue is pressed (no per-field messages and no live box that updates
 * as the person types), a close or wrong-type name is a screen of its own with Use / Switch and the "Add anyway" tick, and the sample-values Autofill is not built.
 */
export const addSupplier: Journey = {
  id: "jrn_add_supplier",
  slug: "add-supplier",
  name: "Add a supplier",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: addSupplierAcceptance,
  scenarios: addSupplierScenarios,
  dataModel: {
    "opt.allowAbroad": { type: "boolean" }, "opt.nameCheck": { type: "boolean" }, "opt.newCap": { type: "boolean" }, "opt.allowPerson": { type: "boolean" },
    "as.name": { type: "string", required: true }, "as.type": { type: "string" }, "as.where": { type: "string" }, "as.country": { type: "string" }, "as.accountName": { type: "string", required: true },
    "as.routing": { type: "string" }, "as.account": { type: "string" }, "as.accountType": { type: "string" }, "as.sort": { type: "string" }, "as.iban": { type: "string" }, "as.swift": { type: "string" }, "as.bankCode": { type: "string" },
    "as.street": { type: "string", required: true }, "as.city": { type: "string", required: true }, "as.postcode": { type: "string" },
    "as.ack": { type: "boolean" }, "as.consent": { type: "boolean", required: true }, "as.result": { type: "object" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "config", adapter: "bank.app.config", mode: "sandbox" },
    { id: "validate", adapter: "corp.suppliers.validate", mode: "sandbox" },
    { id: "nameCheck", adapter: "corp.suppliers.check", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "request", adapter: "corp.suppliers.request", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Add a supplier", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.nc", null),
        { type: "callApi", integration: "config", saveAs: "ctx.cfg", onError: toRoute },
        set("as.name", ""), set("as.type", "company"), set("as.where", "same"), set("as.country", ""), set("as.accountName", ""), set("as.routing", ""), set("as.account", ""), set("as.accountType", "{{ctx.cfg.homeMarket == 'uk' ? 'business' : 'checking'}}"),
        set("as.sort", ""), set("as.iban", ""), set("as.swift", ""), set("as.bankCode", ""), set("as.street", ""), set("as.city", ""), set("as.postcode", ""), set("as.ack", false), set("as.consent", false), set("otp.code", ""), set("as.result", null),
        go("step1"),
      ],
      navigation: route([lacks("biz.suppliers.manage"), "denied"]),
      blocks: [],
    },
    {
      id: "step1", title: "Add a supplier",
      blocks: [
        STEPPER,
        text("Step 1 of 4 · Add a supplier", "caption", "as.where == 'abroad'"),
        text("Step 1 of 3 · Add a supplier", "caption", "as.where != 'abroad'"),
        text("New supplier", "title"),
        alert("error", "You already have a supplier with this name.", is("SUPPLIER_NAME_EXISTS")),
        alert("error", "You have 10 suppliers waiting for approval. Wait for an answer before you add more.", is("TOO_MANY_PENDING")),
        alert("error", "{{ctx.error.message}}", is("INVALID_NAME", "INVALID_TYPE")),
        { type: "textInput", bind: "as.name", label: "Supplier name", placeholder: "The name on their invoices" },
        { type: "select", bind: "as.type", label: "Type", choices: [{ id: "company", label: "Company" }, { id: "person", label: "Person" }], visibleWhen: "opt.allowPerson != false" },
        { type: "select", bind: "as.where", label: "Their bank is", choices: [{ id: "same", label: "In the same country" }, { id: "abroad", label: "In another country" }], visibleWhen: "opt.allowAbroad != false" },
        button("Continue", [
          { type: "validate" }, set("ctx.error", null),
          set("as.accountName", "{{isEmpty(as.accountName) ? as.name : as.accountName}}"),
          { type: "callApi", integration: "validate", input: { ...FORM, step: 1 }, onError: toRoute },
          go("step2"),
        ]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "step2", title: "Add a supplier",
      blocks: [
        STEPPER,
        text("Step 2 of 4 · Add a supplier", "caption", "as.where == 'abroad'"),
        text("Step 2 of 3 · Add a supplier", "caption", "as.where != 'abroad'"),
        text("Bank details", "title"),
        alert("error", "You already have a supplier with these bank details.", is("SUPPLIER_EXISTS")),
        alert("error", "{{ctx.error.message}}", is(...FIELD_CODES)),
        { type: "select", bind: "as.country", label: "Country", variant: "dropdown", choices: COUNTRIES.map(([id, label]) => ({ id, label })), visibleWhen: ABROAD },
        { type: "textInput", bind: "as.accountName", label: "Name on the account" },
        { type: "textInput", bind: "as.routing", label: "Routing number", placeholder: "9 digits", keyboard: "number", visibleWhen: MARKET_A },
        { type: "textInput", bind: "as.account", label: "Account number", visibleWhen: `${MARKET_A} || ${MARKET_B} || ${ABROAD_ACCOUNT}` },
        { type: "select", bind: "as.accountType", label: "Account type", choices: [{ id: "checking", label: "Checking" }, { id: "savings", label: "Savings" }], visibleWhen: MARKET_A },
        { type: "textInput", bind: "as.sort", label: "Sort code", placeholder: "20-00-00", visibleWhen: MARKET_B },
        { type: "select", bind: "as.accountType", label: "Account type", choices: [{ id: "personal", label: "Personal" }, { id: "business", label: "Business" }], visibleWhen: MARKET_B },
        { type: "textInput", bind: "as.iban", label: "IBAN", visibleWhen: `${MARKET_IBAN} || ${ABROAD_IBAN}` },
        { type: "textInput", bind: "as.bankCode", label: "Bank code", visibleWhen: BANK_CODE },
        { type: "textInput", bind: "as.swift", label: "SWIFT / BIC code", placeholder: "8 or 11 characters", visibleWhen: ABROAD },
        button("Continue", [
          { type: "validate" }, set("ctx.error", null), set("as.ack", false),
          { type: "callApi", integration: "validate", input: { ...FORM, step: 2 }, saveAs: "ctx.val", onError: toRoute },
          go("after2"),
        ]),
        button("Back", [set("ctx.error", null), go("step1")], "ghost"),
      ],
    },
    {
      // abroad: the address; the same country in the first market: no name check there; otherwise the bank checks the name
      id: "after2", title: "Add a supplier", kind: "branch",
      onEnter: [go("checkName")],
      navigation: route([ABROAD, "address"], ["opt.nameCheck == false || ctx.cfg.homeMarket == 'us'", "review"]),
      blocks: [],
    },
    {
      id: "checkName", title: "Add a supplier", kind: "branch",
      onEnter: [set("ctx.nc", null), { type: "callApi", integration: "nameCheck", input: { ...FORM }, saveAs: "ctx.nc", onError: toRoute }, go("review")],
      navigation: route(["ctx.nc.result == 'close' || ctx.nc.result == 'none' || ctx.nc.result == 'wrongType'", "nameResult"]),
      blocks: [],
    },
    {
      id: "nameResult", title: "Check the name",
      blocks: [
        STEPPER,
        text("The name is close", "title", "ctx.nc.result == 'close'"),
        text("The account holder is {{ctx.nc.registeredName}}.", "body", "ctx.nc.result == 'close'"),
        text("Wrong type of account", "title", "ctx.nc.result == 'wrongType'"),
        text("This is a {{ctx.nc.recorded}} account.", "body", "ctx.nc.result == 'wrongType'"),
        text("The name doesn’t match", "title", "ctx.nc.result == 'none'"),
        text("The account is held by someone else.", "body", "ctx.nc.result == 'none'"),
        alert("error", "Confirm the name before you continue.", is("NAME_CHECK_NOT_CONFIRMED")),
        button("Use “{{ctx.nc.registeredName}}”", [set("as.accountName", "{{ctx.nc.registeredName}}"), set("as.ack", false), go("checkName")], "secondary", "ctx.nc.result == 'close'"),
        button("Switch to {{ctx.nc.fix}}", [set("as.accountType", "{{ctx.nc.fix}}"), set("as.ack", false), go("checkName")], "secondary", "ctx.nc.result == 'wrongType'"),
        { type: "consent", bind: "as.ack", termsVersion: "add-supplier-name-v1", text: "Add anyway", validation: { mustBeTrue: true, messages: { mustBeTrue: "Confirm to continue." } } },
        button("Continue", [{ type: "validate" }, set("ctx.error", null), go("review")]),
        button("Back", [go("step2")], "ghost"),
      ],
    },
    {
      id: "address", title: "Supplier address",
      blocks: [
        STEPPER,
        text("Step 3 of 4 · Add a supplier", "caption"),
        text("Supplier address", "title"),
        alert("error", "We need the supplier’s address for a bank in another country.", is("ADDRESS_REQUIRED")),
        { type: "textInput", bind: "as.street", label: "Street and number" },
        { type: "textInput", bind: "as.city", label: "Town or city" },
        { type: "textInput", bind: "as.postcode", label: "Postcode" },
        button("Review", [{ type: "validate" }, set("ctx.error", null), go("review")]),
        button("Back", [go("step2")], "ghost"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        STEPPER,
        text("Review", "title"),
        { type: "reviewSummary", rows: [{ label: "Supplier", value: "{{as.name}}" }] },
        { type: "reviewSummary", visibleWhen: "opt.allowPerson != false", rows: [{ label: "Type", value: "{{as.type == 'person' ? 'Person' : 'Company'}}" }] },
        { type: "reviewSummary", visibleWhen: "as.accountName != as.name", rows: [{ label: "Account name", value: "{{as.accountName}}" }] },
        { type: "reviewSummary", visibleWhen: "as.where == 'abroad'", rows: [{ label: "Country", value: "{{ctx.val.countryName}}" }] },
        { type: "reviewSummary", rows: [{ label: "Account", value: "{{ctx.val.account}}" }] },
        { type: "reviewSummary", visibleWhen: "as.where == 'abroad'", rows: [{ label: "Address", value: "{{as.street}}, {{as.city}}{{isEmpty(as.postcode) ? '' : ', ' + as.postcode}}" }] },
        { type: "reviewSummary", rows: [{ label: "Approval", value: "An administrator" }] },
        { type: "reviewSummary", visibleWhen: "opt.newCap != false", rows: [{ label: "First 24 hours", value: "Up to $5,000.00 a payment" }] },
        { type: "alert", tone: "info", text: "An administrator approves the request before the supplier can be paid." },
        { type: "consent", bind: "as.consent", termsVersion: "add-supplier-v1", text: "I confirm the supplier’s details are correct", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        button("Send for approval", [
          { type: "validate" }, set("ctx.error", null), set("otp.code", ""),
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
          go("otp"),
        ]),
        button("Back", [go("step2")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Authorise adding {{as.name}} as a supplier", "title"),
        text("It only works for this request.", "caption"),
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true, hint: "Code sent to {{ctx.otp.maskedPhone}}.", onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }] },
        button("Send for approval", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "request", input: { ...FORM }, saveAs: "as.result", onError: toRoute },
          go("result"),
        ]),
      ],
    },
    {
      id: "result", title: "Sent for approval", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: "{{as.name}} can be paid once an administrator approves it.", meta: "Reference {{as.result.reference}}" },
        { type: "statusChip", status: "pending_approval", label: "Waiting for an administrator" },
        {
          type: "reviewSummary",
          rows: [{ label: "Supplier", value: "{{as.result.name}}" }, { label: "Account", value: "{{as.result.account}}" }, { label: "Approval", value: "{{as.result.approval}}" }],
        },
        { type: "reviewSummary", visibleWhen: "!isEmpty(as.result.country)", rows: [{ label: "Country", value: "{{as.result.country}}" }] },
        { type: "reviewSummary", visibleWhen: "opt.newCap != false", rows: [{ label: "First 24 hours", value: "Up to $5,000.00 a payment" }] },
        button("View suppliers", [{ type: "exit" }]),
        button("Add another supplier", [go("start")], "secondary"),
      ],
    },
    lockedScreen("request", "Nothing was sent."),
    ...suppliersFailures(),
  ] as Screen[],
};

function suppliersFailures(): Screen[] {
  const base = failScreens({
    title: "Add a supplier", effects: ["request"], timeoutText: "We didn’t get an answer in time. Check Suppliers before you try again, so you don’t add it twice.",
    retry: [["validate", "step1"], ["nameCheck", "step2"], ["otpSend", "review"]],
    routes: [
      [is("SUPPLIER_NAME_EXISTS", "TOO_MANY_PENDING", "INVALID_NAME", "INVALID_TYPE"), "step1"],
      [`${is("SUPPLIER_EXISTS", "INVALID_REGION", ...FIELD_CODES)}`, "step2"],
      [is("ADDRESS_REQUIRED"), "address"], [is("NAME_CHECK_NOT_CONFIRMED"), "nameResult"],
    ],
    denied: "You can’t add suppliers at this company",
  });
  return base.filter((s) => !["denied"].includes(s.id)).map((s) => (s.id === "failed" ? {
    ...s, blocks: [
      { type: "result", tone: "error", title: "We couldn’t confirm this request.", text: "Nothing was sent. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID' || ctx.error.code == 'STEP_UP_FAILED'" },
      { type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was sent.", visibleWhen: "ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'STEP_UP_FAILED'" },
      button("Start again", [go("start")]), button("Close", [{ type: "exit" }], "secondary"),
    ],
  } as Screen : s)).concat([denyScreen("Add a supplier", "add suppliers")]);
}

void NOW_DENIED;
