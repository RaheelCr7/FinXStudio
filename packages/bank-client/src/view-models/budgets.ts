import type { Budget, Txn } from "@finx/mock-bank-api";
import { budgetProgress } from "./dashboard";

export type Period = "week" | "month";

/** The detail screen of one budget: what is left, a daily allowance, and the matching spending. */
export function budgetDetail(b: Budget, txns: Txn[], period: Period, daysLeft = 28) {
  const left = Math.max(0, b.limit - b.spent);
  const related = txns.filter((t) => (b.category === "food" ? t.category === "food" || t.category === "coffee" : t.category === b.category));
  return {
    left, daysLeft, ...budgetProgress(b),
    perDay: Math.floor(left / daysLeft),
    transactions: related.filter((t) => period === "month" || t.daysAgo <= 7),
  };
}
