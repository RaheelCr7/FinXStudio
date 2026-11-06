import { describe, expect, it } from "vitest";
import { BankApp, createLive, entryFor, forRow, isRowLevel, isSectionLevel, journeyAllowed, launchFromValues, launchPointsFor, launchValues, LAUNCH_POINTS } from "./index";

const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
const NOW = Date.parse("2026-11-03T10:00:00Z");
async function signedIn() {
  const a = new BankApp({ preset: "bankworkx", live: createLive({ brand: "bankworkx", fetch: down }), studioUrl: "http://studio", toastMs: 20, now: () => NOW });
  (a as any).current.now = () => NOW;
  a.login();
  await a.loadSession();
  return a;
}
const slugs = (...s: string[]) => s.map((slug) => ({ slug }));
const ALL = slugs(...new Set(LAUNCH_POINTS.map((l) => l.journey)));
const personal = async (a: BankApp) => a.context;

describe("the More tab (Personal)", () => {
  it("shows the profile with a Change button per detail, the conversations, the requests and the linked banks", async () => {
    const a = await signedIn();
    await a.loadShell("more");
    const more = a.view<any>("more")!.data;
    expect(more.sections.map((s: any) => s.id)).toEqual(["profile", "messages", "requests", "linked", "settings"]);
    const rows = (id: string) => more.sections.find((s: any) => s.id === id).rows;
    expect(rows("profile").map((r: any) => [r.id, r.title, r.passes?.field])).toEqual([
      ["name", "Alex Morgan", undefined], ["phone", "+1 415 555 0142", "phone"], ["email", "alex.morgan@example.com", "email"], ["address", "12 Harbour Road, Springfield, IL 10001", "address"],
    ]);
    expect(rows("messages").map((r: any) => [r.title, r.tag])).toEqual([["Your new card is on its way", "New"], ["Question about a monthly fee", undefined]]);
    expect(rows("messages")[0].subtitle).toBe("Your replacement debit card has been sent. It should arrive in 3 to 5 … · 2 Nov");
    expect(rows("requests").map((r: any) => [r.title, r.subtitle, r.tag])).toEqual([["Order cheque book", "28 Oct 2026 · SR-204118", "In progress"], ["Request a letter", "12 Oct 2026 · SR-203077", "Done"]]);
    expect(rows("linked").map((r: any) => [r.title, r.subtitle, r.value])).toEqual([["Summit Federal Savings", "At Summit Federal (read only) · ••9876", "$9,876.54"]]);
  });
  it("a change that waits shows Pending on its row, and the tab never shows the number of a notice's destination", async () => {
    const a = await signedIn();
    await a.bank.call("bank.otp.send", { channel: "sms", strict: true }); await a.bank.call("bank.otp.verify", { code: "482100", strict: true });
    await a.bank.call("bank.profile.update", { field: "email", value: "new.alex@example.com" });
    await a.loadShell("more", true);
    expect(a.view<any>("more")!.data.sections.find((s: any) => s.id === "profile").rows.find((r: any) => r.id === "email")).toMatchObject({ tag: "Pending", title: "alex.morgan@example.com" });
  });
  it("the Accounts tab lists what is connected apart, read only", async () => {
    const a = await signedIn();
    const s = await a.bank.call("bank.connections.start", { bankId: "harbor" });
    await a.bank.call("bank.connections.finish", { state: s.state, consent: true, pick1: true });
    await a.loadShell("accounts", true);
    const accounts = a.view<any>("accounts")!.data;
    expect(accounts.sections.map((x: any) => x.id)).toEqual(["accounts", "transactions", "linked", "budgets"]);
    expect(accounts.sections.find((x: any) => x.id === "linked").rows.map((r: any) => [r.title, r.subtitle, r.value])).toEqual([
      ["Harbor Bank Current", "At Harbor Bank (read only) · ••1137", "$2,410.45"], ["Summit Federal Savings", "At Summit Federal (read only) · ••9876", "$9,876.54"],
    ]);
    // none of them is an account the customer can pay from
    expect(accounts.sections.find((x: any) => x.id === "accounts").rows.map((r: any) => r.id)).toEqual(["acc_main", "acc_save", "acc_eur", "acc_aed"]);
  });
  it("a list that cannot be read leaves its section empty and does not take the tab down", async () => {
    const a = await signedIn();
    a.bank.conditions = { unavailable: ["bank.messages.list", "bank.requests.list", "bank.accounts.linked"] };
    await a.loadShell("more", true);
    const more = a.view<any>("more")!.data;
    expect(more.sections.find((s: any) => s.id === "messages").rows).toEqual([]);
    expect(more.sections.find((s: any) => s.id === "profile").rows.length).toBe(4);
  });
});

