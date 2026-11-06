import type { Journey } from "../schema";

/** What must be true for "My requests" to be right. Each is proved by at least one scenario below. */
export const myRequestsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The list shows each request with its title, date, reference and status, newest first." },
  { id: "AC-2", text: "A request opens a detail with its rows, the sent date and the reference." },
  { id: "AC-3", text: "Only a request with the status Received shows Cancel request; it asks to confirm and then becomes Cancelled." },
  { id: "AC-4", text: "Keep it leaves the request unchanged." },
  { id: "AC-5", text: "With no requests the empty state offers New request, which opens service-request." },
  { id: "AC-6", text: "A request sent in service-request appears at the top with the status Received." },
  { id: "AC-7", text: "What the person wrote is shown as text, never as markup." },
  { id: "AC-8", text: "A request the bank has started cannot be cancelled: the bank refuses it, the person is told and the status is read again; cancelling needs messages.send and viewing needs accounts.view." },
  { id: "AC-9", text: "When the bank is unavailable or does not answer in time the list says it could not load, and a cancel changes nothing." },
];

// Alex Morgan on Tuesday 3 November 2026 with his two requests: SR-204118 "Order cheque book" (28 Oct 2026, In progress, Account Main ••4410, Leaves 25, Delivery Post to your address) and
// SR-203077 "Request a letter" (12 Oct 2026, Done, Letter Proof of address, Account Main ••4410, Delivery Email). A request he sends today is SR-204119.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const toast = (t: string): Step => ({ expectToast: t });
const request = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.requests.get", input: { requestId: id }, path, equals } });
const list = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.requests.list", path, equals } });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const base = { persona: "alex", now: NOW };
const CHEQUE = "Order cheque book", LETTER = "Request a letter";
const sent: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.requests.create", input: { type: "other", subject: "Update my records", details: "Please update my records after my move." } }];
const open = (label: string): Step[] => [press(label), screen("detail")];

