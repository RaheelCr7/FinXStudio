import type { Journey, Screen } from "../schema";
import { contactSupportAcceptance, contactSupportScenarios } from "./contact-support-tests";
import { alert, answerRules, button, downScreens, go, note, route, set, text, weekRows } from "./public-kit";

const TOPICS = ["Accounts", "Cards", "Payments", "Loans and savings", "Online and app banking", "Something else"];
const err = (e: string) => `cs.err == '${e}'`;
/** The ways the bank offers, which of them are open now, and the opening hours of the line: the bank works them out from its hours and its clock. */
const HOURS_INPUT = { allowChat: "{{opt.allowChat != false}}", allowCall: "{{opt.allowCall != false}}", secureMessages: "{{opt.secureMessages != false}}" };
/** What a person wrote is kept only until the bank has it: the text is cleared once it was sent, and the bank itself keeps a masked address and a count, never the words. */
const NOTHING_SENT = "We couldn’t send that. Nothing was sent. Try again in a few minutes.";

/**
 * Contact us (BankWorkx, Public: before sign-in). Three ways to reach the bank, each with its own opening hours: Chat (a topic and a question, then the queue), Call (the hours and the
 * dialer) and Message (a topic, an email and a message, answered within one working day). The chip of each way is worked out by the bank from its hours and its clock. No one has to be
 * signed in; a signed-in person can also use the secure messages. What is written is data: shown as text, never kept by the bank beyond a masked address and a count.
 *
 * Built from the spec of the prototype with the blocks FinX has: the ways are tiles with the chip and the hours in their line (the engine has no card block); the engine has no link
 * action, so Call shows the hours and the result says the phone will open the dialer. A closed way can still be chosen (the spec's open point). The message screen is called
 * "Write to us" because "Send us a message" is the name of the secure-messages button on it.
 */
