# Contact details (`update-profile`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://www.openbank.us/help-and-contact/can-i-change-my-mobile-phone-number-if-i-have-lost-my-trusted-mobile-device: Mobile number and trusted phone change guidance

## Patterns by market

| Market | Pattern |
|---|---|
| US | Online change with a code; address often online (unverified) |
| UK | Online with app approval; name changes in branch or with documents (unverified) |
| EU | Online with strong authentication (unverified) |
| Middle East | Mobile and email online with a code; address or ID at a branch (unverified) |

## Standards and rules
- Contact details are used for codes and alerts, so every change is a sensitive action and needs a code.

## Decisions for BankWorkx®
- Customers change mobile, email and address. Name and ID document: visit a branch (one short line).
- A code to the current mobile for every change. A second code to the new number for a mobile change (option).
- Email and address show Pending until checked (options). One pending change per item.
- Proof of address is an option.

## Fields

| Field | Rule | Message |
|---|---|---|
| Mobile | Market format (generic table) | Enter 10 digits. / That is already your number. |
| Email | name@example.com shape | Enter an email like name@example.com. |
| Address | Line 1, city, postal code by market | Check the postal code. |
| Code | 6 digits | That code isn’t right. Try again. |

## Edge cases
- Same value as current is refused.
- A change already pending is refused.
- Wrong code 3 times: nothing changed.

## Open questions
- Cooling-off on new payees after a mobile change (not built).
