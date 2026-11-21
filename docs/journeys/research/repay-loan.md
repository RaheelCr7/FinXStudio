# Research: repay-loan

BankWorkx® Retail, Save & Borrow. Prototype: `design/bankworkx-r1/src/journeys/65-save-borrow.js` to `68-invest.js`. Synthetic data. Checked 4 Nov 2026 from search summaries only; unconfirmed points are marked.

## Sources
- No web source read for this journey; written from general knowledge of retail banking apps. Not verified.

## Patterns by market and rules
| Market | Note |
|---|---|
| United States | See text below; not separately verified unless stated. |
| United Kingdom | See text below. |
| Europe | See text below. |
| Middle East | See text below. |

Lenders generally allow overpayment; early settlement may carry a fee. Decision: next instalment, any amount, or settle in full (balance plus interest since last payment plus 1% fee when over 12 months remain), figure shown before choosing.

## Fields
| Field | Rule | Message |
|---|---|---|
| Other amount | 10 up to below balance | To pay everything off, choose Settle in full. |

## Edge cases
Account frozen or short of money; service timeout on submit (check Activity before retrying); a failed code changes nothing.

## Open questions
Fee rule invented. Not verified online.
