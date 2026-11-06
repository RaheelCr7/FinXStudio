import type { Journey } from "../schema";
import { bank, forced, home, inspect, noText, opens, press, screen, set, text, visitor, error, type Step } from "./public-test-kit";

/** What must be true for "Open an account" to be right. Each is proved by at least one scenario below. */
export const openAccountAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The flow is the same for every customer; only the national ID format, the proof of address, the currency symbol, the postcode field and the tax wording follow the bank's home market." },
  { id: "AC-2", text: "The mobile and email are verified with a 6-digit code before the person goes on; an application that already exists for the details stops with \"We already have an application with these details. Sign in instead.\"" },
  { id: "AC-3", text: "A date of birth under 18 is refused; an invalid or future date is refused." },
  { id: "AC-4", text: "The national ID number is checked against the market's format with the market's message." },
  { id: "AC-5", text: "The proof of address step appears only when the market asks and requirePoa is on, and refuses a document older than 3 months." },
  { id: "AC-6", text: "A passport asks for one photo; other documents ask for front and back." },
  { id: "AC-7", text: "At the selfie step, ID details that do not match what was entered discard the photos and send the person back to the ID step with the mismatch message." },
  { id: "AC-8", text: "A person who is not a tax resident only here must give a country and a tax ID, and a tax ID in the wrong format is refused." },
  { id: "AC-9", text: "The account choice shows only the accounts the bank offers; acc_saver preselects the savings account." },
  { id: "AC-10", text: "Submit needs both ticks; the review shows the ID number masked." },
  { id: "AC-11", text: "Income over 1M with reviewHigh on shows \"A few more checks\" and the email wording." },
  { id: "AC-12", text: "Save and finish later keeps the answers for 30 days without the photos, the code, the ID number or the tax ID; Continue returns to the first photo step; Start again discards the saved application; with allowSave off there is no button and no resume." },
  { id: "AC-13", text: "When the bank is unavailable or does not answer in time nothing is lost, nothing is sent and the person is told so." },
  { id: "AC-14", text: "The terms are read to the end and signed with the name given before the application is sent, and the bank refuses an application without both ticks and the signature." },
  { id: "AC-15", text: "What is personal stays private: the ID number and the tax ID are hidden fields that the bank keeps as a hash and a mask, photos and the code are never kept, and nothing but masks is in the bank's record once the application is sent." },
  { id: "AC-16", text: "A loan or a card product says to open an account first; a bank can decline an application with a way to contact it; from the result the person can sign in or track the application with its reference." },
];

const NAME = "Alex Morgan";
const START = { "oa.mobile": "5550104410", "oa.email": "alex.morgan@example.org" };
const ABOUT = { "oa.name": NAME, "oa.dob": "14/03/1990", "oa.nationality": "United States", "oa.idNumber": "123456789" };
const ADDR = { "oa.line1": "12 Harbour Road", "oa.city": "Springfield", "oa.postcode": "10001" };
const WORK = { "oa.employment": "Employed", "oa.income": "50-100", "oa.source": "Salary", "oa.deposits": "2-10" };
const PHOTOS = { "oa.idDocument": "national-id", "oa.idPhotos": { front: { ref: "SIM-FRONT-1" }, back: { ref: "SIM-BACK-1" } } };
const SELFIE = { "oa.selfie": { selfie: { ref: "SIM-SELFIE-1" } } };
const SIGN = { "oa.read": true, "oa.sig": { mode: "type", name: NAME } };
const code = (c = "482100"): Step[] => [set({ "oa.code": c }), press("Continue")];
const verify = (more: Record<string, unknown> = {}): Step[] => [set({ ...START, ...more }), press("Continue"), screen("code"), ...code(), screen("about")];
const about = (more: Record<string, unknown> = {}): Step[] => [set({ ...ABOUT, ...more }), press("Continue")];
const address = (more: Record<string, unknown> = {}): Step[] => [set({ ...ADDR, ...more }), press("Continue")];
const photos = (more: Record<string, unknown> = {}): Step[] => [set({ ...PHOTOS, ...more }), press("Continue"), screen("selfie")];
const selfie = (): Step[] => [set(SELFIE), press("Continue"), screen("work")];
const work = (more: Record<string, unknown> = {}): Step[] => [set({ ...WORK, ...more }), press("Continue"), screen("tax")];
const taxHere = (): Step[] => [set({ "oa.taxOnly": "yes" }), press("Continue"), screen("product")];
const review = (): Step[] => [press("Continue"), screen("review"), set({ "oa.terms": true, "oa.taxConfirm": true }), press("Continue"), screen("sign")];
const submit = (more: Record<string, unknown> = {}): Step[] => [set({ ...SIGN, ...more }), press("Submit")];
/** Everything from the first screen to the document to sign (Market A: no proof of address). */
const toSign = (): Step[] => [...verify(), ...about(), screen("address"), ...address(), screen("idv"), ...photos(), ...selfie(), ...work(), ...taxHere(), ...review()];
const MASKED = "•••• 789";
const DUPLICATE = "We already have an application with these details. Sign in instead.";
const MISMATCH = "The details on your ID don’t match what you entered. Check them and retake the photos.";
const SORRY = "We couldn’t reach the bank. Your answers are saved.";
const SLOW = "This is taking longer than expected. Nothing was sent.";
/** A draft saved on this device through the bank's own calls, as the journey makes them, with the answers up to the address. */
const saved = [
  { adapter: "bank.onboarding.start", input: { mobile: "5550104410", email: "alex.morgan@example.org" }, saveAs: "s" }, { adapter: "bank.otp.send", input: { channel: "sms" } }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "bank.onboarding.save", input: { applicationId: "{{setup.s.applicationId}}", name: NAME, dob: "14/03/1990", nationality: "United States", idNumber: "123456789", line1: "12 Harbour Road", city: "Springfield", postcode: "10001", country: "United States" } },
];
/** The answers of the application as the bank is sent them, flat: what a forged call would carry. */
const ABOUT_FLAT = {
  name: NAME, dob: "14/03/1990", nationality: "United States", idNumber: "123456789", line1: "12 Harbour Road", city: "Springfield", postcode: "10001", country: "United States",
  employment: "Employed", income: "50-100", source: "Salary", deposits: "2-10", taxOnly: "yes",
};
const D = { homeMarket: "ae" } as const;
const D_ABOUT = { "oa.idNumber": "784199012345678" };
const D_PROOF = { "oa.proof": { name: "electricity-bill.pdf", size: 120_000, kind: "pdf" } };
const toIdD = (): Step[] => [...verify(), ...about(D_ABOUT), ...address(), screen("poa"), set(D_PROOF), press("Continue"), screen("idv")];

