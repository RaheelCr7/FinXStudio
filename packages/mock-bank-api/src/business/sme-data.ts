import { fromMinor } from "@finx/ui-kit";
import type { HomeMarket } from "../config";

/**
 * What the business sandbox keeps beyond the company's own books (corporate.ts): the transactions of each account, what each person may do with
 * each account, the account numbers a company receives money on, the bank details of the suppliers it has, and the seeds of templates and schedules.
 * All of it is made up and fixed, so scenarios repeat. A real bank's API replaces this behind the same adapters.
 */
export type Tx = { id: string; accountId: string; date: string; description: string; reference: string; /** signed, in the account's currency */ amount: number; currency: string; status: "booked" | "pending" };
/** The four rights a person has on an account (the balance is always visible to someone who can see accounts). */
export type Rights = { transactions: boolean; export: boolean; pay: boolean };

/** What differs from "everything": Alex at Alpha cannot pay from Reserve; at Beta he sees the balance of Payroll and nothing else of it. */
export const RIGHTS: Record<string, Record<string, Record<string, Partial<Rights>>>> = {
  alpha: { alpha_res: { alex: { pay: false } } },
  beta: { beta_pay: { alex: { transactions: false, export: false, pay: false } } },
};

/** Where a company's statements go: its own domain, so a statement is not sent to outsiders by accident. */
export const DOMAINS: Record<string, string> = { alpha: "alpha-trading.example", beta: "beta-services.example", gamma: "gamma-works.example", acme: "acme-trading.example" };

/** The numbers an account receives money on, by the bank's home market (a made-up routing number, sort code, IBAN and BIC). */
export const ACCOUNT_NUMBERS: Record<string, string> = { alpha_ops: "100002001", alpha_res: "100002044", beta_ops: "100003001", beta_pay: "100003002" };
export function identifiers(accountId: string, masked: string, market: HomeMarket): [{ label: string; value: string }, { label: string; value: string }] {
  const tail = masked.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const number = ACCOUNT_NUMBERS[accountId] ?? `1000${tail}`;
  if (market === "us") return [{ label: "Routing number", value: "021000021" }, { label: "Account number", value: number }];
  if (market === "uk") return [{ label: "Sort code", value: "20-00-00" }, { label: "Account number", value: `5500${tail}` }];
  return [{ label: "IBAN", value: `DE00 BWXB 0000 0000 ${tail}` }, { label: "BIC", value: "BWXBDEFFXXX" }];
}

/** The bank details of the suppliers a company already has (the sandbox keeps only a masked line on the supplier itself), to find a second copy. */
export const SUPPLIER_KEYS: Record<string, Record<string, string>> = {
  alpha: { harb: "us:021000021:100008841", nord: "iban:DE89370400440532013000", whit: "uk:200000:60109911", gulf: "iban:AE070331234567890123456" },
  beta: { nimb: "us:021000021:100005521", rhine: "iban:DE89370400440532013000", gulf: "iban:AE070331234567890123456" },
};
/** Whether the bank's record of an account says it is a personal or a business account (the name check of a sort code and account). */
export const UK_ACCOUNT_KIND: Record<string, "personal" | "business"> = { "uk:200000:55779911": "personal" };

const BASE = "2026-11-03";
const addDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
type Spec = { accountId: string; currency: string; count: number; start: number; parties: string[]; payers: string[]; refs: string[] };

/** A list of booked transactions spread over 95 days, from fixed arithmetic (no clock, nothing random). */
function spread(s: Spec, ids: string): Tx[] {
  const out: Tx[] = [];
  for (let i = 0; i < s.count; i++) {
    const incoming = i % 3 === 1, minor = 120_000 + ((i * 791_903) % 4_600_000) + ((i * 37) % 100);
    out.push({
      id: `TX-${ids}-${String(s.start + i).padStart(3, "0")}`, accountId: s.accountId, date: addDay(BASE, -1 - Math.round((i * 93) / (s.count - 1))), currency: s.currency,
      description: incoming ? s.payers[i % s.payers.length]! : s.parties[i % s.parties.length]!, reference: s.refs[i % s.refs.length]!.replace("#", String(1000 + ((i * 17) % 900))),
      amount: (incoming ? 1 : -1) * fromMinor(minor, s.currency), status: "booked",
    });
  }
  return out;
}

