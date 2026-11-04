import type { CorpCompany, CorpPayment } from "./corporate";
import type { CorporateProvider } from "./corporate-provider";

/**
 * The two companies of the combined demo (docs/journeys/02-sme.md, seed values). Alex Morgan is Maker at Alpha Trading LLC (starts
 * payments, cannot approve) and Approver at Beta Services Ltd (approves, cannot start). Both are USD, with a person limit, a company
 * limit of 1,000,000, two approvers above 50,000 and a confirmation code from 25,000. Dates are fixed: "today" is 3 November 2026.
 */
export const ALPHA: CorpCompany = {
  id: "alpha", name: "Alpha Trading LLC", currency: "USD",
  accounts: [
    { id: "alpha_ops", name: "Operating", maskedNumber: "••2001", currency: "USD", balance: 480_000 },
    { id: "alpha_res", name: "Reserve", maskedNumber: "••2044", currency: "EUR", balance: 95_200 },
  ],
  users: [
    { id: "alex", name: "Alex Morgan", roles: ["initiator"], dailyLimit: 250_000, usedToday: 18_900 },
    { id: "tess_m", name: "Tess Moreau", roles: ["initiator"], dailyLimit: 100_000, usedToday: 0 },
    { id: "dana", name: "Dana Cruz", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "lee", name: "Lee Park", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "ravi", name: "Ravi Menon", roles: ["admin"], dailyLimit: 0, usedToday: 0 },
  ],
  whitelist: [
    { id: "harb", name: "Harbour Packaging", bank: "JPMorgan Chase", maskedNumber: "ABA 021000021 · ••8841", country: "US", currency: "USD" },
    { id: "nord", name: "Nordic Supplies AB", bank: "Commerzbank", maskedNumber: "DE89 •••• 3000", country: "DE", currency: "EUR" },
    { id: "whit", name: "Whitby Logistics", bank: "Barclays", maskedNumber: "20-00-00 · ••9911", country: "GB", currency: "GBP" },
    { id: "gulf", name: "Gulf Trade FZE", bank: "Emirates NBD", maskedNumber: "AE07 •••• 3456", country: "AE", currency: "AED" },
  ],
  employees: [
    { id: "emp_1", name: "Noah Becker", bank: "Chase", maskedNumber: "••1201", salary: 5_200 },
    { id: "emp_2", name: "Sofia Alvarez", bank: "Wells Fargo", maskedNumber: "••1202", salary: 6_100 },
    { id: "emp_3", name: "Jonas Lindqvist", bank: "Citi", maskedNumber: "••1203", salary: 4_800 },
  ],
  companyDailyLimit: 1_000_000, companyUsedToday: 0, dualApprovalAbove: 50_000, codeAbove: 25_000,
  cutoff: "16:00", holidays: ["2026-11-09"], paymentSeq: { prefix: "PAY", start: 2042 },
  templates: [
    { id: "tpl_packaging", name: "Monthly packaging", beneficiaryId: "harb", amount: 4_500, reference: "PO-STANDING", purpose: "Goods or services" },
    { id: "tpl_freight", name: "Quarterly freight", beneficiaryId: "whit", reference: "FREIGHT-Q", purpose: "Services" },
  ],
  signatoryGroups: [
    { id: "grp_standard", name: "Standard approvals", mode: "parallel", members: ["dana", "lee"], required: 1, above: 0 },
    { id: "grp_large", name: "Large payments", mode: "sequential", members: ["dana", "lee"], required: 2, above: 50_000 },
  ],
  audit: [
    { at: "2026-11-03T09:58:00Z", userId: "ravi", action: "Changed Dana Cruz's daily limit", outcome: "Done" },
    { at: "2026-11-02T11:20:00Z", userId: "ravi", action: "Invited Tess Moreau as Maker", outcome: "Done" },
  ],
};

