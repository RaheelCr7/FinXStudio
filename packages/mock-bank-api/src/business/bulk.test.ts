import { describe, it, expect } from "vitest";
import { MockBank } from "../index";
import { cleanCell, fileKey, parseBankFile, parseCsv, parseMinor, reportCell } from "./bulk-files";
import { defaultRunMinor, seedTotal } from "./bulk-data";

// Tuesday 3 November 2026, 10:42 UTC: the day of the demo (the cut-off is 16:00)
const NOW = Date.parse("2026-11-03T10:42:00Z");
const make = (opts: ConstructorParameters<typeof MockBank>[1] = {}, persona = "alex") => { const b = new MockBank(persona, { ...opts }); b.now = () => NOW; return b; };
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const enter = async (b: MockBank, id: string) => { await verify(b); await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); await b.call("bank.session.switch", { contextId: id }); };
const at = async (id: string, opts?: ConstructorParameters<typeof MockBank>[1]) => { const b = make(opts); await enter(b, id); return b; };

const HEAD = "Payee name,Account number or IBAN,Bank code,Amount,Reference";
const HARB = "Harbour Packaging,5520018841,021000021";
const NORD = "Nordic Supplies AB,DE89370400440532013000,";
const WHIT = "Whitby Logistics,12349911,20-00-00";
const GULF = "Gulf Trade FZE,AE070331234567890123456,";
const csv = (...rows: string[]) => [HEAD, ...rows].join("\n");
const check = (b: MockBank, file: string, extra: Record<string, unknown> = {}) => b.call("corp.bulk.check", { fromAccountId: "alpha_ops", file, kind: "csv", format: "csv", ...extra });

describe("reading a payment file", () => {
  it("a csv is cells; quotes keep commas, doubled quotes and line breaks, and a long file is noticed, not read to the end", () => {
    expect(parseCsv('a,"b, c",d\n"e ""f""",g\r\nh', 50)).toEqual([["a", "b, c", "d"], ['e "f"', "g"], ["h"]]);
    expect(parseCsv("﻿a,b", 50)).toEqual([["a", "b"]]);
    expect(parseCsv("a\n\n  \nb", 50)).toEqual([["a"], ["b"]]);
    expect(parseCsv(Array.from({ length: 5000 }, (_, i) => `r${i},1`).join("\n"), 50).length).toBeLessThanOrEqual(52);
  });
  it("control characters become spaces and a value is cut; nothing is run or expanded", () => {
    expect(cleanCell("a\u0000b\tc\nd")).toBe("a b c d");
    expect(cleanCell("x".repeat(500)).length).toBe(200);
    // a formula in a file is only text: it is kept as it came and shown as text
    expect(parseCsv('=HYPERLINK("http://example.invalid"),1', 5)[0]).toEqual(['=HYPERLINK("http://example.invalid")', "1"]);
  });
  it("the bank file is a BatchFile of Payment blocks; a doctype, an entity or something that is not XML is refused", () => {
    const xml = "<BatchFile><Payment><Name>A &amp; B</Name><Account>1</Account><BankCode>2</BankCode><Amount>3.00</Amount><Reference>R</Reference></Payment></BatchFile>";
    expect(parseBankFile(xml, 50)).toEqual([["A & B", "1", "2", "3.00", "R"]]);
    expect(parseBankFile(`<!DOCTYPE x [<!ENTITY a "b">]>${xml}`, 50)).toBeNull();
    expect(parseBankFile("a,b,c", 50)).toBeNull();
    expect(parseBankFile("<BatchFile></BatchFile>", 50)).toEqual([]);
    expect(parseBankFile("<BatchFile><Payment><Name>&amp;lt;</Name></Payment></BatchFile>", 5)![0]![0]).toBe("&lt;");
  });
  it("an amount is whole smallest units: digits, one dot, no more decimals than the currency has", () => {
    expect([parseMinor("9800", "USD"), parseMinor("9800.5", "USD"), parseMinor("0.05", "USD"), parseMinor("1.234", "JOD"), parseMinor("100", "JPY")]).toEqual([980000, 980050, 5, 1234, 100]);
    for (const bad of ["", "-5", "1,000", "1e3", "5.", ".5", "1.234", "abc", "1.2.3", "1".repeat(16), " "]) expect(parseMinor(bad, "USD"), bad).toBeNull();
    expect(parseMinor("1.5", "JPY")).toBeNull();
  });
  it("a report cell that a spreadsheet would run as a formula is quoted off, and commas and quotes are escaped", () => {
    expect([reportCell("=1+1"), reportCell("@x"), reportCell("a,b"), reportCell('q"q'), reportCell(4)]).toEqual(["'=1+1", "'@x", '"a,b"', '"q""q"', "4"]);
    expect(fileKey("a")).toBe(fileKey("a"));
    expect(fileKey("a")).not.toBe(fileKey("b"));
  });
});

