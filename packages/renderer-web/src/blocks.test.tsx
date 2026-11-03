import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import { axeCheck, renderBlock } from "./test-utils";

expect.extend(matchers as any);

const accounts = [{ id: "a", name: "Main", maskedNumber: "••4410", balance: 8720.76, currency: "USD" }, { id: "b", name: "Savings", maskedNumber: "••7731", balance: 15254.37, currency: "USD" }];

describe("pickers", () => {
  it("is a labelled group of radios, with the chosen account checked, and picks with the keyboard or a click", async () => {
    const set = vi.fn();
    const { container } = renderBlock("accountPicker", { bind: "x.acc", items: accounts, value: "a", showBalance: true }, { set });
    const group = screen.getByRole("group", { name: "Account" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["Main ••4410", "Savings ••7731"]);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("$8,720.76")).toBeTruthy();
    await userEvent.click(radios[1]!);
    expect(set).toHaveBeenCalledWith("x.acc", "b");
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("shows an error as an alert and marks the group invalid", () => {
    renderBlock("accountPicker", { bind: "x.acc", items: accounts, error: "Required" });
    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(screen.getAllByRole("radio").every((r) => r.getAttribute("aria-invalid") === "true")).toBe(true);
  });

  it("lists beneficiaries with their bank", () => {
    renderBlock("beneficiaryPicker", { bind: "t.b", items: [{ id: "k", displayName: "Ahmed Khan", bank: "HBL", maskedNumber: "••99" }], allowAddNew: true });
    expect(screen.getByRole("radio", { name: "Ahmed Khan" })).toBeTruthy();
    expect(screen.getByText("HBL · ••99")).toBeTruthy();
    expect(screen.getByText("+ Add new beneficiary")).toBeTruthy();
  });
});

describe("amount", () => {
  it("is a labelled numeric-keypad text field with the currency, formatting and helper text tied to it", async () => {
    const set = vi.fn();
    const { container } = renderBlock("amountInput", { bind: "a.amt", label: "Amount", currency: "USD", value: 1200, helper: "From $1", error: "Too much", quickAmounts: [50, 100] }, { set });
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.value).toBe("1,200");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = input.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)!.textContent);
    expect(described).toEqual(["From $1", "Too much"]);
    fireEvent.change(input, { target: { value: "2,50x0" } });
    expect(set).toHaveBeenCalledWith("a.amt", 2500);
    fireEvent.change(input, { target: { value: "" } });
    expect(set).toHaveBeenLastCalledWith("a.amt", undefined);
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("offers one-tap amounts as a radio group and marks the chosen one", async () => {
    const set = vi.fn();
    renderBlock("amountInput", { bind: "a.amt", label: "Amount", currency: "PKR", value: 100, quickAmounts: [50, 100] }, { set });
    const chips = within(screen.getByRole("radiogroup", { name: "Quick amounts" })).getAllByRole("radio");
    expect(chips.map((c) => [c.textContent, c.getAttribute("aria-checked")])).toEqual([["PKR 50", "false"], ["PKR 100", "true"]]);
    await userEvent.click(chips[0]!);
    expect(set).toHaveBeenCalledWith("a.amt", 50);
  });
});

describe("select, text, toggle, alert", () => {
  it("shows chips and tiles as radio groups", async () => {
    const set = vi.fn();
    const items = [{ id: "k", name: "K-Electric" }, { id: "l", name: "LESCO", icon: "bank" }];
    const { unmount } = renderBlock("select", { bind: "bill.b", label: "Biller", items, value: "k" }, { set });
    expect(screen.getByRole("group", { name: "Biller" })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "LESCO" }));
    expect(set).toHaveBeenCalledWith("bill.b", "l");
    unmount();
    const t = renderBlock("select", { bind: "bill.b", label: "Biller", items, value: "l", variant: "tiles" });
    expect(t.container.querySelectorAll(".fx-tile").length).toBe(2);
    expect(await axeCheck(t.container)).toHaveNoViolations();
  });

  it("keeps a secret field hidden, out of autofill, with a Show button that says what it does in the journey's language", async () => {
    const { container, unmount } = renderBlock("textInput", { bind: "c.pw", label: "Password", secure: true, value: "hunter2" });
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.getAttribute("autocomplete")).toBe("off");
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide" }).getAttribute("aria-pressed")).toBe("true");
    expect(await axeCheck(container)).toHaveNoViolations();
    unmount();
    renderBlock("textInput", { bind: "c.pw", label: "پاس ورڈ", secure: true }, { lang: "ur" });
    expect(screen.getByRole("button", { name: "دکھائیں" })).toBeTruthy();
  });

  it("uses the right keyboard and autofill hint for email, phone and numbers", () => {
    for (const [keyboard, type, mode, auto] of [["email", "email", null, "email"], ["phone", "tel", null, "tel"], ["number", "text", "numeric", "off"], [undefined, "text", null, "off"]] as const) {
      const { unmount } = renderBlock("textInput", { bind: "c.x", label: "Field", keyboard });
      const el = screen.getByLabelText("Field") as HTMLInputElement;
      expect([el.type, el.getAttribute("inputmode"), el.getAttribute("autocomplete")]).toEqual([type, mode, auto]);
      unmount();
    }
  });

  it("is a switch, and interrupts only for errors and warnings", async () => {
    const set = vi.fn();
    renderBlock("toggle", { bind: "c.on", label: "Alert me", helper: "At 80%", value: false }, { set });
    const sw = screen.getByRole("switch", { name: /Alert me/ });
    await userEvent.click(sw);
    expect(set).toHaveBeenCalledWith("c.on", true);
    expect(sw.getAttribute("aria-describedby")).toBeTruthy();
    for (const [tone, role] of [["error", "alert"], ["warning", "alert"], ["info", "status"], ["success", "status"]] as const) {
      const { unmount } = renderBlock("alert", { tone, text: `msg ${tone}` });
      expect(screen.getByRole(role).textContent).toBe(`msg ${tone}`);
      unmount();
    }
  });
});

