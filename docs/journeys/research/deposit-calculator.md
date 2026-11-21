# Deposit calculator (`deposit-calculator`)

## Sources
- No pages fetched; common bank practice (UNVERIFIED).

## Patterns by market
| Market | Pattern |
|---|---|
| United States | APY shown, term certificates. |
| United Kingdom | AER shown, gross and net. |
| Europe | Gross rate; tax varies by country. |
| Middle East | Profit rate for Islamic deposits; often no tax. |
UNVERIFIED.

## Rules in plain English
Show the rate, total interest and amount back, and say rates can change.

## Decisions for BankWorkx®
Slider for amount, term chips with a rate per term, optional monthly interest. Simple interest for the estimate; no tax. Start application only if registered.

## Fields
| Field | Rule | Message |
|---|---|---|
| Amount | 500 to 100,000 slider | none |
| Term | 3, 6, 12, 24, 60 months | none |

## Edge cases
Monthly payout hides at-maturity total; rates change.

## Open questions
Tax treatment, compounding, early withdrawal.

