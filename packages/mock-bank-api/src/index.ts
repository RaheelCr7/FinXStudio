import { instrumentOf, INSTRUMENTS, dayChange } from "./invest";
import { alexFinance, BANKS, cardNetwork, luhnValid, type Finance } from "./finance";
export * from "./finance";
export * from "./invest";

export type Account = { id: string; name: string; maskedNumber: string; iban: string; balance: number; currency: string; status: "active" | "frozen"; canDebit: boolean };
export type Beneficiary = { id: string; displayName: string; bank: string; maskedNumber: string; addedAt: number };
export type Persona = {
  id: string;
  /** Which bank app this sandbox customer belongs to. */
  brand: "meezan" | "bankworkx";
  name: string;
  phone: string;
  accounts: Account[];
  beneficiaries: Beneficiary[];
  limits: { daily: number; usedToday: number };
  /** Spending, budgets and cards, for the BankWorkx app. */
  finance?: Finance;
  /** deterministic failure modes for testing unhappy paths */
  behaviour: { otpCode: string; transferFails?: boolean; kyc: "verified" | "pending" | "rejected" };
};

const day = 24 * 3600 * 1000;
export const BILLERS = [
  { id: "k_electric", name: "K-Electric", category: "Electricity" }, { id: "lesco", name: "LESCO", category: "Electricity" },
  { id: "ssgc", name: "SSGC", category: "Gas" }, { id: "ptcl", name: "PTCL", category: "Internet" },
];
export const CARRIERS = [{ id: "jazz", name: "Jazz" }, { id: "zong", name: "Zong" }, { id: "telenor", name: "Telenor" }, { id: "ufone", name: "Ufone" }];

