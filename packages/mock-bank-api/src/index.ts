export type Account = { id: string; name: string; maskedNumber: string; iban: string; balance: number; currency: string; status: "active" | "frozen"; canDebit: boolean };
export type Beneficiary = { id: string; displayName: string; bank: string; maskedNumber: string; addedAt: number };
export type Persona = {
  id: string;
  name: string;
  phone: string;
  accounts: Account[];
  beneficiaries: Beneficiary[];
  limits: { daily: number; usedToday: number };
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
    id: "ayesha", name: "Ayesha Rahman", phone: "+92 300 1234471",
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
    id: "bilal", name: "Bilal Raza (transfer fails)", phone: "+92 301 5550192",
    accounts: [{ id: "acc_current", name: "Current", maskedNumber: "••3301", iban: "PK50 MEZN 0000 7777 0000 3301", balance: 92000, currency: "PKR", status: "active", canDebit: true }],
    beneficiaries: [{ id: "ben_9001", displayName: "Hira Builders", bank: "MCB", maskedNumber: "••9001", addedAt: Date.now() - 12 * day }],
    limits: { daily: 50000, usedToday: 40000 },
    behaviour: { otpCode: "111111", transferFails: true, kyc: "verified" },
  },
  zara: {
    id: "zara", name: "Zara Ali (KYC rejected)", phone: "+92 333 2000123",
    accounts: [],
    beneficiaries: [],
    limits: { daily: 25000, usedToday: 0 },
    behaviour: { otpCode: "123456", kyc: "rejected" },
  },
};

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
