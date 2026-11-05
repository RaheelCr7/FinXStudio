export type Receipt = { title: string; lines: { label: string; value: string }[]; /** The same receipt as plain text, for a share sheet. */ text: string };

/** The receipt as plain text: the title, then one "label: value" line each. */
export const receiptText = (title: string, lines: { label: string; value: string }[]): string => [title, ...lines.map((l) => (l.label ? `${l.label}: ${l.value}` : l.value))].join("\n");
