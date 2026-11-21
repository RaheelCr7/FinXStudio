# Research: Add a card (`add-card`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://dev.to/mnotr/luhn-algorithm-explained-credit-card-validation-in-javascript-4ggd : Luhn catches typing errors only.
- https://www.paytia.com/glossary/luhn-algorithm : Luhn does not prove a card exists; storing or showing numbers brings PCI rules.
- https://www.inbrowser.app/tools/credit-card-validator/ : brand prefixes and lengths (Visa 4, Mastercard 51 to 55 and 2221 to 2720; Amex 34 and 37 not confirmed by the source).

## 2. Patterns by market

| Market | Pattern |
|---|---|
| US | Number, expiry, security code, ZIP; verified with a small test charge or code. |
| UK | Number, expiry, security code, postcode; code or app approval. |
| Europe | Same without postcode; strong customer authentication. |
| Middle East | Same; app approval or code. |

## 3. Standards and rules (plain English)

- Luhn check, brand from the first digits, security code length by brand (3, or 4 for Amex).
- Never keep the security code; show only the last four digits afterwards.
- Verification before saving: a text code or a small returned charge.

## 4. Decisions for BankWorkx® and why

- Postcode asked only where the market uses it. Max 5 saved cards. Amex is a bank option. Verification: code or test charge, 3 tries.
- A nickname and two toggles (adding money, paying) finish the journey.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Card number | Digits, Luhn, length by brand, supported brand | Check the card number. / We can’t accept this type of card. |
| Expiry | MM/YY, not past, within 15 years | Use the format MM/YY. / This card has expired. |
| Security code | 3 or 4 digits by brand | Enter the 3 digits on the back. |
| Name | Letters | Use letters only. |
| Postcode | By market | Enter a valid postcode. |
| Code | 6 digits (text) or 4 (charge) | That code isn’t right. |

## 6. Edge cases

- Declined card, duplicate card, five cards already, three wrong codes.

## 7. Open questions

- Exact card prefix ranges for every brand (unverified); PCI first-six rule not confirmed here.
