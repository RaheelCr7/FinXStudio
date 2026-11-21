# Research: Open another account (`open-another-account`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://www.lloydsbank.com/savings/club-lloyds-saver.html : existing customers can open a saver in the app; no new documents (UK).
- https://www.aldermore.co.uk/savings-accounts/personal-savings-accounts/easy-access-savings-accounts/easy-access-account/ : rate, minimum opening balance and fee shown before opening (UK).
- https://product.newbury.co.uk/1EMA.html : minimum opening and operating balance stated up front (UK).
- US Truth in Savings (Regulation DD) and the UK Summary Box: the rule that rate, fees and minimums are shown before opening (from general knowledge, (unverified) in this run).

## 2. Patterns by market

| Market | Pattern |
|---|---|
| US | Product list in the app, rate (APY), fees and minimum shown on a disclosure before opening. |
| UK | Existing customers skip identity checks; a Summary Box (rate, access, fees) is shown first. |
| Europe | Current and savings opened in app; key facts sheet before agreeing. |
| Middle East | Currency accounts offered in the app for existing customers; terms accepted in app, code to confirm. |

## 3. Standards and rules (plain English)

- Key facts (rate, fees, minimum) must be visible before the person agrees. Identity checks are not repeated for an existing customer. A code confirms the request.
- A bank sets a maximum number of accounts.

## 4. Decisions for BankWorkx® and why

- Three products only (current, savings, currency) so the screen stays short; currency chosen second.
- Key facts shown as exactly three rows; one agree box; code from the engine step-up.
- New account is written to D.acc and ACC.meta so the Accounts screen shows it at once.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Product | Required | Choose an account. |
| Currency | Required for currency account | Choose a currency. |
| Account name | 2 to 24 characters, letters, numbers, spaces; not already used | Use 2 to 24 characters. / You already have an account with that name. |
| Agree | Required | Please agree to continue. |

## 6. Edge cases

- Already 6 accounts: the Continue button is disabled and a warning shows.
- The same name twice is refused.
- Wrong or timed-out code: nothing is opened.

## 7. Open questions

- Opening deposit and purpose were in the old spec; left out to keep the journey short. Rates are synthetic (unverified against any real bank).
