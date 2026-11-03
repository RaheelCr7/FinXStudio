import React, { createContext, useContext, useMemo } from "react";
import { KitProvider, kitFor } from "@finx/components/native";
import { brands, completeColors, type Brand, type BrandId, type BrandLook, type Colors, type Preset, type } from "@finx/ui-kit";

export type FdsTheme = {
  c: Colors;
  /** Corner radii for this brand. */
  r: Brand["radius"];
  brand: BrandId;
  /** The look this bank started from. Decides which app screens are used. */
  preset: Preset;
  currency: string;
  locale: string;
  mode: "light" | "dark";
  fontFamily: (lang: string) => string;
  /** How this bank's screens differ from the standard look, if they do. */
  look?: BrandLook;
};
const make = (mode: "light" | "dark", brand: BrandId | Brand): FdsTheme => {
  const b = typeof brand === "string" ? brands[brand] ?? brands.meezan! : brand;
  return {
    c: completeColors((mode === "dark" ? b.dark : b.light).colors), r: b.radius, brand: b.id, preset: b.preset, currency: b.currency, locale: b.locale, mode, look: b.look,
    fontFamily: (lang) => (lang === "ur" ? type.family.urdu : type.family.body),
  };
};

const Ctx = createContext<FdsTheme>(make("light", "meezan"));
export const ThemeProvider = ({ mode, brand = "meezan", children }: { mode: "light" | "dark"; brand?: BrandId | Brand; children: React.ReactNode }) => {
  const v = useMemo(() => make(mode, brand), [mode, brand]);
  const kit = useMemo(() => kitFor(typeof brand === "string" ? brands[brand] ?? brands.meezan! : brand, mode), [mode, brand]);
  return <Ctx.Provider value={v}><KitProvider kit={kit}>{children}</KitProvider></Ctx.Provider>;
};
export const useTheme = () => useContext(Ctx);
