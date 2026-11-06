import type { Journey } from "../schema";
import { bank, forced, inspect, noText, opens, press, screen, set, text, visitor, error, type Step } from "./public-test-kit";

/** What must be true for "Track my application" to be right. Each is proved by at least one scenario below. */
export const trackApplicationAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The application number must be APP- and 6 digits and the mobile number must be valid before Continue works." },
  { id: "AC-2", text: "A match needs both the number and the last 6 digits of the mobile; otherwise the person sees \"We couldn’t find an application with those details. Check them and try again.\" and no hint which part was wrong." },
  { id: "AC-3", text: "With askCode on a one-time code is required before the status shows, and the bank itself refuses the status without it; with it off the status shows after the details." },
  { id: "AC-4", text: "Three wrong tries (details and codes together) lock the journey with the \"Too many tries\" card and a way to contact the bank; the lock lasts 30 minutes by the bank's clock, whatever is typed." },
  { id: "AC-5", text: "The status rows follow the stage rule (Done, In progress, Next; all Done when Ready) and the title and the chip follow the stage." },
  { id: "AC-6", text: "A Ready application shows the account number and the button Register for digital banking with the application number." },
  { id: "AC-7", text: "An application made in open-account can be tracked straight away, and an application number passed in is filled in." },
  { id: "AC-8", text: "When the bank is unavailable or does not answer in time nothing is shown and Try again works." },
  { id: "AC-9", text: "A wrong code is refused (000000) and an old one asks for a new one (999999); the code and the mobile number are not kept by the journey." },
];

const DETAILS = { "ta.reference": "APP-100234", "ta.mobile": "5550100123" };
const READY = { "ta.reference": "APP-100235", "ta.mobile": "5550100124" };
const CODE = "482100";
/** Details, then the code: the way to a status. */
const track = (d: Record<string, string> = DETAILS, code = CODE): Step[] => [set(d), press("Continue"), screen("code"), set({ "ta.code": code }), press("Continue")];
const FOUND = "We couldn’t find an application with those details. Check them and try again.";
const NOT_ASKED = { options: { "track-application": { askCode: false } } };
/** An application made through open-account (the bank's own calls, as the journey makes them), numbered APP-100236. */
const made = [
  { adapter: "bank.onboarding.start", input: { mobile: "5550104410", email: "alex.morgan@example.org" }, saveAs: "s" },
  { adapter: "bank.otp.send", input: { channel: "sms" } }, { adapter: "bank.otp.verify", input: { code: CODE } },
  { adapter: "bank.onboarding.check", input: { applicationId: "{{setup.s.applicationId}}", step: "id", idDocument: "national-id", front: "SIM-FRONT-1", back: "SIM-BACK-1" } },
  { adapter: "bank.onboarding.verifyIdentity", input: { applicationId: "{{setup.s.applicationId}}", selfie: "SIM-SELFIE-1", dob: "14/03/1990", idNumber: "123456789" } },
  { adapter: "bank.onboarding.submit", input: { applicationId: "{{setup.s.applicationId}}", name: "Alex Morgan", dob: "14/03/1990", nationality: "United States", idNumber: "123456789", line1: "12 Harbour Road", city: "Springfield", postcode: "10001", country: "United States", employment: "Employed", income: "50-100", source: "Salary", deposits: "2-10", taxOnly: "yes", product: "acc_everyday", terms: true, taxConfirm: true, signed: true } },
];

