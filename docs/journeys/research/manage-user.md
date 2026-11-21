# manage-user: invite, edit or disable a user

Sources (only search results read; pages not opened in full, so details are unverified where marked):
- https://www.bostonprivate.com/help/resource-library/dual-control-for-digital-banking-user-maintenance-2564 - dual control on user changes
- https://www.rbs.co.uk/content/dam/rbs_co_uk/Business_and_Content/PDFs/bankline-security-settings-rbs.pdf - UK bank guide: second administrator for limit changes
- https://www.chase.com/content/dam/chase-ux/documents/commercial-banking/chase-connect/cc_quickguide_access_security_manager.pdf - US bank access manager guide (not opened in full)

## Standards and rules
- Dual control: a second administrator approves user creation or changes (several banks, optional).
- A person who starts a payment can never approve it.
- A user's limit may not exceed the company limit.

## Decisions for BankWorkx
- Always ask for a code. A new or changed administrator, or disabling one, is sent for approval by another administrator (switchable option).
- Disable asks a reason; payments already waiting keep waiting. Removing Maker from someone with waiting payments is refused.
- The last active administrator cannot be removed; nobody disables themselves.
- Daily limit checked against the company limit and the limit per person.

## Fields
| Field | Rule | Message |
|---|---|---|
| Full name | 2 to 60 letters, spaces, - ' . | Enter their full name. |
| Work email | valid, not already a user | Enter a valid work email, like name@company.com. / This email already has access. Edit that person instead. |
| Mobile | +, 8 to 16 digits | Enter a mobile number with the country code. |
| Role | one of five | Choose a role. |
| Accounts | at least one | Choose at least one account. |
| Daily limit | above 0, within limits | The most one person can have is ... |
| Reason (disable) | required; note 5+ if Other | Choose a reason. |

## Edge cases
- Self-disable, last administrator, pending payments, user already exists, timeout.

## Open questions
- Should a disabled user's waiting approvals pass to a delegate? (not decided)

## Patterns by market
| Market | Pattern |
|---|---|
| US | Company administrator creates users and entitlements; dual control optional per company |
| UK | Second administrator approves limit and user changes (bank guide) |
| EU | Not verified; strong customer authentication for sensitive changes |
| Middle East | Not verified; maker-checker on user changes is common |
