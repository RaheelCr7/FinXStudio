# Research note: bulk-payment (BankWorkx®)

Scope: a company Maker pays many suppliers from one file or from entered lines. Synthetic data only. Everything below is a summary in our own words. Search results were mostly bank guides and vendor pages, not the standards text itself, so every rule marked "check" must be confirmed against the bank's own specification before a real build.

## 1. Sources
- https://achdevguide.nacha.org/ach-file-overview - Nacha developer guide: record types 1 file header, 5 batch header, 6 entry detail, 7 addenda, 8 batch control, 9 file control; fixed 94-character lines.
- https://www.regions.com/virtualdocuments/NACHA_File_Layout_Guide.pdf and https://www.eastwestbank.com/assets/docs/business-training-center/businessBridgeDirect_NACHA_Format_ACH_Import_File_Specifications_20260311.pdf - how US business banks describe the layout for customers.
- https://frbservices.org/resources/financial-services/ach/faq/same-day-ach-sample-scenarios-effective-march--19-2021.html and https://www.nacha.org/system/files/2024-10/Same%20Day%20ACH%202024%20-%20Proposed%20Modifications%20to%20the%20Rules%20-%20October%208%202024.pdf - same-day windows (10:30, 14:45, 16:45 ET), USD 1,000,000 per-entry limit; a fourth window was only proposed (check status).
- https://www.wearepay.uk/wp-content/uploads/2026/02/Pay.UK-Bacs-System-Principles-V18-Jan-2026.pdf and https://www.hsbcnet.com/-/media/hsbcnet/client-transition/bacs-standard-18-mig-feb-2022.pdf - Bacs three-day cycle (submission, processing, value day), working days only.
- https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-10/EPC132-08%20SCT%20C2PSP%20IG%202025%20V1.0.pdf - SEPA customer-to-bank pain.001 guidelines; Latin character set; batch booking flag.
- https://www.nordea.com/en/doc/mig-cap-pain-002.001.03-status-v-1.2.pdf and https://www.cobase.com/insight-hub/pain.002-status-message-guide - pain.002 status: group status ACTC, PART, RJCT; echoes original count and control sum.
- https://www.mbank.pl/pdf/msp-korporacje/bankowosc-elektroniczna/swiftnetkorpo-pain002-specification.pdf - per-transaction status codes in a bank's pain.002.
- https://www.dib.ae/docs/default-source/wps-guidelines/wps-file-format-reference-guide_v1-1.pdf - UAE WPS SIF structure (shared with payroll note).
- https://www.rbcroyalbank.com/ach/cid-212697.html - example of file creation number duplicate check against recent files and levels of file errors.
- https://mypayments.herringbank.com/errors - example of a US bank warning on a file that looks like a recent upload.
- https://docs.lead.bank/products/ach/validations - file-based ACH: file-level failures reject the whole file, entry exceptions are reported separately.
- https://knowledge.modulrfinance.com/knowledge-hub/how-do-i-upload-a-payment-file - UK provider limits (lines and size per file) as a comparison.

## 2. Patterns found
| Region / bank type | File formats offered | Rejection style | Status feedback | Dates and cut-offs |
|---|---|---|---|---|
| US business bank | NACHA 94-character file (CCD for companies, PPD for people), bank CSV template | File-level failures (control totals, bad record order) reject the whole file; bad entries are reported per entry | Online file status, return codes (R01 and so on) days later | Same-day windows (ET) or next business day; per-entry limit USD 1,000,000 |
| UK bank | Bacs Standard 18 (fixed width), bank CSV, pain.001 on newer channels | Whole file fails on format; sort code and account checked before submit | Bacs reports after processing | Three working days: submit, process, value; no weekends |
| Euro bank | pain.001 XML (SCT, SCT Inst), CSV import | Group header count and control sum must match; some banks accept partial | pain.002 with ACTC, PART or RJCT and reason codes | SCT next business day, SCT Inst seconds, 24/7 |
| UAE / Saudi / Jordan | Bank CSV or Excel template; WPS SIF for wages (UAE, Saudi via Mudad) | Strict: totals and record counts must match | Bank confirms; regulator platform sees wage files | Local cut-offs (about 15:00); Sunday to Thursday or Monday to Friday varies by country |
| Modern fintech business banking | CSV with a template and sample row, line table with fix-in-place | Per-line errors shown before submit; send the good lines | Per-line status and a downloadable report | One cut-off shown near the date picker |

Common: upload, validate every line, show a table of errors, fix or drop, choose date, approve, then a status screen with per line outcomes.

## 3. Standards and rules (plain English)
- **ISO 20022 pain.001**: the XML way to hand a bank many credit transfers. A group header says how many payments and what control sum (the total). Banks check these against the lines; a mismatch fails the file. Payments sit in payment-information blocks, usually one per debit account, date and rail.
- **pain.002**: the status report the bank sends back. Group level: accepted (ACTC), partly accepted (PART), rejected (RJCT). Each rejected payment carries a reason code. The report repeats the original count and total so you can match it.
- **NACHA ACH**: fixed 94-character lines. File header, then one or more batches (batch header, entries, optional addenda, batch control), then file control with counts and an entry hash. CCD is company-to-company, PPD is company-to-person. Same-day needs a same-day effective date and a per-entry amount of USD 1,000,000 or less.
- **Bacs Standard 18**: UK fixed-width file for direct credits. Amounts in pence, sort code 6 digits, account 8 digits, reference up to 18 characters. Dates must be working days; the cycle is submit, process, value.
- **SEPA pain.001**: same XML, euro only, IBAN required, Latin characters only, reference up to 140 characters. A batch booking flag decides one debit line or one per payment.
- **CSV templates**: not a standard. Banks publish a header and a sample row. Wrong header or wrong column count is the most common failure.
- **Validation**: IBAN check digits (mod 97), US routing number checksum, sort code and account lengths, amount with two decimals above zero, allowed characters, duplicates inside the file, duplicates of a recently sent file, maximum lines and file size.
- **All-or-nothing versus partial**: the file is rejected whole when the file itself is broken (format, totals, header). Single line problems are usually handled by sending the good lines or by holding the whole batch, depending on the bank setting.

