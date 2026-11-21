# Research: add-money

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

Card top-ups are usually instant with a fee or limit; bank transfer shows identifiers (routing and account number, sort code, IBAN and BIC by market) with Copy. Decision: card path 10 to 5,000 with fee line and code; transfer path shows identifiers from the account model and needs no code.

## Fields
| Field | Rule | Message |
|---|---|---|
| Amount | 10 to 5,000 | The smallest amount is $10.00. |
| Security code | 3 digits | Enter the 3 digits on the back of the card. |

## Edge cases
Account frozen or short of money; service timeout on submit (check Activity before retrying); a failed code changes nothing.

## Open questions
Fee of 1.5% invented. Not verified online.
