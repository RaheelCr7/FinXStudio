import { currencyInfo, formatMoney } from "@finx/ui-kit";
import type { HomeMarket } from "../config";
import type { CorpBeneficiary, CorpCompany } from "./corporate";

/** What a company can say a supplier payment is for (the spec's list), besides the personal ones the sandbox has always taken. */
export const BUSINESS_PURPOSES = ["Goods", "Services", "Rent", "Utilities", "Taxes and duties", "Other"];

/** The countries a supplier can be in for the bank's home-market rails to serve the payment. */
export const DOMESTIC: Record<HomeMarket, string[]> = { us: ["US"], uk: ["GB"], eu: ["DE", "FR", "ES", "IT", "NL", "IE", "BE", "AT", "PT", "FI", "LU", "GR"], ae: ["AE"], sa: ["SA"], jo: ["JO"] };

/** A supplier on a line: the currency it is paid in and the last 4 digits of its account ("USD · ••8841"). */
export const supplierLine = (b: CorpBeneficiary, co: CorpCompany) => `${b.currency ?? co.currency} · ••${b.maskedNumber.replace(/\D/g, "").slice(-4)}`;

/** Money with the currency's own decimals always shown ($4,500.00, -$5.00), for the words a screen draws. */
export const fmt = (amount: number, currency: string) => formatMoney(amount, currency, "en-US", undefined, true);
/** The digits a currency shows. */
export const digitsOf = (currency: string) => currencyInfo(currency).decimals;
