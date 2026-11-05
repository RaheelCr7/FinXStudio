/**
 * What goes wrong on the way to the bank, on purpose (docs/journeys/README.md 1.5). The conditions themselves are the
 * `SandboxConditions` of index.ts; this file says which adapters a list names. A list holds adapter names, prefixes ending in a
 * dot (`corp.`, `bank.payments.`) or in `*` (`bank.o*`); `unavailable` may also hold `rail:<id>` to take one payment rail down.
 */
export const hit = (list: string[] | undefined, adapter: string) =>
  !!list?.some((x) => !x.startsWith("rail:") && (x === adapter || (x.endsWith(".") && adapter.startsWith(x)) || (x.endsWith("*") && adapter.startsWith(x.slice(0, -1)))));

/** Adapters that read a list or a map: the ones `empty` can empty. */
export const isListAdapter = (adapter: string) => /\.(list|pending|totals|issued|saved|numbers|amounts)$/.test(adapter);
