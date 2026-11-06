import { fromMinor, toMinor } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { Account, Persona, SandboxConditions } from "../index";
import type { Flaws } from "../business/corporate";
import type { BankConfig } from "../config";

/**
 * The More tab's own domains (BankWorkx, Personal: More): the contact details the bank holds and the changes asked for, the secure conversations with the bank, the service
 * requests, and the accounts at other banks the customer lets BankWorkx read. The sandbox side of update-profile, new-message, messages, service-request, my-requests and
 * connect-account. `Persona.more` is the seed; the profile itself stays in `retail.profile` and a connected account in `finance.linked`.
 *
 * What the sandbox says about a person is masked (the last four digits of a number, the first letter of an email); the notices it sends to the old and the new contact are
 * kept as text with a masked destination and no value; the log of a change holds what was done, never the value. A message or a request is what the person wrote, kept as
 * text and never as markup. Every rule can be switched off for the mutation check (Flaws).
 */
export type Address = { line1: string; line2?: string; city: string; state: string; postal: string };
export type MessageFile = { name: string; size: number };
export type ThreadMessage = { id: string; mine: boolean; sender: string; /** ISO */ at: string; text: string; file?: MessageFile };
export type Thread = {
  id: string; reference: string; subject: string; topic: string; status: "open" | "answered" | "closed"; /** an unread bank message */ unread: boolean;
  messages: ThreadMessage[]; accountId?: string; /** ISO: when the bank answers a new conversation (the sandbox does it two seconds later) */ replyAt?: string;
};
export type RequestKind = "cheque" | "letter" | "acctype" | "other";
export type RequestStatus = "Received" | "In progress" | "Done" | "Cancelled";
export type ServiceRequest = { id: string; reference: string; kind: RequestKind; title: string; /** ISO date */ date: string; status: RequestStatus; rows: { label: string; value: string }[]; accountId?: string };
export type PendingChange = { field: "mobile" | "email" | "address"; reference: string; /** ISO */ at: string; mobile?: string; email?: string; address?: Address };
export type Notice = { /** a masked destination, never a number or an address */ to: string; channel: "sms" | "email" | "message"; kind: string; text: string };
export type MoreSeed = { threads: Thread[]; requests: ServiceRequest[]; pending: PendingChange[]; outbox: Notice[]; log: { at: string; action: string }[] };

export const TOPICS = ["Account", "Cards", "Payments", "Fraud or security", "Feedback", "Something else"];
export const BRANCHES = ["Main Street", "Riverside", "Station Road"];
export const LETTERS = ["Account confirmation", "Proof of address", "Balance confirmation", "Interest certificate"];
export const ACCOUNT_TYPES = ["Everyday", "Savings", "Premium"];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const REPLY_AFTER_MS = 2000;
export const FIXED_CONTACT_CODE = "482100";
const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BANK_SENDER = "BankWorkx®";
const SUPPORT = "BankWorkx® Support";
/** Other customers' numbers and emails of the sandbox: a change to one of them is refused (CONTACT_IN_USE). */
const IN_USE_MOBILE = ["4155550177", "4155550150", "4155550163", "4155550121", "4155550188", "4155550199"];
const IN_USE_EMAIL = ["jamie.locke@example.com", "omar.nassar@example.com", "yasmin.khoury@example.com", "noor.hayes@example.com", "riley.park@example.com", "sam.rivera@example.com"];

/** The banks a customer can connect (invented). The first has one account, the others three; Lakeside Bank never answers. */
export const CONNECT_BANKS = [
  { id: "harbor", name: "Harbor Bank" }, { id: "maple", name: "Maple Credit Union" }, { id: "northern", name: "Northern Savings" }, { id: "summit-bank", name: "Summit Bank" },
  { id: "lakeside", name: "Lakeside Bank" }, { id: "oakridge", name: "Oakridge Building Society" }, { id: "crown", name: "Crown Trust" }, { id: "bayview", name: "Bayview Bank" },
] as const;
/** How long sharing lasts and the symbol before an amount, by the market the bank is at home in. */
export const SHARING: Record<"A" | "B" | "C" | "D", { days: number; symbol: string; currency: string }> = {
  A: { days: 365, symbol: "$", currency: "USD" }, B: { days: 90, symbol: "£", currency: "GBP" }, C: { days: 180, symbol: "€", currency: "EUR" }, D: { days: 365, symbol: "AED ", currency: "AED" },
};

const dayText = (t: number) => `${new Date(t).getUTCDate()} ${MONTHS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCFullYear()}`;
const shortDay = (t: number) => `${new Date(t).getUTCDate()} ${MONTHS[new Date(t).getUTCMonth()]}`;
const hm = (t: number) => new Date(t).toISOString().slice(11, 16);
const stamp = (t: number) => `${WEEKDAYS[new Date(t).getUTCDay()]} ${shortDay(t)}, ${hm(t)}`;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const onlyDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const maskLast4 = (phone: string) => `•••• ${onlyDigits(phone).slice(-4)}`;
const maskEmail = (email: string) => { const [u = "", d = ""] = email.split("@"); return `${u.slice(0, 1)}•••@${d}`; };
const addressText = (a: Address) => [a.line1, a.line2, a.city, [a.state, a.postal].filter(Boolean).join(" ")].filter(Boolean).join(", ");
const typeOf = (a: Account) => (a.kind === "savings" ? "Savings" : "Everyday");
const label = (a: Account) => `${a.nickname || a.name} ${a.maskedNumber}`;
const extOf = (name: string) => /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
const FILE_TYPES = ["pdf", "jpg", "jpeg", "png"];
const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/* ------------------------------------------------------------------------------------------------------- the seed */

