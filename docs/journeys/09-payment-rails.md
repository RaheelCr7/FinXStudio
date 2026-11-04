# 09. Payment rails: US, Europe, UK, Middle East and international

This is the shared reference for every journey that sends money to a person or a company: `personal-transfer`, `international-transfer`, `supplier-payment`, `schedule-payment`, `schedule-business-payment`, and (for the per-line rules) `bulk-payment` and `payroll-run`. The journeys name a rail from this file instead of repeating its rules.

All figures here are **proposals for the sandbox**: fees, limits, cut-offs, rates, and sample account data are synthetic. Before any figure goes to a real customer, check it against the scheme rules and the bank's own terms. Where a regulation is named, the file says what the journey must do, not how a lawyer would read the regulation.

Brand: BankWorkx®. The prototype for this flow is `design/bankworkx-r1/prototype.html` (gitignored; open it from a checkout).

## 1. How the journeys use this file

One flow, five regions. The shell's **Send money** button opens `personal-transfer` for the United States, Europe (SEPA), the United Kingdom and the Middle East, and `international-transfer` for every other country (SWIFT). Both journeys share the steps below. Business payments use the same steps, with approval added after the review.

| Step | Screen | What happens |
|---|---|---|
| 1 | Payee | Choose a saved payee, or enter a new one (personal only). A region chip decides the fields. |
| 2 | Payee check | New payees only. Shows the name check result (section 4). Saved payees were checked when saved. |
| 3 | Amount and speed | Amount in the payee's currency, the rail, purpose, charges, reference, date. |
| 4 | Review | Full cost, arrival, then the code prompt that names the amount and payee. |
| 5 | Result | Receipt with the rail's own reference, or "Pending approval" for a company. |

Business differences: the payee list shows only whitelisted suppliers (a new supplier is `add-supplier`, done by an administrator); purpose of payment and an invoice or PO reference are always required; limits and approval rules follow section 9.

## 2. Regions and rails

`Max` is per payment, in the rail's own currency. `Fee` is in USD and is what the sandbox charges the sender. "Instant" rails run every hour of every day and ignore cut-offs.

| Region | Rail id | Name | Speed | Currency | Max | Fee (USD) | Cut-off for same-day | Reference label |
|---|---|---|---|---|---|---|---|---|
| United States | `ach` | ACH (standard) | 1–2 business days | USD | 25,000 | 0.00 | none | ACH trace number |
| United States | `sach` | Same-day ACH | Same day | USD | 1,000,000 | 1.00 | 14:45 ET | ACH trace number |
| United States | `rtp` | Instant (RTP® / FedNow®) | Seconds, 24/7 | USD | 500,000 | 0.25 | none | Network ID |
| United States | `wire` | Wire (Fedwire®) | Same day | USD | no limit | 25.00 | 18:00 ET | IMAD |
| Europe (SEPA) | `sct` | SEPA Credit Transfer | Next business day | EUR | 1,000,000 | 0.00 | 15:00 CET (for next day) | End-to-end ID |
| Europe (SEPA) | `sinst` | SEPA Instant | Within 10 seconds, 24/7 | EUR | 100,000 | 0.50 | none | UETR |
| United Kingdom | `fps` | Faster Payments | Seconds, 24/7 | GBP | 1,000,000 | 0.00 | none | FPS reference |
| United Kingdom | `chaps` | CHAPS | Same day | GBP | no limit | 25.00 | 17:00 UK | CHAPS reference |
| United Kingdom | `bacs` | Bacs | 3 business days | GBP | 20,000 | 0.00 | none | Bacs reference |
| UAE | `aani` | Aani instant payment | Seconds, 24/7 | AED | 50,000 | 0.50 | none | Aani reference |
| UAE | `uaefts` | UAEFTS transfer | Same day | AED | no limit | 2.00 | 15:00 UAE | UAEFTS reference |
| Saudi Arabia | `sarieI` | sarie instant | Seconds, 24/7 | SAR | 20,000 | 0.50 | none | sarie reference |
| Saudi Arabia | `sarie` | SARIE transfer | Same day | SAR | no limit | 2.00 | 15:00 Riyadh | SARIE reference |
| Jordan | `cliq` | CliQ instant payment | Seconds, 24/7 | JOD | 10,000 | 0.30 | none | CliQ reference |
| Jordan | `jopacc` | JoPACC transfer | Next business day | JOD | no limit | 1.00 | 14:00 Amman | JoPACC reference |
| Other countries | `swift` | International (SWIFT) | 1–3 business days | per country | no limit | 25.00 (+15.00 if the sender pays all charges) | 15:00 UTC | UETR |

