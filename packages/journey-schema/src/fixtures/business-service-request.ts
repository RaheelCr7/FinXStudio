import type { Journey, Screen } from "../schema";
import { businessServiceRequestAcceptance, businessServiceRequestScenarios } from "./business-service-request-tests";
import { alert, button, denyScreen, failScreens, go, is, route, set, text } from "./business-kit";

const FIELD = ["INVALID_TYPE", "TYPE_NOT_AVAILABLE", "INVALID_CURRENCY", "INVALID_PURPOSE", "ACCOUNT_NOT_FOUND", "INVALID_REASON", "INVALID_UPDATE", "INVALID_LEAVES", "INVALID_DELIVERY", "SUBJECT_REQUIRED", "DETAILS_REQUIRED", "INVALID_PHONE", "ONLY_ACCOUNT"];
const BLOCKED = ["REQUEST_DUPLICATE", "REQUEST_LIMIT_REACHED", "CONSENT_REQUIRED"];
const TYPE = (t: string) => `sr.type == '${t}'`;
const ACCOUNT = `${TYPE("close")} || ${TYPE("cheque")}`;
const FORM = {
  type: "{{sr.type}}", currency: "{{sr.currency}}", purpose: "{{sr.purpose}}", accountId: "{{sr.accountId}}", moveTo: "{{sr.moveTo}}", reason: "{{sr.reason}}", what: "{{sr.what}}", leaves: "{{sr.leaves}}",
  delivery: "{{sr.delivery}}", subject: "{{sr.subject}}", details: "{{sr.details}}", phone: "{{sr.phone}}", cheque: "{{opt.cheque != false}}",
};
const CHOICES = (xs: string[]) => xs.map((x) => ({ id: x, label: x }));
const reviewRow = (label: string, value: string, visibleWhen?: string) => ({ type: "reviewSummary" as const, ...(visibleWhen ? { visibleWhen } : {}), rows: [{ label, value }] });
const kinds = (cheque: boolean) => [
  { id: "add", label: "Add an account", text: "Open another account" }, { id: "close", label: "Close an account", text: "Close one of your accounts" }, { id: "update", label: "Update company details", text: "Address, contacts, owners, signatories" },
  ...(cheque ? [{ id: "cheque", label: "Cheque book", text: "Order a cheque book" }] : []), { id: "other", label: "Other", text: "Anything else" },
];

/** The steps of the progress bar: one fewer when the journey was opened with the first choice made, as the line under it says. */
const STEPPERS = [{ type: "stepper" as const, steps: ["need", "details", "review"], visibleWhen: "sr.skip != true" }, { type: "stepper" as const, steps: ["details", "review"], visibleWhen: "sr.skip == true" }];

/**
 * Business service request (BankWorkx Business, More). A person at the company asks the bank for something that is not a payment: add an account, close an account, update the company's details, order a
 * cheque book or something else. The request is listed under Service requests. Nothing moves, so no code is asked; the bank checks every field, refuses a second open request with the same kind and
 * subject and a sixth request in a day from one person, refuses to close the company's only account, and needs the confirmation tick.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the bank's checks of the fields come with Review (nothing is sent), the account choices say the account and its currency, the phone number is
 * shown masked on the review, the Autofill samples are not built, and Cheque book is offered only while the option `cheque` is on (the bank refuses it otherwise).
 */
