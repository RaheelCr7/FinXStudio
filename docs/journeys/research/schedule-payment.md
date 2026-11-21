# Research: schedule-payment

Journey `schedule-payment` (BankWorkx® Retail, Payments; also covers change and cancel). Prototype file: `design/bankworkx-r1/src/journeys/35-schedule-payment.js`. Data is synthetic. Figures marked "to confirm" were not verified on an official page.

## 1. Sources

| Source | What was taken |
|---|---|
| https://www.smile.co.uk/faqs/digital-banking/online-banking/can-i-cancel-an-existing-standing-order-regular-payment/PROD-6297 | Cancel a standing order by 9pm on the working day before it is due; cancelling on the day may not stop it. |
| https://www.rbs.co.uk/support-centre/payments/general/how-do-i-cancel-a-standing-order.html | Cut-off 6pm on the previous working day; amending takes about three working days notice. |
| https://www.thinkmoney.co.uk/blog/what-you-need-to-know-about-standing-orders/ | Cut-off 11pm the day before. Shows that cut-off times differ by bank. |
| https://www.coutts.com/help-centre/coutts-online/payments/standing-orders/When-is-the-deadline-for-cancelling-a-standing-order-payment-.html | Same idea, bank-specific deadline. |
| https://www.wearepay.uk/what-we-do/payment-systems/faster-payment-system/how-faster-payments-work/ | Faster Payments cannot be recalled once sent, so the only safe stop is before the run. |
| https://www.ally.com/help/bank/bill-pay.html and https://www.usbank.com/customer-service/knowledge-base/KB0069766.html | US scheduled bill pay: cancel or edit until processing starts, no fee; the date you choose is the date the account is debited. |
| https://assets.ing.com/m/24e3cd73efdd3e08/original/SEPA-Direct-Debit-timelines.pdf | SEPA timing basics: business-day calendar (TARGET), 14 days notice for Direct Debit. |
| https://stripe.com/en-ch/resources/more/what-is-the-direct-debit-guarantee | UK Direct Debit failure reasons include insufficient funds; the biller, not the bank, decides on retry. |
| docs/journeys/09-payment-rails.md section 8 and docs/journeys/01-retail.md (`schedule-payment`, `cancel-standing-order`) | The BankWorkx® rules the journey must keep: 06:00 UTC run, no automatic retry, pause after two failures. |

## 2. Patterns found

| Region / bank type | Kinds offered | Closed days | Fail on no money | Change or cancel |
|---|---|---|---|---|
| UK high street | Standing order (weekly to yearly), future-dated payment | Many pay on the next working day; some let the person choose | Payment is returned or skipped, bank may notify; fees vary by bank | Until a cut-off the working day before (6pm, 9pm, 11pm seen) |
| US bank bill pay | One-time and recurring, often "pay on date" | Weekend dates roll to the next business day | Bank may retry or skip; overdraft rules apply | Until processing starts, no fee |
| Europe (SEPA) | Standing order, future-dated SEPA transfer | TARGET business days only | Rejected with a reason code, usually no retry | End of the business day before (PSD2) |
| UAE, Saudi, Jordan | Scheduled transfers and bill schedules in apps | Weekend Fri/Sat in Saudi and Jordan, Sat/Sun in UAE | Reject and notify; no retry by default | Before the run date; bank-specific |

## 3. Standards and rules (plain English)

- **Right to cancel a future-dated payment (PSD2 article 80, UK Payment Services Regulations 2017).** A payer can cancel a payment that is set for a future day up to the end of the business day before. After that it cannot be called back. BankWorkx® uses 18:00 on the previous business day as the cut-off.
- **Strong customer authentication (PSD2 SCA).** The first schedule needs a code. Later runs of the same amount to the same payee are exempt, so the code is asked only when the schedule is created or changed.
- **Faster Payments.** Standing orders and future-dated payments are sent as Faster Payments in the UK, so they arrive in seconds on the run date and cannot be recalled.
- **SEPA Credit Transfer and TARGET calendar.** Runs on TARGET business days. 25 and 26 December and 1 January are closed.
- **US Reg E.** For preauthorised transfers, a stop request three business days before the date must be honoured. BankWorkx® is stricter for a customer's own schedules (previous business day), but a bank may switch to three days.
- **Direct Debit Guarantee (UK) and SEPA Direct Debit Core.** Different thing: the biller pulls the money. They are not scheduled by the payer, so they are out of scope here; they are shown as "Direct Debits" in a later journey.

