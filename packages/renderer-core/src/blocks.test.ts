import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES, KEYPAD_ROWS, accountRows, amountText, applyKey, beneficiaryRows, cardFields, cardNetwork, cardPictureDigits, cleanCardNumber, cleanCvv, cleanOtp, expiryText, groupCard, keyboardKind,
  otpCells, otpLabel, parseAmountText, prefixOf, quickAmounts, selectChoices, symbolOf,
} from "./index";

describe("block contract", () => {
  it("lists every block type of the schema", () => {
    expect([...BLOCK_TYPES].sort()).toEqual(["accordion", "accountPicker", "alert", "amountInput", "avatar", "balanceList", "beneficiaryPicker", "button", "cardForm", "consent", "dateInput", "dialog", "divider", "hero", "map", "menu", "otp", "result", "reviewSummary", "sectionHeader", "select", "shortcuts", "stepper", "text", "textInput", "toggle"]);
  });
});

describe("amounts", () => {
  it("uses short symbols and spaces codes", () => {
    expect([symbolOf("USD"), symbolOf("PKR"), symbolOf("XYZ")]).toEqual(["$", "PKR", "XYZ"]);
    expect([prefixOf("USD"), prefixOf("PKR")]).toEqual(["$", "PKR "]);
  });
  it("reads and shows typed amounts", () => {
    expect([amountText(12000), amountText(undefined), amountText(0)]).toEqual(["12,000", "", ""]);
    expect([parseAmountText("1,2a0"), parseAmountText("abc"), parseAmountText("")]).toEqual([120, undefined, undefined]);
  });
  it("describes the quick amount buttons and which is chosen", () => {
    expect(quickAmounts({ currency: "USD", quickAmounts: [50, 1000], value: 1000 })).toEqual([
      { value: 50, label: "$50", aria: "$50", selected: false }, { value: 1000, label: "$1,000", aria: "$1000", selected: true },
    ]);
    expect(quickAmounts({ currency: "PKR", value: 1 })).toEqual([]);
    expect(quickAmounts({ currency: "PKR", quickAmounts: [500] })[0]!.label).toBe("PKR 500");
  });
});

describe("pickers and choices", () => {
  it("shows accounts with balances only when asked", () => {
    const items = [{ id: "a", name: "Main", maskedNumber: "••4410", balance: 8720.76, currency: "USD" }];
    expect(accountRows({ items, value: "a", showBalance: true })).toEqual([{ id: "a", label: "Main ••4410", title: "Main ••4410", sub: "$8,720.76", avatar: "MA", round: false, selected: true }]);
    expect(accountRows({ items })[0]!.sub).toBeUndefined();
  });
  it("shows beneficiaries with initials", () => {
    expect(beneficiaryRows({ items: [{ id: "b", displayName: "Ali Raza", bank: "HBL", maskedNumber: "••99" }], value: "x" })).toEqual([{ id: "b", label: "Ali Raza", title: "Ali Raza", sub: "HBL · ••99", avatar: "AR", round: true, selected: false }]);
  });
  it("shows select options as chips or tiles", () => {
    const r = selectChoices({ items: [{ id: "k", name: "K-Electric" }, { id: "l", name: "LESCO", icon: "bank" }], value: "l", variant: "tiles" });
    expect(r.tiles).toBe(true);
    expect(r.choices.map((c) => [c.letter, c.selected])).toEqual([["K", false], ["L", true]]);
    expect(selectChoices({ items: [], variant: undefined }).tiles).toBe(false);
  });
  it("maps keyboard kinds", () => { expect(["number", "phone", "email", "text", undefined].map(keyboardKind)).toEqual(["number", "phone", "email", "default", "default"]); });
});

