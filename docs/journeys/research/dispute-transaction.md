# Research: Report a problem with a payment (`dispute-transaction`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://docs.rainforestpay.com/docs/chargeback-dispute-reasons and https://www.chargebackgurus.com/a-merchants-guide-to-visa-chargeback-codes/ : network reason families (not recognised, duplicate, not received, cancelled, wrong amount).
- https://www.consumercomplianceoutlook.org/articles/2025/third-issue-2025/error-resolution-procedures-under-the-electronic-fund-transfer-act-and-regulation-e : US error resolution (10 business days to investigate, up to 45 days with a provisional credit).
- https://www.chargebackgurus.com/chargeback-reason-codes/visa/dispute-reason-code-12-6-processing-errors : duplicate processing family. A 120-day window is common (not verified for every network).

## 2. Patterns by market

| Market | Pattern |
|---|---|
| US | Debit card errors fall under Regulation E: investigate in 10 business days, up to 45 with provisional credit. |
| UK / Europe | Card scheme chargebacks and consumer protection rules; window around 120 days (unverified). |
| Middle East | Scheme chargebacks; bank-set windows (unverified). |

## 3. Standards and rules (plain English)

- Pending payments are not disputed until posted.
- A bank asks for a reason and details, and the person declares them true.

## 4. Decisions for BankWorkx® and why

- Six reasons, each with a few short fields. Evidence is optional. Declaration, then a case reference and a three-step timeline: 2 working days, 10 working days, 45 days.
- Optional block of the card when the payment is not recognised.
- No code: no money moves.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Reason | Required | Choose a reason. |
| Other charge date | Required for charged twice | Required |
| Expected amount | Not equal to charged | This is the amount that was charged. |
| What did you order? | 3 characters | Tell us what you ordered. |
| What happened? | 10 to 300 characters | Tell us a little more (at least 10 characters). |
| Declaration | Required | Please confirm to continue. |

## 6. Edge cases

- Pending, already reported, over 120 days, transfers and income refused with plain messages.

## 7. Open questions

- Exact timelines by market (unverified); provisional credit is not modelled.