describe("bulk payment: the lines", () => {
  it("every line is checked in the order of the spec and the first thing wrong is its message", async () => {
    const b = await at("alpha");
    const r = await check(b, csv(
      `${HARB},9800,PO-1`, // 1 ready
      `${HARB},9800,PO-1`, // 2 same as 1
      ",5520018841,021000021,10,X", // 3 name
      `${"N".repeat(71)},5520018841,021000021,10,X`, // 4 name too long
      `${HARB},0,X`, // 5 amount
      `Harbour Packaging,55,021000021,10,X`, // 6 account
      `Harbour Packaging,5520018841,021000022,10,X`, // 7 routing number
      `Unknown Co,5520018841,021000021,10,X`, // 8 not approved
      `Harbour Packaging,5520018842,021000021,10,X`, // 9 not the saved account
      `${HARB},900000,X`, // 10 above the limit
      `${NORD},6500,INV-1`, // 11 ready, EUR
    ));
    const m = Object.values<any>(r.lines).map((l) => l.message);
    expect(m).toEqual(["", "Same as payment 1.", "Enter the payee name.", "The name is too long.", "Enter an amount above zero.", "Check the account number.", "Check the routing number.", "Not an approved payee.", "Doesn’t match the saved account details.", "Above your payment limit.", ""]);
    expect([r.count, r.valid, r.invalid, r.canContinue, r.blocker, r.mixed, r.currencies]).toEqual([11, 2, 9, false, "Fix or remove the payments that need fixing.", true, ["USD", "EUR"]]);
    // 9,800.00 and 6,500.00 euros at 0.926 (7,019.44)
    expect(r.total).toBe(16_819.44);
    expect(r.lines["11"]).toMatchObject({ currency: "EUR", usd: 7_019.44, amountText: "€6,500.00", accountText: "••3000", status: "ready" });
  });
  it("a sort code and an IBAN are checked by their own rules; the currency follows the format", async () => {
    const b = await at("alpha");
    const r = await check(b, csv(`${WHIT},920,F-1`, `Whitby Logistics,12349911,200000,920,F-2`, "Whitby Logistics,1234991,200000,920,F-3", `${NORD},10,I-1`, "Nordic Supplies AB,DE89370400440532013001,,10,I-2", "Nordic Supplies AB,DE89,,10,I-3", `${GULF},4000,I-4`));
    expect(Object.values<any>(r.lines).map((l) => [l.status, l.currency, l.message])).toEqual([["ready", "GBP", ""], ["ready", "GBP", ""], ["fix", "GBP", "Check the account number."], ["ready", "EUR", ""], ["fix", "EUR", "Check the account number."], ["fix", "EUR", "Check the account number."], ["ready", "AED", ""]]);
  });
  it("a file of more than 50 payments, an empty one, a type that is wrong and one sent before are refused with the words of the spec", async () => {
    const b = await at("alpha");
    expect(await code(check(b, csv(...Array.from({ length: 51 }, (_, i) => `${HARB},${i + 1},R${i}`))))).toBe("BATCH_TOO_LARGE");
    expect((await check(b, csv(...Array.from({ length: 50 }, (_, i) => `${HARB},${i + 1},R${i}`)))).count).toBe(50);
    expect(await code(check(b, HEAD))).toBe("FILE_EMPTY");
    expect(await code(check(b, "", { kind: "csv" }))).toBe("FILE_EMPTY");
    expect(await code(check(b, "x".repeat(300 * 1024)))).toBe("FILE_TOO_BIG");
    expect(await code(check(b, csv(`${HARB},1,R`), { size: 3_400_000 }))).toBe("FILE_TOO_BIG");
    await expect(check(b, "<BatchFile/>", { kind: "xml" })).rejects.toMatchObject({ code: "FILE_TYPE", message: "Use a CSV file." });
    await expect(check(b, csv(`${HARB},1,R`), { format: "bank", bankFormats: true })).rejects.toMatchObject({ code: "FILE_TYPE", message: "Use a bank file." });
    expect(await code(check(b, csv(`${HARB},1,R`), { format: "bank", kind: "xml" }))).toBe("FORMAT_NOT_ENABLED");
    await expect(check(b, "<nothing/>", { format: "bank", kind: "xml", bankFormats: true })).rejects.toMatchObject({ code: "FILE_UNREADABLE" });
    const xml = `<BatchFile><Payment><Name>Harbour Packaging</Name><Account>5520018841</Account><BankCode>021000021</BankCode><Amount>50.00</Amount><Reference>X</Reference></Payment></BatchFile>`;
    expect((await check(b, xml, { format: "bank", kind: "xml", bankFormats: true })).valid).toBe(1);
    const sent = csv(`${HARB},77,SENT`);
    await b.call("corp.sandbox.arrange", { op: "sentFile", file: sent, on: "2026-10-30" });
    await expect(check(b, sent)).rejects.toMatchObject({ code: "ALREADY_SENT", message: "You already sent this file on 30 Oct." });
  });
  it("lines entered by hand: add, remove, edit, use the saved details, remove every error", async () => {
    const b = await at("alpha");
    expect(await code(b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: [], begin: true }))).toBe("EMPTY_BATCH");
    expect(await code(b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: [], add: true, addSupplierId: "harb", addAmount: "" }))).toBe("ADD_INVALID");
    let r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: [], add: true, addSupplierId: "harb", addAmount: "120.50", addReference: "INV-9" });
    r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: r.raw, add: true, addSupplierId: "whit", addAmount: "90" });
    expect([r.count, r.valid, r.total, r.lines["1"].name, r.lines["2"].currency]).toEqual([2, 2, 120.5 + 115.24, "Harbour Packaging", "GBP"]);
    r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: r.raw, editN: 1, editAccount: "123" });
    expect(r.lines["1"]).toMatchObject({ status: "fix", message: "Check the account number." });
    r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: r.raw, editN: 1, editAccount: "5520018842" });
    expect(r.lines["1"]).toMatchObject({ message: "Doesn’t match the saved account details.", canUseSaved: true });
    r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: r.raw, useSavedN: 1 });
    expect(r.lines["1"]).toMatchObject({ status: "ready", canUseSaved: false });
    r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: r.raw, editN: 2, editAmount: "abc" });
    expect(r.invalid).toBe(1);
    r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: r.raw, removeErrors: true });
    expect([r.count, r.canContinue]).toEqual([1, true]);
    r = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: r.raw, removeN: 1 });
    expect([r.count, r.canContinue, r.blocker]).toEqual([0, false, "Add at least one payment."]);
  });
  it("the account must be one the person may pay from, in the company's currency", async () => {
    const b = await at("alpha");
    expect(await code(b.call("corp.bulk.check", { fromAccountId: "alpha_res", lines: [] }))).toBe("ACCOUNT_NOT_PERMITTED");
    expect(await code(b.call("corp.bulk.check", { fromAccountId: "nope", lines: [] }))).toBe("ACCOUNT_NOT_FOUND");
    expect(Object.keys(await b.call("corp.accounts.list", { for: "pay" }))).toEqual(["alpha_ops"]);
  });
});

