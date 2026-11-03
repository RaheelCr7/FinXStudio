import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { displayDate, limitIso, monthGrid, parseIso, shiftMonth, spokenDate, todayIso, weekdayNames, withinLimits } from "./calendar";
import { DateField } from "./web/DateField";
import { Dropdown } from "./web/Dropdown";
import { Avatar, initialsOf } from "./web/Avatar";

describe("calendar logic", () => {
  it("reads only real days of real months", () => {
    expect(parseIso("2001-01-01")).toEqual({ y: 2001, m: 0, d: 1 });
    expect(parseIso("2024-02-29")).toBeTruthy(); // a leap day
    for (const bad of ["2026-02-31", "2026-13-01", "01/01/2001", "2001-1-1", "", undefined]) expect(parseIso(bad), String(bad)).toBeNull();
  });
  it("lays a month out in whole weeks, with the neighbours filling the ends", () => {
    const weeks = monthGrid(2026, 10, 0); // November 2026 starts on a Sunday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]![0]).toMatchObject({ iso: "2026-11-01", day: 1, inMonth: true });
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30);
    const monday = monthGrid(2026, 10, 1); // weeks starting on Monday: the first week begins in October
    expect(monday[0]![0]).toMatchObject({ iso: "2026-10-26", inMonth: false });
    expect(monday.at(-1)!.at(-1)!.inMonth).toBe(false);
  });
  it("steps months across the year and checks limits in date order", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 5, -12)).toEqual({ year: 2025, month: 5 });
    expect(withinLimits("2026-05-01", "2026-05-01", "2026-05-31")).toBe(true);
    expect(withinLimits("2026-06-01", "2026-05-01", "2026-05-31")).toBe(false);
    expect(withinLimits("2001-01-01", undefined, undefined)).toBe(true);
    expect(limitIso("today", new Date(2026, 10, 3))).toBe("2026-11-03");
    expect(limitIso("nonsense")).toBeUndefined();
  });
  it("shows and speaks dates the way people say them", () => {
    expect(displayDate("2001-01-09")).toBe("09 / 01 / 2001"); expect(displayDate("")).toBe("");
    expect(spokenDate("en", "2001-01-01")).toBe("January 1, 2001");
    expect(weekdayNames("en", 1)[0]).toBe("Mon");
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("takes initials from the first and last name", () => {
    expect([initialsOf("Nour Haddad"), initialsOf("nour"), initialsOf("  Mary Ann Smith "), initialsOf("")]).toEqual(["NH", "N", "MS", ""]);
  });
});

describe("DateField", () => {
  it("opens a calendar, steps to a month and picks a day; the answer is ISO text", async () => {
    const onChange = vi.fn();
    render(<DateField label="Date of birth" value="2001-01-01" max="2026-11-03" onChange={onChange} />);
    const field = screen.getByRole("button", { name: /Date of birth/ });
    expect(field.textContent).toContain("01 / 01 / 2001");
    await userEvent.click(field);
    expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeTruthy();
    expect(screen.getByText("January 2001")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("February 2001")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next year" }));
    expect(screen.getByText("February 2002")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "February 14, 2002" }));
    expect(onChange).toHaveBeenCalledWith("2002-02-14");
    expect(screen.queryByRole("dialog")).toBeNull(); // closes after a pick
  });
  it("disables days past the limit and closes on Escape", async () => {
    render(<DateField label="Birth date" value="2026-11-02" max="2026-11-03" />);
    await userEvent.click(screen.getByRole("button", { name: /Birth date/ }));
    expect((screen.getByRole("button", { name: "November 3, 2026" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "November 4, 2026" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "November 2, 2026" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("opens on the latest allowed month when empty and the limit is in the past", async () => {
    render(<DateField label="Date" max="2020-06-15" />);
    await userEvent.click(screen.getByRole("button", { name: /Date/ }));
    expect(screen.getByText("June 2020")).toBeTruthy();
  });
});

describe("Dropdown and Avatar", () => {
  it("a dropdown is a labelled select that reports the id chosen", async () => {
    const onChange = vi.fn();
    render(<Dropdown label="Username" options={[{ id: "a", name: "nour" }, { id: "b", name: "nour.haddad" }]} value="a" onChange={onChange} />);
    const select = screen.getByLabelText("Username") as HTMLSelectElement;
    expect(select.value).toBe("a");
    await userEvent.selectOptions(select, "b");
    expect(onChange).toHaveBeenCalledWith("b");
  });
  it("an avatar shows the initials and the name", () => {
    render(<Avatar name="Nour Haddad" text="nour" />);
    expect(screen.getByText("NH")).toBeTruthy(); expect(screen.getByText("Nour Haddad")).toBeTruthy(); expect(screen.getByText("nour")).toBeTruthy();
  });
});
