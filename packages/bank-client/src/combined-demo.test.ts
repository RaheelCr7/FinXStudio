import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { JourneyRunner, type View } from "@finx/renderer-core";
import { ALPHA, MockBank, personas, type CorpCompany, type ProviderId } from "@finx/mock-bank-api";
import { BankApp, createLive, journeyAllowed, launchFromValues, linkContext, menuFor, parseLink, roleBadge, stepUpValid, type TabId } from "./index";

/**
 * The combined Alex Morgan demo, end to end: one sign-in, a personal relationship, a Maker role at Alpha Trading LLC and an Approver
 * role at Beta Services Ltd (spec: docs/journeys/02-sme.md, "The combined Alex Morgan demo"; the table in this file's E-n names are the spec's).
 *
 * It drives `BankApp` and runs the three journeys with `JourneyRunner` against `app.adapter`, the way the web player does (the journey is
 * only started when `journeyAllowed` says the place may use it; the runner gets `session.permissions` of the active place). Nothing is drawn.
 *
 * How this differs from the 13 steps as the spec proposed them (they were proposals; the real code decides):
 *  - Clock: the sandbox clock is pinned to Wed 4 Nov 2026 10:00 UTC (before the 16:00 cut-off), as the sandbox's own identity tests do. Nothing here
 *    reads the date or the wall clock; the five-minute step-up is moved with the same clock.
 *  - Step 1: BankApp has no user name field: the sign-in screen picks the sandbox customer (`alex`) and `login()` opens the app. The password
 *    `Bwx!Demo2026` is what the step-up asks for, and `482100` is the code. "One sign-in" is proved by one `login()` call and one sandbox (the same
 *    `app.bank`) from the first step to the last.
 *  - Step 3: the saved BankWorkx payee of the real seed is Taylor Brooks (not "Maria Lopez"), and the journey is `personal-transfer`.
 *  - Ids are the sandbox's own `PAY-xxxx` ids (the new Alpha payment is PAY-2042), and payments are read through the company context.
 *  - Step 5: the purpose is "Goods" (the sandbox's list); the seed already has Alex's PAY-2040 waiting at Alpha (18,900.00 used of his day), so his used
 *    amount is 31,400.00 after the payment.
 *  - Step 6: the audit trail of Alpha needs `biz.audit.view`, which a Maker does not hold, so the two Refused rows are read from the sandbox itself.
 *  - Step 8/9: Beta has TWO payments waiting for Alex (PAY-2039 of 64,500.00 after Lee, and PAY-2041 of 8,200.00), not one; he approves PAY-2041 and the
 *    release reference is CORP-20261103-2041 (it carries the payment's own value date).
 *  - Step 3 (Activity): the sandbox does not record a Personal payment in Activity, so that assertion is an `it.fails` case at the end of the file.
 *  - Step 12: the sandbox does not raise a notification when a colleague starts a payment (also an `it.fails` case). The seeded notice for Beta
 *    (n_1) is the one that is tapped, and a notice from another place shows "New activity" tagged with the company name, not the spec's title.
 *    The sheet's wording is the web app's ("Switch to Beta Services Ltd?"), not "This belongs to ...". Omar's payment is made on the Beta books
 *    directly (a test back door the app does not have).
 *  - Step 13: `logout()` makes a fresh sandbox for the next sign-in screen, so "SESSION_EXPIRED" is asserted on the sandbox that was signed in and on the
 *    `adapter` handle a journey still open would hold (found by this test: they kept working before; `logout()` now ends the old session).
 *  - E-2/E-14: the shell now closes the step-up sheet on the third wrong code ("Too many wrong codes. Start again.") and says "We couldn't switch. You are
 *    still in {place}. Try again." when the bank does not answer; both were in the shell spec and not built.
 *  - E-16: identity companies honour `corpProvider` (they always used the reference bank before); Bank B got what the demo's companies need (see the
 *    pull request). Visible results are compared with the reference bank's, with each bank's own payment numbering taken out.
 */

const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
const PASSWORD = "Bwx!Demo2026", CODE = "482100";
const NOW = Date.parse("2026-11-04T10:00:00Z"), MIN = 60_000;
/**
 * The strings that must never be seen in Personal: the companies, their suppliers, invoices, amounts, release references and account ids.
 * The money formatter drops ".00" on whole amounts ("$12,500"), so the amounts are also searched without decimals.
 */
const BANNED = ["Alpha Trading", "Beta Services", "Harbour Packaging", "Nimbus Logistics", "INV-1042", "INV-2291", "12,500.00", "8,200.00", "12,500", "8,200", "CORP-", "beta_ops", "alpha_ops"];
/** What a notice from another place may still carry: the company's name as its tag, nothing else of it. */
const BANNED_IN_NOTICES = BANNED.filter((s) => !/^(Alpha Trading|Beta Services)$/.test(s));

type World = { app: BankApp; clock: { t: number }; advance: (ms: number) => void };
/** An app on the BankWorkx look with a pinned sandbox clock. `bankApi` picks the corporate bank API behind the companies. */
function world(extra: Record<string, unknown> = {}): World {
  const clock = { t: NOW };
  const app = new BankApp({ preset: "bankworkx", live: createLive({ brand: "bankworkx", fetch: down }), studioUrl: "http://studio", toastMs: 20, ...extra });
  return { app, clock, advance: (ms) => { clock.t += ms; } };
}
const pin = (w: World) => { w.app.bank.now = () => w.clock.t; };

/** The sign-in screen picks the customer, the sandbox clock is pinned, and the app opens with its session loaded. */
async function signIn(w: World, personaId = "alex") {
  w.app.selectPersona(personaId); // a fresh sandbox for this customer, as the sign-in screen makes
  pin(w);
  w.app.login();
  await w.app.loadSession();
}
const verifyCode = async (app: BankApp) => { await app.bank.call("bank.otp.send"); await app.bank.call("bank.otp.verify", { code: CODE }); };

/** Moves to a place the way the shell does: a step-up (password, then code) when the bank asks for one. */
async function switchTo(w: World, contextId: string, opts: { code?: string; password?: string } = {}) {
  const first = await w.app.switchContext(contextId);
  if (first !== "step-up") return first;
  await w.app.beginStepUp({ secret: opts.password ?? PASSWORD });
  await w.app.confirmStepUp(opts.code ?? CODE);
  return w.app.getState().session.info?.activeContextId === contextId ? "switched" : "step-up";
}
const activeId = (app: BankApp) => app.getState().session.info?.activeContextId;

