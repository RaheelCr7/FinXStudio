import type { Journey } from "../schema";

/** What must be true for "New message" to be right. Each is proved by at least one scenario below. */
export const newMessageAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Topic, subject (3 or more characters) and message (10 or more characters) are required before Send works." },
  { id: "AC-2", text: "Choosing \"Fraud or security\" shows the warning to call now." },
  { id: "AC-3", text: "With allowFile on, one PDF, JPG or PNG up to 5 MB can be added; a larger file blocks sending with a message and can be removed; with the option off the field is absent." },
  { id: "AC-4", text: "After sending, the result shows the topic and the subject, the conversation is at the top of the inbox, marked read, and the bank answers it two seconds later." },
  { id: "AC-5", text: "A launch value topic or subject is prefilled." },
  { id: "AC-6", text: "When the bank is unavailable or does not answer in time, nothing is sent and the text is kept." },
  { id: "AC-7", text: "What the person writes is kept and shown as text, never as markup." },
  { id: "AC-8", text: "It needs messages.send, and the bank itself refuses a topic, a text or a file that a screen would not send." },
];

// Alex Morgan on Tuesday 3 November 2026 with his two conversations (thr_card, thr_fee); a new one is thr_3 (MSG-20261103-0008).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const list = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.messages.list", path, equals } });
const thread = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.messages.get", input: { threadId: "thr_3" }, path, equals } });
const inspect = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.more.inspect", path, equals } });
const forced = (input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter: "bank.messages.send", input: { topic: "Account", subject: "Question about my account", text: "Please can you check a payment on my account.", ...input }, code: c } });
const base = { persona: "alex", now: NOW };
const SUBJECT = "Question about my account", BODY = "Please can you check a payment on my account.";
const fill = (extra: Record<string, unknown> = {}): Step => set({ "nm.topic": "Account", "nm.subject": SUBJECT, "nm.text": BODY, ...extra });

