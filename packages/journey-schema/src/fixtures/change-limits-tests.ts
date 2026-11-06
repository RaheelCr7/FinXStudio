import type { Journey } from "../schema";
import { CODE, T, approver, bank, error, inspect, limits, maker, noor, noText, opens, press, ravi, refuses, screen, set, text, view, wrongCodes } from "./admin-kit";

/** What must be true for "Change limits" to be right (the spec's criteria). */
export const changeLimitsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The four settings (limit per person, company daily limit, two approvers above, extra code from) are listed with their current amounts; a person without the admin permission lands on \"You can’t change limits\" and the bank refuses them." },
  { id: "AC-2", text: "A new amount that equals the current one, is zero, or breaks a rule (above the company's daily limit, above the bank's ceiling, below the highest of the other settings) is refused by the bank with its words and nothing changes." },
  { id: "AC-3", text: "The review shows the setting, now, new, the difference and when it takes effect, and says whether a second administrator is needed." },
  { id: "AC-4", text: "An increase ends in \"Sent for approval\" and the limit stays as it was; a decrease ends in \"Limit changed\" and the new amount shows under Limits; with the option off an increase applies at once." },
  { id: "AC-5", text: "A setting that already has a change waiting cannot be changed again (\"A change to this is already waiting for approval.\")." },
  { id: "AC-6", text: "The code prompt names the setting and the amount and the bank asks for the code on its side; three wrong codes change nothing; a timeout or an unavailable bank changes nothing." },
  { id: "AC-7", text: "Approving a waiting increase on the admin view applies it, by another administrator and with a code, and declining leaves everything as it was." },
];

const open = (which?: string, extra: Record<string, unknown> = {}) => ({ launch: { ...(which ? { "launch.which": which } : {}), ...extra } });
const pick = (which: string, value: number) => [set({ "cl.which": which }), press("Continue"), screen("amount"), set({ "cl.value": value }), press("Review")];
const confirm = [press("Confirm"), screen("otp")];

