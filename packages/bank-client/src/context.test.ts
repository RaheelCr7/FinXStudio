import { afterEach, describe, expect, it, vi } from "vitest";
import { BankApp, createLive, parseLink, type Screen } from "./index";

const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
const make = (extra: object = {}) => new BankApp({ preset: "bankworkx", live: createLive({ brand: "bankworkx", fetch: down }), studioUrl: "http://studio", toastMs: 20, ...extra });
const PASSWORD = "Bwx!Demo2026";

/** Signed in as Alex with the session loaded. */
async function alex() {
  const a = make();
  a.login();
  await a.loadSession();
  return a;
}
/** Password, then the code, as the confirmation sheet does it. */
async function confirm(a: BankApp) {
  await a.beginStepUp({ secret: PASSWORD });
  await a.confirmStepUp("000000");
}
afterEach(() => vi.useRealTimers());

describe("the session store", () => {
  it("loads who is signed in, their places and what the bank switched on", async () => {
    const a = await alex();
    const s = a.getState();
    expect(s.session.status).toBe("ready");
    expect(s.session.info!.contexts.map((c) => c.id)).toEqual(["personal", "alpha", "beta"]);
    expect(s.workspace).toBe("personal");
    expect(s.session.settings).toEqual({ homeMarket: "us", disabled: [], options: {} });
    expect(a.context!.permissions).toContain("payments.create");
  });
  it("tells a customer with one place apart, so the classic shell is used", async () => {
    const a = make({ defaultPersona: "sam" });
    a.login(); await a.loadSession();
    expect(a.getState().session.status).toBe("unavailable");
  });
  it("starts with nothing signed in, and signing out clears the session", async () => {
    const a = await alex();
    a.logout();
    expect(a.getState().session).toMatchObject({ status: "idle", info: null });
    expect(a.getState().workspace).toBe("personal");
  });
});

