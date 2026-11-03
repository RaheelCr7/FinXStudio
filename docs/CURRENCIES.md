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

## In journeys (step 3)
- **Currency from data:** `amountInput.currency` is a code (`"JOD"`) or a path (`"{{ account.currency }}"`), read when the screen is shown. The block's symbol, keypad and decimals follow it.
- **Decimals:** the amount field takes the currency's own places (JOD 3, USD 2, JPY 0) with a decimal keypad; a trailing point stays while you type ("12." then "12.5"), extra places are cut, and a number with too many places is refused on Continue ("Use at most 3 decimal places", "Enter a whole amount, without decimals"; English and Urdu).
- **Lint:** `amount_no_currency`, `amount_currency_invalid` (neither a code nor a path), `currency_mismatch` (differs from the dataModel entry), `mixed_currency` (more than one fixed currency in a journey; fine for a conversion). `{{ x | money:JOD }}` and a path argument are accepted by the formatter lint.
- Limit: a currency a bank added itself is not known to the engine yet, so it is treated as 2 decimals inside a journey.

## Not built yet (next steps, in order)
1. Sandbox accounts in several currencies, pickers and statements grouped by currency.
2. FX: rate table with spread and fee, quotes that expire, a convert journey and cross-currency transfer with the rate on the review screen.
3. Pass a project's own currencies to the engine.
