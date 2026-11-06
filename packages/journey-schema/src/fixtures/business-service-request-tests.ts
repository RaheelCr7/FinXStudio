import type { Journey } from "../schema";
import { NOW, T, approver, bank, error, noText, opens, press, refuses, screen, set, text } from "./admin-kit";

/** What must be true for "Business service request" to be right (the spec's criteria). */
export const businessServiceRequestAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The five kinds are offered (Add an account, Close an account, Update company details, Cheque book, Other); Cheque book only while the option is on, and the bank refuses it when it is off." },
  { id: "AC-2", text: "The fields of the second step follow the kind and every required one stops the review: the bank's words for a missing choice, the field's words for a short subject, short details and a phone number without its country code." },
  { id: "AC-3", text: "The company's only account cannot be closed; closing an account with a balance asks where it goes." },
  { id: "AC-4", text: "A request cannot be sent without the confirmation tick, on the screen or at the bank." },
  { id: "AC-5", text: "The result gives a reference and the request appears at the top of Service requests as Received, Today; the phone number is shown masked." },
  { id: "AC-6", text: "A second open request with the same kind and subject, and a sixth request in a day, are refused with their messages; a finished earlier request does not block." },
  { id: "AC-7", text: "A timeout or an unavailable bank sends nothing; a person without the permission, another user and Personal are refused by the bank." },
];

const phone = "+1 415 555 0100";
const company = { persona: "alex", context: "alpha", now: NOW };
const pick = (type: string) => [set({ "sr.type": type }), press("Continue"), screen("details")];
const tick = [set({ "sr.ack": true })];
const send = [...tick, press("Send request"), screen("result")];
const wait = (id: string) => bank("corp.requests.list", `${id}.statusText`, "Received");
const arrange = (input: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input });

