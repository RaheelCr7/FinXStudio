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

## In the sandbox bank (step 4)
- **A customer with accounts in four currencies:** Hana Al Mazrouei (`hina`, Meezan app, test code 482100): PKR current, USD savings, AED and KWD (3 decimals) accounts.
- **A limit per currency:** `limits` still applies to the currency of the first account; other currencies have their own entry (`limitsByCurrency`). `bank.limits.get` takes an optional `currency`, and answers `LIMIT_NOT_SET` for a currency with no limit. Transfers, bill payments and top-ups check the balance and limit of the account's own currency, and use that currency's rounding. A transfer's answer includes the `currency`.
- **Totals per currency:** `bank.accounts.totals` adds balances up per currency, never across currencies, as a list a journey can show.
- Account pickers already show each balance in its own currency.

## FX (step 5)
- **Sandbox rates:** a mid-market table (units per US dollar for USD, PKR, AED, KWD, EUR, GBP, JOD, SAR, INR, JPY). The customer's rate is the mid rate less a 0.5% spread, to six decimals; a fee of 0.2% of the amount sent is charged in the currency sent. A real bank's rate provider replaces the table behind the same adapters.
- **`bank.fx.rate`** (a pair's mid and customer rate), **`bank.fx.quote`** (prices an amount between two of the customer's own accounts in different currencies, to each currency's own decimals; valid for 30 seconds) and **`bank.fx.convert`** (after the one-time code: debits amount plus fee, credits the converted amount, each quote works once; `QUOTE_EXPIRED`, `QUOTE_USED`, `INSUFFICIENT_FUNDS`, `SAME_CURRENCY`). Conversions between a customer's own accounts do not use the daily payment limits.
- **Journey "Convert between my accounts"** (catalog, Accounts): choose the account to convert from and to, enter the amount in the currency of the account it leaves (read from that account, with its own decimals), see the rate, fee and what you get on the review screen with the rate's validity, consent, one-time code, receipt. If the rate runs out while the customer is typing the code, nothing is converted and "Try again" gets a new rate. Try it with the sandbox customer Hana Al Mazrouei.

## Not built yet
1. Cross-currency payments to someone else (a beneficiary in another currency): the quote and convert adapters work between a customer's own accounts only.
2. Studio: edit the rate table, spread and fee per project; a real rate provider behind the adapters.
3. Pass a project's own currencies to the engine; a currency a bank added itself is not known to the sandbox FX table.