// ---- walking a journey ------------------------------------------------------------------------------------------------
/** Every string a view shows (title, labels, text, row values, table cells, chips), for "is this on the screen". */
function visible(view: View): string[] {
  const out: string[] = [view.title];
  const walk = (v: unknown) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(view.blocks);
  return out;
}
class Walk {
  constructor(public runner: JourneyRunner) {}
  get view() { return this.runner.view(); }
  get current() { return this.runner.current; }
  get(path: string) { return this.runner.get(path); }
  set(values: Record<string, unknown>) { for (const [k, v] of Object.entries(values)) this.runner.set(k, v); }
  /** Presses a button, a row of a menu or the row of a table (by its key) with that label. */
  async press(label: string) {
    const shown = this.view.blocks as any[];
    const rows = [
      ...shown.filter((b) => b.type === "menu" || b.type === "shortcuts").flatMap((b) => (b.items ?? []).map((i: any) => ({ label: i.label, actions: i.actions }))),
      ...shown.filter((b) => b.type === "dataTable").flatMap((b) => (b.rows ?? []).filter((r: any) => r.actions?.length).map((r: any) => ({ label: r.id, actions: r.actions }))),
    ];
    const all = [...shown.filter((b) => b.type === "button").map((b) => ({ label: b.label, actions: b.actions })), ...rows];
    const hit = all.find((b) => String(b.label).trim().toLowerCase() === label.trim().toLowerCase());
    if (!hit) throw new Error(`No "${label}" on screen "${this.current}". There: ${all.map((b) => `"${b.label}"`).join(", ") || "nothing"}`);
    await this.runner.press(hit.actions);
  }
  screen(id: string) { expect(this.current, `on screen ${this.current}, wanted ${id}`).toBe(id); }
  has(text: string) { return visible(this.view).some((s) => s.includes(text)); }
  text(...texts: string[]) { for (const t of texts) expect(this.has(t), `"${t}" is on screen "${this.current}" (there: ${visible(this.view).slice(0, 14).join(" | ")})`).toBe(true); }
  noText(...texts: string[]) { for (const t of texts) expect(this.has(t), `"${t}" is not on screen "${this.current}"`).toBe(false); }
}
/** Opens a journey as the web player does: refused unless the active place may use it; the runner gets the place's permissions. */
async function runJourney(app: BankApp, slug: string, values: Record<string, string> = {}) {
  const ctx = app.context!;
  const st = app.getState();
  expect(journeyAllowed(slug, { context: ctx, entries: st.catalog.entries, settings: st.session.settings }), `${slug} is offered in ${ctx.label}`).toBe(true);
  const live = (await app.fetchJourney(slug))!;
  expect(live, `${slug} can be loaded`).toBeTruthy();
  const runner = new JourneyRunner(live.journey, { adapter: app.adapter, lang: "en", launch: launchFromValues(slug, values), session: { permissions: ctx.permissions } });
  await runner.start();
  return new Walk(runner);
}

// ---- reading the sandbox -----------------------------------------------------------------------------------------------
/** What the sandbox says, read through the active place (a payment is always read through its company: both companies number from PAY-2042). */
const payment = (app: BankApp, id: string) => app.bank.call("corp.payments.get", { paymentId: id });
const company = (app: BankApp) => app.bank.call("corp.company.get");
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => (e as { code: string }).code);
/** The audit trail of a company as the sandbox holds it (the Maker role may not read it through the bank, so the test looks inside). */
const auditOf = (bank: MockBank, id: string): { userId: string; action: string; outcome: string }[] => (bank as any).business.audit.get(id) ?? [];
const providerOf = (bank: MockBank, id: string): any => (bank as any).providers.get(id);

/** Every Personal screen and the raw answers behind them, as JSON, for the "no company data in Personal" check. Notices are kept apart (they may carry a company's name as their tag). */
async function serialisedViews(app: BankApp) {
  const ctx = app.context!;
  const tabs = menuFor(ctx).filter((m) => m.allowed).map((m) => m.id);
  for (const t of tabs) await app.loadShell(t, true);
  await app.loadNotices(true);
  const adapters: [string, Record<string, unknown>?][] = ctx.workspace === "personal"
    ? [["bank.accounts.list"], ["bank.activity.list"], ["bank.transactions.list", { accountId: "acc_main" }], ["bank.beneficiaries.list"], ["bank.schedules.list", { status: "live" }], ["bank.limits.get"], ["bank.messages.list"], ["bank.requests.list"], ["bank.cards.issued"]]
    : [["corp.company.get"], ["corp.payments.pending"], ["corp.suppliers.list"], ["corp.templates.list"]];
  const raw: Record<string, unknown> = {};
  for (const [a, input] of adapters) raw[a] = await app.bank.call(a, input ?? {});
  const screens = JSON.stringify({ tabs, views: Object.entries(app.getState().views).filter(([k]) => !k.endsWith(":notices")).map(([, v]) => v), raw });
  const notices = JSON.stringify(app.notices());
  return { screens, notices, all: screens + notices };
}
const found = (json: string, words: string[]) => words.filter((w) => json.includes(w));
/** The whole app state as JSON, without the context list (the selector) and the notices (their tag is the company's name, which is allowed). */
const stateWithoutNotices = (app: BankApp) => JSON.stringify({ ...app.getState(), session: undefined, views: Object.fromEntries(Object.entries(app.getState().views).filter(([k]) => !k.endsWith(":notices"))) });

afterEach(() => vi.useRealTimers());

