import type { Journey } from "../schema";
import { CODE, NOW, T, approver, bank, inspect, limits, maker, noor, noText, opens, press, ravi, refuses, screen, set, text, view, wrongCodes } from "./admin-kit";

/** What must be true for "Admin" to be right (the spec's criteria). */
export const adminAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A person without the admin permission sees \"You don’t have access\" and the button to preview as the company's administrator, and no people, limits or groups; the bank refuses every admin call." },
  { id: "AC-2", text: "The preview shows People, Limits, Approval groups and Activity log, with the seed values of the active company." },
  { id: "AC-3", text: "A change sent by another administrator shows Approve and Decline; the acting administrator's own change shows only \"Waiting for another administrator\", and the bank refuses to let a person decide their own." },
  { id: "AC-4", text: "Approve applies the change (with the one-time code, by another administrator) and writes an activity entry; Decline leaves everything as it was." },
  { id: "AC-5", text: "Switching company ends the preview, and the other company shows its own people and its own waiting change; exiting the preview returns to the lock screen." },
  { id: "AC-6", text: "With the option Show the activity log off, the Activity log section is not offered and the bank sends none." },
];

const preview = "Preview as Ravi Menon (administrator)";
const waitingMine = { adapter: "corp.sandbox.arrange", input: { op: "admChange", by: "ravi", text: "Raise the company daily limit from $1,000,000.00 to $1,200,000.00", kind: "limit", which: "company", data: { which: "company", value: 1_200_000 } } };
const fine = (id: string, patch: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input: { op: "admRoles", personId: id, ...patch } });
const tab = (t: string) => set({ "ad.tab": t });
const code = [press("Approve"), screen("otp")];

