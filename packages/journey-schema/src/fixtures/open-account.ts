import type { Block, Journey, Screen } from "../schema";
import { openAccountAcceptance, openAccountScenarios } from "./open-account-tests";
import { alert, answerRules, button, CODE_WORDS, downScreens, go, note, route, set, text } from "./public-kit";

const err = (e: string) => `oa.err == '${e}'`;
const DOB_HINT = "DD/MM/YYYY";
/** What is only held until the bank has it: the code and, from the review on, the ID number and the tax ID (the bank keeps a hash and a mask). */
const secrets = [set("oa.code", ""), set("oa.idNumber", ""), set("oa.taxId", "")];
/** Where each step goes next after the bank's check of it. The market decides whether a proof of address comes between the address and the ID. */
const NEXT: [string, string][] = [["oa.step == 'about'", "address"], ["oa.step == 'address' && ctx.cfg.poa", "poa"], ["oa.step == 'address'", "idv"], ["oa.step == 'poa'", "idv"], ["oa.step == 'id'", "selfie"], ["oa.step == 'work'", "tax"], ["oa.step == 'tax'", "product"]];
/** Every answer the bank may keep, flat (the engine reads only the top-level values of a call). The ID number and the tax ID go as typed and are kept as a hash and a mask; photos never go. */
const ANSWERS = {
  applicationId: "{{oa.applicationId}}", name: "{{oa.name}}", dob: "{{oa.dob}}", nationality: "{{oa.nationality}}", idNumber: "{{oa.idNumber}}", line1: "{{oa.line1}}", line2: "{{oa.line2}}", city: "{{oa.city}}", postcode: "{{oa.postcode}}",
  country: "{{oa.country}}", employment: "{{oa.employment}}", income: "{{oa.income}}", source: "{{oa.source}}", deposits: "{{oa.deposits}}", taxOnly: "{{oa.taxOnly}}", taxCountry: "{{oa.taxCountry}}", taxId: "{{oa.taxId}}", product: "{{oa.product}}",
};
const FILES = { idDocument: "{{oa.idDocument}}", front: "{{oa.idPhotos.front.ref}}", back: "{{oa.idPhotos.back.ref}}", proofName: "{{isEmpty(oa.proof) ? '' : oa.proof.name}}" };
/** A step's own button: it checks the step with the bank (one place, one failure path), then goes where `NEXT` says. */
const next = (step: string) => button("Continue", [{ type: "validate" }, set("oa.err", ""), set("oa.msg", ""), set("oa.step", step), go("check")]);
const save = button("Save and finish later", [set("oa.err", ""), go("saveStep")], "secondary", "ctx.cfg.allowSave");
const problem = alert("error", "{{oa.msg}}", "!isEmpty(oa.err)");
const retake = (what: string[], clear: any[]) => button("Retake", [...clear, set("oa.err", ""), set("oa.msg", "")], "secondary", what.map(err).join(" || "));
/** The ID number, in the market's own format (four fields, one is drawn): the number is a secure field, hidden by default and never written into a transcript. */
const idFields = (): Block[] => ([
  ["A", "9 digits", "^[0-9]{9}$", "Enter the 9 digits."], ["B", "AB123456C", "^[A-Za-z]{2}[0-9]{6}[A-Za-z]$", "Use 2 letters, 6 digits, then 1 letter."],
  ["C", "8 to 14 letters or digits", "^[A-Za-z0-9]{8,14}$", "Use 8 to 14 letters or digits."], ["D", "784…", "^784[0-9]{12}$", "Enter the 15 digits, starting 784."],
] as const).map(([m, placeholder, pattern, patternMessage]) => ({ type: "textInput", bind: "oa.idNumber", label: "National ID number", placeholder, secure: true, pattern, patternMessage, visibleWhen: `ctx.cfg.market == '${m}'` }) as Block);
const TERMS = [
  "## Using BankWorkx®", "You may use your account for your own banking only. We may ask you to confirm who you are before we open it or at any time after.", "",
  "## Keeping your details safe", "You must keep your username, password and one-time codes private and tell us at once if you think someone else knows them. We will never ask for your password.", "",
  "## Your data", "We use what you tell us to open your account, to check who you are and to meet the law. We keep your ID number and tax ID as a protected record, never your photos. You can ask us what we hold.", "",
  "## Changes", "We may change these terms with notice. This is sample text: the bank’s approved wording replaces it.",
].join("\n");

