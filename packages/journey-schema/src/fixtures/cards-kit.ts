import type { Screen } from "../schema";
import { alert, button, denied, go, holds, lacks, problem, route, row, set, SLOW, SORRY, text } from "./accounts-kit";

export { alert, button, denied, go, holds, lacks, problem, route, row, set, SLOW, SORRY, text };

/**
 * The small pieces the Cards journeys (cards, activate-card, card-controls, freeze-card, virtual-card, replace-card, card-pin, dispute-transaction, add-card)
 * are built from, so each file says what is its own and they cannot drift apart on the words of a failure. A card journey that changes a card says what was and
 * was not changed; the screens below are for the two answers the bank can give that no person can fix: no answer in time, and not available.
 */

/** "Nothing was changed on your card." and the like: what a card journey says when the bank did not answer. `what` is "changed" or, for a report or a saved card, "sent" or "saved". */
export const noAnswer = (what: "changed" | "sent" | "saved") => `This is taking longer than expected. Nothing was ${what}.`;
export const notAvailable = (what: "changed" | "sent" | "saved") => `This isn’t available right now. Nothing was ${what}. Try again in a few minutes.`;

/** The terminal screens "timeout" and "unavailable" every card journey has; `retry` is the screen "Try again" returns to, `wipe` clears what the journey holds for the bank (a PIN, a code, a number). */
export function answerScreens(retry: string, what: "changed" | "sent" | "saved", wipe: any[] = []): Screen[] {
  return [
    {
      id: "timeout", title: "No answer in time", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "This is taking longer than expected", text: noAnswer(what) },
        button("Try again", [go(retry)]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Not available right now", text: notAvailable(what) },
        button("Try again", [go(retry)]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
  ] as Screen[];
}