// =========================================================================================================================
describe("E-1: the whole script runs in order, with one sign-in", () => {
  it("passes the 13 steps", async () => {
    const w = world();
    const { app } = w;
    const login = vi.spyOn(app, "login");
    /** What the business screens showed, kept so the "no company data" check is proved able to fail (every banned string is seen somewhere in Business). */
    let seenInBusiness = "";

    // ---- Step 1: sign in once
    await signIn(w);
    const bank = app.bank;
    expect(app.getState().screen).toBe("app");
    const session = await app.bank.call("bank.session.get");
    expect(session.contexts.map((c: any) => [c.id, c.workspace, c.roles])).toEqual([["personal", "personal", []], ["alpha", "business", ["Maker"]], ["beta", "business", ["Approver"]]]);
    expect(session.activeContextId).toBe("personal");
    expect(app.getState().workspace).toBe("personal");
    expect(login).toHaveBeenCalledTimes(1);

    // ---- Step 2: the Personal home
    const home = await serialisedViews(app);
    expect(app.view<any>("home")!.data!.hero.value).toBe("$23,975.13");
    const accounts = app.view<any>("accounts")!.data!.sections[0].rows;
    expect(accounts.find((r: any) => r.title === "Main")).toMatchObject({ subtitle: "••4410 · USD", value: "$8,720.76" });
    expect(accounts.find((r: any) => r.title === "Savings")).toMatchObject({ subtitle: "••7731 · USD", value: "$15,254.37" });
    expect(app.context!.label).toBe("Personal");
    expect(roleBadge(app.context)).toBe("");
    expect(found(home.screens, ["Alpha", "Beta"]), "no company name in any Personal screen").toEqual([]);

    // ---- Step 3: a personal transfer, 250.00 from Main to Taylor Brooks
    {
      const j = await runJourney(app, "personal-transfer");
      j.screen("type");
      await j.press("To a BankWorkx® customer"); await j.press("Taylor Brooks");
      j.screen("amount"); j.text("Taylor Brooks");
      j.set({ "pt.amount": 250 }); await j.press("Continue");
      j.screen("review"); j.text("Instant", "Free");
      j.set({ "pt.consent": true }); await j.press("Confirm and send code");
      j.text("Authorise $250.00 to Taylor Brooks");
      j.set({ "otp.code": CODE }); await j.press("Send $250.00");
      j.screen("result"); j.text("Sent");
      app.bump();
    }
    {
      const acc = await app.bank.call("bank.accounts.list");
      expect(acc.acc_main.balance).toBe(8470.76);
      expect(acc.acc_save.balance).toBe(15254.37);
      expect((await app.bank.call("bank.limits.get")).usedToday).toBe(250);
      // (the spec also expects the transfer in Activity: the sandbox does not record one, see the it.fails case at the end of this file)
      expect(app.bank.persona.accounts.find((a) => a.id === "acc_main")!.balance).toBe(8470.76);
    }

    // ---- Step 4: switch to Alpha as Maker, with a step-up
    await expect(app.bank.call("bank.session.switch", { contextId: "alpha" }), "the bank asks for a step-up first").rejects.toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(app.bank.activeContextId).toBe("personal");
    expect(await app.switchContext("alpha")).toBe("step-up");
    expect(app.getState().stepUp).toMatchObject({ contextId: "alpha", phase: "password" });
    expect(activeId(app)).toBe("personal");
    await app.beginStepUp({ secret: PASSWORD });
    expect(app.getState().stepUp).toMatchObject({ phase: "code" });
    await app.confirmStepUp(CODE);
    expect(app.getState()).toMatchObject({ stepUp: null, workspace: "business", shellTab: "overview", switching: null });
    expect(activeId(app)).toBe("alpha");
    expect(app.bank.activeContextId).toBe("alpha");
    expect(stepUpValid(app.getState().session.info, w.clock.t + 4 * MIN)).toBe(true);
    expect(stepUpValid(app.getState().session.info, w.clock.t + 6 * MIN)).toBe(false);
    expect([app.context!.label, roleBadge(app.context)]).toEqual(["Alpha Trading LLC", "Maker"]);
    expect(app.context!.permissions).toContain("biz.payments.initiate");
    expect(app.context!.permissions).not.toContain("biz.approvals.approve");
    {
      const menu = menuFor(app.context);
      expect(menu.find((m) => m.id === "payments")!.allowed).toBe(true);
      expect(menu.find((m) => m.id === "admin")!.allowed, "the Admin tab shows only the no-access card").toBe(false);
      expect(app.launchPoints({ quick: true }).map((l) => l.journey)).toContain("supplier-payment");
      expect(app.launchPoints().filter((l) => l.needs === "biz.approvals.approve"), "no Approve button anywhere").toEqual([]);
      const alpha = await serialisedViews(app);
      expect(alpha.all, "Personal data is not in Alpha").not.toMatch(/Taylor|8,470\.76|8,720\.76|acc_main/);
      seenInBusiness += alpha.all;
    }

    // ---- Step 5: pay a supplier; it ends "Pending approval"
    let alphaPayment: string;
    {
      const j = await runJourney(app, "supplier-payment");
      j.screen("supplier"); await j.press("Harbour Packaging");
      j.screen("amount"); j.text("Operating ••2001");
      j.set({ "sp.amount": 12_500, "sp.reference": "INV-1042", "sp.purpose": "Goods" }); await j.press("Review");
      j.screen("speed"); j.text("Standard"); await j.press("Review");
      j.screen("review"); j.text("$12,500.00", "INV-1042", "Needs 1 approval");
      seenInBusiness += visible(j.view).join(" | ");
      j.set({ "sp.consent": true }); await j.press("Send for approval");
      j.screen("result"); j.noText("Authorise"); j.text("Sent for approval", "Waiting for 1 approval");
      seenInBusiness += visible(j.view).join(" | ");
      alphaPayment = String(j.get("sp.result.id"));
      expect(alphaPayment).toBe("PAY-2042");
      j.text(alphaPayment);
      app.bump();
    }
    {
      const p = await payment(app, alphaPayment);
      expect(p).toMatchObject({ status: "pending_approval", initiatedBy: "alex", required: 1, approvals: [], valueDate: "2026-11-04", afterCutoff: false, amount: 12_500, payee: "Harbour Packaging" });
      const co = await company(app);
      expect(co.accounts.alpha_ops.balance, "nothing leaves until it is released").toBe(480_000);
      expect(co.companyUsedToday, "the company limit counts at release").toBe(0);
      expect(co.me.usedToday).toBe(31_400); // 18,900.00 of the seed + 12,500.00
      const alphaTabs = await serialisedViews(app);
      seenInBusiness += alphaTabs.all;
      expect(alphaTabs.screens).toContain("Harbour Packaging");
    }

    // ---- Step 6: Alex cannot approve at Alpha, even when forced
    {
      const approvals = app.view<any>("approvals")!.data!;
      expect(approvals.approvals, "nothing for Alex to approve at Alpha").toBe(0);
      expect(approvals.sections[0].rows.every((r: any) => r.tag === "Yours" && r.tone === "neutral"), "only his own, read-only").toBe(true);
      const before = auditOf(app.bank, "alpha").filter((e) => e.outcome === "Refused").length;
      await verifyCode(app); // so the refusal is not OTP_REQUIRED
      expect(await code(app.bank.call("corp.payments.approve", { paymentId: alphaPayment }))).toBe("PERMISSION_DENIED");
      expect(await code(app.bank.call("corp.payments.approve", { paymentId: alphaPayment, userId: "dana" }))).toBe("PERMISSION_DENIED");
      const refused = auditOf(app.bank, "alpha").filter((e) => e.outcome === "Refused");
      expect(refused.length - before, "two Refused rows").toBe(2);
      expect(refused.slice(0, 2).map((e) => e.userId)).toEqual(["alex", "alex"]);
      expect(refused.slice(0, 2).map((e) => e.action).join(" | ")).toMatch(/another user.*approve|approve.*another user/s);
      const p = await payment(app, alphaPayment);
      expect(p).toMatchObject({ status: "pending_approval", approvals: [] });
      expect((await company(app)).accounts.alpha_ops.balance).toBe(480_000);
    }

    // ---- Step 7: switch to Beta as Approver (the step-up is still valid)
    w.advance(2 * MIN);
    expect(await app.switchContext("beta"), "no step-up sheet within five minutes").toBe("switched");
    expect(app.getState().stepUp).toBeNull();
    expect(activeId(app)).toBe("beta");
    expect([app.context!.label, roleBadge(app.context)]).toEqual(["Beta Services Ltd", "Approver"]);
    expect(app.getState().workspace).toBe("business");
    expect(app.context!.permissions).toContain("biz.approvals.approve");
    expect(app.context!.permissions).not.toContain("biz.payments.initiate");
    expect(app.getState().shellTab, "Beta was never opened: the Overview").toBe("overview");
    expect(await code(app.bank.call("corp.payments.initiate", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100 })), "an Approver cannot start a payment").toBe("PERMISSION_DENIED");
    {
      const state = JSON.stringify({ ...app.getState(), session: undefined });
      expect(found(state, ["Harbour Packaging", "alpha_ops", "INV-1042", "Alpha Trading"]), "no trace of Alpha in the app state").toEqual([]);
      expect(Object.keys(app.getState().views).every((k) => k.startsWith("beta:"))).toBe(true);
    }

    // ---- Step 8: the approvals inbox
    await app.loadShell("approvals", true);
    {
      const pending = await app.bank.call("corp.payments.pending");
      expect(Object.keys(pending)).toEqual(["PAY-2039", "PAY-2041"]);
      expect(pending["PAY-2041"]).toMatchObject({ amount: 8_200, payee: "Nimbus Logistics", initiatedBy: "priya", reference: "INV-2291" });
      expect(pending["PAY-2039"]).toMatchObject({ amount: 64_500, initiatedBy: "omar" });
      expect(Object.keys(pending)).not.toContain(alphaPayment); // Alpha's PAY-2042 is not here
      expect(app.approvalsBadge, "the badge on Approvals").toBe(2);
      expect(menuFor(app.context, { approvals: app.approvalsBadge }).find((m) => m.id === "approvals")!.badge).toBe(2);
      expect(app.launchPoints({ place: "approvals.inbox" }).map((l) => l.journey)).toContain("approve-payments");
      seenInBusiness += (await serialisedViews(app)).all;
    }

    // ---- Step 9: approve the payment (8,200.00: no code below 25,000.00)
    {
      const j = await runJourney(app, "approve-payments");
      j.screen("inbox"); j.text("PAY-2041", "Nimbus Logistics", "Priya Nair", "$8,200.00");
      await j.press("PAY-2041");
      j.screen("detail"); j.text("$8,200.00 to Nimbus Logistics", "INV-2291"); j.noText("You’ll be asked for a code.");
      await j.press("Approve $8,200.00");
      j.screen("confirm");
      j.set({ "ap.ack": true }); await j.press("Approve $8,200.00");
      j.screen("approved"); j.noText("Code sent"); j.text("Approved", "Sent to the bank", "CORP-20261103-2041");
      app.bump();
    }
    {
      const p = await payment(app, "PAY-2041");
      expect(p).toMatchObject({ status: "released", initiatedBy: "priya", required: 1, releaseReference: "CORP-20261103-2041" });
      expect(p.approvals.map((a: any) => a.userId)).toEqual(["alex"]);
      const co = await company(app);
      expect(co.accounts.beta_ops.balance).toBe(301_800);
      expect(co.companyUsedToday).toBe(8_200);
      expect(Object.keys(await app.bank.call("corp.payments.pending")), "the inbox now holds only PAY-2039").toEqual(["PAY-2039"]);
      seenInBusiness += JSON.stringify(p);
    }

    // ---- Step 10: back to Personal (no step-up)
    expect(await app.switchContext("personal")).toBe("switched");
    expect(app.getState().stepUp, "no step-up sheet").toBeNull();
    expect(activeId(app)).toBe("personal");
    expect(app.context!.label).toBe("Personal");
    expect(app.getState()).toMatchObject({ workspace: "personal", shellTab: "home", active: null, search: "", filters: {}, drafts: {} });
    expect(app.getState().views, "all Beta view-models are gone").toEqual({});

    // ---- Step 11: no company data is visible in Personal
    {
      const personal = await serialisedViews(app);
      expect(found(personal.screens, BANNED), "none of the banned strings in any Personal screen").toEqual([]);
      expect(found(personal.notices, BANNED_IN_NOTICES), "nor in the notices").toEqual([]);
      expect(JSON.parse(personal.notices).filter((n: any) => n.context !== "personal").every((n: any) => n.text === "New activity" && ["Alpha Trading LLC", "Beta Services Ltd"].includes(n.from))).toBe(true);
      // the check can fail: every banned string IS found in the Business screens and answers that were read on the way
      expect(found(seenInBusiness, BANNED).sort(), "the same search finds all of them in Business").toEqual([...BANNED].sort());
      const acc = await app.bank.call("bank.accounts.list");
      expect(acc.acc_main.balance).toBe(8470.76);
      expect(acc.acc_save.balance).toBe(15254.37);
      expect(await code(app.bank.call("corp.payments.get", { paymentId: "PAY-2041" }))).toBe("WRONG_CONTEXT");
      expect(await code(app.bank.call("corp.payments.pending"))).toBe("WRONG_CONTEXT");
    }

    // ---- Step 12: a notification for another context
    w.advance(10 * MIN);
    {
      // a colleague (omar) starts a payment at Beta while Alex is in Personal: a back door on the Beta books, not something the app can do
      const omar = providerOf(app.bank, "beta").initiatePayment({ userId: "omar", fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 3_150, reference: "INV-2305" });
      expect(omar).toMatchObject({ id: "PAY-2042", status: "pending_approval" });
      await app.loadNotices(true);
      const note = app.notices().find((n) => n.context === "beta")!;
      expect(note).toMatchObject({ from: "Beta Services Ltd", text: "New activity", read: false });
      expect(JSON.stringify(note)).not.toMatch(/8,200|Nimbus|3,150|INV-/);
      expect(activeId(app)).toBe("personal");
      // tapping it asks first, and does not switch by itself
      expect(app.followLink(note.link!)).toBe("offer");
      expect(app.getState().offer).toMatchObject({ workspace: "business", companyId: "beta" });
      expect(activeId(app)).toBe("personal");
      expect(app.getState().workspace).toBe("personal");
      app.declineOffer(); // Not now
      expect(app.getState().offer).toBeNull();
      expect(activeId(app)).toBe("personal");
      // Switch: the step-up has run out by now, so the sheet asks, and then the link arrives
      const link = parseLink("/business/beta/j/approve-payments?paymentId=PAY-2042")!;
      expect(app.followLink(link)).toBe("offer");
      await app.acceptOffer();
      expect(app.getState().stepUp).toMatchObject({ contextId: "beta" });
      expect(app.getState().arrived).toBeNull();
      await app.beginStepUp({ secret: PASSWORD });
      await app.confirmStepUp(CODE);
      expect(activeId(app)).toBe("beta");
      expect(app.getState().arrived).toEqual(link);
      // the journey opens at that payment
      const j = await runJourney(app, link.journey!, link.values!);
      j.screen("detail"); j.text("$3,150.00 to Nimbus Logistics", "INV-2305");
      app.clearArrived();
      app.bump();
      expect(await app.switchContext("personal")).toBe("switched");
    }

    // ---- Step 13: sign out
    expect(app.bank, "one sandbox from the first step to the last").toBe(bank);
    expect(login).toHaveBeenCalledTimes(1);
    const handle = app.adapter; // what a journey still open would hold
    app.logout();
    expect(app.getState().screen).toBe("login");
    expect(app.getState().session).toMatchObject({ status: "idle", info: null });
    expect(await code(bank.call("bank.session.get")), "the old session is over").toBe("SESSION_EXPIRED");
    for (const a of ["bank.accounts.list", "corp.company.get", "corp.payments.pending", "bank.session.switch"]) expect(await code(handle(a, {})), a).toBe("SESSION_EXPIRED");
    expect(app.bank, "a fresh sandbox").not.toBe(bank);
    await signIn(w);
    expect((await app.bank.call("bank.accounts.list")).acc_main.balance, "the sandbox is reset to the seed").toBe(8720.76);
    expect(JSON.stringify({ ...app.getState(), session: undefined })).not.toMatch(/PAY-20|Nimbus|Harbour/);
    await switchTo(w, "alpha");
    expect(Object.keys(await app.bank.call("corp.payments.pending", { as: "initiator" })), "the Alpha payment is gone").toEqual(["PAY-2040"]);
  });
});

