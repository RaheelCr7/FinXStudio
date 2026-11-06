import type { Journey } from "../schema";
import { CODE, T, approver, bank, error, inspect, maker, noor, noText, opens, press, ravi, refuses, screen, set, text, view, wrongCodes } from "./admin-kit";

/** What must be true for "Invite, edit or disable a user" to be right (the spec's criteria). */
export const manageUserAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "An invitation needs a name, a valid new work email, a mobile number, a role, at least one account and, for a Maker, a daily limit within the company's and the per-person limit; each refusal is the bank's, with its words, and nobody is added." },
  { id: "AC-2", text: "An email that already has access is refused with \"This email already has access. Edit that person instead.\"" },
  { id: "AC-3", text: "Edit shows only what changed as \"before → after\" and cannot be reviewed without a change (\"Change something to continue.\")." },
  { id: "AC-4", text: "Removing the Maker role from a person with payments waiting is refused; disabling such a person is allowed and the payments stay as they are." },
  { id: "AC-5", text: "An administrator cannot disable or change themselves, and the last active administrator and the last approver of a group cannot be disabled or demoted; the bank refuses forced calls with the same words." },
  { id: "AC-6", text: "Anything involving an administrator ends in \"Sent for approval\" and changes nothing until another administrator approves; with the option off it applies at once; a person without the admin permission lands on \"You can’t manage people\" and the bank refuses them." },
  { id: "AC-7", text: "The code prompt names the action and the bank asks for the code on its side; three wrong codes change nothing; a timeout or an unavailable bank changes nothing." },
  { id: "AC-8", text: "Every outcome is written to the activity log (with the email masked), the invited person and the other administrators are told, and a person's access follows what was changed." },
];

const invite = { "launch.mode": "invite" };
const who = { "mu.name": "Sam Okafor", "mu.email": "sam.okafor@example.com", "mu.phone": "+1 415 555 0100" };
const toAccess = [set(who), press("Continue"), screen("access")];
const edit = (id: string) => ({ launch: { "launch.mode": "edit", "launch.userId": id } });
const disable = (id: string, extra: Record<string, unknown> = {}) => ({ launch: { "launch.mode": "disable", "launch.userId": id, ...extra } });
const confirm = [press("Confirm"), screen("otp")];
const people = (id: string, path: string, equals: unknown) => view(`people.${id}.${path}`, equals);
const fine = (id: string) => ({ adapter: "corp.sandbox.arrange", input: { op: "admRoles", personId: id, status: "disabled" } });
const newId = "u_sam_okafor";

