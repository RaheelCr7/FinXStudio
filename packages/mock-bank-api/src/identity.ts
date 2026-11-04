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
    { id: "alex", name: "Alex Morgan", roles: ["initiator"], dailyLimit: 25_000, usedToday: 0 },
    { id: "maria", name: "Maria Costa", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "jon", name: "Jon Park", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
  ],
  whitelist: [
    { id: "nordic", name: "Nordic Supplies AB", bank: "Nordea", maskedNumber: "••5510" },
    { id: "harbor", name: "Harbor Tools", bank: "Chase", maskedNumber: "••8802" },
    { id: "lumen", name: "Lumen Packaging", bank: "ING", maskedNumber: "••3340" },
    { id: "cedar", name: "Cedar Freight", bank: "Citi", maskedNumber: "••9051" },
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
}
