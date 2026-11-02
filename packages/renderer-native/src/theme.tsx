import React, { createContext, useContext, useMemo } from "react";
import { themes, type Theme, type } from "@finx/ui-kit";

export type FdsTheme = { c: Theme["colors"] & Record<string, string>; mode: "light" | "dark"; fontFamily: (lang: string) => string };
const make = (mode: "light" | "dark"): FdsTheme => ({
  c: (mode === "dark" ? themes.meezanDark : themes.meezanLight).colors as any,
  mode,
  fontFamily: (lang) => (lang === "ur" ? type.family.urdu : type.family.body),
});

const Ctx = createContext<FdsTheme>(make("light"));
export const ThemeProvider = ({ mode, children }: { mode: "light" | "dark"; children: React.ReactNode }) => {
  const v = useMemo(() => make(mode), [mode]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
};
export const useTheme = () => useContext(Ctx);
