import { roundMoney } from "@finx/ui-kit";
import type { Account } from "../index";

/** What a customer can spend now: the available balance when the account has one (the ledger balance less what is on hold), else the balance. */
export const spendable = (a: Account) => Math.min(a.available ?? a.balance, a.balance);
/** Money leaves: the ledger balance and the available balance both fall. */
export function debit(a: Account, amount: number) {
  a.balance = roundMoney(a.balance - amount, a.currency);
  if (a.available !== undefined) a.available = roundMoney(a.available - amount, a.currency);
}
export function credit(a: Account, amount: number) {
  a.balance = roundMoney(a.balance + amount, a.currency);
  if (a.available !== undefined) a.available = roundMoney(a.available + amount, a.currency);
}
