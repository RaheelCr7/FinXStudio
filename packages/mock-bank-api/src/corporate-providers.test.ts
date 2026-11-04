import { describe, it, expect } from "vitest";
import { ACME, ApiError, BankBApi, MockBank, PROVIDERS, applyRule, build, createCorporateProvider, mapError, type MappingSpec } from "./index";
import bankBSpec from "./mappings/bank-b.corporate.json";

const T = Date.parse("2026-11-03T10:00:00Z");
const provider = (id: (typeof PROVIDERS)[number]) => { const p = createCorporateProvider(id, ACME); p.now = () => T; return p; };
const both = () => ({ a: provider("reference"), b: provider("bank-b") });
const pay = (over: Record<string, unknown> = {}) => ({ userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 100_000, reference: "INV-1", ...over });
const thrown = (fn: () => unknown) => { try { fn(); return { code: "none", message: "" }; } catch (e: any) { return { code: e.code, message: e.message }; } };
/** A payment without the id, which each bank numbers its own way. */
const sans = (p: any) => { const { id: _id, ...rest } = p; return rest; };

describe("Bank B speaks its own language", () => {
  it("has its own operations, field names, states, ids and amounts as strings", () => {
    const api = new BankBApi(ACME); api.now = () => T;
    const t = api.request("payments.create", { initiator: "sara", debit: { accountNo: "acme_ops" }, creditor: { ref: "sup_textile" }, amount: { value: "250000.00" }, remittanceInfo: "INV-9" });
    expect(t).toMatchObject({ txnId: "TXN-000001", state: "AWAITING_AUTH", initiator: "sara", amount: { value: "250000.00", ccy: "PKR" }, authChain: { needed: 1, signedBy: [] }, valueDt: "2026-11-03", pastCutOff: false });
    const done = api.request("payments.authorise", { txnId: "TXN-000001", signer: "hassan" });
    expect(done).toMatchObject({ state: "EXECUTED", execRef: "CORP-20261103-0001", authChain: { signedBy: [{ user: "hassan" }] } });
    expect(api.request("company.profile").staff[0]).toMatchObject({ id: "sara", perms: ["MAKE"], cap: { perDay: 3_000_000 } });
  });
  it("answers errors with numbered codes and its own wording", () => {
    const api = new BankBApi(ACME); api.now = () => T;
    const e: any = (() => { try { api.request("payments.create", { initiator: "omar", debit: { accountNo: "acme_ops" }, creditor: { ref: "sup_textile" }, amount: { value: "600000" } }); } catch (x) { return x; } })();
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ code: "ERR-4291", status: 429, detail: "Staff per-day cap breached", params: { userName: "Omar Belkacem" } });
  });
});

