import React, { createContext, useContext, useMemo } from "react";
import { completeColors, resolveComponentTokens, type Brand, type Colors, type ComponentTokens } from "@finx/ui-kit";

/** Everything the native components read: the bank's colours, radii and component sizes. */
export type Kit = { c: Colors; r: Brand["radius"]; t: ComponentTokens; bar?: string; rtl: boolean };

export const kitFor = (brand: Brand, mode: "light" | "dark" = "light", rtl = false): Kit => ({
  c: completeColors((mode === "dark" ? brand.dark : brand.light).colors), r: brand.radius, t: resolveComponentTokens(brand.components), bar: brand.look?.bar, rtl,
});

const Ctx = createContext<Kit | null>(null);
export const KitProvider = ({ kit, children }: { kit: Kit; children: React.ReactNode }) => {
  const v = useMemo(() => kit, [kit]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
};
export function useKit(): Kit {
  const k = useContext(Ctx);
  if (!k) throw new Error("Wrap the screen in <KitProvider kit={kitFor(brand)}>");
  return k;
}
