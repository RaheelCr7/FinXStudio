// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import { axeCheck, CORPORATE, nav, renderPage } from "./test-utils";
import { Login } from "./Login";
import { CorporateHome } from "./corporate/Home";

expect.extend(matchers as any);
beforeEach(() => { vi.stubGlobal("fetch", async () => { throw new Error("Studio is not part of these tests"); }); sessionStorage.clear(); nav.push.mockClear(); nav.replace.mockClear(); nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const fill = async (user: string, pass: string) => {
  await userEvent.type(await screen.findByLabelText("Username"), user);
  if (pass) await userEvent.type(screen.getByLabelText("Password"), pass);
};

describe("corporate sign in", () => {
  it("has no accessibility violations and keeps Sign in off until both fields have text", async () => {
    const { container } = renderPage(<Login />, CORPORATE, { signedIn: false });
    expect(await axeCheck(container)).toHaveNoViolations();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);
    await fill("jsmith.ops", "x");
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("shows the bank's message and clears the password for a wrong password or a locked profile", async () => {
    renderPage(<Login />, CORPORATE, { signedIn: false });
    await fill("jsmith.ops", "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect username or password.");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    expect(nav.push).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("Username"));
    await fill("locked.user", "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/locked/);
  });
  it("signs in with the sandbox password and goes home, or back to the page asked for inside the bank", async () => {
    renderPage(<Login />, CORPORATE, { signedIn: false });
    await fill("jsmith.ops", "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(nav.push).toHaveBeenCalledWith("/acme-corporate/home");
    cleanup(); nav.push.mockClear();
    nav.search = new URLSearchParams("next=https://evil.example");
    renderPage(<Login />, CORPORATE, { signedIn: false });
    await fill("jsmith.ops", "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(nav.push).toHaveBeenCalledWith("/acme-corporate/home");
  });
  it("links to the three help journeys and says when a session has expired", async () => {
    nav.search = new URLSearchParams("expired=1");
    renderPage(<Login />, CORPORATE, { signedIn: false });
    expect((await screen.findByRole("alert")).textContent).toContain("Your session has expired");
    expect(screen.getByRole("link", { name: "Enroll" }).getAttribute("href")).toBe("/acme-corporate/access/enroll");
    expect(screen.getByRole("link", { name: "Activate your profile" }).getAttribute("href")).toBe("/acme-corporate/access/activate-profile");
    expect(screen.getByRole("link", { name: "Can't sign in?" }).getAttribute("href")).toBe("/acme-corporate/access/cant-sign-in");
  });
  it("asks before changing language", async () => {
    renderPage(<Login />, CORPORATE, { signedIn: false });
    await userEvent.click(await screen.findByRole("button", { name: /Language/ }));
    expect(screen.getByRole("alertdialog").textContent).toContain("Are you sure you want to change language");
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("corporate home and idle timeout", () => {
  it("lists the accounts without accessibility violations", async () => {
    const { container } = renderPage(<CorporateHome />, CORPORATE);
    expect(await screen.findByText("Operating")).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
  });
  it("warns before the session ends, extends on request, and signs out with the expiry notice when idle", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    renderPage(<CorporateHome idleMs={10_000} warnMs={6_000} />, CORPORATE);
    await act(async () => { await vi.advanceTimersByTimeAsync(7_000); });
    expect(screen.getByRole("alertdialog").textContent).toContain("about to expire");
    await act(async () => { screen.getByRole("button", { name: "Extend session" }).click(); await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/acme-corporate/login?expired=1"));
  });
});
