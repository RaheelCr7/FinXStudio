import type { Journey, Screen } from "../schema";
import { adminAcceptance, adminScenarios } from "./admin-tests";
import { alert, button, denyScreen, failScreens, go, lockOnWrongCode, lockedScreen, route, set, text } from "./business-kit";

const STATUSES = { active: { label: "Active", tone: "positive" as const }, invited: { label: "Invited", tone: "info" as const }, disabled: { label: "Disabled", tone: "neutral" as const }, change: { label: "Change waiting", tone: "warning" as const }, waiting: { label: "Waiting for approval", tone: "warning" as const } };
const RESULTS = { done: { label: "Done", tone: "positive" as const }, waiting: { label: "Waiting", tone: "warning" as const }, refused: { label: "Refused", tone: "negative" as const } };
const TAB = (t: string) => `ad.tab == '${t}'`;
const KNOWN = "has(ctx.ad.waiting, ad.id)";
const PERSON = "has(ctx.ad.people, ad.id)";
const PREVIEWING = "ctx.pv.on == true";
const reviewRow = (label: string, value: string, visibleWhen?: string) => ({ type: "reviewSummary" as const, ...(visibleWhen ? { visibleWhen } : {}), rows: [{ label, value }] });
const groupCard = (key: "over" | "upto") => [
  text(`{{ctx.ad.groups.${key}.title}}`, "title", TAB("groups")), text(`{{ctx.ad.groups.${key}.line}}`, "body", TAB("groups")),
  button("Edit group", [{ type: "navigate", toJourney: "edit-signatory-group", with: { "launch.group": key } }], "secondary", TAB("groups")),
];

/**
 * Admin (BankWorkx Business, Admin). A view: who can act at the company, the limits in force, the approval groups and the activity log; the three admin journeys start from it, and a second
 * administrator approves or declines a change another administrator sent. A person without the admin permission sees "You don’t have access" and a button to preview as the company's administrator
 * (a prototype device of the spec: Alex Morgan is never an administrator himself; the preview ends when he exits it or switches company). The bank decides everything: the first call is refused without
 * the permission, nobody decides their own change, and approving a change asks for the one-time code.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): a waiting change and a person open a card with Approve and Decline, or Edit, Disable and Enable (a table row has no buttons of its
 * own), the sections are chips, the answer to Approve or Decline is a line at the top (the engine drops a toast when the screen changes), and the code is asked on Approve (the spec plans it).
 */
