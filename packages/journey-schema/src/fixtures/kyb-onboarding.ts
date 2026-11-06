import type { Journey, Screen } from "../schema";
import { kybOnboardingAcceptance, kybOnboardingScenarios } from "./kyb-onboarding-tests";
import { alert, button, downScreens, go, route, set, text } from "./public-kit";

const SUBMIT = ["DUPLICATE_APPLICATION", "TERMS_REQUIRED", "TRUTH_REQUIRED"];
const PEOPLE = [1, 2, 3, 4, 5];
/** A step of the application: the banner shows the bank's own words for what is wrong on it. */
const said = (step: number) => alert("error", "{{ctx.error.message}}", `kb.step == ${step} && !isEmpty(ctx.error)`);
const row = (label: string, value: string, visibleWhen?: string) => ({ type: "reviewSummary" as const, ...(visibleWhen ? { visibleWhen } : {}), rows: [{ label, value }] });
const progress = (n: number) => text(`Step ${n} of 6 · Open a business account`, "caption");
const STEPPER = { type: "stepper" as const, steps: ["company", "people", "business", "documents", "tax", "review"] };
/** Person n of step 2: name, email, role and, for an owner, the share. */
const person = (n: number) => [
  text(`Person ${n}`, "caption", `kb.count >= ${n}`),
  { type: "textInput" as const, bind: `kb.p${n}Name`, label: "Full name", visibleWhen: `kb.count >= ${n}` },
  { type: "textInput" as const, bind: `kb.p${n}Email`, label: "Email", keyboard: "email" as const, visibleWhen: `kb.count >= ${n}` },
  text("We send an ID check here.", "caption", `kb.count >= ${n}`),
  { type: "select" as const, bind: `kb.p${n}Role`, label: "Role", variant: "dropdown" as const, source: "ctx.cfg.roles", visibleWhen: `kb.count >= ${n}` },
  { type: "textInput" as const, bind: `kb.p${n}Own`, label: "Ownership (%)", keyboard: "number" as const, visibleWhen: `kb.count >= ${n} && kb.p${n}Role != 'Director'` },
];
/** What is typed on each step, as the bank takes it (the engine resolves only the top level of a call's input, so the people are flat). */
const COMPANY = { legalName: "{{kb.legalName}}", registrationNo: "{{kb.registrationNo}}", companyType: "{{kb.companyType}}", incorporated: "{{kb.incorporated}}", country: "{{kb.country}}", address: "{{kb.address}}", city: "{{kb.city}}", postcode: "{{kb.postcode}}" };
const OWNERS = {
  count: "{{kb.count}}", other: "{{kb.other}}",
  ...Object.fromEntries(PEOPLE.flatMap((n) => [[`p${n}Name`, `{{kb.p${n}Name}}`], [`p${n}Email`, `{{kb.p${n}Email}}`], [`p${n}Role`, `{{kb.p${n}Role}}`], [`p${n}Own`, `{{kb.p${n}Own}}`]])),
};
const BUSINESS = { industry: "{{kb.industry}}", about: "{{kb.about}}", tradeCountry: "{{kb.tradeCountry}}", turnover: "{{kb.turnover}}", money: "{{kb.money}}", payments: "{{kb.payments}}", source: "{{kb.source}}" };
const DOCS = { certName: "{{kb.cert.name}}", certSize: "{{kb.cert.size}}", proofName: "{{kb.proof.name}}", proofSize: "{{kb.proof.size}}", chartName: "{{kb.chart.name}}", chartSize: "{{kb.chart.size}}" };
const TAX = { taxCountry: "{{kb.taxCountry}}", taxId: "{{kb.taxId}}", investIncome: "{{kb.invest}}" };
const wipe = ["kb.legalName", "kb.tradingName", "kb.registrationNo", "kb.companyType", "kb.incorporated", "kb.country", "kb.address", "kb.city", "kb.postcode", "kb.industry", "kb.about", "kb.tradeCountry", "kb.turnover", "kb.money", "kb.payments", "kb.source", "kb.taxCountry", "kb.taxId", "kb.other"]
  .map((p) => set(p, "")).concat(PEOPLE.flatMap((n) => [set(`kb.p${n}Name`, ""), set(`kb.p${n}Email`, ""), set(`kb.p${n}Own`, "")]), [set("kb.cert", null), set("kb.proof", null), set("kb.chart", null)]);

