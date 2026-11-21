# Research: pay-bill

Journey `pay-bill` (BankWorkx® Retail, Payments). Prototype file: `design/bankworkx-r1/src/journeys/34-pay-bill.js`. All data in the prototype is synthetic. Statements below come from web search summaries read on 4 Nov 2026 plus general knowledge of the schemes; anything not confirmed on an official page is marked "to confirm". Nothing here is legal advice.

## 1. Sources

| Source | What was taken |
|---|---|
| https://docs.onesingleview.com/v1.0.2/docs/sadad-information | SADAD biller codes exist per biller (for example electricity 002); partial payment is a per-biller setting, not a bank setting. Unofficial integration doc, to confirm with SADAD. |
| https://www.sadad.com/en/our-partners/billers | Official SADAD biller directory exists (page content was thin). Directory by biller, not by bank. |
| https://efawateercom.jo/Portal/Biller | eFAWATEERcom portal: choose a biller category first (for example Insurance), then the biller, then the service type, then the bill number. |
| https://www.jopacc.com/faqs/efawateercom-faqs | Owned by JoPACC, run by MadfoatCom, supervised by the Central Bank of Jordan; government bills carry no fee, other billers set their own fee. |
| https://efawateercom.jo/Portal/WhereToPay | Channels: branch, ATM, mobile and internet banking, wallets, post offices. The same bill can be paid on any channel. |
| https://www.alhilalbank.ae/en/aani and https://habibbank.com/ae/wp-content/uploads/sites/2/2024/12/Aani-Payment-System-Frequently-Asked-Questions.pdf | Aani is the UAE instant rail (AED only). Billers can send a payment request and the customer can pay in full, pay in part or decline. Enrolment is through the bank app. |
| https://www.ally.com/help/bank/bill-pay.html and https://www.usbank.com/customer-service/knowledge-base/KB0069766.html | US bill pay: electronic payment goes out about 1 to 2 days before the date and the account is debited on the date; a paper check needs up to 5 business days; cancel until processing starts. |
| https://stripe.com/en-ch/resources/more/what-is-the-direct-debit-guarantee | UK Direct Debit Guarantee: advance notice (10 working days is the standard) of changes to amount or date. |
| https://assets.ing.com/m/24e3cd73efdd3e08/original/SEPA-Direct-Debit-timelines.pdf and https://www.nordea.com/en/doc/sdd-service-description-mandate-creditor.pdf | SEPA Direct Debit Core: mandate, 14 days notice (can be agreed shorter), 8 week no-questions refund, 13 months for an unauthorised debit. |

## 2. Patterns found

| Region / type | How a customer finds the biller | How the amount is found | Partial pay | Fees | Speed |
|---|---|---|---|---|---|
| US bank bill pay | Search a national directory, or add a payee by name and account number | Often the customer types the amount; "eBill" billers return amount due and due date | Yes (customer types any amount) | Usually free from the bank | Electronic 1 to 2 days, check up to 5 business days |
| UK | Pay by sort code and account number as a normal payee, or use the biller's Direct Debit | Direct Debit: biller collects, bank only holds the mandate. Manual: customer types the amount | Yes | Free | Faster Payments, seconds |
| Europe (SEPA) | Pay with the biller's IBAN and a structured reference, or approve a SEPA Direct Debit mandate | Direct Debit: biller notifies 14 days ahead (can be shortened by agreement) | Not for Direct Debit | Free | Credit transfer next business day; instant in seconds |
| UAE | Bank app biller directory by category, plus Aani payment requests | Bill fetch by account or mobile number | Aani request: full, part or decline; directory billers vary | Biller or bank fee | Seconds |
| Saudi Arabia (SADAD) | Directory by biller code and category | Bill inquiry by bill number, returns amount and due date | Per biller: some allow it (for example electricity), others do not | Bank fee | Same day |
| Jordan (eFAWATEERcom) | Category, then biller, then service, then bill number | Bill inquiry returns amount due | To confirm per biller | Government bills free, others set by biller | Same day |

The pattern in the Middle East is "look up first, then pay what the biller says". The pattern in the US and UK is "pay a payee, type the amount". BankWorkx® should do the Middle East pattern wherever the biller supports a fetch, and fall back to typing the amount when it does not.

## 3. Standards and rules (plain English)