/**
 * Open an account (BankWorkx, Onboarding). A new customer verifies a mobile number with a one-time code, gives personal details and an address, shows an ID and a selfie (and a proof of
 * address where the bank's home market asks), describes work and money, makes the tax declaration, chooses an account, reads and signs the terms and sends the application. The bank decides
 * after its checks: this creates an application, not an account. Save and finish later keeps the answers for 30 days without the photos, the code, the ID number or the tax ID, and the
 * journey offers to continue when it is opened again. Everything the market decides (the ID format, the proof of address, the postcode field, the symbol, the tax wording) comes from the bank.
 *
 * Built from the spec of the prototype with the blocks FinX has: the ID and the selfie are a simulated capture (no camera; a counted reference is all that is kept); the bank's checks
 * run on Continue and the bank's words are shown above the form; a resumed application asks for the ID number again (the bank keeps only a hash), then goes to the first photo step;
 * the terms are read to the end and signed with the typed name, which must match the name given.
 */
export const openAccount: Journey = {
  id: "jrn_bankworkx_open_account",
  slug: "open-account",
  name: "Open an account",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: openAccountAcceptance,
  scenarios: openAccountScenarios,
  dataModel: {
    "launch.fresh": { type: "string" },
    "launch.productId": { type: "string" },
    "opt.allowSave": { type: "boolean" },
    "opt.reviewHigh": { type: "boolean" },
    "oa.mobile": { type: "string", required: true, pattern: "^\\+?[0-9 ()-]{7,20}$" },
    "oa.email": { type: "string", required: true, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
    "oa.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "oa.name": { type: "string", required: true, pattern: "^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]+$" },
    "oa.dob": { type: "string", required: true, pattern: "^[0-9]{2}/[0-9]{2}/[0-9]{4}$" },
    "oa.nationality": { type: "string", required: true },
    "oa.idNumber": { type: "string", required: true },
    "oa.line1": { type: "string", required: true, pattern: "^.{3,}$" },
    "oa.line2": { type: "string" },
    "oa.city": { type: "string", required: true },
    "oa.postcode": { type: "string", required: true, pattern: "^[A-Za-z0-9 -]{3,10}$" },
    "oa.country": { type: "string", required: true },
    "oa.proof": { type: "object", required: true },
    "oa.idDocument": { type: "string", required: true },
    "oa.idPhotos": { type: "object" },
    "oa.selfie": { type: "object" },
    "oa.employment": { type: "string", required: true },
    "oa.income": { type: "string", required: true },
    "oa.source": { type: "string", required: true },
    "oa.deposits": { type: "string", required: true },
    "oa.taxOnly": { type: "string", required: true },
    "oa.taxCountry": { type: "string", required: true },
    "oa.taxId": { type: "string", required: true, pattern: "^.{4,}$" },
    "oa.product": { type: "string", required: true },
    "oa.terms": { type: "boolean", required: true },
    "oa.taxConfirm": { type: "boolean", required: true },
    "oa.read": { type: "boolean" },
    "oa.sig": { type: "object", required: true },
    "oa.applicationId": { type: "string" },
    "oa.idMask": { type: "string" },
    "oa.step": { type: "string" },
    "oa.at": { type: "string" },
    "oa.err": { type: "string" },
    "oa.msg": { type: "string" },
  },
  integrations: [
    { id: "begin", adapter: "bank.onboarding.begin", mode: "sandbox" },
    { id: "start", adapter: "bank.onboarding.start", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "check", adapter: "bank.onboarding.check", mode: "sandbox" },
    { id: "save", adapter: "bank.onboarding.save", mode: "sandbox" },
    { id: "discard", adapter: "bank.onboarding.discard", mode: "sandbox" },
    { id: "verifyId", adapter: "bank.onboarding.verifyIdentity", mode: "sandbox" },
    { id: "submit", adapter: "bank.onboarding.submit", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Open an account", kind: "branch",
      onEnter: [
        ...secrets, set("oa.applicationId", ""), set("oa.err", ""), set("oa.msg", ""), set("oa.at", "start"), set("oa.step", ""), set("oa.terms", false), set("oa.taxConfirm", false), set("oa.read", false),
        set("oa.mobile", ""), set("oa.email", ""), set("oa.name", ""), set("oa.dob", ""), set("oa.nationality", ""), set("oa.line1", ""), set("oa.line2", ""), set("oa.city", ""), set("oa.postcode", ""), set("oa.proof", null),
        set("oa.idDocument", ""), set("oa.idPhotos", null), set("oa.selfie", null), set("oa.employment", ""), set("oa.income", ""), set("oa.source", ""), set("oa.deposits", ""), set("oa.taxOnly", "yes"), set("oa.taxCountry", ""),
        set("oa.sig", null), set("ctx.error", null),
        { type: "callApi", integration: "begin", input: { fresh: "{{launch.fresh == 1}}", productId: "{{launch.productId}}", allowSave: "{{opt.allowSave != false}}" }, saveAs: "ctx.cfg", onError: { navigate: "fail" } },
        set("oa.country", "{{ctx.cfg.country}}"), set("oa.product", "{{ctx.cfg.preselect}}"),
        { type: "navigate" },
      ],
      navigation: route(["!isEmpty(ctx.cfg.welcome)", "welcome"], ["ctx.cfg.saved.found", "resume"], ["true", "details"]),
      blocks: [],
    },
    {
      // a loan or a card is applied for once signed in: the bank says to open an account first
      id: "welcome", title: "Open an account",
      blocks: [
        text("Open an account", "title"),
        alert("info", "To apply for this, first open an account. You can apply once you’re signed in."),
        note("{{ctx.cfg.welcome}}"),
        button("Open an account", [go("details")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "resume", title: "Welcome back",
      blocks: [
        text("Welcome back", "title"),
        text("{{ctx.cfg.saved.name}}", "body"),
        note("{{ctx.cfg.saved.savedText}}"),
        button("Continue", [
          set("oa.applicationId", "{{ctx.cfg.saved.applicationId}}"), set("oa.idMask", "{{ctx.cfg.saved.idMasked}}"),
          set("oa.name", "{{ctx.cfg.saved.answers.name}}"), set("oa.dob", "{{ctx.cfg.saved.answers.dob}}"), set("oa.nationality", "{{ctx.cfg.saved.answers.nationality}}"),
          set("oa.line1", "{{ctx.cfg.saved.answers.line1}}"), set("oa.line2", "{{ctx.cfg.saved.answers.line2}}"), set("oa.city", "{{ctx.cfg.saved.answers.city}}"), set("oa.postcode", "{{ctx.cfg.saved.answers.postcode}}"), set("oa.country", "{{ctx.cfg.saved.answers.country}}"),
          set("oa.employment", "{{ctx.cfg.saved.answers.employment}}"), set("oa.income", "{{ctx.cfg.saved.answers.income}}"), set("oa.source", "{{ctx.cfg.saved.answers.source}}"), set("oa.deposits", "{{ctx.cfg.saved.answers.deposits}}"),
          set("oa.taxOnly", "{{ctx.cfg.saved.answers.taxOnly == false ? 'no' : 'yes'}}"), set("oa.taxCountry", "{{ctx.cfg.saved.answers.taxCountry}}"),
          set("oa.product", "{{ctx.cfg.saved.answers.product ? ctx.cfg.saved.answers.product : ctx.cfg.preselect}}"),
          go("reid"),
        ]),
        button("Start again", [{ type: "callApi", integration: "discard", input: { applicationId: "{{ctx.cfg.saved.applicationId}}" }, onError: { navigate: "fail" } }, go("details")], "secondary"),
      ],
    },
    {
      // the bank keeps only a hash of the ID number and the tax ID, so a resumed application asks for them again before the photos
      id: "reid", title: "Confirm your ID number", onEnter: [set("oa.at", "reid")],
      blocks: [
        text("Confirm your ID number", "title"),
        text("For your security we don’t keep your ID number. Enter it again to go on.", "body"),
        note("You gave {{oa.idMask}}.", "!isEmpty(oa.idMask)"),
        ...idFields(),
        { type: "textInput", bind: "oa.taxId", label: "Tax ID", placeholder: "Your tax ID", secure: true, pattern: "^.{4,}$", patternMessage: "Enter your tax ID.", visibleWhen: "oa.taxOnly == 'no'" },
        button("Continue", [{ type: "validate" }, { type: "navigate" }]),
      ],
      navigation: route(["ctx.cfg.poa", "poa"], ["true", "idv"]),
    },
    {
      id: "details", title: "Get started", onEnter: [set("oa.at", "details")],
      blocks: [
        text("Get started", "title"),
        problem,
        { type: "textInput", bind: "oa.mobile", label: "Mobile number", placeholder: "Mobile number", keyboard: "phone", pattern: "^\\+?[0-9 ()-]{7,20}$", patternMessage: "Enter a valid mobile number." },
        { type: "textInput", bind: "oa.email", label: "Email", placeholder: "name@example.com", keyboard: "email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", patternMessage: "Enter a valid email address." },
        note("We’ll send a 6-digit code to your mobile."),
        button("Continue", [
          { type: "validate" }, set("oa.err", ""), set("oa.msg", ""),
          { type: "callApi", integration: "start", input: { mobile: "{{oa.mobile}}", email: "{{oa.email}}" }, saveAs: "st", onError: { navigate: "startFail" } },
          set("oa.applicationId", "{{st.applicationId}}"), go("sendCode"),
        ]),
        button("Sign in", [{ type: "navigate", toJourney: "sign-in" }], "secondary", "oa.err == 'DUPLICATE_APPLICATION'"),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "startFail", title: "Get started", kind: "branch",
      onEnter: [set("oa.err", "{{ctx.error.code}}"), set("oa.msg", "{{ctx.error.message}}"), go("details")],
      navigation: route(...answerRules),
      blocks: [],
    },
    {
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } }, set("oa.code", ""), set("oa.err", ""), go("code")],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        alert("info", "We sent a 6-digit code to {{st.maskedMobile}}.", "st.maskedMobile"),
        alert("error", "That code isn’t right. Check the latest message.", err("OTP_INVALID")),
        alert("error", CODE_WORDS.expired, err("OTP_EXPIRED")),
        alert("error", CODE_WORDS.limit, err("OTP_RESEND_LIMIT")),
        { type: "otp", bind: "oa.code", length: 6, hint: "Sent to your mobile." },
        button("Resend code", [
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } },
          set("oa.code", ""), set("oa.err", ""), { type: "showToast", text: CODE_WORDS.resent },
        ], "secondary"),
        button("Continue", [{ type: "validate" }, { type: "callApi", integration: "otpVerify", input: { code: "{{oa.code}}" }, onError: { navigate: "codeFail" } }, set("oa.code", ""), set("oa.err", ""), go("about")]),
      ],
    },
    {
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [set("oa.code", ""), set("oa.err", "{{ctx.error.code}}"), go("code")],
      navigation: route(...answerRules),
      blocks: [],
    },
    {
      id: "about", title: "About you", onEnter: [set("oa.at", "about")],
      blocks: [
        text("About you", "title"),
        problem,
        { type: "textInput", bind: "oa.name", label: "Full name as on your ID", placeholder: "First and last name", pattern: "^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]+$", patternMessage: "Use letters only." },
        { type: "textInput", bind: "oa.dob", label: "Date of birth", placeholder: DOB_HINT, keyboard: "number", pattern: "^[0-9]{2}/[0-9]{2}/[0-9]{4}$", patternMessage: "Use the format DD/MM/YYYY." },
        { type: "select", bind: "oa.nationality", label: "Nationality", variant: "dropdown", source: "ctx.cfg.countries" },
        ...idFields(),
        next("about"), save,
      ],
    },
    {
      id: "address", title: "Address", onEnter: [set("oa.at", "address")],
      blocks: [
        text("Address", "title"),
        problem,
        { type: "textInput", bind: "oa.line1", label: "Address line 1", pattern: "^.{3,}$", patternMessage: "Enter the first line of your address." },
        { type: "textInput", bind: "oa.line2", label: "Address line 2 (optional)" },
        { type: "textInput", bind: "oa.city", label: "City" },
        { type: "textInput", bind: "oa.postcode", label: "Postcode", pattern: "^[A-Za-z0-9 -]{3,10}$", patternMessage: "Enter a valid postcode.", visibleWhen: "ctx.cfg.postcode" },
        { type: "select", bind: "oa.country", label: "Country", variant: "dropdown", source: "ctx.cfg.countries" },
        next("address"), save,
      ],
    },
    {
      id: "poa", title: "Proof of address", onEnter: [set("oa.at", "poa")],
      blocks: [
        text("Proof of address", "title"),
        problem,
        { type: "fileUpload", bind: "oa.proof", label: "A recent utility bill or tenancy contract", accept: ["pdf", "image"], maxKb: 5120, helper: "Take a photo or add a file from the last 3 months" },
        retake(["POA_TOO_OLD", "POA_REQUIRED"], [set("oa.proof", null)]),
        next("poa"), save,
      ],
    },
    {
      id: "idv", title: "Verify your identity", onEnter: [set("oa.at", "idv")],
      blocks: [
        text("Verify your identity", "title"),
        problem,
        { type: "select", bind: "oa.idDocument", label: "Document", variant: "chips", choices: [{ id: "national-id", label: "National ID card" }, { id: "passport", label: "Passport" }, { id: "licence", label: "Driving licence" }] },
        { type: "idCapture", bind: "oa.idPhotos", label: "Photos of your document", steps: ["front", "back"], visibleWhen: "oa.idDocument != 'passport'" },
        { type: "idCapture", bind: "oa.idPhotos", label: "Photo of your passport", steps: ["front"], visibleWhen: "oa.idDocument == 'passport'" },
        retake(["ID_UNREADABLE", "ID_EXPIRED", "ID_MISMATCH", "PHOTO_MISSING"], [set("oa.idPhotos", null)]),
        next("id"), save,
      ],
    },
    {
      id: "selfie", title: "Take a selfie", onEnter: [set("oa.at", "selfie")],
      blocks: [
        text("Take a selfie", "title"),
        problem,
        { type: "idCapture", bind: "oa.selfie", label: "Your selfie", steps: ["selfie"] },
        retake(["LIVENESS_LOW_LIGHT", "LIVENESS_FAILED"], [set("oa.selfie", null)]),
        button("Continue", [
          { type: "validate" }, set("oa.err", ""), set("oa.msg", ""),
          { type: "callApi", integration: "verifyId", input: { applicationId: "{{oa.applicationId}}", selfie: "{{oa.selfie.selfie.ref}}", dob: "{{oa.dob}}", idNumber: "{{oa.idNumber}}" }, onError: { navigate: "stepFail" } },
          set("oa.selfie", null), go("work"),
        ]),
        save,
      ],
    },
    {
      id: "work", title: "Work and money", onEnter: [set("oa.at", "work")],
      blocks: [
        text("Work and money", "title"),
        problem,
        { type: "select", bind: "oa.employment", label: "Employment", variant: "dropdown", options: ["Employed", "Self-employed", "Student", "Retired", "Not working"] },
        { type: "select", bind: "oa.income", label: "Yearly income before tax", variant: "dropdown", source: "ctx.cfg.incomeBands" },
        { type: "select", bind: "oa.source", label: "Source of funds", variant: "dropdown", options: ["Salary", "Business income", "Savings", "Pension", "Investments", "Gift or inheritance"] },
        { type: "select", bind: "oa.deposits", label: "Expected monthly deposits", variant: "dropdown", source: "ctx.cfg.depositBands" },
        next("work"), save,
      ],
    },
    {
      id: "tax", title: "Tax", onEnter: [set("oa.at", "tax")],
      blocks: [
        text("Tax", "title"),
        problem,
        { type: "select", bind: "oa.taxOnly", label: "Are you a tax resident only here?", variant: "chips", choices: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] },
        { type: "select", bind: "oa.taxCountry", label: "Country of tax residence", variant: "dropdown", source: "ctx.cfg.countries", visibleWhen: "oa.taxOnly == 'no'" },
        { type: "textInput", bind: "oa.taxId", label: "Tax ID", placeholder: "Your tax ID", secure: true, pattern: "^.{4,}$", patternMessage: "Enter your tax ID.", visibleWhen: "oa.taxOnly == 'no'" },
        next("tax"), save,
      ],
    },
    {
      id: "product", title: "Choose your account", onEnter: [set("oa.at", "product")],
      blocks: [
        text("Choose your account", "title"),
        { type: "select", bind: "oa.product", label: "Account", variant: "tiles", source: "ctx.cfg.accounts" },
        button("Continue", [{ type: "validate" }, go("review")]), save,
      ],
    },
    {
      id: "review", title: "Review and agree", onEnter: [set("oa.at", "review")],
      blocks: [
        text("Review and agree", "title"),
        {
          type: "reviewSummary", rows: [
            { label: "Name", value: "{{oa.name}}" }, { label: "Date of birth", value: "{{oa.dob}}" }, { label: "National ID number", value: "{{oa.idMask}}" },
            { label: "Address", value: "{{oa.line1}}, {{oa.city}} {{oa.postcode}}" }, { label: "Account", value: "{{ctx.cfg.accounts[oa.product].name}}" },
          ],
        },
        { type: "consent", bind: "oa.terms", termsVersion: "2026-10", text: "I agree to the terms and the privacy notice.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Please agree to continue." } } },
        { type: "consent", bind: "oa.taxConfirm", termsVersion: "2026-10", text: "{{ctx.cfg.taxText}}", validation: { mustBeTrue: true, messages: { mustBeTrue: "Please confirm to continue." } } },
        button("Continue", [{ type: "validate" }, go("sign")]), save,
      ],
    },
    {
      id: "sign", title: "Read and sign", onEnter: [set("oa.at", "sign")],
      blocks: [
        text("Read and sign", "title"),
        problem,
        { type: "documentViewer", bind: "oa.read", title: "Terms and privacy notice", text: TERMS, height: 220 },
        { type: "signature", bind: "oa.sig", label: "Sign with your name", expectedName: "{{oa.name}}", helper: "Type your full name as it is on your ID." },
        button("Submit", [
          { type: "validate" }, set("oa.err", ""), set("oa.msg", ""),
          {
            type: "callApi", integration: "submit", saveAs: "oa.res", onError: { navigate: "stepFail" },
            input: { ...ANSWERS, terms: "{{oa.terms}}", taxConfirm: "{{oa.taxConfirm}}", signed: "{{!isEmpty(oa.sig)}}", reviewHigh: "{{opt.reviewHigh != false}}" },
          },
          go("status"),
        ]),
        button("Back", [go("review")], "ghost"),
      ],
    },
    {
      // sent: the journey keeps the reference and the account for the result, not the answers
      id: "status", title: "Your application", onEnter: [...secrets, set("oa.dob", ""), set("oa.line1", ""), set("oa.line2", ""), set("oa.city", ""), set("oa.postcode", ""), set("oa.mobile", ""), set("oa.email", ""), set("oa.proof", null), set("oa.idPhotos", null), set("oa.selfie", null), set("oa.sig", null), set("oa.at", "status")],
      blocks: [
        { type: "result", tone: "success", title: "Application received", text: "Reference {{oa.res.reference}}" },
        {
          type: "timeline", items: [
            { id: "received", title: "Received", text: "We have your application.", state: "done" },
            { id: "checking", title: "Checking your ID", text: "This usually takes a few minutes.", state: "current", visibleWhen: "oa.res.status == 'checking'" },
            { id: "review", title: "A few more checks", text: "A person is looking at your application. We may email you.", state: "current", visibleWhen: "oa.res.status == 'manual-review'" },
            { id: "ready", title: "Ready", text: "Your account is open.", state: "upcoming" },
          ],
        },
        button("Finish", [go("done")]),
      ],
    },
    {
      id: "done", title: "You’re all set", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "You’re all set", text: "{{oa.res.status == 'manual-review' ? 'We’ll email you when it’s ready.' : 'We’ll tell you when your account is ready.'}}", meta: "Reference {{oa.res.reference}}" },
        { type: "statusChip", status: "checking", label: "Checking your ID", tone: "warning", visibleWhen: "oa.res.status == 'checking'" },
        { type: "statusChip", status: "review", label: "A few more checks", tone: "warning", visibleWhen: "oa.res.status == 'manual-review'" },
        { type: "reviewSummary", rows: [{ label: "Account", value: "{{oa.res.productName}}" }, { label: "Name", value: "{{oa.name}}" }] },
        button("Sign in", [{ type: "navigate", toJourney: "sign-in" }]),
        button("Track my application", [{ type: "navigate", toJourney: "track-application", with: { "launch.applicationId": "{{oa.res.reference}}" } }], "secondary"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the check of a step: one place, so one failure path; then where the step goes next
      id: "check", title: "Open an account", kind: "branch",
      onEnter: [
        {
          type: "callApi", integration: "check", onError: { navigate: "stepFail" }, saveAs: "oa.chk",
          input: { step: "{{oa.step}}", ...ANSWERS, ...FILES },
        },
        set("oa.idMask", "{{oa.step == 'about' ? oa.chk.idMasked : oa.idMask}}"), { type: "navigate" },
      ],
      navigation: route(...NEXT),
      blocks: [],
    },
    {
      id: "saveStep", title: "Open an account", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "save", input: { ...ANSWERS, allowSave: "{{opt.allowSave != false}}" }, saveAs: "oa.sv", onError: { navigate: "stepFail" } },
        // the bank has what it keeps: a hash of the ID number and the tax ID, the answers, never the photos; the journey lets go of the numbers
        ...secrets, go("saved"),
      ],
      blocks: [],
    },
    {
      id: "saved", title: "Saved", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Saved", text: "{{oa.sv.savedText}}" },
        button("Continue now", [{ type: "navigate", toJourney: "open-account" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // what the person can fix is a message on the step it belongs to (the answers stay); a mismatch sends them back to the ID photos; a decline has its own screen
      id: "stepFail", title: "Open an account", kind: "branch",
      onEnter: [set("oa.err", "{{ctx.error.code}}"), set("oa.msg", "{{ctx.error.message}}"), go("back")],
      navigation: route(
        ...answerRules, ["ctx.error.code == 'APPLICATION_NOT_ACCEPTED'", "declined"], ["ctx.error.code == 'ID_MISMATCH'", "mismatch"], ["ctx.error.code == 'NOT_VERIFIED' || ctx.error.code == 'APPLICATION_NOT_FOUND'", "details"],
      ),
      blocks: [],
    },
    {
      // the first call, the one that loads the market's rules, and the discard have no step to return to: they say so
      id: "fail", title: "Open an account", kind: "branch",
      onEnter: [set("oa.err", "{{ctx.error.code}}"), set("oa.msg", "{{ctx.error.message}}"), go("unavailable")],
      navigation: route(["ctx.error.code == 'TIMEOUT'", "timeout"]),
      blocks: [],
    },
    {
      id: "mismatch", title: "Verify your identity", kind: "branch",
      onEnter: [set("oa.idPhotos", null), set("oa.selfie", null), go("idv")],
      blocks: [],
    },
    {
      id: "declined", title: "We can’t open this account online", kind: "terminal", onEnter: secrets,
      blocks: [
        { type: "result", tone: "error", title: "We can’t open this account online", text: "We can’t open this account online. Please contact us." },
        button("Contact us", [{ type: "navigate", toJourney: "contact-support" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // back to the step a failure came from, with the answers still in the form
      id: "back", title: "Open an account", kind: "branch",
      onEnter: [{ type: "navigate" }],
      navigation: route(...["details", "about", "address", "poa", "idv", "selfie", "work", "tax", "sign"].map((s) => [`oa.at == '${s}'`, s] as [string, string]), ["true", "start"]),
      blocks: [],
    },
    ...downScreens({
      retry: "back",
      unavailable: { title: "We couldn’t reach the bank", text: "We couldn’t reach the bank. Your answers are saved." },
      timeout: { text: "This is taking longer than expected. Nothing was sent." },
    }),
  ] as Screen[],
};
