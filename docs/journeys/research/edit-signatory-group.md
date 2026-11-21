# edit-signatory-group: who approves payments

Sources (only search results read; pages not opened in full, so details are unverified where marked):
- https://www.bostonprivate.com/help/resource-library/dual-control-for-digital-banking-user-maintenance-2564 - dual control on user changes
- https://www.rbs.co.uk/content/dam/rbs_co_uk/Business_and_Content/PDFs/bankline-security-settings-rbs.pdf - UK bank guide: second administrator for limit changes

## Standards and rules
- Dual authorisation: one starts, a different user approves; larger payments need more approvers.
- Modes: any one, in order, or N of M together.

## Decisions for BankWorkx
- Two groups split at the two-approver threshold; the higher group needs at least two approvals.
- Separation: if a member also starts payments, enough other approvers must remain; the only maker cannot be the only approver.
- Every change goes to a second administrator (switchable); waiting payments keep their current approvers.

## Fields
| Field | Rule | Message |
|---|---|---|
| Mode | required | Choose how they approve. |
| Approvers | at least one | Choose at least one approver. |
| How many | 1 to members | Choose how many must approve, up to N. |
| Goes first | optional, sequential | - |

## Edge cases
- Too few approvers, maker also approver, change already waiting, no change.

## Open questions
- Should order be drag-and-drop? Kept to a first-approver pick.

## Patterns by market
| Market | Pattern |
|---|---|
| US | Company administrator creates users and entitlements; dual control optional per company |
| UK | Second administrator approves limit and user changes (bank guide) |
| EU | Not verified; strong customer authentication for sensitive changes |
| Middle East | Not verified; maker-checker on user changes is common |