export const openAccountScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Market A, every step: the application is received with a reference, the status says Checking your ID and the result says You’re all set; no proof of address is asked", covers: ["AC-1", "AC-9", "AC-10", "AC-14"], ...visitor,
    steps: [
      screen("details"), text("Get started"), ...verify(), ...about(), screen("address"), ...address(), screen("idv"), ...photos(), ...selfie(), ...work(), ...taxHere(), text("Choose your account"), text("Everyday Account"), text("Aurora Savings"),
      press("Continue"), screen("review"), text("Review and agree"), text(NAME), text("14/03/1990"), text(MASKED), noText("123456789"), text("12 Harbour Road, Springfield 10001"), text("Everyday Account"),
      text("I confirm my tax details are correct and I am not subject to backup withholding."), set({ "oa.terms": true, "oa.taxConfirm": true }), press("Continue"), screen("sign"), ...submit(),
      screen("status"), text("Application received"), text("Reference APP-100236"), text("Received"), text("We have your application."), text("Checking your ID"), text("This usually takes a few minutes."), text("Ready"), text("Your account is open."), noText("A few more checks"),
      press("Finish"), screen("done"), text("You’re all set"), text("We’ll tell you when your account is ready."), text("Checking your ID"), text("Account"), text("Everyday Account"), text("Name"), text(NAME), text("Sign in"), text("Track my application"),
      inspect("submitted", 4), inspect("drafts", 0),
    ],
  },
  {
    id: "T-2", name: "Market B: an ID of 2 letters, 6 digits and a letter, a sort-code country, pounds in the bands and the market's tax wording; no proof of address", covers: ["AC-1", "AC-4"], ...visitor, config: home("uk"),
    steps: [
      ...verify(), ...about({ "oa.idNumber": "QQ123456C" }), screen("address"), ...address({ "oa.postcode": "SW1A 1AA" }), screen("idv"), ...photos(), ...selfie(), text("Under £25,000"), text("£25,000 to £50,000"), text("Over £1M"), text("Under £2,000"), ...work(), ...taxHere(),
      press("Continue"), text("I confirm my tax residency details are correct."),set({ "oa.terms": true, "oa.taxConfirm": true }), press("Continue"), ...submit(), screen("status"),
    ],
  },
  {
    id: "T-3", name: "Market C: an ID of 8 to 14 letters or digits, euros in the bands and the exchange-of-information tax wording", covers: ["AC-1", "AC-4"], ...visitor, config: home("eu"),
    steps: [
      ...verify(), ...about({ "oa.idNumber": "AB12345678" }), screen("address"), ...address(), screen("idv"), ...photos(), ...selfie(), text("Under €25,000"), ...work(), ...taxHere(), press("Continue"),
      text("I confirm these details may be reported for automatic exchange of tax information."),set({ "oa.terms": true, "oa.taxConfirm": true }), press("Continue"), ...submit(), screen("status"),
    ],
  },
  {
    id: "T-4", name: "Market D: no postcode, a proof of address before the ID, dirhams, an ID of 15 digits starting 784 whose birth year matches, and the tax authority wording; the application is received", covers: ["AC-1", "AC-4", "AC-5"], ...visitor, config: D,
    steps: [
      ...verify(), ...about(D_ABOUT), screen("address"), noText("Postcode"), set({ ...ADDR, "oa.postcode": "" }), press("Continue"), screen("poa"), text("Proof of address"), text("A recent utility bill or tenancy contract"),
      set(D_PROOF), press("Continue"), screen("idv"), ...photos(), ...selfie(), text("Under AED 25,000"), text("AED 25,000 to AED 50,000"), ...work(), ...taxHere(), press("Continue"),
      text("I confirm my tax residency details are correct and may be shared with the tax authority."), set({ "oa.terms": true, "oa.taxConfirm": true }), press("Continue"), ...submit(), screen("status"), text("Reference APP-100236"),
    ],
  },
  {
    id: "T-5", name: "A wrong code is refused (Check the latest message), an old one asks for a new one, a new code makes the old one useless; the mobile is shown only as its last 4 digits", covers: ["AC-2"], ...visitor,
    steps: [
      set(START), press("Continue"), screen("code"), text("We sent a 6-digit code to ••• 4410."), noText("5550104410"), ...code("000000"), screen("code"), text("That code isn’t right. Check the latest message."),
      ...code("999999"), text("That code has expired. Ask for a new one."), press("Resend code"), ...code("482100"), text("That code isn’t right. Check the latest message."), ...code("482101"), screen("about"),
    ],
  },
  {
    id: "T-6", name: "An email that already has an application stops with Sign in instead, and Sign in opens the sign-in; a mobile with an application does too", covers: ["AC-2"], ...visitor,
    steps: [
      set({ "oa.mobile": "5550104410", "oa.email": "duplicate@example.com" }), press("Continue"), screen("details"), text(DUPLICATE), inspect("drafts", 0), press("Sign in"), opens("sign-in"),
    ],
  },
  {
    id: "T-7", name: "A mobile number with an application already is refused the same way", covers: ["AC-2"], ...visitor,
    steps: [set({ "oa.mobile": "555 010 0999", "oa.email": "someone.else@example.org" }), press("Continue"), screen("details"), text(DUPLICATE)],
  },
  {
    id: "T-8", name: "A mobile number or an email in the wrong format is refused on the screen and again by the bank", covers: ["AC-2"], ...visitor,
    steps: [
      set({ "oa.mobile": "12", "oa.email": "alex" }), press("Continue"), error("Enter a valid mobile number."), error("Enter a valid email address."), screen("details"),
      forced("bank.onboarding.start", { mobile: "12", email: "alex.morgan@example.org" }, "PHONE_INVALID"), forced("bank.onboarding.start", { mobile: "5550104410", email: "alex" }, "EMAIL_INVALID"),
    ],
  },
  {
    id: "T-9", name: "A date of birth of 14/03/2010 is refused as under 18; 31/02/1990 and 14-03-1990 are not in the format; a future date is not a date to check", covers: ["AC-3"], ...visitor,
    steps: [
      ...verify(), ...about({ "oa.dob": "14/03/2010" }), screen("about"), text("You must be 18 or older to open this account."), ...about({ "oa.dob": "31/02/1990" }), text("Use the format DD/MM/YYYY."),
      ...about({ "oa.dob": "14-03-1990" }), error("Use the format DD/MM/YYYY."), ...about({ "oa.dob": "14/03/2030" }), text("Check the date."), ...about({ "oa.dob": "14/03/1900" }), text("Check the date."),
      ...about({ "oa.dob": "03/11/2008" }), screen("address"),
    ],
  },
  {
    id: "T-10", name: "A name of one word, or with digits, is refused; the bank refuses what a screen would not send", covers: ["AC-3"], ...visitor,
    steps: [
      ...verify(), ...about({ "oa.name": "Alex" }), screen("about"), text("Enter your first and last name."), ...about({ "oa.name": "Alex 99" }), error("Use letters only."),
      forced("bank.onboarding.check", { applicationId: "{{oa.applicationId}}", step: "about", name: "Alex 99", dob: "14/03/1990", nationality: "United States", idNumber: "123456789" }, "NAME_INVALID"),
    ],
  },
  {
    id: "T-11", name: "In Market A an ID number that is not 9 digits shows the market's message", covers: ["AC-4"], ...visitor,
    steps: [...verify(), ...about({ "oa.idNumber": "12345" }), screen("about"), error("Enter the 9 digits."), ...about({ "oa.idNumber": "12345678A" }), error("Enter the 9 digits."), ...about(), screen("address")],
  },
  {
    id: "T-12", name: "In Market B an ID number in the wrong format shows the market's message", covers: ["AC-4"], ...visitor, config: home("uk"),
    steps: [...verify(), ...about({ "oa.idNumber": "123456789" }), screen("about"), error("Use 2 letters, 6 digits, then 1 letter."), ...about({ "oa.idNumber": "QQ123456C" }), screen("address")],
  },
  {
    id: "T-13", name: "In Market C an ID number in the wrong format shows the market's message", covers: ["AC-4"], ...visitor, config: home("eu"),
    steps: [...verify(), ...about({ "oa.idNumber": "AB123" }), screen("about"), error("Use 8 to 14 letters or digits."), ...about({ "oa.idNumber": "AB12345678" }), screen("address")],
  },
  {
    id: "T-14", name: "In Market D an ID number in the wrong format shows the market's message", covers: ["AC-4"], ...visitor, config: D,
    steps: [...verify(), ...about({ "oa.idNumber": "123199012345678" }), screen("about"), error("Enter the 15 digits, starting 784."), ...about(D_ABOUT), screen("address")],
  },
  {
    id: "T-15", name: "The bank checks the ID format too, whatever a screen sends", covers: ["AC-4"], ...visitor,
    steps: [
      ...verify(), forced("bank.onboarding.check", { applicationId: "{{oa.applicationId}}", step: "about", ...{ name: NAME, dob: "14/03/1990", nationality: "United States" }, idNumber: "12345" }, "ID_INVALID"),
      forced("bank.onboarding.check", { applicationId: "{{oa.applicationId}}", step: "about", name: NAME, dob: "14/03/1990", nationality: "", idNumber: "123456789" }, "NATIONALITY_REQUIRED"),
    ],
  },
  {
    id: "T-16", name: "Market D asks for the proof of address with requirePoa on, and refuses one over 3 months old; a retake is accepted", covers: ["AC-5"], ...visitor, config: D, conditions: { onboarding: { poa: "old" } },
    steps: [
      ...verify(), ...about(D_ABOUT), ...address(), screen("poa"), set(D_PROOF), press("Continue"), screen("poa"), text("The proof of address must be from the last 3 months."), text("Retake"),
      press("Retake"), noText("The proof of address must be"), set({ "oa.proof": { name: "bill-new.pdf", size: 90_000, kind: "pdf" } }), press("Continue"), screen("idv"),
    ],
  },
  {
    id: "T-17", name: "With requirePoa off the proof of address step is absent in Market D", covers: ["AC-5"], ...visitor, config: { homeMarket: "ae", options: { "open-account": { requirePoa: false } } },
    steps: [...verify(), ...about(D_ABOUT), ...address(), screen("idv")],
  },
  {
    id: "T-18", name: "The proof of address is needed in Market D: the step will not go on without one", covers: ["AC-5"], ...visitor, config: D,
    steps: [...verify(), ...about(D_ABOUT), ...address(), screen("poa"), press("Continue"), screen("poa"), error("oa.proof")],
  },
  {
    id: "T-19", name: "A passport asks for one photo; a national ID card asks for the front and the back", covers: ["AC-6"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), screen("idv"), set({ "oa.idDocument": "passport", "oa.idPhotos": { front: { ref: "SIM-FRONT-1" } } }), press("Continue"), screen("selfie"),
    ],
  },
  {
    id: "T-20", name: "A national ID card with only the front taken is not enough", covers: ["AC-6"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), screen("idv"), set({ "oa.idDocument": "national-id", "oa.idPhotos": { front: { ref: "SIM-FRONT-1" } } }), press("Continue"), screen("idv"), error("oa.idPhotos"),
      set({ "oa.idDocument": "licence", "oa.idPhotos": { front: { ref: "SIM-FRONT-1" }, back: { ref: "SIM-BACK-1" } } }), press("Continue"), screen("selfie"),
    ],
  },
  {
    id: "T-21", name: "An ID the bank cannot read says to retake it in good light, and the retake goes through; so does an expired one", covers: ["AC-6"], ...visitor, conditions: { onboarding: { id: "unreadable" } },
    steps: [
      ...verify(), ...about(), ...address(), set(PHOTOS), press("Continue"), screen("idv"), text("We couldn’t read the ID. Retake it in good light."), text("Retake"), press("Retake"), noText("We couldn’t read the ID."),
      set({ "oa.idPhotos": { front: { ref: "SIM-FRONT-2" }, back: { ref: "SIM-BACK-2" } } }), press("Continue"), screen("selfie"),
    ],
  },
  {
    id: "T-22", name: "An expired ID says to use one that is still valid", covers: ["AC-6"], ...visitor, conditions: { onboarding: { id: "expired" } },
    steps: [...verify(), ...about(), ...address(), set(PHOTOS), press("Continue"), screen("idv"), text("This ID has expired. Use one that is still valid."), press("Retake"), set(PHOTOS), press("Continue"), screen("selfie")],
  },
  {
    id: "T-23", name: "A selfie in the dark, or that is not a live person, is retaken", covers: ["AC-6"], ...visitor, conditions: { onboarding: { selfie: "dark" } },
    steps: [
      ...verify(), ...about(), ...address(), ...photos(), set(SELFIE), press("Continue"), screen("selfie"), text("It was too dark to see your face."), press("Retake"), set(SELFIE), press("Continue"), screen("work"),
    ],
  },
  {
    id: "T-24", name: "A selfie that is not a live person says so", covers: ["AC-6"], ...visitor, conditions: { onboarding: { selfie: "notLive" } },
    steps: [...verify(), ...about(), ...address(), ...photos(), set(SELFIE), press("Continue"), text("We couldn’t confirm a live person."), press("Retake"), set(SELFIE), press("Continue"), screen("work")],
  },
  {
    id: "T-25", name: "In Market D an ID number with another birth year is refused at the selfie: the photos are thrown away and the ID step shows the mismatch with empty photos", covers: ["AC-7"], ...visitor, config: D,
    steps: [
      ...verify(), ...about({ "oa.idNumber": "784200012345678" }), ...address(), set(D_PROOF), press("Continue"), screen("idv"), ...photos(), set(SELFIE), press("Continue"), screen("idv"),
      text(MISMATCH), text("Retake"), inspect("draft.idVerified", false), press("Retake"), noText("The details on your ID don’t match"),
    ],
  },
  {
    id: "T-26", name: "A mismatch of the details sends the person back to the ID step in Market A too, and the retake passes", covers: ["AC-7"], ...visitor, conditions: { onboarding: { match: "mismatch" } },
    steps: [...verify(), ...about(), ...address(), ...photos(), set(SELFIE), press("Continue"), screen("idv"), text(MISMATCH), ...photos(), ...selfie()],
  },
  {
    id: "T-27", name: "Not a tax resident only here: no country and no tax ID are refused; a short tax ID says Enter your tax ID; a tax ID in the wrong format is refused by the bank", covers: ["AC-8"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work(), set({ "oa.taxOnly": "no" }), press("Continue"), screen("tax"), error("oa.taxCountry"), error("oa.taxId"),
      set({ "oa.taxCountry": "Germany", "oa.taxId": "123" }), press("Continue"), error("Enter your tax ID."), set({ "oa.taxId": "12$45" }), press("Continue"), screen("tax"), text("The tax ID isn’t in the right format."),
      set({ "oa.taxId": "DE 4455" }), press("Continue"), screen("product"),
    ],
  },
  {
    id: "T-28", name: "The tax country and ID are not asked when the person is a tax resident only here", covers: ["AC-8"], ...visitor,
    steps: [...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work(), noText("Country of tax residence"), ...taxHere()],
  },
  {
    id: "T-29", name: "The account choice shows the accounts the bank offers; acc_saver preselects the savings account", covers: ["AC-9"], ...visitor, launch: { "launch.productId": "acc_saver" },
    steps: [...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work(), ...taxHere(), press("Continue"), screen("review"), text("Aurora Savings")],
  },
  {
    id: "T-30", name: "With offerSaver off and offerIslamic on only the Everyday and the Islamic account are offered; a saver id then preselects the Everyday one", covers: ["AC-9"], ...visitor, launch: { "launch.productId": "acc_saver" }, config: { options: { "open-account": { offerSaver: false, offerIslamic: true } } },
    steps: [
      ...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work(), ...taxHere(), text("Everyday Islamic Account"), text("Profit sharing, no interest"), noText("Aurora Savings"), press("Continue"), screen("review"), text("Everyday Account"),
    ],
  },
  {
    id: "T-31", name: "Submit needs both ticks: without them the review asks, in the words of the spec", covers: ["AC-10"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work(), ...taxHere(), press("Continue"), screen("review"), press("Continue"), screen("review"), error("Please agree to continue."), error("Please confirm to continue."),
      set({ "oa.terms": true }), press("Continue"), screen("review"), error("Please confirm to continue."), set({ "oa.taxConfirm": true }), press("Continue"), screen("sign"),
    ],
  },
  {
    id: "T-32", name: "Income over 1M with reviewHigh on goes to manual review: A few more checks and We’ll email you when it’s ready", covers: ["AC-11"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work({ "oa.income": "o1m" }), ...taxHere(), ...review(), ...submit(), screen("status"), text("A few more checks"), text("A person is looking at your application. We may email you."), noText("This usually takes a few minutes."),
      press("Finish"), text("We’ll email you when it’s ready."), text("A few more checks"), noText("Checking your ID"),
    ],
  },
  {
    id: "T-33", name: "With reviewHigh off, income over 1M is Checking your ID", covers: ["AC-11"], ...visitor, launch: { "opt.reviewHigh": false },
    steps: [...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work({ "oa.income": "o1m" }), ...taxHere(), ...review(), ...submit(), text("Checking your ID"), noText("A few more checks"), press("Finish"), text("We’ll tell you when your account is ready.")],
  },
  {
    id: "T-34", name: "With reviewHigh off at the bank, income over 1M is Checking your ID whatever the journey sends", covers: ["AC-11"], ...visitor, config: { options: { "open-account": { reviewHigh: false } } },
    steps: [...verify(), ...about(), ...address(), ...photos(), ...selfie(), ...work({ "oa.income": "o1m" }), ...taxHere(), ...review(), ...submit(), text("Checking your ID"), noText("A few more checks")],
  },
  {
    id: "T-35", name: "Save and finish later after the address: Saved, continue any time in the next 30 days; opened again it says Welcome back with the saved name; Continue starts at the ID step; the rest goes through", covers: ["AC-12"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), screen("idv"), press("Save and finish later"), screen("saved"), text("Saved. Continue any time in the next 30 days."), inspect("draft.keys", ["city", "country", "dob", "line1", "name", "nationality", "postcode", "product", "taxOnly"]),
      press("Continue now"), screen("resume"), text("Welcome back"), text(NAME), text("Saved 3 Nov 18:45. You’ll retake your photos."), press("Continue"), screen("reid"),
      text("For your security we don’t keep your ID number. Enter it again to go on."), text("You gave •••• 789."), set({ "oa.idNumber": "123456789" }), press("Continue"), screen("idv"),
      ...photos(), ...selfie(), ...work(), ...taxHere(), press("Continue"), screen("review"), text(NAME), text("12 Harbour Road, Springfield 10001"), text(MASKED), set({ "oa.terms": true, "oa.taxConfirm": true }), press("Continue"), ...submit(), screen("status"),
    ],
  },
  {
    id: "T-36", name: "Start again discards the saved application and begins at Get started", covers: ["AC-12"], ...visitor,
    steps: [...verify(), ...about(), ...address(), press("Save and finish later"), press("Continue now"), screen("resume"), press("Start again"), screen("details"), inspect("drafts", 0)],
  },
  {
    id: "T-37", name: "A saved application is found when the journey is opened again on this device, the bank's own call", covers: ["AC-12"], ...visitor, setup: saved,
    steps: [screen("resume"), text(NAME), press("Continue"), screen("reid"), set({ "oa.idNumber": "123456789" }), press("Continue"), screen("idv")],
  },
  {
    id: "T-38", name: "In Market D Continue returns to the proof of address, the first photo step", covers: ["AC-12"], ...visitor, config: D,
    steps: [
      ...verify(), ...about(D_ABOUT), ...address(), press("Save and finish later"), screen("saved"), press("Continue now"), screen("resume"), press("Continue"), screen("reid"), set(D_ABOUT), press("Continue"), screen("poa"),
    ],
  },
  {
    id: "T-39", name: "A fresh start (the link says fresh) ignores a saved application", covers: ["AC-12"], ...visitor, setup: saved, launch: { "launch.fresh": "1" },
    steps: [screen("details"), noText("Welcome back")],
  },
  {
    id: "T-40", name: "With allowSave off there is no Save and finish later button and no resume", covers: ["AC-12"], ...visitor, launch: { "opt.allowSave": false }, config: { options: { "open-account": { allowSave: false } } },
    steps: [screen("details"), ...verify(), noText("Save and finish later"), ...about(), ...address(), noText("Save and finish later")],
  },
  {
    id: "T-41", name: "The bank refuses to save when saving is off, whatever a screen shows", covers: ["AC-12"], ...visitor, config: { options: { "open-account": { allowSave: false } } },
    steps: [...verify(), forced("bank.onboarding.save", { applicationId: "{{oa.applicationId}}", name: NAME }, "SAVE_OFF")],
  },
  {
    id: "T-42", name: "A saved application lasts 30 days: 31 days later it is gone and the journey begins at Get started", covers: ["AC-12"], ...visitor,
    steps: [...verify(), ...about(), ...address(), press("Save and finish later"), screen("saved"), { advance: 29 * 86_400 }, bank("bank.onboarding.begin", "saved.found", true), { advance: 2 * 86_400 }, press("Continue now"), screen("details"), noText("Welcome back")],
  },
  {
    id: "T-43", name: "A saved application never holds the photos, the code, the ID number, the tax ID or the mobile and email in the clear", covers: ["AC-12", "AC-15"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), press("Save and finish later"), screen("saved"), inspect("draft.hasId", true), inspect("draft.idMasked", MASKED),
      inspect("contains", false, { contains: "123456789" }), inspect("contains", false, { contains: "482100" }), inspect("contains", false, { contains: "SIM-" }), inspect("contains", false, { contains: "5550104410" }), inspect("contains", false, { contains: "alex.morgan@example.org" }),
    ],
  },
  {
    id: "T-44", name: "The bank keeps no photo, code or file even when a forged call sends them: only the answers it asks for are kept", covers: ["AC-12", "AC-15"], ...visitor,
    steps: [
      ...verify(), bank("bank.onboarding.save", "days", 30, { applicationId: "{{oa.applicationId}}", name: NAME, front: "SIM-FRONT-1", back: "SIM-BACK-1", selfie: "SIM-SELFIE-1", code: "482100", proofName: "bill.pdf" }),
      inspect("draft.keys", ["name"]), inspect("contains", false, { contains: "SIM-FRONT" }), inspect("contains", false, { contains: "bill.pdf" }),
    ],
  },
  {
    id: "T-45", name: "When the bank is unavailable at the submit nothing is sent and the answers are still there after Try again", covers: ["AC-13"], ...visitor, conditions: { unavailable: ["bank.onboarding.submit"] },
    steps: [...toSign(), ...submit(), screen("unavailable"), text(SORRY), inspect("submitted", 3), press("Try again"), screen("sign"), press("Submit"), screen("unavailable")],
  },
  {
    id: "T-46", name: "When the bank does not answer in 10 seconds at the submit nothing is sent: This is taking longer than expected. Nothing was sent.", covers: ["AC-13"], ...visitor, conditions: { timeout: ["bank.onboarding.submit"], latencyMs: 10_000 },
    steps: [...toSign(), ...submit(), screen("timeout"), text(SLOW), inspect("submitted", 3), press("Try again"), screen("sign")],
  },
  {
    id: "T-47", name: "When the bank is unavailable at the start nothing is lost, and Try again returns to Get started", covers: ["AC-13"], ...visitor, conditions: { unavailable: ["bank.onboarding.start"] },
    steps: [set(START), press("Continue"), screen("unavailable"), text(SORRY), press("Try again"), screen("details"), press("Continue"), screen("unavailable")],
  },
  {
    id: "T-48", name: "When the settings of the market cannot be loaded the first screen says so, and Try again asks again", covers: ["AC-13"], ...visitor, conditions: { unavailable: ["bank.onboarding.begin"] },
    steps: [screen("unavailable"), text(SORRY), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-49", name: "When the code cannot be sent nothing is lost", covers: ["AC-13"], ...visitor, conditions: { unavailable: ["bank.otp.send"] },
    steps: [set(START), press("Continue"), screen("unavailable"), press("Try again"), screen("details")],
  },
  {
    id: "T-50", name: "When the details cannot be checked nothing is lost: Try again returns to the step with the answers still there", covers: ["AC-13"], ...visitor, conditions: { unavailable: ["bank.onboarding.check"] },
    steps: [...verify(), ...about(), screen("unavailable"), text(SORRY), press("Try again"), screen("about")],
  },
  {
    id: "T-51", name: "When the selfie cannot be checked nothing is lost and Try again returns to the selfie", covers: ["AC-13"], ...visitor, conditions: { timeout: ["bank.onboarding.verifyIdentity"], latencyMs: 10_000 },
    steps: [...verify(), ...about(), ...address(), ...photos(), set(SELFIE), press("Continue"), screen("timeout"), text(SLOW), press("Try again"), screen("selfie")],
  },
  {
    id: "T-52", name: "When saving fails nothing is lost: Try again returns to the step", covers: ["AC-13"], ...visitor, conditions: { unavailable: ["bank.onboarding.save"] },
    steps: [...verify(), ...about(), press("Save and finish later"), screen("unavailable"), text(SORRY), press("Try again"), screen("address")],
  },
  {
    id: "T-53", name: "The terms must be read to the end before Submit", covers: ["AC-14"], ...visitor,
    steps: [...toSign(), text("Terms and privacy notice"), set({ "oa.sig": { mode: "type", name: NAME } }), press("Submit"), screen("sign"), error("oa.read"), inspect("submitted", 3)],
  },
  {
    id: "T-54", name: "The signature must be the name given: another name is refused, and without one Submit does not work", covers: ["AC-14"], ...visitor,
    steps: [...toSign(), set({ "oa.read": true, "oa.sig": { mode: "type", name: "Someone Else" } }), press("Submit"), screen("sign"), error("oa.sig"), set({ "oa.sig": null }), press("Submit"), error("oa.sig"), inspect("submitted", 3)],
  },
  {
    id: "T-55", name: "A drawn signature is accepted too", covers: ["AC-14"], ...visitor,
    steps: [...toSign(), set({ "oa.read": true, "oa.sig": { mode: "draw", path: "M0 0", points: 40 } }), press("Submit"), screen("status")],
  },
  {
    id: "T-56", name: "The bank refuses an application without both ticks, the signature, a checked identity, the code, or an account it offers", covers: ["AC-14", "AC-10"], ...visitor,
    steps: [
      ...verify(), ...about(), ...address(), ...photos(), ...selfie(),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, terms: false, taxConfirm: true, signed: true, product: "acc_everyday" }, "CONSENT_REQUIRED"),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, terms: true, taxConfirm: false, signed: true, product: "acc_everyday" }, "CONSENT_REQUIRED"),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, terms: true, taxConfirm: true, signed: false, product: "acc_everyday" }, "CONSENT_REQUIRED"),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, terms: true, taxConfirm: true, signed: true, product: "acc_islamic" }, "PRODUCT_UNAVAILABLE"),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, dob: "14/03/2010", terms: true, taxConfirm: true, signed: true, product: "acc_everyday" }, "UNDER_AGE"),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, taxOnly: "no", taxCountry: "Germany", taxId: "12", terms: true, taxConfirm: true, signed: true, product: "acc_everyday" }, "TAX_REQUIRED"),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, postcode: "?", terms: true, taxConfirm: true, signed: true, product: "acc_everyday" }, "POSTCODE_INVALID"),
      forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, employment: "Astronaut", terms: true, taxConfirm: true, signed: true, product: "acc_everyday" }, "WORK_INVALID"),
      forced("bank.onboarding.check", { applicationId: "{{oa.applicationId}}", step: "id", idDocument: "national-id", front: "x" }, "PHOTO_MISSING"), forced("bank.onboarding.check", { applicationId: "{{oa.applicationId}}", step: "id", idDocument: "cheque", front: "x", back: "y" }, "DOCUMENT_REQUIRED"),
      inspect("submitted", 3),
    ],
  },
  {
    id: "T-57", name: "The bank refuses to check, save or send anything before the code, and a draft of another device", covers: ["AC-2", "AC-15"], ...visitor,
    steps: [
      set(START), press("Continue"), screen("code"),
      forced("bank.onboarding.check", { applicationId: "{{oa.applicationId}}", step: "about", ...ABOUT_FLAT }, "NOT_VERIFIED"), forced("bank.onboarding.save", { applicationId: "{{oa.applicationId}}", name: NAME }, "NOT_VERIFIED"),
      forced("bank.onboarding.verifyIdentity", { applicationId: "{{oa.applicationId}}", selfie: "x", dob: "14/03/1990", idNumber: "123456789" }, "NOT_VERIFIED"), forced("bank.onboarding.submit", { applicationId: "{{oa.applicationId}}", ...ABOUT_FLAT, terms: true, taxConfirm: true, signed: true, product: "acc_everyday" }, "NOT_VERIFIED"),
      forced("bank.onboarding.save", { applicationId: "draft_999", name: NAME }, "APPLICATION_NOT_FOUND"), inspect("draft.keys", []),
    ],
  },
  {
    id: "T-58", name: "The bank can decline an application: We can’t open this account online, with a way to contact it; nothing is sent", covers: ["AC-16"], ...visitor, conditions: { onboarding: { decline: true } },
    steps: [...toSign(), ...submit(), screen("declined"), text("We can’t open this account online. Please contact us."), text("Contact us"), inspect("submitted", 3), press("Contact us"), opens("contact-support")],
  },
  {
    id: "T-59", name: "A loan product says to open an account first: the welcome screen, then Get started", covers: ["AC-16"], ...visitor, launch: { "launch.productId": "loan_home" },
    steps: [screen("welcome"), text("To apply for this, first open an account. You can apply once you’re signed in."), text("Home loan"), press("Open an account"), screen("details")],
  },
  {
    id: "T-60", name: "A card product says the same; an account product does not", covers: ["AC-16"], ...visitor, launch: { "launch.productId": "card_credit" },
    steps: [screen("welcome"), text("Aurora Credit")],
  },
  {
    id: "T-61", name: "From the result the person can sign in, or track the application with its reference: the tracker finds it straight away", covers: ["AC-16"], ...visitor,
    steps: [
      ...toSign(), ...submit(), press("Finish"), screen("done"), press("Track my application"), opens("track-application", { "launch.applicationId": "APP-100236" }),
      set({ "ta.mobile": "5550104410" }), press("Continue"), screen("code"), set({ "ta.code": "482100" }), press("Continue"), screen("checking"), text("Reference APP-100236"), text("Everyday Account"),
    ],
  },
  {
    id: "T-62", name: "Sign in from the result opens the sign-in", covers: ["AC-16"], ...visitor,
    steps: [...toSign(), ...submit(), press("Finish"), press("Sign in"), opens("sign-in")],
  },
  {
    id: "T-63", name: "Each step refuses empty fields: Get started, About you, Address, the proof of address, the ID, the selfie, Work and money, Tax", covers: ["AC-1"], ...visitor,
    steps: [
      press("Continue"), screen("details"), error("oa.mobile"), error("oa.email"), ...verify(), press("Continue"), error("oa.name"), error("oa.dob"), error("oa.nationality"), error("oa.idNumber"), ...about(), press("Continue"), screen("address"), error("oa.line1"), error("oa.city"),
      ...address(), screen("idv"), press("Continue"), error("oa.idDocument"), set(PHOTOS), press("Continue"), set({ "oa.selfie": null }), press("Continue"), screen("selfie"), error("oa.selfie"), set(SELFIE), press("Continue"),
      press("Continue"), screen("work"), error("oa.employment"), error("oa.income"), error("oa.source"), error("oa.deposits"), ...work(), set({ "oa.taxOnly": "" }), press("Continue"), error("oa.taxOnly"),
    ],
  },
  {
    id: "T-64", name: "The ID number is a hidden field: it never reaches a transcript, and the journey lets go of it once the application is sent", covers: ["AC-15"], ...visitor,
    steps: [...toSign(), ...submit(), screen("status"), noText("123456789"), inspect("contains", false, { contains: "123456789" }), inspect("draft", null)],
  },
  {
    id: "T-65", name: "The bank keeps no answer, ID number, mobile or email once the application is sent: only the reference, the account, the stage and masks", covers: ["AC-15"], ...visitor,
    steps: [
      ...toSign(), ...submit(), inspect("submitted", 4), inspect("outbox", [{ to: "••• 4410", kind: "application-received" }, { to: "a•••@example.org", kind: "application-received" }]),
      inspect("contains", false, { contains: "123456789" }), inspect("contains", false, { contains: "Alex Morgan" }), inspect("contains", false, { contains: "12 Harbour Road" }), inspect("contains", false, { contains: "5550104410" }), inspect("contains", false, { contains: "alex.morgan@example.org" }),
    ],
  },
  {
    id: "T-66", name: "Markup in a name or an address is data: it is shown as text and refused by the rules that stop it", covers: ["AC-15"], ...visitor,
    steps: [...verify(), ...about({ "oa.name": "<b>Alex</b> Morgan" }), screen("about"), error("Use letters only."), ...about(), ...address({ "oa.line1": "<script>alert(1)</script>" }), screen("idv"), inspect("contains", false, { contains: "<script>" })],
  },
  {
    id: "T-67", name: "When the saved application cannot be discarded nothing is lost: the journey says so", covers: ["AC-13"], ...visitor, setup: saved, conditions: { unavailable: ["bank.onboarding.discard"] },
    steps: [screen("resume"), press("Start again"), screen("unavailable"), text(SORRY), press("Try again"), screen("resume")],
  },
  {
    id: "T-68", name: "A resumed application asks for the ID number again, and will not go on without it", covers: ["AC-12"], ...visitor, setup: saved,
    steps: [press("Continue"), screen("reid"), press("Continue"), screen("reid"), error("oa.idNumber"), set({ "oa.idNumber": "12" }), press("Continue"), error("Enter the 9 digits.")],
  },
  {
    id: "T-69", name: "A code of fewer than 6 digits is refused on the screen", covers: ["AC-2"], ...visitor,
    steps: [set(START), press("Continue"), screen("code"), ...code("1234"), screen("code"), error("oa.code")],
  },
  {
    id: "T-70", name: "When the market's settings do not arrive in 10 seconds the first screen says so", covers: ["AC-13"], ...visitor, conditions: { timeout: ["bank.onboarding.begin"], latencyMs: 10_000 },
    steps: [screen("timeout"), text(SLOW), press("Try again"), screen("timeout")],
  },
  {
    id: "T-71", name: "When the start does not answer in 10 seconds nothing is sent", covers: ["AC-13"], ...visitor, conditions: { timeout: ["bank.onboarding.start"], latencyMs: 10_000 },
    steps: [set(START), press("Continue"), screen("timeout"), text(SLOW), press("Try again"), screen("details")],
  },
  {
    id: "T-72", name: "When the code is not checked in 10 seconds nothing is lost", covers: ["AC-13"], ...visitor, conditions: { timeout: ["bank.otp.verify"], latencyMs: 10_000 },
    steps: [set(START), press("Continue"), ...code(), screen("timeout"), text(SLOW), press("Try again"), screen("details")],
  },
  {
    id: "T-73", name: "A code can be sent again three times; the fourth ask says you have asked for the maximum number of codes", covers: ["AC-2"], ...visitor,
    steps: [
      set(START), press("Continue"), screen("code"), press("Resend code"), { expectToast: "New code sent. The old code no longer works." }, press("Resend code"), press("Resend code"), noText("maximum number of codes"),
      press("Resend code"), screen("code"), text("You have asked for the maximum number of codes. Try again later."),
    ],
  },
];

