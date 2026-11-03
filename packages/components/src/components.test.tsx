import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { brands } from "@finx/ui-kit";
import { catalog, brandVars, componentsCss, Button, Keypad, TextField } from "./index";
import * as exported from "./index";
import { KitProvider, kitFor, nativeComponents } from "./native";

expect.extend(matchers);
const axeCheck = (el: HTMLElement) => axe(el, { rules: { "color-contrast": { enabled: false } } });

describe("component catalog", () => {
  it("has one spec per exported component, with props, states and accessibility notes", () => {
    const components = Object.keys(exported).filter((k) => /^[A-Z][a-z]/.test(k) && k !== "Icon");
    expect(catalog.map((c) => c.name).sort()).toEqual(components.sort());
    for (const c of catalog) {
      expect(c.props.length, c.name).toBeGreaterThan(0);
      expect(c.states.length, c.name).toBeGreaterThan(0);
      expect(c.a11y.length, c.name).toBeGreaterThan(0);
    }
  });

  it("has a native twin for every component", () => {
    expect(Object.keys(nativeComponents).sort()).toEqual(catalog.map((c) => c.name).sort());
  });

  for (const spec of catalog) {
    for (const st of spec.states) {
      it(`${spec.name} / ${st.name} renders with no accessibility violations`, async () => {
        const { container } = render(<spec.Component {...st.props} />);
        expect(container.firstElementChild).not.toBeNull();
        expect(await axeCheck(container)).toHaveNoViolations();
      });
    }
  }
});

describe("native twins", () => {
  for (const spec of catalog) {
    for (const st of spec.states) {
      it(`${spec.name} / ${st.name} renders in the bank's look`, () => {
        const N = (nativeComponents as Record<string, React.ComponentType<any>>)[spec.name]!;
        const { container } = render(<KitProvider kit={kitFor(brands.cab!)}><N {...st.props} /></KitProvider>);
        expect(container.querySelector("input, button, [role], [aria-label]") ?? container.textContent).toBeTruthy();
      });
    }
  }
  it("a native keypad reports the key", async () => {
    const keys: string[] = [];
    const { getByLabelText } = render(<KitProvider kit={kitFor(brands.cab!)}><nativeComponents.Keypad onKey={(k: string) => keys.push(k)} /></KitProvider>);
    await userEvent.click(getByLabelText("5"));
    expect(keys).toEqual(["5"]);
  });
  it("a native component outside a provider says what is missing", () => {
    expect(() => render(<nativeComponents.Button label="x" />)).toThrow(/KitProvider/);
  });
});

describe("behaviour", () => {
  it("a busy button blocks presses", async () => {
    let n = 0;
    const { getByRole } = render(<Button label="Go" busy onPress={() => n++} />);
    await userEvent.click(getByRole("button"));
    expect(n).toBe(0);
    expect(getByRole("button").getAttribute("aria-busy")).toBe("true");
  });
  it("a keypad reports the key and a delete", async () => {
    const keys: string[] = [];
    const { getByLabelText } = render(<Keypad labels={{ back: "Delete" }} onKey={(k) => keys.push(k)} />);
    await userEvent.click(getByLabelText("7"));
    await userEvent.click(getByLabelText("Delete"));
    expect(keys).toEqual(["7", "back"]);
  });
  it("a password field hides the text until shown", async () => {
    const { getByLabelText, getByRole } = render(<TextField label="Password" value="secret" secure />);
    expect((getByLabelText("Password") as HTMLInputElement).type).toBe("password");
    await userEvent.click(getByRole("button"));
    expect((getByLabelText("Password") as HTMLInputElement).type).toBe("text");
  });
});

describe("theme", () => {
  it("gives every colour, radius and size the stylesheet reads", () => {
    const vars = brandVars(brands.cab!);
    const used = new Set([...componentsCss.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!));
    for (const name of used) {
      if (name === "--bar-bg") continue; // optional: only banks with a coloured bar set it
      expect(vars[name], name).toBeDefined();
    }
    expect(vars["--bar-bg"]).toBe("#00853E");
  });
});