Rules:
- **Default rail.** The first rail in the region's list that fits the amount: US `ach`, SEPA `sct`, UK `fps`, UAE `aani`, Saudi `sarieI`, Jordan `cliq`, SWIFT `swift`. If the amount is above that rail's maximum, the default moves to the first rail that fits. The person can always pick another that fits.
- **A rail the amount does not fit** is shown dimmed with its limit and cannot be chosen (`RAIL_LIMIT` if forced).
- **Instant rail unavailable.** If the sandbox condition `unavailable: ["rail:sinst"]` (or any rail id) is set, the rail shows "Not available right now" and the screen offers the standard rail. A submit that reaches the bank while the whole bank is down shows `SERVICE_UNAVAILABLE`.
- **Planned extras** (not in the prototype): SEPA Credit Transfer for non-euro SEPA countries, UK Direct Debit, Zelle®-style email or phone aliases (US), CliQ alias payments (Jordan), UK and EU standing orders as native rail instructions.

Currencies by region: US `USD`; Europe `EUR`; UK `GBP`; UAE `AED`; Saudi Arabia `SAR`; Jordan `JOD`; SWIFT countries in the sandbox: Canada `CAD`, India `INR`, Japan `JPY`, Australia `AUD`.

## 3. Payee fields and validation

A saved payee carries all of these and is not re-validated on use. A new payee is validated field by field while typing: an error shows once the field has a value, and an empty required field shows its message after the person presses Continue.

| Region | Field | Rule | Code | Message |
|---|---|---|---|---|
| all | Name on the account | Required, 2 to 70 characters | `PAYEE_NAME_REQUIRED` | "Enter the name on the account." |
| US | Routing number (ABA) | 9 digits and the ABA checksum (3·(d1+d4+d7) + 7·(d2+d5+d8) + (d3+d6+d9) is a multiple of 10) | `INVALID_ROUTING` | "That routing number isn't valid. Check the 9 digits." |
| US | Account number | 4 to 17 digits | `INVALID_ACCOUNT` | "An account number has 4 to 17 digits." |
| US | Account type | Checking or Savings, default Checking | none | none |
| Europe | IBAN | Letters and digits, mod-97 check equals 1, length matches the country | `INVALID_IBAN` | "That IBAN doesn't look right. Check each character." |
| Europe | IBAN country | Must be in the SEPA list below | `NOT_SEPA` | "That IBAN isn't in the SEPA area. Use 'Other countries (SWIFT)'." |
| UK | Sort code | 6 digits, dashes optional (`20-00-00`) | `INVALID_SORT_CODE` | "A sort code has 6 digits, like 20-00-00." |
| UK | Account number | 8 digits | `INVALID_ACCOUNT` | "A UK account number has 8 digits." |
| Middle East | Country | UAE, Saudi Arabia or Jordan | none | none |
| Middle East | IBAN | Same IBAN check; the first two letters must match the chosen country (`AE` 23 characters, `SA` 24, `JO` 30) | `INVALID_IBAN`, `COUNTRY_MISMATCH` | "That IBAN starts with AE, but you chose Saudi Arabia." |
| SWIFT | Country | One of the sandbox list | none | none |
| SWIFT | SWIFT/BIC | 8 or 11 characters: 4 letters, 2 letters, 2 letters or digits, optional 3 | `INVALID_BIC` | "A SWIFT/BIC has 8 or 11 letters and numbers." |
| SWIFT | Account number or IBAN | 6 to 34 letters, digits, spaces or dashes | `INVALID_ACCOUNT` | "That account number looks too short or too long." |

IBAN lengths in the sandbox: DE 22, FR 27, ES 24, IT 27, NL 18, IE 22, BE 16, AT 20, PT 25, FI 18, LU 20, GR 27, AE 23, SA 24, JO 30, GB 22. SEPA list in the sandbox: DE, FR, ES, IT, NL, IE, BE, AT, PT, FI, LU, GR.

When a field is valid and the bank is known, a green note shows below it, for example "✓ Valid IBAN · Commerzbank", "✓ Valid routing number · JPMorgan Chase", "✓ Valid sort code · Barclays".

