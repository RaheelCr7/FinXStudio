import type { Journey } from "../schema";
import { CODE, T, approver, bank, error, group, inspect, maker, noor, noText, opens, press, ravi, refuses, screen, set, text, view, wrongCodes } from "./admin-kit";

/** What must be true for "Edit an approval group" to be right (the spec's criteria). */
export const editSignatoryGroupAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Edit group opens on the approvers step with the group's current mode and approvers; without a group the first step asks which, each with its current line; a person without the admin permission lands on \"You can’t change approval groups\"." },
  { id: "AC-2", text: "Any one, In order and Several together can be chosen (In order only while the option is on); Several together asks how many; In order starts with who goes first." },
  { id: "AC-3", text: "Each rule of the approvers step shows the bank's message and nothing is sent; an unchanged group says \"Change something to continue.\"" },
  { id: "AC-4", text: "The group over 50,000 cannot be set to Any one or to fewer than two approvers; the person who starts payments cannot be the only approver." },
  { id: "AC-5", text: "The result is \"Sent for approval\" and the current group stays; with the option off it is \"Group updated\" and the group shows the new line." },
  { id: "AC-6", text: "A group that already has a change waiting is refused (\"A change to this group is already waiting for approval.\")." },
  { id: "AC-7", text: "The code prompt names the group and the bank asks for the code on its side; three wrong codes change nothing; a timeout or an unavailable bank changes nothing." },
  { id: "AC-8", text: "Payments already waiting keep the approvers they started with (the review says so) and only payments started after the change use the new group." },
];

const open = (g?: string, extra: Record<string, unknown> = {}) => ({ launch: { ...(g ? { "launch.group": g } : {}), ...extra } });
const confirm = [press("Confirm"), screen("otp")];
const fine = (id: string, patch: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input: { op: "admRoles", personId: id, ...patch } });
const waitingGroup = (g: string) => ({ adapter: "corp.sandbox.arrange", input: { op: "admChange", by: "mina", text: "Change approvers for payments", kind: "group", group: g, data: { group: g, mode: "any", members: ["dana"], need: 1 } } });

