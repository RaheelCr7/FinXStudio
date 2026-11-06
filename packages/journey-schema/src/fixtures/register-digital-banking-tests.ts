import type { Journey } from "../schema";
import { bank, forced, inspect, noText, opens, press, screen, set, text, visitor, error, type Step } from "./public-test-kit";

/** What must be true for "Register for digital banking" to be right. Each is proved by at least one scenario below. */
export const registerDigitalBankingAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The customer ID needs 8 digits, a card number must pass the check-digit test, and the date must be real, in the past, and 18 or more years ago." },
  { id: "AC-2", text: "A customer who does not match gets one message that does not say which part failed; the third failure (checks and codes together) locks the journey for 30 minutes with a way to contact the bank." },
  { id: "AC-3", text: "A customer who is already registered is told to sign in or reset the password." },
  { id: "AC-4", text: "The code goes to the mobile number on file, shown only as its last 4 digits; a wrong code counts towards the same lock; an expired code asks for a new one; at most 3 resends, and a new code makes the old one useless." },
  { id: "AC-5", text: "The password follows the four visible rules plus the breach rule (and its length live), each refusal in its own words; the checklist shows the length as it is typed." },
  { id: "AC-6", text: "The username follows the format and cannot be one that is taken." },
  { id: "AC-7", text: "The terms must be ticked, on the screen and at the bank." },
  { id: "AC-8", text: "With trustDevice on the device screen is shown (a name is needed) and the receipt says Trusted or Not trusted; with it off the screen is absent." },
  { id: "AC-9", text: "With an application number of a Ready application the identity screen is skipped and the flow starts at the code; an application that is not Ready is refused in the same words as a customer who does not match." },
  { id: "AC-10", text: "With allowCard off only the customer ID is offered, and the bank refuses a card number." },
  { id: "AC-11", text: "When the bank is unavailable or does not answer in time nothing is registered, the password is cleared and Try again works." },
  { id: "AC-12", text: "The bank makes no profile before the one-time code is right, the token runs out after ten minutes and works once, the password is kept only as a hash and the journey clears it, and the new profile signs in with it." },
];

const ID = { "rg.customerId": "20481993", "rg.day": "1", "rg.month": "1", "rg.year": "1990" };
const PW = "Granite-Lemon-92-River";
const NAME = "jordan.l.1990";
const identify = (more: Record<string, unknown> = {}): Step[] => [set({ ...ID, ...more }), press("Continue")];
const code = (c = "482100"): Step[] => [set({ "rg.code": c }), press("Continue")];
const creds = (more: Record<string, unknown> = {}): Step[] => [set({ "rg.username": NAME, "rg.password": PW, "rg.confirm": PW, "rg.terms": true, ...more }), press("Continue")];
const toCreds: Step[] = [...identify(), screen("code"), ...code(), screen("creds")];
const toDevice: Step[] = [...toCreds, ...creds(), screen("device")];
const NOT_MATCHED = "We couldn’t match those details. Check them and try again.";
const complete = (more: Record<string, unknown>) => ({ registrationToken: "{{found.registrationToken}}", username: NAME, password: PW, confirm: PW, terms: true, ...more });
const signs = (user: string, pw: string, path: string, equals: unknown): Step => bank("bank.auth.signIn", path, equals, { username: user, password: pw });

