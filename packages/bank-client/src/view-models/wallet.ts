import type { SavedCard } from "@finx/mock-bank-api";

/** A made-up full card number for the card picture, ending in the card's real last four digits. */
export const cardPictureNumber = (k: Pick<SavedCard, "network" | "last4">) => `${k.network === "visa" ? "4000" : "5200"}00000000${k.last4}`;
export const networkName = (k: Pick<SavedCard, "network">) => (k.network === "visa" ? "Visa" : "Mastercard");
