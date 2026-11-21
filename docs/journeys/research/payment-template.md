# Research: payment-template

Prototype: `src/journeys/71-templates-schedule.js` (`payment-template` and the `templates` view).

## Sources
| URL | Taken |
|---|---|
| https://commbank.com.au/business/online-banking/commbiz/user-guides/keeping-track-of-payments.html | Business banking keeps payment records and tracking together. |
| https://www.suncorpbank.com.au/help-support/faqs/business-banking/internet-banking/business-payment-awaiting-approval.html | Payments started from saved data still go to approval. |
No source found for template screens specifically (unverified). The design follows common business banking practice.

## Patterns by market
Templates and saved payments exist in business banking in all four markets (unverified per bank). A template stores payee, optional amount and reference; paying from it still goes through limits and approval.

## Decisions
- A template holds supplier, name, optional amount, reference, purpose. Amount is optional so it can be entered each time.
- A template is not a payment: no code, no approval to save or delete.
- Use opens Pay a supplier with the supplier and amount filled in. That journey reads supplier and amount only, so reference and purpose are not carried over (lead to extend).
- Templates for a supplier that is pending or removed cannot be used.
- 20 templates per company.

## Fields
| Field | Rule | Message |
|---|---|---|
| Template name | Required, 30 chars, unique | You already have a template with this name. |
| Amount | Optional, up to the person limit | That is over your limit of 250,000.00 a payment. |
| Reference | Optional, 35 chars | Use letters, numbers and spaces only. |

## Edge cases
Supplier deleted or pending; limit of 20; template used by a Maker with no right to pay (buttons hidden).

## Open questions
Should an administrator be able to share templates by user? Should templates keep the cap on an amount that changed after saving? (unverified)
