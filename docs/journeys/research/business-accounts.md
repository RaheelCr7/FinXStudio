# Research: business-accounts (BankWorkx® Accounts tab)

Synthetic data only. Built in `design/bankworkx-r1/src/journeys/45-business-accounts.js`.

## 1. Sources
- https://www.key.com/businesses-institutions/keynavigator/help/reporting-research/info-reporting/overview-tour.html : intraday summary rolls up all enrolled accounts, with a per-account detail view.
- https://www.firsthorizon.com/business/commercial-banking-solutions/treasury-management/online-banking/online-reporting-modules : prior-day balances and current-day activity as separate modules.
- https://developer.gs.com/docs/services/transaction-banking/bai-file/ : prior-day and intraday reporting cadence.
- https://www.hsbcnet.com/-/media/hsbcnet/client-transition/bai2-ir-specs.pdf : account-level and consolidation records, overnight delivery.
- https://omniplus.ecobank.com/GCPCW/static/en_US_WebHelpNONUS/WebHelpClient/viewing_intraday_account_positions.htm : intraday positions view.
- https://www.uab.ae/-/media/pdf/corporate-banking/corporate-service-form.pdf : Gulf bank form: add or remove accounts and set access per account.
- https://mcb.mu/corporate/payment-cash/monitor/reporting-services-ib-dashboard : dashboard for monitoring and reconciling accounts.
- https://www.sepaforcorporates.com/swift-for-corporates/the-difference-between-a-camt052-camt053-and-camt054/ : intraday versus end-of-day vocabulary.
- Gaps: no public UK or Saudi portal documentation fetched in full; identifier layouts are standard knowledge (ABA, IBAN, sort code) not copied text.

## 2. Patterns found
| Pattern | US | UK | Europe | Middle East |
|---|---|---|---|---|
| Consolidated view | Roll-up of enrolled accounts | Balance by entity and currency | Cash position by IBAN | Dashboard by account |
| Balances shown | Ledger, available, collected | Cleared and available | Booked and value-dated | Ledger and available |
| Account identifier | ABA routing + account | Sort code + account (+ IBAN) | IBAN + BIC | IBAN + SWIFT |
| Entity switch | Company or sub-entity selector | Same | Same | Often separate login per entity |
| Access | Per account and per function | Same | Same | Per account on the application form |

## 3. Standards and rules
- Ledger balance: what the books say. Available balance: ledger minus holds and reserved payments. Pending: not booked yet.
- Consolidation: add accounts of one currency exactly; show another currency only as an indicative equivalent with the rate and time.
- Identifiers by region: ABA and account (US); sort code, account, IBAN (UK); IBAN and BIC (SEPA); IBAN and SWIFT (UAE). The screen shows what a payer in that region needs.
- Intraday data is interim; end-of-day data is final (camt.052 versus camt.053 idea).
- Access is checked per account and per action (see balance, see transactions, export, pay). The bank checks too.

## 4. Decisions for BankWorkx® and why
1. Top block is one consolidated figure plus a tile per currency. A single mixed-currency figure alone would hide risk.
2. FX equivalents are labelled indicative with a time. Reason: avoids a number people treat as a guarantee.
3. Accounts table shows available, ledger and pending separately; phone shows cards.
4. A region switch on account details (US, Europe, UK, Middle East) so a company can share the right details with a payer anywhere.
5. 13-week forecast as a line with the lowest point marked, plus the three numbers in text for accessibility.
6. Transactions filters: date range (with quick ranges), amount range, type, status, counterparty, reference, direction. Results update as you type.
7. A restricted account shows the balance and a clear "transactions hidden" state, not a silent blank (ACCOUNT_NOT_PERMITTED).
8. Export hands over to business-statement with account and dates prefilled.

## 5. Field table
| Field | Rule | Message |
|---|---|---|
| Date range (custom) | Format 2026-10-31 | Use the format 2026-10-31. (BAD_DATE) |
| Date range | End not before start | The end date is before the start date. (INVALID_RANGE) |
| Date range | At most 24 months | Search up to 24 months at a time. (RANGE_TOO_LONG) |
| Amounts | Numbers, up to 2 decimals | Enter amounts as numbers. (BAD_AMOUNT) |
| Amounts | Smallest not above largest | The smallest amount is higher than the largest. (AMOUNT_ORDER) |
| Account transactions | Needs permission | You can see this account's balance, but not its transactions. (ACCOUNT_NOT_PERMITTED) |
| Page | Service up | We couldn't load your accounts. (SERVICE_UNAVAILABLE) |

## 6. Edge cases
Account with pending debits greater than available; EUR account in a USD view; company with a single account; account the person cannot see transactions for; no matches for filters; 15 rows per page with "show more"; service down; switching company changes every number.

## 7. Open questions
- Should available balance include an overdraft or credit line figure?
- Do we show value date as well as booking date?
- How often should indicative FX refresh?
- Should entity totals show only companies where the person has any role?
