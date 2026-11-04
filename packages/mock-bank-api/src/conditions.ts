import { BankError } from "./errors";

/**
 * What goes wrong on the way to the bank, on purpose (docs/journeys/README.md 1.5). Each list holds adapter names or prefixes
 * (`bank.payments.create`, `corp.`); `unavailable` may also hold `rail:<id>` to take a single payment rail down.
 * A scenario sets them with its `conditions` field; a dev-only panel sets them while a person tries the app.
 */
export type Conditions = {
  /** Every call takes this long (milliseconds) before it answers. */
  latencyMs?: number;
  /** These adapters answer TIMEOUT after the latency. The request is not applied. */
  timeout?: string[];
  /** These adapters answer SERVICE_UNAVAILABLE at once. */
  unavailable?: string[];
  /** List adapters answer an empty result, to test empty states. */
  empty?: string[];
};

const hit = (list: string[] | undefined, adapter: string) => !!list?.some((x) => !x.startsWith("rail:") && (x === adapter || (x.endsWith(".") && adapter.startsWith(x)) || (x.endsWith("*") && adapter.startsWith(x.slice(0, -1)))));

/** Adapters that read a list or a map: the ones `empty` can empty. */
export const isListAdapter = (adapter: string) => /\.(list|pending|totals|issued|speeds)$/.test(adapter) || adapter === "bank.transactions.list";

export const railIsDown = (c: Conditions | undefined, railId: string) => !!c?.unavailable?.includes(`rail:${railId}`);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Applies the conditions to one call. Returns "empty" when the call is to answer an empty list, otherwise lets it go on (or throws). */
export async function applyConditions(c: Conditions | undefined, adapter: string): Promise<"go" | "empty"> {
  if (!c) return "go";
  if (hit(c.unavailable, adapter)) throw new BankError("SERVICE_UNAVAILABLE", "This service is not available right now");
  if (c.latencyMs && c.latencyMs > 0) await sleep(c.latencyMs);
  if (hit(c.timeout, adapter)) throw new BankError("TIMEOUT", "The bank did not answer in time");
  if (isListAdapter(adapter) && hit(c.empty, adapter)) return "empty";
  return "go";
}
