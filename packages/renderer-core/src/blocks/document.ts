export type DocParagraph = { heading?: string; text: string };

/**
 * A long text as paragraphs: blank lines separate them, and a line that starts with "## " is a heading.
 * Plain text only, so a bank's terms read the same on every screen.
 */
export function docParagraphs(text: unknown): DocParagraph[] {
  return String(text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => (p.startsWith("## ") ? { heading: p.split("\n")[0]!.slice(3).trim(), text: p.split("\n").slice(1).join(" ").trim() } : { text: p.replace(/\s*\n\s*/g, " ") }));
}