export const changeLimitsScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "The four settings with their amounts; the limit per person to 200,000.00 is a decrease: Straight away, the code names the setting, Limit changed, Limits shows $200,000.00", ["AC-1", "AC-3", "AC-4", "AC-6"], ravi, [
    screen("which"), text("What to change?"), text("Step 1 of 3 · Change limits"), text("Most one person can send in a day · $250,000.00"), text("Most the company can send in a day · $1,000,000.00"), text("Payments above this need two approvers · $50,000.00"), text("Payments from this amount need a code · $25,000.00"),
    ...pick("person", 200_000), screen("review"), text("Step 3 of 3 · Change limits"), text("Limit per person"), text("$250,000.00"), text("$200,000.00"), text("Decrease of $50,000.00"), text("This applies straight away."), text("Straight away"), text("Alpha Trading LLC"), noText("A second administrator has to approve this."),
    ...confirm, text("Change limit per person to $200,000.00"), set({ "otp.code": CODE }), press("Change limit"), screen("result"), text("Limit changed"), text("Limit per person is now $200,000.00."), text("Applied"),
    limits("personText", "$200,000.00"), view("limitRows.0.value", "$200,000.00"), bank("corp.users.get", "limit", 200_000, { personId: "alex" }), bank("corp.admin.get", "log.1.what", "Lower the limit per person from $250,000.00 to $200,000.00"), bank("corp.admin.get", "log.1.result", "Done"),
  ], open()),
  T("T-2", "The company daily limit to 1,200,000.00 is an increase: Sent for approval, Waiting for approval, the limit is still $1,000,000.00 and the admin view shows it as waiting for another administrator", ["AC-4"], ravi, [
    ...pick("company", 1_200_000), screen("review"), text("Increase of $200,000.00"), text("A second administrator has to approve this."), text("After a second administrator approves"), ...confirm, text("Change company daily limit to $1,200,000.00"),
    set({ "otp.code": CODE }), press("Change limit"), screen("result"), text("Sent for approval"), text("Another administrator has to approve this increase. Your current limit stays until then."), text("Waiting for approval"), text("Second administrator"), noText("Limit changed"),
    limits("companyText", "$1,000,000.00"), limits("items.company.waiting", true), view("waiting.CHG-1044.mine", true), view("waiting.CHG-1044.canDecide", false), view("waiting.CHG-1044.text", "Raise the company daily limit from $1,000,000.00 to $1,200,000.00"),
    inspect("outbox.0.kind", "change-waiting"), bank("corp.admin.get", "log.1.result", "Waiting"),
  ], open()),
  T("T-3", "The four rules of the amount, in the order of the spec, each stays on the amount step with the bank's words: above the company limit, the same as now, above the bank's ceiling, below the highest limit", ["AC-2"], ravi, [
    ...pick("person", 1_200_000), screen("amount"), text("It can’t be above the company daily limit of $1,000,000.00."), set({ "cl.value": 250_000 }), press("Review"), screen("amount"), text("That is the same as now. Enter a different amount."),
    press("Back"), set({ "cl.which": "company" }), press("Continue"), set({ "cl.value": 2_500_000 }), press("Review"), screen("amount"), text("The bank’s ceiling is $2,000,000.00."),
    set({ "cl.value": 200_000 }), press("Review"), screen("amount"), text("It can’t be below $250,000.00, the highest limit or threshold set now."), noText("Step 3 of 3"),
    ...[["person", 1_200_000, "LIMIT_ABOVE_COMPANY"], ["person", 250_000, "LIMIT_SAME"], ["company", 2_500_000, "LIMIT_ABOVE_CEILING"], ["company", 200_000, "LIMIT_BELOW_OTHERS"], ["two", 1_100_000, "LIMIT_ABOVE_COMPANY"], ["code", 1_100_000, "CHANGE_PENDING"], ["two", 0, "INVALID_AMOUNT"], ["weekly", 10, "INVALID_SETTING"]]
      .map(([which, value, code]) => refuses("corp.limits.set", code as string, { which, value, dryRun: true })),
    limits("personText", "$250,000.00"), limits("companyText", "$1,000,000.00"),
  ], open()),
  T("T-4", "A setting with a change waiting (Alpha's extra code from) cannot be changed again, whatever the amount", ["AC-5"], ravi, [
    screen("which"), text("Payments from this amount need a code · $25,000.00"), ...pick("code", 40_000), screen("blocked"), text("A change to this is already waiting for approval."), noText("Enter your code"), press("Back"), screen("amount"),
    refuses("corp.limits.set", "CHANGE_PENDING", { which: "code", value: 40_000 }), limits("codeText", "$25,000.00"),
  ], open()),
  T("T-5", "Beta's two-approver threshold has CHG-1043 waiting: it is refused there, and Alpha's is not affected", ["AC-5"], noor, [
    ...pick("two", 40_000), screen("blocked"), text("A change to this is already waiting for approval."), refuses("corp.limits.set", "CHANGE_PENDING", { which: "two", value: 40_000 }), limits("items.code.waiting", false), limits("items.two.waiting", true),
  ], open()),
  T("T-6", "Approving the waiting increase CHG-1042 on the admin view applies it (another administrator, with the code); declining the other leaves everything as it was", ["AC-7"], ravi, [
    refuses("corp.changes.decide", "OTP_REQUIRED", { changeId: "CHG-1042", decision: "approve" }), bank("bank.otp.send", "sent", true), bank("bank.otp.verify", "verified", true, { code: CODE }),
    bank("corp.changes.decide", "message", "Approved. The change is live.", { changeId: "CHG-1042", decision: "approve" }), limits("codeText", "$30,000.00"), view("limitRows.4.value", "$30,000.00"), view("waiting.CHG-1042", undefined),
    bank("corp.admin.get", "log.1.what", "Approved raise the extra code threshold from $25,000.00 to $30,000.00 (CHG-1042)"), refuses("corp.changes.decide", "CHANGE_NOT_FOUND", { changeId: "CHG-1042", decision: "approve" }),
  ], open()),
  T("T-7", "Declining a waiting increase changes nothing", ["AC-7"], ravi, [
    bank("corp.changes.decide", "message", "Declined. Nothing was changed.", { changeId: "CHG-1042", decision: "decline" }), limits("codeText", "$25,000.00"), view("waiting.CHG-1042", undefined), bank("corp.admin.get", "log.1.what", "Declined raise the extra code threshold from $25,000.00 to $30,000.00 (CHG-1042)"),
  ], open()),
  T("T-8", "Nobody decides their own increase: the sender is refused, with and without a code", ["AC-7"], ravi, [
    ...pick("company", 1_200_000), ...confirm, set({ "otp.code": CODE }), press("Change limit"), screen("result"),
    bank("bank.otp.send", "sent", true), bank("bank.otp.verify", "verified", true, { code: CODE }), refuses("corp.changes.decide", "SELF_APPROVAL", { changeId: "CHG-1044", decision: "approve" }), refuses("corp.changes.decide", "SELF_APPROVAL", { changeId: "CHG-1044", decision: "decline" }), view("waiting.CHG-1044.mine", true),
  ], open()),
  T("T-9", "Approving a raise of the two-approver threshold (Beta's CHG-1043) changes the groups' title and the thresholds", ["AC-7"], noor, [
    bank("bank.otp.send", "sent", true), bank("bank.otp.verify", "verified", true, { code: CODE }), bank("corp.changes.decide", "status", "approved", { changeId: "CHG-1043", decision: "approve" }), limits("twoText", "$60,000.00"), view("groups.over.title", "Payments over 60,000"),
    bank("corp.company.get", "dualApprovalAbove", 60_000),
  ], open()),
  T("T-10", "Three wrong codes change nothing: the two-approver threshold stays", ["AC-6"], ravi, [
    ...pick("two", 40_000), ...confirm, ...wrongCodes("Change limit"), screen("locked"), text("We couldn’t confirm this change."), text("Nothing was changed."), limits("twoText", "$50,000.00"), refuses("corp.limits.set", "STEP_UP_FAILED", { which: "two", value: 40_000 }),
  ], open()),
  T("T-11", "An empty code is stopped by the field and nothing is sent", ["AC-6"], ravi, [...pick("two", 40_000), ...confirm, press("Change limit"), error("otp.code"), screen("otp"), limits("twoText", "$50,000.00")], open()),
  T("T-12", "A timeout on the check shows Nothing was changed; Try again returns to the amount; the limits are as they were", ["AC-6"], ravi, [
    set({ "cl.value": 40_000 }), press("Review"), screen("slow"), text("We didn’t get an answer in time"), text("Nothing was changed."), limits("twoText", "$50,000.00"),
  ], { ...open("two"), conditions: { timeout: ["corp.limits.set"], latencyMs: 10_000 } }),
  T("T-13", "The bank unavailable on the check shows the sheet and changes nothing", ["AC-6"], ravi, [set({ "cl.value": 40_000 }), press("Review"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was changed."), limits("twoText", "$50,000.00")], { ...open("two"), conditions: { unavailable: ["corp.limits.set"] } }),
  T("T-14", "The limits not loading shows the sheet", ["AC-6"], ravi, [screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("unavailable")], { ...open(), conditions: { unavailable: ["corp.limits.get"] } }),
  T("T-15", "The code not being sent shows the sheet and Try again returns to the review", ["AC-6"], ravi, [set({ "cl.value": 40_000 }), press("Review"), press("Confirm"), screen("unavailable"), press("Try again"), screen("review")], { ...open("two"), conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-16", "With the option off an increase applies at once: Limit changed", ["AC-4"], ravi, [
    ...pick("company", 1_200_000), screen("review"), text("This applies straight away."), text("Straight away"), noText("A second administrator has to approve this."), ...confirm, set({ "otp.code": CODE }), press("Change limit"), screen("result"), text("Limit changed"), noText("Sent for approval"),
    limits("companyText", "$1,200,000.00"), view("waitingCount", 1),
  ], open(undefined, { "opt.secondIncrease": false })),
  T("T-17", "With a setting passed in, the first step is skipped and the steps say 1 of 2 and 2 of 2; Back leaves the journey", ["AC-3"], ravi, [
    screen("amount"), text("Step 1 of 2 · Change limits"), text("Now $50,000.00"), noText("Step 2 of 3"), set({ "cl.value": 40_000 }), press("Review"), screen("review"), text("Step 2 of 2 · Change limits"), text("Decrease of $10,000.00"),
  ], open("two")),
  T("T-18", "The person limit shows the company's daily limit and the company limit shows the bank's ceiling beside the amount", ["AC-3"], ravi, [
    set({ "cl.which": "person" }), press("Continue"), text("Company daily limit"), text("$1,000,000.00"), noText("Ceiling set by the bank"), press("Back"), set({ "cl.which": "company" }), press("Continue"), text("Ceiling set by the bank"), text("$2,000,000.00"),
  ], open()),
  T("T-19", "Without a setting chosen the first step stops: the field says it is required", ["AC-1"], ravi, [screen("which"), press("Continue"), screen("which"), error("cl.which")], open()),
  T("T-20", "A zero or empty amount is stopped by the field", ["AC-2"], ravi, [set({ "cl.which": "person" }), press("Continue"), press("Review"), screen("amount"), error("cl.value"), refuses("corp.limits.set", "INVALID_AMOUNT", { which: "person", value: 0 }), refuses("corp.limits.set", "INVALID_AMOUNT", { which: "person", value: 99.999 })], open()),
  T("T-21", "Lowering a limit that is a ceiling for the people lowers their limits too: Alex's limit follows 200,000.00", ["AC-4"], ravi, [
    ...pick("person", 200_000), ...confirm, set({ "otp.code": CODE }), press("Change limit"), screen("result"), view("people.alex.limitText", "$200,000.00"), bank("corp.company.get", "personLimit", undefined), bank("corp.users.get", "ceiling", 200_000, { personId: "alex" }),
  ], open()),
  T("T-22", "Alex at Alpha is a Maker: no admin permission, so the journey lands on You can’t change limits and the bank refuses him", ["AC-1"], maker, [
    screen("denied"), text("You can’t change limits at this company"), noText("What to change?"), refuses("corp.limits.get", "PERMISSION_DENIED", {}), refuses("corp.limits.set", "PERMISSION_DENIED", { which: "person", value: 200_000 }), refuses("corp.changes.decide", "PERMISSION_DENIED", { changeId: "CHG-1042", decision: "approve" }),
  ], open()),
  T("T-23", "Alex at Beta is an Approver, and from Personal the journey is refused as belonging to the company's banking", ["AC-1"], approver, [screen("denied"), refuses("corp.limits.set", "PERMISSION_DENIED", { which: "person", value: 200_000 })], open()),
  T("T-24", "From Personal the bank does not answer for a company's limits", ["AC-1"], { persona: "alex", now: "2026-11-03T10:42:00Z" }, [screen("denied"), text("Switch to your business first"), refuses("corp.limits.set", "WRONG_CONTEXT", { which: "person", value: 200_000 })], open()),
  T("T-25", "A forced increase without the code is refused by the bank, and a forced call as another user too", ["AC-6"], ravi, [
    refuses("corp.limits.set", "OTP_REQUIRED", { which: "person", value: 200_000 }), refuses("corp.limits.set", "PERMISSION_DENIED", { userId: "dana", which: "person", value: 200_000 }), limits("personText", "$250,000.00"),
  ], open()),
  T("T-26", "Back from the review returns to the amount and Back from the amount to the choice; the amount stays", ["AC-3"], ravi, [
    ...pick("two", 40_000), press("Back"), screen("amount"), text("Now $50,000.00"), press("Back"), screen("which"),
  ], open()),
  T("T-27", "The change is written to the log with the sender and the amounts and no code", ["AC-4"], ravi, [
    set({ "cl.which": "two" }), press("Continue"), set({ "cl.value": 40_000 }), press("Review"), ...confirm, set({ "otp.code": CODE }), press("Change limit"), screen("result"),
    inspect("log.0.who", "ravi"), inspect("log.0.what", "Lower the two-approver threshold from $50,000.00 to $40,000.00"), bank("corp.audit.list", "1.action", "Lower the two-approver threshold from $50,000.00 to $40,000.00"), noText("482100"),
  ], open()),
  T("T-28", "Back to limits opens Admin", ["AC-4"], ravi, [...pick("two", 40_000), ...confirm, set({ "otp.code": CODE }), press("Change limit"), press("Back to limits"), opens("admin")], open()),
];
