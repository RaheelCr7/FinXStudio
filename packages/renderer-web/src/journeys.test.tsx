import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as matchers from "vitest-axe/matchers";
import { catalog, localTransfer, payBill, bankworkxJourneys, type Journey } from "@finx/journey-schema";
import { BLOCK_TYPES, ui, type BlockType } from "@finx/renderer-core";
import { registry } from "./blocks/blocks";
import { axeCheck, screensOf } from "./test-utils";

expect.extend(matchers as any);

const JOURNEYS: Journey[] = [...new Map([localTransfer, payBill, ...bankworkxJourneys, ...catalog.map((c) => c.journey)].map((j) => [j.slug, j])).values()];

describe("every block kind has a web component", () => {
  it("covers every block type of the schema, and nothing else", () => {
    expect(Object.keys(registry).sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it("matches the native renderer's list of blocks (checked in its source, which cannot be imported without react-native)", () => {
    const native = readFileSync(path.resolve(__dirname, "../../renderer-native/src/blocks.tsx"), "utf8");
    const body = native.slice(native.indexOf("= {", native.indexOf("export const registry")));
    const keys = [...body.matchAll(/\b(\w+): (?:[A-Z]\w+|\(\) => null)/g)].map((m) => m[1]!);
    expect(keys.sort()).toEqual([...BLOCK_TYPES].sort());
  });
});

describe("every shipped journey draws on the web", () => {
  it("has journeys to check", () => { expect(JOURNEYS.length).toBeGreaterThanOrEqual(8); });

  for (const journey of JOURNEYS) {
    it(`${journey.slug}: every screen renders in English${journey.locale.supported.includes("ur") ? " and Urdu" : ""} with no accessibility violations`, async () => {
      const langs = journey.locale.supported.filter((l) => l === "en" || l === "ur");
      for (const lang of langs) {
        const bank = journey.apps?.includes("bankworkx") ? "alex" : journey.slug.startsWith("corporate-") ? "acme" : "ayesha";
        for (const { screenId, layout } of await screensOf(journey, bank)) {
          const blocks = [...layout.body, ...layout.buttons];
          expect(blocks.length, `${journey.slug}/${screenId}`).toBeGreaterThan(0);
          for (const b of blocks) expect(registry[b.type as BlockType], `${journey.slug}/${screenId}: ${b.type}`).toBeTruthy();
          const { container } = render(
            <main lang={lang}><form noValidate>
              {blocks.map((b, i) => { const C = registry[b.type as BlockType]!; return <div key={i}><C b={b} set={() => {}} press={() => {}} busy={false} lang={lang} strings={{ account: ui(lang, "account"), payTo: ui(lang, "payTo"), addBeneficiary: ui(lang, "addBeneficiary"), wait: ui(lang, "wait"), back: "", close: "" }} /></div>; })}
            </form></main>,
          );
          expect(await axeCheck(container), `${journey.slug}/${screenId} (${lang})`).toHaveNoViolations();
          container.remove();
        }
      }
    });
  }
});
