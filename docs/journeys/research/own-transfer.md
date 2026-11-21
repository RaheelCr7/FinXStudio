# Research: between my accounts (`own-transfer`)

Prototype: `design/bankworkx-r1/src/journeys/30-own-transfer.js`.

## 1. Sources
- Wise help and developer pages: Wise charges the mid-market rate with a separate fee and updates the shown rate every minute; an API quote locks the mid-market rate for a period. Took: "no margin, fee separate" wording.
- Wise comparison pages on Revolut: Revolut states a competitive rate from independent data and adds a weekend markup (a competitor's claim). Took: customers distrust hidden margin, so disclose it.
- `docs/journeys/01-retail.md` own-transfer spec and `convert-currency` fixture: 30 second rate hold, 0.2% fee wording, rate refresh.
- General banking app patterns (Chase, Monzo pots, Revolut exchange, ENBD): no OTP for same-name transfers in some banks, OTP in others.
No source I found gave a standard bank rate hold in seconds; the figures here are a design choice.

## 2. Patterns found
| Pattern | US (Chase, Ally) | UK (Monzo, Barclays) | Europe (Revolut, N26) | Middle East (ENBD, Mashreq) |
|---|---|---|---|---|
| Same currency | Instant, free, no code under a limit | Instant, free | Instant, free | Instant, free |
| Different currency | Usually not offered | Pots or Revolut-style exchange | Exchange screen with rate | FX deal screen, rate valid seconds |
| Rate shown | n/a | Rate and fee | Rate and fee, weekend markup | Rate and spread |
| Rate hold | n/a | Seconds | Seconds | 30 to 60 seconds |
| Direction | "From, To, Amount" | "Amount you send" | Toggle which side you type | Either side |

## 3. Standards and rules
- Money between a customer's own accounts does not use the daily payment limit and has no payee, so no name check and no cooling-off.
- Currency conversion needs a quoted rate and a clear total. EU and UK rules on cross-border charges push banks to show total cost and the rate against a reference rate.
- A code is still asked because it moves funds out of a spendable account; the prompt names the amounts.

## 4. Decisions and why
1. Mid-market rate with no margin, and a separate fee of 0.20% shown on its own line. Reason: easiest to explain and to check.
2. A "Margin on the rate: None" line and the mid-market rate shown on the amount screen. Reason: spread-free disclosure.
3. Rate held 30 seconds with a visible count and a "Get a new rate" button; expiry shows a new rate and the old and new values in the message, then asks again. Reason: never charge a rate the person did not see.
4. Either side can be typed (what I send or what I get). Reason: people think in the amount they need.
5. A Swap accounts button. Reason: the most common second move.
6. Frozen account cannot be debited; same account refused.
7. Option to switch off conversion or the fee.

## 5. Field table
| Field | Rule | Message / code |
|---|---|---|
| From | Own account that can debit | "(ACCOUNT_CANNOT_DEBIT)" |
| To | Own account, not the same | "Choose two different accounts. (SAME_ACCOUNT)" / "We can't convert between X and Y yet. (CURRENCY_NOT_SUPPORTED)" |
| Which side to type | Send or Get (conversion only) | none |
| Amount | At least 1.00, 2 decimals, send plus fee within available balance | "The smallest amount is 1.00. (INVALID_AMOUNT)" / "There isn't enough money in {account}. Available: ... (INSUFFICIENT_FUNDS)" |
| Note | Same currency only, 35 characters | "Use 35 characters or fewer." |
| Confirm tick | Required | "Tick to confirm." |
| Rate | Valid 30 s | "(QUOTE_EXPIRED)" |

## 6. Edge cases
- Rounding: receive-side entry rounds the sending amount up to the cent, then the fee is 0.20% of that.
- Rate expires on Review: a new quote with a tiny movement; message names old and new.
- Savings or EUR account as source: balances recomputed from available, not ledger.
- Zero-decimal currencies (JPY) are not in the personal account set, so not handled.

## 7. Open questions
- Is 0.20% the right price, or should there be a spread-based price per account tier?
- Should a larger conversion (over USD 10,000) need extra authentication?
- Weekend FX: should the rate be flagged "indicative" when markets are closed?
- 09 uses a 60-second hold for payments; own-transfer uses 30 as in the retail spec.
