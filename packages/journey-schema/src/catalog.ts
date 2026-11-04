import type { Journey } from "./schema";
import { localTransfer } from "./fixtures/local-transfer";
import { payBill } from "./fixtures/pay-bill";
import { payBillBankworkx } from "./fixtures/pay-bill-bankworkx";
import { corporatePayment, corporateApproval } from "./fixtures/corporate-payments";
import { bulkPayment } from "./fixtures/bulk-payment";
import { payrollRun } from "./fixtures/payroll-run";
import { withdrawPayment } from "./fixtures/withdraw-payment";
import { convertCurrency } from "./fixtures/convert-currency";
import { ownTransfer } from "./fixtures/own-transfer";
import { manageBeneficiary } from "./fixtures/manage-beneficiary";
import { personalTransfer } from "./fixtures/personal-transfer";
import { internalTransfer } from "./fixtures/internal-transfer";
import { addMoney, addCard, connectAccount, createBudget, invest, sellInvestment } from "./fixtures/bankworkx";
import { cabJourneys } from "./fixtures/cab";

/**
 * The journey catalog: ready-made journeys a project can add to its own app.
 * Each entry is the journey exactly as shipped, so adding it never depends on what someone later edited in Studio.
 */
export const CATEGORIES = ["Payments", "Accounts", "Cards", "Budgeting", "Investing", "Access"] as const;
export type CatalogCategory = (typeof CATEGORIES)[number];

export type CatalogEntry = {
  /** Same as the journey's slug. */
  id: string;
  category: CatalogCategory;
  /** One line a product owner can read at a glance. */
  summary: string;
  /** What the journey shows off, as short phrases. */
  highlights: string[];
  /** The look the journey was made in, so a new bank knows what it is getting. */
  madeFor: "meezan" | "bankworkx" | "cab";
  journey: Journey;
};

