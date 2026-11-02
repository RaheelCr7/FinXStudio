import type { Journey } from "./schema";
import { localTransfer } from "./fixtures/local-transfer";
import { payBill } from "./fixtures/pay-bill";
import { addMoney, addCard, connectAccount, createBudget, invest, sellInvestment } from "./fixtures/bankworkx";

/**
 * The journey catalog: ready-made journeys a project can add to its own app.
 * Each entry is the journey exactly as shipped, so adding it never depends on what someone later edited in Studio.
 */
export const CATEGORIES = ["Payments", "Accounts", "Cards", "Budgeting", "Investing"] as const;
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
  madeFor: "meezan" | "bankworkx";
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
    id: addMoney.slug, category: "Accounts", madeFor: "bankworkx", journey: addMoney,
    summary: "Top up an account from a saved card, with quick amounts and a review step.",
    highlights: ["Quick amount chips", "Card picker", "Review and receipt"],
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
];

export const catalogEntry = (id: string) => catalog.find((c) => c.id === id);