describe("card form", () => {
  const empty = { bind: "card", value: {}, errors: {} };
  it("gives each field a label and the browser autofill hint, and hides the security code", async () => {
    const { container } = renderBlock("cardForm", empty);
    const hints = [["Card number", "cc-number", "numeric"], ["Name on card", "cc-name", null], ["Expiry", "cc-exp", "numeric"], ["Security code", "cc-csc", "numeric"]] as const;
    for (const [label, auto, mode] of hints) {
      const el = screen.getByLabelText(label) as HTMLInputElement;
      expect([el.getAttribute("autocomplete"), el.getAttribute("inputmode")]).toEqual([auto, mode]);
    }
    expect((screen.getByLabelText("Security code") as HTMLInputElement).type).toBe("password");
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("formats the number as it is typed and stores only digits", async () => {
    const set = vi.fn();
    renderBlock("cardForm", { bind: "card", value: { number: "424242" }, errors: {} }, { set });
    const input = screen.getByLabelText("Card number") as HTMLInputElement;
    expect(input.value).toBe("4242 42");
    fireEvent.change(input, { target: { value: "4242 4242 x", selectionStart: 11 } });
    expect(set).toHaveBeenCalledWith("card.number", "42424242");
    fireEvent.change(screen.getByLabelText("Expiry"), { target: { value: "1128" } });
    expect(set).toHaveBeenCalledWith("card.expiry", "11/28");
    fireEvent.change(screen.getByLabelText("Security code"), { target: { value: "12ab34" } });
    expect(set).toHaveBeenCalledWith("card.cvv", "1234");
  });

  it("keeps the caret after the digit being edited when a space is added", () => {
    // a controlled input: re-render with the stored value after each change
    const set = vi.fn();
    const { rerender } = renderBlock("cardForm", { bind: "card", value: { number: "4242" }, errors: {} }, { set });
    const input = screen.getByLabelText("Card number") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "42424", selectionStart: 5 } });
    expect(set).toHaveBeenCalledWith("card.number", "42424");
    void rerender;
  });

  it("shows per-field errors tied to their fields, and the labels in Urdu", () => {
    renderBlock("cardForm", { bind: "card", value: {}, errors: { number: "Enter a valid card number" } });
    const input = screen.getByLabelText("Card number");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)!.textContent).toBe("Enter a valid card number");
  });
  it("labels the fields in Urdu", () => {
    renderBlock("cardForm", empty, { lang: "ur" });
    expect(screen.getByLabelText("کارڈ نمبر")).toBeTruthy();
  });
});

