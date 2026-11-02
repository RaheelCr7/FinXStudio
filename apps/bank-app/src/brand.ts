import { brands, type BrandId } from "@finx/ui-kit";

/** Which bank this build is. Inlined at bundle time, like the other EXPO_PUBLIC_ values. */
export const BRAND: BrandId = process.env.EXPO_PUBLIC_FINX_BRAND === "bankworkx" ? "bankworkx" : "meezan";
export const BRAND_INFO = brands[BRAND];
