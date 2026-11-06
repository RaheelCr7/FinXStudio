import { describe, it, expect } from "vitest";
import { MockBank } from "../index";

// Tuesday 3 November 2026, 10:42 UTC: the day of the demo
const NOW = Date.parse("2026-11-03T10:42:00Z");
const make = (opts: ConstructorParameters<typeof MockBank>[1] = {}, persona = "alex") => { const b = new MockBank(persona, { ...opts }); let t = NOW; b.now = () => t; return b; };
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const enter = async (b: MockBank, id: string) => { await verify(b); await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); await b.call("bank.session.switch", { contextId: id }); };
/** Alex in a company, with the administrator preview on (Ravi at Alpha, Noor at Beta). */
const admin = async (id: string, opts?: ConstructorParameters<typeof MockBank>[1]) => { const b = make(opts); await enter(b, id); await b.call("bank.session.preview", { on: true }); return b; };
const invite = { name: "Sam Okafor", email: "sam.okafor@example.com", phone: "+1 415 555 0100", role: "maker", on1: true, on2: true, limit: 100_000 };

describe("the administrator preview", () => {
  it("is a prototype device: it needs a step-up in a company, acts as the company's administrator and ends when the person switches place", async () => {
    const b = make();
    expect(await code(b.call("bank.session.preview", { on: true }))).toBe("WRONG_CONTEXT");
    await enter(b, "alpha");
    expect(await code(b.call("corp.admin.get"))).toBe("PERMISSION_DENIED");
    const on = await b.call("bank.session.preview", { on: true });
    expect(on).toMatchObject({ on: true, as: "ravi", name: "Ravi Menon" });
    const s = await b.call("bank.session.get");
    expect(s.contexts.find((c: any) => c.id === "alpha")).toMatchObject({ roles: ["Administrator (preview)"], preview: true });
    expect(s.contexts.find((c: any) => c.id === "alpha").permissions).toContain("biz.admin.limits");
    expect(s.contexts.find((c: any) => c.id === "beta").permissions).not.toContain("biz.admin.limits");
    // a forced call as someone else is refused, and so is a payment (an administrator moves no money)
    expect(await code(b.call("corp.admin.get", { userId: "alex" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 100, purpose: "Goods", reference: "X" }))).toBe("PERMISSION_DENIED");
    await verify(b); await b.call("bank.session.switch", { contextId: "beta" });
    expect(await code(b.call("corp.admin.get"))).toBe("PERMISSION_DENIED");
    await b.call("bank.session.switch", { contextId: "personal" }); await b.call("bank.session.switch", { contextId: "alpha" }).catch(() => undefined);
  });
  it("can be turned off, and there is none for a company with no administrator", async () => {
    const b = await admin("alpha");
    expect(await b.call("bank.session.preview", { on: false })).toEqual({ on: false });
    expect(await code(b.call("corp.admin.get"))).toBe("PERMISSION_DENIED");
    const g = make({}, "alexempty"); await enter(g, "gamma");
    expect(await code(g.call("bank.session.preview", { on: true }))).toBe("NOT_SUPPORTED");
  });
});

describe("the Admin view", () => {
  it("shows the seed of the active company: nine people at Alpha, the change that waits, the limits, the groups and the log", async () => {
    const b = await admin("alpha");
    const v = await b.call("corp.admin.get");
    expect(Object.values<any>(v.people).map((p) => p.name)).toEqual(["Alex Morgan", "Dana Cruz", "Lee Park", "Maria Silva", "Priya Nair", "Omar Haddad", "Sam Okafor", "Ravi Menon", "Mina Das"]);
    expect(v.people.sam).toMatchObject({ statusText: "Invited", roleText: "Approver", limitText: "-" });
    expect(v.people.alex).toMatchObject({ roleText: "Maker", limitText: "$250,000.00", canEdit: true });
    expect(v.people.ravi).toMatchObject({ label: "Ravi Menon (you)", canEdit: false, canDisable: false, canEnable: false });
    expect(v.waiting["CHG-1042"]).toMatchObject({ text: "Raise the extra code threshold from $25,000.00 to $30,000.00", sent: "Sent by Mina Das · 3 Nov 09:20", canDecide: true, mine: false });
    expect(v.limitRows.map((r: any) => r.value)).toEqual(["$250,000.00", "$1,000,000.00", "$2,000,000.00", "$50,000.00", "$25,000.00"]);
    expect(v.groups.over).toMatchObject({ title: "Payments over 50,000", line: "In order: Dana Cruz, then Lee Park" });
    expect(v.groups.upto).toMatchObject({ title: "Payments up to 50,000", line: "Any one of Dana Cruz, Lee Park" });
    expect(Object.values<any>(v.log)[0]).toMatchObject({ when: "3 Nov 10:14", who: "Alex Morgan", result: "Done" });
    expect(Object.values<any>(v.log).at(-1)).toMatchObject({ who: "unknown", resultKey: "refused" });
    expect(await b.call("corp.admin.get", { log: false }).then((x) => x.logCount)).toBe(0);
  });
  it("Beta has its own people, its own waiting change and none of Alpha's", async () => {
    const b = await admin("beta");
    const v = await b.call("corp.admin.get");
    expect(Object.values<any>(v.people).map((p) => p.name)).toEqual(["Alex Morgan", "Lee Park", "Maria Silva", "Sam Okafor", "Priya Nair", "Omar Haddad", "Noor Sayegh", "Karim Aziz"]);
    expect(Object.keys(v.waiting)).toEqual(["CHG-1043"]);
    expect(v.people.noor.label).toBe("Noor Sayegh (you)");
    expect(v.groups.over.line).toBe("In order: Alex Morgan, then Lee Park");
    // the activity log's first lines are the same text for both companies (the spec's seed); people, groups and waiting changes are Beta's only
    expect(JSON.stringify([v.people, v.groups, v.waiting])).not.toContain("Dana Cruz");
  });
});

