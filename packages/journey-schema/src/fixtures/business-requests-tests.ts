import type { Journey } from "../schema";
import { NOW, T, approver, bank, noText, opens, press, refuses, screen, text } from "./admin-kit";

/** What must be true for "Service requests" to be right (the spec's criteria). */
export const businessRequestsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The list shows the company's own requests with reference, date, type, about and a status chip (Received, In progress, Done, Declined), newest first." },
  { id: "AC-2", text: "A request just sent appears at the top with the status Received and the date \"Today\"." },
  { id: "AC-3", text: "An empty list shows \"No requests yet\", the line under it and a New request button that starts Business service request." },
  { id: "AC-4", text: "Requests of the other company are not shown, and the bank refuses another user and Personal." },
  { id: "AC-5", text: "A timeout or an unavailable bank shows a message and changes nothing." },
];

const alpha = { persona: "alex", context: "alpha", now: NOW };
const sent = { adapter: "corp.requests.create", input: { type: "add", currency: "EUR", purpose: "Savings", phone: "+1 415 555 0100", acknowledged: true } };
const arrange = (input: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input });

export const businessRequestsScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Alex at Alpha: one row, REQ-30418, Cheque book, Cheque book, Operating, Done, 28 Oct", ["AC-1"], alpha, [
    screen("list"), text("Service requests"), text("REQ-30418"), text("28 Oct"), text("Cheque book"), text("Cheque book, Operating"), text("Done"), noText("No requests yet"), text("New request"),
    bank("corp.requests.list", "REQ-30418.typeText", "Cheque book"),
  ]),
  T("T-2", "A request sent now shows first as Received, Today; REQ-30418 follows", ["AC-2"], alpha, [
    text("REQ-30419"), text("Today"), text("New EUR account"), text("Received"), text("REQ-30418"), text("Done"), bank("corp.requests.list", "REQ-30419.statusText", "Received"), bank("corp.requests.list", "REQ-30419.dateText", "Today"),
  ], { setup: [sent] }),
  T("T-3", "Alex at Beta: No requests yet, the line under it and a New request button", ["AC-3", "AC-4"], approver, [
    screen("list"), text("No requests yet"), text("Requests you send to the bank are listed here."), text("New request"), noText("REQ-30418"), noText("Cheque book"),
  ]),
  T("T-4", "The other company's requests are not shown: Beta has none of Alpha's, and Alpha none of Beta's", ["AC-4"], approver, [
    noText("REQ-30418"), bank("corp.requests.list", "REQ-30418", undefined), bank("bank.session.switch", "id", "alpha", { contextId: "alpha" }), bank("corp.requests.list", "REQ-30418.statusText", "Done"), bank("corp.requests.list", "REQ-30419", undefined),
  ], { setup: [sent] }),
  T("T-5", "New request opens Business service request, from the list and from the empty list", ["AC-3"], alpha, [press("New request"), opens("business-service-request")]),
  T("T-6", "New request on the empty list opens Business service request too", ["AC-3"], approver, [text("No requests yet"), press("New request"), opens("business-service-request")]),
  T("T-7", "Every status has its chip: Received, In progress, Done and Declined", ["AC-1"], alpha, [
    text("Received"), text("In progress"), text("Done"), text("Declined"), bank("corp.requests.list", "REQ-30419.statusText", "Received"), bank("corp.requests.list", "REQ-30420.statusText", "In progress"), bank("corp.requests.list", "REQ-30421.statusText", "Declined"),
  ], { setup: [sent, { ...sent, input: { ...sent.input, currency: "GBP" } }, { ...sent, input: { ...sent.input, currency: "USD" } }, arrange({ op: "reqStatus", id: "REQ-30420", status: "in_progress" }), arrange({ op: "reqStatus", id: "REQ-30421", status: "declined" })] }),
  T("T-8", "Newest first: the request sent last is the first the bank lists, and the older one after it", ["AC-1"], alpha, [
    bank("corp.requests.list", "REQ-30420.subject", "New GBP account"), text("New EUR account"), text("New GBP account"), text("REQ-30418"),
  ], { setup: [sent, { ...sent, input: { ...sent.input, currency: "GBP" } }] }),
  T("T-9", "A timeout shows Nothing was changed and Try again asks again", ["AC-5"], alpha, [screen("slow"), text("We didn’t get an answer in time"), text("Nothing was changed."), press("Try again"), screen("slow")], { conditions: { timeout: ["corp.requests.list"], latencyMs: 10_000 } }),
  T("T-10", "The bank unavailable shows the sheet", ["AC-5"], alpha, [screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was changed."), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.requests.list"] } }),
  T("T-11", "From Personal the bank does not answer for a company's requests", ["AC-4"], { persona: "alex", now: NOW }, [screen("denied"), text("Switch to your business first"), refuses("corp.requests.list", "WRONG_CONTEXT", {})]),
  T("T-12", "A forced call as another user is refused", ["AC-4"], alpha, [refuses("corp.requests.list", "PERMISSION_DENIED", { userId: "dana" }), refuses("corp.requests.create", "PERMISSION_DENIED", { userId: "dana", type: "add" })]),
  T("T-13", "What is typed is data: a subject with markup is drawn as text", ["AC-1"], alpha, [text("<b>Statements</b> question")], { setup: [{ adapter: "corp.requests.create", input: { type: "other", subject: "<b>Statements</b> question", details: "Please call me about statements.", phone: "+1 415 555 0100", acknowledged: true } }] }),
];
