import type { Screen } from "../schema";
import { alert, button, denied, go, holds, lacks, problem, route, row, set, SLOW, SORRY, text } from "./accounts-kit";

export { alert, button, denied, go, holds, lacks, problem, route, row, set, SLOW, SORRY, text };

/**
 * The small pieces the More journeys (update-profile, new-message, messages, service-request, my-requests, connect-account) are built from, so each file says what is
 * its own and they cannot drift apart on the words of a failure. Message and request text is what the person wrote: every screen shows it as text.
 */

/** What a journey says when the bank did not answer in time: `what` is what was not done ("changed", "sent", "connected"). */
export const noAnswer = (what: "changed" | "sent" | "connected") => `This is taking longer than expected. Nothing was ${what}.`;

/**
 * The terminal screens "timeout" and "unavailable" every More journey has. `retry` is the screen "Try again" returns to, `wipe` clears what the journey holds only
 * for the bank (a code), and `down` is the journey's words for a bank that is not there (the spec has its own for each).
 */
export function answerScreens(retry: string, what: "changed" | "sent" | "connected", down: { title: string; text: string }, wipe: any[] = []): Screen[] {
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
        { type: "result", tone: "error", title: down.title, text: down.text },
        button("Try again", [go(retry)]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
  ] as Screen[];
}