describe("the mapping engine", () => {
  const scope = { input: { amount: 250000, as: "initiator", list: ["MAKE", "SIGN", "MAKE"] }, response: { state: "EXECUTED", n: "12.50", rows: [{ a: 1 }, { a: 2 }], last4: "6100" } };
  it("reads paths, constants, conversions and value maps", () => {
    expect(applyRule("input.amount", scope)).toBe(250000);
    expect(applyRule({ const: "x" }, scope)).toBe("x");
    expect(applyRule({ from: "input.amount", as: "string" }, scope)).toBe("250000");
    expect(applyRule({ from: "response.n", as: "number" }, scope)).toBe(12.5);
    expect(applyRule({ from: "response.last4", as: "mask4" }, scope)).toBe("••6100");
    expect(applyRule({ from: "response.state", map: { EXECUTED: "released" } }, scope)).toBe("released");
    expect(applyRule({ from: "response.state", map: { OTHER: "x" } }, scope)).toBe("EXECUTED"); // not in the table: passed through
    expect(applyRule({ from: "input.list", mapEach: { MAKE: "initiator", SIGN: "approver" } }, scope)).toEqual(["initiator", "approver"]);
    expect(applyRule({ from: "response.rows", each: { x: "item.a" } }, scope)).toEqual([{ x: 1 }, { x: 2 }]);
  });
  it("leaves out what is missing, uses a default, and obeys if and unless", () => {
    expect(applyRule("response.nothing", scope)).toBeUndefined();
    expect(applyRule({ from: "response.nothing", default: [] }, scope)).toEqual([]);
    expect(applyRule({ from: "input.amount", if: { path: "input.as", in: ["initiator"] } }, scope)).toBe(250000);
    expect(applyRule({ from: "input.amount", if: { path: "input.as", in: ["approver"] } }, scope)).toBeUndefined();
    expect(applyRule({ from: "input.amount", unless: { path: "input.as", in: ["initiator"] } }, scope)).toBeUndefined();
  });
  it("builds a nested object from dotted targets and skips what is missing", () => {
    expect(build({ "debit.accountNo": "input.as", "amount.value": { from: "input.amount", as: "string" }, skipped: "input.none" }, scope)).toEqual({ debit: { accountNo: "initiator" }, amount: { value: "250000" } });
  });
  it("turns their error into ours, filling the words from what the error carries, and never leaks theirs", () => {
    const spec = bankBSpec as unknown as MappingSpec;
    expect(mapError(spec, { code: "ERR-4291", params: { userName: "Omar" } })).toMatchObject({ code: "LIMIT_USER_EXCEEDED", message: "This is above Omar's daily limit" });
    expect(mapError(spec, { code: "ERR-4095", params: { state: "EXECUTED" } }).message).toBe("This payment is already released");
    expect(mapError(spec, { code: "ERR-9999" })).toMatchObject({ code: "BANK_ERROR", message: "The bank could not process this. Try again." });
  });
  it("covers every field of a payment in every state, and every one of its own error codes", () => {
    const { a } = both();
    const released = a.initiatePayment(pay()); a.approvePayment({ userId: "hassan", paymentId: released.id });
    const rejected = a.initiatePayment(pay({ reference: "R" })); a.rejectPayment({ userId: "layla", paymentId: rejected.id, reason: "No" });
    const fields = new Set([...Object.keys(a.getPayment(released.id)), ...Object.keys(a.getPayment(rejected.id))]);
    const shape = Object.keys((bankBSpec as any).shapes.payment);
    expect([...fields].filter((f) => !shape.includes(f))).toEqual([]); // nothing a journey can read is left unmapped
    const codes = ["NOT_AUTHORISED", "USER_NOT_FOUND", "ACCOUNT_NOT_FOUND", "BENEFICIARY_NOT_WHITELISTED", "INVALID_AMOUNT", "CURRENCY_NOT_SUPPORTED", "INSUFFICIENT_FUNDS", "LIMIT_USER_EXCEEDED", "LIMIT_COMPANY_EXCEEDED", "SELF_APPROVAL", "ALREADY_APPROVED", "PAYMENT_NOT_PENDING", "PAYMENT_NOT_FOUND", "NOT_AUTHORISED", "EMPTY_BATCH", "BATCH_TOO_LARGE", "NO_VALID_LINES", "INVALID_PERIOD", "PAYROLL_ALREADY_RUN"];
    expect([...new Set(Object.values((bankBSpec as any).errors).map((e: any) => e.code))].sort()).toEqual([...new Set(codes)].sort());
  });
});