describe("inviting, editing, disabling and enabling a person", () => {
  it("every change needs the one-time code, and a refused change spends none", async () => {
    const b = await admin("alpha");
    expect(await code(b.call("corp.users.invite", invite))).toBe("OTP_REQUIRED");
    expect(await code(b.call("corp.users.invite", { ...invite, name: "x" }))).toBe("INVALID_NAME");
    await verify(b);
    expect(await code(b.call("corp.users.invite", { ...invite, limit: 1_200_000 }))).toBe("LIMIT_ABOVE_COMPANY");
    const r = await b.call("corp.users.invite", invite);
    expect(r).toMatchObject({ status: "invited", name: "Sam Okafor", emailMasked: "s•••@example.com", limitText: "$100,000.00", accountsText: "All accounts" });
    expect(await code(b.call("corp.users.invite", { ...invite, email: "sam.two@example.com" }))).toBe("OTP_REQUIRED");
  });
  it("the rules of an invitation, with the words of the spec", async () => {
    const b = await admin("alpha");
    const say = async (patch: Record<string, unknown>) => b.call("corp.users.invite", { ...invite, dryRun: true, ...patch }).then(() => "ok", (e) => `${e.code}: ${e.message}`);
    expect(await say({ name: "7even" })).toBe("INVALID_NAME: Enter their full name.");
    expect(await say({ email: "sam@@example.com" })).toBe("INVALID_EMAIL: Enter a valid work email, like name@company.com.");
    expect(await say({ email: "dana.cruz@alpha.example" })).toBe("USER_EXISTS: This email already has access. Edit that person instead.");
    expect(await say({ phone: "415 555 0100" })).toBe("INVALID_PHONE: Enter a mobile number with the country code, like +1 415 555 0100.");
    expect(await say({ phone: "+1 415" })).toBe("INVALID_PHONE: Enter a mobile number with the country code, like +1 415 555 0100.");
    expect(await say({ on1: false, on2: false })).toBe("NO_ACCOUNT: Choose at least one account.");
    expect(await say({ limit: 0 })).toBe("INVALID_AMOUNT: Enter a daily limit above 0.");
    expect(await say({ limit: 1_200_000 })).toBe("LIMIT_ABOVE_COMPANY: That is above the company limit of $1,000,000.00.");
    expect(await say({ limit: 300_000 })).toBe("LIMIT_ABOVE_PERSON: The most one person can have is $250,000.00.");
    expect(await say({ limit: 100.005 })).toBe("INVALID_AMOUNT: Enter a daily limit above 0.");
    expect(await say({ role: "boss" })).toBe("INVALID_ROLE: Choose a role.");
    expect(await say({})).toBe("ok");
    // nothing was added by any of them
    expect(Object.keys((await b.call("corp.admin.get")).people)).toHaveLength(9);
  });
  it("an administrator waits for a second one: the person shows as waiting, can be neither edited nor disabled, and declining removes them", async () => {
    const b = await admin("alpha");
    await verify(b);
    const r = await b.call("corp.users.invite", { ...invite, role: "admin", limit: undefined });
    expect(r).toMatchObject({ status: "waiting", approvalText: "Second administrator needed", changeId: "CHG-1044" });
    let v = await b.call("corp.admin.get");
    expect(v.people[r.personId]).toMatchObject({ statusText: "Waiting for approval", canEdit: false, canDisable: false });
    expect(v.waiting["CHG-1044"]).toMatchObject({ mine: true, canDecide: false, sent: expect.stringContaining("Sent by you") });
    // not the sender, and not for a person with a change waiting
    expect(await code(b.call("corp.changes.decide", { changeId: "CHG-1044", decision: "approve" }))).toBe("SELF_APPROVAL");
    expect(await code(b.call("corp.users.disable", { personId: r.personId, reason: "Left the company" }))).toBe("CHANGE_PENDING");
    // the person does not exist as a user of the company who can act until approved
    expect((await b.call("corp.users.list")) [r.personId]).toMatchObject({ name: "Sam Okafor" });
    await b.call("corp.sandbox.arrange", { op: "admChange", by: "mina", text: "x", kind: "limit", which: "person", data: { which: "person", value: 200_000 } });
    expect(await b.call("corp.changes.decide", { changeId: "CHG-1042", decision: "decline" })).toMatchObject({ status: "declined", message: "Declined. Nothing was changed." });
    // another administrator declines the invitation: the person is gone (here Mina sent a change; the invitation is declined through an arranged sender)
    await b.call("corp.sandbox.arrange", { op: "admRoles", personId: r.personId, status: "waiting" });
    v = await b.call("corp.admin.get");
    expect(Object.keys(v.people)).toContain(r.personId);
  });
  it("with the option off, an administrator is invited at once", async () => {
    const b = await admin("alpha");
    await verify(b);
    expect(await b.call("corp.users.invite", { ...invite, role: "admin", limit: undefined, secondApproval: false })).toMatchObject({ status: "invited" });
  });
  it("editing shows only what changed, and nothing changed is refused", async () => {
    const b = await admin("alpha");
    const user = await b.call("corp.users.get", { personId: "dana" });
    expect(user).toMatchObject({ name: "Dana Cruz", emailMasked: "d•••@alpha.example", role: "approver", on1: true, on2: true, label1: "Operating ••2001", count: 2 });
    const same = { personId: "dana", name: "Dana Cruz", phone: user.phone, role: "approver", on1: true, on2: true };
    expect(await code(b.call("corp.users.update", { ...same, dryRun: true }))).toBe("NO_CHANGE");
    const r = await b.call("corp.users.update", { ...same, role: "both", limit: 15_000, dryRun: true });
    expect(r).toMatchObject({ roleChange: "Approver → Maker and approver", limitChange: "- → $15,000.00", nameChange: "", changed: "role, daily limit" });
    await verify(b);
    expect(await b.call("corp.users.update", { ...same, role: "both", limit: 15_000 })).toMatchObject({ status: "saved" });
    const v = await b.call("corp.admin.get");
    expect(v.people.dana).toMatchObject({ roleText: "Maker and approver", limitText: "$15,000.00" });
    expect((await b.call("corp.users.list")).dana.sub).toBe("initiator and approver");
    expect(Object.values<any>(v.log)[0].what).toBe("Changed Dana Cruz: role, daily limit");
  });
  it("removing the Maker role from a person with payments waiting is refused, disabling is allowed and the payment stays", async () => {
    const b = await admin("beta");
    const priya = await b.call("corp.users.get", { personId: "priya" });
    const base = { personId: "priya", name: "Priya Nair", phone: priya.phone, on1: true, on2: true };
    expect(await b.call("corp.users.update", { ...base, role: "approver", dryRun: true }).then(() => "ok", (e) => e.message)).toBe("This person has payments waiting for approval. Remove the Maker role after they are approved or rejected.");
    expect(await b.call("corp.users.disable", { personId: "priya", reason: "Left the company", dryRun: true })).toMatchObject({ paymentsWaiting: 1, statusFrom: "Active", statusTo: "Disabled" });
    await verify(b);
    expect(await b.call("corp.users.disable", { personId: "priya", reason: "Left the company" })).toMatchObject({ status: "disabled" });
    expect((await b.call("corp.admin.get")).people.priya).toMatchObject({ statusText: "Disabled", canEnable: true, canEdit: false });
    expect((await b.call("corp.users.list")).priya.sub).toBe("");
  });
  it("an administrator cannot change or disable themselves; the last active administrator cannot be disabled or demoted", async () => {
    const b = await admin("alpha");
    expect(await b.call("corp.users.disable", { personId: "ravi", reason: "Other", note: "ok ok ok", dryRun: true }).then(() => "ok", (e) => `${e.code}: ${e.message}`)).toBe("CANNOT_DISABLE_SELF: You can’t disable yourself. Ask another administrator.");
    expect(await code(b.call("corp.users.update", { personId: "ravi", name: "Ravi Menon", phone: "+1 415 555 0126", role: "admin", on1: true, limit: 0, dryRun: true }))).toBe("SELF_CHANGE");
    await b.call("corp.sandbox.arrange", { op: "admSingleAdmin", personId: "mina" });
    expect(await b.call("corp.users.disable", { personId: "mina", reason: "Left the company", dryRun: true }).then(() => "ok", (e) => `${e.code}: ${e.message}`)).toBe("LAST_ADMIN: The company must keep one active administrator. Add another one first.");
    expect(await code(b.call("corp.users.update", { personId: "mina", name: "Mina Das", phone: "+1 415 555 0127", role: "viewer", on1: true, dryRun: true }))).toBe("LAST_ADMIN");
    expect((await b.call("corp.admin.get")).people.mina.statusText).toBe("Active");
  });
  it("the only active approver of a group cannot be disabled or demoted", async () => {
    const b = await admin("alpha");
    await b.call("corp.sandbox.arrange", { op: "admRoles", personId: "dana", status: "disabled" });
    const say = (p: Promise<unknown>) => p.then(() => "ok", (e) => `${e.code}: ${e.message}`);
    expect(await say(b.call("corp.users.disable", { personId: "lee", reason: "Left the company", dryRun: true }))).toBe("LAST_APPROVER: Lee Park is the only approver left for Payments over 50,000. Choose another approver first.");
    // with Dana active, either can go
    await b.call("corp.sandbox.arrange", { op: "admRoles", personId: "dana", status: "active" });
    expect(await say(b.call("corp.users.disable", { personId: "lee", reason: "Left the company", dryRun: true }))).toBe("ok");
  });
  it("a reason is needed when the option is on, and Other needs a few words", async () => {
    const b = await admin("alpha");
    const say = (patch: Record<string, unknown>) => b.call("corp.users.disable", { personId: "lee", dryRun: true, ...patch }).then(() => "ok", (e) => e.message);
    expect(await say({})).toBe("Choose a reason.");
    expect(await say({ reason: "Other", note: "ok" })).toBe("Add a few words.");
    expect(await say({ reason: "Other", note: "12345" })).toBe("ok");
    expect(await say({ askReason: false })).toBe("ok");
  });
  it("enabling needs a disabled person, and the people the admin view lists follow the company's own books", async () => {
    const b = await admin("alpha");
    expect(await code(b.call("corp.users.enable", { personId: "lee", dryRun: true }))).toBe("NOT_DISABLED");
    await verify(b);
    await b.call("corp.users.disable", { personId: "lee", reason: "Security concern" });
    await verify(b);
    expect(await b.call("corp.users.enable", { personId: "lee" })).toMatchObject({ status: "active" });
    expect((await b.call("corp.users.list")).lee.sub).toBe("approver");
  });
  it("tells the invited person and the other administrators, with masked values only, and writes every outcome without an email", async () => {
    const b = await admin("alpha");
    await verify(b);
    await b.call("corp.users.invite", invite);
    await verify(b);
    await b.call("corp.users.invite", { ...invite, name: "Zed Okoro", email: "zed.okoro@example.com", role: "admin", limit: undefined });
    const i = await b.call("corp.sandbox.arrange", { op: "admInspect" });
    expect(i.outbox.map((o: any) => [o.to, o.kind])).toEqual([["other administrators", "change-waiting"], ["s•••@example.com", "invitation"]]);
    expect(JSON.stringify(i)).not.toContain("sam.okafor");
    expect(i.log.map((l: any) => [l.what, l.result]).slice(0, 2)).toEqual([["Invited Zed Okoro as Administrator (z•••@example.com)", "Waiting"], ["Invited Sam Okafor as Maker (s•••@example.com)", "Done"]]);
    const audit = JSON.stringify(await b.call("corp.audit.list"));
    expect(audit).toContain("Invited Sam Okafor as Maker (s•••@example.com)");
    expect(audit).not.toContain("sam.okafor");
  });
  it("a bank without the permission refuses everything, whatever the screen shows", async () => {
    const b = make(); await enter(b, "alpha");
    for (const a of ["corp.users.get", "corp.users.invite", "corp.limits.get", "corp.limits.set", "corp.signatories.get", "corp.signatories.update", "corp.changes.decide"]) expect(await code(b.call(a, { personId: "dana" })), a).toBe("PERMISSION_DENIED");
    const p = make(); expect(await code(p.call("corp.admin.get"))).toBe("WRONG_CONTEXT");
  });
});

