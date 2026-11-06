import type { Journey, Screen } from "../schema";
import { serviceRequestAcceptance, serviceRequestScenarios } from "./service-request-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./more-kit";

const DOWN = { title: "We couldn’t send it", text: "We couldn’t send it. Nothing was sent. Try again in a few minutes." };
const COLLECT = "sr.delivery == 'Collect at a branch'";
/** What the bank is told: every value of the form, whatever kind it is (the bank reads the ones of its kind). */
const send = {
  type: "{{sr.kind}}", accountId: "{{sr.accountId}}", leaves: "{{sr.leaves}}", delivery: "{{sr.delivery}}", branch: "{{sr.branch}}", letter: "{{sr.letter}}", addressedTo: "{{sr.addressedTo}}",
  changeTo: "{{sr.changeTo}}", reason: "{{sr.reason}}", subject: "{{sr.subject}}", details: "{{sr.details}}",
};
const submit = (back: string) => [
  button("Submit request", [{ type: "validate" }, set("sr.err", ""), { type: "callApi", integration: "create", input: send, saveAs: "sr.res", onError: { navigate: "fail" } }, go("done")]),
  button("Back", [set("sr.err", ""), go(back)], "ghost"),
];
const problem = alert("error", "{{sr.msg}}", "sr.err == 'rule' || sr.err == 'account'");
/** Only a cheque book can be asked for twice: its screen says so, with a way to the open request. */
const duplicate = [alert("error", "You already have this request open.", "sr.err == 'duplicate'"), button("My requests", [{ type: "navigate", toJourney: "my-requests" }], "secondary", "sr.err == 'duplicate'")];
const accountField = { type: "select" as const, bind: "sr.accountId", label: "Account", source: "ctx.o.accounts", variant: "dropdown" as const };
const branchField = { type: "select" as const, bind: "sr.branch", label: "Branch", source: "ctx.o.branches", variant: "dropdown" as const, visibleWhen: COLLECT };

/**
 * Service request (BankWorkx, Personal: More). Sends a request to the bank and gets a reference: order a cheque book, ask for a letter, change an account type, or write another request.
 * A lost or stolen card is not a request: the person is sent to the card controls to freeze it (or told to call). The status is followed in `my-requests`. It moves no money and asks for no code.
 * The kinds the bank switched off (`opt.cheque`, `opt.letter`, `opt.acctype`) are not offered, and the bank refuses them too.
 *
 * Built from the spec of the prototype with the blocks FinX has: the account type is chosen on a step of its own after the account (the engine has no live redraw, so the types an account
 * can change to come from the bank once the account is known), a refusal shows above the form in the bank's words, and the new request is added to the bank's list when it is sent.
 */