Masked display used everywhere after entry: IBAN as `DE89 •••• 3000` (first four, last four); UK as `20-00-00 · ••9911`; US as `ABA 021000021 · ••6789`; SWIFT as `BOTKJPJT · ••7890`.

## 4. Payee name check

Run once, when a new payee is added (and again if the person edits the name). The label depends on the region; the behaviour is the same.

| Region | Label | Basis |
|---|---|---|
| Europe | Verification of Payee | Required for euro payments under the EU Instant Payments Regulation; the check is offered on every SEPA payment in the sandbox |
| United Kingdom | Confirmation of Payee | UK scheme; the same four outcomes |
| United States | Account name check | No national scheme; shown only when the sandbox registry knows the account |
| Middle East | Name check | Uses the IBAN; availability varies by country |
| SWIFT | Name check | Usually not available: result is "Couldn't check" |

| Result | Meaning | Screen | Can the person continue? |
|---|---|---|---|
| `match` | Name equals the registered name (ignoring case, punctuation and extra spaces) | Green: "The name matches" | Yes |
| `close` | Shares at least one word with the registered name | Amber: shows the registered name and a button "Use '<name>'"; asks them to check with the payee | Yes, after ticking "I understand and want to continue" |
| `none` | No word in common | Red: "The name doesn't match. The money may go to the wrong person and might not be recoverable." | Yes, only after ticking the box |
| `na` | No registry entry or the bank cannot check | Grey: "We couldn't check this name" | Yes, only after ticking the box |

Rules: a saved payee shows a "Verified" chip on the amount screen (or "Saved" if the result was `na`). A tick on the box is recorded on the payment (`payeeCheck: "none", acknowledged: true`) and appears in the receipt and, for a company, in the audit trail. A person can save the payee from this screen ("Save this payee for next time", on by default). A company cannot add a payee; it uses the whitelist.

Sandbox registry (synthetic): the sample accounts in section 14 map to the names shown there. Any other IBAN, sort code or account is `na`.

## 5. Amount, currency and conversion

- The person types **what the payee receives**, in the payee's currency. The screen shows the conversion line only when the payee's currency is not USD.
- The payee's currency is fixed by the region and country (section 2). Sending a currency the payee's country does not use is `CURRENCY_NOT_SUPPORTED` (existing code).
- Sandbox rates (USD to the currency, 1 USD =): EUR 0.926, GBP 0.781, AED 3.672, SAR 3.750, JOD 0.709, CAD 1.360, INR 83.20, JPY 151.0, AUD 1.520. Rates are held for 60 seconds from the moment the amount screen opens; if the review screen is still open after that, it asks the person to refresh the quote (`QUOTE_EXPIRED`).
- Converted amount in USD = receive amount ÷ rate, rounded to the cent. **You pay** = converted amount + fee (+ the 15.00 extra for "sender pays all" on SWIFT). Rounding is to the cent, half up, once, at the end.
- The summary under the amount shows: They receive, Rate, Converted, Fee, **You pay**, Arrives. It updates on every keystroke without moving the cursor.
- Funds check: **You pay** must not exceed the available balance of the chosen account (`INSUFFICIENT_FUNDS`). The message names both numbers.
- Personal accounts offered as the source: the USD accounts. Paying from the Euro or Dirham accounts is planned.

## 6. Charges (SWIFT only)

For SWIFT the person chooses who pays the bank charges. Other rails do not ask: SEPA is always shared by rule, UK and US domestic rails have no payee-side charges, and the Middle East rails use the local scheme fee only.

| Choice | Code | Effect |
|---|---|---|
| Shared (default) | `SHA` | Sender pays the BankWorkx® fee; the payee may pay their bank's fee |
| I pay all | `OUR` | Extra 15.00 USD; the payee receives the full amount |
| They pay | `BEN` | Proposal: the sender pays the same as Shared and the payee's bank takes its charges from what arrives, so the payee may receive less |

The screen explains the choice in one line under the buttons. The receipt records the choice.

## 7. Purpose of payment and reference

- **Purpose** is required for: every Middle East payment, every SWIFT payment, and every company payment. Options: Family support, Goods or services, Salary, Rent, Education, Savings or investment, Other. A company can add its own purposes in a later release.
- **Reference** (called "Memo" in the US): Europe up to 140 characters (SEPA remittance information); UK up to 18 characters (the Faster Payments limit); US up to 80 characters; Middle East and SWIFT up to 140. The field refuses extra characters. Optional for a person; required for a company (invoice or PO number).
- Allowed characters: letters, digits, space and `. , ' - / ( ) + : ?`. Anything else is removed with a short note, never silently changed after review.

