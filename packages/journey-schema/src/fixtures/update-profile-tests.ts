import type { Journey } from "../schema";

/** What must be true for "Update profile" to be right. Each is proved by at least one scenario below. */
export const updateProfileAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The first screen offers Mobile number, Email and Address with the current values masked, and \"Pending\" in the line of a change that waits; a pending item cannot be chosen." },
  { id: "AC-2", text: "The mobile number follows the market rule and cannot be the current number; the email follows the shape and cannot be the current one; the address must differ and follow the market rules." },
  { id: "AC-3", text: "Every change asks for a one-time code sent to the number on file; three wrong codes end the attempt with nothing changed." },
  { id: "AC-4", text: "With verifyNewMobile on, a second code goes to the new number and the change saves only after it." },
  { id: "AC-5", text: "A mobile change applies at once; an email waits with verifyEmail on; an address waits with verifyAddress on; waiting changes show \"Change received\" and a Pending chip." },
  { id: "AC-6", text: "With requireProof on, an address change needs a PDF, JPG or PNG; otherwise the field is absent." },
  { id: "AC-7", text: "The result shows what changed (masked) and its status." },
  { id: "AC-8", text: "When the bank is unavailable or does not answer in time, nothing is changed." },
  { id: "AC-9", text: "It needs profile.update, and the bank itself asks for the code, refuses a second change to an item that waits, and refuses a value, a number it already has or one that belongs to someone else, whatever a screen would do." },
  { id: "AC-10", text: "The old contact is told (and the new one): the bank sends a text to the old and the new number, an email to the old and the new address, a text for an address; each goes to a masked destination, and the log of a change and the answers hold no number, email or address." },
];

// Alex Morgan on Tuesday 3 November 2026: Mobile +1 415 555 0142 (•••• 0142), email alex.morgan@example.com (a•••@example.com), 12 Harbour Road, Springfield, IL 10001. The one-time code is 482100;
// 000000 is wrong and 999999 expired. Market A unless a scenario says otherwise.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const forced = (input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter: "bank.profile.update", input, code: c } });
const profile = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.profile.get", path, equals } });
const inspect = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.more.inspect", path, equals } });
const base = { persona: "alex", now: NOW };
const code = (c = "482100"): Step[] => [set({ "up.code": c }), press("Confirm")];
const code2 = (c = "482100"): Step[] => [set({ "up.code2": c }), press("Save")];
const pick = (what: string): Step[] => [set({ "up.what": what }), press("Continue")];
/** A mobile change up to the first code. */
const newMobile = (n = "5550100177"): Step[] => [...pick("mobile"), set({ "up.mobile": n }), press("Continue"), screen("code")];
const newEmail = (e = "new.alex@example.com"): Step[] => [...pick("email"), set({ "up.email": e }), press("Continue"), screen("code")];
const ADDR = { "up.line1": "5 Pine Avenue", "up.line2": "", "up.city": "Springfield", "up.state": "IL", "up.postal": "62704" };
const newAddress = (extra: Record<string, unknown> = {}): Step[] => [...pick("address"), set({ ...ADDR, ...extra }), press("Continue")];
/** The calls a person's own earlier change would have made: the code to the number on file, then the change. */
const earlier = (input: Record<string, unknown>) => [
  { adapter: "bank.otp.send", input: { channel: "sms", strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } },
  { adapter: "bank.profile.update", input: { verifyNewMobile: false, ...input } },
];
const off = { "opt.verifyNewMobile": false };
const emailWaits = earlier({ field: "email", value: "new.alex@example.com" });

