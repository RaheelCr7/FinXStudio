import { resolveBrandId } from "@finx/bank-client";
import { brands } from "@finx/ui-kit";

/** Which bank this build is: an id from packages/ui-kit/src/brands.json. Inlined at bundle time, like the other EXPO_PUBLIC_ values. */
export const BRAND = resolveBrandId(process.env.EXPO_PUBLIC_FINX_BRAND);
export const BRAND_INFO = brands[BRAND]!;
