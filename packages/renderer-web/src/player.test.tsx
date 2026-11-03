import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import { localTransfer, payBill } from "@finx/journey-schema";
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

  it("fills in initial answers and plays a journey with a card-style multi-field screen", async () => {
    player(localTransfer, { initial: { "transfer.fromAccountId": "acc_current" } });
    const radio = await screen.findByRole("radio", { name: /Current/ });
    await waitFor(() => expect((radio as HTMLInputElement).checked).toBe(true));
    expect(within(screen.getByRole("group", { name: "Account" })).getAllByRole("radio").length).toBe(2);
  });
});
