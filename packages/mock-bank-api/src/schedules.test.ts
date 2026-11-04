import { describe, it, expect } from "vitest";
import { MockBank, personas, type SandboxConditions } from "./index";
import type { Flaws } from "./corporate";
import { addMonths, changeState, dayName, isOpen, isoOf, msOf, nextOpen, nominal, prevOpen, remaining, runDate, upcoming, validIso } from "./schedules";

// Tue 3 Nov 2026, 10:42 UTC: the day of the demo
const NOW = Date.parse("2026-11-03T10:42:00Z");
const bank = async (persona = "alexsched", over: { conditions?: SandboxConditions; flaws?: Flaws; now?: number } = {}) => {
  const b = new MockBank(persona, { conditions: over.conditions, corpFlaws: over.flaws });
  b.now = () => over.now ?? NOW;
  return b;
};
const verified = async (persona = "alexsched", over: Parameters<typeof bank>[1] = {}) => {
  const b = await bank(persona, over);
  await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
  return b;
};
const code = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const balance = async (b: MockBank, id: string) => (await b.call("bank.accounts.list"))[id].balance;
const make = (over: Record<string, unknown> = {}) => ({ kind: "payee", target: "ben_maya", from: "acc_main", amount: 100, frequency: "monthly", first: "2026-11-06", endType: "never", ...over });
const fails = async (p: Promise<unknown>, c: string) => expect(await p.then(() => "no error", (e) => e.code)).toBe(c);

describe("the calendar", () => {
  it("writes a date the way a person reads it and checks that it is a real one", () => {
    expect(dayName("2026-11-06")).toBe("Fri 6 Nov");
    expect(dayName("2026-11-06", true)).toBe("Fri 6 Nov 2026");
    expect(["2026-11-06", "2026-02-30", "2026-1-6", "x", 5].map(validIso)).toEqual([true, false, false, false, false]);
  });
  it("moves a payment off a weekend, and off a day the bank is closed, to the next business day", () => {
    expect([isOpen("2026-11-07"), isOpen("2026-11-08"), isOpen("2026-11-09"), isOpen("2026-11-09", ["2026-11-09"])]).toEqual([false, false, true, false]);
    expect(nextOpen("2026-11-07")).toBe("2026-11-09");
    expect(nextOpen("2026-11-07", ["2026-11-09", "2026-11-10"])).toBe("2026-11-11");
    expect(prevOpen("2026-11-09")).toBe("2026-11-06");
    expect(runDate("2027-04-01", "monthly", 1)).toBe("2027-05-03"); // 1 May 2027 is a Saturday
    expect(runDate("2027-04-01", "monthly", 1, ["2027-05-03"])).toBe("2027-05-04");
  });
  it("keeps the day of the month from the first date and uses the last day of a shorter month", () => {
    expect([0, 1, 2, 3].map((k) => nominal("2027-03-31", "monthly", k))).toEqual(["2027-03-31", "2027-04-30", "2027-05-31", "2027-06-30"]);
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect([0, 1, 2].map((k) => nominal("2026-11-30", "quarterly", k))).toEqual(["2026-11-30", "2027-02-28", "2027-05-30"]);
    expect([0, 1, 2].map((k) => nominal("2026-11-06", "weekly", k))).toEqual(["2026-11-06", "2026-11-13", "2026-11-20"]);
    expect([0, 1, 2].map((k) => nominal("2026-11-06", "biweekly", k))).toEqual(["2026-11-06", "2026-11-20", "2026-12-04"]);
    expect(nominal("2026-11-06", "once", 3)).toBe("2026-11-06");
  });
  it("counts the payments left and lists the next ones, never past the end", () => {
    const s = { anchor: "2026-11-06", frequency: "weekly" as const, done: 0, endsOn: null, endCount: null };
    expect(remaining(s)).toBeNull();
    expect(remaining({ ...s, endCount: 3, done: 1 })).toBe(2);
    expect(remaining({ ...s, endsOn: "2026-11-20" })).toBe(3);
    expect(remaining({ ...s, frequency: "once", done: 1 })).toBe(0);
    expect(upcoming({ ...s, endCount: 2 }, 0, 3)).toEqual(["2026-11-06", "2026-11-13"]);
    expect(upcoming(s, 0, 3)).toEqual(["2026-11-06", "2026-11-13", "2026-11-20"]);
  });
  it("closes changes at 18:00 on the business day before the payment (09:00 when strict), and on the day itself the payment is running", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(changeState("2026-11-04", at("2026-11-03T17:59:00Z"), false)).toBe("ok");
    expect(changeState("2026-11-04", at("2026-11-03T18:00:00Z"), false)).toBe("cutoff");
    expect(changeState("2026-11-04", at("2026-11-03T08:59:00Z"), true)).toBe("ok");
    expect(changeState("2026-11-04", at("2026-11-03T09:00:00Z"), true)).toBe("cutoff");
    expect(changeState("2026-11-04", at("2026-11-04T00:00:00Z"), false)).toBe("running");
    // a Monday payment closes on the Friday before it; a closed Friday moves that to Thursday
    expect(changeState("2026-11-09", at("2026-11-06T17:59:00Z"), false)).toBe("ok");
    expect(changeState("2026-11-09", at("2026-11-06T18:00:00Z"), false)).toBe("cutoff");
    expect(changeState("2026-11-09", at("2026-11-05T17:59:00Z"), false, ["2026-11-06"])).toBe("ok");
    expect(changeState("2026-11-09", at("2026-11-05T18:00:00Z"), false, ["2026-11-06"])).toBe("cutoff");
    expect(isoOf(msOf("2026-11-06"))).toBe("2026-11-06");
  });
});

