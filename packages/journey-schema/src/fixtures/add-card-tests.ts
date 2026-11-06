import type { Journey } from "../schema";

/** What must be true for "Add a card" to be right. Each is proved by at least one scenario below. */
export const addCardAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The card number must be digits, of an accepted type, the right length and pass the check digit, with the messages of the spec." },
  { id: "AC-2", text: "The 15-digit type is accepted only with acceptAmex on and needs a 4-digit security code; the others need 3." },
  { id: "AC-3", text: "An expired card is refused; the expiry format is MM/YY and the date is at most 15 years ahead." },
  { id: "AC-4", text: "The billing postcode follows the home market and is not asked in Market D." },
  { id: "AC-5", text: "A card is saved only after the right code (a text message code or the code of a small test charge); three wrong codes end the attempt with nothing saved." },
  { id: "AC-6", text: "The same card (last four digits and expiry) cannot be saved twice, no more than 5 cards can be saved, and a card the network declines is refused." },
  { id: "AC-7", text: "\"Use to pay\" is offered only with allowPay on; the result lists what the card is used for." },
  { id: "AC-8", text: "The card number and the security code are not in the result, not kept by the journey after the bank has them, and the bank keeps only the last four digits and the expiry." },
  { id: "AC-9", text: "When the bank is unavailable or does not answer in time nothing is saved." },
  { id: "AC-10", text: "It needs payments.create and a tick; the bank itself refuses to save a card that was not verified." },
];

// Alex Morgan on Tuesday 3 November 2026 with one saved card (Everyday ••5832). The test card is 4242 4242 4242 4242, expiry 12/29, security code 123, postcode 62704 (Market A).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const base = { persona: "alex", now: NOW };
const CARD = { number: "4242 4242 4242 4242", expiry: "12/29", cvv: "123", holder: "Alex Morgan", postcode: "62704" };
const fields = (over: Record<string, string> = {}): Step => set(Object.fromEntries(Object.entries({ ...CARD, ...over }).map(([k, v]) => [`ac.${k}`, v])));
/** The details, then Continue: on to the check of the card. */
const details = (over: Record<string, string> = {}): Step[] => [fields(over), press("Continue")];
const toVerify = (over: Record<string, string> = {}): Step[] => [...details(over), screen("verify")];
const sms = (code = "482100"): Step[] => [set({ "ac.code": code }), press("Continue")];
const toName = (): Step[] => [...toVerify(), ...sms(), screen("name")];
/** The bank's own calls that save a card, for the scenarios that need cards already saved. */
const saved = (n: string, expiry = "12/29"): NonNullable<Journey["scenarios"]>[number]["setup"] => {
  const c = { number: n, expiry, cvv: "123", holder: "Alex Morgan", postcode: "62704" };
  return [{ adapter: "bank.cards.check", input: c }, { adapter: "bank.cards.verify", input: { method: "sms", code: "482100" } }, { adapter: "bank.cards.add", input: c }];
};
const isSaved = (last4: string, equals = "visa"): Step => ({ expectBank: { adapter: "bank.cards.list", path: `c_${last4}.network`, equals } });
/** The card is not saved: checking it again does not find it as a duplicate. */
const notSaved = (): Step => ({ expectBank: { adapter: "bank.cards.check", input: CARD, path: "last4", equals: "4242" } });