export const adminScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Alex at Alpha (a Maker): Open Admin shows the lock screen with the preview button and no data at all", ["AC-1"], maker, [
    screen("noaccess"), text("You don’t have access"), text("Only administrators can manage people and limits."), text(preview), noText("Dana Cruz"), noText("Limit per person"), noText("Approval groups"), noText("Invite user"),
    refuses("corp.admin.get", "PERMISSION_DENIED", {}), refuses("corp.changes.decide", "PERMISSION_DENIED", { changeId: "CHG-1042", decision: "approve" }), refuses("corp.limits.get", "PERMISSION_DENIED", {}),
  ]),
  T("T-2", "The preview: the bar, nine people at Alpha with Sam Okafor Invited and Ravi marked (you) and with no buttons", ["AC-2"], maker, [
    press(preview), screen("main"), text("Previewing as Ravi Menon, an administrator."), text("Admin"), text("People"), text("Invite user"), text("Alex Morgan"), text("Dana Cruz"), text("Lee Park"), text("Maria Silva"), text("Priya Nair"), text("Omar Haddad"), text("Sam Okafor"), text("Invited"), text("Ravi Menon (you)"), text("Mina Das"),
    text("Maker"), text("$250,000.00"), text("Administrator"), text("Active"), view("people.ravi.canEdit", false), view("people.ravi.canDisable", false), view("people.dana.canEdit", true),
    press("ravi"), screen("person"), text("Ravi Menon (you)"), noText("Disable"), noText("Enable"), press("Back"), screen("main"),
  ]),
  T("T-3", "The other sections: the five limits, the two approval groups with their lines, and the activity log newest first with the Refused chip", ["AC-2"], ravi, [
    tab("limits"), text("Limit per person"), text("$250,000.00"), text("Company daily limit"), text("$1,000,000.00"), text("Ceiling set by the bank"), text("$2,000,000.00"), text("Two approvers above"), text("$50,000.00"), text("Extra code from"), text("$25,000.00"), text("Change limits"),
    tab("groups"), text("Payments over 50,000"), text("In order: Dana Cruz, then Lee Park"), text("Payments up to 50,000"), text("Any one of Dana Cruz, Lee Park"), text("Edit group"),
    tab("log"), text("Signed in to Alpha Trading LLC as Maker"), text("Changed Dana Cruz’s daily limit from 100,000.00 to 150,000.00"), text("Started payment PAY-2039 of USD 64,500.00"), text("Invited Priya Nair as Maker"), text("Sign in attempt"), text("3 Nov 10:14"), text("Refused"), text("Done"), view("logCount", 5),
  ]),
  T("T-4", "A change sent by another administrator waits for a second one: CHG-1042 by Mina Das with Approve and Decline", ["AC-3"], ravi, [
    text("Waiting for a second administrator"), text("Raise the extra code threshold from $25,000.00 to $30,000.00"), text("Sent by Mina Das · 3 Nov 09:20"), press("Raise the extra code threshold from $25,000.00 to $30,000.00"), screen("change"), text("Approve"), text("Decline"), noText("Waiting for another administrator"),
  ]),
  T("T-5", "Approve CHG-1042: the code, the line Approved. The change is live., Extra code from $30,000.00, the log has the entry", ["AC-4"], ravi, [
    press("Raise the extra code threshold from $25,000.00 to $30,000.00"), ...code, text("Approve Raise the extra code threshold from $25,000.00 to $30,000.00"), set({ "otp.code": CODE }), press("Approve"), screen("main"), text("Approved. The change is live."), noText("Waiting for a second administrator"),
    tab("limits"), text("$30,000.00"), noText("$25,000.00"), tab("log"), text("Approved raise the extra code threshold from $25,000.00 to $30,000.00 (CHG-1042)"), limits("codeText", "$30,000.00"), bank("corp.admin.get", "log.1.result", "Done"),
  ]),
  T("T-6", "Decline CHG-1042: the line Declined. Nothing was changed., Extra code from is still $25,000.00, and the log has the entry", ["AC-4"], ravi, [
    press("Raise the extra code threshold from $25,000.00 to $30,000.00"), press("Decline"), screen("main"), text("Declined. Nothing was changed."), noText("Waiting for a second administrator"), tab("limits"), text("$25,000.00"), noText("$30,000.00"),
    tab("log"), text("Declined raise the extra code threshold from $25,000.00 to $30,000.00 (CHG-1042)"), limits("codeText", "$25,000.00"),
  ]),
  T("T-7", "The acting administrator's own change shows only Waiting for another administrator, with no Approve and no Decline, and the bank refuses to let him decide it", ["AC-3"], ravi, [
    press("Raise the company daily limit from $1,000,000.00 to $1,200,000.00"), screen("change"), text("Waiting for another administrator"), text("Sent by you"), noText("Approve"), noText("Decline"),
    refuses("corp.changes.decide", "SELF_APPROVAL", { changeId: "CHG-1044", decision: "decline" }), refuses("corp.changes.decide", "SELF_APPROVAL", { changeId: "CHG-1044", decision: "approve" }), limits("companyText", "$1,000,000.00"),
  ], { setup: [...ravi.setup, waitingMine] }),
  T("T-8", "Three wrong codes on Approve change nothing: the limit stays", ["AC-4"], ravi, [
    press("Raise the extra code threshold from $25,000.00 to $30,000.00"), ...code, ...wrongCodes("Approve"), screen("locked"), text("We couldn’t confirm this change."), text("Nothing was changed."), limits("codeText", "$25,000.00"), refuses("corp.changes.decide", "STEP_UP_FAILED", { changeId: "CHG-1042", decision: "approve" }),
  ]),
  T("T-9", "Approving needs the code on the bank's side too, and an empty code is stopped by the field", ["AC-4"], ravi, [
    refuses("corp.changes.decide", "OTP_REQUIRED", { changeId: "CHG-1042", decision: "approve" }), refuses("corp.changes.decide", "CHANGE_NOT_FOUND", { changeId: "CHG-9999", decision: "approve" }), refuses("corp.changes.decide", "INVALID_DECISION", { changeId: "CHG-1042", decision: "maybe" }),
    press("Raise the extra code threshold from $25,000.00 to $30,000.00"), ...code, press("Approve"), screen("otp"), limits("codeText", "$25,000.00"),
  ]),
  T("T-10", "Switching to Beta ends the preview: the same call is refused there; with the preview on Beta shows Noor, Karim's change and none of Alpha's", ["AC-5"], ravi, [
    bank("bank.session.switch", "id", "beta", { contextId: "beta" }), refuses("corp.admin.get", "PERMISSION_DENIED", {}), bank("bank.session.preview", "name", "Noor Sayegh", { on: true }), view("company.name", "Beta Services Ltd"), view("people.noor.label", "Noor Sayegh (you)"), view("waiting.CHG-1043.byName", "Karim Aziz"), view("people.dana", undefined), view("waiting.CHG-1042", undefined),
  ]),
  T("T-11", "Beta with the preview on: Noor, CHG-1043 by Karim Aziz, Beta's own people, and none of Alpha's", ["AC-5"], noor, [
    text("Previewing as Noor Sayegh, an administrator."), text("Noor Sayegh (you)"), text("Karim Aziz"), text("Sam Okafor"), noText("Dana Cruz"), noText("Mina Das"), text("Raise the two-approver threshold from $50,000.00 to $60,000.00"), text("Sent by Karim Aziz · 3 Nov 08:50"), noText("Raise the extra code threshold"),
    press("Raise the two-approver threshold from $50,000.00 to $60,000.00"), screen("change"), text("Approve"), text("Decline"),
  ]),
  T("T-12", "Exit ends the preview: the lock screen comes back, and the bank refuses the admin calls again", ["AC-5"], ravi, [
    text("Previewing as Ravi Menon, an administrator."), press("Exit"), screen("noaccess"), text("You don’t have access"), text(preview), noText("Dana Cruz"), refuses("corp.admin.get", "PERMISSION_DENIED", {}),
  ]),
  T("T-13", "With the option Show the activity log off, the section is not offered and the bank sends no log", ["AC-6"], ravi, [
    text("People"), text("Limits"), text("Approval groups"), noText("Activity log"), tab("log"), noText("Signed in to Alpha Trading LLC as Maker"), bank("corp.admin.get", "logCount", 0, { log: false }),
  ], { launch: { "opt.showLog": false } }),
  T("T-14", "With the option on the log is offered as a section", ["AC-6"], ravi, [text("Activity log")]),
  T("T-15", "A waiting change by a person who was just disabled still shows who sent it; a change of a person disables their row's buttons", ["AC-3"], ravi, [
    press("mina"), screen("person"), text("Mina Das"), text("Change waiting"), noText("Edit"), noText("Disable"), noText("Enable"),
  ], { setup: [...ravi.setup, { adapter: "corp.sandbox.arrange", input: { op: "admChange", by: "ravi", text: "Disable Mina Das", kind: "user", personId: "mina", data: { op: "disable", personId: "mina", patch: {} } } }] }),
  T("T-16", "A person's card offers Edit and Disable, and Enable only for a disabled person; each opens Manage a user with the person", ["AC-2"], ravi, [
    press("dana"), screen("person"), text("Dana Cruz"), text("Approver"), noText("Enable"), press("Edit"), opens("manage-user", { "launch.mode": "edit", "launch.userId": "dana" }),
  ]),
  T("T-17", "Disable opens Manage a user in disable mode", ["AC-2"], ravi, [press("lee"), press("Disable"), opens("manage-user", { "launch.mode": "disable", "launch.userId": "lee" })]),
  T("T-18", "A disabled person's card offers Enable only", ["AC-2"], ravi, [press("lee"), screen("person"), text("Disabled"), noText("Edit"), view("people.lee.canDisable", false), press("Enable"), opens("manage-user", { "launch.mode": "enable", "launch.userId": "lee" })], { setup: [...ravi.setup, fine("lee", { status: "disabled" })] }),
  T("T-19", "Invite user opens Manage a user in invite mode", ["AC-2"], ravi, [press("Invite user"), opens("manage-user", { "launch.mode": "invite" })]),
  T("T-20", "Change limits opens the limits journey, and Edit group opens the group journey for that group", ["AC-2"], ravi, [tab("limits"), press("Change limits"), opens("change-limits")]),
  T("T-21", "Edit group opens the approval group journey with the group", ["AC-2"], ravi, [tab("groups"), press("Edit group"), opens("edit-signatory-group", { "launch.group": "over" })]),
  T("T-22", "The new waiting change of a limit sent from Change limits shows in the card of the waiting changes with the sender", ["AC-3"], ravi, [
    text("Waiting for a second administrator"), text("Raise the company daily limit from $1,000,000.00 to $1,200,000.00"), text("Sent by you · 3 Nov 10:42"), tab("limits"), text("$1,000,000.00"),
  ], { setup: [...ravi.setup, waitingMine] }),
  T("T-23", "A company with no administrator to preview (the new company) has the lock screen and no preview button", ["AC-1"], { persona: "alexempty", context: "gamma", now: NOW }, [screen("noaccess"), text("You don’t have access"), noText("Preview as"), refuses("bank.session.preview", "NOT_SUPPORTED", { on: true })]),
  T("T-24", "From Personal the bank does not answer for a company's people", ["AC-1"], { persona: "alex", now: NOW }, [screen("denied"), text("Switch to your business first"), refuses("corp.admin.get", "WRONG_CONTEXT", {})]),
  T("T-25", "Alex at Beta is an Approver: the lock screen with the preview button for Noor", ["AC-1"], approver, [screen("noaccess"), text("Preview as Noor Sayegh (administrator)"), noText("Karim Aziz")]),
  T("T-26", "A timeout on the view shows Nothing was changed, and the bank being unavailable shows the sheet", ["AC-2"], ravi, [screen("slow"), text("We didn’t get an answer in time"), text("Nothing was changed."), press("Try again"), screen("slow")], { conditions: { timeout: ["corp.admin.get"], latencyMs: 10_000 } }),
  T("T-27", "The bank unavailable on the view shows the sheet", ["AC-2"], ravi, [screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was changed."), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.admin.get"] } }),
  T("T-28", "The bank unavailable on a decision shows the sheet, Try again returns to Admin, and nothing was changed", ["AC-4"], ravi, [press("Raise the extra code threshold from $25,000.00 to $30,000.00"), press("Decline"), screen("unavailable"), limits("codeText", "$25,000.00"), press("Try again"), screen("main")], { conditions: { unavailable: ["corp.changes.decide"] } }),
  T("T-29", "A timeout on a decision says to check Admin before trying again, and the change is not applied twice", ["AC-4"], ravi, [press("Raise the extra code threshold from $25,000.00 to $30,000.00"), press("Decline"), screen("timeout"), text("Check the Admin tab before you try again"), limits("codeText", "$25,000.00")], { conditions: { timeout: ["corp.changes.decide"], latencyMs: 10_000 } }),
  T("T-30", "The code not being sent shows the sheet and Try again returns to Admin", ["AC-4"], ravi, [press("Raise the extra code threshold from $25,000.00 to $30,000.00"), press("Approve"), screen("unavailable"), press("Try again"), screen("main")], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-31", "The lock screen reads who the preview would be without turning it on, and the bank refuses the preview without a step-up", ["AC-1"], maker, [
    screen("noaccess"), bank("bank.session.preview", "on", false, {}), bank("bank.session.preview", "name", "Ravi Menon", {}), bank("bank.session.preview", "on", false, {}),
  ]),
  T("T-32", "The log of the change just made: the sender is the administrator, and the activity entry carries no code and no value", ["AC-4"], ravi, [
    press("Raise the extra code threshold from $25,000.00 to $30,000.00"), ...code, set({ "otp.code": CODE }), press("Approve"), inspect("log.0.who", "ravi"), bank("corp.audit.list", "1.action", "Approved raise the extra code threshold from $25,000.00 to $30,000.00 (CHG-1042)"), noText("482100"),
  ]),
];