describe("the cast of scheduled payments", () => {
  it("has the eight schedules and the one that ended, each worked out from its anchor to the date it shows", async () => {
    const b = await bank();
    const all = Object.values(await b.call("bank.schedules.list", { status: "live" })) as any[];
    expect(all.map((s) => [s.id, s.name, s.nextText, s.status])).toEqual([
      ["SCH-1004", "Peak Fitness", "Tue 3 Nov", "active"], ["SCH-1003", "Harbor Insurance", "Wed 4 Nov", "active"], ["SCH-1002", "Savings top-up", "Fri 6 Nov", "active"],
      ["SCH-1006", "Maya Chen", "Thu 12 Nov", "active"], ["SCH-1007", "James Whitfield", "Fri 13 Nov", "active"], ["SCH-1005", "Lena Fischer", "Mon 16 Nov", "active"],
      ["SCH-1008", "Omar Haddad", "Fri 20 Nov", "paused"], ["SCH-1001", "Rent", "Tue 1 Dec", "active"],
    ]);
    for (const s of personas.alexsched!.schedules as any[]) expect(runDate(s.anchor, s.frequency, s.done), s.id).toBe(s.nextRunOn);
    expect(Object.values(await b.call("bank.schedules.list", { status: "history" })).map((s: any) => [s.id, s.status])).toEqual([["SCH-0900", "completed"]]);
    expect(all.find((s) => s.id === "SCH-1005")).toMatchObject({ remainingRuns: 7, endsText: "After 12 payments", amountText: "$200.00", fromText: "Main ••4410", sub: "Monthly · Mon 16 Nov · $200.00" });
    expect(all.find((s) => s.id === "SCH-1004")).toMatchObject({ running: true, note: "Running now" });
    expect(all.find((s) => s.id === "SCH-1008")).toMatchObject({ note: "Paused" });
    expect(all.find((s) => s.id === "SCH-1003")).toMatchObject({ amountText: "Full bill", toText: "Harbor Insurance •••• 5678" });
    expect(all.find((s) => s.id === "SCH-1007")).toMatchObject({ endsText: "Fri 26 Mar 2027", remainingRuns: 10 });
  });
  it("keeps the older entries as they were: no status asks for all of them, and the older Rent can be managed too", async () => {
    const b = await bank("alexpayees");
    const all = await b.call("bank.schedules.list");
    expect(all.sch_rent).toMatchObject({ id: "sch_rent", name: "Rent", text: "Rent · Monthly, 1 Dec, $1,450.00", beneficiaryId: "ben_james", status: "active" });
    expect(Object.keys(await b.call("bank.schedules.list", { status: "live" }))).toEqual(["sch_rent"]);
    expect(await (await bank("alex")).call("bank.schedules.list")).toEqual({});
    // a payment made later in Send money is an older entry: listed with no status filter, not managed here
    const c = await verified("alexpayees");
    await c.call("bank.schedules.cancel", { scheduleId: "sch_rent", scope: "all" });
    expect(await c.call("bank.schedules.list", { status: "live" })).toEqual({});
    await expect(c.call("bank.schedules.get", { scheduleId: "sch_new1" })).rejects.toMatchObject({ code: "SCHEDULE_NOT_FOUND" });
  });
  it("gives a saved biller a name and a line a choice list can show", async () => {
    const v = Object.values(await (await bank()).call("bank.bills.saved")) as any[];
    expect(v.map((x) => [x.name, x.sub, x.accepts])).toEqual([["Harbor Insurance", "Harbor Insurance •••• 5678", "full"], ["Northwind Card", "Northwind Card •••• 3456", "minimum"], ["Home electricity", "City Power •••• 3456", "any"]]);
  });
});

