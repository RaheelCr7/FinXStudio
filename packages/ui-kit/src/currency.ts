/**
 * Currencies: the ISO 4217 ones a bank is likely to offer, with the number of minor-unit digits each uses (JPY 0, USD 2, JOD 3)
 * and the short form people expect in front of an amount. A bank can add its own in `brands.json` ("customCurrencies").
 */
export type CurrencyInfo = { code: string; name: string; symbol: string; /** Digits after the point: 0, 2 or 3. */ decimals: number; custom?: boolean };

// code, name, symbol, decimals. A one-character symbol sits tight against the number ($50); a code gets a space (PKR 50).
const DATA: [string, string, string, number][] = [
  ["USD", "US dollar", "$", 2], ["EUR", "Euro", "€", 2], ["GBP", "Pound sterling", "£", 2], ["JPY", "Japanese yen", "¥", 0], ["CHF", "Swiss franc", "CHF", 2],
  ["CAD", "Canadian dollar", "CA$", 2], ["AUD", "Australian dollar", "A$", 2], ["NZD", "New Zealand dollar", "NZ$", 2], ["CNY", "Chinese yuan", "CN¥", 2], ["HKD", "Hong Kong dollar", "HK$", 2],
  ["SGD", "Singapore dollar", "S$", 2], ["INR", "Indian rupee", "₹", 2], ["PKR", "Pakistani rupee", "PKR", 2], ["BDT", "Bangladeshi taka", "৳", 2], ["LKR", "Sri Lankan rupee", "LKR", 2],
  ["AED", "UAE dirham", "AED", 2], ["SAR", "Saudi riyal", "SAR", 2], ["QAR", "Qatari riyal", "QAR", 2], ["KWD", "Kuwaiti dinar", "KWD", 3], ["BHD", "Bahraini dinar", "BHD", 3],
  ["OMR", "Omani rial", "OMR", 3], ["JOD", "Jordanian dinar", "JOD", 3], ["EGP", "Egyptian pound", "EGP", 2], ["ILS", "Israeli shekel", "₪", 2], ["TRY", "Turkish lira", "₺", 2],
  ["IQD", "Iraqi dinar", "IQD", 0], ["LBP", "Lebanese pound", "LBP", 0], ["MAD", "Moroccan dirham", "MAD", 2], ["TND", "Tunisian dinar", "TND", 3], ["DZD", "Algerian dinar", "DZD", 2],
  ["LYD", "Libyan dinar", "LYD", 3], ["MRU", "Mauritanian ouguiya", "MRU", 2], ["ZAR", "South African rand", "R", 2], ["NGN", "Nigerian naira", "₦", 2], ["KES", "Kenyan shilling", "KSh", 2],
  ["GHS", "Ghanaian cedi", "GH₵", 2], ["BRL", "Brazilian real", "R$", 2], ["MXN", "Mexican peso", "MX$", 2], ["ARS", "Argentine peso", "ARS", 2], ["RUB", "Russian rouble", "₽", 2],
  ["PLN", "Polish zloty", "zł", 2], ["SEK", "Swedish krona", "kr", 2], ["NOK", "Norwegian krone", "NOK", 2], ["DKK", "Danish krone", "DKK", 2], ["CZK", "Czech koruna", "Kč", 2],
  ["HUF", "Hungarian forint", "Ft", 2], ["KRW", "South Korean won", "₩", 0], ["THB", "Thai baht", "฿", 2], ["MYR", "Malaysian ringgit", "RM", 2], ["IDR", "Indonesian rupiah", "Rp", 2],
  ["PHP", "Philippine peso", "₱", 2], ["VND", "Vietnamese dong", "₫", 0],
];

export const CURRENCY_LIST: CurrencyInfo[] = DATA.map(([code, name, symbol, decimals]) => ({ code, name, symbol, decimals }));
const BY_CODE = new Map(CURRENCY_LIST.map((c) => [c.code, c]));

/** What is known about a currency: the bank's own list first, then the built-in one. A code nobody knows is shown as its code with two decimals. */
export function currencyInfo(code: string, custom: CurrencyInfo[] = []): CurrencyInfo {
  return custom.find((c) => c.code === code) ?? BY_CODE.get(code) ?? { code, name: code, symbol: code, decimals: 2 };
}

export const symbolOf = (currency: string, custom?: CurrencyInfo[]) => currencyInfo(currency, custom).symbol;
/** Symbols that are a single character sit tight against the number ($50); codes and longer forms get a space (PKR 50). */
export const prefixOf = (currency: string, custom?: CurrencyInfo[]) => { const s = symbolOf(currency, custom); return s.length > 1 && /[A-Za-z]$/.test(s) ? `${s} ` : s; };

/** Why a bank's own currency is not acceptable, or null when it is. */
export function validateCustomCurrency(c: Partial<CurrencyInfo>, existing: CurrencyInfo[] = []): string | null {
  if (!c.code || !/^[A-Z]{3,4}$/.test(c.code)) return "The code must be 3 or 4 capital letters, like JOD.";
  if (BY_CODE.has(c.code)) return `${c.code} is already built in.`;
  if (existing.some((e) => e.code === c.code)) return `${c.code} has already been added.`;
  if (!c.name?.trim()) return "Give the currency a name.";
  if (!c.symbol?.trim() || c.symbol.length > 5) return "The symbol must be 1 to 5 characters.";
  if (c.decimals !== 0 && c.decimals !== 2 && c.decimals !== 3) return "Decimals must be 0, 2 or 3.";
  return null;
}

const pow = (d: number) => 10 ** d;
/** Round half away from zero, to the currency's own decimals: 2.675 USD becomes 2.68, -2.675 becomes -2.68. */
export function roundMoney(amount: number, currency: string, custom?: CurrencyInfo[]): number {
  const d = currencyInfo(currency, custom).decimals;
  const scaled = Number((Math.abs(amount) * pow(d)).toPrecision(15));
  return (Math.sign(amount) * Math.round(scaled)) / pow(d);
}
/** The amount as a whole number of the smallest unit (cents, fils): 12.5 JOD is 12500. Do sums in these, not in floating point. */
export function toMinor(amount: number, currency: string, custom?: CurrencyInfo[]): number {
  const d = currencyInfo(currency, custom).decimals;
  return Math.sign(amount) * Math.round(Number((Math.abs(amount) * pow(d)).toPrecision(15)));
}
export const fromMinor = (minor: number, currency: string, custom?: CurrencyInfo[]) => minor / pow(currencyInfo(currency, custom).decimals);

/**
 * Money for a person to read: the symbol, then the number grouped for the locale. Whole amounts show no decimals (PKR 5,000);
 * anything else shows the currency's own digits (JOD 12.500, $86.50). A negative amount puts the sign first (-$86.50).
 * Pass an Arabic or Urdu locale ("ar-EG", "ur-PK") for native digits.
 */
export function formatMoney(amount: number, currency = "PKR", locale = "en-US", custom?: CurrencyInfo[], fixed = false): string {
  const { decimals } = currencyInfo(currency, custom);
  const n = roundMoney(amount, currency, custom);
  let body: string;
  try {
    body = new Intl.NumberFormat(locale, { minimumFractionDigits: fixed || !Number.isInteger(n) ? decimals : 0, maximumFractionDigits: decimals }).format(Math.abs(n));
  } catch {
    body = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: fixed || !Number.isInteger(n) ? decimals : 0, maximumFractionDigits: decimals });
  }
  return `${n < 0 ? "-" : ""}${prefixOf(currency, custom)}${body}`;
}
