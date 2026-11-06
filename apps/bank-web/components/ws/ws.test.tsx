// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import type { BankApp } from "@finx/bank-client";
import { PERSONAL_PERMISSIONS } from "@finx/mock-bank-api";
import { axeCheck, BANKWORKX, nav, renderPage } from "../test-utils";
import { useApp } from "../AppProvider";
import { Guard } from "../Guard";
import { Workspace } from "./Workspace";
import { WorkspaceFrame } from "./WorkspaceFrame";

expect.extend(matchers as any);
// the journey player is the real one; this only records what the shell hands it as the person's permissions
const played = vi.hoisted(() => ({ sessions: [] as unknown[] }));
vi.mock("@finx/renderer-web", async (orig) => {
  const real = await orig<typeof import("@finx/renderer-web")>();
  return { ...real, JourneyPlayer: (p: any) => { played.sessions.push(p.session); return <real.JourneyPlayer {...p} />; } };
});
let app: BankApp;
const Probe = () => { app = useApp().app; return null; };
const shell = (path: string) => { nav.path = path; return renderPage(<><Probe /><Guard><WorkspaceFrame><Workspace /></WorkspaceFrame></Guard></>, BANKWORKX); };
beforeEach(() => { vi.stubGlobal("fetch", async () => { throw new Error("Studio is not part of these tests"); }); sessionStorage.clear(); nav.push.mockClear(); nav.replace.mockClear(); nav.params = {}; nav.search = new URLSearchParams(); delete document.documentElement.dataset.workspace; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** Opens Alpha or Beta through the real dialogs: the switcher, then the password and the code. */
async function enter(company: string) {
  await userEvent.click(await screen.findByRole("button", { name: /^Workspace:/ }));
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(company) }));
  const su = await screen.findByRole("dialog", { name: "Confirm it's you" });
  await userEvent.type(within(su).getByLabelText("Password"), "Bwx!Demo2026");
  await userEvent.click(within(su).getByRole("button", { name: "Continue" }));
  await userEvent.type(await within(su).findByLabelText(/^Code sent to/), "000000");
  await userEvent.click(within(su).getByRole("button", { name: "Continue" }));
}

describe("session.permissions in a journey", () => {
  const permissionsHanded = () => (played.sessions.at(-1) as { permissions: string[] } | undefined)?.permissions;
  beforeEach(() => { played.sessions.length = 0; });
  it("the shell hands the player the permissions of the place the journey opens in: Personal's, then Alpha's as a Maker", async () => {
    nav.path = "/bankworkx/personal/j/mobile-topup";
    shell("/bankworkx/personal/j/mobile-topup");
    await waitFor(() => expect(permissionsHanded()).toBeTruthy(), { timeout: 5000 });
    expect(permissionsHanded()).toEqual(PERSONAL_PERMISSIONS);
    expect(permissionsHanded()).toContain("payments.create");
    cleanup(); played.sessions.length = 0;
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await enter("Alpha Trading LLC");
    await waitFor(() => expect(document.documentElement.dataset.workspace).toBe("business"));
    nav.path = "/bankworkx/business/alpha/j/supplier-payment";
    await act(async () => { app.bump(); });
    await waitFor(() => expect(permissionsHanded()).toBeTruthy());
    expect(permissionsHanded()).toContain("biz.payments.initiate");
    expect(permissionsHanded()).not.toContain("biz.approvals.approve");
    expect(permissionsHanded()).not.toContain("payments.create");
  });
});