// =========================================================================================================================
/** A signed-in world, optionally already inside a company (the step-up done with the right password and code). */
async function at(contextId?: "alpha" | "beta", extra: Record<string, unknown> = {}) {
  const w = world(extra);
  await signIn(w);
  if (contextId) expect(await switchTo(w, contextId)).toBe("switched");
  return w;
}
/** Starts a payment at Alpha with the adapters the journey uses (a price, then the payment), for cases that need one without walking the screens. */
async function startAlphaPayment(app: BankApp, amount: number, reference = "INV-1042") {
  if (amount >= 25_000) await verifyCode(app);
  const q = await app.bank.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount, purpose: "Goods", reference });
  return app.bank.call("corp.payments.create", { quoteId: q.quoteId });
}

describe("E-2: step-up is required to enter Alpha", () => {
  it("asks first, refuses a wrong password, closes after three wrong codes, and still lets the right ones in", async () => {
    const w = await at();
    const { app } = w;
    const spy = vi.spyOn(app.bank, "call");
    expect(await app.switchContext("alpha")).toBe("step-up");
    expect(app.getState().stepUp).toMatchObject({ contextId: "alpha", phase: "password" });
    expect(activeId(app)).toBe("personal");

    await app.beginStepUp({ secret: "wrong" });
    expect(app.getState().stepUp).toMatchObject({ phase: "password", error: "That password isn't right." });
    expect(await code(app.bank.call("bank.session.stepUp", { method: "password", secret: "wrong" })), "the bank answers STEP_UP_FAILED").toBe("STEP_UP_FAILED");
    expect(spy.mock.calls.some((c) => c[0] === "bank.otp.send"), "no code is sent for a wrong password").toBe(false);

    await app.beginStepUp({ secret: PASSWORD });
    expect(app.getState().stepUp).toMatchObject({ phase: "code" });
    await app.confirmStepUp("111111");
    expect(app.getState().stepUp).toMatchObject({ phase: "code", error: "Incorrect code" });
    await app.confirmStepUp("222222");
    expect(app.getState().stepUp).not.toBeNull();
    await app.confirmStepUp("333333");
    expect(app.getState().stepUp, "the third wrong code closes the sheet").toBeNull();
    expect(app.getState().toast).toMatchObject({ text: "Too many wrong codes. Start again.", ok: false });
    await app.confirmStepUp(CODE); // the sheet is closed: the right code now opens nothing
    expect(activeId(app)).toBe("personal");
    expect(app.bank.activeContextId).toBe("personal");
    expect(app.getState().workspace).toBe("personal");
    expect((await app.bank.call("bank.session.get")).stepUpUntil, "no step-up was granted").toBeUndefined();
    expect(Object.keys(app.getState().views).every((k) => k.startsWith("personal:")), "no company data was loaded").toBe(true);

    expect(await switchTo(w, "alpha"), "starting again with the right password and code works").toBe("switched");
    expect(activeId(app)).toBe("alpha");
  });
  it("a wrong code does not let a later switch skip the step-up", async () => {
    const w = await at();
    expect(await w.app.switchContext("beta")).toBe("step-up");
    await w.app.beginStepUp({ secret: PASSWORD });
    await w.app.confirmStepUp("000001");
    w.app.cancelStepUp();
    expect(await w.app.switchContext("beta")).toBe("step-up");
  });
});

