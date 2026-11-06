import type { Journey } from "../schema";
import { bank, error, forced, home, noText, press, screen, set, text, visitor, type Step } from "./public-test-kit";

/** What must be true for "Open a business account" to be right (the spec's criteria). */
export const kybOnboardingAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The six steps run in order and each required field, and each rule of the bank, stops Continue with its message; Back keeps what was typed." },
  { id: "AC-2", text: "Owners and directors cannot continue unless ownership adds up to 100% and at least one person is a director; at most five people." },
  { id: "AC-3", text: "The tax ID, the money sign of the bands and the postal code follow the bank's home market; the screens name no country." },
  { id: "AC-4", text: "The registration certificate and the proof of address are required; a file of the wrong kind or size is refused; the ownership chart appears only while its option is on." },
  { id: "AC-5", text: "Submit needs both ticks, on the screen and at the bank, and ends in Application received with a reference and a tracker, then You’re all set." },
  { id: "AC-6", text: "The tax ID is masked on the review and in what the bank keeps; no tax ID, owner email or registration number is kept as typed." },
  { id: "AC-7", text: "A registration number already applied for is refused with \"We already have an application for this registration number.\"" },
  { id: "AC-8", text: "A timeout or an unavailable bank sends nothing; before sign-in the bank refuses every adapter but the public ones." },
];

const company = { "kb.legalName": "Harbour Trading Ltd", "kb.tradingName": "Harbour", "kb.registrationNo": "REG-2015-0412", "kb.companyType": "Private company", "kb.incorporated": "14/03/2015", "kb.country": "US", "kb.address": "12 Example Street", "kb.city": "Springfield", "kb.postcode": "62704" };
const maya = { "kb.p1Name": "Maya Chen", "kb.p1Email": "maya.chen@example.com", "kb.p1Own": "100" };
const business = { "kb.industry": "Technology", "kb.about": "We sell software to small shops.", "kb.tradeCountry": "US", "kb.turnover": "t2", "kb.money": "m2", "kb.payments": "p2", "kb.source": "Sales to customers" };
const docs = { "kb.cert": { name: "document-1.pdf", size: 1_258_291, kind: "pdf" }, "kb.proof": { name: "document-2.pdf", size: 943_718, kind: "pdf" } };
const tax = { "kb.taxCountry": "US", "kb.taxId": "123456789" };
const step1: Step[] = [set(company), press("Continue"), screen("people")];
const step2: Step[] = [set(maya), press("Continue"), screen("business")];
const step3: Step[] = [set(business), press("Continue"), screen("documents")];
const step4: Step[] = [set(docs), press("Continue"), screen("tax")];
const step5: Step[] = [set(tax), press("Continue"), screen("review")];
const toReview: Step[] = [...step1, ...step2, ...step3, ...step4, ...step5];
const ticks: Step[] = [set({ "kb.terms": true, "kb.truth": true })];
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], stepList: Step[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...visitor, ...extra, steps: stepList } as Scenario);
const kyb = (path: string, equals: unknown, input?: Record<string, unknown>) => bank("sandbox.kyb.inspect", path, equals, input);
const holds = (secret: string) => kyb("found", false, { contains: secret });

