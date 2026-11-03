/**
 * Country profiles: the facts a new project starts from. Every profile is a DRAFT for a person at the bank to confirm: it names the
 * regulator and links to its site, and it is not legal or compliance guidance. Rules and guidelines per country belong in the
 * knowledge base (planned), which these profiles will point to.
 */
export type CountryProfile = {
  code: string; name: string; currency: string; locale: string;
  /** Languages usually offered, the first being the default. */
  languages: string[];
  regulator: { name: string; url: string };
  nationalId: string;
  /** Days the banks are usually closed. */
  weekend: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[];
  dialCode: string;
  status: "draft" | "approved";
};

const P = (code: string, name: string, currency: string, locale: string, languages: string[], reg: [string, string], nationalId: string, weekend: CountryProfile["weekend"], dialCode: string): CountryProfile =>
  ({ code, name, currency, locale, languages, regulator: { name: reg[0], url: reg[1] }, nationalId, weekend, dialCode, status: "draft" });
const SS: CountryProfile["weekend"] = ["sat", "sun"], FS: CountryProfile["weekend"] = ["fri", "sat"];

export const COUNTRIES: CountryProfile[] = [
  P("PK", "Pakistan", "PKR", "en-PK", ["en", "ur"], ["State Bank of Pakistan", "https://www.sbp.org.pk"], "CNIC", SS, "+92"),
  P("JO", "Jordan", "JOD", "en-JO", ["en", "ar"], ["Central Bank of Jordan", "https://www.cbj.gov.jo"], "National number", FS, "+962"),
  P("AE", "United Arab Emirates", "AED", "en-AE", ["en", "ar"], ["Central Bank of the UAE", "https://www.centralbank.ae"], "Emirates ID", SS, "+971"),
  P("SA", "Saudi Arabia", "SAR", "en-SA", ["ar", "en"], ["Saudi Central Bank", "https://www.sama.gov.sa"], "National ID or Iqama", FS, "+966"),
  P("EG", "Egypt", "EGP", "en-EG", ["ar", "en"], ["Central Bank of Egypt", "https://www.cbe.org.eg"], "National ID", FS, "+20"),
  P("KW", "Kuwait", "KWD", "en-KW", ["ar", "en"], ["Central Bank of Kuwait", "https://www.cbk.gov.kw"], "Civil ID", FS, "+965"),
  P("QA", "Qatar", "QAR", "en-QA", ["ar", "en"], ["Qatar Central Bank", "https://www.qcb.gov.qa"], "Qatar ID", FS, "+974"),
  P("BH", "Bahrain", "BHD", "en-BH", ["ar", "en"], ["Central Bank of Bahrain", "https://www.cbb.gov.bh"], "CPR number", FS, "+973"),
  P("OM", "Oman", "OMR", "en-OM", ["ar", "en"], ["Central Bank of Oman", "https://cbo.gov.om"], "Civil number", FS, "+968"),
  P("IN", "India", "INR", "en-IN", ["en", "hi"], ["Reserve Bank of India", "https://www.rbi.org.in"], "Aadhaar or PAN", ["sun"], "+91"),
  P("US", "United States", "USD", "en-US", ["en", "es"], ["Federal Reserve", "https://www.federalreserve.gov"], "SSN", SS, "+1"),
  P("GB", "United Kingdom", "GBP", "en-GB", ["en"], ["Financial Conduct Authority", "https://www.fca.org.uk"], "Passport or driving licence", SS, "+44"),
  P("DE", "Germany", "EUR", "de-DE", ["de", "en"], ["BaFin", "https://www.bafin.de"], "Personalausweis", SS, "+49"),
  P("FR", "France", "EUR", "fr-FR", ["fr", "en"], ["ACPR (Banque de France)", "https://acpr.banque-france.fr"], "Carte nationale d'identité", SS, "+33"),
];

export const countryByCode = (code: string) => COUNTRIES.find((c) => c.code === code.toUpperCase());
/** The country in a locale such as en-JO, if we have a profile for it. */
export const countryOfLocale = (locale: string) => countryByCode(locale.split(/[-_]/)[1] ?? "");