export const admin: Journey = {
  id: "jrn_admin",
  slug: "admin",
  name: "Admin",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: adminAcceptance,
  scenarios: adminScenarios,
  dataModel: { "opt.showLog": { type: "boolean" }, "ad.tab": { type: "string" }, "ad.id": { type: "string" }, "ad.msg": { type: "string" }, "otp.code": { type: "string", pattern: "^[0-9]{6}$" } },
  integrations: [
    { id: "info", adapter: "bank.session.preview", mode: "sandbox" },
    { id: "view", adapter: "corp.admin.get", mode: "sandbox" },
    { id: "preview", adapter: "bank.session.preview", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "decide", adapter: "corp.changes.decide", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Admin", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.ad", null), set("otp.code", ""), set("ad.tab", "{{isEmpty(ad.tab) ? 'people' : ad.tab}}"),
        { type: "callApi", integration: "info", saveAs: "ctx.pv", onError: { navigate: "route" } },
        { type: "callApi", integration: "view", input: { log: "{{opt.showLog != false}}" }, saveAs: "ctx.ad", onError: { navigate: "route" } },
        go("main"),
      ],
      blocks: [],
    },
    {
      id: "route", title: "One moment", kind: "branch", onEnter: [go("failed")],
      navigation: route(
        ["ctx.error.code == 'PERMISSION_DENIED'", "noaccess"], ["ctx.error.code == 'TIMEOUT' && ctx.error.integration == 'decide'", "timeout"], ["ctx.error.code == 'TIMEOUT'", "slow"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["ctx.error.code == 'WRONG_CONTEXT'", "denied"],
        ["ctx.error.code == 'CHANGE_NOT_FOUND' || ctx.error.code == 'SELF_APPROVAL'", "blocked"],
      ),
      blocks: [],
    },
    {
      id: "noaccess", title: "You don’t have access", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You don’t have access", text: "Only administrators can manage people and limits." },
        button("Preview as {{ctx.pv.name}} (administrator)", [
          set("ctx.error", null),
          { type: "callApi", integration: "preview", input: { on: true }, saveAs: "ctx.pv", onError: { navigate: "route" } },
          go("start"),
        ], "primary", "!isEmpty(ctx.pv.name)"),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "main", title: "Admin",
      blocks: [
        text("Previewing as {{ctx.ad.me.name}}, an administrator.", "body", PREVIEWING),
        button("Exit", [{ type: "callApi", integration: "preview", input: { on: false }, saveAs: "ctx.pv", onError: { navigate: "route" } }, set("ad.msg", ""), go("start")], "ghost", PREVIEWING),
        text("Admin", "title"),
        alert("success", "{{ad.msg}}", "!isEmpty(ad.msg)"),
        text("Waiting for a second administrator", "title", "ctx.ad.waitingCount > 0"),
        { type: "menu", visibleWhen: "ctx.ad.waitingCount > 0", source: "ctx.ad.waiting", item: { label: "{{item.text}}", text: "{{item.sent}}", actions: [set("ad.id", "{{item.id}}"), set("ad.msg", ""), go("change")] } },
        { type: "select", bind: "ad.tab", label: "Section", variant: "chips", visibleWhen: "opt.showLog != false", choices: [{ id: "people", label: "People" }, { id: "limits", label: "Limits" }, { id: "groups", label: "Approval groups" }, { id: "log", label: "Activity log" }] },
        { type: "select", bind: "ad.tab", label: "Section", variant: "chips", visibleWhen: "opt.showLog == false", choices: [{ id: "people", label: "People" }, { id: "limits", label: "Limits" }, { id: "groups", label: "Approval groups" }] },
        button("Invite user", [{ type: "navigate", toJourney: "manage-user", with: { "launch.mode": "invite" } }], "primary", TAB("people")),
        {
          type: "dataTable", source: "ctx.ad.people", label: "People", visibleWhen: TAB("people"),
          columns: [
            { key: "label", label: "Person" }, { key: "roleText", label: "Role" }, { key: "limitText", label: "Daily limit" }, { key: "statusKey", label: "Status", type: "status", statuses: STATUSES },
          ],
          onRowPress: [set("ad.id", "{{item.id}}"), go("person")],
        },
        reviewRow("Limit per person", "{{ctx.ad.limitRows[0].value}}", TAB("limits")), reviewRow("Company daily limit", "{{ctx.ad.limitRows[1].value}}", TAB("limits")), reviewRow("Ceiling set by the bank", "{{ctx.ad.limitRows[2].value}}", TAB("limits")),
        reviewRow("Two approvers above", "{{ctx.ad.limitRows[3].value}}", TAB("limits")), reviewRow("Extra code from", "{{ctx.ad.limitRows[4].value}}", TAB("limits")),
        button("Change limits", [{ type: "navigate", toJourney: "change-limits" }], "primary", TAB("limits")),
        ...groupCard("over"), ...groupCard("upto"),
        {
          type: "dataTable", source: "ctx.ad.log", label: "Activity log", visibleWhen: `${TAB("log")} && opt.showLog != false`,
          columns: [{ key: "when", label: "When" }, { key: "who", label: "Who" }, { key: "what", label: "What" }, { key: "resultKey", label: "Result", type: "status", statuses: RESULTS }],
        },
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "person", title: "Person",
      blocks: [
        text("{{ctx.ad.people[ad.id].label}}", "title", PERSON), text("We can’t find that person.", "title", `!(${PERSON})`),
        reviewRow("Role", "{{ctx.ad.people[ad.id].roleText}}", PERSON), reviewRow("Daily limit", "{{ctx.ad.people[ad.id].limitText}}", PERSON), reviewRow("Status", "{{ctx.ad.people[ad.id].statusText}}", PERSON),
        button("Edit", [{ type: "navigate", toJourney: "manage-user", with: { "launch.mode": "edit", "launch.userId": "{{ad.id}}" } }], "primary", `${PERSON} && ctx.ad.people[ad.id].canEdit`),
        button("Disable", [{ type: "navigate", toJourney: "manage-user", with: { "launch.mode": "disable", "launch.userId": "{{ad.id}}" } }], "secondary", `${PERSON} && ctx.ad.people[ad.id].canDisable`),
        button("Enable", [{ type: "navigate", toJourney: "manage-user", with: { "launch.mode": "enable", "launch.userId": "{{ad.id}}" } }], "primary", `${PERSON} && ctx.ad.people[ad.id].canEnable`),
        button("Back", [go("main")], "ghost"),
      ],
    },
    {
      id: "change", title: "Waiting for a second administrator",
      blocks: [
        text("{{ctx.ad.waiting[ad.id].text}}", "title", KNOWN), text("We can’t find that change.", "title", `!(${KNOWN})`),
        text("{{ctx.ad.waiting[ad.id].sent}}", "caption", KNOWN),
        { type: "statusChip", status: "waiting", label: "Waiting for another administrator", tone: "warning", visibleWhen: `${KNOWN} && ctx.ad.waiting[ad.id].mine` },
        button("Approve", [set("ctx.error", null), set("otp.code", ""), { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } }, go("otp")], "primary", `${KNOWN} && ctx.ad.waiting[ad.id].canDecide`),
        button("Decline", [
          set("ctx.error", null),
          { type: "callApi", integration: "decide", input: { changeId: "{{ad.id}}", decision: "decline" }, saveAs: "ctx.dec", onError: { navigate: "route" } },
          set("ad.msg", "{{ctx.dec.message}}"), go("start"),
        ], "secondary", `${KNOWN} && ctx.ad.waiting[ad.id].canDecide`),
        button("Back", [go("main")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Approve {{ctx.ad.waiting[ad.id].text}}", "title"), text("It only works for this change.", "caption"),
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true, hint: "Code sent to {{ctx.otp.maskedPhone}}.", onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } }] },
        button("Approve", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "decide", input: { changeId: "{{ad.id}}", decision: "approve" }, saveAs: "ctx.dec", onError: { navigate: "route" } },
          set("otp.code", ""), set("ad.msg", "{{ctx.dec.message}}"), go("start"),
        ]),
      ],
    },
    {
      id: "blocked", title: "Admin", kind: "terminal",
      blocks: [text("We can’t do this", "title"), alert("error", "{{ctx.error.message}}"), button("Back", [set("ctx.error", null), go("start")]), button("Close", [{ type: "exit" }], "ghost")],
    },
    lockedScreen("change", "Nothing was changed."),
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({
    title: "Admin", effects: ["decide"], timeoutText: "We didn’t get an answer in time. Check the Admin tab before you try again, so it isn’t done twice.",
    retry: [["otpSend", "main"], ["decide", "main"]], unavailable: "Nothing was changed.",
  });
  return base.filter((s) => !["denied", "route"].includes(s.id)).concat([denyScreen("Admin", "see this")]);
}
