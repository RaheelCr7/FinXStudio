import { slugIs, type Entry } from "./live";

/**
 * The Landing: what a person sees before signing in, as data (docs/BANKWORKX.md, "Public: before sign-in"). Web and phone draw the same list, so they stay identical. A point opens a
 * journey of the app; nothing here needs a session or a permission, and nothing asks for personal data. The shell screens the spec also plans (Products, Exchange rates, the legal
 * pages, the welcome carousel, the splash) are not built: only the journeys that exist are listed.
 */
export type LandingPoint = {
  id: string;
  /** The four main actions, the Explore rows, and the text link under the buttons. */
  group: "main" | "link" | "explore";
  label: string;
  /** One line under an Explore row. */
  text?: string;
  journey: string;
  icon?: string;
  /** The first main action is the primary button, the others are secondary. */
  primary?: boolean;
};

export const LANDING_POINTS: LandingPoint[] = [
  { id: "open-account", group: "main", label: "Open an account", journey: "open-account" },
  { id: "register", group: "main", label: "Register for digital banking", journey: "register-digital-banking" },
  { id: "track", group: "link", label: "Track my application", journey: "track-application" },
  { id: "loan", group: "explore", label: "Loan calculator", text: "Estimate a loan", journey: "loan-calculator", icon: "dollar" },
  { id: "deposit", group: "explore", label: "Deposit calculator", text: "Estimate a deposit", journey: "deposit-calculator", icon: "trend" },
  { id: "branch", group: "explore", label: "Find a branch or ATM", text: "Near you", journey: "find-branch-atm", icon: "mapPin" },
  { id: "contact", group: "explore", label: "Contact us", text: "Call or message us", journey: "contact-support", icon: "phone" },
];

/** The points of the Landing the app can open: the journey is there and the bank has not switched it off. Sign in is the screen itself, so it has no point. */
export function landingPointsFor(entries: Entry[], disabled: string[] = []): LandingPoint[] {
  return LANDING_POINTS.filter((p) => entries.some((e) => slugIs(e.slug, p.journey)) && !disabled.includes(p.journey));
}
