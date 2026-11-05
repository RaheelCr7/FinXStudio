import { ui } from "../strings";

export type FileKind = "csv" | "xml" | "pdf" | "image";
export const FILE_KINDS: FileKind[] = ["csv", "xml", "pdf", "image"];

const EXT: Record<FileKind, string[]> = { csv: ["csv"], xml: ["xml"], pdf: ["pdf"], image: ["jpg", "jpeg", "png"] };
/** The types a phone's file picker is asked for. */
export const MIME: Record<FileKind, string[]> = { csv: ["text/csv", "text/comma-separated-values"], xml: ["text/xml", "application/xml"], pdf: ["application/pdf"], image: ["image/jpeg", "image/png"] };
/** Files of these kinds are read, so a journey can check their rows; the others are kept as a name and a size. */
export const TEXT_KINDS: FileKind[] = ["csv", "xml"];
/** The most a file of each kind may weigh (KB) unless the block says otherwise: a payment file is small, a scan is not. */
const DEFAULT_MAX_KB: Record<FileKind, number> = { csv: 256, xml: 256, pdf: 10_240, image: 10_240 };

/** What was chosen, as it is saved at the block's bind. `content` is the text of a csv or xml file. */
export type FileValue = { name: string; size: number; kind: FileKind; content?: string };

export const fileKindOf = (name: string): FileKind | undefined => {
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase();
  return FILE_KINDS.find((k) => ext && EXT[k].includes(ext));
};
/** The `accept` of a file input: ".csv,.xml". */
export const acceptAttr = (accept: FileKind[]) => accept.flatMap((k) => EXT[k].map((e) => `.${e}`)).join(",");
export const maxKbOf = (kind: FileKind, maxKb?: number) => maxKb ?? DEFAULT_MAX_KB[kind];

export type FileProblem = "type" | "size" | "empty";
/** What is wrong with a chosen file, if anything: not one of the accepted kinds, too big for its kind, or empty. */
export function fileProblem(f: { name: string; size: number }, accept: FileKind[], maxKb?: number): FileProblem | undefined {
  const kind = fileKindOf(f.name);
  if (!kind || !accept.includes(kind)) return "type";
  if (!(f.size > 0)) return "empty";
  if (f.size > maxKbOf(kind, maxKb) * 1024) return "size";
  return undefined;
}

export const sizeText = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const KIND_WORD: Record<FileKind, string> = { csv: "CSV", xml: "XML", pdf: "PDF", image: "JPG or PNG" };
/** "CSV or XML", "PDF, JPG or PNG": the kinds a person may choose, in words. */
export function acceptedText(accept: FileKind[]): string {
  const words = accept.map((k) => KIND_WORD[k]);
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}
/** The line under the field: what may be chosen and how big. */
export function fileHint(lang: string, accept: FileKind[], maxKb?: number): string {
  const biggest = Math.max(...accept.map((k) => maxKbOf(k, maxKb)));
  return ui(lang, "fileHint", { types: acceptedText(accept), size: biggest >= 1024 ? `${Math.round(biggest / 1024)} MB` : `${biggest} KB` });
}
export function fileMessage(lang: string, problem: FileProblem, accept: FileKind[], maxKb?: number): string {
  if (problem === "type") return ui(lang, "fileType", { types: acceptedText(accept) });
  if (problem === "empty") return ui(lang, "fileEmpty");
  const biggest = Math.max(...accept.map((k) => maxKbOf(k, maxKb)));
  return ui(lang, "fileTooBig", { size: biggest >= 1024 ? `${Math.round(biggest / 1024)} MB` : `${biggest} KB` });
}
/** The value to save for a chosen, checked file. */
export const fileValue = (f: { name: string; size: number }, content?: string): FileValue => {
  const kind = fileKindOf(f.name)!;
  return { name: f.name, size: f.size, kind, ...(content !== undefined && TEXT_KINDS.includes(kind) ? { content } : {}) };
};