describe("card form", () => {
  it("formats the number, expiry and code as they are typed", () => {
    expect([groupCard("4242424242424242"), groupCard("42")]).toEqual(["4242 4242 4242 4242", "42"]);
    expect([expiryText("1128"), expiryText("11"), expiryText("1/2/8")]).toEqual(["11/28", "11", "12/8"]);
    expect([cleanCardNumber("4242 4242-4242 4242 99999"), cleanCvv("12a345")]).toEqual(["4242424242424242999", "1234"]);
    expect(cardPictureDigits("4242")).toBe("4242  ••••  ••••  ••••");
  });
  it("tells the card brand from the first digits", () => {
    expect([cardNetwork("4242"), cardNetwork("5555"), cardNetwork("3782"), cardNetwork("")]).toEqual(["visa", "mastercard", "amex", "mastercard"]);
  });
  it("describes the four fields in the journey's language, with autofill hints and errors", () => {
    const fields = cardFields({ value: { number: "4242", holder: "A B", expiry: "11/28", cvv: "123" }, errors: { number: "Enter a valid card number" } }, "en");
    expect(fields.map((f) => [f.key, f.label, f.autocomplete, f.secure, f.value])).toEqual([
      ["number", "Card number", "cc-number", false, "4242"], ["holder", "Name on card", "cc-name", false, "A B"], ["expiry", "Expiry", "cc-exp", false, "11/28"], ["cvv", "Security code", "cc-csc", true, "123"],
    ]);
    expect(fields[0]!.error).toBe("Enter a valid card number");
    expect(fields[0]!.show("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(fields[2]!.clean("1128")).toBe("11/28");
    expect(cardFields({}, "ur")[0]!.label).toBe("کارڈ نمبر");
    expect(cardFields({}, "en").every((f) => f.value === "")).toBe(true);
  });
});

describe("one-time code", () => {
  it("shows one cell per digit with the next one active", () => {
    expect(otpCells("12", 4)).toEqual([{ char: "1", active: false }, { char: "2", active: false }, { char: "", active: true }, { char: "", active: false }]);
    expect(otpCells(undefined, 2)).toEqual([{ char: "", active: true }, { char: "", active: false }]);
    expect(cleanOtp("1a2 3")).toBe("123");
    expect([otpLabel("en", 6), otpLabel("ur", 6)]).toEqual(["One-time code, 6 digits", "ایک بار استعمال ہونے والا کوڈ، 6 ہندسے"]);
  });
});

import { caretAfterFormat } from "./index";
describe("caret after formatting", () => {
  it("keeps the caret after the same digit", () => {
    expect(caretAfterFormat("42424", 5, "4242 4")).toBe(6);        // typing at the end: after the new digit, past the added space
    expect(caretAfterFormat("42x424", 3, "4242 4")).toBe(2);       // a stray letter is dropped: caret stays after the second digit
    expect(caretAfterFormat("4242 9 4242", 6, "4242 9424 2")).toBe(6); // inserting in the middle
    expect(caretAfterFormat("12/", 3, "12")).toBe(2);
    expect(caretAfterFormat("abc", 2, "")).toBe(0);
    expect(caretAfterFormat("12", 99, "12")).toBe(2);
  });
});

describe("number pad", () => {
  it("lays out three keys across, with a blank, 0 and delete last", () => {
    expect(KEYPAD_ROWS).toEqual([["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "back"]]);
  });
  it("adds digits up to the length and removes the last one", () => {
    expect(applyKey("", "4", 6)).toBe("4");
    expect(applyKey("123456", "7", 6)).toBe("123456");
    expect(applyKey("123", "back", 6)).toBe("12");
    expect(applyKey("", "back", 6)).toBe("");
    expect(applyKey("12", "", 6)).toBe("12");
  });
  it("shows dots for a PIN and the next cell as active", () => {
    expect(otpCells("48", 4, true)).toEqual([{ char: "•", active: false }, { char: "•", active: false }, { char: "", active: true }, { char: "", active: false }]);
    expect(otpCells("48", 4)[0]!.char).toBe("4");
  });
});
