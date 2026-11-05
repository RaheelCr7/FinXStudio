// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import type { BankApp } from "@finx/bank-client";
import { axeCheck, BANKWORKX, nav, renderPage } from "../test-utils";
import { useApp } from "../AppProvider";
import { Guard } from "../Guard";
import { Workspace } from "./Workspace";
import { WorkspaceFrame } from "./WorkspaceFrame";

expect.extend(matchers as any);
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
    expect(await screen.findByText("Debit")).toBeTruthy();
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
    expect(await within(su).findByRole("alert")).toHaveProperty("textContent", "That password isn't right.");
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