export const updateProfileScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The first screen shows the number, the email and the address masked, and says where to go to change a name", covers: ["AC-1"], ...base,
    steps: [
      screen("what"), text("Contact details"), text("To change your name or ID document, visit a branch."), text("Mobile number · •••• 0142"), text("Email · a•••@example.com"), text("Address · 12 Harbour Road, Springfield, IL 10001"),
      noText("alex.morgan@example.com"), noText("415 555 0142"),
    ],
  },
  {
    id: "T-2", name: "A change that waits shows Pending with the new value masked, and cannot be chosen again; the others can", covers: ["AC-1"], ...base, setup: emailWaits,
    steps: [
      text("Email · Pending n•••@example.com"), text("Mobile number · •••• 0142"),
      ...pick("email"), screen("what"), text("A change to this is already waiting to be confirmed."),
      ...pick("mobile"), screen("mobile"), noText("A change to this is already waiting to be confirmed."),
    ],
  },
  {
    id: "T-3", name: "Nothing chosen is refused on the first screen", covers: ["AC-1"], ...base,
    steps: [press("Continue"), screen("what"), error("up.what")],
  },
  {
    id: "T-4", name: "Opened from a Change button or a link, the change is already chosen and still confirmed with Continue", covers: ["AC-1"], ...base, launch: { "launch.field": "phone" },
    steps: [screen("what"), press("Continue"), screen("mobile"), text("New mobile number")],
  },
  {
    id: "T-5", name: "A link with what = email chooses the email; one with what = address chooses the address", covers: ["AC-1"], ...base, launch: { "launch.what": "email" },
    steps: [press("Continue"), screen("email"), text("New email")],
  },
  {
    id: "T-6", name: "what = address opens the address step", covers: ["AC-1"], ...base, launch: { "launch.what": "address" },
    steps: [press("Continue"), screen("address"), text("New address")],
  },
  {
    id: "T-7", name: "The mobile number follows the market rule and cannot be the number it already is, however it is written", covers: ["AC-2"], ...base,
    steps: [
      ...pick("mobile"), press("Continue"), screen("mobile"), error("up.mobile"),
      set({ "up.mobile": "123" }), press("Continue"), screen("mobile"), text("Enter 10 digits."),
      set({ "up.mobile": "415 555 0142" }), press("Continue"), screen("mobile"), text("That is already your number."), noText("Enter 10 digits."),
      set({ "up.mobile": "415-555-0142" }), press("Continue"), text("That is already your number."),
      set({ "up.mobile": "4155550177" }), press("Continue"), text("We can’t use that number or email. Try another."),
      set({ "up.mobile": "555 010 0177" }), press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-8", name: "The email follows the shape, cannot be the one it already is (capitals ignored) and cannot belong to someone else", covers: ["AC-2"], ...base,
    steps: [
      ...pick("email"), set({ "up.email": "alex" }), press("Continue"), screen("email"), error("Enter an email like name@example.com."),
      set({ "up.email": "ALEX.MORGAN@example.com" }), press("Continue"), screen("email"), text("That is already your email."),
      set({ "up.email": "jamie.locke@example.com" }), press("Continue"), text("We can’t use that number or email. Try another."), noText("That is already your email."),
      set({ "up.email": "new.alex@example.com" }), press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-9", name: "The address must be filled in, follow the postal code rule and differ from the one on file", covers: ["AC-2"], ...base,
    steps: [
      ...pick("address"), press("Continue"), screen("address"), error("up.line1"), error("up.city"), error("up.state"), error("up.postal"),
      set({ ...ADDR, "up.postal": "12" }), press("Continue"), screen("address"), text("Enter a 5-digit postal code."),
      set({ "up.line1": "12 Harbour Road", "up.city": "Springfield", "up.state": "IL", "up.postal": "10001" }), press("Continue"), screen("address"), text("That is already your address."), noText("Enter a 5-digit postal code."),
      set({ "up.line1": "12 harbour road", "up.city": "springfield", "up.state": "il", "up.postal": "10001" }), press("Continue"), text("That is already your address."),
      set({ ...ADDR }), press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-10", name: "Every change asks for a code: a code to the phone ending 0142, wrong ones are refused with the tries left, the right one goes on", covers: ["AC-3"], ...base, launch: off,
    steps: [
      ...newMobile(), text("Enter your code"), text("Sent to the phone ending 0142."),
      ...code("000000"), screen("code"), text("That code isn’t right. Try again."), text("2 tries left."),
      ...code("111111"), text("1 try left."),
      ...code(), screen("done"), text("Mobile number updated"),
    ],
  },
  {
    id: "T-11", name: "Three wrong codes end the attempt: Too many wrong codes, nothing was changed, and the number is still the old one", covers: ["AC-3"], ...base, launch: off,
    steps: [
      ...newMobile(), ...code("000000"), ...code("000000"), ...code("000000"), screen("locked"), text("Too many wrong codes"), text("Too many wrong codes. Nothing was changed. Go back to start again."),
      profile("phoneMasked", "•••• 0142"), noText("5550100177"), press("Back to start"), screen("what"),
    ],
  },
  {
    id: "T-12", name: "A code that has expired says to go back and get a new one, and Back goes to the first screen", covers: ["AC-3"], ...base, launch: off,
    steps: [
      ...newMobile(), ...code("999999"), screen("code"), text("That code has expired. Go back to get a new one."), noText("tries left"), press("Back"), screen("what"),
      ...newMobile(), ...code(), screen("done"),
    ],
  },
  {
    id: "T-13", name: "An empty code is not sent", covers: ["AC-3"], ...base, launch: off,
    steps: [...newMobile(), press("Confirm"), screen("code"), error("up.code")],
  },
  {
    id: "T-14", name: "A code typed in the wrong form (letters, five digits) is refused on the screen", covers: ["AC-3"], ...base, launch: off,
    steps: [...newMobile(), ...code("12345"), screen("code"), error("up.code"), ...code("abcdef"), screen("code")],
  },
  {
    id: "T-15", name: "A new mobile number gets a code of its own, to the new number: Sent to the new number, then it saves with the old number told", covers: ["AC-4", "AC-5", "AC-7"], ...base,
    steps: [
      ...newMobile(), ...code(), screen("code2"), text("Confirm your new number"), text("Sent to the new number."),
      profile("phoneMasked", "•••• 0142"), ...code2(), screen("done"),
      text("Mobile number updated"), text("Mobile number"), text("•••• 0177"), text("Status"), text("Updated"), text("Old number"), text("Told by message"), noText("Pending"), noText("5550100177"),
      profile("phoneMasked", "•••• 0177"),
    ],
  },
  {
    id: "T-16", name: "The code to the new number: a wrong one is refused with the tries left; three wrong ones end it and nothing is changed; an expired one says to go back", covers: ["AC-4"], ...base,
    steps: [
      ...newMobile(), ...code(), screen("code2"),
      ...code2("000000"), screen("code2"), text("That code isn’t right. Try again."), text("2 tries left."),
      ...code2("000000"), ...code2("000000"), screen("locked"), text("Too many wrong codes. Nothing was changed. Go back to start again."), profile("phoneMasked", "•••• 0142"),
    ],
  },
  {
    id: "T-17", name: "An expired code to the new number says to go back; Back starts again", covers: ["AC-4"], ...base,
    steps: [...newMobile(), ...code(), ...code2("999999"), screen("code2"), text("That code has expired. Go back to get a new one."), press("Back"), screen("what"), profile("phoneMasked", "•••• 0142")],
  },
  {
    id: "T-18", name: "An empty or malformed code to the new number is not sent", covers: ["AC-4"], ...base,
    steps: [...newMobile(), ...code(), press("Save"), screen("code2"), error("up.code2"), ...code2("12"), screen("code2"), error("up.code2")],
  },
  {
    id: "T-19", name: "With verifyNewMobile off the change saves after the first code only", covers: ["AC-4", "AC-5"], ...base, launch: off, config: { options: { "update-profile": { verifyNewMobile: false } } },
    steps: [...newMobile(), ...code(), screen("done"), text("Mobile number updated"), profile("phoneMasked", "•••• 0177")],
  },
  {
    id: "T-20", name: "The bank asks for the code to the new number whatever a screen would do", covers: ["AC-4", "AC-9"], ...base,
    setup: [{ adapter: "bank.otp.send", input: { channel: "sms", strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } }],
    steps: [forced({ field: "mobile", value: "5550100177" }, "CONTACT_NOT_VERIFIED"), profile("phoneMasked", "•••• 0142")],
  },
  {
    id: "T-21", name: "An email waits: Change received, check your inbox, Pending; the email on file is unchanged", covers: ["AC-5", "AC-7"], ...base,
    steps: [
      ...newEmail(), ...code(), screen("done"), text("Change received"), text("Check your inbox and confirm the new address."), text("Pending"), text("Email"), text("n•••@example.com"), text("Status"),
      noText("Email updated"), noText("Old number"), noText("new.alex@example.com"), profile("email", "alex.morgan@example.com"), profile("pending.email", true),
    ],
  },
  {
    id: "T-22", name: "With verifyEmail off the email applies at once: Email updated, Updated", covers: ["AC-5", "AC-7"], ...base, launch: { "opt.verifyEmail": false }, config: { options: { "update-profile": { verifyEmail: false } } },
    steps: [...newEmail(), ...code(), screen("done"), text("Email updated"), text("n•••@example.com"), text("Updated"), noText("Pending"), profile("email", "new.alex@example.com"), profile("pending.email", false)],
  },
  {
    id: "T-23", name: "An address waits with verifyAddress on: Change received, We’ll check it and tell you, Pending, the whole address", covers: ["AC-5", "AC-7"], ...base,
    steps: [
      ...newAddress(), screen("code"), ...code(), screen("done"), text("Change received"), text("We’ll check it and tell you."), text("Pending"), text("Address"), text("5 Pine Avenue, Springfield, IL 62704"),
      profile("addressText", "12 Harbour Road, Springfield, IL 10001"), profile("pending.address", true),
    ],
  },
  {
    id: "T-24", name: "With verifyAddress off the address saves at once: Address updated, Updated, and the profile has it", covers: ["AC-5", "AC-7"], ...base, launch: { "opt.verifyAddress": false }, config: { options: { "update-profile": { verifyAddress: false } } },
    steps: [
      ...newAddress({ "up.line2": "Flat 2" }), ...code(), screen("done"), text("Address updated"), text("5 Pine Avenue, Flat 2, Springfield, IL 62704"), text("Updated"), noText("Pending"),
      profile("addressText", "5 Pine Avenue, Flat 2, Springfield, IL 62704"),
    ],
  },
  {
    id: "T-25", name: "With requireProof on the proof of address is asked for: a file that is not a PDF, JPG or PNG is refused, a PDF is accepted", covers: ["AC-6"], ...base, launch: { "opt.requireProof": true, "opt.verifyAddress": false }, config: { options: { "update-profile": { requireProof: true, verifyAddress: false } } },
    steps: [
      ...pick("address"), text("Proof of address"), set({ ...ADDR, "up.proof": { name: "photo.heic", size: 2048, kind: "image" } }), press("Continue"), screen("address"), error("up.proof"),
      set({ "up.proof": null }), press("Continue"), screen("address"), error("up.proof"),
      set({ "up.proof": { name: "utility-bill.pdf", size: 2048, kind: "pdf" } }), press("Continue"), screen("code"), ...code(), screen("done"), text("Address updated"),
    ],
  },
  {
    id: "T-26", name: "With requireProof off the proof field is absent", covers: ["AC-6"], ...base,
    steps: [...pick("address"), noText("Proof of address"), set({ ...ADDR }), press("Continue"), screen("code")],
  },
  {
    id: "T-27", name: "The bank asks for the proof itself when it is on, and refuses a file of another kind", covers: ["AC-6", "AC-9"], ...base, config: { options: { "update-profile": { requireProof: true } } },
    setup: [{ adapter: "bank.otp.send", input: { channel: "sms", strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } }],
    steps: [
      forced({ field: "address", ...{ line1: "5 Pine Avenue", city: "Springfield", state: "IL", postal: "62704" } }, "PROOF_REQUIRED"),
      forced({ field: "address", line1: "5 Pine Avenue", city: "Springfield", state: "IL", postal: "62704", proofName: "photo.heic" }, "FILE_TYPE"),
    ],
  },
  {
    id: "T-28", name: "Market B: the mobile number starts 7 or 07, the postal code follows the local pattern, and there is no State", covers: ["AC-2"], ...base, config: { homeMarket: "uk" },
    steps: [
      ...pick("mobile"), set({ "up.mobile": "5550100177" }), press("Continue"), screen("mobile"), text("Enter 10 or 11 digits starting 7 or 07."), text("11 digits"),
      set({ "up.mobile": "07700 900177" }), press("Continue"), screen("code"), press("Back"), ...pick("address"), noText("State"),
      set({ "up.line1": "5 Pine Road", "up.city": "London", "up.postal": "ZZZ" }), press("Continue"), text("Check the postal code."),
      set({ "up.postal": "SW1A 1AA" }), press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-29", name: "Market C: the number is 8 to 14 digits with the country code and the postal code 4 or 5 digits", covers: ["AC-2"], ...base, config: { homeMarket: "eu" },
    steps: [
      ...pick("mobile"), set({ "up.mobile": "1234567" }), press("Continue"), text("Enter 8 to 14 digits, with the country code."), text("With country code"),
      set({ "up.mobile": "+4915112345678" }), press("Continue"), screen("code"), press("Back"), ...pick("address"), noText("State"),
      set({ "up.line1": "Beispielstrasse 5", "up.city": "Berlin", "up.postal": "123" }), press("Continue"), text("Enter 4 or 5 digits."),
      set({ "up.postal": "10115" }), press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-30", name: "Market D: a mobile number like 0501234567, and no Postal code and no State field", covers: ["AC-2"], ...base, config: { homeMarket: "ae" },
    steps: [
      ...pick("mobile"), set({ "up.mobile": "5550100177" }), press("Continue"), text("Enter a mobile number, like 0501234567."), text("05XXXXXXXX"),
      set({ "up.mobile": "0501234567" }), press("Continue"), screen("code"), press("Back"), ...pick("address"), noText("Postal code"), noText("State"),
      set({ "up.line1": "Example Tower, Flat 1204", "up.city": "Dubai" }), press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-31", name: "Market A asks for the State and the Postal code", covers: ["AC-2"], ...base,
    steps: [...pick("address"), text("State"), text("Postal code")],
  },
  {
    id: "T-32", name: "When the bank is unavailable a mobile change is not made", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.profile.update"] },
    steps: [...pick("mobile"), set({ "up.mobile": "5550100177" }), press("Continue"), screen("unavailable"), text("We couldn’t reach the bank"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), profile("phoneMasked", "•••• 0142")],
  },
  {
    id: "T-33", name: "When the bank is unavailable an email change is not made", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.profile.update"] },
    steps: [...pick("email"), set({ "up.email": "new.alex@example.com" }), press("Continue"), screen("unavailable"), profile("email", "alex.morgan@example.com")],
  },
  {
    id: "T-34", name: "When the bank is unavailable an address change is not made", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.profile.update"] },
    steps: [...newAddress(), screen("unavailable"), profile("addressText", "12 Harbour Road, Springfield, IL 10001")],
  },
  {
    id: "T-35", name: "When the bank does not answer in time nothing is changed: This is taking longer than expected, and Try again starts again", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.profile.update"], latencyMs: 10000 },
    steps: [...pick("mobile"), set({ "up.mobile": "5550100177" }), press("Continue"), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("what")],
  },
  {
    id: "T-36", name: "When the bank cannot send the code nothing is changed", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...pick("mobile"), set({ "up.mobile": "5550100177" }), press("Continue"), screen("unavailable"), profile("phoneMasked", "•••• 0142")],
  },
  {
    id: "T-37", name: "When the bank does not answer in time on the code nothing is changed", covers: ["AC-8"], ...base, launch: off, conditions: { timeout: ["bank.otp.verify"], latencyMs: 10000 },
    steps: [...newMobile(), ...code(), screen("timeout"), text("Nothing was changed."), profile("phoneMasked", "•••• 0142")],
  },
  {
    id: "T-38", name: "When the bank cannot send the code to the new number nothing is changed", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.profile.sendContactCode"] },
    steps: [...newMobile(), ...code(), screen("unavailable"), profile("phoneMasked", "•••• 0142")],
  },
  {
    id: "T-39", name: "When the bank cannot check the code of the new number nothing is changed", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.profile.verifyContact"] },
    steps: [...newMobile(), ...code(), screen("code2"), ...code2(), screen("unavailable"), profile("phoneMasked", "•••• 0142")],
  },
  {
    id: "T-40", name: "When the contact details cannot be read nothing starts", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.profile.contacts"] },
    steps: [screen("unavailable"), noText("Mobile number")],
  },
  {
    id: "T-41", name: "Without profile.update it is not available, and the bank refuses the call and the codes to the new number", covers: ["AC-9"], ...base, conditions: { withoutPermissions: ["profile.update"] },
    steps: [screen("denied"), text("Not available"), forced({ field: "mobile", value: "5550100177" }, "PERMISSION_DENIED"), { expectBankError: { adapter: "bank.profile.sendContactCode", input: { channel: "sms", value: "5550100177" }, code: "PERMISSION_DENIED" } }],
  },
  {
    id: "T-42", name: "The bank itself asks for the code, refuses a change to an item that waits, bad values and numbers it cannot use, whatever a screen would do", covers: ["AC-9"], ...base, setup: emailWaits,
    steps: [
      forced({ field: "mobile", value: "5550100177", verifyNewMobile: false }, "OTP_REQUIRED"),
      forced({ field: "email", value: "other.alex@example.com" }, "ALREADY_PENDING"),
      forced({ field: "mobile", value: "123" }, "INVALID_MOBILE"), forced({ field: "mobile", value: "4155550142" }, "SAME_VALUE"), forced({ field: "mobile", value: "4155550177" }, "CONTACT_IN_USE"),
      forced({ field: "address", line1: "5 Pine Avenue", city: "Springfield", state: "IL", postal: "1" }, "INVALID_POSTAL"), forced({ field: "address", line1: "", city: "Springfield", state: "IL", postal: "62704" }, "ADDRESS_INCOMPLETE"),
      forced({ field: "address", line1: "12 Harbour Road", city: "Springfield", state: "IL", postal: "10001" }, "SAME_VALUE"), forced({ field: "name", value: "Alex" }, "FIELD_INVALID"),
      profile("email", "alex.morgan@example.com"),
    ],
  },
  {
    id: "T-43", name: "After a mobile change the old number is texted and the new number is texted; nothing holds a number or an address", covers: ["AC-10"], ...base, launch: off, config: { options: { "update-profile": { verifyNewMobile: false } } },
    steps: [
      ...newMobile(), ...code(), screen("done"),
      inspect("outbox", [{ to: "•••• 0142", channel: "sms", kind: "old-mobile" }, { to: "•••• 0177", channel: "sms", kind: "new-mobile" }]), inspect("log", ["profile.mobile.updated"]),
      text("Told by message"),
    ],
  },
  {
    id: "T-44", name: "After an email change that waits the old address is told and the new address is asked to confirm; an applied one tells both", covers: ["AC-10"], ...base,
    steps: [...newEmail(), ...code(), screen("done"), inspect("outbox", [{ to: "a•••@example.com", channel: "email", kind: "old-email" }, { to: "n•••@example.com", channel: "email", kind: "new-email" }]), inspect("log", ["profile.email.pending"])],
  },
  {
    id: "T-45", name: "An address change texts the number on file", covers: ["AC-10"], ...base, launch: { "opt.verifyAddress": false }, config: { options: { "update-profile": { verifyAddress: false } } },
    steps: [...newAddress(), ...code(), screen("done"), inspect("outbox", [{ to: "•••• 0142", channel: "sms", kind: "address" }]), inspect("log", ["profile.address.updated"])],
  },
  {
    id: "T-46", name: "A change that was refused tells nobody and logs nothing", covers: ["AC-10", "AC-3"], ...base, launch: off,
    steps: [...newMobile(), ...code("000000"), ...code("000000"), ...code("000000"), screen("locked"), inspect("outbox", []), inspect("log", [])],
  },
  {
    id: "T-47", name: "Back from a field goes to the first screen with nothing changed", covers: ["AC-1"], ...base,
    steps: [...pick("email"), press("Back"), screen("what"), ...pick("address"), press("Back"), screen("what"), ...pick("mobile"), press("Back"), screen("what"), profile("email", "alex.morgan@example.com")],
  },
  {
    id: "T-48", name: "After the result the new value is not on the screen or kept: the journey holds the masked answer", covers: ["AC-7", "AC-10"], ...base, launch: off,
    steps: [...newMobile(), ...code(), screen("done"), noText("5550100177"), noText("555 010 0177"), noText("482100"), press("Done")],
  },
];
