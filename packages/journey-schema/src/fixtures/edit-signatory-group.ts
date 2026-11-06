import type { Journey, Screen } from "../schema";
import { editSignatoryGroupAcceptance, editSignatoryGroupScenarios } from "./edit-signatory-group-tests";
import { alert, button, denyScreen, failScreens, go, is, lockOnWrongCode, lockedScreen, route, set, text } from "./business-kit";

const FIELD = ["INVALID_MODE", "MODE_NOT_ALLOWED", "INVALID_APPROVER", "NO_APPROVERS", "INVALID_NEED", "NOT_ENOUGH_APPROVERS", "SEPARATION", "NO_CHANGE"];
const FORM = {
  group: "{{eg.group}}", mode: "{{eg.mode}}", need: "{{eg.need}}", first: "{{eg.first}}", on1: "{{eg.on1}}", on2: "{{eg.on2}}", on3: "{{eg.on3}}", on4: "{{eg.on4}}", on5: "{{eg.on5}}", on6: "{{eg.on6}}",
  allowSeq: "{{opt.allowSeq != false}}", secondApproval: "{{opt.secondGroup != false}}",
};
const skipped = "eg.skip == true";
const reviewRow = (label: string, value: string, visibleWhen?: string) => ({ type: "reviewSummary" as const, ...(visibleWhen ? { visibleWhen } : {}), rows: [{ label, value }] });
const switchOn = (n: number) => ({ type: "toggle" as const, bind: `eg.on${n}`, label: `{{ctx.g.label${n}}}`, visibleWhen: `ctx.g.count >= ${n}` });
const fill = [
  set("eg.mode", "{{ctx.g.mode}}"), set("eg.need", "{{ctx.g.need >= 2 ? ctx.g.need : 2}}"), set("eg.first", "{{ctx.g.first}}"),
  ...[1, 2, 3, 4, 5, 6].map((n) => set(`eg.on${n}`, `{{ctx.g.current.on${n}}}`)),
];

/** The steps of the progress bar: one fewer when the journey was opened with the first choice made, as the line under it says. */
const STEPPERS = [{ type: "stepper" as const, steps: ["group", "approvers", "review"], visibleWhen: "eg.skip != true" }, { type: "stepper" as const, steps: ["approvers", "review"], visibleWhen: "eg.skip == true" }];

/**
 * Edit an approval group (BankWorkx Business, Admin). An administrator chooses who approves payments in one of the two approval groups ("Payments over 50,000" and "Payments up to 50,000", the amount
 * follows the two-approver limit) and how: any one of them, in order, or several together. It changes who can release money, so the bank decides every rule (the group over the limit needs two approvers,
 * the person who starts payments cannot be the only approver, nobody is counted twice), asks for the one-time code before the change, holds the change for ANOTHER administrator (the option
 * `secondGroup`, on unless a bank turns it off) and leaves the payments that already wait with the approvers they started with. Approving in order is offered while the option `allowSeq` is on.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the live message under the approvers is the bank's answer to Review (shown above the fields), the switches are the first six
 * candidates in the bank's order, "How many must approve" is a row of chips 2 to 6 (the bank refuses a number above the approvers chosen), and the Autofill sample is not built.
 */
