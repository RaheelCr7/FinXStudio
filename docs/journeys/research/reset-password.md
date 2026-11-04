# Reset password and unlock account (`reset-password`)

## Sources
- https://pages.nist.gov/800-63-4/ (NIST digital identity guidelines): the primary text; I could only reach secondary summaries (a vendor blog and an OWASP wiki PDF of the 800-63B draft), so wording is UNVERIFIED.
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html (OWASP): generic responses and rate limiting; reached only through secondary posts, UNVERIFIED wording.

## Patterns by market
| Market | Pattern (general knowledge, not checked page by page) |
|---|---|
| United States | Online enrolment with account or card number plus tax or birth date, then a code by text or email. |
| United Kingdom | Card reader or app approval is common for first registration; SCA applies to access to payment accounts. |
| Europe | PSD2 strong customer authentication at first set-up; app approval widely used. |
| Middle East | Card plus PIN or code by text; app activation increasingly common. |

Market rows are UNVERIFIED summaries; no bank sites were fetched.

## Rules in plain English
Recovery must not be easier than sign-in. Prove control of a registered contact with a one-time code; rate limit; do not reveal more than needed. Unlocking after failed sign-ins does not need a password change, so it is a separate mode that keeps the password.

## Decisions for BankWorkx®
One journey, two modes via `{mode:'reset'|'unlock'}`. Aliases `forgot-password` and `unlock-account` are separate catalog switches. Identify by username or email, code to the mobile on file (masked), then new password or unlock. A successful reset clears the lock and failed counters. Unknown profiles get a clear not-found message (the prototype favours clarity over enumeration resistance; a bank may prefer a generic reply: open question).

## Fields
| Field | Rule | Message |
|---|---|---|
| Username or email | 3 to 80, no spaces | Enter your username or the email address we have for you. |
| Code | 6 digits | Enter the 6 digits from the message. |
| New password | 12 to 64, not username, not common, not breached, not reused | per rule |

## Edge cases
Account not locked in unlock mode (told so); lock after 3 failures; expired and wrong codes; reused password.

## Open questions
Sign out other sessions after a reset; notify by email; app approval instead of text.

