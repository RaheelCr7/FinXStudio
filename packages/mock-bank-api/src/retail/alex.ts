import { roundMoney } from "@finx/ui-kit";
import type { AccountTxn, Application, IssuedCard, Loan, LoanInstalment, RetailData } from "./data";

/** Alex Morgan, the personal side of the combined demo (docs/journeys/README.md 1.7). Dates are fixed so tests read the same every day; "today" in the prototype is 3 November 2026. */
export const ALEX_TODAY = "2026-11-03";

const tx = (id: number, accountId: string, date: string, title: string, category: string, amount: number, currency = "USD", status: AccountTxn["status"] = "posted"): AccountTxn =>
  ({ id: `tx_${id}`, accountId, date, title, category, amount, currency, status });

const transactions = (): AccountTxn[] => [
  tx(1, "acc_main", "2026-11-03", "Blue Bottle Café", "Food", -6.4),
  tx(2, "acc_main", "2026-11-03", "Online order, Parcel Co", "Shopping", -118.4, "USD", "pending"),
  tx(3, "acc_main", "2026-11-01", "Salary, Northwind", "Income", 4200),
  tx(4, "acc_main", "2026-10-31", "Metro Transit", "Travel", -32),
  tx(5, "acc_main", "2026-10-30", "StreamPlus", "Subscriptions", -14.99),
  tx(6, "acc_main", "2026-10-29", "Maya Chen", "Transfer", -80),
  tx(7, "acc_main", "2026-10-28", "Green Grocer", "Food", -58.2),
  tx(8, "acc_main", "2026-10-28", "Interest", "Income", 12.4),
  tx(9, "acc_main", "2026-10-25", "Fuel, Highway 9", "Travel", -46.1),
  tx(10, "acc_main", "2026-10-22", "Pharmacy", "Health", -18.9),
  tx(11, "acc_main", "2026-10-15", "Gym membership", "Health", -39),
  tx(12, "acc_main", "2026-10-12", "Cinema", "Entertainment", -32),
  tx(13, "acc_main", "2026-10-05", "Rent", "Home", -1450),
  tx(14, "acc_main", "2026-10-01", "Salary, Northwind", "Income", 4200),
  tx(15, "acc_main", "2026-09-28", "Green Grocer", "Food", -64.75),
  tx(16, "acc_main", "2026-09-05", "Rent", "Home", -1450),
  tx(17, "acc_main", "2026-09-01", "Salary, Northwind", "Income", 4200),
  tx(18, "acc_save", "2026-10-31", "Interest", "Income", 31.2),
  tx(19, "acc_save", "2026-10-01", "From Main", "Transfer", 500),
  tx(20, "acc_save", "2026-09-01", "From Main", "Transfer", 500),
  tx(21, "acc_eur", "2026-10-20", "Café Central, Vienna", "Food", -24.5, "EUR"),
  tx(22, "acc_eur", "2026-10-18", "Rail ticket", "Travel", -89, "EUR"),
  tx(23, "acc_eur", "2026-10-02", "From Main", "Transfer", 1000, "EUR"),
  tx(24, "acc_aed", "2026-10-24", "Souk Market", "Shopping", -42.8, "AED"),
  tx(25, "acc_aed", "2026-10-10", "Omar Haddad", "Transfer", -120, "AED"),
  tx(26, "acc_aed", "2026-10-02", "From Main", "Transfer", 800, "AED"),
];


const card = (c: Partial<IssuedCard> & Pick<IssuedCard, "id" | "kind" | "last4" | "nickname">): IssuedCard => ({
  network: c.kind === "credit" ? "mastercard" : "visa", holder: "Alex Morgan", expiry: "11/29", status: "active", virtual: false, pinSet: true,
  limits: { daily: 5000, online: 3000, atm: 1000 }, controls: { online: true, international: false, contactless: true, atm: true }, ...c,
});
const cards = (): IssuedCard[] => [
  card({ id: "card_debit", kind: "debit", last4: "4410", nickname: "Debit", accountId: "acc_main" }),
  card({ id: "card_credit", kind: "credit", last4: "0873", nickname: "Credit", limits: { daily: 12000, online: 6000, atm: 500 }, creditLimit: 12000, outstanding: 1340.2, controls: { online: true, international: true, contactless: true, atm: false } }),
  card({ id: "card_new", kind: "debit", last4: "2290", nickname: "Debit (new)", accountId: "acc_main", status: "inactive", pinSet: false, expiry: "11/30" }),
];

