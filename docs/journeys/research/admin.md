# admin: administrator screen

Sources (only search results read; pages not opened in full, so details are unverified where marked):
- https://www.bostonprivate.com/help/resource-library/dual-control-for-digital-banking-user-maintenance-2564 - dual control on user changes
- https://www.rbs.co.uk/content/dam/rbs_co_uk/Business_and_Content/PDFs/bankline-security-settings-rbs.pdf - UK bank guide: second administrator for limit changes

## Standards and rules
- Only administrators see people, limits, groups and the activity log; others see a short no-access state.

## Decisions for BankWorkx
- One screen, four sections, each with one action. Second administrator can approve pending items from the top card.
- Preview flag S.adm adds the admin permission so the journeys can be tried.

## Fields
| Field | Rule | Message |
|---|---|---|
| - | - | - |

## Edge cases
- Non-admin, nothing pending, empty log.

## Open questions
- None.