describe("E-3: a Maker sees no approve action at Alpha", () => {
  it("has no Approve button, no approval permission and no approve journey, and the bank refuses it when forced", async () => {
    const { app } = await at("alpha");
    const ctx = app.context!;
    expect(ctx.roles).toEqual(["Maker"]);
    expect(ctx.permissions).not.toContain("biz.approvals.approve");
    expect(ctx.permissions).toContain("biz.approvals.view");
    expect(app.launchPoints().filter((l) => l.journey === "approve-payments" || l.needs === "biz.approvals.approve"), "no Approve anywhere").toEqual([]);
    expect(app.launchPoints({ place: "approvals.inbox" })).toEqual([]);
    const st = app.getState();
    expect(journeyAllowed("approve-payments", { context: ctx, entries: st.catalog.entries, settings: st.session.settings })).toBe(false);
    expect(journeyAllowed("supplier-payment", { context: ctx, entries: st.catalog.entries, settings: st.session.settings })).toBe(true);
    // the Approvals tab shows what he started and nothing to act on; the Admin tab is the no-access card
    const menu = menuFor(ctx);
    expect(menu.find((m) => m.id === "approvals")!.allowed).toBe(true);
    expect(menu.find((m) => m.id === "admin")!.allowed).toBe(false);
    await app.loadShell("approvals");
    expect(app.view<any>("approvals")!.data!.approvals).toBe(0);
    expect(app.view<any>("approvals")!.data!.sections[0].rows.map((r: any) => [r.id, r.tag])).toEqual([["PAY-2040", "Yours"]]);
    // forced: the approve journey's own calls are refused by the bank
    const live = (await app.fetchJourney("approve-payments"))!;
    const runner = new JourneyRunner(live.journey, { adapter: app.adapter, lang: "en", session: { permissions: ctx.permissions } });
    await runner.start();
    expect(runner.current, "the journey does not show an inbox to a Maker").not.toBe("detail");
    await verifyCode(app);
    for (const a of ["corp.payments.approve", "corp.payments.reject", "corp.payments.delegate"]) expect(await code(app.bank.call(a, { paymentId: "PAY-2040" })), a).toBe("PERMISSION_DENIED");
    expect(await code(app.bank.call("corp.payments.approveMany", { paymentIds: ["PAY-2040"] }))).toBe("PERMISSION_DENIED");
    expect((await payment(app, "PAY-2040")).status).toBe("pending_approval");
  });
});

describe("E-4: the payment ends Pending approval and moves no money", () => {
  it("12,500.00 waits for one approval; nothing leaves the account and the company limit is not used", async () => {
    const { app } = await at("alpha");
    const p = await startAlphaPayment(app, 12_500);
    expect(p).toMatchObject({ id: "PAY-2042", status: "pending_approval", required: 1, approvals: [], initiatedBy: "alex" });
    const co = await company(app);
    expect(co.accounts.alpha_ops.balance).toBe(480_000);
    expect(co.companyUsedToday).toBe(0);
  });
  it("60,000.00 waits for two approvals and moves no money either", async () => {
    const { app } = await at("alpha");
    const p = await startAlphaPayment(app, 60_000);
    expect(p).toMatchObject({ status: "pending_approval", required: 2, approvals: [] });
    const co = await company(app);
    expect(co.accounts.alpha_ops.balance).toBe(480_000);
    expect(co.companyUsedToday).toBe(0);
    expect(co.me.usedToday).toBe(78_901); // 18,900.00 of the seed + 60,000.00 + the 1.00 fee of Same day (Standard is over its limit at this amount)
  });
  it("a payment that is refused (no money, over the limit) is not created", async () => {
    const { app } = await at("alpha");
    expect(await code(app.bank.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 600_000, purpose: "Goods", reference: "BIG" }))).toBe("INSUFFICIENT_FUNDS");
    expect(Object.keys(await app.bank.call("corp.payments.pending", { as: "initiator" }))).toEqual(["PAY-2040"]);
  });
});

describe("E-5: the step-up expires after five minutes", () => {
  it("is still valid at five minutes, and asks again after six", async () => {
    const w = await at("alpha");
    w.advance(5 * MIN);
    expect(stepUpValid((await w.app.bank.call("bank.session.get")) as never, w.clock.t)).toBe(true);
    expect(await w.app.switchContext("beta"), "exactly five minutes: still valid").toBe("switched");
    expect(await w.app.switchContext("alpha")).toBe("switched");
    w.advance(MIN + 1); // six minutes since the step-up
    expect(await w.app.switchContext("beta")).toBe("step-up");
    expect(w.app.getState().stepUp).toMatchObject({ contextId: "beta", phase: "password" });
    expect(activeId(w.app), "still where they were until they confirm").toBe("alpha");
    await w.app.beginStepUp({ secret: PASSWORD });
    await w.app.confirmStepUp(CODE);
    expect(activeId(w.app)).toBe("beta");
  });
  it("never asks to go back to Personal, however long ago the step-up was", async () => {
    const w = await at("beta");
    w.advance(30 * MIN);
    expect(await w.app.switchContext("personal")).toBe("switched");
    expect(w.app.getState().stepUp).toBeNull();
    expect(await w.app.switchContext("alpha"), "but a company asks again").toBe("step-up");
  });
});

describe("E-6: a forced approval at Alpha is refused and written to the audit trail", () => {
  it("answers PERMISSION_DENIED for Alex and for userId dana, changes nothing, and writes two Refused rows", async () => {
    const { app } = await at("alpha");
    const before = auditOf(app.bank, "alpha").filter((e) => e.outcome === "Refused").length;
    await verifyCode(app);
    expect(await code(app.bank.call("corp.payments.approve", { paymentId: "PAY-2040" }))).toBe("PERMISSION_DENIED");
    expect(await code(app.bank.call("corp.payments.approve", { paymentId: "PAY-2040", userId: "dana" })), "pretending to be dana (context and userId differ)").toBe("PERMISSION_DENIED");
    expect(await code(app.bank.call("corp.payments.approve", { paymentId: "PAY-2040", userId: "alex" })), "his own name does not help").toBe("PERMISSION_DENIED");
    const rows = auditOf(app.bank, "alpha").filter((e) => e.outcome === "Refused");
    expect(rows.length - before).toBe(3);
    expect(rows.slice(0, 3).every((e) => e.userId === "alex" && e.action.includes("corp.payments.approve"))).toBe(true);
    expect(rows.slice(0, 3).map((e) => e.action).filter((a) => /another user/.test(a))).toHaveLength(1);
    const p = await payment(app, "PAY-2040");
    expect(p).toMatchObject({ status: "pending_approval", approvals: [] });
    expect((await company(app)).accounts.alpha_ops.balance).toBe(480_000);
    expect(Object.keys(await app.bank.call("corp.payments.pending", { as: "initiator" }))).toEqual(["PAY-2040"]);
  });
});