## 4. Decisions for BankWorkx® and why

1. **One journey with three modes: new, edit, cancel.** Same screens and same rules for the schedule list, fewer places to get out of step.
2. **Five frequencies: once, weekly, fortnightly, monthly, quarterly.** Fortnightly and quarterly are what UK and Gulf banks offer and what bills need. Day 29 to 31 on a monthly schedule falls on the last day of short months.
3. **End rules: never, last payment on a date, after N payments.** The date is chosen from the run dates so it can never be invalid. Never is allowed for repeating schedules only.
4. **Closed days are allowed but explained.** Person picks any date; if it is a weekend or holiday for the payee's region the screen says which business day it will really go, and offers "next business day" (default) or "previous business day" (a switch).
5. **Always show the next 3 run dates** in the live summary, with any shift from a closed day. This is the check people do in their head.
6. **Amount: fixed, or the full balance of a saved bill, or the minimum due.** For a bill the amount is fetched on the run day. A "never more than" limit guards against a surprise bill.
7. **Insufficient-funds policy is a choice:** skip and tell me (default), try again next business day (once), or pause the schedule. This follows the BankWorkx® spec (no hidden retry) while giving people control.
8. **Reminder before it runs** (1 or 3 days before) by app, SMS or email, with a low-balance warning in it.
9. **Cut-off for change and cancel is 18:00 on the previous business day.** After that: "This payment runs today and can't be changed. Change or cancel it tomorrow to affect the next one." (`SCHEDULE_RUNNING`).
10. **Cancel asks no code**; changing does. Cancelling can only reduce what leaves the account.
11. **Skip next run** offered at cancel time (switch).

## 5. Field table

| Field | Rule | Message |
|---|---|---|
| What | Payee, own account, or saved bill | "Choose who or what to pay." |
| To | One of the saved payees, own accounts or saved bills | "Choose who to pay." |
| From | Account that can pay, same currency rule as the payment page | "Choose an account to pay from." |
| Amount | More than 0, 2 decimals, at most the rail maximum | "Enter an amount above zero." / "That's over the {rail} limit of {x}." (`RAIL_LIMIT`) |
| Amount type | Fixed, full balance of bill, minimum due (bills only) | none |
| Never more than | Bill schedules; more than 0 | "Enter a limit above zero." |
| How often | Once, weekly, fortnightly, monthly, quarterly | "Choose how often." |
| First payment | From tomorrow to 12 months ahead | "Choose a date from tomorrow." / "Choose a date within the next 12 months." |
| Ends | Never (repeating only), last payment on a date, after N payments | "Choose when it ends." |
| Last payment on | One of the run dates, after the first | "Choose a last payment date after the first." |
| Number of payments | Weekly 2 to 104, fortnightly 2 to 52, monthly 2 to 60, quarterly 2 to 40 | "Enter a number from 2 to {max}." |
| Purpose | Required for Middle East and international payees | "Choose a purpose for this payment." (`PURPOSE_REQUIRED`) |
| Reference | US 80, UK 18, others 140 characters | field stops extra characters |
| Reminder | None, 1 day, 3 days | none |
| Consent | Must be ticked | "Tick the box to confirm." |

## 6. Edge cases

- First date on a weekend or holiday: shown with the day it will actually go.
- Monthly on 31 Jan: runs 28 Feb, 31 Mar, 30 Apr.
- Run date already past the cut-off: `SCHEDULE_RUNNING`. Unknown id: `SCHEDULE_NOT_FOUND`. Already cancelled or ended: `SCHEDULE_NOT_ACTIVE`.
- Payee in another currency: the rate is set again on the run day, so "You pay" is an estimate.
- Instant rails run at 06:00 UTC; same-day rails must meet their cut-off, otherwise the run moves to the next business day.
- Two failed runs in a row pause the schedule (resume by saving a new date).
- Schedule that ends before its first run: refused.
- Bank down or timeout on save: nothing is scheduled and the message says so.
- Daily limit and balance are checked on the day, not at set-up; the review warns when today's balance is already lower than the payment.

## 7. Open questions

1. Should the cut-off be the same for all banks that use BankWorkx® or a setting per rail?
2. Do we offer "pay on the previous business day" in every region? Gulf banks differ.
3. Should fortnightly be available on SEPA (standing orders there are usually monthly or longer)?
4. Fees for a failed run, if any, are not defined; the prototype charges none.
5. Is "skip next" a separate journey (`cancel-standing-order`) or part of this one? The prototype puts it in this one.
