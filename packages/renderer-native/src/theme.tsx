import React, { createContext, useContext, useMemo } from "react";
import { brands, completeColors, type Brand, type BrandId, type Colors, type } from "@finx/ui-kit";

export type FdsTheme = {
  c: Colors;
  /** Corner radii for this brand. */
  r: Brand["radius"];
  brand: BrandId;
  currency: string;
  locale: string;
  mode: "light" | "dark";
  fontFamily: (lang: string) => string;
};
const make = (mode: "light" | "dark", brand: BrandId): FdsTheme => {
  const b = brands[brand];
  return {
    c: completeColors((mode === "dark" ? b.dark : b.light).colors), r: b.radius, brand, currency: b.currency, locale: b.locale, mode,
    fontFamily: (lang) => (lang === "ur" ? type.family.urdu : type.family.body),
  };
};

const Ctx = createContext<FdsTheme>(make("light", "meezan"));
export const ThemeProvider = ({ mode, brand = "meezan", children }: { mode: "light" | "dark"; brand?: BrandId; children: React.ReactNode }) => {
  const v = useMemo(() => make(mode, brand), [mode, brand]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
};
export const useTheme = () => useContext(Ctx);
