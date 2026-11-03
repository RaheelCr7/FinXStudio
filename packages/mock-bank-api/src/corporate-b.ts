import { currencyInfo } from "@finx/ui-kit";
import { CorporateSandbox, type CorpCompany, type CorpPayment, type Flaws } from "./corporate";
import { BankError } from "./errors";

/**
 * "Bank B": a second simulated corporate bank API, with its own vocabulary, shapes and error codes (plan, Stage 1: the same
 * journeys must run on a different API with no UI rebuild, only a mapping file). It is a different front door to the same kind
 * of business: its own names for operations, fields and states, amounts as strings, its own ids, and numbered error codes with
 * their own wording. The rule engine behind it is the corporate sandbox's (a simulation; a real vendor has its own).
 */
export class ApiError extends Error {
  constructor(public code: string, public status: number, public detail: string, public params: Record<string, unknown> = {}) { super(detail); this.name = "ApiError"; }
}

export type BTransaction = {
  txnId: string; state: "AWAITING_AUTH" | "EXECUTED" | "CANCELLED";
  initiator: string; debit: { accountNo: string }; creditor: { ref: string };
  amount: { value: string; ccy: string }; remittanceInfo: string;
  authChain: { needed: number; signedBy: { user: string; ts: string }[] };
  valueDt: string; pastCutOff: boolean; createdTs: string;
  execRef?: string; executedTs?: string; cancelledBy?: string; cancelNote?: string; cancelledTs?: string;
};
export type BCompanyProfile = {
  companyId: string; legalName: string; baseCcy: string;
  accounts: { accountNo: string; title: string; last4: string; ccy: string; available: number }[];
  approvedCreditors: { ref: string; name: string; bank: string; last4: string }[];
  staff: { id: string; name: string; perms: ("MAKE" | "SIGN")[]; cap: { perDay: number; spentToday: number } }[];
  limits: { companyPerDay: number; companySpent: number };
  signOffAbove: number; cutOffUtc: string;
};

const STATE = { pending_approval: "AWAITING_AUTH", released: "EXECUTED", rejected: "CANCELLED" } as const;
const BACK = { AWAITING_AUTH: "pending_approval", EXECUTED: "released", CANCELLED: "rejected" } as const;

export class BankBApi {
  private inner: CorporateSandbox;
  constructor(company: CorpCompany, flaws: Flaws = {}) { this.inner = new CorporateSandbox(company, flaws); }
  set now(fn: () => number) { this.inner.now = fn; }

  private txnId(id: string) { return `TXN-${String(id.split("_")[1]).padStart(6, "0")}`; }
  private innerId(txnId: string) { const m = /^TXN-0*([0-9]+)$/.exec(txnId); if (!m) throw new ApiError("ERR-4042", 404, `Transaction ${txnId} does not exist`, { txnId }); return `pay_${m[1]}`; }
  private name(userId: string) { return this.inner.summary.users.find((u) => u.id === userId)?.name ?? userId; }

  private shape(p: CorpPayment): BTransaction {
    const digits = currencyInfo(p.currency).decimals;
    return {
      txnId: this.txnId(p.id), state: STATE[p.status], initiator: p.initiatedBy, debit: { accountNo: p.fromAccountId }, creditor: { ref: p.beneficiaryId },
      amount: { value: p.amount.toFixed(digits), ccy: p.currency }, remittanceInfo: p.reference,
      authChain: { needed: p.required, signedBy: p.approvals.map((a) => ({ user: a.userId, ts: a.at })) },
      valueDt: p.valueDate, pastCutOff: p.afterCutoff, createdTs: p.initiatedAt,
      ...(p.releaseReference ? { execRef: p.releaseReference, executedTs: p.releasedAt } : {}),
      ...(p.status === "rejected" ? { cancelledBy: p.rejectedBy, cancelNote: p.rejectReason ?? "", cancelledTs: p.rejectedAt } : {}),
    };
  }