## 8. When: now, later, repeating

- **Now.** Instant rails send straight away. A same-day rail sent after its cut-off becomes next business day, and the review screen says so ("Goes out tomorrow: after the 14:45 ET cut-off").
- **Later.** The person picks a date that is a business day (up to 30 days ahead for a person, up to 24 months for a company, as in `schedule-business-payment`) for the rail's region; weekends and the holiday list for the region are disabled. Repeat: doesn't repeat, every week, every month.
- A scheduled payment is not taken from the balance until its date. It is checked again on that day (balance, limits, payee still valid). A failed run sends a notification and does not retry unless the person asks (`schedule-payment` journey).
- Scheduled and repeating payments appear in Payments › Scheduled with the next date and the amount in the payee's currency.
- A company's scheduled payment still needs approval before its date; one that is not fully approved by the cut-off on the date does not go (`NOT_APPROVED_IN_TIME`).

## 9. Limits, approval and strong customer authentication

Personal: the existing sandbox daily transfer limit of USD 50,000 for Alex (`bank.limits.get`) across all payments, shown on the amount screen as the remaining amount (41,250.00 in the demo); above it, `DAILY_LIMIT_EXCEEDED`. Rail maximums in section 2 apply on top.

Business (as in the SME spec): the person's daily limit 250,000.00 at Alpha (`LIMIT_USER_EXCEEDED`), company limit 1,000,000.00 (`LIMIT_COMPANY_EXCEEDED`), two approvers above 50,000.00, extra security check from 25,000.00. The limit is tested on the USD amount after conversion.

Strong customer authentication:
- Every payment to a new payee asks for a one-time code. Every payment from a person account asks for a code; payments to a saved payee under USD 30 in a rolling 24 hours may skip it (planned; the prototype always asks).
- **Dynamic linking.** The prompt names the amount and the payee ("Authorise €200.00 to Lena Fischer") and the code only works for that payment. Changing the amount or payee after the code is sent voids it (`STEP_UP_FAILED`).
- Companies: the extra check applies from 25,000.00 USD equivalent, to the Maker when submitting and to each Approver when approving.
- Three wrong codes lock the payment, not the account (`LOCKED` is for sign-in only; here the payment fails with `STEP_UP_FAILED` and the person starts again).

## 10. Compliance and fraud protection

- **Sanctions and screening.** Every payment is screened. A hit puts the payment on hold: status "Held for review", message "We're checking this payment and will tell you within one working day. You don't need to do anything." (`PAYMENT_HELD`). Sandbox trigger: a payee name of "Test Sanctions".
- **New payee cooling-off.** Existing rule (`BENEFICIARY_COOLING_OFF`): a payee under 24 hours old can receive at most USD 500 in 24 hours. The amount screen shows the remaining allowance for such a payee.
- **Name mismatch.** The acknowledgement in section 4 is the customer-facing fraud warning. A change of payee name after the check re-runs the check.
- **Purpose and amount patterns.** Planned: warn on a round amount to a new payee over USD 5,000, or "investment" purposes to a new payee, with a one-line scam warning the person can dismiss.

## 11. Receipt and references

The result screen and the receipt show: status chip, amount they receive, rate (if any), **You pay**, fee, rail name, payee name and masked account, date, **the rail's own reference** (label from section 2), and the BankWorkx® reference `BWX-nnnnnn`. For a company, the screen says "Pending approval", the approvers needed, and links to the tracker.

Reference formats in the sandbox: SWIFT, SEPA Instant: UETR (UUID v4). ACH: 15 digits. Fedwire: IMAD `20261103B1Q8` + 8 digits. Faster Payments: `FP` + 10 digits. CHAPS: `CH` + 10 digits. Bacs: `BC` + 10 digits. SEPA Credit Transfer: `E2E` + 12 digits. Others: a two-to-four-letter prefix + 10 digits.

Status words (timeline): Created, Awaiting approval (companies), Released to bank, Settled, plus the end states Rejected, Withdrawn, Returned (payee bank sent it back), Held for review. An instant rail goes straight from Created to Settled; a returned payment credits the account back and raises a notification.

## 12. Error codes added by this file

Shown through `ctx.error.message`. Codes already in the README keep their wording.

