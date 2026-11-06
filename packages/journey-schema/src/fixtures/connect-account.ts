import type { Journey, Screen } from "../schema";
import { connectAccountAcceptance, connectAccountScenarios } from "./connect-account-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./more-kit";

const DOWN = { title: "We couldn’t reach the bank", text: "We couldn’t reach the bank. Nothing was connected." };
const REMOVING = "!isEmpty(cx.removeId)";
const toggle = (n: number) => ({ type: "toggle" as const, bind: `cx.on${n}`, label: `{{ctx.cx.label${n}}}`, helper: `{{ctx.cx.balance${n}}}`, visibleWhen: `ctx.cx.count >= ${n}` });
const wipe = [set("cx.on1", false), set("cx.on2", false), set("cx.on3", false)];

/**
 * Connect a bank (BankWorkx, Personal: More). Lets BankWorkx read accounts held at another bank, and only read: choose the bank, agree to share, allow it on the other bank's own secure
 * sign-in (the person never types that bank's password here), choose the accounts. The sharing ends after the period of the bank's home market and the accounts are listed as read only:
 * none is ever one to pay from. A connected bank can be disconnected after a confirmation. It moves no money. The bank decides what it will connect: it asks for the agreement, refuses a bank
 * that is not answering or already connected, and needs at least one account.
 *
 * Built from the spec of the prototype with the blocks FinX has: the accounts of a bank are up to three switches, one per account (the engine has no list of switches that follows the bank's
 * answer), the confirmation of a disconnect sits under the row on the same screen, and the other bank's sign-in is the step "Allow" or "Deny" (a real redirect cannot run in a browser or the sandbox).
 * This replaces the older journey that asked for the other bank's username and password.
 */