  /** Our rules, in this bank's words: a numbered code, an HTTP-like status, its own wording and the facts the wording needs. */
  private fail(e: unknown, ctx: { action: "create" | "authorise" | "decline"; user: string; txnState?: string; ccy?: string }): never {
    if (!(e instanceof BankError)) throw e;
    const who = this.name(ctx.user);
    const verb = { create: "initiate", authorise: "approve", decline: "reject" }[ctx.action];
    const table: Record<string, [string, number, string, Record<string, unknown>]> = {
      NOT_AUTHORISED: ["ERR-4031", 403, `Signer ${ctx.user} lacks the ${ctx.action === "create" ? "MAKE" : "SIGN"} permission`, { userName: who, action: verb }],
      USER_NOT_FOUND: ["ERR-4043", 404, `Unknown staff id ${ctx.user}`, { userId: ctx.user, company: this.inner.summary.name }],
      ACCOUNT_NOT_FOUND: ["ERR-4044", 404, "Debit account unknown", {}],
      BENEFICIARY_NOT_WHITELISTED: ["ERR-4041", 422, "Creditor is not in the approved creditor register", {}],
      INVALID_AMOUNT: ["ERR-4221", 422, "Amount value malformed for the currency", { ccy: ctx.ccy ?? "", digits: currencyInfo(ctx.ccy ?? "PKR").decimals }],
      CURRENCY_NOT_SUPPORTED: ["ERR-4222", 422, "Debit currency differs from the company base currency", { ccy: this.inner.summary.currency }],
      INSUFFICIENT_FUNDS: ["ERR-4091", 409, "Available balance too low", {}],
      LIMIT_USER_EXCEEDED: ["ERR-4291", 429, "Staff per-day cap breached", { userName: who }],
      LIMIT_COMPANY_EXCEEDED: ["ERR-4292", 429, "Company per-day cap breached", {}],
      SELF_APPROVAL: ["ERR-4093", 403, "Signer is the maker of this transaction", {}],
      ALREADY_APPROVED: ["ERR-4094", 409, "Signer already present in the authorisation chain", {}],
      PAYMENT_NOT_PENDING: ["ERR-4095", 409, `Transaction is ${ctx.txnState ?? "closed"}`, { state: ctx.txnState ?? "" }],
      PAYMENT_NOT_FOUND: ["ERR-4042", 404, "Transaction does not exist", {}],
    };
    const row = table[e.code];
    if (!row) throw new ApiError("ERR-5000", 500, e.message);
    throw new ApiError(row[0], row[1], row[2], row[3]);
  }

  /** One entry point, like an HTTP API: an operation and a JSON body in, JSON out, or an ApiError. */
  request(op: string, body: Record<string, any> = {}): any {
    switch (op) {
      case "company.profile": return this.profile();
      case "payments.create": {
        const ccy = String(body.amount?.ccy ?? "");
        try {
          const p = this.inner.initiatePayment({ userId: String(body.initiator ?? ""), fromAccountId: String(body.debit?.accountNo ?? ""), beneficiaryId: String(body.creditor?.ref ?? ""), amount: Number(body.amount?.value), reference: body.remittanceInfo });
          return this.shape(p);
        } catch (e) { return this.fail(e, { action: "create", user: String(body.initiator ?? ""), ccy: ccy || this.inner.summary.accounts.find((a) => a.id === body.debit?.accountNo)?.currency }); }
      }
      case "payments.authorise": case "payments.decline": {
        const action = op === "payments.authorise" ? "authorise" : "decline";
        const user = String(body.signer ?? "");
        let id: string; try { id = this.innerId(String(body.txnId ?? "")); } catch (e) { throw e; }
        const stateNow = (() => { try { return BACK[this.shape(this.inner.getPayment(id)).state] ? this.shape(this.inner.getPayment(id)).state : ""; } catch { return ""; } })();
        try {
          const p = action === "authorise" ? this.inner.approvePayment({ userId: user, paymentId: id }) : this.inner.rejectPayment({ userId: user, paymentId: id, reason: body.note });
          return this.shape(p);
        } catch (e) { return this.fail(e, { action, user, txnState: stateNow }); }
      }
      case "payments.get": {
        const id = this.innerId(String(body.txnId ?? ""));
        try { return this.shape(this.inner.getPayment(id)); } catch (e) { return this.fail(e, { action: "create", user: "" }); }
      }
      case "payments.list": {
        // awaiting: a signer id (what waits for them); madeBy: a maker id (what they started)
        const user = String(body.awaiting ?? body.madeBy ?? "");
        try { return { items: this.inner.listPending({ userId: user, as: body.madeBy ? "initiator" : "approver" }).map((p) => this.shape(p)) }; } catch (e) { return this.fail(e, { action: "create", user }); }
      }
      default: throw new ApiError("ERR-4000", 400, `Unknown operation ${op}`);
    }
  }

  private profile(): BCompanyProfile {
    const c = this.inner.summary;
    return {
      companyId: c.id, legalName: c.name, baseCcy: c.currency,
      accounts: c.accounts.map((a) => ({ accountNo: a.id, title: a.name, last4: a.maskedNumber.replace(/[^0-9]/g, ""), ccy: a.currency, available: a.balance })),
      approvedCreditors: c.whitelist.map((b) => ({ ref: b.id, name: b.name, bank: b.bank, last4: b.maskedNumber.replace(/[^0-9]/g, "") })),
      staff: c.users.map((u) => ({ id: u.id, name: u.name, perms: [...(u.roles.includes("initiator") ? ["MAKE" as const] : []), ...(u.roles.includes("approver") ? ["SIGN" as const] : [])], cap: { perDay: u.dailyLimit, spentToday: u.usedToday } })),
      limits: { companyPerDay: c.companyDailyLimit, companySpent: c.companyUsedToday },
      signOffAbove: c.dualApprovalAbove, cutOffUtc: c.cutoff,
    };
  }
}