describe("the same answers from both banks, through the mapping", () => {
  it("shows the same company", () => {
    const { a, b } = both();
    const ca = a.getCompany(), cb = b.getCompany();
    expect({ ...cb, holidays: ca.holidays }).toEqual(ca); // Bank B does not publish holidays; everything else is the same
  });
  it("makes the same payment, apart from the bank's own id", () => {
    const { a, b } = both();
    const pa = a.initiatePayment(pay({ amount: 2_000_000 })), pb = b.initiatePayment(pay({ amount: 2_000_000 }));
    expect(pa.id).toBe("pay_1"); expect(pb.id).toBe("TXN-000001"); // each bank numbers its own
    expect(sans(pb)).toEqual(sans(pa));
    expect(sans(b.approvePayment({ userId: "hassan", paymentId: pb.id }))).toEqual(sans(a.approvePayment({ userId: "hassan", paymentId: pa.id })));
    expect(sans(b.approvePayment({ userId: "layla", paymentId: pb.id }))).toEqual(sans(a.approvePayment({ userId: "layla", paymentId: pa.id })));
    expect(b.getCompany().accounts).toEqual(a.getCompany().accounts);
  });
  it("withdraws the same way, and refuses the same people", () => {
    const { a, b } = both();
    const x = a.initiatePayment(pay()), y = b.initiatePayment(pay());
    const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as any).code; } };
    expect(err(() => a.withdrawPayment({ userId: "omar", paymentId: x.id }))).toBe("NOT_AUTHORISED");
    expect(err(() => b.withdrawPayment({ userId: "omar", paymentId: y.id }))).toBe("NOT_AUTHORISED");
    expect(sans(b.withdrawPayment({ userId: "sara", paymentId: y.id }))).toEqual(sans(a.withdrawPayment({ userId: "sara", paymentId: x.id })));
    expect(err(() => b.withdrawPayment({ userId: "sara", paymentId: y.id }))).toBe(err(() => a.withdrawPayment({ userId: "sara", paymentId: x.id })));
  });
  it("lists, rejects and gives the limit back the same way", () => {
    const { a, b } = both();
    const ids = [a, b].map((p) => ({ x: p.initiatePayment(pay({ userId: "nadia", amount: 100_000 })), y: p.initiatePayment(pay({ amount: 200_000, reference: "B" })) }));
    for (const as of ["approver", "initiator"] as const) for (const user of ["hassan", "nadia", "sara"]) {
      expect(b.listPending({ userId: user, as }).map(sans)).toEqual(a.listPending({ userId: user, as }).map(sans));
    }
    expect(sans(b.rejectPayment({ userId: "layla", paymentId: ids[1]!.y.id, reason: "Wrong supplier" }))).toEqual(sans(a.rejectPayment({ userId: "layla", paymentId: ids[0]!.y.id, reason: "Wrong supplier" })));
    expect(b.getCompany().users).toEqual(a.getCompany().users);
  });
  it("refuses for the same reason, with the same code and the same words", () => {
    const cases: [string, (p: ReturnType<typeof provider>) => unknown][] = [
      ["not an initiator", (p) => p.initiatePayment(pay({ userId: "hassan" }))],
      ["unknown user", (p) => p.initiatePayment(pay({ userId: "nobody" }))],
      ["unknown account", (p) => p.initiatePayment(pay({ fromAccountId: "nope" }))],
      ["not whitelisted", (p) => p.initiatePayment(pay({ beneficiaryId: "someone-new" }))],
      ["bad amount", (p) => p.initiatePayment(pay({ amount: 10.005 }))],
      ["wrong currency", (p) => p.initiatePayment(pay({ fromAccountId: "acme_usd", amount: 100 }))],
      ["too little money", (p) => p.initiatePayment(pay({ amount: 30_000_000 }))],
      ["user limit", (p) => p.initiatePayment(pay({ userId: "omar", amount: 600_000 }))],
      ["company limit", (p) => { for (let i = 0; i < 3; i++) p.initiatePayment(pay({ userId: i === 2 ? "nadia" : "sara", amount: i === 2 ? 400_000 : 3_000_000 })); const q = p.initiatePayment(pay({ amount: 100_000 })); p.approvePayment({ userId: "hassan", paymentId: q.id }); }],
    ];
    for (const [name, run] of cases) {
      const { a, b } = both();
      expect(thrown(() => run(b)), name).toEqual(thrown(() => run(a)));
    }
    const { a, b } = both();
    const x = a.initiatePayment(pay({ userId: "nadia" })), y = b.initiatePayment(pay({ userId: "nadia" }));
    const steps: [string, (p: typeof a, id: string) => unknown][] = [
      ["only an approver approves", (p, id) => p.approvePayment({ userId: "sara", paymentId: id })],
      ["no self approval", (p, id) => p.approvePayment({ userId: "nadia", paymentId: id })],
    ];
    for (const [name, run] of steps) expect(thrown(() => run(b, y.id)), name).toEqual(thrown(() => run(a, x.id)));
    a.approvePayment({ userId: "hassan", paymentId: x.id }); b.approvePayment({ userId: "hassan", paymentId: y.id });
    expect(thrown(() => b.approvePayment({ userId: "layla", paymentId: y.id }))).toEqual(thrown(() => a.approvePayment({ userId: "layla", paymentId: x.id }))); // already released
    expect(thrown(() => b.approvePayment({ userId: "layla", paymentId: y.id })).message).toBe("This payment is already released");
  });
});