export const personas: Record<string, Persona> = {
  ayesha: {
    id: "ayesha", brand: "meezan", name: "Ayesha Rahman", phone: "+92 300 1234471",
    accounts: [
      { id: "acc_current", name: "Current", maskedNumber: "••7710", iban: "PK36 MEZN 0000 1234 5678 7710", balance: 184250, currency: "PKR", status: "active", canDebit: true },
      { id: "acc_savings", name: "Savings", maskedNumber: "••2204", iban: "PK12 MEZN 0000 1234 5678 2204", balance: 1250000, currency: "PKR", status: "active", canDebit: true },
    ],
    beneficiaries: [
      { id: "ben_4821", displayName: "Ahmed Khan", bank: "HBL", maskedNumber: "••4821", addedAt: Date.now() - 90 * day },
      { id: "ben_1190", displayName: "Sana Malik", bank: "UBL", maskedNumber: "••1190", addedAt: Date.now() - 40 * day },
    ],
    limits: { daily: 50000, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  bilal: {
    id: "bilal", brand: "meezan", name: "Bilal Raza (transfer fails)", phone: "+92 301 5550192",
    accounts: [{ id: "acc_current", name: "Current", maskedNumber: "••3301", iban: "PK50 MEZN 0000 7777 0000 3301", balance: 92000, currency: "PKR", status: "active", canDebit: true }],
    beneficiaries: [{ id: "ben_9001", displayName: "Hira Builders", bank: "MCB", maskedNumber: "••9001", addedAt: Date.now() - 12 * day }],
    limits: { daily: 50000, usedToday: 40000 },
    behaviour: { otpCode: "111111", transferFails: true, kyc: "verified" },
  },
  alex: {
    id: "alex", brand: "bankworkx", name: "Alex Morgan", phone: "+1 415 555 0142",
    accounts: [
      { id: "acc_main", name: "Main", maskedNumber: "••4410", iban: "US00 BWX 0000 0000 4410", balance: 8720.76, currency: "USD", status: "active", canDebit: true },
      { id: "acc_save", name: "Savings", maskedNumber: "••7731", iban: "US00 BWX 0000 0000 7731", balance: 15254.37, currency: "USD", status: "active", canDebit: true },
    ],
    beneficiaries: [],
    limits: { daily: 50000, usedToday: 0 },
    finance: alexFinance(),
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  sam: {
    id: "sam", brand: "bankworkx", name: "Sam Rivera (new customer)", phone: "+1 415 555 0199",
    accounts: [], beneficiaries: [], limits: { daily: 50000, usedToday: 0 },
    finance: { ...alexFinance(), income: 0, expense: 0, savings: 0, balanceSeries: [], ranges: { "1W": [], "1M": [], "3M": [], "1Y": [] }, spendingByCategory: [], transactions: [], budgets: [], subscriptions: [], linked: [], cards: [], invest: { holdings: [], watchlist: [] } },
    behaviour: { otpCode: "123456", kyc: "verified" },
  },
  zara: {
    id: "zara", brand: "meezan", name: "Zara Ali (KYC rejected)", phone: "+92 333 2000123",
    accounts: [],
    beneficiaries: [],
    limits: { daily: 25000, usedToday: 0 },
    behaviour: { otpCode: "123456", kyc: "rejected" },
  },
};

/** The sandbox customers for one bank app. */
export const personasFor = (brand: Persona["brand"]) => Object.values(personas).filter((p) => p.brand === brand);

export class MockBank {
  private p: Persona;
  private otpAttempts = 0;
  private otpVerified = false;
  private seq = 0;
  constructor(personaId = "ayesha") {
    const base = personas[personaId];
    if (!base) throw new Error(`Unknown persona ${personaId}`);
    this.p = structuredClone(base);
  }
  get persona() { return this.p; }

  /** Single entry point used by journeys: adapter id + input -> result. */
  async call(adapter: string, input: Record<string, any> = {}): Promise<any> {
    switch (adapter) {
      case "bank.accounts.list":
        return Object.fromEntries(this.p.accounts.map((a) => [a.id, a]));
      case "bank.beneficiaries.list":
        return Object.fromEntries(this.p.beneficiaries.map((b) => [b.id, { ...b, ageHours: Math.floor((Date.now() - b.addedAt) / 3600000) }]));
      case "bank.limits.get":
        return { ...this.p.limits };
      case "bank.otp.send":
        this.otpAttempts = 0;
        this.otpVerified = false;
        return { sent: true, maskedPhone: this.p.phone.replace(/\d(?=\d{4})/g, "•"), channel: input.channel ?? "sms" };
      case "bank.otp.verify": {
        this.otpAttempts += 1;
        if (String(input.code) !== this.p.behaviour.otpCode && String(input.code) !== "000000") throw new BankError("OTP_INVALID", "Incorrect code", this.otpAttempts);
        this.otpVerified = true;
        return { verified: true };
      }
      case "bank.transfers.create": {
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const amount = Number(input.amount);
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        if (this.p.limits.usedToday + amount > this.p.limits.daily) throw new BankError("LIMIT_EXCEEDED", "Daily limit exceeded");
        from.balance -= amount;
        this.p.limits.usedToday += amount;
        this.otpVerified = false;
        this.seq += 1;
        return { reference: `TRX-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: from.balance };
      }
      case "bank.billers.list":
        return Object.fromEntries(BILLERS.map((b) => [b.id, b]));
      case "bank.bills.lookup": {
        const biller = BILLERS.find((b) => b.id === input.billerId);
        const ref = String(input.reference ?? "").replace(/\s/g, "");
        if (!biller) throw new BankError("BILLER_NOT_FOUND", "Unknown biller");
        if (!/^[0-9]{10,14}$/.test(ref)) throw new BankError("BILL_NOT_FOUND", "No bill found for this reference");
        const amount = 1000 + (parseInt(ref.slice(-4), 10) % 9000);
        return { billerName: biller.name, reference: ref, payerName: this.p.name.split(" (")[0], amount, dueDate: "2026-11-12" };
      }
      case "bank.bills.pay":
      case "bank.topup.create": {
        const isBill = adapter === "bank.bills.pay";
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const amount = Number(input.amount);
        if (!isBill && !(amount >= 50 && amount <= 5000)) throw new BankError("INVALID_AMOUNT", "Top-up must be between 50 and 5,000");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        if (this.p.limits.usedToday + amount > this.p.limits.daily) throw new BankError("LIMIT_EXCEEDED", "Daily limit exceeded");
        from.balance -= amount;
        this.p.limits.usedToday += amount;
        this.otpVerified = false;
        this.seq += 1;
        return { reference: `${isBill ? "BILL" : "TOP"}-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: from.balance };
      }
      case "bank.banks.list":
        return Object.fromEntries(BANKS.map((b) => [b.id, { id: b.id, name: b.name, color: b.color }]));
      case "bank.cards.list":
        return Object.fromEntries((this.p.finance?.cards ?? []).map((c) => [c.id, { ...c, name: `${c.nickname} ••${c.last4}` }]));
      case "bank.budgets.list":
        return Object.fromEntries((this.p.finance?.budgets ?? []).map((b) => [b.id, b]));
      case "bank.subscriptions.list":
        return Object.fromEntries((this.p.finance?.subscriptions ?? []).map((x) => [x.id, x]));
      case "bank.deposit.create": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const to = this.p.accounts.find((a) => a.id === input.toAccountId);
        if (!to) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        const amount = Number(input.amount);
        if (!(amount >= 1 && amount <= 50000)) throw new BankError("INVALID_AMOUNT", "Enter an amount from $1 to $50,000");
        if (!fin.cards.some((c) => c.id === input.fromCardId)) throw new BankError("CARD_NOT_FOUND", "Choose a card to add money from");
        to.balance = Math.round((to.balance + amount) * 100) / 100;
        fin.transactions.unshift({ id: `t_dep${++this.seq}`, title: "Added money", category: "income", amount, daysAgo: 0, time: "Now" });
        return { reference: `ADD-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: to.balance };
      }
      case "bank.cards.add": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const num = String(input.number ?? "").replace(/\s/g, "");
        if (!luhnValid(num)) throw new BankError("CARD_INVALID", "That card number is not valid");
        const m = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/.exec(String(input.expiry ?? "").replace(/\s/g, ""));
        if (!m) throw new BankError("EXPIRY_INVALID", "Enter the expiry as MM/YY");
        const exp = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59);
        if (exp.getTime() < Date.UTC(2026, 10, 2)) throw new BankError("CARD_EXPIRED", "This card has expired");
        if (!/^[0-9]{3,4}$/.test(String(input.cvv ?? ""))) throw new BankError("CVV_INVALID", "Enter the 3 or 4 digit security code");
        if (fin.cards.some((c) => c.last4 === num.slice(-4))) throw new BankError("CARD_EXISTS", "This card is already added");
        const makeDefault = input.makeDefault === true || fin.cards.length === 0;
        if (makeDefault) fin.cards.forEach((c) => { c.isDefault = false; });
        const card = { id: `c_${num.slice(-4)}`, network: cardNetwork(num), last4: num.slice(-4), holder: String(input.holder ?? this.p.name), expiry: `${m[1]}/${m[2]}`, nickname: String(input.nickname || "My card"), isDefault: makeDefault };
        fin.cards.push(card);
        return { cardId: card.id, last4: card.last4, network: card.network };
      }
      case "bank.accounts.connect": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const bank = BANKS.find((b) => b.id === input.bankId);
        if (!bank) throw new BankError("BANK_NOT_FOUND", "Choose a bank to connect");
        if (!String(input.username ?? "").trim() || String(input.password ?? "").length < 6) throw new BankError("BANK_AUTH_FAILED", "Check your username and password");
        if (String(input.password) === "invalid123") throw new BankError("BANK_AUTH_FAILED", `${bank.name} did not accept these details`);
        if (fin.linked.some((l) => l.id === `l_${bank.id}`)) throw new BankError("ALREADY_CONNECTED", `${bank.name} is already connected`);
        const kind = input.accountType === "credit" ? "Credit" : "Savings";
        const linked = { id: `l_${bank.id}`, bank: bank.name, kind, maskedNumber: `••${String(1000 + (String(input.username).length * 977) % 9000).slice(-4)}`, balance: kind === "Credit" ? 1240.5 : 4210.25 } as const;
        fin.linked.push(linked);
        return { connectedId: linked.id, bank: bank.name, kind, maskedNumber: linked.maskedNumber, balance: linked.balance };
      }
      case "bank.budgets.create": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const limit = Number(input.limit);
        if (!(limit >= 10 && limit <= 100000)) throw new BankError("INVALID_AMOUNT", "A budget must be between $10 and $100,000");
        const name = String(input.category ?? "").trim();
        if (!name) throw new BankError("CATEGORY_REQUIRED", "Choose a category");
        if (fin.budgets.some((b) => b.name.toLowerCase() === name.toLowerCase())) throw new BankError("BUDGET_EXISTS", `You already have a ${name} budget`);
        const b = { id: `b_${name.toLowerCase().replace(/[^a-z]+/g, "_")}`, name, category: "shopping" as const, limit, spent: 0 };
        fin.budgets.push(b);
        return { budgetId: b.id, name, limit };
      }
      case "bank.subscriptions.pay": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const sub = fin.subscriptions.find((x) => x.id === input.subscriptionId);
        if (!sub) throw new BankError("SUBSCRIPTION_NOT_FOUND", "Subscription not found");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (sub.amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        from.balance = Math.round((from.balance - sub.amount) * 100) / 100;
        sub.nextInDays += 30;
        fin.transactions.unshift({ id: `t_sub${++this.seq}`, title: sub.name, category: "entertainment", amount: -sub.amount, daysAgo: 0, time: "Now" });
        return { reference: `SUB-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: from.balance };
      }
      case "bank.invest.instruments":
        return Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, { id: i.symbol, symbol: i.symbol, kind: i.kind, sector: i.sector, price: i.price, changePct: dayChange(i).pct, name: `${i.name} (${i.symbol}) · $${i.price.toFixed(2)}` }]));
      case "bank.invest.buy": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const inst = instrumentOf(String(input.symbol));
        if (!inst) throw new BankError("INSTRUMENT_NOT_FOUND", "Choose a stock or fund to buy");
        const amount = Number(input.amount);
        if (!(amount >= 1 && amount <= 50000)) throw new BankError("INVALID_AMOUNT", "Enter an amount from $1 to $50,000");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        const shares = Math.round((amount / inst.price) * 10000) / 10000;
        const held = fin.invest.holdings.find((h) => h.symbol === inst.symbol);
        if (held) { held.avgCost = (held.avgCost * held.shares + amount) / (held.shares + shares); held.shares = Math.round((held.shares + shares) * 10000) / 10000; }
        else fin.invest.holdings.push({ symbol: inst.symbol, shares, avgCost: inst.price });
        from.balance = Math.round((from.balance - amount) * 100) / 100;
        fin.transactions.unshift({ id: `t_inv${++this.seq}`, title: `Bought ${inst.symbol}`, category: "investing", amount: -amount, daysAgo: 0, time: "Now" });
        return { reference: `INV-20261102-${String(930 + this.seq).padStart(4, "0")}`, symbol: inst.symbol, name: inst.name, shares, price: inst.price, newBalance: from.balance };
      }
      case "bank.invest.watch": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        if (!instrumentOf(String(input.symbol))) throw new BankError("INSTRUMENT_NOT_FOUND", "Unknown stock or fund");
        const w = fin.invest.watchlist.filter((s) => s !== input.symbol);
        fin.invest.watchlist = input.on === false ? w : [...w, String(input.symbol)];
        return { watching: input.on !== false };
      }
      case "bank.carriers.list":
        return Object.fromEntries(CARRIERS.map((c) => [c.id, c]));
      default:
        throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
    }
  }
}

export class BankError extends Error {
  constructor(public code: string, message: string, public attempt?: number) {
    super(message);
    this.name = "BankError";
  }
}

export * from "./catalog";