export const serviceRequest: Journey = {
  id: "jrn_bankworkx_service_request",
  slug: "service-request",
  name: "Service request",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: serviceRequestAcceptance,
  scenarios: serviceRequestScenarios,
  dataModel: {
    "launch.type": { type: "string" },
    "opt.cheque": { type: "boolean" },
    "opt.letter": { type: "boolean" },
    "opt.acctype": { type: "boolean" },
    "sr.kind": { type: "string", required: true },
    "sr.accountId": { type: "string", required: true },
    "sr.leaves": { type: "string" },
    "sr.delivery": { type: "string" },
    "sr.branch": { type: "string", required: true },
    "sr.letter": { type: "string", required: true },
    "sr.addressedTo": { type: "string", pattern: "^[\\s\\S]{0,60}$", },
    "sr.changeTo": { type: "string", required: true },
    "sr.reason": { type: "string", pattern: "^[\\s\\S]{0,300}$" },
    "sr.subject": { type: "string", required: true, pattern: "^[\\s\\S]{3,80}$" },
    "sr.details": { type: "string", required: true, pattern: "^[\\s\\S]{10,500}$" },
    "sr.err": { type: "string" },
    "sr.msg": { type: "string" },
    "sr.stuck": { type: "boolean" },
  },
  integrations: [
    { id: "options", adapter: "bank.requests.options", mode: "sandbox" },
    { id: "create", adapter: "bank.requests.create", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "New request", kind: "branch",
      onEnter: [
        set("sr.err", ""), set("sr.msg", ""), set("sr.stuck", false), set("sr.accountId", ""), set("sr.branch", ""), set("sr.letter", ""), set("sr.changeTo", ""), set("sr.addressedTo", ""), set("sr.reason", ""), set("sr.details", ""), set("ctx.error", null),
        { type: "callApi", integration: "options", saveAs: "ctx.o", onError: { navigate: "fail" } },
        // a kind passed in is chosen and still confirmed with Continue; the profile's Request a change (name-change) is an Other request about the name
        set("sr.kind", "{{has(ctx.o.kinds, launch.type) ? launch.type : launch.type == 'name-change' ? 'other' : ''}}"),
        set("sr.subject", "{{launch.type == 'name-change' ? 'Change of name' : ''}}"),
        go("type"),
      ],
      navigation: route([lacks("messages.send"), "denied"]),
      blocks: [],
    },
    {
      id: "type", title: "New request",
      blocks: [
        text("New request", "title"),
        { type: "select", bind: "sr.kind", label: "What do you need?", source: "ctx.o.kinds", variant: "rows" },
        button("Continue", [
          { type: "validate" }, set("sr.err", ""), set("sr.stuck", false), set("sr.leaves", "25"), set("sr.delivery", "{{sr.kind == 'letter' ? 'Post' : 'Post to my address'}}"), go("chosen"),
        ]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "chosen", title: "New request", kind: "branch",
      onEnter: [go("type")],
      navigation: route(["sr.kind == 'lost'", "lost"], ["sr.kind == 'cheque'", "cheque"], ["sr.kind == 'letter'", "letter"], ["sr.kind == 'acctype'", "acctPick"], ["sr.kind == 'other'", "other"]),
      blocks: [],
    },
    {
      // a lost or stolen card is not a request: freezing the card is what protects the person, and the card controls do it
      id: "lost", title: "Lost or stolen card",
      blocks: [
        text("Lost or stolen card", "title"),
        text("Freeze your card now, then order a new one.", "body", "!isEmpty(ctx.o.cardJourney)"),
        button("Go to my cards", [{ type: "navigate", toJourney: "card-controls", with: { "launch.mode": "freeze" } }], "primary", "!isEmpty(ctx.o.cardJourney)"),
        text("Call us now so we can stop your card.", "body", "isEmpty(ctx.o.cardJourney)"),
        alert("error", "Use your card options.", "sr.stuck"),
        button("Continue", [set("sr.stuck", true)], "secondary"),
        button("Back", [set("sr.stuck", false), go("type")], "ghost"),
      ],
    },
    {
      id: "cheque", title: "Order cheque book",
      blocks: [
        text("Order cheque book", "title"),
        problem, ...duplicate,
        accountField,
        { type: "select", bind: "sr.leaves", label: "Leaves", options: ["25", "50"] },
        { type: "select", bind: "sr.delivery", label: "Delivery", options: ["Post to my address", "Collect at a branch"] },
        branchField,
        ...submit("type"),
      ],
    },
    {
      id: "letter", title: "Request a letter",
      blocks: [
        text("Request a letter", "title"),
        problem,
        { type: "select", bind: "sr.letter", label: "Which letter?", source: "ctx.o.letters", variant: "dropdown" },
        accountField,
        { type: "select", bind: "sr.delivery", label: "Delivery", options: ["Email", "Post", "Collect at a branch"] },
        branchField,
        { type: "textInput", bind: "sr.addressedTo", label: "Addressed to (optional)", pattern: "^[\\s\\S]{0,60}$", patternMessage: "Use 60 characters or fewer." },
        ...submit("type"),
      ],
    },
    {
      id: "acctPick", title: "Change account type",
      blocks: [
        text("Change account type", "title"),
        problem,
        accountField,
        button("Continue", [{ type: "validate" }, set("sr.err", ""), { type: "callApi", integration: "options", input: { accountId: "{{sr.accountId}}" }, saveAs: "ctx.o", onError: { navigate: "fail" } }, set("sr.changeTo", ""), go("acctype")]),
        button("Back", [set("sr.err", ""), go("type")], "ghost"),
      ],
    },
    {
      id: "acctype", title: "Change account type",
      blocks: [
        text("Change account type", "title"),
        text("Now: {{ctx.o.currentType}}", "caption"),
        problem,
        { type: "select", bind: "sr.changeTo", label: "Change to", source: "ctx.o.changeTo", variant: "dropdown" },
        { type: "textInput", bind: "sr.reason", label: "Reason (optional)", lines: 3, pattern: "^[\\s\\S]{0,300}$", patternMessage: "Use 300 characters or fewer." },
        text("Fees and limits can change. We’ll confirm before we switch it.", "caption"),
        ...submit("acctPick"),
      ],
    },
    {
      id: "other", title: "Other request",
      blocks: [
        text("Other request", "title"),
        problem,
        { type: "textInput", bind: "sr.subject", label: "Subject", pattern: "^[\\s\\S]{3,80}$", patternMessage: "Use at least 3 characters." },
        { type: "textInput", bind: "sr.details", label: "Details", lines: 4, pattern: "^[\\s\\S]{10,500}$", patternMessage: "Write at least 10 characters." },
        ...submit("type"),
      ],
    },
    {
      id: "done", title: "Request sent", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Request sent", text: "We’ll update the status under My requests.", meta: "{{sr.res.reference}}" },
        { type: "statusChip", status: "Received", statuses: { Received: { label: "Received", tone: "info" } } },
        { type: "reviewSummary", rows: [{ label: "Request", value: "{{sr.res.title}}" }, { label: "Reference", value: "{{sr.res.reference}}" }] },
        { type: "reviewSummary", rows: [{ label: "Account", value: "{{sr.res.account}}" }, { label: "Leaves", value: "{{sr.res.leaves}}" }, { label: "Delivery", value: "{{sr.res.delivery}}" }], visibleWhen: "sr.kind == 'cheque'" },
        { type: "reviewSummary", rows: [{ label: "Letter", value: "{{sr.res.letter}}" }, { label: "Account", value: "{{sr.res.account}}" }, { label: "Delivery", value: "{{sr.res.delivery}}" }], visibleWhen: "sr.kind == 'letter'" },
        { type: "reviewSummary", rows: [{ label: "Addressed to", value: "{{sr.res.addressedTo}}" }], visibleWhen: "sr.kind == 'letter' && !isEmpty(sr.res.addressedTo)" },
        { type: "reviewSummary", rows: [{ label: "Account", value: "{{sr.res.account}}" }, { label: "Change to", value: "{{sr.res.changeTo}}" }], visibleWhen: "sr.kind == 'acctype'" },
        { type: "reviewSummary", rows: [{ label: "Subject", value: "{{sr.res.subject}}" }], visibleWhen: "sr.kind == 'other'" },
        button("My requests", [{ type: "navigate", toJourney: "my-requests" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: what the person can fix shows on the screen of its kind; no answer has its own screen
      id: "fail", title: "New request", kind: "branch",
      onEnter: [
        set("sr.msg", "{{ctx.error.message}}"),
        set("sr.err", "{{ctx.error.code == 'DUPLICATE' ? 'duplicate' : ctx.error.code == 'ACCOUNT_NOT_FOUND' ? 'account' : ctx.error.code == 'TIMEOUT' || ctx.error.code == 'SERVICE_UNAVAILABLE' ? '' : 'rule'}}"),
        go("again"),
      ],
      navigation: route(["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"]),
      blocks: [],
    },
    {
      // back to the screen of the kind that was being sent (what was typed is still there)
      id: "again", title: "New request", kind: "branch",
      onEnter: [go("type")],
      navigation: route(["sr.kind == 'cheque'", "cheque"], ["sr.kind == 'letter'", "letter"], ["sr.kind == 'acctype'", "acctype"], ["sr.kind == 'other'", "other"]),
      blocks: [],
    },
    ...answerScreens("again", "sent", DOWN),
    denied("New request"),
  ] as Screen[],
};