describe("E-7: an Approver cannot start a payment at Beta", () => {
  it("every way of starting money out answers PERMISSION_DENIED, is audited, and the app does not offer it", async () => {
    const { app } = await at("beta");
    const forced: [string, Record<string, unknown>][] = [
      ["corp.payments.initiate", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100 }],
      ["corp.payments.quote", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100, purpose: "Goods", reference: "X" }],
      ["corp.bulk.submit", { fromAccountId: "beta_ops", file: "nimb,10,x" }],
      ["corp.payroll.submit", { fromAccountId: "beta_pay", period: "2026-10", file: "emp_1,10" }],
    ];
    for (const [a, input] of forced) expect(await code(app.bank.call(a, input)), a).toBe("PERMISSION_DENIED");
    expect(await code(app.bank.call("corp.payments.initiate", { userId: "priya", fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100 })), "as priya").toBe("PERMISSION_DENIED");
    const rows = Object.values(await app.bank.call("corp.audit.list")) as any[];
    expect(rows.filter((r) => r.outcome === "Refused" && r.userId === "alex")).toHaveLength(5);
    expect(Object.keys(await app.bank.call("corp.payments.pending")), "nothing was created").toEqual(["PAY-2039", "PAY-2041"]);
    expect((await company(app)).accounts.beta_ops.balance).toBe(310_000);
    const st = app.getState();
    expect(journeyAllowed("supplier-payment", { context: app.context!, entries: st.catalog.entries, settings: st.session.settings })).toBe(false);
    expect(app.launchPoints().map((l) => l.journey)).not.toContain("supplier-payment");
    expect(app.launchPoints({ place: "approvals.inbox" }).map((l) => l.journey)).toContain("approve-payments");
  });
});

describe("E-8: four-eyes holds even when one person has both roles", () => {
  // A test-only customer: Alex with the Approver role added at Alpha, built on the sandbox's own persona table (nothing in the rules is weakened).
  const both: CorpCompany = { ...ALPHA, users: ALPHA.users.map((u) => (u.id === "alex" ? { ...u, roles: ["initiator" as const, "approver" as const] } : u)) };
  personas.alexboth = { ...structuredClone(personas.alex!), id: "alexboth", name: "Alex Morgan (both roles at Alpha, test seed)", identity: { ...personas.alex!.identity!, business: personas.alex!.identity!.business.map((b) => (b.id === "alpha" ? { ...b, company: both } : b)) } };
  afterAll(() => { delete personas.alexboth; });

  it("holds both permissions, yet approving his own payment answers SELF_APPROVAL and releases nothing", async () => {
    const w = world();
    await signIn(w, "alexboth");
    expect(await switchTo(w, "alpha")).toBe("switched");
    const { app } = w;
    expect(app.context!.roles).toEqual(["Maker", "Approver"]);
    expect(app.context!.permissions).toEqual(expect.arrayContaining(["biz.payments.initiate", "biz.approvals.approve"]));
    const mine = await startAlphaPayment(app, 12_500);
    for (const id of [mine.id, "PAY-2040"]) {
      expect(await code(app.bank.call("corp.payments.approve", { paymentId: id })), id).toBe("SELF_APPROVAL");
      expect(await code(app.bank.call("corp.payments.approveMany", { paymentIds: [id] })), `${id} with others`).toBe("SELF_APPROVAL");
      expect((await payment(app, id)).status).toBe("pending_approval");
    }
    expect((await company(app)).accounts.alpha_ops.balance).toBe(480_000);
    // the shell agrees: his own payments are never in the queue of what he can approve, even with the role
    await app.loadShell("approvals", true);
    const inbox = app.view<any>("approvals")!.data!;
    expect(inbox.approvals).toBe(0);
    expect(inbox.sections[0].rows).toEqual([]);
    expect(Object.keys(await app.bank.call("corp.payments.pending", { as: "initiator" })).sort()).toEqual(["PAY-2040", mine.id]);
  });
  it("and the rule is what stops it: with it switched off, the same call would release the payment", async () => {
    const bank = new MockBank("alexboth", { corpFlaws: { fourEyes: false } });
    bank.now = () => NOW;
    await bank.call("bank.session.stepUp", { method: "password", secret: PASSWORD }).catch(() => undefined);
    await bank.call("bank.otp.send"); await bank.call("bank.otp.verify", { code: CODE });
    await bank.call("bank.session.stepUp", { method: "password", secret: PASSWORD });
    await bank.call("bank.session.switch", { contextId: "alpha" });
    expect((await bank.call("corp.payments.approve", { paymentId: "PAY-2040" })).status).toBe("released");
  });
});

describe("E-9: personal adapters are refused in a business context", () => {
  it("answers WRONG_CONTEXT at Beta (and at Alpha) for what belongs to Personal", async () => {
    for (const place of ["beta", "alpha"] as const) {
      const { app } = await at(place);
      for (const [a, input] of [["bank.accounts.list", {}], ["bank.transactions.list", {}], ["bank.beneficiaries.list", {}], ["bank.limits.get", {}], ["bank.cards.issued", {}], ["bank.payments.quote", { fromAccountId: "acc_main", amount: 10 }], ["bank.transfers.create", { fromAccountId: "acc_main", beneficiaryId: "ben_taylor", amount: 10 }]] as const)
        expect(await code(app.bank.call(a, input)), `${a} at ${place}`).toBe("WRONG_CONTEXT");
      expect(await code(app.bank.call("bank.notifications.list")), "the notification centre spans every place").toBe("no error");
      expect(await code(app.bank.call("bank.session.get"))).toBe("no error");
    }
  });
  it("and a Personal screen cannot be loaded from inside a company", async () => {
    const { app } = await at("beta");
    expect(Object.keys(app.getState().views).every((k) => k.startsWith("beta:"))).toBe(true);
    expect(await app.bank.call("bank.session.get").then((s: any) => s.contexts.find((c: any) => c.id === s.activeContextId).permissions)).not.toContain("accounts.view");
  });
});

describe("E-10: a link into another context asks first", () => {
  const link = () => parseLink("/business/beta/j/approve-payments?paymentId=PAY-2041")!;
  /** The app's state apart from the offer itself (a clock tick and the toast timer are not part of "nothing changed"). */
  const calm = (app: BankApp) => JSON.stringify({ ...app.getState(), offer: null, tick: 0 });

  it("shows the sheet, and Not now changes nothing", async () => {
    const w = await at();
    const { app } = w;
    await app.loadShell("home");
    const before = calm(app);
    expect(app.followLink(link())).toBe("offer");
    expect(app.getState().offer).toEqual(link());
    expect(activeId(app), "the offer does not switch by itself").toBe("personal");
    expect(app.bank.activeContextId).toBe("personal");
    expect(findLabel(app, linkContext(app.getState().offer!))).toBe("Beta Services Ltd");
    app.declineOffer();
    expect(app.getState().offer).toBeNull();
    expect(calm(app), "Not now leaves everything as it was").toBe(before);
    expect(app.bank.activeContextId).toBe("personal");
    expect((await app.bank.call("bank.session.get")).stepUpUntil).toBeUndefined();
  });
  it("Switch needs the step-up, and cancelling it leaves the person where they were with nothing opened", async () => {
    const w = await at();
    const { app } = w;
    app.followLink(link());
    await app.acceptOffer();
    expect(app.getState().stepUp).toMatchObject({ contextId: "beta", phase: "password" });
    expect(app.getState().offer).toBeNull();
    expect(activeId(app)).toBe("personal");
    app.cancelStepUp();
    expect(app.getState()).toMatchObject({ arrived: null, workspace: "personal", stepUp: null });
    expect(activeId(app)).toBe("personal");
    // and again, to the end: the link arrives once the switch is done, and only then
    app.followLink(link());
    await app.acceptOffer();
    await app.beginStepUp({ secret: PASSWORD });
    expect(app.getState().arrived).toBeNull();
    await app.confirmStepUp(CODE);
    expect(activeId(app)).toBe("beta");
    expect(app.getState().arrived).toEqual(link());
  });
  it("opens at once inside the same place, offers for another company even from a company, and refuses a place the person is not in", async () => {
    const w = await at("alpha");
    const { app } = w;
    expect(app.followLink(parseLink("/business/alpha/payments")!)).toBe("go");
    expect(app.followLink(link())).toBe("offer");
    app.declineOffer();
    expect(app.followLink(parseLink("/business/acme/approvals")!)).toBe("denied");
    expect(app.getState().offer).toBeNull();
    expect(activeId(app)).toBe("alpha");
  });
});
const findLabel = (app: BankApp, id: string) => app.getState().session.info!.contexts.find((c) => c.id === id)!.label;

