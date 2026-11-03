import { ApiError, BankBApi } from "./corporate-b";
import { CorporateSandbox, type BatchCheck, type BulkLineInput, type CorporateBankAdapter, type CorpCompany, type CorpPayment, type Flaws, type InitiateInput } from "./corporate";
import { build, mapError, responseRules, type MappingSpec } from "./mapping";
import bankBSpec from "./mappings/bank-b.corporate.json";

/** What the bank layer needs from a corporate bank: the four operations plus reading the company and one payment. */
export interface CorporateProvider extends CorporateBankAdapter {
  getCompany(): CorpCompany;
  getPayment(id: string): CorpPayment;
  now: (() => number) | undefined;
}
export type ProviderId = "reference" | "bank-b";
export const PROVIDERS: ProviderId[] = ["reference", "bank-b"];

/** A corporate bank reached through a mapping file: the neutral operations become that bank's API calls, and its answers and errors come back in neutral form. */
export class MappedCorporateProvider implements CorporateProvider {
  constructor(private spec: MappingSpec, private api: { request(op: string, body?: Record<string, any>): any }, private context: { companyId: string }, private clock: (fn: () => number) => void) {}
  set now(fn: (() => number) | undefined) { if (fn) this.clock(fn); }
  get now() { return undefined; }

  private run(opName: string, input: Record<string, any>): any {
    const op = this.spec.operations[opName];
    if (!op) throw new Error(`The mapping for ${this.spec.provider} has no operation ${opName}`);
    let response: any;
    try { response = this.api.request(op.call, build(op.request, { input, context: this.context })); }
    catch (e) { if (e instanceof ApiError) throw mapError(this.spec, e); throw e; }
    const rules = responseRules(this.spec, op);
    if (op.list) {
      const items: any[] = op.list.split(".").slice(1).reduce((o: any, k) => o?.[k], response) ?? [];
      return items.map((item) => build(rules, { response: item, context: this.context }));
    }
    return build(rules, { response, context: this.context });
  }

  getCompany() { return this.run("company", {}) as CorpCompany; }
  getPayment(id: string) { return this.run("getPayment", { paymentId: id }) as CorpPayment; }
  initiatePayment(input: InitiateInput) { return this.run("initiatePayment", input) as CorpPayment; }
  approvePayment(input: { userId: string; paymentId: string }) { return this.run("approvePayment", input) as CorpPayment; }
  rejectPayment(input: { userId: string; paymentId: string; reason?: string }) { return this.run("rejectPayment", input) as CorpPayment; }
  withdrawPayment(input: { userId: string; paymentId: string }) { return this.run("withdrawPayment", input) as CorpPayment; }
  checkBatch(input: { userId: string; fromAccountId: string; lines: BulkLineInput[] }) { return this.run("checkBatch", input) as BatchCheck; }
  initiateBulk(input: { userId: string; fromAccountId: string; lines: BulkLineInput[]; reference?: string }) { return this.run("initiateBulk", input) as CorpPayment; }
  checkPayroll(input: { userId: string; fromAccountId: string; period: string; lines: BulkLineInput[] }) { return this.run("checkPayroll", input) as BatchCheck; }
  initiatePayroll(input: { userId: string; fromAccountId: string; period: string; lines: BulkLineInput[] }) { return this.run("initiatePayroll", input) as CorpPayment; }
  listPending(input: { userId: string; as?: "approver" | "initiator" }) { return this.run("listPending", input) as CorpPayment[]; }
}

/** The reference sandbox as a provider (no mapping needed: it already speaks the neutral shapes). */
class ReferenceProvider extends CorporateSandbox implements CorporateProvider {
  getCompany() { return this.summary; }
}

export function createCorporateProvider(id: ProviderId, company: CorpCompany, flaws: Flaws = {}): CorporateProvider {
  if (id === "bank-b") {
    const api = new BankBApi(company, flaws);
    return new MappedCorporateProvider(bankBSpec as unknown as MappingSpec, api, { companyId: company.id }, (fn) => { api.now = fn; });
  }
  return new ReferenceProvider(company, flaws);
}
