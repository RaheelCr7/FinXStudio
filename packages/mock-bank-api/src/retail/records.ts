import { roundMoney } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { Persona } from "../index";
import type { RetailData } from "./data";

const keyed = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));
const needData = (p: Persona): RetailData => { if (!p.retail) throw new BankError("NOT_SUPPORTED", "Not available for this customer"); return p.retail; };
const inRange = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date <= to);

/** What the retail customer can read and the few things they can change in their own records. Returns undefined for an adapter it does not own. */
export function retailRecords(p: Persona, adapter: string, input: Record<string, any>, now: number): any {
  switch (adapter) {
    case "bank.accounts.get": {
      const a = p.accounts.find((x) => x.id === input.accountId);
      if (!a) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
      return a;
    }
    case "bank.accounts.rename": {
      const a = p.accounts.find((x) => x.id === input.accountId);
      if (!a) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
      const nickname = String(input.nickname ?? "").trim();
      if (nickname.length < 1 || nickname.length > 30) throw new BankError("INVALID_NICKNAME", "A nickname can have 1 to 30 characters.");
      a.nickname = nickname;
      return { accountId: a.id, nickname };
    }
    case "bank.transactions.list": {
      const d = needData(p);
      if (input.accountId && !p.accounts.some((a) => a.id === input.accountId)) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
      const q = String(input.q ?? "").trim().toLowerCase();
      const list = d.transactions
        .filter((t) => (!input.accountId || t.accountId === input.accountId) && inRange(t.date, input.from, input.to)
          && (!input.direction || (input.direction === "in" ? t.amount > 0 : t.amount < 0)) && (!input.category || t.category === input.category)
          && (!input.status || t.status === input.status) && (!q || t.title.toLowerCase().includes(q))
          && (input.minAmount === undefined || Math.abs(t.amount) >= Number(input.minAmount)) && (input.maxAmount === undefined || Math.abs(t.amount) <= Number(input.maxAmount)))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      return keyed(input.limit ? list.slice(0, Number(input.limit)) : list);
    }
    case "bank.statements.get": {
      const d = needData(p);
      const a = p.accounts.find((x) => x.id === input.accountId);
      if (!a) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
      const from = String(input.from ?? ""), to = String(input.to ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new BankError("INVALID_DATE", "Choose a start date that is before the end date.");
      const all = d.transactions.filter((t) => t.accountId === a.id && t.status === "posted");
      const rows = all.filter((t) => inRange(t.date, from, to)).sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id));
      const after = all.filter((t) => t.date > to).reduce((s, t) => s + t.amount, 0);
      const closing = roundMoney(a.balance - after, a.currency);
      const credits = roundMoney(rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0), a.currency);
      const debits = roundMoney(rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0), a.currency);
      return { accountId: a.id, currency: a.currency, from, to, opening: roundMoney(closing - credits - debits, a.currency), credits, debits, closing, count: rows.length, transactions: keyed(rows) };
    }
    case "bank.payees.list": return keyed(needData(p).payees);
    case "bank.cards.issued": return keyed(needData(p).cards);
    case "bank.cards.get": {
      const c = needData(p).cards.find((x) => x.id === input.cardId);
      if (!c) throw new BankError("CARD_NOT_FOUND", "We can't find that card.");
      return c;
    }
    case "bank.deposits.list": return keyed(needData(p).deposits);
    case "bank.goals.list": return keyed(needData(p).goals);
    case "bank.loans.list": return keyed(needData(p).loans.map(({ schedule: _s, ...loan }) => loan));
    case "bank.loans.get": {
      const l = needData(p).loans.find((x) => x.id === input.loanId);
      if (!l) throw new BankError("LOAN_NOT_FOUND", "We can't find that loan.");
      return l;
    }
    case "bank.schedules.list": return keyed(needData(p).schedules.filter((s) => s.status === "active"));
    case "bank.messages.list": return keyed(needData(p).messages);
    case "bank.notifications.list": return keyed(needData(p).notifications.filter((n) => !input.context || n.context === input.context));
    case "bank.requests.list": return keyed(needData(p).requests);
    case "bank.profile.get": return needData(p).profile;
    case "bank.applications.list": return keyed(needData(p).applications);
    case "bank.applications.get": {
      const a = needData(p).applications.find((x) => x.id === input.applicationId);
      if (!a) throw new BankError("APPLICATION_NOT_FOUND", "We can't find that application.");
      return a;
    }
    case "bank.applications.save": {
      const d = needData(p);
      const at = new Date(now).toISOString();
      if (input.applicationId) {
        const a = d.applications.find((x) => x.id === input.applicationId);
        if (!a) throw new BankError("APPLICATION_NOT_FOUND", "We can't find that application.");
        if (a.status !== "draft") throw new BankError("APPLICATION_LOCKED", "This application has been sent and can't be changed.");
        a.step = String(input.step ?? a.step); a.data = { ...a.data, ...(input.data ?? {}) }; a.updatedAt = at;
        if (input.submit === true) a.status = "submitted";
        return { applicationId: a.id, status: a.status, step: a.step, updatedAt: a.updatedAt };
      }
      const id = `APP-${1001 + d.applications.length}`;
      d.applications.push({ id, type: "account", status: input.submit === true ? "submitted" : "draft", step: String(input.step ?? "start"), productId: input.productId, data: input.data ?? {}, updatedAt: at });
      return { applicationId: id, status: d.applications.at(-1)!.status, step: d.applications.at(-1)!.step, updatedAt: at };
    }
    default: return undefined;
  }
}
