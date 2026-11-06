import { describe, expect, it } from "vitest";
import { BankApp, createLive, forRow, isRowLevel, isSectionLevel, journeyOn, landingPointsFor, LANDING_POINTS, launchPointsFor, LAUNCH_POINTS } from "./index";

const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
const NOW = Date.parse("2026-11-03T10:00:00Z");
async function signedIn() {
  const a = new BankApp({ preset: "bankworkx", live: createLive({ brand: "bankworkx", fetch: down }), studioUrl: "http://studio", toastMs: 20, now: () => NOW });
  (a as any).current.now = () => NOW;
  a.login();
  await a.loadSession();
  return a;
}
const into = async (a: BankApp, id: string) => { await a.switchContext(id); await a.beginStepUp({ secret: "Bwx!Demo2026" }); await a.confirmStepUp("000000"); };
const slugs = (...s: string[]) => s.map((slug) => ({ slug }));
const ALL = slugs(...new Set(LAUNCH_POINTS.map((l) => l.journey)));
const labels = (ctx: any, place: string, level: (l: any) => boolean = () => true) => launchPointsFor({ context: ctx, entries: ALL }, { place }).filter(level).map((l) => l.label);

describe("the Admin tab and its buttons (Business)", () => {
  it("a Maker or an Approver has no admin permission: the tab offers only Open Admin (the view, which says why and offers the preview), and no journey button", async () => {
    const a = await signedIn(); await into(a, "alpha");
    for (const place of ["admin.users", "admin.limits", "admin.groups"]) expect(labels(a.context, place), place).toEqual([]);
    expect(labels(a.context, "admin.overview")).toEqual(["Open Admin"]);
    const b = await signedIn(); await into(b, "beta");
    expect(labels(b.context, "admin.users")).toEqual([]);
    expect(labels(b.context, "admin.overview")).toEqual(["Open Admin"]);
  });
  it("with the administrator preview on, the permissions follow: Invite user, Edit, Disable and Enable by what a row allows, Change limits and Edit group", async () => {
    const a = await signedIn(); await into(a, "alpha");
    await a.bank.call("bank.session.preview", { on: true });
    await a.loadSession();
    const ctx = a.context!;
    expect(ctx.roles).toEqual(["Administrator (preview)"]);
    const users = launchPointsFor({ context: ctx, entries: ALL }, { place: "admin.users" });
    expect(users.filter(isSectionLevel).map((l) => l.label)).toEqual(["Invite user"]);
    expect(forRow(users.filter(isRowLevel), { state: "editable" }).map((l) => [l.label, l.journey, l.fixed])).toEqual([["Edit", "manage-user", { mode: "edit" }], ["Disable", "manage-user", { mode: "disable" }]]);
    expect(forRow(users.filter(isRowLevel), { state: "disabled" }).map((l) => l.label)).toEqual(["Enable"]);
    expect(forRow(users.filter(isRowLevel), { state: "none" }).map((l) => l.label)).toEqual([]);
    expect(labels(ctx, "admin.limits")).toEqual(["Change limits"]);
    expect(launchPointsFor({ context: ctx, entries: ALL }, { place: "admin.groups" }).map((l) => [l.label, l.journey, l.passes])).toEqual([["Edit group", "edit-signatory-group", ["group"]]]);
  });
  it("the tab of an administrator is the bank's Admin view: the waiting change, nine people with their state, the limits, the groups and the log; Ravi's own row has no state to edit", async () => {
    const a = await signedIn(); await into(a, "alpha");
    await a.bank.call("bank.session.preview", { on: true });
    await a.loadSession();
    await a.loadShell("admin", true);
    const admin = a.view<any>("admin")!.data;
    expect(admin.sections.map((s: any) => s.id)).toEqual(["overview", "waiting", "users", "limits", "groups", "audit"]);
    const rows = (id: string) => admin.sections.find((s: any) => s.id === id).rows;
    expect(rows("waiting").map((r: any) => [r.id, r.title])).toEqual([["CHG-1042", "Raise the extra code threshold from $25,000.00 to $30,000.00"]]);
    expect(rows("users")).toHaveLength(9);
    expect(rows("users").find((r: any) => r.id === "ravi")).toMatchObject({ title: "Ravi Menon (you)", state: "none" });
    expect(rows("users").find((r: any) => r.id === "dana")).toMatchObject({ state: "editable", passes: { userId: "dana" } });
    expect(rows("users").find((r: any) => r.id === "sam")).toMatchObject({ tag: "Invited" });
    expect(rows("limits").map((r: any) => [r.title, r.value])).toEqual([["Limit per person", "$250,000.00"], ["Company daily limit", "$1,000,000.00"], ["Ceiling set by the bank", "$2,000,000.00"], ["Two approvers above", "$50,000.00"], ["Extra code from", "$25,000.00"]]);
    expect(rows("groups").map((r: any) => [r.passes.group, r.subtitle])).toEqual([["over", "In order: Dana Cruz, then Lee Park"], ["upto", "Any one of Dana Cruz, Lee Park"]]);
    expect(rows("audit")).toHaveLength(5);
  });
  it("switching company ends the preview: the context is an Approver's again and the tab shows what an Approver may see", async () => {
    const a = await signedIn(); await into(a, "alpha");
    await a.bank.call("bank.session.preview", { on: true });
    await a.loadSession();
    expect(a.context!.permissions).toContain("biz.admin.limits");
    await into(a, "beta");
    expect(a.context!.permissions).not.toContain("biz.admin.limits");
    expect(labels(a.context, "admin.users")).toEqual([]);
  });
});

describe("the More tab and the Landing (Business)", () => {
  it("every person who may see accounts gets Service requests and New request; the profile's Request a change asks for an Update", async () => {
    for (const id of ["alpha", "beta"]) {
      const a = await signedIn(); await into(a, id);
      expect(labels(a.context, "more.requests"), id).toEqual(["Service requests", "New request"]);
      expect(launchPointsFor({ context: a.context, entries: ALL }, { place: "more.profile" }).map((l) => [l.label, l.journey, l.fixed]), id).toEqual([["Request a change", "business-service-request", { type: "update" }]]);
    }
  });
  it("Business onboarding is not started from a signed-in profile any more (it is a public journey), and there is no cheque-book button on an account yet", async () => {
    expect(LAUNCH_POINTS.some((l) => l.journey === "kyb-onboarding")).toBe(false);
    expect(LAUNCH_POINTS.some((l) => l.journey === "business-service-request" && l.place === "accounts.detail")).toBe(false);
    expect(LAUNCH_POINTS.some((l) => l.fixed?.type === "limit_review" || l.fixed?.type === "chequebook")).toBe(false);
  });
  it("the Landing under the sign-in offers Open a business account when the app has the journey and the bank has not switched it off", () => {
    expect(LANDING_POINTS.find((p) => p.journey === "kyb-onboarding")).toMatchObject({ id: "business", group: "explore", label: "Open a business account" });
    expect(landingPointsFor(slugs("kyb-onboarding", "open-account") as any).map((p) => p.journey)).toEqual(["open-account", "kyb-onboarding"]);
    expect(landingPointsFor(slugs("kyb-onboarding") as any, ["kyb-onboarding"])).toEqual([]);
    expect(journeyOn("admin", { disabled: ["admin"], options: {} })).toBe(false);
    expect(journeyOn("business-requests", { disabled: [], options: { "business-requests": { enabled: false } } })).toBe(false);
  });
});