export const trackApplicationScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "An application number that is not APP- and 6 digits, and a mobile number that is too short, are refused before the bank is asked", covers: ["AC-1"], ...visitor,
    steps: [
      screen("find"), text("Track my application"), text("Enter the number we sent you."), set({ "ta.reference": "APP-12", "ta.mobile": "5550100123" }), press("Continue"), error("Enter the number as shown, like APP-123456."), screen("find"),
      set({ "ta.reference": "APP-100234", "ta.mobile": "12" }), press("Continue"), error("Enter a valid mobile number."), inspect("trackFails", 0),
    ],
  },
  {
    id: "T-2", name: "APP-100234 with its mobile and the code: We’re checking your ID; Received is Done, Checking your ID is In progress, Ready is Next", covers: ["AC-2", "AC-3", "AC-5"], ...visitor,
    steps: [
      ...track(), screen("checking"), text("We’re checking your ID"), text("We’ll text you when something changes."), text("Checking your ID"), text("Reference APP-100234"),
      text("Account"), text("Everyday Account"), text("Received"), text("Done"), text("In progress"), text("Ready"), text("Next"), text("Contact us"), noText("Account number"), noText("Register for digital banking"),
    ],
  },
  {
    id: "T-3", name: "The number written in capitals or small letters with spaces around it, and the mobile with brackets and dashes, are found", covers: ["AC-2"], ...visitor,
    steps: [...track({ "ta.reference": " app-100234 ", "ta.mobile": "(555) 010-0123" }), screen("checking")],
  },
  {
    id: "T-4", name: "A different mobile is not found, in the words of the spec and with no hint which part was wrong", covers: ["AC-2"], ...visitor,
    steps: [set({ ...DETAILS, "ta.mobile": "5550100999" }), press("Continue"), screen("find"), text(FOUND), noText("mobile number was"), noText("number was wrong"), inspect("trackFails", 1)],
  },
  {
    id: "T-5", name: "A number that does not exist with a real mobile gives the same words", covers: ["AC-2"], ...visitor,
    steps: [set({ "ta.reference": "APP-999999", "ta.mobile": "5550100123" }), press("Continue"), screen("find"), text(FOUND)],
  },
  {
    id: "T-6", name: "Two wrong detail tries, then a wrong code: the third shows the Too many tries card and the fields are gone", covers: ["AC-4"], ...visitor,
    steps: [
      set({ ...DETAILS, "ta.mobile": "5550100999" }), press("Continue"), text(FOUND), press("Continue"), screen("find"), inspect("trackFails", 2),
      set({ "ta.mobile": "5550100123" }), press("Continue"), screen("code"), set({ "ta.code": "000000" }), press("Continue"),
      screen("locked"), text("Too many tries"), text("For your security, try again in 30 minutes, or contact us."), text("Contact us"), noText("Application number"), noText("Mobile number"),
    ],
  },
  {
    id: "T-7", name: "Locked, even the right details are refused for 30 minutes by the bank's clock, and let in after", covers: ["AC-4"], ...visitor,
    steps: [
      set({ ...DETAILS, "ta.mobile": "5550100999" }), press("Continue"), press("Continue"), press("Continue"), screen("locked"),
      forced("bank.applications.find", { reference: "APP-100234", mobile: "5550100123" }, "TRACK_LOCKED"), { advance: 29 * 60 }, forced("bank.applications.find", { reference: "APP-100234", mobile: "5550100123" }, "TRACK_LOCKED"),
      { advance: 2 * 60 }, bank("bank.applications.find", "found", true, { reference: "APP-100234", mobile: "5550100123" }),
    ],
  },
  {
    id: "T-8", name: "From the Too many tries card, Contact us opens contact-support", covers: ["AC-4"], ...visitor,
    steps: [set({ ...DETAILS, "ta.mobile": "5550100999" }), press("Continue"), press("Continue"), press("Continue"), screen("locked"), press("Contact us"), opens("contact-support")],
  },
  {
    id: "T-9", name: "A code of 000000 is wrong and 999999 has expired, in the words of the spec; the field is emptied", covers: ["AC-3", "AC-9"], ...visitor,
    steps: [
      set(DETAILS), press("Continue"), set({ "ta.code": "000000" }), press("Continue"), screen("code"), text("That code isn’t right. Check the latest message and try again."), inspect("trackFails", 1),
      set({ "ta.code": "999999" }), press("Continue"), text("That code has expired. Ask for a new one."), noText("That code isn’t right."), inspect("trackFails", 1),
      set({ "ta.code": CODE }), press("Continue"), screen("checking"),
    ],
  },
  {
    id: "T-10", name: "The code goes to the mobile on the application, shown only as its last 4 digits", covers: ["AC-3", "AC-9"], ...visitor,
    steps: [set(DETAILS), press("Continue"), screen("code"), text("We sent a 6-digit code to ••• 0123."), noText("5550100123")],
  },
  {
    id: "T-11", name: "A code that is not 6 digits is refused on the screen", covers: ["AC-3"], ...visitor,
    steps: [set(DETAILS), press("Continue"), set({ "ta.code": "1234" }), press("Continue"), screen("code"), error("ta.code")],
  },
  {
    id: "T-12", name: "With askCode off there is no code screen: the status shows after the details", covers: ["AC-3"], ...visitor, config: NOT_ASKED,
    steps: [set(DETAILS), press("Continue"), screen("checking"), text("We’re checking your ID")],
  },
  {
    id: "T-13", name: "The bank refuses the status before the details and before the code, whatever a screen shows", covers: ["AC-3"], ...visitor,
    steps: [
      forced("bank.applications.status", {}, "FIND_FIRST"), set(DETAILS), press("Continue"), screen("code"), forced("bank.applications.status", {}, "OTP_REQUIRED"),
      set({ "ta.code": "000000" }), press("Continue"), forced("bank.applications.status", {}, "OTP_REQUIRED"),
    ],
  },
  {
    id: "T-14", name: "A Ready application: Your account is ready, every stage Done, the account number ••2208 and the button Register for digital banking", covers: ["AC-5", "AC-6"], ...visitor,
    steps: [
      ...track(READY), screen("ready"), text("Your account is ready"), text("One last step: set up your online login."), text("Ready"), text("Done"), text("Account number"), text("••2208"),
      noText("In progress"), noText("Next"), text("Register for digital banking"), noText("Contact us"),
    ],
  },
  {
    id: "T-15", name: "Register for digital banking opens register-digital-banking with the application number", covers: ["AC-6"], ...visitor,
    steps: [...track(READY), press("Register for digital banking"), opens("register-digital-banking", { "launch.applicationId": "APP-100235" })],
  },
  {
    id: "T-16", name: "A Received application: Received is In progress, the other two are Next", covers: ["AC-5"], ...visitor, setup: [{ adapter: "sandbox.public.advance", input: { reference: "APP-100234", stage: "received" } }],
    steps: [...track(), screen("received"), text("We’ve received your application"), text("In progress"), text("Next"), text("Contact us"), noText("Account number")],
  },
  {
    id: "T-17", name: "Contact us from a status opens contact-support", covers: ["AC-5"], ...visitor,
    steps: [...track(), press("Contact us"), opens("contact-support")],
  },
  {
    id: "T-18", name: "An application made in open-account is found straight away with its number and mobile", covers: ["AC-7"], ...visitor, setup: made,
    steps: [...track({ "ta.reference": "APP-100236", "ta.mobile": "555 010 4410" }), screen("checking"), text("Reference APP-100236"), text("Everyday Account"), text("In progress")],
  },
  {
    id: "T-19", name: "An application number passed in (from open-account or a notification) is filled in: only the mobile is left to type", covers: ["AC-7"], ...visitor, launch: { "launch.applicationId": "APP-100234" },
    steps: [set({ "ta.mobile": "5550100123" }), press("Continue"), screen("code")],
  },
  {
    id: "T-20", name: "When the bank is unavailable at the details nothing is shown, and Try again asks again", covers: ["AC-8"], ...visitor, conditions: { unavailable: ["bank.applications.find"] },
    steps: [set(DETAILS), press("Continue"), screen("unavailable"), text("We couldn’t reach the bank. Try again in a few minutes."), noText("We’re checking your ID"), press("Try again"), screen("find"), press("Continue"), screen("unavailable")],
  },
  {
    id: "T-21", name: "When the bank does not answer in 10 seconds nothing is shown: This is taking longer than expected. Try again.", covers: ["AC-8"], ...visitor, conditions: { timeout: ["bank.applications.find"], latencyMs: 10_000 },
    steps: [set(DETAILS), press("Continue"), screen("timeout"), text("This is taking longer than expected. Try again."), press("Try again"), screen("find")],
  },
  {
    id: "T-22", name: "When the code cannot be checked nothing is shown", covers: ["AC-8"], ...visitor, conditions: { unavailable: ["bank.otp.verify"] },
    steps: [set(DETAILS), press("Continue"), set({ "ta.code": CODE }), press("Continue"), screen("unavailable"), noText("We’re checking your ID"), press("Try again"), screen("find")],
  },
  {
    id: "T-23", name: "When the status cannot be read nothing is shown, though the details and the code were right", covers: ["AC-8"], ...visitor, conditions: { unavailable: ["bank.applications.status"] },
    steps: [...track(), screen("unavailable"), noText("We’re checking your ID"), noText("Everyday Account")],
  },
  {
    id: "T-24", name: "A slow status says nothing was shown", covers: ["AC-8"], ...visitor, conditions: { timeout: ["bank.applications.status"], latencyMs: 10_000 },
    steps: [...track(), screen("timeout"), text("This is taking longer than expected. Try again.")],
  },
  {
    id: "T-25", name: "Back from the code returns to the details", covers: ["AC-3"], ...visitor,
    steps: [set(DETAILS), press("Continue"), screen("code"), press("Back"), screen("find")],
  },
  {
    id: "T-26", name: "A manual review application is still checking your ID on the tracker", covers: ["AC-5", "AC-7"], ...visitor, setup: made.map((c) => (c.adapter === "bank.onboarding.submit" ? { ...c, input: { ...c.input, income: "o1m" } } : c)),
    steps: [...track({ "ta.reference": "APP-100236", "ta.mobile": "5550104410" }), screen("checking"), text("We’re checking your ID")],
  },
  {
    id: "T-27", name: "From the Received status, Contact us opens contact-support", covers: ["AC-5"], ...visitor, setup: [{ adapter: "sandbox.public.advance", input: { reference: "APP-100234", stage: "received" } }],
    steps: [...track(), screen("received"), press("Contact us"), opens("contact-support")],
  },
  {
    id: "T-28", name: "When the code cannot be sent nothing is shown, and Try again returns to the details", covers: ["AC-8"], ...visitor, conditions: { unavailable: ["bank.otp.send"] },
    steps: [set(DETAILS), press("Continue"), screen("unavailable"), noText("We’re checking your ID"), press("Try again"), screen("find")],
  },
  {
    id: "T-29", name: "When the bank does not answer in time while the code is checked nothing is shown", covers: ["AC-8"], ...visitor, conditions: { timeout: ["bank.otp.verify"], latencyMs: 10_000 },
    steps: [set(DETAILS), press("Continue"), set({ "ta.code": CODE }), press("Continue"), screen("timeout"), text("This is taking longer than expected. Try again."), noText("We’re checking your ID")],
  },
];