/**
 * Open a business account (BankWorkx, Public). A company applies for business banking before anyone signs in: its details, its owners and directors, what the business does, its documents, a tax
 * declaration, a review with two ticks, and a tracker for the application. No sign-in, no permission, no one-time code, and nothing moves. The bank (not the screens) decides every rule: the
 * registration number and the date, the owners adding up to 100% with a director, the tax ID of the bank's own market, the two documents every application needs, both ticks, and a registration
 * number already applied for. The screens name no country: the sign of money and the tax ID come from the bank's market.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the bank's checks come with Continue (no live box that adds up the ownership as it is typed), a person is added with a button, and
 * the files are a name and a size (nothing is kept). What is typed is data: the company name and the owners' details are drawn as text and the bank keeps hashes and counts only.
 */
export const kybOnboarding: Journey = {
  id: "jrn_kyb_onboarding",
  slug: "kyb-onboarding",
  name: "Open a business account",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: kybOnboardingAcceptance,
  scenarios: kybOnboardingScenarios,
  dataModel: {
    "opt.askChart": { type: "boolean" }, "kb.step": { type: "number" },
    "kb.legalName": { type: "string", required: true }, "kb.tradingName": { type: "string" }, "kb.registrationNo": { type: "string", required: true }, "kb.companyType": { type: "string", required: true }, "kb.incorporated": { type: "string", required: true },
    "kb.country": { type: "string", required: true }, "kb.address": { type: "string", required: true }, "kb.city": { type: "string", required: true }, "kb.postcode": { type: "string" },
    "kb.count": { type: "number" }, "kb.other": { type: "string" },
    ...Object.fromEntries(PEOPLE.flatMap((n) => [[`kb.p${n}Name`, { type: "string" }], [`kb.p${n}Email`, { type: "string" }], [`kb.p${n}Role`, { type: "string" }], [`kb.p${n}Own`, { type: "string" }]])),
    "kb.industry": { type: "string", required: true }, "kb.about": { type: "string" }, "kb.tradeCountry": { type: "string", required: true }, "kb.turnover": { type: "string", required: true }, "kb.money": { type: "string", required: true }, "kb.payments": { type: "string", required: true }, "kb.source": { type: "string", required: true },
    "kb.cert": { type: "object" }, "kb.proof": { type: "object" }, "kb.chart": { type: "object" },
    "kb.taxCountry": { type: "string", required: true }, "kb.taxId": { type: "string", required: true }, "kb.invest": { type: "string" }, "kb.terms": { type: "boolean" }, "kb.truth": { type: "boolean" }, "kb.res": { type: "object" },
  },
  integrations: [
    { id: "config", adapter: "bank.kyb.config", mode: "sandbox" },
    { id: "check", adapter: "bank.kyb.check", mode: "sandbox" },
    { id: "submit", adapter: "bank.kyb.submit", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Open a business account", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.tx", null), set("kb.res", null), set("kb.step", 0), ...wipe,
        set("kb.count", 1), set("kb.p1Role", "Owner and director"), set("kb.p2Role", "Owner"), set("kb.p3Role", "Owner"), set("kb.p4Role", "Owner"), set("kb.p5Role", "Owner"), set("kb.other", "0"), set("kb.invest", "No"), set("kb.terms", false), set("kb.truth", false),
        { type: "callApi", integration: "config", saveAs: "ctx.cfg", onError: { navigate: "route" } },
        go("company"),
      ],
      blocks: [],
    },
    {
      id: "company", title: "Your company",
      blocks: [
        STEPPER, progress(1), text("Your company", "title"), said(1),
        { type: "textInput", bind: "kb.legalName", label: "Legal name" },
        { type: "textInput", bind: "kb.tradingName", label: "Trading name (if different)" },
        { type: "textInput", bind: "kb.registrationNo", label: "Registration number" },
        { type: "select", bind: "kb.companyType", label: "Type of company", variant: "dropdown", source: "ctx.cfg.types" },
        { type: "textInput", bind: "kb.incorporated", label: "Date of incorporation", placeholder: "DD/MM/YYYY" },
        { type: "select", bind: "kb.country", label: "Country of registration", variant: "dropdown", source: "ctx.cfg.countries" },
        { type: "textInput", bind: "kb.address", label: "Registered address" },
        { type: "textInput", bind: "kb.city", label: "City" },
        { type: "textInput", bind: "kb.postcode", label: "Postal code" },
        text("Optional for your bank’s market.", "caption", "ctx.cfg.postalRequired == false"),
        button("Continue", [{ type: "validate" }, set("ctx.error", null), set("kb.step", 1), { type: "callApi", integration: "check", input: { step: 1, ...COMPANY }, onError: { navigate: "route" } }, go("people")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "people", title: "Owners and directors",
      blocks: [
        STEPPER, progress(2), text("Owners and directors", "title"), said(2),
        text("Up to five people. Add everyone who owns 25% or more, and every director.", "caption"),
        ...PEOPLE.flatMap(person),
        button("Add another person", [set("kb.count", "{{kb.count + 1}}")], "secondary", "kb.count < 5"),
        button("Remove last", [set("kb.count", "{{kb.count - 1}}")], "ghost", "kb.count > 1"),
        { type: "textInput", bind: "kb.other", label: "Other owners (%)", keyboard: "number" },
        text("Owners with less than 25% each, combined.", "caption"),
        button("Continue", [set("ctx.error", null), set("kb.step", 2), { type: "callApi", integration: "check", input: { step: 2, ...OWNERS }, saveAs: "ctx.ow", onError: { navigate: "route" } }, go("business")]),
        button("Back", [set("ctx.error", null), go("company")], "ghost"),
      ],
    },
    {
      id: "business", title: "Your business",
      blocks: [
        STEPPER, progress(3), text("Your business", "title"), said(3),
        { type: "select", bind: "kb.industry", label: "Industry", variant: "dropdown", source: "ctx.cfg.industries" },
        { type: "textInput", bind: "kb.about", label: "What the company does", lines: 4, pattern: "^[\\s\\S]{10,300}$", patternMessage: "Tell us a little more." },
        { type: "select", bind: "kb.tradeCountry", label: "Main country of trade", variant: "dropdown", source: "ctx.cfg.countries" },
        { type: "select", bind: "kb.turnover", label: "Yearly turnover", variant: "dropdown", source: "ctx.cfg.turnover" },
        { type: "select", bind: "kb.money", label: "Expected money in each month", variant: "dropdown", source: "ctx.cfg.money" },
        { type: "select", bind: "kb.payments", label: "Payments each month", variant: "dropdown", source: "ctx.cfg.payments" },
        { type: "select", bind: "kb.source", label: "Where the money comes from", variant: "dropdown", source: "ctx.cfg.sources" },
        button("Continue", [{ type: "validate" }, set("ctx.error", null), set("kb.step", 3), { type: "callApi", integration: "check", input: { step: 3, ...BUSINESS }, onError: { navigate: "route" } }, go("documents")]),
        button("Back", [set("ctx.error", null), go("people")], "ghost"),
      ],
    },
    {
      id: "documents", title: "Documents",
      blocks: [
        STEPPER, progress(4), text("Documents", "title"), said(4),
        text("PDF, JPG or PNG, up to 10 MB.", "caption"),
        { type: "fileUpload", bind: "kb.cert", label: "Registration certificate", accept: ["pdf", "image"], maxKb: 10_240 },
        { type: "fileUpload", bind: "kb.proof", label: "Proof of registered address", accept: ["pdf", "image"], maxKb: 10_240 },
        { type: "fileUpload", bind: "kb.chart", label: "Ownership chart (optional)", accept: ["pdf", "image"], maxKb: 10_240, visibleWhen: "ctx.cfg.askChart == true || opt.askChart == true" },
        button("Continue", [set("ctx.error", null), set("kb.step", 4), { type: "callApi", integration: "check", input: { step: 4, ...DOCS }, onError: { navigate: "route" } }, go("tax")]),
        button("Back", [set("ctx.error", null), go("business")], "ghost"),
      ],
    },
    {
      id: "tax", title: "Tax declaration",
      blocks: [
        STEPPER, progress(5), text("Tax declaration", "title"), said(5),
        { type: "select", bind: "kb.taxCountry", label: "Country of tax residence", variant: "dropdown", source: "ctx.cfg.countries" },
        { type: "textInput", bind: "kb.taxId", label: "Tax ID", placeholder: "{{ctx.cfg.taxSample}}" },
        text("{{ctx.cfg.taxHint}}", "caption"),
        { type: "select", bind: "kb.invest", label: "Does most of the income come from investments?", variant: "chips", choices: [{ id: "No", label: "No" }, { id: "Yes", label: "Yes" }] },
        button("Continue", [{ type: "validate" }, set("ctx.error", null), set("kb.step", 5), { type: "callApi", integration: "check", input: { step: 5, ...TAX }, saveAs: "ctx.tx", onError: { navigate: "route" } }, go("review")]),
        button("Back", [set("ctx.error", null), go("documents")], "ghost"),
      ],
    },
    {
      id: "review", title: "Review and agree",
      blocks: [
        STEPPER, progress(6), text("Review and agree", "title"),
        alert("error", "{{ctx.error.message}}", is(...SUBMIT)),
        row("Company", "{{kb.legalName}}"), row("Registration number", "{{kb.registrationNo}}"), row("Type", "{{kb.companyType}}"), row("Registered in", "{{kb.country}}"), row("People", "{{kb.count}}"),
        row("Industry", "{{kb.industry}}"), row("Tax ID", "{{ctx.tx.taxMasked}}"),
        { type: "consent", bind: "kb.terms", termsVersion: "kyb-terms-v1", text: "I agree to the terms and the privacy notice.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Please agree to continue." } } },
        { type: "consent", bind: "kb.truth", termsVersion: "kyb-truth-v1", text: "I confirm these details are true and I can apply for the company.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Please confirm to continue." } } },
        button("Submit", [
          { type: "validate" }, set("ctx.error", null), set("kb.step", 6),
          { type: "callApi", integration: "submit", input: { ...COMPANY, ...OWNERS, ...BUSINESS, ...DOCS, ...TAX, agreeTerms: "{{kb.terms}}", confirmTrue: "{{kb.truth}}" }, saveAs: "kb.res", onError: { navigate: "route" } },
          go("tracker"),
        ]),
        button("Back", [set("ctx.error", null), go("tax")], "ghost"),
      ],
    },
    {
      id: "tracker", title: "Your application", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Application received", text: "Reference {{kb.res.reference}}" },
        {
          type: "timeline", label: "Where it stands",
          items: [
            { id: "received", title: "Received", text: "{{kb.res.steps.received}}", state: "done" }, { id: "checking", title: "Checking your documents", text: "{{kb.res.steps.checking}}", state: "current" },
            { id: "identity", title: "Identity checks", text: "{{kb.res.steps.identity}}", state: "upcoming" }, { id: "ready", title: "Account ready", text: "{{kb.res.steps.ready}}", state: "upcoming" },
          ],
        },
        button("Finish", [go("done")]),
      ],
    },
    {
      id: "done", title: "You’re all set", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "You’re all set", text: "We’ll email you when your account is ready.", meta: "Reference {{kb.res.reference}}" },
        { type: "statusChip", status: "checking", label: "Checking your documents", tone: "warning" },
        row("Company", "{{kb.res.company}}"), row("Registration number", "{{kb.res.registrationMasked}}"),
        button("Back to the start", [{ type: "exit" }]),
      ],
    },
    {
      id: "route", title: "One moment", kind: "branch", onEnter: [go("failed")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        [is(...SUBMIT), "review"], [`kb.step == 1`, "company"], [`kb.step == 2`, "people"], [`kb.step == 3`, "business"], [`kb.step == 4`, "documents"], [`kb.step == 5`, "tax"],
      ),
      blocks: [],
    },
    {
      id: "failed", title: "Open a business account", kind: "terminal",
      blocks: [{ type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was sent." }, button("Start again", [go("start")]), button("Close", [{ type: "exit" }], "secondary")],
    },
    ...downScreens({
      retry: [["ctx.error.integration == 'config'", "start"], ["ctx.error.integration == 'submit'", "review"], ["kb.step == 1", "company"], ["kb.step == 2", "people"], ["kb.step == 3", "business"], ["kb.step == 4", "documents"], ["kb.step == 5", "tax"], ["true", "company"]],
      unavailable: { title: "We couldn’t reach the bank", text: "Nothing was sent. Try again." }, timeout: { title: "We didn’t get an answer in time", text: "We didn’t get an answer in time. Nothing was sent." },
    }),
  ] as Screen[],
};
function is(...codes: string[]) { return codes.map((c) => `ctx.error.code == '${c}'`).join(" || "); }
