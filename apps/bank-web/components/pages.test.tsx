// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import { axeCheck, BANKWORKX, BANKWORKX_SIGNIN, BANKWORKX_STAGE, MEEZAN, nav, renderPage } from "./test-utils";
import { Login } from "./Login";
import { MeezanHome } from "./MeezanHome";
import { Guard } from "./Guard";
import { Dashboard } from "./bankworkx/Dashboard";
import { Accounts, BudgetDetail, Budgets, Wallet } from "./bankworkx/Tabs";
import { InstrumentDetail, InvestHome } from "./bankworkx/Invest";
import { BankworkxShell } from "./bankworkx/Shell";

expect.extend(matchers as any);
beforeEach(() => { vi.stubGlobal("fetch", async () => { throw new Error("Studio is not part of these tests"); }); sessionStorage.clear(); nav.push.mockClear(); nav.replace.mockClear(); nav.params = {}; nav.path = "/"; nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("sign in", () => {
  it("lists the bank's sandbox customers as radios, signs in and goes to the right first page, without accessibility violations", async () => {
    const { container } = renderPage(<Login />, MEEZAN, { signedIn: false });
    expect(await axeCheck(container)).toHaveNoViolations();
    const radios = await screen.findAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["ayesha", "bilal", "zara", "hina", "acme"]);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    await userEvent.click(radios[1]!);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(nav.push).toHaveBeenCalledWith("/meezan/home");
  });
  it("goes to Personal for BankWorkx's customer with companies, the dashboard for the others, and back to the page asked for when it is inside the bank", async () => {
    renderPage(<Login />, BANKWORKX, { signedIn: false });
    await userEvent.click(await screen.findByRole("button", { name: "Log in" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/home");
    cleanup(); nav.push.mockClear();
    renderPage(<Login />, BANKWORKX, { signedIn: false });
    await userEvent.click((await screen.findAllByRole("radio")).find((r) => (r as HTMLInputElement).value === "sam")!);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/dashboard");
    cleanup(); nav.push.mockClear();
    nav.search = new URLSearchParams("next=/bankworkx/invest/LMRB");
    renderPage(<Login />, BANKWORKX, { signedIn: false });
    await userEvent.click(await screen.findByRole("button", { name: "Log in" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/invest/LMRB");
    cleanup(); nav.push.mockClear();
    nav.search = new URLSearchParams("next=https://evil.example");
    renderPage(<Login />, BANKWORKX, { signedIn: false });
    await userEvent.click(await screen.findByRole("button", { name: "Log in" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/home");
  });
  it("sends a signed-out visitor to sign in, and shows nothing until it knows", async () => {
    nav.path = "/bankworkx/wallet";
    const { container } = renderPage(<Guard><p>secret</p></Guard>, BANKWORKX, { signedIn: false });
    expect(screen.queryByText("secret")).toBeNull();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/bankworkx/login?next=%2Fbankworkx%2Fwallet"));
    expect(container.querySelector("[aria-busy]")).toBeTruthy();
  });
  it("shows the page to a signed-in visitor", async () => {
    renderPage(<Guard><p>hello</p></Guard>, BANKWORKX);
    expect(await screen.findByText("hello")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe("sign in with the real sign-in journey (BankWorkx)", () => {
  const PW = "Bwx!Demo2026";
  it("shows the sign-in journey, not the list of sandbox customers, and keeps the picker one link away", async () => {
    const { container } = renderPage(<Login />, BANKWORKX_SIGNIN, { signedIn: false });
    expect(await screen.findByLabelText("Username")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toEqual([]);
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Use the sandbox customer picker" }));
    expect((await screen.findAllByRole("radio")).map((r) => (r as HTMLInputElement).value)).toEqual(["alex", "sam"]);
    await userEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByLabelText("Username")).toBeTruthy();
  });
  it("?picker=1 opens the picker straight away", async () => {
    nav.search = new URLSearchParams("picker=1");
    renderPage(<Login />, BANKWORKX_SIGNIN, { signedIn: false });
    expect((await screen.findAllByRole("radio")).length).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/home");
  });
  it("keeps the plain page unless the bank chose the stage in its look", async () => {
    renderPage(<Login />, BANKWORKX_SIGNIN, { signedIn: false });
    expect(await screen.findByLabelText("Username")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Welcome to/ })).toBeNull();
    expect(screen.queryByText("Starts Here.")).toBeNull();
  });
  it("frames the sign-in in the stage when the bank chose it: the bank's words beside the journey, the scene hidden from assistive technology, and forgot password opens inside it", async () => {
    const { container } = renderPage(<Login />, BANKWORKX_STAGE, { signedIn: false });
    expect(await screen.findByLabelText("Username")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Welcome to BankWorkx" })).toBeTruthy();
    expect(screen.getByText("Starts Here.")).toBeTruthy();
    expect(container.querySelector("canvas.wb-signin-canvas")?.getAttribute("aria-hidden")).toBe("true");
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await waitFor(() => expect(screen.queryByLabelText("Password")).toBeNull());
    expect(screen.getByText("Starts Here.")).toBeTruthy();
  });
  it("a wrong password says so and the field is empty again; the right one, the code from a new browser and the end of the journey open Personal", async () => {
    renderPage(<Login />, BANKWORKX_SIGNIN, { signedIn: false });
    await userEvent.type(await screen.findByLabelText("Username"), "alex.morgan");
    await userEvent.type(screen.getByLabelText("Password"), "not-my-password");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("The username or password isn’t right. Check them and try again.")).toBeTruthy();
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    await userEvent.type(screen.getByLabelText("Password"), PW);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    // a browser the bank does not know yet: a code first
    await userEvent.type(await screen.findByLabelText("One-time code, 6 digits"), "482100");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Trust this device?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: /Don’t trust/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Welcome, Alex. Taking you to your accounts.")).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Go to Home" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/bankworkx/personal/home"));
    // the tab remembers who is signed in, never the password
    expect(sessionStorage.getItem("finx.session")).toContain('"personaId":"alex"');
    expect(sessionStorage.getItem("finx.session")).not.toContain(PW);
  });
  it("a customer without companies goes to the dashboard, and the page asked for is kept when it is inside the bank", async () => {
    nav.search = new URLSearchParams("next=/bankworkx/wallet");
    renderPage(<Login />, BANKWORKX_SIGNIN, { signedIn: false });
    await userEvent.type(await screen.findByLabelText("Username"), "sam.rivera");
    await userEvent.type(screen.getByLabelText("Password"), PW);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.type(await screen.findByLabelText("One-time code, 6 digits"), "482100");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(await screen.findByRole("radio", { name: /Don’t trust/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(await screen.findByRole("button", { name: "Go to Home" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/bankworkx/wallet"));
  });
  it("Forgot username opens that journey in place, and nobody is signed in by it", async () => {
    renderPage(<Login />, BANKWORKX_SIGNIN, { signedIn: false });
    await userEvent.click(await screen.findByRole("button", { name: "Forgot username?" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Forgot your username?" })).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });
  it("a visit that was not signed in does not pick a customer: closing a journey cannot sign anyone in without a password", async () => {
    renderPage(<Login />, BANKWORKX_SIGNIN, { signedIn: false, personaId: "alex" });
    expect(await screen.findByLabelText("Username")).toBeTruthy();
    expect(sessionStorage.getItem("finx.session")).toContain('"signedIn":false');
  });
  it("keeps the picker as the sign-in of a bank without the real sign-in, as before", async () => {
    renderPage(<Login />, BANKWORKX, { signedIn: false });
    expect((await screen.findAllByRole("radio")).length).toBe(2);
    expect(screen.queryByRole("button", { name: "Back to sign in" })).toBeNull();
    expect(screen.queryByLabelText("Username")).toBeNull();
  });
});

describe("Meezan home", () => {
  it("shows the balance, the limit and the services as links, in English and Urdu", async () => {
    const { container } = renderPage(<MeezanHome />, MEEZAN);
    expect(await screen.findByText(/PKR 184,250/)).toBeTruthy();
    expect(screen.getByText(/Daily limit used PKR 0 of PKR 50,000/)).toBeTruthy();
    const services = screen.getAllByRole("link");
    expect(services.some((a) => a.getAttribute("href") === "/meezan/j/fund-transfer-local")).toBe(true);
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "اردو" }));
    expect(container.querySelector(".wb-home")!.getAttribute("dir")).toBe("rtl");
    expect(screen.getByRole("heading", { name: "سروسز" })).toBeTruthy();
  });
  it("explains a rejected customer and disables the services", async () => {
    renderPage(<MeezanHome />, MEEZAN, { personaId: "zara" });
    expect(await screen.findByText("Account opening was not approved")).toBeTruthy();
    expect(screen.queryAllByRole("link").length).toBe(0);
  });
});

describe("BankWorkx pages have no accessibility violations", () => {
  const pages: [string, () => React.ReactElement, () => void][] = [
    ["dashboard", () => <Dashboard />, () => {}],
    ["accounts", () => <Accounts />, () => {}],
    ["budgets", () => <Budgets />, () => {}],
    ["budget detail", () => <BudgetDetail />, () => { nav.params = { id: "b_food" }; }],
    ["wallet", () => <Wallet />, () => {}],
    ["invest", () => <InvestHome />, () => {}],
    ["a stock", () => <InstrumentDetail />, () => { nav.params = { symbol: "LMRB" }; }],
  ];
  for (const [name, page, prep] of pages) {
    it(name, async () => {
      prep();
      const { container } = renderPage(page(), BANKWORKX);
      await waitFor(() => expect(container.querySelector("h1, h2")).toBeTruthy());
      expect(await axeCheck(container), name).toHaveNoViolations();
    });
  }
  it("a new customer sees what to do first on the dashboard and an empty Invest, with no violations", async () => {
    const d = renderPage(<Dashboard />, BANKWORKX, { personaId: "sam" });
    expect(await screen.findByText("Let's set up your money")).toBeTruthy();
    expect(await axeCheck(d.container)).toHaveNoViolations();
    cleanup();
    const i = renderPage(<InvestHome />, BANKWORKX, { personaId: "sam" });
    expect(await screen.findByText("Nothing here yet")).toBeTruthy();
    expect(await axeCheck(i.container)).toHaveNoViolations();
  });
});

describe("BankWorkx behaviour", () => {
  it("filters transactions by money in, from the income card", async () => {
    renderPage(<Dashboard />, BANKWORKX);
    const income = await screen.findByRole("button", { name: /Income/ });
    expect(income.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(income);
    expect(income.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Money in" })).toBeTruthy();
    const list = within(screen.getByRole("heading", { name: "Money in" }).closest("section")!);
    expect(list.queryByText("Food & Drinks")).toBeNull();
    expect(list.getByText("Freelancing Work")).toBeTruthy();
  });

  it("opens a transaction's details and reads the money on a budget card", async () => {
    renderPage(<Dashboard />, BANKWORKX);
    const row = await screen.findByRole("button", { name: /Food & Drinks/ });
    expect(row.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Reference:/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Food & Drinks budget, 35 percent used" }).getAttribute("href")).toBe("/bankworkx/budgets/b_food");
  });

  it("searches accounts' transactions and groups them by day", async () => {
    renderPage(<Accounts />, BANKWORKX);
    expect(await screen.findByText("Summit Federal", { exact: false })).toBeTruthy();
    await userEvent.type(screen.getByRole("searchbox"), "starbucks");
    expect(screen.getByText("Starbucks Coffee")).toBeTruthy();
    expect(screen.queryByText("Monthly Rent")).toBeNull();
    await userEvent.clear(screen.getByRole("searchbox")); await userEvent.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText("No transactions match.")).toBeTruthy();
  });

  it("switches a budget between this week and this month, and says what can be spent a day", async () => {
    nav.params = { id: "b_food" };
    renderPage(<BudgetDetail />, BANKWORKX);
    expect(await screen.findByText(/each day for the rest of the period/)).toBeTruthy();
    expect(screen.getByText("$34")).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "This month" }));
    expect(screen.getByText("Starbucks Coffee")).toBeTruthy();
  });

  it("explores stocks: search, filter and open one", async () => {
    renderPage(<InvestHome />, BANKWORKX);
    await userEvent.click(await screen.findByRole("radio", { name: "Explore" }));
    expect(screen.getByRole("heading", { name: "Biggest movers today" })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Funds" }));
    expect(screen.getAllByRole("link").filter((a) => /GLBX|GRNF|TBND/.test(a.getAttribute("href") ?? "")).length).toBe(3);
    expect(screen.getByRole("link", { name: /Global Index Fund/ }).getAttribute("href")).toBe("/bankworkx/invest/GLBX");
  });

  it("a stock page shows the position, toggles the watchlist, and links to buy and sell with the symbol", async () => {
    nav.params = { symbol: "LMRB" };
    renderPage(<InstrumentDetail />, BANKWORKX);
    expect(await screen.findByText("Your position")).toBeTruthy();
    const star = screen.getByRole("button", { name: "Add LMRB to watchlist" });
    await userEvent.click(star);
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove LMRB from watchlist" }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByRole("link", { name: "Buy LMRB" }).getAttribute("href")).toMatch(/^\/bankworkx\/j\/invest\?symbol=LMRB$/);
    expect(screen.getByRole("link", { name: "Sell" }).getAttribute("href")).toMatch(/\/j\/sell-investment\?symbol=LMRB$/);
  });

  it("an unknown stock says so instead of failing", async () => {
    nav.params = { symbol: "NOPE" };
    renderPage(<InstrumentDetail />, BANKWORKX);
    expect(await screen.findByText("We could not find that stock or fund")).toBeTruthy();
  });
});

describe("BankWorkx frame", () => {
  it("has a skip link, a labelled main menu with the current page marked, and the account menu button", async () => {
    nav.path = "/bankworkx/wallet";
    const { container } = renderPage(<BankworkxShell><h1>Page</h1></BankworkxShell>, BANKWORKX);
    expect(await screen.findByRole("link", { name: "Skip to content" })).toBeTruthy();
    const menu = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["BankWorkx", "Dashboard", "Accounts", "Budgets", "Wallet", "Invest"]) expect(within(menu).getByRole("link", { name }), name).toBeTruthy();
    expect(within(menu).getByRole("link", { name: "Wallet" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /Account menu, Alex Morgan/ })).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
  });
});