describe("E-11: nothing leaks after switching back", () => {
  it("the JSON of every Personal screen contains none of the banned strings, and the same search does find them in Business", async () => {
    const w = await at("alpha");
    const { app } = w;
    let business = "";
    await startAlphaPayment(app, 12_500);
    business += (await serialisedViews(app)).all;
    app.setSearch("harbour"); app.setFilter("status", "pending"); app.setDraft("supplier-payment", { amount: 12_500, supplier: "Harbour Packaging" });
    expect(await app.switchContext("beta")).toBe("switched");
    business += (await serialisedViews(app)).all;
    business += JSON.stringify(await app.bank.call("corp.payments.get", { paymentId: "PAY-2041" }));
    await verifyCode(app);
    await app.bank.call("corp.payments.approve", { paymentId: "PAY-2041" });
    business += JSON.stringify(await app.bank.call("corp.payments.get", { paymentId: "PAY-2041" }));
    business += "$12,500.00 $8,200.00"; // the journeys' own screens print amounts with decimals (E-1 reads them from the result screens)

    expect(await app.switchContext("personal")).toBe("switched");
    expect(app.getState()).toMatchObject({ search: "", filters: {}, drafts: {}, views: {}, active: null, sheet: null, toast: null, offer: null, stepUp: null });
    const personal = await serialisedViews(app);
    expect(found(personal.screens, BANNED), "Personal screens").toEqual([]);
    expect(found(personal.notices, BANNED_IN_NOTICES), "Personal notices").toEqual([]);
    expect(found(stateWithoutNotices(app), BANNED), "the app's whole state").toEqual([]);
    // the check is able to fail: the same search finds every one of the strings in the Business answers
    expect(found(business, BANNED).sort()).toEqual([...BANNED].sort());
    // Personal works, company calls do not
    expect(Object.values(await app.bank.call("bank.accounts.list")).map((a: any) => a.name)).toEqual(["Main", "Savings", "EUR Travel", "AED Home"]);
    for (const a of ["corp.company.get", "corp.payments.pending", "corp.suppliers.list", "corp.audit.list"]) expect(await code(app.bank.call(a)), a).toBe("WRONG_CONTEXT");
  });
  it("the search cannot pass by accident: a company string put into a Personal view is caught", async () => {
    const { app } = await at();
    const clean = await serialisedViews(app);
    expect(found(clean.screens, BANNED)).toEqual([]);
    expect(found(clean.screens + "Nimbus Logistics", BANNED)).toEqual(["Nimbus Logistics"]);
  });
});

describe("E-12: a one-time code does not carry across contexts", () => {
  it("a code verified at Alpha does not approve at Beta, and a code verified at Beta does not send money in Personal", async () => {
    const w = await at("alpha");
    const { app } = w;
    await verifyCode(app);
    expect(await app.switchContext("beta")).toBe("switched");
    expect(await code(app.bank.call("corp.payments.approve", { paymentId: "PAY-2039" })), "64,500.00 needs a code").toBe("OTP_REQUIRED");
    await verifyCode(app);
    expect((await app.bank.call("corp.payments.approve", { paymentId: "PAY-2039" })).status, "with a new code it goes through").toBe("released");
    await verifyCode(app);
    expect(await app.switchContext("personal")).toBe("switched");
    const send = { fromAccountId: "acc_main", beneficiaryId: "ben_taylor", amount: 10 };
    expect(await code(app.bank.call("bank.transfers.create", send))).toBe("OTP_REQUIRED");
    await verifyCode(app);
    expect(await code(app.bank.call("bank.transfers.create", send)), "with a new code it goes through").toBe("no error");
  });
  it("and a code used for a step-up is spent: the next company payment asks again", async () => {
    const { app } = await at("alpha");
    expect(await code(app.bank.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 30_000, purpose: "Goods", reference: "X" }).then((q: any) => app.bank.call("corp.payments.create", { quoteId: q.quoteId })))).toBe("OTP_REQUIRED");
  });
});

describe("E-13: signing out ends everything", () => {
  it("every adapter of the old session answers SESSION_EXPIRED, the app is on the sign-in screen and the sandbox is reset", async () => {
    const w = await at("alpha");
    const { app } = w;
    const old = app.bank, handle = app.adapter;
    await startAlphaPayment(app, 12_500);
    app.setDraft("supplier-payment", { amount: 1 }); app.say("hello");
    await app.loadShell("approvals");
    app.logout();
    expect(app.getState()).toMatchObject({ screen: "login", workspace: "personal", active: null, stepUp: null, offer: null, arrived: null, toast: null, drafts: {}, views: {}, search: "", filters: {}, session: { status: "idle", info: null } });
    for (const a of ["bank.session.get", "bank.session.switch", "bank.otp.send", "bank.accounts.list", "bank.transfers.create", "bank.notifications.list", "corp.company.get", "corp.payments.pending", "corp.payments.approve"]) {
      expect(await code(old.call(a, {})), `${a} on the old sandbox`).toBe("SESSION_EXPIRED");
      expect(await code(handle(a, {})), `${a} through a handle a journey still holds`).toBe("SESSION_EXPIRED");
    }
    expect(app.bank).not.toBe(old);
    await signIn(w);
    expect(activeId(app)).toBe("personal");
    expect(JSON.stringify(app.getState())).not.toMatch(/PAY-20|Harbour|Nimbus/);
    await switchTo(w, "alpha");
    expect(Object.keys(await app.bank.call("corp.payments.pending", { as: "initiator" })), "the payment started before signing out is gone").toEqual(["PAY-2040"]);
    expect((await company(app)).me.usedToday).toBe(18_900);
  });
});