- **SADAD (Saudi Arabia).** The national bill presentment and payment system under the Saudi Central Bank. Every biller has a code. The customer enters the bill number, the biller answers with the amount, and the bank pays through SADAD.
- **eFAWATEERcom (Jordan).** The national bill system run for the Central Bank of Jordan. Category, biller, service, bill number. Government bills are free for the payer.
- **Aani (UAE).** Instant payment in AED. A biller can send a request which the payer may pay in full, pay in part or decline.
- **SEPA Direct Debit Core.** A customer signs a mandate. The biller tells them 14 days ahead, and they can get any authorised debit back within 8 weeks without giving a reason. This is why "set up auto-pay" in BankWorkx® is a customer instruction (a standing payment), not a mandate, and why the journey names it that way.
- **UK Direct Debit Guarantee.** Advance notice of changes, and an immediate refund by the bank if the biller makes an error.
- **US Regulation E.** Covers electronic bill payments (error resolution). A paper check is outside it. BankWorkx® only offers electronic payment in the prototype.
- **PSD2 strong customer authentication (Europe, UK equivalent).** Paying a new payee needs SCA. Paying a saved, trusted payee can be exempt. The prototype always asks for a code on a bill payment, as the existing spec does, and says why.

## 4. Decisions for BankWorkx® and why

1. **One directory with search, six categories (utilities, telecom, government, insurance, cards, education) and a region filter.** All three Middle East systems start with a category; searching is faster for a known name. Saved bills sit on top so repeat payers do one tap.
2. **Fetch the bill first, always when the biller supports it.** Shows amount due, due date, name on the bill and any late fee before the person chooses an amount. A switch (`billFetch`) turns it off for a bank without an adapter; then the person types the amount.
3. **Pay full, minimum, or another amount.** Each biller carries its own rule (full only, any amount, or at least the minimum). This mirrors SADAD and Aani, where the biller decides. A card biller allows paying up to the total balance.
4. **Currency follows the biller.** A bill in SAR or JOD is paid from a USD account with the conversion shown. A switch (`allowCrossCurrency`) can force same-currency accounts, giving `BILL_CURRENCY_MISMATCH` as in the existing spec.
5. **Show the amount again at pay time.** If the biller changes the amount between lookup and payment, we stop and show the new amount (`BILL_CHANGED`). This protects the person from paying a stale figure.
6. **Already paid and not found are different errors.** "No bill found" means check the number; "already paid" means nothing to do. Mixing them wastes calls to support.
7. **Auto-pay is an offer, not a default.** It creates a normal schedule that the person can see, edit and cancel in `schedule-payment`. Saves a second set of rules.
8. **A code is asked for every bill payment** (matches the spec and the fixture). A bank may lower this later for saved billers.

## 5. Field table

| Field | Rule | Message |
|---|---|---|
| Biller | Must be chosen from the directory | "Choose a biller." |
| Search | Free text, up to 40 characters, matches name, category, region | none |
| Reference (account, bill or mobile number) | Pattern per biller (for example 12 digits, 10 digits, mobile starting 05) | "{label} should be {n} digits." (`INVALID_REFERENCE`) |
| Pay from | Account with enough available balance in the bill currency or, if allowed, converted | "Not enough in the account: you would pay {x} but {y} is available." (`INSUFFICIENT_FUNDS`) |
| Amount choice | Full, minimum (if the biller has one), other amount (if the biller allows part payment) | none |
| Other amount | More than 0, up to 2 decimals, at least the biller's minimum, not above the amount due (cards: up to total balance) | "The minimum for this bill is {x}." (`AMOUNT_BELOW_MINIMUM`) / "This bill is {x}. You can't pay more than that." (`AMOUNT_ABOVE_DUE`) |
| Daily limit | Total in USD at most 41,250.00 remaining | "That's over your remaining daily limit of $41,250.00." (`DAILY_LIMIT_EXCEEDED`) |
| Save biller | Optional; nickname up to 30 characters | none |
| Auto-pay | Optional; billers that support it; cap amount above 0 | "Enter a limit above zero." |
| Consent | Must be ticked | "Tick the box to confirm." |

## 6. Edge cases

- Bill not found (reference ends 0000): `BILL_NOT_FOUND`. Already paid (9999): `BILL_ALREADY_PAID`. Biller not answering (1111): `BILLER_UNAVAILABLE`. Nothing due (5555): `NO_AMOUNT_DUE`. Overdue with late fee (7777). Amount changes after lookup (3333): `BILL_CHANGED`.
- Partial payment: the next lookup of the same bill shows the remaining balance.
- Overpaying is refused except for cards.
- Paying a bill in a currency the person has no account for: converted from USD with the rate shown; fee also converted.
- The bank is down (`SERVICE_UNAVAILABLE`) or times out (`TIMEOUT`): the receipt is never shown; the message says to check Activity before trying again.
- Duplicate payment within a short time of the same bill and amount is blocked by "already paid" in the sandbox.
- Arabic (RTL) layout: the reference field stays left to right.

## 7. Open questions

1. Which billers in each country allow partial payment? Needs the official SADAD and eFAWATEERcom biller rules.
2. Does the bank charge a fee for SADAD or eFAWATEERcom, and who sets it?
3. Should a saved biller skip the code for amounts under a limit (PSD2 style exemption)?
4. Do UK and EU billers need an IBAN-based pay flow instead of a fetch? The prototype treats them as fetch-capable billers.
5. Should receipts be PDF documents with the biller's logo?
