import { resolveBrandId } from "@finx/bank-client";
import { WORKSPACES, brandDefs, brandFor, brands, type Brand, type WorkspaceId } from "@finx/ui-kit";

/** Which bank this build is: an id from packages/ui-kit/src/brands.json. Inlined at bundle time, like the other EXPO_PUBLIC_ values. */
export const BRAND = resolveBrandId(process.env.EXPO_PUBLIC_FINX_BRAND);
export const BRAND_INFO = brands[BRAND]!;
/** The URL scheme of this build (app.config.ts registers it), the start of its deep links: bankworkx://personal/cards. */
export const LINK_SCHEME = brandDefs[BRAND]?.scheme ?? BRAND;

/**
 * The workspace whose look to draw. The shell's context store sets it when the customer switches workspace; until then a build can
 * preview one with EXPO_PUBLIC_FINX_WORKSPACE=personal|business. Anything else means the bank's own look.
 */
export const WORKSPACE: WorkspaceId | undefined = WORKSPACES.find((w) => w === process.env.EXPO_PUBLIC_FINX_WORKSPACE);

/** The resolved brand object ThemeProvider takes: the workspace's look when the bank themed it, otherwise the bank's brand. */
export const brandOf = (workspace: WorkspaceId | undefined = WORKSPACE): Brand => brandFor(BRAND, workspace);