describe("Personal", () => {
  it("draws the balance, the accounts and the quick actions from the bank, without accessibility violations", async () => {
    nav.path = "/bankworkx/personal/home";
    const { container } = shell("/bankworkx/personal/home");
    expect(await screen.findByText("$23,975.13")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy();
    for (const name of ["Send money", "Pay a bill", "Top up", "Add money"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link").slice(1).map((l) => l.textContent)).toEqual(["Home", "Accounts", "Payments", "Cards", "Save & Borrow", "More"]);
    expect(document.documentElement.dataset.workspace).toBe("personal");
    expect(await axeCheck(container)).toHaveNoViolations();
  });
  it("opens a journey from a button with the launch point's address", async () => {
    shell("/bankworkx/personal/home");
    await userEvent.click(await screen.findByRole("button", { name: "Send money" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/j/personal-transfer");
  });
  it("starts the journey with the values in the address: ?operatorId=aster skips the operator step of Mobile top-up", async () => {
    nav.search = new URLSearchParams("operatorId=aster&junk=1");
    try {
      shell("/bankworkx/personal/j/mobile-topup");
      expect(await screen.findByRole("heading", { name: "Mobile number", level: 1 }, { timeout: 5000 })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Choose your operator" })).toBeNull();
    } finally { nav.search = new URLSearchParams(); }
  });
  it("shows a row's buttons with the values the row passes in", async () => {
    shell("/bankworkx/personal/payments");
    await userEvent.click(await screen.findByRole("button", { name: /Taylor Brooks/ }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/j/manage-beneficiary?beneficiaryId=ben_taylor&mode=edit");
  });
  it("shows a loading state, then the error with a retry, then the data", async () => {
    shell("/bankworkx/personal/cards");
    await screen.findByRole("heading", { name: "Cards", level: 1 });
    app.bank.conditions = { ...app.bank.conditions, unavailable: ["bank.cards.issued"] } as typeof app.bank.conditions;
    await app.loadShell("cards", true);
    expect(await screen.findByText("This service is not available right now")).toBeTruthy();
    app.bank.conditions = { ...app.bank.conditions, unavailable: [] } as typeof app.bank.conditions;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Everyday debit")).toBeTruthy();
  });
  it("shows an empty state for a place with nothing in it", async () => {
    shell("/bankworkx/personal/payments");
    await screen.findByRole("heading", { name: "Payments" });
    app.bank.conditions = { ...app.bank.conditions, empty: ["bank.beneficiaries.list", "bank.schedules.list"] } as typeof app.bank.conditions;
    await app.loadShell("payments", true);
    expect(await screen.findByText("Nothing here yet")).toBeTruthy();
  });
  it("tells the customer when the bank ended the session", async () => {
    shell("/bankworkx/personal/cards");
    await screen.findByRole("heading", { name: "Cards", level: 1 });
    app.bank.expireSession();
    await app.loadShell("cards", true);
    expect(await screen.findByText("You were signed out")).toBeTruthy();
  });
});

describe("switching to a company", () => {
  it("asks for the password and the code, then draws the company in its own theme with the role and the approvals badge", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await enter("Beta Services Ltd");
    await waitFor(() => expect(document.documentElement.dataset.workspace).toBe("business"));
    expect(await screen.findByRole("button", { name: /Workspace: Beta Services Ltd/ })).toBeTruthy();
    expect(screen.getAllByText("Approver").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link").slice(1).map((l) => l.textContent?.replace(/\d+$/, ""))).toEqual(["Overview", "Accounts", "Payments", "Approvals", "Admin", "More"]);
    expect(screen.getByLabelText("2 waiting")).toBeTruthy();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/bankworkx/business/beta/overview"));
    expect(screen.queryByText("$23,975.13")).toBeNull();
  });
  it("keeps the customer out of a company on a wrong password", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await userEvent.click(await screen.findByRole("button", { name: /^Workspace:/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Alpha Trading LLC/ }));
    const su = await screen.findByRole("dialog", { name: "Confirm it's you" });
    await userEvent.type(within(su).getByLabelText("Password"), "wrong");
    await userEvent.click(within(su).getByRole("button", { name: "Continue" }));
    expect(await within(su).findByRole("alert")).toHaveProperty("textContent", "That password isn't right. 4 tries left.");
    expect(document.documentElement.dataset.workspace).toBe("personal");
  });
  it("offers to switch for an address into a company, and goes back to Personal when declined", async () => {
    shell("/bankworkx/business/beta/approvals");
    const offer = await screen.findByRole("dialog", { name: "Switch to Beta Services Ltd?" });
    await userEvent.click(within(offer).getByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Nimbus Logistics")).toBeNull();
    expect(screen.getByRole("heading", { name: "Switch to Beta Services Ltd" })).toBeTruthy();
  });
  it("refuses an address into a company the customer does not belong to", async () => {
    shell("/bankworkx/business/acme/approvals");
    expect((await screen.findAllByText("You don't have access to that.")).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Back to Personal" }));
    expect(nav.replace).toHaveBeenCalledWith("/bankworkx/personal/home");
  });
  it("draws Admin as no access for a Maker", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await enter("Alpha Trading LLC");
    await waitFor(() => expect(document.documentElement.dataset.workspace).toBe("business"));
    cleanup();
    nav.path = "/bankworkx/business/alpha/admin";
    const { container } = renderPage(<><Probe /><Guard><WorkspaceFrame><Workspace /></WorkspaceFrame></Guard></>, BANKWORKX);
    // a fresh page is Personal again (the sandbox bank lives in memory): the address offers to switch first
    expect(await screen.findByRole("dialog", { name: "Switch to Alpha Trading LLC?" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Harbour/);
  });
});

describe("notifications", () => {
  it("lists them with the other places as a pointer only, and offers to switch for a company's", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await userEvent.click(screen.getByRole("button", { name: /^Notifications/ }));
    const list = await screen.findByRole("dialog", { name: "Notifications" });
    expect(await within(list).findByText(/Salary received/)).toBeTruthy();
    expect(list.textContent).not.toMatch(/Nimbus/);
    await userEvent.click(within(list).getByRole("button", { name: /Beta Services Ltd/ }));
    expect(await screen.findByRole("dialog", { name: "Switch to Beta Services Ltd?" })).toBeTruthy();
  });
});

describe("the command bar", () => {
  it("opens with the keyboard shortcut, finds a place and goes there", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await userEvent.keyboard("{Control>}k{/Control}");
    const box = await screen.findByRole("combobox", { name: "Search or go to" });
    await userEvent.type(box, "cards");
    await userEvent.keyboard("{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/cards");
  });
  it("starts a journey the person may use, and lists nothing else", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await userEvent.keyboard("{Control>}k{/Control}");
    const box = await screen.findByRole("combobox", { name: "Search or go to" });
    await userEvent.type(box, "top up");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/j/mobile-topup");
  });
});

describe("Settings > Security and the session", () => {
  it("the More tab has a Security row that goes to its page", async () => {
    shell("/bankworkx/personal/more");
    const link = await screen.findByRole("link", { name: /Security/ });
    expect(link.getAttribute("href")).toBe("/bankworkx/personal/more/settings/security");
  });

  it("draws the password, the sign-in methods, the devices and the login history, with the buttons the place may use and no biometrics on the web, without accessibility violations", async () => {
    const { container } = shell("/bankworkx/personal/more/settings/security");
    expect(await screen.findByRole("heading", { name: "Security", level: 1 })).toBeTruthy();
    expect(await screen.findByText("Last changed 2 May 2026")).toBeTruthy();
    expect(screen.getByText("3 of 5")).toBeTruthy();
    expect(screen.getByText("Not set")).toBeTruthy();
    for (const name of ["Change password", "Set up", "Change", "Manage"]) expect(screen.getAllByRole("button", { name }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Biometrics/)).toBeNull();
    // the history: twelve sign-ins, the chips say what happened, the address is partly hidden
    expect(await screen.findByRole("table")).toBeTruthy();
    const rows = within(screen.getByRole("table"));
    expect(rows.getAllByText("Signed in").length).toBeGreaterThan(5);
    expect(rows.getByText("Wrong password")).toBeTruthy();
    expect(screen.getByText("New device code")).toBeTruthy();
    expect(screen.queryByText(/\d+\.\d+\.\d+\.\d+(?!•)/)).toBeNull();
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("filters the history: the result, and a way back when nothing matches", async () => {
    shell("/bankworkx/personal/more/settings/security");
    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Result"), "failed");
    const table = () => within(screen.getByRole("table"));
    await waitFor(() => expect(table().queryByText("New device code")).toBeTruthy());
    expect(table().queryAllByText("Signed in")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(table().getAllByText("Signed in").length).toBeGreaterThan(5));
    await userEvent.selectOptions(screen.getByLabelText("Period"), "7");
    await waitFor(() => expect(table().queryByText("Wrong password")).toBeNull());
  });

  it("opens a row's details with the way to change the password", async () => {
    shell("/bankworkx/personal/more/settings/security");
    await userEvent.click((await screen.findAllByRole("button", { name: /Nov 2026/ }))[0]!);
    const d = await screen.findByRole("dialog", { name: "Sign-in details" });
    expect(within(d).getByText("How you signed in")).toBeTruthy();
    expect(within(d).getByText(/We also recommend you change your password/)).toBeTruthy();
    expect(within(d).getByRole("button", { name: "Change password" })).toBeTruthy();
  });

  it("asks it is the person before a security journey (password, then code) and opens the journey once it is, then not again for five minutes", async () => {
    shell("/bankworkx/personal/more/settings/security");
    await userEvent.click((await screen.findAllByRole("button", { name: "Manage" }))[0]!);
    const su = await screen.findByRole("dialog", { name: "Confirm it's you" });
    expect(within(su).getByText(/To trusted devices\./)).toBeTruthy();
    await userEvent.type(within(su).getByLabelText("Password"), "nope");
    await userEvent.click(within(su).getByRole("button", { name: "Continue" }));
    expect((await within(su).findByRole("alert")).textContent).toBe("That password isn't right. 4 tries left.");
    expect(nav.push).not.toHaveBeenCalled();
    await userEvent.clear(within(su).getByLabelText("Password"));
    await userEvent.type(within(su).getByLabelText("Password"), "Bwx!Demo2026");
    await userEvent.click(within(su).getByRole("button", { name: "Continue" }));
    await userEvent.type(await within(su).findByLabelText(/^Code sent to/), "000000");
    await userEvent.click(within(su).getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/j/trusted-devices"));
    // a second one inside the five minutes goes straight in
    nav.push.mockClear();
    await userEvent.click((await screen.findAllByRole("button", { name: "Change password" }))[0]!);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/j/change-password"));
    expect(screen.queryByRole("dialog", { name: "Confirm it's you" })).toBeNull();
  });

  it("a security journey opened by its address asks first too, and Back leaves", async () => {
    shell("/bankworkx/personal/j/change-password");
    expect(await screen.findByText("Confirm it’s you first")).toBeTruthy();
    expect(await screen.findByRole("dialog", { name: "Confirm it's you" })).toBeTruthy();
    await userEvent.click(within(screen.getByRole("dialog", { name: "Confirm it's you" })).getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/more/settings/security");
  });

  it("warns before the timeout, keeps the session on request and signs out when the time is up", async () => {
    const real = Date.now();
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    const at = (s: number) => vi.spyOn(Date, "now").mockReturnValue(real + s * 1000);
    at(250); (app as any).idleTick();
    const warn = await screen.findByRole("dialog", { name: "Still there?" });
    expect(within(warn).getByText(/we’ll sign you out in/)).toBeTruthy();
    expect(within(warn).getByText(/^5[01]$/)).toBeTruthy();
    await userEvent.click(within(warn).getByRole("button", { name: "Stay signed in" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Still there?" })).toBeNull());
    expect(app.getState().screen).toBe("app");
    at(250 + 300); (app as any).idleTick();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/bankworkx/login?next=%2Fbankworkx%2Fpersonal%2Fhome"));
    expect(app.getState()).toMatchObject({ screen: "login", notice: "expired" });
    vi.restoreAllMocks();
  });

  it("Log out asks once, and Cancel changes nothing", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    const d = await screen.findByRole("dialog", { name: "Sign out?" });
    expect(within(d).getByText("You’ll need to sign in again.")).toBeTruthy();
    await userEvent.click(within(d).getByRole("button", { name: "Cancel" }));
    expect(app.getState().screen).toBe("app");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Sign out?" })).getByRole("button", { name: "Sign out" }));
    expect(app.getState().screen).toBe("login");
    expect(nav.replace).toHaveBeenCalledWith("/bankworkx/login");
    expect(sessionStorage.getItem("finx.session") ?? "").not.toContain("\"signedIn\":true");
  });

  it("says when the network is gone and when it is back", async () => {
    shell("/bankworkx/personal/home");
    await screen.findByText("$23,975.13");
    window.dispatchEvent(new Event("offline"));
    expect((await screen.findByRole("status", { name: "" })).textContent ?? "").toContain("You’re offline. We’ll reconnect when you are.");
    window.dispatchEvent(new Event("online"));
    expect(await screen.findByText("You’re back online")).toBeTruthy();
  });

  it("a screen that cannot load says the bank is unavailable and offers to try again, keeping what was there", async () => {
    shell("/bankworkx/personal/cards");
    await screen.findByRole("heading", { name: "Cards", level: 1 });
    app.bank.conditions = { unavailable: ["bank.cards.issued"] };
    await app.loadShell("cards", true);
    expect((await screen.findByRole("alert")).textContent).toContain("This service is not available right now");
    app.bank.conditions = {};
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
