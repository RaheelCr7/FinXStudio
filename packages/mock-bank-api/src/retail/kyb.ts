import { BankError } from "../errors";
import type { Flaws } from "../business/corporate";
import type { BankConfig } from "../config";
import { secretHash } from "../hash";
import { validEmail, validName } from "../business/admin";
import { MARKET_BY_HOME, type PubMarket } from "./public-data";

/**
 * A company applying for business banking before anyone signs in (BankWorkx, Public: `kyb-onboarding`). The bank checks each step of the application (company, owners and directors, what the
 * business does, documents, tax declaration), then takes the application and gives it a reference. No adapter here answers with account data and none moves money; no one-time code is asked.
 *
 * What is kept is small and made up: the reference, the company's name and a hash of its registration number (to refuse a second application), how many people were named and the tracker stage.
 * Documents are a name and a size, never a file; a tax ID is shown masked ("•••• 789") and kept as a hash; the owners' emails and every typed value are data, never markup or instructions.
 * Every rule can be switched off for the mutation check (Flaws).
 */
export type KybHost = { now: () => number; config: () => BankConfig; flaws: () => Flaws };
const ADAPTERS = /^(bank\.kyb\.(config|check|submit)|sandbox\.kyb\.inspect)$/;

const TYPES = ["Private company", "Public company", "Partnership", "Sole trader", "Non-profit organisation"];
export const KYB_COUNTRIES: [string, string][] = [["US", "United States"], ["GB", "United Kingdom"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["IE", "Ireland"], ["CA", "Canada"], ["AU", "Australia"], ["IN", "India"], ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["JO", "Jordan"], ["EG", "Egypt"], ["PK", "Pakistan"]];
const ROLES = ["Owner and director", "Owner", "Director"];
const INDUSTRIES = ["Retail and wholesale", "Transport and logistics", "Construction", "Food and hospitality", "Professional services", "Technology", "Manufacturing", "Health and education", "Other"];
const SOURCES = ["Sales to customers", "Investors or owners", "Loans", "Grants", "Other"];
const BANDS: Record<"turnover" | "money" | "payments", [string, string][]> = {
  turnover: [["t1", "Under {s}100,000"], ["t2", "{s}100,000 to {s}500,000"], ["t3", "{s}500,000 to {s}2M"], ["t4", "Over {s}2M"]],
  money: [["m1", "Under {s}50,000"], ["m2", "{s}50,000 to {s}250,000"], ["m3", "{s}250,000 to {s}1M"], ["m4", "Over {s}1M"]],
  payments: [["p1", "Up to 20"], ["p2", "21 to 100"], ["p3", "101 to 500"], ["p4", "Over 500"]],
};
const MARKETS: Record<PubMarket, { symbol: string; tax: string; taxMessage: string; sample: string; postal: boolean }> = {
  A: { symbol: "$", tax: "9 digits", taxMessage: "Enter the 9 digits.", sample: "123456789", postal: true },
  B: { symbol: "£", tax: "10 digits", taxMessage: "Enter the 10 digits.", sample: "1234567890", postal: true },
  C: { symbol: "€", tax: "8 to 14 letters or digits", taxMessage: "Use 8 to 14 letters or digits.", sample: "DE12345678", postal: true },
  D: { symbol: "AED ", tax: "15 digits", taxMessage: "Enter the 15 digits.", sample: "100123456700003", postal: false },
};
export const MAX_PEOPLE = 5;
const MAX_DOC_BYTES = 10 * 1024 * 1024;

function fail(code: string, message: string): never { throw new BankError(code, message); }
const s = (v: unknown) => String(v ?? "").trim();
const digitsOnly = (t: string) => { let o = ""; for (const ch of t) if (ch >= "0" && ch <= "9") o += ch; return o; };
const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const isAlnum = (ch: string) => isDigit(ch) || (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
const compact = (t: string) => t.split(" ").join("").split("-").join("");
const fillSymbol = (text: string, sym: string) => text.split("{s}").join(sym);

type App = { reference: string; company: string; regHash: string; people: number; stage: "checking" };

export class KybApi {
  private apps: App[] = [{ reference: "KYB-10001", company: "Seed Trading Ltd", regHash: secretHash("DUPLICATE", "kyb-reg", 8), people: 1, stage: "checking" }];
  private seq = 10001;
  constructor(private host: KybHost) {}
  handles = (adapter: string) => ADAPTERS.test(adapter);
  private get f() { return this.host.flaws(); }
  private market = (): PubMarket => MARKET_BY_HOME[this.host.config().homeMarket] ?? "A";
  private on = (key: string, dflt: boolean) => { const v = this.host.config().options["kyb-onboarding"]?.[key]; return v === undefined ? dflt : v !== false; };

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.kyb.config": return this.config();
      case "bank.kyb.check": return this.check(input);
      case "bank.kyb.submit": return this.submit(input);
      case "sandbox.kyb.inspect": return this.inspect(input);
    }
    return undefined;
  }

  /** The market's rules and the choices of the form: the tax ID, the sign of money, whether the postal code is needed, the lists. */
  private config() {
    const m = MARKETS[this.market()], sym = m.symbol;
    const list = (b: [string, string][]) => Object.fromEntries(b.map(([id, label]) => [id, { id, name: fillSymbol(label, sym) }]));
    const plain = (xs: string[]) => Object.fromEntries(xs.map((x) => [x, { id: x, name: x }]));
    return {
      market: this.market(), symbol: sym, taxHint: m.tax, taxMessage: m.taxMessage, taxSample: m.sample, postalRequired: m.postal, askChart: this.on("askChart", false), maxPeople: MAX_PEOPLE,
      countries: Object.fromEntries(KYB_COUNTRIES.map(([id, name]) => [id, { id, name }])), types: plain(TYPES), roles: plain(ROLES), industries: plain(INDUSTRIES), sources: plain(SOURCES),
      turnover: list(BANDS.turnover), money: list(BANDS.money), payments: list(BANDS.payments),
    };
  }

  /** The people of step 2 from the flat fields p1Name, p1Email, p1Role, p1Own ... p5Own (the engine resolves only the top level of a call's input). */
  private people(input: Record<string, any>) {
    const n = Math.min(Number(input.count) || 0, MAX_PEOPLE);
    if (Number(input.count) > MAX_PEOPLE && this.f.kybFields !== false) fail("TOO_MANY_PEOPLE", `You can name up to ${MAX_PEOPLE} people.`);
    return Array.from({ length: n }, (_, i) => ({ name: s(input[`p${i + 1}Name`]), email: s(input[`p${i + 1}Email`]), role: s(input[`p${i + 1}Role`]), own: s(input[`p${i + 1}Own`]) }));
  }

  private company(input: Record<string, any>) {
    const f = this.f, m = MARKETS[this.market()];
    if (f.kybFields !== false) {
      if (s(input.legalName).length < 2) fail("LEGAL_NAME_REQUIRED", "Enter the company’s legal name.");
      const reg = s(input.registrationNo);
      if (reg.length < 5 || reg.length > 20 || ![...reg].every((ch) => isAlnum(ch) || ch === "-" || ch === "/" || ch === " ")) fail("INVALID_REGISTRATION", "Use 5 to 20 letters or digits.");
      if (!TYPES.includes(s(input.companyType))) fail("TYPE_REQUIRED", "Choose the type of company.");
      if (!KYB_COUNTRIES.some(([id]) => id === s(input.country))) fail("COUNTRY_REQUIRED", "Choose the country of registration.");
      if (!s(input.address)) fail("ADDRESS_REQUIRED", "Enter the registered address.");
      if (!s(input.city)) fail("CITY_REQUIRED", "Enter the city.");
      if (m.postal && !s(input.postcode)) fail("POSTCODE_REQUIRED", "Enter the postal code.");
    }
    const parts = s(input.incorporated).split("/");
    const [d, mo, y] = parts.map((p) => (p.length > 0 && [...p].every(isDigit) ? Number(p) : NaN));
    const real = parts.length === 3 && parts[0]!.length <= 2 && parts[1]!.length <= 2 && parts[2]!.length === 4 && d! >= 1 && mo! >= 1 && mo! <= 12 && new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDate() === d && new Date(Date.UTC(y!, mo! - 1, d!)).getUTCMonth() === mo! - 1;
    if (!real) fail("INVALID_DATE", "Enter the date as DD/MM/YYYY.");
    if (f.kybFields !== false) {
      if (Date.UTC(y!, mo! - 1, d!) > this.host.now()) fail("DATE_IN_FUTURE", "The date can’t be in the future.");
      if (y! < 1900) fail("INVALID_YEAR", "Check the year.");
    }
  }
  private owners(input: Record<string, any>) {
    const f = this.f, people = this.people(input);
    if (f.kybFields !== false) {
      if (!people.length) fail("DIRECTOR_REQUIRED", "Add at least one director.");
      for (const p of people) {
        if (!validName(p.name)) fail("INVALID_NAME", "Enter their full name.");
        if (!validEmail(p.email)) fail("INVALID_EMAIL", "Enter a valid email, like name@company.com.");
        if (!ROLES.includes(p.role)) fail("ROLE_REQUIRED", "Choose a role.");
        if (p.role !== "Director") { const o = Number(p.own); if (!Number.isInteger(o) || o < 25 || o > 100) fail("INVALID_OWNERSHIP", "Enter 25 to 100."); }
      }
      const other = Number(input.other ?? 0);
      if (!Number.isInteger(other) || other < 0 || other > 75) fail("INVALID_OTHER_OWNERS", "Enter 0 to 75.");
    }
    if (f.kybOwnership !== false) {
      const total = people.filter((p) => p.role !== "Director").reduce((sum, p) => sum + (Number(p.own) || 0), 0) + (Number(input.other) || 0);
      if (total !== 100) fail("OWNERSHIP_TOTAL", `Ownership adds up to ${total}%. It must be 100%.`);
      if (!people.some((p) => p.role !== "Owner")) fail("DIRECTOR_REQUIRED", "Add at least one director.");
    }
    return people;
  }
  private business(input: Record<string, any>) {
    if (this.f.kybFields === false) return;
    if (!INDUSTRIES.includes(s(input.industry))) fail("INDUSTRY_REQUIRED", "Choose the industry.");
    if (s(input.about).length < 10) fail("ABOUT_REQUIRED", "Tell us a little more.");
    if (!KYB_COUNTRIES.some(([id]) => id === s(input.tradeCountry))) fail("COUNTRY_REQUIRED", "Choose the main country of trade.");
    if (!BANDS.turnover.some(([id]) => id === s(input.turnover))) fail("TURNOVER_REQUIRED", "Choose the yearly turnover.");
    if (!BANDS.money.some(([id]) => id === s(input.money))) fail("MONEY_REQUIRED", "Choose the expected money in each month.");
    if (!BANDS.payments.some(([id]) => id === s(input.payments))) fail("PAYMENTS_REQUIRED", "Choose the payments each month.");
    if (!SOURCES.includes(s(input.source))) fail("SOURCE_REQUIRED", "Choose where the money comes from.");
  }
  /** A document is a name and a size: PDF, JPG or PNG, up to 10 MB. The two documents every application needs are checked; the ownership chart only when the bank asks for it. */
  private documents(input: Record<string, any>) {
    if (this.f.kybDocs === false) return;
    const ok = (name: string, bytes: unknown) => { const n = name.toLowerCase(); return (n.endsWith(".pdf") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png")) && Number(bytes) > 0 && Number(bytes) <= MAX_DOC_BYTES; };
    if (!s(input.certName)) fail("CERTIFICATE_REQUIRED", "Add the certificate.");
    if (!s(input.proofName)) fail("PROOF_REQUIRED", "Add a proof of address.");
    if (!ok(s(input.certName), input.certSize ?? 1) || !ok(s(input.proofName), input.proofSize ?? 1) || (s(input.chartName) && !ok(s(input.chartName), input.chartSize ?? 1))) fail("INVALID_DOCUMENT", "Use a PDF, JPG or PNG file up to 10 MB.");
  }
  private tax(input: Record<string, any>) {
    if (this.f.kybTax === false) return { masked: "" };
    if (!KYB_COUNTRIES.some(([id]) => id === s(input.taxCountry))) fail("COUNTRY_REQUIRED", "Choose the country of tax residence.");
    const id = compact(s(input.taxId)), m = this.market();
    const ok = m === "A" ? id.length === 9 && [...id].every(isDigit) : m === "B" ? id.length === 10 && [...id].every(isDigit) : m === "C" ? id.length >= 8 && id.length <= 14 && [...id].every(isAlnum) : id.length === 15 && [...id].every(isDigit);
    if (!ok) fail("INVALID_TAX_ID", MARKETS[m].taxMessage);
    return { masked: `•••• ${id.slice(-3)}` };
  }

  private check(input: Record<string, any>) {
    switch (Number(input.step)) {
      case 1: this.company(input); return { ok: true };
      case 2: { const people = this.owners(input); const listed = people.filter((p) => p.role !== "Director").reduce((sum, p) => sum + (Number(p.own) || 0), 0) + (Number(input.other) || 0); return { ok: true, people: people.length, listed }; }
      case 3: this.business(input); return { ok: true };
      case 4: this.documents(input); return { ok: true };
      case 5: { const t = this.tax(input); return { ok: true, taxMasked: t.masked }; }
    }
    return fail("INVALID_STEP", "Unknown step.");
  }

  private submit(input: Record<string, any>) {
    this.company(input); const people = this.owners(input); this.business(input); this.documents(input); const tax = this.tax(input);
    if (this.f.kybConsent !== false) {
      if (input.agreeTerms !== true) fail("TERMS_REQUIRED", "Please agree to continue.");
      if (input.confirmTrue !== true) fail("TRUTH_REQUIRED", "Please confirm to continue.");
    }
    const key = compact(s(input.registrationNo)).toUpperCase();
    const regHash = secretHash(key, "kyb-reg", 8);
    if (this.f.kybDuplicate !== false && this.apps.some((a) => a.regHash === regHash)) fail("DUPLICATE_APPLICATION", "We already have an application for this registration number.");
    const reference = `KYB-${++this.seq}`;
    this.apps.push({ reference, company: s(input.legalName), regHash, people: people.length, stage: "checking" });
    const reg = s(input.registrationNo);
    return {
      reference, company: s(input.legalName), registrationMasked: `•••• ${reg.slice(-4)}`, taxMasked: tax.masked, people: people.length, stage: "checking", stageText: "Checking your documents",
      steps: { received: "We have your application.", checking: "This usually takes 1 to 2 working days.", identity: "We email each owner and director.", ready: "You can sign in and pay." },
    };
  }

  /** Scenarios only: whether a text is anywhere in what the bank keeps about applications (a tax ID, an email, a registration number must not be). */
  private inspect(input: Record<string, any>) {
    const dump = JSON.stringify(this.apps);
    return { count: this.apps.length, references: this.apps.map((a) => a.reference), ...(input.contains !== undefined ? { found: dump.includes(String(input.contains)) } : {}) };
  }
}
