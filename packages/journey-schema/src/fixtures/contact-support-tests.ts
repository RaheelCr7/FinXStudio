import type { Journey } from "../schema";
import { bank, forced, inspect, noText, opens, press, screen, set, text, visitor, error, type Step } from "./public-test-kit";

/** What must be true for "Contact us" to be right. Each is proved by at least one scenario below. */
export const contactSupportAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Chat appears only with allowChat, Call only with allowCall, Message always; each shows an open or closed chip and its hours from the bank's hours and clock." },
  { id: "AC-2", text: "Chat needs a topic and at least 5 characters, and ends in the queue result." },
  { id: "AC-3", text: "Call shows the seven opening-hours rows, then the dialer result with the weekday hours." },
  { id: "AC-4", text: "Message needs a topic, a valid email and at least 10 characters, and the result repeats the email." },
  { id: "AC-5", text: "The secure-message button appears only with secureMessages on, when the person is signed in and new-message is available to them." },
  { id: "AC-6", text: "A launch value way preselects that way; a way that is not offered is not preselected." },
  { id: "AC-7", text: "When the bank is unavailable or does not answer in time nothing is sent, what was written is kept and Try again works." },
  { id: "AC-8", text: "The bank holds to the rules: a topic from the list, the lengths, a valid email, the ways it offers, and at most five messages an hour from one device." },
  { id: "AC-9", text: "What is written is data: shown as text, and the bank keeps a count and a masked address, never the words or the address." },
];

const MSG = "Please help me with my account.";
/** Opens a way: chosen on the first screen and confirmed with Continue. */
const choose = (way: string): Step[] => [set({ "cs.way": way }), press("Continue")];
const chat = (topic = "Cards", question = "I need help with my card."): Step[] => [...choose("chat"), set({ "cs.topic": topic, "cs.text": question }), press("Start chat")];
const message = (more: Record<string, unknown> = {}): Step[] => [...choose("message"), set({ "cs.topic": "Accounts", "cs.email": "alex.morgan@example.com", "cs.text": MSG, ...more }), press("Send")];
const OFF = { options: { "contact-support": { allowChat: false, allowCall: false } } };
/** Five messages already sent from this device, through the bank directly: the sixth is the journey's. */
const fiveSent: Step[] = [1, 2, 3, 4, 5].map((n) => bank("bank.support.sendMessage", "reference", `CS-20261103-000${n}`, { topic: "Accounts", email: "x@example.com", text: `Message number ${n} to the bank.` }));

