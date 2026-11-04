# Connect a bank (`connect-account`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://support.plaid.com/hc/en-us/articles/43359270181911-How-does-Open-Banking-consent-renewal-work-in-the-UK-and-Europe: Consent renewal in the UK and Europe
- https://docs.yapily.com/concepts/consent-lifecycle: Consent lifecycle
- https://truelayer.com/blog/explaining-changes-to-the-90-day-rule-for-open-banking-access: Change to the 90-day rule

## Patterns by market

| Market | Pattern |
|---|---|
| US | Aggregator link, consent screen, sign in at the bank, choose accounts; no fixed rule (unverified) |
| UK | Read access for 90 days, then reconfirm with the provider |
| EU | Bank login renewed about every 180 days |
| Middle East | Open finance frameworks starting; 12 months assumed (unverified) |

## Standards and rules
- Account information consent is time limited; the person can stop it any time.

## Decisions for BankWorkx®
- Steps: choose bank, consent (what is shared, until a date, revoke any time, read only), sign in at the bank (simulated sheet with Allow and Deny), choose accounts.
- Sharing period by market: 365, 90, 180, 365 days (US, UK, EU, UAE; last unverified).
- Connected accounts go into the accounts view as read only; payments cannot use them.
- Disconnect from the first screen.

## Fields

| Field | Rule | Message |
|---|---|---|
| Bank | From the list, not already connected | This is required. |
| Agree | Ticked | Agree to continue. |
| Accounts | At least one | Choose at least one account. |

## Edge cases
- Bank not answering: nothing connected.
- Deny: nothing connected.
- Credit cards only if the bank option allows.

## Open questions
- Re-consent flow when the period ends (not built).
- Whether connected balances count in the total (they do in the sandbox).
