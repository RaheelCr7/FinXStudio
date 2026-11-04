# Change password (`change-password`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://doi.org/10.6028/NIST.SP.800-63b-4: NIST digital identity guidance, revision 4: length over composition, blocklist, no forced rotation (read through summaries, not the text itself)
- https://www.enzoic.com/blog/nist-sp-800-63b-rev4/: Summary of the new password rules

## Patterns by market

| Market | Pattern |
|---|---|
| US | Current password, new password twice, live checklist; many banks still show composition rules (unverified) |
| UK | Same shape; often a code or app approval after (unverified) |
| EU | Strong customer authentication for sensitive changes (unverified per bank) |
| Middle East | Code by text or app approval after the form (unverified) |

## Standards and rules
- NIST revision 4 drops composition rules, asks for a long minimum, a blocklist of common and breached passwords, and no forced rotation. The 15-character figure for password-only sign-in was reported inconsistently; confirm at the source.
- Wrong current password attempts should count towards the same lock as sign-in.

## Decisions for BankWorkx®
- 12 characters minimum, up to 64, no composition rules; blocklist and reuse check; not the username. Live checklist updates as the person types.
- Code after the form so a stolen session alone cannot change the password.
- Bank option: sign out other devices after a change (default on).

## Fields

| Field | Rule | Message |
|---|---|---|
| Current password | Required; 5 wrong tries lock | That isn’t your current password. |
| New password | 12 to 64 characters; not username, common, breached or used before; different from current | Use at least 12 characters. / Choose a different password. |
| Confirm | Equals new | The two passwords don’t match. |
| Code | 6 digits; 3 wrong stop the journey | That code isn’t right. Try again. |

## Edge cases
- Locked after 5 wrong current passwords: lock card with reset and support.
- Code expired (999999) or wrong 3 times: nothing changed.
- Service down: nothing changed.

## Open questions
- Should a change also end the person’s own session? Sandbox keeps it.
- Exact reuse history length (sandbox: all earlier ones).
