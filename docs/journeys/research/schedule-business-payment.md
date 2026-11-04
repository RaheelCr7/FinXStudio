# Research: schedule-business-payment

Prototype: `src/journeys/71-templates-schedule.js` (journey plus `business-schedules` view). Builds on `docs/journeys/research/schedule-payment.md`.

## Sources
| URL | Taken |
|---|---|
| https://www.td.com/ca/en/commercial-banking/wbb/help/wbwviewpendingpymtsfielddefnsandbusrules | Pending payments can be cancelled until late on the business day before processing. |
| https://www.suncorpbank.com.au/help-support/faqs/business-banking/internet-banking/business-payment-awaiting-approval.html | Awaiting Approval status for payments needing further sign-off. |
| https://commerceconnections.commercebank.com/cb/cb/help/approvals_approvepayments.html | Approvers approve or hold; final approval moves it on. |
Approval of a repeating payment once, then checks at each run: no public source found (unverified). It matches how standing instructions work at retail banks.

## Decisions
- Frequencies: Once, Weekly, Monthly, Quarterly. Start and end on business days; end Never, a date or a count.
- Approved once before the first run, with the approvers the amount needs (two above 50,000).
- Every run is checked again: enough money, within the person limit, supplier still approved. A failed run is skipped and the Maker is told.
- A change goes back for approval and nothing runs until it is approved. Cancel is immediate. Changes close the business day before at 18:00 (09:00 option).
- Code for the Maker only from 25,000.

## Fields
| Field | Rule | Message |
|---|---|---|
| Amount | Above zero, up to 250,000 | That is over your limit of 250,000.00 a payment. |
| Reference, Purpose | Required | Use letters, numbers and spaces only. |
| Start date | Weekday, from tomorrow, within 12 months | Choose a weekday. |
| Count | 2 to the maximum for the frequency | Enter a number from 2 to 60. |

## Edge cases
Cut-off passed; supplier removed; schedule limit (20); balance short on the day; run in progress.

## Open questions
Should an approver be able to approve only the first run? Should a run above the approved amount (rate change on a foreign supplier) need approval again? (unverified)