describe("reading and checking", () => {
  it("says why a payment cannot be changed or cancelled now, in the order a person meets it", async () => {
    const b = await bank();
    await expect(b.call("bank.schedules.get", { scheduleId: "SCH-9999", for: "change" })).rejects.toMatchObject({ code: "SCHEDULE_NOT_FOUND", message: "We can’t find that payment." });
    await expect(b.call("bank.schedules.get", { scheduleId: "SCH-0900", for: "change" })).rejects.toMatchObject({ code: "SCHEDULE_NOT_ACTIVE", message: "This payment has already ended or been cancelled." });
    await expect(b.call("bank.schedules.get", { scheduleId: "SCH-1004", for: "cancel" })).rejects.toMatchObject({ code: "SCHEDULE_RUNNING", message: "This payment is being processed. Try again later." });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1003", for: "change" })).toMatchObject({ id: "SCH-1003", canSkip: true });
    await expect(b.call("bank.schedules.get", { scheduleId: "SCH-1003", for: "change", strictCutoff: true })).rejects.toMatchObject({ code: "SCHEDULE_CUTOFF_PASSED", message: "This payment can’t be changed any more. Change it after it runs." });
    // reading does not need the schedule to be changeable; a paused one can always be changed
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1004" })).toMatchObject({ running: true });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1008", for: "change" })).toMatchObject({ status: "paused" });
  });
  it("says whether the next payment can be skipped, and what follows it", async () => {
    const b = await bank();
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1005" })).toMatchObject({ canSkip: true, nextText: "Mon 16 Nov", afterText: "Wed 16 Dec", endType: "count", endLeft: 7 });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1006" })).toMatchObject({ canSkip: false, endType: "never" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1007" })).toMatchObject({ endType: "date", endOn: "2027-03-26" });
  });
  it("checks a new payment without keeping it, and tells the next three dates and the dates the end can be", async () => {
    const b = await bank();
    const before = Object.keys(await b.call("bank.schedules.list", { status: "live" })).length;
    const r = await b.call("bank.schedules.check", make({ first: "2026-11-06", frequency: "weekly" }));
    expect(r).toMatchObject({ ok: true, targetName: "Maya Chen", toText: "Maya Chen ••4417", fromText: "Main ••4410", amountText: "$100.00", frequencyName: "Weekly", adverb: "weekly", startText: "Fri 6 Nov 2026", endsText: "Never", nextDates: "Fri 6 Nov · Fri 13 Nov · Fri 20 Nov", reminder: true, maxCount: 104 });
    const dates = Object.keys(r.dates);
    expect([dates.length, dates[0], r.dates[dates[0]!].name]).toEqual([60, "2026-11-13", "Fri 13 Nov 2026"]);
    expect(Object.keys(await b.call("bank.schedules.list", { status: "live" })).length).toBe(before);
    expect((await b.call("bank.schedules.check", make({ frequency: "once" }))).endsText).toBe("Doesn’t repeat");
  });
  it("lists the dates after a Saturday or a month end the way the payments will fall", async () => {
    const b = await bank();
    const monthEnd = await b.call("bank.schedules.check", make({ first: "2027-03-31", frequency: "monthly" }));
    expect(monthEnd.nextDates).toBe("Wed 31 Mar · Fri 30 Apr · Mon 31 May");
    expect((await b.call("bank.schedules.check", make({ first: "2027-04-01", frequency: "monthly" }))).nextDates).toBe("Thu 1 Apr · Mon 3 May · Tue 1 Jun");
    // a closed day moves a payment on, in the list and in the run
    const closed = await bank("alexsched", { conditions: { closedDays: ["2026-11-13"] } });
    expect((await closed.call("bank.schedules.check", make({ first: "2026-11-06", frequency: "weekly" }))).nextDates).toBe("Fri 6 Nov · Mon 16 Nov · Fri 20 Nov".replace("Mon 16 Nov", "Mon 16 Nov"));
  });
});