describe("bulk payment: speeds, the review, the code, the batch", () => {
  const raw = async (b: MockBank, rows: string[]) => (await check(b, csv(...rows))).raw;
  it("the speeds follow the rails and the options; one that a payment is too large for is marked; Instant has no date", async () => {
    const b = await at("alpha");
    const small = await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", lines: await raw(b, [`${HARB},100,A`, `${HARB},200,B`]) });
    expect(Object.values<any>(small.speeds).map((x) => [x.id, x.usable, x.feeText])).toEqual([["standard", true, "No fee"], ["sameDay", true, "$2.00"], ["instant", true, "$0.50"]]);
    const large = await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", lines: await raw(b, [`${HARB},30000,A`]) });
    expect(large.speeds.standard).toMatchObject({ usable: false, reason: "Some payments are too large" });
    expect(large.firstUsable).toBe("sameDay");
    const abroad = await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", lines: await raw(b, [`${NORD},100,A`]) });
    expect(abroad.speeds.standard).toMatchObject({ usable: true, feeText: "$25.00" });
    expect(abroad.speeds.sameDay).toMatchObject({ usable: false, reason: "Some payments go abroad" });
    const some = await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", allowSameDay: false, allowInstant: false, lines: await raw(b, [`${HARB},100,A`]) });
    expect(Object.keys(some.speeds)).toEqual(["standard"]);
    expect(await code(b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "standard", lines: await raw(b, [`${HARB},30000,A`]) }))).toBe("RAIL_LIMIT");
    const inst = await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "instant", sendOn: "2026-11-10", lines: await raw(b, [`${HARB},100,A`]) });
    expect(inst.sendOn).toBe("2026-11-03");
    expect(await code(b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "standard", sendOn: "2026-11-07", lines: await raw(b, [`${HARB},100,A`]) }))).toBe("DATE_NOT_WORKING_DAY");
    expect(await code(b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "standard", sendOn: "2026-11-09", lines: await raw(b, [`${HARB},100,A`]) }))).toBe("DATE_NOT_WORKING_DAY");
    expect((await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "standard", sendOn: "2026-11-10", lines: await raw(b, [`${HARB},100,A`]) })).sendText).toBe("Tue 10 Nov");
    expect(await code(b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", lines: await raw(b, [`${HARB},0,A`]) }))).toBe("LINES_NEED_FIXING");
    expect(await code(b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", lines: [] }))).toBe("NO_VALID_LINES");
  });
  it("the review checks the person's limit, the company's and the money before the code, and counts the approvers", async () => {
    const b = await at("alpha");
    // Alex has 231,100.00 of his day left (250,000.00 less 18,900.00)
    const big = await raw(b, [`${HARB},20000,A`, `${HARB},20000,B`, `${HARB},20000,C`, `${HARB},20000,D`, `${HARB},20000,E`, `${HARB},20000,F`, `${HARB},20000,G`, `${HARB},20000,H`, `${HARB},20000,I`, `${HARB},20000,J`, `${HARB},20000,K`, `${HARB},20000,L`]);
    const ok = await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "sameDay", review: true, lines: big.slice(0, 3) });
    expect([ok.totalText, ok.fee, ok.youPayText, ok.requiredApprovers, ok.codeExtra, ok.sendText]).toEqual(["$60,000.00", 3, "$60,003.00", 2, true, "Today"]);
    expect(await code(b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "sameDay", review: true, lines: big }))).toBe("LIMIT_USER_EXCEEDED");
    const small = await b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "standard", review: true, lines: big.slice(0, 1) });
    expect([small.requiredApprovers, small.codeExtra]).toEqual([1, false]);
    await b.call("corp.sandbox.arrange", { op: "balance", accountId: "alpha_ops", balance: 1_000 });
    await expect(b.call("corp.bulk.quote", { fromAccountId: "alpha_ops", speed: "standard", review: true, lines: big.slice(0, 1) })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS", message: "There isn’t enough money in this account." });
  });
  it("a batch needs the one-time code, is refused with a line that needs fixing, and then waits for approval as one payment; nothing moves", async () => {
    const b = await at("alpha");
    const file = csv(`${HARB},1200.50,PO-1`, `${NORD},6500,INV-1`);
    const r = await check(b, file);
    const input = { fromAccountId: "alpha_ops", lines: r.raw, speed: "standard", name: "Suppliers November", fileKey: r.fileKey };
    expect(await code(b.call("corp.bulk.submit", input))).toBe("OTP_REQUIRED");
    await verify(b);
    expect(await code(b.call("corp.bulk.submit", { ...input, lines: [...r.raw, { name: "Nobody", account: "1", code: "", amount: "5", reference: "" }] }))).toBe("LINES_NEED_FIXING");
    expect(await code(b.call("corp.bulk.submit", { ...input, name: "x".repeat(36) }))).toBe("NAME_TOO_LONG");
    expect(await code(b.call("corp.bulk.submit", { ...input, speed: "turbo" }))).toBe("RAIL_NOT_AVAILABLE");
    const before = await b.call("corp.company.get");
    const done = await b.call("corp.bulk.submit", input);
    // 1,200.50 and 6,500.00 euros (7,019.44), plus the fee of 25.00 for a payment abroad
    expect(done).toMatchObject({ id: "PAY-2042", status: "pending_approval", required: 1, name: "Suppliers November", count: 2, totalText: "$8,219.94", youPayText: "$8,244.94", speedName: "Standard", sendText: "Today", approvalsText: "Waiting for 1 approver", mixed: true });
    expect(done.reference).toBe("BWX-20261103-2042");
    const after = await b.call("corp.company.get");
    expect(after.accounts.alpha_ops.balance).toBe(before.accounts.alpha_ops.balance);
    expect(after.me.usedToday).toBe(27_144.94);
    expect(after.companyUsedToday).toBe(0);
    // the code is used up, and the same file cannot be sent again
    expect(await code(b.call("corp.bulk.submit", input))).toBe("OTP_REQUIRED");
    await expect(check(b, file)).rejects.toMatchObject({ code: "ALREADY_SENT" });
    const list = await b.call("corp.bulk.list");
    expect(list.latest).toBe("PAY-2042");
    expect(list.batches["PAY-2042"]).toMatchObject({ statusKey: "waiting", statusText: "Waiting for approval", name: "Suppliers November", sub: "2 payments · 3 Nov" });
    const one = await b.call("corp.bulk.get", { id: "PAY-2042" });
    expect(Object.values<any>(one.lines).map((l) => [l.payee, l.statusText, l.account])).toEqual([["1. Harbour Packaging", "Waiting for approval", "••8841"], ["2. Nordic Supplies AB", "Waiting for approval", "••3000"]]);
  });
  it("the approvers: two above 50,000.00 of what the account pays; every line is checked again at submit", async () => {
    const b = await at("alpha");
    const r = await check(b, csv(`${HARB},24000,A`, `${HARB},24000,B`, `${HARB},2500,C`));
    await verify(b);
    const done = await b.call("corp.bulk.submit", { fromAccountId: "alpha_ops", lines: r.raw, speed: "sameDay", name: "Big" });
    expect([done.required, done.youPayText]).toEqual([2, "$50,503.00"]);
  });
  it("the same rules apply when a person who may not start a batch tries, from Personal and with another user", async () => {
    const beta = await at("beta");
    expect(await code(beta.call("corp.bulk.check", { fromAccountId: "beta_ops", lines: [] }))).toBe("PERMISSION_DENIED");
    expect(await code(beta.call("corp.bulk.list"))).toBe("PERMISSION_DENIED");
    expect(await code(beta.call("corp.payroll.register", { op: "options" }))).toBe("PERMISSION_DENIED");
    const personal = make();
    expect(await code(personal.call("corp.bulk.check", { fromAccountId: "alpha_ops", lines: [] }))).toBe("WRONG_CONTEXT");
    const alpha = await at("alpha");
    expect(await code(alpha.call("corp.bulk.check", { userId: "tess_m", fromAccountId: "alpha_ops", lines: [] }))).toBe("PERMISSION_DENIED");
  });
});