export const contactSupportScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Chat is open now and closes at 20:00; Call closed at 18:00 and opens tomorrow at 08:00; Message is open any time", covers: ["AC-1"], ...visitor,
    steps: [
      screen("way"), text("Contact us"), text("How would you like to reach us?"), text("Chat"), text("Ask an adviser online · Open now · Closes 20:00"), text("Call"), text("Talk to us · Closed · Opens tomorrow 08:00"),
      text("Message"), text("We reply within 1 working day · Open now · Any time"),
    ],
  },
  {
    id: "T-2", name: "With allowChat and allowCall off only Message is offered", covers: ["AC-1"], ...visitor, launch: { "opt.allowChat": false, "opt.allowCall": false }, config: OFF,
    steps: [text("Message"), noText("Chat"), noText("Call"), noText("Ask an adviser online"), noText("Talk to us"), ...choose("message"), screen("message")],
  },
  {
    id: "T-3", name: "The bank keeps chat and call out when it does not offer them, whatever the journey asks", covers: ["AC-1", "AC-8"], ...visitor, config: OFF,
    steps: [text("Message"), noText("Ask an adviser online"), forced("bank.support.openChat", { topic: "Cards", text: "I need help with my card." }, "WAY_UNAVAILABLE")],
  },
  {
    id: "T-4", name: "On a Sunday evening Chat is closed and says when it opens; it can still be chosen", covers: ["AC-1"], persona: "signed-out", now: "2026-11-08T17:00:00Z",
    steps: [text("Ask an adviser online · Closed · Opens tomorrow 08:00"), text("Talk to us · Closed · Opens tomorrow 08:00"), ...choose("chat"), screen("chat")],
  },
  {
    id: "T-5", name: "On a Saturday morning Call is closed until Monday", covers: ["AC-1"], persona: "signed-out", now: "2026-11-07T09:00:00Z",
    steps: [text("Ask an adviser online · Open now · Closes 20:00"), text("Talk to us · Closed · Opens Mon 08:00")],
  },
  {
    id: "T-6", name: "Chat with the topic Cards and the question Hi: Write a few words so we can help; a real question: You’re in the queue, with the topic", covers: ["AC-2"], ...visitor,
    steps: [
      ...chat("Cards", "Hi"), screen("chat"), error("Write a few words so we can help."), noText("You’re in the queue"), inspect("support.chats", 0),
      set({ "cs.text": "I need help with my card." }), press("Start chat"), screen("chatDone"), text("You’re in the queue"), text("An adviser will join in about 2 minutes."), text("Waiting"), text("Topic"), text("Cards"),
      text("Reference CHAT-20261103-0001"), inspect("support.chats", 1),
    ],
  },
  {
    id: "T-7", name: "Chat needs a topic", covers: ["AC-2"], ...visitor,
    steps: [...choose("chat"), set({ "cs.text": "I need help with my card." }), press("Start chat"), screen("chat"), error("cs.topic"), inspect("support.chats", 0)],
  },
  {
    id: "T-8", name: "A question of 300 characters is accepted; the bank refuses more and fewer than 5", covers: ["AC-2", "AC-8"], ...visitor,
    steps: [
      ...chat("Payments", "q".repeat(300)), screen("chatDone"),
      forced("bank.support.openChat", { topic: "Payments", text: "q".repeat(301) }, "TEXT_INVALID"), forced("bank.support.openChat", { topic: "Payments", text: "abcd" }, "TEXT_INVALID"),
      forced("bank.support.openChat", { topic: "Weather", text: "I need help with this." }, "TOPIC_INVALID"), forced("bank.support.openChat", { topic: "", text: "I need help with this." }, "TOPIC_INVALID"),
    ],
  },
  {
    id: "T-9", name: "Call shows the seven opening-hours rows (Saturday and Sunday closed, Monday 08:00 to 18:00) and then the dialer result with the weekday hours", covers: ["AC-3"], ...visitor,
    steps: [
      ...choose("call"), screen("call"), text("Opening hours"), text("Sunday"), text("Monday"), text("08:00 to 18:00"), text("Tuesday"), text("Wednesday"), text("Thursday"), text("Friday"), text("Saturday"), text("Closed"),
      press("Call us"), screen("callDone"), text("Calling the bank"), text("Your phone will open the dialer."), text("Opening hours"), text("Mon to Fri, 08:00 to 18:00"), text("Reference CALL-20261103-"),
    ],
  },
  {
    id: "T-10", name: "Message: an email without a host, a message under 10 characters, then valid: Message sent, we’ll reply to the address within 1 working day", covers: ["AC-4"], ...visitor,
    steps: [
      ...message({ "cs.email": "alex" }), screen("message"), error("Enter a valid email address."), inspect("support.messages", 0),
      set({ "cs.email": "alex.morgan@example.com", "cs.text": "Hello" }), press("Send"), error("Write at least 10 characters."),
      set({ "cs.text": MSG }), press("Send"), screen("messageDone"), text("Message sent"), text("We’ll reply to alex.morgan@example.com within 1 working day."), text("Received"), text("Topic"), text("Accounts"),
      text("Reply to"), text("Reference CS-20261103-0001"), inspect("support.messages", 1),
    ],
  },
  {
    id: "T-11", name: "Message needs a topic; the counter reads how many of 1000 characters were written", covers: ["AC-4"], ...visitor,
    steps: [...choose("message"), set({ "cs.email": "alex.morgan@example.com", "cs.text": MSG }), text("31 of 1000"), press("Send"), screen("message"), error("cs.topic"), inspect("support.messages", 0)],
  },
  {
    id: "T-12", name: "A message of 1000 characters is accepted; the bank refuses 1001, fewer than 10, a wrong email, a missing topic", covers: ["AC-4", "AC-8"], ...visitor,
    steps: [
      ...message({ "cs.text": "m".repeat(1000) }), screen("messageDone"),
      forced("bank.support.sendMessage", { topic: "Accounts", email: "alex.morgan@example.com", text: "m".repeat(1001) }, "TEXT_INVALID"),
      forced("bank.support.sendMessage", { topic: "Accounts", email: "alex.morgan@example.com", text: "short" }, "TEXT_INVALID"),
      forced("bank.support.sendMessage", { topic: "Accounts", email: "alex", text: MSG }, "EMAIL_INVALID"), forced("bank.support.sendMessage", { topic: "Accounts", email: `${"a".repeat(80)}@example.com`, text: MSG }, "EMAIL_INVALID"),
      forced("bank.support.sendMessage", { topic: "", email: "alex.morgan@example.com", text: MSG }, "TOPIC_INVALID"),
    ],
  },
  {
    id: "T-13", name: "A signed-in customer can open the secure messages from Message", covers: ["AC-5"], persona: "alex", now: "2026-11-03T18:45:00Z",
    steps: [...choose("message"), text("Send us a message"), press("Send us a message"), opens("new-message")],
  },
  {
    id: "T-14", name: "Signed out the secure-message button is absent", covers: ["AC-5"], ...visitor,
    steps: [...choose("message"), screen("message"), text("Write to us"), noText("Send us a message"), bank("bank.support.hours", "secure", true)],
  },
  {
    id: "T-15", name: "With secureMessages off the button is absent even for a signed-in customer", covers: ["AC-5"], persona: "alex", now: "2026-11-03T18:45:00Z", launch: { "opt.secureMessages": false }, config: { options: { "contact-support": { secureMessages: false } } },
    steps: [...choose("message"), screen("message"), noText("Send us a message"), bank("bank.support.hours", "secure", false)],
  },
  {
    id: "T-16", name: "With new-message switched off at the bank the button is absent", covers: ["AC-5"], persona: "alex", now: "2026-11-03T18:45:00Z", config: { disabled: ["new-message"] },
    steps: [...choose("message"), screen("message"), noText("Send us a message"), bank("bank.support.hours", "secure", false)],
  },
  {
    id: "T-17", name: "A launch value way opens with that way chosen: Continue goes straight to it", covers: ["AC-6"], ...visitor, launch: { "launch.way": "message" },
    steps: [press("Continue"), screen("message")],
  },
  {
    id: "T-18", name: "A launch value chat opens Chat, and call opens Call", covers: ["AC-6"], ...visitor, launch: { "launch.way": "call" },
    steps: [press("Continue"), screen("call")],
  },
  {
    id: "T-19", name: "A way that does not exist, or is not offered, is not preselected: the person must choose", covers: ["AC-6"], ...visitor, launch: { "launch.way": "fax" },
    steps: [press("Continue"), screen("way"), error("cs.way")],
  },
  {
    id: "T-20", name: "A launch value chat while chat is off is not preselected", covers: ["AC-6"], ...visitor, launch: { "launch.way": "chat", "opt.allowChat": false }, config: OFF,
    steps: [press("Continue"), screen("way"), error("cs.way")],
  },
  {
    id: "T-21", name: "When the bank is unavailable nothing is sent: the message is still in the form after Try again, and nothing was counted", covers: ["AC-7"], ...visitor, conditions: { unavailable: ["bank.support.sendMessage"] },
    steps: [
      ...message(), screen("unavailable"), text("We couldn’t send that. Nothing was sent. Try again in a few minutes."), inspect("support.messages", 0), inspect("outbox", []),
      press("Try again"), screen("message"), press("Send"), screen("unavailable"),
    ],
  },
  {
    id: "T-22", name: "When the bank does not answer in 10 seconds nothing is sent: This is taking longer than expected. Nothing was sent.", covers: ["AC-7"], ...visitor, conditions: { timeout: ["bank.support.sendMessage"], latencyMs: 10_000 },
    steps: [...message(), screen("timeout"), text("This is taking longer than expected. Nothing was sent."), inspect("support.messages", 0), press("Try again"), screen("message"), press("Send"), screen("timeout")],
  },
  {
    id: "T-23", name: "When chat is unavailable or slow nothing is sent and Try again returns to the question", covers: ["AC-7"], ...visitor, conditions: { unavailable: ["bank.support.openChat"] },
    steps: [...chat(), screen("unavailable"), inspect("support.chats", 0), press("Try again"), screen("chat")],
  },
  {
    id: "T-24", name: "A slow chat says nothing was sent", covers: ["AC-7"], ...visitor, conditions: { timeout: ["bank.support.openChat"], latencyMs: 10_000 },
    steps: [...chat(), screen("timeout"), text("Nothing was sent."), inspect("support.chats", 0), press("Try again"), screen("chat")],
  },
  {
    id: "T-25", name: "When the hours cannot be loaded the first screen says so, and Try again asks again", covers: ["AC-7"], ...visitor, conditions: { unavailable: ["bank.support.hours"] },
    steps: [screen("unavailable"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-26", name: "The sixth message from one device in an hour is refused: You’ve sent a lot of messages; an hour later it goes", covers: ["AC-8"], ...visitor,
    steps: [...fiveSent, ...message(), screen("limited"), text("You’ve sent a lot of messages. Try again later."), inspect("support.messages", 5), press("Back"), screen("way")],
  },
  {
    id: "T-27", name: "Markup in a message is data: the result shows the words as text and the bank keeps no part of it", covers: ["AC-9"], ...visitor,
    steps: [
      ...message({ "cs.text": "<script>alert(1)</script> and <b>bold</b> text please" }), screen("messageDone"), noText("<script>"), inspect("contains", false, { contains: "<script>" }), inspect("contains", false, { contains: "bold" }),
    ],
  },
  {
    id: "T-28", name: "The bank keeps a count and a masked address: never the words nor the address", covers: ["AC-9"], ...visitor,
    steps: [
      ...message(), screen("messageDone"), inspect("contains", false, { contains: "alex.morgan" }), inspect("contains", false, { contains: "Please help me" }), inspect("outbox", [{ to: "a•••@example.com", kind: "support-reply" }]),
      press("Done"),
    ],
  },
  {
    id: "T-29", name: "The words of a sent chat are gone from the journey: it keeps the topic for the result only", covers: ["AC-9"], ...visitor,
    steps: [...chat("Cards", "My card number is 4000 0000 0000 0002"), screen("chatDone"), noText("4000"), inspect("contains", false, { contains: "4000 0000" })],
  },
  {
    id: "T-30", name: "Nothing is chosen on the first screen: it asks for a way", covers: ["AC-1"], ...visitor,
    steps: [press("Continue"), screen("way"), error("cs.way")],
  },
];