export const editSignatoryGroupScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "The group over 50,000, Several together, 2 of Dana, Lee and Maria: the review shows the new line, the code names the group, Sent for approval, and the groups still show the old line", ["AC-1", "AC-2", "AC-5", "AC-7"], ravi, [
    screen("approvers"), text("Payments over 50,000"), text("Step 1 of 2 · Edit approval group"), text("Dana Cruz"), text("Lee Park"), text("Maria Silva"),
    set({ "eg.mode": "par", "eg.need": 2, "eg.on3": true }), text("A set number of them approve, in any order."), press("Review"), screen("review"), text("Step 2 of 2 · Edit approval group"), text("Payments over 50,000"), text("In order: Dana Cruz, then Lee Park"), text("2 of 3 together: Dana Cruz, Lee Park, Maria Silva"), text("After a second administrator approves"),
    ...confirm, text("Change payments over 50,000"), set({ "otp.code": CODE }), press("Change group"), screen("result"), text("Sent for approval"), text("Another administrator has to approve this. The current group stays until then."), text("Waiting for approval"), text("Second administrator"), text("2 of 3"), noText("Group updated"),
    view("groups.over.line", "In order: Dana Cruz, then Lee Park"), group("over", "current.waiting", true), view("waiting.CHG-1044.mine", true), bank("corp.admin.get", "log.1.what", "Change approvers for payments over 50,000 to: 2 of 3 together: Dana Cruz, Lee Park, Maria Silva"), bank("corp.admin.get", "log.1.result", "Waiting"), inspect("outbox.0.kind", "change-waiting"),
  ], open("over")),
  T("T-2", "The group over 50,000 cannot be set to Any one, nor to one approver: the bank's words, and nothing is sent", ["AC-3", "AC-4"], ravi, [
    set({ "eg.mode": "any" }), press("Review"), screen("approvers"), text("Payments over 50,000 need two approvers. Choose In order or Several together."), noText("Enter your code"),
    set({ "eg.mode": "seq", "eg.on2": false }), press("Review"), screen("approvers"), text("Add at least 2 approvers."),
    refuses("corp.signatories.update", "NOT_ENOUGH_APPROVERS", { group: "over", mode: "any", on1: true, on2: true }), refuses("corp.signatories.update", "NOT_ENOUGH_APPROVERS", { group: "over", mode: "seq", on1: true }), group("over", "line", "In order: Dana Cruz, then Lee Park"),
  ], open("over")),
  T("T-3", "Switching off both approvers of the group up to 50,000: Choose at least one approver", ["AC-3"], ravi, [set({ "eg.on1": false, "eg.on2": false }), press("Review"), screen("approvers"), text("Choose at least one approver."), refuses("corp.signatories.update", "NO_APPROVERS", { group: "upto", mode: "any" })], open("upto")),
  T("T-4", "Opening the group up to 50,000 and changing nothing: Change something to continue.", ["AC-1", "AC-3"], ravi, [screen("approvers"), text("Dana Cruz"), press("Review"), screen("approvers"), text("Change something to continue."), refuses("corp.signatories.update", "NO_CHANGE", { group: "upto", mode: "any", on1: true, on2: true })], open("upto")),
  T("T-5", "In order with three approvers and Lee Park first: In order: Lee Park, then Dana Cruz, then Maria Silva; left empty the first switched on goes first", ["AC-2"], ravi, [
    set({ "eg.mode": "seq", "eg.on3": true }), text("One after another, in the order below."), text("Goes first"), set({ "eg.first": "lee" }), press("Review"), screen("review"), text("In order: Lee Park, then Dana Cruz, then Maria Silva"),
    press("Back"), set({ "eg.first": "" }), press("Review"), text("In order: Dana Cruz, then Lee Park, then Maria Silva"),
  ], open("over")),
  T("T-6", "With the option Allow approvers in order off, In order is not offered, and the bank refuses it", ["AC-2"], ravi, [
    screen("approvers"), noText("In order"), text("Any one"), text("Several together"), refuses("corp.signatories.update", "MODE_NOT_ALLOWED", { group: "upto", mode: "seq", on1: true, on2: true, allowSeq: false }),
  ], open("upto", { "opt.allowSeq": false })),
  T("T-7", "A group that already has a change waiting is refused on Review with the spec's words, and by the bank", ["AC-6"], ravi, [
    set({ "eg.on3": true }), press("Review"), screen("blocked"), text("A change to this group is already waiting for approval."), noText("Enter your code"), press("Back"), screen("approvers"),
    refuses("corp.signatories.update", "CHANGE_PENDING", { group: "over", mode: "seq", on1: true, on2: true, on3: true }), group("upto", "current.waiting", false),
  ], { ...open("over"), setup: [...ravi.setup, waitingGroup("over")] }),
  T("T-8", "Payments waiting at the company show Keep their current approvers, and one that waits keeps its approvers after the group changes", ["AC-8"], ravi, [
    set({ "eg.on2": false, "eg.on3": true }), press("Review"), screen("review"), text("Payments waiting"), text("Keep their current approvers"), ...confirm, set({ "otp.code": CODE }), press("Change group"), screen("result"), text("Group updated"),
    group("upto", "line", "Any one of Dana Cruz, Maria Silva"), bank("corp.payments.get", "signatories.0.name", "Dana Cruz", { paymentId: "PAY-2040" }), bank("corp.payments.get", "signatories.1.name", "Lee Park", { paymentId: "PAY-2040" }), bank("corp.payments.get", "signatories.2", undefined, { paymentId: "PAY-2040" }),
  ], { ...open("upto", { "opt.secondGroup": false }) }),
  T("T-9", "Three wrong codes change nothing: the group is as it was", ["AC-7"], ravi, [set({ "eg.on3": true, "eg.mode": "seq" }), press("Review"), ...confirm, ...wrongCodes("Change group"), screen("locked"), text("We couldn’t confirm this change."), text("Nothing was changed."), group("over", "line", "In order: Dana Cruz, then Lee Park"), refuses("corp.signatories.update", "STEP_UP_FAILED", { group: "over", mode: "seq", on1: true, on2: true, on3: true })], open("over")),
  T("T-10", "With the option off the change applies at once: Group updated, and Approval groups show the new line", ["AC-5"], ravi, [
    set({ "eg.mode": "par", "eg.need": 2, "eg.on3": true }), press("Review"), screen("review"), text("Straight away"), noText("After a second administrator approves"), ...confirm, set({ "otp.code": CODE }), press("Change group"), screen("result"), text("Group updated"), text("Payments over 50,000 now has the new approvers."), text("Applied"), noText("Sent for approval"), noText("Second administrator"),
    view("groups.over.line", "2 of 3 together: Dana Cruz, Lee Park, Maria Silva"), view("waitingCount", 1), bank("corp.admin.get", "log.1.result", "Done"),
  ], open("over", { "opt.secondGroup": false })),
  T("T-11", "A timeout on the check shows Nothing was changed, and the group is as it was", ["AC-7"], ravi, [set({ "eg.on3": true }), press("Review"), screen("slow"), text("We didn’t get an answer in time"), text("Nothing was changed."), group("upto", "line", "Any one of Dana Cruz, Lee Park"), press("Try again"), screen("approvers")], { ...open("upto"), conditions: { timeout: ["corp.signatories.update"], latencyMs: 10_000 } }),
  T("T-12", "The bank unavailable on the check shows the sheet and changes nothing", ["AC-7"], ravi, [set({ "eg.on3": true }), press("Review"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was changed."), press("Try again"), screen("approvers")], { ...open("upto"), conditions: { unavailable: ["corp.signatories.update"] } }),
  T("T-13", "Alex at Alpha is a Maker: no admin permission, so the journey lands on You can’t change approval groups and the bank refuses him", ["AC-1"], maker, [
    screen("denied"), text("You can’t change approval groups at this company"), noText("Approvers"), refuses("corp.signatories.get", "PERMISSION_DENIED", {}), refuses("corp.signatories.update", "PERMISSION_DENIED", { group: "upto", mode: "any", on1: true }),
  ], open("upto")),
  T("T-14", "Alex at Beta is an Approver: refused too, and from Personal the bank does not answer for a company's groups", ["AC-1"], approver, [screen("denied"), refuses("corp.signatories.update", "PERMISSION_DENIED", { group: "upto", mode: "any", on1: true })], open("upto")),
  T("T-15", "From Personal the bank does not answer for a company's groups", ["AC-1"], { persona: "alex", now: "2026-11-03T10:42:00Z" }, [screen("denied"), text("Switch to your business first"), refuses("corp.signatories.update", "WRONG_CONTEXT", { group: "upto" })], open("upto")),
  T("T-16", "Without a group the first step lists both with their current line; a choice is needed", ["AC-1"], ravi, [
    screen("pick"), text("Step 1 of 3 · Edit approval group"), text("Which group?"), text("Payments over 50,000"), text("In order: Dana Cruz, then Lee Park"), text("Payments up to 50,000"), text("Any one of Dana Cruz, Lee Park"), press("Continue"), screen("pick"), error("eg.group"),
    set({ "eg.group": "over" }), press("Continue"), screen("approvers"), text("Step 2 of 3 · Edit approval group"), text("Payments over 50,000"), press("Back"), screen("pick"),
  ], open()),
  T("T-17", "Several together asks how many: more than the approvers chosen is refused, with the number", ["AC-2", "AC-3"], ravi, [
    set({ "eg.mode": "par", "eg.need": 3 }), press("Review"), screen("approvers"), text("Choose how many must approve, up to 2."), set({ "eg.need": 2 }), press("Review"), screen("review"), text("2 of 2 together: Dana Cruz, Lee Park"),
    refuses("corp.signatories.update", "INVALID_NEED", { group: "over", mode: "par", need: 1, on1: true, on2: true }), refuses("corp.signatories.update", "INVALID_MODE", { group: "over", mode: "bogus", on1: true }),
  ], open("over")),
  T("T-18", "A person who starts payments cannot be the only approver, and not an approver without enough others (Maria as a Maker and approver)", ["AC-4"], ravi, [
    set({ "eg.on1": false, "eg.on2": false, "eg.on3": true }), press("Review"), screen("approvers"), text("The person who starts payments can’t be the only approver."),
    set({ "eg.on1": true, "eg.mode": "par", "eg.need": 2 }), press("Review"), screen("approvers"), text("If Maria Silva starts a payment, there would not be enough other approvers."),
    refuses("corp.signatories.update", "SEPARATION", { group: "upto", mode: "any", on3: true }), group("upto", "line", "Any one of Dana Cruz, Lee Park"),
  ], { ...open("upto"), setup: [...ravi.setup, fine("maria", { role: "both" })] }),
  T("T-19", "Beta has four people who can approve, and its own groups; Noor changes the group up to 60,000 once the threshold is raised", ["AC-1", "AC-5"], noor, [
    screen("approvers"), text("Alex Morgan"), text("Lee Park"), text("Maria Silva"), text("Sam Okafor"), noText("Dana Cruz"), set({ "eg.on3": true }), press("Review"), text("Any one of Alex Morgan, Lee Park, Maria Silva"), group("upto", "count", 4),
  ], open("upto")),
  T("T-20", "The code names the group; an empty code is stopped by the field and nothing is sent", ["AC-7"], ravi, [set({ "eg.on3": true }), press("Review"), ...confirm, text("Change payments up to 50,000"), press("Change group"), error("otp.code"), screen("otp"), group("upto", "line", "Any one of Dana Cruz, Lee Park")], open("upto")),
  T("T-21", "The code not being sent shows the sheet and Try again returns to the review; the groups not loading shows the sheet", ["AC-7"], ravi, [set({ "eg.on3": true }), press("Review"), press("Confirm"), screen("unavailable"), press("Try again"), screen("review")], { ...open("upto"), conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-22", "The groups not loading shows the sheet and changes nothing", ["AC-7"], ravi, [screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("unavailable")], { ...open("upto"), conditions: { unavailable: ["corp.signatories.get"] } }),
  T("T-23", "A forced change without the code is refused by the bank, and as another user", ["AC-7"], ravi, [
    refuses("corp.signatories.update", "OTP_REQUIRED", { group: "upto", mode: "any", on1: true, on3: true }), refuses("corp.signatories.update", "PERMISSION_DENIED", { userId: "dana", group: "upto", mode: "any", on1: true, on3: true }), group("upto", "line", "Any one of Dana Cruz, Lee Park"),
    refuses("corp.signatories.update", "INVALID_GROUP", { group: "nope", mode: "any", on1: true }), refuses("corp.signatories.update", "INVALID_APPROVER", { group: "upto", mode: "any", approvers: ["ravi"] }),
  ], open("upto")),
  T("T-24", "Back to groups opens Admin", ["AC-5"], ravi, [set({ "eg.on3": true }), press("Review"), ...confirm, set({ "otp.code": CODE }), press("Change group"), press("Back to groups"), opens("admin")], open("upto")),
  T("T-25", "A mode and a number passed in are used, and the bank's choice of first and the order are kept in the log", ["AC-2"], ravi, [
    screen("approvers"), text("A set number of them approve, in any order."), set({ "eg.on3": true }), press("Review"), text("3 of 3 together: Dana Cruz, Lee Park, Maria Silva"),
  ], open("over", { "launch.mode": "par", "launch.need": 3 })),
  T("T-26", "A group of the spec's second seed (Beta, in order Alex then Lee) is shown as the bank has it", ["AC-1"], noor, [screen("approvers"), text("Payments over 50,000"), group("over", "line", "In order: Alex Morgan, then Lee Park")], open("over")),
];
