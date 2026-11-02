import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { JourneyController, ui, type BlockType } from "@finx/renderer-core";
import type { Journey } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { registry } from "./blocks/blocks";

/** Renders one block the way the player would, inside a form, so labels and error messages are in a realistic page. */
export function renderBlock(type: BlockType, b: Record<string, any>, over: Partial<Parameters<(typeof registry)[BlockType]>[0]> = {}) {
  const C = registry[type];
  const set = over.set ?? (() => {});
  const press = over.press ?? (() => {});
  return render(
    <main lang={over.lang ?? "en"}><form noValidate onSubmit={(e) => e.preventDefault()}>
      <C b={{ type, ...b }} set={set} press={press} busy={over.busy ?? false} lang={over.lang ?? "en"} strings={over.strings ?? { account: ui("en", "account"), payTo: ui("en", "payTo"), addBeneficiary: ui("en", "addBeneficiary"), wait: ui("en", "wait"), back: "Back", close: "Close" }} />
    </form></main>,
  );
}

/** Colour contrast needs real layout, which the test DOM does not have; contrast is checked on the theme tokens instead. */
export const axeCheck = (container: HTMLElement) => axe(container, { rules: { "color-contrast": { enabled: false } } });

/** Opens every screen of a journey in the engine, with sandbox data, and returns what a player would draw there. */
export async function screensOf(journey: Journey, persona = "alex") {
  const bank = new MockBank(persona);
  const out: { screenId: string; layout: ReturnType<JourneyController["layout"]> }[] = [];
  for (const s of journey.screens) {
    const c = new JourneyController(journey, { adapter: (id, input) => bank.call(id, input) });
    await c.start();
    try { await (c.runner as any).enter(s.id); } catch { /* a screen that needs earlier answers still shows its blocks */ }
    out.push({ screenId: s.id, layout: c.layout() });
  }
  return out;
}
