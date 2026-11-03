"use client";
import { useMemo } from "react";
import type { Journey } from "@finx/journey-schema";
import { MockBank, personasFor } from "@finx/mock-bank-api";
import { brands, type Brand } from "@finx/ui-kit";
import { JourneyPlayer, ThemeProvider } from "@finx/renderer-native";
import { sampleAnswers } from "@/lib/slides";
import { useProjects } from "./Projects";

export const PHONE = { w: 340, h: 690 };
const noop = () => {};

/** What a journey previews with: the look of the project it belongs to (Meezan when none) and that project's first sandbox customer. */
export function usePreviewKit(journey: Journey): { brand: Brand; adapter: (id: string, input: Record<string, any>) => Promise<any> } {
  const { byId } = useProjects();
  const brand: Brand = byId(journey.apps?.[0] ?? "meezan")?.brand ?? brands.meezan!;
  const adapter = useMemo(() => {
    const bank = new MockBank(personasFor(brand.preset, brand.id)[0]!.id);
    return (id: string, input: Record<string, any>) => bank.call(id, input);
  }, [brand.preset]);
  return { brand, adapter };
}

/**
 * One screen of a journey drawn by the real app renderer inside a phone, as a customer would first see it. The journey is
 * opened at that screen, so lists and amounts fill from the sandbox customer. It cannot be tapped: it is a picture.
 */
export function ScreenShot({ journey, screenId, scale, lang = "en", dark = false }: { journey: Journey; screenId: string; scale: number; lang?: string; dark?: boolean }) {
  const { brand, adapter } = usePreviewKit(journey);
  const opened = useMemo(() => ({ ...journey, entryScreen: screenId }), [journey, screenId]);
  const initial = useMemo(() => sampleAnswers(journey), [journey]);
  return (
    <div className="shot-phone" aria-hidden inert style={{ width: PHONE.w * scale, height: PHONE.h * scale }}>
      <div className="phone" style={{ transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
        <div className="screen"><div>
          <ThemeProvider mode={dark ? "dark" : "light"} brand={brand}>
            <JourneyPlayer key={screenId + lang} journey={opened} adapter={adapter} lang={lang} initial={initial} onClose={noop} onExit={noop} />
          </ThemeProvider>
        </div></div>
      </div>
    </div>
  );
}
