import { formatMoney, fromMinor, roundMoney, toMinor } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { Account, Persona, SandboxConditions } from "../index";
import type { Flaws } from "../business/corporate";
import type { BankConfig } from "../config";
import type { AccountTxn } from "./data";
import type { SavedCard } from "./finance";
import { luhnValid } from "./finance";
import { secretHash } from "../hash";
import { debit, spendable } from "./money";

/**
 * The cards a bank issues to a customer, and the cards a customer saves from other banks (BankWorkx, Personal: Cards). The sandbox side of the journeys
 * cards, activate-card, card-controls, freeze-card, virtual-card, replace-card, card-pin, dispute-transaction and add-card. `Persona.cards` is the seed;
 * `bank.cards.list` stays the saved cards (retail.ts) and `bank.cards.issued` is what the bank issued.
 *
 * What the sandbox keeps is masked: the last four digits, the expiry, and a hash of a PIN. A full card number and the security code of a virtual card are
 * made once, handed to the one call that asked and never kept; a PIN is checked and kept only as a hash. Every rule can be switched off for the mutation check (Flaws).
 */
export type CardKind = "debit" | "credit";
export type CardStatus = "inactive" | "active" | "frozen" | "blocked" | "expired" | "replaced";
export type CardLimits = { perTransaction: number; dailyPurchases: number; monthly: number; dailyAtm: number };
export type CardRecord = {
  id: string; kind: CardKind; network: "visa" | "mastercard"; last4: string; holder: string; /** MM/YY */ expiry: string; nickname: string;
  status: CardStatus; /** the account a debit card (and a virtual card on it) spends from */ accountId?: string;
  virtual?: boolean; parentCardId?: string; purpose?: string; singleUse?: boolean;
  creditLimit?: number; availableCredit?: number; minimumDue?: number; /** YYYY-MM-DD */ dueDate?: string;
  controls: { online: boolean; contactless: boolean; abroad: boolean; atm: boolean };
  limits: CardLimits; ceilings: CardLimits; used: { dailyPurchases: number; dailyAtm: number; monthly: number };
  pinSet: boolean; /** a hash, never the PIN */ pinHash?: string;
  alerts: { every: boolean; large: boolean; largeFrom: number; online: boolean }; trip?: { country: string; from: string; to: string };
  activation: { tries: number; verified?: boolean }; replacement?: { reference: string; newCardId: string; arrivesBy: string; reason: string };
};
export type CardTxn = {
  id: string; cardId: string; merchant: string; /** signed: negative is money out */ amount: number; currency: string; status: "pending" | "posted";
  daysAgo: number; time: string; channel: "pos" | "online" | "atm"; country: string; disputeId?: string;
};
export type CardDispute = { id: string; cardId: string; transactionId: string; reason: string; amount: number; at: number; cardBlocked: boolean };
export type CardsSeed = { cards: CardRecord[]; transactions: CardTxn[]; disputes?: CardDispute[] };

export const MAX_VIRTUAL = 5;
export const VIRTUAL_MIN = 1;
export const VIRTUAL_MAX = 5000;
export const DISPUTE_DAYS = 120;
export const ACTIVATION_TRIES = 3;
export const EXPRESS_FEE = 15;
export const MAX_SAVED_CARDS = 5;
export const TRIP_DAYS = 90;
export const TRIP_AHEAD_DAYS = 120;
export const NEAR_EXPIRY_DAYS = 60;
export const ALERT_MIN = 1;
export const ALERT_MAX = 100_000;
export const CHARGE_CODE = "4821";
const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PILL: Record<CardStatus, string> = { inactive: "Not activated", active: "Active", frozen: "Frozen", blocked: "Blocked", expired: "Expired", replaced: "Replaced" };
const NETWORK_NAME: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express" };
const CHANNEL_LABEL: Record<CardTxn["channel"], string> = { pos: "Shop", online: "Online", atm: "Cash machine" };
const DISPUTE_REASONS = ["I don’t recognise it", "Charged twice", "Wrong amount", "Goods or service not received", "Cancelled but charged", "Other"];
const PURPOSES = ["Online shopping", "Subscriptions", "One-time purchase"];
const BLOCK_REASONS = ["lost", "stolen", "fraud"];
const REPLACE_REASONS = ["lost", "stolen", "damaged", "expired"];
/** The PINs everyone tries. */
const COMMON_PINS = ["0000", "1004", "2000", "1000", "2580", "0852", "1122", "6969", "1313", "4321", "2001", "2468", "1357"];

const money = (amount: number, currency: string) => formatMoney(amount, currency, "en-US", undefined, true);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const shortDay = (t: number) => `${new Date(t).getUTCDate()} ${MONTHS[new Date(t).getUTCMonth()]}`;
const longDay = (t: number) => `${new Date(t).getUTCDate()} ${MONTHS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCFullYear()}`;
const dayName = (t: number) => `${WEEKDAYS[new Date(t).getUTCDay()]} ${shortDay(t)}`;
const onlyDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const sameMoney = (a: number, b: number, currency: string) => toMinor(a, currency) === toMinor(b, currency);
/** A number that has no more digits after the point than the currency has. */
const isAmount = (v: unknown, currency: string): v is number => typeof v === "number" && Number.isFinite(v) && fromMinor(toMinor(v, currency), currency) === v;
const addWorkingDays = (from: number, n: number) => {
  let t = Date.UTC(new Date(from).getUTCFullYear(), new Date(from).getUTCMonth(), new Date(from).getUTCDate()), left = n;
  while (left > 0) { t += DAY; const w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6) left -= 1; }
  return t;
};
const expiryEnd = (expiry: string) => { const [m, y] = expiry.split("/").map(Number) as [number, number]; return Date.UTC(2000 + y, m, 0, 23, 59, 59); };
const addMonths = (t: number, n: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); };
const expiryOf = (t: number) => `${String(new Date(t).getUTCMonth() + 1).padStart(2, "0")}/${String(new Date(t).getUTCFullYear()).slice(2)}`;
/** The next digit that makes a card number pass the standard check. */
const checkDigit = (body: string) => { let sum = 0; for (let i = 0; i < body.length; i++) { let n = Number(body[body.length - 1 - i]); if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; } sum += n; } return String((10 - (sum % 10)) % 10); };
const group4 = (digits: string) => (digits.match(/.{1,4}/g) ?? []).join(" ");

/* ------------------------------------------------------------------------------------------------------- the seed */

const record = (c: Partial<CardRecord> & Pick<CardRecord, "id" | "kind" | "last4" | "nickname" | "expiry">): CardRecord => ({
  network: c.kind === "credit" ? "mastercard" : "visa", holder: "Alex Morgan", status: "active", pinSet: true,
  controls: { online: true, contactless: true, abroad: true, atm: true },
  limits: { perTransaction: 2000, dailyPurchases: 3000, monthly: 15000, dailyAtm: 800 }, ceilings: { perTransaction: 10000, dailyPurchases: 15000, monthly: 50000, dailyAtm: 1500 },
  used: { dailyPurchases: 0, dailyAtm: 0, monthly: 0 }, alerts: { every: false, large: false, largeFrom: 500, online: false }, activation: { tries: 0 }, ...c,
});
const txn = (id: string, cardId: string, merchant: string, amount: number, daysAgo: number, time: string, channel: CardTxn["channel"], country: string, status: CardTxn["status"] = "posted"): CardTxn =>
  ({ id, cardId, merchant, amount, currency: "USD", status, daysAgo, time, channel, country });

