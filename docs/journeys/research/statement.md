# Research note: Statements and letters (`statement`)

Release 1, Personal. Prototype build: `design/bankworkx-r1/src/journeys/22-statement.js` (replaces the reference `10-statement.js`). Synthetic data only.

## 1. Sources

| Source | What I took |
|---|---|
| https://www.emiratesnbd.com/en/help-and-support/all-about-your-authenticated-statement | UAE: a bank-authenticated statement exists as a separate product and can be requested in the app. (Page body was truncated in my fetch; only the title and the search snippet were usable. Fee details to confirm.) |
| https://www.emiratesnbd.com/en/help-and-support/balance-certificate | UAE: a balance certificate states the balance on a requested date; requestable in the app. |
| https://www.emiratesnbd.com/en/ways-of-banking/e-statements | UAE: e-statements as a standard option. |
| https://www.consumerfinance.gov/rules-policy/regulations/1005/9/ | US Regulation E: monthly statements when electronic transfers happen, otherwise at least quarterly; contents include opening and closing balance, fees and an address and phone for errors. |
| https://www.legislation.gov.uk/uksi/2015/2038/regulation/10?view=plain | UK: annual statement of fees, free; delivery agreed with the customer; paper on request. |
| https://www.legislation.gov.uk/eudr/2014/92/chapter/II | EU: same idea under the Payment Accounts Directive. |
| https://suncorpbank.com.au/help-support/faqs/business-banking/accounts/download-statements-into-other-file-type.html | CSV and OFX export (OFX for Xero). |
| https://cbna.com/faq/file-types-for-transaction-downloads | A US bank offering CSV, TXT, OFX, QBO and QFX downloads. |
| https://community.standardbank.co.za/t5/General-banking/Personal-banking-statements-in-csv-or-excel-format/m-p/437712 | A bank offering CSV, PDF, QIF, OFX, XLSX and TXT. |
| https://www.propersoft.net/howto/convert-pdf-files-from-your-online-banking-to-qif-or-ofx-format/ | Many people convert PDFs by hand because banks do not offer OFX/QIF; a gap worth closing. |
| https://www.alrajhibank.com.sa/induction/en/induction_form_apply_en.html | Salary certificates come from the employer on letterhead, not from the bank app. |

I found no bank page that gave exact wording for visa-support letters; the wording below is my own, based on what these banks describe.

## 2. Patterns found

| Topic | US | UK | Europe | Middle East |
|---|---|---|---|---|
| Regular statement | Monthly PDF kept in the app for years | Monthly PDF, 7 years in app at many banks (general knowledge) | Monthly or quarterly PDF; annual fee statement | Monthly e-statement; authenticated/stamped version on request |
| Proof of address | Statement or a letter from branch | Statement or letter; many banks email a "proof of address" PDF | Bank certificate | Stamped statement or letter, often with fee |
| Formats | PDF; CSV/OFX/QFX for downloads | PDF; CSV | PDF; CSV; MT940/CAMT for business | PDF; some CSV/Excel |
| Paperless | Opt-in with email notice | Default digital, paper on request | Paperless with notice | Opt-out common; SMS notice |
| Certified copy | "Statement with bank stamp" at branch | Stamped copy at branch | Same | In-app authenticated statement, English and Arabic |

## 3. Standards and rules (plain English)

- **US Regulation E.** A monthly statement for each month with an electronic transfer, at least quarterly otherwise. It must show opening and closing balance, fees and a contact for errors. Our PDF summary page does this.
- **EU/UK fee statement.** Yearly, free, on request on paper. The statement hub should also offer this fee statement (open question below).
- **Anti-fraud for official documents.** A stamped document carries a code or QR so the recipient can check it with the bank. Prevents forged statements for visa or loan.
- **Data protection.** An official statement shows name, address, account number. Sending it to a third party needs the customer's say-so and a short-lived link.
- **KYC address proof.** A letter only works if the address was verified. Prototype refuses a letter when no verified address exists (`ADDRESS_NOT_VERIFIED`).
- **Retention.** Banks must keep records for years (commonly 5 to 7); the app shows 24 months and the rest by request.

## 4. Decisions for BankWorkx

| Decision | Why |
|---|---|
| One journey, six purposes: records, official statement, proof of address letter, balance certificate, past monthly statement, paperless settings | People think in "what do I need it for", not in file types. |
| Official statement: PDF only, up to 12 months, English or Arabic and English, QR/verification code, optional $5 fee | Matches UAE/Middle East practice and stops year-long forgeries. |
| Records: up to 24 months; PDF, CSV, OFX, QIF each switchable by the bank | Closes the gap noted by accounting users. |
| Fee shown at review and charged at confirmation; refused if available balance is too low | No surprise charges. |
| A code (step-up) is needed for official documents and paperless changes, not for records | These carry identity data or change settings. |
| "What is it for?" (visa, loan, rent, employer) is printed on the document | Recipients trust documents that say why they were issued. |
| Email: to me, or to someone else (switchable), recipient gets a link that works 14 days | Avoids attaching sensitive PDFs. |
| Monthly list: last 24 months, "Ready" from the 1st of the next month | Matches regular statement behaviour. |
| Paperless: per account; paper has a monthly fee; at least one notification channel | Explicit consent for the channel. |

## 5. Field table

| Field | Rule | Message |
|---|---|---|
| Purpose | Required | "This is required." |
| Account | Required; closed accounts refused | "Closed accounts can only be requested at a branch." (`ACCOUNT_CLOSED`) |
| Period | Records: up to 24 months; official: up to 12 months | "Statements cover up to 24 months at a time." / "Official statements cover up to 12 months." (`PERIOD_TOO_LONG`) |
| From | Not before the account opened | "This account opened on D. Choose a later start." (`BEFORE_OPENING`) |
| To | Not before From | "The end date is before the start date." (`RANGE_INVALID`) |
| Statement month | Required for past monthly; last 24 months | none |
| Balance on | Required for balance certificate; a past date | none |
| Format | Depends on purpose | none |
| Language | Official documents only | none |
| What is it for? | Official documents only | none |
| Recipient email | Required when sending to someone else; valid email | "That email address doesn't look right." (`INVALID_EMAIL`) |
| Paperless toggle and channel | Channel required while paperless | none |
| Review | At least one transaction in the period (records, official, monthly); fee covered | "There are no transactions on A in the period P." (`NO_TRANSACTIONS`); "Your available balance of X is too low for the Y fee." (`FEE_INSUFFICIENT_FUNDS`) |
| Letter | Verified address; account not dormant | `ADDRESS_NOT_VERIFIED`, `ACCOUNT_DORMANT` |

## 6. Edge cases

- Period before the first transaction: opening balance computed from the earliest data; empty periods are refused rather than producing a blank file.
- A balance certificate for a date with no activity is allowed.
- Foreign currency account: fee is converted to the account currency.
- Dormant account: statements allowed; letters refused.
- JOD amounts use three decimals.
- Email delivery of a record to the customer's own address needs no step-up.
- Time-out or bank down: standard messages, nothing charged.
- A statement that spans a closed account is a branch request.

## 7. Open questions

1. Should the free annual fee statement (EU/UK) be a purpose here, or its own journey?
2. Is the verification service public (a page where a recipient types the code)? The prototype only prints the code.
3. Will the bank charge for official statements, and will the fee change by account tier?
4. Do we offer MT940/CAMT or Excel to retail customers, or only to business?
5. How far back can statements go in the app (24 months here)?
6. Are letters in languages other than English and Arabic needed (for example French in Jordan or Lebanon)?
