# Forgot username (`forgot-username`)

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
A username is not secret but still personal data: send it to the contact already on file instead of showing it on screen, after identity and code checks.

## Decisions for BankWorkx®
Identify by mobile (or email if the bank allows) plus date of birth, code, then "We sent your username" with the masked destination. Never mention the password. Lock after 3 failures.

## Fields
| Field | Rule | Message |
|---|---|---|
| Mobile | 7 to 18 digits | Enter a valid mobile number. |
| Email | valid format | Enter a valid email address. |
| Date of birth | real, past | That date doesn’t exist. |
| Code | 6 digits | Enter the 6 digits from the message. |

## Edge cases
No match; lock; expired or wrong code.

## Open questions
Whether to also show a hint of the username (first letters) on screen.

