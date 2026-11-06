import { currencyInfo, fromMinor, toMinor } from "@finx/ui-kit";
import { BANKWORKX_FX, midRate } from "../retail/fx";

/**
 * The data behind the BankWorkx bulk payments and payroll runs (sandbox only, made-up names and numbers): the full bank details of the approved
 * suppliers (the company's books only keep them masked), the batches that were sent before, the payroll register and the runs of earlier months.
 */

/** An amount of one currency in another, in the smallest unit of each, rounded half up, at the sandbox's mid-market rate. 0 when the sandbox has no rate. */
export function convertMinor(minor: number, from: string, to: string): number {
  if (from === to) return minor;
  const rate = midRate(from, to, BANKWORKX_FX);
  if (rate === undefined) return 0;
  return Math.round(minor * rate * 10 ** (currencyInfo(to).decimals - currencyInfo(from).decimals));
}

/** What a line of an IBAN, a sort code or a routing number is paid in. */
export const IBAN_CURRENCY: Record<string, string> = { DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR", LU: "EUR", GR: "EUR", GB: "GBP", AE: "AED", SA: "SAR", JO: "JOD", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN" };

/** The details the bank holds for each approved supplier of the demo companies: the bank code (routing number or sort code; none for an IBAN) and the account. */
export const SUPPLIER_ACCOUNTS: Record<string, Record<string, { code: string; account: string }>> = {
  alpha: {
    harb: { code: "021000021", account: "5520018841" },
    nord: { code: "", account: "DE89370400440532013000" },
    whit: { code: "200000", account: "12349911" },
    gulf: { code: "", account: "AE070331234567890123456" },
  },
};

export type SeedLine = { supplierId: string; payee: string; amount: number; currency: string; reference: string; failed?: string };
export type SeedBatch = { name: string; accountId: string; lines: SeedLine[] };
/** Two batches that were paid before the demo day. PAY-1190 has a payment the bank returned. */
export const SEED_BATCHES: Record<string, Record<string, SeedBatch>> = {
  alpha: {
    "PAY-1180": {
      name: "Supplier batch 18", accountId: "alpha_ops", lines: [
        { supplierId: "harb", payee: "Harbour Packaging", amount: 9_800, currency: "USD", reference: "PO-5400" },
        { supplierId: "nord", payee: "Nordic Supplies AB", amount: 6_500, currency: "EUR", reference: "INV-31" },
        { supplierId: "whit", payee: "Whitby Logistics", amount: 5_000, currency: "GBP", reference: "FREIGHT-3" },
        { supplierId: "harb", payee: "Harbour Packaging", amount: 1_450, currency: "USD", reference: "PO-5421" },
        { supplierId: "nord", payee: "Nordic Supplies AB", amount: 2_200, currency: "EUR", reference: "INV-35" },
        { supplierId: "whit", payee: "Whitby Logistics", amount: 1_800, currency: "GBP", reference: "FREIGHT-4" },
      ],
    },
    "PAY-1190": {
      name: "Supplier batch 19", accountId: "alpha_ops", lines: [
        { supplierId: "harb", payee: "Harbour Packaging", amount: 3_200, currency: "USD", reference: "PO-5501" },
        { supplierId: "nord", payee: "Nordic Supplies AB", amount: 1_850, currency: "EUR", reference: "INV-33" },
        { supplierId: "whit", payee: "Whitby Logistics", amount: 920, currency: "GBP", reference: "FREIGHT-5" },
        { supplierId: "gulf", payee: "Gulf Trade FZE", amount: 4_000, currency: "AED", reference: "INV-77", failed: "The account name didn’t match." },
      ],
    },
  },
};
/** The total of a seeded batch in the company's currency, from its lines. */
export function seedTotal(companyId: string, id: string, company = "USD"): number {
  const b = SEED_BATCHES[companyId]?.[id];
  return fromMinor((b?.lines ?? []).reduce((s, l) => s + convertMinor(toMinor(l.amount, l.currency), l.currency, company), 0), company);
}
/** The lines of a seeded batch as the company's books keep them (the amount of each in the company's currency). */
export function seedLines(companyId: string, id: string, company = "USD") {
  return (SEED_BATCHES[companyId]?.[id]?.lines ?? []).map((l, i) => ({ n: i + 1, beneficiaryId: l.supplierId, amount: fromMinor(convertMinor(toMinor(l.amount, l.currency), l.currency, company), company), reference: l.reference }));
}

/** One person on the payroll register. `net` is what was paid last month and what a run starts with; `salary` is the monthly salary the cap is worked out from. All in `currency`. */
export type Employee = { id: string; name: string; dept: string; currency: string; salary: number; net: number; bank: boolean };
export const PAYROLL_REGISTER: Record<string, Employee[]> = {
  alpha: [
    { id: "emp_ali", name: "Ali Hamdan", dept: "Finance", currency: "USD", salary: 3_600, net: 3_600, bank: true },
    { id: "emp_sana", name: "Sana Malik", dept: "Sales", currency: "USD", salary: 4_800, net: 4_800, bank: true },
    { id: "emp_bilal", name: "Bilal Ahmed", dept: "Operations", currency: "USD", salary: 3_000, net: 3_000, bank: true },
    { id: "emp_hina", name: "Hina Rauf", dept: "Engineering", currency: "USD", salary: 6_400, net: 6_400, bank: true },
    { id: "emp_lena", name: "Lena Marsh", dept: "Marketing", currency: "GBP", salary: 3_200, net: 3_000, bank: true },
    { id: "emp_noura", name: "Noura Saleh", dept: "Sales", currency: "AED", salary: 14_000, net: 12_500, bank: true },
    { id: "emp_khalid", name: "Khalid Mansour", dept: "Operations", currency: "SAR", salary: 12_000, net: 11_250, bank: true },
    { id: "emp_rana", name: "Rana Qasem", dept: "Finance", currency: "JOD", salary: 2_200, net: 2_000, bank: true },
    { id: "emp_faris", name: "Faris Qasem", dept: "Engineering", currency: "USD", salary: 3_900, net: 3_900, bank: false },
  ],
};
/** The employees the register's bank accounts end in (shown masked, never in full). */
export const EMPLOYEE_LAST4: Record<string, string> = { emp_ali: "4410", emp_sana: "5521", emp_bilal: "6632", emp_hina: "7743", emp_lena: "8851", emp_noura: "9962", emp_khalid: "1073", emp_rana: "2184", emp_faris: "" };

/** The months that can be chosen in a run, the latest first (the sandbox's demo month is November 2026). */
export const PAY_PERIODS = ["2026-11", "2026-10", "2026-09"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const periodText = (period: string) => `${MONTH_NAMES[Number(period.slice(5, 7)) - 1] ?? period.slice(5, 7)} ${period.slice(0, 4)}`;
/** The run already paid for an earlier month (it is kept in the register's history, not among the payments the tracker lists). */
export const PAYROLL_HISTORY: Record<string, { period: string; id: string; employees: number }[]> = { alpha: [{ period: "2026-10", id: "PAY-1120", employees: 8 }] };
/** What a default run costs in the company's currency: the sum of every employee with bank details, each converted on its own. */
export function defaultRunMinor(companyId: string, company = "USD") {
  return (PAYROLL_REGISTER[companyId] ?? []).filter((e) => e.bank).reduce((s, e) => s + convertMinor(toMinor(e.net, e.currency), e.currency, company), 0);
}