describe("through the bank, on either API", () => {
  it("answers the corp.* adapters the same, only the payment ids differ", async () => {
    const run = async (corpProvider: (typeof PROVIDERS)[number]) => {
      const b = new MockBank("acme", { corpProvider }); b.now = () => T;
      await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
      const p = await b.call("corp.payments.initiate", { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_logistics", amount: 250_000, reference: "X" });
      const pending = await b.call("corp.payments.pending", { userId: "hassan" });
      const company = await b.call("corp.company.get", { userId: "hassan" });
      return { p: sans(p), pending: Object.values(pending).map(sans), company };
    };
    expect(await run("bank-b")).toEqual(await run("reference"));
  });
});

describe("bulk payments", () => {
  const rows = [
    { beneficiaryId: "sup_textile", amount: 100_000, reference: "A" },
    { beneficiaryId: "sup_logistics", amount: 50_000, reference: "B" },
    { beneficiaryId: "someone_new", amount: 10_000, reference: "C" },
    { beneficiaryId: "sup_textile", amount: 100_000, reference: "A" },
    { beneficiaryId: "sup_packaging", amount: -5, reference: "D" },
  ];
  it("checks every row the same way on both banks", () => {
    const { a, b } = both();
    const x = a.checkBatch({ userId: "sara", fromAccountId: "acme_ops", lines: rows }), y = b.checkBatch({ userId: "sara", fromAccountId: "acme_ops", lines: rows });
    expect(y).toEqual(x);
    expect(x.lines.map((l) => [l.n, l.ok, l.code])).toEqual([[1, true, undefined], [2, true, undefined], [3, false, "BENEFICIARY_NOT_WHITELISTED"], [4, false, "DUPLICATE_LINE"], [5, false, "INVALID_AMOUNT"]]);
    expect(x).toMatchObject({ validCount: 2, invalidCount: 3, total: 150_000 });
  });
  it("starts one payment of the valid rows, counted once against the limits, approved as one", () => {
    const { a, b } = both();
    const x = a.initiateBulk({ userId: "sara", fromAccountId: "acme_ops", lines: rows, reference: "Nov run" }), y = b.initiateBulk({ userId: "sara", fromAccountId: "acme_ops", lines: rows, reference: "Nov run" });
    expect(x).toMatchObject({ amount: 150_000, beneficiaryId: "bulk", required: 1, reference: "Nov run", status: "pending_approval" });
    expect(x.lines!.map((l) => l.n)).toEqual([1, 2]);
    expect(sans(y)).toEqual(sans(x));
    expect(a.getCompany().users.find((u) => u.id === "sara")!.usedToday).toBe(150_000);
    expect(sans(b.approvePayment({ userId: "hassan", paymentId: y.id }))).toEqual(sans(a.approvePayment({ userId: "hassan", paymentId: x.id })));
    expect(a.getCompany().accounts[0]!.balance).toBe(24_850_000);
  });
  it("refuses the same whole-file problems with the same codes and words", () => {
    const { a, b } = both();
    const cases: [string, () => unknown, () => unknown][] = [
      ["no rows", () => a.checkBatch({ userId: "sara", fromAccountId: "acme_ops", lines: [] }), () => b.checkBatch({ userId: "sara", fromAccountId: "acme_ops", lines: [] })],
      ["too many rows", () => a.checkBatch({ userId: "sara", fromAccountId: "acme_ops", lines: Array.from({ length: 51 }, () => rows[0]!) }), () => b.checkBatch({ userId: "sara", fromAccountId: "acme_ops", lines: Array.from({ length: 51 }, () => rows[0]!) })],
      ["no valid row", () => a.initiateBulk({ userId: "sara", fromAccountId: "acme_ops", lines: [rows[2]!] }), () => b.initiateBulk({ userId: "sara", fromAccountId: "acme_ops", lines: [rows[2]!] })],
      ["an approver", () => a.checkBatch({ userId: "hassan", fromAccountId: "acme_ops", lines: rows }), () => b.checkBatch({ userId: "hassan", fromAccountId: "acme_ops", lines: rows })],
      ["above the person's limit", () => a.initiateBulk({ userId: "omar", fromAccountId: "acme_ops", lines: [{ ...rows[0]!, amount: 600_000 }] }), () => b.initiateBulk({ userId: "omar", fromAccountId: "acme_ops", lines: [{ ...rows[0]!, amount: 600_000 }] })],
    ];
    for (const [name, fa, fb] of cases) { expect(thrown(fb), name).toEqual(thrown(fa)); expect(thrown(fa).code, name).not.toBe("none"); }
  });
  it("reads a pasted file: header, blanks, spaces and a reference with a comma", async () => {
    const bank = new MockBank("acme"); bank.now = () => T;
    const c = await bank.call("corp.bulk.check", { userId: "sara", fromAccountId: "acme_ops", file: "beneficiary,amount,reference\n\n sup_textile , 25000 , INV-1, part 2\nsup_logistics,\nsup_packaging,18_000.50,INV-3\n" });
    expect(Object.values(c.lines).map((l: any) => [l.n, l.payee, l.amount, l.reference, l.ok])).toEqual([[1, "Atlas Textiles", 25000, "INV-1, part 2", true], [2, "Nile Logistics", NaN, "", false], [3, "Dubai Packaging", 18000.5, "INV-3", true]]);
    expect(Object.keys(c.problems)).toEqual(["2"]);
    expect(c).toMatchObject({ validCount: 2, total: 43_000.5, requiredApprovers: 1, currency: "PKR" });
    await expect(bank.call("corp.bulk.submit", { userId: "sara", fromAccountId: "acme_ops", file: "sup_textile,1000" })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
});

describe("payroll runs", () => {
  const rows = [
    { beneficiaryId: "emp_ali", amount: 180_000, reference: "Oct salary" },
    { beneficiaryId: "emp_sana", amount: 300_000, reference: "Salary + bonus" }, // 1.25 x 240,000: fits
    { beneficiaryId: "emp_bilal", amount: 300_000, reference: "typo" }, // 2 x 150,000: above the cap
    { beneficiaryId: "sup_textile", amount: 1_000, reference: "not staff" },
    { beneficiaryId: "emp_ali", amount: 180_000, reference: "again" }, // paid twice
    { beneficiaryId: "emp_hina", amount: -1, reference: "bad" },
  ];
  const run = (over: Record<string, unknown> = {}) => ({ userId: "sara", fromAccountId: "acme_ops", period: "2026-10", lines: rows, ...over });
  it("checks every row the same way on both banks", () => {
    const { a, b } = both();
    const x = a.checkPayroll(run()), y = b.checkPayroll(run());
    expect(y).toEqual(x);
    expect(x.lines.map((l) => [l.n, l.ok, l.code])).toEqual([[1, true, undefined], [2, true, undefined], [3, false, "ABOVE_SALARY_CAP"], [4, false, "NOT_AN_EMPLOYEE"], [5, false, "DUPLICATE_LINE"], [6, false, "INVALID_AMOUNT"]]);
    expect(x).toMatchObject({ validCount: 2, total: 480_000 });
  });
  it("always needs two approvers, even for a small run, and is one payment for the limits", () => {
    const { a, b } = both();
    const x = a.initiatePayroll(run({ lines: [rows[0]!] })), y = b.initiatePayroll(run({ lines: [rows[0]!] }));
    expect(x).toMatchObject({ beneficiaryId: "payroll", period: "2026-10", required: 2, amount: 180_000, reference: "Payroll 2026-10" });
    expect(sans(y)).toEqual(sans(x));
    expect(a.getCompany().users.find((u) => u.id === "sara")!.usedToday).toBe(180_000);
    for (const [p, id] of [[a, x.id], [b, y.id]] as const) {
      expect(p.approvePayment({ userId: "hassan", paymentId: id }).status).toBe("pending_approval");
      expect(p.approvePayment({ userId: "layla", paymentId: id }).status).toBe("released");
    }
  });
  it("runs a pay period once, until the run is withdrawn or rejected", () => {
    for (const p of [provider("reference"), provider("bank-b")]) {
      const first = p.initiatePayroll(run({ lines: [rows[0]!] }));
      expect(thrown(() => p.checkPayroll(run())), p.constructor.name).toMatchObject({ code: "PAYROLL_ALREADY_RUN", message: "Payroll for 2026-10 has already been started" });
      expect(thrown(() => p.initiatePayroll(run({ lines: [rows[1]!] }))).code).toBe("PAYROLL_ALREADY_RUN");
      p.withdrawPayment({ userId: "sara", paymentId: first.id });
      expect(p.checkPayroll(run()).validCount).toBe(2);
      expect(p.checkPayroll(run({ period: "2026-09" })).validCount).toBe(2); // another month is independent
    }
  });
  it("refuses a period that is not a month or lies in the future, with the same words on both banks", () => {
    const { a, b } = both();
    for (const period of ["October", "2026-13", "2026-12", ""]) {
      const x = thrown(() => a.checkPayroll(run({ period }))), y = thrown(() => b.checkPayroll(run({ period })));
      expect(y, period).toEqual(x); expect(x.code, period).toBe("INVALID_PERIOD");
    }
  });
  it("reads a pasted file and shows employee names, and the roster and error words are the bank's own", async () => {
    const bank = new MockBank("acme"); bank.now = () => T;
    const c = await bank.call("corp.payroll.check", { userId: "sara", fromAccountId: "acme_ops", period: "2026-10", file: "employee,amount,reference\nemp_ali,180000,Oct\nemp_hina,500000,Oct\n" });
    expect(Object.values(c.lines).map((l: any) => [l.payee, l.ok, l.message])).toEqual([["Ali Hamdan", true, undefined], ["Helena Rauch", false, "More than 1.5 times this employee's monthly salary"]]);
    expect(c).toMatchObject({ requiredApprovers: 2, period: "2026-10", total: 180_000 });
    expect((await bank.call("corp.company.get", { userId: "sara" })).employees.emp_ali).toEqual({ id: "emp_ali", name: "Ali Hamdan", bank: "HBL", maskedNumber: "••4410" });
    await expect(bank.call("corp.payroll.submit", { userId: "sara", fromAccountId: "acme_ops", period: "2026-10", file: "emp_ali,1000" })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await bank.call("bank.otp.send"); await bank.call("bank.otp.verify", { code: "482100" });
    const p = await bank.call("corp.payroll.submit", { userId: "sara", fromAccountId: "acme_ops", period: "2026-10", file: "emp_ali,180000\nemp_sana,200000" });
    expect(p).toMatchObject({ payee: "Payroll 2026-10 · 2 employees", required: 2 });
  });
});
