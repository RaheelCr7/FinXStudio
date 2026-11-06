import type { Journey } from "../schema";

/** What must be true for "Freeze a card" to be right. It is card-controls opened on its freeze (or unfreeze) change, so the rules are proved there and here only that it opens it. */
export const freezeCardAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "It opens card-controls on the freeze change for the card it is given, with no screen or bank call of its own: the review says Card Active to Frozen and asks for no code." },
  { id: "AC-2", text: "With the action unfreeze it opens card-controls on the unfreeze change, which asks for a one-time code." },
  { id: "AC-3", text: "Any other action opens the freeze (blocking is not built here), and without a card it opens card-controls at the choice of the card." },
  { id: "AC-4", text: "When the bank has switched it off it says \"This isn’t available at your bank.\" without opening card-controls." },
];

const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const base = { persona: "alex", now: NOW };

export const freezeCardScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "It opens card-controls on the freeze change for the card it is given; no code is asked and Save changes freezes it", covers: ["AC-1"], ...base, launch: { "launch.cardId": "card_9021" },
    steps: [
      { expectOpens: { journey: "card-controls", with: { "launch.cardId": "card_9021", "launch.mode": "freeze" } } }, screen("review"), text("Everyday debit ••9021"), text("Active → Frozen"), noText("We’ll ask for a code to confirm."),
      press("Save changes"), text("Card frozen"), { expectBank: { adapter: "bank.cards.get", input: { cardId: "card_9021" }, path: "status", equals: "frozen" } },
    ],
  },
  {
    id: "T-2", name: "With the action unfreeze it opens card-controls on the unfreeze change, which asks for a code", covers: ["AC-2"], ...base, launch: { "launch.cardId": "card_9021", "launch.action": "unfreeze" },
    setup: [{ adapter: "bank.cards.freeze", input: { cardId: "card_9021" } }],
    steps: [
      { expectOpens: { journey: "card-controls", with: { "launch.cardId": "card_9021", "launch.mode": "unfreeze" } } }, screen("review"), text("Frozen → Active"), text("We’ll ask for a code to confirm."), noText("Save changes"),
      press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-3", name: "Any other action opens the freeze: the shell's block is not built here", covers: ["AC-3"], ...base, launch: { "launch.cardId": "card_9021", "launch.action": "block" },
    steps: [{ expectOpens: { journey: "card-controls", with: { "launch.cardId": "card_9021", "launch.mode": "freeze" } } }, screen("review"), text("Active → Frozen")],
  },
  {
    id: "T-4", name: "Without a card it opens card-controls at the choice of the card", covers: ["AC-3"], ...base,
    steps: [{ expectOpens: { journey: "card-controls", with: { "launch.mode": "freeze" } } }, screen("pick"), text("Which card?"), text("Everyday debit ••9021")],
  },
  {
    id: "T-5", name: "When the bank has switched it off it says so and opens nothing", covers: ["AC-4"], ...base, launch: { "launch.cardId": "card_9021", "opt.enabled": false },
    steps: [screen("off"), text("Not available"), text("This isn’t available at your bank."), noText("Which card?"), press("Done")],
  },
];