describe("switching places", () => {
  it("asks for a step-up before a company, and finishes the switch once it is given", async () => {
    const a = await alex();
    expect(await a.switchContext("alpha")).toBe("step-up");
    expect(a.getState().stepUp).toMatchObject({ contextId: "alpha", phase: "password" });
    expect(a.getState().workspace).toBe("personal");
    await a.beginStepUp({ secret: PASSWORD });
    expect(a.getState().stepUp).toMatchObject({ phase: "code", busy: false });
    expect(a.getState().stepUp!.phone).toBe("+• ••• ••• 0142");
    await a.confirmStepUp("000000");
    expect(a.getState()).toMatchObject({ stepUp: null, workspace: "business", switching: null });
    expect(a.getState().session.info!.activeContextId).toBe("alpha");
    expect(a.context!.roles).toEqual(["Maker"]);
  });
  it("does not open a company on a wrong password or a wrong code", async () => {
    const a = await alex();
    await a.switchContext("beta");
    await a.beginStepUp({ secret: "nope" });
    expect(a.getState().stepUp).toMatchObject({ phase: "password", error: "That password isn't right." });
    await a.beginStepUp({ secret: PASSWORD });
    await a.confirmStepUp("111111");
    expect(a.getState().stepUp).toMatchObject({ phase: "code", error: "Incorrect code" });
    expect(a.getState().workspace).toBe("personal");
    a.cancelStepUp();
    expect(a.getState().stepUp).toBeNull();
  });
  it("accepts biometrics for the first step", async () => {
    const a = await alex();
    await a.switchContext("alpha");
    await a.beginStepUp({ method: "biometric" });
    await a.confirmStepUp("000000");
    expect(a.getState().workspace).toBe("business");
  });
  it("does not ask again within five minutes, and going back to Personal never asks", async () => {
    const a = await alex();
    await a.switchContext("alpha"); await confirm(a);
    expect(await a.switchContext("beta")).toBe("switched");
    expect(a.context!.label).toBe("Beta Services Ltd");
    expect(await a.switchContext("personal")).toBe("switched");
    expect(a.getState().workspace).toBe("personal");
  });
  it("keeps the screen up while the session is refreshed during a switch", async () => {
    const a = await alex();
    const seen = new Set<string>();
    a.subscribe(() => seen.add(a.getState().session.status));
    await a.switchContext("alpha"); await confirm(a);
    expect([...seen]).toEqual(["ready"]);
  });
  it("refuses a place the customer does not have", async () => {
    const a = await alex();
    expect(await a.switchContext("gamma")).toBe("failed");
    expect(a.getState().toast).toMatchObject({ ok: false });
  });
  it("shows 'Switching to <company>...' while it happens, then clears it", async () => {
    const a = make({ switchMs: 20 });
    a.login(); await a.loadSession();
    const seen: (string | null)[] = [];
    a.subscribe(() => { const v = a.getState().switching; if (seen.at(-1) !== v) seen.push(v); });
    await a.switchContext("alpha"); await confirm(a);
    expect(seen).toContain("Switching to Alpha Trading LLC...");
    expect(seen.at(-1)).toBeNull();
    await a.switchContext("personal");
    expect(seen.slice(-2)).toEqual(["Switching to Personal...", null]);
  });
  it("clears everything sensitive on a switch and keeps language, mode and the last tab per workspace", async () => {
    const a = await alex();
    a.setLang("ur"); a.setPrefs({ scheme: "dark" });
    a.setShellTab("cards");
    a.setSearch("taylor"); a.setFilter("tx", "pending"); a.setDraft("transfer", { amount: 50 }); a.openSheet("notes"); a.say("Saved");
    await a.openJourney("personal-transfer");
    await a.loadShell("home");
    expect(a.getState().active).not.toBeNull();
    expect(Object.keys(a.getState().views).length).toBeGreaterThan(0);

    await a.switchContext("alpha"); await confirm(a);
    const s = a.getState();
    expect(s).toMatchObject({ active: null, search: "", filters: {}, drafts: {}, sheet: null, toast: null, screen: "app", workspace: "business", lang: "ur" });
    expect(Object.keys(s.views).every((k) => k.startsWith("alpha:"))).toBe(true);
    expect(s.prefs.scheme).toBe("dark");
    expect(s.prefs.lastTab.personal).toBe("cards");
    expect(s.shellTab).toBe("overview");

    a.setShellTab("payments");
    await a.switchContext("personal");
    expect(a.getState().shellTab).toBe("cards"); // back where they were in Personal
    await a.switchContext("alpha");
    expect(a.getState().shellTab).toBe("payments");
  });
  it("leaves no company data behind after switching back", async () => {
    const a = await alex();
    await a.switchContext("beta"); await confirm(a);
    await a.loadShell("approvals"); await a.loadNotices();
    expect(JSON.stringify(a.view("approvals"))).toContain("Nimbus");
    expect(a.notices().find((n) => n.context === "beta")!.text).toContain("Nimbus");
    await a.switchContext("personal");
    expect(a.getState().views).toEqual({});
    await a.loadShell("home"); await a.loadNotices();
    expect(JSON.stringify(a.getState())).not.toMatch(/Nimbus|Harbour|8,200|PAY-20|Rhine|alpha_ops|beta_ops/);
  });
  it("drops an answer that arrives after the customer left the place", async () => {
    const a = await alex();
    let release!: (v: Screen) => void;
    const slow = a.loadView("alpha-late", () => new Promise<Screen>((r) => { release = r; }));
    await a.switchContext("alpha"); await confirm(a);
    release({ tab: "home", sections: [] });
    await slow;
    expect(a.getState().views["alpha-late"]).toBeUndefined();
  });
  it("makes the bank answer for the new place: personal calls fail in a company and the reverse", async () => {
    const a = await alex();
    await a.switchContext("alpha"); await confirm(a);
    await expect(a.bank.call("bank.accounts.list")).rejects.toMatchObject({ code: "WRONG_CONTEXT" });
    await a.switchContext("personal");
    await expect(a.bank.call("corp.company.get")).rejects.toMatchObject({ code: "WRONG_CONTEXT" });
  });
});