export const connectAccount: Journey = {
  id: "jrn_connect_account",
  slug: "connect-account",
  name: "Connect a bank",
  version: 2,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: connectAccountAcceptance,
  scenarios: connectAccountScenarios,
  dataModel: {
    "launch.bank": { type: "string" },
    "opt.allowCards": { type: "boolean" },
    "cx.bankId": { type: "string", required: true },
    "cx.bankName": { type: "string" },
    "cx.consent": { type: "boolean", required: true },
    "cx.on1": { type: "boolean" },
    "cx.on2": { type: "boolean" },
    "cx.on3": { type: "boolean" },
    "cx.removeId": { type: "string" },
    "cx.removeName": { type: "string" },
    "cx.at": { type: "string" },
    "cx.err": { type: "string" },
    "cx.msg": { type: "string" },
  },
  integrations: [
    { id: "banks", adapter: "bank.connections.banks", mode: "sandbox" },
    { id: "start", adapter: "bank.connections.start", mode: "sandbox" },
    { id: "finish", adapter: "bank.connections.finish", mode: "sandbox" },
    { id: "remove", adapter: "bank.connections.remove", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Connect a bank", kind: "branch",
      onEnter: [
        ...wipe, set("cx.consent", false), set("cx.err", ""), set("cx.msg", ""), set("cx.at", ""), set("cx.removeId", ""), set("ctx.error", null),
        { type: "callApi", integration: "banks", saveAs: "ctx.b", onError: { navigate: "loadFail" } },
        // a bank passed in (a link with bank = maple) is chosen, and still confirmed with Continue
        set("cx.bankId", "{{has(ctx.b.banks, launch.bank) ? launch.bank : ''}}"),
        go("bank"),
      ],
      navigation: route([lacks("accounts.manage"), "denied"]),
      blocks: [],
    },
    {
      id: "bank", title: "Connect a bank",
      blocks: [
        text("Connect a bank", "title"),
        text("See your accounts from another bank here.", "body"),
        alert("error", "{{cx.msg}}", "!isEmpty(cx.msg)"),
        { type: "sectionHeader", title: "Connected", visibleWhen: "ctx.b.connectedCount > 0" },
        {
          type: "menu", source: "ctx.b.connected", visibleWhen: "ctx.b.connectedCount > 0",
          item: { label: "Disconnect {{item.bank}}", text: "{{item.line}}", icon: "bank", actions: [set("cx.removeId", "{{item.id}}"), set("cx.removeName", "{{item.bank}}"), set("cx.msg", "")] },
        },
        // a row turns into a question: Disconnect {bank}? Its accounts leave your list.
        text("Disconnect {{cx.removeName}}?", "title", REMOVING),
        text("Its accounts leave your list.", "body", REMOVING),
        button("Disconnect", [
          { type: "callApi", integration: "remove", input: { bankId: "{{cx.removeId}}" }, onError: { navigate: "removeFail" } },
          set("cx.removeId", ""), { type: "callApi", integration: "banks", saveAs: "ctx.b", onError: { navigate: "loadFail" } }, { type: "showToast", text: "Bank disconnected" },
        ], "primary", REMOVING),
        button("Keep", [set("cx.removeId", "")], "ghost", REMOVING),
        { type: "select", bind: "cx.bankId", label: "Your bank", source: "ctx.b.banks", variant: "rows", visibleWhen: `!${REMOVING}` },
        button("Continue", [{ type: "validate" }, set("cx.msg", ""), set("cx.bankName", "{{ctx.b.banks[cx.bankId].name}}"), go("consent")], "primary", `!${REMOVING}`),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "consent", title: "Share your accounts",
      blocks: [
        text("Share your accounts", "title"),
        text("{{cx.bankName}} will share with BankWorkx®", "body"),
        text("✓ Account names and last 4 digits", "body"),
        text("✓ Balances", "body"),
        text("✓ Transactions from the last 12 months", "body"),
        text("Until {{ctx.b.untilText}}", "title"),
        text("You can stop sharing at any time from Accounts. We can only read. We can’t move money.", "caption"),
        { type: "consent", bind: "cx.consent", termsVersion: "connect-v2", text: "I agree to share this information", validation: { mustBeTrue: true, messages: { mustBeTrue: "Agree to continue." } } },
        alert("error", "{{cx.msg}}", "!isEmpty(cx.msg)"),
        button("Continue", [{ type: "validate" }, set("cx.msg", ""), go("signin")]),
        button("Back", [set("cx.msg", ""), go("bank")], "ghost"),
      ],
    },
    {
      // the other bank's own sign-in: BankWorkx never sees a password
      id: "signin", title: "Sign in at your bank",
      blocks: [
        text("Sign in at your bank", "title"),
        text("{{cx.bankName}}", "body"),
        text("Secure sign-in", "caption"),
        text("BankWorkx® wants to read your accounts.", "body"),
        text("You’re signed in at {{cx.bankName}}.", "body"),
        button("Allow", [
          set("cx.at", "signin"),
          { type: "callApi", integration: "start", input: { bankId: "{{cx.bankId}}", allowCards: "{{opt.allowCards != false}}" }, saveAs: "ctx.cx", onError: { navigate: "fail" } },
          ...wipe, set("cx.on1", true), set("cx.on2", true), set("cx.on3", true), set("cx.msg", ""), go("accounts"),
        ]),
        button("Deny", [go("refused")], "secondary"),
        button("Back", [go("consent")], "ghost"),
      ],
    },
    {
      id: "accounts", title: "Choose accounts",
      blocks: [
        text("Choose accounts", "title"),
        text("{{cx.bankName}}", "caption"),
        alert("error", "{{cx.msg}}", "!isEmpty(cx.msg)"),
        toggle(1), toggle(2), toggle(3),
        button("Connect", [
          set("cx.at", "accounts"), set("cx.msg", ""),
          {
            type: "callApi", integration: "finish", saveAs: "cx.res", onError: { navigate: "fail" },
            input: { state: "{{ctx.cx.state}}", consent: "{{cx.consent}}", pick1: "{{cx.on1}}", pick2: "{{cx.on2}}", pick3: "{{cx.on3}}" },
          },
          go("done"),
        ]),
        button("Back", [set("cx.msg", ""), go("signin")], "ghost"),
      ],
    },
    {
      id: "done", title: "Bank connected", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Bank connected", text: "Its accounts are on your Accounts tab, read only." },
        { type: "reviewSummary", rows: [{ label: "Bank", value: "{{cx.res.bank}}" }, { label: "Accounts", value: "{{cx.res.accounts}}" }, { label: "Shared until", value: "{{cx.res.untilText}}" }] },
        button("See accounts", [{ type: "navigate", toJourney: "accounts" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "refused", title: "Access was not allowed", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Access was not allowed", text: "Access was not allowed. Nothing was connected." },
        button("Back to start", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "unreachable", title: "Not answering", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "That bank isn’t answering", text: "That bank isn’t answering right now. Nothing was connected. Try again later." },
        button("Choose another bank", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // a disconnect that did not go through: the bank is still connected, and the person is told
      id: "removeFail", title: "Connect a bank", kind: "branch",
      onEnter: [
        set("cx.removeId", ""),
        set("cx.msg", "{{ctx.error.code == 'LINK_NOT_FOUND' ? 'This bank isn’t connected.' : ctx.error.code == 'TIMEOUT' ? 'This is taking longer than expected. Nothing was changed.' : 'This isn’t available right now. Nothing was changed. Try again in a few minutes.'}}"),
        go("bank"),
      ],
      blocks: [],
    },
    {
      // where a refusal goes: the bank's words on the screen of the step, a bank that is not answering and a refusal have their own screens
      id: "fail", title: "Connect a bank", kind: "branch",
      onEnter: [
        set("cx.msg", "{{ctx.error.message}}"),
        go("again"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["ctx.error.code == 'BANK_UNAVAILABLE'", "unreachable"],
        ["ctx.error.code == 'ALREADY_CONNECTED'", "bank"], ["ctx.error.code == 'CONSENT_REQUIRED'", "consent"], ["ctx.error.code == 'STATE_INVALID'", "bank"],
      ),
      blocks: [],
    },
    {
      // Try again goes back to the step that was being sent
      id: "again", title: "Connect a bank", kind: "branch",
      onEnter: [go("signin")],
      navigation: route(["cx.at == 'accounts'", "accounts"]),
      blocks: [],
    },
    ...answerScreens("again", "connected", DOWN),
    {
      id: "loadFail", title: "Connect a bank",
      blocks: [
        text("We couldn’t reach the bank", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("This isn’t available right now. Nothing was changed. Try again in a few minutes.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Connect a bank"),
  ] as Screen[],
};
