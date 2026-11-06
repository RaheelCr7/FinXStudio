import type { Journey } from "../schema";

/** What must be true for "Messages" to be right. Each is proved by at least one scenario below. */
export const messagesAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The inbox lists each conversation with its subject, a preview of the latest message, its date and an unread dot where a bank message is unread, the latest activity first." },
  { id: "AC-2", text: "Opening a conversation shows every message in order and clears its unread dot." },
  { id: "AC-3", text: "A reply of at least 2 characters is added to the thread and the field is cleared; shorter text shows \"Write a message first.\"" },
  { id: "AC-4", text: "With no conversations the empty state offers New message." },
  { id: "AC-5", text: "New message opens new-message; a message sent there appears at the top of the inbox." },
  { id: "AC-6", text: "When the bank is unavailable or does not answer in time a reply is not added and the text stays." },
  { id: "AC-7", text: "What was written is shown as text, never as markup." },
  { id: "AC-8", text: "A closed conversation offers a new message instead of a reply, and the bank refuses a reply to it; replying needs messages.send, reading needs accounts.view." },
  { id: "AC-9", text: "When the bank cannot be reached the list says so and nothing is changed." },
];

// Alex Morgan on Tuesday 3 November 2026 with his two conversations: "Your new card is on its way" (thr_card, Cards, unread, one message from BankWorkx® on 2 Nov, 10:12) and
// "Question about a monthly fee" (thr_fee, Account, read, You on 29 Oct and Sara, BankWorkx® on 30 Oct).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const toast = (t: string): Step => ({ expectToast: t });
const list = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.messages.list", path, equals } });
const thread = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.messages.get", input: { threadId: id }, path, equals } });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const base = { persona: "alex", now: NOW };
const CARD = "● Your new card is on its way", FEE = "Question about a monthly fee";
const open = (label: string): Step[] => [press(label), screen("thread")];
const reply = (t: string): Step[] => [set({ "ms.reply": t }), press("Send")];
const closed: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "sandbox.more.advance", input: { what: "close-thread", id: "thr_fee" } }];