describe("bulk status, resending and the report", () => {
  it("the two batches of the seed: PAY-1180 paid; PAY-1190 partly paid with the fourth payment returned", async () => {
    const b = await at("alpha");
    const l = await b.call("corp.bulk.list");
    expect(Object.keys(l.batches)).toEqual(["PAY-1190", "PAY-1180"]);
    const one = await b.call("corp.bulk.get", { id: "PAY-1190" });
    expect(one).toMatchObject({ name: "Supplier batch 19", countText: "4 payments", statusKey: "partly", statusText: "Partly paid", canResend: true, failed: 1 });
    expect(one.lines["4"]).toMatchObject({ payee: "4. Gulf Trade FZE", statusText: "Failed", note: "The account name didn’t match.", account: "••3456" });
    expect(Object.values<any>(one.lines).filter((x) => x.statusKey === "paid")).toHaveLength(3);
    expect(Object.keys(one.others)).toEqual(["PAY-1180"]);
    const paid = await b.call("corp.bulk.get", { id: "PAY-1180" });
    expect(paid).toMatchObject({ statusText: "Paid", canResend: false, countText: "6 payments", total: seedTotal("alpha", "PAY-1180") });
    expect((await b.call("corp.bulk.get", {})).id).toBe("PAY-2042".replace("2042", "1190"));
    expect(await code(b.call("corp.bulk.get", { id: "PAY-9" }))).toBe("PAYMENT_NOT_FOUND");
  });
  it("the report has a row for each payment and a note for the returned one, and a name that a spreadsheet would run is quoted off", async () => {
    const b = await at("alpha");
    const r = (await b.call("corp.bulk.get", { id: "PAY-1190", report: true })).report;
    expect(r.fileName).toBe("PAY-1190_report.csv");
    expect(r.csv.split("\n")).toEqual(["Line,Payee,Amount,Currency,Status,Note", "1,Harbour Packaging,3200.00,USD,Paid,", "2,Nordic Supplies AB,1850.00,EUR,Paid,", "3,Whitby Logistics,920.00,GBP,Paid,", "4,Gulf Trade FZE,4000.00,AED,Failed,The account name didn’t match."]);
    expect(r.rows).toHaveLength(4);
  });
  it("Fix and resend: the failed lines come with the bank's sentence until edited; the new batch is named and sent; the original line is Resent, once", async () => {
    const b = await at("alpha");
    const first = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", repairOf: "PAY-1190" });
    expect([first.count, first.resend, first.repairOf, first.batchName, first.canContinue, first.blocker]).toEqual([1, true, "PAY-1190", "Resend of Supplier batch 19", false, "Fix or remove the payments that need fixing."]);
    expect(first.lines["1"]).toMatchObject({ name: "Gulf Trade FZE", status: "fix", message: "The account name didn’t match.", amountText: "AED 4,000.00" });
    expect(await code(b.call("corp.bulk.check", { fromAccountId: "alpha_ops", repairOf: "PAY-1180" }))).toBe("REPAIR_NOT_ALLOWED");
    expect(await code(b.call("corp.bulk.check", { fromAccountId: "alpha_ops", repairOf: "PAY-2040" }))).toBe("PAYMENT_NOT_FOUND");
    const fixed = await b.call("corp.bulk.check", { fromAccountId: "alpha_ops", repairOf: "PAY-1190", lines: first.raw, editN: 1, editName: "Gulf Trade FZE", editAccount: "AE070331234567890123456" });
    expect([fixed.lines["1"].status, fixed.canContinue, fixed.raw[0].origN]).toEqual(["ready", true, 4]);
    await verify(b);
    const done = await b.call("corp.bulk.submit", { fromAccountId: "alpha_ops", repairOf: "PAY-1190", lines: fixed.raw, speed: "standard" });
    expect([done.name, done.resent, done.count]).toEqual(["Resend of Supplier batch 19", "PAY-1190", 1]);
    const orig = await b.call("corp.bulk.get", { id: "PAY-1190" });
    expect(orig.lines["4"]).toMatchObject({ statusText: "Resent", note: "" });
    expect(orig.canResend).toBe(false);
    expect(await code(b.call("corp.bulk.check", { fromAccountId: "alpha_ops", repairOf: "PAY-1190" }))).toBe("REPAIR_NOT_ALLOWED");
  });
  it("a batch waiting for approval becomes Cancelled when it is rejected and Withdrawn when its starter takes it back", async () => {
    const b = await at("alpha");
    const r = await check(b, csv(`${HARB},100,A`));
    await verify(b);
    const done = await b.call("corp.bulk.submit", { fromAccountId: "alpha_ops", lines: r.raw, speed: "standard" });
    expect((await b.call("corp.bulk.get", { id: done.id })).lines["1"].statusText).toBe("Waiting for approval");
    await b.call("corp.payments.withdraw", { paymentId: done.id });
    const w = await b.call("corp.bulk.get", { id: done.id });
    expect([w.statusText, w.lines["1"].statusText]).toEqual(["Withdrawn", "Withdrawn"]);
  });
  it("a company with no batches has none to list", async () => {
    const b = make({}, "alexempty");
    await enter(b, "gamma");
    expect(await b.call("corp.bulk.list")).toMatchObject({ count: 0, latest: "" });
    expect(await code(b.call("corp.bulk.get", {}))).toBe("NO_BATCHES");
  });
});