export const catalog: CatalogEntry[] = [
  {
    id: localTransfer.slug, category: "Payments", madeFor: "meezan", journey: localTransfer,
    summary: "Send money to a saved beneficiary, with a daily-limit check, consent and a one-time code.",
    highlights: ["Daily limit rule", "Consent before sending", "One-time code", "English and Urdu"],
  },
  {
    id: payBill.slug, category: "Payments", madeFor: "meezan", journey: payBill,
    summary: "Look up a bill by company and reference, review it and pay from an account.",
    highlights: ["Bill lookup", "Review before paying", "One-time code", "English and Urdu"],
  },
  {
    id: convertCurrency.slug, category: "Accounts", madeFor: "meezan", journey: convertCurrency,
    summary: "Convert money between two of your own accounts in different currencies, with the rate and fee shown before you confirm.",
    highlights: ["Amount in the account's own currency", "Rate and fee on the review", "Rate that expires", "One-time code", "English and Urdu"],
  },
  {
    id: corporatePayment.slug, category: "Payments", madeFor: "meezan", journey: corporatePayment,
    summary: "A company initiator starts a payment to an approved supplier: limits, approvers needed, cut-off, and a one-time code. It then waits for an approver.",
    highlights: ["Only for initiators", "Daily limit shown and checked", "Approved suppliers only", "Cut-off and value date", "One-time code"],
  },
  {
    id: corporateApproval.slug, category: "Payments", madeFor: "meezan", journey: corporateApproval,
    summary: "A company approver reviews what waits for them, approves or rejects. Nobody approves their own; above a threshold a second approver is needed.",
    highlights: ["Only for approvers", "Pending list", "Four eyes", "Second approver above a threshold", "One-time code"],
  },
  {
    id: bulkPayment.slug, category: "Payments", madeFor: "meezan", journey: bulkPayment,
    summary: "A company initiator pays many approved suppliers from a pasted file: every row checked and the failures explained, then sent for approval as one payment.",
    highlights: ["Row by row checks with reasons", "Up to 50 rows", "One payment against the limits", "Approvers needed shown", "One-time code"],
  },
  {
    id: payrollRun.slug, category: "Payments", madeFor: "meezan", journey: payrollRun,
    summary: "A company initiator pays the month's salaries from a pasted file: every row checked against the payroll register and salary cap, one run per pay period, always two approvers.",
    highlights: ["Payroll register and salary cap", "One run per pay period", "Always two approvers", "One payment against the limits", "One-time code"],
  },
  {
    id: withdrawPayment.slug, category: "Payments", madeFor: "meezan", journey: withdrawPayment,
    summary: "The person who started a company payment takes it back while it waits for approval, with a one-time code. Their daily limit is given back.",
    highlights: ["Only your own waiting payments", "Even if one approver has approved", "One-time code", "Limit given back"],
  },
  {
    id: addMoney.slug, category: "Accounts", madeFor: "bankworkx", journey: addMoney,
    summary: "Top up an account from a saved card, with quick amounts and a review step.",
    highlights: ["Quick amount chips", "Card picker", "Review and receipt"],
  },
  {
    id: ownTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: ownTransfer,
    summary: "Move money between your own accounts: instant and free in the same currency; converted at the mid-market rate with a separate 0.20% fee and a rate held for 30 seconds in different currencies.",
    highlights: ["Same-currency move with a note", "Mid-market rate, no margin", "Type what you send or what you get", "Rate that runs out and renews", "One-time code, locked after 3 wrong codes", "Timeout and unavailable screens"],
  },
  {
    id: manageBeneficiary.slug, category: "Payments", madeFor: "bankworkx", journey: manageBeneficiary,
    summary: "Save a person or company to pay, change their details, or remove them. The bank checks the details and the name; a new or changed payee is limited to 500.00 USD for 24 hours.",
    highlights: ["Add a BankWorkx customer, a payee at a US, European, UK or Middle East bank, or abroad", "Name check with Use for a close match", "One-time code to add or change the name or account", "Nickname and label changes need no code", "Delete with or without the scheduled payments that use the payee", "Timeout and unavailable screens"],
  },
  {
    id: personalTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: personalTransfer,
    summary: "Send money to a BankWorkx customer, a person at another bank or another country: choose how fast, see the fee, the rate and the arrival, confirm with a one-time code. A payee typed in the payment can be saved; a new payee is limited to 500.00 USD for 24 hours.",
    highlights: ["Three ways to send, each switched on or off by the bank", "Find a BankWorkx customer by mobile, email or ID", "Standard, Same day, Instant (and Priority) with fee, arrival and limit", "Rate held 60 seconds, then a new price", "Later and repeating payments on business days", "Held for review, timeout and unavailable screens"],
  },
  {
    id: payBillBankworkx.slug, category: "Payments", madeFor: "bankworkx", journey: payBillBankworkx,
    summary: "Pay a bill from the bank's directory of billers: enter the reference, see the bill, pay the full amount, the minimum or another amount, confirm with a one-time code, and get a receipt.",
    highlights: ["Directory with search, categories and saved billers", "Reference format per biller", "Full, minimum or other amount", "Late fee, fee and rate in another currency", "Save the biller or pay automatically", "Timeout and unavailable screens"],
  },
  {
    id: internalTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: internalTransfer,
    summary: "Send money to a BankWorkx customer: found by mobile number, email or BankWorkx ID, free and instant, up to 25,000.00. The same flow as Send money, opened at this type; kept so that links to the old name open the right place.",
    highlights: ["Alias of Send money for one type", "Free and instant", "Switched off with the same option", "One-time code"],
  },
  {
    id: connectAccount.slug, category: "Accounts", madeFor: "bankworkx", journey: connectAccount,
    summary: "Link an account from another bank: pick the bank, sign in, choose accounts.",
    highlights: ["Bank tiles", "Hidden password field", "Failure path for a bad sign-in"],
  },
  {
    id: addCard.slug, category: "Cards", madeFor: "bankworkx", journey: addCard,
    summary: "Add a debit or credit card with a live card number check and clear field errors.",
    highlights: ["Card number and expiry checks", "Per-field errors", "Review before saving"],
  },
  {
    id: createBudget.slug, category: "Budgeting", madeFor: "bankworkx", journey: createBudget,
    summary: "Set a monthly spending limit for a category and get warned before it is reached.",
    highlights: ["Category tiles", "Amount with limits", "Alert toggle"],
  },
  {
    id: invest.slug, category: "Investing", madeFor: "bankworkx", journey: invest,
    summary: "Buy a stock or fund with a dollar amount, even part of a share, with a review step before the order.",
    highlights: ["Instrument picker", "Quick amount chips", "Risk notice", "Failure path with no money moved"],
  },
  {
    id: sellInvestment.slug, category: "Investing", madeFor: "bankworkx", journey: sellInvestment,
    summary: "Sell part or all of a holding and have the money paid into an account.",
    highlights: ["Holding picker", "Amount capped by what you own", "Failure path with nothing sold"],
  },
  // Cairo Amman Bank: the access journeys from its design file
  ...(
    [
      ["sign-in", "Sign in with username and password, with attempts left, a locked profile, an expired password and a profile not yet activated.", ["Attempts left, then locked", "Locked, expired and inactive screens", "English and Arabic"]],
      ["default-sign-in", "Choose how to sign in by default: password, biometric, or a six-digit PIN entered twice.", ["PIN entered twice", "Biometric option", "Mismatch check"]],
      ["account-preview", "Turn on balances before sign-in, and see what the sign-in screen will show.", ["Toggle", "Balances picture", "Privacy notice"]],
      ["change-language", "Change the app language, with a confirmation step.", ["Language list", "Confirm before changing"]],
      ["enroll", "Enrol a retail customer from last name, national ID and date of birth, with a picture code.", ["Picture code", "Records check", "Already enrolled and not found paths"]],
      ["activate-profile", "Activate a profile with the username and activation code, then create a password under the bank's rules.", ["Activation code blocks after 3 mistakes", "Password rules", "Passwords must match"]],
      ["cant-sign-in", "Find a customer who cannot sign in, verify with a one-time code and set a new password, or send a new activation code.", ["Picture code", "One-time code with lock after 3 mistakes", "Reset or reactivate"]],
      ["locate-us", "Find branches and ATMs by kind, range and text, and see hours and distance.", ["Filters", "Results list", "Call from the details"]],
      ["support", "FAQs by topic, terms, privacy and calling the bank.", ["FAQ topics", "Terms and privacy", "Call us"]],
    ] as const
  ).map(([slug, summary, highlights]) => ({ id: slug, category: "Access" as const, madeFor: "cab" as const, journey: cabJourneys.find((j) => j.slug === slug)!, summary, highlights: [...highlights] })),
];


export const catalogEntry = (id: string) => catalog.find((c) => c.id === id);
