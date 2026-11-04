import type { CorpCompany, CorpRole } from "./corporate";
import type { CorporateProvider } from "./corporate-provider";

/**
 * One person, several places to bank from: their own accounts and each company they act for. The sandbox holds the active
 * context the way a server holds a session, and every adapter reads it: what Alex does at Alpha cannot touch Beta or the
 * personal accounts, whatever a screen shows or hides.
 */
export type PersonaContext = { id: string; company: CorpCompany; /** who this person is at the company */ userId: string; /** start with payments already waiting for this person */ seed?: "waiting-payments" | "history" };
export type Permission = "accounts.view" | "pay.create" | "pay.approve" | "cards.manage";

export const PERSONAL_PERMISSIONS: Permission[] = ["accounts.view", "pay.create", "cards.manage"];
export const permissionsOf = (roles: CorpRole[]): Permission[] => ["accounts.view", ...(roles.includes("initiator") ? ["pay.create" as const] : []), ...(roles.includes("approver") ? ["pay.approve" as const] : [])];

/** Alex starts payments here (Maker) and cannot approve them. A second person approves. */
export const ALPHA: CorpCompany = {
  id: "alpha", name: "Alpha Trading LLC", currency: "USD", paymentPrefix: "alpha",
  accounts: [
    { id: "alpha_ops", name: "Operating", maskedNumber: "••2201", currency: "USD", balance: 298_000 },
    { id: "alpha_pay", name: "Payroll", maskedNumber: "••2202", currency: "USD", balance: 120_310.55 },
    { id: "alpha_eur", name: "Reserve", maskedNumber: "••2203", currency: "EUR", balance: 64_000 },
  ],
  users: [
    { id: "alex", name: "Alex Morgan", roles: ["initiator"], dailyLimit: 250_000, usedToday: 0 },
    { id: "maria", name: "Maria Costa", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "jon", name: "Jon Park", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
  ],
  whitelist: [
    { id: "nordic", name: "Nordic Supplies AB", bank: "Nordea", maskedNumber: "••5510" },
    { id: "harbor", name: "Harbor Tools", bank: "Chase", maskedNumber: "••8802" },
    { id: "lumen", name: "Lumen Packaging", bank: "ING", maskedNumber: "••3340" },
    { id: "cedar", name: "Cedar Freight", bank: "Citi", maskedNumber: "••9051" },
  ],
  employees: [
    { id: "emp_ines", name: "Ines Alvarez", bank: "BBVA", maskedNumber: "••1101", salary: 4_200 },
    { id: "emp_kofi", name: "Kofi Mensah", bank: "Chase", maskedNumber: "••1102", salary: 3_800 },
    { id: "emp_lena", name: "Lena Novak", bank: "Citi", maskedNumber: "••1103", salary: 5_100 },
    { id: "emp_raj", name: "Raj Malhotra", bank: "HSBC", maskedNumber: "••1104", salary: 4_700 },
    { id: "emp_tess", name: "Tess Holloway", bank: "Wells Fargo", maskedNumber: "••1105", salary: 3_300 },
    { id: "emp_yuki", name: "Yuki Tanaka", bank: "Chase", maskedNumber: "••1106", salary: 4_000 },
  ],
  companyDailyLimit: 500_000, companyUsedToday: 0, dualApprovalAbove: 100_000, cutoff: "16:00", holidays: [],
};

/** Alex approves here (Approver). Two payments are already waiting, started by someone else. */
export const BETA: CorpCompany = {
  id: "beta", name: "Beta Services Ltd", currency: "USD", paymentPrefix: "beta",
  accounts: [
    { id: "beta_ops", name: "Operating", maskedNumber: "••3301", currency: "USD", balance: 160_000 },
    { id: "beta_res", name: "Reserve", maskedNumber: "••3302", currency: "USD", balance: 55_904.2 },
  ],
  users: [
    { id: "alex", name: "Alex Morgan", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "priya", name: "Priya Nair", roles: ["initiator"], dailyLimit: 50_000, usedToday: 0 },
    { id: "tom", name: "Tom Becker", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
  ],
  whitelist: [
    { id: "kestrel", name: "Kestrel Logistics", bank: "Barclays", maskedNumber: "••6601" },
    { id: "orbit", name: "Orbit Print Co", bank: "Wells Fargo", maskedNumber: "••7702" },
    { id: "pixel", name: "Pixel Office Supply", bank: "Chase", maskedNumber: "••4418" },
  ],
  companyDailyLimit: 200_000, companyUsedToday: 0, dualApprovalAbove: 10_000, cutoff: "16:00", holidays: [],
};

/** The 12,400 payment needs two approvers and Tom has given one; the 2,150 one needs Alex alone. */
export function seedBeta(p: CorporateProvider) {
  const big = p.initiatePayment({ userId: "priya", fromAccountId: "beta_ops", beneficiaryId: "kestrel", amount: 12_400, reference: "INV-8841" });
  p.approvePayment({ userId: "tom", paymentId: big.id });
  p.initiatePayment({ userId: "priya", fromAccountId: "beta_ops", beneficiaryId: "orbit", amount: 2_150, reference: "INV-8790" });
  // one that nobody has touched yet and that also needs two approvers
  p.initiatePayment({ userId: "priya", fromAccountId: "beta_res", beneficiaryId: "pixel", amount: 18_900, reference: "PO-5521" });
}

/** Alpha's past: one payment Maria released, one still waiting for her, one she rejected. */
export function seedAlpha(p: CorporateProvider) {
  const done = p.initiatePayment({ userId: "alex", fromAccountId: "alpha_ops", beneficiaryId: "nordic", amount: 4_800, reference: "INV-2031" });
  p.approvePayment({ userId: "maria", paymentId: done.id });
  p.initiatePayment({ userId: "alex", fromAccountId: "alpha_ops", beneficiaryId: "harbor", amount: 7_250, reference: "INV-2044" });
  const no = p.initiatePayment({ userId: "alex", fromAccountId: "alpha_ops", beneficiaryId: "cedar", amount: 1_600, reference: "INV-2050" });
  p.rejectPayment({ userId: "maria", paymentId: no.id, reason: "Wrong invoice number" });
  // a bulk payment to three suppliers, released
  const bulk = p.initiateBulk({ userId: "alex", fromAccountId: "alpha_ops", reference: "Supplier run", lines: [
    { beneficiaryId: "nordic", amount: 3_100, reference: "INV-2002" }, { beneficiaryId: "harbor", amount: 1_450, reference: "INV-2003" }, { beneficiaryId: "lumen", amount: 2_380, reference: "INV-2004" },
  ] });
  p.approvePayment({ userId: "maria", paymentId: bulk.id });
  // last month's payroll, released by two approvers (so this month's can still be run)
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const pay = p.initiatePayroll({ userId: "alex", fromAccountId: "alpha_pay", period, lines: ALPHA.employees!.map((e) => ({ beneficiaryId: e.id, amount: e.salary, reference: `Salary ${period}` })) });
  p.approvePayment({ userId: "maria", paymentId: pay.id });
  p.approvePayment({ userId: "jon", paymentId: pay.id });
}

/** A company that is nearly out of room today: the daily limits and the balance push back on the next payment. */
export const GAMMA: CorpCompany = {
  id: "gamma", name: "Gamma Logistics Inc", currency: "USD", paymentPrefix: "gamma",
  accounts: [{ id: "gamma_ops", name: "Operating", maskedNumber: "••4401", currency: "USD", balance: 21_500 }],
  users: [
    { id: "leo", name: "Leo Fischer", roles: ["initiator"], dailyLimit: 20_000, usedToday: 18_500 },
    { id: "nina", name: "Nina Walsh", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
  ],
  whitelist: [{ id: "dock", name: "Dockside Services", bank: "Citi", maskedNumber: "••1209" }, { id: "fleet", name: "FleetCare", bank: "Chase", maskedNumber: "••6620" }],
  companyDailyLimit: 100_000, companyUsedToday: 95_000, dualApprovalAbove: 5_000, cutoff: "16:00", holidays: [],
};