/** Alex Morgan's cards (synthetic): two physical cards in use, a new one waiting to be activated and a virtual card for online shopping. */
export function alexCards(): CardsSeed {
  return {
    cards: [
      record({ id: "card_9021", kind: "debit", last4: "9021", nickname: "Everyday debit", expiry: "09/29", accountId: "acc_main", used: { dailyPurchases: 4.8, dailyAtm: 0, monthly: 534 } }),
      record({
        id: "card_3318", kind: "credit", last4: "3318", nickname: "Aurora credit", expiry: "03/30", creditLimit: 5000, availableCredit: 3640.2, minimumDue: 45, dueDate: "2026-11-28",
        controls: { online: true, contactless: true, abroad: false, atm: false }, limits: { perTransaction: 1500, dailyPurchases: 2500, monthly: 10000, dailyAtm: 0 },
        ceilings: { perTransaction: 5000, dailyPurchases: 5000, monthly: 20000, dailyAtm: 0 },
      }),
      record({ id: "card_7745", kind: "debit", last4: "7745", nickname: "Spare debit", expiry: "11/29", accountId: "acc_save", status: "inactive", pinSet: false }),
      record({
        id: "card_6150", kind: "debit", last4: "6150", nickname: "Online shopping", expiry: "10/28", accountId: "acc_main", virtual: true, parentCardId: "card_9021", purpose: "Online shopping", pinSet: false,
        controls: { online: true, contactless: false, abroad: true, atm: false }, limits: { perTransaction: 300, dailyPurchases: 300, monthly: 300, dailyAtm: 0 },
        ceilings: { perTransaction: 5000, dailyPurchases: 5000, monthly: 5000, dailyAtm: 0 }, used: { dailyPurchases: 0, dailyAtm: 0, monthly: 59.98 },
      }),
    ],
    transactions: [
      txn("ct_1", "card_9021", "Northwind Market", -64.2, 1, "17:45", "pos", "US"),
      txn("ct_2", "card_9021", "Skyline Travel Co.", -420, 3, "11:20", "online", "GB"),
      txn("ct_3", "card_9021", "Brightside Coffee", -4.8, 0, "09:12", "pos", "US", "pending"),
      txn("ct_4", "card_9021", "Harbor Fuel", -45, 2, "14:05", "pos", "US"),
      txn("ct_5", "card_9021", "Old Bookshop", -18, 119, "16:30", "pos", "US"),
      txn("ct_6", "card_9021", "Past Travel", -75, 130, "10:10", "online", "FR"),
      txn("ct_7", "card_9021", "Skyline Travel Co. refund", 35, 4, "13:00", "online", "GB"),
      txn("ct_8", "card_9021", "Metro cash machine", -100, 5, "18:20", "atm", "US"),
      txn("ct_c1", "card_3318", "Globe Hotels", -240, 6, "19:00", "online", "ES"),
      txn("ct_c2", "card_3318", "Metro Transit", -12.5, 2, "08:15", "pos", "US"),
      txn("ct_v1", "card_6150", "Pixel Store", -29.99, 9, "20:40", "online", "US"),
      txn("ct_v2", "card_6150", "Pixel Store", -29.99, 40, "20:35", "online", "US"),
    ],
  };
}
export const emptyCards = (): CardsSeed => ({ cards: [], transactions: [] });

/* ------------------------------------------------------------------------------------------------------ the bank */

export type CardsHost = { now: () => number; otp: { attempts: number; verified: boolean }; conditions: () => SandboxConditions; flaws: Flaws; config: () => BankConfig };
const ADAPTERS = /^bank\.(cards\.(issued|eligible|get|transactions|verifyActivation|activate|freeze|unfreeze|block|controls\.update|virtual\.(create|delete)|replace(\.check)?|pin\.set|check|verify|add)|disputes\.(reasons|check|create|list))$/;
/** Where the home market is on the three that differ for a card: the home address, the postcode of the billing address, whether a postcode is asked. */
const HOME = { us: { address: "12 Example Street, Springfield 62704", zip: /^[0-9]{5}(-[0-9]{4})?$/, message: "Enter the 5-digit ZIP code." }, uk: { address: "12 Example Road, London SW1A 1AA", zip: /^[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}$/, message: "Enter a valid postcode." }, eu: { address: "Beispielstrasse 5, Berlin 10115", zip: /^[A-Za-z0-9 -]{4,10}$/, message: "Enter a valid postcode." } } as const;

export class CardsApi {
  private seq = 0;
  private vseq = 0;
  private cases = 0;
  private orders = 0;
  /** The check of a card being saved: the card it was for, the tries left on its code, and whether the code was right. */
  private adding: { key: string; method: string; tries: number; verified: boolean; locked: boolean } | undefined;
  constructor(private p: Persona, private host: CardsHost) {}
  private get f() { return this.host.flaws; }
  private get data(): CardsSeed {
    if (!this.p.cards) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    return this.p.cards;
  }
  private now = () => this.host.now();
  private market = () => { const m = this.host.config().homeMarket; return m === "us" ? "A" : m === "uk" ? "B" : m === "eu" ? "C" : "D"; };

