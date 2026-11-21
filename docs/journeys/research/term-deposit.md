# Research: term-deposit

BankWorkx® Retail, Save & Borrow. Prototype: `design/bankworkx-r1/src/journeys/65-save-borrow.js` to `68-invest.js`. Synthetic data. Checked 4 Nov 2026 from search summaries only; unconfirmed points are marked.

## Sources
- https://www.emiratesnbd.com/en/KFS/term-deposits : UAE key facts statement for term deposits (early-withdrawal terms not seen, to confirm)
- https://content.usbank.com/dam/onboarding/disclosures/en/savings/certificate_of_deposit_truth_in_savings.pdf : US certificate disclosure, penalty by original term
- https://hblbankuk.com/wp-content/uploads/2025/12/Fixed-Term-Deposit-Form.pdf : UK term deposit, penalty taken from accrued interest only

## Patterns by market and rules
| Market | Note |
|---|---|
| United States | See text below; not separately verified unless stated. |
| United Kingdom | See text below. |
| Europe | See text below. |
| Middle East | See text below. |

UK: early-withdrawal penalty only from interest. US: penalty set by original term. UAE: disclosed in the key facts statement (to confirm). Decision: terms 3/6/12/24 months, interest at maturity or monthly, early closure keeps back half the interest earned and never touches the money paid in, renew sets the maturity instruction, code on every change.

## Fields
| Field | Rule | Message |
|---|---|---|
| Amount | 1,000 to 250,000 | The smallest deposit is $1,000.00. |
| From | enough available | Not enough money in {account}. |

## Edge cases
Account frozen or short of money; service timeout on submit (check Activity before retrying); a failed code changes nothing.

## Open questions
Rates, limits and the 50% charge are invented. Open: cooling-off period.