describe("the More buttons", () => {
  it("Change is on the rows of the profile, Request a change, New message, New request and Connect an account are on their sections", async () => {
    const a = await signedIn();
    const ctx = { context: await personal(a), entries: ALL };
    const at = (place: string, level: "row" | "section") => launchPointsFor(ctx, { place }).filter(level === "row" ? isRowLevel : isSectionLevel).map((l) => [l.label, l.journey]);
    expect(at("more.profile", "row")).toEqual([["Change", "update-profile"]]);
    expect(at("more.profile", "section")).toEqual([["Request a change", "service-request"]]);
    expect(at("more.messages", "section")).toEqual([["Read messages", "messages"], ["New message", "new-message"]]);
    expect(at("more.requests", "section")).toEqual([["My requests", "my-requests"], ["New request", "service-request"]]);
    expect(at("more.linked", "section")).toEqual([["Connect an account", "connect-account"]]);
    expect(at("accounts", "section")).toEqual(expect.arrayContaining([["Connect a bank", "connect-account"]]));
    expect(forRow(launchPointsFor(ctx, { place: "more.profile" }).filter(isRowLevel), { state: undefined }).map((l) => l.label)).toEqual(["Change"]);
  });
  it("Change passes the field, Request a change asks about the name, and a link may carry the values the journeys read", async () => {
    const change = LAUNCH_POINTS.find((l) => l.journey === "update-profile")!;
    expect(launchValues(change, { field: "phone", other: "x" })).toEqual({ field: "phone" });
    const request = LAUNCH_POINTS.find((l) => l.journey === "service-request" && l.label === "Request a change" && l.workspace === "personal")!;
    expect(launchValues(request)).toEqual({ type: "name-change" });
    expect(launchFromValues("update-profile", { what: "email", field: "phone", opt: "x", ctx: "y" })).toEqual({ "launch.what": "email", "launch.field": "phone" });
    expect(launchFromValues("new-message", { topic: "Cards", subject: "Lost card", accountId: "acc_main", text: "no" })).toEqual({ "launch.topic": "Cards", "launch.subject": "Lost card", "launch.accountId": "acc_main" });
    expect(launchFromValues("service-request", { type: "cheque", branch: "x" })).toEqual({ "launch.type": "cheque" });
    expect(launchFromValues("connect-account", { bank: "maple", state: "x" })).toEqual({ "launch.bank": "maple" });
  });
  it("the two views open from a link and the command bar with the permission of the place, and the buttons follow the permissions of their journey", async () => {
    const a = await signedIn();
    const personalCtx = await personal(a)!;
    for (const j of ["messages", "my-requests", "update-profile", "new-message", "service-request", "connect-account"]) expect(journeyAllowed(j, { context: personalCtx, entries: ALL }), j).toBe(true);
    const none = { ...personalCtx!, permissions: [] };
    for (const j of ["messages", "my-requests", "update-profile", "new-message", "connect-account"]) expect(journeyAllowed(j, { context: none, entries: ALL }), j).toBe(false);
    const noSend = { ...personalCtx!, permissions: personalCtx!.permissions.filter((p) => p !== "messages.send") };
    expect(launchPointsFor({ context: noSend, entries: ALL }, { place: "more.messages" }).map((l) => l.label)).toEqual(["Read messages"]);
    expect(launchPointsFor({ context: noSend, entries: ALL }, { place: "more.profile" }).map((l) => l.label)).toEqual(["Change"]);
    const off = { context: personalCtx, entries: ALL, settings: { disabled: ["messages", "new-message"], options: {} } };
    expect(launchPointsFor(off, { place: "more.messages" })).toEqual([]);
    expect(launchPointsFor({ context: personalCtx, entries: ALL, settings: { disabled: ["my-requests"], options: {} } }, { place: "more.requests" }).map((l) => l.label)).toEqual(["New request"]);
    expect(entryFor("my-requests", slugs("my-requests-acme"))).toBe("my-requests-acme");
  });
  it("Business keeps its own More buttons", async () => {
    const a = await signedIn();
    await a.switchContext("alpha"); await a.beginStepUp({ secret: "Bwx!Demo2026" }); await a.confirmStepUp("000000");
    const ctx = { context: a.context, entries: ALL };
    expect(launchPointsFor(ctx, { place: "more.requests" }).map((l) => l.journey)).toEqual(["business-service-request"]);
    expect(launchPointsFor(ctx, { place: "more.profile" }).map((l) => l.journey)).toEqual(expect.not.arrayContaining(["update-profile"]));
  });
});
