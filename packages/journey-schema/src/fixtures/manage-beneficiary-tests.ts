import type { Journey } from "../schema";

/**
 * What must be true for "Add, edit or delete a payee" to be right. Each is proved by at least one scenario below.
 * AC-9 of the spec (returning to the transfer the payee was added from) is not built: a journey cannot be opened with values yet.
 */
export const manageBeneficiaryAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A payee of each kind (BankWorkx® customer, US, Europe, UK, UAE, Saudi Arabia, Jordan, abroad) can be saved after valid details, the name check, consent and a verified code, and then appears in the list with its region, mask and chip." },
  { id: "AC-2", text: "Invalid routing, IBAN, sort code, account, BIC, a non-SEPA IBAN and a country-mismatched IBAN are refused with the exact messages." },
  { id: "AC-3", text: "The name check runs on add and on a changed name or account; a match continues freely; close, none and could-not-check need the tick; Use corrects the name." },
  { id: "AC-4", text: "A payee is Verified only after a match (or a corrected close match); otherwise Saved; abroad payees are never Verified." },
  { id: "AC-5", text: "The same details twice give an error saying the payee is saved already; the 51st payee gives the limit message." },
  { id: "AC-6", text: "A new or changed payee is limited to 500.00 USD for 24 hours, and the pick list, the review and the result say so." },
  { id: "AC-7", text: "Changing only the nickname or label asks for no check and no code and does not restart the 24 hours; changing only the name checks and asks for a code but does not restart them either; changing the bank details does." },
  { id: "AC-8", text: "A payee used by a scheduled payment cannot be deleted unless the person cancels the schedules (when the option allows); deleting asks for no code." },
  { id: "AC-10", text: "Three wrong codes save nothing; a timeout, an unavailable service and an unknown payee save nothing and say so; Try again goes back to where the person was." },
  { id: "AC-11", text: "With the name check off every bank payee shows \"couldn't check\"; with labels off no label is offered." },
];

// The sandbox customer "alexpayees" has the Payments cast: Taylor Brooks (BankWorkx), Jamie Lee (US), Marco Rossi (abroad), Casey Nguyen (US, added
// 3 hours ago), Lena Fischer (Europe) and James Whitfield (UK, used by the scheduled payment "Rent"). Camille Dubois is not saved yet.
const PERSONA = "alexpayees";
const NOW = "2026-11-02T09:31:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
/** Reads one value of the payee list from the bank, for example that a payee was saved (or not). */
const list = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.beneficiaries.list", path, equals } });
const code = (c = "482100"): Step => set({ "otp.code": c });

const CAMILLE = { "ben.name": "Camille Dubois", "ben.iban": "FR14 2004 1010 0505 0001 3M02 606" };
const OTHER_DE = "DE02 1203 0000 0000 2020 51";

/** Start, choose Add, a type, and (for a bank payee) where the account is. */
const add = (kind: "internal" | "domestic" | "international", region?: string): Step[] => [
  set({ "ben.mode": "add" }), press("Continue"), screen("type"), set({ "ben.kind": kind }), press("Continue"), screen("details"), ...(region ? [set({ "ben.region": region })] : []),
];
/** Choose Edit or Delete and a payee from the list. */
const choose = (mode: "edit" | "delete", payee: string): Step[] => [set({ "ben.mode": mode }), press("Continue"), screen("pick"), press(payee), screen(mode === "edit" ? "details" : "delete")];
/** From the check to the end: the confirmation, the code and the save. `tick` when the name check needs it. */
const save = (tick = false): Step[] => [
  ...(tick ? [set({ "ben.ack": true })] : []), press("Continue"), screen("review"),
  set({ "ben.consent": true }), press("Save and send code"), screen("otp"), code(), press("Save payee"), screen("result"),
];
/** The details of a new payee: enter them and let the bank check them. */
const fill = (fields: Record<string, unknown>): Step[] => [set(fields), press("Check details"), screen("check")];
/** The same for a payee changed: the changes are entered on the form that already holds the payee. */
const change = (fields: Record<string, unknown>): Step[] => [set(fields), press("Check details")];