/** Alex Morgan's conversations and requests (synthetic), as the spec of the More tab lists them. */
export function alexMore(): MoreSeed {
  return {
    threads: [
      {
        id: "thr_card", reference: "MSG-20261102-0007", subject: "Your new card is on its way", topic: "Cards", status: "answered", unread: true,
        messages: [{ id: "m_card1", mine: false, sender: BANK_SENDER, at: "2026-11-02T10:12:00Z", text: "Your replacement debit card has been sent. It should arrive in 3 to 5 working days. Activate it in the app when it arrives." }],
      },
      {
        id: "thr_fee", reference: "MSG-20261029-0006", subject: "Question about a monthly fee", topic: "Account", status: "answered", unread: false,
        messages: [
          { id: "m_fee1", mine: true, sender: "You", at: "2026-10-29T14:30:00Z", text: "Why was I charged a monthly fee on my Main account last month?" },
          { id: "m_fee2", mine: false, sender: `Sara, ${BANK_SENDER}`, at: "2026-10-30T09:48:00Z", text: "Hi Alex, the fee applies when the balance falls below the minimum on the 1st. We have refunded it this time, and it won't apply again while your salary comes in." },
        ],
      },
    ],
    requests: [
      { id: "SR-204118", reference: "SR-204118", kind: "cheque", title: "Order cheque book", date: "2026-10-28", status: "In progress", accountId: "acc_main", rows: [{ label: "Account", value: "Main ••4410" }, { label: "Leaves", value: "25" }, { label: "Delivery", value: "Post to your address" }] },
      { id: "SR-203077", reference: "SR-203077", kind: "letter", title: "Request a letter", date: "2026-10-12", status: "Done", accountId: "acc_main", rows: [{ label: "Letter", value: "Proof of address" }, { label: "Account", value: "Main ••4410" }, { label: "Delivery", value: "Email" }] },
    ],
    pending: [], outbox: [], log: [],
  };
}
export const emptyMore = (): MoreSeed => ({ threads: [], requests: [], pending: [], outbox: [], log: [] });

/* ------------------------------------------------------------------------------------------------------ the bank */

export type MoreHost = {
  now: () => number; otp: { attempts: number; verified: boolean }; conditions: () => SandboxConditions; flaws: Flaws; config: () => BankConfig;
  /** The bank's own record of how to reach the customer changed (sign-in and recovery use it): the new mobile number or email. */
  contact?: (field: "mobile" | "email", value: string) => void;
};
const ADAPTERS = /^(bank\.(profile\.(get|contacts|update|sendContactCode|verifyContact)|messages\.(list|get|markRead|send|reply)|requests\.(options|create|list|get|cancel)|accounts\.linked|connections\.(banks|start|finish|remove))|sandbox\.more\.(inspect|advance))$/;
const MARKET_BY_HOME = { us: "A", uk: "B", eu: "C", ae: "D", sa: "D", jo: "D" } as const;
const MARKET = {
  A: { hint: "10 digits", mobile: /^\d{10}$/, mobileMessage: "Enter 10 digits.", prefix: "+1 ", postal: /^\d{5}(-\d{4})?$/, postalMessage: "Enter a 5-digit postal code.", state: true, postalField: true },
  B: { hint: "11 digits", mobile: /^0?7\d{9}$/, mobileMessage: "Enter 10 or 11 digits starting 7 or 07.", prefix: "+44 ", postal: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/, postalMessage: "Check the postal code.", state: false, postalField: true },
  C: { hint: "With country code", mobile: /^\+?\d{8,14}$/, mobileMessage: "Enter 8 to 14 digits, with the country code.", prefix: "", postal: /^\d{4,5}$/, postalMessage: "Enter 4 or 5 digits.", state: false, postalField: true },
  D: { hint: "05XXXXXXXX", mobile: /^05\d{8}$/, mobileMessage: "Enter a mobile number, like 0501234567.", prefix: "+971 ", postal: /^$/, postalMessage: "", state: false, postalField: false },
} as const;

export class MoreApi {
  private seq = { thread: 0, message: 0, request: 0, change: 0, connect: 0 };
  /** The code sent to a new mobile number: how many wrong tries, when it went out, and the number it was verified for. */
  private newCode: { value: string; sentAt: number; wrong: number } | undefined;
  private newVerified: string | undefined;
  /** The connection that was started: its state, the bank and the accounts the bank offered. */
  private connecting: { state: string; bankId: string; offered: { kind: "Current" | "Savings" | "Credit"; last4: string; cents: number }[] } | undefined;
  constructor(private p: Persona, private host: MoreHost) {}
  private get f() { return this.host.flaws; }
  private now = () => this.host.now();
  private get data(): MoreSeed {
    if (!this.p.more) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    return this.p.more;
  }
  private market = () => MARKET_BY_HOME[this.host.config().homeMarket] ?? "A";
  private opt = (slug: string, key: string) => this.host.config().options[slug]?.[key];
  private profile() {
    const pr = this.p.retail?.profile;
    if (!pr) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    return pr;
  }
  private ensureOtp() { if (!this.host.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified"); }
  private note(n: Notice) { if (this.f.contactNotify !== false) this.data.outbox.push(n); }
  private log(action: string) { this.data.log.push({ at: new Date(this.now()).toISOString(), action }); }
  private notify(text: string) {
    if (!this.p.retail) return;
    this.p.retail.notifications.unshift({ id: `n_more${++this.seq.change + 100}`, context: "personal", text, at: new Date(this.now()).toISOString(), read: false, topic: "account" });
  }

  /** Whether this class answers the adapter: the three that older records answered (the profile, the messages and the requests) only for a customer who has the new ones. */
  handles = (adapter: string) => ADAPTERS.test(adapter) && (!!this.p.more || !/^bank\.(messages\.list|requests\.list|profile\.get)$/.test(adapter));

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.profile.get": return this.get();
      case "bank.profile.contacts": return this.contacts();
      case "bank.profile.update": return this.update(input);
      case "bank.profile.sendContactCode": return this.sendContactCode(input);
      case "bank.profile.verifyContact": return this.verifyContact(input);
      case "bank.messages.list": return this.threadList();
      case "bank.messages.get": return this.threadGet(input);
      case "bank.messages.markRead": return this.markRead(input);
      case "bank.messages.send": return this.send(input);
      case "bank.messages.reply": return this.reply(input);
      case "bank.requests.options": return this.requestOptions(input);
      case "bank.requests.create": return this.createRequest(input);
      case "bank.requests.list": return this.requestList();
      case "bank.requests.get": return this.requestView(this.request(input.requestId));
      case "bank.requests.cancel": return this.cancelRequest(input);
      case "bank.accounts.linked": return this.linked();
      case "bank.connections.banks": return this.banks();
      case "bank.connections.start": return this.startConnection(input);
      case "bank.connections.finish": return this.finishConnection(input);
      case "bank.connections.remove": return this.removeConnection(input);
      case "sandbox.more.inspect": return this.inspect();
      case "sandbox.more.advance": return this.advance(input);
    }
    throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
  }

