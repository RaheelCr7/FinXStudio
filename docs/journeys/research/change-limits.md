# change-limits: person limit, company limit, thresholds

Sources (only search results read; pages not opened in full, so details are unverified where marked):
- https://www.bostonprivate.com/help/resource-library/dual-control-for-digital-banking-user-maintenance-2564 - dual control on user changes
- https://www.rbs.co.uk/content/dam/rbs_co_uk/Business_and_Content/PDFs/bankline-security-settings-rbs.pdf - UK bank guide: second administrator for limit changes
- https://www.chase.com/content/dam/chase-ux/documents/commercial-banking/chase-connect/cc_quickguide_access_security_manager.pdf - US bank access manager guide (not opened in full)

## Standards and rules
- Limits form a chain: person <= company <= bank ceiling; thresholds <= company.
- Banks ask a second administrator to approve limit changes; lowering takes effect at once in many guides (one guide: affected approver blocked until accepted; unverified).

## Decisions for BankWorkx
- Increases (limits and thresholds, since a higher threshold loosens control) go to a second administrator; decreases apply at once.
- Show Now and New side by side with the ceiling.
- One setting per run; one pending change per setting.

## Fields
| Field | Rule | Message |
|---|---|---|
| New amount | above 0, different from now | That is the same as now. Enter a different amount. |
| Person limit | <= company | It can't be above the company daily limit of ... |
| Company limit | <= ceiling, >= person, thresholds | The bank's ceiling is ... |
| Thresholds | <= company | It can't be above the company daily limit of ... |

## Edge cases
- A change already waiting; same value; lowering company limit below a threshold.

## Open questions
- Does a decrease also need dual control at some banks? Guides differ.

## Patterns by market
| Market | Pattern |
|---|---|
| US | Company administrator creates users and entitlements; dual control optional per company |
| UK | Second administrator approves limit and user changes (bank guide) |
| EU | Not verified; strong customer authentication for sensitive changes |
| Middle East | Not verified; maker-checker on user changes is common |