describe("making a schedule", () => {
  it("needs the one-time code, and the code is used up by the schedule it was for", async () => {
    const b = await bank();
    await fails(b.call("bank.schedules.create", make()), "OTP_REQUIRED");
    await code(b);
    const made = await b.call("bank.schedules.create", make());
    expect(made).toMatchObject({ scheduleId: "SCH-1009", next: "Fri 6 Nov", nextOn: "2026-11-06", targetName: "Maya Chen", amountText: "$100.00", adverb: "monthly", startText: "Fri 6 Nov 2026" });
    await fails(b.call("bank.schedules.create", make()), "OTP_REQUIRED");
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1009" })).toMatchObject({ status: "active", nextText: "Fri 6 Nov", remainingRuns: null, text: "Maya Chen · Monthly, Fri 6 Nov, $100.00", beneficiaryId: "ben_maya" });
    expect(Object.keys(await b.call("bank.schedules.list", { status: "live" }))).toHaveLength(9);
  });
  it("takes nothing when it is made: no balance moves, and the balance is not checked until a payment runs", async () => {
    const b = await verified();
    await b.call("bank.schedules.create", make({ amount: 9000 }));
    expect(await balance(b, "acc_main")).toBe(8720.76);
    expect((await b.call("bank.limits.get")).usedToday).toBe(0);
  });
  it("is refused with the core down, as every money-moving call is", async () => {
    const b = await verified("alexsched", { conditions: { transferFails: true } });
    await fails(b.call("bank.schedules.create", make()), "CORE_UNAVAILABLE");
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-1006", amount: 300 }), "CORE_UNAVAILABLE");
  });
  it("makes a schedule between own accounts of one currency, and for a saved bill in full, as the minimum or a fixed amount", async () => {
    const b = await verified();
    expect(await b.call("bank.schedules.create", { kind: "own", target: "acc_save", from: "acc_main", amount: 50, frequency: "weekly", first: "2026-11-06", endType: "count", endCount: 10 })).toMatchObject({ targetName: "Savings ••7731", endsText: "After 10 payments" });
    await code(b);
    expect(await b.call("bank.schedules.create", { kind: "bill", target: "sb_card", from: "acc_main", amountMode: "minimum", frequency: "monthly", first: "2026-11-06" })).toMatchObject({ amountText: "Minimum due", targetName: "Northwind Card" });
    await code(b);
    expect(await b.call("bank.schedules.create", { kind: "bill", target: "sb_harbor", from: "acc_main", amountMode: "full", frequency: "monthly", first: "2026-11-06" })).toMatchObject({ amountText: "Full bill" });
    await code(b);
    expect(await b.call("bank.schedules.create", { kind: "bill", target: "sb_power", from: "acc_main", amountMode: "fixed", amount: 80, frequency: "monthly", first: "2026-11-06" })).toMatchObject({ amountText: "$80.00" });
  });
  it("refuses a choice the target does not allow", async () => {
    const b = await verified();
    await fails(b.call("bank.schedules.check", make({ kind: "nothing" })), "NOT_SUPPORTED");
    await fails(b.call("bank.schedules.check", make({ target: "ben_nobody" })), "BENEFICIARY_NOT_FOUND");
    await fails(b.call("bank.schedules.check", make({ from: "acc_eur" })), "ACCOUNT_CANNOT_DEBIT");
    await fails(b.call("bank.schedules.check", make({ from: "acc_nope" })), "ACCOUNT_NOT_FOUND");
    await fails(b.call("bank.schedules.check", { kind: "own", target: "acc_main", from: "acc_main", amount: 5, frequency: "weekly", first: "2026-11-06" }), "SAME_ACCOUNT");
    await fails(b.call("bank.schedules.check", { kind: "own", target: "acc_eur", from: "acc_main", amount: 5, frequency: "weekly", first: "2026-11-06" }), "CURRENCY_MISMATCH");
    await fails(b.call("bank.schedules.check", { kind: "bill", target: "sb_nope", from: "acc_main", frequency: "monthly", first: "2026-11-06" }), "BILLER_NOT_FOUND");
    await fails(b.call("bank.schedules.check", { kind: "bill", target: "sb_power", from: "acc_main", amountMode: "minimum", frequency: "monthly", first: "2026-11-06" }), "INVALID_AMOUNT");
    await fails(b.call("bank.schedules.check", { kind: "bill", target: "sb_power", from: "acc_eur", amountMode: "full", frequency: "monthly", first: "2026-11-06" }), "BILL_CURRENCY_MISMATCH");
    await fails(b.call("bank.schedules.check", make({ frequency: "daily" })), "NOT_SUPPORTED");
  });
  it("refuses an amount that is not above zero, has too many decimals, or is over the daily limit", async () => {
    const b = await verified();
    for (const amount of [0, -5, "x"]) await fails(b.call("bank.schedules.check", make({ amount })), "INVALID_AMOUNT");
    await fails(b.call("bank.schedules.check", make({ amount: 10.123 })), "INVALID_AMOUNT");
    await fails(b.call("bank.schedules.check", make({ amount: 50_000.01 })), "DAILY_LIMIT_EXCEEDED");
    expect((await b.call("bank.schedules.check", make({ amount: 50_000 }))).ok).toBe(true);
  });
  it("takes a first date from tomorrow to 12 months ahead that is a business day, and says which rule it broke", async () => {
    const b = await bank();
    const date = (first: string) => b.call("bank.schedules.check", make({ first }));
    await fails(date("2026-11-03"), "DATE_TOO_SOON");
    await fails(date("2026-11-02"), "DATE_TOO_SOON");
    expect((await date("2026-11-04")).ok).toBe(true);
    expect((await date("2027-11-03")).ok).toBe(true);
    await fails(date("2027-11-04"), "DATE_TOO_FAR");
    await fails(date("2026-11-07"), "DATE_NOT_WEEKDAY");
    await fails(date("2026-11-08"), "DATE_NOT_WEEKDAY");
    await fails(date("soon"), "INVALID_DATE");
    const closed = await bank("alexsched", { conditions: { closedDays: ["2026-11-10"] } });
    await expect(closed.call("bank.schedules.check", make({ first: "2026-11-10" }))).rejects.toMatchObject({ code: "DATE_CLOSED" });
  });
  it("ends never, on a date from the list, or after 2 to the most for the frequency; a single payment has no end", async () => {
    const b = await bank();
    const end = (over: Record<string, unknown>) => b.call("bank.schedules.check", make({ frequency: "weekly", first: "2026-11-06", ...over }));
    expect((await end({ endType: "date", endOn: "2026-11-13" })).endsText).toBe("Fri 13 Nov 2026");
    await fails(end({ endType: "date", endOn: "2026-11-06" }), "END_BEFORE_START");
    await fails(end({ endType: "date", endOn: "2026-10-01" }), "END_BEFORE_START");
    await fails(end({ endType: "date", endOn: "2026-11-14" }), "INVALID_END_DATE");
    await fails(end({ endType: "date", endOn: "" }), "END_BEFORE_START");
    for (const [freq, max] of [["weekly", 104], ["biweekly", 52], ["monthly", 60], ["quarterly", 40]] as const) {
      expect((await b.call("bank.schedules.check", make({ frequency: freq, endType: "count", endCount: max }))).endsText).toBe(`After ${max} payments`);
      await fails(b.call("bank.schedules.check", make({ frequency: freq, endType: "count", endCount: max + 1 })), "INVALID_COUNT");
    }
    await fails(end({ endType: "count", endCount: 1 }), "INVALID_COUNT");
    await fails(end({ endType: "count", endCount: 2.5 }), "INVALID_COUNT");
    await fails(end({ endType: "count", endCount: "" }), "INVALID_COUNT");
    expect((await end({ endType: "count", endCount: 2 })).nextDates).toBe("Fri 6 Nov · Fri 13 Nov");
    expect((await end({ frequency: "once", endType: "count", endCount: 99 })).endsText).toBe("Doesn’t repeat");
    await fails(end({ endType: "sometime" }), "NOT_SUPPORTED");
  });
  it("holds the first payment to a new payee until its first 24 hours are over, and never counts the day it was added", async () => {
    const b = await bank();
    const to = (first: string) => b.call("bank.schedules.check", make({ target: "ben_casey", first }));
    // Casey was added at 07:42 today, so the 24 hours end at 07:42 tomorrow
    await expect(to("2026-11-04")).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF", message: "Casey Nguyen was added 3 hours ago. For your security the first payment to a new beneficiary must be on or after Thu 5 Nov 2026." });
    expect((await to("2026-11-05")).ok).toBe(true);
    // editing the bank details of a payee restarts its 24 hours (manage-beneficiary), so an old payee is not held
    expect((await b.call("bank.schedules.check", make({ target: "ben_jamie", first: "2026-11-04" }))).ok).toBe(true);
  });
  it("allows 20 active or paused schedules and refuses the 21st; a cancelled one frees a place", async () => {
    const b = await verified();
    for (let i = 0; i < 12; i++) { await b.call("bank.schedules.create", make({ amount: 10 + i })); await code(b); }
    await fails(b.call("bank.schedules.check", make()), "SCHEDULE_LIMIT");
    await fails(b.call("bank.schedules.create", make()), "SCHEDULE_LIMIT");
    expect(await b.call("bank.schedules.cancel", { scheduleId: "SCH-1002" })).toMatchObject({ status: "cancelled" });
    expect((await b.call("bank.schedules.check", make())).ok).toBe(true);
    const lenient = await verified("alexsched", { flaws: { scheduleLimit: false } });
    for (let i = 0; i < 13; i++) { await lenient.call("bank.schedules.create", make()); await code(lenient); }
    expect((await lenient.call("bank.schedules.check", make())).ok).toBe(true);
  });
});