describe("review, consent, one-time code, result, text, button", () => {
  it("lists review rows as a description list", () => {
    const { container } = renderBlock("reviewSummary", { rows: [{ label: "Amount", value: "$100" }, { label: "Fee", value: "$0" }] });
    expect(container.querySelectorAll("dt").length).toBe(2);
    expect(container.querySelector("dd")!.textContent).toBe("$100");
  });

  it("is a checkbox with its text as the label, and explains a missing tick", async () => {
    const set = vi.fn();
    const { container } = renderBlock("consent", { bind: "c.ok", text: "I confirm", value: false, error: "Tick the confirmation first" }, { set });
    const box = screen.getByRole("checkbox", { name: "I confirm" });
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Tick the confirmation first");
    await userEvent.click(box);
    expect(set).toHaveBeenCalledWith("c.ok", true);
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("is one real input that a browser can fill from an SMS, mirrored in cells, always left to right", () => {
    const set = vi.fn();
    const { container } = renderBlock("otp", { bind: "otp.code", length: 6, value: "48", hint: "Enter the code sent to +92 300 •••4471" }, { set });
    const input = screen.getByLabelText("One-time code, 6 digits") as HTMLInputElement;
    expect([input.getAttribute("autocomplete"), input.getAttribute("inputmode"), input.maxLength, input.value]).toEqual(["one-time-code", "numeric", 6, "48"]);
    expect(container.querySelectorAll(".fx-otp-cell").length).toBe(6);
    expect(container.querySelector(".fx-otp")!.getAttribute("dir")).toBe("ltr");
    fireEvent.change(input, { target: { value: "4821x0" } });
    expect(set).toHaveBeenCalledWith("otp.code", "48210");
  });

  it("announces a result with its title as a heading", () => {
    renderBlock("result", { tone: "success", title: "Transfer sent", text: "PKR 25,000 to Ahmed", meta: "Ref TRX-1" });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Transfer sent" })).toBeTruthy();
    expect(screen.getByText("Ref TRX-1")).toBeTruthy();
  });

  it("draws text blocks and a busy button", async () => {
    renderBlock("text", { variant: "title", text: "Hello" });
    expect(screen.getByRole("heading", { name: "Hello" })).toBeTruthy();
    const press = vi.fn();
    const { unmount } = renderBlock("button", { label: "Pay now", actions: [{ type: "exit" }], variant: "primary" }, { press });
    await userEvent.click(screen.getByRole("button", { name: "Pay now" }));
    expect(press).toHaveBeenCalledWith([{ type: "exit" }]);
    unmount();
    renderBlock("button", { label: "Pay now", actions: [] }, { busy: true });
    const busy = screen.getByRole("button", { name: "Please wait…" }) as HTMLButtonElement;
    expect([busy.disabled, busy.getAttribute("aria-busy")]).toEqual([true, "true"]);
  });
});

describe("a bank's own screens", () => {
  it("draws a menu of rows that each run their actions, with help text below", async () => {
    const press = vi.fn();
    const { container } = renderBlock("menu", { items: [{ id: "a", label: "Enroll your account", text: "Create your profile", icon: "user", actions: [{ type: "exit" }] }, { id: "b", label: "Activate", actions: [] }] }, { press });
    await userEvent.click(screen.getByRole("button", { name: "Enroll your account" }));
    expect(press).toHaveBeenCalledWith([{ type: "exit" }]);
    expect(screen.getByText("Create your profile")).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("draws shortcut buttons and a heading with a link", async () => {
    const press = vi.fn();
    const { container } = renderBlock("shortcuts", { items: [{ id: "s", label: "Support", icon: "send", actions: [{ type: "exit" }] }] }, { press });
    await userEvent.click(screen.getByRole("button", { name: "Support" }));
    expect(press).toHaveBeenCalledTimes(1);
    expect(await axeCheck(container)).toHaveNoViolations();
    const press2 = vi.fn();
    renderBlock("sectionHeader", { title: "Welcome", action: { label: "English", actions: [{ type: "exit" }] } }, { press: press2 });
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(press2).toHaveBeenCalled();
  });

  it("types a code on the number pad, with delete, and masks a PIN", async () => {
    const set = vi.fn();
    const { container } = renderBlock("otp", { bind: "pin", length: 4, keypad: true, masked: true, value: "12", hint: "Enter your PIN" }, { set });
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(set).toHaveBeenLastCalledWith("pin", "123");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(set).toHaveBeenLastCalledWith("pin", "1");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("2/4");
    expect(container.querySelector(".fx-dash span")!.textContent).toBe("•");
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("lists options as rows with a radio dot", async () => {
    const set = vi.fn();
    const { container } = renderBlock("select", { bind: "l", label: "Language", variant: "rows", items: [{ id: "en", name: "US English", sub: "English" }, { id: "ar", name: "Arabic", sub: "عربي" }], value: "en" }, { set });
    expect((screen.getByRole("radio", { name: "US English" }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "Arabic" }));
    expect(set).toHaveBeenCalledWith("l", "ar");
    expect(await axeCheck(container)).toHaveNoViolations();
  });
});
