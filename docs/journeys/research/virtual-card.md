# Research: Virtual card (`virtual-card`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://www.revolut.com/en-JP/blog/post/disposable-virtual-cards-en/ : single-use virtual cards.
- https://www.bankwest.com.au/virtual-cards : single use or multi use; single use ends after one purchase or 24 hours.
- https://www.bankinter.com/banca/en/accounts-cards/cards/virtual-cards : limit set and changed by the customer.

## 2. Patterns by market

| Market | Pattern |
|---|---|
| UK / EU | Virtual cards free, single or reusable, limits. |
| US / Australia | Single-use or multi-use created in app. |
| Middle East | Online-only virtual card with limit (unverified). |

## 3. Standards and rules (plain English)

- Card details are shown once or behind authentication; only the last four digits afterwards.

## 4. Decisions for BankWorkx® and why

- Three purposes, a limit, single use or 3 years. A code before creation; details shown once on the receipt with Copy.
- Up to 5 virtual cards per card.
- The number is made by the prototype with a valid check digit and is not kept.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Purpose | Required | Choose a purpose. |
| Limit | 1 to 5,000 | The smallest limit is $1.00. / The most is $5,000.00. |
| Lasts | Single use or 3 years | - |

## 6. Edge cases

- Fifth card on one parent is refused. One-time purpose is always single use.

## 7. Open questions

- Merchant locking and real expiry after one payment are not simulated.