export const editSignatoryGroup: Journey = {
  id: "jrn_edit_signatory_group",
  slug: "edit-signatory-group",
  name: "Edit an approval group",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: editSignatoryGroupAcceptance,
  scenarios: editSignatoryGroupScenarios,
  dataModel: {
    "launch.group": { type: "string" }, "launch.mode": { type: "string" }, "launch.need": { type: "number" }, "opt.allowSeq": { type: "boolean" }, "opt.secondGroup": { type: "boolean" },
    "eg.group": { type: "string", required: true }, "eg.skip": { type: "boolean" }, "eg.mode": { type: "string" }, "eg.need": { type: "number" }, "eg.first": { type: "string" },
    "eg.on1": { type: "boolean" }, "eg.on2": { type: "boolean" }, "eg.on3": { type: "boolean" }, "eg.on4": { type: "boolean" }, "eg.on5": { type: "boolean" }, "eg.on6": { type: "boolean" }, "eg.res": { type: "object" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "groups", adapter: "corp.signatories.get", mode: "sandbox" },
    { id: "check", adapter: "corp.signatories.update", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "change", adapter: "corp.signatories.update", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Edit an approval group", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.rv", null), set("eg.res", null), set("otp.code", ""), set("eg.skip", false),
        set("eg.group", "{{launch.group == 'over' || launch.group == 'upto' ? launch.group : ''}}"),
        { type: "callApi", integration: "groups", input: { group: "{{eg.group}}" }, saveAs: "ctx.g", onError: { navigate: "route" } },
        go("pick"),
      ],
      navigation: route(["eg.group == 'over' || eg.group == 'upto'", "skip"]),
      blocks: [],
    },
    {
      // opened with a group: its current mode and approvers, and the first step is skipped
      id: "skip", title: "Edit an approval group", kind: "branch",
      onEnter: [
        set("eg.skip", true), ...fill,
        set("eg.mode", "{{launch.mode == 'any' || launch.mode == 'seq' || launch.mode == 'par' ? launch.mode : ctx.g.mode}}"), set("eg.need", "{{launch.need >= 2 ? launch.need : eg.need}}"),
        go("approvers"),
      ],
      blocks: [],
    },
    {
      id: "pick", title: "Which group?",
      blocks: [
        ...STEPPERS, text("Step 1 of 3 · Edit approval group", "caption"), text("Which group?", "title"),
        alert("error", "Choose a group.", is("INVALID_GROUP")),
        {
          type: "select", bind: "eg.group", label: "Which group?", variant: "tiles",
          choices: [{ id: "over", label: "Over the two-approver limit", text: "{{ctx.g.groups.over.title}} · {{ctx.g.groups.over.line}}" }, { id: "upto", label: "Up to the two-approver limit", text: "{{ctx.g.groups.upto.title}} · {{ctx.g.groups.upto.line}}" }],
        },
        button("Continue", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "groups", input: { group: "{{eg.group}}" }, saveAs: "ctx.g", onError: { navigate: "route" } },
          ...fill, go("approvers"),
        ]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "approvers", title: "Approvers",
      blocks: [
        ...STEPPERS,
        text("Step 2 of 3 · Edit approval group", "caption", `!(${skipped})`), text("Step 1 of 2 · Edit approval group", "caption", skipped),
        text("Approvers: {{ctx.g.title}}", "title"),
        alert("error", "{{ctx.error.message}}", is(...FIELD)),
        {
          type: "select", bind: "eg.mode", label: "How they approve", variant: "chips", visibleWhen: "opt.allowSeq != false",
          choices: [{ id: "any", label: "Any one" }, { id: "seq", label: "In order" }, { id: "par", label: "Several together" }],
        },
        {
          type: "select", bind: "eg.mode", label: "How they approve", variant: "chips", visibleWhen: "opt.allowSeq == false",
          choices: [{ id: "any", label: "Any one" }, { id: "par", label: "Several together" }],
        },
        text("One approver is enough.", "caption", "eg.mode == 'any'"), text("One after another, in the order below.", "caption", "eg.mode == 'seq'"), text("A set number of them approve, in any order.", "caption", "eg.mode == 'par'"),
        {
          type: "select", bind: "eg.need", label: "How many must approve", variant: "chips", visibleWhen: "eg.mode == 'par'",
          choices: [{ id: "2", label: "2" }, { id: "3", label: "3" }, { id: "4", label: "4" }, { id: "5", label: "5" }, { id: "6", label: "6" }],
        },
        text("Approvers", "caption"),
        switchOn(1), switchOn(2), switchOn(3), switchOn(4), switchOn(5), switchOn(6),
        { type: "select", bind: "eg.first", label: "Goes first", variant: "dropdown", source: "ctx.g.candidates", visibleWhen: "eg.mode == 'seq'" },
        button("Review", [
          set("ctx.error", null),
          { type: "callApi", integration: "check", input: { ...FORM, dryRun: true }, saveAs: "ctx.rv", onError: { navigate: "route" } },
          go("review"),
        ]),
        button("Back", [set("ctx.error", null), go("pick")], "ghost", `!(${skipped})`),
        button("Cancel", [{ type: "exit" }], "ghost", skipped),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        ...STEPPERS,
        text("Step 3 of 3 · Edit approval group", "caption", `!(${skipped})`), text("Step 2 of 2 · Edit approval group", "caption", skipped),
        text("Review", "title"),
        reviewRow("Group", "{{ctx.rv.groupTitle}}"), reviewRow("Now", "{{ctx.rv.nowLine}}"), reviewRow("New", "{{ctx.rv.newLine}}"), reviewRow("Takes effect", "{{ctx.rv.effectText}}"),
        reviewRow("Payments waiting", "Keep their current approvers", "ctx.rv.paymentsWaiting > 0"),
        button("Confirm", [
          set("ctx.error", null), set("otp.code", ""),
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } },
          go("otp"),
        ]),
        button("Back", [set("ctx.error", null), go("approvers")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Change {{ctx.rv.lower}}", "title"), text("It only works for this change.", "caption"),
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true, hint: "Code sent to {{ctx.otp.maskedPhone}}.", onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } }] },
        button("Change group", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "change", input: { ...FORM }, saveAs: "eg.res", onError: { navigate: "route" } },
          set("otp.code", ""), go("result"),
        ]),
      ],
    },
    {
      id: "result", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: "Another administrator has to approve this. The current group stays until then.", visibleWhen: "eg.res.status == 'waiting'" },
        { type: "statusChip", status: "waiting", label: "Waiting for approval", tone: "warning", visibleWhen: "eg.res.status == 'waiting'" },
        { type: "result", tone: "success", title: "Group updated", text: "{{eg.res.groupTitle}} now has the new approvers.", visibleWhen: "eg.res.status == 'applied'" },
        { type: "statusChip", status: "applied", label: "Applied", tone: "positive", visibleWhen: "eg.res.status == 'applied'" },
        reviewRow("Group", "{{eg.res.groupTitle}}"), reviewRow("Approvers", "{{eg.res.approversText}}"), reviewRow("How", "{{eg.res.modeText}}"), reviewRow("Company", "{{eg.res.company}}"),
        reviewRow("Approval", "Second administrator", "eg.res.status == 'waiting'"),
        button("Back to groups", [{ type: "navigate", toJourney: "admin" }]),
      ],
    },
    {
      // a change is already waiting for this group: said on a screen of its own, with the way back
      id: "blocked", title: "Review",
      blocks: [text("We can’t do this", "title"), alert("error", "{{ctx.error.message}}"), button("Back", [set("ctx.error", null), go("approvers")]), button("Close", [{ type: "exit" }], "ghost")],
    },
    lockedScreen("change", "Nothing was changed."),
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({
    title: "Edit an approval group", effects: ["change"], timeoutText: "We didn’t get an answer in time. Check the Admin tab before you try again, so it isn’t done twice.",
    retry: [["otpSend", "review"], ["change", "review"]],
    routes: [[is(...FIELD), "approvers"], [is("CHANGE_PENDING"), "blocked"], [is("INVALID_GROUP"), "pick"]],
    unavailable: "Nothing was changed.",
  });
  return base.filter((s) => s.id !== "denied").concat([denyScreen("Edit an approval group", "change approval groups")]);
}