describe("screens and their states", () => {
  it("loads a tab once, keeps the data, and reloads on request", async () => {
    const a = await alex();
    const key = a.viewKey("home");
    const first = a.loadShell("home");
    expect(a.getState().views[key]).toMatchObject({ status: "loading" });
    await first;
    expect(a.getState().views[key]!.status).toBe("ready");
    const before = a.getState().views[key];
    await a.loadShell("home");
    expect(a.getState().views[key]).toBe(before);
    await a.loadShell("home", true);
    expect(a.getState().views[key]).not.toBe(before);
  });
  it("reports the bank's message when a screen cannot load, and loads again after a retry", async () => {
    const a = await alex();
    a.bank.conditions = { ...a.bank.conditions, unavailable: ["bank.accounts.list"] } as typeof a.bank.conditions;
    await a.loadShell("home");
    expect(a.view("home")).toMatchObject({ status: "error", code: "SERVICE_UNAVAILABLE", error: "This service is not available right now" });
    a.bank.conditions = { ...a.bank.conditions, unavailable: [] } as typeof a.bank.conditions;
    await a.loadShell("home");
    expect(a.view("home")!.status).toBe("ready");
  });
  it("shows a timeout the same way", async () => {
    const a = await alex();
    a.bank.conditions = { ...a.bank.conditions, timeout: ["bank.cards.issued"] } as typeof a.bank.conditions;
    await a.loadShell("cards");
    expect(a.view("cards")).toMatchObject({ status: "error", code: "TIMEOUT" });
  });
  it("runs out of session when the bank ends it", async () => {
    const a = await alex();
    a.bank.expireSession();
    await a.loadShell("home");
    expect(a.view("home")).toMatchObject({ status: "error", code: "SESSION_EXPIRED" });
  });
  it("counts what waits for approval at Beta and nothing at Alpha", async () => {
    const a = await alex();
    await a.switchContext("alpha"); await confirm(a);
    await a.loadShell("approvals");
    expect(a.approvalsBadge).toBe(0);
    await a.switchContext("beta");
    await a.loadShell("approvals");
    expect(a.approvalsBadge).toBe(2);
  });
});

describe("links into another place", () => {
  it("goes straight to a link in the same place, and offers to switch for another", async () => {
    const a = await alex();
    expect(a.followLink(parseLink("/personal/cards")!)).toBe("go");
    expect(a.followLink(parseLink("/business/beta/approvals")!)).toBe("offer");
    expect(a.getState().offer).toMatchObject({ companyId: "beta" });
    a.declineOffer();
    expect(a.getState().offer).toBeNull();
    expect(a.getState().workspace).toBe("personal");
  });
  it("refuses a link to a company the customer does not belong to", async () => {
    const a = await alex();
    expect(a.followLink(parseLink("/business/acme/approvals")!)).toBe("denied");
    expect(a.getState().offer).toBeNull();
  });
  it("switches first, asks for the step-up, then hands the app the link to open", async () => {
    const a = await alex();
    const link = parseLink("/business/beta/j/approve-payments?paymentId=PAY-2041")!;
    a.followLink(link);
    await a.acceptOffer();
    expect(a.getState().stepUp).toMatchObject({ contextId: "beta" });
    expect(a.getState().arrived).toBeNull();
    await confirm(a);
    expect(a.getState().workspace).toBe("business");
    expect(a.getState().arrived).toEqual(link);
    a.clearArrived();
    expect(a.getState().arrived).toBeNull();
  });
  it("does not open the link when the customer cancels the step-up", async () => {
    const a = await alex();
    a.followLink(parseLink("/business/beta/approvals")!);
    await a.acceptOffer();
    a.cancelStepUp();
    expect(a.getState()).toMatchObject({ arrived: null, workspace: "personal" });
  });
});

describe("launching a journey from a button", () => {
  it("lists the buttons of the active place from its permissions and the bank's settings", async () => {
    const a = await alex();
    const quick = a.launchPoints({ quick: true }).map((l) => l.journey);
    expect(quick).toEqual(expect.arrayContaining(["personal-transfer", "pay-bill", "mobile-topup", "add-money"]));
    await a.switchContext("beta"); await confirm(a);
    expect(a.launchPoints().every((l) => l.workspace === "business")).toBe(true);
  });
  it("gives the journey and the values it starts with", async () => {
    const a = await alex();
    const lp = a.launchPoints({ place: "payments.beneficiary" }).find((l) => l.label === "Edit")!;
    expect(a.launchTarget(lp, { beneficiaryId: "ben_taylor", junk: 1 })).toEqual({ slug: "manage-beneficiary", values: { beneficiaryId: "ben_taylor", mode: "edit" } });
  });
});

describe("notifications", () => {
  it("loads them for every place, tags them, and marks one read", async () => {
    const a = await alex();
    await a.loadNotices();
    const n = a.notices();
    expect(n.map((x) => x.context)).toEqual(["beta", "personal", "alpha"]);
    expect(n.filter((x) => !x.read).map((x) => x.id)).toEqual(["n_1"]);
    a.markRead("n_1");
    expect(a.notices().every((x) => x.read)).toBe(true);
  });
});