export const contactSupport: Journey = {
  id: "jrn_bankworkx_contact_support",
  slug: "contact-support",
  name: "Contact us",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: contactSupportAcceptance,
  scenarios: contactSupportScenarios,
  dataModel: {
    "launch.way": { type: "string" },
    "opt.allowChat": { type: "boolean" },
    "opt.allowCall": { type: "boolean" },
    "opt.secureMessages": { type: "boolean" },
    "cs.way": { type: "string", required: true },
    "cs.topic": { type: "string", required: true },
    "cs.text": { type: "string", required: true },
    "cs.email": { type: "string", required: true, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
    "cs.err": { type: "string" },
    "cs.msg": { type: "string" },
  },
  integrations: [
    { id: "hours", adapter: "bank.support.hours", mode: "sandbox" },
    { id: "openChat", adapter: "bank.support.openChat", mode: "sandbox" },
    { id: "sendMessage", adapter: "bank.support.sendMessage", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Contact us", kind: "branch",
      onEnter: [
        set("cs.err", ""), set("cs.msg", ""), set("cs.topic", ""), set("cs.text", ""), set("cs.email", ""), set("ctx.error", null),
        { type: "callApi", integration: "hours", input: HOURS_INPUT, saveAs: "cs.hours", onError: { navigate: "fail" } },
        set("cs.way", "{{has(cs.hours.choices, launch.way) ? launch.way : ''}}"),
        go("way"),
      ],
      blocks: [],
    },
    {
      id: "way", title: "Contact us",
      blocks: [
        text("Contact us", "title"),
        text("How would you like to reach us?", "body"),
        alert("error", "{{cs.msg}}", "!isEmpty(cs.err)"),
        { type: "select", bind: "cs.way", label: "Way to reach us", variant: "tiles", source: "cs.hours.choices" },
        button("Continue", [{ type: "validate" }, set("cs.err", ""), { type: "navigate" }]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
      navigation: route(["cs.way == 'chat'", "chat"], ["cs.way == 'call'", "call"], ["cs.way == 'message'", "message"]),
    },
    {
      id: "chat", title: "Chat",
      blocks: [
        text("Chat", "title"),
        alert("error", "{{cs.msg}}", "!isEmpty(cs.err)"),
        { type: "select", bind: "cs.topic", label: "What is it about?", variant: "dropdown", options: TOPICS },
        { type: "textInput", bind: "cs.text", label: "Your question", placeholder: "Tell us a little", lines: 4, pattern: "^[\\s\\S]{5,300}$", patternMessage: "Write a few words so we can help." },
        button("Start chat", [
          { type: "validate" }, set("cs.err", ""),
          { type: "callApi", integration: "openChat", input: { topic: "{{cs.topic}}", text: "{{cs.text}}", allowChat: "{{opt.allowChat != false}}" }, saveAs: "cs.res", onError: { navigate: "fail" } },
          // the bank has the question: the journey keeps the topic for the result, not the words
          set("cs.text", ""), go("chatDone"),
        ]),
        button("Back", [go("way")], "ghost"),
      ],
    },
    {
      id: "call", title: "Call us",
      blocks: [
        text("Call us", "title"),
        text("Opening hours", "title"),
        { type: "reviewSummary", rows: weekRows("cs.hours.callHours") },
        button("Call us", [go("callDone")]),
        button("Back", [go("way")], "ghost"),
      ],
    },
    {
      id: "message", title: "Write to us",
      blocks: [
        text("Write to us", "title"),
        alert("error", "{{cs.msg}}", "!isEmpty(cs.err)"),
        { type: "select", bind: "cs.topic", label: "What is it about?", variant: "dropdown", options: TOPICS },
        { type: "textInput", bind: "cs.email", label: "Your email", placeholder: "name@example.com", keyboard: "email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", patternMessage: "Enter a valid email address." },
        { type: "textInput", bind: "cs.text", label: "Your message", placeholder: "How can we help?", lines: 5, pattern: "^[\\s\\S]{10,1000}$", patternMessage: "Write at least 10 characters." },
        note("{{len(cs.text)}} of 1000"),
        button("Send", [
          { type: "validate" }, set("cs.err", ""),
          { type: "callApi", integration: "sendMessage", input: { topic: "{{cs.topic}}", email: "{{cs.email}}", text: "{{cs.text}}" }, saveAs: "cs.res", onError: { navigate: "fail" } },
          set("cs.text", ""), go("messageDone"),
        ]),
        button("Send us a message", [{ type: "navigate", toJourney: "new-message" }], "secondary", "cs.hours.secure && has(session.permissions, 'messages.send')"),
        button("Back", [go("way")], "ghost"),
      ],
    },
    {
      id: "chatDone", title: "You’re in the queue", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "You’re in the queue", text: "An adviser will join in about 2 minutes.", meta: "Reference {{cs.res.reference}}" },
        { type: "statusChip", status: "waiting", label: "Waiting", tone: "warning" },
        { type: "reviewSummary", rows: [{ label: "Topic", value: "{{cs.topic}}" }] },
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "callDone", title: "Calling the bank", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Calling the bank", text: "Your phone will open the dialer.", meta: "Reference {{cs.hours.callReference}}" },
        { type: "reviewSummary", rows: [{ label: "Opening hours", value: "{{cs.hours.callSummary}}" }] },
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "messageDone", title: "Message sent", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Message sent", text: "We’ll reply to {{cs.email}} within 1 working day.", meta: "Reference {{cs.res.reference}}" },
        { type: "statusChip", status: "received", label: "Received", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Topic", value: "{{cs.topic}}" }, { label: "Reply to", value: "{{cs.email}}" }] },
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      // what the person can fix is a message on the form (the words stay); the rest has its screen
      id: "fail", title: "Contact us", kind: "branch",
      onEnter: [
        set("cs.msg", "{{ctx.error.message}}"),
        set("cs.err", "{{ctx.error.code != 'TIMEOUT' && ctx.error.code != 'SERVICE_UNAVAILABLE' ? ctx.error.code : ''}}"),
        go("way"),
      ],
      navigation: route(...answerRules, ["ctx.error.code == 'RATE_LIMITED'", "limited"]),
      blocks: [],
    },
    {
      id: "limited", title: "Message not sent", kind: "terminal",
      blocks: [{ type: "result", tone: "error", title: "Too many messages", text: "You’ve sent a lot of messages. Try again later." }, button("Back", [go("way")]), button("Close", [{ type: "exit" }], "secondary")],
    },
    ...downScreens({
      retry: [["cs.way == 'chat'", "chat"], ["cs.way == 'message'", "message"], ["true", "start"]],
      unavailable: { title: "We couldn’t send that", text: NOTHING_SENT },
      timeout: { text: "This is taking longer than expected. Nothing was sent." },
    }),
  ] as Screen[],
};
