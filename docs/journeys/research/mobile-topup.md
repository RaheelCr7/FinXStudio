# Research: Mobile top-up (`mobile-topup`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://icicibank.com/personal-banking/bill-payment/prepaid-mobile-recharge : operator, number, amount, one-time password (India).
- https://sc.com/in/bank-with-us/prepaid_mobile_top-up : save a number for later; some operators limit repeat top-ups on one number.
- https://bnz.co.nz/support/banking/mobile-banking/topping-up-your-prepay-mobile-phone : top up any prepay phone, including someone else's (New Zealand, reference).

## 2. Patterns by market

| Market | Pattern |
|---|---|
| US / UK | Usually done at the operator; banks offer it through bill pay. (unverified) |
| Europe | Operator list then amount tiles in some apps (unverified). |
| Middle East / South Asia | Operator, number, amount tiles, code. Common in banking apps. |

## 3. Standards and rules (plain English)

- Payment from an account needs a code (step-up). Operators set their own denominations and some limit repeats on one number.

## 4. Decisions for BankWorkx® and why

- Operator list is generic; saved numbers filtered to the operator.
- Fixed denominations as cards; no free amount, so no range errors.
- Daily cap of $300 per number so repeated top-ups are refused.
- Same-currency accounts only.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Operator | Required | Choose an operator. |
| Number | Format by market (10 digits; 07 plus 9; 8 to 12 digits; 05 plus 8) | Enter the 10-digit number. (varies) |
| Amount | One of the operator's amounts | Choose an amount. |
| Pay from | Required, enough money | Not enough in this account. |

## 6. Edge cases

- Number not active, operator down, daily cap reached, wrong code.
- Number saved already: the Save toggle is hidden.

## 7. Open questions

- Real operators validate the number with a lookup; the prototype uses fixed endings to simulate it.
