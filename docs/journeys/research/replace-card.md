# Research: Replace a card (`replace-card`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://barclays.co.uk/help/security-fraud/lost-stolen-card : report at once; replacement to the address on file (UK).
- https://www.mybanktracker.com/news/lost-debit-card-replacement-fee-comparison-top-10-us-banks : replacement usually free, express a fee (US).
- https://wise.com/help/articles/2935777/what-should-i-do-if-my-wise-card-is-lost-or-stolen : freeze or replace in app.

## 2. Patterns by market

| Market | Pattern |
|---|---|
| US | Standard free, express about $20 to $25; 7 to 10 days standard. |
| UK | Free; 2 to 5 working days. |
| Europe / Middle East | Often free, or a small fee (unverified). |

## 3. Standards and rules (plain English)

- A lost or stolen card is blocked at once so later use is refused.
- Standard delivery goes to the address on file.

## 4. Decisions for BankWorkx® and why

- Card blocked as soon as the reason is confirmed, before the rest of the form, with a plain message.
- Address from profile or another address; standard free, express $15 (bank option).
- A code only when a fee is charged.
- Damaged cards keep working until the new one arrives.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Reason | Required | Choose a reason. |
| Address | Home or another; line, city, postcode | Enter a valid postcode. |
| Speed | Standard or express | - |

## 6. Edge cases

- A replacement already ordered, a virtual card, an expired reason on a card not expiring soon.

## 7. Open questions

- Delivery times are estimates (unverified).
