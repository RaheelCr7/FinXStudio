/** The languages a project can offer. A project can also add its own (see ProjectLanguage). */
export type Direction = "ltr" | "rtl";
export type LanguageInfo = { code: string; name: string; native: string; dir: Direction };

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", native: "English", dir: "ltr" },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl" },
  { code: "ur", name: "Urdu", native: "اردو", dir: "rtl" },
  { code: "fa", name: "Persian", native: "فارسی", dir: "rtl" },
  { code: "he", name: "Hebrew", native: "עברית", dir: "rtl" },
  { code: "fr", name: "French", native: "Français", dir: "ltr" },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr" },
  { code: "de", name: "German", native: "Deutsch", dir: "ltr" },
  { code: "tr", name: "Turkish", native: "Türkçe", dir: "ltr" },
  { code: "hi", name: "Hindi", native: "हिन्दी", dir: "ltr" },
  { code: "bn", name: "Bengali", native: "বাংলা", dir: "ltr" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", dir: "ltr" },
];

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));
const base = (code: string) => code.toLowerCase().split(/[-_]/)[0]!;

export const languageInfo = (code: string): LanguageInfo | undefined => byCode.get(base(code));
/** Right to left? Known languages by their direction; unknown codes are left to right. */
export const isRtlLanguage = (code: string): boolean => languageInfo(code)?.dir === "rtl";

/** A language code such as en, ur or pt-BR: two or three letters, optionally a region. */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
