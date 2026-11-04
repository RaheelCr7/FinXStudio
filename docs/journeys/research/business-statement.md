# Research: business-statement (statements and reports)

Synthetic data only. Built in `design/bankworkx-r1/src/journeys/46-business-statement.js`.

## 1. Sources
- https://www.sepaforcorporates.com/swift-for-corporates/the-difference-between-a-camt052-camt053-and-camt054/ : camt.052 intraday, camt.053 end of day, camt.054 debit/credit notification.
- https://www.deutsche-bank.de/dam/deutschebank/de/shared/pdf/ub/camt_FactSheet.pdf : bulk booking details can be in camt.053 or a separate camt.054; camt formats replace MT940/MT942.
- https://www.abnamro.nl/en/commercialbanking/products/payments/sepa/reporting/choice-format.html : choosing MT940/942 versus camt.053/052.
- https://www.commerzbank.com/ms/documents/en/iso-20022-conversion-account-information.pdf : camt formats replace MT940 and MT942.
- https://eco.com/support/en/articles/17190462-bai2-vs-mt940-vs-camt-053-bank-statement-formats-explained : BAI2 versus MT940 versus camt.053 summary.
- https://www.hsbcnet.com/-/media/hsbcnet/client-transition/bai2-ir-specs.pdf : BAI2 files generated overnight; account and consolidation records.
- https://developer.gs.com/docs/services/transaction-banking/bai-file/ : prior-day and intraday BAI2 cadence.
- https://iserve.cbd.ae/support/solutions/articles/80000957516-how-to-download-mt940-statements- : UAE bank: register accounts first, then download MT940 as text.
- https://emiratesislamic.ae/-/media/ei/pdfs/business-online/mt940_maintenance.pdf : MT940 service needs a signed maintenance request.
- https://www.santander.co.uk/content/dam/sites/santander-uk-cb/resources/documents/connect/mt940-and-mt942.pdf : UK MT940 and MT942 guide.
- Gaps: no Saudi or Jordan sources found; retention and period limits vary and are set as bank options.

## 2. Patterns found
| Format | Who uses it | Typical delivery | Notes |
|---|---|---|---|
| PDF | Owners, auditors, lenders | Download, secure link | Human-readable; size limited |
| CSV | Bookkeepers | Download | No standard layout |
| Excel | Finance teams | Download | Summary sheet, filters |
| MT940 / MT942 | Treasury, ERP (global, still wide in Gulf and UK) | sFTP, host-to-host | Country-specific codes |
| camt.053 / camt.052 | Europe, UK, growing worldwide | sFTP, host-to-host, EBICS | Structured XML, richer |
| BAI2 | US treasury | sFTP, portal | Needs code mapping; overnight or intraday |

## 3. Standards and rules
- MT940 is the SWIFT end-of-day statement; MT942 the intraday interim report. camt.053 and camt.052 are the ISO 20022 equivalents. camt.054 is a notification of single or bulk credits and debits (not offered in this release, see open questions).
- BAI2 (Bank Administration Institute) is comma-separated with account headers, balance and transaction type codes.
- End-of-day files are final; intraday files are interim and are replaced by the end-of-day file.
- A statement is per account and currency; each has its own opening and closing balance.
- Sensitive files go by secure link or secure file transfer, with optional PGP encryption, not as plain attachments.
- Delivery to addresses outside the company is a bank decision (option).

## 4. Decisions for BankWorkx® and why
1. Format cards say who uses each one and are individually switchable by the bank; a disabled one is shown with "Not enabled at your bank", so the person understands why it is missing.
2. Choosing intraday relabels MT940 to MT942 and camt.053 to camt.052. Reason: one concept for the person, the right message for the machine.
3. Period: quick periods plus custom dates, 24 months maximum (PERIOD_TOO_LONG). Intraday is today only.
4. Several accounts allowed; accounts without export rights are left out, not silently included.
5. Preview of the first rows, or the first lines of the machine format, before creating.
6. One-off download or schedule (daily, weekly, monthly, hourly for intraday). Schedules capped at 10.
7. Email defaults to a secure link; sFTP can be PGP encrypted; recipients limited to the company domain unless the bank allows others.
8. Option "send an empty file or skip" for no-activity days, because ERP jobs expect a file.
9. When opened from Accounts with account and dates, the form is filled and starts at the check screen, with a Change options button.

## 5. Field table
| Field | Rule | Message |
|---|---|---|
| Account | Needs export permission | You can't export one of these accounts. (ACCOUNT_NOT_PERMITTED) |
| Several accounts | At least one | Choose at least one account you can export. |
| From / To | To not before From | The end date is before the start date. (INVALID_RANGE) |
| From / To | At most 731 days | Statements and reports cover up to 24 months at a time. (PERIOD_TOO_LONG) |
| Format | Enabled at the bank | Your bank hasn't switched that format on. (FORMAT_NOT_ENABLED) |
| Size | Per format limit (PDF 2,000 rows, Excel 10,000) | This is too large for the format you chose. (EXPORT_TOO_LARGE) |
| Rows | End-of-day one-off needs rows | There are no transactions on these accounts in that period. (NO_TRANSACTIONS) |
| Schedule name | 3 to 40 characters | Use at least 3 characters. |
| Recipients | 1 to 5 valid addresses | Check the email addresses. (INVALID_RECIPIENT) |
| Recipients | Company domain unless allowed | Your bank only allows delivery to addresses at your company. (EXTERNAL_RECIPIENT_BLOCKED) |
| Destination | Registered by an admin | That file-transfer destination isn't set up. (DELIVERY_NOT_SET_UP) |
| Schedules | At most 10 | You already have 10 schedules. (SCHEDULE_LIMIT) |

## 6. Edge cases
Intraday with pending items; two currencies in one request (separate statements); account added mid-period; weekend and holiday daily runs; empty day; period across a statement-number change; very large export; permission removed after the schedule is created (schedule should pause); bank turns off a format that a schedule uses.

## 7. Open questions
- Should camt.054 and camt.052 pushes (event-driven) be a separate journey?
- Retention: 7 days for one-off files in the prototype; what do real banks keep (often 90 days to 7 years)?
- Who is allowed to create schedules that go outside the company?
- Is a schedule owned by the person or by the company when the person leaves?
