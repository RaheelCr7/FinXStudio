import type { Journey, Screen } from "../schema";
import { changeLimitsAcceptance, changeLimitsScenarios } from "./change-limits-tests";
import { alert, button, denyScreen, failScreens, go, is, lockOnWrongCode, lockedScreen, route, set, text } from "./business-kit";

const FIELD = ["INVALID_AMOUNT", "LIMIT_SAME", "LIMIT_ABOVE_COMPANY", "LIMIT_ABOVE_CEILING", "LIMIT_BELOW_OTHERS"];
const FORM = { which: "{{cl.which}}", value: "{{cl.value}}", secondApproval: "{{opt.secondIncrease != false}}" };
const skipped = "cl.skip == true";
const reviewRow = (label: string, value: string, visibleWhen?: string) => ({ type: "reviewSummary" as const, ...(visibleWhen ? { visibleWhen } : {}), rows: [{ label, value }] });

/** The steps of the progress bar: one fewer when the journey was opened with the first choice made, as the line under it says. */
const STEPPERS = [{ type: "stepper" as const, steps: ["setting", "amount", "review"], visibleWhen: "cl.skip != true" }, { type: "stepper" as const, steps: ["amount", "review"], visibleWhen: "cl.skip == true" }];

/**
 * Change limits (BankWorkx Business, Admin). An administrator changes one of four company settings: the limit per person, the company daily limit, the amount above which two approvers are needed
 * and the amount from which an extra code is asked. A decrease applies at once; an increase waits for ANOTHER administrator (the option `secondIncrease`, on unless a bank turns it off). It changes
 * how much can leave the company, so the bank decides every rule (the amount against the company's limit, the bank's ceiling and the highest of the other settings), asks for the one-time code
 * before any change and writes the outcome to the activity log. A single person's own limit is changed in Invite, edit or disable a user.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the live box beside the amount (now, new, the difference) is the review, because the engine cannot redraw as the person types, and
 * the bank's checks of the amount come with Review and show above the field; the Autofill sample is not built.
 */
