import { brands, type BrandId } from "@finx/ui-kit";

/** Which bank this build is: an id from packages/ui-kit/src/brands.json. Inlined at bundle time, like the other EXPO_PUBLIC_ values. */
const requested = process.env.EXPO_PUBLIC_FINX_BRAND ?? "meezan";
export const BRAND: BrandId = requested in brands ? requested : "meezan";
export const BRAND_INFO = brands[BRAND]!;
