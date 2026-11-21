# Research: Card PIN (`card-pin`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://en.wikipedia.org/wiki/ISO_9564 : PIN 4 to 12 digits, issuer policy decides weak PIN rules.
- https://support.capitalone.ca/account-set-up-and-management/all-about-pins : some combinations are refused; avoid birthdays.
- https://arxiv.org/pdf/1302.2656.pdf : 1234 and repeated digits are the most common PINs.

## 2. Patterns by market

| Market | Pattern |
|---|---|
| All | PIN set in app after a code; the current PIN is never displayed. Easy PINs refused. |

## 3. Standards and rules (plain English)

- The weak PIN list is issuer policy, not a standard (the standard text is paywalled, unverified).
- A PIN must never be shown or stored in the app.

## 4. Decisions for BankWorkx® and why

- Code first, then new PIN twice. Refuse same digits, runs up or down, ABAB patterns and the last four of the card number or the expiry.
- Not offered for virtual cards, inactive or blocked cards.
- The weak PIN rule is a bank option.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Code | 6 digits | Enter the 6-digit code. |
| New PIN | 4 digits, not weak | Enter 4 digits. / Don’t use numbers in a row, like 1234. |
| Confirm | Same as new PIN | The PINs don’t match. |

## 6. Edge cases

- Three wrong codes lock the journey. A frozen card can still change its PIN.

## 7. Open questions

- Whether the PIN works at once at every terminal depends on the processor.