export const changeLimits: Journey = {
  id: "jrn_change_limits",
  slug: "change-limits",
  name: "Change limits",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: changeLimitsAcceptance,
  scenarios: changeLimitsScenarios,
  dataModel: {
    "launch.which": { type: "string" }, "opt.secondIncrease": { type: "boolean" },
    "cl.which": { type: "string", required: true }, "cl.skip": { type: "boolean" }, "cl.value": { type: "number" }, "cl.res": { type: "object" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "limits", adapter: "corp.limits.get", mode: "sandbox" },
    { id: "check", adapter: "corp.limits.set", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "change", adapter: "corp.limits.set", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Change limits", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.rv", null), set("cl.res", null), set("otp.code", ""), set("cl.value", ""),
        set("cl.which", "{{launch.which}}"), set("cl.skip", false),
        { type: "callApi", integration: "limits", saveAs: "ctx.lim", onError: { navigate: "route" } },
        go("which"),
      ],
      navigation: route([`launch.which == 'person' || launch.which == 'company' || launch.which == 'two' || launch.which == 'code'`, "skip"]),
      blocks: [],
    },
    { id: "skip", title: "Change limits", kind: "branch", onEnter: [set("cl.skip", true), go("amount")], blocks: [] },
    {
      id: "which", title: "What to change?",
      blocks: [
        ...STEPPERS, text("Step 1 of 3 · Change limits", "caption"), text("What to change?", "title"),
        alert("error", "Choose what to change.", is("INVALID_SETTING")),
        {
          type: "select", bind: "cl.which", label: "What to change", variant: "tiles",
          choices: [
            { id: "person", label: "Limit per person", text: "Most one person can send in a day · {{ctx.lim.personText}}" }, { id: "company", label: "Company daily limit", text: "Most the company can send in a day · {{ctx.lim.companyText}}" },
            { id: "two", label: "Two approvers above", text: "Payments above this need two approvers · {{ctx.lim.twoText}}" }, { id: "code", label: "Extra code from", text: "Payments from this amount need a code · {{ctx.lim.codeText}}" },
          ],
        },
        button("Continue", [{ type: "validate" }, set("ctx.error", null), go("amount")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "amount", title: "New amount",
      blocks: [
        ...STEPPERS,
        text("Step 2 of 3 · Change limits", "caption", `!(${skipped})`), text("Step 1 of 2 · Change limits", "caption", skipped),
        text("New amount", "title"),
        alert("error", "{{ctx.error.message}}", is(...FIELD)),
        { type: "reviewSummary", rows: [{ label: "{{ctx.lim.items[cl.which].title}}", value: "Now {{ctx.lim.items[cl.which].text}}" }] },
        { type: "reviewSummary", visibleWhen: "cl.which == 'person'", rows: [{ label: "Company daily limit", value: "{{ctx.lim.companyText}}" }] },
        { type: "reviewSummary", visibleWhen: "cl.which == 'company'", rows: [{ label: "Ceiling set by the bank", value: "{{ctx.lim.ceilingText}}" }] },
        { type: "amountInput", bind: "cl.value", currency: "USD", label: "New {{ctx.lim.items[cl.which].name}}", placeholder: "0.00" },
        button("Review", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "check", input: { ...FORM, dryRun: true }, saveAs: "ctx.rv", onError: { navigate: "route" } },
          go("review"),
        ]),
        button("Back", [set("ctx.error", null), go("which")], "ghost", `!(${skipped})`),
        button("Cancel", [{ type: "exit" }], "ghost", skipped),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        ...STEPPERS,
        text("Step 3 of 3 · Change limits", "caption", `!(${skipped})`), text("Step 2 of 2 · Change limits", "caption", skipped),
        text("Review", "title"),
        reviewRow("Setting", "{{ctx.rv.setting}}"), reviewRow("Now", "{{ctx.rv.nowText}}"), reviewRow("New", "{{ctx.rv.newText}}"), reviewRow("Change", "{{ctx.rv.changeText}}"),
        text("A second administrator has to approve this.", "caption", "ctx.rv.approvalNeeded"), text("This applies straight away.", "caption", "!ctx.rv.approvalNeeded"),
        reviewRow("Takes effect", "{{ctx.rv.effectText}}"), reviewRow("Company", "{{ctx.rv.company}}"),
        button("Confirm", [
          set("ctx.error", null), set("otp.code", ""),
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } },
          go("otp"),
        ]),
        button("Back", [set("ctx.error", null), go("amount")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Change {{ctx.rv.name}} to {{ctx.rv.newText}}", "title"), text("It only works for this change.", "caption"),
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true, hint: "Code sent to {{ctx.otp.maskedPhone}}.", onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } }] },
        button("Change limit", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "change", input: { ...FORM }, saveAs: "cl.res", onError: { navigate: "route" } },
          set("otp.code", ""), go("result"),
        ]),
      ],
    },
    {
      id: "result", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: "Another administrator has to approve this increase. Your current limit stays until then.", visibleWhen: "cl.res.status == 'waiting'" },
        { type: "statusChip", status: "waiting", label: "Waiting for approval", tone: "warning", visibleWhen: "cl.res.status == 'waiting'" },
        { type: "result", tone: "success", title: "Limit changed", text: "{{cl.res.setting}} is now {{cl.res.newText}}.", visibleWhen: "cl.res.status == 'applied'" },
        { type: "statusChip", status: "applied", label: "Applied", tone: "positive", visibleWhen: "cl.res.status == 'applied'" },
        reviewRow("Setting", "{{cl.res.setting}}"), reviewRow("Now", "{{cl.res.nowText}}"), reviewRow("New", "{{cl.res.newText}}"), reviewRow("Company", "{{cl.res.company}}"),
        reviewRow("Approval", "Second administrator", "cl.res.status == 'waiting'"),
        button("Back to limits", [{ type: "navigate", toJourney: "admin" }]),
      ],
    },
    {
      // a change is already waiting for this setting: said on a screen of its own, with the way back
      id: "blocked", title: "Review",
      blocks: [text("We can’t do this", "title"), alert("error", "{{ctx.error.message}}"), button("Back", [set("ctx.error", null), go("amount")]), button("Close", [{ type: "exit" }], "ghost")],
    },
    lockedScreen("change", "Nothing was changed."),
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({
    title: "Change limits", effects: ["change"], timeoutText: "We didn’t get an answer in time. Check the Admin tab before you try again, so it isn’t done twice.",
    retry: [["otpSend", "review"], ["change", "review"]],
    routes: [[is(...FIELD), "amount"], [is("CHANGE_PENDING"), "blocked"], [is("INVALID_SETTING"), "which"]],
    unavailable: "Nothing was changed.",
  });
  return base.filter((s) => s.id !== "denied").concat([denyScreen("Change limits", "change limits")]);
}