## 4. Decisions for BankWorkx® and why
1. File checks run before line checks, in this order: format, size, header, row count, control totals, character set, recent duplicate. A broken file is refused whole with a code, because a partial read of a broken file is dangerous.
2. Line checks run for every line and never stop at the first problem; each line gets ok, warning or error with all its codes. People fix once instead of five times.
3. Partial acceptance is a bank switch (`allowPartial`). On: send the good lines and keep the rest for repair. Off: the Continue button needs zero errors.
4. Lines can be fixed in place or dropped. Dropped lines are not lost: they go to a "left out" list that feeds the repair step.
5. Rails are chosen per country group, never per line, to keep the review readable. A rail that cannot carry the largest line in the group is greyed out.
6. Approval is by the whole batch by default (matches the existing spec: one payment, counts once against limits). Per-line approval is a switch (`allowPerLine`) because some companies want an approver to reject single lines.
7. Whitelist is strict: payee name must match an approved supplier and the account must equal the approved account. A known name with a new account is an account change, which is a classic fraud sign, so it is an error.
8. Instant rails are offered in bulk where the scheme allows it, with their own per-payment limit.
9. After release the bank report is shown per line, with a download in CSV and a pain.002-style XML. Bank-rejected lines are repairable with the same screen.
10. The prototype caps a file at 50 lines and 256 KB to match the existing spec; real banks allow hundreds to thousands (open question).

## 5. Field table
| Field | Rule | Message (code) |
|---|---|---|
| Pay from | One of the company's accounts | Choose the account to pay from. |
| Batch name | Optional, up to 35 characters | Use 35 characters or fewer. |
| File format | One of the formats the bank switched on | That file looks like {x}, but you chose {y}. (FILE_FORMAT_MISMATCH) |
| File | Allowed type, up to 256 KB | That file type isn't supported. (FILE_FORMAT_UNSUPPORTED); That file is too big. The limit is 256 KB. (FILE_TOO_LARGE) |
| Header | Seven columns in the template order | The first row must be the header: ... (FILE_HEADER_MISSING) |
| Control total | File count and sum equal the lines | The file says {a} payments and {b}, but the lines add up to {c} and {d}. (FILE_CONTROL_TOTAL_MISMATCH) |
| Recent duplicate | Same content as a file sent in the last 30 days | This file looks the same as one sent on {date}. Confirm to continue. (FILE_DUPLICATE) |
| Payee name | Required, 2 to 70 characters | Enter the payee name. (PAYEE_NAME_REQUIRED) |
| Whitelist | Name and account on the approved list | Not on the company's approved list. (BENEFICIARY_NOT_WHITELISTED); The account differs from the approved record. (ACCOUNT_CHANGED) |
| Country | A country the bank serves in bulk | Bulk payments don't reach {country} yet. Use an international transfer. (RAIL_NOT_AVAILABLE) |
| IBAN | mod 97 and length for country | That IBAN doesn't look right. (INVALID_IBAN) |
| US routing and account | Checksum; 4 to 17 digits | That routing number isn't valid. (INVALID_ROUTING); An account number has 4 to 17 digits. (INVALID_ACCOUNT) |
| UK sort code and account | 6 and 8 digits | A sort code has 6 digits. (INVALID_SORT_CODE) |
| Amount | Above zero, two decimals, not above the person's limit | The amount is not valid for this currency. (INVALID_AMOUNT); Above your limit of USD 250,000.00. (OVER_LIMIT) |
| Reference | Required; Bacs 18 characters, US 80, SEPA 140 | Reference shortened to 18 characters. (REF_TRUNCATED, warning) |
| Duplicate line | Same payee, account, amount and reference | Same payee, amount and reference as line {n}. (DUPLICATE_LINE) |
| Execution date | Working day, not in the past; today only before 16:00 UTC | Choose a working day. (DATE_NOT_WORKING_DAY) |

## 6. Edge cases
- File with a header only, or more than 50 lines: refused (EMPTY_BATCH, BATCH_TOO_LARGE).
- Same payee twice with different references and amounts: allowed, warning only if amount equals.
- Lines in several currencies: totals shown per currency and also in USD for limits.
- Name with accents or non-Latin letters: replaced for SEPA and Bacs, shown as a warning.
- Line over the default rail limit: the group moves to the next rail that fits, or the person chooses.
- Approved after the cut-off: the date moves to the next working day and the person is told.
- Bank rejects one line after release: batch is "partly paid", report lists the reason, line goes to repair.
- Edit while another person approves: not allowed once submitted; withdraw first.
- Spreadsheet-corrupted amounts (1,2e3, text): invalid amount.

## 7. Open questions
1. Real maximum lines and file size per bank (500, 5,000, 10,000?).
2. Per-line approval: reject only, or approve a subset as well?
3. Does the bank hold the whole batch when one line fails sanctions screening?
4. Should lines to payees not whitelisted be addable inline with a request for approval?
5. Is the pain.002 style download enough, or is a PDF report needed?
6. Confirmation of Payee or Verification of Payee on every line, or only new payees?
