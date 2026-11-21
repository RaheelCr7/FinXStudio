# Research: quick transfer (`single-transfer`)

Prototype: `design/bankworkx-r1/src/journeys/29-single-transfer.js`. Synthetic data only.

## 1. Sources
- Nacha, ECB and bank cut-off pages as listed in `transfer-types.md` (limits, speeds, cut-offs).
- ECB instant payments page and Finextra: Verification of Payee is offered before every euro credit transfer from 9 October 2025; instant credit must arrive within 10 seconds; the payer's bank must tell the payer the result.
- UK bank pages (NatWest, Coutts): Confirmation of Payee runs when a new Faster Payment or CHAPS payee is set up or changed.
- PSR APP scam reimbursement coverage: GBP 85,000 cap, started 7 October 2024; why UK apps show scam warnings on new-payee payments.
- Vendor guides to PSD2 SCA exemptions (Adyen, Verifone, pci-proxy): trusted-beneficiary and low-value exemptions exist (low value is about EUR 30 for card payments, five in a row or EUR 100 cumulative), but the issuer may always require authentication. Took: dynamic linking and "may skip under 30" stay as a future option, not in this prototype.
- Wise developer docs: a quoted rate is locked at quote creation; bank sandboxes use short windows (60 seconds in 09).

## 2. Patterns found
| Pattern | Chase / Zelle | Monzo / Starling | N26 / ING | Emirates NBD / Arab Bank |
|---|---|---|---|---|
| Layout | Multi-screen wizard | Few screens: payee, amount, reference, confirm | Payee, amount, confirm | Form with from, to, amount, purpose |
| Live cost | Fee at the end | Fee rarely (free) | Rarely | Fee and FX rate on the same page |
| Reference | "Memo" | 18 characters, bank limit | Up to 140 | Purpose of payment dropdown |
| Review | Full-screen summary | Summary with CoP result | Summary | Summary + OTP |
| After send | Receipt with confirmation number | Tick and "Done" | Instant badge | Receipt with scheme reference |

## 3. Standards and rules
- **Reference lengths**: Faster Payments 18 characters, SEPA 140, ACH 80 (memo). The field refuses extra characters and rejects characters outside the allowed set.
- **Purpose of payment**: required by Middle East banks and SWIFT. 
- **Name check**: done when the payee was saved; the chip shows Verified or Saved.
- **Dynamic linking**: the code prompt names the amount and the payee; changing either voids the code.
- **Rate hold**: 60 seconds for foreign-currency payments, after which a new rate is shown.
- **Cooling-off**: a payee under 24 hours old can receive at most USD 500.
- **Daily limit**: USD 50,000 in the sandbox, 41,250.00 remaining.
- **Screening**: a payee named "Test Sanctions" is held for review.

## 4. Decisions and why
1. One page with live validation, not a wizard, because a returning customer with a saved payee only needs amount and rail. The wizard (`personal-transfer`) stays for new payees.
2. Rail cards update on every keystroke from the amount (dimmed with the limit when too small, "Not available right now" when down). Reason: wrong-rail errors found after Review waste a step.
3. A live summary shows they-receive, rate, fee, you-pay, arrival and the allowance left. Reason: foreign-currency surprise is the top complaint in reviews of banking apps.
4. Review is a second screen with a code prompt that names amount and payee.
5. Purpose and charges (OUR/SHA/BEN) show only where required.
6. Demo switches in the catalog: "SEPA Instant unavailable" and "it is 16:30, after cut-offs".
7. BankWorkx® customers are shown disabled with a pointer to their own journey. Reason: that rail is internal, with no fee, so a different journey fits.

## 5. Field table
| Field | Rule | Message / code |
|---|---|---|
| From account | USD accounts only; must have available balance | "Not enough in the account: you'd pay $X but $Y is available. (INSUFFICIENT_FUNDS)" |
| Payee | Saved payee, not a BankWorkx® customer | "Choose who to pay." |
| Amount (payee currency) | Greater than 0, up to 2 decimals, within chosen rail max, balance, daily limit, 500 for new payee | "Enter an amount above zero." / "That's over the {rail} limit of {limit}. Choose another way to send it. (RAIL_LIMIT)" / "(DAILY_LIMIT_EXCEEDED)" / "(BENEFICIARY_COOLING_OFF)" |
| Rail | Not down, not over limit | "(RAIL_NOT_AVAILABLE)" |
| Charges | SWIFT only; SHA, OUR (+15), BEN | none |
| Reference | Region limit; letters, digits, space and . , ' - / ( ) + : ? | "Use 18 characters or fewer for this payee's bank." |
| Purpose | Required for Middle East and SWIFT | "Choose a purpose for this payment. (PURPOSE_REQUIRED)" |
| When | Now or Later; later is a business day within 30 days, weekends per country | none |
| Repeat | Does not repeat, weekly, monthly | none |
| Code | Three wrong tries fail the payment | "(STEP_UP_FAILED)" |

## 6. Edge cases
- Amount over the default rail's limit: the default moves to the first rail that fits.
- Payee under 24 hours: allowance line in the summary and a warning on Review.
- Rate older than 60 seconds on Review: `QUOTE_EXPIRED`, a fresh quote is taken, confirm again.
- Same-day rail after cut-off (demo switch): arrival moves to the next business day with a note.
- Held payment: result is "Held for review", funds reserved, not debited.
- No saved payees: empty state with "Add a beneficiary".
- Backend timeout or unavailable at submit: `TIMEOUT` / `SERVICE_UNAVAILABLE`, nothing sent.

## 7. Open questions
- Should payments under USD 30 to a saved payee skip the code (PSD2 low-value exemption), or does the bank want every payment authorised?
- Should the daily limit be per rail?
- Differences from 09: the review is the same; "Held for review" reserves the funds (09 is silent). Aani limit disagrees with the Central Bank FAQ (see `transfer-types.md`).