  /* ----------------------------------------------------------------------------------------- the profile */

  private pendingOf(field: PendingChange["field"]) { return this.data.pending.find((x) => x.field === field); }
  private addressOf(): Address {
    const a = this.profile().address;
    return { line1: a.line1, ...(a.line2 ? { line2: a.line2 } : {}), city: a.city, state: a.region, postal: a.postalCode };
  }
  /** What the Profile screen shows: the details the bank holds (the customer's own, in full) and whether a change waits. */
  private get() {
    const pr = this.profile(), addr = this.addressOf();
    return {
      ...pr, customerId: "BWX-0042-1187", kycLevel: "Verified", memberSince: dayText(Date.parse(pr.customerSince)).replace(/^\d+ /, ""),
      addressText: addressText(addr), phoneMasked: maskLast4(pr.phone), emailMasked: maskEmail(pr.email),
      pending: { mobile: !!this.pendingOf("mobile"), email: !!this.pendingOf("email"), address: !!this.pendingOf("address") },
    };
  }
  /** What update-profile shows on its first screen and in its fields: masked values, what is pending, and what the home market asks for. */
  private contacts() {
    const pr = this.profile(), m = this.market(), rule = MARKET[m], addr = this.addressOf();
    const pm = this.pendingOf("mobile"), pe = this.pendingOf("email"), pa = this.pendingOf("address");
    const choice = (id: string, name: string) => ({ id, name });
    return {
      market: m, mobileHint: rule.hint, phoneEnding: onlyDigits(pr.phone).slice(-4), state: rule.state, postal: rule.postalField,
      mobileMasked: maskLast4(pr.phone), emailMasked: maskEmail(pr.email), addressText: addressText(addr),
      pending: { mobile: !!pm, email: !!pe, address: !!pa },
      choices: {
        mobile: choice("mobile", `Mobile number · ${pm ? `Pending ${maskLast4(pm.mobile!)}` : maskLast4(pr.phone)}`),
        email: choice("email", `Email · ${pe ? `Pending ${maskEmail(pe.email!)}` : maskEmail(pr.email)}`),
        address: choice("address", `Address · ${pa ? `Pending ${addressText(pa.address!)}` : addressText(addr)}`),
      },
    };
  }

