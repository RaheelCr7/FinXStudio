# Research: sell-investment

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

Funds settle in a few business days; proceeds are estimates. Decision: amount or everything, optional 0.25% fee, settlement 2 business days, code.

## Fields
| Field | Rule | Message |
|---|---|---|
| Amount | 10 up to holding value | You can't sell more than {value}. |

## Edge cases
Account frozen or short of money; service timeout on submit (check Activity before retrying); a failed code changes nothing.

## Open questions
Not verified online. Open: hold proceeds until settlement?
