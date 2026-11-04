# Research: transfer types (`transfer-types`)

Prototype: `design/bankworkx-r1/src/journeys/28-transfer-types.js`. Synthetic figures; brand BankWorkx®.

## 1. Sources
- Nacha Same Day ACH rule page (nacha.org): same-day ACH is $1 million per payment today, rising to $10 million in a later phase (one source says September 2027). Took: the figure and the "per payment, not per day" wording.
- Industry write-ups on RTP and FedNow (Modern Treasury, WisBank, Goldman Sachs page): RTP and FedNow network limits are now $10 million per payment; some bank pages still show the old $100,000 or $1 million. Took: the network limit is not what a customer sees; the bank sets the customer limit.
- ECB instant payments regulation page, Finextra explainer, UniCredit and Sparkasse customer notices: Verification of Payee and instant euro payments became mandatory in the euro area from 9 October 2025; the old EUR 100,000 instant ceiling no longer exists in law, banks set their own (UniCredit presets 100,000). Took: SEPA Instant "limit" is a bank setting.
- Bank cut-off pages (Lloyds, NatWest, Santander UK, Metro Bank) and Wise on CHAPS: CHAPS runs about 06:00 to 18:00 UK on working days, customer deadline about 17:40, banks cut earlier; Faster Payments has no scheme cut-off, bank limits vary widely; Bacs is three working days. Took: cut-offs are per bank.
- Central Bank of the UAE Aani FAQ and bank pages (Emirates Islamic, Mashreq, HSBC UAE): scheme FAQ says AED 10,000 per transaction and AED 50,000 per day outward; marketing and some banks say AED 50,000 per transaction; banks set lower caps. Took: conflict, flagged below.
- JoPACC and Jordanian bank CliQ pages: JOD 10,000 per transaction system cap; banks set lower caps (2,000 to 5,000 seen). SAMA launch coverage and Riyad Bank / Tweeq: sarie instant under SAR 20,000, quick transfer to unregistered recipients SAR 2,500.
- PSR APP scams reimbursement coverage (Hogan Lovells, PSR): UK reimbursement for Faster Payments and CHAPS scams capped at GBP 85,000 per claim from 7 October 2024. Took: why UK apps push Confirmation of Payee and warnings.

## 2. Patterns found
| Pattern | US (Chase, Bank of America, Wells Fargo) | UK (Monzo, Barclays, Lloyds) | Europe (N26, ING, Revolut EU) | Middle East (ENBD, Al Rajhi, Arab Bank) |
|---|---|---|---|---|
| Entry | "Send money" with Zelle, wire, ACH hidden under "Transfer" | One "Make a payment"; the rail is chosen for you (Faster Payments) | One "Transfer"; instant is the default | Separate "Local" and "International" tabs; instant brand (Aani, sarie, CliQ) promoted |
| Does the customer pick a rail? | Yes for wires and same-day; no for Zelle | No, except CHAPS or Bacs for business | No, SEPA Instant if the receiver supports it, else SCT | Yes, with the instant option as a toggle |
| Shown up front | Fee, cut-off and "arrives by" for wires | "Arrives in seconds, up to GBP 1m" | "Instant" badge | Limit and daily cap |
| Name check | Rare | Confirmation of Payee before the first payment | Verification of Payee (since Oct 2025) | Name shown after IBAN lookup in some banks |

## 3. Standards and rules (plain English)
- **Same Day ACH**: three Nacha settlement windows a day; the bank cut-off is earlier than the final window. Limit per payment, set by Nacha and then by the bank.
- **RTP and FedNow**: instant, 24/7, final (no recall like a card). Each bank sets a customer limit under the network limit.
- **Fedwire**: same-day, high value, final. Fee is high, which is why the app asks "are you sure".
- **Faster Payments, CHAPS, Bacs**: instant retail, same-day high value, three-day batch. Name check (Confirmation of Payee) applies to the first two.
- **SEPA Credit Transfer and SEPA Instant**: one-day and 10-second euro transfers. The EU Instant Payments Regulation requires banks to offer instant at no more than the standard price and to offer Verification of Payee.
- **Aani, sarie, CliQ**: national instant schemes. **UAEFTS, SARIE, JoPACC**: same-day or next-day settlement rails.
- **SWIFT gpi**: international payments tracked by a UETR; banks show the tracker.
- **Strong customer authentication (PSD2)**: payments need two factors and the code is linked to amount and payee ("dynamic linking").

## 4. Decisions for BankWorkx® and why
1. One screen that lists every type, filtered by destination region, because the choice depends on where the money goes. Reason: US and Middle East banks make the person choose a rail; UK and EU banks hide it. Showing it teaches the choice and works for all five regions.
2. A "Which should I use?" helper with urgency, destination and amount, giving a reason in one paragraph. Reason: it removes the need to learn rail names.
3. The UK "standard" is Faster Payments (same rail as instant); Bacs is explained in a note as the scheduled-payment rail. Reason: no UK retail app asks a customer to wait three days for a one-off payment.
4. SEPA has no same-day card; the card says so and points to SEPA Instant. Reason: honesty about what exists.
5. Types whose journey is switched off disappear; types whose journey is not built show a "(soon)" button.
6. Bulk (business) is a greyed teaser. Reason: it tells a person the capability exists without a dead end.

## 5. Field table (helper)
| Field | Rule | Message |
|---|---|---|
| Urgency | One of Right now, Today, In a few days, Cheapest | none |
| Destination | One of nine | none |
| Amount (USD) | Number, optional; converted to the destination currency to test rail limits | "No rail fits this amount. Try a smaller amount, or split the payment. (RAIL_LIMIT)" |
| Daily limit warning | Over USD 41,250.00 | "Over your remaining daily limit... (DAILY_LIMIT_EXCEEDED)" |
| New payee warning | Over USD 500.00 | "...first 24 hours are limited to $500.00 (BENEFICIARY_COOLING_OFF)" |

## 6. Edge cases
- Amount empty: the helper recommends without a limit test.
- Instant rail switched off or SEPA Instant "unavailable": the helper skips it.
- No rail meets the urgency (for example 200,000 euros "right now" with no instant fit): recommend the fastest that fits and say so.
- Same-day rail near its cut-off: the recommendation adds "Send before {cut-off}".
- Region with no separate wire (Europe, Middle East): greyed explanatory card.

## 7. Open questions and differences from 09
- **09 says RTP max is 500,000; the networks now allow 10 million** (RTP June 2025, FedNow November 2025). Customer limits are bank settings, so 500,000 is acceptable as a bank figure but should be labelled as such.
- **09 says SEPA Instant max 100,000; since October 2025 there is no legal ceiling**. 100,000 is a common bank default.
- **09 says Aani max 50,000 per payment; the Central Bank FAQ says 10,000 per transaction and 50,000 per day.** Decide which the prototype follows.
- **CHAPS cut-off**: 09 says 17:00; the customer submission deadline in the scheme is about 17:40 and banks cut earlier. 17:00 is fine as a bank cut-off.
- Same Day ACH rising to 10 million: not in 09, harmless.
- Should the helper count the person's real daily usage instead of a fixed 41,250?
