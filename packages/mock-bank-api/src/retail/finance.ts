import { alexInvest, type InvestState } from "./invest";

/** Sandbox data for the BankWorkx (money management) app: spending, budgets, subscriptions, cards and linked banks. */

export type Category = "food" | "income" | "shopping" | "coffee" | "rent" | "transport" | "entertainment" | "health" | "groceries" | "vehicle" | "investing";
export type Txn = { id: string; title: string; category: Category; /** negative = money out */ amount: number; daysAgo: number; time?: string };
export type Budget = { id: string; name: string; category: Category; limit: number; spent: number };
export type Subscription = { id: string; name: string; amount: number; nextInDays: number; color: string };
export type LinkedBank = { id: string; bank: string; kind: "Savings" | "Current" | "Credit"; maskedNumber: string; balance: number };
export type SavedCard = { id: string; network: "mastercard" | "visa"; last4: string; holder: string; expiry: string; nickname: string; isDefault: boolean };
export type Finance = {
  currency: string;
  income: number; expense: number; savings: number;
  /** Balance over the current month, one point per entry. */
  balanceSeries: { label: string; value: number }[];
  /** Portfolio-style 5 range series for the chart's period switch. */
  ranges: Record<"1W" | "1M" | "3M" | "1Y", { label: string; value: number }[]>;
  spendingByCategory: { label: string; value: number }[];
  transactions: Txn[];
  budgets: Budget[];
  subscriptions: Subscription[];
  linked: LinkedBank[];
  cards: SavedCard[];
  invest: InvestState;
};

/** The banks a customer can connect. Names are made up. */
export const BANKS = [
  { id: "northwind", name: "Northwind Bank", color: "#E0457B" },
  { id: "harbor", name: "Harbor Trust", color: "#2B4FB4" },
  { id: "apex", name: "Apex Credit Union", color: "#0BB5E3" },
  { id: "summit", name: "Summit Federal", color: "#1AA37A" },
];

const wave = (base: number, amp: number, n: number, phase = 0) =>
  Array.from({ length: n }, (_, i) => Math.round((base + Math.sin(i * 0.9 + phase) * amp + i * (amp / 6)) * 100) / 100);
const labels = (n: number, unit: string) => Array.from({ length: n }, (_, i) => `${unit} ${i + 1}`);
const series = (base: number, amp: number, n: number, unit: string, phase = 0) => {
  const v = wave(base, amp, n, phase), l = labels(n, unit);
  return v.map((value, i) => ({ label: l[i]!, value }));
};

export const alexFinance = (): Finance => ({
  currency: "USD",
  income: 3480, expense: 2406.4, savings: 1073.6,
  balanceSeries: series(7400, 900, 14, "Day"),
  ranges: {
    "1W": series(8200, 380, 7, "Day", 1), "1M": series(7400, 900, 14, "Day"), "3M": series(6900, 1500, 12, "Week", 2), "1Y": series(5200, 3400, 12, "Month", 0.4),
  },
  spendingByCategory: [
    { label: "Groceries", value: 1240 }, { label: "Health & Wellness", value: 620 }, { label: "Home Rent", value: 2100 }, { label: "Vehicle", value: 780 }, { label: "Entertainment", value: 460 },
  ],
  transactions: [
    { id: "t1", title: "Food & Drinks", category: "food", amount: -20, daysAgo: 0, time: "7:00 PM" },
    { id: "t2", title: "Freelancing Work", category: "income", amount: 22, daysAgo: 1, time: "2:15 PM" },
    { id: "t3", title: "Shopping", category: "shopping", amount: -20, daysAgo: 1, time: "11:40 AM" },
    { id: "t4", title: "Starbucks Coffee", category: "coffee", amount: -21, daysAgo: 2, time: "8:05 AM" },
    { id: "t5", title: "Monthly Rent", category: "rent", amount: -900, daysAgo: 3, time: "9:00 AM" },
    { id: "t6", title: "Salary", category: "income", amount: 3200, daysAgo: 5, time: "6:00 AM" },
    { id: "t7", title: "Fuel", category: "vehicle", amount: -45, daysAgo: 6, time: "5:30 PM" },
    { id: "t8", title: "Groceries", category: "groceries", amount: -86.5, daysAgo: 7, time: "6:10 PM" },
    { id: "t9", title: "Cinema", category: "entertainment", amount: -32, daysAgo: 9, time: "8:45 PM" },
    { id: "t10", title: "Pharmacy", category: "health", amount: -18.9, daysAgo: 11, time: "1:20 PM" },
  ],
  budgets: [
    { id: "b_food", name: "Food & Drinks", category: "food", limit: 1500, spent: 525 },
    { id: "b_shop", name: "Shopping", category: "shopping", limit: 1500, spent: 450 },
    { id: "b_ent", name: "Entertainment", category: "entertainment", limit: 300, spent: 272 },
  ],
  subscriptions: [
    { id: "s_google", name: "Google One", amount: 21, nextInDays: 4, color: "#4285F4" },
    { id: "s_video", name: "StreamPlus", amount: 27, nextInDays: 9, color: "#E5484D" },
    { id: "s_music", name: "TuneBox", amount: 11, nextInDays: 14, color: "#1AA37A" },
  ],
  linked: [{ id: "l_summit", bank: "Summit Federal", kind: "Savings", maskedNumber: "••9876", balance: 9876.54 }],
  invest: alexInvest(),
  cards: [{ id: "c_5832", network: "mastercard", last4: "5832", holder: "Alex Morgan", expiry: "11/28", nickname: "Everyday", isDefault: true }],
});

/** Luhn check: the standard test for a plausible card number. */
export function luhnValid(num: string): boolean {
  const d = num.replace(/\s/g, "");
  if (!/^[0-9]{13,19}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
export const cardNetwork = (num: string): "visa" | "mastercard" => (num.replace(/\s/g, "").startsWith("4") ? "visa" : "mastercard");