  private normalMobile(raw: unknown) {
    const m = this.market(), rule = MARKET[m], s = String(raw ?? "").replace(/[\s-]/g, "");
    if (this.f.contactRules !== false && !rule.mobile.test(s)) throw new BankError("INVALID_MOBILE", rule.mobileMessage);
    const digits = onlyDigits(s);
    const local = m === "D" ? digits.replace(/^0/, "") : m === "B" ? digits.replace(/^0/, "") : digits;
    const grouped = m === "A" ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : m === "C" ? `${s.startsWith("+") ? "" : "+"}${digits}` : local;
    return { value: m === "C" ? grouped : `${rule.prefix}${grouped}`.trim(), digits };
  }
  private checkAddress(input: Record<string, any>): Address {
    const m = this.market(), rule = MARKET[m];
    const a: Address = { line1: String(input.line1 ?? "").trim(), ...(String(input.line2 ?? "").trim() ? { line2: String(input.line2).trim() } : {}), city: String(input.city ?? "").trim(), state: rule.state ? String(input.state ?? "").trim() : "", postal: rule.postalField ? String(input.postal ?? "").trim() : "" };
    if (this.f.contactRules !== false) {
      if (!a.line1 || !a.city || (rule.state && !a.state)) throw new BankError("ADDRESS_INCOMPLETE", "This is required.");
      if (a.line1.length > 60 || (a.line2?.length ?? 0) > 60 || a.city.length > 40 || a.state.length > 30 || a.postal.length > 10) throw new BankError("ADDRESS_TOO_LONG", "That is too long. Use fewer characters.");
      if (rule.postalField && !rule.postal.test(a.postal)) throw new BankError("INVALID_POSTAL", rule.postalMessage);
    }
    return a;
  }
  private same(a: Address, b: Address) {
    const n = (x: Address) => [x.line1, x.line2 ?? "", x.city, x.state, x.postal].map((v) => v.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
    return n(a) === n(b);
  }
  private shape(field: "mobile" | "email" | "address", status: "updated" | "pending", value: string, reference: string, told: boolean) {
    const name = field === "mobile" ? "Mobile number" : field === "email" ? "Email" : "Address";
    return {
      reference, field, fieldName: name, status, statusText: status === "updated" ? "Updated" : "Pending", valueText: value,
      title: status === "updated" ? `${name} updated` : "Change received",
      text: status === "updated" ? "" : field === "email" ? "Check your inbox and confirm the new address." : "We’ll check it and tell you.",
      oldTold: told, oldToldText: field === "mobile" ? "Told by message" : "",
    };
  }

  /** Changes the mobile number, the email or the address. Every rule is applied; a dry run changes nothing and asks for no code (the review before the code). */
  private update(input: Record<string, any>) {
    const field = String(input.field ?? "");
    if (field !== "mobile" && field !== "email" && field !== "address") throw new BankError("FIELD_INVALID", "Choose what to change.");
    const pr = this.profile(), dry = input.dryRun === true, f = this.f;
    const verifyNew = this.opt("update-profile", "verifyNewMobile") !== false && input.verifyNewMobile !== false;
    const waitEmail = this.opt("update-profile", "verifyEmail") !== false && input.verifyEmail !== false;
    const waitAddress = this.opt("update-profile", "verifyAddress") !== false && input.verifyAddress !== false;
    const needProof = this.opt("update-profile", "requireProof") === true || input.requireProof === true;
    let mobile: { value: string; digits: string } | undefined, email = "", address: Address | undefined;
    if (field === "mobile") {
      mobile = this.normalMobile(input.value);
      if (f.contactSame !== false) {
        if (mobile.digits.slice(-9) === onlyDigits(pr.phone).slice(-9)) throw new BankError("SAME_VALUE", "That is already your number.");
        if (IN_USE_MOBILE.includes(mobile.digits.slice(-10))) throw new BankError("CONTACT_IN_USE", "We can’t use that number or email. Try another.");
      }
    } else if (field === "email") {
      email = String(input.value ?? "").trim();
      if (f.contactRules !== false && (email.length > 80 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) throw new BankError("INVALID_EMAIL", "Enter an email like name@example.com.");
      if (f.contactSame !== false) {
        if (email.toLowerCase() === pr.email.toLowerCase()) throw new BankError("SAME_VALUE", "That is already your email.");
        if (IN_USE_EMAIL.includes(email.toLowerCase())) throw new BankError("CONTACT_IN_USE", "We can’t use that number or email. Try another.");
      }
    } else {
      address = this.checkAddress(input);
      if (f.contactSame !== false && this.same(address, this.addressOf())) throw new BankError("SAME_VALUE", "That is already your address.");
    }
    if (f.contactPending !== false && this.pendingOf(field)) throw new BankError("ALREADY_PENDING", "A change to this is already waiting to be confirmed.");
    if (field === "address" && f.contactProof !== false && needProof) {
      const proof = String(input.proofName ?? "").trim();
      if (!proof) throw new BankError("PROOF_REQUIRED", "Add a recent bill or statement.");
      if (!FILE_TYPES.includes(extOf(proof))) throw new BankError("FILE_TYPE", "Use a PDF, JPG or PNG.");
    }
    const waits = field === "email" ? waitEmail : field === "address" ? waitAddress : false;
    if (dry) return { ok: true, field, needsNewCode: field === "mobile" && verifyNew, wouldWait: waits, valueText: field === "mobile" ? maskLast4(mobile!.value) : field === "email" ? maskEmail(email) : addressText(address!) };
    if (f.contactCode !== false) this.ensureOtp();
    if (field === "mobile" && verifyNew && f.contactNewNumber !== false && this.newVerified !== mobile!.digits) throw new BankError("CONTACT_NOT_VERIFIED", "Confirm the new number first.");
    this.host.otp.verified = false; this.newVerified = undefined; this.newCode = undefined;
    const at = new Date(this.now()).toISOString(), reference = `PC-${ymd(this.now())}-${String(++this.seq.change).padStart(4, "0")}`;
    const oldPhone = pr.phone, oldEmail = pr.email;
    if (field === "mobile") {
      pr.phone = mobile!.value; this.p.phone = mobile!.value; this.host.contact?.("mobile", mobile!.value);
      this.note({ to: maskLast4(oldPhone), channel: "sms", kind: "old-mobile", text: "Your mobile number was changed. If this wasn’t you, call us now." });
      this.note({ to: maskLast4(mobile!.value), channel: "sms", kind: "new-mobile", text: "This number is now on your BankWorkx® profile." });
      this.log("profile.mobile.updated"); this.notify("Mobile number updated");
      return this.shape("mobile", "updated", maskLast4(mobile!.value), reference, f.contactNotify !== false);
    }
    if (field === "email") {
      if (waits) {
        this.data.pending.push({ field, reference, at, email });
        this.note({ to: maskEmail(oldEmail), channel: "email", kind: "old-email", text: "A change of your email address was asked for. If this wasn’t you, call us now." });
        this.note({ to: maskEmail(email), channel: "email", kind: "new-email", text: "Confirm this address to finish the change." });
        this.log("profile.email.pending"); this.notify("Email change received");
        return this.shape("email", "pending", maskEmail(email), reference, f.contactNotify !== false);
      }
      pr.email = email; this.host.contact?.("email", email);
      this.note({ to: maskEmail(oldEmail), channel: "email", kind: "old-email", text: "Your email address was changed. If this wasn’t you, call us now." });
      this.note({ to: maskEmail(email), channel: "email", kind: "new-email", text: "This address is now on your BankWorkx® profile." });
      this.log("profile.email.updated"); this.notify("Email updated");
      return this.shape("email", "updated", maskEmail(email), reference, f.contactNotify !== false);
    }
    const text = addressText(address!);
    if (waits) {
      this.data.pending.push({ field, reference, at, address });
      this.note({ to: maskLast4(pr.phone), channel: "sms", kind: "address", text: "A change of your home address was asked for. If this wasn’t you, call us now." });
      this.log("profile.address.pending"); this.notify("Address change received");
      return this.shape("address", "pending", text, reference, f.contactNotify !== false);
    }
    pr.address = { ...pr.address, line1: address!.line1, ...(address!.line2 ? { line2: address!.line2 } : {}), city: address!.city, region: address!.state, postalCode: address!.postal };
    if (!address!.line2) delete (pr.address as { line2?: string }).line2;
    this.note({ to: maskLast4(pr.phone), channel: "sms", kind: "address", text: "Your home address was changed. If this wasn’t you, call us now." });
    this.log("profile.address.updated"); this.notify("Address updated");
    return this.shape("address", "updated", text, reference, f.contactNotify !== false);
  }

  /** The code to the new number: the same codes as the one-time code of a change (482100; 000000 is wrong, 999999 expired), its own three tries. */
  private sendContactCode(input: Record<string, any>) {
    if (String(input.channel ?? "sms") !== "sms") throw new BankError("CHANNEL_INVALID", "Choose how to send the code.");
    const m = this.normalMobile(input.value);
    if (this.f.contactSame !== false && m.digits.slice(-9) === onlyDigits(this.profile().phone).slice(-9)) throw new BankError("SAME_VALUE", "That is already your number.");
    this.newCode = { value: m.digits, sentAt: this.now(), wrong: 0 }; this.newVerified = undefined;
    return { sent: true, masked: maskLast4(m.value), last4: m.digits.slice(-4) };
  }
  private verifyContact(input: Record<string, any>) {
    const c = this.newCode, m = this.normalMobile(input.value);
    if (!c || c.value !== m.digits) throw new BankError("OTP_REQUIRED", "Ask for a code first.");
    if (c.wrong >= 3 && this.f.contactNewNumber !== false) throw new BankError("OTP_LOCKED", "Too many wrong codes.", c.wrong);
    const code = String(input.code ?? "");
    if (code === "999999" || this.now() - c.sentAt > 5 * 60_000) throw new BankError("OTP_EXPIRED", "That code has expired. Go back to get a new one.");
    if (code !== FIXED_CONTACT_CODE) {
      c.wrong += 1;
      if (c.wrong >= 3 && this.f.contactNewNumber !== false) throw new BankError("OTP_LOCKED", "Too many wrong codes.", c.wrong);
      throw new BankError("OTP_INVALID", "That code isn’t right.", c.wrong);
    }
    this.newVerified = m.digits; this.newCode = undefined;
    return { verified: true };
  }

  /* ---------------------------------------------------------------------------------------------- messages */

  /** The bank answers a new conversation two seconds after it was sent: when that time has come the answer is added, unread. */
  private settle() {
    for (const t of this.data.threads) {
      if (t.replyAt && this.now() >= Date.parse(t.replyAt)) {
        t.messages.push({ id: `m_${++this.seq.message + 100}`, mine: false, sender: SUPPORT, at: t.replyAt, text: "Thanks Alex. We have your message and will reply within 1 working day." });
        t.unread = true; t.status = t.status === "closed" ? "closed" : "answered"; delete t.replyAt;
      }
    }
  }
  private lastAt = (t: Thread) => Date.parse(t.messages[t.messages.length - 1]!.at);
  private thread(id: unknown): Thread {
    this.settle();
    const t = this.data.threads.find((x) => x.id === id);
    if (!t) throw new BankError("THREAD_NOT_FOUND", "We can’t find that conversation.");
    return t;
  }
  private statusOf = (t: Thread) => (t.status === "closed" ? "Closed" : t.messages[t.messages.length - 1]!.mine ? "Open" : "Answered");
  private threadList() {
    this.settle();
    const list = [...this.data.threads].sort((a, b) => this.lastAt(b) - this.lastAt(a) || b.id.localeCompare(a.id));
    return Object.fromEntries(list.map((t, k) => {
      const last = t.messages[t.messages.length - 1]!, at = Date.parse(last.at);
      return [t.id, {
        id: t.id, rank: k + 1, reference: t.reference, subject: t.subject, topic: t.topic, status: this.statusOf(t), unread: t.unread, read: !t.unread, preview: clip(last.text, 70), dateText: shortDay(at), at: last.at,
        lastFrom: last.mine ? "you" : "bank", hasFile: t.messages.some((m) => !!m.file), count: t.messages.length, closed: t.status === "closed",
      }];
    }));
  }
  private threadGet(input: Record<string, any>) {
    const t = this.thread(input.threadId);
    return {
      id: t.id, reference: t.reference, subject: t.subject, topic: t.topic, status: this.statusOf(t), unread: t.unread, closed: t.status === "closed", accountId: t.accountId ?? "",
      messages: t.messages.map((m) => ({ id: m.id, mine: m.mine, who: m.sender, at: m.at, timeText: stamp(Date.parse(m.at)), text: m.text, fileName: m.file?.name ?? "", fileText: m.file ? `${m.file.name} · ${sizeText(m.file.size)}` : "", hasFile: !!m.file })),
    };
  }
  private markRead(input: Record<string, any>) { const t = this.thread(input.threadId); t.unread = false; return { ok: true }; }

  private send(input: Record<string, any>) {
    const f = this.f, subject = String(input.subject ?? "").trim(), text = String(input.text ?? ""), topic = String(input.topic ?? "");
    if (f.messageRules !== false) {
      if (!TOPICS.includes(topic)) throw new BankError("TOPIC_INVALID", "Choose a topic.");
      if (subject.length < 3 || subject.length > 80) throw new BankError("SUBJECT_INVALID", "Use at least 3 characters.");
      if (text.trim().length < 10 || text.length > 1000) throw new BankError("TEXT_INVALID", "Write at least 10 characters.");
    }
    const fileName = String(input.fileName ?? "").trim(), size = Number(input.fileSize ?? 0);
    let file: MessageFile | undefined;
    if (fileName) {
      if (this.opt("new-message", "allowFile") === false || input.allowFile === false) throw new BankError("FILE_NOT_ALLOWED", "Attachments aren’t available.");
      if (f.messageFile !== false) {
        if (!FILE_TYPES.includes(extOf(fileName))) throw new BankError("FILE_TYPE", "Use a PDF, JPG or PNG.");
        if (!(size > 0) || size > MAX_FILE_BYTES) throw new BankError("FILE_TOO_LARGE", "That file is over 5 MB.");
      }
      file = { name: fileName, size };
    }
    this.settle();
    const at = new Date(this.now()).toISOString();
    const t: Thread = {
      id: `thr_${this.data.threads.length + 1}`, reference: `MSG-${ymd(this.now())}-${String(7 + ++this.seq.thread).padStart(4, "0")}`, subject, topic, status: "open", unread: false,
      messages: [{ id: `m_${++this.seq.message}`, mine: true, sender: "You", at, text, ...(file ? { file } : {}) }], ...(input.accountId ? { accountId: String(input.accountId) } : {}),
      replyAt: new Date(this.now() + REPLY_AFTER_MS).toISOString(),
    };
    this.data.threads.unshift(t);
    return { threadId: t.id, reference: t.reference };
  }
  private reply(input: Record<string, any>) {
    const t = this.thread(input.threadId), text = String(input.text ?? "");
    if (this.f.replyRules !== false) {
      if (t.status === "closed") throw new BankError("THREAD_CLOSED", "This conversation is closed. Start a new message.");
      if (text.trim().length < 2 || text.length > 1000) throw new BankError("REPLY_INVALID", "Write a message first.");
    }
    const m: ThreadMessage = { id: `m_${++this.seq.message}`, mine: true, sender: "You", at: new Date(this.now()).toISOString(), text };
    t.messages.push(m); t.status = "open";
    return { messageId: m.id };
  }

  /* ------------------------------------------------------------------------------------ service requests */

  private request(id: unknown): ServiceRequest {
    const r = this.data.requests.find((x) => x.id === id);
    if (!r) throw new BankError("REQUEST_NOT_FOUND", "We can’t find that request.");
    return r;
  }
  private requestView(r: ServiceRequest) {
    const at = Date.parse(r.date);
    return { id: r.id, reference: r.reference, kind: r.kind, type: r.title, title: r.title, summary: r.title, date: dayText(at), dateIso: r.date, status: r.status, rows: r.rows.map((x) => ({ ...x })), canCancel: r.status === "Received", line: `${dayText(at)} · ${r.reference}` };
  }
  private requestList() {
    const list = [...this.data.requests].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    return Object.fromEntries(list.map((r, k) => [r.id, { ...this.requestView(r), rank: k + 1 }]));
  }
  private offered(kind: string) {
    if (kind === "lost" || kind === "other") return true;
    const key = kind === "cheque" ? "cheque" : kind === "letter" ? "letter" : "acctype";
    return this.opt("service-request", key) !== false;
  }
  /** What the form needs: the kinds on offer, the accounts, the branches, the letters, and for an account the types it can change to. */
  private requestOptions(input: Record<string, any>) {
    const kinds: Record<string, { id: string; name: string }> = {};
    for (const [id, name] of [["cheque", "Order cheque book"], ["letter", "Request a letter"], ["lost", "Report a lost card"], ["acctype", "Change account type"], ["other", "Other"]] as const) if (this.offered(id)) kinds[id] = { id, name };
    const accs = this.p.accounts.filter((a) => a.status !== "closing");
    const accounts = Object.fromEntries(accs.map((a) => [a.id, { id: a.id, name: label(a) }]));
    const picked = this.p.accounts.find((a) => a.id === input.accountId) ?? accs[0];
    const current = picked ? typeOf(picked) : "";
    const off = this.host.config().disabled;
    // the card journeys that can freeze a card are report-lost-card, block-card and card-controls; BankWorkx has card-controls
    const cardJourney = ["card-controls"].find((s) => !off.includes(s)) ?? "";
    return {
      kinds, kindCount: Object.keys(kinds).length, accounts, accountCount: accs.length, firstAccountId: accs[0]?.id ?? "",
      branches: Object.fromEntries(BRANCHES.map((b) => [b, { id: b, name: b }])), letters: Object.fromEntries(LETTERS.map((l) => [l, { id: l, name: l }])),
      currentType: current, changeTo: Object.fromEntries(ACCOUNT_TYPES.filter((t) => this.f.requestTypeChange === false || t !== current).map((t) => [t, { id: t, name: t }])), cardJourney,
    };
  }
  private createRequest(input: Record<string, any>) {
    const f = this.f, type = String(input.type ?? "");
    if (type === "lost") throw new BankError("USE_CARD_OPTIONS", "Use your card options to freeze the card.");
    if (!["cheque", "letter", "acctype", "other"].includes(type)) throw new BankError("TYPE_INVALID", "Choose what you need.");
    if (f.requestOptions !== false && !this.offered(type)) throw new BankError("TYPE_UNAVAILABLE", "This isn’t available at your bank.");
    const kind = type as RequestKind, rules = f.requestRules !== false;
    const account = this.p.accounts.find((a) => a.id === input.accountId);
    const needAccount = kind !== "other";
    if (needAccount && !account) throw new BankError("ACCOUNT_NOT_FOUND", "We can’t find that account. Choose another.");
    const collect = (v: unknown) => String(v ?? "") === "Collect at a branch";
    const branch = String(input.branch ?? "");
    if (rules && collect(input.delivery) && !BRANCHES.includes(branch)) throw new BankError("BRANCH_INVALID", "This is required.");
    let rows: ServiceRequest["rows"] = [], title = "";
    if (kind === "cheque") {
      title = "Order cheque book";
      const leaves = String(input.leaves ?? "25");
      if (rules && !["25", "50"].includes(leaves)) throw new BankError("LEAVES_INVALID", "Choose 25 or 50 leaves.");
      const post = String(input.delivery ?? "Post to my address") !== "Collect at a branch";
      if (f.requestDuplicate !== false && this.data.requests.some((r) => r.kind === "cheque" && r.accountId === account!.id && r.status !== "Done" && r.status !== "Cancelled")) throw new BankError("DUPLICATE", "You already have this request open.");
      rows = [{ label: "Account", value: label(account!) }, { label: "Leaves", value: leaves }, { label: "Delivery", value: post ? "Post to your address" : `Collect at ${branch}` }];
    } else if (kind === "letter") {
      title = "Request a letter";
      const letter = String(input.letter ?? ""), delivery = String(input.delivery ?? "Post");
      if (rules && !LETTERS.includes(letter)) throw new BankError("LETTER_INVALID", "This is required.");
      if (rules && !["Email", "Post", "Collect at a branch"].includes(delivery)) throw new BankError("DELIVERY_INVALID", "Choose how to get it.");
      const to = String(input.addressedTo ?? "").trim();
      if (rules && to.length > 60) throw new BankError("ADDRESSED_TO_INVALID", "Use 60 characters or fewer.");
      rows = [{ label: "Letter", value: letter }, { label: "Account", value: label(account!) }, { label: "Delivery", value: collect(delivery) ? `Collect at ${branch}` : delivery }, ...(to ? [{ label: "Addressed to", value: to }] : [])];
    } else if (kind === "acctype") {
      title = "Change account type";
      const to = String(input.changeTo ?? ""), reason = String(input.reason ?? "").trim();
      if (rules && !ACCOUNT_TYPES.includes(to)) throw new BankError("TYPE_INVALID", "This is required.");
      if (f.requestTypeChange !== false && to === typeOf(account!)) throw new BankError("SAME_TYPE", "This account already has that type.");
      if (rules && reason.length > 300) throw new BankError("REASON_INVALID", "Use 300 characters or fewer.");
      rows = [{ label: "Account", value: label(account!) }, { label: "Change to", value: to }, ...(reason ? [{ label: "Reason", value: reason }] : [])];
    } else {
      title = "Other request";
      const subject = String(input.subject ?? "").trim(), details = String(input.details ?? "");
      if (rules && (subject.length < 3 || subject.length > 80)) throw new BankError("SUBJECT_INVALID", "Use at least 3 characters.");
      if (rules && (details.trim().length < 10 || details.length > 500)) throw new BankError("DETAILS_INVALID", "Write at least 10 characters.");
      rows = [{ label: "Subject", value: subject }, { label: "Details", value: details }];
    }
    const reference = `SR-${204118 + ++this.seq.request}`;
    const r: ServiceRequest = { id: reference, reference, kind, title, date: new Date(this.now()).toISOString().slice(0, 10), status: "Received", rows, ...(account ? { accountId: account.id } : {}) };
    this.data.requests.unshift(r);
    const row = (k: string) => rows.find((x) => x.label === k)?.value ?? "";
    return { reference, requestId: r.id, status: "Received", title, account: row("Account"), leaves: row("Leaves"), delivery: row("Delivery"), letter: row("Letter"), addressedTo: row("Addressed to"), changeTo: row("Change to"), subject: row("Subject") };
  }
  private cancelRequest(input: Record<string, any>) {
    const r = this.request(input.requestId);
    if (this.f.requestCancel !== false && r.status !== "Received") throw new BankError("ALREADY_STARTED", "This request has already started, so it can’t be cancelled.");
    r.status = "Cancelled";
    return { status: "Cancelled", requestId: r.id };
  }

  /* ------------------------------------------------------------------------------ banks the customer links */

  private fin() {
    if (!this.p.finance) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    return this.p.finance;
  }
  private sharing() { return SHARING[this.f.connectPeriod === false ? "A" : this.market()]; }
  private moneyText(cents: number) { const s = this.sharing(), v = Math.abs(cents) / 100; return `${cents < 0 ? "−" : ""}${s.symbol}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  private bankIdOf = (l: { id: string; bankId?: string }) => l.bankId ?? l.id.replace(/^l_/, "");
  /** What each bank offers: the position of the bank in the list decides the numbers, so the same bank always has the same accounts. */
  private offer(bankId: string, allowCards: unknown) {
    const i = CONNECT_BANKS.findIndex((b) => b.id === bankId);
    const cards = this.opt("connect-account", "allowCards") !== false && allowCards !== false && allowCards !== "false";
    const all: { kind: "Current" | "Savings" | "Credit"; last4: string; cents: number }[] = [{ kind: "Current", last4: String(1137 + 137 * i), cents: 241_045 + 10_000 * i }];
    if (i > 0) { all.push({ kind: "Savings", last4: String(5285 + 137 * i), cents: 952_080 + 10_000 * i }); if (cards) all.push({ kind: "Credit", last4: String(8049 + 137 * i), cents: -(34_015 + 10_000 * i) }); }
    return all;
  }
  private connectedIds() { return new Set(this.fin().linked.map((l) => this.bankIdOf(l))); }
  private banks() {
    const have = this.connectedIds(), s = this.sharing(), fin = this.fin();
    const open = CONNECT_BANKS.filter((b) => !have.has(b.id));
    const groups = new Map<string, typeof fin.linked>();
    for (const l of fin.linked) groups.set(this.bankIdOf(l), [...(groups.get(this.bankIdOf(l)) ?? []), l]);
    const connected = [...groups.entries()].map(([id, accs]) => {
      const until = accs.map((a) => a.until).filter(Boolean).sort()[0];
      return { id, bank: accs[0]!.bank, accounts: accs.length, untilText: until ? dayText(Date.parse(until)) : "", line: `${accs.length} ${accs.length === 1 ? "account" : "accounts"}${until ? ` · until ${dayText(Date.parse(until))}` : ""}` };
    });
    return {
      banks: Object.fromEntries(open.map((b) => [b.id, { id: b.id, name: b.name }])), count: open.length, connected, connectedCount: connected.length,
      sharingDays: s.days, untilText: dayText(this.now() + s.days * DAY), market: this.market(),
    };
  }
  private startConnection(input: Record<string, any>) {
    const bank = CONNECT_BANKS.find((b) => b.id === input.bankId);
    if (!bank) throw new BankError("BANK_NOT_FOUND", "Choose your bank.");
    if (this.f.connectBank !== false) {
      if (this.connectedIds().has(bank.id)) throw new BankError("ALREADY_CONNECTED", "This bank is already connected.");
      if (bank.id === "lakeside") throw new BankError("BANK_UNAVAILABLE", "That bank isn’t answering right now. Nothing was connected. Try again later.");
    }
    const offered = this.offer(bank.id, input.allowCards), state = `cx_${bank.id}_${++this.seq.connect}`;
    this.connecting = { state, bankId: bank.id, offered };
    return {
      state, redirectUrl: `sandbox://${bank.id}/authorize?state=${state}`, bank: bank.name, count: offered.length,
      accounts: offered.map((a, k) => ({ index: k + 1, kind: a.kind, label: `${a.kind === "Credit" ? "Credit card" : a.kind} ••${a.last4}`, balanceText: this.moneyText(a.cents) })),
      // the same, flat, because a screen reads a value by its name (up to three accounts, one switch each)
      ...Object.fromEntries(offered.flatMap((a, k) => [[`label${k + 1}`, `${a.kind === "Credit" ? "Credit card" : a.kind} ••${a.last4}`], [`balance${k + 1}`, this.moneyText(a.cents)]])),
    };
  }
  private finishConnection(input: Record<string, any>) {
    if (input.denied === true) { this.connecting = undefined; throw new BankError("ACCESS_DENIED", "Access was not allowed. Nothing was connected."); }
    const c = this.connecting, f = this.f;
    if (!c || c.state !== input.state) throw new BankError("STATE_INVALID", "That connection has ended. Start again.");
    if (f.connectConsent !== false && input.consent !== true) throw new BankError("CONSENT_REQUIRED", "Agree to continue.");
    const picks = [input.pick1, input.pick2, input.pick3].map((v) => v === true || v === "true");
    const chosen = c.offered.filter((_, k) => picks[k]);
    if (f.connectPick !== false && chosen.length === 0) throw new BankError("NO_ACCOUNT_CHOSEN", "Choose at least one account.");
    const bank = CONNECT_BANKS.find((b) => b.id === c.bankId)!, fin = this.fin();
    if (f.connectBank !== false && this.connectedIds().has(bank.id)) throw new BankError("ALREADY_CONNECTED", "This bank is already connected.");
    const s = this.sharing(), at = new Date(this.now()).toISOString(), until = new Date(this.now() + s.days * DAY).toISOString().slice(0, 10);
    for (const a of chosen) {
      const id = `l_${bank.id}_${a.kind.toLowerCase()}`;
      fin.linked.push({ id, bank: bank.name, kind: a.kind, name: a.kind === "Credit" ? "Credit card" : a.kind, maskedNumber: `••${a.last4}`, balance: fromMinor(a.cents, s.currency), bankId: bank.id, connectedAt: at, until, currency: s.currency });
      // a connected account is read only: it is never one the customer can pay from (the bank keeps it out of the accounts that can send money)
      if (f.connectReadOnly === false) this.p.accounts.push({ id, name: `${bank.name} ${a.kind}`, maskedNumber: `••${a.last4}`, iban: "", balance: fromMinor(a.cents, s.currency), currency: s.currency, status: "active", canDebit: true });
    }
    this.connecting = undefined;
    this.log(`connections.${bank.id}.added`); this.notify(`${bank.name} connected`);
    return { bank: bank.name, accounts: chosen.length, until, untilText: dayText(Date.parse(until)), days: s.days };
  }
  private removeConnection(input: Record<string, any>) {
    const fin = this.fin(), id = String(input.bankId ?? ""), mine = fin.linked.filter((l) => this.bankIdOf(l) === id);
    if (mine.length === 0) throw new BankError("LINK_NOT_FOUND", "This bank isn’t connected.");
    fin.linked = fin.linked.filter((l) => this.bankIdOf(l) !== id);
    this.p.accounts = this.p.accounts.filter((a) => !mine.some((l) => l.id === a.id));
    this.log(`connections.${id}.removed`);
    return { removed: mine.length, bank: mine[0]!.bank };
  }
  private linked() {
    const fin = this.fin(), s = this.sharing();
    const list = [...fin.linked].sort((a, b) => (b.connectedAt ?? "").localeCompare(a.connectedAt ?? ""));
    return Object.fromEntries(list.map((l) => {
      const cents = toMinor(l.balance, l.currency ?? s.currency), name = l.name ?? l.kind;
      return [l.id, {
        id: l.id, bank: l.bank, bankId: this.bankIdOf(l), kind: l.kind, name, title: `${l.bank} ${name}`, maskedNumber: l.maskedNumber, balance: l.balance, balanceText: this.moneyText(cents), readOnly: true,
        line: `At ${l.bank} (read only)`, connectedText: l.connectedAt ? dayText(Date.parse(l.connectedAt)) : "", untilText: l.until ? dayText(Date.parse(l.until)) : "",
      }];
    }));
  }

  /* ---------------------------------------------------------------------------------------- for scenarios */

  /** What the bank sent and logged, for a scenario to check: where and what kind, never a value. */
  private inspect() {
    const d = this.data;
    return {
      outbox: d.outbox.map((n) => ({ to: n.to, channel: n.channel, kind: n.kind })), log: d.log.map((l) => l.action), pending: d.pending.map((x) => x.field),
      threads: d.threads.length, requests: d.requests.length,
    };
  }
  /** Arranges what the bank does on its own, so a scenario can reach it: closes a conversation, starts work on a request or sets it back to Received. */
  private advance(input: Record<string, any>) {
    if (input.what === "close-thread") { this.thread(input.id).status = "closed"; return { ok: true }; }
    if (input.what === "start-request") { this.request(input.id).status = "In progress"; return { ok: true }; }
    if (input.what === "reset-request") { this.request(input.id).status = "Received"; return { ok: true }; }
    throw new BankError("NOT_SUPPORTED", "Unknown action");
  }
}