export const manageUserScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Invite Sam Okafor as a Maker with all accounts and 100,000.00: the review, the code that names the action, Invitation sent, a new row at the bottom of People, the log, and the invited person told", ["AC-1", "AC-7", "AC-8"], ravi, [
    screen("who"), text("Who is it?"), text("Step 1 of 3 · Manage a user"), set(who), press("Continue"), screen("access"), text("Role and access"), text("Operating ••2001"), text("Reserve ••2044"), text("Up to $250,000.00 for one person."),
    set({ "mu.role": "maker", "mu.limit": 100_000 }), press("Review"), screen("review"), text("Step 3 of 3 · Manage a user"), text("Sam Okafor"), text("s•••@example.com"), text("•••• 0100"), text("Maker"), text("All accounts"), text("$100,000.00"), text("Alpha Trading LLC"), noText("Second administrator needed"), noText("sam.okafor@example.com"),
    press("Confirm"), screen("otp"), text("Invite Sam Okafor"), text("Code sent to"), set({ "otp.code": CODE }), press("Invite"), screen("result"), text("Invitation sent"), text("We emailed s•••@example.com. They can sign in after they accept."), text("Invited"), text("Alpha Trading LLC"),
    people(newId, "statusText", "Invited"), people(newId, "roleText", "Maker"), people(newId, "limitText", "$100,000.00"), bank("corp.admin.get", "log.1.what", "Invited Sam Okafor as Maker (s•••@example.com)"), bank("corp.admin.get", "log.1.result", "Done"),
    inspect("outbox.0.to", "s•••@example.com"), inspect("outbox.0.kind", "invitation"), bank("corp.users.list", `${newId}.name`, "Sam Okafor"),
  ], { launch: invite }),
  T("T-2", "A Maker with 1,200,000.00 and then 300,000.00: the bank's two messages, in order, nobody is added", ["AC-1"], ravi, [
    ...toAccess, set({ "mu.role": "maker", "mu.limit": 1_200_000 }), press("Review"), screen("access"), text("That is above the company limit of $1,000,000.00."), noText("Invitation sent"),
    set({ "mu.limit": 300_000 }), press("Review"), screen("access"), text("The most one person can have is $250,000.00."), view("logCount", 5),
    refuses("corp.users.invite", "LIMIT_ABOVE_COMPANY", { name: "Sam Okafor", email: "sam.okafor@example.com", phone: "+1 415 555 0100", role: "maker", on1: true, limit: 1_200_000 }),
    refuses("corp.users.invite", "LIMIT_ABOVE_PERSON", { name: "Sam Okafor", email: "sam.okafor@example.com", phone: "+1 415 555 0100", role: "maker", on1: true, limit: 300_000 }),
    refuses("corp.users.invite", "INVALID_AMOUNT", { name: "Sam Okafor", email: "sam.okafor@example.com", phone: "+1 415 555 0100", role: "maker", on1: true, limit: 0 }),
    bank("corp.admin.get", `people.${newId}`, undefined),
  ], { launch: invite }),
  T("T-3", "An email that already has access (Dana Cruz's) is refused on the first step with the spec's words", ["AC-2"], ravi, [
    set({ ...who, "mu.email": "dana.cruz@alpha.example" }), press("Continue"), screen("who"), text("This email already has access. Edit that person instead."), noText("Role and access"),
    refuses("corp.users.invite", "USER_EXISTS", { name: "Sam Okafor", email: "DANA.cruz@alpha.example", phone: "+1 415 555 0100", role: "maker", on1: true, limit: 1000 }),
  ], { launch: invite }),
  T("T-4", "A name, an email and a mobile number are each checked by the bank with its words; no account is refused too", ["AC-1"], ravi, [
    set({ ...who, "mu.name": "7even" }), press("Continue"), screen("who"), text("Enter their full name."),
    set({ "mu.name": "Sam Okafor", "mu.email": "sam@@example.com" }), press("Continue"), screen("who"), text("Enter a valid work email, like name@company.com."),
    set({ "mu.email": "sam.okafor@example.com", "mu.phone": "415 555 0100" }), press("Continue"), screen("who"), text("Enter a mobile number with the country code, like +1 415 555 0100."),
    set({ "mu.phone": "+1 415 555 0100" }), press("Continue"), screen("access"),
    set({ "mu.on1": false, "mu.on2": false, "mu.limit": 100_000 }), press("Review"), screen("access"), text("Choose at least one account."),
    refuses("corp.users.invite", "INVALID_NAME", { name: "x", email: "a@b.co", phone: "+1 415 555 0100", role: "maker", on1: true, limit: 1000 }),
    refuses("corp.users.invite", "INVALID_PHONE", { name: "Sam Okafor", email: "a@b.co", phone: "+1 415", role: "maker", on1: true, limit: 1000 }),
    refuses("corp.users.invite", "INVALID_ROLE", { name: "Sam Okafor", email: "a@b.co", phone: "+1 415 555 0100", role: "boss", on1: true }),
  ], { launch: invite }),
  T("T-5", "A role that is not a Maker has no daily limit: an Approver is invited without one, and the limit row is not on the review", ["AC-1"], ravi, [
    ...toAccess, set({ "mu.role": "approver" }), noText("Daily limit"), press("Review"), screen("review"), text("Approver"), noText("Daily limit"), confirm[0]!, confirm[1]!, set({ "otp.code": CODE }), press("Invite"), screen("result"), text("Invitation sent"), people(newId, "limitText", "-"),
  ], { launch: invite }),
  T("T-6", "Edit Dana Cruz to Maker and approver with 15,000.00: the review shows only Role and Daily limit as before to after, Changes saved, the note about never approving their own", ["AC-3", "AC-8"], ravi, [
    screen("who"), text("Dana Cruz"), text("d•••@alpha.example"), press("Continue"), screen("access"), text("Role and access"),
    set({ "mu.role": "both" }), text("They can start and approve payments, but never approve their own."), set({ "mu.limit": 15_000 }), press("Review"), screen("review"), text("Approver → Maker and approver"), text("- → $15,000.00"), noText("Mobile"), noText("Accounts"), noText("Name"),
    ...confirm, text("Save changes for Dana Cruz"), set({ "otp.code": CODE }), press("Save changes"), screen("result"), text("Changes saved"), text("role, daily limit"),
    people("dana", "roleText", "Maker and approver"), people("dana", "limitText", "$15,000.00"), bank("corp.users.list", "dana.sub", "initiator and approver"), bank("corp.admin.get", "log.1.what", "Changed Dana Cruz: role, daily limit"),
  ], edit("dana")),
  T("T-7", "Edit and change nothing: Review is refused with \"Change something to continue.\"; the name and the mobile number can change too", ["AC-3"], ravi, [
    press("Continue"), screen("access"), press("Review"), screen("access"), text("Change something to continue."), noText("Review the changes"),
    screen("access"), press("Back"), screen("who"), set({ "mu.name": "Dana Cruz-Lopez", "mu.phone": "+1 415 555 0199" }), press("Continue"), set({ "mu.on2": false }), press("Review"), screen("review"), text("Dana Cruz → Dana Cruz-Lopez"), text("•••• 0121 → •••• 0199"), text("All accounts → Operating ••2001"),
  ], edit("dana")),
  T("T-8", "Noor at Beta: removing the Maker role from Priya Nair, who has a payment waiting, is refused with the spec's words", ["AC-4"], noor, [
    screen("who"), press("Continue"), set({ "mu.role": "approver" }), press("Review"), screen("access"), text("This person has payments waiting for approval. Remove the Maker role after they are approved or rejected."), noText("Changes saved"),
    people("priya", "roleText", "Maker"),
    refuses("corp.users.update", "USER_HAS_PENDING_PAYMENTS", { personId: "priya", name: "Priya Nair", phone: "+1 415 555 0124", role: "approver", on1: true, on2: true }),
  ], edit("priya")),
  T("T-9", "Disable Priya Nair (a payment of hers waits) because she left the company: the notice, the review, the code, \"Priya Nair is disabled\", and the payment still waits", ["AC-4", "AC-8"], noor, [
    screen("why"), text("1 payment(s) waiting. They stay as they are after Priya Nair is disabled."), text("Step 1 of 2 · Manage a user"), set({ "mu.reason": "Left the company" }), press("Review"), screen("review"), text("Step 2 of 2 · Manage a user"), text("Active → Disabled"), text("Left the company"), text("Maker"),
    ...confirm, text("Disable Priya Nair"), set({ "otp.code": CODE }), press("Disable"), screen("result"), text("Priya Nair is disabled"), text("They are signed out now."), text("Disabled"),
    people("priya", "statusText", "Disabled"), people("priya", "canEnable", true), people("priya", "canEdit", false), bank("corp.payments.get", "status", "pending_approval", { paymentId: "PAY-2041" }), bank("corp.users.list", "priya.sub", ""),
    bank("corp.admin.get", "log.1.what", "Disabled Priya Nair. Reason: Left the company"),
  ], disable("priya")),
  T("T-10", "Ravi's own row has no buttons, and a forced disable of himself or an edit of his own access is refused; with only one active administrator the last one cannot be disabled or demoted", ["AC-5"], ravi, [
    people("ravi", "label", "Ravi Menon (you)"), people("ravi", "canEdit", false), people("ravi", "canDisable", false), people("mina", "canDisable", true),
    refuses("corp.users.disable", "CANNOT_DISABLE_SELF", { personId: "ravi", reason: "Left the company" }),
    refuses("corp.users.update", "SELF_CHANGE", { personId: "ravi", name: "Ravi Menon", phone: "+1 415 555 0126", role: "admin", on1: true, limit: 0 }),
    refuses("corp.users.enable", "SELF_CHANGE", { personId: "ravi" }),
    bank("corp.sandbox.arrange", "ok", true, { op: "admSingleAdmin", personId: "mina" }),
    refuses("corp.users.disable", "LAST_ADMIN", { personId: "mina", reason: "Left the company" }),
    refuses("corp.users.update", "LAST_ADMIN", { personId: "mina", name: "Mina Das", phone: "+1 415 555 0127", role: "viewer", on1: true }),
    people("mina", "statusText", "Active"),
  ]),
  T("T-11", "Disabling yourself from the journey says so on a screen of its own, and nothing is asked", ["AC-5"], ravi, [
    set({ "mu.reason": "Left the company" }), press("Review"), screen("blocked"), text("You can’t disable yourself. Ask another administrator."), noText("Enter your code"), press("Back"), screen("why"), people("ravi", "statusText", "Active"),
  ], disable("ravi")),
  T("T-12", "The only approver left of a group cannot be disabled: Lee is the only active approver once Dana is disabled", ["AC-5"], ravi, [
    set({ "mu.reason": "Left the company" }), press("Review"), screen("blocked"), text("Lee Park is the only approver left for Payments over 50,000. Choose another approver first."), people("lee", "statusText", "Active"),
    refuses("corp.users.disable", "LAST_APPROVER", { personId: "lee", reason: "Left the company" }),
    refuses("corp.users.update", "LAST_APPROVER", { personId: "lee", name: "Lee Park", phone: "+1 415 555 0122", role: "viewer", on1: true }),
  ], { ...disable("lee"), setup: [...ravi.setup, fine("dana")] }),
  T("T-13", "Inviting an Administrator ends in Sent for approval: the person shows as Waiting for approval, has no buttons, and the sender cannot approve it", ["AC-6"], ravi, [
    ...toAccess, set({ "mu.role": "admin" }), text("A second administrator has to approve this."), press("Review"), screen("review"), text("Second administrator needed"), ...confirm, set({ "otp.code": CODE }), press("Invite"), screen("result"),
    text("Sent for approval"), text("Another administrator has to approve this before it takes effect."), text("Waiting for approval"), text("Second administrator"), noText("Invitation sent"), noText("Invite another"),
    people(newId, "statusText", "Waiting for approval"), people(newId, "canEdit", false), people(newId, "canDisable", false), view("waiting.CHG-1044.mine", true), view("waiting.CHG-1044.canDecide", false),
    bank("corp.users.list", `${newId}.sub`, ""), inspect("outbox.0.to", "other administrators"), bank("corp.admin.get", "log.1.result", "Waiting"),
    refuses("corp.changes.decide", "SELF_APPROVAL", { changeId: "CHG-1044", decision: "approve" }), refuses("corp.users.disable", "CHANGE_PENDING", { personId: newId, reason: "Left the company" }),
  ], { launch: invite }),
  T("T-14", "With the option off an Administrator is invited at once", ["AC-6"], ravi, [
    ...toAccess, set({ "mu.role": "admin" }), noText("A second administrator has to approve this."), press("Review"), noText("Second administrator needed"), ...confirm, set({ "otp.code": CODE }), press("Invite"), screen("result"), text("Invitation sent"), people(newId, "statusText", "Invited"), noText("Sent for approval"),
  ], { launch: { ...invite, "opt.secondAdmin": false } }),
  T("T-15", "Disabling an existing administrator (Mina Das) waits too: she shows Change waiting and nothing changes until it is approved", ["AC-6"], ravi, [
    set({ "mu.reason": "Security concern" }), press("Review"), screen("review"), text("Second administrator needed"), ...confirm, set({ "otp.code": CODE }), press("Disable"), screen("result"), text("Sent for approval"), text("Second administrator"),
    people("mina", "statusText", "Change waiting"), people("mina", "canEdit", false), people("mina", "canDisable", false), view("waiting.CHG-1044.text", "Disable Mina Das"),
    refuses("corp.users.update", "CHANGE_PENDING", { personId: "mina", name: "Mina Das", phone: "+1 415 555 0127", role: "admin", on1: true, limit: 0 }),
  ], disable("mina")),
  T("T-16", "Three wrong codes change nothing: Lee Park is still Active, and the bank asks for the code on its own side", ["AC-7"], ravi, [
    set({ "mu.reason": "Left the company" }), press("Review"), ...confirm, text("Disable Lee Park"), press("Disable"), error("otp.code"), ...wrongCodes("Disable"), screen("locked"), text("We couldn’t confirm this change."), text("Nothing was changed."), people("lee", "statusText", "Active"), noText("Lee Park is disabled"),
    refuses("corp.users.disable", "STEP_UP_FAILED", { personId: "lee", reason: "Left the company" }),
  ], disable("lee")),
  T("T-17", "Disabling asks for a reason: Other needs a few words (\"ok\" is not enough, five characters are), and with the option off there is no reason step", ["AC-1"], ravi, [
    set({ "mu.reason": "Other", "mu.note": "ok" }), press("Review"), screen("why"), text("Add a few words."), set({ "mu.note": "12345" }), press("Review"), screen("review"), text("Other: 12345"),
    refuses("corp.users.disable", "REASON_REQUIRED", { personId: "lee", note: "ok", reason: "Other" }), refuses("corp.users.disable", "REASON_REQUIRED", { personId: "lee", reason: "Because" }),
  ], disable("lee")),
  T("T-18", "With askReason off the journey goes straight to the review", ["AC-1"], ravi, [screen("review"), text("Step 1 of 1 · Manage a user"), text("Active → Disabled"), noText("Reason"), press("Back"), screen("review")], { ...disable("lee", { "opt.askReason": false }) }),
  T("T-19", "A timeout on the check shows Nothing was changed and Lee stays Active", ["AC-7"], ravi, [set({ "mu.reason": "Left the company" }), press("Review"), screen("slow"), text("We didn’t get an answer in time"), text("Nothing was changed."), people("lee", "statusText", "Active"), press("Try again"), screen("why")], { ...disable("lee"), conditions: { timeout: ["corp.users.disable"], latencyMs: 10_000 } }),
  T("T-20", "The bank being unavailable shows the sheet and changes nothing", ["AC-7"], ravi, [set({ "mu.reason": "Left the company" }), press("Review"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was changed."), people("lee", "statusText", "Active"), press("Try again"), screen("why")], { ...disable("lee"), conditions: { unavailable: ["corp.users.disable"] } }),
  T("T-21", "The person not loading, and the code not being sent, show the sheet; the first changes nothing", ["AC-7"], ravi, [screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("unavailable")], { ...disable("lee"), conditions: { unavailable: ["corp.users.get"] } }),
  T("T-22", "The code not being sent shows the sheet and Try again comes back to the review", ["AC-7"], ravi, [set({ "mu.reason": "Left the company" }), press("Review"), press("Confirm"), screen("unavailable"), people("lee", "statusText", "Active"), press("Try again"), screen("review")], { ...disable("lee"), conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-23", "Alex at Alpha is a Maker: no admin permission, so the journey lands on You can’t manage people and the bank refuses every call", ["AC-6"], maker, [
    screen("denied"), text("You can’t manage people at this company"), noText("Who is it?"),
    refuses("corp.users.invite", "PERMISSION_DENIED", { name: "Sam Okafor", email: "sam.okafor@example.com", phone: "+1 415 555 0100", role: "maker", on1: true, limit: 1000 }),
    refuses("corp.users.disable", "PERMISSION_DENIED", { personId: "lee", reason: "Left the company" }), refuses("corp.users.get", "PERMISSION_DENIED", {}), refuses("corp.admin.get", "PERMISSION_DENIED", {}),
  ], { launch: invite }),
  T("T-24", "Alex at Beta is an Approver and from Personal the bank does not answer for a company's people", ["AC-6"], approver, [screen("denied"), refuses("corp.users.update", "PERMISSION_DENIED", { personId: "priya" })], { launch: invite }),
  T("T-25", "From Personal the journey is refused as belonging to the company's banking", ["AC-6"], { persona: "alex", now: "2026-11-03T10:42:00Z" }, [screen("denied"), text("Switch to your business first"), refuses("corp.users.invite", "WRONG_CONTEXT", {})], { launch: invite }),
  T("T-26", "A forced call as another user is refused even by an administrator", ["AC-6"], ravi, [refuses("corp.users.disable", "PERMISSION_DENIED", { userId: "dana", personId: "lee", reason: "Left the company" }), people("lee", "statusText", "Active")]),
  T("T-27", "Enabling a disabled person (Lee Park, arranged) asks for the code and Lee can sign in again, with the log and the change of access", ["AC-8"], ravi, [
    screen("review"), text("Disabled → Active"), text("Approver"), ...confirm, text("Enable Lee Park"), set({ "otp.code": CODE }), press("Enable"), screen("result"), text("Lee Park can sign in again"), text("Active"),
    people("lee", "statusText", "Active"), bank("corp.users.list", "lee.sub", "approver"), bank("corp.admin.get", "log.1.what", "Enabled Lee Park"),
    refuses("corp.users.enable", "NOT_DISABLED", { personId: "lee" }),
  ], { launch: { "launch.mode": "enable", "launch.userId": "lee" }, setup: [...ravi.setup, fine("lee")] }),
  T("T-28", "Back to people opens Admin, and Invite another starts a fresh invitation", ["AC-8"], ravi, [
    ...toAccess, set({ "mu.limit": 100_000 }), press("Review"), ...confirm, set({ "otp.code": CODE }), press("Invite"), screen("result"), press("Invite another"), screen("who"), noText("Sam Okafor"),
    set({ ...who, "mu.email": "sam2@example.com" }), press("Continue"), set({ "mu.limit": 100_000 }), press("Review"), ...confirm, set({ "otp.code": CODE }), press("Invite"), screen("result"), press("Back to people"), opens("admin"),
  ], { launch: invite }),
  T("T-29", "Nothing secret travels: no email or number in the run's data after an invitation, and the log and the outbox hold masked values", ["AC-8"], ravi, [
    ...toAccess, set({ "mu.limit": 100_000 }), press("Review"), ...confirm, set({ "otp.code": CODE }), press("Invite"), screen("result"), noText("sam.okafor@example.com"), noText("415 555 0100"),
    inspect("log.0.what", "Invited Sam Okafor as Maker (s•••@example.com)"), bank("corp.audit.list", "1.action", "Invited Sam Okafor as Maker (s•••@example.com)"),
  ], { launch: invite }),
  T("T-30", "Markup in a name is data: it is refused by the bank as not a name, never drawn as markup", ["AC-1"], ravi, [set({ ...who, "mu.name": "<b>Sam</b>" }), press("Continue"), screen("who"), text("Enter their full name."), noText("Role and access")], { launch: invite }),
  T("T-31", "The mobile number's country code is needed: eight to sixteen digits after the plus", ["AC-1"], ravi, [
    set({ ...who, "mu.phone": "+1234567" }), press("Continue"), screen("who"), text("Enter a mobile number with the country code"), set({ "mu.phone": "+12345678901234567" }), press("Continue"), screen("who"), text("Enter a mobile number with the country code"),
    set({ "mu.phone": "+12345678" }), press("Continue"), screen("access"), press("Back"), set({ "mu.phone": "+1234567890123456" }), press("Continue"), screen("access"),
  ], { launch: invite }),
  T("T-32", "The edit of a person with a change waiting is refused: Mina after her disable is queued shows blocked on a second try", ["AC-6"], ravi, [
    set({ "mu.reason": "Left the company" }), press("Review"), screen("blocked"), text("A change to this person is already waiting for approval."), press("Back"), screen("why"),
  ], { ...disable("mina"), setup: [...ravi.setup, { adapter: "corp.sandbox.arrange", input: { op: "admChange", by: "ravi", text: "Disable Mina Das", kind: "user", personId: "mina", data: { op: "disable", personId: "mina", patch: {} } } }] }),
  T("T-33", "A person who does not exist is a screen of its own with the spec’s words", ["AC-5"], ravi, [screen("blocked"), text("We can’t find that person. They may have been removed."), noText("Who is it?")], edit("nobody")),
  T("T-34", "A Maker with no daily limit typed is stopped by the field, and an empty code by the code field, before the bank is asked", ["AC-1", "AC-7"], ravi, [
    ...toAccess, press("Review"), screen("access"), error("mu.limit"), set({ "mu.limit": 100_000 }), press("Review"), ...confirm, press("Invite"), screen("otp"), error("otp.code"), view("logCount", 5),
  ], { launch: invite }),
  T("T-35", "Three wrong codes on an invitation change nothing: nobody is added", ["AC-7"], ravi, [
    ...toAccess, set({ "mu.limit": 100_000 }), press("Review"), ...confirm, ...wrongCodes("Invite"), screen("locked"), text("Nothing was changed."), view(`people.${newId}`, undefined), refuses("corp.users.invite", "STEP_UP_FAILED", { name: "Sam Okafor", email: "sam.okafor@example.com", phone: "+1 415 555 0100", role: "maker", on1: true, limit: 1000 }),
  ], { launch: invite }),
  T("T-36", "Three wrong codes on an edit change nothing, and an empty code is stopped by the field", ["AC-7"], ravi, [
    press("Continue"), set({ "mu.role": "both", "mu.limit": 15_000 }), press("Review"), ...confirm, press("Save changes"), error("otp.code"), ...wrongCodes("Save changes"), screen("locked"), people("dana", "roleText", "Approver"),
  ], edit("dana")),
  T("T-43", "Editing an Approver into a Maker with no daily limit typed is stopped by the field", ["AC-1"], ravi, [press("Continue"), set({ "mu.role": "maker" }), press("Review"), screen("access"), error("mu.limit"), people("dana", "roleText", "Approver")], edit("dana")),
  T("T-37", "Three wrong codes on enabling change nothing, and an empty code is stopped by the field", ["AC-7"], ravi, [
    ...confirm, press("Enable"), error("otp.code"), ...wrongCodes("Enable"), screen("locked"), people("lee", "statusText", "Disabled"),
  ], { launch: { "launch.mode": "enable", "launch.userId": "lee" }, setup: [...ravi.setup, fine("lee")] }),
  T("T-38", "An empty code on disabling is stopped by the field; nothing is sent", ["AC-7"], ravi, [set({ "mu.reason": "Left the company" }), press("Review"), ...confirm, press("Disable"), error("otp.code"), screen("otp"), people("lee", "statusText", "Active")], disable("lee")),
  T("T-39", "Demoting the only active administrator from the journey is refused on a screen of its own, and Back returns to the role", ["AC-5"], ravi, [
    press("Continue"), set({ "mu.role": "viewer" }), press("Review"), screen("blocked"), text("The company must keep one active administrator. Add another one first."), press("Back"), screen("access"), people("mina", "roleText", "Administrator"),
  ], { ...edit("mina"), setup: [...ravi.setup, { adapter: "corp.sandbox.arrange", input: { op: "admSingleAdmin", personId: "mina" } }] }),
  T("T-40", "The bank unavailable on the first check of an invitation: the sheet, and Try again goes on to the role", ["AC-7"], ravi, [set(who), press("Continue"), screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("access")], { launch: invite, conditions: { unavailable: ["corp.users.invite"] } }),
  T("T-41", "The bank unavailable on the first check of an edit: the sheet, and Try again goes on to the role", ["AC-7"], ravi, [press("Continue"), screen("unavailable"), press("Try again"), screen("access")], { ...edit("dana"), conditions: { unavailable: ["corp.users.update"] } }),
  T("T-42", "The bank unavailable when enabling: the sheet, and nothing is changed", ["AC-7"], ravi, [screen("unavailable"), text("Nothing was changed."), people("lee", "statusText", "Disabled")], { launch: { "launch.mode": "enable", "launch.userId": "lee" }, setup: [...ravi.setup, fine("lee")], conditions: { unavailable: ["corp.users.enable"] } }),
];