describe("payroll run", () => {
  const open = (b: MockBank, extra: Record<string, unknown> = {}) => b.call("corp.payroll.register", { op: "open", period: "2026-11", fromAccountId: "alpha_ops", payDate: "2026-11-04", ...extra });
  it("the register is the source: eight people with bank details are in, one is not and says so", async () => {
    const b = await at("alpha");
    const v = await open(b);
    expect([v.count, v.periodText, v.payDateText, v.accountName, v.notInCount]).toEqual([8, "November 2026", "Wed 4 Nov 2026", "Operating ••2001", 1]);
    expect(v.notIn.emp_faris).toMatchObject({ name: "Faris Qasem", reason: "No bank details", canAddBack: false });
    expect(v.rows.emp_ali).toMatchObject({ name: "Ali Hamdan", dept: "Finance", netText: "3600.00", payText: "$3,600.00", status: "ready" });
    expect(v.rows.emp_rana).toMatchObject({ currency: "JOD", payText: "JOD 2,000.000", netText: "2000.000" });
    expect(v.totalText).toBe("$17,800.00 + £3,000.00 + AED 12,500.00 + SAR 11,250.00 + JOD 2,000.000");
    expect(v.totalUsdText).toBe("$30,866.24");
    expect(v.totalUsd * 100).toBe(defaultRunMinor("alpha"));
    expect([v.requiredApprovers, v.codeExtra, v.varianceNeeded, v.fundsOk, v.canReview]).toEqual([1, true, false, true, true]);
    const o = await b.call("corp.payroll.register", { op: "options" });
    expect(Object.values<any>(o.periods).map((p) => [p.id, p.taken])).toEqual([["2026-11", false], ["2026-10", true], ["2026-09", false]]);
    expect(Object.keys(o.dates)).toHaveLength(25);
    expect(Object.keys(o.dates)[0]).toBe("2026-11-04");
    expect(Object.keys(o.dates)).not.toContain("2026-11-09");
  });
  it("a period already sent or in the future, a day that is not a working day and an account that cannot pay are refused", async () => {
    const b = await at("alpha");
    await expect(open(b, { period: "2026-10" })).rejects.toMatchObject({ code: "PAYROLL_ALREADY_RUN", message: "Payroll for this period was already sent." });
    await expect(open(b, { period: "2026-12" })).rejects.toMatchObject({ code: "INVALID_PERIOD", message: "Choose this month or an earlier one." });
    expect(await code(open(b, { payDate: "2026-11-07" }))).toBe("DATE_NOT_WORKING_DAY");
    expect(await code(open(b, { payDate: "2027-01-04" }))).toBe("DATE_NOT_WORKING_DAY");
    expect(await code(open(b, { payDate: "" }))).toBe("DATE_REQUIRED");
    expect(await code(open(b, { fromAccountId: "alpha_res" }))).toBe("ACCOUNT_NOT_PERMITTED");
    expect(await code(b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "1" }))).toBe("NO_RUN_STARTED");
  });
  it("pay is net plus bonus less deduction; a pay above 1.5 times the monthly salary, zero or invalid is marked and blocks the review", async () => {
    const b = await at("alpha");
    await open(b);
    let v = await b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "6000" });
    expect(v.rows.emp_ali).toMatchObject({ status: "fix", message: "Above the maximum of $5,400.00.", payText: "$6,000.00" });
    expect([v.canReview, v.blocker]).toEqual([false, "Fix or remove the people marked."]);
    v = await b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "5400" });
    expect(v.rows.emp_ali.status).toBe("ready");
    v = await b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "5400.01" });
    expect(v.rows.emp_ali.message).toBe("Above the maximum of $5,400.00.");
    v = await b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "0" });
    expect(v.rows.emp_ali.message).toBe("Pay must be above zero.");
    v = await b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "12.345" });
    expect(v.rows.emp_ali.message).toBe("Enter an amount with up to 2 decimals.");
    v = await b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "3600" });
    v = await b.call("corp.payroll.register", { op: "bonus", employeeId: "emp_sana", amount: "500" });
    expect(v.rows.emp_sana).toMatchObject({ payText: "$5,300.00", detail: "Bonus +$500.00", status: "ready", netText: "4800.00" });
    v = await b.call("corp.payroll.register", { op: "deduction", employeeId: "emp_sana", amount: "120.50" });
    expect([v.rows.emp_sana.payText, v.rows.emp_sana.detail]).toEqual(["$5,179.50", "Bonus +$500.00 · Deduction -$120.50"]);
    v = await b.call("corp.payroll.register", { op: "removeLine", employeeId: "emp_sana", kind: "bonus", index: 0 });
    expect(v.rows.emp_sana.payText).toBe("$4,679.50");
    expect(await code(b.call("corp.payroll.register", { op: "bonus", employeeId: "emp_sana", amount: "0" }))).toBe("INVALID_AMOUNT");
    expect(await code(b.call("corp.payroll.register", { op: "bonus", employeeId: "emp_sana", amount: "5", allowBonus: false }))).toBe("BONUS_NOT_ALLOWED");
    expect(await code(b.call("corp.payroll.register", { op: "deduction", employeeId: "emp_sana", amount: "5", allowDeduction: false }))).toBe("DEDUCTION_NOT_ALLOWED");
    expect(await code(b.call("corp.payroll.register", { op: "net", employeeId: "emp_nobody", amount: "5" }))).toBe("NOT_AN_EMPLOYEE");
  });
  it("Remove takes a person out and Add back returns them; someone without bank details cannot be added back; a total that moves by more than 20% needs a reason", async () => {
    const b = await at("alpha");
    await open(b);
    let v = await b.call("corp.payroll.register", { op: "remove", employeeId: "emp_hina" });
    expect([v.count, v.notInCount, v.notIn.emp_hina.reason, v.totalUsdText]).toEqual([7, 2, "Removed", "$24,466.24"]);
    v = await b.call("corp.payroll.register", { op: "addBack", employeeId: "emp_hina" });
    expect([v.count, v.totalUsdText]).toEqual([8, "$30,866.24"]);
    expect(await code(b.call("corp.payroll.register", { op: "addBack", employeeId: "emp_faris" }))).toBe("NO_BANK_DETAILS");
    for (const id of ["emp_sana", "emp_hina", "emp_bilal"]) v = await b.call("corp.payroll.register", { op: "remove", employeeId: id });
    expect([v.varianceNeeded, v.varianceText]).toEqual([true, "The total is down 46% on last month."]);
    expect(await code(b.call("corp.payroll.check", {}))).toBe("REASON_REQUIRED");
    expect(await code(b.call("corp.payroll.check", { reason: "x".repeat(141) }))).toBe("REASON_REQUIRED");
    expect((await b.call("corp.payroll.check", { reason: "Leavers" })).count).toBe(5);
    expect((await b.call("corp.payroll.check", { varianceCheck: false })).count).toBe(5);
    await b.call("corp.payroll.register", { op: "bonus", employeeId: "emp_ali", amount: "1000" });
    expect((await b.call("corp.payroll.register", { op: "open", period: "2026-11", fromAccountId: "alpha_ops", payDate: "2026-11-04" })).varianceNeeded).toBe(false);
    // 20 per cent is not more than 20 per cent
    for (const id of ["emp_ali", "emp_sana", "emp_hina", "emp_noura"]) await b.call("corp.payroll.register", { op: "remove", employeeId: id });
    await b.call("corp.payroll.register", { op: "net", employeeId: "emp_bilal", amount: "4500" });
    await b.call("corp.payroll.register", { op: "addBack", employeeId: "emp_hina" });
    expect((await b.call("corp.payroll.register", { op: "bonus", employeeId: "emp_hina", amount: "10" })).varianceNeeded).toBe(true);
  });
  it("an empty run and a debit above the balance are refused; the review checks the limits", async () => {
    const b = await at("alpha");
    await open(b);
    let v: any;
    for (const id of ["emp_ali", "emp_sana", "emp_bilal", "emp_hina", "emp_lena", "emp_noura", "emp_khalid", "emp_rana"]) v = await b.call("corp.payroll.register", { op: "remove", employeeId: id });
    expect([v.count, v.totalText, v.blocker, v.canReview]).toEqual([0, "None", "Add at least one person.", false]);
    await expect(b.call("corp.payroll.check", { reason: "x" })).rejects.toMatchObject({ code: "EMPTY_BATCH", message: "Add at least one person." });
    await open(b);
    await b.call("corp.sandbox.arrange", { op: "balance", accountId: "alpha_ops", balance: 20_000 });
    v = await b.call("corp.payroll.register", { op: "net", employeeId: "emp_ali", amount: "3600" });
    expect([v.fundsOk, v.fundsMessage, v.blocker]).toEqual([false, "There isn’t enough money in this account.", "There isn’t enough money in this account."]);
    await expect(b.call("corp.payroll.check", {})).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    await b.call("corp.sandbox.arrange", { op: "balance", accountId: "alpha_ops", balance: 480_000 });
    expect((await b.call("corp.payroll.check", { review: true })).youPayText).toBe("$30,866.24");
    // 250,000.00 less 18,900.00: a person who has sent most of the day cannot start a run
    const c = await at("alpha");
    await open(c);
    await c.call("corp.sandbox.arrange", { op: "payment", payment: { id: "PAY-7001", companyId: "alpha", fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 1, currency: "USD", reference: "X", status: "pending_approval", initiatedBy: "alex", initiatedAt: "2026-11-03T09:00:00Z", valueDate: "2026-11-03", afterCutoff: false, required: 1, approvals: [] } });
  });
  it("a run needs the one-time code and then waits as one payment for one approver (two above 50,000.00); the period is then taken", async () => {
    const b = await at("alpha");
    await open(b);
    expect(await code(b.call("corp.payroll.submit", { payslips: true }))).toBe("OTP_REQUIRED");
    await verify(b);
    const done = await b.call("corp.payroll.submit", { payslips: true });
    expect(done).toMatchObject({ id: "PAY-2042", status: "pending_approval", required: 1, periodText: "November 2026", count: 8, countText: "8 employees", totalUsdText: "$30,866.24", approvalsText: "Waiting for 1 approver", reference: "BWX-20261103-2042" });
    const co = await b.call("corp.company.get");
    expect(co.accounts.alpha_ops.balance).toBe(480_000);
    expect(co.me.usedToday).toBe(49_766.24);
    expect(await code(open(b))).toBe("PAYROLL_ALREADY_RUN");
    const pending = (await b.call("corp.payments.track", { paymentId: "PAY-2042" }));
    expect(pending.to).toBe("Payroll 2026-11 · 8 employees");
    // withdrawing it frees the period again
    await b.call("corp.payments.withdraw", { paymentId: "PAY-2042" });
    expect((await open(b)).count).toBe(8);
  });
  it("two approvers are needed above the company's threshold (50,000.00; no run on this register reaches it, so a test lowers it), one below", async () => {
    const b = await at("alpha");
    await b.call("corp.sandbox.arrange", { op: "dualAbove", amount: 25_000 });
    await open(b);
    expect((await b.call("corp.payroll.check", {})).requiredApprovers).toBe(2);
    await verify(b);
    expect((await b.call("corp.payroll.submit", {})).required).toBe(2);
  });
});
