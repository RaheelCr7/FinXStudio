import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import { cabJourneys, internalTransfer, localTransfer, mobileTopup, payBill } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyPlayer } from "./JourneyPlayer";
import { axeCheck } from "./test-utils";

expect.extend(matchers as any);

const player = (journey = payBill, props: Record<string, any> = {}, persona = "ayesha") => {
  const bank = new MockBank(persona);
  return { bank, ...render(<JourneyPlayer journey={journey} adapter={(id, input) => bank.call(id, input)} {...props} />) };
};

describe("JourneyPlayer", () => {
  it("shows the first screen with a title, a step list, labelled fields and a continue button, with no accessibility violations", async () => {
    const { container } = player();
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Pay a bill");
    expect(screen.getByRole("list", { name: "Step 1 of 3" })).toBeTruthy();
    expect(screen.getByLabelText("Consumer number")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Find my bill" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("explains what is missing and moves focus to the first field with a mistake", async () => {
    player();
    await userEvent.click(await screen.findByRole("button", { name: "Find my bill" }));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toContain("Required");
    await waitFor(() => expect((document.activeElement as HTMLElement).getAttribute("aria-invalid")).toBe("true"));
  });

  it("scrolls the first field with a mistake into view, so a mistake below the fold is not missed", async () => {
    const scrolled = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrolled as any;
    try {
      player();
      await userEvent.click(await screen.findByRole("button", { name: "Find my bill" }));
      await waitFor(() => expect(scrolled).toHaveBeenCalled());
      expect(scrolled.mock.contexts[0]).toHaveProperty("className", expect.stringContaining("fxc-field"));
    } finally { Element.prototype.scrollIntoView = original; }
  });

  it("moves focus to the new screen's title, and offers a back button that returns", async () => {
    player();
    await userEvent.click(await screen.findByRole("radio", { name: "K-Electric" }));
    await userEvent.type(screen.getByLabelText("Consumer number"), "0123456789");
    await userEvent.click(screen.getByRole("radio", { name: /Current/ }));
    await userEvent.click(screen.getByRole("button", { name: "Find my bill" }));
    const h1 = await screen.findByRole("heading", { level: 1, name: "Review bill" });
    await waitFor(() => expect(document.activeElement).toBe(h1));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Pay a bill");
  });

  it("goes through a payment to a result, with the one-time code field, and calls onExit from the last button", async () => {
    let exited = false;
    const { bank } = player(payBill, { onExit: () => { exited = true; } });
    await userEvent.click(await screen.findByRole("radio", { name: "K-Electric" }));
    await userEvent.type(screen.getByLabelText("Consumer number"), "0123456789");
    await userEvent.click(screen.getByRole("radio", { name: /Current/ }));
    await userEvent.click(screen.getByRole("button", { name: "Find my bill" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /confirm/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm and send OTP" }));
    const code = await screen.findByLabelText("One-time code, 6 digits");
    await userEvent.type(code, "482100");
    await userEvent.click(screen.getByRole("button", { name: "Pay now" }));
    expect((await screen.findByRole("heading", { level: 2, name: "Bill paid" })).textContent).toBe("Bill paid");
    expect((await bank.call("bank.accounts.list")).acc_current.balance).toBe(184250 - 7789);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(exited).toBe(true));
  });

  it("submits the primary action when Enter submits the form", async () => {
    player();
    await userEvent.click(await screen.findByRole("radio", { name: "K-Electric" }));
    const form = screen.getByLabelText("Consumer number").closest("form")!;
    await act(async () => { fireEvent.submit(form); });
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  });

  it("reads right to left in Urdu, mirrors the back arrow, and keeps the button labels in Urdu", async () => {
    const { container } = player(payBill, { lang: "ur" });
    await screen.findByRole("heading", { level: 1 });
    const root = container.querySelector(".fx-player")!;
    expect([root.getAttribute("dir"), root.getAttribute("lang")]).toEqual(["rtl", "ur"]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("بل ادا کریں");
    expect(screen.getByRole("button", { name: "میرا بل تلاش کریں" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "بند کریں" })).toBeTruthy();
  });

  it("opens at the step the launch values choose, before the first screen shows", async () => {
    player(mobileTopup, { launch: { "launch.operatorId": "bright" } }, "alextopup");
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Mobile number");
    expect(screen.queryByText("Choose your operator")).toBeNull();
  });

  it("hands over to the journey a journey opens, and says so when the app cannot", async () => {
    const asked: any[] = [];
    const first = player(internalTransfer, { onOpenJourney: (r: any) => asked.push(r) }, "alexpayees");
    await waitFor(() => expect(asked).toEqual([{ journey: "personal-transfer", launch: { "launch.type": "internal" } }]));
    first.unmount();
    // no app to open it (the Studio preview): the person sees why nothing happened, nothing breaks
    player(internalTransfer, {}, "alexpayees");
    expect((await screen.findByRole("alert")).textContent).toBe("This step opens another journey, which is not loaded here.");
  });

  it("fills in initial answers and plays a journey with a card-style multi-field screen", async () => {
    player(localTransfer, { initial: { "transfer.fromAccountId": "acc_current" } });
    const radio = await screen.findByRole("radio", { name: /Current/ });
    await waitFor(() => expect((radio as HTMLInputElement).checked).toBe(true));
    expect(within(screen.getByRole("group", { name: "Account" })).getAllByRole("radio").length).toBe(2);
  });
});

describe("a bank with its own look", () => {
  const look = { chrome: "bar" as const, fields: "outlined" as const, pageBg: "#F1F5F8", bar: "#00853E", logo: "data:image/png;base64,iVBORw0KGgo=" };
  const cab = (slug: string) => cabJourneys.find((j) => j.slug === slug)!;
  const cabPlayer = (slug: string) => { const bank = new MockBank("nour"); return render(<JourneyPlayer journey={cab(slug)} adapter={(id, input) => bank.call(id, input)} look={look} brandName="CAB" />); };

  it("opens on the bank's banner with its logo, shortcuts last, and no visible app bar", async () => {
    const { container } = cabPlayer("sign-in");
    expect(await screen.findByRole("img", { name: "CAB" })).toBeTruthy();
    expect(container.querySelector(".fx-player")!.getAttribute("data-chrome")).toBe("bar");
    expect(container.querySelector(".fx-player")!.hasAttribute("data-hero")).toBe(true);
    expect(screen.getByRole("button", { name: "Existing user login" })).toBeTruthy();
    expect(container.querySelector(".fx-player-body")!.lastElementChild!.querySelector(".fxc-shortcuts")).toBeTruthy();
    expect((container.querySelector(".fx-player") as HTMLElement).style.getPropertyValue("--bar-bg")).toBe("#00853E");
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("draws outlined fields with the label as the placeholder, and an eye on the password", async () => {
    const { container } = cabPlayer("sign-in");
    await userEvent.click(await screen.findByRole("button", { name: "Existing user login" }));
    const user = await screen.findByLabelText("Username");
    expect(user.getAttribute("placeholder")).toBe("Username");
    expect(user.closest(".fxc-field")!.classList.contains("is-outlined")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("opens the call pop-up over the screen: named by its heading, Escape closes it, and it passes the accessibility check", async () => {
    const { container } = cabPlayer("support");
    await userEvent.click(await screen.findByRole("button", { name: "Call Us" }));
    const dialog = await screen.findByRole("dialog", { name: "Call us" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("+96112025050");
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the places of a search as pins, each a named button, and a pin opens that place", async () => {
    const { container } = cabPlayer("locate-us");
    await userEvent.click(await screen.findByRole("button", { name: "List view" }));
    const group = await screen.findByRole("group", { name: "Locations on the map" });
    const pin = await screen.findByRole("button", { name: "Abdoun Branch – Signature", pressed: false });
    expect(group.contains(pin)).toBe(true);
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.click(pin);
    expect((await screen.findAllByText("Abdoun Branch – Signature")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("group", { name: "Locations on the map" })).toBeNull(); // it is on the details screen now
  });

  it("keeps the standard look when the bank has none", async () => {
    const bank = new MockBank("nour");
    const { container } = render(<JourneyPlayer journey={cab("sign-in")} adapter={(id, input) => bank.call(id, input)} />);
    await screen.findByRole("button", { name: "Existing user login" });
    expect(container.querySelector(".fx-player")!.hasAttribute("data-chrome")).toBe(false);
  });
});