/** About 64 synthetic transactions for each company, a few of them pending. */
export function seedTransactions(companyId: string): Tx[] {
  if (companyId === "alpha") {
    return [
      { id: "TX-OP-001", accountId: "alpha_ops", date: BASE, description: "Whitby Logistics", reference: "INV-2290", amount: -2_340, currency: "USD", status: "pending" },
      { id: "TX-OP-002", accountId: "alpha_ops", date: BASE, description: "Crescent Retail Ltd", reference: "INV-2288", amount: 5_100, currency: "USD", status: "pending" },
      ...spread({ accountId: "alpha_ops", currency: "USD", count: 34, start: 3, parties: ["Harbour Packaging", "Nordic Supplies AB", "Whitby Logistics", "Gulf Trade FZE", "Metro Utilities", "Payroll transfer"], payers: ["Crescent Retail Ltd", "Marlow Distribution", "Interest paid"], refs: ["PO-#", "INV-#", "Rent Q4", "Freight #"] }, "OP"),
      { id: "TX-RS-001", accountId: "alpha_res", date: BASE, description: "Transfer to Operating", reference: "Top-up", amount: -1_500, currency: "EUR", status: "pending" },
      ...spread({ accountId: "alpha_res", currency: "EUR", count: 27, start: 2, parties: ["Transfer to Operating", "Nordic Supplies AB", "Bank charges"], payers: ["Rhine Imports GmbH", "Interest paid", "Transfer from Operating"], refs: ["Reserve #", "INV-#", "FX top-up"] }, "RS"),
    ];
  }
  if (companyId === "beta") {
    return [
      { id: "TX-OP-001", accountId: "beta_ops", date: BASE, description: "Nimbus Logistics", reference: "INV-2291", amount: -1_820, currency: "USD", status: "pending" },
      ...spread({ accountId: "beta_ops", currency: "USD", count: 34, start: 2, parties: ["Nimbus Logistics", "Rhine Freight GmbH", "Transfer to Payroll", "Metro Utilities", "Office lease"], payers: ["Orchard Retail Inc", "Delta Wholesale", "Interest paid"], refs: ["INV-#", "Payroll Oct", "Lease #", "PO-#"] }, "OP"),
      ...spread({ accountId: "beta_pay", currency: "USD", count: 29, start: 1, parties: ["Payroll run", "Payroll tax", "Benefits provider"], payers: ["Transfer from Operating", "Interest paid"], refs: ["Payroll #", "Payroll Oct", "Tax #"] }, "PY"),
    ];
  }
  return [];
}

/** The template and schedule seeds of a company (the spec's seed values). Dates are fixed; "today" of the demo is Tuesday 3 November 2026. */
export type SchedSeed = { id: string; supplierId: string; amount: number; currency: string; reference: string; purpose: string; frequency: "once" | "weekly" | "monthly" | "quarterly"; anchor: string; done: number; paid: number; endsOn: string | null; endCount: number | null; status: "awaiting" | "active"; approvals: number; required: 1 | 2; last: string };
export const SCHEDULE_SEEDS: Record<string, SchedSeed[]> = {
  alpha: [
    { id: "BSC-3001", supplierId: "harb", amount: 4_500, currency: "USD", reference: "PO-STANDING", purpose: "Goods", frequency: "monthly", anchor: "2026-12-01", done: 0, paid: 3, endsOn: null, endCount: null, status: "active", approvals: 1, required: 1, last: "Paid 3 Nov" },
    { id: "BSC-3002", supplierId: "whit", amount: 12_000, currency: "GBP", reference: "FREIGHT-Q", purpose: "Services", frequency: "quarterly", anchor: "2027-01-04", done: 0, paid: 0, endsOn: null, endCount: 8, status: "awaiting", approvals: 0, required: 1, last: "" },
  ],
};
