# Research: withdraw-payment

Prototype: `src/journeys/72-withdraw-tracker.js` (`withdraw-payment` and the `payment-tracker` view).

## Sources
| URL | Taken |
|---|---|
| https://docs.oracle.com/en/industries/financial-services/banking-digital-experience/25.1.0.0.0/fxccs/withdraw-transactions-pending-approval.html | A maker withdraws a transaction pending approval and it leaves the approvers' list. |
| https://www.suncorpbank.com.au/help-support/faqs/business-banking/internet-banking/business-payment-awaiting-approval.html | Awaiting Approval payments can be deleted before they are processed. |
| https://macquarie.com.au/help/business/making-payments/recall-or-investigate-a-payment/recall-or-investigate-a-payment.html | After a payment is sent it is a recall request to the bank, not a withdrawal. |
| https://www.td.com/ca/en/commercial-banking/wbb/help/wbwviewpendingpymtsfielddefnsandbusrules | Cancel until the day before processing. |

## Patterns by market
Withdrawing before release is standard maker-checker (unverified per market). After release, the route is a recall through the bank in all four markets; it is outside this journey.

## Decisions
- Only the Maker's own payments that are pending and not fully approved. A partly approved payment can still be withdrawn.
- Reason is optional (bank option). No code: withdrawing reduces risk.
- Status becomes Withdrawn; the timeline shows who and why; audit trail gets a line.
- The tracker lists all company payments with a status filter; Withdraw shows only on eligible rows.

## Fields
| Field | Rule | Message |
|---|---|---|
| Payment | One of your pending payments | Choose a payment. |
| Reason | Optional list; "Other" adds a note (100 chars) | none |

## Edge cases
Released while the screen was open (refused: already released); not found; someone else's payment; no pending payments (empty state).

## Open questions
Should the approvers be told? Should a released but unsettled payment offer a recall request? (unverified)
