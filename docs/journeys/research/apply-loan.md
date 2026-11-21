# Research: apply-loan

BankWorkx® Retail, Save & Borrow. Prototype: `design/bankworkx-r1/src/journeys/65-save-borrow.js` to `68-invest.js`. Synthetic data. Checked 4 Nov 2026 from search summaries only; unconfirmed points are marked.

## Sources
- https://handbook.fca.org.uk/handbook/CONC/5/ : UK creditworthiness and affordability rules (CONC 5)
- https://www.fca.org.uk/firms/creditworthiness-and-affordability-common-misunderstandings : affordability is part of creditworthiness

## Patterns by market and rules
| Market | Note |
|---|---|
| United States | See text below; not separately verified unless stated. |
| United Kingdom | See text below. |
| Europe | See text below. |
| Middle East | See text below. |

UK lenders must assess creditworthiness and affordability in proportion to the loan; other markets similar (to confirm). Decision: slider and term chips with live payment, decline when income is too low or payments exceed 50% of income, refer 40 to 50% or large amounts, otherwise offer with total repayable and first payment date, then code. Max 3 loans.

## Fields
| Field | Rule | Message |
|---|---|---|
| Income | above 0 | Enter your monthly income. |
| Terms | must agree | Agree to the terms to continue. |

## Edge cases
Account frozen or short of money; service timeout on submit (check Activity before retrying); a failed code changes nothing.

## Open questions
Thresholds are sandbox policy. Unverified: disclosure wording per market.