export const messagesScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Two rows: the card one with the dot and the first 70 characters of its message, the fee one without a dot, each with its date", covers: ["AC-1"], ...base,
    steps: [
      screen("list"), text("Messages"), text(CARD), text("Unread · Your replacement debit card has been sent. It should arrive in 3 to 5 …"), text("2 Nov"),
      text(FEE), text("30 Oct"), noText("● Question about a monthly fee"), list("thr_card.unread", true), list("thr_fee.unread", false),
    ],
  },
  {
    id: "T-2", name: "The latest activity is first: a reply to the older conversation puts it ahead", covers: ["AC-1"], ...base,
    steps: [list("thr_card.rank", 1), list("thr_fee.rank", 2), ...open(FEE), ...reply("Thanks for sorting it"), list("thr_fee.rank", 1), list("thr_card.rank", 2)],
  },
  {
    id: "T-3", name: "Opening the card conversation shows its one message from BankWorkx® and clears the dot; the inbox no longer shows it", covers: ["AC-2"], ...base,
    steps: [
      ...open(CARD), text("Your new card is on its way"), text("Cards · MSG-20261102-0007"), text("Answered"), text("BankWorkx® · Mon 2 Nov, 10:12"), text("Your replacement debit card has been sent."),
      thread("thr_card", "unread", false), press("‹ Messages"), screen("list"), noText("●"), noText("Unread ·"),
    ],
  },
  {
    id: "T-4", name: "Opening the fee conversation shows both messages in order, the person's as You and the bank's from Sara", covers: ["AC-2"], ...base,
    steps: [
      ...open(FEE), text("You · Thu 29 Oct, 14:30"), text("Sara, BankWorkx® · Fri 30 Oct, 09:48"), text("Why was I charged a monthly fee"),
      thread("thr_fee", "messages.0.who", "You"), thread("thr_fee", "messages.1.who", "Sara, BankWorkx®"), thread("thr_fee", "messages.0.at", "2026-10-29T14:30:00Z"),
    ],
  },
  {
    id: "T-5", name: "A reply of Thanks is added as You with the toast Message sent and the box cleared; a reply of one character is refused", covers: ["AC-3"], ...base,
    steps: [
      ...open(FEE), ...reply("Thanks"), screen("thread"), toast("Message sent"), thread("thr_fee", "messages.2.text", "Thanks"), thread("thr_fee", "messages.2.who", "You"), list("thr_fee.count", 3),
      ...reply("a"), screen("thread"), error("Write a message first."), list("thr_fee.count", 3),
      ...reply("   a   "), error("Write a message first."), list("thr_fee.count", 3),
    ],
  },
  {
    id: "T-6", name: "An empty reply is refused, and the reply that went in shows in the thread", covers: ["AC-3"], ...base,
    steps: [...open(FEE), press("Send"), screen("thread"), error("ms.reply"), ...reply("Two words"), text("Two words"), list("thr_fee.status", "Open")],
  },
  {
    id: "T-7", name: "A reply of 1000 characters is added; the bank refuses one of 1001 and one that is empty", covers: ["AC-3", "AC-8"], ...base,
    steps: [
      ...open(FEE), ...reply("r".repeat(1000)), list("thr_fee.count", 3),
      forced("bank.messages.reply", { threadId: "thr_fee", text: "r".repeat(1001) }, "REPLY_INVALID"), forced("bank.messages.reply", { threadId: "thr_fee", text: "" }, "REPLY_INVALID"), forced("bank.messages.reply", { threadId: "thr_fee", text: " a " }, "REPLY_INVALID"),
      forced("bank.messages.reply", { threadId: "thr_nope", text: "Hello" }, "THREAD_NOT_FOUND"), list("thr_fee.count", 3),
    ],
  },
  {
    id: "T-8", name: "With no conversations the empty state says so and offers New message, which opens new-message", covers: ["AC-4", "AC-5"], ...base, conditions: { empty: ["bank.messages.list"] },
    steps: [screen("empty"), text("No messages"), text("Send us a message and we’ll reply here."), press("New message"), { expectOpens: { journey: "new-message" } }],
  },
  {
    id: "T-9", name: "New message opens new-message", covers: ["AC-5"], ...base,
    steps: [press("New message"), { expectOpens: { journey: "new-message" } }],
  },
  {
    id: "T-10", name: "A message sent in new-message is the first in the inbox, marked read, and the bank's answer comes two seconds later with the dot", covers: ["AC-5"], ...base,
    setup: [{ adapter: "bank.messages.send", input: { topic: "Account", subject: "Question about my account", text: "Please can you check a payment on my account." } }],
    steps: [list("thr_3.rank", 1), text("Question about my account"), noText("● Question about my account"), { advance: 3 }, press("Done"), list("thr_3.unread", true)],
  },
  {
    id: "T-12", name: "When the bank is unavailable a reply is not added and the text stays: the same reply is sent again", covers: ["AC-6"], ...base, conditions: { unavailable: ["bank.messages.reply"] },
    steps: [
      ...open(FEE), ...reply("Thanks for sorting it"), screen("thread"), text("We couldn’t send it. Try again in a few minutes."), list("thr_fee.count", 2),
      press("Send"), screen("thread"), text("We couldn’t send it. Try again in a few minutes."), thread("thr_fee", "messages.1.who", "Sara, BankWorkx®"),
    ],
  },
  {
    id: "T-13", name: "When the bank does not answer in time a reply is not added: This is taking longer than expected, Nothing was sent", covers: ["AC-6"], ...base, conditions: { timeout: ["bank.messages.reply"], latencyMs: 10000 },
    steps: [...open(FEE), ...reply("Thanks for sorting it"), text("This is taking longer than expected. Nothing was sent."), list("thr_fee.count", 2), press("Send"), text("This is taking longer than expected. Nothing was sent.")],
  },
  {
    id: "T-14", name: "Markup in a message is shown as the text it is, not as markup", covers: ["AC-7"], ...base,
    setup: [{ adapter: "bank.messages.send", input: { topic: "Account", subject: "<b>Bold</b> subject", text: "<script>alert(1)</script> and <img src=x onerror=alert(2)>" } }],
    steps: [text("<b>Bold</b> subject"), ...open("<b>Bold</b> subject"), text("<script>alert(1)</script> and <img src=x onerror=alert(2)>"), text("You · Tue 3 Nov, 10:00")],
  },
  {
    id: "T-15", name: "A closed conversation says so and offers Start a new message with the same topic instead of a reply box; the bank refuses a reply to it", covers: ["AC-8"], ...base, setup: closed,
    steps: [
      ...open(FEE), text("This conversation is closed."), text("Closed"), noText("Reply"), press("Start a new message"), { expectOpens: { journey: "new-message", with: { "launch.topic": "Account" } } },
      forced("bank.messages.reply", { threadId: "thr_fee", text: "Hello again" }, "THREAD_CLOSED"),
    ],
  },
  {
    id: "T-16", name: "A conversation the bank closes while it is open: the reply is refused, the thread is read again and shows as closed", covers: ["AC-8"], ...base,
    steps: [...open(FEE), text("Reply"), { expectBank: { adapter: "sandbox.more.advance", input: { what: "close-thread", id: "thr_fee" }, path: "ok", equals: true } }, ...reply("Thanks"), screen("thread"), text("This conversation is closed."), noText("Reply"), text("Closed"), press("Start a new message"), { expectOpens: { journey: "new-message" } }],
  },
  {
    id: "T-17", name: "Without messages.send the conversations can be read but not answered and there is no New message; the bank refuses a reply", covers: ["AC-8"], ...base, conditions: { withoutPermissions: ["messages.send"] },
    steps: [screen("list"), text(CARD), noText("New message"), ...open(FEE), noText("Reply"), noText("Send"), forced("bank.messages.reply", { threadId: "thr_fee", text: "Hello" }, "PERMISSION_DENIED")],
  },
  {
    id: "T-18", name: "Without accounts.view it is not available", covers: ["AC-8"], ...base, conditions: { withoutPermissions: ["accounts.view"] },
    steps: [screen("denied"), text("Not available")],
  },
  {
    id: "T-19", name: "When the bank is unavailable the list says it could not load, and Try again reads it again", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.messages.list"] },
    steps: [screen("loadFail"), text("We couldn’t load your messages. Nothing was changed."), text("Try again in a few minutes."), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-20", name: "When the bank does not answer in time the list says so", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.messages.list"], latencyMs: 10000 },
    steps: [screen("loadFail"), text("We couldn’t load your messages. Nothing was changed."), text("This is taking longer than expected. Nothing was changed.")],
  },
  {
    id: "T-21", name: "When a conversation cannot be read it says so and nothing is changed", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.messages.get"] },
    steps: [press(CARD), screen("loadFail"), text("We couldn’t load your messages. Nothing was changed."), list("thr_card.unread", true)],
  },
  {
    id: "T-22", name: "When the bank cannot mark a conversation read it still opens, and the dot stays", covers: ["AC-9", "AC-2"], ...base, conditions: { unavailable: ["bank.messages.markRead"] },
    steps: [...open(CARD), text("Your replacement debit card has been sent."), list("thr_card.unread", true)],
  },
  {
    id: "T-23", name: "Done leaves the inbox", covers: ["AC-1"], ...base,
    steps: [press("Done")],
  },
  {
    id: "T-24", name: "A conversation about an account that is closed offers a new message about the same account", covers: ["AC-8"], ...base,
    setup: [{ adapter: "bank.messages.send", input: { topic: "Payments", subject: "Payment question", text: "Please can you check a payment on my account.", accountId: "acc_main" } }, { adapter: "sandbox.more.advance", input: { what: "close-thread", id: "thr_3" } }],
    steps: [...open("Payment question"), text("This conversation is closed."), press("Start a new message"), { expectOpens: { journey: "new-message", with: { "launch.topic": "Payments", "launch.accountId": "acc_main" } } }],
  },
];