export const BETA: CorpCompany = {
  id: "beta", name: "Beta Services Ltd", currency: "USD",
  accounts: [
    { id: "beta_ops", name: "Operating", maskedNumber: "••3001", currency: "USD", balance: 310_000 },
    { id: "beta_pay", name: "Payroll", maskedNumber: "••3002", currency: "USD", balance: 64_300 },
  ],
  users: [
    { id: "alex", name: "Alex Morgan", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "lee", name: "Lee Park", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "sofia", name: "Sofia Reyes", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "priya", name: "Priya Nair", roles: ["initiator"], dailyLimit: 100_000, usedToday: 8_200 },
    { id: "omar", name: "Omar Haddad", roles: ["initiator"], dailyLimit: 100_000, usedToday: 64_500 },
    { id: "noor", name: "Noor Saleh", roles: ["admin"], dailyLimit: 0, usedToday: 0 },
  ],
  whitelist: [
    { id: "nimb", name: "Nimbus Logistics", bank: "JPMorgan Chase", maskedNumber: "ABA 021000021 · ••5521", country: "US", currency: "USD" },
    { id: "rhine", name: "Rhine Freight GmbH", bank: "Commerzbank", maskedNumber: "DE89 •••• 3000", country: "DE", currency: "EUR" },
  ],
  employees: [
    { id: "emp_1", name: "Grace Holloway", bank: "Chase", maskedNumber: "••3101", salary: 4_900 },
    { id: "emp_2", name: "Mateo Silva", bank: "Citi", maskedNumber: "••3102", salary: 5_400 },
  ],
  companyDailyLimit: 1_000_000, companyUsedToday: 0, dualApprovalAbove: 50_000, codeAbove: 25_000,
  cutoff: "16:00", holidays: ["2026-11-09"], paymentSeq: { prefix: "PAY", start: 2042 },
  templates: [],
  signatoryGroups: [
    { id: "grp_standard", name: "Standard approvals", mode: "parallel", members: ["alex", "lee", "sofia"], required: 1, above: 0 },
    { id: "grp_large", name: "Large payments", mode: "sequential", members: ["lee", "alex"], required: 2, above: 50_000 },
  ],
  audit: [{ at: "2026-11-02T16:02:00Z", userId: "omar", action: "Started payment PAY-2039 of USD 64,500.00", outcome: "Done" }],
};

const pay = (p: Partial<CorpPayment> & Pick<CorpPayment, "id" | "companyId" | "fromAccountId" | "beneficiaryId" | "amount" | "reference" | "initiatedBy" | "initiatedAt" | "required" | "approvals" | "status">): CorpPayment =>
  ({ currency: "USD", valueDate: p.initiatedAt.slice(0, 10), afterCutoff: false, ...p });

/** What already happened or waits when the day starts. Alpha: Alex's own payment waits and an earlier one settled. Beta: two payments started by others wait for Alex, one of them for a second approver after Lee. */
export function seedPayments(companyId: string, corp: CorporateProvider) {
  const sandbox = corp as unknown as { seedPayment(p: CorpPayment): void };
  const list: CorpPayment[] = companyId === "alpha" ? [
    pay({ id: "PAY-1187", companyId, fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 12_450, reference: "PO-5581", initiatedBy: "alex", initiatedAt: "2026-10-30T10:00:00Z", status: "released", required: 1, approvals: [{ userId: "dana", at: "2026-10-30T11:00:00Z" }], releasedAt: "2026-10-30T11:00:00Z", releaseReference: "CORP-20261030-1187" }),
    pay({ id: "PAY-2040", companyId, fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 18_900, reference: "PO-5612", initiatedBy: "alex", initiatedAt: "2026-11-03T09:30:00Z", status: "pending_approval", required: 1, approvals: [] }),
  ] : companyId === "beta" ? [
    pay({ id: "PAY-2012", companyId, fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 3_400, reference: "INV-2204", initiatedBy: "priya", initiatedAt: "2026-10-28T09:00:00Z", status: "released", required: 1, approvals: [{ userId: "alex", at: "2026-10-28T10:00:00Z" }], releasedAt: "2026-10-28T10:00:00Z", releaseReference: "CORP-20261028-2012" }),
    pay({ id: "PAY-2039", companyId, fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 64_500, reference: "INV-2270", initiatedBy: "omar", initiatedAt: "2026-11-02T16:02:00Z", status: "pending_approval", required: 2, approvals: [{ userId: "lee", at: "2026-11-02T17:40:00Z" }] }),
    pay({ id: "PAY-2041", companyId, fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 8_200, reference: "INV-2291", initiatedBy: "priya", initiatedAt: "2026-11-03T09:12:00Z", status: "pending_approval", required: 1, approvals: [] }),
  ] : [];
  for (const p of list) sandbox.seedPayment(p);
}