  /** Whether this class answers the adapter: the issued cards only for a customer who has them (the older records answer for the rest). */
  handles = (adapter: string) => ADAPTERS.test(adapter) && (!/^bank\.cards\.(issued|get)$/.test(adapter) || !!this.p.cards);

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.cards.issued": return this.issued();
      case "bank.cards.eligible": return this.eligible(input);
      case "bank.cards.get": return this.view(this.card(input.cardId));
      case "bank.cards.transactions": return this.transactions(input);
      case "bank.cards.verifyActivation": return this.verifyActivation(input);
      case "bank.cards.activate": return this.activate(input);
      case "bank.cards.freeze": return this.freeze(input);
      case "bank.cards.unfreeze": return this.unfreeze(input);
      case "bank.cards.block": return this.block(input);
      case "bank.cards.controls.update": return this.update(input);
      case "bank.cards.virtual.create": return this.createVirtual(input);
      case "bank.cards.virtual.delete": return this.deleteVirtual(input);
      case "bank.cards.replace": return this.replace(input, false);
      case "bank.cards.replace.check": return this.replace(input, true);
      case "bank.cards.pin.set": return this.setPin(input);
      case "bank.disputes.reasons": return this.reasons();
      case "bank.disputes.check": return this.disputeCheck(input);
      case "bank.disputes.create": return this.dispute(input);
      case "bank.disputes.list": return this.disputes(input);
      case "bank.cards.check": return this.checkSaved(input);
      case "bank.cards.verify": return this.verifySaved(input);
      case "bank.cards.add": return this.addSaved(input);
    }
    throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
  }
  private ensureOtp() { if (!this.host.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified"); }

  /* -------------------------------------------------------------------------------------------- reading */

  private card(id: unknown): CardRecord {
    const c = this.data.cards.find((x) => x.id === id);
    if (!c) throw new BankError("CARD_NOT_FOUND", "We can’t find that card.");
    return c;
  }
  /** What a card is now: a card that ran past its expiry month is Expired whatever it was. */
  private statusOf(c: CardRecord): CardStatus {
    if ((c.status === "active" || c.status === "frozen" || c.status === "inactive") && this.now() > expiryEnd(c.expiry)) return "expired";
    return c.status;
  }
  private account(c: CardRecord): Account | undefined { return this.p.accounts.find((a) => a.id === c.accountId) ?? (c.kind === "credit" ? this.p.accounts[0] : undefined); }
  private currency = (c: CardRecord) => this.account(c)?.currency ?? "USD";
  private locked = (c: CardRecord) => c.activation.tries >= ACTIVATION_TRIES;
  private virtualsOf = (c: CardRecord) => this.data.cards.filter((v) => v.parentCardId === c.id && v.status !== "blocked" && v.status !== "replaced");
  private daysLeft = (c: CardRecord) => Math.floor((expiryEnd(c.expiry) - this.now()) / DAY);

  /** The address on file, by home market (synthetic). */
  private homeAddress = () => { const m = this.market(); return m === "A" ? HOME.us.address : m === "B" ? HOME.uk.address : m === "C" ? HOME.eu.address : "Example Tower, Flat 1204, Dubai"; };

  private view(c: CardRecord) {
    const status = this.statusOf(c), cur = this.currency(c), acc = this.account(c);
    const virtual = !!c.virtual, usable = status === "active" || status === "frozen";
    let lineLabel: string, lineValue = "", lineExtra = "";
    if (status === "inactive") lineLabel = this.locked(c) ? "Activation is locked. Please call us." : "Activate this card to start using it.";
    else if (!usable) lineLabel = "This card can’t be used.";
    else if (c.kind === "credit" && !virtual) { lineLabel = "Available credit"; lineValue = money(c.availableCredit ?? 0, cur); lineExtra = `Minimum due ${money(c.minimumDue ?? 0, cur)} by ${longDay(Date.parse(`${c.dueDate}T00:00:00Z`))}`; }
    else if (virtual) { lineLabel = "Available"; lineValue = money(roundMoney(Math.max(c.limits.monthly - c.used.monthly, 0), cur), cur); }
    else { lineLabel = "Available balance"; lineValue = acc ? money(spendable(acc), acc.currency) : ""; }
    const parent = c.parentCardId ? this.data.cards.find((x) => x.id === c.parentCardId) : undefined;
    const manageable = status === "active" || status === "frozen";
    return {
      id: c.id, kind: c.kind, virtual, parentCardId: c.parentCardId ?? "", parentName: parent ? `${parent.nickname} ••${parent.last4}` : "", purpose: c.purpose ?? "", singleUse: !!c.singleUse,
      network: c.network, networkName: NETWORK_NAME[c.network]!, last4: c.last4, holder: c.holder, expiry: c.expiry, nickname: c.nickname, name: `${c.nickname} ••${c.last4}`,
      status, statusLabel: virtual && status === "active" ? "Virtual" : PILL[status], pill: virtual && status === "active" ? "Virtual" : PILL[status],
      number: `•••• •••• •••• ${c.last4}`, holderLine: `${c.holder.toUpperCase()} · ${c.expiry}`,
      lineLabel, lineValue, lineExtra, line: [lineLabel, lineValue, lineExtra].filter(Boolean).join(" · "),
      accountId: c.accountId ?? "", accountName: acc ? `${acc.nickname || acc.name} ${acc.maskedNumber}` : "", currency: cur, credit: c.kind === "credit",
      creditLimit: c.creditLimit ?? 0, availableCredit: c.availableCredit ?? 0,
      controls: { ...c.controls }, limits: { ...c.limits }, ceilings: { ...c.ceilings }, used: { ...c.used }, alerts: { ...c.alerts }, trip: c.trip ? { ...c.trip } : null, hasTrip: !!c.trip,
      allowsCash: c.ceilings.dailyAtm > 0, pinSet: c.pinSet, locked: this.locked(c), triesLeft: Math.max(ACTIVATION_TRIES - c.activation.tries, 0),
      ceilingText: { perTransaction: `Up to ${money(c.ceilings.perTransaction, cur)}`, dailyPurchases: `Up to ${money(c.ceilings.dailyPurchases, cur)}`, monthly: `Up to ${money(c.ceilings.monthly, cur)}`, dailyAtm: `Up to ${money(c.ceilings.dailyAtm, cur)}` },
      limitText: { perTransaction: money(c.limits.perTransaction, cur), dailyPurchases: money(c.limits.dailyPurchases, cur), monthly: money(c.limits.monthly, cur), dailyAtm: money(c.limits.dailyAtm, cur) },
      homeAddress: this.homeAddress(), askPostcode: this.market() !== "D",
      replacement: c.replacement ? { reference: c.replacement.reference, newCardId: c.replacement.newCardId, arrivesBy: c.replacement.arrivesBy } : null,
      can: {
        freeze: status === "active", unfreeze: status === "frozen", controls: manageable, pin: status === "active" && !virtual, activate: status === "inactive" && !this.locked(c) && !virtual,
        replace: (status === "blocked" || status === "expired") && !virtual && !c.replacement, createVirtual: status === "active" && !virtual, change: manageable,
      },
    };
  }

  /** Debit cards, then credit cards; each kind active first; a virtual card sits under the card it is linked to. */
  private issued() {
    const rank: Record<CardStatus, number> = { active: 0, inactive: 1, frozen: 2, blocked: 3, expired: 4, replaced: 5 };
    const physical = this.data.cards.filter((c) => !c.virtual).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "debit" ? -1 : 1) || rank[this.statusOf(a)] - rank[this.statusOf(b)]);
    const out: ReturnType<CardsApi["view"]>[] = [];
    for (const c of physical) { out.push(this.view(c)); for (const v of this.data.cards.filter((x) => x.parentCardId === c.id)) out.push(this.view(v)); }
    for (const v of this.data.cards.filter((x) => x.virtual && !physical.some((c) => c.id === x.parentCardId))) out.push(this.view(v));
    return Object.fromEntries(out.map((c) => [c.id, c]));
  }

  /** The cards a journey offers to choose from, and the first one it can use: `for` is activate, controls, pin, replace or virtual. A card that is offered but cannot be used says why when it is chosen. */
  private eligible(input: Record<string, any>) {
    const scope = String(input.for ?? "controls");
    const all = Object.values(this.issued());
    const physical = all.filter((v) => !v.virtual && v.status !== "replaced");
    const [shown, usable] = ((): [typeof all, typeof all] => {
      switch (scope) {
        case "view": return [all, all];
        case "activate": { const w = all.filter((v) => v.status === "inactive" && !v.virtual); return [w, w.filter((v) => v.can.activate)]; }
        case "pin": return [physical, physical.filter((v) => v.status === "active" || v.status === "frozen")];
        case "replace": return [physical, physical.filter((v) => (v.status === "blocked" || v.status === "expired") && !v.replacement)];
        case "virtual": { const a = all.filter((v) => !v.virtual && v.status === "active"); return [a, a]; }
        default: { const c = all.filter((v) => v.status !== "replaced"); return [c, c.filter((v) => v.status === "active" || v.status === "frozen")]; }
      }
    })();
    return { count: shown.length, usable: usable.length, firstId: usable[0]?.id ?? "", cards: Object.fromEntries(shown.map((v) => [v.id, v])) };
  }

  /* -------------------------------------------------------------------------------------- transactions */

  private ageOf = (t: CardTxn) => t.daysAgo;
  private txnView(t: CardTxn) {
    const c = this.card(t.cardId), at = this.now() - t.daysAgo * DAY;
    const when = t.status === "pending" ? "Pending" : t.daysAgo === 0 ? "Today" : t.daysAgo === 1 ? "Yesterday" : shortDay(at);
    const notice = this.disputeProblem(t);
    const status = t.disputeId ? "disputed" : t.status;
    const signed = `${t.amount > 0 ? "+" : "−"}${money(Math.abs(t.amount), t.currency)}`;
    return {
      id: t.id, cardId: t.cardId, cardName: `${c.nickname} ••${c.last4}`, merchant: t.merchant, amount: t.amount, amountText: signed, currency: t.currency, status, statusLabel: status === "disputed" ? "Disputed" : t.status === "pending" ? "Pending" : "Posted",
      pending: t.status === "pending", when, date: longDay(at), time: t.time, channel: t.channel, channelLabel: CHANNEL_LABEL[t.channel], country: t.country, reference: `CT-${t.id.replace(/\D/g, "").padStart(6, "0") || t.id}`,
      disputeId: t.disputeId ?? "", reportable: notice === "", notice: notice === "" ? "" : notice.replace(/^[A-Z_]+\|/, ""), noticeCode: notice === "" ? "" : notice.split("|")[0]!,
      line: `${signed} · ${when}${t.status === "pending" ? "" : ` · ${t.time}`}`,
    };
  }
  private transactions(input: Record<string, any>) {
    if (input.cardId !== undefined && input.cardId !== "") this.card(input.cardId);
    const q = String(input.q ?? "").trim().toLowerCase();
    const list = this.data.transactions.filter((t) => (!input.cardId || t.cardId === input.cardId) && (!input.status || (input.status === "disputed" ? !!t.disputeId : t.status === input.status)) && (!q || t.merchant.toLowerCase().includes(q)))
      .sort((a, b) => a.daysAgo - b.daysAgo || Number(b.status === "pending") - Number(a.status === "pending") || b.time.localeCompare(a.time) || b.id.localeCompare(a.id));
    const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 100);
    const items = list.slice(0, limit).map((t) => this.txnView(t));
    // the same payments as a map, for a select block: the words of a row and the card it belongs to
    const choices = Object.fromEntries(items.map((t) => [t.id, { id: t.id, name: `${t.merchant} · ${t.amountText} · ${t.when}`, cardId: t.cardId }]));
    return { items, choices, total: list.length, shown: items.length, more: list.length > items.length, empty: this.data.transactions.filter((t) => !input.cardId || t.cardId === input.cardId).length === 0 };
  }

  /* ----------------------------------------------------------------------------------- freezing, blocking */

  /** A card the customer may change: active or frozen. */
  private manageable(c: CardRecord, what = "changed") {
    const s = this.statusOf(c);
    if (this.f.cardState === false) return s;
    if (s === "inactive") throw new BankError("CARD_NOT_ACTIVATED", "Activate this card first.");
    if (s !== "active" && s !== "frozen") throw new BankError("CARD_NOT_ACTIVE", `This card can’t be ${what}.`);
    return s;
  }
  private freeze(input: Record<string, any>) {
    const c = this.card(input.cardId), s = this.statusOf(c);
    if (s === "frozen") throw new BankError("CARD_ALREADY_FROZEN", "This card is already frozen.");
    if (s !== "active" && this.f.cardState !== false) throw new BankError("CARD_NOT_ACTIVE", "Only an active card can be frozen.");
    c.status = "frozen";
    return { cardId: c.id, status: "frozen", statusLabel: PILL.frozen, name: `${c.nickname} ••${c.last4}` };
  }
  private unfreeze(input: Record<string, any>) {
    const c = this.card(input.cardId);
    if (this.statusOf(c) !== "frozen") throw new BankError("CARD_NOT_FROZEN", "This card isn’t frozen.");
    if (this.f.unfreezeCode !== false) this.ensureOtp();
    c.status = "active";
    this.host.otp.verified = false;
    return { cardId: c.id, status: "active", statusLabel: PILL.active, name: `${c.nickname} ••${c.last4}` };
  }
  /** Blocking only ever makes a card harder to use, so it asks for no code: a lost card is blocked at once. */
  private block(input: Record<string, any>) {
    const c = this.card(input.cardId), s = this.statusOf(c);
    if (s === "blocked") throw new BankError("CARD_ALREADY_BLOCKED", "This card is already blocked.");
    if (s === "replaced" || (s === "inactive" && this.f.cardState !== false)) throw new BankError("CARD_NOT_ACTIVE", "This card can’t be changed.");
    const reason = String(input.reason ?? "");
    if (!BLOCK_REASONS.includes(reason)) throw new BankError("REASON_INVALID", "Choose a reason.");
    c.status = "blocked";
    this.seq += 1;
    return { cardId: c.id, status: "blocked", statusLabel: PILL.blocked, reference: `BLK-${iso(this.now()).replace(/-/g, "")}-${String(700 + this.seq).padStart(4, "0")}`, name: `${c.nickname} ••${c.last4}` };
  }

  /* ------------------------------------------------------------------------------- limits and controls */

  private limitProblems(c: CardRecord, limits: Partial<CardLimits>, merged: CardLimits) {
    const cur = this.currency(c);
    for (const k of ["perTransaction", "dailyPurchases", "monthly", "dailyAtm"] as const) {
      const v = limits[k];
      if (v === undefined) continue;
      if (this.f.limitRules !== false && (!isAmount(v, cur) || v < 0)) throw new BankError("LIMIT_INVALID", "Enter an amount.");
      if (this.f.limitCeiling !== false && typeof v === "number" && v > c.ceilings[k]) throw new BankError("LIMIT_ABOVE_CEILING", `The most is ${money(c.ceilings[k], cur)}.`);
    }
    if (this.f.limitRules !== false) {
      if (merged.perTransaction > merged.dailyPurchases) throw new BankError("LIMIT_INVALID", "Can’t be more than the daily limit.");
      if (merged.dailyPurchases > merged.monthly) throw new BankError("LIMIT_INVALID", "Can’t be more than the monthly limit.");
    }
  }
  private tripProblem(trip: any, abroad: boolean) {
    const country = String(trip?.country ?? "").trim(), from = String(trip?.from ?? ""), to = String(trip?.to ?? "");
    if (!country || !from || !to) throw new BankError("TRIP_INVALID", "Add the country and both dates, or clear them.");
    if (this.f.tripRules === false) return;
    const t0 = Date.parse(`${from}T00:00:00Z`), t1 = Date.parse(`${to}T00:00:00Z`), today = Date.parse(`${iso(this.now())}T00:00:00Z`);
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) throw new BankError("TRIP_INVALID", "Add the country and both dates, or clear them.");
    if (t1 < t0) throw new BankError("TRIP_INVALID", "The end date is before the start date.");
    if (t1 - t0 > TRIP_DAYS * DAY) throw new BankError("TRIP_INVALID", "A trip can last up to 90 days.");
    if (t0 < today || t0 > today + TRIP_AHEAD_DAYS * DAY) throw new BankError("TRIP_INVALID", "Choose dates from today to 120 days ahead.");
    if (!abroad) throw new BankError("TRIP_INVALID", "Turn on International to add a trip.");
  }
  private tripText = (t: { country: string; from: string; to: string } | undefined) => (t ? `${t.country}, ${shortDay(Date.parse(`${t.from}T00:00:00Z`))} to ${shortDay(Date.parse(`${t.to}T00:00:00Z`))}` : "None");

  /** A journey sends plain values (the engine does not fill in nested objects): perTransaction, dailyPurchases, monthly, dailyAtm, allowContactless, allowOnline, allowAbroad, allowAtm, tripCountry, tripFrom, tripTo (all empty clears the trip), alertEvery, alertLarge, alertFrom, alertOnline. They are the same as limits, controls, trip and alerts. */
  private flat(input: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = { ...input };
    const has = (k: string) => input[k] !== undefined;
    const limits: Record<string, any> = { ...(input.limits ?? {}) };
    for (const k of ["perTransaction", "dailyPurchases", "monthly", "dailyAtm"]) if (has(k)) limits[k] = input[k];
    const controls: Record<string, any> = { ...(input.controls ?? {}) };
    for (const [from, to] of [["allowContactless", "contactless"], ["allowOnline", "online"], ["allowAbroad", "abroad"], ["allowAtm", "atm"]] as const) if (has(from)) controls[to] = input[from];
    const alerts: Record<string, any> = { ...(input.alerts ?? {}) };
    for (const [from, to] of [["alertEvery", "every"], ["alertLarge", "large"], ["alertFrom", "largeFrom"], ["alertOnline", "online"]] as const) if (has(from)) alerts[to] = input[from];
    if (Object.keys(limits).length) out.limits = limits;
    if (Object.keys(controls).length) out.controls = controls;
    if (Object.keys(alerts).length) out.alerts = alerts;
    if (has("tripCountry") || has("tripFrom") || has("tripTo")) out.trip = { country: input.tripCountry ?? "", from: input.tripFrom ?? "", to: input.tripTo ?? "" };
    const t = out.trip;
    // a trip with nothing in it is no trip
    if (t && typeof t === "object" && !String(t.country ?? "").trim() && !String(t.from ?? "") && !String(t.to ?? "")) out.trip = null;
    return out;
  }

  /** Freezing, unfreezing, limits, where the card works, a trip and alerts, in one call. Only what loosens the card needs the code. `dryRun` applies every rule and changes nothing. */
  private update(raw: Record<string, any>) {
    const input = this.flat(raw);
    const c = this.card(input.cardId), s = this.manageable(c), cur = this.currency(c), dry = input.dryRun === true;
    const onOff = (b: boolean) => (b ? "On" : "Off");
    const changes: { key: string; label: string; before: string; after: string }[] = [];
    let loosened = false;
    const want = input.status === undefined ? s : String(input.status);
    if (want !== "active" && want !== "frozen") throw new BankError("CARD_NOT_ACTIVE", "This card can’t be changed.");
    // a frozen card takes nothing but its unfreezing
    const others = input.limits || input.controls || input.trip !== undefined || input.alerts;
    if (s === "frozen" && want === "frozen" && others && this.f.cardState !== false) throw new BankError("CARD_FROZEN", "Unfreeze this card first.");
    if (want !== s) { changes.push({ key: "status", label: "Card", before: PILL[s], after: PILL[want as CardStatus] }); if (want === "active") loosened = true; }
    const limits = (input.limits ?? {}) as Partial<CardLimits>;
    const merged: CardLimits = { ...c.limits, ...Object.fromEntries(Object.entries(limits).filter(([, v]) => v !== undefined)) } as CardLimits;
    this.limitProblems(c, limits, merged);
    const labels: Record<keyof CardLimits, string> = { perTransaction: "Per transaction", dailyPurchases: "Daily", monthly: "Monthly", dailyAtm: "Cash withdrawal, daily" };
    for (const k of ["perTransaction", "dailyPurchases", "monthly", "dailyAtm"] as const) {
      if (limits[k] === undefined || sameMoney(limits[k]!, c.limits[k], cur)) continue;
      changes.push({ key: k, label: labels[k], before: money(c.limits[k], cur), after: money(limits[k]!, cur) });
      if (limits[k]! > c.limits[k]) loosened = true;
    }
    const controls = (input.controls ?? {}) as Partial<Record<keyof CardRecord["controls"], boolean>>;
    const clabels = { contactless: "Contactless", online: "Online", abroad: "International", atm: "Cash machines" } as const;
    for (const k of ["contactless", "online", "abroad", "atm"] as const) {
      if (controls[k] === undefined || controls[k] === c.controls[k]) continue;
      changes.push({ key: k, label: clabels[k], before: onOff(c.controls[k]), after: onOff(!!controls[k]) });
      if (controls[k]) loosened = true;
    }
    let trip = c.trip;
    if (input.trip !== undefined) {
      if (input.trip === null) trip = undefined;
      else { this.tripProblem(input.trip, controls.abroad ?? c.controls.abroad); trip = { country: String(input.trip.country).trim(), from: String(input.trip.from), to: String(input.trip.to) }; }
      if (this.tripText(trip) !== this.tripText(c.trip)) { changes.push({ key: "trip", label: "Trip", before: this.tripText(c.trip), after: this.tripText(trip) }); if (trip) loosened = true; }
    }
    const alerts = (input.alerts ?? {}) as Partial<CardRecord["alerts"]>;
    const next = { ...c.alerts, ...Object.fromEntries(Object.entries(alerts).filter(([, v]) => v !== undefined)) } as CardRecord["alerts"];
    if (next.large && this.f.alertRules !== false) {
      if (!(typeof next.largeFrom === "number" && next.largeFrom >= ALERT_MIN)) throw new BankError("ALERT_INVALID", "Enter an amount above zero.");
      if (next.largeFrom > ALERT_MAX) throw new BankError("ALERT_INVALID", `The most is ${money(ALERT_MAX, cur)}.`);
    }
    const alabels = { every: "Every transaction", large: "Large transactions", online: "Online purchases" } as const;
    for (const k of ["every", "large", "online"] as const) if (next[k] !== c.alerts[k]) changes.push({ key: `alert-${k}`, label: alabels[k], before: onOff(c.alerts[k]), after: onOff(next[k]) });
    if (next.large && next.largeFrom !== c.alerts.largeFrom) changes.push({ key: "alert-from", label: "Alert me from", before: money(c.alerts.largeFrom, cur), after: money(next.largeFrom, cur) });
    const onlyStatus = changes.length === 1 && changes[0]!.key === "status";
    const kind = onlyStatus ? (want === "frozen" ? "freeze" : "unfreeze") : "changes";
    const out = { cardId: c.id, name: `${c.nickname} ••${c.last4}`, changes, loosened, needsCode: loosened, kind, changed: changes.length > 0, status: want, statusLabel: PILL[want as CardStatus] };
    if (dry) return out;
    if (changes.length === 0) throw new BankError("NOTHING_CHANGED", "You haven’t changed anything yet.");
    if (loosened && this.f.loosenCode !== false) this.ensureOtp();
    c.status = want as CardStatus; Object.assign(c.limits, merged); Object.assign(c.controls, Object.fromEntries(Object.entries(controls).filter(([, v]) => v !== undefined))); c.trip = trip; c.alerts = next;
    if (loosened) this.host.otp.verified = false;
    return out;
  }

  /* ----------------------------------------------------------------------------------------- activation */

  private pinMessage(pin: string, c: CardRecord, how: "activate" | "change", strong = true): string | null {
    if (!/^[0-9]{4}$/.test(pin)) return how === "activate" ? "Use exactly 4 digits." : "Enter 4 digits.";
    if (!strong || this.f.pinStrength === false) return null;
    const d = [...pin].map(Number), step = (n: number) => d.every((x, i) => i === 0 || x - d[i - 1]! === n);
    if (d.every((x) => x === d[0])) return how === "activate" ? "Don’t repeat one digit." : "Don’t use the same digit four times.";
    if (step(1) || step(-1)) return how === "activate" ? "Don’t use a run of digits." : "Don’t use numbers in a row, like 1234.";
    const hard = "Choose a PIN that’s harder to guess.";
    if (pin.slice(0, 2) === pin.slice(2) || (d[0] === d[1] && d[2] === d[3])) return hard;
    if (pin === c.last4 || pin === c.expiry.replace("/", "")) return how === "activate" ? hard : "Don’t use part of your card number or expiry date.";
    if (how === "activate") {
      const born = String(this.p.retail?.profile.dateOfBirth ?? "1988-04-17").split("-");
      if ([born[0], `${born[2]}${born[1]}`, `${born[1]}${born[2]}`].includes(pin)) return hard;
      if (pin === onlyDigits(this.p.phone).slice(-4) || this.p.accounts.some((a) => onlyDigits(a.maskedNumber).slice(-4) === pin)) return hard;
      if (COMMON_PINS.includes(pin)) return hard;
    }
    return null;
  }
  private verifyActivation(input: Record<string, any>) {
    const c = this.card(input.cardId), s = this.statusOf(c);
    if (s === "active" || s === "frozen") throw new BankError("CARD_ALREADY_ACTIVE", "This card is already active.");
    if (s !== "inactive" || c.virtual) throw new BankError("CARD_BLOCKED", "This card can’t be activated.");
    const lock = () => ({ verified: false as const, code: "ACTIVATION_LOCKED", triesLeft: 0, locked: true });
    if (this.locked(c) && this.f.activateLock !== false) return lock();
    const expiry = String(input.expiry ?? "").trim(), cvv = input.securityCode;
    // a date that has already gone by is not a wrong try: the card is not the one on the screen
    if (/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(expiry) && expiryEnd(expiry) < this.now()) throw new BankError("CARD_EXPIRED", "This card has expired.");
    const right = String(input.last4 ?? "") === c.last4 && expiry === c.expiry && (cvv === undefined || cvv === "" || (/^[0-9]{3}$/.test(String(cvv)) && String(cvv) !== "000"));
    if (!right && this.f.activateMatch !== false) {
      c.activation.tries += 1; c.activation.verified = false;
      if (this.locked(c) && this.f.activateLock !== false) return lock();
      return { verified: false as const, code: "ACTIVATION_MISMATCH", triesLeft: Math.max(ACTIVATION_TRIES - c.activation.tries, 0), locked: false };
    }
    c.activation.verified = true;
    return { verified: true as const, code: "", triesLeft: Math.max(ACTIVATION_TRIES - c.activation.tries, 0), locked: false };
  }
  private activate(input: Record<string, any>) {
    const c = this.card(input.cardId), s = this.statusOf(c);
    if (s === "active" || s === "frozen") throw new BankError("CARD_ALREADY_ACTIVE", "This card is already active.");
    if (s !== "inactive" || c.virtual) throw new BankError("CARD_BLOCKED", "This card can’t be activated.");
    if (this.locked(c) && this.f.activateLock !== false) throw new BankError("ACTIVATION_LOCKED", "Too many wrong tries. Activation is locked. Please call us.");
    // holding the card is the proof: the details must have been checked (here or by verifyActivation just before)
    if (input.last4 !== undefined) { const r = this.verifyActivation(input); if (!r.verified) throw new BankError(r.code, r.code === "ACTIVATION_LOCKED" ? "Too many wrong tries. Activation is locked. Please call us." : "The details don’t match this card. Check them and try again."); }
    if (!c.activation.verified && this.f.activateMatch !== false) throw new BankError("ACTIVATION_MISMATCH", "The details don’t match this card. Check them and try again.");
    const pin = input.pin === undefined || input.pin === "" ? undefined : String(input.pin);
    if (pin !== undefined) {
      const problem = this.pinMessage(pin, c, "activate");
      if (problem) throw new BankError(/^Use exactly/.test(problem) ? "PIN_INVALID" : "PIN_WEAK", problem);
    }
    c.status = "active"; c.activation.verified = false;
    if (pin !== undefined) { c.pinSet = true; c.pinHash = secretHash(pin, `cardpin:${c.id}`); }
    this.retire(c.id);
    return { cardId: c.id, status: "active", statusLabel: PILL.active, pinSet: c.pinSet, name: `${c.nickname} ••${c.last4}` };
  }
  /** A new card taking over from another: the old one is Replaced from then on. */
  private retire(newId: string) {
    const old = this.data.cards.find((x) => x.replacement?.newCardId === newId);
    if (!old) return;
    old.status = "replaced"; old.replacement = undefined;
  }

  /* --------------------------------------------------------------------------------------------- PIN */

  private setPin(input: Record<string, any>) {
    const c = this.card(input.cardId);
    if (c.virtual && this.f.cardState !== false) throw new BankError("CARD_VIRTUAL", "Virtual cards don’t have a PIN.");
    this.manageable(c);
    const pin = String(input.pin ?? "");
    const problem = this.pinMessage(pin, c, "change", input.blockWeak !== false);
    if (problem) throw new BankError(/^Enter 4/.test(problem) ? "PIN_INVALID" : "PIN_WEAK", problem);
    if (this.f.pinCode !== false) this.ensureOtp();
    const first = !c.pinSet;
    c.pinSet = true; c.pinHash = secretHash(pin, `cardpin:${c.id}`);
    this.host.otp.verified = false;
    return { cardId: c.id, firstSet: first, pinSet: true, name: `${c.nickname} ••${c.last4}` };
  }

  /* ---------------------------------------------------------------------------------------- virtual */

  private parentOf(id: unknown) {
    const c = this.card(id);
    if (c.virtual || this.statusOf(c) !== "active") throw new BankError("CARD_NOT_ACTIVE", "Choose an active card to link this to.");
    return c;
  }
  private createVirtual(input: Record<string, any>) {
    const parent = this.f.virtualParent === false ? this.card(input.cardId) : this.parentOf(input.cardId), cur = this.currency(parent);
    if (this.f.virtualCap !== false && this.virtualsOf(parent).length >= MAX_VIRTUAL) throw new BankError("VIRTUAL_LIMIT_REACHED", "You have 5 virtual cards on this card, the most you can have. Delete one first.");
    const purpose = String(input.purpose ?? "");
    if (!PURPOSES.includes(purpose)) throw new BankError("PURPOSE_INVALID", "Choose a purpose.");
    const single = input.singleUse === true || purpose === "One-time purchase";
    const limit = input.limit;
    if (this.f.virtualRange !== false) {
      if (!isAmount(limit, cur) || limit < VIRTUAL_MIN) throw new BankError("LIMIT_INVALID", "The smallest limit is $1.00.");
      if (limit > VIRTUAL_MAX) throw new BankError("LIMIT_ABOVE_CEILING", "The most is $5,000.00.");
    } else if (typeof limit !== "number") throw new BankError("LIMIT_INVALID", "The smallest limit is $1.00.");
    const summary = { cardId: parent.id, parentName: `${parent.nickname} ••${parent.last4}`, purpose, limit, limitText: money(limit, cur), per: single ? "per payment" : "a month", lasts: single ? "One payment" : "3 years", singleUse: single };
    if (input.dryRun === true) return summary;
    if (this.f.virtualCode !== false) this.ensureOtp();
    this.vseq += 1;
    // a test number that passes the check digit; the sandbox keeps only its last four digits and expiry
    const body = `400000${String(100_000_000 + this.vseq * 7919).slice(-9)}`, number = body + checkDigit(body);
    const cvv = String(100 + ((this.vseq * 37) % 900)), last4 = number.slice(-4);
    const expiry = expiryOf(addMonths(this.now(), single ? 12 : 36));
    this.data.cards.push(record({
      id: `card_v${last4}`, kind: parent.kind, last4, nickname: purpose, expiry, accountId: parent.accountId, virtual: true, parentCardId: parent.id, purpose, singleUse: single, pinSet: false,
      controls: { online: true, contactless: false, abroad: true, atm: false }, limits: { perTransaction: limit, dailyPurchases: limit, monthly: limit, dailyAtm: 0 },
      ceilings: { perTransaction: VIRTUAL_MAX, dailyPurchases: VIRTUAL_MAX, monthly: VIRTUAL_MAX, dailyAtm: 0 }, network: parent.network,
    }));
    this.host.otp.verified = false;
    // shown once, here: nothing in the sandbox can say it again
    return { ...summary, id: `card_v${last4}`, last4, expiry, status: single ? "Single use" : "Active", number: group4(number), cvv };
  }
  private deleteVirtual(input: Record<string, any>) {
    const c = this.card(input.cardId);
    if (!c.virtual) throw new BankError("CARD_NOT_FOUND", "We can’t find that card.");
    if (c.status === "blocked") throw new BankError("CARD_ALREADY_BLOCKED", "This card is already blocked.");
    c.status = "blocked";
    return { cardId: c.id, status: "blocked", statusLabel: PILL.blocked };
  }

  /* --------------------------------------------------------------------------------------- replacing */

  private replaceProblem(c: CardRecord, reason: string) {
    if (c.virtual) throw new BankError("CARD_VIRTUAL", "Virtual cards can’t be replaced. Create a new one instead.");
    if (this.f.replaceOnce !== false && c.replacement) throw new BankError("REPLACEMENT_PENDING", `A replacement is already on its way. It arrives by ${c.replacement.arrivesBy}.`);
    const s = this.statusOf(c);
    if (this.f.replaceEligible !== false) {
      if (s === "replaced") throw new BankError("CARD_REPLACED", "This card has already been replaced.");
      if (s === "inactive") throw new BankError("CARD_NOT_ACTIVATED", "This card isn’t active yet.");
    }
    if (!REPLACE_REASONS.includes(reason)) throw new BankError("REASON_INVALID", "Choose a reason.");
    if (reason === "expired" && this.f.replaceExpired !== false && s !== "expired" && this.daysLeft(c) > NEAR_EXPIRY_DAYS) throw new BankError("REASON_INVALID", "This card hasn’t expired yet.");
    return s;
  }
  private addressProblem(a: any) {
    const line = String(a?.line ?? "").trim(), city = String(a?.city ?? "").trim(), post = String(a?.postcode ?? "").trim();
    if (line.length < 3 || line.length > 60) throw new BankError("ADDRESS_INVALID", "Enter the address line (3 to 60 characters).");
    if (city.length < 2 || city.length > 40) throw new BankError("ADDRESS_INVALID", "Enter the city (2 to 40 characters).");
    if (this.market() !== "D" && !/^[A-Za-z0-9 -]{3,10}$/.test(post)) throw new BankError("ADDRESS_INVALID", "Enter a valid postcode.");
    return { line, city, post };
  }
  /** Ordering a replacement (`dry`: checking everything it will check, changing nothing). Every order asks for the code: the card comes to an address, and a fee may be taken. */
  private replace(input: Record<string, any>, dry: boolean) {
    const c = this.card(input.cardId), reason = String(input.reason ?? "");
    this.replaceProblem(c, reason);
    // a card reported lost or stolen has to be blocked before anything is ordered
    if ((reason === "lost" || reason === "stolen") && this.f.lostBlocked !== false && this.statusOf(c) !== "blocked") throw new BankError("CARD_NOT_BLOCKED", "Block the card first.");
    const flat = input.where !== undefined, address = flat ? { line: input.line, city: input.city, postcode: input.postcode } : input.address;
    const home = flat ? input.where !== "other" : address === undefined || address === "home" || address?.home === true;
    let addressText = this.homeAddress();
    if (!home && this.f.replaceAddress !== false) { const a = this.addressProblem(address); addressText = `${a.line}, ${a.city}${a.post ? ` ${a.post}` : ""}`; }
    else if (!home) addressText = String(address?.line ?? "");
    const speed = String(input.speed ?? "standard");
    if (speed !== "standard" && speed !== "express") throw new BankError("DELIVERY_INVALID", "Choose how fast.");
    const fee = speed === "express" && input.fee !== false && this.f.replaceFee !== false ? EXPRESS_FEE : 0;
    const acc = this.account(c);
    if (fee > 0) {
      if (!acc) throw new BankError("ACCOUNT_NOT_FOUND", "We can’t find the account for the fee.");
      if (this.f.replaceFunds !== false && spendable(acc) < fee) throw new BankError("INSUFFICIENT_FUNDS", "Not enough in your account to pay the delivery fee.");
    }
    const needsCode = true;
    const arrives = addWorkingDays(this.now(), speed === "express" ? 2 : 5);
    const summary = { cardId: c.id, name: `${c.nickname} ••${c.last4}`, reason, speed, fee, feeText: fee > 0 ? money(fee, acc?.currency ?? "USD") : "Free", deliveryText: `${speed === "express" ? "Express" : "Standard"}, by ${dayName(arrives)}`, deliverTo: addressText, deliveryBy: dayName(arrives), needsCode, oldCard: reason === "lost" || reason === "stolen" ? "Blocked" : "" };
    if (dry) return summary;
    if (this.f.replaceCode !== false) this.ensureOtp();
    if (fee > 0 && acc) {
      debit(acc, fee);
      this.p.retail?.transactions.push({ id: `tx_fee${++this.seq}`, accountId: acc.id, date: iso(this.now()), title: "Card delivery fee", category: "Fees", amount: -fee, currency: acc.currency, status: "posted" } satisfies AccountTxn);
    }
    this.orders += 1;
    const last4 = String(9300 + this.orders), newId = `card_${last4}`;
    const fresh = record({ ...structuredClone(c), id: newId, last4, expiry: expiryOf(addMonths(this.now(), 36)), status: "inactive", pinSet: false, pinHash: undefined, replacement: undefined, activation: { tries: 0 }, used: { dailyPurchases: 0, dailyAtm: 0, monthly: 0 }, trip: undefined });
    this.data.cards.push(fresh);
    const reference = `RPL-${iso(this.now()).replace(/-/g, "")}-${String(400 + this.orders).padStart(4, "0")}`;
    c.replacement = { reference, newCardId: newId, arrivesBy: dayName(arrives), reason };
    this.host.otp.verified = false;
    return { ...summary, reference, newCardId: newId, last4, newStatus: "Not activated", arrivesBy: dayName(arrives) };
  }

  /* ---------------------------------------------------------------------------------------- disputes */

  private reasons() {
    const ask: Record<string, string[]> = {
      "I don’t recognise it": ["Whether you still have the card"], "Charged twice": ["Date of the other charge"], "Wrong amount": ["The amount you expected"],
      "Goods or service not received": ["What you ordered", "When it should have arrived", "Whether you contacted the merchant"], "Cancelled but charged": ["When you cancelled", "Cancellation reference (optional)"], Other: ["What happened"],
    };
    const days = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => { const t = this.now() - (i + 1) * DAY; return [iso(t), { id: iso(t), name: `${dayName(t)}${i === 0 ? " (yesterday)" : ""}` }]; }));
    return { reasons: DISPUTE_REASONS.map((r) => ({ id: r, name: r, asks: ask[r] })), days30: days(30), days60: days(60), days90: days(90), windowDays: DISPUTE_DAYS };
  }
  /** Why a payment cannot be reported, as "CODE|message", or "" when it can. In the order the customer is told. */
  private disputeProblem(t: CardTxn): string {
    if (this.f.disputeEligible !== false) {
      if (t.status === "pending") return "TRANSACTION_PENDING|This payment is still pending. You can report a problem once it has posted.";
      if (t.amount >= 0) return "NOT_A_PAYMENT_OUT|Only payments out can be reported.";
      if (t.channel === "atm") return "NOT_A_CARD_PAYMENT|This payment can’t be reported here. Contact us.";
    }
    if (t.disputeId && this.f.disputeOnce !== false) return `DISPUTE_EXISTS|You’ve already reported this payment. Case ${t.disputeId}.`;
    if (this.f.disputeWindow !== false && t.daysAgo > DISPUTE_DAYS) return `DISPUTE_WINDOW_CLOSED|It’s been more than ${DISPUTE_DAYS} days since this payment. Contact us.`;
    return "";
  }
  private disputeTxn(input: Record<string, any>) {
    const c = this.card(input.cardId);
    const t = this.data.transactions.find((x) => x.id === input.transactionId && x.cardId === c.id);
    if (!t) throw new BankError("TRANSACTION_NOT_FOUND", "We can’t find that payment.");
    const bad = this.disputeProblem(t);
    if (bad) { const [code, ...msg] = bad.split("|"); throw new BankError(code!, msg.join("|")); }
    return { c, t };
  }
  private disputeCheck(input: Record<string, any>) {
    const { c, t } = this.disputeTxn(input);
    return { ok: true, ...this.txnView(t), cardActive: this.statusOf(c) === "active", cardName: `${c.nickname} ••${c.last4}` };
  }
  private dispute(input: Record<string, any>) {
    const { c, t } = this.disputeTxn(input);
    const reason = String(input.reason ?? "");
    if (!DISPUTE_REASONS.includes(reason)) throw new BankError("REASON_INVALID", "Choose a reason.");
    // the details come as an object or as the same keys beside the reason (a journey cannot build an object from its answers)
    const d = { ...input, ...(input.details ?? {}) } as Record<string, any>, cur = t.currency;
    if (this.f.disputeDetails !== false) {
      if (reason === "Charged twice" && !String(d.otherChargeDate ?? "")) throw new BankError("DETAILS_INVALID", "Choose when the other charge was.");
      if (reason === "Wrong amount") {
        if (!isAmount(d.expectedAmount, cur) || d.expectedAmount <= 0) throw new BankError("DISPUTE_AMOUNT_INVALID", "Enter the amount you expected.");
        if (sameMoney(d.expectedAmount, Math.abs(t.amount), cur)) throw new BankError("DISPUTE_AMOUNT_INVALID", "This is the amount that was charged.");
      }
      if (reason === "Goods or service not received") {
        if (String(d.ordered ?? "").trim().length < 3) throw new BankError("DETAILS_INVALID", "Tell us what you ordered.");
        if (!String(d.arrivedBy ?? "") || !["yes", "no"].includes(String(d.contacted ?? ""))) throw new BankError("DETAILS_INVALID", "Tell us when it should have arrived and whether you contacted the merchant.");
      }
      if (reason === "Cancelled but charged" && !String(d.cancelledOn ?? "")) throw new BankError("DETAILS_INVALID", "Choose when you cancelled.");
      if (reason === "Other" && String(d.text ?? "").trim().length < 10) throw new BankError("DETAILS_INVALID", "Tell us a little more (at least 10 characters).");
      if (reason === "I don’t recognise it" && !["yes", "no"].includes(String(d.cardInPossession ?? ""))) throw new BankError("DETAILS_INVALID", "Tell us whether you still have your card.");
    }
    // blocking from a report only restricts the card, so it needs no code; a card that is not active cannot be blocked again
    const block = input.blockCard === true && reason === "I don’t recognise it" && this.statusOf(c) === "active" && this.f.disputeBlock !== false;
    if (block) c.status = "blocked";
    this.cases += 1;
    const id = `DSP-${9000 + this.cases}`;
    t.disputeId = id;
    (this.data.disputes ??= []).push({ id, cardId: c.id, transactionId: t.id, reason, amount: Math.abs(t.amount), at: this.now(), cardBlocked: block });
    return { disputeId: id, caseRef: id, status: "under_review", statusLabel: "Under review", reference: id, replyBy: longDay(this.now() + 45 * DAY), cardBlocked: block, merchant: t.merchant, amountText: money(Math.abs(t.amount), cur), reason, evidence: Array.isArray(input.evidence) ? input.evidence.map((e: any) => String(e?.name ?? e).slice(0, 80)) : input.evidenceName ? [String(input.evidenceName).slice(0, 80)] : [] };
  }
  private disputes(input: Record<string, any>) {
    const list = (this.data.disputes ?? []).filter((x) => !input.cardId || x.cardId === input.cardId);
    return Object.fromEntries(list.map((x) => [x.id, { id: x.id, cardId: x.cardId, transactionId: x.transactionId, reason: x.reason, amountText: money(x.amount, "USD"), status: "Under review", cardBlocked: x.cardBlocked }]));
  }

  /* ------------------------------------------------------------------------- saving another bank's card */

  private saved = (): SavedCard[] => { if (!this.p.finance) throw new BankError("NOT_SUPPORTED", "Not available for this customer"); return this.p.finance.cards; };
  private brandOf(digits: string): "visa" | "mastercard" | "amex" | undefined {
    if (/^4/.test(digits)) return "visa";
    if (/^(5[1-5]|2(22[1-9]|2[3-9]|[3-6]|7[01]|720))/.test(digits)) return "mastercard";
    if (/^3[47]/.test(digits)) return "amex";
    return undefined;
  }
  /** Every check of the details of a card being saved. Nothing is kept. */
  private checkSaved(input: Record<string, any>) {
    const cards = this.saved(), raw = String(input.number ?? "");
    const f = this.f;
    if (f.cardNumber !== false && !/^[0-9 -]+$/.test(raw)) throw new BankError("CARD_INVALID", "Use digits only.");
    const digits = onlyDigits(raw), brand = this.brandOf(digits);
    const amexOn = this.host.config().options["add-card"]?.acceptAmex !== false && input.acceptAmex !== false;
    if (f.cardNumber !== false) {
      if (!brand || (brand === "amex" && !amexOn)) throw new BankError("CARD_BRAND_UNSUPPORTED", "We can’t accept this type of card.");
      if (digits.length !== (brand === "amex" ? 15 : 16) || !luhnValid(digits)) throw new BankError("CARD_INVALID", "Check the card number.");
    }
    const expiry = String(input.expiry ?? "").replace(/\s/g, "");
    const m = /^(0[1-9]|1[0-2])\/([0-9]{2})$/.exec(expiry);
    if (f.cardExpiry !== false) {
      if (!m) throw new BankError("EXPIRY_INVALID", "Use the format MM/YY.");
      const end = expiryEnd(expiry);
      if (end < this.now()) throw new BankError("CARD_EXPIRED", "This card has expired.");
      if (end > this.now() + 15 * 366 * DAY) throw new BankError("EXPIRY_INVALID", "Check the expiry date.");
    }
    const cvv = String(input.cvv ?? "");
    if (f.cardCvv !== false) {
      const want = brand === "amex" ? 4 : 3;
      if (!new RegExp(`^[0-9]{${want}}$`).test(cvv)) throw new BankError("CVV_INVALID", brand === "amex" ? "Enter the 4 digits on the front." : "Enter the 3 digits on the back.");
    }
    const holder = String(input.holder ?? "").trim();
    if (f.cardCvv !== false && (holder.length < 2 || !/^[A-Za-z .’'-]+$/.test(holder))) throw new BankError("HOLDER_INVALID", "Use letters only.");
    const market = this.market();
    if (f.cardPostcode !== false && market !== "D") {
      const rule = HOME[market === "A" ? "us" : market === "B" ? "uk" : "eu"];
      if (!rule.zip.test(String(input.postcode ?? "").trim())) throw new BankError("POSTCODE_INVALID", rule.message);
    }
    if (f.cardDecline !== false && digits.endsWith("0002")) throw new BankError("CARD_DECLINED", "The card was declined. Try another card.");
    if (f.cardDuplicate !== false && cards.some((c) => c.last4 === digits.slice(-4) && c.expiry === expiry)) throw new BankError("CARD_DUPLICATE", "This card is already saved.");
    if (f.cardLimit !== false && cards.length >= MAX_SAVED_CARDS) throw new BankError("CARD_LIMIT", "You can save up to 5 cards. Remove one to add another.");
    const key = `${digits.slice(-4)}:${expiry}`;
    // a new check starts the verification of this card again
    if (this.adding?.key !== key) this.adding = { key, method: "", tries: 0, verified: false, locked: false };
    return { ok: true, network: brand, networkName: NETWORK_NAME[brand ?? "visa"], last4: digits.slice(-4), expiry, typeText: `${NETWORK_NAME[brand ?? "visa"]} ••${digits.slice(-4)}`, phoneEnding: onlyDigits(this.p.phone).slice(-4) };
  }
  /** The code that proves the person holds the card: a text message or the code in a small test charge. Three wrong tries end it. */
  private verifySaved(input: Record<string, any>) {
    const a = this.adding;
    if (!a) throw new BankError("VERIFY_REQUIRED", "Check the card details first.");
    const method = String(input.method ?? "");
    if (method !== "sms" && method !== "charge") throw new BankError("VERIFY_INVALID", "Choose how to check.");
    if (a.method !== method) { a.method = method; a.tries = 0; a.verified = false; if (!a.locked) a.locked = false; }
    if (a.locked) throw new BankError("VERIFY_LOCKED", "Too many wrong codes. Nothing was saved. Go back to start again.");
    const code = String(input.code ?? "");
    const right = method === "sms" ? code === String(this.p.behaviour.otpCode) || code === "000000" : code === CHARGE_CODE;
    if (!right) {
      a.tries += 1;
      if (a.tries >= 3 && this.f.cardVerify !== false) { a.locked = true; throw new BankError("VERIFY_LOCKED", "Too many wrong codes. Nothing was saved. Go back to start again.", a.tries); }
      throw new BankError("VERIFY_INVALID", "That code isn’t right. Try again.", a.tries);
    }
    a.verified = true;
    return { verified: true, method };
  }
  private addSaved(input: Record<string, any>) {
    const info = this.checkSaved(input), cards = this.saved();
    const a = this.adding;
    if (this.f.cardVerify !== false && !(a?.verified && a.key === `${info.last4}:${info.expiry}`)) throw new BankError("VERIFY_REQUIRED", "Confirm it’s your card first.");
    const nick = String(input.nickname ?? "").trim();
    if (nick && nick.length < 2) throw new BankError("NICKNAME_INVALID", "Use at least 2 characters.");
    const addMoney = input.useToAddMoney !== false, pay = input.useToPay !== false && this.host.config().options["add-card"]?.allowPay !== false && input.allowPay !== false;
    const network = (info.network === "amex" ? "amex" : info.network) as SavedCard["network"];
    const card: SavedCard = { id: `c_${info.last4}`, network, last4: info.last4, holder: String(input.holder ?? this.p.name).trim(), expiry: info.expiry, nickname: nick || "My card", isDefault: cards.length === 0, uses: { addMoney, pay } };
    cards.push(card);
    this.adding = undefined;
    const used = [addMoney ? "Adding money" : "", pay ? "Paying" : ""].filter(Boolean).join(" and ") || "Nothing yet";
    return { cardId: card.id, last4: card.last4, network: card.network, networkName: info.networkName, expiry: card.expiry, nickname: nick, typeText: info.typeText, usedFor: used };
  }
}