export const businessServiceRequestScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Add an account: EUR for Savings and a phone number; the review says New EUR account with the phone masked; Request sent, Received, the reference; the list shows it first, Today", ["AC-1", "AC-2", "AC-5"], company, [
    screen("type"), text("What do you need?"), text("Step 1 of 3 · Service request"), text("Add an account"), text("Close an account"), text("Update company details"), text("Cheque book"), text("Other"),
    ...pick("add"), text("Step 2 of 3 · Service request"), set({ "sr.currency": "EUR", "sr.purpose": "Savings", "sr.phone": phone }), press("Review"), screen("review"), text("Step 3 of 3 · Service request"), text("Add an account"), text("New EUR account"), text("•••• 0100"), text("Alpha Trading LLC"), noText("415 555 0100"),
    ...send, text("Request sent"), text("We’ll update you under Service requests."), text("Received"), text("REQ-30419"), text("New EUR account"), noText("415 555 0100"),
    wait("REQ-30419"), bank("corp.requests.list", "REQ-30419.dateText", "Today"), bank("corp.requests.list", "REQ-30419.subject", "New EUR account"),
  ]),
  T("T-2", "Close the Reserve account, moving the balance to Operating, reason Other: the review says where the balance goes", ["AC-3"], company, [
    ...pick("close"), text("Account"), noText("Move the balance to"), set({ "sr.accountId": "alpha_res" }), text("Move the balance to"), set({ "sr.moveTo": "alpha_ops", "sr.reason": "Other", "sr.phone": phone }), press("Review"), screen("review"), text("Close Reserve ••2044"), text("Balance goes to"), text("Operating ••2001"),
    ...send, text("Close Reserve ••2044"), wait("REQ-30419"),
  ]),
  T("T-3", "A company with one account cannot close it: the screen says so, and the bank refuses the request", ["AC-3"], company, [
    ...pick("close"), text("You can’t close the only account."), set({ "sr.accountId": "alpha_ops", "sr.reason": "Other", "sr.phone": phone }), press("Review"), screen("details"), text("You can’t close the only account."),
    refuses("corp.requests.create", "ONLY_ACCOUNT", { type: "close", accountId: "alpha_ops", reason: "Other", phone, acknowledged: true }), bank("corp.requests.list", "REQ-30419", undefined),
  ], { setup: [arrange({ op: "soleAccount" })] }),
  T("T-4", "Close an account with a balance needs where it goes, and it cannot be the same account", ["AC-3"], company, [
    ...pick("close"), set({ "sr.accountId": "alpha_res", "sr.reason": "Other", "sr.phone": phone }), press("Review"), screen("details"), text("We can’t find that account. Choose another."),
    set({ "sr.moveTo": "alpha_res" }), press("Review"), screen("details"), text("We can’t find that account. Choose another."), noText("Request sent"),
    refuses("corp.requests.create", "ACCOUNT_NOT_FOUND", { type: "close", accountId: "alpha_res", moveTo: "alpha_res", reason: "Other", phone, acknowledged: true }), refuses("corp.requests.create", "INVALID_REASON", { type: "close", accountId: "alpha_res", moveTo: "alpha_ops", reason: "Because", phone, acknowledged: true }),
  ]),
  T("T-5", "A cheque book for Operating, 50 leaves, collected at a branch: the earlier cheque book request is Done, so it does not block; opened with the kind and the account the first step is skipped", ["AC-1", "AC-6"], company, [
    screen("details"), text("Step 1 of 2 · Service request"), text("Number of leaves"), text("Delivery"), set({ "sr.leaves": "50", "sr.delivery": "Collect at a branch", "sr.phone": phone }), press("Review"), screen("review"), text("Step 2 of 2 · Service request"), text("Cheque book, Operating"), text("50"), text("Collect at a branch"),
    ...send, text("Cheque book, Operating"), wait("REQ-30419"), bank("corp.requests.list", "REQ-30418.statusText", "Done"),
  ], { launch: { "launch.type": "cheque", "launch.accountId": "alpha_ops" } }),
  T("T-6", "Other with the subject Hi: the field says Add a short subject (at least 5 characters); a short detail and a phone without its country code are stopped by the fields too", ["AC-2"], company, [
    ...pick("other"), set({ "sr.subject": "Hi", "sr.details": "Please call me about our statements.", "sr.phone": phone }), press("Review"), screen("details"), error("sr.subject"),
    set({ "sr.subject": "Question about statements", "sr.details": "short" }), press("Review"), screen("details"), error("sr.details"),
    set({ "sr.details": "Please call me about our statements.", "sr.phone": "415 555 0100" }), press("Review"), screen("details"), error("sr.phone"),
    set({ "sr.phone": phone }), press("Review"), screen("review"), text("Question about statements"),
    refuses("corp.requests.create", "SUBJECT_REQUIRED", { type: "other", subject: "Hi", details: "Please call me about our statements.", phone, acknowledged: true }), refuses("corp.requests.create", "DETAILS_REQUIRED", { type: "other", subject: "Question", details: "short", phone, acknowledged: true }), refuses("corp.requests.create", "INVALID_PHONE", { type: "other", subject: "Question", details: "Please call me about statements.", phone: "+1 415", acknowledged: true }),
  ]),
  T("T-7", "Leaving the tick off stops Send with Confirm to send., and the bank refuses a request without it", ["AC-4"], company, [
    ...pick("add"), set({ "sr.currency": "GBP", "sr.purpose": "Tax", "sr.phone": phone }), press("Review"), press("Send request"), screen("review"), error("sr.ack"), noText("Request sent"),
    refuses("corp.requests.create", "CONSENT_REQUIRED", { type: "add", currency: "GBP", purpose: "Tax", phone }), bank("corp.requests.list", "REQ-30419", undefined),
  ]),
  T("T-8", "The same Update request twice: the second is refused with You already have an open request about this. Wait for our reply.", ["AC-6"], company, [
    ...pick("update"), set({ "sr.what": "Registered address", "sr.details": "Please change our registered address.", "sr.phone": phone }), press("Review"), ...send, text("Update registered address"), press("Send another"), screen("type"),
    ...pick("update"), set({ "sr.what": "Registered address", "sr.details": "Please change our registered address.", "sr.phone": phone }), press("Review"), screen("blocked"), text("You already have an open request about this. Wait for our reply."), noText("Request sent"), press("Back"), screen("details"),
    refuses("corp.requests.create", "REQUEST_DUPLICATE", { type: "update", what: "Registered address", details: "Please change our registered address.", phone, acknowledged: true }),
  ]),
  T("T-9", "A sixth request in a day (five already sent today) is refused with the spec's words", ["AC-6"], company, [
    ...pick("add"), set({ "sr.currency": "AED", "sr.purpose": "Payroll", "sr.phone": phone }), press("Review"), screen("blocked"), text("You have sent the most requests allowed today (5). Try again tomorrow."), noText("Request sent"),
    refuses("corp.requests.create", "REQUEST_LIMIT_REACHED", { type: "add", currency: "AED", purpose: "Payroll", phone, acknowledged: true }),
  ], { setup: [arrange({ op: "reqToday", userId: "alex", count: 5 })] }),
  T("T-10", "The fifth request in a day is still sent: exactly five is the limit", ["AC-6"], company, [...pick("add"), set({ "sr.currency": "AED", "sr.purpose": "Payroll", "sr.phone": phone }), press("Review"), screen("review"), ...send, text("Request sent")], { setup: [arrange({ op: "reqToday", userId: "alex", count: 4 })] }),
  T("T-11", "With the option off Cheque book is not offered, and the bank refuses it", ["AC-1"], company, [
    screen("type"), text("Add an account"), text("Other"), noText("Cheque book"), refuses("corp.requests.create", "TYPE_NOT_AVAILABLE", { type: "cheque", accountId: "alpha_ops", leaves: 50, delivery: "Collect at a branch", phone, acknowledged: true, cheque: false }),
  ], { launch: { "opt.cheque": false } }),
  T("T-12", "A missing choice is the bank's: no currency, no purpose, no account, no leaves, no delivery, no kind", ["AC-2"], company, [
    ...pick("add"), set({ "sr.phone": phone }), press("Review"), screen("details"), text("Choose a currency."), set({ "sr.currency": "EUR" }), press("Review"), text("Choose what it is for."),
    refuses("corp.requests.create", "INVALID_CURRENCY", { type: "add", currency: "JPY", purpose: "Savings", phone, acknowledged: true }), refuses("corp.requests.create", "INVALID_LEAVES", { type: "cheque", accountId: "alpha_ops", leaves: 30, delivery: "Collect at a branch", phone, acknowledged: true }),
    refuses("corp.requests.create", "INVALID_DELIVERY", { type: "cheque", accountId: "alpha_ops", leaves: 25, delivery: "Courier", phone, acknowledged: true }), refuses("corp.requests.create", "INVALID_UPDATE", { type: "update", what: "Nothing", details: "Please change something.", phone, acknowledged: true }),
    refuses("corp.requests.create", "INVALID_TYPE", { type: "loan", phone, acknowledged: true }), refuses("corp.requests.create", "ACCOUNT_NOT_FOUND", { type: "cheque", accountId: "nope", leaves: 25, delivery: "Collect at a branch", phone, acknowledged: true }),
  ]),
  T("T-13", "Without a kind chosen the first step stops", ["AC-1"], company, [screen("type"), press("Continue"), screen("type"), error("sr.type")]),
  T("T-14", "Go to requests opens the list, and Send another starts again", ["AC-5"], company, [...pick("add"), set({ "sr.currency": "EUR", "sr.purpose": "Savings", "sr.phone": phone }), press("Review"), ...send, press("Go to requests"), opens("business-requests")]),
  T("T-15", "Alex at Beta (an Approver) can send too: the request is Beta's, and Alpha's REQ-30418 is not in Beta's list", ["AC-5"], approver, [
    ...pick("add"), set({ "sr.currency": "GBP", "sr.purpose": "Tax", "sr.phone": phone }), press("Review"), text("Beta Services Ltd"), ...send, text("Beta Services Ltd"), wait("REQ-30419"), bank("corp.requests.list", "REQ-30418", undefined),
  ]),
  T("T-16", "A timeout on the check sends nothing", ["AC-7"], company, [...pick("add"), set({ "sr.currency": "EUR", "sr.purpose": "Savings", "sr.phone": phone }), press("Review"), screen("slow"), text("We didn’t get an answer in time"), text("Nothing was sent."), bank("corp.requests.list", "REQ-30419", undefined)], { conditions: { timeout: ["corp.requests.create"], latencyMs: 10_000 } }),
  T("T-17", "The bank unavailable on the check shows the sheet and sends nothing; Try again returns to the details", ["AC-7"], company, [
    ...pick("add"), set({ "sr.currency": "EUR", "sr.purpose": "Savings", "sr.phone": phone }), press("Review"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent."), press("Try again"), screen("details"),
  ], { conditions: { unavailable: ["corp.requests.create"] } }),
  T("T-18", "The company's accounts not loading shows the sheet", ["AC-7"], company, [screen("unavailable"), text("Nothing was sent."), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.requests.list"] } }),
  T("T-19", "From Personal the bank does not answer for a company's requests", ["AC-7"], { persona: "alex", now: NOW }, [screen("denied"), text("Switch to your business first"), refuses("corp.requests.create", "WRONG_CONTEXT", { type: "add" })]),
  T("T-20", "A forced call as another user is refused", ["AC-7"], company, [refuses("corp.requests.create", "PERMISSION_DENIED", { userId: "dana", type: "add", currency: "EUR", purpose: "Savings", phone, acknowledged: true }), refuses("corp.requests.list", "PERMISSION_DENIED", { userId: "dana" })]),
  T("T-21", "What is typed is data: markup in a subject and in the details is kept as text and never drawn as markup", ["AC-5"], company, [
    ...pick("other"), set({ "sr.subject": "<b>Statements</b> question", "sr.details": "<script>alert(1)</script> please", "sr.phone": phone }), press("Review"), text("<b>Statements</b> question"), ...send, text("<b>Statements</b> question"), bank("corp.requests.list", "REQ-30419.subject", "<b>Statements</b> question"),
  ]),
  T("T-22", "An Update request opens with the kind passed in, and the first step says 1 of 2", ["AC-1"], company, [screen("details"), text("Step 1 of 2 · Service request"), text("What to update"), noText("Number of leaves"), noText("Currency"), text("Details")], { launch: { "launch.type": "update" } }),
  T("T-23", "A kind that is not one of the five is ignored: the first step asks", ["AC-1"], company, [screen("type")], { launch: { "launch.type": "limit_review" } }),
  T("T-24", "The code is not asked: no one-time code is sent for a request", ["AC-4"], company, [...pick("add"), set({ "sr.currency": "EUR", "sr.purpose": "Savings", "sr.phone": phone }), press("Review"), ...send, noText("Enter your code")], { conditions: { unavailable: ["bank.otp.send"] } }),
];