| Code | When | Message |
|---|---|---|
| `INVALID_IBAN` | IBAN fails the check | "That IBAN doesn't look right. Check each character." |
| `NOT_SEPA` | IBAN country outside the SEPA list | "That IBAN isn't in the SEPA area. Use 'Other countries (SWIFT)'." |
| `COUNTRY_MISMATCH` | IBAN does not start with the chosen country | "That IBAN starts with {cc}, but you chose {country}." |
| `INVALID_ROUTING` | ABA checksum fails | "That routing number isn't valid. Check the 9 digits." |
| `INVALID_SORT_CODE` | Not 6 digits | "A sort code has 6 digits, like 20-00-00." |
| `INVALID_ACCOUNT` | Account number the wrong length | "That account number doesn't look right." |
| `INVALID_BIC` | Not an 8 or 11 character BIC | "A SWIFT/BIC has 8 or 11 letters and numbers." |
| `RAIL_NOT_AVAILABLE` | Chosen rail is down or not offered for this payee | "{rail} isn't available right now. Choose another way to send it." |
| `RAIL_LIMIT` | Amount above the rail maximum | "That's over the {rail} limit of {limit}. Choose another way to send it." |
| `QUOTE_EXPIRED` | Review open longer than 60 seconds after the quote | "The exchange rate changed. Check the new amount." |
| `DAILY_LIMIT_EXCEEDED` | Personal daily limit | "That's over your remaining daily limit of {remaining}." |
| `PAYEE_NOT_CHECKED` | Payee check result needed but not acknowledged | "Check the payee before you continue." |
| `PURPOSE_REQUIRED` | Purpose missing where required | "Choose a purpose for this payment." |
| `NOT_APPROVED_IN_TIME` | A company payment reached its date without full approval | "This payment wasn't approved in time and has not been sent." |
| `PAYMENT_HELD` | Screening hit | "We're checking this payment and will tell you within one working day." |
| `PAYMENT_RETURNED` | Payee bank returned the money | "The payee's bank sent this payment back. The money is in your account." |