describe("E-14: a timeout on the switch keeps the person where they were", () => {
  it("stays in Personal with the bank's answer unapplied, says so, and the retry works", async () => {
    const w = await at();
    const { app } = w;
    await app.loadShell("home");
    app.setShellTab("cards");
    app.bank.conditions = { timeout: ["bank.session.switch"] };
    expect(await app.switchContext("alpha")).toBe("failed");
    expect(app.getState()).toMatchObject({ workspace: "personal", shellTab: "cards", switching: null, stepUp: null });
    expect(app.getState().toast).toMatchObject({ ok: false, text: "We couldn't switch. You are still in Personal. Try again." });
    expect(app.bank.activeContextId).toBe("personal");
    expect(app.view("home")!.status, "what the person was looking at is kept").toBe("ready");
    app.bank.conditions = {};
    expect(await switchTo(w, "alpha"), "retry").toBe("switched");
    expect(activeId(app)).toBe("alpha");
  });
  it("also when the step-up is valid and the switch itself is what times out (in a company, and back)", async () => {
    const w = await at("alpha");
    const { app } = w;
    app.bank.conditions = { timeout: ["bank.session.switch"] };
    expect(await app.switchContext("beta")).toBe("failed");
    expect(app.getState().toast!.text).toBe("We couldn't switch. You are still in Alpha Trading LLC. Try again.");
    expect(activeId(app)).toBe("alpha");
    expect(app.getState().workspace).toBe("business");
    expect(await app.switchContext("personal")).toBe("failed");
    expect(app.bank.activeContextId).toBe("alpha");
    app.bank.conditions = { unavailable: ["bank.session.switch"] };
    expect(await app.switchContext("beta")).toBe("failed");
    expect(app.getState().toast!.text).toMatch(/^We couldn't switch\. You are still in Alpha Trading LLC/);
    app.bank.conditions = {};
    expect(await app.switchContext("beta")).toBe("switched");
  });
});

describe("E-15: the bank unavailable on an approval changes nothing", () => {
  it("the journey says nothing was approved; the payment still waits and no money moved", async () => {
    const { app } = await at("beta");
    app.bank.conditions = { unavailable: ["corp.payments.approve"] };
    const j = await runJourney(app, "approve-payments", { paymentId: "PAY-2041" });
    j.screen("detail");
    await j.press("Approve $8,200.00");
    j.screen("confirm");
    j.set({ "ap.ack": true }); await j.press("Approve $8,200.00");
    j.screen("unavailable"); j.text("Nothing was approved.");
    app.bank.conditions = {};
    const p = await payment(app, "PAY-2041");
    expect(p).toMatchObject({ status: "pending_approval", approvals: [] });
    const co = await company(app);
    expect(co.accounts.beta_ops.balance).toBe(310_000);
    expect(co.companyUsedToday).toBe(0);
    expect(Object.keys(await app.bank.call("corp.payments.pending"))).toEqual(["PAY-2039", "PAY-2041"]);
    // and Try again, once the bank is back, approves it
    await j.press("Try again");
    j.screen("confirm");
    j.set({ "ap.ack": true }); await j.press("Approve $8,200.00");
    j.screen("approved");
    expect((await payment(app, "PAY-2041")).status).toBe("released");
  });
  it("a timeout does the same", async () => {
    const { app } = await at("beta");
    app.bank.conditions = { timeout: ["corp.payments.approve"] };
    const j = await runJourney(app, "approve-payments", { paymentId: "PAY-2041" });
    await j.press("Approve $8,200.00");
    j.set({ "ap.ack": true }); await j.press("Approve $8,200.00");
    j.text("Check Payments");
    app.bank.conditions = {};
    expect((await payment(app, "PAY-2041")).status).toBe("pending_approval");
    expect((await company(app)).accounts.beta_ops.balance).toBe(310_000);
  });
});

// =========================================================================================================================
/**
 * The corporate steps (4 to 9) on a bank API, with everything a person can see written down as it goes: screens, statuses, amounts, error codes.
 * Each bank numbers its own payments (PAY-2042 on the reference bank, TXN-002042 on Bank B), so the numbers in ids are compared and the prefixes are not.
 */
async function corporateSteps(corpProvider: ProviderId) {
  const w = world({ bankApi: corpProvider });
  await signIn(w);
  const { app } = w;
  const seen: Record<string, unknown> = {};
  const pid = (n: number) => (corpProvider === "bank-b" ? `TXN-${String(n).padStart(6, "0")}` : `PAY-${n}`);
  const view = (j: Walk) => visible(j.view);

  // 4: Alpha as Maker, with the step-up
  expect(await app.switchContext("alpha")).toBe("step-up");
  await app.beginStepUp({ secret: PASSWORD }); await app.confirmStepUp(CODE);
  seen.s4 = { context: [app.context!.label, roleBadge(app.context)], canApprove: app.context!.permissions.includes("biz.approvals.approve"), canPay: app.context!.permissions.includes("biz.payments.initiate"), limits: app.context!.limits };

  // 5: pay a supplier
  const pay = await runJourney(app, "supplier-payment");
  await pay.press("Harbour Packaging");
  pay.set({ "sp.amount": 12_500, "sp.reference": "INV-1042", "sp.purpose": "Goods" }); await pay.press("Review");
  const speeds = view(pay); await pay.press("Review");
  const review = view(pay);
  pay.set({ "sp.consent": true }); await pay.press("Send for approval");
  pay.screen("result");
  const alphaId = String(pay.get("sp.result.id"));
  const made = await payment(app, alphaId);
  const co = await company(app);
  seen.s5 = { speeds, review, result: view(pay), payment: { ...made, id: alphaId }, balance: co.accounts.alpha_ops.balance, companyUsed: co.companyUsedToday, alexUsed: co.me.usedToday, pending: await app.bank.call("corp.payments.pending", { as: "initiator" }) };

  // 6: forced approvals at Alpha
  await verifyCode(app);
  seen.s6 = [await code(app.bank.call("corp.payments.approve", { paymentId: alphaId })), await code(app.bank.call("corp.payments.approve", { paymentId: alphaId, userId: "dana" })), (await payment(app, alphaId)).status];

  // 7: Beta as Approver (still inside the five minutes)
  w.advance(2 * MIN);
  expect(await app.switchContext("beta")).toBe("switched");
  seen.s7 = { context: [app.context!.label, roleBadge(app.context)], initiate: await code(app.bank.call("corp.payments.initiate", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100 })) };

  // 8: the inbox
  const pending = await app.bank.call("corp.payments.pending");
  await app.loadShell("approvals", true);
  seen.s8 = { pending, badge: app.approvalsBadge };

  // 9: approve 8,200.00
  const approve = await runJourney(app, "approve-payments");
  seen.s9inbox = view(approve);
  await approve.press(pid(2041));
  approve.screen("detail");
  seen.s9detail = view(approve);
  await approve.press("Approve $8,200.00");
  approve.set({ "ap.ack": true }); await approve.press("Approve $8,200.00");
  approve.screen("approved");
  const co2 = await company(app);
  seen.s9 = { result: view(approve), payment: await payment(app, pid(2041)), balance: co2.accounts.beta_ops.balance, used: co2.companyUsedToday, pending: Object.keys(await app.bank.call("corp.payments.pending")) };
  return { seen, alphaId, bank: app.bank };
}
/** Ids with their prefix and padding taken off: PAY-2042, TXN-002042 and pay_2042 are all "#2042". */
const numbered = (v: unknown): unknown => JSON.parse(JSON.stringify(v).replace(/(?:PAY-|TXN-0*|pay_)(\d+)/g, "#$1"));

describe("E-16: the same corporate steps on the second bank API", () => {
  it("Bank B gives the same visible results as the reference bank, steps 4 to 9", async () => {
    const reference = await corporateSteps("reference");
    const bankB = await corporateSteps("bank-b");
    expect(providerOf(bankB.bank, "alpha").constructor.name, "it really ran on Bank B").toBe("MappedCorporateProvider");
    expect(providerOf(reference.bank, "alpha").constructor.name).not.toBe("MappedCorporateProvider");
    expect([reference.alphaId, bankB.alphaId], "each bank numbers its own payments").toEqual(["PAY-2042", "TXN-002042"]);
    expect(numbered(bankB.seen)).toEqual(numbered(reference.seen));
    // and what was compared is the real thing, not two empty transcripts
    const s = numbered(bankB.seen) as any;
    expect(s.s5.payment).toMatchObject({ status: "pending_approval", initiatedBy: "alex", required: 1, valueDate: "2026-11-04" });
    expect(s.s5.balance).toBe(480_000);
    expect(s.s6.slice(0, 2)).toEqual(["PERMISSION_DENIED", "PERMISSION_DENIED"]);
    expect(Object.keys(s.s8.pending)).toEqual(["#2039", "#2041"]);
    expect(s.s9.payment).toMatchObject({ status: "released", releaseReference: "CORP-20261103-2041" });
    expect([s.s9.balance, s.s9.used]).toEqual([301_800, 8_200]);
  });
});

// =========================================================================================================================
describe("known gaps in the sandbox, left as failing assertions (see the pull request)", () => {
  it.fails("a Personal payment shows up in Activity (spec step 3)", async () => {
    const { app } = await at();
    await verifyCode(app);
    await app.bank.call("bank.transfers.create", { fromAccountId: "acc_main", beneficiaryId: "ben_taylor", amount: 250 });
    const activity = Object.values(await app.bank.call("bank.activity.list")) as any[];
    expect(activity.some((t) => t.amount === -250), "one transfer of 250.00 in Activity").toBe(true);
  });
  it.fails("a payment a colleague starts raises a notification for Beta's approvers (spec step 12)", async () => {
    const { app } = await at();
    const before = Object.keys(await app.bank.call("bank.notifications.list")).length;
    providerOf(app.bank, "beta").initiatePayment({ userId: "omar", fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 3_150, reference: "INV-2305" });
    const after = Object.values(await app.bank.call("bank.notifications.list")) as any[];
    expect(after.length, "a new notification").toBe(before + 1);
    expect(after.filter((n) => n.context === "beta" && !n.read)).toHaveLength(2);
  });
});