export const newMessageScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A topic, a subject and a message: Message sent, the topic and the subject, and the conversation is first in the inbox, marked read", covers: ["AC-1", "AC-4"], ...base,
    steps: [
      screen("write"), text("New message"), text("Don’t include passwords, codes or full card numbers."), fill(), press("Send"),
      screen("done"), text("Message sent"), text("We usually reply within 1 business day."), text("Topic"), text("Account"), text("Subject"), text(SUBJECT), noText(BODY),
      press("Go to messages"), { expectOpens: { journey: "messages" } },
      list("thr_3.subject", SUBJECT), list("thr_3.topic", "Account"), list("thr_3.unread", false), list("thr_3.status", "Open"), list("thr_3.reference", "MSG-20261103-0008"), inspect("threads", 3),
    ],
  },
  {
    id: "T-2", name: "Nothing filled in is refused: topic, subject and message are required", covers: ["AC-1"], ...base,
    steps: [press("Send"), screen("write"), error("nm.topic"), error("nm.subject"), error("nm.text"), inspect("threads", 2)],
  },
  {
    id: "T-3", name: "A subject under 3 characters and a message under 10 are refused with the words of the spec", covers: ["AC-1"], ...base,
    steps: [
      fill({ "nm.subject": "ab" }), press("Send"), screen("write"), error("Use at least 3 characters."), noText("Message sent"),
      fill({ "nm.text": "short" }), press("Send"), error("Write at least 10 characters."),
      fill(), press("Send"), screen("done"),
    ],
  },
  {
    id: "T-4", name: "A subject of spaces is refused by the bank in its own words, and the form keeps the text", covers: ["AC-1", "AC-8"], ...base,
    steps: [fill({ "nm.subject": "     " }), press("Send"), screen("write"), text("Use at least 3 characters."), inspect("threads", 2), set({ "nm.subject": SUBJECT }), press("Send"), screen("done")],
  },
  {
    id: "T-5", name: "Choosing Fraud or security shows the warning to call now; another topic does not", covers: ["AC-2"], ...base,
    steps: [
      noText("If someone has used your account, call us now."), set({ "nm.topic": "Fraud or security" }),
      text("If someone has used your account, call us now. Messages are read within one business day."), set({ "nm.topic": "Cards" }), noText("If someone has used your account"),
    ],
  },
  {
    id: "T-6", name: "Opened with the topic Fraud or security (This wasn't me) the topic is chosen and the warning shows", covers: ["AC-2", "AC-5"], ...base, launch: { "launch.topic": "Fraud or security" },
    steps: [screen("write"), text("If someone has used your account, call us now."), set({ "nm.subject": "I did not sign in", "nm.text": "There was a sign-in that was not me." }), press("Send"), screen("done"), text("Fraud or security")],
  },
  {
    id: "T-7", name: "The shell's This wasn't me button passes security, which is the topic Fraud or security", covers: ["AC-2", "AC-5"], ...base, launch: { "launch.topic": "security" },
    steps: [text("If someone has used your account, call us now."), set({ "nm.subject": "I did not sign in", "nm.text": "There was a sign-in that was not me." }), press("Send"), text("Fraud or security")],
  },
  {
    id: "T-8", name: "A topic and a subject passed in are filled in: only the message is left to write", covers: ["AC-5"], ...base, launch: { "launch.topic": "Cards", "launch.subject": "Lost card" },
    steps: [set({ "nm.text": "I lost my card yesterday on the train." }), press("Send"), screen("done"), text("Cards"), text("Lost card"), list("thr_3.topic", "Cards")],
  },
  {
    id: "T-9", name: "A topic that is not in the list is ignored", covers: ["AC-5"], ...base, launch: { "launch.topic": "Weather" },
    steps: [set({ "nm.subject": SUBJECT, "nm.text": BODY }), press("Send"), screen("write"), error("nm.topic")],
  },
  {
    id: "T-10", name: "A PDF up to 5 MB is accepted and shows as the file of the first message", covers: ["AC-3", "AC-4"], ...base,
    steps: [text("Attachment (optional)"), fill({ "nm.file": { name: "receipt.pdf", size: 120_000, kind: "pdf" } }), press("Send"), screen("done"), thread("messages.0.fileName", "receipt.pdf"), thread("messages.0.fileText", "receipt.pdf · 117 KB"), list("thr_3.hasFile", true)],
  },
  {
    id: "T-11", name: "A file over 5 MB blocks sending, the screen says so before the bank is asked, and removing it lets the message go", covers: ["AC-3"], ...base,
    steps: [
      fill({ "nm.file": { name: "scan.pdf", size: 8 * 1024 * 1024, kind: "pdf" } }), press("Send"), screen("write"), error("The file is larger than 5 MB."), text("PDF or JPG or PNG, up to 5 MB."), inspect("threads", 2),
      set({ "nm.file": null }), press("Send"), screen("done"), thread("messages.0.hasFile", false),
    ],
  },
  {
    id: "T-12", name: "A file of another kind is refused on the screen", covers: ["AC-3"], ...base,
    steps: [fill({ "nm.file": { name: "notes.exe", size: 2048, kind: "pdf" } }), press("Send"), screen("write"), error("nm.file"), inspect("threads", 2)],
  },
  {
    id: "T-13", name: "With allowFile off there is no attachment field, and the bank refuses a file all the same", covers: ["AC-3", "AC-8"], ...base, launch: { "opt.allowFile": false }, config: { options: { "new-message": { allowFile: false } } },
    steps: [noText("Attachment (optional)"), fill(), press("Send"), screen("done"), forced({ fileName: "receipt.pdf", fileSize: 1000 }, "FILE_NOT_ALLOWED")],
  },
  {
    id: "T-14", name: "The bank answers a new conversation two seconds later: unread, from the bank", covers: ["AC-4"], ...base,
    steps: [fill(), press("Send"), screen("done"), list("thr_3.unread", false), { advance: 3 }, list("thr_3.unread", true), list("thr_3.lastFrom", "bank"), list("thr_3.status", "Answered"), list("thr_3.preview", "Thanks Alex. We have your message and will reply within 1 working day.")],
  },
  {
    id: "T-15", name: "A new conversation is the first in the inbox, ahead of the older ones", covers: ["AC-4"], ...base,
    steps: [fill(), press("Send"), screen("done"), list("thr_3.rank", 1), list("thr_card.rank", 2), list("thr_fee.rank", 3), inspect("threads", 3)],
  },
  {
    id: "T-16", name: "When the bank is unavailable nothing is sent, and Try again finds the text still in the form", covers: ["AC-6"], ...base, conditions: { unavailable: ["bank.messages.send"] },
    steps: [
      fill(), press("Send"), screen("unavailable"), text("We couldn’t send it. Nothing was sent. Try again in a few minutes."), inspect("threads", 2),
      press("Try again"), screen("write"), press("Send"), screen("unavailable"),
    ],
  },
  {
    id: "T-17", name: "When the bank does not answer in time nothing is sent: This is taking longer than expected", covers: ["AC-6"], ...base, conditions: { timeout: ["bank.messages.send"], latencyMs: 10000 },
    steps: [fill(), press("Send"), screen("timeout"), text("This is taking longer than expected. Nothing was sent."), inspect("threads", 2), press("Try again"), screen("write"), press("Send"), screen("timeout")],
  },
  {
    id: "T-18", name: "Markup in a message is kept as written and is not on the screen as anything but text", covers: ["AC-7"], ...base,
    steps: [fill({ "nm.subject": "<b>Hello</b> there", "nm.text": "<script>alert(1)</script> and <img src=x onerror=alert(2)>" }), press("Send"), screen("done"), text("<b>Hello</b> there"), thread("messages.0.text", "<script>alert(1)</script> and <img src=x onerror=alert(2)>"), thread("subject", "<b>Hello</b> there")],
  },
  {
    id: "T-19", name: "Without messages.send it is not available, and the bank refuses the call", covers: ["AC-8"], ...base, conditions: { withoutPermissions: ["messages.send"] },
    steps: [screen("denied"), text("Not available"), forced({}, "PERMISSION_DENIED")],
  },
  {
    id: "T-20", name: "The bank refuses a topic, a subject, a text and a file that a screen would not send", covers: ["AC-8"], ...base,
    steps: [
      forced({ topic: "Weather" }, "TOPIC_INVALID"), forced({ topic: "" }, "TOPIC_INVALID"), forced({ subject: "ab" }, "SUBJECT_INVALID"), forced({ subject: "x".repeat(81) }, "SUBJECT_INVALID"),
      forced({ text: "short" }, "TEXT_INVALID"), forced({ text: "y".repeat(1001) }, "TEXT_INVALID"),
      forced({ fileName: "notes.exe", fileSize: 100 }, "FILE_TYPE"), forced({ fileName: "scan.pdf", fileSize: 5 * 1024 * 1024 + 1 }, "FILE_TOO_LARGE"), forced({ fileName: "scan.pdf", fileSize: 0 }, "FILE_TOO_LARGE"),
      inspect("threads", 2),
    ],
  },
  {
    id: "T-21", name: "A file of exactly 5 MB is accepted", covers: ["AC-3", "AC-8"], ...base,
    steps: [fill({ "nm.file": { name: "photo.JPG", size: 5 * 1024 * 1024, kind: "image" } }), press("Send"), screen("done"), thread("messages.0.fileName", "photo.JPG")],
  },
  {
    id: "T-22", name: "A message with a text of exactly 1000 characters is accepted and 10 characters are enough", covers: ["AC-1", "AC-8"], ...base,
    steps: [fill({ "nm.text": "z".repeat(1000) }), press("Send"), screen("done"), thread("messages.0.text", "z".repeat(1000))],
  },
  {
    id: "T-23", name: "Done on the form leaves without sending", covers: ["AC-1"], ...base,
    steps: [press("Done"), inspect("threads", 2)],
  },
];
