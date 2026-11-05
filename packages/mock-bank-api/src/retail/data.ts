
/** The rest of a retail customer's relationship besides the accounts and BankWorkx spending data: what the retail journeys read and change. */
export type AccountTxn = {
  id: string; accountId: string; /** YYYY-MM-DD */ date: string; title: string; category: string;
  /** signed, in the account's currency: negative is money out */ amount: number; currency: string;
  /** a pending item is on hold: it lowers the available balance but not yet the ledger balance */
  status: "posted" | "pending"; reference?: string;
};
export type IssuedCard = {
  id: string; kind: "debit" | "credit"; network: "visa" | "mastercard"; last4: string; holder: string; expiry: string; nickname: string;
  status: "inactive" | "active" | "frozen" | "blocked"; /** the account a debit card spends from */ accountId?: string; virtual: boolean; pinSet: boolean;
  limits: { daily: number; online: number; atm: number };
  controls: { online: boolean; international: boolean; contactless: boolean; atm: boolean };
  creditLimit?: number; outstanding?: number;
};
export type TermDeposit = { id: string; name: string; principal: number; currency: string; ratePercent: number; termMonths: number; openedOn: string; maturesOn: string; status: "active" | "matured" | "closed"; autoRenew: boolean; accountId: string };
export type SavingsGoal = { id: string; name: string; target: number; saved: number; currency: string; targetDate: string; accountId: string };
export type LoanInstalment = { n: number; due: string; principal: number; interest: number; balance: number };
export type Loan = { id: string; name: string; principal: number; outstanding: number; currency: string; ratePercent: number; monthlyPayment: number; nextDue: string; schedule: LoanInstalment[] };
export type Message = { id: string; subject: string; from: string; at: string; read: boolean; body: string };
export type Notification = {
  id: string; /** which place it belongs to */ context: string; text: string; at: string; read: boolean;
  /** What it is about, said without the details: the bank gives this (not the text) for a notification of another place. */
  topic: "approval" | "payment" | "account" | "card" | "general";
};
export type ServiceRequest = { id: string; type: string; summary: string; status: "open" | "in progress" | "closed"; openedAt: string };
export type Application = {
  id: string; type: "account"; status: "draft" | "submitted" | "in review" | "approved" | "declined" | "active";
  /** the screen to resume on */ step: string; data: Record<string, unknown>; updatedAt: string; productId?: string;
};
export type Profile = {
  name: string; email: string; phone: string; dateOfBirth: string; customerSince: string; language: string;
  address: { line1: string; city: string; region: string; postalCode: string; country: string };
};

export type RetailData = {
  profile: Profile; transactions: AccountTxn[]; cards: IssuedCard[]; deposits: TermDeposit[]; goals: SavingsGoal[]; loans: Loan[];
  messages: Message[]; notifications: Notification[]; requests: ServiceRequest[]; applications: Application[];
};
