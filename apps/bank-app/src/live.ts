import { createLive } from "@finx/bank-client";
import { BRAND } from "./brand";

export { slugIs, type Entry, type Live } from "@finx/bank-client";

/** Journeys for this build's bank, loaded from Studio with the bundled copies as the fallback. The logic is shared with the web app (@finx/bank-client). */
export const { bundledEntries, loadCatalog, loadJourney } = createLive({ brand: BRAND });