Existing and reused: `INSUFFICIENT_FUNDS`, `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `BENEFICIARY_NOT_WHITELISTED`, `BENEFICIARY_COOLING_OFF`, `STEP_UP_FAILED`, `SERVICE_UNAVAILABLE`, `TIMEOUT`.

## 13. Sandbox adapters (planned)

These replace the single `bank.transfers.create` (today it ignores the beneficiary and purpose). Names follow the existing `bank.*` and `corp.*` pattern; each goes into `catalog.ts` with `errors[]`, `moneyMoving`, `requiresOtp`.

| Adapter | Does | Money moving | OTP |
|---|---|---|---|
| `bank.payees.validate` | Validates the fields for a region; returns per-field errors and bank name | no | no |
| `bank.payees.check` | Runs the name check; returns `{result, registeredName?}` | no | no |
| `bank.payees.save` | Saves a payee after validation and check | no | no |
| `bank.payments.quote` | Returns rates, fee, total, arrival and the rails that fit; holds the quote for 60 seconds | no | no |
| `bank.payments.create` | Creates the payment from a quote id and a confirmed code | yes | yes |
| `corp.payments.quote`, `corp.payments.create` | The same for a company, with maker-checker, whitelist, limits and approver count | yes (create) | from 25,000 |

Sandbox conditions (see README): `unavailable: ["rail:sinst"]` takes a single rail down; `timeout: ["bank.payments.create"]` returns `TIMEOUT` without moving money; `latencyMs` slows every call. A scenario can also set the payee name to `Test Sanctions` for `PAYMENT_HELD`.

## 14. Sample data (synthetic)

All account numbers below are made up; the IBANs satisfy the checksum so the validators accept them.

| Region | Name | Account | Bank | Name check |
|---|---|---|---|---|
| US | Maya Chen | ABA 021000021, account 123456789 | JPMorgan Chase | match (saved) |
| US | Priya Raman | ABA 021000021, account 987654321 | JPMorgan Chase | match |
| Europe | Lena Fischer | IBAN DE89 3704 0044 0532 0130 00 | Commerzbank | match (saved) |
| Europe | Camille Dubois | IBAN FR14 2004 1010 0505 0001 3M02 606 | Crédit Agricole | match |
| UK | James Whitfield | Sort code 20-00-00, account 55779911 | Barclays | match (saved) |
| UAE | Omar Haddad | IBAN AE07 0331 2345 6789 0123 456 | Emirates NBD | match (saved) |
| Saudi Arabia | Faisal Al-Harbi | IBAN SA03 8000 0000 6080 1016 7519 | Al Rajhi Bank | match |
| Jordan | Rania Haddad | IBAN JO94 CBJO 0010 0000 0000 0131 0003 02 | Central Bank of Jordan | match |
| Japan (SWIFT) | Aiko Tanaka | BIC BOTKJPJT, account 1234567890 | none | `na` |

Business suppliers (Alpha): Harbour Packaging (US), Nordic Supplies AB (Europe), Whitby Logistics (UK), Gulf Trade FZE (UAE). Beta: Nimbus Logistics (US), Rhine Freight GmbH (Europe).

To see the other name-check results: type "Lena Fisher" against the Lena Fischer IBAN for `close`, "Bob Smith" for `none`.

## 15. Shared scenario matrix

Every payment journey's scenario list includes these, with the region it applies to. Scenario numbering restarts in each journey; the table gives the intent.

| Case | Applies to | Expected |
|---|---|---|
| Happy path, saved payee, default rail | all regions | Result screen with the rail reference; balance reduced by **You pay** |
| New payee, name `match` | all with a registry | Continue without a tick; payee saved if ticked |
| New payee, name `close` | Europe, UK | "Use '<name>'" button works; Continue needs the tick otherwise |
| New payee, name `none` | Europe, UK, US | Cannot continue without the tick; payment records `acknowledged: true` |
| New payee, name `na` | SWIFT | Tick required; payment still goes |
| Invalid IBAN, routing, sort code, BIC | by region | Field error with its code; Continue disabled |
| IBAN not in SEPA | Europe | `NOT_SEPA` |
| IBAN country differs from the chosen country | Middle East | `COUNTRY_MISMATCH` |
| Amount above the rail maximum | all rails with a max | `RAIL_LIMIT`; the default rail moves to the next that fits |
| Amount above available balance | all | `INSUFFICIENT_FUNDS` naming both numbers |
| Amount above the daily limit | personal | `DAILY_LIMIT_EXCEEDED` |
| Instant rail down | rails with an instant option | "Not available right now"; standard rail offered |
| Same-day rail after the cut-off | US, UK, Middle East, SWIFT | Review says it goes next business day |
| Foreign currency | Europe, UK, Middle East, SWIFT | Conversion line; rate held 60 seconds; `QUOTE_EXPIRED` after |
| SWIFT charges choice | SWIFT | `OUR` adds 15.00; receipt shows the choice |
| Purpose missing | Middle East, SWIFT, companies | `PURPOSE_REQUIRED`; Review disabled |
| Scheduled and repeating | all | Not debited until the date; appears in Scheduled |
| Wrong code three times | all | `STEP_UP_FAILED`, payment not created |
| Backend timeout on create | all | `TIMEOUT`; no money moved; message says to check Activity before trying again |
| Backend unavailable on create | all | `SERVICE_UNAVAILABLE`; nothing sent |
| Screening hit | all | Status "Held for review" |
| Company: Maker submits | companies | "Pending approval"; approvers named |
| Company: over 50,000 | companies | Two approvers |
| Company: above the person's limit | companies | `LIMIT_USER_EXCEEDED` |
| Company: payee not whitelisted | companies | `BENEFICIARY_NOT_WHITELISTED` |
| Company: person without `biz.payments.initiate` | companies | Button not offered; the bank refuses with `PERMISSION_DENIED` |

Mutation-check survivors expected across the journeys (with reasons): the exact text of each message (tests check the code, not the words); the sandbox registry names (fixture data); the specific rates (tests use a fixed rate table); the ordering of rails inside a region (only the default is asserted).

## 16. Open questions

1. Should the personal daily limit (50,000 today) be one figure for all payments, or per rail (so an instant rail has a lower daily cap than a wire)?
2. Do we offer payments from the Euro and Dirham accounts in Release 1, or only from USD accounts as in the prototype?
3. Is a name check wanted for US payments at all? The prototype shows one only when the sandbox registry knows the account.
4. Instant-payment limits for the Middle East (Aani, sarie, CliQ) are placeholders; the real figures depend on the bank and scheme.
5. Should "Sender pays all" (`OUR`) be offered for payments to the Middle East over SWIFT, or only for payments outside the region?
6. Whether the shell keeps one **Send money** button that chooses the journey by region, or shows two (domestic and abroad) as the existing launch points do.
