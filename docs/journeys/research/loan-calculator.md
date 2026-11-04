# Loan calculator (`loan-calculator`)

## Sources
- No pages fetched. Based on common bank calculators and the standard annuity formula (UNVERIFIED against specific banks).

## Patterns by market
| Market | Pattern |
|---|---|
| United States | Amount, term, rate; shows monthly payment and total interest. |
| United Kingdom | Shows a representative APR and "your rate may differ". |
| Europe | Annual percentage rate of charge shown near the result. |
| Middle East | Often flat-rate quotes; some banks show profit rate for Islamic products. |
UNVERIFIED general knowledge.

## Rules in plain English
Show the rate type, the total to repay and a plain "estimate only" line. No personal data is collected.

## Decisions for BankWorkx®
Product chips from a small table, sliders for amount and term bounded per product, live monthly payment (annuity), total interest, total to repay, rate. Start application only if the bank has that journey. Currency symbol follows the home market; no country names.

## Fields
| Field | Rule | Message |
|---|---|---|
| Amount | slider within product limits | none (slider cannot go outside) |
| Term | slider in steps of 6 or 12 months | none |

## Edge cases
Zero-rate product (payment is amount over months); product limits change on switching product; rates unavailable.

## Open questions
Fees, insurance and APR display per regulator.

