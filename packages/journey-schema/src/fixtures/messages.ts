import type { Journey, Screen } from "../schema";
import { messagesAcceptance, messagesScenarios } from "./messages-tests";
import { alert, button, denied, go, holds, lacks, route, set, text } from "./more-kit";

const SEND = holds("messages.send");
const CLOSED = "ctx.thread.closed";
const load = { type: "callApi" as const, integration: "thread", input: { threadId: "{{ms.id}}" }, saveAs: "ctx.thread", onError: { navigate: "loadFail" } };

/**
 * Messages (BankWorkx, Personal: More). A view, not a form: the conversations with the bank, newest activity first, each with its subject, a preview of the latest message, its
 * date and a dot where a bank message is unread. A conversation opens to every message in order (and is marked read), with a box to reply to an open one; a closed one offers a
 * new message instead. What the person and the bank wrote is shown as text, never as markup. Nothing here moves money.
 *
 * Built from the spec of the prototype with the blocks FinX has: the dot is a mark in front of the subject (the engine has no coloured dot), the messages are rows in time order
 * (bank and person are told apart by the name on each, not by the side), a reply cannot carry a file, and the unread count of the Messages row in More is not drawn. The shell's
 * own More tab is unchanged; this journey is the view a bank can switch off.
 */
export const messagesView: Journey = {
  id: "jrn_bankworkx_messages",
  slug: "messages",
  name: "Messages",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: messagesAcceptance,
  scenarios: messagesScenarios,
  dataModel: {
    "ms.id": { type: "string" },
    "ms.reply": { type: "string", required: true, pattern: "^[\\s\\S]*\\S[\\s\\S]*\\S[\\s\\S]*$" },
    "ms.msg": { type: "string" },
  },
  integrations: [
    { id: "threads", adapter: "bank.messages.list", mode: "sandbox" },
    { id: "thread", adapter: "bank.messages.get", mode: "sandbox" },
    { id: "markRead", adapter: "bank.messages.markRead", mode: "sandbox" },
    { id: "reply", adapter: "bank.messages.reply", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Messages", kind: "branch",
      onEnter: [set("ms.msg", ""), set("ms.reply", ""), set("ctx.error", null), { type: "callApi", integration: "threads", saveAs: "ctx.threads", onError: { navigate: "loadFail" } }, go("list")],
      navigation: route([lacks("accounts.view"), "denied"], ["len(ctx.threads) == 0", "empty"]),
      blocks: [],
    },
    {
      id: "list", title: "Messages",
      blocks: [
        text("Messages", "title"),
        button("New message", [{ type: "navigate", toJourney: "new-message" }], "secondary", SEND),
        {
          type: "menu", source: "ctx.threads",
          item: {
            label: "{{item.unread ? '● ' : ''}}{{item.subject}}",
            text: "{{item.unread ? 'Unread · ' : ''}}{{item.preview}} · {{item.dateText}}",
            icon: "mail",
            // opening a conversation reads it and marks it read: a failed mark leaves the dot, the conversation still opens
            actions: [set("ms.id", "{{item.id}}"), set("ms.msg", ""), set("ms.reply", ""), load, { type: "callApi", integration: "markRead", input: { threadId: "{{ms.id}}" }, onError: { navigate: "thread" } }, go("thread")],
          },
        },
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "thread", title: "{{ctx.thread.subject}}",
      blocks: [
        text("{{ctx.thread.topic}} · {{ctx.thread.reference}}", "caption"),
        {
          type: "statusChip", status: "{{ctx.thread.status}}",
          statuses: { Open: { label: "Open", tone: "info" }, Answered: { label: "Answered", tone: "positive" }, Closed: { label: "Closed", tone: "neutral" } },
        },
        { type: "menu", source: "ctx.thread.messages", item: { label: "{{item.who}} · {{item.timeText}}", text: "{{item.text}}{{item.hasFile ? ' · ' + item.fileName : ''}}", icon: "mail", actions: [] } },
        alert("error", "{{ms.msg}}", "!isEmpty(ms.msg)"),
        { type: "textInput", bind: "ms.reply", label: "Reply", placeholder: "Write a reply", lines: 3, pattern: "^[\\s\\S]*\\S[\\s\\S]*\\S[\\s\\S]*$", patternMessage: "Write a message first.", visibleWhen: `!${CLOSED} && ${SEND}` },
        button("Send", [
          set("ms.msg", ""), { type: "validate" },
          { type: "callApi", integration: "reply", input: { threadId: "{{ms.id}}", text: "{{ms.reply}}" }, onError: { navigate: "replyFail" } },
          // the reply is in the thread: the box is cleared and the thread is read again
          set("ms.reply", ""), load, { type: "showToast", text: "Message sent" },
        ], "primary", `!${CLOSED} && ${SEND}`),
        text("This conversation is closed.", "body", CLOSED),
        button("Start a new message", [{ type: "navigate", toJourney: "new-message", with: { "launch.topic": "{{ctx.thread.topic}}", "launch.accountId": "{{ctx.thread.accountId}}" } }], "primary", `${CLOSED} && ${SEND}`),
        button("‹ Messages", [set("ms.reply", ""), set("ms.msg", ""), go("start")], "ghost"),
      ],
    },
    {
      // the reply was refused or the bank did not answer: the thread is as it was and the text stays in the box
      id: "replyFail", title: "Messages", kind: "branch",
      onEnter: [
        set("ms.msg", "{{ctx.error.code == 'THREAD_CLOSED' ? 'This conversation is closed. Start a new message.' : ctx.error.code == 'REPLY_INVALID' ? ctx.error.message : ctx.error.code == 'TIMEOUT' ? 'This is taking longer than expected. Nothing was sent.' : ctx.error.code == 'SERVICE_UNAVAILABLE' ? 'We couldn’t send it. Try again in a few minutes.' : 'Something went wrong. Nothing was sent.'}}"),
        go("thread"),
      ],
      navigation: route(["ctx.error.code == 'THREAD_CLOSED'", "closedNow"]),
      blocks: [],
    },
    // the bank closed the conversation while it was open: it is read again, and shows as closed
    { id: "closedNow", title: "Messages", kind: "branch", onEnter: [{ ...load, onError: { navigate: "thread" } }, go("thread")], blocks: [] },
    {
      id: "empty", title: "Messages",
      blocks: [
        text("No messages", "title"),
        text("Send us a message and we’ll reply here.", "body"),
        button("New message", [{ type: "navigate", toJourney: "new-message" }], "primary", SEND),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "loadFail", title: "Messages",
      blocks: [
        text("We couldn’t load your messages. Nothing was changed.", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("Try again in a few minutes.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Messages"),
  ] as Screen[],
};