export const addCardScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The details, a text message code, a nickname and the tick: Card saved, Visa ••4242 is ready to use, used for Adding money and Paying", covers: ["AC-1", "AC-5", "AC-7"], ...base,
    steps: [
      screen("card"), text("Card details"), ...toVerify(), text("Confirm it’s your card"), text("Visa ••4242"), text("Sent to the phone ending 0142."), noText("temporary charge"),
      ...sms(), screen("name"), set({ "ac.nick": "Spare card", "ac.consent": true }), press("Save card"),
      screen("done"), text("Card saved"), text("Visa ••4242 is ready to use."), text("Spare card"), text("12/29"), text("Adding money and Paying"), isSaved("4242"), forced("bank.cards.add", { ...CARD }, "CARD_DUPLICATE"),
    ],
  },
  {
    id: "T-2", name: "A number with a wrong check digit, letters or a type the bank does not accept is refused with the spec's words", covers: ["AC-1"], ...base,
    steps: [
      fields({ number: "abcd" }), press("Continue"), screen("card"), text("Use digits only."),
      ...details({ number: "4242 4242 4242 4241" }), screen("card"), text("Check the card number."), noText("Use digits only."),
      ...details({ number: "6011 1111 1111 1117" }), text("We can’t accept this type of card."),
      ...details({ number: "4242 4242 4242" }), text("Check the card number."),
      ...details({ number: "5555 5555 5555 4444" }), screen("verify"),
    ],
  },
  {
    id: "T-3", name: "With acceptAmex off a 15-digit card is refused; with it on it needs the 4 digits on the front, and a 3-digit code on a 16-digit card is refused", covers: ["AC-2"], ...base, launch: { "opt.acceptAmex": false },
    steps: [...details({ number: "3782 822463 10005", cvv: "1234" }), screen("card"), text("We can’t accept this type of card.")],
  },
  {
    id: "T-4", name: "A 15-digit card with the option on needs 4 digits; 16 digits need 3", covers: ["AC-2"], ...base,
    steps: [
      ...details({ number: "3782 822463 10005", cvv: "123" }), screen("card"), text("Enter the 4 digits on the front."),
      ...details({ number: "4242 4242 4242 4242", cvv: "1234" }), text("Enter the 3 digits on the back."),
      ...details({ number: "3782 822463 10005", cvv: "1234" }), screen("verify"), text("American Express ••0005"),
    ],
  },
  {
    id: "T-5", name: "The expiry must be MM/YY, not past and not more than 15 years ahead", covers: ["AC-3"], ...base,
    steps: [
      fields({ expiry: "13/29" }), press("Continue"), screen("card"), text("Use the format MM/YY."),
      ...details({ expiry: "01/24" }), text("This card has expired."), ...details({ expiry: "12/42" }), text("Check the expiry date."), ...details({ expiry: "10/26" }), screen("card"), text("This card has expired."), ...details({ expiry: "10/41" }), screen("verify"),
    ],
  },
  {
    id: "T-6", name: "Market A asks for the 5-digit ZIP code (or ZIP+4); a wrong one is refused", covers: ["AC-4"], ...base,
    steps: [...details({ postcode: "1234" }), screen("card"), text("Enter the 5-digit ZIP code."), ...details({ postcode: "62704-1234" }), screen("verify")],
  },
  {
    id: "T-7", name: "Market B asks for a UK postcode; Market C for 4 to 10 letters and digits", covers: ["AC-4"], ...base, config: { homeMarket: "uk" },
    steps: [...details({ postcode: "1234" }), text("Enter a valid postcode."), ...details({ postcode: "SW1A 1AA" }), screen("verify")],
  },
  {
    id: "T-8", name: "Market C asks for 4 to 10 letters, digits, spaces or hyphens", covers: ["AC-4"], ...base, config: { homeMarket: "eu" },
    steps: [...details({ postcode: "1" }), text("Enter a valid postcode."), ...details({ postcode: "10115" }), screen("verify")],
  },
  {
    id: "T-9", name: "In Market D the postcode is not asked and not needed", covers: ["AC-4"], ...base, config: { homeMarket: "ae" },
    steps: [text("Card details"), noText("Billing postcode"), set({ "ac.number": CARD.number, "ac.expiry": CARD.expiry, "ac.cvv": CARD.cvv, "ac.holder": CARD.holder }), press("Continue"), screen("verify")],
  },
  {
    id: "T-10", name: "In Market A the postcode is asked for and cannot be left empty", covers: ["AC-4"], ...base,
    steps: [text("Billing postcode"), ...details({ postcode: "" }), screen("card"), error("ac.postcode")],
  },
  {
    id: "T-11", name: "A wrong code saves nothing and says so; the right code goes on", covers: ["AC-5"], ...base,
    steps: [...toVerify(), ...sms("111111"), screen("verify"), text("That code isn’t right. Try again."), ...sms(), screen("name"), notSaved()],
  },
  {
    id: "T-12", name: "Three wrong codes end the attempt: Too many wrong codes, nothing saved; even the right code is refused until the card is checked again", covers: ["AC-5"], ...base,
    steps: [
      ...toVerify(), ...sms("111111"), ...sms("111111"), ...sms("111111"), screen("locked"), text("Too many wrong codes. Nothing was saved. Go back to start again."), notSaved(),
      forced("bank.cards.verify", { method: "sms", code: "482100" }, "VERIFY_LOCKED"), forced("bank.cards.add", CARD, "VERIFY_REQUIRED"), press("Back to start"), screen("card"),
    ],
  },
  {
    id: "T-13", name: "The code of a small test charge is 4 digits (4821); the text message code is 6", covers: ["AC-5"], ...base,
    steps: [
      ...toVerify(), set({ "ac.method": "charge" }), text("temporary charge"), set({ "ac.code": "482100" }), press("Continue"), screen("verify"), error("ac.code"),
      set({ "ac.code": "4822" }), press("Continue"), text("That code isn’t right. Try again."), set({ "ac.code": "4821" }), press("Continue"), screen("name"),
    ],
  },
  {
    id: "T-14", name: "000000 is also accepted as the text message code in the sandbox; a code of the wrong length is refused on the screen", covers: ["AC-5"], ...base,
    steps: [...toVerify(), ...sms("12345"), screen("verify"), error("ac.code"), set({ "ac.code": "000000" }), press("Continue"), screen("name")],
  },
  {
    id: "T-15", name: "The same card cannot be saved twice", covers: ["AC-6"], ...base, setup: saved("4242 4242 4242 4242"),
    steps: [isSaved("4242"), ...details(), screen("card"), text("This card is already saved."), ...details({ expiry: "11/29" }), screen("verify")],
  },
  {
    id: "T-16", name: "A sixth card is refused: You can save up to 5 cards", covers: ["AC-6"], ...base,
    setup: [...saved("4111 1111 1111 1111")!, ...saved("4012 8888 8888 1881")!, ...saved("5555 5555 5555 4444")!, ...saved("5105 1051 0510 5100")!],
    steps: [...details(), screen("card"), text("You can save up to 5 cards. Remove one to add another.")],
  },
  {
    id: "T-17", name: "A card the network declines (a number ending 0002) is refused", covers: ["AC-6"], ...base,
    steps: [...details({ number: "4000 0000 0000 0002" }), screen("card"), text("The card was declined. Try another card.")],
  },
  {
    id: "T-18", name: "With allowPay off only Use to add money is offered, and the result says Adding money", covers: ["AC-7"], ...base, launch: { "opt.allowPay": false },
    steps: [...toName(), text("Use to add money"), noText("Use to pay"), set({ "ac.consent": true }), press("Save card"), screen("done"), text("Adding money"), noText("Paying")],
  },
  {
    id: "T-19", name: "Both uses off says Nothing yet; only paying says Paying", covers: ["AC-7"], ...base,
    steps: [...toName(), set({ "ac.addMoney": false, "ac.pay": false, "ac.consent": true }), press("Save card"), screen("done"), text("Nothing yet")],
  },
  {
    id: "T-20", name: "Only paying is saved as Paying", covers: ["AC-7"], ...base,
    steps: [...toName(), set({ "ac.addMoney": false, "ac.consent": true }), press("Save card"), text("Paying"), noText("Adding money")],
  },
  {
    id: "T-21", name: "The result shows only ••4242: no number and no code on the screen, and the nickname is optional", covers: ["AC-8"], ...base,
    steps: [...toName(), set({ "ac.consent": true }), press("Save card"), screen("done"), text("Visa ••4242"), noText("4242 4242"), noText("123"), noText("Nickname"), noText("62704")],
  },
  {
    id: "T-22", name: "The bank keeps the last four digits and the expiry: what it lists has no number", covers: ["AC-8"], ...base,
    steps: [...toName(), set({ "ac.consent": true }), press("Save card"), isSaved("4242"), { expectBank: { adapter: "bank.cards.list", path: "c_4242.expiry", equals: "12/29" } }, { expectBank: { adapter: "bank.cards.list", path: "c_4242.last4", equals: "4242" } }],
  },
  {
    id: "T-23", name: "A refusal of the details keeps what was typed, a screen of the bank not answering clears the number and the code", covers: ["AC-8", "AC-9"], ...base, conditions: { unavailable: ["bank.cards.check"] },
    steps: [...details(), screen("unavailable"), text("This isn’t available right now. Nothing was saved. Try again in a few minutes."), noText("4242 4242"), press("Try again"), screen("card")],
  },
  {
    id: "T-24", name: "When the bank does not answer in time on the details nothing is saved", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.cards.check"], latencyMs: 10000 },
    steps: [...details(), screen("timeout"), text("This is taking longer than expected. Nothing was saved."), press("Try again"), screen("card")],
  },
  {
    id: "T-25", name: "When the card cannot be saved at the end because the bank is unavailable nothing is saved", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.cards.add"] },
    steps: [...toName(), set({ "ac.consent": true }), press("Save card"), screen("unavailable"), text("Nothing was saved."), noText("Card saved")],
  },
  {
    id: "T-26", name: "When the bank does not answer in time at the end nothing is saved", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.cards.add"], latencyMs: 10000 },
    steps: [...toName(), set({ "ac.consent": true }), press("Save card"), screen("timeout"), text("This is taking longer than expected. Nothing was saved.")],
  },
  {
    id: "T-27", name: "When the code check is unavailable nothing is saved", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.cards.verify"] },
    steps: [...toVerify(), ...sms(), screen("unavailable"), text("Nothing was saved.")],
  },
  {
    id: "T-28", name: "When the text message cannot be sent nothing is saved", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...details(), screen("unavailable")],
  },
  {
    id: "T-29", name: "When the bank's setup cannot be read nothing starts", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.app.config"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-30", name: "The tick is needed to save, and a nickname of one character is refused", covers: ["AC-10"], ...base,
    steps: [...toName(), press("Save card"), screen("name"), error("ac.consent"), set({ "ac.nick": "x", "ac.consent": true }), press("Save card"), screen("name"), text("Use at least 2 characters."), set({ "ac.nick": "" }), press("Save card"), screen("done")],
  },
  {
    id: "T-31", name: "Without payments.create it is not available, and the bank refuses", covers: ["AC-10"], ...base, conditions: { withoutPermissions: ["payments.create"] },
    steps: [screen("denied"), text("Not available"), forced("bank.cards.check", CARD, "PERMISSION_DENIED"), forced("bank.cards.add", CARD, "PERMISSION_DENIED")],
  },
  {
    id: "T-32", name: "The bank saves nothing that was not verified, and checks the details again itself", covers: ["AC-10", "AC-1"], ...base,
    steps: [forced("bank.cards.verify", { method: "sms", code: "482100" }, "VERIFY_REQUIRED"), forced("bank.cards.add", CARD, "VERIFY_REQUIRED"), forced("bank.cards.check", { ...CARD, number: "4242 4242 4242 4241" }, "CARD_INVALID"), notSaved()],
  },
  {
    id: "T-33", name: "A nickname of one character is refused by the bank itself, after the code, whatever a screen would do", covers: ["AC-10"], ...base,
    setup: [{ adapter: "bank.cards.check", input: CARD }, { adapter: "bank.cards.verify", input: { method: "sms", code: "482100" } }],
    steps: [forced("bank.cards.add", { ...CARD, nickname: "x" }, "NICKNAME_INVALID"), notSaved()],
  },
];