export const registerDigitalBankingScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A customer ID of 1234, a year of 2015, 31 February, a future year and a card that fails the check-digit test are each refused in the words of the spec", covers: ["AC-1"], ...visitor,
    steps: [
      screen("find"), text("Register for digital banking"), text("Tell us who you are."), ...identify({ "rg.customerId": "1234" }), error("Enter your 8-digit customer ID."), screen("find"),
      ...identify({ "rg.year": "2015" }), text("You need to be 18 or over to register online."), ...identify({ "rg.day": "31", "rg.month": "2", "rg.year": "1990" }), text("That date doesn’t exist."),
      ...identify({ "rg.day": "1", "rg.month": "1", "rg.year": "2030" }), text("Enter a date in the past."), ...identify({ "rg.year": "199" }), error("Enter a 4-digit year."),
      set({ "rg.by": "card", "rg.card": "4242 4242 4242 4241", "rg.day": "1", "rg.month": "1", "rg.year": "1990" }), press("Continue"), text("Check the card number."), inspect("regFails", 0),
    ],
  },
  {
    id: "T-2", name: "The wrong date of birth three times: the first two say We couldn’t match those details; the third shows the Too many tries card and the fields are gone", covers: ["AC-2"], ...visitor,
    steps: [
      ...identify({ "rg.year": "1991" }), screen("find"), text(NOT_MATCHED), press("Continue"), text(NOT_MATCHED), inspect("regFails", 2), noText("which part"),
      press("Continue"), screen("locked"), text("Too many tries"), text("For your security, try again in 30 minutes, or contact us."), text("Contact us"), noText("Customer ID"), noText("Year"),
    ],
  },
  {
    id: "T-3", name: "A customer ID that is not on the bank's books gives the same words as a wrong date", covers: ["AC-2"], ...visitor,
    steps: [...identify({ "rg.customerId": "20481999" }), screen("find"), text(NOT_MATCHED), inspect("regFails", 1)],
  },
  {
    id: "T-4", name: "Once locked the right details are refused for 30 minutes by the bank's clock, and let in after", covers: ["AC-2"], ...visitor,
    steps: [
      ...identify({ "rg.year": "1991" }), press("Continue"), press("Continue"), screen("locked"),
      forced("bank.registration.verify", { customerId: "20481993", day: 1, month: 1, year: "1990" }, "ID_LOCKED"), { advance: 29 * 60 }, forced("bank.registration.verify", { customerId: "20481993", day: 1, month: 1, year: "1990" }, "ID_LOCKED"),
      { advance: 2 * 60 }, bank("bank.registration.verify", "maskedMobile", "••• 0177", { customerId: "20481993", day: 1, month: 1, year: "1990" }),
    ],
  },
  {
    id: "T-5", name: "From the Too many tries card, Contact us opens contact-support", covers: ["AC-2"], ...visitor,
    steps: [...identify({ "rg.year": "1991" }), press("Continue"), press("Continue"), screen("locked"), press("Contact us"), opens("contact-support")],
  },
  {
    id: "T-6", name: "Two wrong identity checks and then a wrong code lock it: wrong codes and wrong details count together", covers: ["AC-2", "AC-4"], ...visitor,
    steps: [
      ...identify({ "rg.year": "1991" }), press("Continue"), set({ "rg.year": "1990" }), press("Continue"), screen("code"), ...code("000000"), screen("locked"), text("Too many tries"), inspect("regFails", 3),
    ],
  },
  {
    id: "T-7", name: "A customer who is already registered is told to sign in or reset the password", covers: ["AC-3"], ...visitor,
    steps: [...identify({ "rg.customerId": "20440010" }), screen("find"), text("You’re already registered. Sign in, or reset your password if you’ve forgotten it."), inspect("regFails", 0)],
  },
  {
    id: "T-8", name: "A card number that is on the books finds the customer", covers: ["AC-1"], ...visitor,
    steps: [set({ "rg.by": "card", "rg.card": "5555 5555 5555 4444", "rg.day": "1", "rg.month": "1", "rg.year": "1990" }), press("Continue"), screen("code"), text("We sent a 6-digit code to ••• 0177.")],
  },
  {
    id: "T-9", name: "The code goes to the mobile on file, shown as its last 4 digits; 000000 is wrong, 999999 has expired; the field is emptied each time", covers: ["AC-4"], ...visitor,
    steps: [
      ...identify(), screen("code"), text("Enter your code"), text("We sent a 6-digit code to ••• 0177."), noText("415"), ...code("000000"), screen("code"), text("That code isn’t right. Check the latest message and try again."),
      ...code("999999"), text("That code has expired. Ask for a new one."), noText("That code isn’t right."), ...code(), screen("creds"),
    ],
  },
  {
    id: "T-10", name: "Resend code says the old code no longer works; after 3 resends the fourth says you have asked for the maximum number of codes", covers: ["AC-4"], ...visitor,
    steps: [
      ...identify(), press("Resend code"), { expectToast: "New code sent. The old code no longer works." }, press("Resend code"), press("Resend code"), screen("code"), noText("maximum number of codes"),
      press("Resend code"), screen("code"), text("You have asked for the maximum number of codes. Try again later."),
    ],
  },
  {
    id: "T-11", name: "A new code makes the old one useless: the first code is wrong after a resend, the second is right", covers: ["AC-4"], ...visitor,
    steps: [...identify(), press("Resend code"), ...code("482100"), text("That code isn’t right. Check the latest message and try again."), ...code("482101"), screen("creds")],
  },
  {
    id: "T-12", name: "A code of fewer than 6 digits is refused on the screen", covers: ["AC-4"], ...visitor,
    steps: [...identify(), ...code("1234"), screen("code"), error("rg.code")],
  },
  {
    id: "T-13", name: "The username admin is taken; a username that is too short or has spaces is not a username", covers: ["AC-6"], ...visitor,
    steps: [
      ...toCreds, ...creds({ "rg.username": "admin" }), screen("creds"), text("That username is taken. Try another."),
      ...creds({ "rg.username": "Alex.Morgan" }), text("That username is taken. Try another."), ...creds({ "rg.username": "abc.d" }), text("Use 6 to 30 letters, numbers, dots, dashes or underscores."),
      ...creds({ "rg.username": "has spaces here" }), text("Use 6 to 30 letters, numbers, dots, dashes or underscores."), ...creds({ "rg.username": "demo.locked" }), text("That username is taken. Try another."), noText("Trust this device?"),
    ],
  },
  {
    id: "T-14", name: "A password that is too short, that holds the username, that is too common, that is in a known breach or too long is refused in its own words; a different confirmation is refused", covers: ["AC-5", "AC-7"], ...visitor,
    steps: [
      ...toCreds, ...creds({ "rg.password": "short", "rg.confirm": "short" }), error("Use at least 12 characters. Three or four unrelated words work well."), screen("creds"),
      ...creds({ "rg.password": "my-jordan.l.1990-pass", "rg.confirm": "my-jordan.l.1990-pass" }), text("Don’t use your username in your password."),
      ...creds({ "rg.password": "Password123!Password", "rg.confirm": "Password123!Password" }), text("That password is too common. Try a longer phrase of unrelated words."),
      ...creds({ "rg.password": "Winter2024!Winter", "rg.confirm": "Winter2024!Winter" }), text("This password has appeared in a data breach, so we can’t accept it."),
      ...creds({ "rg.password": "x".repeat(65), "rg.confirm": "x".repeat(65) }), text("Use 64 characters or fewer."),
      ...creds({ "rg.confirm": "Another-Phrase-77-Meadow" }), text("The two passwords don’t match."), noText("Trust this device?"), inspect("registered", []),
    ],
  },
  {
    id: "T-15", name: "The checklist shows the length as it is typed", covers: ["AC-5"], ...visitor,
    steps: [...toCreds, text("○ At least 12 characters"), set({ "rg.password": "Granite-Lemon" }), text("✓ At least 12 characters"), set({ "rg.password": "short" }), text("○ At least 12 characters")],
  },
  {
    id: "T-16", name: "The terms must be ticked: a screen asks, and the bank refuses without", covers: ["AC-7"], ...visitor,
    steps: [
      ...toCreds, ...creds({ "rg.terms": false }), screen("creds"), error("Please agree to continue."), noText("Trust this device?"),
      bank("bank.registration.complete", "code", "TERMS_REQUIRED", complete({ terms: false, dryRun: true })),
    ],
  },
  {
    id: "T-17", name: "With trustDevice on the device screen asks for a name; trusted, the receipt says Trusted and the profile trusts this device", covers: ["AC-8"], ...visitor,
    steps: [
      ...toDevice, text("Trust this device?"), text("You won’t need a code for 90 days."), set({ "rg.device": "My phone" }), press("Finish"), screen("registered"), text("You’re registered"), text("Sign in with your username and password."),
      text("Done"), text("Username"), text(NAME), text("This device"), text("Trusted"), inspect("registered", ["jordan.l.1990"]),
      bank("sandbox.access.inspect", "trustedDevices", ["dev_new"], { username: NAME }),
    ],
  },
  {
    id: "T-18", name: "With the toggle off the receipt says Not trusted and no device is trusted", covers: ["AC-8"], ...visitor,
    steps: [...toDevice, set({ "rg.trust": false }), press("Finish"), screen("registered"), text("Not trusted"), bank("sandbox.access.inspect", "trustedDevices", [], { username: NAME })],
  },
  {
    id: "T-19", name: "A trusted device needs a name", covers: ["AC-8"], ...visitor,
    steps: [...toDevice, set({ "rg.device": "" }), press("Finish"), screen("device"), error("rg.device"), inspect("registered", [])],
  },
  {
    id: "T-20", name: "With trustDevice off there is no device screen: the profile is made after the username and password", covers: ["AC-8"], ...visitor, launch: { "opt.trustDevice": false }, config: { options: { "register-digital-banking": { trustDevice: false } } },
    steps: [...toCreds, ...creds(), screen("registered"), text("Not trusted"), bank("sandbox.access.inspect", "trustedDevices", [], { username: NAME })],
  },
  {
    id: "T-21", name: "The bank trusts no device when it does not offer it, whatever a screen sends", covers: ["AC-8"], ...visitor, config: { options: { "register-digital-banking": { trustDevice: false } } },
    steps: [...toDevice, press("Finish"), screen("registered"), text("Not trusted"), bank("sandbox.access.inspect", "trustedDevices", [], { username: NAME })],
  },
  {
    id: "T-22", name: "From a Ready application the identity screen is skipped: the first screen is Enter your code, to the mobile of the application", covers: ["AC-9"], ...visitor, launch: { "launch.applicationId": "APP-100235" },
    steps: [screen("code"), text("Enter your code"), text("We sent a 6-digit code to ••• 0124."), ...code(), screen("creds"), ...creds({ "rg.username": "sam.hart.2026" }), screen("device"), press("Finish"), screen("registered"), text("sam.hart.2026")],
  },
  {
    id: "T-23", name: "An application that is not Ready, or that does not exist, is refused in the words of a customer who does not match", covers: ["AC-9"], ...visitor, launch: { "launch.applicationId": "APP-100234" },
    steps: [screen("find"), text(NOT_MATCHED), inspect("regFails", 1)],
  },
  {
    id: "T-24", name: "An application that was registered cannot be registered again: it is told to sign in", covers: ["AC-9"], ...visitor, launch: { "launch.applicationId": "APP-100235" },
    steps: [screen("code"), ...code(), ...creds({ "rg.username": "sam.hart.2026" }), press("Finish"), screen("registered"), forced("bank.registration.verify", { applicationId: "APP-100235" }, "ALREADY_REGISTERED")],
  },
  {
    id: "T-25", name: "With allowCard off only the customer ID is offered, and the bank refuses a card number", covers: ["AC-10"], ...visitor, launch: { "opt.allowCard": false }, config: { options: { "register-digital-banking": { allowCard: false } } },
    steps: [noText("Card number"), noText("Identify with"), forced("bank.registration.verify", { cardNumber: "5555 5555 5555 4444", day: 1, month: 1, year: "1990" }, "CARD_UNAVAILABLE"), ...identify(), screen("code")],
  },
  {
    id: "T-26", name: "Both ways are offered when the bank offers them", covers: ["AC-10"], ...visitor,
    steps: [text("Identify with"), text("Customer ID"), text("Card number")],
  },
  {
    id: "T-27", name: "When the bank cannot make the profile nothing is registered, the password is cleared and Try again goes back to the sign-in details", covers: ["AC-11"], ...visitor, conditions: { unavailable: ["bank.registration.complete"] },
    steps: [
      ...toCreds, ...creds(), screen("unavailable"), text("We couldn’t reach the bank. Nothing was changed."), bank("sandbox.access.inspect", "found", false, { username: NAME }), inspect("registered", []),
      press("Try again"), screen("creds"), noText("Trust this device?"),
    ],
  },
  {
    id: "T-28", name: "When the bank does not answer in 10 seconds nothing is registered: This is taking longer than expected. Nothing was changed.", covers: ["AC-11"], ...visitor, conditions: { timeout: ["bank.registration.complete"], latencyMs: 10_000 },
    steps: [...toCreds, ...creds(), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), bank("sandbox.access.inspect", "found", false, { username: NAME }), press("Try again"), screen("creds")],
  },
  {
    id: "T-29", name: "When the customer cannot be looked up nothing is changed, and Try again returns to the first screen", covers: ["AC-11"], ...visitor, conditions: { unavailable: ["bank.registration.verify"] },
    steps: [...identify(), screen("unavailable"), text("We couldn’t reach the bank. Nothing was changed."), press("Try again"), screen("find")],
  },
  {
    id: "T-30", name: "When the code cannot be sent nothing is changed", covers: ["AC-11"], ...visitor, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...identify(), screen("unavailable"), press("Try again"), screen("find")],
  },
  {
    id: "T-31", name: "The bank makes no profile before the one-time code is right, whatever a screen shows", covers: ["AC-12"], ...visitor,
    steps: [
      ...identify(), screen("code"), forced("bank.registration.complete", complete({}), "OTP_REQUIRED"), ...code("000000"), forced("bank.registration.complete", complete({}), "OTP_REQUIRED"),
      forced("bank.registration.complete", { ...complete({}), registrationToken: "reg_0_forged" }, "TOKEN_INVALID"), bank("sandbox.access.inspect", "found", false, { username: NAME }),
    ],
  },
  {
    id: "T-32", name: "The token runs out after ten minutes by the bank's clock: That took too long, start again", covers: ["AC-12"], ...visitor,
    steps: [...toCreds, { advance: 11 * 60 }, ...creds(), screen("expired"), text("That took too long"), text("Start again"), press("Start again"), screen("find")],
  },
  {
    id: "T-33", name: "The token works once: the profile is made, and the same token makes nothing more", covers: ["AC-12"], ...visitor,
    steps: [
      ...toDevice, press("Finish"), screen("registered"), forced("bank.registration.complete", { registrationToken: "reg_1_anything", username: "jordan.l.1991", password: PW, confirm: PW, terms: true }, "TOKEN_INVALID"),
      bank("sandbox.access.inspect", "found", false, { username: "jordan.l.1991" }),
    ],
  },
  {
    id: "T-34", name: "The new profile signs in with the new password and not with the demo one, and the customer cannot register twice", covers: ["AC-12", "AC-3"], ...visitor,
    steps: [
      ...toDevice, press("Finish"), screen("registered"), signs(NAME, PW, "ok", true), signs(NAME, "Bwx!Demo2026", "code", "INVALID_CREDENTIALS"),
      forced("bank.registration.verify", { customerId: "20481993", day: 1, month: 1, year: "1990" }, "ALREADY_REGISTERED"),
    ],
  },
  {
    id: "T-35", name: "Sign in from the receipt opens the sign-in with the new username", covers: ["AC-12"], ...visitor,
    steps: [...toDevice, press("Finish"), press("Sign in"), opens("sign-in", { "launch.user": NAME })],
  },
  {
    id: "T-36", name: "The password is only a hash at the bank, and the bank's record holds neither it nor the card number or the customer ID typed", covers: ["AC-12"], ...visitor,
    steps: [...toDevice, press("Finish"), inspect("contains", false, { contains: PW }), inspect("contains", false, { contains: "5555 5555" }), inspect("contains", false, { contains: "482100" })],
  },
  {
    id: "T-37", name: "The token runs out between the sign-in details and the final call: That took too long, nothing is made", covers: ["AC-12"], ...visitor,
    steps: [...toDevice, { advance: 11 * 60 }, press("Finish"), screen("expired"), text("That took too long"), bank("sandbox.access.inspect", "found", false, { username: NAME })],
  },
  {
    id: "T-38", name: "When the customer cannot be looked up in time nothing is changed, and Try again returns to the first screen", covers: ["AC-11"], ...visitor, conditions: { timeout: ["bank.registration.verify"], latencyMs: 10_000 },
    steps: [...identify(), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("find")],
  },
  {
    id: "T-39", name: "When the code cannot be checked in time nothing is changed", covers: ["AC-11"], ...visitor, conditions: { timeout: ["bank.otp.verify"], latencyMs: 10_000 },
    steps: [...identify(), screen("code"), ...code(), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("find")],
  },
];
