# Currencies and money

Step 1 of multi-currency (plan section 15). One place knows how each currency is written: `packages/ui-kit/src/currency.ts`.

## What is built
- **Registry:** 51 currencies (ISO 4217) with name, symbol and the digits after the point: JPY, KRW, VND, IQD, LBP use 0; KWD, BHD, OMR, JOD, TND, LYD use 3; the rest 2. An unknown code is shown as itself with 2 digits.
- **`formatMoney(amount, currency, locale)`:** symbol, then the number grouped for the locale. A one-character symbol sits tight (`$50`), a code gets a space (`PKR 5,000`, `JOD 12.500`). Whole amounts show no decimals; part amounts show the currency's own digits. Rounds half away from zero. A negative amount is `-$86.50`. An Arabic or Urdu locale (`ar-EG`, `ur-PK`) gives native digits.
- **Minor units:** `toMinor`, `fromMinor`, `roundMoney` turn an amount into whole cents or fils and back, so sums are not done in floating point (0.1 + 0.2 is 30 cents).
- **Template filter:** `{{ amount | money:JOD }}` or `{{ amount | money:account.currency }}` writes money in that currency. `{{ amount | money }}` without a currency is unchanged (a plain number).
- **A bank's own currency:** `validateCustomCurrency` checks a code, name, symbol and decimals; `currencyInfo(code, custom)` prefers the bank's own entry. They are stored with the project (see Studio below).

## Studio
**Currencies** (sidebar): tick the currencies the project offers, pick the base currency, add your own (code, name, symbol, decimals, with a live preview of how it prints). Saved with the project shape (`PATCH /api/projects/:id/shape`, fields `currencies`, `baseCurrency`, `customCurrencies`) in the bank's entry in `brands.json`; the answer carries the previous shape so Undo works. The base currency is always offered; a currency an entity uses cannot be dropped; an added currency cannot be removed while the base currency or an entity uses it. Existing projects need no migration: with nothing stored, the list is the base currency plus each entity's.

## Not built yet (next steps, in order)
1. Amounts with decimals in the amount field (today it types whole units), `amountInput.currency` as a data path, lint for mixed-currency sums.
2. Sandbox accounts in several currencies, pickers and statements grouped by currency.
3. FX: rate table with spread and fee, quotes that expire, a convert journey and cross-currency transfer with the rate on the review screen.
