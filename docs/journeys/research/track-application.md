# Track my application (`track-application`)

## Sources
- No pages fetched; common application-tracker patterns (UNVERIFIED).

## Patterns by market
| Market | Pattern |
|---|---|
| All | Reference plus a second factor (mobile or date of birth), then a short status timeline. |
UNVERIFIED.

## Rules in plain English
Status is personal data: require the reference and a matching detail, give the same error for any mismatch, and throttle.

## Decisions for BankWorkx®
Reference and mobile, optional code, three stages (received, checking your ID, ready). Uses OA.app from open-account when present, else synthetic applications. Ready leads to register-digital-banking. Lock after 3 misses.

## Fields
| Field | Rule | Message |
|---|---|---|
| Application number | APP- and 6 digits | Enter the number as shown, like APP-123456. |
| Mobile | 7 to 18 digits | Enter a valid mobile number. |
| Code | 6 digits | Enter the 6 digits from the message. |

## Edge cases
Not found; locked; expired application after 30 days (open question); declined or more information needed (not built).

## Open questions
Declined and document-needed stages.