describe("changing a schedule", () => {
  it("changes the amount and keeps everything else: the payee, the date and the series", async () => {
    const b = await verified();
    expect(await b.call("bank.schedules.update", { scheduleId: "SCH-1006", amount: 300, first: "2026-11-12", frequency: "weekly", target: "ben_omar" })).toMatchObject({ scheduleId: "SCH-1006", targetName: "Maya Chen", amountText: "$300.00", frequencyName: "Once" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1006" })).toMatchObject({ amount: 300, nextText: "Thu 12 Nov", targetId: "ben_maya", text: "Maya Chen · Once, Thu 12 Nov, $300.00" });
    await code(b);
    await b.call("bank.schedules.update", { scheduleId: "SCH-1005", amount: 250 });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1005" })).toMatchObject({ amount: 250, nextRunOn: "2026-11-16", remainingRuns: 7, paid: 5, done: 5 });
  });
  it("changes the next date or the end, which starts the series again from the new date", async () => {
    const b = await verified();
    await b.call("bank.schedules.update", { scheduleId: "SCH-1005", first: "2026-11-17", endType: "count", endCount: 4 });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1005" })).toMatchObject({ nextRunOn: "2026-11-17", remainingRuns: 4, anchor: "2026-11-17", done: 0, endsText: "After 4 payments" });
    await code(b);
    await b.call("bank.schedules.update", { scheduleId: "SCH-1002", endType: "date", endOn: "2026-11-20", first: "2026-11-06" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1002" })).toMatchObject({ remainingRuns: 3, endsText: "Fri 20 Nov 2026" });
    await code(b);
    // the end the person already has, sent back as it was, changes nothing about the series
    await b.call("bank.schedules.update", { scheduleId: "SCH-1007", endType: "date", endOn: "2027-03-26", first: "2026-11-13", amount: 120 });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1007" })).toMatchObject({ done: 12, amount: 120 });
  });
  it("applies the rules of a new schedule to the change, and the rules of changing", async () => {
    const b = await verified();
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-1006", first: "2026-11-03" }), "DATE_TOO_SOON");
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-1006", amount: 60_000 }), "DAILY_LIMIT_EXCEEDED");
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-1005", first: "2026-11-17", endType: "count", endCount: 1 }), "INVALID_COUNT");
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-1004", amount: 40 }), "SCHEDULE_RUNNING");
  });
  it("refuses a change after changes closed, on the day, and to one that ended, and the code is kept for the next try", async () => {
    const b = await verified("alexsched", { conditions: {} });
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-0900", amount: 5 }), "SCHEDULE_NOT_ACTIVE");
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-1004", amount: 5 }), "SCHEDULE_RUNNING");
    await fails(b.call("bank.schedules.update", { scheduleId: "SCH-9999", amount: 5 }), "SCHEDULE_NOT_FOUND");
    expect(await b.call("bank.schedules.update", { scheduleId: "SCH-1006", amount: 5 })).toMatchObject({ amountText: "$5.00" });
    const late = await verified("alexsched", { now: Date.parse("2026-11-03T18:00:00Z") });
    await fails(late.call("bank.schedules.update", { scheduleId: "SCH-1003", amount: 300 }), "SCHEDULE_CUTOFF_PASSED");
    const strict = await verified();
    await fails(strict.call("bank.schedules.update", { scheduleId: "SCH-1003", amount: 300, strictCutoff: true }), "SCHEDULE_CUTOFF_PASSED");
  });
  it("lets a paused schedule be resumed by choosing a new date", async () => {
    const b = await verified();
    await b.call("bank.schedules.update", { scheduleId: "SCH-1008", first: "2026-11-23" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1008" })).toMatchObject({ status: "active", nextRunOn: "2026-11-23", fails: 0 });
  });
  it("has rules a mutation check can switch off one at a time", async () => {
    const run = async (flaws: Flaws, call: (b: MockBank) => Promise<unknown>) => call(await verified("alexsched", { flaws }));
    expect(await run({ scheduleRunning: false }, (b) => b.call("bank.schedules.update", { scheduleId: "SCH-1004", amount: 5 }))).toMatchObject({ scheduleId: "SCH-1004" });
    expect(await run({ scheduleCutoff: false }, (b) => b.call("bank.schedules.update", { scheduleId: "SCH-1003", amount: 300, strictCutoff: true }))).toMatchObject({ scheduleId: "SCH-1003" });
    expect(await run({ scheduleDates: false }, (b) => b.call("bank.schedules.check", make({ first: "2026-11-07" })))).toMatchObject({ ok: true });
    expect(await run({ scheduleEnd: false }, (b) => b.call("bank.schedules.check", make({ endType: "count", endCount: 1 })))).toMatchObject({ ok: true });
  });
});

describe("cancelling and skipping", () => {
  it("cancels for good, needs no code, and the schedule is archived", async () => {
    const b = await bank();
    expect(await b.call("bank.schedules.cancel", { scheduleId: "SCH-1005", scope: "all" })).toMatchObject({ status: "cancelled", name: "Lena Fischer", amountText: "$200.00", frequencyName: "Monthly", cancelledOn: "Tue 3 Nov 2026" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1005" })).toMatchObject({ status: "cancelled" });
    expect(Object.keys(await b.call("bank.schedules.list", { status: "history" }))).toEqual(["SCH-0900", "SCH-1005"]);
    await fails(b.call("bank.schedules.cancel", { scheduleId: "SCH-1005" }), "SCHEDULE_NOT_ACTIVE");
  });
  it("skips only the next payment and moves the next date to the following one", async () => {
    const b = await bank();
    expect(await b.call("bank.schedules.cancel", { scheduleId: "SCH-1005", scope: "next" })).toMatchObject({ status: "skipped", skippedOn: "Mon 16 Nov 2026", next: "Wed 16 Dec 2026", nextOn: "2026-12-16" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1005" })).toMatchObject({ status: "active", nextRunOn: "2026-12-16", remainingRuns: 6, paid: 5, text: "Lena Fischer · Monthly, Wed 16 Dec, $200.00" });
  });
  it("cannot skip a single payment or the last one", async () => {
    const b = await bank();
    await fails(b.call("bank.schedules.cancel", { scheduleId: "SCH-1006", scope: "next" }), "NOT_SUPPORTED");
    const c = await bank("alexsched");
    for (let i = 0; i < 6; i++) await c.call("bank.schedules.cancel", { scheduleId: "SCH-1005", scope: "next" });
    expect(await c.call("bank.schedules.get", { scheduleId: "SCH-1005" })).toMatchObject({ remainingRuns: 1, canSkip: false });
    await fails(c.call("bank.schedules.cancel", { scheduleId: "SCH-1005", scope: "next" }), "NOT_SUPPORTED");
  });
  it("refuses the running payment, one after changes closed, and one that ended", async () => {
    const b = await bank();
    await fails(b.call("bank.schedules.cancel", { scheduleId: "SCH-1004", scope: "all" }), "SCHEDULE_RUNNING");
    await fails(b.call("bank.schedules.cancel", { scheduleId: "SCH-1003", scope: "all", strictCutoff: true }), "SCHEDULE_CUTOFF_PASSED");
    await fails(b.call("bank.schedules.cancel", { scheduleId: "SCH-0900", scope: "all" }), "SCHEDULE_NOT_ACTIVE");
    await fails(b.call("bank.schedules.cancel", { scheduleId: "SCH-9999", scope: "all" }), "SCHEDULE_NOT_FOUND");
    expect(await b.call("bank.schedules.cancel", { scheduleId: "SCH-1003", scope: "all" })).toMatchObject({ status: "cancelled" });
  });
  it("lets a payee be deleted once the schedules that used it are cancelled", async () => {
    const b = await bank();
    await expect(b.call("bank.payees.delete", { payeeId: "ben_maya" })).rejects.toMatchObject({ code: "BENEFICIARY_IN_USE" });
    await b.call("bank.schedules.cancel", { scheduleId: "SCH-1006" });
    expect(await b.call("bank.payees.delete", { payeeId: "ben_maya" })).toMatchObject({ removed: true, schedulesCancelled: 0 });
    // Peak Fitness has a running schedule and an ended one: only the running one counts
    await expect(b.call("bank.payees.delete", { payeeId: "ben_peak" })).rejects.toMatchObject({ message: expect.stringContaining("used by 1 scheduled payment") });
  });
});

describe("the scheduler (runDue)", () => {
  it("pays what is due, moves the clock, and moves the next date on", async () => {
    const b = await bank();
    const runs = await b.call("bank.schedules.runDue", { date: "2026-11-06" });
    expect(Object.values(runs).map((r: any) => [r.id, r.status, r.amount])).toEqual([
      ["SCH-1004-2026-11-03", "paid", 39.99], ["SCH-1003-2026-11-04", "paid", 383.9], ["SCH-1002-2026-11-06", "paid", 100],
    ]);
    expect(await balance(b, "acc_main")).toBe(Math.round((8720.76 - 39.99 - 383.9 - 100) * 100) / 100);
    expect(await balance(b, "acc_save")).toBe(15354.37);
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1002" })).toMatchObject({ nextRunOn: "2026-11-13", paid: 41, done: 41 });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1004" })).toMatchObject({ nextRunOn: "2026-12-03" });
    expect(b.now()).toBe(Date.parse("2026-11-06T12:00:00Z"));
  });
  it("pays a full bill only up to the most the person agreed to", async () => {
    const b = await bank();
    (b.persona.schedules as any[]).find((x) => x.id === "SCH-1003").amount = 300;
    const runs = await b.call("bank.schedules.runDue", { date: "2026-11-04" });
    expect(runs["SCH-1003-2026-11-04"]).toMatchObject({ status: "skipped", reason: "ABOVE_CAP", amount: 383.9 });
    expect(await balance(b, "acc_main")).toBe(Math.round((8720.76 - 39.99) * 100) / 100);
  });
  it("completes a single payment and a schedule that reached its end", async () => {
    const b = await bank();
    await b.call("bank.schedules.runDue", { date: "2026-11-12" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1006" })).toMatchObject({ status: "completed", endedOn: "2026-11-12" });
    expect(await balance(b, "acc_main")).toBeLessThan(8720.76 - 250);
    const c = await bank();
    c.persona.accounts[0]!.balance = 1_000_000;
    await c.call("bank.schedules.runDue", { date: "2027-04-02" });
    expect(await c.call("bank.schedules.get", { scheduleId: "SCH-1007" })).toMatchObject({ status: "completed", paid: 22, endedOn: "2027-03-19" });
  });
  it("makes no payment for a skipped date, a cancelled schedule, a paused one or a closed day's payment before the day it moves to", async () => {
    const b = await bank();
    await b.call("bank.schedules.cancel", { scheduleId: "SCH-1002", scope: "next" });
    await b.call("bank.schedules.cancel", { scheduleId: "SCH-1006" });
    const runs = await b.call("bank.schedules.runDue", { date: "2026-11-20" });
    expect(Object.keys(runs)).not.toContain("SCH-1002-2026-11-06");
    expect(Object.keys(runs)).not.toContain("SCH-1006-2026-11-12");
    expect(Object.keys(runs).filter((k) => k.startsWith("SCH-1008"))).toEqual([]);
    expect(Object.keys(runs).filter((k) => k.startsWith("SCH-1002"))).toEqual(["SCH-1002-2026-11-13", "SCH-1002-2026-11-20"]);
    // a closed Friday: the weekly payment of the 6th is followed by one on the Monday, not on the closed day
    const closed = await bank("alexsched", { conditions: { closedDays: ["2026-11-13"] } });
    await closed.call("bank.schedules.runDue", { date: "2026-11-06" });
    expect(await closed.call("bank.schedules.get", { scheduleId: "SCH-1002" })).toMatchObject({ nextRunOn: "2026-11-16" });
    expect(Object.keys(await closed.call("bank.schedules.runDue", { date: "2026-11-13" })).filter((k) => k.startsWith("SCH-1002"))).toEqual([]);
    expect(Object.keys(await closed.call("bank.schedules.runDue", { date: "2026-11-16" })).filter((k) => k.startsWith("SCH-1002"))).toEqual(["SCH-1002-2026-11-16"]);
  });
  it("skips a payment when there is not enough money, tells the customer, and pauses the schedule after two in a row", async () => {
    const b = await bank();
    await code(b); await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 8700 });
    const first = await b.call("bank.schedules.runDue", { date: "2026-11-06" });
    expect(first["SCH-1002-2026-11-06"]).toMatchObject({ status: "skipped", reason: "INSUFFICIENT_FUNDS", notice: "Payment skipped, not enough money", paused: false });
    const second = await b.call("bank.schedules.runDue", { date: "2026-11-13" });
    expect(second["SCH-1002-2026-11-13"]).toMatchObject({ status: "skipped", paused: true, notice: "Payment skipped, not enough money. Schedule paused" });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1002" })).toMatchObject({ status: "paused", fails: 2 });
    expect(Object.keys(await b.call("bank.schedules.runDue", { date: "2026-11-27" })).filter((k) => k.startsWith("SCH-1002"))).toEqual([]);
  });
  it("tries once more on the next business day when the schedule asks for it", async () => {
    const b = await verified();
    await b.call("bank.schedules.create", make({ first: "2026-11-06", retry: true, amount: 50, endType: "count", endCount: 2 }));
    await code(b); await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 8720 });
    const day1 = await b.call("bank.schedules.runDue", { date: "2026-11-06" });
    expect(day1["SCH-1009-2026-11-06"]).toMatchObject({ status: "retry", notice: "Payment postponed, not enough money. We’ll try again on Mon 9 Nov." });
    await code(b); await b.call("bank.transfers.own", { fromAccountId: "acc_save", toAccountId: "acc_main", amount: 500 });
    const day2 = await b.call("bank.schedules.runDue", { date: "2026-11-09" });
    expect(day2["SCH-1009-2026-11-09"]).toMatchObject({ status: "paid", amount: 50 });
    expect(await b.call("bank.schedules.get", { scheduleId: "SCH-1009" })).toMatchObject({ paid: 1, done: 1, nextRunOn: "2026-12-07" });
  });
  it("checks the daily limit again on the day", async () => {
    const b = await bank();
    b.persona.limits.daily = 50;
    const runs = await b.call("bank.schedules.runDue", { date: "2026-11-06" });
    expect(runs["SCH-1002-2026-11-06"]).toMatchObject({ status: "skipped", reason: "DAILY_LIMIT_EXCEEDED" });
    expect(runs["SCH-1004-2026-11-03"]).toMatchObject({ status: "paid" });
  });
  it("holds a payee that became new again to its allowance on the day, and leaves an older one alone", async () => {
    const b = await bank();
    const rent = (await b.call("bank.beneficiaries.list")).ben_harbor;
    expect(rent.ageHours).toBeGreaterThan(24);
    b.persona.beneficiaries.find((x) => x.id === "ben_harbor")!.addedAt = Date.parse("2026-11-30T23:00:00Z");
    const runs = await b.call("bank.schedules.runDue", { date: "2026-12-01" });
    expect(runs["SCH-1001-2026-12-01"]).toMatchObject({ status: "skipped", reason: "BENEFICIARY_COOLING_OFF" });
    const lenient = await bank("alexsched", { flaws: { coolingOff: false } });
    lenient.persona.beneficiaries.find((x) => x.id === "ben_harbor")!.addedAt = Date.parse("2026-11-30T23:00:00Z");
    expect((await lenient.call("bank.schedules.runDue", { date: "2026-12-01" }))["SCH-1001-2026-12-01"]).toMatchObject({ status: "paid" });
  });
  it("pays a bill in full up to the most agreed, or its minimum, from the bill the biller has that day", async () => {
    const b = await verified();
    await b.call("bank.schedules.create", { kind: "bill", target: "sb_card", from: "acc_main", amountMode: "minimum", frequency: "monthly", first: "2026-11-06" });
    await code(b); await b.call("bank.schedules.create", { kind: "bill", target: "sb_power", from: "acc_main", amountMode: "full", frequency: "monthly", first: "2026-11-06" });
    const runs = await b.call("bank.schedules.runDue", { date: "2026-11-06" });
    expect(runs["SCH-1009-2026-11-06"]).toMatchObject({ status: "paid", amount: 37.28 });
    expect(runs["SCH-1010-2026-11-06"]).toMatchObject({ status: "paid", amount: 322.8 });
    expect(Object.values(await b.call("bank.activity.list")).slice(0, 2).map((t: any) => [t.title, t.category])).toEqual([["Home electricity", "bills"], ["Northwind Card", "bills"]]);
  });
});