export const kybOnboardingScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "All six steps, both ticks, Submit: Application received with the reference and the tracker, then Finish: You’re all set, Checking your documents, the company and the registration number masked", ["AC-1", "AC-5"], [
    screen("company"), text("Step 1 of 6 · Open a business account"), text("Your company"), text("Legal name"), text("Date of incorporation"),
    ...step1, text("Step 2 of 6 · Open a business account"), text("Owners and directors"), text("Owners with less than 25% each, combined."), ...step2, text("Step 3 of 6 · Open a business account"), text("Under $100,000"), ...step3,
    text("Step 4 of 6 · Open a business account"), text("PDF, JPG or PNG, up to 10 MB."), noText("Ownership chart"), ...step4, text("Step 5 of 6 · Open a business account"), text("9 digits"), ...step5,
    text("Step 6 of 6 · Open a business account"), text("Review and agree"), text("Harbour Trading Ltd"), text("REG-2015-0412"), text("Private company"), text("US"), text("Technology"), text("•••• 789"), ...ticks,
    press("Submit"), screen("tracker"), text("Application received"), text("Reference KYB-10002"), text("Received"), text("We have your application."), text("Checking your documents"), text("This usually takes 1 to 2 working days."), text("Identity checks"), text("We email each owner and director."), text("Account ready"), text("You can sign in and pay."),
    press("Finish"), screen("done"), text("You’re all set"), text("We’ll email you when your account is ready."), text("Checking your documents"), text("Harbour Trading Ltd"), text("•••• 0412"), noText("REG-2015-0412"), kyb("count", 2),
  ]),
  T("T-2", "Two people at 60% and 40%, other owners 0: Continue goes on; a sixth person cannot be added and Remove last takes one away", ["AC-2"], [
    ...step1, set(maya), press("Add another person"), text("Person 2"), set({ "kb.p1Own": "60", "kb.p1Role": "Owner and director", "kb.p2Name": "Omar Haddad", "kb.p2Email": "omar.haddad@example.com", "kb.p2Role": "Owner", "kb.p2Own": "40" }), press("Continue"), screen("business"),
    press("Back"), screen("people"), text("Omar Haddad"), press("Add another person"), press("Add another person"), press("Add another person"), noText("Add another person"), text("Person 5"), press("Remove last"), text("Add another person"), noText("Person 5"),
  ]),
  T("T-3", "One owner at 50% and other owners 0: Ownership adds up to 50%. It must be 100%.", ["AC-2"], [
    ...step1, set({ ...maya, "kb.p1Own": "50" }), press("Continue"), screen("people"), text("Ownership adds up to 50%. It must be 100%."), set({ "kb.p1Own": "50", "kb.other": "50" }), press("Continue"), screen("business"),
    forced("bank.kyb.check", { step: 2, count: 1, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner and director", p1Own: 50, other: 0 }, "OWNERSHIP_TOTAL"),
  ]),
  T("T-4", "One person with the role Owner only and 100%: Add at least one director.", ["AC-2"], [
    ...step1, set({ ...maya, "kb.p1Role": "Owner" }), press("Continue"), screen("people"), text("Add at least one director."), set({ "kb.p1Role": "Director" }), noText("Ownership (%)"), press("Continue"), screen("people"), text("Ownership adds up to 0%. It must be 100%."),
    forced("bank.kyb.check", { step: 2, count: 1, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner", p1Own: 100, other: 0 }, "DIRECTOR_REQUIRED"),
  ]),
  T("T-5", "A share below 25%, other owners above 75, a name that is not a name and an email that is not one: each with the bank's words", ["AC-2", "AC-1"], [
    ...step1, set({ ...maya, "kb.p1Own": "20", "kb.other": "80" }), press("Continue"), text("Enter 25 to 100."), set({ "kb.p1Own": "25", "kb.other": "76" }), press("Continue"), text("Enter 0 to 75."),
    set({ "kb.other": "75", "kb.p1Name": "7even" }), press("Continue"), text("Enter their full name."), set({ "kb.p1Name": "Maya Chen", "kb.p1Email": "maya@@example.com" }), press("Continue"), text("Enter a valid email, like name@company.com."),
    set({ "kb.p1Email": "maya.chen@example.com" }), press("Continue"), screen("business"),
  ]),
  T("T-6", "Market B (a sort code): the tax ID 123 is refused with Enter the 10 digits., the bands use the pound sign and the hint says 10 digits", ["AC-3"], [
    ...step1, ...step2, text("Under £100,000"), noText("$"), ...step3, ...step4, set({ ...tax, "kb.taxId": "123" }), text("10 digits"), press("Continue"), screen("tax"), text("Enter the 10 digits."), set({ "kb.taxId": "1234567890" }), press("Continue"), screen("review"), text("•••• 890"),
  ], { config: home("uk") }),
  T("T-7", "Market D (an IBAN and a mobile alias): the postal code is optional, the tax ID is 15 digits and the bands use AED", ["AC-3"], [
    set({ ...company, "kb.postcode": "" }), text("Optional for your bank’s market."), press("Continue"), screen("people"), ...step2, text("Under AED 100,000"), ...step3, ...step4, set({ ...tax, "kb.taxId": "123456789" }), text("15 digits"), press("Continue"), screen("tax"), text("Enter the 15 digits."), set({ "kb.taxId": "100123456700003" }), press("Continue"), screen("review"), text("•••• 003"),
  ], { config: home("ae") }),
  T("T-8", "Market A needs the postal code; Market C takes 8 to 14 letters or digits", ["AC-3"], [
    set({ ...company, "kb.postcode": "" }), press("Continue"), screen("company"), text("Enter the postal code."), noText("Optional for your bank’s market."), forced("bank.kyb.check", { step: 1, legalName: "Harbour Trading Ltd", registrationNo: "REG-2015-0412", companyType: "Private company", incorporated: "14/03/2015", country: "US", address: "12 Example Street", city: "Springfield", postcode: "" }, "POSTCODE_REQUIRED"),
  ]),
  T("T-9", "Market C: the tax ID is 8 to 14 letters or digits", ["AC-3"], [
    ...step1, ...step2, text("Under €100,000"), ...step3, ...step4, set({ ...tax, "kb.taxId": "DE123" }), text("8 to 14 letters or digits"), press("Continue"), text("Use 8 to 14 letters or digits."), set({ "kb.taxId": "DE12345678" }), press("Continue"), screen("review"), text("•••• 678"),
  ], { config: home("eu") }),
  T("T-10", "The company step: each rule of the bank with its words (the registration number, the date, a date in the future, a year before 1900)", ["AC-1"], [
    set({ ...company, "kb.registrationNo": "AB1" }), press("Continue"), screen("company"), text("Use 5 to 20 letters or digits."), set({ "kb.registrationNo": "REG-2015-0412", "kb.incorporated": "31/02/2015" }), press("Continue"), text("Enter the date as DD/MM/YYYY."),
    set({ "kb.incorporated": "14/03/2027" }), press("Continue"), text("The date can’t be in the future."), set({ "kb.incorporated": "14/03/1850" }), press("Continue"), text("Check the year."), set({ "kb.incorporated": "14/03/2015" }), press("Continue"), screen("people"),
  ]),
  T("T-11", "A required field left empty stops Continue on the step, and Back keeps what was typed", ["AC-1"], [
    set({ ...company, "kb.legalName": "" }), press("Continue"), screen("company"), error("kb.legalName"), set({ "kb.legalName": "Harbour Trading Ltd" }), press("Continue"), screen("people"), set(maya), press("Back"), screen("company"), text("Harbour Trading Ltd"), press("Continue"), screen("people"), text("Maya Chen"),
  ]),
  T("T-12", "The business step: a short description and missing choices are stopped; a long one is allowed up to 300 characters", ["AC-1"], [
    ...step1, ...step2, set({ ...business, "kb.about": "short" }), press("Continue"), screen("business"), error("kb.about"), set({ ...business, "kb.turnover": "" }), press("Continue"), screen("business"), error("kb.turnover"),
    set({ ...business, "kb.about": "x".repeat(301) }), press("Continue"), screen("business"), error("kb.about"), set({ ...business, "kb.about": "x".repeat(300) }), press("Continue"), screen("documents"),
    forced("bank.kyb.check", { step: 3, industry: "Technology", about: "short", tradeCountry: "US", turnover: "t2", money: "m2", payments: "p2", source: "Sales to customers" }, "ABOUT_REQUIRED"),
  ]),
  T("T-13", "The documents: leaving one out is refused with the bank's words; the ownership chart appears only while its option is on", ["AC-4"], [
    ...step1, ...step2, ...step3, press("Continue"), screen("documents"), text("Add the certificate."), noText("Ownership chart"), set({ "kb.cert": docs["kb.cert"] }), press("Continue"), screen("documents"), text("Add a proof of address."), set({ "kb.proof": docs["kb.proof"] }), press("Continue"), screen("tax"),
  ]),
  T("T-14", "With the option Ask for an ownership chart on, the chart can be added (and is optional)", ["AC-4"], [
    ...step1, ...step2, ...step3, text("Ownership chart (optional)"), set(docs), press("Continue"), screen("tax"), press("Back"), set({ "kb.chart": { name: "chart.png", size: 400_000, kind: "image" } }), press("Continue"), screen("tax"),
  ], { config: { options: { "kyb-onboarding": { askChart: true } } } }),
  T("T-15", "A file of the wrong kind or too large is refused by the field, and by the bank for a forced call", ["AC-4"], [
    ...step1, ...step2, ...step3, set({ "kb.cert": { name: "notes.exe", size: 2048, kind: "pdf" }, "kb.proof": docs["kb.proof"] }), press("Continue"), screen("documents"), set({ "kb.cert": { name: "big.pdf", size: 12_000_000, kind: "pdf" } }), press("Continue"), screen("documents"),
    forced("bank.kyb.check", { step: 4, certName: "notes.exe", certSize: 2048, proofName: "p.pdf", proofSize: 100 }, "INVALID_DOCUMENT"), forced("bank.kyb.check", { step: 4, certName: "big.pdf", certSize: 12_000_000, proofName: "p.pdf", proofSize: 100 }, "INVALID_DOCUMENT"),
  ]),
  T("T-16", "Review without ticks: Submit is refused with the two messages, and the bank refuses it too", ["AC-5"], [
    ...toReview, press("Submit"), screen("review"), error("kb.terms"), error("kb.truth"), kyb("count", 1),
    forced("bank.kyb.submit", { legalName: "Harbour Trading Ltd", registrationNo: "REG-2015-0412", companyType: "Private company", incorporated: "14/03/2015", country: "US", address: "12 Example Street", city: "Springfield", postcode: "62704", count: 1, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner and director", p1Own: 100, other: 0, industry: "Technology", about: "We sell software to small shops.", tradeCountry: "US", turnover: "t2", money: "m2", payments: "p2", source: "Sales to customers", certName: "a.pdf", certSize: 10, proofName: "b.pdf", proofSize: 10, taxCountry: "US", taxId: "123456789", agreeTerms: true, confirmTrue: false }, "TRUTH_REQUIRED"),
    forced("bank.kyb.submit", { legalName: "Harbour Trading Ltd", registrationNo: "REG-2015-0412", companyType: "Private company", incorporated: "14/03/2015", country: "US", address: "12 Example Street", city: "Springfield", postcode: "62704", count: 1, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner and director", p1Own: 100, other: 0, industry: "Technology", about: "We sell software to small shops.", tradeCountry: "US", turnover: "t2", money: "m2", payments: "p2", source: "Sales to customers", certName: "a.pdf", certSize: 10, proofName: "b.pdf", proofSize: 10, taxCountry: "US", taxId: "123456789", agreeTerms: false, confirmTrue: true }, "TERMS_REQUIRED"),
  ]),
  T("T-17", "The tax ID is shown as •••• 789 on the review, never as typed; spaces and hyphens in it are ignored", ["AC-6"], [
    ...step1, ...step2, ...step3, ...step4, set({ ...tax, "kb.taxId": "123-456 789" }), press("Continue"), screen("review"), text("•••• 789"), noText("123456789"), noText("123-456 789"),
  ]),
  T("T-18", "Nothing typed is kept as typed: no tax ID, no owner email, no registration number, no owner name in what the bank holds", ["AC-6"], [
    ...toReview, ...ticks, press("Submit"), screen("tracker"), holds("123456789"), holds("maya.chen@example.com"), holds("REG-2015-0412"), holds("Maya Chen"), kyb("found", true, { contains: "KYB-10002" }),
  ]),
  T("T-19", "The registration number DUPLICATE: We already have an application for this registration number., and nothing is sent", ["AC-7"], [
    set({ ...company, "kb.registrationNo": "DUPLICATE" }), press("Continue"), ...step2, ...step3, ...step4, ...step5, ...ticks, press("Submit"), screen("review"), text("We already have an application for this registration number."), noText("Application received"), kyb("count", 1),
    forced("bank.kyb.submit", { legalName: "Harbour Trading Ltd", registrationNo: "duplicate", companyType: "Private company", incorporated: "14/03/2015", country: "US", address: "12 Example Street", city: "Springfield", postcode: "62704", count: 1, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner and director", p1Own: 100, other: 0, industry: "Technology", about: "We sell software to small shops.", tradeCountry: "US", turnover: "t2", money: "m2", payments: "p2", source: "Sales to customers", certName: "a.pdf", certSize: 10, proofName: "b.pdf", proofSize: 10, taxCountry: "US", taxId: "123456789", agreeTerms: true, confirmTrue: true }, "DUPLICATE_APPLICATION"),
  ]),
  T("T-20", "A second application with the same registration number is refused after the first went through", ["AC-7"], [
    ...toReview, ...ticks, press("Submit"), screen("tracker"), forced("bank.kyb.submit", { legalName: "Other Ltd", registrationNo: "reg-2015-0412", companyType: "Private company", incorporated: "14/03/2015", country: "US", address: "1 Road", city: "Town", postcode: "62704", count: 1, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner and director", p1Own: 100, other: 0, industry: "Technology", about: "We sell software to small shops.", tradeCountry: "US", turnover: "t2", money: "m2", payments: "p2", source: "Sales to customers", certName: "a.pdf", certSize: 10, proofName: "b.pdf", proofSize: 10, taxCountry: "US", taxId: "123456789", agreeTerms: true, confirmTrue: true }, "DUPLICATE_APPLICATION"),
  ]),
  T("T-21", "A timeout on Submit sends nothing: Nothing was sent., and Try again returns to the review", ["AC-8"], [...toReview, ...ticks, press("Submit"), screen("timeout"), text("We didn’t get an answer in time. Nothing was sent."), kyb("count", 1), press("Try again"), screen("review")], { conditions: { timeout: ["bank.kyb.submit"], latencyMs: 10_000 } }),
  T("T-22", "The bank unavailable on Submit sends nothing: We couldn’t reach the bank. Nothing was sent. Try again.", ["AC-8"], [...toReview, ...ticks, press("Submit"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent. Try again."), kyb("count", 1), press("Try again"), screen("review")], { conditions: { unavailable: ["bank.kyb.submit"] } }),
  T("T-23", "The bank unavailable on a check shows the sheet; Try again returns to that step", ["AC-8"], [set(company), press("Continue"), screen("unavailable"), press("Try again"), screen("company")], { conditions: { unavailable: ["bank.kyb.check"] } }),
  T("T-24", "The form's rules not loading shows the sheet; Try again asks again", ["AC-8"], [screen("unavailable"), text("Nothing was sent. Try again."), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["bank.kyb.config"] } }),
  T("T-25", "A timeout on the form's rules shows the message and Try again asks again", ["AC-8"], [screen("timeout"), text("Nothing was sent."), press("Try again"), screen("timeout")], { conditions: { timeout: ["bank.kyb.config"], latencyMs: 10_000 } }),
  T("T-26", "Before sign-in the bank refuses every adapter that is not public", ["AC-8"], [
    forced("bank.accounts.list", {}, "NOT_SIGNED_IN"), forced("corp.company.get", {}, "NOT_SIGNED_IN"), forced("corp.admin.get", {}, "NOT_SIGNED_IN"), forced("corp.requests.list", {}, "NOT_SIGNED_IN"), forced("bank.transfers.create", {}, "NOT_SIGNED_IN"), screen("company"),
  ]),
  T("T-27", "Markup in the company name and in an owner's name is data: kept as text, never drawn as markup, and refused as a name", ["AC-6"], [
    set({ ...company, "kb.legalName": "<script>alert(1)</script> Ltd" }), press("Continue"), screen("people"), set({ ...maya, "kb.p1Name": "<b>Maya</b>" }), press("Continue"), screen("people"), text("Enter their full name."),
    set({ "kb.p1Name": "Maya Chen" }), press("Continue"), ...step3, ...step4, ...step5, text("<script>alert(1)</script> Ltd"), ...ticks, press("Submit"), screen("tracker"), press("Finish"), text("<script>alert(1)</script> Ltd"),
  ]),
  T("T-28", "Cancel on the first step leaves the application, and Back from the review goes back step by step to the company", ["AC-1"], [...toReview, press("Back"), screen("tax"), press("Back"), screen("documents"), press("Back"), screen("business"), press("Back"), screen("people"), press("Back"), screen("company"), press("Cancel")]),
  T("T-30", "The tax step without a country or a tax ID is stopped by the field before the bank is asked", ["AC-1"], [...step1, ...step2, ...step3, ...step4, set({ "kb.taxId": "" }), press("Continue"), screen("tax"), error("kb.taxId"), kyb("count", 1)]),
  T("T-29", "The application takes no one-time code and no sign-in: no code screen is ever reached", ["AC-5"], [...toReview, ...ticks, press("Submit"), screen("tracker"), noText("Enter your code")], { conditions: { unavailable: ["bank.otp.send", "bank.otp.verify"] } }),
];