const base = { persona: PERSONA, now: NOW };
let n = 0;
const T = (name: string, covers: string[], steps: Step[], more: { persona?: string; conditions?: NonNullable<Journey["scenarios"]>[number]["conditions"] } = {}) => ({ id: `T-${++n}`, name, covers, ...base, ...more, steps });

export const manageBeneficiaryScenarios: NonNullable<Journey["scenarios"]> = [
  T("Europe: Camille Dubois, her name matches, saved as Verified, new for 24 hours, and the list says so", ["AC-1", "AC-4", "AC-6"], [
    ...add("domestic", "eu"), ...fill(CAMILLE), text("The name matches the account: Camille Dubois"), text("Verification of Payee"),
    press("Continue"), screen("review"), text("For your security, you can send up to $500.00 to a new payee in the first 24 hours."), text("Matches"), text("Europe (SEPA)"), text("Another bank"),
    press("Save and send code"), screen("review"), error("Tick to confirm."),
    set({ "ben.consent": true }), press("Save and send code"), screen("otp"), text("Authorise saving Camille Dubois"), code(), press("Save payee"),
    screen("result"), text("Saved"), text("Camille Dubois is saved as Verified."), text("$500.00 for 24 hours"), text("••2606"),
    list("ben_new1.verified", true), list("ben_new1.region", "eu"), list("ben_new1.maskedNumber", "••2606"), list("ben_new1.coolingOffHoursLeft", 24), list("ben_new1.allowanceLeft", 500),
    press("Manage more payees"), screen("mode"), set({ "ben.mode": "edit" }), press("Continue"), screen("pick"),
    text("Camille Dubois"), text("Another bank · ••2606 · New · 24 hours left"), text("Taylor Brooks"), text("BankWorkx customer · ••3308 · Verified"),
  ]),
  T("BankWorkx customer: a wrong number, a customer already saved, then Jordan Keller is found and saved as Verified", ["AC-1", "AC-4", "AC-5"], [
    ...add("internal"),
    set({ "ben.customerNo": "123" }), press("Check details"), screen("details"), text("Enter the 10-digit BankWorkx® account number."),
    set({ "ben.customerNo": "0000000000" }), press("Check details"), screen("details"), text("We can't find a BankWorkx® account with that number. Check it and try again."),
    set({ "ben.customerNo": "3301123308" }), press("Check details"), screen("details"), text("You already saved this payee with these details."),
    ...fill({ "ben.customerNo": "3301554412" }), text("✓ Found: Jordan K. · ••4412"), text("BankWorkx® customer record"), noText("I understand and want to continue"),
    press("Continue"), screen("review"), text("Jordan Keller"), set({ "ben.consent": true }), press("Save and send code"), screen("otp"), text("Authorise saving Jordan Keller"), code(), press("Save payee"),
    screen("result"), text("Jordan Keller is saved as Verified."), list("ben_new1.verified", true), list("ben_new1.kind", "internal"), list("ben_new1.maskedNumber", "••4412"),
  ]),
  T("Abroad: Aiko Tanaka cannot be checked, needs the tick, and is saved as Saved, never Verified", ["AC-1", "AC-4"], [
    ...add("international"), screen("details"),
    ...fill({ "ben.country": "JP", "ben.name": "Aiko Tanaka", "ben.swift": "BOTKJPJT", "ben.account": "1234567890" }),
    text("We couldn't check the name for this account."), press("Continue"), screen("check"), error("Check the payee before you continue."),
    ...save(true), text("Aiko Tanaka is saved as Saved."), text("Could not be checked"),
    list("ben_new1.verified", false), list("ben_new1.kind", "international"), list("ben_new1.country", "JP"), list("ben_new1.currency", "JPY"), list("ben_new1.maskedNumber", "••7890"),
  ]),
  T("United States: Priya Raman at a known bank, her name matches, saved as Verified", ["AC-1"], [
    ...add("domestic", "us"), ...fill({ "ben.name": "Priya Raman", "ben.routing": "021000021", "ben.account": "987654321" }), text("Name check"),
    press("Continue"), screen("review"), text("JPMorgan Chase"), text("United States"), set({ "ben.consent": true }), press("Save and send code"), code(), press("Save payee"),
    screen("result"), text("JPMorgan Chase"), list("ben_new1.verified", true), list("ben_new1.region", "us"), list("ben_new1.routing", "021000021"), list("ben_new1.accountType", "checking"), list("ben_new1.maskedNumber", "••4321"),
  ]),
  T("United Kingdom: a new payee the name check does not know, saved as Saved after the tick", ["AC-1", "AC-4"], [
    ...add("domestic", "uk"), ...fill({ "ben.name": "Alice Green", "ben.sort": "40-47-84", "ben.account": "70872490" }),
    text("Confirmation of Payee"), text("We couldn't check the name for this account."), ...save(true),
    list("ben_new1.verified", false), list("ben_new1.region", "uk"), list("ben_new1.sortCode", "40-47-84"), list("ben_new1.maskedNumber", "••2490"),
  ]),
  T("Middle East: Omar Haddad in the UAE, Faisal Al-Harbi in Saudi Arabia and Rania Haddad in Jordan are each saved as Verified", ["AC-1", "AC-4"], [
    ...add("domestic", "me"), ...fill({ "ben.country": "AE", "ben.name": "Omar Haddad", "ben.iban": "AE07 0331 2345 6789 0123 456" }), ...save(), list("ben_new1.verified", true), list("ben_new1.country", "AE"), list("ben_new1.region", "me"),
    press("Manage more payees"), ...add("domestic", "me"), ...fill({ "ben.country": "SA", "ben.name": "Faisal Al-Harbi", "ben.iban": "SA03 8000 0000 6080 1016 7519" }), ...save(), list("ben_new2.verified", true), list("ben_new2.country", "SA"),
    press("Manage more payees"), ...add("domestic", "me"), ...fill({ "ben.country": "JO", "ben.name": "Rania Haddad", "ben.iban": "JO94 CBJO 0010 0000 0000 0131 0003 02" }), ...save(), list("ben_new3.verified", true), list("ben_new3.country", "JO"), list("ben_new3.maskedNumber", "••0302"),
  ]),
  T("Refused details: routing, IBAN, SEPA, sort code, country and account, each with the exact message, and nothing is saved", ["AC-2"], [
    ...add("domestic", "us"),
    set({ "ben.name": "", "ben.routing": "021000021", "ben.account": "987654321" }), press("Check details"), screen("details"), text("Enter the name on the account."),
    set({ "ben.name": "Priya Raman", "ben.routing": "" }), press("Check details"), text("Enter the 9-digit routing number."),
    set({ "ben.routing": "123456789" }), press("Check details"), screen("details"), text("That routing number isn't valid. Check the 9 digits."),
    set({ "ben.routing": "021000021", "ben.account": "123" }), press("Check details"), text("An account number has 4 to 17 digits."),
    set({ "ben.region": "eu", "ben.iban": "" }), press("Check details"), text("Enter the IBAN."),
    set({ "ben.iban": "DE89 3704 0044 0532 0130 01" }), press("Check details"), text("That IBAN isn't valid. Check the characters and the length."),
    set({ "ben.iban": "GB82 WEST 1234 5698 7654 32" }), press("Check details"), text("That IBAN isn't in the SEPA area. Use “Other countries (SWIFT)”."),
    set({ "ben.region": "uk", "ben.sort": "20-00", "ben.account": "55779911" }), press("Check details"), text("A sort code has 6 digits, like 20-00-00."),
    set({ "ben.sort": "20-00-00", "ben.account": "5577" }), press("Check details"), text("A UK account number has 8 digits."),
    set({ "ben.region": "me", "ben.country": "SA", "ben.iban": "AE07 0331 2345 6789 0123 456" }), press("Check details"), screen("details"), text("That IBAN starts with AE, but you chose Saudi Arabia."),
    list("ben_new1", undefined),
  ]),
  T("Refused details abroad: the SWIFT/BIC and the account number", ["AC-2"], [
    ...add("international"),
    set({ "ben.country": "JP", "ben.name": "Aiko Tanaka", "ben.swift": "ABC", "ben.account": "1234567890" }), press("Check details"), screen("details"), text("A SWIFT/BIC has 8 or 11 letters and numbers."),
    set({ "ben.swift": "BOTKJPJT", "ben.account": "12" }), press("Check details"), screen("details"), text("That account number looks too short or too long."),
    set({ "ben.account": "" }), press("Check details"), text("Enter the account number or IBAN."),
    set({ "ben.account": "1234567890", "ben.country": "" }), press("Check details"), text("Choose a country."),
  ]),
  T("A close name: the bank says what the account holder is called, Use corrects it, the check is repeated and it is Verified", ["AC-3", "AC-4"], [
    ...add("domestic", "eu"), ...fill({ ...CAMILLE, "ben.name": "Camille Dubios" }),
    text("The name is close to the one on the account: “Camille Dubois”"), text("I understand and want to continue"),
    press("Use “Camille Dubois”"), screen("check"), text("The name matches the account: Camille Dubois"), noText("I understand and want to continue"),
    ...save(), text("Camille Dubois is saved as Verified."), list("ben_new1.verified", true), list("ben_new1.displayName", "Camille Dubois"),
  ]),
  T("A close name continued without Use: needs the tick and is saved as Saved", ["AC-3", "AC-4"], [
    ...add("domestic", "eu"), ...fill({ ...CAMILLE, "ben.name": "Camille Dubios" }),
    press("Continue"), screen("check"), error("Check the payee before you continue."),
    ...save(true), text("Close, you continued"), text("Camille Dubios is saved as Saved."), list("ben_new1.verified", false), list("ben_new1.nameCheck", "close"),
  ]),
  T("A name that does not match: red, saved only after the tick, and Saved", ["AC-3", "AC-4"], [
    ...add("domestic", "eu"), ...fill({ ...CAMILLE, "ben.name": "Bob Smith" }),
    text("does not match the account holder"), press("Continue"), screen("check"), error("Check the payee before you continue."),
    set({ "ben.ack": true }), press("Continue"), screen("review"), text("Does not match, you continued"),
    set({ "ben.consent": true }), press("Save and send code"), code(), press("Save payee"), screen("result"), text("Bob Smith is saved as Saved."),
    list("ben_new1.verified", false), list("ben_new1.nameCheck", "none"),
  ]),
  T("With the name check off even a name that would match is \"couldn't check\", needs the tick, and is Saved", ["AC-3", "AC-11"], [
    set({ "opt.nameCheck": false }), ...add("domestic", "eu"), ...fill(CAMILLE),
    text("We couldn't check the name for this account."), press("Continue"), screen("check"), error("Check the payee before you continue."),
    ...save(true), text("Could not be checked"), list("ben_new1.verified", false), list("ben_new1.nameCheck", "na"),
  ]),
  T("Labels: offered by default, not offered when the bank switches them off", ["AC-11"], [
    ...add("domestic", "us"), text("Landlord"), text("Family"),
    set({ "opt.labels": false }), noText("Landlord"), noText("Family"), text("Nickname"),
  ]),
  T("The same details twice: a UK payee that is saved already, however the sort code is written", ["AC-5"], [
    ...add("domestic", "uk"),
    set({ "ben.name": "James Whitfield", "ben.sort": "20-00-00", "ben.account": "55779911" }), press("Check details"), screen("details"), text("You already saved this payee with these details."),
    set({ "ben.sort": "200000" }), press("Check details"), screen("details"), text("You already saved this payee with these details."),
    list("ben_new1", undefined),
  ]),
  T("The 51st payee: refused with the limit message", ["AC-5"], [
    ...add("domestic", "eu"), set(CAMILLE), press("Check details"), screen("details"), text("You can save up to 50 payees. Delete one to add another."),
  ], { persona: "alexfull" }),
  T("A payee added 3 hours ago shows New with the hours left; older ones show Verified or Saved", ["AC-6"], [
    set({ "ben.mode": "edit" }), press("Continue"), screen("pick"),
    text("Casey Nguyen"), text("Another bank · ••5150 · New · 21 hours left"), text("Jam (Jamie Lee)"), text("Another bank · ••6620 · Friend · Saved"),
    text("Marco Rossi"), text("Abroad · ••3000 · Saved"), text("Lena Fischer"), text("Another bank · ••4931 · Friend · Verified"),
    list("ben_casey.allowanceLeft", 500), list("ben_casey.coolingOffHoursLeft", 21), list("ben_taylor.allowanceLeft", null),
  ]),
  T("Changing the account details of a saved payee: the name check runs again, a code is asked, and the payee is new for 24 hours", ["AC-3", "AC-6", "AC-7"], [
    ...choose("edit", "Lena Fischer"), text("If you change the account details, we check the payee again"), text("Lena Fischer"),
    ...change({ "ben.iban": OTHER_DE }), screen("check"), text("We couldn't check the name for this account."),
    list("ben_lena.ageHours", 720),
    set({ "ben.ack": true }), press("Continue"), screen("review"), text("For your security, you can send up to $500.00 to a new payee in the first 24 hours."), noText("Save changes"),
    set({ "ben.consent": true }), press("Save and send code"), screen("otp"), code(), press("Save the changes"),
    screen("result"), text("Changes saved"), text("Lena Fischer is a new payee again for 24 hours. You can send up to $500.00 in that time."), text("Checked again"),
    list("ben_lena.ageHours", 0), list("ben_lena.coolingOffHoursLeft", 24), list("ben_lena.allowanceLeft", 500), list("ben_lena.verified", false), list("ben_lena.maskedNumber", "••2051"),
  ]),
  T("Changing only the nickname: no check, no code, and the payee does not become new", ["AC-7"], [
    ...choose("edit", "Lena Fischer"), ...change({ "ben.nickname": "Lena F" }), screen("review"), text("Not repeated"), noText("Save and send code"), noText("For your security, you can send up to $500.00"),
    press("Save changes"), screen("review"), error("Tick to confirm."),
    set({ "ben.consent": true }), press("Save changes"), screen("result"), text("Changes saved"), text("Lena Fischer was updated."), noText("Checked again"),
    list("ben_lena.nickname", "Lena F"), list("ben_lena.ageHours", 720), list("ben_lena.coolingOffUntil", null), list("ben_lena.verified", true),
    press("Manage more payees"), set({ "ben.mode": "edit" }), press("Continue"), text("Lena F (Lena Fischer)"),
  ]),
  T("Changing only the name: the check runs again and a code is asked, but the 24 hours do not start again", ["AC-3", "AC-7"], [
    ...choose("edit", "Lena Fischer"), ...change({ "ben.name": "Lena Fisher" }), screen("check"), text("The name is close to the one on the account: “Lena Fischer”"),
    set({ "ben.ack": true }), press("Continue"), screen("review"), text("Close, you continued"), noText("For your security, you can send up to $500.00"), noText("Save changes"),
    set({ "ben.consent": true }), press("Save and send code"), screen("otp"), code(), press("Save the changes"),
    screen("result"), text("Lena Fisher was updated."), text("Checked again"),
    list("ben_lena.displayName", "Lena Fisher"), list("ben_lena.ageHours", 720), list("ben_lena.verified", false),
  ]),
  T("Deleting a payee a scheduled payment uses: blocked, then deleted with its schedule; the count is shown, no code is asked", ["AC-8"], [
    ...choose("delete", "James Whitfield"), text("Used by: Rent · Monthly, 1 Dec, $1,450.00"), text("Also cancel these scheduled payments"), text("You won't be able to send money to James Whitfield"),
    press("Delete payee"), screen("delete"), text("James Whitfield is used by 1 scheduled payment. Cancel it first."), list("ben_james.displayName", "James Whitfield"),
    set({ "ben.cancelSchedules": true }), press("Delete payee"), screen("result"),
    text("Payee deleted"), text("James Whitfield was removed from your payees."), text("Scheduled payments cancelled"), list("ben_james", undefined), list("ben_taylor.displayName", "Taylor Brooks"),
  ]),
  T("The bank does not let schedules be cancelled here: no switch, and the delete stays blocked", ["AC-8"], [
    set({ "opt.allowCancelSchedules": false }), ...choose("delete", "James Whitfield"),
    text("Cancel these in Payments › Scheduled first."), noText("Also cancel these scheduled payments"),
    press("Delete payee"), screen("delete"), text("James Whitfield is used by 1 scheduled payment. Cancel it first."), list("ben_james.displayName", "James Whitfield"),
  ]),
  T("Deleting a payee nothing uses: deleted with no code, and the others stay", ["AC-8"], [
    ...choose("delete", "Jam (Jamie Lee)"), noText("Used by:"), noText("Also cancel these scheduled payments"),
    press("Delete payee"), screen("result"), text("Jamie Lee was removed from your payees."), text("Scheduled payments cancelled"),
    list("ben_jamie", undefined), list("ben_james.displayName", "James Whitfield"), list("ben_casey.displayName", "Casey Nguyen"),
  ]),
  T("A payee that is not there any more: \"We can't find that payee\", on delete and on a change", ["AC-10"], [
    ...choose("delete", "Marco Rossi"), set({ "ben.id": "ben_nobody" }), press("Delete payee"), screen("failed"), text("We can't find that payee."), text("Nothing was changed."),
    press("Start again"), screen("mode"), ...choose("edit", "Lena Fischer"), set({ "ben.id": "ben_nobody" }), press("Check details"), screen("failed"), text("We can't find that payee."),
    list("ben_marco.displayName", "Marco Rossi"),
  ]),
  T("Three wrong codes on add: locked, nothing saved", ["AC-10"], [
    ...add("domestic", "eu"), ...fill(CAMILLE), press("Continue"), set({ "ben.consent": true }), press("Save and send code"), screen("otp"),
    press("Save payee"), screen("otp"), error("Enter all 6 digits"),
    code("111111"), press("Save payee"), screen("otp"), press("Save payee"), screen("otp"), press("Save payee"),
    screen("locked"), text("Too many wrong codes"), text("You entered the wrong code 3 times, so we stopped. Nothing was saved."), list("ben_new1", undefined),
    press("Start again"), screen("mode"),
  ]),
  T("Three wrong codes on a change: locked, nothing changed", ["AC-10"], [
    ...choose("edit", "Lena Fischer"), ...change({ "ben.iban": OTHER_DE }), set({ "ben.ack": true }), press("Continue"), set({ "ben.consent": true }), press("Save and send code"), screen("otp"),
    press("Save the changes"), screen("otp"), error("Enter all 6 digits"),
    code("111111"), press("Save the changes"), screen("otp"), press("Save the changes"), screen("otp"), press("Save the changes"),
    screen("locked"), list("ben_lena.maskedNumber", "••4931"), list("ben_lena.ageHours", 720),
  ]),
  T("The bank does not answer when saving: nothing was changed, and Try again returns to the review", ["AC-10"], [
    ...add("domestic", "eu"), ...fill(CAMILLE), press("Continue"), set({ "ben.consent": true }), press("Save and send code"), code(), press("Save payee"),
    screen("timeout"), text("We didn't get an answer in time"), text("This is taking longer than expected. Nothing was changed."),
    list("ben_new1", undefined), press("Try again"), screen("review"),
  ], { conditions: { timeout: ["bank.payees.save"], latencyMs: 10000 } }),
  T("The details cannot be checked because the bank is down: standard message, Try again returns to the details", ["AC-10"], [
    ...add("domestic", "eu"), set(CAMILLE), press("Check details"), screen("unavailable"), text("Service not available"), text("We couldn't reach the bank. Nothing was changed."),
    list("ben_new1", undefined), press("Try again"), screen("details"),
  ], { conditions: { unavailable: ["bank.payees.validate"] } }),
  T("The payees cannot be loaded: standard message, and Try again starts over", ["AC-10"], [
    screen("unavailable"), text("We couldn't reach the bank. Nothing was changed."), press("Try again"), screen("unavailable"),
  ], { conditions: { unavailable: ["bank.beneficiaries.list"] } }),
  T("The name check is down: standard message, Try again returns to the details", ["AC-10"], [
    ...add("domestic", "eu"), set(CAMILLE), press("Check details"), screen("unavailable"), list("ben_new1", undefined), press("Try again"), screen("details"),
  ], { conditions: { unavailable: ["bank.payees.check"] } }),
  T("The code cannot be sent: standard message, nothing saved, Try again returns to the review", ["AC-10"], [
    ...add("domestic", "eu"), ...fill(CAMILLE), press("Continue"), set({ "ben.consent": true }), press("Save and send code"), screen("unavailable"), list("ben_new1", undefined), press("Try again"), screen("review"),
  ], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("Saving a nickname when the bank is down: nothing changed", ["AC-10"], [
    ...choose("edit", "Lena Fischer"), ...change({ "ben.nickname": "Lena F" }), set({ "ben.consent": true }), press("Save changes"), screen("unavailable"),
    list("ben_lena.nickname", undefined), press("Try again"), screen("review"),
  ], { conditions: { unavailable: ["bank.payees.update"] } }),
  T("Saving a changed account when the bank is down: nothing changed", ["AC-10"], [
    ...choose("edit", "Lena Fischer"), ...change({ "ben.iban": OTHER_DE }), set({ "ben.ack": true }), press("Continue"), set({ "ben.consent": true }), press("Save and send code"), code(), press("Save the changes"),
    screen("unavailable"), list("ben_lena.maskedNumber", "••4931"), list("ben_lena.ageHours", 720),
  ], { conditions: { unavailable: ["bank.payees.update"] } }),
  T("Deleting when the bank is down: nothing deleted, Try again returns to the delete screen", ["AC-10"], [
    ...choose("delete", "Jam (Jamie Lee)"), press("Delete payee"), screen("unavailable"), list("ben_jamie.displayName", "Jamie Lee"), press("Try again"), screen("delete"),
  ], { conditions: { unavailable: ["bank.payees.delete"] } }),
  T("Nothing is chosen: the mode, the payee type and an empty form are each refused before the bank is asked", ["AC-10"], [
    press("Continue"), screen("mode"), error("ben.mode"),
    set({ "ben.mode": "add" }), press("Continue"), screen("type"), press("Continue"), screen("type"), error("ben.kind"),
    set({ "ben.kind": "domestic" }), press("Continue"), screen("details"),
    set({ "ben.nickname": "A very long nickname that is over the limit" }), press("Check details"), screen("details"), error("Use 24 characters or fewer."),
  ]),
  T("Nobody saved yet: the list says so and offers to add someone", ["AC-1"], [
    set({ "ben.mode": "edit" }), press("Continue"), screen("pick"), text("You haven't saved anyone yet"), text("Add someone to pay them in two taps."),
    press("Add a beneficiary"), screen("type"),
  ], { persona: "sam" }),
];