/** An even-instalment loan: the schedule that pays `outstanding` off over `n` months at `ratePercent`. */
export function loanSchedule(outstanding: number, ratePercent: number, n: number, firstDue: string, currency: string): { monthlyPayment: number; schedule: LoanInstalment[] } {
  const i = ratePercent / 100 / 12;
  const pay = roundMoney(i === 0 ? outstanding / n : (outstanding * i) / (1 - (1 + i) ** -n), currency);
  const [y, m, d] = firstDue.split("-").map(Number) as [number, number, number];
  let balance = outstanding;
  const schedule = Array.from({ length: n }, (_, k) => {
    const interest = roundMoney(balance * i, currency);
    const principal = k === n - 1 ? balance : roundMoney(pay - interest, currency);
    balance = roundMoney(balance - principal, currency);
    const due = new Date(Date.UTC(y, m - 1 + k, d)).toISOString().slice(0, 10);
    return { n: k + 1, due, principal, interest, balance };
  });
  return { monthlyPayment: pay, schedule };
}
const loans = (): Loan[] => {
  const s = loanSchedule(7480, 8.9, 20, "2026-11-15", "USD");
  return [{ id: "loan_personal", name: "Personal loan", principal: 12000, outstanding: 7480, currency: "USD", ratePercent: 8.9, monthlyPayment: s.monthlyPayment, nextDue: "2026-11-15", schedule: s.schedule }];
};

const applications = (): Application[] => [
  { id: "APP-1001", type: "account", status: "draft", step: "address", productId: "savings", updatedAt: "2026-11-02T18:20:00Z", data: { firstName: "Alex", lastName: "Morgan", email: "alex.morgan@example.com" } },
  { id: "APP-1002", type: "account", status: "approved", step: "status", productId: "current", updatedAt: "2026-10-30T09:05:00Z", data: { firstName: "Alex", lastName: "Morgan" } },
];

export const alexRetail = (): RetailData => ({
  profile: { name: "Alex Morgan", email: "alex.morgan@example.com", phone: "+1 415 555 0142", dateOfBirth: "1988-04-17", customerSince: "2019-03-12", language: "en", address: { line1: "12 Harbour Road", city: "Springfield", region: "IL", postalCode: "10001", country: "US" } },
  transactions: transactions(),
  cards: cards(),
  deposits: [
    { id: "td_1", name: "12-month deposit", principal: 5000, currency: "USD", ratePercent: 4.1, termMonths: 12, openedOn: "2026-03-03", maturesOn: "2027-03-03", status: "active", autoRenew: false, accountId: "acc_save" },
    { id: "td_2", name: "6-month deposit", principal: 2000, currency: "USD", ratePercent: 3.6, termMonths: 6, openedOn: "2026-05-02", maturesOn: "2026-11-02", status: "matured", autoRenew: false, accountId: "acc_save" },
  ],
  goals: [
    { id: "goal_holiday", name: "Holiday", target: 3000, saved: 1250, currency: "USD", targetDate: "2027-06-30", accountId: "acc_save" },
    { id: "goal_reserve", name: "Emergency fund", target: 10000, saved: 6400, currency: "USD", targetDate: "2027-12-31", accountId: "acc_save" },
  ],
  loans: loans(),
  messages: [
    { id: "msg_1", subject: "Your statement is ready", from: "BankWorkx", at: "2026-11-01T06:00:00Z", read: false, body: "Your October statement for Main is ready to download." },
    { id: "msg_2", subject: "Your deposit has matured", from: "BankWorkx", at: "2026-11-02T06:00:00Z", read: false, body: "Your 6-month deposit has matured. Renew it or move the money." },
    { id: "msg_3", subject: "Welcome to BankWorkx", from: "BankWorkx", at: "2019-03-12T10:00:00Z", read: true, body: "Thanks for banking with us." },
  ],
  notifications: [
    { id: "n_1", context: "beta", text: "Payment awaiting your approval: USD 8,200.00 to Nimbus Logistics", at: "2026-11-03T09:12:00Z", read: false, topic: "approval" },
    { id: "n_2", context: "personal", text: "Salary received: $4,200.00", at: "2026-11-01T06:00:00Z", read: true, topic: "account" },
    { id: "n_3", context: "alpha", text: "Payment PAY-1187 settled", at: "2026-10-30T14:00:00Z", read: true, topic: "payment" },
  ],
  requests: [{ id: "REQ-5001", type: "Card", summary: "Replacement card sent", status: "in progress", openedAt: "2026-10-29T10:00:00Z" }],
  applications: applications(),
});
