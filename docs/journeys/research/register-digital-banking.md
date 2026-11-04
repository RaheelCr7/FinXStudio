# Register for digital banking (`register-digital-banking`)

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
Identity is checked with something only the customer has (customer ID or card number) plus date of birth, then a one-time code to the mobile on file. Failures stay generic so the screen never says which detail was wrong. Passwords: length over complexity, block common and breached passwords, no forced symbols (NIST direction). Cap attempts and lock.

## Decisions for BankWorkx®
Customer ID or card number (card checked with Luhn), date of birth as three selects (avoids day/month format clashes across markets), code, then username plus password with a live checklist, then optional device trust. Lock after 3 failed identity checks or codes. Already-registered gets its own clear message. Arriving from an application skips the identity step. Password rules reuse sign-in's.

## Fields
| Field | Rule | Message |
|---|---|---|
| Customer ID | 8 digits | Enter your 8-digit customer ID. |
| Card number | Luhn valid | Check the card number. |
| Date of birth | Real date, past, 18 or over | That date doesn’t exist. / You need to be 18 or over to register online. |
| Code | 6 digits | Enter the 6 digits from the message. |
| Username | 6 to 30 of letters, digits . _ - ; not taken | Use 6 to 30 letters, numbers, dots, dashes or underscores. / That username is taken. Try another. |
| Password | 12 to 64, checklist | per rule |

## Edge cases
Already registered; locked (2 minutes in the sandbox, shown as 30 minutes); expired code (999999); wrong code (000000); under 18; username taken; code resend limit 3.

## Open questions
Card readers or app approval instead of a text code for some markets; joint accounts; business customers.