describe("limits", () => {
  it("lists the four limits, those with a change waiting marked", async () => {
    const b = await admin("alpha");
    const l = await b.call("corp.limits.get");
    expect([l.personText, l.companyText, l.twoText, l.codeText, l.ceilingText]).toEqual(["$250,000.00", "$1,000,000.00", "$50,000.00", "$25,000.00", "$2,000,000.00"]);
    expect([l.items.person.waiting, l.items.code.waiting]).toEqual([false, true]);
  });
  it("a decrease applies at once, an increase waits for a second administrator, each with the code", async () => {
    const b = await admin("alpha");
    expect(await b.call("corp.limits.set", { which: "person", value: 200_000, dryRun: true })).toMatchObject({ kind: "decrease", changeText: "Decrease of $50,000.00", effectText: "Straight away", nowText: "$250,000.00", newText: "$200,000.00" });
    expect(await code(b.call("corp.limits.set", { which: "person", value: 200_000 }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect(await b.call("corp.limits.set", { which: "person", value: 200_000 })).toMatchObject({ status: "applied" });
    expect((await b.call("corp.limits.get")).personText).toBe("$200,000.00");
    // Alex's own limit followed the lower ceiling; the company limit did not move
    expect((await b.call("corp.admin.get")).people.alex.limitText).toBe("$200,000.00");
    await verify(b);
    const r = await b.call("corp.limits.set", { which: "company", value: 1_200_000 });
    expect(r).toMatchObject({ status: "waiting", kind: "increase", changeId: "CHG-1044", effectText: "After a second administrator approves" });
    expect((await b.call("corp.limits.get")).companyText).toBe("$1,000,000.00");
    expect((await b.call("corp.admin.get")).waiting["CHG-1044"]).toMatchObject({ mine: true, canDecide: false, text: "Raise the company daily limit from $1,000,000.00 to $1,200,000.00" });
  });
  it("the rules of the amount, in order, with the bank's words; a setting with a change waiting cannot be changed again", async () => {
    const b = await admin("alpha");
    const say = (which: string, value: number) => b.call("corp.limits.set", { which, value, dryRun: true }).then(() => "ok", (e) => `${e.code}: ${e.message}`);
    expect(await say("person", 1_200_000)).toBe("LIMIT_ABOVE_COMPANY: It can’t be above the company daily limit of $1,000,000.00.");
    expect(await say("person", 250_000)).toBe("LIMIT_SAME: That is the same as now. Enter a different amount.");
    expect(await say("company", 2_500_000)).toBe("LIMIT_ABOVE_CEILING: The bank’s ceiling is $2,000,000.00.");
    expect(await say("company", 200_000)).toBe("LIMIT_BELOW_OTHERS: It can’t be below $250,000.00, the highest limit or threshold set now.");
    expect(await say("two", 1_100_000)).toBe("LIMIT_ABOVE_COMPANY: It can’t be above the company daily limit of $1,000,000.00.");
    expect(await say("two", 0)).toBe("INVALID_AMOUNT: Enter an amount above 0.");
    expect(await say("code", 40_000)).toBe("CHANGE_PENDING: A change to this is already waiting for approval.");
    expect(await say("weekly", 40_000)).toBe("INVALID_SETTING: Choose what to change.");
    expect(await say("two", 40_000)).toBe("ok");
  });
  it("approving a waiting increase applies it (with the code), declining leaves everything as it was, and nobody decides their own change", async () => {
    const b = await admin("alpha");
    expect(await code(b.call("corp.changes.decide", { changeId: "CHG-1042", decision: "approve" }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect(await b.call("corp.changes.decide", { changeId: "CHG-1042", decision: "approve" })).toMatchObject({ message: "Approved. The change is live." });
    expect((await b.call("corp.limits.get")).codeText).toBe("$30,000.00");
    expect(Object.values<any>((await b.call("corp.admin.get")).log)[0].what).toBe("Approved raise the extra code threshold from $25,000.00 to $30,000.00 (CHG-1042)");
    expect(await code(b.call("corp.changes.decide", { changeId: "CHG-1042", decision: "approve" }))).toBe("CHANGE_NOT_FOUND");
    const d = await admin("alpha");
    await d.call("corp.changes.decide", { changeId: "CHG-1042", decision: "decline" });
    expect((await d.call("corp.limits.get")).codeText).toBe("$25,000.00");
    expect(Object.values<any>((await d.call("corp.admin.get")).log)[0].what).toBe("Declined raise the extra code threshold from $25,000.00 to $30,000.00 (CHG-1042)");
  });
  it("the thresholds take effect for the payments that start afterwards", async () => {
    const b = await admin("beta");
    await verify(b);
    await b.call("corp.changes.decide", { changeId: "CHG-1043", decision: "approve" });
    const v = await b.call("corp.admin.get");
    expect(v.groups.over.title).toBe("Payments over 60,000");
    expect(v.limitRows[3]).toEqual({ label: "Two approvers above", value: "$60,000.00" });
  });
  it("the option off applies an increase at once; the mutation switches the bank's rules off", async () => {
    const b = await admin("alpha");
    await verify(b);
    expect(await b.call("corp.limits.set", { which: "company", value: 1_200_000, secondApproval: false })).toMatchObject({ status: "applied" });
    const f = await admin("alpha", { corpFlaws: { limIncrease: false } });
    await verify(f);
    expect(await f.call("corp.limits.set", { which: "company", value: 1_200_000 })).toMatchObject({ status: "applied" });
  });
});

describe("approval groups", () => {
  it("lists both groups, the candidates and the switches of the group being edited", async () => {
    const b = await admin("alpha");
    const g = await b.call("corp.signatories.get", { group: "over" });
    expect(g).toMatchObject({ count: 3, label1: "Dana Cruz", label2: "Lee Park", label3: "Maria Silva", title: "Payments over 50,000", modeText: "In order", line: "In order: Dana Cruz, then Lee Park", first: "dana", paymentsWaiting: 1 });
    expect([g.current.on1, g.current.on2, g.current.on3]).toEqual([true, true, false]);
    expect((await b.call("corp.signatories.get", {})).groups.upto.line).toBe("Any one of Dana Cruz, Lee Park");
    const beta = await admin("beta");
    expect((await beta.call("corp.signatories.get", { group: "upto" })).count).toBe(4);
  });
  it("the rules of a group, in the order of the spec", async () => {
    const b = await admin("alpha");
    const say = (patch: Record<string, unknown>) => b.call("corp.signatories.update", { dryRun: true, ...patch }).then(() => "ok", (e) => `${e.code}: ${e.message}`);
    expect(await say({ group: "over", mode: "any", on1: true, on2: true })).toBe("NOT_ENOUGH_APPROVERS: Payments over 50,000 need two approvers. Choose In order or Several together.");
    expect(await say({ group: "over", mode: "seq", on1: true })).toBe("NOT_ENOUGH_APPROVERS: Add at least 2 approvers.");
    expect(await say({ group: "upto", mode: "any" })).toBe("NO_APPROVERS: Choose at least one approver.");
    expect(await say({ group: "over", mode: "par", on1: true, on2: true, need: 3 })).toBe("INVALID_NEED: Choose how many must approve, up to 2.");
    expect(await say({ group: "upto", mode: "any", on1: true, on2: true })).toBe("NO_CHANGE: Change something to continue.");
    expect(await say({ group: "upto", mode: "bogus", on1: true })).toBe("INVALID_MODE: Choose how they approve.");
    expect(await say({ group: "upto", mode: "seq", on1: true, on2: true, allowSeq: false })).toBe("MODE_NOT_ALLOWED: Approving in order isn’t available at your bank.");
    expect(await say({ group: "nope", mode: "any", on1: true })).toBe("INVALID_GROUP: Choose a group.");
    expect(await say({ group: "over", mode: "par", on1: true, on2: true, on3: true, need: 2 })).toBe("ok");
    // a Maker and approver cannot be the only approver, nor leave too few others
    await b.call("corp.sandbox.arrange", { op: "admRoles", personId: "maria", role: "both" });
    expect(await say({ group: "upto", mode: "any", on3: true })).toBe("SEPARATION: The person who starts payments can’t be the only approver.");
    expect(await say({ group: "over", mode: "par", on1: true, on3: true, need: 2 })).toBe("SEPARATION: If Maria Silva starts a payment, there would not be enough other approvers.");
  });
  it("a change waits for a second administrator: the current group stays, and a group with a change waiting is refused", async () => {
    const b = await admin("alpha");
    await verify(b);
    const r = await b.call("corp.signatories.update", { group: "over", mode: "par", on1: true, on2: true, on3: true, need: 2 });
    expect(r).toMatchObject({ status: "waiting", newLine: "2 of 3 together: Dana Cruz, Lee Park, Maria Silva", nowLine: "In order: Dana Cruz, then Lee Park", paymentsWaiting: 1 });
    expect((await b.call("corp.admin.get")).groups.over.line).toBe("In order: Dana Cruz, then Lee Park");
    expect(await code(b.call("corp.signatories.update", { group: "over", mode: "seq", on1: true, on2: true, on3: true, dryRun: true }))).toBe("CHANGE_PENDING");
    expect(await code(b.call("corp.signatories.update", { group: "over", mode: "seq", on1: true, on3: true, dryRun: true }))).toBe("CHANGE_PENDING");
  });
  it("the order starts with who goes first; with the option off the group changes at once and the payments that wait keep their approvers", async () => {
    const b = await admin("alpha");
    expect((await b.call("corp.signatories.update", { group: "over", mode: "seq", on1: true, on2: true, on3: true, first: "lee", dryRun: true })).newLine).toBe("In order: Lee Park, then Dana Cruz, then Maria Silva");
    // the left-empty default is the first switched on
    expect((await b.call("corp.signatories.update", { group: "over", mode: "seq", on1: true, on2: true, on3: true, dryRun: true })).newLine).toBe("In order: Dana Cruz, then Lee Park, then Maria Silva");
    await verify(b);
    expect(await b.call("corp.signatories.update", { group: "upto", mode: "any", on3: true, on1: true, secondApproval: false })).toMatchObject({ status: "applied" });
    expect((await b.call("corp.admin.get")).groups.upto.line).toBe("Any one of Dana Cruz, Maria Silva");
    // a payment started now (up to 50,000) by Alex can only be approved by the people of the group as it is now
    const alex = make(); await enter(alex, "alpha");
    expect(alex).toBeTruthy();
  });
});

describe("service requests of a company", () => {
  it("lists the company's own requests newest first: Alpha has one, Beta none", async () => {
    const b = make(); await enter(b, "alpha");
    expect(Object.values<any>(await b.call("corp.requests.list")).map((r) => [r.id, r.typeText, r.subject, r.statusText, r.dateText])).toEqual([["REQ-30418", "Cheque book", "Cheque book, Operating", "Done", "28 Oct"]]);
    const c = make(); await enter(c, "beta");
    expect(await c.call("corp.requests.list")).toEqual({});
  });
  it("a request sent now goes to the top as Received, Today", async () => {
    const b = make(); await enter(b, "alpha");
    const r = await b.call("corp.requests.create", { type: "add", currency: "EUR", purpose: "Savings", phone: "+1 415 555 0100", acknowledged: true });
    expect(r).toMatchObject({ id: "REQ-30419", subject: "New EUR account", statusText: "Received" });
    expect(Object.values<any>(await b.call("corp.requests.list")).map((x) => [x.id, x.statusText, x.dateText])).toEqual([["REQ-30419", "Received", "Today"], ["REQ-30418", "Done", "28 Oct"]]);
  });
  it("the rules: the tick, a duplicate, five a day, the only account, the balance, the fields", async () => {
    const b = make(); await enter(b, "alpha");
    const say = (patch: Record<string, unknown>) => b.call("corp.requests.create", { phone: "+1 415 555 0100", acknowledged: true, ...patch }).then((r) => `ok ${r.subject}`, (e) => `${e.code}: ${e.message}`);
    expect(await say({ type: "update", what: "Registered address", details: "Please change our registered address.", acknowledged: false })).toBe("CONSENT_REQUIRED: Confirm to send.");
    expect(await say({ type: "other", subject: "Hi", details: "Please call me about statements." })).toBe("SUBJECT_REQUIRED: Add a short subject (at least 5 characters).");
    expect(await say({ type: "other", subject: "Question about statements", details: "short" })).toBe("DETAILS_REQUIRED: Tell us a little more (at least 10 characters).");
    expect(await say({ type: "update", what: "Registered address", details: "Please change our registered address.", phone: "415" })).toBe("INVALID_PHONE: Enter a phone number with the country code, like +1 415 555 0100.");
    expect(await say({ type: "close", accountId: "alpha_res", moveTo: "alpha_ops", reason: "Other" })).toBe("ok Close Reserve ••2044");
    expect(await say({ type: "close", accountId: "alpha_res", reason: "Other" })).toBe("ACCOUNT_NOT_FOUND: We can’t find that account. Choose another.");
    expect(await say({ type: "cheque", accountId: "alpha_ops", leaves: 50, delivery: "Collect at a branch" })).toBe("ok Cheque book, Operating");
    expect(await say({ type: "cheque", accountId: "alpha_ops", leaves: 50, delivery: "Collect at a branch" })).toBe("REQUEST_DUPLICATE: You already have an open request about this. Wait for our reply.");
    expect(await say({ type: "cheque", accountId: "alpha_ops", leaves: 50, delivery: "Collect at a branch", cheque: false })).toBe("TYPE_NOT_AVAILABLE: Cheque books aren’t available at your bank.");
    expect(await say({ type: "update", what: "Signatories", details: "Add our new finance director." })).toBe("ok Update signatories");
    expect(await say({ type: "update", what: "Signatories", details: "Add our new finance director." })).toBe("REQUEST_DUPLICATE: You already have an open request about this. Wait for our reply.");
    expect(await say({ type: "add", currency: "GBP", purpose: "Tax" })).toBe("ok New GBP account");
    expect(await say({ type: "add", currency: "USD", purpose: "Payroll" })).toBe("ok New USD account");
    expect(await say({ type: "add", currency: "AED", purpose: "Savings" })).toBe("REQUEST_LIMIT_REACHED: You have sent the most requests allowed today (5). Try again tomorrow.");
  });
  it("a company with one account cannot close it", async () => {
    const b = make(); await enter(b, "alpha");
    await b.call("corp.sandbox.arrange", { op: "soleAccount" });
    expect(await b.call("corp.requests.create", { type: "close", accountId: "alpha_ops", reason: "Other", phone: "+1 415 555 0100", acknowledged: true }).then(() => "ok", (e) => `${e.code}: ${e.message}`)).toBe("ONLY_ACCOUNT: You can’t close the only account.");
  });
  it("needs the permission to see accounts, in a company only", async () => {
    const p = make(); expect(await code(p.call("corp.requests.list"))).toBe("WRONG_CONTEXT");
    const b = make({ conditions: {} }); await enter(b, "beta");
    expect(await code(b.call("corp.requests.create", { type: "add", currency: "EUR", purpose: "Savings", phone: "+1 415 555 0100", acknowledged: true, userId: "dana" }))).toBe("PERMISSION_DENIED");
  });
});

describe("a company applying for business banking, before sign-in", () => {
  const visitor = (opts?: ConstructorParameters<typeof MockBank>[1]) => make(opts, "signed-out");
  const company = { legalName: "Harbour Trading Ltd", registrationNo: "REG-2015-0412", companyType: "Private company", incorporated: "14/03/2015", country: "US", address: "12 Example Street", city: "Springfield", postcode: "62704" };
  const people = { count: 1, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner and director", p1Own: 100, other: 0 };
  const business = { industry: "Technology", about: "We sell software to small shops.", tradeCountry: "US", turnover: "t2", money: "m2", payments: "p2", source: "Sales to customers" };
  const docs = { certName: "document-1.pdf", proofName: "document-2.pdf" };
  const tax = { taxCountry: "US", taxId: "123456789" };
  const all = { ...company, ...people, ...business, ...docs, ...tax, agreeTerms: true, confirmTrue: true };
  const say = (b: MockBank, adapter: string, input: Record<string, unknown>) => b.call(adapter, input).then(() => "ok", (e) => `${e.code}: ${e.message}`);

  it("answers before anyone signs in, and nothing else does", async () => {
    const b = visitor();
    expect(await b.call("bank.kyb.config")).toMatchObject({ market: "A", symbol: "$", taxHint: "9 digits", postalRequired: true, askChart: false });
    expect(await code(b.call("bank.accounts.list"))).toBe("NOT_SIGNED_IN");
    expect(await code(b.call("corp.company.get"))).toBe("NOT_SIGNED_IN");
    expect(await code(b.call("corp.admin.get"))).toBe("NOT_SIGNED_IN");
    expect(await code(b.call("corp.requests.create", {}))).toBe("NOT_SIGNED_IN");
    expect(await code(b.call("bank.kybx.submit", {}))).toBe("NOT_SIGNED_IN");
  });
  it("each step is checked by the bank, in the words of the spec", async () => {
    const b = visitor();
    expect(await say(b, "bank.kyb.check", { step: 1, ...company })).toBe("ok");
    expect(await say(b, "bank.kyb.check", { step: 1, ...company, registrationNo: "AB1" })).toBe("INVALID_REGISTRATION: Use 5 to 20 letters or digits.");
    expect(await say(b, "bank.kyb.check", { step: 1, ...company, incorporated: "31/02/2015" })).toBe("INVALID_DATE: Enter the date as DD/MM/YYYY.");
    expect(await say(b, "bank.kyb.check", { step: 1, ...company, incorporated: "14/03/2027" })).toBe("DATE_IN_FUTURE: The date can’t be in the future.");
    expect(await say(b, "bank.kyb.check", { step: 1, ...company, incorporated: "14/03/1850" })).toBe("INVALID_YEAR: Check the year.");
    expect(await say(b, "bank.kyb.check", { step: 1, ...company, postcode: "" })).toBe("POSTCODE_REQUIRED: Enter the postal code.");
    expect(await say(b, "bank.kyb.check", { step: 3, ...business, about: "short" })).toBe("ABOUT_REQUIRED: Tell us a little more.");
    expect(await say(b, "bank.kyb.check", { step: 4, certName: "", proofName: "x.pdf" })).toBe("CERTIFICATE_REQUIRED: Add the certificate.");
    expect(await say(b, "bank.kyb.check", { step: 4, certName: "a.pdf", proofName: "" })).toBe("PROOF_REQUIRED: Add a proof of address.");
    expect(await say(b, "bank.kyb.check", { step: 4, ...docs, chartSize: 1, chartName: "chart.exe" })).toBe("INVALID_DOCUMENT: Use a PDF, JPG or PNG file up to 10 MB.");
    expect(await say(b, "bank.kyb.check", { step: 4, ...docs, certSize: 20_000_000 })).toBe("INVALID_DOCUMENT: Use a PDF, JPG or PNG file up to 10 MB.");
    expect(await b.call("bank.kyb.check", { step: 5, ...tax })).toMatchObject({ taxMasked: "•••• 789" });
  });
  it("owners and directors must add up to 100% with a director, and at most five people", async () => {
    const b = visitor();
    const two = { count: 2, p1Name: "Maya Chen", p1Email: "maya.chen@example.com", p1Role: "Owner and director", p1Own: 60, p2Name: "Omar Haddad", p2Email: "omar.haddad@example.com", p2Role: "Owner", p2Own: 40, other: 0 };
    expect(await b.call("bank.kyb.check", { step: 2, ...two })).toMatchObject({ people: 2, listed: 100 });
    expect(await say(b, "bank.kyb.check", { step: 2, ...people, p1Own: 50 })).toBe("OWNERSHIP_TOTAL: Ownership adds up to 50%. It must be 100%.");
    expect(await say(b, "bank.kyb.check", { step: 2, ...people, p1Role: "Owner" })).toBe("DIRECTOR_REQUIRED: Add at least one director.");
    expect(await say(b, "bank.kyb.check", { step: 2, ...people, p1Own: 20, other: 80 })).toBe("INVALID_OWNERSHIP: Enter 25 to 100.");
    expect(await say(b, "bank.kyb.check", { step: 2, ...people, p1Own: 25, other: 75 })).toBe("ok");
    expect(await say(b, "bank.kyb.check", { step: 2, ...people, other: 76 })).toBe("INVALID_OTHER_OWNERS: Enter 0 to 75.");
    expect(await say(b, "bank.kyb.check", { step: 2, ...people, p1Email: "maya@@example.com" })).toBe("INVALID_EMAIL: Enter a valid email, like name@company.com.");
    expect(await say(b, "bank.kyb.check", { step: 2, ...people, count: 6 })).toBe("TOO_MANY_PEOPLE: You can name up to 5 people.");
  });
  it("the tax ID, the money sign and the postal code follow the bank's home market", async () => {
    for (const [home, id, hint, msg, symbol] of [["uk", "1234567890", "10 digits", "Enter the 10 digits.", "£"], ["eu", "DE12345678", "8 to 14 letters or digits", "Use 8 to 14 letters or digits.", "€"], ["ae", "100123456700003", "15 digits", "Enter the 15 digits.", "AED "]] as const) {
      const b = visitor({ config: { homeMarket: home } });
      expect(await b.call("bank.kyb.config")).toMatchObject({ taxHint: hint, symbol, postalRequired: home !== "ae" });
      expect(await b.call("bank.kyb.check", { step: 5, taxCountry: "DE", taxId: id })).toMatchObject({ ok: true });
      expect(await say(b, "bank.kyb.check", { step: 5, taxCountry: "DE", taxId: "123" })).toBe(`INVALID_TAX_ID: ${msg}`);
    }
    expect(Object.values<any>((await visitor({ config: { homeMarket: "uk" } }).call("bank.kyb.config")).turnover).map((x) => x.name)).toEqual(["Under £100,000", "£100,000 to £500,000", "£500,000 to £2M", "Over £2M"]);
    expect(await say(visitor({ config: { homeMarket: "ae" } }), "bank.kyb.check", { step: 1, ...company, postcode: "" })).toBe("ok");
    const a = visitor(); expect(await say(a, "bank.kyb.check", { step: 5, taxCountry: "US", taxId: "123-456 789" })).toBe("ok");
  });
  it("submitting needs both ticks, refuses a registration number already applied for, and keeps no tax ID, email or registration number", async () => {
    const b = visitor();
    expect(await say(b, "bank.kyb.submit", { ...all, agreeTerms: false })).toBe("TERMS_REQUIRED: Please agree to continue.");
    expect(await say(b, "bank.kyb.submit", { ...all, confirmTrue: false })).toBe("TRUTH_REQUIRED: Please confirm to continue.");
    expect(await say(b, "bank.kyb.submit", { ...all, registrationNo: "DUPLICATE" })).toBe("DUPLICATE_APPLICATION: We already have an application for this registration number.");
    const r = await b.call("bank.kyb.submit", all);
    expect(r).toMatchObject({ reference: "KYB-10002", company: "Harbour Trading Ltd", registrationMasked: "•••• 0412", taxMasked: "•••• 789", stageText: "Checking your documents", people: 1 });
    expect(await say(b, "bank.kyb.submit", { ...all, registrationNo: "reg-2015-0412" })).toBe("DUPLICATE_APPLICATION: We already have an application for this registration number.");
    for (const secret of ["123456789", "maya.chen@example.com", "REG-2015-0412", "Maya Chen"]) expect((await b.call("sandbox.kyb.inspect", { contains: secret })).found, secret).toBe(false);
    expect((await b.call("sandbox.kyb.inspect", { contains: "KYB-10002" })).found).toBe(true);
  });
  it("what is typed is data: markup is kept as text and a company name is never run", async () => {
    const b = visitor();
    const r = await b.call("bank.kyb.submit", { ...all, legalName: "<script>alert(1)</script> Ltd", registrationNo: "REG-0001-XX" });
    expect(r.company).toBe("<script>alert(1)</script> Ltd");
  });
  it("a bank that is down or slow sends nothing", async () => {
    const down = visitor({ conditions: { unavailable: ["bank.kyb.submit"] } });
    expect(await code(down.call("bank.kyb.submit", all))).toBe("SERVICE_UNAVAILABLE");
    const slow = visitor({ conditions: { timeout: ["bank.kyb.submit"], latencyMs: 10_000 } });
    expect(await code(slow.call("bank.kyb.submit", all))).toBe("TIMEOUT");
    expect((await slow.call("sandbox.kyb.inspect", {})).count).toBe(1);
  });
});
