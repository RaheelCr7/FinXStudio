import type { Journey, Screen } from "../schema";
import { newMessageAcceptance, newMessageScenarios } from "./new-message-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./more-kit";

const TOPICS = ["Account", "Cards", "Payments", "Fraud or security", "Feedback", "Something else"];
const FRAUD = "Fraud or security";
const DOWN = { title: "We couldn’t send it", text: "We couldn’t send it. Nothing was sent. Try again in a few minutes." };
/** A topic passed in, as the list has it ("security" is what the shell's This wasn't me button passes); anything else is left for the person to choose. */
const topicFrom = `{{${[...TOPICS.map((t) => `launch.topic == '${t}' ? '${t}'`), "launch.topic == 'security' || launch.topic == 'fraud' ? 'Fraud or security'", "''"].join(" : ")}}}`;

/**
 * New message (BankWorkx, Personal: More). Sends a secure message to the bank with a topic, a subject, the text and, when the bank allows it, one file (PDF, JPG or PNG up to 5 MB).
 * It moves no money and asks for no code; the reply arrives in the `messages` view. What the person writes is kept and shown as text, never as markup. The bank applies every rule
 * (the topic, the lengths, the file) and its words are what a refusal shows.
 *
 * Built from the spec of the prototype with the blocks FinX has: the text box is a field of several lines with the hint beside it, a refusal of the file shows above the form with a
 * button to remove it (the engine has no message under one field from the bank), and the file is kept as a name and a size.
 */
export const newMessage: Journey = {
  id: "jrn_bankworkx_new_message",
  slug: "new-message",
  name: "New message",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: newMessageAcceptance,
  scenarios: newMessageScenarios,
  dataModel: {
    "launch.topic": { type: "string" },
    "launch.subject": { type: "string" },
    "launch.accountId": { type: "string" },
    "opt.allowFile": { type: "boolean" },
    "nm.topic": { type: "string", required: true },
    "nm.subject": { type: "string", required: true },
    "nm.text": { type: "string", required: true },
    "nm.file": { type: "string" },
    "nm.err": { type: "string" },
    "nm.msg": { type: "string" },
  },
  integrations: [{ id: "send", adapter: "bank.messages.send", mode: "sandbox" }],
  screens: [
    {
      id: "start", title: "New message", kind: "branch",
      onEnter: [set("nm.err", ""), set("nm.msg", ""), set("nm.text", ""), set("nm.file", null), set("ctx.error", null), set("nm.topic", topicFrom), set("nm.subject", "{{launch.subject}}"), go("write")],
      navigation: route([lacks("messages.send"), "denied"]),
      blocks: [],
    },
    {
      id: "write", title: "New message",
      blocks: [
        text("New message", "title"),
        alert("error", "{{nm.msg}}", "nm.err == 'rule' || nm.err == 'file'"),
        alert("error", "Remove the file that can’t be sent.", "nm.err == 'file'"),
        { type: "select", bind: "nm.topic", label: "Topic", options: TOPICS, variant: "dropdown" },
        alert("warning", "If someone has used your account, call us now. Messages are read within one business day.", `nm.topic == '${FRAUD}'`),
        { type: "textInput", bind: "nm.subject", label: "Subject", placeholder: "What is it about?", pattern: "^[\\s\\S]{3,80}$", patternMessage: "Use at least 3 characters." },
        { type: "textInput", bind: "nm.text", label: "Message", placeholder: "Write your message", lines: 5, pattern: "^[\\s\\S]{10,1000}$", patternMessage: "Write at least 10 characters." },
        text("Don’t include passwords, codes or full card numbers.", "caption"),
        { type: "fileUpload", bind: "nm.file", label: "Attachment (optional)", accept: ["pdf", "image"], maxKb: 5120, helper: "Add a PDF, JPG or PNG", visibleWhen: "opt.allowFile != false" },
        button("Remove the file", [set("nm.file", null), set("nm.err", ""), set("nm.msg", "")], "secondary", "nm.err == 'file'"),
        button("Send", [
          { type: "validate" }, set("nm.err", ""),
          {
            type: "callApi", integration: "send", saveAs: "nm.res", onError: { navigate: "fail" },
            input: { topic: "{{nm.topic}}", subject: "{{nm.subject}}", text: "{{nm.text}}", fileName: "{{isEmpty(nm.file) ? '' : nm.file.name}}", fileSize: "{{isEmpty(nm.file) ? 0 : nm.file.size}}", allowFile: "{{opt.allowFile != false}}", accountId: "{{launch.accountId}}" },
          },
          // the bank has it: the journey keeps what it needs for the result, not the text
          set("nm.text", ""), set("nm.file", null), go("done"),
        ]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "done", title: "Message sent", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Message sent", text: "We usually reply within 1 business day." },
        { type: "reviewSummary", rows: [{ label: "Topic", value: "{{nm.topic}}" }, { label: "Subject", value: "{{nm.subject}}" }] },
        button("Go to messages", [{ type: "navigate", toJourney: "messages" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: what the person can fix shows on the form (the text stays), no answer has its own screen
      id: "fail", title: "New message", kind: "branch",
      onEnter: [
        set("nm.msg", "{{ctx.error.message}}"),
        set("nm.err", "{{ctx.error.code == 'FILE_TOO_LARGE' || ctx.error.code == 'FILE_TYPE' || ctx.error.code == 'FILE_NOT_ALLOWED' ? 'file' : ctx.error.code == 'TOPIC_INVALID' || ctx.error.code == 'SUBJECT_INVALID' || ctx.error.code == 'TEXT_INVALID' ? 'rule' : ''}}"),
        go("problem"),
      ],
      navigation: route(["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["nm.err != ''", "write"]),
      blocks: [],
    },
    ...answerScreens("write", "sent", DOWN),
    {
      id: "problem", title: "New message", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t send it", text: "Something went wrong. Nothing was sent." },
        button("Try again", [go("write")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("New message"),
  ] as Screen[],
};
