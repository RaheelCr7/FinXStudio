import type { Journey, Screen } from "../schema";
import { trackApplicationAcceptance, trackApplicationScenarios } from "./track-application-tests";
import { alert, answerRules, button, CODE_WORDS, downScreens, go, route, set, text } from "./public-kit";

const err = (e: string) => `ta.err == '${e}'`;
const NOT_FOUND = "We couldn’t find an application with those details. Check them and try again.";
/** What a person has typed that the bank has now: the code is gone at once, the mobile number once the bank found the application. */
const wipe = [set("ta.code", "")];
const stage = (id: string, title: string, chip: string, tone: "warning" | "positive", rows: [string, string][], buttons: any[]): Screen => ({
  id, title, kind: "terminal",
  blocks: [
    { type: "result", tone: "success", title, text: id === "ready" ? "One last step: set up your online login." : "We’ll text you when something changes.", meta: "Reference {{st.reference}}" },
    { type: "statusChip", status: id, label: chip, tone },
    { type: "reviewSummary", rows: [{ label: "Account", value: "{{st.productName}}" }, ...rows.map(([label, value]) => ({ label, value }))] },
    { type: "reviewSummary", visibleWhen: "!isEmpty(st.accountLast4)", rows: [{ label: "Account number", value: "••{{st.accountLast4}}" }] },
    ...buttons,
  ],
} as Screen);
const contact = button("Contact us", [{ type: "navigate", toJourney: "contact-support" }], "secondary");
const done = button("Done", [{ type: "exit" }], "ghost");

/**
 * Track my application (BankWorkx, Public: before sign-in). Find an application with its number and the last digits of the mobile number, confirm a one-time code sent to that mobile, and
 * see where it is: Received, Checking your ID or Ready. A Ready application goes on to Register for digital banking. The bank asks for the code before it shows anything (a bank can switch
 * that off with askCode), says nothing about which part of the details was wrong, and locks the journey after three wrong tries (details and codes together).
 *
 * Built from the spec of the prototype with the blocks FinX has: the code is the shared code field; there is no Resend button (the spec's open point); the status is one screen per stage.
 */
export const trackApplication: Journey = {
  id: "jrn_bankworkx_track_application",
  slug: "track-application",
  name: "Track my application",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: trackApplicationAcceptance,
  scenarios: trackApplicationScenarios,
  dataModel: {
    "launch.applicationId": { type: "string" },
    "ta.reference": { type: "string", required: true, pattern: "^\\s*[Aa][Pp][Pp]-[0-9]{6}\\s*$" },
    "ta.mobile": { type: "string", required: true, pattern: "^\\+?[0-9 ()-]{7,18}$" },
    "ta.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "ta.err": { type: "string" },
  },
  integrations: [
    { id: "find", adapter: "bank.applications.find", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "status", adapter: "bank.applications.status", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Track my application", kind: "branch",
      onEnter: [set("ta.reference", "{{launch.applicationId ? launch.applicationId : ''}}"), set("ta.mobile", ""), set("ta.code", ""), set("ta.err", ""), set("ctx.error", null), go("find")],
      blocks: [],
    },
    {
      id: "find", title: "Track my application",
      blocks: [
        text("Track my application", "title"),
        text("Enter the number we sent you.", "body"),
        alert("error", NOT_FOUND, err("notfound")),
        { type: "textInput", bind: "ta.reference", label: "Application number", placeholder: "APP-123456", pattern: "^\\s*[Aa][Pp][Pp]-[0-9]{6}\\s*$", patternMessage: "Enter the number as shown, like APP-123456." },
        { type: "textInput", bind: "ta.mobile", label: "Mobile number", placeholder: "Mobile number", keyboard: "phone", pattern: "^\\+?[0-9 ()-]{7,18}$", patternMessage: "Enter a valid mobile number." },
        button("Continue", [
          { type: "validate" }, set("ta.err", ""),
          { type: "callApi", integration: "find", input: { reference: "{{ta.reference}}", mobile: "{{ta.mobile}}" }, saveAs: "found", onError: { navigate: "findFail" } },
          // the bank has the number: the journey does not keep it
          set("ta.mobile", ""),
          { type: "navigate" },
        ]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
      // with askCode off (the bank says so: needsCode is false) the status comes straight after the details
      navigation: route(["found.needsCode", "sendCode"], ["true", "show"]),
    },
    {
      id: "findFail", title: "Track my application", kind: "branch",
      onEnter: [set("ta.err", "{{ctx.error.code == 'NOT_FOUND' ? 'notfound' : ''}}"), go("find")],
      navigation: route(["ctx.error.code == 'TRACK_LOCKED'", "locked"], ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code != 'NOT_FOUND'", "unavailable"]),
      blocks: [],
    },
    {
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } }, ...wipe, set("ta.err", ""), go("code")],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        alert("info", "We sent a 6-digit code to {{found.maskedMobile}}.", "found.maskedMobile"),
        alert("error", CODE_WORDS.wrong, err("OTP_INVALID")),
        alert("error", CODE_WORDS.expired, err("OTP_EXPIRED")),
        { type: "otp", bind: "ta.code", length: 6 },
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{ta.code}}" }, onError: { navigate: "codeFail" } },
          ...wipe, set("ta.err", ""), go("show"),
        ]),
        button("Back", [go("find")], "ghost"),
      ],
    },
    {
      // a wrong or an old code goes back to the code field (emptied); the third wrong try of anything locks it
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [...wipe, set("ta.err", "{{ctx.error.code}}"), go("code")],
      navigation: route(["ctx.error.code == 'TRACK_LOCKED'", "locked"], ...answerRules),
      blocks: [],
    },
    {
      id: "show", title: "Track my application", kind: "branch",
      onEnter: [{ type: "callApi", integration: "status", saveAs: "st", onError: { navigate: "codeFail" } }, { type: "navigate" }],
      navigation: route(["st.stage == 'ready'", "ready"], ["st.stage == 'received'", "received"], ["true", "checking"]),
      blocks: [],
    },
    stage("received", "We’ve received your application", "Received", "warning", [["Received", "In progress"], ["Checking your ID", "Next"], ["Ready", "Next"]], [contact, done]),
    stage("checking", "We’re checking your ID", "Checking your ID", "warning", [["Received", "Done"], ["Checking your ID", "In progress"], ["Ready", "Next"]], [contact, done]),
    stage("ready", "Your account is ready", "Ready", "positive", [["Received", "Done"], ["Checking your ID", "Done"], ["Ready", "Done"]], [
      button("Register for digital banking", [{ type: "navigate", toJourney: "register-digital-banking", with: { "launch.applicationId": "{{st.reference}}" } }]), done,
    ]),
    {
      id: "locked", title: "Too many tries", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many tries", text: "For your security, try again in 30 minutes, or contact us." },
        contact,
        done,
      ],
    },
    ...downScreens({
      retry: "find", wipe,
      unavailable: { title: "We couldn’t reach the bank", text: "We couldn’t reach the bank. Try again in a few minutes." },
      timeout: { text: "This is taking longer than expected. Try again." },
    }),
  ] as Screen[],
};
