import { brands, type BrandId } from "@finx/ui-kit";

/** The brand to use for a requested id: the id itself when it is a known bank, otherwise the original Meezan app. */
export const resolveBrandId = (requested: string | undefined): BrandId => (requested && Object.hasOwn(brands, requested) ? requested : "meezan");
