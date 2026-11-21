# Research: invest

BankWorkx® Retail, Save & Borrow. Prototype: `design/bankworkx-r1/src/journeys/65-save-borrow.js` to `68-invest.js`. Synthetic data. Checked 4 Nov 2026 from search summaries only; unconfirmed points are marked.

## Sources
- https://www.esma.europa.eu/node/204224 : ESMA appropriateness material
- https://www.fdcapital.co.uk/appropriateness-assessments-mifid-ii-guide/ : practical guide, clear warning with evidence (secondary)

## Patterns by market and rules
| Market | Note |
|---|---|
| United States | See text below; not separately verified unless stated. |
| United Kingdom | See text below. |
| Europe | See text below. |
| Middle East | See text below. |

EU: complex products need an appropriateness check and clear warning; plain funds may be execution-only. UK, US, UAE: not verified. Decision: small fund shelf with risk chips and ongoing charge, fund minimum, one risk checkbox for high-risk funds, review, code.

## Fields
| Field | Rule | Message |
|---|---|---|
| Amount | at least the fund minimum | The smallest amount for this fund is {min}. |
| Risk box | required for high risk | Please confirm to continue. |

## Edge cases
Account frozen or short of money; service timeout on submit (check Activity before retrying); a failed code changes nothing.

## Open questions
One checkbox stands in for the full questionnaire. Open: suitability questions before a first investment.