export const myRequestsScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Two rows: the cheque book with 28 Oct 2026 · SR-204118 and In progress, the letter with Done; the newest first", covers: ["AC-1"], ...base,
    steps: [
      screen("list"), text("My requests"), text(CHEQUE), text("28 Oct 2026 · SR-204118 · In progress"), text(LETTER), text("12 Oct 2026 · SR-203077 · Done"), list("SR-204118.rank", 1), list("SR-203077.rank", 2),
    ],
  },
  {
    id: "T-2", name: "The cheque book opens with Account, Leaves, Delivery, Sent and Reference, and no cancel button", covers: ["AC-2", "AC-3"], ...base,
    steps: [
      ...open(CHEQUE), text("Main ••4410"), text("Leaves"), text("25"), text("Post to your address"), text("Sent"), text("28 Oct 2026"), text("Reference"), text("SR-204118"), text("In progress"), noText("Cancel request"),
    ],
  },
  {
    id: "T-3", name: "The letter that is Done opens with its rows and no cancel button", covers: ["AC-2", "AC-3"], ...base,
    steps: [...open(LETTER), text("Proof of address"), text("Email"), text("12 Oct 2026"), text("SR-203077"), text("Done"), noText("Cancel request")],
  },
  {
    id: "T-4", name: "A request that was only Received shows Cancel request; Yes, cancel makes it Cancelled with the toast Request cancelled and no cancel button", covers: ["AC-3", "AC-6"], ...base, setup: sent,
    steps: [
      list("SR-204119.rank", 1), list("SR-204119.status", "Received"), text("Other request"), text("3 Nov 2026 · SR-204119 · Received"),
      ...open("Other request"), text("Received"), text("Cancel request"), press("Cancel request"), screen("detail"), text("Cancel this request?"), noText("Cancel request"), request("SR-204119", "status", "Received"),
      press("Yes, cancel"), screen("detail"), text("Cancelled"), toast("Request cancelled"), noText("Cancel request"), request("SR-204119", "status", "Cancelled"),
    ],
  },
  {
    id: "T-5", name: "Keep it leaves the request as it was: still Received and still cancellable", covers: ["AC-4"], ...base, setup: sent,
    steps: [...open("Other request"), press("Cancel request"), press("Keep it"), screen("detail"), text("Received"), text("Cancel request"), request("SR-204119", "status", "Received")],
  },
  {
    id: "T-6", name: "With no requests the empty state says so and offers New request", covers: ["AC-5"], ...base, conditions: { empty: ["bank.requests.list"] },
    steps: [screen("empty"), text("No requests"), text("Requests you send will show here."), press("New request"), { expectOpens: { journey: "service-request" } }],
  },
  {
    id: "T-7", name: "New request on the list opens service-request", covers: ["AC-5"], ...base,
    steps: [press("New request"), { expectOpens: { journey: "service-request" } }],
  },
  {
    id: "T-8", name: "A request sent today is on top with the status Received, ahead of the older ones", covers: ["AC-6"], ...base, setup: sent,
    steps: [list("SR-204119.rank", 1), list("SR-204118.rank", 2), list("SR-203077.rank", 3), list("SR-204119.status", "Received"), list("SR-204119.line", "3 Nov 2026 · SR-204119")],
  },
  {
    id: "T-9", name: "Markup in a request is shown as the text it is", covers: ["AC-7"], ...base,
    setup: [{ adapter: "bank.requests.create", input: { type: "other", subject: "<b>Records</b>", details: "<script>alert(1)</script> please" } }],
    steps: [...open("Other request"), text("<script>alert(1)</script> please"), text("<b>Records</b>")],
  },
  {
    id: "T-10", name: "A request the bank has started cannot be cancelled: the person is told, and the status is read again", covers: ["AC-8"], ...base, setup: sent,
    steps: [
      ...open("Other request"), press("Cancel request"), { expectBank: { adapter: "sandbox.more.advance", input: { what: "start-request", id: "SR-204119" }, path: "ok", equals: true } },
      press("Yes, cancel"), screen("detail"), text("This request has already started, so it can’t be cancelled."), text("In progress"), noText("Cancel request"), request("SR-204119", "status", "In progress"),
    ],
  },
  {
    id: "T-11", name: "The bank refuses to cancel a request that is in progress, done or unknown, whatever a screen would do", covers: ["AC-8"], ...base,
    steps: [
      forced("bank.requests.cancel", { requestId: "SR-204118" }, "ALREADY_STARTED"), forced("bank.requests.cancel", { requestId: "SR-203077" }, "ALREADY_STARTED"), forced("bank.requests.cancel", { requestId: "SR-nope" }, "REQUEST_NOT_FOUND"),
      forced("bank.requests.get", { requestId: "SR-nope" }, "REQUEST_NOT_FOUND"), request("SR-204118", "status", "In progress"), request("SR-203077", "status", "Done"),
    ],
  },
  {
    id: "T-12", name: "Without messages.send the requests can be read but not cancelled and there is no New request; the bank refuses a cancel", covers: ["AC-8"], ...base, setup: [{ adapter: "sandbox.more.advance", input: { what: "reset-request", id: "SR-204118" } }], conditions: { withoutPermissions: ["messages.send"] },
    steps: [screen("list"), noText("New request"), ...open(CHEQUE), text("Received"), noText("Cancel request"), forced("bank.requests.cancel", { requestId: "SR-204118" }, "PERMISSION_DENIED"), request("SR-204118", "status", "Received")],
  },
  {
    id: "T-13", name: "Without accounts.view it is not available", covers: ["AC-8"], ...base, conditions: { withoutPermissions: ["accounts.view"] },
    steps: [screen("denied"), text("Not available")],
  },
  {
    id: "T-14", name: "When the bank is unavailable the list says it could not load, and Try again reads it again", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.requests.list"] },
    steps: [screen("loadFail"), text("We couldn’t load your requests. Nothing was changed."), text("This isn’t available right now. Try again in a few minutes."), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-15", name: "When the bank does not answer in time the list says so", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.requests.list"], latencyMs: 10000 },
    steps: [screen("loadFail"), text("We couldn’t load your requests. Nothing was changed."), text("This is taking longer than expected. Nothing was changed.")],
  },
  {
    id: "T-16", name: "When a request cannot be read it says so and nothing is changed", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.requests.get"] },
    steps: [press(CHEQUE), screen("loadFail"), text("We couldn’t load your requests. Nothing was changed."), list("SR-204118.status", "In progress")],
  },
  {
    id: "T-17", name: "When the bank is unavailable a cancel changes nothing, and the person is told", covers: ["AC-9"], ...base, setup: sent, conditions: { unavailable: ["bank.requests.cancel"] },
    steps: [...open("Other request"), press("Cancel request"), press("Yes, cancel"), screen("detail"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), text("Received"), text("Cancel request"), request("SR-204119", "status", "Received")],
  },
  {
    id: "T-18", name: "When the bank does not answer in time a cancel changes nothing", covers: ["AC-9"], ...base, setup: sent, conditions: { timeout: ["bank.requests.cancel"], latencyMs: 10000 },
    steps: [...open("Other request"), press("Cancel request"), press("Yes, cancel"), screen("detail"), text("This is taking longer than expected. Nothing was changed."), request("SR-204119", "status", "Received")],
  },
  {
    id: "T-19", name: "Back from the detail returns to the list, and Done leaves", covers: ["AC-1"], ...base,
    steps: [...open(CHEQUE), press("‹ My requests"), screen("list"), press("Done")],
  },
];