export const businessServiceRequest: Journey = {
  id: "jrn_business_service_request",
  slug: "business-service-request",
  name: "Business service request",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessServiceRequestAcceptance,
  scenarios: businessServiceRequestScenarios,
  dataModel: {
    "launch.type": { type: "string" }, "launch.accountId": { type: "string" }, "opt.cheque": { type: "boolean" },
    "sr.type": { type: "string", required: true }, "sr.skip": { type: "boolean" }, "sr.currency": { type: "string" }, "sr.purpose": { type: "string" }, "sr.accountId": { type: "string" }, "sr.moveTo": { type: "string" }, "sr.reason": { type: "string" },
    "sr.what": { type: "string" }, "sr.leaves": { type: "string" }, "sr.delivery": { type: "string" },
    "sr.subject": { type: "string" }, "sr.details": { type: "string" },
    "sr.phone": { type: "string", required: true }, "sr.ack": { type: "boolean" }, "sr.res": { type: "object" },
  },
  integrations: [
    { id: "options", adapter: "corp.requests.list", mode: "sandbox" },
    { id: "check", adapter: "corp.requests.create", mode: "sandbox" },
    { id: "create", adapter: "corp.requests.create", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Service request", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.rv", null), set("sr.res", null), set("sr.ack", false), set("sr.skip", false),
        set("sr.type", "{{launch.type == 'add' || launch.type == 'close' || launch.type == 'update' || launch.type == 'cheque' || launch.type == 'other' ? launch.type : ''}}"), set("sr.accountId", "{{launch.accountId}}"),
        set("sr.currency", ""), set("sr.purpose", ""), set("sr.moveTo", ""), set("sr.reason", ""), set("sr.what", ""), set("sr.leaves", ""), set("sr.delivery", ""), set("sr.subject", ""), set("sr.details", ""), set("sr.phone", ""),
        { type: "callApi", integration: "options", input: { options: true }, saveAs: "ctx.o", onError: { navigate: "route" } },
        go("type"),
      ],
      navigation: route([`!isEmpty(sr.type)`, "skip"]),
      blocks: [],
    },
    { id: "skip", title: "Service request", kind: "branch", onEnter: [set("sr.skip", true), go("details")], blocks: [] },
    {
      id: "type", title: "What do you need?",
      blocks: [
        ...STEPPERS, text("Step 1 of 3 · Service request", "caption"), text("What do you need?", "title"),
        alert("error", "{{ctx.error.message}}", is("INVALID_TYPE", "TYPE_NOT_AVAILABLE")),
        { type: "select", bind: "sr.type", label: "What do you need?", variant: "tiles", visibleWhen: "opt.cheque != false", choices: kinds(true) },
        { type: "select", bind: "sr.type", label: "What do you need?", variant: "tiles", visibleWhen: "opt.cheque == false", choices: kinds(false) },
        button("Continue", [{ type: "validate" }, set("ctx.error", null), go("details")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "details", title: "Tell us more",
      blocks: [
        ...STEPPERS,
        text("Step 2 of 3 · Service request", "caption", "sr.skip != true"), text("Step 1 of 2 · Service request", "caption", "sr.skip == true"),
        text("Tell us more", "title"),
        alert("error", "{{ctx.error.message}}", is(...FIELD)),
        alert("error", "You can’t close the only account.", `${TYPE("close")} && ctx.o.count < 2`),
        { type: "select", bind: "sr.currency", label: "Currency", variant: "dropdown", visibleWhen: TYPE("add"), choices: CHOICES(["USD", "EUR", "GBP", "AED"]) },
        { type: "select", bind: "sr.purpose", label: "What it is for", variant: "dropdown", visibleWhen: TYPE("add"), choices: CHOICES(["Day-to-day payments", "Payroll", "Tax", "Savings", "Other"]) },
        { type: "select", bind: "sr.accountId", label: "Account", variant: "dropdown", source: "ctx.o.accounts", visibleWhen: ACCOUNT },
        { type: "select", bind: "sr.moveTo", label: "Move the balance to", variant: "dropdown", source: "ctx.o.accounts", visibleWhen: `${TYPE("close")} && !isEmpty(sr.accountId) && ctx.o.accounts[sr.accountId].hasBalance` },
        { type: "select", bind: "sr.reason", label: "Reason", variant: "dropdown", visibleWhen: TYPE("close"), choices: CHOICES(["No longer needed", "Moving to another bank", "Company is closing", "Other"]) },
        { type: "select", bind: "sr.what", label: "What to update", variant: "dropdown", visibleWhen: TYPE("update"), choices: CHOICES(["Registered address", "Contact details", "Company name", "Owners or directors", "Signatories"]) },
        { type: "select", bind: "sr.leaves", label: "Number of leaves", variant: "chips", visibleWhen: TYPE("cheque"), choices: CHOICES(["25", "50", "100"]) },
        { type: "select", bind: "sr.delivery", label: "Delivery", variant: "dropdown", visibleWhen: TYPE("cheque"), choices: CHOICES(["Collect at a branch", "Post to the registered address"]) },
        { type: "textInput", bind: "sr.subject", label: "Subject", placeholder: "A few words", visibleWhen: TYPE("other"), pattern: "^.{5,80}$", patternMessage: "Add a short subject (at least 5 characters)." },
        { type: "textInput", bind: "sr.details", label: "Details", placeholder: "Tell us what you need", lines: 4, visibleWhen: `${TYPE("update")} || ${TYPE("other")}`, pattern: "^[\\s\\S]{10,1000}$", patternMessage: "Tell us a little more (at least 10 characters)." },
        { type: "textInput", bind: "sr.phone", label: "Contact phone", placeholder: "+1 415 555 0100", keyboard: "phone", pattern: "^\\+[0-9 ]{8,20}$", patternMessage: "Enter a phone number with the country code, like +1 415 555 0100." },
        text("With the country code.", "caption"),
        button("Review", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "check", input: { ...FORM, dryRun: true }, saveAs: "ctx.rv", onError: { navigate: "route" } },
          go("review"),
        ]),
        button("Back", [set("ctx.error", null), go("type")], "ghost", "sr.skip != true"),
        button("Cancel", [{ type: "exit" }], "ghost", "sr.skip == true"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        ...STEPPERS,
        text("Step 3 of 3 · Service request", "caption", "sr.skip != true"), text("Step 2 of 2 · Service request", "caption", "sr.skip == true"),
        text("Review", "title"),
        alert("error", "{{ctx.error.message}}", is("CONSENT_REQUIRED")),
        reviewRow("Request", "{{ctx.rv.typeText}}"), reviewRow("About", "{{ctx.rv.subject}}"), reviewRow("Leaves", "{{ctx.rv.leaves}}", TYPE("cheque")), reviewRow("Delivery", "{{ctx.rv.delivery}}", TYPE("cheque")),
        reviewRow("Balance goes to", "{{ctx.rv.balanceTo}}", `${TYPE("close")} && !isEmpty(ctx.rv.balanceTo)`), reviewRow("Phone", "{{ctx.rv.phoneMasked}}"), reviewRow("Company", "{{ctx.rv.company}}"),
        { type: "consent", bind: "sr.ack", termsVersion: "business-service-request-v1", text: "I confirm these details are correct and I’m allowed to ask for this for {{ctx.rv.company}}.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Confirm to send." } } },
        button("Send request", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "create", input: { ...FORM, acknowledged: "{{sr.ack}}" }, saveAs: "sr.res", onError: { navigate: "route" } },
          go("result"),
        ]),
        button("Back", [set("ctx.error", null), go("details")], "ghost"),
      ],
    },
    {
      id: "result", title: "Request sent", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Request sent", text: "We’ll update you under Service requests.", meta: "Reference {{sr.res.id}}" },
        { type: "statusChip", status: "received", label: "Received", tone: "info" },
        reviewRow("Request", "{{sr.res.typeText}}"), reviewRow("About", "{{sr.res.subject}}"), reviewRow("Company", "{{sr.res.company}}"),
        button("Go to requests", [{ type: "navigate", toJourney: "business-requests" }]),
        button("Send another", [go("start")], "secondary"),
      ],
    },
    {
      // a second open request, a sixth request in a day: said on a screen of its own, with the way back
      id: "blocked", title: "Review",
      blocks: [text("We can’t send this", "title"), alert("error", "{{ctx.error.message}}"), button("Back", [set("ctx.error", null), go("details")]), button("Close", [{ type: "exit" }], "ghost")],
    },
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({
    title: "Service request", effects: ["create"], timeoutText: "We didn’t get an answer in time. Check Service requests before you try again, so it isn’t sent twice.",
    retry: [["check", "details"], ["create", "review"]],
    routes: [[is(...FIELD), "details"], [is("CONSENT_REQUIRED"), "review"], [is(...BLOCKED), "blocked"]],
    unavailable: "Nothing was sent.",
  });
  const say = (id: string, title: string, body: string, again: string) => ({ id, title: "Service request", kind: "terminal", blocks: [{ type: "result", tone: "error", title, text: body }, button(id === "failed" ? "Start again" : "Try again", [go(again)]), button("Close", [{ type: "exit" }], "secondary")] }) as Screen;
  // nothing is sent whenever the bank did not answer: the words of the spec say Sent, not Changed
  return base.filter((s) => s.id !== "denied").map((s) => (s.id === "failed" ? say("failed", "Something went wrong.", "Nothing was sent.", "start") : s.id === "slow" ? say("slow", "We didn’t get an answer in time", "Nothing was sent.", "retry") : s)).concat([denyScreen("Service request", "send requests")]);
}
