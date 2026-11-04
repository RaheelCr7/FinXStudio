import { createLive } from "@finx/bank-client";
import { parseTrustedKeys } from "@finx/journey-schema";
import { BRAND } from "./brand";

export { slugIs, type Entry, type Live } from "@finx/bank-client";

/** Journeys for this build's bank, loaded from Studio with the bundled copies as the fallback. The logic is shared with the web app (@finx/bank-client). */
export const live = createLive({ brand: BRAND, trustedKeys: parseTrustedKeys(process.env.EXPO_PUBLIC_FINX_TRUSTED_KEYS) }); // set in production builds
export const { bundledEntries, loadCatalog, loadJourney } = live;
