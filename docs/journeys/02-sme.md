# Module 2: SME (Business "Graphite") and the combined Alex Morgan demo

**Release 1. Workspace: Business.** Small and medium companies: a Maker starts payments, an Approver approves them, an Admin manages people and limits. The same person can hold different roles in different companies: Alex Morgan is Maker at Alpha Trading LLC and Approver at Beta Services Ltd, with a Personal relationship besides.

**What exists today:** the Meezan-only `CorporateSandbox` (`packages/mock-bank-api/src/corporate.ts`, `docs/CORPORATE.md`) with maker-checker, whitelist, limits, threshold, cut-off, bulk and payroll; Bank B behind the same `corp.*` adapters; five journeys in `packages/journey-schema/src/fixtures/` (`corporate-payments.ts` holds two). **What is planned:** workspaces and contexts, Alpha and Beta, an Admin role, shell screens, `dataTable`, `fileUpload`, `timeline`, `chart`, and the identity and conditions work (README 2.3, 1.5).

**Seed values** used throughout this file (planned, one table so the three parts agree): Alpha Trading LLC and Beta Services Ltd both USD; Alex's daily limit at Alpha 250,000.00; company daily limit 1,000,000.00 at each (bank ceiling 2,000,000.00); two approvers above 50,000.00; step-up amount 25,000.00; batch cap 20 items; file cap 256 KB.

## Journey index

| Group | Journeys |
|---|---|
| Accounts | `business-accounts`, `business-statement` |
| Payments | `supplier-payment`, `add-supplier`, `payment-template`, `schedule-business-payment`, `withdraw-payment` |
| Bulk and payroll | `bulk-payment`, `repair-bulk-lines` (alias of `bulk-payment`), `bulk-status`, `payroll-run` |
| Approvals | `approve-payments` |
| Admin | `manage-user`, `change-limits`, `edit-signatory-group` |
| More | `business-service-request`, `kyb-onboarding` (stretch) |

**17 journeys** (14 plus the stretch, plus `bulk-status` and `business-accounts` added when the prototype was built). Existing fixtures behind them: `corporate-payment` (becomes `supplier-payment`), `corporate-approval` (becomes `approve-payments`), `bulk-payment`, `payroll-run`, `withdraw-a-payment` (becomes `withdraw-payment`).

## Business: Overview

The first tab of Business "Graphite". It is a shell screen, not a journey: it draws from view-models and starts journeys through launch points. No Business shell exists in `packages/bank-client` today (the app has the Personal tabs `dashboard`, `accounts`, `budgets`, `wallet`), so everything on this screen is *(planned)* except the two adapters it can already read, `corp.company.get` and `corp.payments.pending`.

### Shell: Overview

#### Purpose
One glance answers four questions for the company the person is working in: how much money do we have, what is coming in and going out over the next 13 weeks, what is waiting for a decision and how long is left before the bank's cut-off, and what happened lately.

#### Route and view-model
| Item | Value |
|---|---|
| Web path | `/business/<companyId>/overview` (for example `/business/alpha/overview`) |
| Mobile screen | `BusinessOverview` (first tab; tab bar: Overview, Accounts, Payments, Approvals, Admin, More) |
| Workspace | Business. Switching to Business needs `stepup` (README 4.3). The screen clears on a context switch (README 5.4). |
| View-model | `packages/bank-client/src/view-models/business-overview.ts` *(planned)*, one function that calls the adapters below and returns `{ header, balances, cashFlow, cutoff, queue, mine, recent }` |
| Permission to open | `biz.accounts.view`. Each widget has its own permission below. |

#### Data sources
| Widget | Adapter | Status | Request | Response (fields used) |
|---|---|---|---|---|
| Header, cut-off, limits | `corp.company.get` | Existing | `{ userId }` (from the active context after step 2) | `name`, `currency`, `accounts`, `me.roles`, `me.remainingToday`, `companyDailyLimit`, `companyUsedToday`, `dualApprovalAbove`, `cutoff` |
| Balances | `corp.accounts.list` *(planned)* | Planned | `{ userId }` | `accounts[]`: `id`, `name`, `maskedNumber`, `currency`, `balance`, `balanceInEntityCurrency`, `rate`, `rateAsOf`; `totalInEntityCurrency`, `entityCurrency` |
| Cash flow | `corp.cashflow.forecast` *(planned)* | Planned | `{ userId, weeks: 13, accountIds? }` | `weeks[13]`: `weekStart`, `inflow`, `outflow`, `net`, `closing`; `openingBalance`, `currency`, `basis` (a sentence saying what the forecast is built from) |
| Approvals queue | `corp.payments.pending` | Existing | `{ userId, as: "approver" }` | Object keyed by payment id: `amount`, `currency`, `payee`, `reference`, `initiatedBy`, `initiatedAt`, `approvals`, `required`, `valueDate`, `afterCutoff` |
| My payments waiting | `corp.payments.pending` | Existing | `{ userId, as: "initiator" }` | same shape |
| Recent payments | `corp.payments.list` *(planned)* | Planned | `{ userId, limit: 8, sort: "initiatedAt desc" }` | `payments[]`: the payment shape of `corp.payments.get` plus `payee` |
| Counter-value rates | `bank.fx.rate` | Existing (`fx.ts`) | `{ from, to }` | indicative rate, used inside `corp.accounts.list` |

`corp.accounts.list`, `corp.cashflow.forecast` and `corp.payments.list` follow the existing naming (`corp.<domain>.<verb>`). They read only: `moneyMoving: false`, `requiresOtp: false`. Errors for all three: `USER_NOT_FOUND`, `PERMISSION_DENIED` *(planned)*, `TIMEOUT` and `SERVICE_UNAVAILABLE` *(planned)*.

The sandbox builds the forecast from three things: the planned scheduled payments, payments waiting for approval (they are counted as outflow on their value date), and a seeded list of expected receipts (synthetic invoices). It never calls a real forecasting service.

#### Layout (web, 12-column grid; on mobile the same widgets stack in the order of the "Mobile order" column)
| Widget | Web position | Mobile order | Shown when the context holds |
|---|---|---|---|
| Entity header (company name, role badge, cut-off timer) | Top bar | 1 | always |
| Quick actions (**+**) | Top right | 2 (floating button) | at least one of `biz.payments.initiate`, `biz.payments.bulk`, `biz.payroll.run` |
| Consolidated balances | Row 1, columns 1–5 | 3 | `biz.accounts.view` |
| 13-week cash flow chart | Row 1, columns 6–12 | 4 | `biz.accounts.view` |
| Cash in and out (this week and last 4 weeks) | Row 2, columns 1–4 | 5 | `biz.accounts.view` |
| Approvals queue | Row 2, columns 5–8 | 6 (first when the person can approve) | `biz.approvals.approve` |
| My payments waiting | Row 2, columns 5–8 (in place of the queue) | 6 | `biz.payments.initiate` and not `biz.approvals.approve` |
| Recent payments | Row 3, full width | 7 | `biz.accounts.view` |

#### Widgets in detail

**Entity header.** Company name, a role badge (`Maker`, `Approver`, `Admin`), the base currency, and the cut-off timer.
- Cut-off timer text, before the cut-off on a working day: "Cut-off in {hh}h {mm}m. Payments approved by {cutoff} UTC go out today." Under 30 minutes it turns amber: "Cut-off in {mm} minutes."
- After the cut-off, or on a weekend or holiday: "Cut-off has passed. New payments go out on {valueDate}." (`valueDate` is the next working day; the sandbox is closed on weekends and on 9 Nov 2026.)
- Button **Pay now** on the timer shows only with `biz.payments.initiate` and opens `supplier-payment`.
- The timer ticks once a minute. The clock is `MockBank.now`, so a scenario can fix it.

**Consolidated balances.** A big number: the total of every account converted into the company's currency (USD for Alpha and Beta), labelled "Total across {n} accounts, in USD", with "Rates as of {date}, indicative" underneath. Below it a table.
| Column | Content | Sort |
|---|---|---|
| Account | name and `maskedNumber` | by name |
| Currency | ISO code | – |
| Balance | in the account's currency, with its decimal places (`currencyInfo`) | by value in USD |
| In USD | converted value (blank for USD accounts) | default, descending |
Tap or click a row opens Accounts › detail. A balance in a currency with no rate shows "Rate not available" and is left out of the total, with a small note "Total excludes 1 account".

**13-week cash flow.** A `chart` block *(planned)*: `kind: "line"`, source `corp.cashflow.forecast`, x = `weekStart` (label "Mon 9 Nov"), three series: `inflow` (positive tone), `outflow` (negative tone), `closing` (neutral, dashed). Hover or press shows a tooltip "Week of 9 Nov 2026: in {inflow}, out {outflow}, closing {closing}". Under the chart one line of text from `basis`. A table toggle ("Show as table") gives the same 13 rows as a `dataTable` *(planned)*, for accessibility. If `closing` goes below zero in any week, a warning chip "Balance may go negative in week of {date}" appears.

**Cash in and out.** Three figures for the last 7 days (and a small sparkline of the last 4 weeks): "Money in", "Money out", "Net". It is built from released payments and received credits, in USD. Empty: "No money has moved in the last 7 days."

**Approvals queue** (needs `biz.approvals.approve`). The first 5 rows of `corp.payments.pending` as approver, oldest first, with a count badge ("7 waiting"). Each row: payee (for example "Crescent Textiles" or "3 payments"), amount, who started it, "1 of 2 approved", and a cut-off chip: "Today" if `valueDate` is today, "Next working day" if `afterCutoff`. Button **Review** opens `approve-payments` with `{paymentId}`. Link "See all" opens Approvals › inbox. Empty: "Nothing is waiting for your approval." A person never sees their own payments or ones they have already approved here: `corp.payments.pending` already hides them.

**My payments waiting** (a Maker without approve rights). The same adapter with `as: "initiator"`. Row text "Waiting for {n} more approver(s)". Button **Withdraw** opens `withdraw-payment` with `{paymentId}` (needs `biz.payments.withdraw`). Empty: "You have no payments waiting for approval."

**Recent payments.** A `dataTable` *(planned)* with the last 8 payments of the company.
| Column | Content | Notes |
|---|---|---|
| Date | `initiatedAt`, `12 Nov 2026` | default sort, newest first |
| Payee | `payee` | "3 payments" or "Payroll 2026-10 · 3 employees" for bulk and payroll |
| Reference | `reference` | truncated at 24 characters |
| Amount | `amount` with currency | right aligned |
| Status | `statusChip` *(planned)*: Waiting for approval (amber), Paid (green), Rejected (red) | from `status` |
Row opens Payments › tracker › payment (the status timeline). On phones the table becomes a card list.

#### Role-dependent view: Alex at two companies
The same person sees two different Overviews. The permission list comes from `bank.session.get` *(planned)* for the active context.

| Widget | Alex as **Maker at Alpha Trading LLC** | Alex as **Approver at Beta Services Ltd** |
|---|---|---|
| Role badge | Maker | Approver |
| Quick actions (**+**) | Pay a supplier, Upload payments, Run payroll | None (the button is hidden: no initiate permission) |
| Cut-off timer **Pay now** | Shown | Hidden |
| Balances, cash flow, cash in and out, recent payments | Shown | Shown |
| Approvals queue | Hidden (no `biz.approvals.approve`) | Shown, with the payment started by `priya` waiting for Alex |
| My payments waiting | Shown (payments Alex started) | Hidden |
| Admin tab | Hidden | Hidden |
| Direct link to `approve-payments` | Opens a refusal: "Your role doesn't allow this. Ask an administrator at Alpha Trading LLC." | Opens the journey |

#### States
| State | What the person sees |
|---|---|
| Loading | Skeletons for each widget (grey blocks in the widget's size). Each widget loads on its own, so a slow forecast does not block balances. After 10 seconds without an answer a widget shows its timeout state. |
| Empty (new company) | Balances: "No accounts yet. Ask your bank to open one." (no button). Cash flow: "Not enough activity to forecast yet." Recent payments: "No payments yet." with button **Pay a supplier** (only with `biz.payments.initiate`). |
| Error (one widget) | The widget shows "We couldn't load this. Nothing was changed." and a **Try again** button. The rest of the screen stays usable. `TIMEOUT`: "This is taking longer than expected. Nothing was changed." `SERVICE_UNAVAILABLE`: standard message S-SERVICE_UNAVAILABLE (README 1.6). |
| Error (whole screen) | `SESSION_EXPIRED`: standard message (README 1.6), button **Sign in**. `PERMISSION_DENIED` on balances: "Your role doesn't allow this. Ask an administrator at {company}." |
| Stale data | If a refresh fails after a success, the old figures stay, greyed, with "Last updated {hh:mm}. Couldn't refresh." |

#### Drill-downs and launch points on this screen
| Tap | Leads to | Passes | Permission |
|---|---|---|---|
| **+** › Pay a supplier | `supplier-payment` | – | `biz.payments.initiate` |
| **+** › Upload payments | `bulk-payment` | – | `biz.payments.bulk` |
| **+** › Run payroll | `payroll-run` | – | `biz.payroll.run` |
| Cut-off timer › Pay now | `supplier-payment` | – | `biz.payments.initiate` |
| Approvals queue › row or Review | `approve-payments` | `{paymentId}` | `biz.approvals.approve` |
| Approvals queue › See all | Approvals › inbox | – | `biz.approvals.view` |
| My payments waiting › Withdraw | `withdraw-payment` | `{paymentId}` | `biz.payments.withdraw` |
| Balances › row | Accounts › detail | `{accountId}` | `biz.accounts.view` |
| Recent payments › row | Payments › tracker › payment | `{paymentId}` | `biz.accounts.view` |
| Header › switch | context switch (step-up) | `{companyId}` | context |

#### Acceptance and tests for the shell (checked by view-model tests, not by journey scenarios)
- S-1. A Maker at Alpha sees quick actions and "My payments waiting" and no approvals queue; an Approver at Beta sees the queue and no quick actions.
- S-2. The balances total equals the sum of each account converted at the rate shown, in the company's currency.
- S-3. The cash-flow chart has exactly 13 weeks starting on the Monday of the current week.
- S-4. The cut-off timer shows "Cut-off has passed" after 16:00 UTC, on a Saturday and on 9 Nov 2026.
- S-5. A failing forecast does not hide the balances (`conditions.unavailable: ["corp.cashflow.forecast"]`).
- S-6. After a context switch no data of the other company is visible.

---

## Business: Accounts

Shell screens for the **Accounts** tab of Business "Graphite", and two journeys on it, `business-accounts` (which folds the former Accounts table, Account detail and Transaction table shells) and `business-statement`. All are Release 1. Data comes from view-models in `packages/bank-client` over the active context (the company the person switched to). Nothing here shows data from another company or from Personal.

Common to every screen on this tab: the permission `biz.accounts.view` is needed to see it; the Export buttons need `biz.accounts.export`. Without `biz.accounts.view` the tab is not in the menu, and a forced adapter call answers `PERMISSION_DENIED` (planned). Amounts are in each account's own currency and decimals (`currencyInfo`, `roundMoney`). Totals are never added across currencies (the same rule as `bank.accounts.totals` for Personal). Account rows only appear if the person's role includes that account (see *Admin › Account permissions*).

New sandbox adapters used by this tab (all *planned*, read-only, `moneyMoving: false`, `requiresOtp: false`):

| Adapter | Request | Response | Error codes |
|---|---|---|---|
| `corp.accounts.list` (planned) | none (company and user from the active context) | record keyed by account id: `{ id, name, maskedNumber, iban, currency, ledgerBalance, availableBalance, status ("active" or "dormant" or "blocked"), type ("current" or "savings" or "payroll" or "collection"), lastActivityAt }` | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `corp.accounts.get` (planned) | `{ accountId }` | one account as above, plus `holdsToday` (money reserved by payments waiting for approval), `signatories` (names), `openedAt` | `ACCOUNT_NOT_FOUND`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `corp.transactions.list` (planned) | `{ accountId?, from?, to?, direction?, minAmount?, maxAmount?, text?, status?, reference?, sort?, page?, pageSize? }` | `{ rows: record keyed by transaction id, total, page, pageSize, sumIn, sumOut, currency }`; row `{ id, accountId, bookedAt, valueDate, description, counterparty, reference, amount (signed), currency, runningBalance, status ("booked" or "pending"), paymentId? }` | `ACCOUNT_NOT_FOUND`, `INVALID_RANGE`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |

### Shell: Statements

| | |
|---|---|
| Purpose | The statements and reports the person has already generated, to download again. |
| Route | Web: `/{project}/business/{companyId}/accounts/statements`. Mobile: `Business/Accounts/Statements`. |
| Data source | `businessStatements(ctx)` (planned) over `corp.statements.list` (planned; request none; response record keyed by id `{ id, kind, accountId?, from, to, format, createdAt, createdBy, sizeKb, expiresAt }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | `biz.accounts.export` |

**Columns**: Created (`12 Nov 2026 10:42`), Type (Statement or the report name), Account ("All accounts" when none), Period (`1 Oct 2026 to 31 Oct 2026`), Format (PDF, CSV or Excel), Size, Created by, Download (button; a link that stops working at `expiresAt`, shown as "Expired" in grey). **Sort**: Created, newest first. **Filters**: type (chips), account (select), format (chips). **Page size** 25.

**Buttons**: *New statement or report* (→ `business-statement`, no values). Row *Download* (downloads the generated file; web saves it, mobile opens the share sheet; no journey).

**States**: loading (skeleton rows); empty "You haven't made a statement yet." with button *New statement or report*; error and timeout as above. Files expire after 7 days in the sandbox.

**Launch points on it**: *Accounts › statements › New statement or report* → `business-statement`.

### Shell: Reports

| | |
|---|---|
| Purpose | A short menu of ready-made reports, each leading to `business-statement` with the report type preselected. |
| Route | Web: `/{project}/business/{companyId}/accounts/reports`. Mobile: `Business/Accounts/Reports`. |
| Data source | Static list in `businessReports()` (planned); no adapter. |
| Permission | `biz.accounts.export` |

**Cards** (title, one sentence, button *Create*):

| Card | Sentence |
|---|---|
| Account statement | "Every transaction on one account for a period." |
| Daily balance report | "The closing balance of each account on each day." |
| Payments report | "Every payment your company started, with its status and who approved it." |
| Cash in and out | "Money in and money out per account and per week." |

Each *Create* opens `business-statement` with `{reportType}` (planned value passed; see the journey). **States**: nothing loads, so there is no loading or error state; with no `biz.accounts.export` the screen is not in the menu and a direct address shows the S-`PERMISSION_DENIED` message with *Back*.

---

### ★ Business accounts — `business-accounts`

Catalog: `business-accounts`, workspace business, category Accounts, core no (kept in the "Lean" preset), a bank can switch it off (yes). Options: `forecast` "Show the 13-week forecast" (default on); `entities` "Show totals for other companies the person can see" (on); `details` "Show account details for receiving money" (on; declared in the catalog, not yet read by the prototype screen, which always shows the card (planned)).

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `business-accounts` |
| Purpose | The Accounts tab of a company: one consolidated balance, a tile per currency, a table of every account the person may see (available, ledger, pending), a 13-week cash forecast, totals for the person's other companies, and for one account: balances, details to give a payer in each region, the person's access, and searchable transactions with filters, a quick CSV and a hand-off to statements. |
| Release / workspace | 1 / Business |
| Status | Built in the prototype as a screen (`design/bankworkx-r1/src/journeys/45-business-accounts.js`, tab `acc`; research `research/business-accounts.md`). This block replaces the earlier shell texts "Accounts table", "Account detail" and "Transaction table with advanced filters and export" in this file; the shells "Statements" and "Reports" below it remain. |
| Channels | Web (table beside detail) and mobile (cards, then detail) |
| Starting pattern | `corp.company.get` for the accounts; everything else is new. |
| Who may use it | Business permission `accounts.view` in the prototype (README 4.2: `biz.accounts.view`). Per account the person has four rights: see balance, see transactions, export, pay from (below). Alex Morgan sees Alpha as Maker and Beta as Approver; both include this right. In the Personal workspace the tab is the Personal one and this screen is refused with `WRONG_CONTEXT`. |
| Launch parameters | `{accountId}` (the position of the account in the company's list, "0" or "1") opens that account's detail. |
| Shared reference | README 4.2 and 5.3; `business-statement` for exports. |

**Sandbox demo values.** Today is Tue 3 Nov 2026. Rates (indicative, updated 09:00 UTC): EUR 1.08, GBP 1.27 to the dollar. Accounts and the rights per account (see balance, see transactions, export, pay from):

| Company | Account | Currency | Ledger balance | Rights |
|---|---|---|---|---|
| Alpha Trading LLC (Alex is Maker) | Operating ••2001 | USD | 480,000.00 | all four |
| Alpha Trading LLC | Reserve ••2044 | EUR | 95,200.00 | balance, transactions, export; not pay from |
| Beta Services Ltd (Alex is Approver) | Operating ••3001 | USD | 310,000.00 | balance, transactions, export; not pay from |
| Beta Services Ltd | Payroll ••3002 | USD | 64,300.00 | balance only: transactions hidden, no export, no pay |

Consolidated balance: Alpha USD 582,816.00 (480,000.00 plus EUR 95,200.00 at 1.08), Beta USD 374,300.00. Tiles: Alpha "USD · 1 account" 480,000.00 and "EUR · 1 account" 95,200.00 "About $102,816.00 at 1.08". The sandbox adds 64 generated transactions per company over the last 95 days (the same every time): types Receipt, Payment, Payroll, Fee, Interest, Transfer, Direct debit; 78% on the first account; the first four payments are Pending; references `INV-…`, `RCPT-…`, `PAYROLL-yyyy-mm`, `FEE-yyyy-mm`, `REF-…`; ids `TX-52100` upward in steps of 7. Available balance = ledger minus pending payments out minus money held for payments waiting for approval minus, on the first account, a fixed hold of 1,250.00; pending money in on the first account is 24,100.00 at Alpha and 14,942.00 at Beta. For Alpha the hold for approvals includes `PAY-2040` (18,900.00). Forecast (13 weeks from the sandbox's weekly in and out figures): Alpha from USD 582,816.00 to USD 720,816.00, lowest point today; Beta from 374,300.00 to 459,860.00. Account details shown to a payer (Alpha Operating): United States ABA 021000021, account 0002001701, Business checking; Europe IBAN `DE89 3704 0044 0532 0120 010`, BIC `BWXDDEFFXXX`; United Kingdom sort code 20-00-00, account 5520010, IBAN `GB29 BWXK 2000 0055 200100`; Middle East IBAN `AE07 0331 2345 6789 20010`, SWIFT `BWXAAEADXXX`.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts tab | none | `accounts.view` |
| Overview › Consolidated balance | none | `accounts.view` |
| Command bar › Accounts | none | `accounts.view` |
| Payments › tracker › payment › account link | `{accountId}` | `accounts.view` |
| Business statement result › back | none | `accounts.view` |

If `business-accounts` is switched off the tab shows "Not available at your bank" (`JOURNEY_DISABLED`) and the Overview balance is not a link.

#### 3. Screens

**Accounts overview.** On a phone: a hero card, the accounts as cards, the companies card, the forecast; on desktop the hero and a row for companies and forecast sit above a table beside the detail.

*Hero.* "Consolidated balance · {company}", the USD total, "n accounts · USD equivalent at indicative rates · updated 09:00 UTC". Beneath it one tile per currency: "{currency} · n account(s)", the ledger total, "Available x", and for a non-dollar currency "About $x at 1.08". No tile adds two currencies.

*Your companies* (`entities` on). "Totals only. Switch to a company to see its accounts." A row per company where the person has the right to view accounts: name, "{role} · n accounts", the company total or the chip "Active"; a row switches to that company (the usual context switch with its security check).

*13-week forecast* (`forecast` on). A line chart "Forecast closing balance for the next 13 weeks: starts {x}, ends {y}, lowest in week {n}" with the lowest point marked and labels Now, W4, W8, W13; below it the figures in text: Today, In 13 weeks, Lowest point ("Today" or "{x} in week n"); a note "{All accounts in USD | account name}. Based on scheduled payments, payments waiting for approval and expected receipts. It is an estimate, not a promise." For one account the forecast is scaled by that account's share of the total.

*Accounts table.* Columns Account ("Operating ••2001"), Currency, Available, Ledger, Pending ("in x out y" or "None"). A row opens the account; **All accounts: every transaction** opens the combined transaction list. Loading: skeleton blocks for 0.6 s after a selection.

**Account detail** (one account selected).

*Balance card.* Name and masked number, the big available amount ("Available now · USD"), Ledger balance, Pending money in, Pending money out and holds, and the note "Available is the ledger balance minus holds and payments already reserved. Pending items are not booked yet." Buttons: **Statement or report** (opens `business-statement` with `{accountId}`; only with the export right) and **Pay from this account** (starts the supplier payment; only with the pay-from right).

*Account details card* (to give a payer). "Share these so someone can pay you. Pick where the payer is." A region switch: United States, Europe, United Kingdom, Middle East. The rows per region (labels): United States Routing number (ABA), Account number, Account type, Beneficiary; Europe IBAN, BIC, Beneficiary, Bank; United Kingdom Sort code, Account number, IBAN, Account name; Middle East IBAN, SWIFT / BIC, Beneficiary, Bank. A note per region ("US banks pay by ACH or Fedwire. They need the routing number and the account number."; "Euro payers use the IBAN and BIC. SEPA payments arrive the same or next business day."; "UK payers use the sort code and account number (Faster Payments, Bacs). Name is checked with Confirmation of Payee."; "UAE payers use the IBAN with the bank's SWIFT code. Local transfers run on the UAE instant payment platform."). Button **Copy details** (toast "Account details copied").

*Your access to this account* card: chips "✓ See balance", "✓ See transactions", "✓ Statements and export", "✓ Pay from this account" or "No: …"; note "Set by an administrator at {company}. The bank checks it on its side too."

*Transactions.* A filter card and the result list.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Period | chips: 7 days, 30 days, 90 days (default), This month, Dates | No | One of the list | none |
| From, To | text, placeholders `2026-08-01`, `2026-10-31` (only for Dates) | No | Format `yyyy-mm-dd`; To not before From; at most 24 months (731 days) | "Use the format 2026-10-31. (BAD_DATE)" / "The end date is before the start date. (INVALID_RANGE)" / "Search up to 24 months at a time. (RANGE_TOO_LONG)" |
| Smallest amount, Largest amount | text, decimal keypad, placeholders "0.00" and "Any" | No | A number with up to 2 decimals; smallest not above largest; compared with the size of the amount | "Enter amounts as numbers, for example 1500 or 1500.50. (BAD_AMOUNT)" / "The smallest amount is higher than the largest. (AMOUNT_ORDER)" |
| Counterparty | text, "Name contains" | No | Contains, ignoring case | none |
| Reference | text, "Reference contains" | No | Contains, ignoring case | none |
| Type | select: All types, Receipt, Payment, Payroll, Fee, Interest, Transfer, Direct debit | No | One of the list | none |
| Status | select: Booked and pending, Booked only, Pending only | No | One of the list | none |
| Direction | chips: All, Money in, Money out | No | One of the list | none |

Results update as the person types. A summary line "n transactions · in x · out y" (or "· more than one currency"). The list (table on desktop, cards on phone) shows Date and bank id, Counterparty and reference (and the account when all accounts are shown), Type with a chip "Pending" when not booked, and the signed Amount (money in in green). 15 rows at a time, button **Show 15 more (n left)**, then "End of results". A bad filter replaces the list with the red message above. No match: **No transactions found** / "Nothing matches these filters. Widen the dates or clear a filter." with **Clear filters**. Buttons: **Clear filters**, **Quick CSV** (toast "CSV with n transactions downloaded (prototype)"), **Export…** (opens `business-statement` with the account and the dates of the current filter; hidden, with "Export isn't available to you on this account.", without the export right).

*Transaction detail.* A row opens a card: counterparty, the signed amount, Status (Booked, or "Pending, not yet booked"), Account, Type, Reference, Booking date, Bank reference; buttons **Copy reference** (toast) and **Query this transaction** (toast "Opens the transaction query journey (not in this prototype)"; a later journey).

*An account whose transactions the person cannot see* (Beta Payroll). The balance card and the access card show; the filter card is hidden and a card says **Transactions are hidden** / "You can see this account's balance, but not its transactions. Ask an administrator for access. (ACCOUNT_NOT_PERMITTED)".

**States.** Empty (no account): **No accounts yet** / "There are no accounts at {company} that you can see. Ask an administrator for access." Bank unavailable (sandbox "Demo: service unavailable" or Bank unavailable): **We couldn't load your accounts** / "We couldn't load your accounts. Nothing was changed. (SERVICE_UNAVAILABLE)" with **Try again**. A slow answer would show "This is taking longer than expected. Nothing was changed." (not simulated). Switching company changes every number on the screen.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ACCOUNT_NOT_PERMITTED` | "You can see this account's balance, but not its transactions. Ask an administrator for access." | Detail card | none (Back) |
| `SERVICE_UNAVAILABLE` | "We couldn't load your accounts. Nothing was changed." | Whole screen | Try again |
| `INVALID_RANGE` | "The end date is before the start date." | Filter | Edit the dates |
| `RANGE_TOO_LONG` | "Search up to 24 months at a time." | Filter | Edit the dates |
| `BAD_DATE` | "Use the format 2026-10-31." | Filter | Edit the dates |
| `BAD_AMOUNT` | "Enter amounts as numbers, for example 1500 or 1500.50." | Filter | Edit |
| `AMOUNT_ORDER` | "The smallest amount is higher than the largest." | Filter | Edit |
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | Detail | Back to accounts |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | Whole screen | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `JOURNEY_DISABLED` | README 1.6 wording | Whole screen | Back / Switch |

#### 5. Adapters

Existing: `corp.company.get` (company with `accounts`). The rest is (planned); the prototype generates its data in the browser. These fold in the earlier shell adapters.

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{userId}` | company, accounts, `me`, limits | `NOT_SUPPORTED` | Existing |
| `accounts` | `corp.accounts.list` | none | accounts keyed by id: `{id, name, maskedNumber, iban, currency, ledgerBalance, availableBalance, pendingIn, pendingOut, holds, rights: {balance, transactions, export, pay}}` | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `account` | `corp.accounts.get` | `{accountId}` | one account plus `holdsToday`, `signatories`, `details` per region | `ACCOUNT_NOT_FOUND`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `transactions` | `corp.transactions.list` | `{accountId?, from?, to?, direction?, minAmount?, maxAmount?, counterparty?, reference?, type?, status?, page?, pageSize: 15}` | `{rows keyed by id, total, page, pageSize, sumIn, sumOut, currency}`; row `{id, accountId, bookedAt, counterparty, reference, type, amount (signed), currency, status ("booked" or "pending")}` | `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_PERMITTED`, `INVALID_RANGE`, `RANGE_TOO_LONG`, `BAD_DATE`, `BAD_AMOUNT`, `AMOUNT_ORDER`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `forecast` | `corp.cashflow.forecast` | `{accountId?, weeks: 13}` | weekly closing balances and the lowest point | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `rates` | `bank.fx.rate` | `{from, to}` | indicative rate and time | `INVALID_AMOUNT` | Existing |

#### 6. Permissions, step-up and limits

`accounts.view` for the screen; per account the rights balance, transactions, export and pay-from, set by an administrator and checked by the bank as well (the sandbox answers `ACCOUNT_NOT_PERMITTED`). Step-up none (read-only). No limits. A change of company clears the filters and the selected account.

#### 7. Result and links out

No result screen. Links out: **Statement or report** and **Export…** (`business-statement`), **Pay from this account** (`supplier-payment`), a company row (context switch), **Query this transaction** (a later journey, not built), the Statements and Reports shells of this tab.

#### 8. Acceptance criteria

- AC-1: The hero shows one consolidated USD figure, a tile per currency and the number of accounts, with other currencies marked as indicative with the rate.
- AC-2: The table shows available, ledger and pending separately for every account the person may see, and available equals ledger minus pending out, holds and the fixed hold.
- AC-3: An account's detail shows its balances, the details for a payer in each of four regions, and the person's four rights.
- AC-4: Transactions filter by period, dates, amount range, counterparty, reference, type, status and direction, update as the person types, page by 15 and show totals.
- AC-5: Bad dates, an end before the start, more than 24 months and bad or reversed amounts are refused with the codes and messages in section 3 and the list is not replaced by wrong data.
- AC-6: An account whose transactions the person may not see shows its balance and a clear "Transactions are hidden" state, never a blank.
- AC-7: Export and Statement buttons appear only with the export right and pass the account and the dates to `business-statement`; Pay from appears only with the pay-from right.
- AC-8: Switching company changes every number; the companies card shows totals only for companies where the person may view accounts.
- AC-9: The forecast shows the lowest point and the same facts in text; it hides when `forecast` is off, and the companies card hides when `entities` is off.
- AC-10: An unavailable service shows the error state with Try again and changes nothing; a slow service shows the "taking longer" message; the journey off gives `JOURNEY_DISABLED`.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` at Alpha | none | Hero: USD 582,816.00, "2 accounts". Tiles USD 480,000.00 and EUR 95,200.00 "About $102,816.00 at 1.08". Operating: ledger 480,000.00, pending in 24,100.00, available lower than ledger by the holds (including 18,900.00 for `PAY-2040` and 1,250.00). |
| T-2 | AC-3 | `alex` at Alpha | none | Open Operating, region Europe: IBAN `DE89 3704 0044 0532 0120 010`, BIC `BWXDDEFFXXX`. Switch to United Kingdom: sort code 20-00-00. Access chips: all four ticked. Open Reserve: "No: Pay from this account", no pay button. |
| T-3 | AC-4 | `alex` at Alpha | none | Operating, 90 days: Money out only, Type Payment, Status Booked only, Counterparty `harbour`: the list narrows live and the summary shows totals. Smallest `5000`, Largest `20000`: only amounts in that range. 15 rows then **Show 15 more**. |
| T-4 | AC-5 | `alex` at Alpha | none | Dates `2026-10-31` to `2026-10-01`: INVALID_RANGE. `31/10/2026`: BAD_DATE. `2024-01-01` to `2026-11-03`: RANGE_TOO_LONG. Smallest `abc`: BAD_AMOUNT. Smallest `500`, Largest `100`: AMOUNT_ORDER. |
| T-5 | AC-6 | `alex` at Beta | none | Open Payroll ••3002: balance shown, "Transactions are hidden" with ACCOUNT_NOT_PERMITTED, no filter card, no export button. |
| T-6 | AC-7 | `alex` at Alpha | none | Operating, Dates `2026-10-01` to `2026-10-31`, **Export…**: `business-statement` opens at the check screen for Operating with 1 Oct to 31 Oct 2026. All accounts, **Export…**: opens with no account preset. |
| T-7 | AC-8 | `alex` at Alpha | none | In Your companies choose Beta Services Ltd (after the security check): hero USD 374,300.00, tiles one USD tile, accounts Operating and Payroll. |
| T-8 | AC-9 | `alex` at Alpha | `forecast` off, `entities` off | No forecast card and no companies card. With both on: the forecast text "Today USD 582,816.00, In 13 weeks USD 720,816.00, Lowest point Today". |
| T-9 | AC-10 | `alex` at Alpha | `unavailable: ["corp.accounts.list"]` (prototype: Demo: service unavailable) | Error state "We couldn't load your accounts"; **Try again** after the bank is back loads the data. |
| T-10 | AC-10 | `alex` at Alpha | `timeout: ["corp.accounts.list"]` | "This is taking longer than expected. Nothing was changed."; Try again. (The prototype does not simulate this; it runs against the bank adapter.) |
| T-11 | AC-4 | `alex` at Alpha | `empty: ["corp.transactions.list"]` | Operating: **No transactions found** with **Clear filters**. |
| T-12 | AC-10 | `alex` at Alpha | `business-accounts` off | The Accounts tab shows "Not available at your bank"; Overview balance is not a link. |

#### 10. Expected mutation-check survivors

- The generated transaction data (amounts, counterparties) survives: tests check counts and totals, not each value.
- The indicative rate and the "updated 09:00 UTC" text survive (display only).
- Region notes (ABA, IBAN, sort code) survive except the values listed in T-2.
- The `details` option survives because the screen does not read it yet (planned).
- `ACCOUNT_NOT_FOUND` survives in the prototype (no way to reach it).
- Forecast arithmetic survives except the start and end totals in T-8.

---
### ★ Business statement — `business-statement`

Catalog: `business-statement`, workspace business, category Accounts, core no (kept in the "Lean" preset), a bank can switch it off (yes). Options: `fmtPdf` "Offer PDF" (default on); `fmtCsv` "Offer CSV" (on); `fmtXlsx` "Offer Excel" (on); `fmtMt940` "Offer MT940 / MT942" (on); `fmtCamt` "Offer camt.053 / camt.052" (on); `fmtBai2` "Offer BAI2" (on); `intraday` "Allow intraday reports" (on); `schedule` "Allow scheduled delivery" (on); `email` "Allow delivery by email" (on); `sftp` "Allow secure file transfer (sFTP / host-to-host)" (on); `external` "Allow email to addresses outside the company" (default off).

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `business-statement` |
| Purpose | Download now, or schedule, a statement or report for one, several or all accounts the person may export, as end of day (booked) or intraday (today so far), in PDF, CSV, Excel, MT940/MT942, camt.053/camt.052 or BAI2, delivered as a download, by email (optionally a secure link) or by secure file transfer (optionally PGP encrypted). |
| Release / workspace | 1 / Business |
| Status | Built in the prototype (`design/bankworkx-r1/src/journeys/46-business-statement.js`, research `research/business-statement.md`). Replaces the earlier spec ("Business statement and report download", three formats, four report types). The old heading and slug are unchanged. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures; reads the generated transactions of `business-accounts`. |
| Who may use it | Business permission `accounts.view` for the journey in the prototype; each account also needs the export right (README 4.2: `biz.accounts.export`). Alex has export rights on Alpha Operating and Reserve and on Beta Operating, but not on Beta Payroll. |
| Launch parameters | `{accountId}` ("" for all accounts), `{from, to}` (dates `yyyy-mm-dd`) and `{reportType: "sched"}`. When `accountId`, `from` and `to` are all given the journey opens directly on the check screen (the form is filled; the button **Change options** goes back). |
| Shared reference | `business-accounts` for the data and the export right; the Statements and Reports shells below this block. |

**Formats.** Each card says what it is and who uses it.

| Format | Name | Intraday name | File type | Description shown | Used by | Largest request |
|---|---|---|---|---|---|---|
| PDF | PDF | PDF | `pdf` | Readable and printable. For audits, loan applications and proof of balance. | Owners, auditors, lenders | 2,000 rows |
| CSV | CSV | CSV | `csv` | Plain rows for Excel or accounting software. Quick reconciliation. | Bookkeepers | 100,000 |
| Excel | Excel | Excel | `xlsx` | A workbook with a summary sheet and filters. Easy to share with finance. | Finance teams | 10,000 |
| MT940 | MT940 | MT942 | `sta` | SWIFT text file that treasury and ERP systems read. MT940 is end of day, MT942 is intraday. | Treasury, SAP, banks using SWIFT | 100,000 |
| camt | camt.053 | camt.052 | `xml` | ISO 20022 XML with full names and structured references. camt.053 is end of day, camt.052 is intraday. The standard in Europe. | Treasury and ERP in Europe and the UK | 100,000 |
| BAI2 | BAI2 | BAI2 | `bai` | US cash-management standard with balances and type codes. Prior day or intraday. | US treasury and ERP | 100,000 |

The row estimate for "too large" is (days in the period + 1) times the number of accounts times 9.

**Sandbox demo values.** Today is Tue 3 Nov 2026, 10:42 UTC. Periods for end of day: Yesterday (Mon 2 Nov), This month so far (1 to 3 Nov), Last month (1 to 31 Oct 2026, the default), Last 3 months (4 Aug to 3 Nov), Last 12 months (4 Nov 2025 to 3 Nov 2026), Choose dates (up to 24 months). The sandbox holds 64 generated transactions per company over the last 95 days (see `business-accounts`), so a period before 31 Jul 2026 is empty. File names look like `BWX_2001_20261001_20261031.pdf` (last four digits of the account, or `ALL`, then the dates; camt files `…20261031.053.xml` or `.052.xml`). A one-off file stays available 7 days under Accounts › Statements. Two schedules already exist at Alpha: "Daily MT940 to ERP" (every business day, 06:00 UTC, secure file transfer to `erp-gateway`) and "Weekly PDF to finance" (Mondays 07:00 UTC, email to `finance@alpha-trading.example`); the maximum is 10. Company email domains: `alpha-trading.example` at Alpha, `beta-services.example` at Beta (your default recipient is `alex.morgan@alpha-trading.example`). Secure file transfer destinations: "ERP gateway · sftp.erp.alpha-trading.example · /inbound/bank", "Treasury system · host-to-host · TMS-PROD", and "Not registered yet" (always refused). To see `EXPORT_TOO_LARGE`: PDF for Last 12 months (about 3,285 rows for one account); to see it for Excel: All accounts for 24 months (about 13,176 rows).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › detail › Statement or report | `{accountId}` | `accounts.view` and export right on the account |
| Accounts › transactions › Export… | `{accountId?, from, to}` | `accounts.view` and export right |
| Accounts › statements › New | none | `accounts.view` |
| Command bar › Statement | none | `accounts.view` |
| Result of a one-off file › Schedule this | `{accountId, reportType: "sched"}` | `accounts.view` |
| Accounts › reports › a report card (Reports shell) | `{reportType}` (planned values; the prototype handles only `sched`) | `accounts.view` |

With the journey off the entries disappear; a forced open gives `JOURNEY_DISABLED`; in the Personal workspace `WRONG_CONTEXT`.

#### 3. Screens

Step ids: `what`, `fmt`, `del`, `rev`. With a full prefill (account and both dates) only `rev` shows, with the button **Change options** (secondary) that unhides the other three. The progress bar counts the visible steps.

**`what`: "Statements and reports"**. Intro: "Choose the accounts and the time you need."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Type | chips: End of day (booked); Intraday (today so far) (only when `intraday` is on) | Yes (default End of day) | One of the list | Hint: end of day "End of day shows booked transactions. It is the official record."; intraday "Intraday shows today up to now. Items may still change, so it is not an official statement." |
| Accounts | chips: One account; Choose several; All accounts | Yes (default One account) | One of the list | none |
| Account | select of the accounts the person may export, "{name} ••{last four} · {currency}" (an account without export is not listed) | Yes (one account) | The account has the export right | "You can't export one of these accounts. Ask an administrator. (ACCOUNT_NOT_PERMITTED)" |
| Several accounts | one check per account, disabled with "(no export access)" when not allowed | Yes (several) | At least one ticked and exportable | "Choose at least one account you can export. (ACCOUNT_NOT_PERMITTED)" |
| Period | chips: Yesterday; This month so far; Last month; Last 3 months; Last 12 months; Choose dates (end of day, download now only) | Yes (default Last month) | One of the list | none |
| From, To | date select from today back about two years, "Start date", "End date" (only for Choose dates) | Yes then | To not before From; at most 731 days | "The end date is before the start date. (INVALID_RANGE)" / "Statements and reports cover up to 24 months at a time. (PERIOD_TOO_LONG)" |

Info for several or all: "n account(s) selected. Accounts you can't export are left out. Each currency gets its own statement, with its own balance." Button **Continue**.

**`fmt`: "Format"**. Intro: "Pick the file that suits whoever will use it."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| File format | cards for the six formats (name, description, "Used by: …"); a format the bank switched off is greyed with the chip "Not enabled at your bank"; intraday renames MT940 to MT942 and camt.053 to camt.052 | Yes (default the first enabled) | An enabled format | "Your bank hasn't switched that format on. (FORMAT_NOT_ENABLED)" |
| Add a summary page with opening and closing balances | check (PDF and Excel) | No (default on) | none | none |
| Show the running balance after each line | check (PDF, CSV, Excel) | No (default on) | none | none |
| Include counterparty details and references | check (CSV, Excel, PDF) | No (default on) | none | none |
| Include pending items | toggle, sub "Pending items are not booked yet and can still change." (end of day, PDF, CSV, Excel) | No (default off) | none | none |

A note below changes with the format: for MT940 and camt "End-of-day files are booked only, so pending items are not included." or "Intraday files are MT942. They are interim and replaced by the end-of-day file."; for BAI2 "BAI2 carries balances and bank type codes. Your bank maps its transaction codes to BAI2 codes."; for CSV "CSV does not combine currencies: you get one section per account."; otherwise "Amounts are in each account's own currency." Button **Continue**.

**`del`: "Delivery"**. Intro: "Get it once, or have it sent to you on a schedule."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| When | chips: Download now; Schedule it (when `schedule` is on) | Yes | One of the list | none |
| Schedule name | text, max 40, placeholder "For example: Daily MT940 to ERP" (schedule only) | Yes then | 3 to 40 characters | "Use at least 3 characters." |
| How often | chips: Every business day; Weekly; Monthly (end of day), or Every hour (intraday) | Yes then | One of the list | none |
| Day of the week | select: Monday, Tuesday, Friday (weekly) | Yes then | One of the list | none |
| Day of the month | select: 1st, 5th, Last business day (monthly) | Yes then | One of the list | none |
| Send at (UTC) | select: 05:00, 06:00, 07:00, 08:00, 12:00, 18:00 (not hourly) | Yes then | One of the list | none |
| Send by | chips: Email (`email` on); Secure file transfer (`sftp` on) | Yes then | One of the list | none |
| Send to | text area, max 200, placeholder "name@company.example, name2@company.example", hint "Up to 5 addresses, separated by commas." (email) | Yes then | 1 to 5 valid addresses; at the company domain unless `external` is on | "Check the email addresses. Use up to 5, separated by commas. (INVALID_RECIPIENT)" / "Your bank only allows delivery to addresses at your company. (EXTERNAL_RECIPIENT_BLOCKED)" |
| Send a secure link instead of attaching the file | check (email) | No (default on) | none | none |
| Destination | select (secure file transfer): ERP gateway; Treasury system; Not registered yet | Yes then | A registered destination | "That file-transfer destination isn't set up. An administrator must register it first. (DELIVERY_NOT_SET_UP)" |
| Encrypt the file with the bank's key (PGP) | check (secure file transfer) | No (default on) | none | none |
| If there is no activity | chips: Send an empty file; Skip it | Yes (default Send) | One of the list | none |

Info for a schedule: "Each file covers the time since the last one: the previous business day / the previous week / the previous calendar month / today so far. If an account has no activity you can choose to skip that file." Gate: "You already have 10 schedules, which is the maximum. Remove one first. (SCHEDULE_LIMIT)". Button **Continue**.

**`rev`: "Check and create"**. Preview card: for a one-off file in CSV, MT940, camt or BAI2 the first lines of the machine format (for example MT940 `:20:`, `:25:`, `:28C:`, `:60F:`, `:61:`, `:86:`, `:62F:`), otherwise a table of the first 5 rows (Date, Counterparty and reference, Type, Amount), with "Showing n of m rows. File name BWX_….". For a schedule: "The first file arrives {date}, {time} UTC." A **Your request** card: Type, Accounts, Period (or "Covers: Since the last file"), Format, Delivery ("Download", "Email to … (secure link)", "Secure file transfer, ERP gateway, encrypted"). Buttons **Create** (busy "Preparing your file…", 0.9 s) and **Change options**. Checks on Create for a one-off file, in this order: `PERIOD_TOO_LONG`, `ACCOUNT_NOT_PERMITTED`, `FORMAT_NOT_ENABLED`, `EXPORT_TOO_LARGE`, `NO_TRANSACTIONS` (end of day only). A schedule is not checked against data.

**Result.** One-off: **Your file is ready**, "It stays available for 7 days under Accounts › Statements.", chip "{format} · {n} KB"; rows File, Type ("End of day" or "Intraday, to 10:42 UTC"), Accounts, Period, Rows, Pending items ("Included" or "Not included"), Created by ("Alex Morgan, 3 Nov 2026 10:42 UTC"); buttons **Download {file name}** (toast "Downloaded … (prototype)") and **Schedule this**. Schedule: **Schedule created**, "Your {format} files will be sent by email / by secure file transfer. You can pause or delete it under Accounts › Statements.", chip "n of 10 schedules used"; rows Name, Accounts, Format, How often, First file, Sent to, If no activity; button **New statement or report**. First-file wording: every business day "Wed 4 Nov 2026, 06:00 UTC"; weekly "Mon 9 Nov 2026, 07:00 UTC" (Mon), "Fri 6 Nov", "Tue 10 Nov"; monthly "Tue 1 Dec 2026" (1st), "Sat 5 Dec 2026" (5th), "Mon 30 Nov 2026" (last business day); hourly "Today, every hour from 08:00 to 18:00 UTC". The audit log records "Created {format} for {accounts}, {from} to {to}" or "Created schedule “{name}” ({format} to email|secure file transfer)".

**Other states.** Sandbox "Backend will time out on submit" and "Bank unavailable" do not stop this journey in the prototype (it is not marked money-moving, and the create step uses the file builder only). Product behaviour: a timeout shows "This is taking longer than expected. Nothing was changed." and creates nothing; an unavailable bank shows "This service is not available right now. Nothing was changed. Please try again in a few minutes."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `PERIOD_TOO_LONG` | "Statements and reports cover up to 24 months at a time." | `what`, `rev` | Edit the dates |
| `INVALID_RANGE` | "The end date is before the start date." | `what` | Edit the dates |
| `NO_TRANSACTIONS` | "There are no transactions on these accounts in that period. Choose another period or account." | `rev` | Change options |
| `EXPORT_TOO_LARGE` | "This is too large for the format you chose. Shorten the period, pick fewer accounts, or choose CSV or a bank file format." | `rev` | Change options |
| `ACCOUNT_NOT_PERMITTED` | "You can't export one of these accounts. Ask an administrator." | `what`, `rev` | Change accounts |
| `FORMAT_NOT_ENABLED` | "Your bank hasn't switched that format on." | `fmt`, `rev` | Choose a format |
| `INVALID_RECIPIENT` | "Check the email addresses. Use up to 5, separated by commas." | `del` | Edit |
| `EXTERNAL_RECIPIENT_BLOCKED` | "Your bank only allows delivery to addresses at your company." | `del` | Edit |
| `SCHEDULE_LIMIT` | "You already have 10 schedules, which is the maximum. Remove one first." | `del` | Back to schedules |
| `DELIVERY_NOT_SET_UP` | "That file-transfer destination isn't set up. An administrator must register it first." | `del` | Choose another destination |
| `EXPORT_LIMIT_REACHED` | "You have made the most files allowed today (20). Try again tomorrow." (planned, sandbox limit of 20 one-off files per person per day) | `rev` | Back |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | Banner | Try again |
| `SERVICE_UNAVAILABLE` | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | Banner | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `JOURNEY_DISABLED` | README 1.6 wording | Whole journey | Back / Switch |

#### 5. Adapters

All of these are (planned); the prototype builds the file text in the browser from the generated transactions. They fold in the earlier `corp.statements.generate` and `corp.transactions.list` entries.

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `corp.accounts.list` | none | accounts with `rights.export` | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `count` | `corp.transactions.list` | `{accountId?, from, to, includePending, pageSize: 1}` | `{total, currency}` | `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_PERMITTED`, `INVALID_RANGE`, `PERIOD_TOO_LONG`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `generate` | `corp.statements.generate` | `{kind: "eod"\|"intraday", accountIds[], from, to, format: "pdf"\|"csv"\|"xlsx"\|"mt940"\|"camt"\|"bai2", includePending, summaryPage, runningBalance, counterparty}` | `{id, fileName, rows, sizeKb, createdAt, expiresAt, downloadRef}` | `ACCOUNT_NOT_PERMITTED`, `INVALID_RANGE`, `PERIOD_TOO_LONG`, `NO_TRANSACTIONS`, `EXPORT_TOO_LARGE`, `FORMAT_NOT_ENABLED`, `EXPORT_LIMIT_REACHED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). `moneyMoving: false`, no code |
| `scheduleCreate` | `corp.statements.schedule.create` | `{name, accountIds[], kind, format, frequency, dayOfWeek?, dayOfMonth?, timeUtc, via: "email"\|"sftp", recipients[]?, secureLink?, destinationId?, pgp?, onEmpty}` | `{scheduleId, nextRunAt, usedOf: "n of 10"}` | `SCHEDULE_LIMIT`, `INVALID_RECIPIENT`, `EXTERNAL_RECIPIENT_BLOCKED`, `DELIVERY_NOT_SET_UP`, `FORMAT_NOT_ENABLED`, `PERMISSION_DENIED` | (planned) |
| `destinations` | `corp.delivery.destinations` | none | registered destinations | `PERMISSION_DENIED` | (planned) |
| `statements` | `corp.statements.list` | none | files made: `{id, kind, accounts, from, to, format, createdAt, createdBy, sizeKb, expiresAt}` | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned; backs the Statements shell) |

The generated file is deterministic in the sandbox, so a test can count rows. Machine formats follow the layouts in the sample snippets: MT940 tags `:20:` to `:62F:`, camt `Stmt` or `Rpt` with `Ntry`, BAI2 records `01`, `02`, `03`, `16`; ISO 20022 and BAI2 mapping of the bank's transaction codes is a bank setting (research note).

#### 6. Permissions, step-up and limits

`accounts.view` plus the export right on each account (README 4.2: `biz.accounts.export`), checked at the launch point, in the journey (accounts without export are not offered) and in the sandbox (`ACCOUNT_NOT_PERMITTED`). Step-up none (read-only). Limits: 24 months per request; per-format size limits (table in section 1); 10 schedules per company; (planned) 20 one-off files per person per day. Email delivery outside the company is off unless `external` is on; a secure link is the default for email; secure file transfer files can be PGP encrypted.

#### 7. Result and links out

Receipt as in section 3 with the BankWorkx® reference. One-off files appear in Accounts › Statements for 7 days. Notifications (planned): "Your {format} file is ready"; a scheduled file arrives by the chosen channel; if a schedule's account right is removed the schedule pauses and the owner is told. Links out: **Download {file}**, **Schedule this**, **New statement or report**, back to `business-accounts`.

#### 8. Acceptance criteria

- AC-1: A statement can be made for one, several or all accounts the person may export; accounts without the export right are never offered or included.
- AC-2: End of day covers booked items only and is the default; intraday covers today so far, offers only intraday-capable naming (MT942, camt.052) and is available only when `intraday` is on.
- AC-3: Period options are Yesterday, This month so far, Last month, Last 3 months, Last 12 months or chosen dates; an end before the start and more than 24 months are refused.
- AC-4: The six formats are offered with who uses each; a format the bank switched off is shown as not enabled and cannot be chosen.
- AC-5: A one-off file is refused when the request is too large for the format (`EXPORT_TOO_LARGE`) or has no transactions (`NO_TRANSACTIONS`); otherwise it is created with a file name that carries the account and dates and a row count.
- AC-6: A schedule needs a name of 3 to 40 characters, a frequency, a time, a delivery method and a destination; email recipients are 1 to 5 valid addresses at the company unless `external` is on; secure file transfer needs a registered destination.
- AC-7: At most 10 schedules exist; the 11th is refused.
- AC-8: Opened with an account and dates (from the accounts screen), the journey starts at the check screen with the form filled and a way to change options.
- AC-9: Intraday schedules can only be hourly; the first file date and time are shown before creating.
- AC-10: Timeout and unavailable states create nothing and say so; the journey off gives `JOURNEY_DISABLED`; the Personal workspace gives `WRONG_CONTEXT`.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3, AC-5 | `alex` at Alpha | none | Accounts › Operating › Statement or report. One account Operating, Last month, PDF, Download now. Check: first rows table; Create: "Your file is ready", file `BWX_2001_20261001_20261031.pdf`, rows greater than 0, "Pending items Not included". |
| T-2 | AC-1 | `alex` at Beta | none | Choose several: Payroll ••3002 is disabled "(no export access)"; All accounts includes Operating only. |
| T-3 | AC-2, AC-4 | `alex` at Alpha | none | Intraday: MT940 card is renamed MT942, camt.053 camt.052; period chips disappear; preview shows `:20:` lines; result type "Intraday, to 10:42 UTC". |
| T-4 | AC-3 | `alex` at Alpha | none | Choose dates `Oct 31 2026` to `Oct 1 2026`: INVALID_RANGE; a start two years and a month back: PERIOD_TOO_LONG. |
| T-5 | AC-4 | `alex` at Alpha | `fmtBai2` off | The BAI2 card shows "Not enabled at your bank" and cannot be selected; FORMAT_NOT_ENABLED if forced. |
| T-6 | AC-5 | `alex` at Alpha | none | PDF with Last 12 months: EXPORT_TOO_LARGE; switching to CSV succeeds. Choose dates 1 Jan 2026 to 31 Jan 2026: NO_TRANSACTIONS. All accounts, Excel, 24 months: EXPORT_TOO_LARGE. |
| T-7 | AC-6, AC-7 | `alex` at Alpha | none | Schedule it, name `Daily MT940`, Every business day, 06:00, Secure file transfer to ERP gateway, PGP on: "Schedule created", "3 of 10 schedules used" (two exist), first file "Wed 4 Nov 2026, 06:00 UTC". Destination "Not registered yet": DELIVERY_NOT_SET_UP. Name `ab`: "Use at least 3 characters." |
| T-8 | AC-6 | `alex` at Alpha | `external` off | Email to `x@gmail.example`: EXTERNAL_RECIPIENT_BLOCKED; six addresses: INVALID_RECIPIENT; `a@alpha-trading.example`: accepted; with `external` on the first is accepted. |
| T-9 | AC-7 | `alex`, setup: 8 more schedules | none | Creating another: SCHEDULE_LIMIT. |
| T-10 | AC-8 | `alex` at Alpha | none | From Accounts › Operating with dates 2026-10-01 to 2026-10-31, **Export…**: opens at the check screen with Operating, 1 Oct to 31 Oct 2026; **Change options** opens the form. |
| T-11 | AC-9 | `alex` at Alpha | none | Intraday plus Schedule it: How often offers only Every hour; first file "Today, every hour from 08:00 to 18:00 UTC". |
| T-12 | AC-10 | `alex` at Alpha | `timeout: ["corp.statements.generate"]` | Create: "This is taking longer than expected. Nothing was changed."; no file. (Run against the bank adapter; the prototype does not simulate it.) |
| T-13 | AC-10 | `alex` at Alpha | `unavailable: ["corp.statements.generate"]` | Create: "This service is not available right now. Nothing was changed." |
| T-14 | AC-10 | `alex` at Alpha | `business-statement` off | The statement buttons on the Accounts screen are hidden; forced open: JOURNEY_DISABLED. |

#### 10. Expected mutation-check survivors

- The text of the machine-format snippets (tags, element names) survives: tests count rows and check the file name.
- The per-format size limits other than PDF and Excel survive (no request reaches 100,000 rows in the sandbox).
- The 7-day expiry survives (display only).
- The weekly and monthly "first file" dates survive except the cases in T-7.
- The 20-files-a-day limit survives (planned).
- The `external` domain rule survives except the cases in T-8.
- The reports of the earlier spec (daily balance, payments, cash flow) are not in the prototype and have no tests (planned).

---
## Business: Payments

This group is the **Payments** tab of Business "Graphite" (README 3.3). It has seven shell screens and five journeys. The tab is for people who can see payments. Launch points on it show only to the roles in README section 4.2.

Used throughout (sandbox facts, all grounded in `packages/mock-bank-api/src/corporate.ts` and `docs/CORPORATE.md`):

- A company payment is **started** by a Maker and **approved** by someone else. Starting moves no money. The last approval releases it. Nobody approves what they started (`SELF_APPROVAL`).
- Payment states in the sandbox: `pending_approval`, `released`, `rejected`. A withdrawn payment is stored as `rejected` with the reason "Withdrawn by the person who started it". The screens show four words: **Pending approval**, **Released**, **Rejected**, **Withdrawn**. (planned: **Scheduled** for a payment that has not started yet.)
- Cut-off is 16:00 UTC. Before it, on a working day, the value date is today. After it, on a weekend or on a closed day (9 Nov 2026), the value date is the next working day and `afterCutoff` is true. At exactly 16:00 it is still today.
- Alpha Trading LLC seed for these specs (README 1.7, planned): company currency USD; Alex Morgan is Maker with a daily limit of 250,000.00 USD; the company daily limit is 1,000,000.00 USD; a payment **above 50,000.00 USD** needs two different approvers (`dana`, `lee`); accounts Operating ••2001 (USD 250,000.00) and Reserve ••6101 (EUR 40,000.00). Whitelisted suppliers, one per region (`supplier-payment`, `add-supplier`, `schedule-business-payment`, region rules in `09-payment-rails.md`): Harbour Packaging (US, `sup_harbour`), Nordic Supplies AB (Europe, `sup_nordic`), Whitby Logistics (UK, `sup_whitby`), Gulf Trade FZE (UAE, `sup_gulf`); Beta has Nimbus Logistics (US) and Rhine Freight GmbH (Europe). The older domestic suppliers Nile Packaging Co. ••3301 and Delta Logistics ••7782 (US, USD) stay for the template and bulk journeys, and Rhine Components GmbH (Germany, EUR) and Orchid Textiles Ltd (United Kingdom, GBP) are the same as Nordic Supplies AB and Whitby Logistics in kind. Cedar Tools is added but **waiting for whitelisting**, so it cannot be paid yet.
- The acting person today is a `userId` the journey asks for on a sandbox "who am I" screen (`corp.users.list`). After step 2 (identity) the acting person comes from the **active context** and the "who" screen is removed from the Business versions. Each journey below says what that changes.

New adapters in this group follow the corporate style: `corp.<domain>.<verb>`. All of them are **(planned)** and read the acting user and company from the active context.

### Shell: Payments hub

| | |
|---|---|
| **Purpose** | One place to start a payment, see what needs attention and jump to the lists. |
| **Route** | Web `/business/{company}/payments`. Mobile screen `BusinessPaymentsHub` (Payments tab, first screen). |
| **Data source** | View-model `bizPaymentsHub` (planned, `packages/bank-client`). Built from `corp.company.get` (existing: accounts, `me.remainingToday`, `dualApprovalAbove`, `cutoff`) and `corp.payments.list` (planned, below). |
| **Permission** | `biz.accounts.view` to see the screen. Each action card shows only with its own permission (below). |

**Widgets, top to bottom**

1. **Cut-off banner.** Text: "Cut-off today is 16:00 UTC. {n} h {m} min left." After the cut-off or on a closed day: "The bank is closed for today's payments. New payments go out on {next working day, e.g. 4 Nov 2026}." Button "Pay now" (before the cut-off only) opens `supplier-payment`.
2. **Action cards** (2 by 3 on web, a vertical list on phones):

| Card | Opens | Shows when the context holds |
|---|---|---|
| Pay a supplier | `supplier-payment` | `biz.payments.initiate` |
| Upload a file | `bulk-payment` | `biz.payments.bulk` |
| Run payroll | `payroll-run` | `biz.payroll.run` |
| Schedule a payment | `schedule-business-payment` | `biz.payments.schedule` |
| Use a template | Templates (shell) | `biz.templates.manage` |
| Add a supplier | `add-supplier` | `biz.suppliers.manage` |

   A person without the permission does not see the card (check 1). If a deep link opens the journey anyway, check 2 and check 3 apply (`PERMISSION_DENIED`).
3. **Your limit today** (Makers only): "You can send {remainingToday} more today. Daily limit {dailyLimit}." A progress bar of `usedToday / dailyLimit`.
4. **Needs your attention** (a short list, up to 5): your payments waiting for approval (with "Withdraw"), payments rejected in the last 7 days, and schedule runs that failed.
5. **Recent payments**: the last 5 rows of the tracker, with a "See all payments" link.

**States.** Loading: skeleton for the banner and cards. Empty "Needs your attention": "Nothing needs your attention." Error: "We couldn't load your payments. Nothing was changed." with a "Try again" button. `unavailable` condition shows the same error text with SERVICE_UNAVAILABLE wording (README 1.6). **Drill-downs**: a row opens Payment detail; "See all payments" opens the Payment tracker. **Launch points on it**: README 5.3 rows "Payments › hub" (Pay a supplier, Upload a file, Run payroll, Schedule).

### Shell: Payment tracker (list)

| | |
|---|---|
| **Purpose** | Find any payment the company started and see where it is. |
| **Route** | Web `/business/{company}/payments/tracker` (list on the left, detail on the right on wide screens). Mobile `PaymentTracker`. |
| **Data source** | `corp.payments.list` (planned). Request `{ status?, from?, to?, kind?, startedBy?, q?, sort?, page? }`. Response `{ items: Payment[], total, page, pageSize: 25 }`. `Payment` is the existing payment plus `payee`, `kind` (planned: `single`, `international`, `bulk`, `payroll`, `scheduled`), `displayStatus` and `valueDate`. Error codes: `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: false`. Permission `biz.accounts.view`. |
| **Block** | `dataTable` (planned) with `statusChip` (planned). On phones the table becomes a list of cards. |

**Table columns** (in this order)

| Column | Content | Sortable |
|---|---|---|
| Reference | `id` such as `pay_1`; after release the release reference such as `CORP-20261103-0001` | yes |
| Payee | `payee` (supplier name, "3 payments" for a bulk file, "Payroll 2026-10 · 3 employees") | yes |
| Amount | amount and currency, right aligned | yes |
| Started by | user name | yes |
| Status | `statusChip` | yes |
| Approvals | "1 of 2" | no |
| Value date | `12 Nov 2026` | yes |
| Started | date and time (24 hour, UTC) | yes (default, newest first) |

**Status chips**

| Word | Colour and icon | Rule |
|---|---|---|
| Pending approval | amber, clock | `pending_approval`; the text "1 of 2 approved" is added when at least one approval exists |
| Released | green, check | `released` |
| Rejected | red, cross | `rejected` with a reason other than the withdraw reason |
| Withdrawn | grey, undo | `rejected` and `rejectReason` is "Withdrawn by the person who started it" |
| Scheduled (planned) | blue, calendar | a schedule run that has not started |

**Filters.** Status (chips: All, Pending approval, Released, Rejected, Withdrawn), Date range (`datePicker`, planned; started date), Type (Single, International, Bulk, Payroll), Started by (a person), Search (reference, payee or reference text). The filter bar shows the active filters as removable chips and "Clear all".
**Sort order.** Started, newest first; a click on a column header sorts by it. A Maker sees every payment of the company, but "Mine" is a one-tap toggle that filters on `startedBy = me`.
**States.** Loading: 8 skeleton rows. Empty with no filters: "No payments yet. When you start one, you can follow it here." Button "Pay a supplier" (only with `biz.payments.initiate`). Empty after a filter: "No payments match. Clear the filters to see all." Error: "We couldn't load your payments. Nothing was changed." Button "Try again".
**Drill-downs.** A row opens Payment detail. A row's overflow menu holds: Withdraw (when pending and mine), Save as template, Repeat, Repair rejected lines (bulk with rejected lines).
**Launch points on it.** README 5.3: "Payments › tracker › payment" Withdraw, Save as template, Repeat; "Payments › tracker › bulk payment" Repair rejected lines.

### Shell: Payment detail (with status timeline)

| | |
|---|---|
| **Purpose** | Everything about one payment: what, who, when, and what happens next. |
| **Route** | Web `/business/{company}/payments/tracker/{paymentId}`. Mobile `PaymentDetail`. Deep link `bankworkx://business/{company}/payments/{paymentId}`. |
| **Data source** | `corp.payments.get` (existing). Request `{ paymentId }` and today also `{ userId }`. Response the payment with `payee`. Error codes today: `PAYMENT_NOT_FOUND` ("No payment {id}"). Upgrade: needs an access check (README 2.3): the payment must belong to the active company, else `PERMISSION_DENIED`. |

**Widgets**

1. **Header.** Payee, amount, `statusChip`. Under it: "Payment {id}" and, when released, "Reference {releaseReference}".
2. **Details list.** From (account name and mask), To (payee), Amount, Reference, Type, Value date (with "Goes out on {date} because it was started after the cut-off" when `afterCutoff`), Started by, Started at.
3. **Approvals.** "1 of 2 approvals". One row per approval (name, time). One row per missing approval: "Waiting for another approver". An approver other than the Maker is named only after approving.
4. **Status timeline** (`timeline` block, planned). Events, oldest first. The icon and wording per event:

| Event | Timeline text | Time field |
|---|---|---|
| Started | "{name} started this payment" | `initiatedAt` |
| Approved | "{name} approved" (one event per approval) | `approvals[].at` |
| Released | "Released. Reference {releaseReference}" | `releasedAt` |
| Rejected | "{name} rejected it. Reason: {reason}" (or "No reason given") | `rejectedAt` |
| Withdrawn | "{name} withdrew it" | `rejectedAt` |
| Next step (a dashed future row) | Pending: "Waiting for {n} more approver(s). Value date {date}." | none |

5. **Lines** (bulk and payroll only): a table of `lines` (n, payee, amount, reference).
6. **Buttons**, each with its permission and rule:

| Button | Shows when | Opens |
|---|---|---|
| Withdraw | `pending_approval`, started by me, `biz.payments.withdraw` | `withdraw-payment` with `{paymentId}` |
| Save as template | single or international payment, `biz.templates.manage` | `payment-template` with `{paymentId}` |
| Repeat | `biz.payments.initiate`, single or international | `supplier-payment` with `{paymentId}` |
| Repair rejected lines | bulk payment with rejected lines, `biz.payments.bulk` | `repair-bulk-lines` with `{paymentId}` |
| View receipt | released | receipt (planned engine feature `receipts`; print on web, share sheet on mobile) |
| Go to approvals | the person also holds `biz.approvals.approve` and is not the Maker | `approve-payments` with `{paymentId}` |

**States.** Loading: skeleton header and three timeline rows. Not found: "We can't find that payment." with a "Back to payments" button. Error and timeout: "We couldn't load this payment. Nothing was changed." Button "Try again".

### Shell: Templates

| | |
|---|---|
| **Purpose** | Saved payment details a Maker can reuse. |
| **Route** | Web `/business/{company}/payments/templates`. Mobile `PaymentTemplates`. |
| **Data source** | `corp.templates.list` (planned). Request `{}`. Response `{ items: Template[] }`; a `Template` is `{ id, name, kind, fromAccountId, beneficiaryId, amount?, currency, reference, purpose?, createdBy, createdAt, supplierStatus }`. Error codes `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: false`. Permission `biz.templates.manage`. |

**Columns**: Name, Supplier, Type, Amount ("Variable" when no amount is saved), Reference, Last used, Created by. **Filters**: Type, Search by name. **Sort**: Name, A to Z (default); Last used. **Row buttons**: Use (opens `supplier-payment` with `{templateId}`), Schedule (opens `schedule-business-payment` with `{templateId}`), Edit and Delete (open `payment-template` with `{templateId}`). A template whose supplier is no longer approved shows a red chip "Supplier not approved" and its Use button is disabled with the helper "Ask an approver to confirm this supplier first."
**Top button**: "New template" opens `payment-template`.
**States.** Empty: "No templates yet. Save one from a payment you make often." Button "New template". Loading: 6 skeleton rows. Error: "We couldn't load your templates. Nothing was changed." with "Try again".
**Launch points on it.** README 5.3 row "Payments › templates" (New, Use).

### Shell: Suppliers

| | |
|---|---|
| **Purpose** | The company's approved list of suppliers (the "whitelist"). Only these can be paid. |
| **Route** | Web `/business/{company}/payments/suppliers`. Mobile `PaymentSuppliers`. |
| **Data source** | Today: the `beneficiaries` map inside `corp.company.get` (existing, only approved suppliers). Upgrade: `corp.suppliers.list` (planned). Request `{ status? }`. Response `{ items: Supplier[] }`, `Supplier` is `{ id, name, kind, country, currency, bank, maskedNumber, status, addedBy, addedAt }` with `status` one of `approved`, `waiting_approval`, `disabled`. Error codes as the Templates list. `moneyMoving: false`, `requiresOtp: false`. Permission `biz.suppliers.manage` to edit; `biz.accounts.view` to read. |

**Columns**: Name, Type (Domestic or International), Country, Currency, Account (masked, "••3301"), Status chip (Approved green, Waiting for approval amber, Disabled grey), Added by, Added. **Filters**: Status chips, Type, Search. **Sort**: Name, A to Z. **Row buttons**: Pay (opens `supplier-payment` with `{supplierId}`; hidden unless approved), Edit (opens `add-supplier` with `{supplierId}`). **Top button**: "Add a supplier" (opens `add-supplier`).
**States.** Empty: "No suppliers yet. Add one before you can pay them." Button "Add a supplier". Loading: skeleton rows. Error: "We couldn't load your suppliers. Nothing was changed." Button "Try again".
**Launch points on it.** README 5.3 row "Payments › suppliers" (Add, Edit).

### Shell: Scheduled

| | |
|---|---|
| **Purpose** | Payments set to start on future dates, and the runs they have made. |
| **Route** | Web `/business/{company}/payments/scheduled`. Mobile `ScheduledPayments`. |
| **Data source** | `corp.schedules.list` (planned). Request `{ status? }`. Response `{ items: Schedule[] }`, `Schedule` is `{ id, templateId?, beneficiaryId, fromAccountId, amount, currency, frequency, nextRunDate, endsOn?, runsLeft?, status, lastRun? }`, `status` one of `active`, `stopped`, `ended`, `failed_last_run`. Error codes as above. `moneyMoving: false`, `requiresOtp: false`. Permission `biz.payments.schedule`. |

**Columns**: Supplier, Amount, Frequency ("Once", "Every week", "Every month"), Next run (`12 Nov 2026`), Ends ("Never", "After 6 runs", "On 31 Dec 2026"), Status chip, Last run (a link to the payment it started). **Sort**: Next run, soonest first. **Filters**: Status chips. **Row buttons**: Stop (a `dialog` block: "Stop this schedule? Payments already started are not affected." Buttons "Stop schedule" and "Keep it"; calls `corp.schedules.cancel` (planned): request `{ scheduleId }`, response the schedule with `status: stopped`, errors `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE`, `PERMISSION_DENIED`; `moneyMoving: false`, `requiresOtp: false`). **Top button**: "Schedule a payment" opens `schedule-business-payment`.
**States.** Empty: "Nothing is scheduled. Set up a payment that repeats and it appears here." Button "Schedule a payment". A `failed_last_run` row shows the red text "Last run failed: {message}. Nothing was paid." **Loading/error** as the other lists.
**Launch points on it.** README 5.3 row "Payments › hub › Schedule".

### Shell: Bulk and payroll history

| | |
|---|---|
| **Purpose** | Every bulk file and payroll run, with how many lines were paid and how many were left out. |
| **Route** | Web `/business/{company}/payments/files`. Mobile `BulkHistory`. |
| **Data source** | `corp.payments.list` (planned, above) with `kind` in (`bulk`, `payroll`). Each item carries `lines` (existing) and `leftOut` (planned: count of rejected lines from the check). Permission `biz.payments.bulk` or `biz.payroll.run`. |

**Columns**: Reference, Type (Bulk file or Payroll {period}), Lines paid, Lines left out, Total, Status chip, Started by, Started. **Filters**: Type, Status, Date range. **Sort**: Started, newest first. **Drill-down**: a row opens Payment detail (with the Lines table). A row with left-out lines shows "Repair lines" (opens `repair-bulk-lines`, `{paymentId}`). **Empty**: "No files yet. Upload a file to pay many suppliers at once." Button "Upload a file". **Loading/error**: as the tracker.
**Launch points on it.** README 5.3 rows "Payments › hub" (Upload a file, Run payroll) and "Payments › tracker › bulk payment".

---

### ★ Pay a supplier — `supplier-payment`

Catalog: `supplier-payment`, workspace business, category Payments, core no, a bank can switch it off (yes). Options: none in the prototype (it is the legacy region-aware wizard in `src/js/90-payflow.js`, declared in `src/journeys/05-legacy.js` with permission `pay.create`).

**As built in the prototype** (names to use in tests; the longer text below remains the target). Three steps with the progress text "Step n of 3 · Supplier payment": (1) "Who are you paying?" lists only whitelisted suppliers with the chip Whitelisted and a note that new suppliers are added by an administrator ("Request one"); button **Continue**. (2) "Amount and speed": **From** (the Operating account), **They receive ({currency})** (placeholder with symbol, above zero, within the rail maximum, within the balance and USD 250,000.00), a live summary (They receive, Rate "1 USD = x ... held for 60 s", Converted, Fee, **You pay**, Arrives), **How fast?** rail cards (name, speed, maximum, fee, Instant chip), **Purpose of payment** (always for a company; Family support, Goods or services, Salary, Rent, Education, Savings or investment, Other), **Who pays the bank charges?** (Shared, I pay all (+$15), They pay; abroad only), **Invoice or PO number** (required, max 80 US, 18 UK, 140 others), **When?** Now or Later with a date list (Wed 4 Nov, Thu 5 Nov, Tue 10 Nov, Tue 1 Dec) and **Repeat** (Doesn't repeat, Every week, Every month); button **Review**. (3) "Review payment" with rows From, To, Country, Sent by, Rate, Fee, You pay, Arrives, Purpose, Reference, Charges, Repeats, an Approval needed card (1 approver Dana Cruz or Lee Park, 2 above USD 50,000.00; extra security check from 25,000.00), and button **Submit for approval**. Below USD 25,000.00 no code is asked; from it the sheet "Authorise {amount} to {supplier}" / "This amount needs an extra security check. The code only works for this payment." Result "Pending approval" with chip "Waiting for n approver(s)"; buttons **Track payment**, **Back to Overview**. Differences from the text below: no separate `authorise`, `failed` or `unavailable` screens (the bank-down sheet is shared), no "Later" hand-over to `schedule-business-payment`, no consent tick, no quote expiry, no cooling-off and no add-supplier link. Limit messages use `RAIL_LIMIT`, `INSUFFICIENT_FUNDS` and `LIMIT_EXCEEDED` ("That's above your limit of USD 250,000.00.").

> Starting pattern: the existing `corporate-payment` journey (`packages/journey-schema/src/fixtures/corporate-payments.ts`, adapter `corp.payments.initiate`). This spec describes it **as built** first, then the upgrade for BankWorkx®. The upgrade is region-aware: it uses the rails, fields, charges, purpose rules, limits and error codes in `09-payment-rails.md` (called "09" below) instead of repeating them. The Business version also carries the M1 combined-demo path (below). The prototype is `design/bankworkx-r1/prototype.html` (the business branch of `payFlow`).

#### 1. Summary

| | |
|---|---|
| Slug | `supplier-payment` |
| Purpose | A Maker pays a whitelisted supplier in the United States, Europe, the United Kingdom or the Middle East (or in a SWIFT country, if the company has a supplier there). The payment waits for approval; no money leaves the account. |
| Release | 1 |
| Workspace | Business (planned field `workspace: "business"`) |
| Status | **Existing, upgraded.** Built today as `corporate-payment` ("Start a payment", `entryScreen: "who"`, 11 criteria, 12 scenarios, English only, app `meezan`, USD only, one rail). The new journey adds the region-aware flow of 09 section 1 (steps Payee, Amount and speed, Review, Authorise, Result), the permission model and the context. |
| Channels | web, mobile |
| Starting pattern | `corporate-payment` plus the quote of `bank.fx.quote` (`packages/mock-bank-api/src/fx.ts`) for the foreign-currency branches. |
| Who may use it | The context holds `biz.payments.initiate`. At Alpha Trading LLC: Alex Morgan (Maker). Not Approvers, not Admins without the permission. |

**The screens as built today** (`corporate-payment`)

| Screen id | Title | What it does |
|---|---|---|
| `who` | Sign in | "Sandbox: choose who you are. A real bank app already knows who signed in." A `select` (rows) bound to `session.userId`, label "I am", fed by `corp.users.list`. Button "Continue" runs `corp.company.get` and goes to `start`. If the user has no `initiator` role the `authorisation` rule sends them to `denied`. |
| `start` | Payment details | `accountPicker` (`pay.fromAccountId`, balances shown), `beneficiaryPicker` (`pay.beneficiaryId`), `amountInput` (label "Amount", helper "Your limit left today: {remainingToday}", max = remaining, message "That is above your daily limit"), `textInput` "Reference" (placeholder "Invoice number"). Button "Continue". |
| `review` | Review payment | `reviewSummary` (From, To, Amount, Reference, Approvers needed), `alert` info "Payments made after {cutoff} UTC, or on a day the bank is closed, go out on the next working day.", `consent` ("I confirm the payment details are correct", `mustBeTrue`, message "Tick the confirmation first"), button "Confirm and send OTP". |
| `otp` | Verify | `otp` block (6 digits, 3 attempts, resend after 60 s, hint "Enter the code sent to {maskedPhone}"), button "Verify and send for approval". Wrong code: toast "Incorrect code", stay; the third wrong code goes to `failed`. |
| `success` | Sent for approval | `result` success "Sent for approval", text "{amount} to {supplier} now waits for {n} approver(s). Nothing has left the account yet.", meta "Payment {id} · value date {valueDate}", info alert when `afterCutoff`, button "Done". |
| `failed` | Payment not sent | `result` error with `ctx.error.message`, caption "No money has left the account.", buttons "Try again" (to `start`) and "Close". |
| `unavailable` | Not available | `result` error "We can't open this right now", button "Try again" (to `who`), "Close". |
| `denied` | Not allowed | "You can't do this. Only an initiator can use this. You are signed in as {name}." Button "Close". |

**What the upgrade changes**

1. **No `who` screen.** The acting user is the active context's user. The journey no longer holds `session.userId`; the adapters read the user from the context. If a call sends a different `userId`, the sandbox answers `PERMISSION_DENIED` (README 2.3). The old version with `who` keeps working for the Meezan look.
2. **Region-aware.** The supplier decides the region, country, currency and rails (09 sections 2 and 3). The Maker types **what the supplier receives** in the supplier's currency (09 section 5). There is no "same country / abroad" switch and no separate rate screen: the conversion summary sits under the amount.
3. **Rail and speed.** The Maker picks a rail that fits (09 section 2), including instant rails and their "not available right now" state.
4. **Purpose and invoice or PO reference** are always required for a company (09 section 7).
5. **Limits are tested on the USD amount after conversion** (09 section 9). The number of approvers (1 or 2) and the extra check also use that USD-equivalent amount.
6. **Authorisation with dynamic linking** (09 section 9) replaces the old "one-time code for every payment" and the password `stepup` screen: a payment under USD 25,000.00 needs no code (the whitelist is the control); from 25,000.00 the Maker sees a prompt that names the amount and the supplier and enters a code that only works for that payment.
7. **Permission** `biz.payments.initiate` at all three checks; `denied` is reached by `PERMISSION_DENIED` too. New codes: `TIMEOUT`, `SERVICE_UNAVAILABLE`, `SESSION_EXPIRED`, `WRONG_CONTEXT` and the 09 section 12 codes.
8. **Links out**: Track payment, Save as template, "Add supplier" (an information sheet; the supplier is added and whitelisted by an administrator), "Repeat" from the tracker with `{paymentId}`.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Overview › + quick action: Pay a supplier | none | `biz.payments.initiate` |
| Overview › Cut-off timer › Pay now | none | `biz.payments.initiate` |
| Payments › hub › Pay a supplier | `{supplierId}` optional | `biz.payments.initiate` |
| Payments › suppliers › row › Pay | `{supplierId}` | `biz.payments.initiate` |
| Payments › templates › Use | `{templateId}` | `biz.templates.manage` and `biz.payments.initiate` |
| Payments › tracker › payment › Repeat | `{paymentId}` | `biz.payments.initiate` |
| ⌘K command bar "Pay a supplier", or deep link `bankworkx://business/alpha/j/supplier-payment?supplierId=sup_harbour` | `{supplierId}` optional | `biz.payments.initiate` |

When `{supplierId}` is passed the journey opens on `amount` with the supplier chosen. When `{templateId}` or `{paymentId}` is passed the journey fills supplier, account, rail, purpose, reference and (if saved) amount, and the person still goes through every screen. The `amountInput` is pre-filled and editable. If the saved rail no longer fits the amount or is not available, the default rail for the region is chosen and the screen says so.

#### 3. Screens

Screen ids: `payee`, `amount`, `review`, `authorise` (when needed), `success`, `failed`, `unavailable`, `denied`, `wrongContext`. Loading rule for every screen that calls an adapter: the button is disabled with a spinner; after 10 seconds the screen shows `unavailable` with the TIMEOUT text. A `stepper` block shows "Payee", "Amount and speed", "Review", "Authorise" (the last only when the extra check applies).

**Screen `payee` — "Who are you paying?"**

Blocks: `stepper`, `beneficiaryPicker` (rows, `allowAddNew: false`), `alert`, `button`. `onEnter`: `corp.company.get` (loads accounts, whitelisted suppliers, `me.remainingToday`, `dualApprovalAbove`, `cutoff`).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Supplier (`pay.beneficiaryId`) | `beneficiaryPicker` listing **saved, whitelisted suppliers only** | yes | must be on the whitelist | "Choose a whitelisted supplier." |

Each row shows: the supplier name, the region and country (for example "Europe · Germany"), the masked account (09 section 3: `ABA 021000021 · ••8841`, `DE89 •••• 3000`, `20-00-00 · ••9911`, `AE07 •••• 3456`, `BOTKJPJT · ••7890`), and the chip **Whitelisted** (green). A supplier whitelisted less than 24 hours ago also shows an amber chip "New: up to USD 500.00 in 24 hours" (the cooling-off rule, 09 section 10). A supplier waiting for whitelisting is listed greyed with "Waiting for whitelisting" and cannot be chosen. There is **no form to enter a new payee**: a company cannot add a payee here (09 section 4).

Copy: title "Who are you paying?". Info alert: "Payments need approval. Nothing leaves your account until it is approved." Link under the list: "Add supplier". It opens an information sheet: "New suppliers are added and whitelisted by a company administrator. Ask {administrator name}." Where the context also holds `biz.suppliers.manage` the sheet has a button "Add a supplier" (`navigate.toJourney: "add-supplier"`, `returnTo: "payee"`, planned engine feature). Button "Continue" (disabled until a supplier is chosen); "Cancel" (exit).
States. Loading: skeleton rows. Empty: "No whitelisted suppliers yet. Ask an administrator to add one." Error on load: `unavailable`.

**Screen `amount` — "Amount and speed"**

Blocks: `stepper`, `reviewSummary` (supplier chip), `accountPicker`, `amountInput`, `select` (rail cards), `select` (rows, purpose), `textInput`, `select` (chips, when), `datePicker` (planned), `select` (charges, SWIFT only), `alert`, `button`. `onEnter`: `corp.payments.quote` (planned), repeated while the person types (debounced 400 ms, so the summary updates on every keystroke without moving the cursor). The quote is held for 60 seconds from the moment the amount screen opens (09 section 5).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| From (`pay.fromAccountId`) | `accountPicker`, balances shown | yes | a USD account of the company (Operating ••2001). Paying from the Reserve (EUR) account is planned. | "Choose an account." |
| They receive (`pay.amount`) | `amountInput`; the currency is the supplier's (USD, EUR, GBP, AED, SAR, JOD, or a SWIFT currency); the prefix shows the symbol | yes | greater than 0; at most the currency's decimals (JPY none, JOD 3, others 2); the USD amount after conversion at most `me.remainingToday` | required: "Enter an amount."; decimals: "Enter an amount in {cur} with at most {n} decimal places."; zero: "Enter an amount above zero."; limit: "That is above your daily limit of USD 250,000.00. You have {remainingToday} left today." (`LIMIT_USER_EXCEEDED`) |
| Speed (`pay.rail`) | `select` cards, one per rail of the supplier's region (09 section 2), showing name, arrival, fee in USD | yes | the default is the first rail that fits the amount (09 section 2 "Default rail"). A rail the amount does not fit is dimmed and shows its limit. A rail that is down shows "Not available right now". | `RAIL_LIMIT`: "That's over the {rail} limit of {limit}. Choose another way to send it."; `RAIL_NOT_AVAILABLE`: "{rail} isn't available right now. Choose another way to send it." |
| Purpose (`pay.purpose`) | `select` rows: Goods or services, Rent, Salary, Education, Savings or investment, Family support, Other (09 section 7) | yes (always, for a company) | one of the list | "Choose a purpose for this payment." (`PURPOSE_REQUIRED`) |
| Invoice or PO number (`pay.reference`) | `textInput`, placeholder "Required" | yes | 1 up to the region's limit (US 80, Europe 140, UK 18, Middle East and SWIFT 140); the field refuses extra characters; allowed: letters, digits, space and `. , ' - / ( ) + : ?`; others are removed with the note "Some characters aren't allowed and were removed." | required: "Enter the invoice or PO number."; over the limit: the field stops accepting characters and shows "{n} of {max} characters" |
| Charges (`pay.charges`), SWIFT only | `select` chips: "Shared", "I pay all", "They pay" (09 section 6) | yes (SWIFT) | `SHA` default, `OUR`, `BEN` | "Choose who pays the charges." |
| When (`pay.when`) | `select` chips "Now", "Later", default "Now" | yes | — | — |
| Date (`pay.date`), when "Later" | `datePicker` (planned) | yes if "Later" | a business day for the supplier's region within the next 30 days (09 section 8); weekends and the region's closed days are disabled | "Choose a business day." |
| Repeat (`pay.repeat`), when "Later" | `select` rows: "Doesn't repeat", "Every week", "Every month" | yes if "Later" | one of three | "Choose how often." |

**Conversion summary** (shown under the amount only when the supplier's currency is not USD; for a USD supplier it shows only Fee, You pay and Arrives): They receive, Rate ("1 USD = 0.926 EUR"), Converted ("USD 12,203.02"), Fee (the rail's fee in USD, plus 15.00 for `OUR`), **You pay** (converted amount plus fee), Arrives (the rail's speed, or the date chosen), and a line "Rate held for {mm:ss}". Rounding is to the cent, half up, once, at the end (09 section 5). Under it: "Limit left today: USD {remaining}" in USD, and the approvers line "Needs {1 or 2} approver(s)" (USD-equivalent over 50,000.00 means 2).

Funds check: **You pay** must not exceed the balance of the chosen account (`INSUFFICIENT_FUNDS`, message names both numbers, see section 4).

Copy: title "Amount and speed". Instant rails say "Goes out straight away, any time." Same-day rails say "Cut-off for same-day delivery: {time} UTC." (the effective cut-off, see "Cut-off and value date" in section 6). Warning when the USD amount is 25,000.00 or more: "You'll be asked for an extra security check." Buttons: "Continue" (validates; enabled only when the amount, rail, purpose and reference are valid; goes to `review`); "Back" (to `payee`).
States. Loading: skeleton summary. Quote error: the field shows the message under the amount and Continue stays disabled. `TIMEOUT` on the quote: `unavailable`.
When "Later" is chosen the journey continues into `schedule-business-payment` at its `review` screen with the supplier, amount, rail, purpose, reference, date and repeat filled in (`navigate.toJourney: "schedule-business-payment"`, planned). That journey owns the rules for scheduled and repeating payments (09 section 8).

**Screen `review` — "Review payment"**

Blocks: `reviewSummary`, `alert`, `consent`, `button`. The screen reads the held quote. If more than 60 seconds have passed since the quote, the screen shows the amber alert "The exchange rate changed. Check the new amount." (`QUOTE_EXPIRED`) with the new figures and the button "Accept new rate"; the payment cannot be sent until it is accepted. A supplier in USD has no quote and cannot show this alert.
Rows: From ("Operating ••2001"), To (supplier name and masked account), Country, Sent by (rail name), They receive ("EUR 11,300.00"), Rate (if any), Fee, **You pay** ("USD 12,203.02"), Arrives, Goes out on (value date), Purpose, Invoice or PO number, Charges (SWIFT), and **Approvers needed** (below).
Approvers card: "1 approver: Dana Cruz or Lee Park." or "2 approvers: Dana Cruz and Lee Park." (names from the approver list of the context). If the USD amount is 25,000.00 or more it adds "You'll be asked for an extra security check."
Alerts: info "Payments made after the cut-off, or on a day the bank is closed, go out on the next working day." When the chosen rail has passed its cut-off or it is a closed day, the same screen shows the warning "Goes out on {valueDate}: after the {time} UTC cut-off." Instant rails show no cut-off warning.
Consent (`pay.consent`, `termsVersion: "corporate-v1"`): "I confirm the payment details are correct". Rule `mustBeTrue`. Message: "Tick the confirmation first."
Buttons: "Submit for approval" (validates; if the USD amount is below 25,000.00 creates the payment and goes to `success`; otherwise sends the code and goes to `authorise`); "Back" (to `amount`).

**Screen `authorise` — "Authorise this payment"**

Shown only when the USD amount is 25,000.00 or more (the extra security check, policy `stepUpAbove`, planned). Blocks: `text`, `otp`, `button`. The prompt names the payment (dynamic linking, 09 section 9): "Authorise EUR 55,600.00 to Nordic Supplies AB" and below it "This amount needs an extra security check. The code only works for this payment." The `otp` block has 6 digits, 3 attempts, resend after 30 s, hint "Enter the code sent to {maskedPhone}". Field `otp.code`: required, pattern `^[0-9]{6}$`, message "Enter the 6-digit code." Wrong code: toast "That code isn't right. {n} tries left." (`OTP_INVALID`). The third wrong code fails the payment (`STEP_UP_FAILED`): `failed` with "Too many wrong codes. Start again." If the amount, supplier or rail changes after the code was sent, the code is void (`STEP_UP_FAILED`): "The payment changed, so that code no longer works. Start again." Button "Verify and submit for approval"; "Send a new code" after 30 s; "Back".

**Screen `success` — "Pending approval"**

`result` success with the status chip **Pending approval**. Title "Pending approval". Text: "{They receive amount} to {supplier} is waiting for {n} approver(s): {names}. Nothing has left your account yet." Receipt-style rows: Sent by (rail), They receive, You pay, Arrives, Payment `{id}` and the BankWorkx® reference `BWX-nnnnnn` (the rail's own reference, 09 section 11, comes after release). Meta: "Payment {id} · value date {valueDate}". Info alert when `afterCutoff`: "It was started after the cut-off, so it goes out on {valueDate}."
Buttons: "Track payment" (opens Payment detail, `{paymentId}`); "Save as template" (`payment-template`, `{paymentId}`); "Pay another supplier" (restarts); "Done" (returns to where the person started). Notification raised: see section 7.

**Screens `failed`, `unavailable`, `denied`, `wrongContext`**: see section 4. All end with the sentence "No money has left your account." (except the TIMEOUT wording, section 4).

#### 4. Sandbox errors

Messages in the third column are the **upgraded** wording. "Today" is what the adapter message shows through `ctx.error.message` in the existing journey. Codes from 09 section 12 keep the wording given there.

| Code | Adapter message today | What the person sees | Screen | Button |
|---|---|---|---|---|
| `OTP_INVALID` | "Incorrect code" (carries `attempt`) | "That code isn't right. {n} tries left." | `authorise` | Try again |
| `STEP_UP_FAILED` | none today | After the third wrong code, or when the amount or supplier changed after the code was sent: "Too many wrong codes. Start again." / "The payment changed, so that code no longer works. Start again." No payment is created. | `failed` | Start again |
| `OTP_REQUIRED` | "OTP not verified" | "Confirm with your one-time code first." | `authorise` | Back to code |
| `ACCOUNT_NOT_FOUND` | "Account not found" | "We can't find that account. Choose another." | `failed` | Choose account (to `amount`) |
| `USER_NOT_FOUND` | "No user {id} at {company}" | "We can't find your user at {company}. Sign in again." | `failed` | Sign in |
| `NOT_AUTHORISED` | "{name} is not allowed to initiate payments" | "Only a Maker can start a payment. You are {role}. No money has left your account." | `denied` | Close |
| `PERMISSION_DENIED` (planned) | none today | "Your role doesn't allow this. Ask an administrator at Alpha Trading LLC." | `denied` | Back |
| `WRONG_CONTEXT` (planned) | none today | "This belongs to your Business banking. Switch to Business to continue." | `wrongContext` | Switch |
| `STEP_UP_REQUIRED` (planned) | none today | "For your security, confirm it's you first." Used by `bank.session.switch` when entering Business; for a payment the `authorise` screen already shows. | `authorise` | Confirm |
| `BENEFICIARY_NOT_WHITELISTED` | "This beneficiary is not on the company's approved list" | "This supplier isn't on Alpha Trading LLC's whitelist. Ask an administrator to whitelist them. No money has left your account." | `failed` | Choose supplier (to `payee`) |
| `BENEFICIARY_COOLING_OFF` (existing code in the personal sandbox; planned for `corp.*`) | none today | "This supplier was whitelisted less than 24 hours ago. You can send up to USD 500.00 to them in 24 hours. You have {remaining} left. No money has left your account." | `failed` | Change amount |
| `INVALID_AMOUNT` | "Enter an amount in {cur} with at most {n} decimal places" | "Enter an amount in {cur} with at most {n} decimal places." | `amount` | Change amount |
| `CURRENCY_NOT_SUPPORTED` | "Payments are limited in {cur}: choose a {cur} account" | "Payments are limited in USD. Choose a USD account. No money has left your account." Also used when the supplier's country does not use the currency sent. | `failed` | Choose account |
| `RAIL_NOT_AVAILABLE` (planned, 09) | none | "{rail} isn't available right now. Choose another way to send it." | `amount` | Choose another speed |
| `RAIL_LIMIT` (planned, 09) | none | "That's over the {rail} limit of {limit}. Choose another way to send it." | `amount` | Choose another speed |
| `PURPOSE_REQUIRED` (planned, 09) | none | "Choose a purpose for this payment." | `amount` | Choose purpose |
| `QUOTE_EXPIRED` (planned, 09) | none | "The exchange rate changed. Check the new amount." | `review` | Accept new rate |
| `QUOTE_NOT_FOUND` / `QUOTE_USED` (planned) | none | "This rate can't be used. Check the new amount." | `review` | Accept new rate |
| `INSUFFICIENT_FUNDS` | "Insufficient funds" | "There isn't enough money in Operating ••2001: you'd pay {youPay} and {balance} is available. No money has left your account." | `failed` | Change amount |
| `LIMIT_USER_EXCEEDED` | "This is above {name}'s daily limit" | "This is above your daily limit of {dailyLimit}. You have {remainingToday} left today. No money has left your account." Tested on the USD amount after conversion. | `failed` | Change amount |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit" | "This is above Alpha Trading LLC's daily limit. Try a smaller amount or wait until tomorrow. No money has left your account." | `failed` | Change amount |
| `PAYMENT_HELD` (planned, 09) | none | The payment is created with the status "Held for review": "We're checking this payment and will tell you within one working day. You don't need to do anything." (sandbox trigger: supplier name "Test Sanctions") | `success` (status chip "Held for review") | Track payment |
| `CORE_UNAVAILABLE` | "Core banking unavailable" | "We couldn't complete this right now. No money has left your account." | `failed` | Try again |
| `TIMEOUT` (planned) | none | "We didn't get an answer in time. Check Payments before you try again, so you don't pay twice. In the sandbox nothing was started." | `unavailable` | Check payments (opens the tracker) |
| `SERVICE_UNAVAILABLE` (planned) | none | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `unavailable` | Try again |
| `SESSION_EXPIRED` (planned) | none | "You were signed out for your security. Sign in again to continue. Nothing you were doing was saved." | `unavailable` | Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{ userId }` (today); `{}` after step 2 | company: `accounts`, `beneficiaries` (whitelisted suppliers; planned fields `region`, `country`, `currency`, `maskedNumber`, `rails`, `whitelistedAt`), `me` (`roles`, `dailyLimit`, `usedToday`, `remainingToday`), `dualApprovalAbove`, `cutoff`, `companyDailyLimit`, `companyUsedToday` | `NOT_SUPPORTED` ("Not available for this customer"), `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing |
| `quote` | `corp.payments.quote` (replaces the planned `corp.fx.quote`) | `{ fromAccountId, beneficiaryId, amount (in the supplier's currency), rail?, charges? }` | `{ quoteId, currency, receive, rate, usdAmount, fee, youPay, rails: [{ id, fits, available, fee, arrives, max }], defaultRail, approversNeeded, extraCheck, valueDate, afterCutoff, expiresAt, ttlSeconds: 60 }` | `ACCOUNT_NOT_FOUND`, `BENEFICIARY_NOT_WHITELISTED`, `BENEFICIARY_COOLING_OFF`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `RAIL_LIMIT`, `RAIL_NOT_AVAILABLE`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: false` | **(planned)** |
| `otpSend` | `bank.otp.send` | `{ channel: "sms" }` | `{ sent, maskedPhone, channel }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified: true }` | `OTP_INVALID` (with `attempt`) | Existing. The engine counts failures only for the id `otpVerify`. |
| `create` | `corp.payments.create` (the upgrade of `corp.payments.initiate`) | today `{ userId, fromAccountId, beneficiaryId, amount, reference }`. Upgrade: no `userId`; adds `{ quoteId, rail, purpose, reference, charges?, code? }`. A code is needed from USD 25,000.00. | the payment: `id`, `status: "pending_approval"` (or `held` after screening), `required` (1 or 2), `valueDate`, `afterCutoff`, `payee`, `amount` and `currency` (the supplier's), `usdAmount`, `youPay`, `rail`, `railReference` after release | `OTP_REQUIRED`, `STEP_UP_FAILED`, `NOT_AUTHORISED`, `USER_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `BENEFICIARY_NOT_WHITELISTED`, `BENEFICIARY_COOLING_OFF`, `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `QUOTE_EXPIRED`, `QUOTE_NOT_FOUND`, `QUOTE_USED`, `RAIL_NOT_AVAILABLE`, `RAIL_LIMIT`, `PURPOSE_REQUIRED`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `PAYMENT_HELD`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving`: **no** at this step (the debit happens at release); `requiresOtp`: from 25,000.00 USD. | Existing as `corp.payments.initiate` (`CorporateSandbox.initiatePayment`), extended; the name `corp.payments.create` is **planned** |
| `templates` | `corp.templates.list` | `{}` | `{ items }` | see Templates shell | **(planned)** |

Sandbox rule order inside the create call: role, account, whitelist, cooling-off, amount, currency, quote, rail availability, rail limit, purpose, funds, user limit, company limit, code. The journey must show the first refusal; scenarios depend on this order. The company limit is **checked** at start but **used** only at release, as the code does. The existing order (role, account, whitelist, amount, currency, funds, user limit, company limit) is a subset of it.

#### 6. Permissions, step-up and limits

- **Permission:** `biz.payments.initiate` (checks 1, 2 and 3). Launch points are hidden without it. `authorisation.role` is `initiator` today (read from `ctx.company.me.roles`); after step 2 it reads `session.permissions`.
- **Step-up level:** none for a payment under USD 25,000.00 (the supplier is already whitelisted). From USD 25,000.00, exactly 25,000.00 included, the extra check: a code with dynamic linking (`authorise`). Entering Business needs `stepup` (README 4.3), unchanged. Payments to a supplier whitelisted less than 24 hours ago are limited by the cooling-off rule.
- **Limits** (09 section 9), all tested on the **USD amount after conversion** (the fee is not part of the limit): per person per day (Alex 250,000.00 USD at Alpha, `LIMIT_USER_EXCEEDED`, counted at start); per company per day (1,000,000.00 USD, `LIMIT_COMPANY_EXCEEDED`, counted at release). The rail maximum in 09 section 2 applies on top and is in the rail's own currency. The source account is USD; **You pay** (converted amount plus fee) must be available on it.
- **Approvers:** the USD amount decides. Above 50,000.00 USD two different approvers (`dana`, `lee`); at 50,000.00 exactly, one. A payment of GBP 40,000.00 (USD 51,216.39) needs two approvers although 40,000 is below 50,000.
- **Cut-off and value date:** instant rails ignore cut-offs. Every other rail has an effective cut-off, the earlier of the company cut-off (16:00 UTC) and the rail's own cut-off (09 section 2) converted to UTC. For November 2026 (clocks as in the sandbox) that gives: US, UK and CHAPS: 16:00 UTC (the rail cut-offs 19:45 and 23:00 for the US, and 17:00 for CHAPS, are later); SEPA Credit Transfer 14:00 UTC; UAEFTS 11:00 UTC; SARIE 12:00 UTC; JoPACC 11:00 UTC; SWIFT 15:00 UTC. A payment started at or before the effective cut-off on a working day has the value date today (exactly at the cut-off it is still today); after it, on a weekend or on a closed day (9 Nov 2026) the value date is the next working day and `afterCutoff` is true.
- **Whitelist:** only whitelisted suppliers; one added by a Maker or an administrator waits for whitelisting (see `add-supplier`).
- **Other context:** a personal context is refused by `WRONG_CONTEXT`. A user from Beta (Alex as Approver) is refused by `PERMISSION_DENIED`.

#### 7. Result and links out

- **Result:** `success` with payment id, status **Pending approval**, value date. Receipt: not issued until release (planned engine feature `receipts`); the person sees "Receipt available once it is released" on Payment detail. At release the receipt shows the rail's own reference (09 section 11) and the BankWorkx® reference `BWX-nnnnnn`.
- **Tracker:** Payment detail and the tracker list show the **rail** ("Sent by Wire (Fedwire®)") and the amount **in the supplier's currency** ("EUR 11,300.00", with "USD 12,203.02" beneath). The tracker shell's current columns do not have a Rail column yet; adding one is a small change to the shell (not part of this journey).
- **Notifications raised:** to every user holding `biz.approvals.approve` at the company (`dana`, `lee`): "Payment awaiting your approval, Alpha Trading LLC. {amount in supplier currency} to {supplier}, started by {name}." (deep link: switch context, then `approve-payments`, `{companyId, paymentId}`). To Alex: none on start.
- **Buttons:** Track payment (Payments › tracker › Payment detail), Save as template (`payment-template`), Pay another supplier, Done. "Go to approvals" is shown only when the person also holds `biz.approvals.approve`; Alex does not at Alpha.
- **M1 combined demo:** this journey is the first half. Alex at Alpha starts a payment to Harbour Packaging (US, ACH), sees it Pending approval, cannot approve it (no permission, and `SELF_APPROVAL` as well), switches to Beta (with step-up) and approves **Priya's** payment there with `approve-payments`. At Beta the Pay a supplier card is not shown, because Alex has no `biz.payments.initiate` there.

#### 8. Acceptance criteria

- **AC-1** The acting person comes from the active context. The journey has no "who" screen, and a call that names a different user is refused (`PERMISSION_DENIED`).
- **AC-2** Only a context with `biz.payments.initiate` can start a payment; an Approver (Alex at Beta) is refused with "Your role doesn't allow this" and the launch point is hidden.
- **AC-3** Only a whitelisted supplier can be paid. The Payee screen lists only saved, whitelisted suppliers (name, region, country, masked account, chip "Whitelisted"), has no form for a new payee, and its "Add supplier" link says an administrator whitelists new suppliers. A supplier waiting for whitelisting, or not on the list, is refused (`BENEFICIARY_NOT_WHITELISTED`) and no money moves.
- **AC-4** United States: a supplier in the US is paid by ACH by default, with same-day ACH, instant (RTP®/FedNow®) and wire as other speeds; the memo allows up to 80 characters; the receipt names the rail reference (09 section 11).
- **AC-5** Europe: a supplier with a SEPA IBAN is paid in EUR by SEPA Credit Transfer by default, or SEPA Instant; the person types the euro amount the supplier receives and sees the conversion, rate and total in USD; the reference allows up to 140 characters.
- **AC-6** United Kingdom: a UK supplier is paid in GBP by Faster Payments by default, or CHAPS or Bacs; the reference allows up to 18 characters.
- **AC-7** Middle East: a supplier in the UAE (or Saudi Arabia, or Jordan) is paid in its local currency by the instant rail by default, or the same-day rail; purpose is required.
- **AC-8** SWIFT: where the company has a supplier in a SWIFT country, the payment goes by SWIFT, the person chooses who pays the charges, and `OUR` adds USD 15.00 to **You pay**.
- **AC-9** The person types what the supplier receives, in the supplier's currency. The summary shows rate, converted USD amount, fee, **You pay** and arrival. A payment to a USD supplier shows no rate.
- **AC-10** The daily limit and the company limit are tested on the USD amount after conversion (`LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`), and the remaining limit is shown in USD.
- **AC-11** An amount above a rail's maximum cannot be sent on that rail (`RAIL_LIMIT`), and the default rail moves to the first rail that fits.
- **AC-12** When a rail is down the screen says "Not available right now" and offers another rail; forcing it gives `RAIL_NOT_AVAILABLE`.
- **AC-13** A payment started after the rail's effective cut-off, on a weekend or on 9 Nov 2026 goes out on the next working day, and the person is told so. Instant rails ignore cut-offs.
- **AC-14** The rate is held for 60 seconds; a review left open longer asks the person to accept the new amount (`QUOTE_EXPIRED`).
- **AC-15** Purpose and the invoice or PO number are always required (`PURPOSE_REQUIRED`); Review stays disabled until both are given.
- **AC-16** Not enough money for **You pay** is refused with both numbers, and an account in a currency other than USD is refused, each with "No money has left your account".
- **AC-17** The USD amount decides the approvers: above 50,000.00 two different approvers, 50,000.00 exactly one, whatever the supplier's currency.
- **AC-18** From USD 25,000.00 the person authorises with a code that names the amount and supplier; below 25,000.00 no code is asked. A code is void if the amount or supplier changes, and three wrong codes stop the payment (`STEP_UP_FAILED`).
- **AC-19** Starting a payment moves no money: the balance is unchanged, and the result shows **Pending approval** with the approvers named and a Track payment button.
- **AC-20** A payment cannot be sent without the confirmation.
- **AC-21** A supplier whitelisted less than 24 hours ago can receive at most USD 500.00 in 24 hours (`BENEFICIARY_COOLING_OFF`).
- **AC-22** Choosing "Later" hands over to `schedule-business-payment` with the details filled in; nothing is started today.
- **AC-23** A personal context cannot start a company payment (`WRONG_CONTEXT`).
- **AC-24** When the bank times out or is unavailable, nothing is started and the person is told what to do next.
- **AC-25** After success the person can follow the payment in the tracker, where it shows Pending approval with a timeline, the rail, and the amount in the supplier's currency.

#### 9. Scenarios

Persona `alpha` is Alex Morgan as Maker at Alpha Trading LLC (planned). `now` is `2026-11-03T10:00:00Z` (Tuesday, before every cut-off) unless stated. Rates are the fixed table of 09 section 5 (EUR 0.926, GBP 0.781, AED 3.672, JPY 151.0). Suppliers (Alpha): `sup_harbour` Harbour Packaging (US), `sup_nordic` Nordic Supplies AB (Europe), `sup_whitby` Whitby Logistics (UK), `sup_gulf` Gulf Trade FZE (UAE); a planned variant persona `alpha-swift` adds `sup_tanaka` Tanaka Metals KK (Japan, BIC BOTKJPJT, JPY). Every scenario that moves nothing also checks the Operating balance with `expectBank` (`corp.company.get`, `accounts.alpha_ops.balance`, 250,000).

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-1 | US happy path, default rail | AC-1, AC-4, AC-19, AC-25 | `alpha`; Harbour Packaging, USD 12,500.00, ACH, purpose Goods or services, ref INV-1001 | No `who` screen; no code asked; `success` "Pending approval", "waiting for 1 approver: Dana Cruz or Lee Park"; Operating still 250,000.00; the tracker lists it as Pending approval with rail "ACH (standard)" and USD 12,500.00 |
| T-2 | Europe happy path | AC-5, AC-9 | `alpha`; Nordic Supplies AB, EUR 11,300.00, default rail | Default rail SEPA Credit Transfer; summary: rate 0.926, converted USD 12,203.02, fee 0.00, **You pay** USD 12,203.02; `success`; tracker shows "SEPA Credit Transfer" and EUR 11,300.00; balance unchanged |
| T-3 | UK happy path | AC-6, AC-9 | `alpha`; Whitby Logistics, GBP 5,000.00, reference of 19 characters typed | Default rail Faster Payments; the reference field stops at 18 characters; **You pay** USD 6,402.05; `success` |
| T-4 | Middle East happy path | AC-7, AC-9 | `alpha`; Gulf Trade FZE, AED 18,360.00 | Default rail Aani; fee 0.50; converted USD 5,000.00; **You pay** USD 5,000.50; purpose chosen; `success` |
| T-5 | SWIFT with charges | AC-8 | `alpha-swift`; Tanaka Metals KK, JPY 1,510,000, charges "I pay all" | Rail SWIFT; converted USD 10,000.00; fee 25.00 plus 15.00; **You pay** USD 10,040.00; the review shows "Charges: I pay all"; `success` |
| T-6 | A different user in the request is refused | AC-1 | `alpha`; call `corp.payments.create` with `userId: "dana"` | `PERMISSION_DENIED`; nothing started |
| T-7 | An Approver cannot start a payment | AC-2 | persona `beta-alex` (Approver at Beta) opens the journey by deep link | `denied` with "Your role doesn't allow this. Ask an administrator at Beta Services Ltd."; the hub shows no Pay a supplier card |
| T-8 | Only whitelisted suppliers are listed | AC-3 | `alpha`; open `payee` | Lists Harbour Packaging, Nordic Supplies AB, Whitby Logistics, Gulf Trade FZE, each with region, country, masked account and chip "Whitelisted"; Cedar Tools greyed "Waiting for whitelisting"; no new-payee form; link "Add supplier" shows "New suppliers are added and whitelisted by a company administrator." |
| T-9 | A supplier that is not whitelisted is refused | AC-3 | `alpha`; supplier `sup_cedar` forced by deep link | `failed` with "This supplier isn't on Alpha Trading LLC's whitelist" and "No money has left your account" |
| T-10 | Over the personal limit, tested in USD | AC-10 | `alpha`; Nordic Supplies AB, EUR 231,500.01 (USD 250,000.01) | Amount field shows "That is above your daily limit of USD 250,000.00."; EUR 231,500.00 (exactly USD 250,000.00) passes; calling the adapter with the first gives `LIMIT_USER_EXCEEDED` |
| T-11 | Remaining limit shrinks | AC-10 | `alpha`; setup: USD 215,000.00 already started today by Alex; then Whitby GBP 27,000.00 (USD 34,571.31), then GBP 30,000.00 (USD 38,412.29) | helper shows "Limit left today: USD 35,000.00"; the first amount passes; the second is refused with "That is above your daily limit of USD 250,000.00. You have USD 35,000.00 left today." |
| T-12 | Over the company limit | AC-10 | persona `alpha-near-limit` (planned variant: `companyUsedToday` 995,000.00); Harbour, USD 6,000.00 | `failed`: "This is above Alpha Trading LLC's daily limit"; balance unchanged |
| T-13 | Rail limit moves the default | AC-11 | `alpha`; Harbour, USD 60,000.00 | ACH dimmed with "limit $25,000.00"; default rail Same-day ACH; **You pay** USD 60,001.00; forcing ACH gives `RAIL_LIMIT` "That's over the ACH (standard) limit of $25,000.00. Choose another way to send it." |
| T-14 | Instant rail unavailable | AC-12 | `alpha`; conditions `unavailable: ["rail:sinst"]`; Nordic, EUR 5,000.00 | SEPA Instant shows "Not available right now"; SEPA Credit Transfer is offered and chosen; forcing SEPA Instant gives `RAIL_NOT_AVAILABLE` |
| T-15 | Before the cut-off, today | AC-13 | `alpha`; `now` 2026-11-03T15:59:00Z; Harbour, ACH | value date 2026-11-03; no after-cut-off alert |
| T-16 | After the cut-off, next working day | AC-13 | `now` 2026-11-03T17:00:00Z; Harbour, ACH | value date 2026-11-04; alert "It was started after the cut-off, so it goes out on 2026-11-04." |
| T-17 | Friday after the cut-off skips the weekend and the closed Monday | AC-13 | `now` 2026-11-06T17:00:00Z; Harbour, ACH | value date 2026-11-10 |
| T-18 | A rail with an earlier cut-off | AC-13 | `now` 2026-11-03T14:30:00Z; Nordic, SEPA Credit Transfer (effective cut-off 14:00 UTC) | review: "Goes out on 4 Nov 2026: after the 14:00 UTC cut-off."; the same payment on Faster Payments to Whitby shows value date today |
| T-19 | An instant rail ignores the cut-off | AC-13 | `now` 2026-11-03T17:00:00Z; Gulf Trade, Aani, AED 18,360.00 | value date 2026-11-03; no after-cut-off alert |
| T-20 | Quote expires | AC-14 | `alpha`; Whitby, GBP 5,000.00; `now` advanced 61 seconds after the amount screen opened | `review` shows "The exchange rate changed. Check the new amount."; "Submit for approval" disabled until "Accept new rate"; calling create with the old quote gives `QUOTE_EXPIRED`; nothing started |
| T-21 | Purpose and reference required | AC-15 | `alpha`; Harbour, amount typed, purpose empty, then reference empty | "Choose a purpose for this payment." (`PURPOSE_REQUIRED` from the adapter); "Enter the invoice or PO number."; Continue stays disabled |
| T-22 | Wrong currency account | AC-16 | `alpha`; account Reserve ••6101 (EUR) forced | `failed`: "Payments are limited in USD. Choose a USD account. No money has left your account." |
| T-23 | Not enough money for You pay | AC-16 | persona `alpha-low-balance` (planned variant: Operating 5,000.00); Harbour, USD 5,000.00 on wire (fee 25.00) | `failed`: "There isn't enough money in Operating ••2001: you'd pay USD 5,025.00 and USD 5,000.00 is available." |
| T-24 | Two approvers by USD equivalent | AC-17, AC-18 | `alpha`; Whitby, GBP 40,000.00 (USD 51,216.39) | Review: "2 approvers: Dana Cruz and Lee Park"; `authorise` appears; `success` says "waiting for 2 approvers" |
| T-25 | At the threshold, one approver | AC-17 | `alpha`; Nordic, EUR 46,300.00 (exactly USD 50,000.00) | "1 approver"; extra check still asked (above 25,000.00) |
| T-26 | Extra check starts at 25,000 | AC-18 | `alpha`; Harbour, ACH, USD 24,999.99, then USD 25,000.00 | the first goes straight to `success` with no code; the second shows `authorise` "Authorise USD 25,000.00 to Harbour Packaging" |
| T-27 | Code is tied to the payment | AC-18 | `alpha`; code requested for USD 30,000.00; person goes Back and changes the amount, then enters the old code | `STEP_UP_FAILED`; no payment; "The payment changed, so that code no longer works. Start again." |
| T-28 | Short code and three wrong codes | AC-18 | `alpha`; USD 30,000.00; code `123`, then `999999` three times | "Enter the 6-digit code."; then `failed` with "Too many wrong codes. Start again." (`STEP_UP_FAILED`); balance unchanged; no payment listed |
| T-29 | Without the confirmation | AC-20 | `alpha`; press "Submit for approval" without ticking | stays on `review`; error "Tick the confirmation first." |
| T-30 | New supplier cooling-off | AC-21 | `alpha`; setup: Nordic whitelisted 2 hours ago; EUR 463.00 (USD 500.00), then EUR 464.00 (USD 501.08) | the first passes; the second fails with `BENEFICIARY_COOLING_OFF` and "up to USD 500.00 in 24 hours" |
| T-31 | Later hands over to the schedule journey | AC-22 | `alpha`; Harbour, USD 12,500.00, "Later", date 2026-11-12, Doesn't repeat | The journey opens `schedule-business-payment` at `review` with the details filled in; no payment exists; the date picker had 9 Nov 2026 disabled |
| T-32 | Personal context | AC-23 | persona `alex` with the **personal** context active; call `corp.payments.create` | `WRONG_CONTEXT`; message "This belongs to your Business banking. Switch to Business to continue." |
| T-33 | **Timeout** on starting | AC-24 | `alpha`; conditions `timeout: ["corp.payments.create"]`, `latencyMs: 10000` | `unavailable` with the TIMEOUT text; no payment in the tracker; balance unchanged |
| T-34 | **Unavailable** | AC-24 | `alpha`; conditions `unavailable: ["corp.company.get"]` | `unavailable` with "This service is not available right now. Nothing was changed."; button "Try again" |
| T-35 | Held for review | AC-19 | `alpha`; supplier name "Test Sanctions" (planned variant seed); USD 1,000.00 | Status "Held for review" with "We're checking this payment and will tell you within one working day."; no approver notified; balance unchanged |
| T-36 | M1 combined demo (first half) | AC-2, AC-19, AC-25 | persona `alex`; start at Alpha (Harbour Packaging, USD 12,500.00 by ACH), then switch to Beta | At Alpha the payment is Pending approval; at Beta the Approvals inbox lists Priya's payment and **not** Alpha's; the Beta hub has no Pay a supplier card |

#### 10. Expected mutation-check survivors

| Survivor | Reason |
|---|---|
| `flaws.companyLimit` off | Only killed because of the near-limit variant in T-12. Without that variant the company limit (1,000,000) is above the sum of every Maker's limit (250,000), so the sandbox cannot produce it, the same reason as in `scenarios.test.ts` for Acme. |
| `flaws.roles` off | Killed by T-7 (check 3), unless a second layer (the permission check) stops the Approver first. Then the role rule is a survivor with that reason: the `PERMISSION_DENIED` layer already stops the case. |
| `flaws.dualApproval` off | Killed by T-24 and T-25. |
| `flaws.cutoff` off | Killed by T-16, T-17 and T-18. |
| The text of each message | Tests check the code, not the words (09 section 15). |
| The rates and the specific rail fees | Tests use the fixed table of 09 sections 2 and 5; changing a rate in the table changes the expected numbers in the same commit. |
| The order of rails inside a region | Only the default rail is asserted. |
| The `stepper` block label change | Cosmetic; no scenario depends on step labels. |
| Region holiday lists other than 9 Nov 2026 and weekends | No scenario relies on them here; they are proved in `schedule-business-payment`. |

---

### ★ Add a supplier — `add-supplier`

#### 1. Summary

| | |
|---|---|
| Slug | `add-supplier` |
| Purpose | Add a supplier in the United States, Europe, the United Kingdom, the Middle East or a SWIFT country to the company's list. The supplier's account is checked, the name is checked against the bank's registry, and the supplier cannot be paid until a company administrator whitelists them. A newly whitelisted supplier has a 24-hour cooling-off limit. |
| Release | 1 |
| Workspace | Business |
| Status | **New (planned).** No fixture exists. The sandbox has a fixed whitelist today (`CorporateSandbox.whitelist` in `packages/mock-bank-api/src/corporate.ts`); this journey needs `corp.suppliers.*`, `bank.payees.validate` and `bank.payees.check` (all planned, 09 section 13). |
| Channels | web, mobile |
| Starting pattern | The `beneficiaryPicker` block with `allowAddNew` and `addNewJourney`; the add-payee flow of Personal (`manage-beneficiary`) for the field list; the region fields, validation and name check of `09-payment-rails.md` (called "09" below). |
| Who may use it | `biz.suppliers.manage` (Maker; Admin by policy) to add or edit. Whitelisting is done by a company administrator (permission `biz.suppliers.whitelist`, planned; Admin only). A person never whitelists a supplier they added themselves. |

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › suppliers › Add / Edit | `{supplierId}` optional | `biz.suppliers.manage` |
| Payments › hub › Add a supplier card | none | `biz.suppliers.manage` |
| `supplier-payment` › "Add supplier" (information sheet) › Add a supplier | none; opens with `returnTo` | `biz.suppliers.manage` |
| `payment-template` › "Add a new supplier" | none; opens with `returnTo` | `biz.suppliers.manage` |

With `{supplierId}` the journey opens in **edit** mode: the region cannot change, the account number is shown masked and cannot be viewed (09 section 3 masks), and changing the account number or the name sends the supplier back to "Waiting for whitelisting", runs the name check again (09 section 4) and restarts the cooling-off clock when they are whitelisted again.

#### 3. Screens

Screen ids: `region`, `details`, `check`, `review`, `otp`, `success`, `failed`, `unavailable`, `denied`, `wrongContext`.

**Screen `region` — "Add a supplier"**
Blocks: `text`, `select` (tiles), `button`. Field `sup.region`: tiles "United States" (hint "ACH, same-day ACH, instant, wire"), "Europe (SEPA)" (hint "Euro payments, IBAN"), "United Kingdom" (hint "Faster Payments, CHAPS, Bacs"), "Middle East" (hint "UAE, Saudi Arabia, Jordan"), "Other countries (SWIFT)" (hint "Canada, India, Japan, Australia"). Required. Message: "Choose where the supplier is." Button "Continue" goes to `details`. "Cancel" exits.

**Screen `details` — "Supplier details"**

Fields that every region has:

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Name on the account (`sup.name`) | `textInput` | yes | 2 to 70 characters (09 section 3) | "Enter the name on the account." (`PAYEE_NAME_REQUIRED`) |
| What do you usually pay them for? (`sup.purpose`) | `select` rows: Goods or services, Rent, Salary, Education, Savings or investment, Family support, Other (09 section 7) | yes | one of the list; becomes the default purpose on `supplier-payment` and can be changed per payment | "Choose the usual purpose of payments to this supplier." |
| Contact email (`sup.email`) | `textInput` | no | a valid email if given | "Enter a valid email address." |
| Note for the administrator (`sup.note`) | `textInput` (`lines: 3`) | no | up to 140 characters | "Keep it to 140 characters." |

Fields that depend on the region (rules and messages are those of 09 section 3; the codes are the ones in 09 section 12):

| Region | Fields | Rules | Errors |
|---|---|---|---|
| United States | Routing number (ABA) (`sup.rout`), Account number (`sup.account`), Account type (`sup.acctType`: Checking or Savings, default Checking) | 9 digits and the ABA checksum; 4 to 17 digits | `INVALID_ROUTING`: "That routing number isn't valid. Check the 9 digits."; `INVALID_ACCOUNT`: "An account number has 4 to 17 digits." |
| Europe | IBAN (`sup.iban`) | letters and digits, mod-97 check equals 1, length matches the country, country in the SEPA list | `INVALID_IBAN`: "That IBAN doesn't look right. Check each character."; `NOT_SEPA`: "That IBAN isn't in the SEPA area. Use 'Other countries (SWIFT)'." |
| United Kingdom | Sort code (`sup.sort`), Account number (`sup.account`) | 6 digits, dashes optional; 8 digits | `INVALID_SORT_CODE`: "A sort code has 6 digits, like 20-00-00."; `INVALID_ACCOUNT`: "A UK account number has 8 digits." |
| Middle East | Country (`sup.country`: United Arab Emirates, Saudi Arabia, Jordan), IBAN (`sup.iban`) | the IBAN check, and the first two letters match the country (`AE` 23 characters, `SA` 24, `JO` 30) | `INVALID_IBAN`; `COUNTRY_MISMATCH`: "That IBAN starts with AE, but you chose Saudi Arabia." |
| Other countries (SWIFT) | Country (`sup.country`: Canada, India, Japan, Australia), SWIFT/BIC (`sup.bic`), Account number or IBAN (`sup.account`) | BIC: 8 or 11 characters; account: 6 to 34 letters, digits, spaces or dashes | `INVALID_BIC`: "A SWIFT/BIC has 8 or 11 letters and numbers."; `INVALID_ACCOUNT`: "That account number looks too short or too long." |

Each field is checked while typing: an error shows once the field has a value, and an empty required field shows its message after the person presses Continue. When a field is valid and the bank is known, a green note shows below it, for example "✓ Valid IBAN · Commerzbank" or "✓ Valid sort code · Barclays". **Currency** (`sup.currency`) is not asked: it is fixed by the region and country (USD, EUR, GBP, AED, SAR, JOD, or CAD, INR, JPY, AUD for SWIFT) and shown read-only as "Payments to this supplier are in {currency}". **Bank name** (`sup.bank`) is filled in when known and shown read-only; when the bank is not known (SWIFT, or an unknown routing number) the field is a required `textInput` of 2 to 60 characters, message "Enter the bank's name."

Copy: title "Supplier details". Info alert: "A company administrator has to whitelist a new supplier before you can pay them." Buttons "Continue" (validate with `bank.payees.validate`, then `check`; disabled while any field has an error) and "Back".

**Screen `check` — "Check the name"**
Blocks: `text`, `alert`, `button` (the "Use" button), `consent`, `button`. `onEnter`: `bank.payees.check`. The heading is the label of the region (09 section 4): "Verification of Payee" (Europe), "Confirmation of Payee" (United Kingdom), "Account name check" (United States), "Name check" (Middle East and SWIFT).

| Result | What the person sees | Can the person continue? |
|---|---|---|
| `match` | Green: "The name matches" | Yes |
| `close` | Amber: "The registered name is {registeredName}. Check with the supplier." and a button "Use '{registeredName}'" that replaces the name and shows the green result | Yes, after ticking "I understand and want to continue" |
| `none` | Red: "The name doesn't match. The money may go to the wrong person and might not be recoverable." | Yes, only after ticking the box |
| `na` | Grey: "We couldn't check this name" | Yes, only after ticking the box |

Rules: the tick is saved on the supplier (`nameCheck: "none"`, `acknowledged: true`), is shown to the administrator who whitelists the supplier, and goes into the audit trail. There is no "Save this payee for next time" box: a supplier is always saved. If the name is edited later the check runs again. If the check cannot run (the check adapter is unavailable or times out) the result is `na`; the rest of the journey is unaffected. Without the tick the bank refuses to add the supplier (`PAYEE_NOT_CHECKED`: "Check the payee before you continue."). Buttons "Continue" (disabled until the result allows it) and "Back".

**Screen `review` — "Review supplier"**
`reviewSummary` rows: Name, Region and country, Currency, Bank, Account (masked, 09 section 3: `ABA 021000021 · ••8841`, `DE89 •••• 3000`, `20-00-00 · ••9911`, `AE07 •••• 3456`, `BOTKJPJT · ••7890`), Usual purpose, Name check (result and, if ticked, "You chose to continue"), Contact email, Note. `consent` (`sup.consent`): "I have checked these details with the supplier" (`mustBeTrue`, message "Tick the confirmation first."). Button "Confirm and send OTP" (sends code, to `otp`). "Edit" (back to `details`).

**Screen `otp`** as `supplier-payment`'s authorise screen: the prompt names the change, "Authorise adding {name} to Alpha Trading LLC's suppliers" (dynamic linking, 09 section 9), and the code only works for this supplier. Button "Verify and add supplier". Changing the account or name after the code was sent voids it (`STEP_UP_FAILED`).

**Screen `success` — "Supplier added"**
`result` success. Title "Sent for whitelisting". Text: "{name} is waiting for a company administrator to whitelist them. You can pay them once they are whitelisted. After that, the first 24 hours allow up to USD 500.00." Meta: "Supplier {id}". Status chip **Waiting for whitelisting**. Buttons "View suppliers" (Payments › suppliers), "Back to your payment" (only when opened with `returnTo`; returns to the origin journey, where the supplier is listed greyed out), "Add another", "Done".

**Screens `failed`, `unavailable`, `denied`, `wrongContext`** as section 4.

States. Loading: spinner on buttons. Error: `failed` with "Nothing was changed."

#### 4. Sandbox errors

Field errors use the messages in section 3 and stay on `details`. Codes from 09 section 12 keep the wording given there.

| Code | What the person sees | Screen | Button |
|---|---|---|---|
| `OTP_INVALID`, `OTP_REQUIRED` | Standard messages S-`OTP_INVALID`, S-`OTP_REQUIRED` (README 1.6) | `otp` / `failed` | Try again / Start again |
| `STEP_UP_FAILED` | "Too many wrong codes. Start again." or, when the supplier changed after the code was sent, "The details changed, so that code no longer works. Start again." Nothing was added. | `failed` | Start again |
| `INVALID_ROUTING`, `INVALID_ACCOUNT`, `INVALID_IBAN`, `NOT_SEPA`, `COUNTRY_MISMATCH`, `INVALID_SORT_CODE`, `INVALID_BIC`, `PAYEE_NAME_REQUIRED` | The field messages in section 3 | `details` | Edit details |
| `PAYEE_NOT_CHECKED` | "Check the payee before you continue." | `check` | Back |
| `SUPPLIER_EXISTS` (planned) | "You already have a supplier with this account: {name}. Nothing was changed." | `failed` | Edit details |
| `COUNTRY_NOT_SUPPORTED` (planned) | "We can't pay suppliers in {country} yet. Nothing was changed." | `failed` | Edit details |
| `SUPPLIER_LIMIT` (planned) | "You have reached 200 suppliers. Remove one to add another. Nothing was changed." | `failed` | View suppliers |
| `NOT_AUTHORISED` | "Only a Maker can add a supplier. Nothing was changed." | `denied` | Close |
| `PERMISSION_DENIED` (planned) | Standard message S-`PERMISSION_DENIED` | `denied` | Back |
| `WRONG_CONTEXT` (planned) | Standard message S-`WRONG_CONTEXT` | `wrongContext` | Switch |
| `STEP_UP_REQUIRED` (planned) | Standard message S-`STEP_UP_REQUIRED` | `otp` | Confirm |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. Nothing was changed." | `failed` | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `unavailable` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | Standard message S-`SERVICE_UNAVAILABLE` | `unavailable` | Try again |

For the whitelisting step (not part of this journey, see the adapters): `SELF_APPROVAL` "You can't whitelist a supplier you added.", `PERMISSION_DENIED` for a person without `biz.suppliers.whitelist`, and after a decline a later payment gets `BENEFICIARY_NOT_WHITELISTED` (`supplier-payment`).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `validate` | `bank.payees.validate` | `{ region, country?, name, rout?, account?, sort?, iban?, bic? }` | per-field errors and `{ bankName?, valid }` | the field codes of 09 section 12 | **(planned)** |
| `check` | `bank.payees.check` | `{ region, name, iban? , sort?, account?, rout? }` | `{ result: "match" \| "close" \| "none" \| "na", registeredName? }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` (the journey treats both as `na`). `moneyMoving: false`, `requiresOtp: false` | **(planned)** |
| `addSupplier` | `corp.suppliers.add` | `{ region, country?, name, purpose, rout?, account?, acctType?, sort?, iban?, bic?, bank?, email?, note?, nameCheck, acknowledged }` | `{ id, name, region, country, currency, status: "waiting_approval", maskedNumber, nameCheck, addedBy, addedAt }` | `OTP_REQUIRED`, `STEP_UP_FAILED`, `PAYEE_NOT_CHECKED`, the field codes, `SUPPLIER_EXISTS`, `COUNTRY_NOT_SUPPORTED`, `SUPPLIER_LIMIT`, `NOT_AUTHORISED`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `STEP_UP_REQUIRED`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: true` (it changes who the company can pay) | **(planned)** |
| `updateSupplier` | `corp.suppliers.update` | `{ supplierId, ...fields }` | the supplier; changing name or account returns `status: "waiting_approval"` and a new `nameCheck` | as above plus `SUPPLIER_NOT_FOUND` | **(planned)** |
| `suppliers` | `corp.suppliers.list` | `{ status? }` | `{ items }` (adds `region`, `country`, `purpose`, `whitelistedAt`) | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | **(planned)** |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as `supplier-payment` | as `supplier-payment` | `OTP_INVALID` | Existing |

An administrator whitelists or declines a supplier with `corp.suppliers.decide` (planned; request `{ supplierId, decision: "approve" \| "decline", reason? }`; permission `biz.suppliers.whitelist`; same-person rule as payments: the person who added a supplier cannot whitelist them, `SELF_APPROVAL`). On approve the supplier gets `status: "approved"` and `whitelistedAt`; on decline `status: "disabled"` with the reason. That action belongs to the Approvals inbox (item type "Supplier") and to Payments › suppliers; see open questions.

**Cooling-off rule.** From `whitelistedAt`, a supplier can receive at most USD 500.00 in 24 hours (`BENEFICIARY_COOLING_OFF`, enforced by `supplier-payment`, 09 section 10). The supplier row shows an amber chip "New: up to USD 500.00 in 24 hours" until the 24 hours pass.

#### 6. Permissions, step-up and limits

`biz.suppliers.manage` to add or edit; `biz.suppliers.whitelist` (planned, Admin) to whitelist or decline. Step-up `otp` with dynamic linking. No amount limits on adding. At most 200 suppliers per company. Duplicate test: the same routing and account (US), the same IBAN (Europe, Middle East), the same sort code and account (UK) or the same BIC and account (SWIFT). A SWIFT country outside Canada, India, Japan and Australia is refused (`COUNTRY_NOT_SUPPORTED`).

#### 7. Result and links out

Result `success` as above. Receipt: none. Notifications: to every administrator (users holding `biz.suppliers.whitelist`) "Supplier awaiting whitelisting, Alpha Trading LLC. {name}, added by {name}." When whitelisted: to the Maker "{name} was whitelisted. You can pay them now (up to USD 500.00 in the first 24 hours)." When declined: to the Maker "{name} was not whitelisted. {reason}". Links: View suppliers, the origin journey via `returnTo`, Done.

#### 8. Acceptance criteria

- **AC-1** Only a context with `biz.suppliers.manage` can add a supplier; others (an Approver at Beta) are refused.
- **AC-2** The fields depend on the region (09 section 3): United States, Europe, United Kingdom, Middle East and SWIFT each ask for their own fields, and the currency is fixed by the region and country.
- **AC-3** Bad account details are refused with the field's own code and message, and Continue stays disabled: `INVALID_ROUTING`, `INVALID_ACCOUNT`, `INVALID_IBAN`, `NOT_SEPA`, `COUNTRY_MISMATCH`, `INVALID_SORT_CODE`, `INVALID_BIC`.
- **AC-4** The name is checked when a supplier is added: `match` continues; `close` shows the registered name and a button to use it; `none` and `na` need the person to tick the box; the tick is saved on the supplier.
- **AC-5** The check label follows the region (Verification of Payee, Confirmation of Payee, Account name check, Name check), and a check that cannot run counts as `na`.
- **AC-6** A usual purpose is required for every supplier and becomes the default purpose for payments.
- **AC-7** A new supplier is created as "Waiting for whitelisting" and cannot be paid until a company administrator whitelists them (`BENEFICIARY_NOT_WHITELISTED`).
- **AC-8** A supplier with the same account as an existing one is refused.
- **AC-9** The person who added a supplier cannot whitelist them (`SELF_APPROVAL`), and a person without `biz.suppliers.whitelist` cannot whitelist anyone.
- **AC-10** A declined supplier cannot be paid.
- **AC-11** A whitelisted supplier can receive at most USD 500.00 in the first 24 hours (cooling-off).
- **AC-12** Changing the name or the account of a supplier sends it back to "Waiting for whitelisting", runs the name check again and restarts the cooling-off clock.
- **AC-13** The supplier is not added without the confirmation and a correct six-digit code that names the supplier; three wrong codes, or a change after the code was sent, stop it (`STEP_UP_FAILED`).
- **AC-14** Opened from `supplier-payment`, the journey returns to the payment with the supplier listed but not selectable.
- **AC-15** When the bank times out or is unavailable, nothing is added and the person is told so.

#### 9. Scenarios

Synthetic registry data from 09 section 14. Persona `alpha` is Alex Morgan as Maker at Alpha; `alpha-admin` is the administrator `ravi` at Alpha (planned).

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-1 | Add a US supplier, name matches | AC-1, AC-2, AC-4, AC-7 | `alpha`; region United States; name "Priya Raman", ABA 021000021, account 987654321, Checking, purpose Goods or services | Green note "✓ Valid routing number · JPMorgan Chase"; check result `match`, Continue without a tick; `success` "Sent for whitelisting"; list shows Waiting for whitelisting; paying them gives `BENEFICIARY_NOT_WHITELISTED` |
| T-2 | Europe, name matches | AC-2, AC-4, AC-5 | `alpha`; Europe; "Camille Dubois", IBAN FR14 2004 1010 0505 0001 3M02 606 | Heading "Verification of Payee", `match`; `success` |
| T-3 | Europe, name is close | AC-4 | `alpha`; Europe; "Lena Fisher", IBAN DE89 3704 0044 0532 0130 00 | Amber, registered name "Lena Fischer", button "Use 'Lena Fischer'"; pressing it turns the result green and the name changes; without pressing it, Continue needs the tick |
| T-4 | Europe, name does not match | AC-4 | `alpha`; Europe; "Bob Smith", the same IBAN | Red; Continue disabled until the box is ticked; after it, the supplier is saved with `nameCheck: "none"` and `acknowledged: true`, and the review shows "You chose to continue" |
| T-5 | UK, name matches; Middle East; SWIFT unchecked | AC-2, AC-4, AC-5 | `alpha`; UK "James Whitfield", sort code 20-00-00, account 55779911; then Middle East, Saudi Arabia, "Faisal Al-Harbi", IBAN SA03 8000 0000 6080 1016 7519; then SWIFT, Japan, "Aiko Tanaka", BIC BOTKJPJT, account 1234567890 | UK heading "Confirmation of Payee", `match`; Saudi `match` under "Name check"; Japan `na` "We couldn't check this name", Continue needs the tick |
| T-6 | Field errors by region | AC-3 | `alpha`; one case each: routing 021000022; account `12`; IBAN `DE00 0000 0000 0000 0000 00`; IBAN `AE07 0331 2345 6789 0123 456` typed as Europe; sort code `2000`; UAE IBAN with Saudi Arabia chosen; BIC `BOTK` | `INVALID_ROUTING`, `INVALID_ACCOUNT`, `INVALID_IBAN`, `NOT_SEPA`, `INVALID_SORT_CODE`, `COUNTRY_MISMATCH` ("That IBAN starts with AE, but you chose Saudi Arabia."), `INVALID_BIC`; Continue disabled each time |
| T-7 | Usual purpose required | AC-6 | `alpha`; every other field valid, purpose empty | "Choose the usual purpose of payments to this supplier."; Continue disabled; after adding, `supplier-payment` offers that purpose as the default |
| T-8 | Approver cannot add | AC-1 | `beta-alex` | `denied` (`PERMISSION_DENIED`); the hub shows no Add a supplier card |
| T-9 | Duplicate account | AC-8 | `alpha`; US, ABA 021000021, account 000118841 (Harbour Packaging) | `SUPPLIER_EXISTS`; `failed`, "You already have a supplier with this account: Harbour Packaging." |
| T-10 | Administrator whitelists; cooling-off starts | AC-7, AC-11 | `alpha` adds "Priya Raman" (as T-1); `alpha-admin` runs `corp.suppliers.decide` approve; `alpha` pays USD 500.00, then USD 500.01 within the hour | Status Approved; the row shows "New: up to USD 500.00 in 24 hours"; USD 500.00 goes to Pending approval; USD 500.01 gives `BENEFICIARY_COOLING_OFF`; at `now` + 25 hours the larger amount is accepted |
| T-11 | Administrator declines | AC-10 | as T-10 but decision `decline` with reason "Not a known supplier" | Status `disabled`; payment attempt gives `BENEFICIARY_NOT_WHITELISTED`; the Maker's notification shows "was not whitelisted. Not a known supplier" |
| T-12 | Whitelisting is separate from adding | AC-9 | `alpha` adds a supplier, then `alpha` calls `corp.suppliers.decide`; `alpha-admin` adds a supplier, then calls decide | the Maker gets `PERMISSION_DENIED`; the administrator who added it gets `SELF_APPROVAL` |
| T-13 | Edit restarts everything | AC-12 | `alpha-admin` whitelisted "Camille Dubois" yesterday; `alpha` edits the name to "Camille Dubo" | status back to Waiting for whitelisting; name check runs again (`close`); `whitelistedAt` cleared |
| T-14 | Missing confirmation and wrong codes | AC-13 | `alpha`; untick; then `999999` three times | "Tick the confirmation first."; then "Too many wrong codes. Start again." (`STEP_UP_FAILED`); no supplier added |
| T-15 | Code is tied to the supplier | AC-13 | `alpha`; code sent; person goes Back, edits the account, then enters the old code | `STEP_UP_FAILED`; nothing added |
| T-16 | Name check unavailable | AC-5 | `alpha`; conditions `unavailable: ["bank.payees.check"]`; Europe "Camille Dubois" | result `na` "We couldn't check this name"; the box must be ticked; the rest works |
| T-17 | Return to the payment | AC-14 | `alpha`; start `supplier-payment`, "Add supplier", finish | back on `payee`; the new supplier is greyed "Waiting for whitelisting" |
| T-18 | **Timeout** | AC-15 | `alpha`; conditions `timeout: ["corp.suppliers.add"]` | `unavailable`; no supplier listed |
| T-19 | **Unavailable** | AC-15 | `alpha`; conditions `unavailable: ["corp.suppliers.add"]` | `unavailable` "Nothing was changed." |

#### 10. Expected mutation-check survivors

| Survivor | Reason |
|---|---|
| The 200-supplier limit | No scenario fills 200 suppliers; the sandbox seed holds 6. |
| `COUNTRY_NOT_SUPPORTED` | The country is a list the person chooses from; only a forced adapter call could reach it. Add a scenario that calls the adapter with `country: "BR"` if it should be proved. |
| The registry names | They are fixture data (09 section 15). |
| The exact text of each message | Tests check the code, not the words. |
| The bank names in the green notes | Fixture data. |

---

### ★ Payment template — `payment-template`

#### 1. Summary

| | |
|---|---|
| Slug | `payment-template` |
| Purpose | Save the details of a payment you repeat, so you can start it again in two taps. |
| Release | 1 |
| Workspace | Business |
| Status | **New (planned).** No fixture. Needs `corp.templates.*`. |
| Channels | web, mobile |
| Starting pattern | The start screen of `corporate-payment` (account, supplier, amount, reference), without the code step. |
| Who may use it | `biz.templates.manage`. |

A template stores no money and starts no payment. Using it opens `supplier-payment`, where every normal check and approval still applies.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › templates › New / Edit | `{templateId}` optional | `biz.templates.manage` |
| Payments › tracker › payment › Save as template | `{paymentId}` | `biz.templates.manage` |
| `supplier-payment` result › Save as template | `{paymentId}` | `biz.templates.manage` |

With `{paymentId}` the fields are filled from that payment (supplier, account, reference, purpose, and the amount as a suggestion).

#### 3. Screens

Screen ids: `details`, `review`, `success`, `failed`, `unavailable`, `denied`, `wrongContext`, `confirmDelete` (edit mode).

**Screen `details` — "Template details"**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Template name (`tpl.name`) | `textInput` | yes | 2 to 40 characters; unique in the company | "Give the template a name." / "You already have a template with this name." |
| Supplier (`tpl.beneficiaryId`) | `beneficiaryPicker` (`allowAddNew`, `addNewJourney: "add-supplier"`) | yes | on the approved list | "Choose an approved supplier." |
| From (`tpl.fromAccountId`) | `accountPicker` | yes | a USD account | "Choose an account." |
| Amount (`tpl.amount`) | `amountInput` | no | if given: greater than 0 and the currency's decimals; blank means "Variable" | "Enter an amount in USD with at most 2 decimal places." |
| Reference (`tpl.reference`) | `textInput` | no | up to 35 characters of letters, numbers, spaces, `- / .` | "Use letters, numbers, spaces and - / . only, up to 35 characters." |
| Purpose (`tpl.purpose`), abroad suppliers only | `select` rows | yes (abroad) | as `supplier-payment` | "Choose a purpose." |

Copy: title "Save as template" (title "Edit template" in edit mode). Helper under Amount: "Leave empty to enter the amount each time." Buttons "Continue" and "Cancel".

**Screen `review` — "Review template"**
`reviewSummary` (Name, Supplier, From, Amount or "Variable", Reference, Purpose). Info alert: "Using a template starts a new payment that still needs approval." Button "Save template" (calls `corp.templates.save`; no code, no consent). "Back".

**Screen `success` — "Template saved"**
`result` success, title "Template saved", text "{name} is ready. Use it from Payments or here." Buttons "Use it now" (`supplier-payment`, `{templateId}`), "Schedule it" (`schedule-business-payment`, `{templateId}`), "View templates", "Done".

**Screen `confirmDelete`** (edit mode, button "Delete template"): `dialog` "Delete this template? Payments already started are not affected." Buttons "Delete template" (calls `corp.templates.delete`) and "Keep it".

States. Loading: spinner on buttons. Error: `failed`.

#### 4. Sandbox errors

| Code | What the person sees | Screen | Button |
|---|---|---|---|
| `TEMPLATE_NAME_TAKEN` (planned) | "You already have a template with this name." | `details` | Change name |
| `TEMPLATE_LIMIT` (planned) | "You have reached 50 templates. Delete one to save another. Nothing was changed." | `failed` | View templates |
| `TEMPLATE_NOT_FOUND` (planned) | "We can't find that template. It may have been deleted." | `failed` | View templates |
| `BENEFICIARY_NOT_WHITELISTED` | "This supplier isn't on Alpha Trading LLC's approved list. Nothing was changed." | `failed` | Choose supplier |
| `ACCOUNT_NOT_FOUND` | Standard message S-`ACCOUNT_NOT_FOUND` | `failed` | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "Payments are limited in USD. Choose a USD account. Nothing was changed." | `failed` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount in USD with at most 2 decimal places." | `details` | Change amount |
| `NOT_AUTHORISED` / `PERMISSION_DENIED` (planned) | "Your role doesn't allow this. Ask an administrator at Alpha Trading LLC." | `denied` | Back |
| `WRONG_CONTEXT` (planned) | Standard message S-`WRONG_CONTEXT` | `wrongContext` | Switch |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `unavailable` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | Standard message S-`SERVICE_UNAVAILABLE` | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | as `supplier-payment` | as `supplier-payment` | as there | Existing |
| `getPayment` | `corp.payments.get` | `{ paymentId }` | the payment | `PAYMENT_NOT_FOUND`, `PERMISSION_DENIED` | Existing |
| `saveTemplate` | `corp.templates.save` | `{ templateId?, name, beneficiaryId, fromAccountId, amount?, reference?, purpose? }` | the template | `TEMPLATE_NAME_TAKEN`, `TEMPLATE_LIMIT`, `BENEFICIARY_NOT_WHITELISTED`, `ACCOUNT_NOT_FOUND`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: false` | **(planned)** |
| `deleteTemplate` | `corp.templates.delete` | `{ templateId }` | `{ deleted: true }` | `TEMPLATE_NOT_FOUND`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: false` | **(planned)** |
| `templates` | `corp.templates.list` | `{}` | `{ items }` | see shell | **(planned)** |

#### 6. Permissions, step-up and limits

`biz.templates.manage`; step-up `none`. At most 50 templates per company. A template never bypasses a limit: limits, whitelist and approvals are checked when the payment is started.

#### 7. Result and links out

Result `success`. Receipt: none. Notifications: none. Buttons: Use it now (`supplier-payment`, `{templateId}`), Schedule it (`schedule-business-payment`, `{templateId}`), View templates, Done (returns to where the person started; from the tracker, back to Payment detail).

#### 8. Acceptance criteria

- **AC-1** Only a context with `biz.templates.manage` can save, change or delete a template.
- **AC-2** A template can only use an approved supplier and a USD account.
- **AC-3** Template names are unique in the company and limited to 50 templates.
- **AC-4** Saving from a payment fills in that payment's supplier, account, reference and purpose.
- **AC-5** Saving a template starts no payment and moves no money.
- **AC-6** A template whose supplier is no longer approved cannot be used.
- **AC-7** When the bank times out or is unavailable, nothing is saved and the person is told so.

#### 9. Scenarios

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-1 | Save a new template | AC-1, AC-5 | `alpha`; name "Monthly packaging", supplier Nile Packaging, amount blank | `success` "Template saved"; no payment in the tracker; balance unchanged |
| T-2 | Save from a payment | AC-4 | `alpha`; setup: Alex starts a payment (USD 12,500.00, ref INV-1001) | fields prefilled; saved template has amount 12,500.00 and reference INV-1001 |
| T-3 | Approver cannot save | AC-1 | `beta-alex` | `denied` |
| T-4 | Unapproved supplier | AC-2 | `alpha`; supplier Cedar Tools | `BENEFICIARY_NOT_WHITELISTED` message shown; nothing saved |
| T-5 | Euro account refused | AC-2 | `alpha`; Reserve ••6101 | "Payments are limited in USD. Choose a USD account." |
| T-6 | Duplicate name | AC-3 | `alpha`; setup saves "Monthly packaging"; save the same name | "You already have a template with this name." |
| T-7 | Fifty templates | AC-3 | `alpha`; setup saves 50 templates | the 51st gives `TEMPLATE_LIMIT` |
| T-8 | Supplier becomes unapproved | AC-6 | `alpha`; setup: disable the supplier | Templates shows "Supplier not approved"; Use is disabled |
| T-9 | **Timeout** | AC-7 | conditions `timeout: ["corp.templates.save"]` | `unavailable`; template list unchanged |
| T-10 | **Unavailable** | AC-7 | conditions `unavailable: ["corp.templates.save"]` | `unavailable` with the standard message |

#### 10. Expected mutation-check survivors

None expected. If the 50-template limit mutant survives in the sandbox seed, T-7 is the scenario that must kill it.

---

### ★ Schedule a business payment — `schedule-business-payment`

#### 1. Summary

| | |
|---|---|
| Slug | `schedule-business-payment` |
| Purpose | A Maker sets up a payment to a whitelisted supplier in the United States, Europe, the United Kingdom, the Middle East (or a SWIFT country) that starts on a future business day, or repeats. Every run is a normal payment that still needs approval, and it is checked again on the day. |
| Release | 1 |
| Workspace | Business |
| Status | **New (planned).** No fixture; the Personal `schedule-payment` is the sibling. Needs `corp.schedules.*`, `corp.payments.quote` and `corp.payments.create` (09 section 13). |
| Channels | web, mobile |
| Starting pattern | `corporate-payment` (the same rules per run) plus `datePicker` (planned); the rails, amounts, purpose, scheduling and error codes of `09-payment-rails.md` (called "09" below). |
| Who may use it | `biz.payments.schedule` and `biz.payments.initiate` (a schedule starts payments as the Maker). |

A schedule is a standing instruction. Each run starts at **09:00 UTC** on the run date (before every cut-off), as a payment started by the person who made the schedule, and waits for approval like any payment. A run never moves money by itself. The supplier's currency, rate and the rail's rules are those of `supplier-payment`; this journey adds dates, repeating, and the checks on the day.

**Business days and cut-offs by region** (09 section 8; the sandbox calendar below is a proposal because 09 does not list holidays). The date picker disables a date that is not a business day for the supplier's region. 9 Nov 2026 is closed for every region (the existing company closed day).

| Supplier's region | Weekend | Other closed days in the sandbox (Nov 2026 to Jan 2027) | Approval deadline on the run date (UTC) |
|---|---|---|---|
| United States | Saturday, Sunday | 11 Nov, 26 Nov, 25 Dec, 1 Jan | 16:00 (all US rails; the Same-day ACH and wire cut-offs are later) |
| Europe | Saturday, Sunday | 25 Dec, 1 Jan | 14:00 for SEPA Credit Transfer; 16:00 for SEPA Instant |
| United Kingdom | Saturday, Sunday | 25 Dec, 28 Dec, 1 Jan | 16:00 (CHAPS closes at 17:00 UK, later) |
| UAE | Saturday, Sunday | 2 Dec, 3 Dec, 1 Jan | 11:00 for UAEFTS; 16:00 for Aani |
| Saudi Arabia | Friday, Saturday | none in the window | 12:00 for SARIE; 16:00 for sarie instant |
| Jordan | Friday, Saturday | 25 Dec | 11:00 for JoPACC; 16:00 for CliQ |
| SWIFT countries | Saturday, Sunday | 25 Dec, 1 Jan | 15:00 |

The **approval deadline** is the earlier of the company cut-off (16:00 UTC) and the rail's own cut-off converted to UTC (09 section 2, clocks as in November 2026). An instant rail has no cut-off of its own, so a scheduled instant payment uses the company cut-off of 16:00 UTC: a schedule has a fixed day, so it needs a deadline.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › hub › Schedule a payment | `{templateId}` optional | `biz.payments.schedule` |
| Payments › templates › Schedule | `{templateId}` | `biz.payments.schedule` |
| Payments › scheduled › Schedule a payment | none | `biz.payments.schedule` |
| `payment-template` result › Schedule it | `{templateId}` | `biz.payments.schedule` |
| `supplier-payment` › amount screen › "Later" | supplier, amount, rail, purpose, reference, date, repeat; opens at `review` | `biz.payments.schedule` and `biz.payments.initiate` |

#### 3. Screens

Screen ids: `details`, `when`, `review`, `otp`, `success`, `failed`, `unavailable`, `denied`, `wrongContext`.

**Screen `details` — "What to pay"**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Use a template (`sch.templateId`) | `select` rows (templates), "Don't use a template" first | no | an existing template | "Choose a template or fill in the details." |
| Supplier (`sch.beneficiaryId`) | `beneficiaryPicker`, whitelisted suppliers only, each with region, country, masked account and the chip "Whitelisted"; no new-payee form (an "Add supplier" link explains that an administrator whitelists new suppliers) | yes | whitelisted supplier | "Choose a whitelisted supplier." |
| From (`sch.fromAccountId`) | `accountPicker` | yes | a USD account | "Choose an account." |
| They receive (`sch.amount`) | `amountInput` in the supplier's currency | yes | greater than 0; the currency's decimals; the USD amount at today's indicative rate at most the person's daily limit (250,000.00) | "Enter an amount." / "Enter an amount in {cur} with at most {n} decimal places." / "That is above your daily limit of USD 250,000.00." (`LIMIT_USER_EXCEEDED`) |
| Speed (`sch.rail`) | `select` cards of the supplier's region (09 section 2); default is the first rail that fits | yes | a rail the amount fits; an unavailable rail shows "Not available right now" | `RAIL_LIMIT`: "That's over the {rail} limit of {limit}. Choose another way to send it."; `RAIL_NOT_AVAILABLE`: "{rail} isn't available right now. Choose another way to send it." |
| Purpose (`sch.purpose`) | `select` rows (09 section 7) | yes | one of the list | "Choose a purpose for this payment." (`PURPOSE_REQUIRED`) |
| Invoice or PO number (`sch.reference`) | `textInput` | yes | up to the region's limit (US 80, Europe 140, UK 18, Middle East and SWIFT 140); allowed characters as 09 section 7 | "Enter the invoice or PO number." |
| Charges (`sch.charges`), SWIFT only | `select` chips Shared, I pay all, They pay (09 section 6) | yes (SWIFT) | `SHA`, `OUR`, `BEN` | "Choose who pays the charges." |

Copy: title "Schedule a payment". Info alert: "Each time, the payment waits for approval. It has to be fully approved by the cut-off on the day, or it is not sent." A conversion line appears when the supplier's currency is not USD: "At today's rate 1 USD = 0.926 EUR this is about USD 12,203.02. The rate is set on the day." Buttons "Continue", "Cancel".

**Screen `when` — "When"**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| How often (`sch.frequency`) | `select` chips: "Once", "Every week", "Every month" | yes | one of three | "Choose how often." |
| First payment on (`sch.startDate`) | `datePicker` (planned) | yes | tomorrow or later; no more than 24 months ahead; a business day for the supplier's region (weekends, the region's closed days and 9 Nov 2026 are disabled) | "Choose a date from tomorrow." / "Choose a date within 24 months." / "Choose a business day for {region}." (`SCHEDULE_DATE_INVALID`) |
| Ends (`sch.ends`) | `select` chips: "Never", "After a number of payments", "On a date" (not for "Once") | yes if repeating | one of three | "Choose when it ends." |
| Number of payments (`sch.count`) | `textInput` | if "After a number" | whole number 2 to 60 | "Enter a number from 2 to 60." |
| End date (`sch.endDate`) | `datePicker` | if "On a date" | after the first payment, within 24 months | "Choose a date after the first payment." |

Copy: title "When". Helper under the date: "Only business days for {region} can be chosen." A disabled date has the tooltip "Closed in {region}". A repeat that lands on a weekend or closed day for the region moves to the next business day, and the list shows "Runs on {date} instead of {date}". A monthly schedule on the 31st: "On shorter months it runs on the last business day." Buttons "Continue", "Back".

**Screen `review` — "Review schedule"**
`reviewSummary` rows: Supplier (name, region, country), From, They receive, Sent by (rail), Rate ("Set on the day"; with a foreign currency also "About USD {n} today"), Fee, Purpose, Invoice or PO number, Charges (SWIFT), How often, First payment, Ends, "Approval needed" ("1 approver" or "2 approvers" by the USD amount, 2 above 50,000.00; "checked again on the day"), and "Approve by" ("{time} UTC on each run date", from the table in section 1). A note when the USD amount is 25,000.00 or more: "Approvers will be asked for an extra security check." Alert info "Nothing leaves your account now. The checks run again on each date." `consent` (`sch.consent`): "I understand each payment still needs approval and I can stop this at any time" (`mustBeTrue`, "Tick the confirmation first."). Button "Confirm and send OTP". "Back".

**Screen `otp` — "Authorise this schedule"**
A schedule is a standing instruction, so the code is always asked. The prompt names the schedule (dynamic linking, 09 section 9): "Authorise EUR 11,300.00 to Nordic Supplies AB, every month from 12 Nov 2026". The code only works for this schedule; changing the amount, supplier, rail or dates after the code was sent voids it (`STEP_UP_FAILED`). `otp` block: 6 digits, 3 attempts, resend after 30 s. Field `otp.code`: required, pattern `^[0-9]{6}$`, message "Enter the 6-digit code." Wrong code: "That code isn't right. {n} tries left." Third wrong code: `failed`, "Too many wrong codes. Start again." Button "Verify and schedule". There is no separate password step.

**Screen `success` — "Payment scheduled"**
`result` success: title "Payment scheduled", text "{amount in supplier currency} to {supplier}, {frequency}, from {firstRun}. Each payment waits for approval and must be approved by {time} UTC on the day.", meta "Schedule {id}". Buttons "View scheduled payments" (Payments › scheduled, which shows the next date and the amount in the supplier's currency), "Schedule another", "Done".

#### 4. Sandbox errors

| Code | What the person sees | Screen | Button |
|---|---|---|---|
| `OTP_INVALID`, `OTP_REQUIRED` | Standard (README 1.6) | `otp` / `failed` | Try again / Start again |
| `STEP_UP_FAILED` | "Too many wrong codes. Start again." / "The schedule changed, so that code no longer works. Start again." | `failed` | Start again |
| `SCHEDULE_DATE_INVALID` (planned) | "Choose a business day for {region}, from tomorrow and within 24 months." | `when` | Change date |
| `SCHEDULE_LIMIT` (planned) | "You have 25 active schedules, the most allowed. Stop one to add another. Nothing was changed." | `failed` | View scheduled |
| `BENEFICIARY_NOT_WHITELISTED` | "This supplier isn't on Alpha Trading LLC's whitelist. Nothing was changed." | `failed` | Choose supplier |
| `LIMIT_USER_EXCEEDED` | "This is above your daily limit of USD 250,000.00. Nothing was changed." (tested on the USD amount at the indicative rate) | `failed` | Change amount |
| `CURRENCY_NOT_SUPPORTED` | "Payments are limited in USD. Choose a USD account. Nothing was changed." | `failed` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount in {cur} with at most {n} decimal places." | `details` | Change amount |
| `RAIL_LIMIT`, `RAIL_NOT_AVAILABLE` (planned, 09) | Messages in section 3 | `details` | Choose another speed |
| `PURPOSE_REQUIRED` (planned, 09) | "Choose a purpose for this payment." | `details` | Choose purpose |
| `ACCOUNT_NOT_FOUND` | Standard (README 1.6) | `failed` | Choose account |
| `NOT_AUTHORISED` / `PERMISSION_DENIED` (planned) | Standard S-`PERMISSION_DENIED` | `denied` | Back |
| `WRONG_CONTEXT`, `STEP_UP_REQUIRED` (planned) | Standard | `wrongContext` / `otp` | Switch / Confirm |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. Nothing was changed." | `failed` | Try again |
| `TIMEOUT` (planned) | "We didn't get an answer in time. Check Scheduled before you try again, so you don't create it twice." | `unavailable` | Check Scheduled |
| `SERVICE_UNAVAILABLE` (planned) | Standard | `unavailable` | Try again |

**At run time** (not in the journey), the run checks everything again on the date, with the same rules and messages as `supplier-payment`: the supplier is still whitelisted (`BENEFICIARY_NOT_WHITELISTED`), the rail is still available (`RAIL_NOT_AVAILABLE`) and the amount still fits it (`RAIL_LIMIT`), a new quote is taken at the day's rate, the purpose is still given, the account has enough money for **You pay** (`INSUFFICIENT_FUNDS`), and the person and company limits are met on the USD amount at the day's rate (`LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`). A run that fails starts no payment, marks the schedule `failed_last_run` and raises a notification (section 7). No automatic retry and no automatic switch to another rail. A repeating schedule goes on to its next date.

After the run starts the payment, the approval deadline in section 1 applies. A payment that is not fully approved by the deadline is **not sent**: `NOT_APPROVED_IN_TIME`, "This payment wasn't approved in time and has not been sent." It is stored as `rejected` with the reason "Not approved in time", the schedule run is marked failed, and no money moves. Partial approval does not count (1 of 2 is not enough). A later run of the same schedule is not affected.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company`, `otpSend`, `otpVerify` | as `supplier-payment` | | | | Existing |
| `templates` | `corp.templates.list` | `{}` | `{ items }` | see shell | **(planned)** |
| `quote` | `corp.payments.quote` | as `supplier-payment`; used only to show the indicative amount and check rail and limit | as `supplier-payment` | as `supplier-payment` | **(planned)** |
| `createSchedule` | `corp.schedules.create` | `{ templateId?, beneficiaryId, fromAccountId, amount, currency, rail, purpose, reference, charges?, frequency, startDate, ends, count?, endDate? }` | `{ id, status: "active", nextRunDate, approveBy, ... }` | `OTP_REQUIRED`, `STEP_UP_FAILED`, `SCHEDULE_DATE_INVALID`, `SCHEDULE_LIMIT`, `BENEFICIARY_NOT_WHITELISTED`, `LIMIT_USER_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `RAIL_LIMIT`, `RAIL_NOT_AVAILABLE`, `PURPOSE_REQUIRED`, `ACCOUNT_NOT_FOUND`, `NOT_AUTHORISED`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `STEP_UP_REQUIRED`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: true` | **(planned)** |
| `runSchedules` | `corp.schedules.run` | `{ now }` (sandbox clock) | the payments started, the failures with their codes, and the payments that missed their approval deadline (`NOT_APPROVED_IN_TIME`) | `PERMISSION_DENIED` | **(planned, sandbox-only; used by scenarios to move time forward)** |

Each run uses `corp.payments.quote` and `corp.payments.create` (09 section 13) as the Maker. Scenarios may set the sandbox condition `rates: { EUR: 0.92 }` (planned) to move a rate between creation and the run.

#### 6. Permissions, step-up and limits

`biz.payments.schedule` and `biz.payments.initiate`. Step-up: the code at creation with dynamic linking, always; approvers get the extra check from 25,000.00 USD equivalent at each run (`approve-payments`). At most 25 active schedules per company; 24 months ahead at most. Limits, the whitelist, the rail and the funds are checked at creation (on the USD amount at the indicative rate) **and again at each run** (on the USD amount at the day's rate). The number of approvers (1, or 2 above 50,000.00 USD) is decided at each run from the day's USD amount. Rail maximums are in the rail's own currency (09 section 2).

#### 7. Result and links out

Result `success`. Receipt: none. Notifications: on creation, none; at each run, to the Maker "Scheduled payment started: {amount} to {supplier}. It's waiting for approval." and to approvers "Payment awaiting your approval, Alpha Trading LLC. Approve by {time} UTC."; on a failed run, to the Maker "A scheduled payment didn't start: {message}. Nothing was paid."; on a missed deadline, to the Maker and to the approvers "This payment wasn't approved in time and has not been sent." Buttons: View scheduled payments, Schedule another, Done.

#### 8. Acceptance criteria

- **AC-1** Only a context with `biz.payments.schedule` and `biz.payments.initiate` can schedule a payment.
- **AC-2** The first date must be tomorrow or later, within 24 months, and a business day for the supplier's region; weekends and the region's closed days are disabled, and a repeat that lands on one moves to the next business day, which the person sees.
- **AC-3** Only a whitelisted supplier and a USD account can be scheduled; the amount is in the supplier's currency; the USD amount cannot exceed the person's daily limit.
- **AC-4** Each region schedules with its own rails: the default rail, the choice of other rails, the rail maximum (`RAIL_LIMIT`) and the reference length follow 09; an instant rail can be scheduled and goes at 09:00 UTC on its date.
- **AC-5** Purpose and the invoice or PO number are required (`PURPOSE_REQUIRED`).
- **AC-6** Creating a schedule moves no money and starts no payment; the rate is not fixed, and the review says so.
- **AC-7** Each run takes a new quote, starts a payment that waits for approval, and counts against the limits on the USD amount of that day.
- **AC-8** On the date the run checks again: whitelist, rail availability, rail maximum, funds and limits. A run that fails starts nothing and tells the Maker why.
- **AC-9** A scheduled payment not fully approved by the approval deadline for its rail and region is not sent (`NOT_APPROVED_IN_TIME`), money does not move, and the Maker and approvers are told; later runs continue.
- **AC-10** The review shows the approvers needed and the "Approve by" time for the region and rail.
- **AC-11** A schedule is not created without the confirmation and a correct six-digit code that names the schedule; three wrong codes, or a change after the code was sent, stop it (`STEP_UP_FAILED`).
- **AC-12** A schedule whose payments need two approvers (above 50,000.00 USD at the indicative rate) says so at review.
- **AC-13** When the bank times out or is unavailable, no schedule is created and the person is told so.

#### 9. Scenarios

Persona `alpha` is Alex Morgan as Maker at Alpha. Suppliers as in `supplier-payment` section 9. `now` is `2026-11-03T10:00:00Z` unless stated. Rates: EUR 0.926, GBP 0.781, AED 3.672 unless a scenario sets a rate.

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-1 | US monthly payment from a template | AC-1, AC-4, AC-6 | `alpha`; template "Monthly packaging" (Harbour Packaging, USD 12,500.00, ACH); every month from 2026-11-20; ends never | `success`; no payment exists; balance unchanged; the review shows "Approve by 16:00 UTC" |
| T-2 | Approver cannot schedule | AC-1 | `beta-alex` | `denied` |
| T-3 | Date in the past | AC-2 | `alpha`; start date 2026-11-03 | "Choose a date from tomorrow." |
| T-4 | Closed Monday cannot be chosen | AC-2 | `alpha`; start date 2026-11-09 | the picker disables 9 Nov 2026 ("Closed in United States"); forced through the adapter gives `SCHEDULE_DATE_INVALID` |
| T-5 | Over 24 months | AC-2 | `alpha`; start 2029-01-01 | "Choose a date within 24 months." |
| T-6 | A repeat lands on a weekend | AC-2 | `alpha`; Harbour, every month from 2026-11-30 | the list shows the third run as "Runs on Mon 1 Feb 2027 instead of Sat 30 Jan 2027" |
| T-7 | The calendar follows the region | AC-2 | `alpha`; pick Wed 2 Dec 2026 for Gulf Trade FZE, then for Harbour Packaging | disabled for Gulf Trade ("Closed in UAE"); allowed for Harbour |
| T-8 | Europe schedule | AC-3, AC-4, AC-10 | `alpha`; Nordic Supplies AB, EUR 11,300.00, SEPA Credit Transfer, once on 2026-11-12 | review shows "About USD 12,203.02", "Rate: set on the day", "Approve by 14:00 UTC"; `success` |
| T-9 | UK weekly and Middle East schedules | AC-4 | `alpha`; Whitby Logistics, GBP 5,000.00, Faster Payments, weekly from 2026-11-06; then Gulf Trade FZE, AED 18,360.00, UAEFTS, once on 2026-11-12 | both created; the UK reference field stops at 18 characters; the Gulf review shows "Approve by 11:00 UTC" |
| T-10 | Rail limit and default | AC-4 | `alpha`; Harbour, USD 25,000.01 | default rail moves to Same-day ACH; forcing ACH gives `RAIL_LIMIT` |
| T-11 | Purpose and reference required | AC-5 | `alpha`; purpose empty, then reference empty | "Choose a purpose for this payment."; "Enter the invoice or PO number."; Continue disabled |
| T-12 | Unapproved supplier, euro account, over the limit | AC-3 | `alpha`; Cedar Tools; Reserve ••6101; Harbour USD 250,000.01 | each refused with its message; nothing created |
| T-13 | A run starts a payment | AC-7 | `alpha`; Harbour, USD 12,500.00 once for 2026-11-04; run `corp.schedules.run` at 2026-11-04T09:00:00Z | one payment Pending approval, started by Alex, value date 2026-11-04; Alex's used limit rises by the amount; approvers notified "Approve by 16:00 UTC" |
| T-14 | The run takes a new rate and tests the USD limit | AC-7, AC-8 | `alpha`; Nordic, EUR 231,000.00 (USD 249,460.04) once for 2026-11-04; condition `rates: { EUR: 0.92 }` at the run | creation accepted; the run computes USD 251,086.96 and fails with `LIMIT_USER_EXCEEDED`; no payment; schedule `failed_last_run` |
| T-15 | A failed run: supplier disabled | AC-8 | `alpha`; schedule for 2026-11-04; supplier disabled before the run | no payment; `failed_last_run`; notification "A scheduled payment didn't start" with `BENEFICIARY_NOT_WHITELISTED` |
| T-16 | A failed run: instant rail down on the day | AC-8 | `alpha`; Nordic, EUR 5,000.00, SEPA Instant, once for 2026-11-04; at the run `unavailable: ["rail:sinst"]` | no payment; `failed_last_run` with `RAIL_NOT_AVAILABLE`; no automatic switch to SEPA Credit Transfer |
| T-17 | A failed run: not enough money | AC-8 | `alpha-low-balance`; Harbour, USD 12,500.00 for 2026-11-04 | `INSUFFICIENT_FUNDS`; no payment |
| T-18 | Not approved in time | AC-9 | `alpha`; Nordic, EUR 11,300.00, SEPA Credit Transfer, for 2026-11-12; run at 09:00; no approval; sweep at 2026-11-12T14:00:01Z | `NOT_APPROVED_IN_TIME`; the payment is `rejected` with "Not approved in time"; balance unchanged; Maker and approvers notified |
| T-19 | Approved just in time | AC-9 | as T-18 but `dana` approves at 2026-11-12T13:59:59Z | the payment is released with value date 2026-11-12 |
| T-20 | Half approved is not enough | AC-9, AC-12 | `alpha`; Whitby, GBP 40,000.00 (USD 51,216.39) for 2026-11-12; `dana` approves at 15:00; sweep at 2026-11-12T16:00:01Z | review had said "2 approvers"; `NOT_APPROVED_IN_TIME`; nothing sent |
| T-21 | Large amount shows the extra check | AC-12 | `alpha`; Harbour, USD 60,000.00, Same-day ACH | review: "2 approvers", "Approvers will be asked for an extra security check."; the creation still needs only the code |
| T-22 | Confirmation and codes | AC-11 | `alpha`; untick; then `999999` three times | "Tick the confirmation first."; then "Too many wrong codes. Start again." (`STEP_UP_FAILED`); no schedule |
| T-23 | Code is tied to the schedule | AC-11 | `alpha`; code requested; person goes Back and changes the amount; old code entered | `STEP_UP_FAILED`; no schedule |
| T-24 | **Timeout** | AC-13 | conditions `timeout: ["corp.schedules.create"]` | `unavailable`; Scheduled list unchanged |
| T-25 | **Unavailable** | AC-13 | conditions `unavailable: ["corp.schedules.create"]` | `unavailable` "Nothing was changed." |

#### 10. Expected mutation-check survivors

| Survivor | Reason |
|---|---|
| 25-schedule limit | No scenario creates 25 schedules; listed with the reason that the seed has 2. |
| Region holiday dates other than 9 Nov, 2 Dec (UAE) and weekends | No scenario uses them; the list is sandbox data. |
| Saudi Arabia and Jordan weekend (Friday and Saturday) | Alpha has no supplier in those countries; a planned persona variant would prove it. |
| Monthly "last business day of a short month" rule | No scenario starts a schedule on the 31st. Add one if this should be proved. |
| The approval deadline of rails not used in a scenario (SARIE, JoPACC, SWIFT) | Only SEPA Credit Transfer, UAEFTS and the company cut-off are asserted. |
| The text of each message and the specific rates | Tests check the code and a fixed rate table (09 section 15). |

---

### ★ Withdraw a payment — `withdraw-payment`

> The existing journey is `withdraw-a-payment` (`packages/journey-schema/src/fixtures/withdraw-payment.ts`, made by the generator, English only, app `meezan`). README 5.3 calls it `withdraw-payment`. The slug must be aligned (see "README changes needed" in the report of this file). This spec uses `withdraw-payment` and says "today" for the fixture.

#### 1. Summary

| | |
|---|---|
| Slug | `withdraw-payment` (fixture slug today: `withdraw-a-payment`) |
| Purpose | The person who started a payment takes it back while it waits for approval. |
| Release | 1 |
| Workspace | Business |
| Status | **Existing, upgraded.** 6 criteria, 18 scenarios, proved on both bank APIs. |
| Channels | web, mobile |
| Starting pattern | The existing `withdraw-a-payment` fixture; adapter `corp.payments.withdraw`. |
| Who may use it | The context holds `biz.payments.withdraw` **and** is the person who started the payment. |

**The screens as built today**

| Screen id | Title | What it does |
|---|---|---|
| `who` | Sign in | The sandbox "who am I" choice (`session.userId`). Button "Continue" loads the company and goes to `start`; a user who is not an initiator goes to `denied`. |
| `start` | Waiting for approval | Calls `corp.payments.pending` with `{ userId, as: "initiator" }`. Caption "Payments you started that are waiting for approval. You can withdraw one before it is approved." If none: "Nothing you started is waiting for approval." Else a `menu`: label "{amount} to {supplier}", text "{reference} · {n} of {required} approved". A tap sets `wd.paymentId` and goes to `review`. Button "Close". |
| `review` | Withdraw payment | `reviewSummary` (From, To, Amount, Reference, Approved so far, Value date); warning `alert` "Once withdrawn, the payment can no longer be approved, even if an approver has already approved it. To pay this supplier you would start a new payment."; buttons "Withdraw and send code" and "Keep it". There is **no consent block** today. |
| `otp` | Verify | `otp` block (6 digits, 3 attempts, resend after 60 s); button "Verify and withdraw". Wrong code: toast "Incorrect code"; third wrong code to `failed`. |
| `withdrawn` | Withdrawn | Reloads the company (`ctx.company`); `result` success "Payment withdrawn", text "{amount} to {supplier} can no longer be approved. No money has left the account."; text "The amount has been given back to your daily limit. You can still start {remainingToday} today."; buttons "Back to the list", "Close". |
| `failed` | Not withdrawn | `result` error "The payment was not withdrawn", text `ctx.error.message`; caption "Nothing has changed. If an approver has already released or rejected it, it can no longer be withdrawn."; buttons "Back to the list", "Close". |
| `unavailable` | Not available | `result` error "Not available for this customer"; buttons "Try again" (to `who`), "Close". |
| `denied` | Not allowed | "You can't do this. Only the person who started a payment can withdraw it." Button "Close". |

Two facts about the fixture the upgrade must fix: the `start` list and the `review` summary read the supplier name through `ctx.company.beneficiaries[item.beneficiaryId].name`, which is blank for a bulk file (`beneficiaryId` is "bulk") or payroll run ("payroll"); the adapter result already carries `payee`, so the upgrade uses `item.payee`. And the sandbox adapter `corp.payments.withdraw` does **not** check the one-time code (no `OTP_REQUIRED` in `index.ts`); the journey asks for it, but only the journey enforces it today.

**What the upgrade changes**

1. No `who` screen; the acting user is the active context's user (`PERMISSION_DENIED` for a different `userId`).
2. Entry with `{paymentId}` from the tracker skips the `start` list and opens `review`.
3. `payee` instead of the beneficiary lookup, so bulk and payroll payments read correctly.
4. A `consent` block ("I understand this payment can no longer be approved").
5. The adapter enforces the one-time code (`OTP_REQUIRED`) (planned; see open questions).
6. A `timeline` on the review so the person sees who has already approved.
7. `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE`, `SESSION_EXPIRED`.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › tracker › payment › Withdraw | `{paymentId}` | `biz.payments.withdraw` |
| Payments › hub › Needs your attention › Withdraw | `{paymentId}` | `biz.payments.withdraw` |
| Payment detail › Withdraw | `{paymentId}` | `biz.payments.withdraw` |
| Deep link `bankworkx://business/alpha/j/withdraw-payment?paymentId=pay_1` | `{paymentId}` | `biz.payments.withdraw` |

Without `{paymentId}` (for example from the ⌘K bar) the journey opens on `start`.

#### 3. Screens

Screen ids: `start`, `review`, `otp`, `withdrawn`, `failed`, `unavailable`, `denied`, `wrongContext`.

**Screen `start` — "Waiting for approval"**
Unchanged copy. List fed by `corp.payments.pending` `{ as: "initiator" }`. Row label "{amount} to {payee}", row text "{reference} · {n} of {required} approved". Empty: "Nothing you started is waiting for approval." with button "Pay a supplier" (`supplier-payment`) in addition to "Close". Loading: skeleton rows. Error: `unavailable`.

**Screen `review` — "Withdraw payment"**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| I understand this payment can no longer be approved (`wd.consent`) | `consent`, `termsVersion: "corporate-v1"` (planned upgrade) | yes | `mustBeTrue` | "Tick the confirmation first." |

Other blocks: `reviewSummary` (From, To (`payee`), Amount, Reference, Approved so far, Value date), `timeline` (Started by me; each approval so far), warning `alert` as today, buttons "Withdraw and send code" (validate, send code, `otp`) and "Keep it" (to `start`, or exit when opened by `{paymentId}`).

**Screen `otp`** as today; button "Verify and withdraw"; field `otp.code` required, pattern `^[0-9]{6}$`, message "Enter the 6-digit code."; resend after 30 s (upgrade from 60).

**Screen `withdrawn`** as today, plus a `statusChip` **Withdrawn**, buttons "Track payment" (Payment detail), "Back to the list", "Pay a supplier" (`supplier-payment`), "Done". For a payroll run: extra line "The pay period {period} is free again. You can run payroll for it."

**Screen `failed`** as today (the message comes from the error table); caption "Nothing has changed." **Screen `unavailable`**, **`denied`**, **`wrongContext`**: see section 4.

#### 4. Sandbox errors

| Code | Adapter message today | What the person sees | Screen | Button |
|---|---|---|---|---|
| `PAYMENT_NOT_PENDING` | "This payment is already {status}" (status is "released" or "rejected") | "This payment was not withdrawn. It is already {released, rejected or withdrawn}. Nothing has changed." | `failed` | Back to the list |
| `NOT_AUTHORISED` | "{name} can only withdraw payments they started" | "Only the person who started a payment can withdraw it. Nothing has changed." | `failed` / `denied` | Back to the list / Close |
| `PAYMENT_NOT_FOUND` | "No payment {id}" | "We can't find that payment." | `failed` | Back to the list |
| `USER_NOT_FOUND` | "No user {id} at {company}" | "We can't find your user at {company}. Sign in again." | `failed` | Sign in |
| `OTP_INVALID` | "Incorrect code" | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." (the payment keeps waiting) | `otp` / `failed` | Try again / Start again |
| `OTP_REQUIRED` (planned for this adapter) | none today | "Confirm with your one-time code first." | `otp` | Back to code |
| `PERMISSION_DENIED` (planned) | none today | "Your role doesn't allow this. Ask an administrator at Alpha Trading LLC." | `denied` | Back |
| `WRONG_CONTEXT` (planned) | none today | "This belongs to your Business banking. Switch to Business to continue." | `wrongContext` | Switch |
| `STEP_UP_REQUIRED` | not used | Not used: withdrawing is `otp` level. | none | none |
| `CORE_UNAVAILABLE` | "Core banking unavailable" (not raised by this adapter today) | "We couldn't complete this right now. Nothing has changed." | `failed` | Try again |
| `TIMEOUT` (planned) | none | "We didn't get an answer in time. Open the payment to see whether it was withdrawn before you try again." | `unavailable` | Open payment |
| `SERVICE_UNAVAILABLE` (planned) | none | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `unavailable` | Try again |
| `SESSION_EXPIRED` (planned) | none | Standard (README 1.6) | `unavailable` | Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `people` | `corp.users.list` | none | the company's people | none | Existing (removed from the Business journey after step 2) |
| `company` | `corp.company.get` | `{ userId }` (today) | company with `me.remainingToday` | as `supplier-payment` | Existing |
| `pending` | `corp.payments.pending` | today `{ userId, as: "initiator" }`; upgrade `{ as: "initiator" }` | payments by id, each with `payee`, `required`, `approvals`, `valueDate` | `USER_NOT_FOUND`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing |
| `payment` | `corp.payments.get` | `{ paymentId }` | the payment | `PAYMENT_NOT_FOUND`, `PERMISSION_DENIED` (the payment must belong to the active company) | Existing; the access check is planned |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as `supplier-payment` | as there | `OTP_INVALID` | Existing |
| `withdraw` | `corp.payments.withdraw` | today `{ userId, paymentId }`; upgrade `{ paymentId }` | the payment, `status: "rejected"`, `rejectReason: "Withdrawn by the person who started it"`, `rejectedBy`, `rejectedAt` | `NOT_AUTHORISED`, `PAYMENT_NOT_PENDING`, `PAYMENT_NOT_FOUND`, `USER_NOT_FOUND`; planned `OTP_REQUIRED`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false` (it only gives the Maker's daily limit back), `requiresOtp`: no today, **yes** after the upgrade | Existing, extended |

Checks the sandbox makes, in order: user, payment, pending, initiator. Side effects: the payment becomes `rejected`; the Maker's `usedToday` goes down by the payment amount (never below 0); for payroll the period is free again (`PAYROLL_ALREADY_RUN` no longer applies).

#### 6. Permissions, step-up and limits

`biz.payments.withdraw` (checks 1 to 3) plus the sandbox rule that only the starter can withdraw (so an Admin or another Maker is refused with `NOT_AUTHORISED`). Step-up `otp`. Limits: none are consumed; the Maker's remaining daily limit increases by the payment amount. A payment one approver has already approved can still be withdrawn. A released payment cannot.

#### 7. Result and links out

Result `withdrawn` with status **Withdrawn**. Receipt: none (the timeline records it). Notifications: to approvers who had approved or were waiting "{name} withdrew a payment you were asked to approve. No action needed." The payment disappears from their inbox. Buttons: Track payment (Payment detail), Back to the list, Pay a supplier (`supplier-payment`), Done.

#### 8. Acceptance criteria

(The first six are the fixture's own criteria. AC-7 to AC-10 are the upgrade.)

- **AC-1** Someone who is not an initiator, or who has not said who they are, cannot continue; a non-initiator is told only the person who started a payment can withdraw it.
- **AC-2** Only the payments the person started that are still waiting for approval are listed, and the screen says so when there are none.
- **AC-3** A correct six-digit code is needed; with a wrong or short code the payment keeps waiting; three wrong codes end the journey without withdrawing.
- **AC-4** A withdrawn payment is closed, moves no money, and its amount comes back to the initiator's daily limit, even if one of two approvers had approved it.
- **AC-5** A payment that is already closed (released, rejected or withdrawn) cannot be withdrawn and nothing changes.
- **AC-6** A customer who is not a company is told it is not available.
- **AC-7** The acting person comes from the active context; a call that names a different user is refused (`PERMISSION_DENIED`), and a context without `biz.payments.withdraw` is refused.
- **AC-8** Opened with a `paymentId`, the journey goes straight to the review of that payment; a bulk or payroll payment shows its payee text.
- **AC-9** The withdrawal is not sent without the confirmation.
- **AC-10** When the bank times out or is unavailable, the payment keeps waiting and the person is told what to do.

#### 9. Scenarios

Existing scenarios T-1 to T-18 in the fixture cover AC-1 to AC-6 (an approver is refused; unknown company user; no "who"; a person with both roles sees their own waiting payment; another person's payment is not listed; a released payment is not listed; nothing waiting; another person's payment cannot be withdrawn by id; wrong code; three wrong codes; short code; withdrawing frees the limit; one approver already approved; only the withdrawn amount returns; full-limit return; already released, already rejected, already withdrawn; non-company customer). Persona `acme`, `now` 2026-11-03T10:00:00Z. The upgrade adds the following (persona `alpha` is Alex as Maker; `dana` is the approver).

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-19 | Context user, no "who" screen | AC-7 | `alpha`; setup: Alex starts a payment USD 12,500.00 | the journey opens on `start` with the payment listed; withdrawing it works without choosing a user |
| T-20 | Other user in the request | AC-7 | `alpha`; call `corp.payments.withdraw` with `userId: "dana"` | `PERMISSION_DENIED`; payment still pending |
| T-21 | Approver context | AC-7 | `beta-alex` | `denied`; Withdraw is not shown on the tracker |
| T-22 | Another Maker's payment | AC-7 | persona `beta-priya` withdraws a payment started by `omar` at Beta | `NOT_AUTHORISED` "Only the person who started a payment can withdraw it." |
| T-23 | Straight to review | AC-8 | `alpha`; open with `paymentId` | `review` is the first screen; "Keep it" exits |
| T-24 | Bulk payment label | AC-8 | `alpha`; setup: a bulk file of 3 lines started by Alex | the row reads "USD 150,000.00 to 3 payments" |
| T-25 | Payroll period freed | AC-4, AC-8 | `alpha`; setup: payroll run 2026-10; withdraw it | `withdrawn` shows "The pay period 2026-10 is free again."; starting payroll 2026-10 again works |
| T-26 | Without the confirmation | AC-9 | `alpha` | stays on `review`; "Tick the confirmation first." |
| T-27 | **Timeout** | AC-10 | `alpha`; conditions `timeout: ["corp.payments.withdraw"]` | `unavailable` with the TIMEOUT text; the payment still shows Pending approval in the tracker; the daily limit is unchanged |
| T-28 | **Unavailable** | AC-10 | `alpha`; conditions `unavailable: ["corp.payments.pending"]` | `unavailable`; "Nothing was changed." |
| T-29 | No code, no withdrawal (planned adapter rule) | AC-3 | `alpha`; call `corp.payments.withdraw` without verifying a code | `OTP_REQUIRED`; the payment keeps waiting |

#### 10. Expected mutation-check survivors

The fixture's own survivors are listed in `packages/finx-mcp/src/scenarios.test.ts`. Expected additions for the upgrade:

| Survivor | Reason |
|---|---|
| The `consent` block on `review` is removed | Killed by T-26 only after the block is added; until then no scenario can notice it. |
| `OTP_REQUIRED` rule on the adapter switched off | Killed by T-29 once the rule exists. Before then it is not mutable. |
| The sandbox check "only the starter" (`NOT_AUTHORISED`) is hidden behind the permission check | If `biz.payments.withdraw` is held by every Maker, T-22 kills it; if the permission layer stops the case first, the sandbox rule survives with that reason. |
| The unchanged mutants of the six fixture criteria | None expected beyond those already listed in `scenarios.test.ts`. |

## Business: Bulk and payroll

Three journeys pay many people from one file. All three start **one** payment that is approved as one (`lines` lists what it pays) and counts once against the person's and the company's daily limits. The existing fixtures run today on the demo company Acme Trading Co. (PKR, app `meezan`) with a sandbox "who am I" screen. The upgrade moves them to Alpha Trading LLC (USD, app `bankworkx`, `workspace: "business"` *(planned)*), drops the "who am I" screen (the acting user comes from the active context, README 2.3) and adds file upload, a table of rows, the context permission check and the timeout and unavailable states.

Seed values used in the scenarios below are *(planned)* and mirror the Acme proportions in USD: Alex's daily limit at Alpha 250,000; Alpha's daily limit 1,000,000; two approvers above 50,000; cut-off 16:00 UTC; the sandbox clock for scenarios is `2026-11-03T10:00:00Z` (a Tuesday, before cut-off). Approved suppliers keep the Acme ids: `sup_textile` (Crescent Textiles), `sup_logistics` (Indus Logistics), `sup_packaging` (Karachi Packaging). Payroll register at Alpha: `emp_ali` Ali Hamdan salary 3,600; `emp_sana` Sana Malik 4,800; `emp_bilal` Bilal Ahmed 3,000; `emp_hina` Hina Rauf 6,400.

Row messages the person sees (existing, `BULK_LINE_MESSAGE` in `mock-bank-api/src/index.ts`), used by both bulk and payroll:
| Row code | Message | Applies to |
|---|---|---|
| `BENEFICIARY_NOT_WHITELISTED` | "Not on the company's approved list" | bulk |
| `INVALID_AMOUNT` | "The amount is not valid for this account's currency" | bulk, payroll |
| `DUPLICATE_LINE` | bulk: "Same payee, amount and reference as an earlier line". Payroll: "This employee is already on the file" | bulk, payroll |
| `NOT_AN_EMPLOYEE` | "Not on the company's payroll register" | payroll |
| `ABOVE_SALARY_CAP` | "More than 1.5 times this employee's monthly salary" | payroll |

The order the bank checks a row in: bulk is approved list, then amount, then duplicate. Payroll is on the register, then amount, then salary cap, then duplicate.

---

### ★ Bulk payment — `bulk-payment`

Catalog: `bulk-payment`, workspace business, category Payments (the Payments tab lists it under "Bulk & payroll"), core no, a bank can switch it off (yes). Options: `allowCsv` "Accept CSV template files" (default on); `allowPain001` "Accept ISO 20022 pain.001 XML files" (on); `allowNacha` "Accept NACHA files (US)" (on); `allowBacs18` "Accept Bacs Standard 18 files (UK)" (on); `allowEnter` "Allow entering lines by hand" (on); `allowPaste` "Allow pasting lines" (on); `allowPartial` "Partial acceptance: send the good lines and keep the rest for repair" (on); `allowDropLines` "Allow dropping lines" (on); `allowPerLine` "Let approvers decide per line as well as per batch" (default off).

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `bulk-payment` |
| Purpose | A Maker pays many approved suppliers in one go, from a file (CSV template, ISO 20022 pain.001 XML, NACHA, Bacs Standard 18), from lines entered by hand, or from lines pasted from a spreadsheet. Every line is checked, problems are fixed or dropped, the good lines go for approval as one payment, and the left-out lines can be repaired and sent later in the same journey (repair mode). |
| Release / workspace | 1 / Business |
| Status | Built in the prototype (`design/bankworkx-r1/src/journeys/40-bulk-payment.js`, research `research/bulk-payment.md`). Replaces the earlier spec (3-column file, only the sandbox rules). `repair-bulk-lines` is now an alias of this journey (below) and the per-line outcome screen is the separate entry `bulk-status`. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/bulk-payment.ts` for the check, review, code and result; the file formats, the line table with fix-in-place, the rails and the repair are new. |
| Who may use it | Business permission `pay.create` in the prototype (README 4.2 calls it `biz.payments.bulk`). Alex Morgan is Maker at Alpha Trading LLC; at Beta Services Ltd he is Approver only and the journey is refused (`PERMISSION_DENIED`). In the Personal workspace it is refused with `WRONG_CONTEXT`. |
| Launch parameters | none for a new batch; `{repairOf: paymentId}` for repair mode. |
| Shared reference | `09-payment-rails.md` sections 2 (rails), 8 (dates), 9 (limits). Rail names, maximums and fees are those of the prototype's `RAILS` table (shared with `supplier-payment`). |

**Limits of a batch.** 1 to 50 lines; a file up to 256 KB; the whole batch counts once against Alex's daily limit (USD 250,000.00) and Alpha's (USD 1,000,000.00), tested on the USD value of all lines together (rates: USD 1 = EUR 0.926 = GBP 0.781 = AED 3.672 = SAR 3.75 = JOD 0.709). One approver up to USD 50,000.00 in total, two above it. An extra security check from USD 25,000.00. Cut-off 16:00 UTC; it is Tue 3 Nov 2026, 10:42 UTC in the sandbox ("5h 18m left"). Alpha's accounts: Operating ••2001 (USD 480,000.00) and Reserve ••2044 (EUR 95,200.00). Approvers at Alpha: Dana Cruz and Lee Park. Alex's limit left today shows as USD 231,100.00 and Alpha's as USD 981,100.00 because the sandbox already holds PAY-2040 (USD 18,900.00) started today.

**Country groups.** A line goes to a group by its two-letter country; the group sets the currency, the rails and the reference length.

| Group | Countries | Currency | Rails (first is the default when the largest line fits) | Reference |
|---|---|---|---|---|
| United States | US | USD | ACH standard, Same-day ACH, Wire (Fedwire) | 80 |
| United Kingdom | GB | GBP | Bacs, Faster Payments, CHAPS | 18 |
| Europe (SEPA) | DE FR ES IT NL IE BE AT PT FI LU GR | EUR | SEPA Credit Transfer, SEPA Instant | 140 |
| United Arab Emirates | AE | AED | UAEFTS transfer, Aani instant | 140 |
| Saudi Arabia | SA | SAR | SARIE transfer, sarie instant | 140 |
| Jordan | JO | JOD | JoPACC transfer, CliQ instant | 140 |

Any other country (the list names Japan, India, Canada and Australia) gives `RAIL_NOT_AVAILABLE` on the line: "Bulk payments don't reach {country} yet. Use an international transfer."

**Sandbox demo values** (the file chooser offers these samples, so a tester needs no real file).

| Sample | Format | What it contains | What happens |
|---|---|---|---|
| `Suppliers_Nov_clean.csv` ("Clean CSV") | CSV | 5 lines: Harbour Packaging USD 12,400.00 `INV-5701` and USD 3,150.50 `INV-5702`; Nordic Supplies AB EUR 8,900.00 `NS-2210`; Whitby Logistics GBP 4,275.00 `WL-0931`; Gulf Trade FZE AED 15,600.00 `GT-118` | All ready. About USD 34,883.85; fee USD 2.00 (UAEFTS); debit USD 34,885.85; extra security check, one approver |
| `Suppliers_Nov_errors.csv` ("CSV with row errors") | CSV | 12 lines (below) | 2 ready, 3 warnings, 7 errors |
| `Suppliers_Nov_pain001.xml` ("Clean pain.001 XML") | pain.001 | The same 5 lines | As the clean CSV |
| `ACH_CCD_Nov.ach` ("NACHA file") | NACHA | Harbour Packaging USD 5,200.00 `INV-5710` and USD 7,800.00 `INV-5711` | Ready; US only |
| `BACS_STD18_Nov.txt` ("Bacs file") | Bacs 18 | Whitby Logistics GBP 4,275.00 `WL-0940` and GBP 1,380.00 `WL-0941` | Ready; UK only |
| `Suppliers_Oct_clean.csv` ("Same as a file sent before") | CSV | The clean lines | Warning "Same as 30 Oct (Supplier batch 18, PAY-1180)"; the person must tick the box to continue |
| `Suppliers_Nov_totals.xml` ("Control total does not match") | pain.001 | Header says 6 payments, 5 lines | `FILE_CONTROL_TOTAL_MISMATCH` |
| `Suppliers_no_header.csv` ("No header row") | CSV | 5 lines, no header | `FILE_HEADER_MISSING` |
| `payroll_oct.xlsx` ("Excel file (wrong type)") | none | 18 KB | `FILE_FORMAT_UNSUPPORTED` |
| `all_invoices_2026.csv` ("Too large") | CSV | 3.4 MB | `FILE_TOO_LARGE` |

The 12 lines of the errors file and their results: 1 Harbour 12,400.00 `INV-5701` ready; 2 Nordic 8,900.00 `NS-2210` ready; 3 Harbour `12,4x0.00` `INV-5703` `INVALID_AMOUNT`; 4 Sunrise Traders (not approved) `BENEFICIARY_NOT_WHITELISTED`; 5 Nordic with IBAN ending `...3001` `INVALID_IBAN`; 6 Harbour 12,400.00 `INV-5701` again `DUPLICATE_LINE`; 7 Harbour account `000999999` `ACCOUNT_CHANGED`; 8 Whitby GBP 300,000.00 `OVER_LIMIT` (plus a rail limit warning); 9 Aiko Tanaka, Japan `RAIL_NOT_AVAILABLE` and `BENEFICIARY_NOT_WHITELISTED`; 10 Whitby 1,950.00 with a 36-character reference `REF_TRUNCATED` (warning); 11 Gulf Trade 7,400.00 with no reference `REF_MISSING` (warning); 12 Nordic 3,200.00 "Façade repair" `CHARS_REPLACED` (warning). After **Drop 7 lines with errors**, 5 lines are paid (about USD 29,979.00) and 7 are left out. The CSV template (7 columns, button **Download CSV template**, file `BankWorkx_bulk_template.csv`): `Payee name, Country, Account (IBAN or number), Routing or sort code, Amount, Currency, Reference`, sample row `Harbour Packaging, US, 000118841, 021000021, 1250.00, USD, INV-0001`. Approved suppliers at Alpha: Harbour Packaging (US, ABA 021000021, account 000118841), Nordic Supplies AB (DE89 3704 0044 0532 0130 00), Whitby Logistics (UK, sort 20-00-00, account 55779911), Gulf Trade FZE (AE07 0331 2345 6789 0123 456). Earlier batches for repair and status: `PAY-1180` "Supplier batch 18" (30 Oct, paid) and `PAY-1190` "Supplier batch 19" (28 Oct, partly paid, 2 lines left out: Gulf Trade FZE AED 5,000.00 rejected by the bank with `AC04`, and Sunrise Traders).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Bulk & payroll › Upload a file | none | `pay.create` |
| Overview › + › Upload payments | none | `pay.create` |
| Bulk status › Repair left-out lines | `{repairOf}` | `pay.create` |
| Bulk payment result › Repair n left-out lines | `{repairOf}` | `pay.create` |
| Command bar "Bulk payment" | none | `pay.create` |

With the journey off, the entries disappear and a forced open gives `JOURNEY_DISABLED`.

#### 3. Screens

Step ids: `setup`, `file`, `enter`, `paste`, `fix`, `rails`, `review`, then the code sheet and the result. Only the steps that apply are counted ("Step n of …"). In repair mode `setup`, `file`, `enter` and `paste` are skipped and the batch starts at `fix`.

**`setup`: "New bulk payment"**. Intro: "Choose what you are paying and from which account."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Payment type | chips: Supplier payments, Expense refunds, Tax and other | No (default Supplier payments) | One of the list (shown on the receipt only) | none |
| Pay from | select, "{account} ••{last four} · {balance}" | Yes | One of the company's accounts | "Choose the account to pay from." |
| Batch name (optional) | text, max 35, placeholder "Suppliers November", hint "Shown in the tracker and on the receipt. Up to 35 characters." | No | 35 characters | the field stops at 35 |
| How do you want to add the lines? | cards: **Upload a file** ("CSV template, pain.001 XML, NACHA or Bacs. Checked line by line."), **Enter lines** ("Pick approved suppliers and type the amounts."), **Paste lines** ("Copy rows from a spreadsheet: payee, country, account, code, amount, currency, reference.") | Yes (default Upload) | A card is greyed when `allowEnter` or `allowPaste` is off | none |

Lock line: "Only approved suppliers can be paid. Cut-off today is 16:00 UTC (5h 18m left). Up to 50 lines per batch." Button **Continue**; Cancel leaves.

**`file`: "Upload your file"** (upload only). Intro: "Choose the format, then the file. We check the file before we read the lines." Busy "Checking the file…" (0.9 s).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| File format | chips, only the formats the bank switched on (CSV template; ISO 20022 pain.001 (XML); NACHA file (US); Bacs Standard 18 (UK)) | Yes | One enabled format | none |
| Payment file | file chooser with the sample files, "Choose a file (up to 256 KB)" | Yes | The file passes the checks below and its format equals the chosen format | "Choose a file first." / the file's own message / "This looks like a {x} file, but you chose {y}. (FILE_FORMAT_MISMATCH)" |
| I know this file looks the same as one sent before, and I still want to use it. | check | Yes, only when the file matches a batch sent in the last 30 days | Ticked | "Confirm that you want to send it again." |

A **Need a template?** card says "CSV template has 7 columns: …" with **Download CSV template**. After a file is chosen a **File checks** card lists, each with a tick, a warning mark or a cross: Type; Size ("4 KB of 256 KB"); Header (Found or Missing); Lines ("5 (up to 50)"); Control total ("Count 5 matches" or "File says 6, lines 5"); Characters ("Latin only" or "Some will be replaced"); Sent before ("No match in 30 days" or "Same as 30 Oct (Supplier batch 18, PAY-1180)"). On Continue: no lines gives `EMPTY_BATCH`; more than 50 gives `BATCH_TOO_LARGE`. The file checks run in this order: type, size, header, line count, control total, characters, recent duplicate.

**`enter`: "Enter the lines"** (enter only). Intro: "Add one line at a time. Approved suppliers fill in their bank details for you." A counter "Lines added: n of 50" lists each added line (name, reference or "No reference", country, amount, **Remove**).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Payee | select of the company's approved suppliers plus "Other payee (not approved)" | Yes to add | A choice | toast "Choose a payee and enter an amount" |
| Payee name, Country, Account number or IBAN, Routing or sort code | text and select, only for "Other payee" | For other payee | Same checks as the line checks (next step) | on the next step |
| Amount | amount | Yes to add | Above zero, two decimals | toast above; line checks later |
| Reference | text, max 140, placeholder "INV-1001" | No | none | none |

Button **Add line** adds the line (the currency follows the supplier's country). A 51st line: toast "A batch has up to 50 lines. (BATCH_TOO_LARGE)". Continue needs at least one line: "Add at least one line. (EMPTY_BATCH)".

**`paste`: "Paste the lines"** (paste only). Intro: "One line per payment with 7 columns: Payee name, Country, Account (IBAN or number), Routing or sort code, Amount, Currency, Reference." One required text area "Lines" (placeholder `Harbour Packaging,US,000118841,021000021,1250.00,USD,INV-0001`; hint "Commas, tabs or semicolons work. A header row is ignored."; "Paste the lines first: one line per payment."). Busy "Reading the lines…". A row without 7 columns becomes a line with the error `ROW_COLUMNS` ("This row has n columns. The template has 7."). No line gives `EMPTY_BATCH`; over 50 gives `BATCH_TOO_LARGE`.

**`fix`: "Check the lines"** (every route). Four to five tiles: Lines, Ready, Warnings, Errors, Dropped; chips for problems ("n duplicate", "n not approved", "n over limit", "n country not served"); a filter (All, Ready, Warnings, Errors, Dropped); a table with columns Line, Country and account (••last four), Amount (and reference), Result (chip Ready, Warning, Error or Dropped, then each message with its code, then **Fix** or **Edit** and **Drop** or **Restore**). Buttons: **Drop n lines with errors** (needs `allowDropLines`), **Download error report** (`BankWorkx_line_errors.csv`). **Fix line n** opens a panel with Payee name, Country, Currency, Account number or IBAN, Routing or sort code, Amount, Reference and the buttons **Use the approved account** (for `ACCOUNT_CHANGED`), **Done**, **Drop this line**. The result updates on every change. In repair mode a banner reads "Repairing lines left out of {id}. Fix them and send them as a new payment." and, when nothing can be repaired, an empty state **Nothing to repair** / "This batch has no left-out lines, or it was rejected or withdrawn. (REPAIR_NOT_ALLOWED)".

Gate to continue: at least one payable line ("No line can be paid yet. Fix or drop the lines with errors. (NO_VALID_LINES)"); and, when `allowPartial` is off, no error lines ("Fix or drop every line with an error to continue. Your bank sends whole batches only."). Live summary: "Will be paid n of m lines", "Left out n lines", "Total {currency}" per currency, "About in USD". Button **Continue**.

Line checks (every line gets all its codes, never just the first):

| Code | Kind | Rule and message |
|---|---|---|
| `ROW_COLUMNS` | error | Not 7 columns: "This row has n columns. The template has 7." |
| `PAYEE_NAME_REQUIRED`, `PAYEE_NAME_TOO_LONG` | error | "Enter the payee name." / "The name is longer than 70 characters." |
| `INVALID_AMOUNT` | error | Number above zero with up to 2 decimals (commas ignored): "The amount is not valid for this currency. Use a number above zero with up to 2 decimals." |
| `RAIL_NOT_AVAILABLE` | error | Country has no group: "Bulk payments don't reach {country} yet. Use an international transfer." |
| `CURRENCY_MISMATCH` | error | "Payments to {country} are made in {currency}, not {x}." |
| `FORMAT_RULE` | error | NACHA only US: "A NACHA file carries US dollar payments to US accounts only."; Bacs only UK: "A Bacs file carries pound payments to UK accounts only." |
| `INVALID_ROUTING`, `INVALID_ACCOUNT` | error | US routing 9 digits with the check digit, account 4 to 17 digits: "That routing number isn't valid. Check the 9 digits." / "An account number has 4 to 17 digits." UK account 8 digits: "A UK account number has 8 digits." |
| `INVALID_SORT_CODE` | error | "A sort code has 6 digits, like 20-00-00." |
| `INVALID_IBAN`, `COUNTRY_MISMATCH` | error | IBAN check digits and country length; "That IBAN doesn't look right. Check each character." / "That IBAN starts with {xx}, but the country is {yy}." |
| `BENEFICIARY_NOT_WHITELISTED` | error | Name not on the approved list (names compared without case or punctuation): "Not on the company's approved list." |
| `ACCOUNT_CHANGED` | error | Known name, different account: "The account differs from the approved record for {name}. Phone the supplier on a known number before you change it." |
| `OVER_LIMIT` | error | One line above USD 250,000.00: "Above your limit of USD 250,000.00 for one person. (LIMIT_USER_EXCEEDED)" |
| `DUPLICATE_LINE` | error | Same payee, account, amount and reference as an earlier line: "Same payee, amount and reference as line n." |
| `RAIL_LIMIT` | warning | Above the default rail's maximum: "Over the {rail} limit of {x}. A larger rail is needed; check the rails step." |
| `REF_MISSING` | warning | "No reference. We will use “Payment”." |
| `REF_TRUNCATED` | warning | "Reference will be cut to n characters for this rail." |
| `CHARS_REPLACED` | warning | UK and Europe only: "Special characters will be replaced (for example ç with c) because this rail accepts Latin letters only." |
| `POSSIBLE_DUPLICATE` | warning | Same payee and amount, different reference: "Same payee and amount as line n, with a different reference." |

**`rails`: "Rails and date"**. Intro: "Choose how each country group is sent and when." One required card list per country group that has payable lines ("{Group}: how to send"): each rail shows its name, arrival, maximum ("max $25,000" etc.), fee ("Free" or "{x} each") and an "Instant" chip; a rail below the largest line in the group is greyed with "too small for your largest line". Defaults are the first rail that fits. Message when forced: "The largest payment is over the {rail} limit. (RAIL_LIMIT)". **When should it go?** chips: **Today, before 16:00 UTC** (default) or **Another day** with a required **Execution date** (business days for 30 days; "Choose a working day."). Lock line: "Now: Tue 3 Nov, 10:42 UTC. Cut-off 16:00 UTC (5h 18m left). A batch that isn't fully approved before the cut-off on its date goes out the next working day, and we tell you." Summary per group: "{Group} · {rail} · n lines {total}" and "Arrives {speed}". Button **Review**.

**`review`: "Review the batch"**. Busy "Checking limits and funds…" (0.9 s). A card shows From ({account}), the USD total, "n payments · fees {x} · debit {amount in the account currency}"; a table of Group, Rail, Lines, Amount; an **Approvals needed** card ("1 approver: Dana Cruz or Lee Park." or "2 approvers: Dana Cruz then Lee Park.", and "You'll be asked for an extra security check." from USD 25,000.00); a warning if lines are left out ("n lines are left out. After you submit, you can fix them and send them as a new payment."); Date, "Your limit left today", "Company limit left today", "Balance after"; the hint "The whole batch counts as one payment against your limit and the company's. No money moves until it is approved."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| How should approvers decide? | chips: Whole batch; Batch, with the right to reject single lines (only when `allowPerLine` is on) | No | One of the list | none |
| Note for approvers (optional) | text area, max 140, placeholder "Monthly supplier run" | No | none | none |
| I confirm the payments in this batch are correct. | check | Yes | Ticked | "Tick the confirmation first." |

Button **Submit for approval**. Bank checks at this step: `NO_VALID_LINES`; the person's limit (`LIMIT_USER_EXCEEDED`); the company's limit (`LIMIT_COMPANY_EXCEEDED`); funds (`INSUFFICIENT_FUNDS`: "Insufficient funds: the batch needs {x} but the account has {y}.").

**Code sheet.** "Authorise USD {total} in {n} payments"; sub "Code sent to ••• 4410. It only works for this batch." plus " This amount needs an extra security check." from USD 25,000.00. Code `482100`; the prototype keypad accepts any six digits.

**Result** (pending, amber). Title **Sent for approval**; text "n payments totalling USD x now wait for k approver(s). Nothing has left the account yet."; chip "Waiting for k approver(s)". Receipt rows: Batch ("{name} · PAY-nnnn"), Payments, Total (per currency), Debit, Rails, Execution date ("Today, 3 Nov (cut-off 16:00 UTC)" or the chosen day), Approvers needed, Left out, Source (file name, "Typed lines" or "Repair of {id}"). Buttons: **View batch status** (`bulk-status`), **Repair n left-out lines** (when some were left out; reopens this journey in repair mode), **Track in Payments**, **Done**. In repair mode the repaired lines are marked done on the original so they cannot be sent twice.

**Other states.** Sandbox "Backend will time out on submit": banner `TIMEOUT` "We didn't get an answer in time. Check Payments before you try again, so you don't pay twice." on the `file`, `paste` and `review` steps and at the code; the batch is not created. "Bank unavailable": the sheet "We couldn't reach the bank". Loading: spinner with the step's text.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `FILE_FORMAT_UNSUPPORTED` | "That file type isn't supported. Use CSV, XML (pain.001), NACHA or Bacs Standard 18." | `file` | Choose another file |
| `FILE_TOO_LARGE` | "That file is too big. The limit is 256 KB." | `file` | Choose another file |
| `FILE_HEADER_MISSING` | "The first row must be the header: Payee name, Country, Account (IBAN or number), Routing or sort code, Amount, Currency, Reference." | `file` | Choose another file |
| `FILE_CONTROL_TOTAL_MISMATCH` | "The file header says 6 payments, but the file contains 5. Ask whoever made the file to export it again." | `file` | Choose another file |
| `FILE_FORMAT_MISMATCH` | "This looks like a {x} file, but you chose {y}." | `file` | Change format |
| `FILE_DUPLICATE` | "This file looks the same as one sent before." (the person may tick the box and go on) | `file` | Tick and continue |
| `EMPTY_BATCH` | "The file has no payment lines. Add at least one line." | `file`, `enter`, `paste` | Back |
| `BATCH_TOO_LARGE` | "The file has more than 50 lines. Split it into files of 50 lines or fewer." | `file`, `paste`, `enter` | Back |
| `NO_VALID_LINES` | "None of the lines can be paid." | `fix`, `review` | Back to the lines |
| Line codes | the table above | `fix` | Fix, Drop |
| `RAIL_LIMIT` | "The largest payment is over the {rail} limit." | `rails` | Choose another rail |
| `DATE_NOT_WORKING_DAY` | "Choose a working day." | `rails` | Choose a day |
| `INSUFFICIENT_FUNDS` | "Insufficient funds: the batch needs {x} but the account has {y}." | `review` | Change account |
| `LIMIT_USER_EXCEEDED` | "This is above Alex Morgan's daily limit." | `review` | Back |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit." | `review` | Back |
| `REPAIR_NOT_ALLOWED` | "This batch can't be repaired because it was rejected or withdrawn." | `fix` | Back to status |
| `OTP_INVALID`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | README 1.6 wording | Code sheet / failure | As README |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `JOURNEY_DISABLED` | README 1.6 wording | Whole journey | Back / Switch |
| `TIMEOUT` | "We didn't get an answer in time. Check Payments before you try again, so you don't pay twice." | Banner | Check Payments |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank." sheet | Sheet | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{userId}` | company, accounts, approved suppliers, `me`, limits, `dualApprovalAbove`, `cutoff` | `NOT_SUPPORTED` | Existing |
| `importBulk` | `corp.bulk.import` | `{format: "csv"\|"pain001"\|"nacha"\|"bacs18", content}` | `{rows[] (7 columns), control: {count}, headerFound, rowCount, sentBefore?}` | `FILE_FORMAT_UNSUPPORTED`, `FILE_TOO_LARGE`, `FILE_HEADER_MISSING`, `FILE_CONTROL_TOTAL_MISMATCH`, `FILE_FORMAT_MISMATCH`, `EMPTY_BATCH`, `BATCH_TOO_LARGE` | (planned). The existing sandbox parses a 3-column file (`beneficiary,amount,reference`) in `parseBulkFile`; the 7-column rows and the four formats are new |
| `checkBulk` | `corp.bulk.check` | `{userId, fromAccountId, file}` | `{lines{}, problems{}, validCount, invalidCount, total, requiredApprovers, currency}` | `NOT_AUTHORISED`, `ACCOUNT_NOT_FOUND`, `EMPTY_BATCH`, `BATCH_TOO_LARGE` | Existing (3-column rows and the row codes `BENEFICIARY_NOT_WHITELISTED`, `INVALID_AMOUNT`, `DUPLICATE_LINE`); the other line codes of section 3 are (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as README | as README | `OTP_INVALID` | Existing |
| `submitBulk` | `corp.bulk.submit` | `{userId, fromAccountId, file, reference}`; (planned) adds `rails`, `executionDate`, `approvalMode`, `note`, `repairOf` | the payment: `id`, `status: "pending_approval"`, `amount`, `currency`, `required`, `valueDate`, `afterCutoff`, `payee` ("N payments"), `lines`; (planned) `leftOut[]` | `OTP_REQUIRED`, `NOT_AUTHORISED`, `NO_VALID_LINES`, `EMPTY_BATCH`, `BATCH_TOO_LARGE`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `CORE_UNAVAILABLE`; (planned) `RAIL_LIMIT`, `DATE_NOT_WORKING_DAY`, `REPAIR_NOT_ALLOWED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing; creates a pending payment, moves no money; code needed |
| `leftOut` | `corp.bulk.leftOut` | `{paymentId}` | `{rows[] with code, message, repaired}` | `PAYMENT_NOT_FOUND`, `REPAIR_NOT_ALLOWED`, `NOTHING_TO_REPAIR`, `PERMISSION_DENIED` | (planned) |

Bank B parity: Bank B's calls are `batches.validate` and `batches.create` with its own row shape; row verdicts `B-201` (not approved), `B-202` (invalid amount), `B-203` (duplicate) and errors `ERR-4101` to `ERR-4103` map to our codes in `mappings/bank-b.corporate.json`.

#### 6. Permissions, step-up and limits

Permission `pay.create` (README 4.2: `biz.payments.bulk`). Step-up `otp` at the last step, with the extra security check text from USD 25,000.00. Limits: the whole batch counts once; Alex USD 250,000.00 per day, Alpha USD 1,000,000.00; one approver to USD 50,000.00 and two above it. Cut-off 16:00 UTC: not fully approved by then, the batch goes out the next working day and the person is told. 1 to 50 lines, 256 KB. A repair is a new payment against the same limits.

#### 7. Result and links out

Receipt as in section 3 plus the reference BWX-. Notifications (planned): to every Alpha approver "Payment awaiting your approval" (link `approve-payments` with the payment id); to the Maker nothing on send. Links out: **View batch status** (`bulk-status`), **Repair n left-out lines** (this journey, repair mode), **Track in Payments**, **Done**. Approvers who reject a line in a batch with `allowPerLine` on leave it out; it can be repaired.

#### 8. Acceptance criteria

- AC-1: A file is read only if its type, size, header, line count, control total and format match; each failure is refused whole with its code and message (FILE_*).
- AC-2: Every line is checked for all rules and shows all its errors and warnings; the table filters by Ready, Warnings, Errors and Dropped.
- AC-3: A payee not on the approved list, or a known payee with a changed account, is an error and is never paid.
- AC-4: With `allowPartial` on, the good lines go for approval and the rest are kept for repair; with it off, any error line blocks Continue.
- AC-5: Lines can be fixed in place or dropped (`allowDropLines`); dropped lines are not lost but listed as left out.
- AC-6: A rail that cannot carry the largest line in a country group cannot be chosen; the default is the first rail that fits.
- AC-7: The whole batch counts once against the person's and the company's daily limits, tested on the USD value; over either limit or over the balance stops the journey before the code.
- AC-8: One approver is needed up to USD 50,000.00 in total and two above; the extra security check applies from USD 25,000.00.
- AC-9: The bank creates the payment only after consent and a verified code, with status "waiting for approval" and no money moving.
- AC-10: Left-out lines can be repaired in the same journey (repair mode) and sent as a new payment; a repaired line cannot be sent twice; a rejected or withdrawn batch cannot be repaired.
- AC-11: A file the same as one sent in the last 30 days needs a confirmation tick.
- AC-12: A timeout or unavailable bank creates nothing and says so; a Maker only at Alpha (not Alex at Beta) may start a batch; the journey off gives `JOURNEY_DISABLED`.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4, AC-7, AC-8, AC-9 | `alex` at Alpha | none | Setup: Operating, name "Suppliers November", Upload. CSV, `Suppliers_Nov_clean.csv`: 5 lines, control total matches. All ready; rails default ACH, Bacs, SEPA Credit Transfer, UAEFTS; Today. Review: about USD 34,883.85, fees USD 2.00, 1 approver, extra security check. Code. Result "Sent for approval", `PAY-` id, Alex's limit left falls. |
| T-2 | AC-2, AC-3, AC-5 | `alex` | none | `Suppliers_Nov_errors.csv`: tiles 12 / 2 / 3 / 7 / 0; chips "1 duplicate", "3 not approved", "1 over limit", "1 country not served". Line 7: **Use the approved account** clears `ACCOUNT_CHANGED`. **Drop 6 lines with errors** (7 minus the fixed one): continue with the rest. |
| T-3 | AC-1 | `alex` | none | Each failing sample: control total, no header, Excel, too large: the message and code in section 4; Continue is disabled. Choose NACHA sample with CSV format: FILE_FORMAT_MISMATCH. |
| T-4 | AC-4 | `alex` | `allowPartial` off | Errors file: Continue says "Your bank sends whole batches only." until every error line is fixed or dropped. |
| T-5 | AC-6 | `alex` | none | A paste line Whitby GBP 25,000.00: Bacs (max £20,000) is greyed; the default is Faster Payments. |
| T-6 | AC-7 | `alex`, setup: pasted lines to Harbour Packaging of USD 10,000.00 each with different references | none | 30 lines from Operating: review gives `LIMIT_USER_EXCEEDED` (USD 300,000.00 plus the USD 18,900.00 already used today is over USD 250,000.00). 12 lines from the Reserve (EUR) account: debit about EUR 111,120.00 against EUR 95,200.00 gives `INSUFFICIENT_FUNDS`. |
| T-7 | AC-8 | `alex` | none | USD 60,000.00 in total: "2 approvers: Dana Cruz then Lee Park". |
| T-8 | AC-10 | `alex` | none | Open `bulk-status` for `PAY-1190`; **Repair 2 lines**; repair mode starts at the check: Gulf Trade FZE (bank rejected) and Sunrise Traders (not approved). Drop Sunrise, submit: a new `PAY-`; the original shows 1 line left. Repairing `PAY-1180` (no left-out lines) shows "Nothing to repair" `REPAIR_NOT_ALLOWED`. |
| T-9 | AC-11 | `alex` | none | `Suppliers_Oct_clean.csv`: Continue disabled until the box is ticked. |
| T-10 | AC-12 | `alex` | `timeout: ["corp.bulk.submit"]` | Review: banner TIMEOUT; no new batch in Payments. |
| T-11 | AC-12 | `alex` | `unavailable: ["corp.bulk.check"]` | Continue on the file: sheet SERVICE_UNAVAILABLE. |
| T-12 | AC-12 | `alex` at Beta | none | Bulk entries are not shown; forced open: `PERMISSION_DENIED`. |
| T-13 | AC-12 | `alex` | `bulk-payment` off | Entries gone; forced open `JOURNEY_DISABLED`. |
| T-14 | AC-1 | `alex` | `allowCsv` off | The CSV format chip is missing; the default format is the first enabled one. |

#### 10. Expected mutation-check survivors

- The reference length per group and the character-replacement warning survive unless a line with a long or accented reference is tested for each group (T-2 covers UK and Europe only).
- Rail maximums other than Bacs survive (one scenario).
- The 50-line and 256 KB caps survive without a 51-line file (the samples have at most 12).
- `POSSIBLE_DUPLICATE` survives (no sample triggers it).
- Per-line approval (`allowPerLine`) survives: it only changes a label and the note.
- The Bank B mapping of line verdicts survives until the planned `leftOut` mapping exists.

---

### ★ Repair rejected lines — `repair-bulk-lines`

Catalog: `repair-bulk-lines`, workspace business, category Payments, core no, a bank can switch it off (only with `bulk-payment`, of which it is a mode). Options: those of `bulk-payment`; lines are left out for repair only when `allowPartial` is on, and `allowDropLines` controls dropping.

Alias of `bulk-payment`: reached by launching `bulk-payment` with `{repairOf: paymentId}` from Bulk status › **Repair n lines**, from the bulk result button **Repair n left-out lines**, or from the old `repair-bulk-lines` link, which now opens that journey in repair mode. (planned) wording on old links: none.

What differs from a new batch:

- No `setup`, `file`, `enter` or `paste` step. The batch starts at **Check the lines** with a banner "Repairing lines left out of {id}. Fix them and send them as a new payment." The account is the original batch's; the name is "Repair of {name}" (35 characters at most).
- The lines are the original's left-out lines that are not yet done: those the bank rejected (for example `AC04`, "The receiving account is closed.") and those that failed the checks (for example not on the approved list). All the line checks, the rails, the review and the code are the same.
- A repair that cannot start shows the empty state **Nothing to repair** with `REPAIR_NOT_ALLOWED` ("This batch can't be repaired because it was rejected or withdrawn."), also when no left-out lines remain.
- On submit a new payment is made and the repaired lines are marked done on the original, so they cannot be sent twice. Acceptance criterion and scenario: AC-10 and T-8 of `bulk-payment`.

---

### ★ Batch status — `bulk-status`

Catalog: `bulk-status`, workspace business, category Payments, core no, a bank can switch it off (yes; the result button then disappears). Options: none (it follows the options of `bulk-payment`; the Repair button needs `bulk-payment` on).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `bulk-status` |
| Purpose | A screen in the Payments tab that shows one bulk batch: its progress from created to bank report, the status of every line (paid, sent to bank, awaiting approval, rejected by bank, left out), downloads of the report, and the way to repair left-out lines. |
| Release / workspace | 1 / Business |
| Status | Built in the prototype as a screen (`view`, tab `pay`, same file 40-bulk-payment.js). New in this spec; it was not in the earlier version. |
| Channels | Web (list beside detail) and mobile (list then detail) |
| Who may use it | Permission `pay.create` in the prototype (README 4.2 would also let approvers view). |
| Parameters | `{id}` of a batch; with none, the latest bulk batch of the company. |

Sandbox: two earlier batches exist, `PAY-1180` "Supplier batch 18" (30 Oct, 6 lines, all paid, approved by Dana Cruz, file `Suppliers_Oct_clean.csv`, about USD 37,083.85) and `PAY-1190` "Supplier batch 19" (28 Oct, 4 lines, about USD 17,986.21, approved by Lee Park; line 4 Gulf Trade FZE AED 5,000.00 rejected by the bank with `AC04`; 2 lines left out). A batch just sent from `bulk-payment` appears at the top as "Pending approval".

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Bulk & payroll › a batch | `{id}` | `pay.create` |
| Bulk payment result › View batch status | `{id}` | `pay.create` |
| Payments › tracker › a bulk payment | `{id}` | `pay.create` |

#### 3. Screens

**Batch status.** Head card: batch name, a status chip (Pending approval, Sent to bank, Paid, Partly paid, Cancelled or Withdrawn), the USD total, and "PAY-nnnn · n payments · {rails} · file {name}" (plus " · repair of {id}"). A timeline of four stages: **Created** ("{who} · {when}"), **Approval** ("1 of 2 approved (Dana Cruz)", "Rejected" or "Withdrawn"), **Sent to bank** ("Before 16:00 UTC cut-off"), **Bank report** ("Waiting", "All accepted (ACSC)" or "Partly accepted (PART): n rejected"). A line "Approvers can reject single lines in this batch." when the batch was sent with that mode. Buttons: **Demo: approvers approve** or **Demo: bank report arrives** (sandbox only; the second marks the last paid line rejected with `AC04` when the batch has 3 or more lines), **Download report (CSV)** (`{id}_report.csv`: Line, Payee, Amount, Currency, Rail, Status, Code, Message, with left-out lines as `L1`, `L2`), **Status file (pain.002)** (`{id}_status.xml` with group status ACSC, PART or ACSP/PDNG and a status per payment, `RJCT` with a reason code for rejected ones), and **Repair n lines** when lines are left out (opens `bulk-payment` in repair mode). Four tiles: Lines, Paid, In progress, Rejected or left out. A filter All, Paid, Rejected. A table Line, Rail, Amount, Status (chip Paid, Sent to bank, Awaiting approval, Rejected by bank, Cancelled, Withdrawn; a rejected line shows the bank's message and code). **Left out (n)**: table Line (`L1`), Payee, Amount, Reason with code. **Other batches**: rows to switch to another batch.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Filter | chips: All, Paid, Rejected | No | One of the list | none |
| Batch | list row | No | One of the company's bulk batches | none |

States: no batch yet: empty state **No bulk batches yet** / "Batches you send show here with the status of every line." with button **Upload a file** (`bulk-payment`). A filter with no match: **No lines here** / "No lines match this filter."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `PAYMENT_NOT_FOUND` | "We can't find that payment." | Screen | Back to Payments |
| `PERMISSION_DENIED` | README 1.6 wording | Screen | Back |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | README 1.6 wording | Screen | Try again |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | Screen | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `batch` | `corp.payments.get` | `{paymentId}` | the payment; (planned) with per-line `status`, `bankCode`, `bankMessage`, `leftOut[]`, `fileName`, `rails` | `PAYMENT_NOT_FOUND` | Existing; line detail (planned) |
| `batches` | `corp.bulk.list` | `{}` | the company's bulk batches | none | (planned) |
| `report` | `corp.bulk.report` | `{paymentId, format: "csv"\|"pain002"}` | file | `PAYMENT_NOT_FOUND` | (planned) |

#### 6. Permissions, step-up and limits

`pay.create` (planned: also approvers view). Step-up none. Read-only. The company context decides which batches show.

#### 7. Result and links out

No result. Links out: **Repair n lines** (`bulk-payment`, `{repairOf}`), **Upload a file** (empty state), a row of another batch.

#### 8. Acceptance criteria

- AC-1: The screen shows a batch's four stages and a status per line that matches the stage.
- AC-2: A line the bank rejected shows the bank's code and message and appears among the left-out lines that can be repaired.
- AC-3: The CSV report and the pain.002 file list every line with its status and any rejection code.
- AC-4: A batch that is rejected or withdrawn shows "Cancelled" or "Withdrawn" on every line and offers no repair.
- AC-5: With no bulk batch the empty state is shown with a way to start one.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` at Alpha | none | Open `PAY-1190`: "Partly paid", approval "1 of 1 approved (Lee Park)", bank report "Partly accepted (PART): 1 rejected"; line 4 shows `AC04` "The receiving account is closed."; Left out (2); **Repair 2 lines** is shown. |
| T-2 | AC-3 | `alex` | none | Download CSV and pain.002 for `PAY-1190`: group status PART, one `RJCT` with `AC04`. |
| T-3 | AC-1 | `alex` | none | Send a new batch, open it: "Pending approval"; **Demo: approvers approve** moves to "Sent to bank"; **Demo: bank report arrives** to "Partly paid" or "Paid". |
| T-4 | AC-5 | `alex` at a company with no bulk batches | `empty` | Empty state with **Upload a file**. |
| T-5 | AC-4 | `alex` | none | A rejected batch: every line "Cancelled", no Repair button. |

#### 10. Expected mutation-check survivors

- The pain.002 content (message ids, element names) survives: the test counts rows, not the XML.
- The "Demo" buttons are sandbox only and are not covered.
- The `Other batches` switcher survives.

---
### ★ Payroll run — `payroll-run`

Catalog: `payroll-run`, workspace business, category Payments (the Payments tab lists it under "Bulk & payroll"), core no, a bank can switch it off (yes). Options: `allowFile` "Allow payroll upload from a CSV file" (default on); `allowBonus` "Allow bonus lines" (on); `allowDeduction` "Allow deduction lines" (on); `varianceCheck` "Compare with last month and ask for a reason on big changes" (on); `wpsFile` "Build the WPS file for the UAE and Saudi Arabia" (on); `allowPayslipNotify` "Offer to tell employees their payslip is ready" (on).

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `payroll-run` |
| Purpose | A Maker pays employees for one pay period: net pay from the company's employee register or from a CSV file, bonus and deduction as separate amounts, a check against each person's salary and against last month, a funding check, a wage protection (WPS) file for the UAE and Saudi Arabia, and always two different approvers. Net pay only: tax and insurance are worked out in the company's payroll system. |
| Release / workspace | 1 / Business |
| Status | Built in the prototype (`design/bankworkx-r1/src/journeys/41-payroll-run.js`, research `research/payroll-run.md`). Replaces the earlier spec (4 employees, a 3-column file). |
| Channels | Web and mobile |
| Starting pattern | `fixtures/payroll-run.ts` for the checks and the two-approver rule; the register view, bonus and deduction, variance, WPS and payslip message are new. |
| Who may use it | Business permission `pay.create` in the prototype (README 4.2: `biz.payroll.run`). Alex Morgan is Maker at Alpha Trading LLC. Refused for Alex at Beta (`PERMISSION_DENIED`) and in the Personal workspace (`WRONG_CONTEXT`). |
| Launch parameters | `{period}` optional (a value like `2026-11`); the default is `2026-11`. |
| Shared reference | `09-payment-rails.md` sections 2, 8, 9. Rails and fees come from the shared rails table. |

**Rules in one place.** A pay period is a month. It can be paid once while a run for it is pending, released or paid; a rejected or withdrawn run frees it. Only people on the register can be paid, each once per run, and their bank details always come from the register. The pay for a person is net pay plus bonus minus deduction, paid as one payment; it may not exceed 1.5 times the monthly salary on the register; deductions can never make it negative. A run always needs 2 different approvers whatever the total (Dana Cruz then Lee Park at Alpha). An extra security check applies from USD 25,000.00. The whole run counts once against Alex's USD 250,000.00 and Alpha's USD 1,000,000.00 daily limits. Cut-off 16:00 UTC; the sandbox clock is Tue 3 Nov 2026, 10:42 UTC.

**Sandbox demo values.** The register for Alpha Trading LLC (all synthetic): 

| Id | Employee | Department | Country (currency) | Monthly salary | Net paid last month | Account | Cap (1.5 times) | Note |
|---|---|---|---|---|---|---|---|---|
| `emp_ali` | Ali Hamdan | Operations | US (USD) | 3,600.00 | 3,600.00 | ••8120 | 5,400.00 | |
| `emp_sana` | Sana Malik | Finance | US (USD) | 4,800.00 | 4,800.00 | ••4471 | 7,200.00 | |
| `emp_bilal` | Bilal Ahmed | Sales | US (USD) | 3,000.00 | 2,700.00 | ••9034 | 4,500.00 | |
| `emp_hina` | Hina Rauf | Management | US (USD) | 6,400.00 | 6,400.00 | ••3365 | 9,600.00 | |
| `emp_emma` | Emma Clarke | Sales | UK (GBP) | 2,900.00 | 2,900.00 | ••5512 | 4,350.00 | Leaver: "Leaves on 27 Nov. Check the final pay." |
| `emp_noor` | Noor Khalid | Operations | UAE (AED) | 14,000.00 | 14,000.00 | ••3456 | 21,000.00 | Labour card 20261234567890 |
| `emp_layla` | Layla Mansour | Finance | UAE (AED) | 11,500.00 | 0.00 | ••9981 | 17,250.00 | Joiner: "Joined on 9 Nov. Pay only the days worked." Labour card 20269876543210 |
| `emp_yousef` | Yousef Anazi | Operations | Saudi Arabia (SAR) | 9,000.00 | 9,000.00 | ••7519 | 13,500.00 | |
| `emp_faris` | Faris Qasem | Support | Jordan (JOD) | 1,100.00 | 1,100.00 | none | 1,650.00 | Bank details missing; starts "taken out" |

The default run (from the register, Faris out) pays USD 17,800.00, GBP 2,900.00, AED 25,500.00 and SAR 9,000.00, about USD 30,857.63 against about USD 28,977.31 last month (up 6.5%, under the 10% that needs a reason). Fees on a Fri 27 Nov pay date: ACH and Bacs free, UAEFTS and SARIE USD 2.00 each person, so USD 6.00 in all; debit about USD 30,863.63. Alpha's accounts are Operating ••2001 (USD 480,000.00) and Reserve ••2044 (EUR 95,200.00). Periods offered: November 2026 (this month), October 2026, September 2026. October is already taken in the sandbox (`PAY-1120`, "Payroll 2026-10 · 8 employees", paid), so choosing it gives `PAYROLL_ALREADY_RUN`. The WPS employer ID defaults to `1234567890123`.

Sample payroll files (button group in the file step):

| Sample | What it contains | Result |
|---|---|---|
| `payroll_2026-11.csv` ("Clean CSV") | The 8 employees with a bank account, net pay equal to salary | All ready |
| `payroll_2026-11_errors.csv` ("CSV with row errors") | Ali 3,600.00; Sana 7,200.01; `emp_zzz` 1,000.00; Bilal `abc`; Ali again 100.00; Hina 6,400.00 with bonus 1,500.00 and deduction 200.00 | Sana `ABOVE_SALARY_CAP`; `emp_zzz` left out `NOT_AN_EMPLOYEE`; Bilal `INVALID_AMOUNT`; second Ali line left out `DUPLICATE_LINE`; Hina ready with a bonus and a deduction note. Everyone else is "Not in the file" and out of the run |
| `payroll_oct.xlsx` ("Excel file (wrong type)") | 22 KB | `FILE_FORMAT_UNSUPPORTED` |
| `payroll_all_year.csv` ("Too large") | 3.1 MB | `FILE_TOO_LARGE` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Bulk & payroll › Run payroll | none | `pay.create` |
| Overview › + › Run payroll | none | `pay.create` |
| Payments › Bulk & payroll history › New run | `{period}` optional | `pay.create` |

With the journey off the entries disappear and a forced open gives `JOURNEY_DISABLED`.

#### 3. Screens

Step ids: `period`, `file` (file source only), `lines`, `checks`, `wps` (only when UAE or Saudi people are in the run and `wpsFile` is on), `review`, then the code sheet and the result.

**`period`: "Pay period and date"**. Intro: "Which month is this payroll for, and when should employees be paid?"

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Pay period | select: November 2026 (this month), October 2026, September 2026 | Yes | Not later than this month; no run for it pending, released or paid | "Choose a pay period not later than this month. (INVALID_PERIOD)" / "Payroll for 2026-10 has already been started. (PAYROLL_ALREADY_RUN)" |
| Pay date | date, business days for the next 25 days, hint "Employees see the money on this day. We work out when to send it." | Yes | A working day after today | "Choose the pay date." / "Choose a working day. (DATE_NOT_WORKING_DAY)" |
| Pay from | select, "{account} ••{last four} · {balance}" | Yes | One of the company's accounts | "Choose the account to pay from." |
| Where do the amounts come from? | chips: Employee register; Upload a CSV file (only when `allowFile` is on) | No (default register) | One of the list | none |

Lock line: "A payroll run always needs 2 different approvers. Cut-off is 16:00 UTC (5h 18m left today). Net pay only: tax and insurance are worked out in your payroll system." Live summary once a date is chosen: for each country the rail and the day it must be sent, then "Approve before 16:00 UTC on the send date, or the run slips by a working day." Rule behind it: working days between today and the pay date (the pay date counts, today does not). United States: ACH standard if there are 2 or more working days, sent 2 working days before, otherwise Same-day ACH sent on the pay date. United Kingdom: Bacs if 3 or more working days, sent 3 working days before, otherwise Faster Payments sent on the pay date. UAE (WPS): UAEFTS, sent on the pay date. Saudi Arabia (Mudad): SARIE, sent on the pay date. Jordan: JoPACC, sent 1 working day before. Example: pay date Fri 6 Nov: ACH sent Wed 4 Nov, Bacs sent Tue 3 Nov, UAEFTS and SARIE on Fri 6 Nov. Button **Continue** (the step has no other button).

**`file`: "Upload the payroll file"** (file source only). Intro: "CSV with these columns: employee ID, net pay, bonus, deduction, reference. Bank details always come from the register." Busy "Reading the file…" (0.8 s). One required file chooser "Payroll file" ("Choose a CSV file (up to 256 KB)", "Choose a file first.") with the four samples above; a failed file shows its message. On Continue: no rows gives `EMPTY_BATCH`; rows for people not on the register or listed twice are shown later as "n lines in the file left out"; people not in the file are marked "Not in the file" and left out of the run.

**`lines`: "Net pay for each person"**. Four tiles: In the run, Ready, Need fixing, Taken out. If lines were refused, a warning card "n lines in the file left out" lists each as "Line n · {id}", the reason and its code. One card per register person:

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Net pay ({currency}) | text with decimal keypad | Yes | A number with up to 2 decimals; net plus bonus minus deduction above 0; up to 1.5 times the monthly salary | "The amount is not valid for this account's currency. Use a number with up to 2 decimals. (INVALID_AMOUNT)" / "More than 1.5 times this employee's monthly salary (up to {x}). (ABOVE_SALARY_CAP)" |
| Bonus | text (only when `allowBonus` is on) | No (default 0) | Zero or more, 2 decimals | `INVALID_AMOUNT`; warning "Includes a bonus of {x}." |
| Deduction | text (only when `allowDeduction` is on) | No (default 0) | Zero or more, 2 decimals, not more than net plus bonus | "Deductions can't be more than the pay. (NEGATIVE_NET)"; warning "Includes a deduction of {x}." |
| Reason for the change | text, shown when this person moved more than 20% against last month (and `varianceCheck` is on) | Yes in that case | Not empty | "Add a short reason for the change. (VARIANCE_REASON_REQUIRED)" |

Per person also: **Take out of this run** / **Add to run**; "account ••nnnn" or "account missing"; "last month {x}". Other checks and warnings: not on the register `NOT_AN_EMPLOYEE` ("Not on the company's payroll register."); `MISSING_BANK_DETAILS` ("Bank details are missing on the register. Ask HR to complete them."); `VARIANCE` ("Up 12% on last month ({x})." or "Down …"); `JOINER`, `LEAVER` (the notes in the table). Button **Start again from the register**. Gate: "Add at least one person to the run. (EMPTY_BATCH)"; "Fix or take out n people with errors to continue."; "No line can be paid. (NO_VALID_LINES)". Live summary: People paid, Total per currency, About in USD. Button **Check caps and totals**.

**`checks`: "Caps, variance and funding"**. Busy "Checking limits and funds…" (0.9 s). Cards: **This run against last month** (USD total, "Last month {x} · up/down n.n% · n people", and, when it moved more than 10%, "The run moved more than 10%. Add a reason below."); **Biggest changes** (the five largest movements per person, "{last} to {now}" with the percent, or "No changes against last month."); **Salary cap** ("Nobody is above 1.5 times their monthly salary. Highest use: n% of the cap."); **Funding and limits** (Debit including fees, Balance of the account, Your limit left today, Company limit left today).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Why is this month different? | text area, max 140 | Yes, only when the run moved more than 10% against last month and `varianceCheck` is on | Not empty | "Add a short reason for the change. (VARIANCE_REASON_REQUIRED)" |

Bank checks at this step: `NO_VALID_LINES`; `LIMIT_USER_EXCEEDED`; `LIMIT_COMPANY_EXCEEDED`; `INSUFFICIENT_FUNDS` ("Insufficient funds: the run needs {x} but the account has {y}."). Button **Continue**.

**`wps`: "Wage protection (WPS) file"**. Intro: "People in the UAE and Saudi Arabia are paid through the national wage protection system." A card "What we build for you": "We create the salary file from this run, so nobody edits it by hand. Several markets reject a wage file that was changed after it was produced." For the UAE: a salary information file (SIF) table (Employee, Labour card, IBAN masked, Pay (AED)), the control record "n employees · AED x", "Lines add up to control total: ✓ matches to the fils" and **Download SIF file** (`WPS_{employer id}_{yyyymm}.SIF`, one employee record per person and one control record). For Saudi Arabia: "n employee(s) paid by SARIE. The bank reports the outcome to Mudad. Check that base wages match your GOSI records."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Employer ID for WPS (13 digits) | text, max 13 | Yes | Exactly 13 digits | "Enter the 13-digit employer ID from your labour ministry card. (WPS_EMPLOYER_ID_INVALID)" |

**`review`: "Review the payroll run"**. A card: "Payroll {month year} · pay date {date}", the USD total, "n employees · fees {x} · debit {y} from {account}". A table Country, Rail (with "send {date}"), People, Amount. A **Lines** card listing each person's Net pay, Bonus and Deduction on separate rows (deduction shown as a negative). A warning "n people are not in this run." when some are out. **Approvals needed**: "2 different approvers: Dana Cruz then Lee Park. Always, whatever the total." and, from USD 25,000.00, "You'll be asked for an extra security check." A **WPS** card when relevant: "n people are paid through the wage protection system. The file is built after the second approval." Hint: "The whole run counts once against your limit and the company's. No money moves until the second approver says yes."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Tell employees their payslip is ready | toggle, sub "A message on the pay date. It never shows amounts." (only when `allowPayslipNotify` is on) | No | none | none |
| How? | chips: Email; In the employee app; Both (shown when the toggle is on) | No (default Email) | One of the list | none |
| Note for approvers (optional) | text area, max 140, placeholder "Monthly payroll" | No | none | none |
| I confirm the salaries in this payroll are correct. | check | Yes | Ticked | "Tick the confirmation first." |

Button **Submit for approval**.

**Code sheet.** "Authorise payroll {yyyy-mm}: USD {total}"; sub "Code sent to ••• 4410. It only works for this run." plus " This amount needs an extra security check." from USD 25,000.00. Code `482100`; the prototype keypad accepts any six digits.

**Result** (amber). Title **Sent for approval**; text "Payroll {yyyy-mm} totalling USD x now waits for 2 different approvers. Nothing has left the account yet."; chip "Waiting for 2 approvers". Receipt rows: Pay period, Pay date, Employees paid, Total (per currency), Debit, Rails, Approvers needed ("2 different approvers"), Left out ("n people"), WPS file ("Built after approval (n people)", when relevant), Payslip message ("On the pay date by email", "…the employee app", "…email and the app", or "Not sent"). Buttons: **Track payment**, **Back to Payments**, **Done**. A payment `PAY-nnnn` of kind payroll is created.

**Other states.** Sandbox "Backend will time out on submit": banner `TIMEOUT` "We didn't get an answer in time. Check Payments before you try again, so you don't pay twice." on `file`, `checks` and at the code; nothing is created. "Bank unavailable": the sheet "We couldn't reach the bank".

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INVALID_PERIOD` | "Choose a pay period not later than this month." | `period` | Change period |
| `PAYROLL_ALREADY_RUN` | "Payroll for {yyyy-mm} has already been started." | `period` | Change period |
| `FILE_FORMAT_UNSUPPORTED` | "That file type isn't supported. Use a CSV file." | `file` | Choose another file |
| `FILE_TOO_LARGE` | "That file is too big. The limit is 256 KB." | `file` | Choose another file |
| `EMPTY_BATCH` | "There is nobody to pay. Add at least one employee." | `file`, `lines` | Back |
| Row codes | `NOT_AN_EMPLOYEE`, `DUPLICATE_LINE`, `INVALID_AMOUNT`, `NEGATIVE_NET`, `ABOVE_SALARY_CAP`, `MISSING_BANK_DETAILS`, `VARIANCE_REASON_REQUIRED` as in section 3 | `lines` | Fix or take out |
| `NO_VALID_LINES` | "None of the lines can be paid." | `lines`, `checks` | Back |
| `LIMIT_USER_EXCEEDED` | "This is above Alex Morgan's daily limit." | `checks` | Back |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit." | `checks` | Back |
| `INSUFFICIENT_FUNDS` | "Insufficient funds in the account." (prototype: "Insufficient funds: the run needs {x} but the account has {y}.") | `checks` | Change account |
| `WPS_EMPLOYER_ID_INVALID` | "Enter the 13-digit employer ID from your labour ministry card." | `wps` | Edit |
| `WPS_TOTAL_MISMATCH` | "The WPS file total doesn't match the run." (defined, not raised in the prototype) | `wps` | Back |
| `DATE_NOT_WORKING_DAY` | "Choose a working day." | `period` | Choose a day |
| `OTP_INVALID`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | README 1.6 wording | Code sheet / failure | As README |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `JOURNEY_DISABLED` | README 1.6 wording | Whole journey | Back / Switch |
| `TIMEOUT` | "We didn't get an answer in time. Check Payments before you try again, so you don't pay twice." | Banner | Check Payments |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank." sheet | Sheet | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{userId}` | company, accounts, `employees` (the register), `me`, limits | `NOT_SUPPORTED` | Existing (register has 4 people today; 9 with country, salary, last month and bank status are (planned)) |
| `importPayroll` | `corp.payroll.import` | `{format: "csv", content}` | `{rows[]: {employeeId, net, bonus, deduction, reference}, rowCount}` | `FILE_FORMAT_UNSUPPORTED`, `FILE_TOO_LARGE`, `EMPTY_BATCH` | (planned) |
| `checkPayroll` | `corp.payroll.check` | `{userId, fromAccountId, period, file}` | `{lines{}, problems{}, validCount, invalidCount, total, requiredApprovers: 2, period, currency}` | `NOT_AUTHORISED`, `ACCOUNT_NOT_FOUND`, `INVALID_PERIOD`, `PAYROLL_ALREADY_RUN`, `EMPTY_BATCH`, `BATCH_TOO_LARGE`; row codes `NOT_AN_EMPLOYEE`, `DUPLICATE_LINE`, `ABOVE_SALARY_CAP`, `INVALID_AMOUNT` | Existing. Planned additions: bonus and deduction, `NEGATIVE_NET`, `MISSING_BANK_DETAILS`, variance, per-country rails |
| `buildWps` | `corp.payroll.wps` | `{paymentId, employerId}` | SIF file and control totals | `WPS_EMPLOYER_ID_INVALID`, `WPS_TOTAL_MISMATCH` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as README | as README | `OTP_INVALID` | Existing |
| `submitPayroll` | `corp.payroll.submit` | `{userId, fromAccountId, period, file}`; (planned) adds `payDate`, `rails`, `reason`, `wpsEmployerId`, `payslipNotice`, `note` | the payment with `status: "pending_approval"`, `required: 2`, `period`, `payee` ("Payroll 2026-11 · 8 employees"), `lines` | `OTP_REQUIRED`, `NOT_AUTHORISED`, `INVALID_PERIOD`, `PAYROLL_ALREADY_RUN`, `NO_VALID_LINES`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `CORE_UNAVAILABLE`; (planned) `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing; creates a pending payment, moves no money; code needed |

Existing rules in the sandbox (`corporate.ts`): period `^(\d{4})-(0[1-9]|1[0-2])$` and not later than this month; a period is taken while a run is pending or released; the cap factor is 1.5 and exactly 1.5 passes; an employee appears once per run; the run is one payment against the limits with `required: 2`. Bank B parity: verdicts `B-201` to `B-205` and errors `ERR-4111` (period), `ERR-4112` (already run) map to the same codes.

#### 6. Permissions, step-up and limits

Permission `pay.create` (README: `biz.payroll.run`). Step-up `otp` at the last step, with the extra security check text from USD 25,000.00. Always 2 different approvers. One payment against Alex's USD 250,000.00 and Alpha's USD 1,000,000.00. No cut-off rule of its own beyond the send-date rule in `period`; a run not fully approved before 16:00 UTC on the send date slips by a working day.

#### 7. Result and links out

Receipt as in section 3 with the BankWorkx® reference. Notifications (planned): to both approvers "Payment awaiting your approval" (link `approve-payments`); if the payslip message is on, a message to each employee on the pay date (email or app, no amounts). After the second approval the WPS file is built (planned). Links out: **Track payment** (Payments tracker, the payroll payment), **Back to Payments**, **Done**.

#### 8. Acceptance criteria

- AC-1: A period later than this month, or one with a run already pending, released or paid, is refused; a rejected or withdrawn run frees the period.
- AC-2: Only people on the register can be paid, each once; bank details come from the register; a person without bank details is out of the run unless fixed.
- AC-3: Pay is net plus bonus minus deduction, shown as separate lines; it may not exceed 1.5 times the monthly salary and can never be negative.
- AC-4: A person who moved more than 20% against last month, and the run if it moved more than 10%, need a reason when `varianceCheck` is on.
- AC-5: Each country group is paid on its own rail and send date derived from the pay date; same-day rails send on the pay date.
- AC-6: When UAE or Saudi people are paid and `wpsFile` is on, a WPS step builds the SIF file whose control total equals the lines, and needs a 13-digit employer ID.
- AC-7: The run goes for approval only after consent and a verified code and always needs 2 different approvers; no money moves until both approve.
- AC-8: Over either daily limit or over the balance stops the run before the code.
- AC-9: A CSV file is checked for type, size and lines; rows for unknown or duplicate people are left out and listed.
- AC-10: A timeout or unavailable bank creates nothing and says so; the journey off gives `JOURNEY_DISABLED`; only a Maker at Alpha can start it.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-2, AC-3, AC-5, AC-7 | `alex` at Alpha | none | Period November 2026, pay date Fri 27 Nov, Operating, register. 8 people ready (Faris out). Totals USD 17,800.00, GBP 2,900.00, AED 25,500.00, SAR 9,000.00; about USD 30,857.63; extra security check; 2 approvers. WPS step: employer ID `1234567890123`, SIF download. Review, tick, code. Result "Sent for approval", "Waiting for 2 approvers". |
| T-2 | AC-1 | `alex` | none | Choose October 2026: `PAYROLL_ALREADY_RUN` "Payroll for 2026-10 has already been started."; Continue disabled. |
| T-3 | AC-3 | `alex` | none | Sana net `7,200.01`: ABOVE_SALARY_CAP "up to $7,200.00"; `7,200.00` passes (exactly the cap). Deduction 5,000.00 on Ali's 3,600.00: NEGATIVE_NET. Faris added back: MISSING_BANK_DETAILS. |
| T-4 | AC-4 | `alex` | none | Bilal net `3,900.00` against 2,700.00 last month: "Up 44% on last month ($2,700.00)." and a required reason; empty reason keeps Continue disabled. A run up more than 10% (add bonuses of 4,000.00 to Hina): `checks` requires "Why is this month different?". |
| T-5 | AC-9 | `alex` | `allowFile` on | Upload `payroll_2026-11_errors.csv`: Sana error, Bilal error, `emp_zzz` and the second Ali line left out, Hina ready with bonus and deduction notes; others "Not in the file". |
| T-6 | AC-9 | `alex` | none | `payroll_oct.xlsx`: FILE_FORMAT_UNSUPPORTED; `payroll_all_year.csv`: FILE_TOO_LARGE. |
| T-7 | AC-6 | `alex` | none | Employer ID `123`: "Enter the 13-digit employer ID…" Continue disabled. Take Noor, Layla and Yousef out: the WPS step is skipped. |
| T-8 | AC-5 | `alex` | none | Pay date Fri 6 Nov: summary shows ACH sent Wed 4 Nov, Bacs sent Tue 3 Nov, UAEFTS and SARIE on Fri 6 Nov. Pay date Wed 4 Nov: Same-day ACH and Faster Payments. |
| T-9 | AC-8 | `alex`, setup: Operating available set to 20,000.00 | none | Checks: `INSUFFICIENT_FUNDS` "the run needs … but the account has …". Setup: limit used 240,000.00: `LIMIT_USER_EXCEEDED`. |
| T-10 | AC-10 | `alex` | `timeout: ["corp.payroll.submit"]` | Review submit: banner TIMEOUT; no payroll payment appears in Payments. |
| T-11 | AC-10 | `alex` | `unavailable: ["corp.payroll.check"]` | Continue on `lines`: sheet SERVICE_UNAVAILABLE. |
| T-12 | AC-10 | `alex` at Beta | none | Entries are not shown; forced open: `PERMISSION_DENIED`. |
| T-13 | AC-10 | `alex` | `payroll-run` off | Entries gone; forced open `JOURNEY_DISABLED`. |
| T-14 | AC-7 | `alex`, `allowBonus` and `allowDeduction` off | none | The Bonus and Deduction fields are absent from every person card. |

#### 10. Expected mutation-check survivors

- The pay-date arithmetic for Jordan and for weekends survives (T-8 covers the US and UK).
- The 20% per-person variance threshold survives if only one person is tested around 20%.
- The payslip message (email, app, both) survives: nothing is sent in the prototype.
- `WPS_TOTAL_MISMATCH` survives: it is defined but never raised.
- The SIF record layout survives: the test checks the control total, not the file text.
- `INVALID_PERIOD` survives: the period list never offers a later month.
- Joiner and leaver warnings survive (display only).

---
## Business: Approvals

The Approvals tab is where a second person decides on what a Maker started. Three shell screens (inbox, signatory progress, history) and one journey (`approve-payments`). Rule behind all of it (existing, `corporate.ts`): nobody approves what they started (`SELF_APPROVAL`), the same approver cannot approve twice (`ALREADY_APPROVED`), a payment above the dual-approval threshold and every payroll run need two different approvers, and the last approval releases the money after re-checking funds and the company limit.

### Shell: Approvals inbox

#### Purpose
The approver's work list: every payment waiting for a decision from this person, most urgent first, with the choice to open one or select several and approve them together.

#### Route and view-model
| Item | Value |
|---|---|
| Web path | `/business/<companyId>/approvals` |
| Mobile screen | `ApprovalsInbox` (tab 4) |
| View-model | `packages/bank-client/src/view-models/business-approvals.ts` *(planned)*: `{ rows, filters, selection, counts }` |
| Permission to open | `biz.approvals.view`. Approve and reject buttons need `biz.approvals.approve`. A Maker with only `biz.approvals.view` sees the screen as "Waiting for others": their own payments, read only (no checkboxes, no Approve). |

#### Data source
`corp.payments.pending {userId, as: "approver"}` (existing). It returns what waits for this person: pending payments that are not theirs and that they have not already approved, oldest first (`initiatedAt`, then id). Each item carries `id`, `amount`, `currency`, `payee`, `reference`, `initiatedBy`, `initiatedAt`, `valueDate`, `afterCutoff`, `required`, `approvals[]`, and for bulk or payroll `lines`, `period`. Filtering and sorting are done in the view-model over this list (it is at most one day's work). `signatories` and `urgency` fields are *(planned)*, see the signatory shell.

#### Table (web `dataTable` *(planned)*; phones: card list)
| Column | Content | Sort | Default |
|---|---|---|---|
| Select | checkbox (hidden without `biz.approvals.approve`) | – | – |
| Payment | `payee`, with the reference underneath ("3 payments", "Payroll 2026-10 · 3 employees") | by payee | – |
| Type | `statusChip` *(planned)*: Single, Bulk, Payroll | by type | – |
| Amount | `amount` and `currency` | by value | – |
| Started by | name of `initiatedBy`, with date `12 Nov 2026` and time | by date | – |
| Progress | "{approvals} of {required} approved" | by remaining | – |
| Value date | `valueDate`, with a chip "After cut-off" when `afterCutoff` | by date | – |
| Cut-off | countdown to the cut-off for today's value date: "2h 10m left" or "Missed" | by urgency | **Sort ascending by this column** |
Default sort: payments that must be approved before today's cut-off first (soonest cut-off), then the rest by `initiatedAt` oldest first. A payment that was started after the cut-off shows "Next working day" in the Cut-off column and sorts after the urgent ones.

#### Filters and search
| Filter | Control | Values |
|---|---|---|
| Search | text | payee, reference, payment id |
| Type | chips | All, Single, Bulk, Payroll |
| Amount | range | from, to (company currency) |
| Started by | select | the company's users who can initiate |
| Needs | chips | Any, My approval first, Second approval |
| Value date | `datePicker` *(planned)* range | any |
Filters are kept while the person stays on the tab and cleared on a context switch (README 5.4). A "Clear filters" link appears when any is set.

#### Selection and batch bar
- Checkbox per row; a header checkbox selects all rows on the current page (page size 25). Selection is kept across pages and lost on leaving the tab.
- When at least one row is selected, a bar shows "{n} selected · total {sum}" and the buttons **Approve {n}** and **Reject {n}**. At most 20 may be selected *(proposed)*; the 21st shows the hint "You can approve up to 20 payments at a time."
- **Approve {n}** opens `approve-payments` with `{paymentIds}`. **Reject {n}** opens it in reject mode.
- A row can also be opened (click or tap) to see the payment detail panel: the review fields of the journey plus the signatory progress (next shell).

#### States
| State | What the person sees |
|---|---|
| Loading | 6 skeleton rows. After 10 seconds: "This is taking longer than expected. Nothing was changed." with **Try again**. |
| Empty | "Nothing is waiting for your approval." (exact text of the journey today). No button. Under it: link "See history". |
| Empty after filters | "No payments match these filters." with **Clear filters**. |
| Error | "We couldn't load your approvals. Nothing was changed." with **Try again**. `SESSION_EXPIRED`: standard message, **Sign in**. `PERMISSION_DENIED`: "Your role doesn't allow this. Ask an administrator at {company}." |
| Payment taken meanwhile | If someone else approves or rejects a row while it is on screen, it greys out with "Already {approved/rejected} by {name}" on the next refresh (30 s, or on pull to refresh). |

#### Drill-downs and launch points
| Tap | Leads to | Passes | Permission |
|---|---|---|---|
| Row | Payment detail panel (shell) with **Approve** and **Reject** | `{paymentId}` | `biz.approvals.view` |
| Approve / Reject on a row | `approve-payments` | `{paymentId}` | `biz.approvals.approve` |
| Approve {n} / Reject {n} | `approve-payments` | `{paymentIds}` | `biz.approvals.approve` |
| Started by (name) | filters the list | – | – |
| See history | Approvals › history | – | `biz.approvals.view` |
| Notification "Payment awaiting your approval, {company}" | switch context, then `approve-payments` | `{companyId, paymentId}` | `biz.approvals.approve` |

---

### Shell: Signatory progress

#### Purpose
Shows, for one payment, who must approve, who has, and who is next. It appears inside the payment detail (inbox row, tracker, history) and at the end of `approve-payments`.

#### Route and view-model
| Item | Value |
|---|---|
| Web path | `/business/<companyId>/payments/<paymentId>` (panel on the inbox, full page in the tracker) |
| Mobile screen | `PaymentDetail` |
| View-model | `payment-progress.ts` *(planned)* in `bank-client/src/view-models/` |
| Data | `corp.payments.get {paymentId}` (existing: `required`, `approvals[{userId, at}]`, `status`, `rejectedBy`, `rejectReason`, `releasedAt`, `releaseReference`) plus `signatories` *(planned)* |
| Permission | `biz.approvals.view` (own payments for a Maker) |

#### Today and planned
Today the rule is a count: `required` is 1 or 2 different approvers, in any order ("parallel"). The planned **signatory group** (README 3.3, journey `edit-signatory-group`) adds a mode and ordered steps. `corp.payments.get` then also returns:
`signatories: [{ step, label, groupId, mode: "parallel" | "sequential", state: "done" | "waiting" | "blocked", userId?, name?, at? }]` and `nextActors: [userId]`.

| Mode | Meaning | What the screen shows | What the bank does |
|---|---|---|---|
| Parallel (today) | Any `required` different approvers, in any order | A row per slot: "Approver 1 · done by Dana Haddad, 12 Nov 2026 09:14" and "Approver 2 · waiting" | Approve works for any eligible approver |
| Sequential *(planned)* | Step 1 must approve before step 2 can | A vertical `timeline` *(planned)*: Step 1 (done), Step 2 (waiting, "Only after step 1"), Step 3 (blocked) | Step 2 is not listed in the inbox of its approver until step 1 is done; a forced approve answers `NOT_YOUR_TURN` *(planned)*: "This payment is waiting for an earlier approver first." |

#### Layout
- A header `statusChip`: Waiting for approval (amber), Released (green), Rejected (red), Withdrawn (grey, a rejection with the reason "Withdrawn by the person who started it").
- A `timeline` of events, newest at the bottom: "Started by Priya Nair · 12 Nov 2026 08:41", "Approved by Alex Morgan · 09:14", "Released · CORP-20261112-0007" or "Rejected by Dana Haddad: {reason}".
- A progress bar "{done} of {required}".
- For a bulk or payroll payment, a count of rows and a link "View the rows" (a `dataTable` of `lines`). The planned `leftOut` rows show under "Left out".
- A box "Value date": `valueDate`; when `afterCutoff`: "Started after the cut-off, so it goes out on {valueDate}."

#### States
Loading: skeleton timeline. Not found: "We can't find that payment." (code `PAYMENT_NOT_FOUND`) with **Back to approvals**. Error: "We couldn't load this payment. Nothing was changed." with **Try again**. Empty: not reachable.

#### Drill-downs and launch points
| Control | Leads to | Passes | Permission |
|---|---|---|---|
| **Approve** / **Reject** (only while pending and not already approved by the person, and not their own) | `approve-payments` | `{paymentId}` | `biz.approvals.approve` |
| **Withdraw** (only the Maker who started it, while pending) | `withdraw-payment` | `{paymentId}` | `biz.payments.withdraw` |
| **Repair rejected lines** (bulk with left-out rows) | `repair-bulk-lines` | `{paymentId}` | `biz.payments.bulk` |
| **Save as template** | `payment-template` | `{paymentId}` | `biz.templates.manage` |

---

### Shell: Approvals history

#### Purpose
What this person (and, for those who may see it, the company) approved or rejected, and how it ended. It is the audit-friendly record behind "I never saw that".

#### Route and view-model
| Item | Value |
|---|---|
| Web path | `/business/<companyId>/approvals/history` |
| Mobile screen | `ApprovalsHistory` |
| Data | `corp.payments.list {userId, status, from, to, approvedBy, q, sort, page}` *(planned)*; fields as `corp.payments.get` plus `approvals[]`, `rejectedBy`, `rejectReason`, `releaseReference` |
| Permission | `biz.approvals.view`. The scope "Everyone's decisions" needs `biz.audit.view`; without it only "My decisions". |

#### Table
| Column | Content | Sort |
|---|---|---|
| Decided | date and time of the last event | **default, newest first** |
| Payment | `payee` and reference | – |
| Amount | with currency | by value |
| Started by | name | – |
| My decision | Approved, Rejected, or "Not involved" (for the wide scope) | – |
| Outcome | `statusChip`: Released (green), Waiting for second approver (amber), Rejected (red, with reason in a tooltip) | – |
| Release reference | `releaseReference` such as `CORP-20261112-0007` | – |
Filters: Outcome (All, Released, Rejected, Waiting), My decision (All, Approved, Rejected), date range (`datePicker` *(planned)*, default last 30 days), search (payee, reference, id). Export to CSV needs `biz.accounts.export`.

#### States
Loading: skeleton rows. Empty: "No decisions yet." Empty with filters: "No payments match these filters." with **Clear filters**. Error: "We couldn't load the history. Nothing was changed." with **Try again**; timeout: "This is taking longer than expected. Nothing was changed."

#### Drill-downs
Row → the payment detail (signatory progress shell above). No journey is started from history except **Save as template**. Launch point: Approvals › history › View → shell payment detail (README 5.3).

---

### ★ Approve payments — `approve-payments`

Catalog: `approve-payments`, workspace business, category Approvals, core no (kept in the "Lean" preset), a bank can switch it off (yes). Options: `batch` "Allow batch approval" (default on); `stepUp` "Extra security check from 25,000.00" (on); `changes` "Allow “Ask for changes”" (on); `delegate` "Allow passing a payment to another approver" (on).

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `approve-payments` |
| Purpose | The approvals inbox. An Approver sees the payments started by colleagues that wait for them, sees everything needed to decide (payee and account, both currencies, purpose, rail, documents, name check, risk flags, who has approved, the audit trail), and approves, rejects, sends back for changes, or passes a payment to another approver. Several payments can be approved together, with one security check. A countdown shows the 16:00 UTC cut-off. |
| Release / workspace | 1 / Business |
| Status | Built in the prototype as a screen with confirmations (`design/bankworkx-r1/src/journeys/44-approve-payments.js`, a view on the Approvals tab; research `research/approve-payments.md`). Replaces the earlier spec, which was a wizard (`inbox`, `detail`, `confirm`, code) for approve and reject only. |
| Channels | Web (list beside detail) and mobile (list, then detail) |
| Starting pattern | `fixtures/corporate-approval.ts` for the approve call; the filters, detail, name check, batch, changes, delegate and history are new. |
| Who may use it | Business permission `pay.approve` in the prototype (README 4.2: `biz.approvals.approve`). Alex Morgan is Approver at Beta Services Ltd. At Alpha he is Maker without this permission: the screen shows the denied state and, below it, his own requests waiting for approval. |
| Launch parameters | `{paymentId}` opens that payment in the detail. |
| Shared reference | `09-payment-rails.md` section 9 (limits and security checks); README 4.2 and 4.3. |

**The rules the screen enforces.** Nobody approves what they started (`SELF_APPROVAL`) and nobody approves twice (`ALREADY_APPROVED`). Some payments must be approved in order (a sequential group): Alex waits for the earlier signatory (`OUT_OF_SEQUENCE`). Up to USD 50,000.00 one approval is enough from any one of the group; above it two different people. From USD 25,000.00 (exactly 25,000.00 included) approving needs an extra security check, one code for a whole batch, and the code prompt names the amount. After 16:00 UTC the payment can no longer be approved that day (`APPROVAL_EXPIRED`); at exactly 16:00 it is already expired. A payment on which changes were requested cannot be approved until the maker resubmits (`CHANGES_REQUESTED`). A payment handed to someone else is no longer in the person's queue (`DELEGATED`). A close or missing payee name needs a tick that the approver checked the details by phone or from a trusted record (`NAME_CHECK_ACK`) and is not approved in a batch.

**Sandbox demo values.** Clock: Tue 3 Nov 2026, 10:42 UTC ("Cut-off in 5h 18m"). A checkbox **Demo: pretend it is 16:05 UTC (after the cut-off)** moves the clock to 16:05 and back. At Beta Services Ltd (Alex is Approver; Beta's approvers are Alex Morgan and Lee Park; other approvers who can receive a delegation: Lee Park, Maria Silva, Sam Okafor):

| Payment | Started by | Payee | Amount (USD equivalent) | Rail and currency | Needs | State for Alex |
|---|---|---|---|---|---|---|
| `PAY-2041` | Priya Nair | Nimbus Logistics, ABA 021000021 ••5521, "Freight, October deliveries", ref `INV-2291` | 8,200.00 | ACH, USD | 1 (Alex or Lee Park) | Ready for you; no security check |
| `PAY-2039` | Omar Haddad | Nimbus Logistics, "Warehouse fit-out, stage 2", ref `INV-2270` | 64,500.00 | Wire (Fedwire), USD | 2, in order Lee Park then Alex; Lee Park has approved | Ready for you (Alex is next); flags: above the 50,000.00 two-approver limit, started after yesterday's cut-off, amount is 4 times this payee's average; documents `INV-2270.pdf`, `Contract-stage2.pdf` |
| `PAY-2043` | Priya Nair | Rhine Freight GmbH, DE89 •••• 3000, "Road freight, Rotterdam to Munich", ref `INV-RF-8841` | 27,500.00 (about EUR 25,462.96 at 1 EUR = 1.0800 USD) | SEPA Credit Transfer, EUR | 1 | Ready for you; name check "Close match": "Rhine Freight GmbH vs “Rhine Fracht GmbH” on the bank's record"; security check |
| `PAY-2044` | Alex Morgan | Nimbus Logistics, "Courier surcharge", ref `INV-2288` | 9,800.00 | ACH, USD | 1 (Lee Park or Maria Silva) | Started by you: approve refused with `SELF_APPROVAL` |
| `PAY-2046` | Omar Haddad | Rhine Freight GmbH, "Quarterly freight contract", ref `INV-RF-8790` | 56,000.00 | SEPA Credit Transfer, EUR | 2, any order (Alex, Lee Park) | Ready for you; security check |
| `PAY-2047` | Priya Nair | Nimbus Logistics, "Equipment lease, 12 months", ref `INV-2301` | 72,000.00 | Wire, USD | 2, in order Lee Park then Alex; value date Wed 4 Nov | Waiting for others (`OUT_OF_SEQUENCE`) until Lee Park approves |
| `PAY-2048` | Omar Haddad | Gulf Trade FZE, AE07 •••• 3456, "Sample shipment", ref `INV-GT-117` | 6,100.00 (AED) | UAE instant payment, AED | 1 | Ready for you; name check "No match": "No account holder named “Gulf Trade FZE” was found"; first payment to this payee; no document attached |

Open at start: 7 payments, total USD 244,100.00, 5 "ready for you". History at Beta: `PAY-2036` (Priya Nair, USD 5,300.00, expired at the cut-off yesterday, `APPROVAL_EXPIRED`), `PAY-2012` (USD 3,400.00, paid 28 Oct, approved by Alex Morgan). At Alpha: `PAY-2040` (Alex's own USD 18,900.00 to Harbour Packaging, waiting, 0 of 1 approved) and `PAY-1187` (paid 30 Oct, approved by Dana Cruz). Code `482100`; the prototype keypad accepts any six digits.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Overview › Approvals queue | none | `pay.approve` |
| Approvals tab | none | `pay.approve` |
| Notification › "Payment awaiting your approval" | `{paymentId}` | `pay.approve` |
| Command bar › Approvals | none | `pay.approve` |
| Bulk payment, payroll and supplier payment results (for the Maker) | none (the Maker sees "Track payment" instead) | none |

Without the permission the entries are hidden. With the journey off, the Approvals tab shows "Not available at your bank" and a forced open gives `JOURNEY_DISABLED`.

#### 3. Screens

This is one screen with an inbox, a detail and four action panels. There is no stepper. On a phone the list and the detail are separate pages with a Back button; on desktop they sit side by side and the first ready payment is opened.

**Inbox (list).** Header card: "Waiting for approval · {company}", "n ready for you", "n open · total USD x". Cut-off strip: a chip ("Cut-off in 5h 18m", amber under 90 minutes, red under 30, "Cut-off passed" red) and the text "Payments approved by 16:00 UTC go out today. It is 10:42 UTC." (after the cut-off: "Payments not approved by 16:00 UTC expire. The maker must start them again for the next business day."). Tabs **Inbox (n)** and **History**.

| Filter | Block | Options |
|---|---|---|
| Status | select | All open; Ready for you; Waiting for others; Changes requested; Delegated; Started by you |
| Amount | select | Any amount; Under 25,000; 25,000 to 50,000; Over 50,000 |
| Submitter | select | Any submitter, or a person who started a payment |
| Rail | select | Any rail, or a rail in the list |
| Due before today's cut-off | check | Only payments with value date today |

Each row: (with `batch` on) a checkbox "Select {id}", "USD 8,200.00 to Nimbus Logistics", "{who} · {when} · {rail}", chips: state (Ready for you green, Waiting for others blue, Changes requested amber, Delegated grey, Started by you grey, Expired red), "n of k approved", "Extra check" (from 25,000.00), the name check chip for a close match or no match, and "Value date {date}" when not today. Empty list: **All caught up** / "No payments are waiting for approval. New ones appear here as soon as a colleague starts them." Filter with no match: **Nothing matches** / "Try a different filter." with **Clear filters**. With no row open on a phone nothing else shows. **History** tab: table Payment, Payee, Amount, Outcome (status chip, the rejection reason or the approvers) for every payment that is no longer waiting; empty: **No history yet** / "Payments you approve, reject or pass on will be listed here."

**Detail.** Header: payment id, state chip, the USD amount, and for another currency "About EUR x at 1 EUR = 1.0800 USD. The payee receives EUR." (for USD "Paid in USD. No conversion."). A banner explains why the person cannot act (the message of the blocking code), and, after a request for changes, "You asked {maker} to change: {note}". Rows: Payee (name, bank, masked account), From account, Purpose, Rail, Reference, Value date, Started by; **Payee name check** with a chip (Name matches, Close match, No match, Check unavailable) and the bank's text. **Risk flags** chips (or "No risk flags."). **Supporting documents**: PDF rows ("PDF · uploaded by {maker}"), or "None attached." **Who must approve** card: "1 approval from any one of A or B", "2 approvals, in order: A then B" or "2 approvals, in any order from A and B", "Above 50,000.00 two different people must approve." when relevant, a timeline of signatories ("Approved", "Next to approve", "Waits for A", "Any one approver", "Can approve in any order") with "(you)" on Alex, and the cut-off chip with "Approve before 16:00 UTC to go out today." (or "on {date}"). Action card: **Approve USD x**, **Reject**, **Ask for changes** (`changes` on), **Pass to someone** (`delegate` on). The Approve button is disabled when any block applies; Reject, Ask for changes and Pass to someone stay available for `OUT_OF_SEQUENCE` and, for Reject and Ask for changes, `SELF_APPROVAL`. Below: **Audit trail** (timeline "{event} · {who} · {time}"). Sandbox buttons: **Demo: {maker} resubmits** and **Demo: {earlier signatory} approves first**.

**Panel: "Check before you approve"** (opens on Approve).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| I checked the payee details with the supplier by phone or from a trusted record | check, shown when the name check is Close match or No match | Yes then | Ticked | "The payee name did not fully match. Confirm that you checked the details with the supplier. (NAME_CHECK_ACK)" |

The panel repeats Pay (amount and payee), From, Purpose; warns "No supporting document is attached." when none; and, from USD 25,000.00 with `stepUp` on, says "This amount needs an extra security check next." The button reads **Continue to security check** (from 25,000.00) or **Approve USD x**; **Cancel**. Under 25,000.00 the approval is applied at once; from 25,000.00 the code sheet opens.

**Code sheet** (extra security check). Title "Approve USD x" (or "Approve n payments"); sub "Extra security check: enter the code from your BankWorkx® token or app. Sent to ••• 4410" (batch: "one code covers every payment in this batch"). Code `482100`; the prototype keypad accepts any six digits; failure `STEP_UP_FAILED` "The security check did not pass. Nothing was approved." (planned in the prototype).

**Panel: "Reject this payment".** Text "{maker} is told why. Nothing is sent and {account} is not debited."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Reason | chips: Wrong amount; Wrong payee or bank details; Unknown supplier; Duplicate payment; Missing supporting document; Suspected fraud; Other | Yes | One of the list; "Other" needs a note of at least 10 characters | "Choose a reason. For “Other”, write at least 10 characters. (REASON_REQUIRED)" |
| Note | text area, max 300, placeholder "Anything the maker should know" | Only for Other | 10 to 300 characters | as above |

Button **Reject payment** (red, disabled until valid). Result **Payment rejected**: "{amount} to {payee}. Nothing was sent.", chip "Rejected"; rows Payment, Reason, Told ("{maker} by notification and email"), Money ("{account} was not debited").

**Panel: "Ask for changes".** Text "The payment goes back to {maker}. Approvals already given are kept, and it must be resubmitted before the cut-off."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| What should change? | text area, max 300, placeholder "For example: attach the signed delivery note", hint "At least 10 characters." | Yes | 10 to 300 characters | "Tell the maker what to change, in at least 10 characters. (NOTE_REQUIRED)" |

Button **Send back**. Result **Changes requested**: "{maker} has been asked to update {id}. Approvals pause until they resubmit.", chip "Sent back to maker"; rows Payment, Your note, Approvals kept.

**Panel: "Pass to another approver".** Text "Use this when you are out of office. Only people with the approver role at {company} are listed. This payment only; your own rights do not change."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Approver | select: Choose…, then the approvers at the company other than Alex | Yes | Not the person who started the payment; not someone who already approved | "That person started this payment, so they can't approve it. Choose someone else. (DELEGATE_CONFLICT)" / "That person has already approved this payment. Choose someone else. (DELEGATE_ALREADY_APPROVED)" |
| Valid until | select: Until the cut-off today; 16:00 today; 16:00 tomorrow | No | One of the list | none |

Button **Pass it on**. Result **Passed to {name}**: "{name} can now approve {id}. It is no longer in your queue.", chip "Delegated"; rows Payment, Delegated to, Valid for ("This payment only, until …"), "Your name stays on" ("The audit trail").

**Batch approval** (`batch` on). Ticking rows shows a bar "n selected" with **Clear** and **Review batch**. The batch page "Approve n payments" says "Each payment is checked on its own. Any that can't be approved are left out and stay in your inbox." A table Payment, Payee, Amount, Check ("Can approve" or the reason, e.g. "You started this payment, so you can't approve it."). Card: "Will be approved m of n", Total, "Security check: Needed once for the batch" (when any payment is 25,000.00 or more) or "Not needed". Warning "A payee name didn't fully match. Approve that payment on its own after checking it. It is left out of batches." Button **Approve m payments**. (planned: the prototype shows this warning but does not yet remove the payment from the batch.)

**Result** (shown in place of the screen). Approve: **Approved and released** (green, chip "Released to bank") when the last required approval is given; **Approved, one more approval needed** (amber, chip "Waiting for another approver"); a batch: "n payments approved", chip "Released to bank" or "m released, k waiting". Rows: Payments, Total, "Approved by" ("Alex Morgan, 10:42 UTC"), Security check ("Passed" or "Not needed"), "Released now" ("m of n"), and for a single payment still short, "Still needed" (the names). Reference `APR-…`. Buttons **Back to approvals**, **See payment tracker**.

**Denied view.** At a company where the person is only a Maker: the standard denied page for "the approvals inbox", then **Your requests waiting for approval** with a row per own pending payment ("USD x to {payee}", "{id} · n of k approved", status chip) that opens the Payments tracker.

**Other states.** Loading is instant in the prototype. "Bank unavailable" (sandbox): the sheet "We couldn't reach the bank" when Approve or Review batch is pressed. A refusal never changes the payment; each refusal is written to the audit as "Tried to act on {id} ({code})" with the result "Refused {code}".

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `PERMISSION_DENIED` | "Refused by the bank: your role here can't approve payments." | Denied view / banner | Back |
| `SELF_APPROVAL` | "You started this payment, so you can't approve it. Another approver must." | Detail banner | Reject or Ask for changes still possible |
| `ALREADY_APPROVED` | "You have already approved this payment." | Detail banner | Back |
| `OUT_OF_SEQUENCE` | "This payment needs an earlier approver first. You are next after they approve." | Detail banner | Pass to someone, Reject |
| `APPROVAL_EXPIRED` | "The 16:00 UTC cut-off has passed. This payment can no longer be approved today." | Detail banner | Back |
| `CHANGES_REQUESTED` | "Changes were requested. The maker must update and resubmit before anyone can approve." | Detail banner | Back |
| `DELEGATED` | "This payment was passed to another approver." | Detail banner | Back |
| `NOT_PENDING` | "This payment is no longer waiting for approval." | Detail banner | Back |
| `NAME_CHECK_ACK` | "The payee name did not fully match. Confirm that you checked the details with the supplier." | Approve panel | Tick the box |
| `REASON_REQUIRED` | "Choose a reason. For “Other”, write at least 10 characters." | Reject panel | Choose a reason |
| `NOTE_REQUIRED` | "Tell the maker what to change, in at least 10 characters." | Changes panel | Edit |
| `DELEGATE_CONFLICT` | "That person started this payment, so they can't approve it. Choose someone else." | Delegate panel | Choose someone else |
| `DELEGATE_ALREADY_APPROVED` | "That person has already approved this payment. Choose someone else." | Delegate panel | Choose someone else |
| `STEP_UP_FAILED` | "The security check did not pass. Nothing was approved." | Code sheet | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Nothing was approved. Try again in a moment." | Sheet | Try again |
| `INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`, `CORE_UNAVAILABLE`, `PAYMENT_NOT_FOUND`, `NOT_YOUR_TURN`, `SELECTION_TOO_LARGE`, `EMPTY_SELECTION` | README 1.6 wording (adapter codes the last approval or batch can return) | Banner | As README |
| `TIMEOUT` | "We didn't get an answer in time. Check the payment's status before you try again." (not simulated in the prototype) | Banner | Check status |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | Whole tab | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{userId}` | company, accounts, `me`, limits, `dualApprovalAbove`, `cutoff` | `NOT_SUPPORTED` | Existing |
| `pending` | `corp.payments.pending` | `{userId, as?}` | payments keyed by id with `payee`; (planned) with rail, currency, purpose, `nameCheck`, flags, documents, signatories, `sequential`, `valueDate`, `changesRequested`, `delegatedTo`, audit | `USER_NOT_FOUND`, `NOT_SUPPORTED` | Existing; extra fields (planned) |
| `payment` | `corp.payments.get` | `{paymentId}` | the payment | `PAYMENT_NOT_FOUND` | Existing (access check planned) |
| `history` | `corp.payments.history` | `{userId, from?, to?}` | non-pending payments | `PERMISSION_DENIED` | (planned) |
| `stepUp` | `bank.session.stepUp` | `{code}` | `{stepUpUntil}` | `STEP_UP_FAILED` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as README | as README | `OTP_INVALID` | Existing |
| `approve` | `corp.payments.approve` | `{userId, paymentId}` | `released` with `releaseReference`, or `pending_approval` with `approvals` | `OTP_REQUIRED`, `NOT_AUTHORISED`, `PAYMENT_NOT_FOUND`, `PAYMENT_NOT_PENDING`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`, `CORE_UNAVAILABLE`; (planned) `OUT_OF_SEQUENCE`, `APPROVAL_EXPIRED`, `CHANGES_REQUESTED`, `NAME_CHECK_ACK`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing. The last approval moves the money. The existing call needs a code every time; the prototype asks for one only from USD 25,000.00 |
| `approveMany` | `corp.payments.approveMany` | `{userId, paymentIds[] (1 to 20)}` | `{results[], released, pending, failed}` | whole call: `OTP_REQUIRED`, `NOT_AUTHORISED`, `PERMISSION_DENIED`, `EMPTY_SELECTION`, `SELECTION_TOO_LARGE`, `STEP_UP_REQUIRED`, `CORE_UNAVAILABLE`; per payment: `PAYMENT_NOT_FOUND`, `PAYMENT_NOT_PENDING`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`, `NOT_YOUR_TURN` | (planned). One code covers the call |
| `reject` | `corp.payments.reject` | `{userId, paymentId, reason?}` | the payment, `rejected` | `NOT_AUTHORISED`, `PAYMENT_NOT_FOUND`, `PAYMENT_NOT_PENDING` | Existing; reason list and note (planned). Gives the Maker's daily limit back |
| `requestChanges` | `corp.payments.requestChanges` | `{paymentId, note}` | payment with `changesRequested` | `NOTE_REQUIRED`, `PAYMENT_NOT_PENDING` | (planned) |
| `delegate` | `corp.payments.delegate` | `{paymentId, toUserId, until?}` | payment with `delegatedTo` | `DELEGATE_CONFLICT`, `DELEGATE_ALREADY_APPROVED`, `PAYMENT_NOT_PENDING` | (planned) |

Bank B parity: `approveMany` is a loop over Bank B's `payments.authorise` in the mapping layer, with its per-item codes mapped (`ERR-4093` self approval, `ERR-4094` already approved, `ERR-4095` not pending, `ERR-4091` funds, `ERR-4292` company limit).

#### 6. Permissions, step-up and limits

Permission `pay.approve` (README 4.2: `biz.approvals.approve`), checked at the launch point, in the screen and in the sandbox (the existing sandbox answers `NOT_AUTHORISED`; the identity step will answer `PERMISSION_DENIED`; a scenario accepts both until then). Separation of duties (`SELF_APPROVAL`, `ALREADY_APPROVED`) is enforced by the bank whatever the screen shows: this is the proof for the Alex demo, where Alex approves Priya's payments at Beta and is refused at Alpha. Step-up: none under USD 25,000.00 (prototype); from USD 25,000.00 the extra security check, valid for one payment or one batch. The company's daily limit is checked when the last approval releases the money; the Maker's limit is given back on reject.

#### 7. Result and links out

Receipt as in section 3 with the reference `APR-…`. Notifications (planned): to the Maker "Your payment {id} was approved / released", "rejected: {reason}", "changes requested: {note}"; to a delegate "A payment was passed to you"; to the other approvers when the Maker resubmits. Audit entries are written for every approval, rejection, request for changes, delegation and refusal. Links out: **Back to approvals**, **See payment tracker**, the Maker's **Track payment**.

#### 8. Acceptance criteria

- AC-1: The inbox lists payments waiting at the company, with filters by state, amount band, submitter, rail and due today, and a count of the ones ready for the person.
- AC-2: The detail shows payee and account, amount in both currencies, purpose, rail, reference, value date, who started it, the name check, risk flags, documents, who must approve with their progress, and an audit trail.
- AC-3: A payment the person started, has already approved, or that waits for an earlier signatory cannot be approved, with the matching code and message, and each refusal is written to the audit.
- AC-4: Approving needs the extra security check from USD 25,000.00 (exactly 25,000.00 included) and none below it; one code covers a whole batch.
- AC-5: A payment needing two approvers is released only after the second approval and says so; a payment above USD 50,000.00 needs two different people.
- AC-6: A close or missing name match needs the tick (`NAME_CHECK_ACK`) before approval and is not approved in a batch.
- AC-7: Reject needs a reason, with at least 10 characters for Other; Ask for changes needs at least 10 characters, keeps earlier approvals and blocks approval until the maker resubmits.
- AC-8: A payment can be passed to another approver for that payment only, never to the maker or to someone who already approved, and it leaves the person's queue.
- AC-9: After 16:00 UTC (including exactly 16:00) no payment can be approved and the screen explains it; the maker must start again.
- AC-10: Batch approval approves each eligible payment, leaves out the ineligible ones with the reason, and reports how many were released.
- AC-11: A person without the permission sees the denied view and their own pending requests, and a forced approval is refused by the bank.
- AC-12: An unavailable bank approves nothing and says so; a timeout leaves the payment unchanged; the journey off gives `JOURNEY_DISABLED`.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex` at Beta | none | Open Approvals: "5 ready for you", "7 open · total USD 244,100.00". Open `PAY-2041` (8,200.00), Approve, Approve: no code asked. "Approved and released", "Released to bank". |
| T-2 | AC-4, AC-5 | `alex` at Beta | none | `PAY-2039` (64,500.00, Lee Park already approved): Approve, Continue to security check, code `482100`: "Approved and released". `PAY-2046` (56,000.00, none yet): after Alex's code, "Approved, one more approval needed", "Still needed Lee Park". |
| T-3 | AC-3 | `alex` at Beta | none | `PAY-2044`: Approve disabled, banner SELF_APPROVAL; Reject still possible. Forced approve: audit "Refused SELF_APPROVAL". Approve `PAY-2041` twice: second gives NOT_PENDING. After `PAY-2046`, approving again gives ALREADY_APPROVED. |
| T-4 | AC-3, AC-5 | `alex` at Beta | none | `PAY-2047`: "Waiting for others", banner OUT_OF_SEQUENCE; **Demo: Lee Park approves first**; now Approve with security check releases it. |
| T-5 | AC-6 | `alex` at Beta | none | `PAY-2043`: Approve without the tick: NAME_CHECK_ACK; with the tick and the code: released. `PAY-2048` shows "No match", "No supporting document is attached." and the tick. |
| T-6 | AC-7 | `alex` at Beta | none | `PAY-2048`: Reject with Other and note `short`: disabled; with "Unknown supplier": "Payment rejected"; the Maker is told. Ask for changes with a 5-character note: disabled; with 20 characters: "Changes requested"; Approve now shows CHANGES_REQUESTED; **Demo: Priya Nair resubmits** restores it. |
| T-7 | AC-8 | `alex` at Beta | none | `PAY-2039`: Pass to someone, Lee Park: DELEGATE_ALREADY_APPROVED. `PAY-2041`: Pass to Maria Silva: "Passed to Maria Silva", row leaves "Ready for you", state "Delegated". Through the bank adapter, delegating `PAY-2041` to Priya Nair gives DELEGATE_CONFLICT. |
| T-8 | AC-9 | `alex` at Beta | Demo clock 16:05 | Rows show "Expired" (or "Started by you"), chip "Cut-off passed", Approve disabled with APPROVAL_EXPIRED; History shows `PAY-2036`. Moving the clock to exactly 16:00 gives the same result. |
| T-9 | AC-10, AC-4 | `alex` at Beta | none | Tick `PAY-2041`, `PAY-2044`, `PAY-2046`: the batch page lists `PAY-2044` with "You started this payment, so you can't approve it."; "Will be approved 2 of 3", "Needed once for the batch"; Approve 2: one code; result "2 payments approved", chip "1 released, 1 waiting" (`PAY-2046` still needs Lee Park). |
| T-10 | AC-11 | `alex` at Alpha | none | Approvals shows the denied view and "Your requests waiting for approval" with `PAY-2040`; a forced approve gives PERMISSION_DENIED. |
| T-11 | AC-12 | `alex` at Beta | `unavailable: ["corp.payments.approve"]` (prototype: Bank unavailable) | Approve: sheet SERVICE_UNAVAILABLE; the payment stays pending. |
| T-12 | AC-12 | `alex` at Beta | `timeout: ["corp.payments.approve"]` | Approve: banner TIMEOUT; the payment is unchanged (not simulated in the prototype; runs on the bank adapter). |
| T-13 | AC-1 | `alex` at Beta | none | Filters: Under 25,000 shows `PAY-2041`, `PAY-2044`, `PAY-2048`; 25,000 to 50,000 shows `PAY-2043`; Over 50,000 shows `PAY-2039`, `PAY-2046`, `PAY-2047`; Submitter Priya Nair; Status "Waiting for others" shows `PAY-2047`; no match: "Nothing matches". |
| T-14 | AC-12 | `alex` at Beta | `approve-payments` off | Approvals tab shows "Not available at your bank"; JOURNEY_DISABLED. |
| T-15 | AC-4 | `alex` at Beta | `stepUp` off | `PAY-2039` approves with no code. |

#### 10. Expected mutation-check survivors

- The boundary of exactly USD 25,000.00 and exactly 50,000.00 survives unless a payment of exactly those amounts is added to the seed (planned).
- The 16:00 versus 15:59 boundary survives (the demo clock jumps to 16:05).
- The batch exclusion of close or missing name matches survives, because the prototype does not implement it (planned).
- Risk flag wording and chip colours survive (display only).
- "Valid until" on a delegation survives: it is stored, not enforced.
- Documents ("Opens … (prototype)") survive: no file opens.
- `TIMEOUT` and `STEP_UP_FAILED` survive in the prototype (not simulated); they are killed against the bank adapters.

---
## Business: Admin

Shell screens for the **Admin** tab, and three journeys: `manage-user`, `change-limits`, `edit-signatory-group`. Release 1. The tab is shown only to a person with at least one of `biz.admin.users`, `biz.admin.limits`, `biz.admin.signatories` or `biz.audit.view`. In the demo, Alex is Maker at Alpha and Approver at Beta, so he sees **no** Admin tab at either company except *Audit trail* at Beta (an Approver holds `biz.audit.view`). `ravi` (Alpha) and `noor` (Beta) are the admins.

**What exists today.** `CorporateSandbox` knows users with `roles: CorpRole[]` (`initiator`, `approver`), `dailyLimit` and `usedToday`; the company has `companyDailyLimit`, `dualApprovalAbove` (a payment above this needs two different approvers) and `cutoff`. `corp.company.get` returns them and `corp.users.list` returns `{ id, name, sub }`. There is no way to change any of it, no admin role, no signatory groups, no audit trail. Everything that changes data below is *planned*.

**Role names.** The README says Maker, Approver, Admin. The sandbox says `initiator` and `approver`. In this spec "Maker" is the label for `initiator`. A new role `admin` (planned) is added to `CorpRole`. A person can hold more than one role (as `nadia` does today), but the four-eyes rule still applies (`SELF_APPROVAL`).

**Planned data (sandbox, `business/admin.ts`)**

| Thing | Shape |
|---|---|
| User | `{ id, name, email, phone, roles: ("initiator" or "approver" or "admin")[], status: "invited" or "active" or "disabled", accountIds: string[], dailyLimit, usedToday, invitedAt, lastSignInAt? }` |
| Signatory group | `{ id, name, mode: "sequential" or "parallel", members: userId[] (ordered for sequential), required: number, appliesAbove: number, accountIds: string[], version }` |
| Audit entry | `{ id, at, actorId, action, target, before?, after?, outcome: "ok" or "refused", code? }` |

**Admin changes and the demo.** Every admin journey needs `stepup` (README 4.3) and writes an audit entry, including refused attempts. Changes apply at once in Release 1 (open question 3 asks whether a second admin must confirm).

### Shell: Users

| | |
|---|---|
| Purpose | See everyone who can act at this company, and start inviting, editing or disabling. |
| Route | Web: `/{project}/business/{companyId}/admin/users`. Mobile: `Business/Admin/Users`. |
| Data source | `adminUsers(ctx)` (planned) over `corp.users.list` (existing name; planned extension: returns the full user record above, with `sub` kept for the sandbox "who" screens). |
| Permission | `biz.admin.users` |

**Columns** (`dataTable`): Name (and email below), Roles (chips: Maker, Approver, Admin), Status (`statusChip`: Active green tick, Invited blue envelope, Disabled grey slash), Accounts ("All 3" or "2 of 3"), Daily limit (company currency; "Not set" for an approver-only user), Last sign-in (`12 Nov 2026 09:15` or "Never"). **Filters**: role, status, search (name or email). **Default sort**: Name A to Z; Disabled users last. **Page size** 25.

**Buttons**: *Invite user* (top right) → `manage-user` `{mode: "invite"}`; row menu *Edit* → `manage-user` `{mode: "edit", userId}`; *Disable* / *Enable* → `manage-user` `{mode: "disable" or "enable", userId}`; *Resend invite* (invited users only; calls `corp.users.invite` again, see below).

**States**: loading (skeleton rows); empty (never, an admin always exists); filtered to nothing "No users match. Clear filters."; error / timeout as in Accounts. A "Disabled" count appears in the header ("12 users · 2 disabled").

### Shell: Roles

| | |
|---|---|
| Purpose | Show what each role can do, so an admin knows what they are granting. Read-only in Release 1. |
| Route | Web: `/{project}/business/{companyId}/admin/roles`. Mobile: `Business/Admin/Roles`. |
| Data source | `adminRoles()` (planned) over `corp.roles.list` (planned; request none; response record keyed by role `{ id, name, description, permissions: string[], userCount }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | `biz.admin.users` |

**Layout**: three cards: Maker, Approver, Admin. Each lists the `biz.*` permissions from README 4.2 in plain words and the number of people. Example copy, Maker: "Starts payments, uploads files, runs payroll, saves templates, withdraws its own pending payments." Approver: "Approves or rejects payments that others started. Cannot start payments." Admin: "Invites and edits users, sets limits and signatory groups. Cannot start or approve payments unless also given those roles."
**States**: loading skeleton; error as above. **Drill-down**: *See users with this role* → Users filtered by role. Custom roles are out of Release 1.

### Shell: Account permissions

| | |
|---|---|
| Purpose | A grid of who can see and use which account. |
| Route | Web: `/{project}/business/{companyId}/admin/account-permissions`. Mobile: `Business/Admin/AccountPermissions` (a list per user). |
| Data source | `adminAccountPermissions(ctx)` (planned) over `corp.accountPermissions.get` (planned; request none; response `{ users: [...], accounts: [...], grants: record keyed by "userId:accountId" `{ view, initiate, approve }` }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | `biz.admin.users` to read and to change |

**Grid**: rows are users; columns are accounts; each cell shows up to three small chips: View, Start, Approve (a chip is present only if granted; the cell is empty when none). **Filters**: user search, account select. **Change**: a cell opens a sheet with three `toggle`s (View, Start payments, Approve payments) and *Save* → `corp.accountPermissions.set` (planned; request `{ userId, accountId, view, initiate, approve }`; response the new grant; error codes `USER_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `GRANT_NOT_ALLOWED` (a grant needs the matching role: "Start" needs Maker, "Approve" needs Approver), `LAST_ADMIN_ACCESS` not used, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; `moneyMoving: false`; needs `stepup`). Messages: `GRANT_NOT_ALLOWED` → "{name} doesn't have the {role} role, so this can't be granted. Edit the user's roles first." This save is a single step, not a journey; if it must be proved it becomes a journey after Release 1 (open question 4). It writes an audit entry.
**States**: loading skeleton grid; empty "No accounts at this company."; error as above.

### Shell: Limits

| | |
|---|---|
| Purpose | Show every limit in force and who is close to theirs. |
| Route | Web: `/{project}/business/{companyId}/admin/limits`. Mobile: `Business/Admin/Limits`. |
| Data source | `adminLimits(ctx)` (planned) over `corp.limits.get` (planned; request none; response `{ currency, company: { daily, usedToday, ceiling }, approvalThreshold, cutoff, users: record keyed by user id `{ id, name, daily, usedToday, remaining }` }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | `biz.admin.limits` |

**Widgets**: (1) *Company* card: "Daily limit {daily}", a bar "Used today {usedToday} ({pct}%)", "Bank ceiling {ceiling}"; (2) *Approval rule* card: "Payments above {approvalThreshold} need two different approvers"; (3) *Cut-off* card: "Payments after {cutoff} UTC are paid on the next working day"; (4) *People* table. **People columns**: Name, Role chips, Daily limit, Used today, Remaining, a bar. **Default sort**: used percentage, high to low. **Buttons**: *Change* on the company card and each row → `change-limits` `{userId}` or `{}` for company-wide (README 5.3 passes `{userId or accountId}`: `accountId` is reserved for account limits in a later release; Release 1 only changes user and company limits).
**States**: loading skeletons; error as above.

### Shell: Signatory groups

| | |
|---|---|
| Purpose | See who must sign payments, in what order, above what amount. |
| Route | Web: `/{project}/business/{companyId}/admin/signatories`. Mobile: `Business/Admin/Signatories`. |
| Data source | `adminSignatoryGroups(ctx)` (planned) over `corp.signatories.list` (planned; request none; response record keyed by group id with the group shape above and `memberNames`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | `biz.admin.signatories` |

**Cards**, one per group: name; a mode label (`statusChip`-style): "Sequential: one after another" or "Parallel: any {required} of {n}"; a visual of the members (sequential: numbered chain 1 → 2 → 3; parallel: a row of avatars with "{required} of {n} needed"); "Applies to payments above {appliesAbove}" and the accounts it covers. Button on each: *Edit* → `edit-signatory-group` `{groupId}`. **Sort**: by `appliesAbove`, low to high. **States**: loading skeleton cards; empty "No signatory groups. Payments need one approver." (this is today's default rule); error as above.

**How the groups relate to today's rule.** Today a payment needs one approver, or two different approvers above `dualApprovalAbove` (`required` on the payment). A group replaces that threshold rule for payments above its `appliesAbove`. A *sequential* group needs the members in order (member 2 cannot approve until member 1 has). A *parallel* group needs any `required` of its members, in any order. The payment keeps a snapshot of the group version it started with (`payment.signatoryProgress`, planned: `[ { userId, state: "waiting" or "approved" or "rejected", at? } ]`). Editing a group never changes a payment already waiting.

### Shell: Audit trail

| | |
|---|---|
| Purpose | A read-only history of who did what at this company, including refused attempts. |
| Route | Web: `/{project}/business/{companyId}/admin/audit`. Mobile: `Business/Admin/Audit`. |
| Data source | `adminAudit(ctx, filters)` (planned) over `corp.audit.list` (planned; request `{ from?, to?, actorId?, action?, outcome?, page?, pageSize? }`; response `{ rows: record keyed by id, total }`; errors `INVALID_RANGE`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | `biz.audit.view` (Admin and Approver) |

**Columns**: When (`12 Nov 2026 10:42:07 UTC`), Who (name), What (plain sentence: "Alex Morgan started payment pay_1 of USD 12,500.00", "ravi changed Dana Cruz's daily limit from 100,000.00 to 150,000.00"), Result (`statusChip`: Done green tick, Refused red cross with the code). Click a row for before and after values. **Filters**: date range (`datePicker`), person, action type (Payments, Users, Limits, Signatory groups, Sign-in), result. **Default sort**: When, newest first. **Page size** 50. **Export**: hidden in Release 1 (open question 5).
**What is recorded**: every adapter call that changes data, and every refusal with its code (`PERMISSION_DENIED`, `SELF_APPROVAL`, `NOT_AUTHORISED`, …), plus context switches ("Alex Morgan switched to Alpha Trading LLC as Maker").
**States**: loading (skeleton rows); empty "Nothing has been recorded in this period."; error as above.

---

### ★ Invite, edit or disable a user — `manage-user`

#### 1. Summary

| | |
|---|---|
| Slug | `manage-user` |
| Purpose | An administrator invites a new user, edits a user's name, roles, accounts and limit, or disables or re-enables a user. |
| Release | 1 |
| Workspace | Business |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | `corporate-payments.ts` (`authorisation`, `ctx.error`, review, consent, OTP). Not money-moving, but it changes who can move money, so it is a security change. |
| Who may use it | `biz.admin.users` (Admin: `ravi` at Alpha, `noor` at Beta) |
| Journey type | Security journey: carries timeout and unavailable scenarios. |

#### 2. Entry points

| Place | Label | Values passed in | Permission |
|---|---|---|---|
| Admin › users | Invite user | `{mode: "invite"}` | `biz.admin.users` |
| Admin › users › row | Edit | `{mode: "edit", userId}` | `biz.admin.users` |
| Admin › users › row | Disable / Enable | `{mode: "disable" or "enable", userId}` | `biz.admin.users` |
| Admin › users › row (invited) | Resend invite | `{mode: "resend", userId}` | `biz.admin.users` |
| Admin › account permissions | Edit roles | `{mode: "edit", userId}` | `biz.admin.users` |

#### 3. Screens

Stepper: **Details**, **Access**, **Review**, **Confirm**, then the result. In `disable`, `enable` and `resend` modes the journey opens on `review` (no details to type). Blocks: `stepper`, `textInput`, `select`, `toggle`, `amountInput`, `alert`, `reviewSummary`, `consent`, `otp`, `button`, `result`.

**Screen `details` — "User details"** (invite and edit)

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Full name | `textInput` | Yes | 2 to 60 characters; letters, spaces, hyphen, apostrophe | "Enter the person's full name." |
| Work email | `textInput` (pattern `^[^@\s]+@[^@\s]+\.[^@\s]+$`) | Yes (locked in edit mode) | Valid email; not already a user | "Enter a valid work email, like name@company.com." / `USER_EXISTS` below |
| Mobile number | `textInput` (pattern `^\+[0-9 ]{8,16}$`) | Yes | International format; used for one-time codes | "Enter a mobile number with the country code, like +1 415 555 0100." |

Copy: title "User details"; helper under email: "We'll send the invitation here. The link works for 7 days."
Buttons: *Next* → `access`; *Cancel* → exit.

**Screen `access` — "Roles and access"**

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Roles | `select` (`tiles`, multiple): Maker, Approver, Admin | Yes | At least one. "Maker" and "Approver" together allowed (a person still can't approve their own). | "Choose at least one role." |
| Accounts | `select` (`rows`, multiple) of the company's accounts, with "All accounts" | Yes | At least one | "Choose at least one account." |
| Daily limit | `amountInput` in the company currency | Yes if Maker | Above 0; not above the company daily limit | "Enter a daily limit above zero." / "The limit can't be above the company's daily limit of {companyDailyLimit}." |

Hidden when Maker is not chosen: Daily limit. Copy: title "Roles and access"; role helper: "Makers start payments. Approvers approve payments others started. Admins manage users and limits."; alert (info) when Maker and Approver are both chosen: "This person can start and approve payments, but never approve their own." Alert (warning) in edit mode when the edited person has payments waiting: "{name} has {n} payments waiting for approval. They keep waiting; changing roles doesn't change them."
Buttons: *Review* → `review`; *Back* → `details`.

**Screen `review` — "Check and confirm"** `reviewSummary` rows by mode:
- Invite: Name, Email, Mobile, Roles, Accounts, Daily limit, Company.
- Edit: only changed rows, as "Before → After".
- Disable: Name, Roles, "Status: Active → Disabled"; alert (warning) "{name} will be signed out now and can't sign in until you enable them again. Payments they started and that are waiting stay as they are."
- Enable: Name, "Status: Disabled → Active".
- Resend: Name, Email; "A new link replaces the old one."
Buttons: *Continue* → `confirm`; *Edit* → `details` (not in disable, enable, resend).

**Screen `confirm` — "Confirm it's you"**: `consent` (`mustBeTrue`): "I confirm this change is correct and I'm allowed to make it for {company}." Then `otp` (6 digits, 3 attempts, resend after 30 s) after a step-up. The step-up asks for the password or fingerprint first (`bank.session.stepUp`), then the code (`bank.otp.send` then `bank.otp.verify`, integration id `otpVerify`). Button: *{Invite user | Save changes | Disable user | Enable user | Resend invite}* → calls the matching adapter.
States: submit shows a spinner; 10 s → timeout.

**Screen `done` — result**: Invite: "Invitation sent" / "We emailed {email}. They can sign in after they accept." Edit: "Changes saved". Disable: "{name} is disabled". Enable: "{name} can sign in again". Resend: "Invitation sent again". Reference: audit id ("Audit {auditId}"). Buttons: *Go to users* → Admin › Users; *Invite another* (invite mode) → `details`; *Done* → exit.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `USER_EXISTS` (planned) | "{email} already has access at {company}. Edit that person instead." | `details` | *Edit that person* → `manage-user` `{mode: "edit", userId}` |
| `EMAIL_INVALID` (planned) | "Enter a valid work email, like name@company.com." | `details` | *Edit* |
| `USER_NOT_FOUND` (existing code) | "We can't find that user. They may have been removed." | `review` | *Go to users* |
| `ROLE_NOT_FOUND` (planned) | "That role isn't available. Choose Maker, Approver or Admin." | `access` | *Edit* |
| `ACCOUNT_NOT_FOUND` (existing) | "We can't find that account. Choose another." | `access` | *Choose account* |
| `LIMIT_ABOVE_COMPANY` (planned) | "The limit can't be above the company's daily limit of {companyDailyLimit}." | `access` | *Change limit* |
| `INVALID_AMOUNT` (existing) | "Enter a daily limit in {currency} with at most {digits} decimal places." | `access` | *Change limit* |
| `CANNOT_DISABLE_SELF` (planned) | "You can't disable yourself. Ask another administrator." | `review` | *Back* |
| `LAST_ADMIN` (planned) | "{company} must keep at least one active administrator. Add another administrator first." | `review` | *Back* |
| `USER_HAS_PENDING_PAYMENTS` (planned; only for removing the Maker role) | "{name} has {n} payments waiting for approval. Remove the Maker role after they are approved, rejected or withdrawn." | `review` | *View payments* → Payments tracker |
| `OTP_INVALID` | S-`OTP_INVALID` | `confirm` | *Try again* / *Start again* |
| `OTP_REQUIRED` | S-`OTP_REQUIRED` | `confirm` | *Back to code* |
| `STEP_UP_REQUIRED` (planned) | S-`STEP_UP_REQUIRED` | `confirm` | *Confirm* |
| `PERMISSION_DENIED` (planned) | S-`PERMISSION_DENIED` | `denied` | *Back* |
| `WRONG_CONTEXT` (planned) | S-`WRONG_CONTEXT` ({workspace} = Business) | `denied` | *Switch* |
| `SESSION_EXPIRED` (planned) | S-`SESSION_EXPIRED` | `denied` | *Sign in* |
| `CORE_UNAVAILABLE` (existing) | "We couldn't save this right now. Nothing was changed." (reworded from S-`CORE_UNAVAILABLE`: no money is involved) | `confirm` | *Try again* |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `confirm` | *Try again* |
| `SERVICE_UNAVAILABLE` (planned) | S-`SERVICE_UNAVAILABLE` | `confirm` | *Try again* / *Back* |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | none (acting user from the context; `userId` is accepted today) | company, accounts, users, `me`, limits | `NOT_SUPPORTED`, `PERMISSION_DENIED` | Existing |
| `user` | `corp.users.get` | `{ userId }` | the full user record | `USER_NOT_FOUND`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned |
| `otpSend` | `bank.otp.send` | `{ channel? }` | `{ sent, maskedPhone, channel }` | none | Existing |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified }` | `OTP_INVALID` (with `attempt`) | Existing |
| `stepUp` | `bank.session.stepUp` | `{ method: "password" or "biometric", secret? }` | `{ stepUpUntil }` | `STEP_UP_REQUIRED`, `SESSION_EXPIRED` | Planned |
| `invite` | `corp.users.invite` | `{ name, email, phone, roles, accountIds, dailyLimit? }` | the new user, `status: "invited"`, plus `auditId` | `USER_EXISTS`, `EMAIL_INVALID`, `ROLE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `LIMIT_ABOVE_COMPANY`, `INVALID_AMOUNT`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned; `moneyMoving: false`, `requiresOtp: true` |
| `update` | `corp.users.update` | `{ userId, name?, phone?, roles?, accountIds?, dailyLimit? }` | the user and `auditId` | `USER_NOT_FOUND`, `ROLE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `LIMIT_ABOVE_COMPANY`, `INVALID_AMOUNT`, `USER_HAS_PENDING_PAYMENTS`, `LAST_ADMIN`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned; `requiresOtp: true` |
| `setStatus` | `corp.users.disable` / `corp.users.enable` | `{ userId }` | the user and `auditId` | `USER_NOT_FOUND`, `CANNOT_DISABLE_SELF`, `LAST_ADMIN`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned; `requiresOtp: true` |
| `resend` | `corp.users.invite` with `{ userId }` | `{ userId }` | the user | `USER_NOT_FOUND`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned (a user in status `active` answers `USER_EXISTS`) |

Disabling signs the user out at once: any later call by that user answers `SESSION_EXPIRED`.

#### 6. Permissions, step-up and limits

- Permission `biz.admin.users`. Check 3: forcing `corp.users.invite` as Alex at Alpha (Maker) answers `PERMISSION_DENIED`.
- Step-up: `stepup` (password or biometrics, then a one-time code). The sandbox answers `STEP_UP_REQUIRED` if the last step-up is older than 5 minutes.
- Limits: a user's daily limit may not exceed the company daily limit; the company daily limit is changed by `change-limits`, not here.
- Separation: an admin who is also a Maker or Approver keeps the four-eyes rule on payments.
- A denied screen (`denied`): "You can't do this", the S-`PERMISSION_DENIED` message, button *Back*.

#### 7. Result and links out

Result screens above. Receipt: an on-screen summary with the audit id (print/share: planned receipts engine feature). Notifications raised: to the invited person, an email "You're invited to {company} on BankWorkx®" (not shown in-app); to every admin, an in-app notification "Admin change at {company}: {name} {invited | updated | disabled | enabled}" tagged with the company (visible in Business only). Links out: *Go to users*, *Invite another*, *Done*.

#### 8. Acceptance criteria

- **AC-1** An admin can invite a user with a name, email, mobile, at least one role and at least one account; the user appears in Users as Invited.
- **AC-2** A Maker must be given a daily limit above zero and not above the company daily limit.
- **AC-3** Inviting an email that already has access is refused with `USER_EXISTS` and creates nothing.
- **AC-4** An admin can change a user's roles, accounts and limit, and the audit trail shows before and after.
- **AC-5** Disabling needs consent, step-up and a correct one-time code; a wrong code three times ends the attempt and changes nothing.
- **AC-6** An admin cannot disable themselves, and cannot disable or remove the last active administrator.
- **AC-7** A disabled user cannot sign in or act; a call they make answers `SESSION_EXPIRED`.
- **AC-8** Payments a disabled user started stay pending and can still be approved by someone else.
- **AC-9** A person without `biz.admin.users` cannot invite, edit or disable, even if the call is forced.
- **AC-10** Every change, and every refused attempt, appears in the audit trail.
- **AC-11** On timeout or unavailability nothing changes and the person can retry.
- **AC-12** Changes at Alpha never show at Beta.

#### 9. Scenarios

| # | Persona and setup | Conditions | Covers | Expected |
|---|---|---|---|---|
| T-1 | `ravi` (Alpha admin) invites "Tess Hart", Maker, all accounts, limit 20,000.00 | none | AC-1, AC-2, AC-10 | Users lists Tess as Invited; audit has "ravi invited Tess Hart". |
| T-2 | `ravi` invites a Maker with limit 0, then 1,200,000 (company limit 1,000,000) | none | AC-2 | Both stopped on `access` with their messages; no user added. |
| T-3 | `ravi` invites `dana`'s email | none | AC-3 | `USER_EXISTS`; user count unchanged. |
| T-4 | `ravi` edits `dana`: adds Maker, limit 15,000.00 | none | AC-4, AC-10 | `dana` has both roles and the limit; audit shows before and after. |
| T-5 | `ravi` disables `lee`; code `482100` | none | AC-5, AC-7, AC-10 | `lee` is Disabled; a call as `lee` answers `SESSION_EXPIRED`. |
| T-6 | `ravi` disables `lee`; code wrong 3 times | none | AC-5 | "Too many wrong codes. Start again."; `lee` still Active. |
| T-7 | `ravi` tries to disable `ravi`; then disables the only admin | none | AC-6 | `CANNOT_DISABLE_SELF`; `LAST_ADMIN`; both unchanged. |
| T-8 | `priya` (Beta Maker) has a pending payment; `noor` disables `priya` | none | AC-8 | `priya` Disabled; payment still pending; Alex can approve it. |
| T-9 | Alex (Maker at Alpha) forces `corp.users.invite` | none | AC-9, AC-10 | `PERMISSION_DENIED`; audit has a Refused row. |
| T-10 | `ravi` disables `lee` | `timeout: ["corp.users.disable"]` | AC-11 | Timeout message; `lee` still Active; retry after clearing works. |
| T-11 | `ravi` invites a user | `unavailable: ["corp.users.invite"]` | AC-11 | `SERVICE_UNAVAILABLE`; no user added. |
| T-12 | `ravi` invites "Tess Hart" at Alpha | none | AC-12 | Beta's Users does not list Tess; `noor` forcing `corp.users.get {userId: "tess"}` at Beta answers `USER_NOT_FOUND`. |

#### 10. Expected mutation-check survivors

- Journey-side email pattern and limit-above-company `validate`: survive because the sandbox rules (`EMAIL_INVALID`, `LIMIT_ABOVE_COMPANY`) also stop the same input (layer 3); T-2 proves the sandbox rule.
- The `resend` mode: survives unless a scenario resends; add T-13 if wanted (listed as an open question). All others: none expected.

---

### ★ Change limits — `change-limits`

#### 1. Summary

| | |
|---|---|
| Slug | `change-limits` |
| Purpose | An administrator changes a person's daily limit, the company's daily limit, or the approval threshold (the amount above which two approvers are needed). |
| Release | 1 |
| Workspace | Business |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | `corporate-payments.ts` (it already shows the person's remaining limit and the review) |
| Who may use it | `biz.admin.limits` (Admin) |
| Journey type | Security journey (limits govern money): timeout and unavailable scenarios included. |

#### 2. Entry points

| Place | Label | Values passed in | Permission |
|---|---|---|---|
| Admin › limits › company card | Change | none (target = company) | `biz.admin.limits` |
| Admin › limits › people row | Change | `{userId}` | `biz.admin.limits` |
| Admin › users › row | Change limit | `{userId}` | `biz.admin.limits` |

#### 3. Screens

Stepper: **What**, **New value**, **Review**, **Confirm**, then the result.

**Screen `target` — "What do you want to change?"**: `select` (`rows`): "A person's daily limit", "The company's daily limit", "The approval threshold". If `{userId}` is passed, the first is preselected and the journey opens on `value`. A person is chosen with a second `select` of the company's Makers (label "Person"; error "Choose a person."). Buttons: *Next* → `value`; *Cancel* → exit.

**Screen `value` — "New limit"**

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| New value | `amountInput` in the company currency, `quickAmounts` none | Yes | Above 0; at most the currency's decimals; person limit not above the company limit; company limit not above the bank ceiling; not below what is already used today; approval threshold not above the company limit | "Enter an amount above zero." / "Enter an amount in {currency} with at most {digits} decimal places." / "A person's limit can't be above the company's daily limit of {companyDailyLimit}." / "The company's limit can't be above the bank ceiling of {ceiling}." / "{name} has already used {usedToday} today. Choose a higher limit, or change it tomorrow." |
| Reason | `textInput` (`lines: 2`) | Yes | 5 to 200 characters | "Add a short reason. It is kept in the audit trail." |

Copy: title "New limit"; a line shows the current value ("Now: {current}"), the used amount ("Used today: {usedToday}") and, for people, "Company limit: {companyDailyLimit}". Alert (info) for the approval threshold: "Payments above this amount need two different approvers. A lower number means more payments need two."
Alert (warning), shown when the change raises a limit by more than 50%: "You are raising this limit by {pct}%. Make sure this is what you intend."
Buttons: *Review* → `review`; *Back* → `target`.

**Screen `review`**: `reviewSummary`: What ("Dana Cruz's daily limit"), Now, New, Change ("+50,000.00" or "−20,000.00"), Reason, Company. Alert (info): "The new limit applies to new payments from now on. Payments already waiting for approval are not affected." Buttons: *Continue* → `confirm`; *Edit* → `value`.

**Screen `confirm`**: `consent`: "I confirm this change is approved by {company} and I'm allowed to make it." Then step-up and `otp` as in `manage-user`. Button: *Save new limit* → calls `corp.limits.set`.

**Screen `done`**: `result`: "Limit changed"; body "{What} is now {New}."; reference "Audit {auditId}". Buttons: *Go to limits* → Admin › Limits; *Change another* → `target`; *Done*.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `USER_NOT_FOUND` (existing) | "We can't find that user. They may have been removed." | `target` | *Choose person* |
| `INVALID_AMOUNT` (existing) | "Enter an amount in {currency} with at most {digits} decimal places." | `value` | *Change amount* |
| `LIMIT_ABOVE_COMPANY` (planned) | "A person's limit can't be above the company's daily limit of {companyDailyLimit}." | `value` | *Change amount* |
| `LIMIT_ABOVE_CEILING` (planned) | "The company's limit can't be above the bank ceiling of {ceiling}." | `value` | *Change amount* |
| `LIMIT_BELOW_USED_TODAY` (planned) | "{name} has already used {usedToday} today. Choose a higher limit, or change it tomorrow." | `value` | *Change amount* |
| `THRESHOLD_ABOVE_LIMIT` (planned) | "The approval threshold can't be above the company's daily limit of {companyDailyLimit}." | `value` | *Change amount* |
| `OTP_INVALID` / `OTP_REQUIRED` / `STEP_UP_REQUIRED` / `PERMISSION_DENIED` / `WRONG_CONTEXT` / `SESSION_EXPIRED` | Standard messages S-`…` (README 1.6) | as in `manage-user` | as there |
| `CORE_UNAVAILABLE` (existing) | "We couldn't save this right now. Nothing was changed." | `confirm` | *Try again* |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `confirm` | *Try again* |
| `SERVICE_UNAVAILABLE` (planned) | S-`SERVICE_UNAVAILABLE` | `confirm` | *Try again* / *Back* |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | none | includes `me`, `companyDailyLimit`, `companyUsedToday`, `dualApprovalAbove`, `cutoff` | `NOT_SUPPORTED` | Existing |
| `limits` | `corp.limits.get` | none | see Limits shell | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned |
| `otpSend`, `otpVerify`, `stepUp` | as in `manage-user` | | | | Existing / planned |
| `setLimit` | `corp.limits.set` | `{ target: "user" or "company" or "threshold", userId?, value, reason }` | `{ target, before, after, auditId }` | `USER_NOT_FOUND`, `INVALID_AMOUNT`, `LIMIT_ABOVE_COMPANY`, `LIMIT_ABOVE_CEILING`, `LIMIT_BELOW_USED_TODAY`, `THRESHOLD_ABOVE_LIMIT`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned; `moneyMoving: false`, `requiresOtp: true` |

Sandbox seed ceiling: Alpha 1,000,000.00 USD company limit with ceiling 2,000,000.00; Beta 1,000,000.00 with ceiling 2,000,000.00 (planned seed).

#### 6. Permissions, step-up and limits

`biz.admin.limits`; `stepup` plus one-time code. Check 3: Alex at Alpha forcing `corp.limits.set` answers `PERMISSION_DENIED`. Effect on existing rules: `LIMIT_USER_EXCEEDED` is read from the new person limit on the next payment; `LIMIT_COMPANY_EXCEEDED` from the new company limit (also at release; the planned fix makes `release` honour `flaws.companyLimit`); `dualApprovalAbove` from the new threshold for payments started after the change.

#### 7. Result and links out

Result "Limit changed" with the audit id. Notifications: the affected person gets "Your daily limit at {company} is now {New}" (tagged with the company); other admins get "Admin change at {company}". Links out: *Go to limits*, *Change another*, *Done*.

#### 8. Acceptance criteria

- **AC-1** An admin can change a person's daily limit, and that person's next payment is checked against the new limit.
- **AC-2** An admin can change the company's daily limit, and a payment that would exceed the new company limit is refused with `LIMIT_COMPANY_EXCEEDED`.
- **AC-3** An admin can change the approval threshold, and a payment above it needs two different approvers.
- **AC-4** A person's limit above the company limit, a company limit above the bank ceiling, and a threshold above the company limit are each refused with their message.
- **AC-5** A limit below what is already used today is refused.
- **AC-6** A reason is required and appears in the audit trail with before and after values.
- **AC-7** Saving needs consent, step-up and a correct one-time code.
- **AC-8** A person without `biz.admin.limits` cannot change a limit, even when the call is forced.
- **AC-9** Payments already waiting for approval are not changed by a limit change.
- **AC-10** On timeout or unavailability nothing changes.

#### 9. Scenarios

| # | Persona and setup | Conditions | Covers | Expected |
|---|---|---|---|---|
| T-1 | `ravi` sets the daily limit of an Alpha Maker (`tess_m`, planned seed) to 20,000.00; then `tess_m` starts a payment of 25,000.00 | none | AC-1, AC-6, AC-7 | `LIMIT_USER_EXCEEDED` on the payment; audit shows 20,000.00 and the reason. |
| T-2 | `ravi` sets the company limit to 30,000.00; Alex starts a payment of 25,000.00 and `dana` approves; a second of 10,000.00 is approved | none | AC-2 | The second approval answers `LIMIT_COMPANY_EXCEEDED` and stays pending. |
| T-3 | `ravi` sets the threshold to 10,000.00; Alex starts 12,500.00 | none | AC-3 | The payment has `required: 2`. |
| T-4 | `ravi` tries person 1,200,000; company 2,500,000; threshold 1,500,000 (company limit 1,000,000, ceiling 2,000,000) | none | AC-4 | Each refused with its code and message; limits unchanged. |
| T-5 | A Maker has used 8,000.00 today; `ravi` sets 5,000.00 | none | AC-5 | `LIMIT_BELOW_USED_TODAY`. |
| T-6 | `ravi` leaves the reason empty | none | AC-6 | Stopped on `value`: "Add a short reason. It is kept in the audit trail." |
| T-7 | `ravi` enters a wrong code 3 times | none | AC-7 | "Too many wrong codes. Start again."; limit unchanged. |
| T-8 | Alex (Alpha Maker) forces `corp.limits.set` | none | AC-8 | `PERMISSION_DENIED`; audit has a Refused row. |
| T-9 | Alex has a 12,500.00 payment waiting; `ravi` lowers the threshold to 10,000.00 | none | AC-9 | The waiting payment still has `required: 1`. |
| T-10 | `ravi` changes a limit | `timeout: ["corp.limits.set"]` | AC-10 | Timeout message; limit unchanged. |
| T-11 | `ravi` changes a limit | `unavailable: ["corp.limits.set"]` | AC-10 | `SERVICE_UNAVAILABLE`; limit unchanged. |

#### 10. Expected mutation-check survivors

Journey-side ceiling and "above company" checks survive because the sandbox repeats them (layer 3); T-4 proves the sandbox side. The "raising by more than 50%" warning: survives (a warning only; no behaviour); a scenario can check its text, otherwise it is listed. Others: none expected.

---

### ★ Edit a signatory group — `edit-signatory-group`

#### 1. Summary

| | |
|---|---|
| Slug | `edit-signatory-group` |
| Purpose | An administrator changes who must sign (approve) payments, whether they sign in order (sequential) or in any order (parallel), how many are needed, and above what amount the group applies. |
| Release | 1 |
| Workspace | Business |
| Status | New (planned). Builds on today's `required` and `dualApprovalAbove` fields. |
| Channels | Web, mobile |
| Starting pattern | `corporate-approval.ts` (it shows how many approvers are needed and who has approved) |
| Who may use it | `biz.admin.signatories` (Admin) |
| Journey type | Security journey: timeout and unavailable scenarios included. |

#### 2. Entry points

| Place | Label | Values passed in | Permission |
|---|---|---|---|
| Admin › signatory groups › card | Edit | `{groupId}` | `biz.admin.signatories` |
| Admin › signatory groups | New group | none | `biz.admin.signatories` |

#### 3. Screens

Stepper: **Group**, **Members**, **Review**, **Confirm**, then the result.

**Screen `group` — "Group rules"**

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Group name | `textInput` | Yes | 3 to 40 characters | "Enter a name for the group, like 'Large payments'." |
| How they sign | `select` (`tiles`): "One after another (sequential)", "Any of them, in any order (parallel)" | Yes | One of two | "Choose how the group signs." |
| Applies to payments above | `amountInput` in the company currency | Yes | 0 or more; two groups may not apply from the same amount | "Enter an amount, or 0 for all payments." / `GROUP_OVERLAP` below |
| Accounts | `select` (`rows`, multiple) with "All accounts" | Yes | At least one | "Choose at least one account." |

Copy: title "Group rules"; helper under How they sign: "One after another: member 1 signs first, then member 2, and so on. Any of them: it's enough that {required} of the members sign, in any order." Buttons: *Next* → `members`; *Cancel* → exit.

**Screen `members` — "Who signs"**

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Members | `select` (`rows`, multiple) of users with the Approver role, ordered by choice in sequential mode (a number badge shows the order) | Yes | At least 2 for a sequential group, at least 2 for a parallel group; each an active Approver; no duplicates | "Choose at least two approvers." / `MEMBER_NOT_APPROVER` / `DUPLICATE_MEMBER` |
| People needed | `select` (`chips`: 1, 2, 3 …, up to the member count); sequential: fixed to all members and shown disabled as "All {n}, in order" | Yes (parallel) | 1 to the member count; 2 or more when the group applies above 0 | "Choose how many people must sign." / "A group for large payments needs at least two signatures." |

Copy: title "Who signs"; helper: "The person who starts a payment can't sign it, even if they are in this group." Alert (info), edit mode: "{n} payments are waiting under the old rule. They keep it. Only new payments use the new rule."
Buttons: *Review* → `review`; *Back* → `group`.

**Screen `review`**: `reviewSummary`: Name, How they sign ("Sequential: Dana, then Lee" or "Parallel: any 2 of Dana, Lee, Omar"), Applies above, Accounts, Before → After (edit mode), Company. Buttons: *Continue* → `confirm`; *Edit* → `group`.

**Screen `confirm`**: `consent`: "I confirm this change is approved by {company} and I'm allowed to make it." Then step-up and `otp`. Button: *Save group* → `corp.signatories.update`.

**Screen `done`**: `result`: "Group saved"; body "{Name}: {How they sign}. It applies to new payments above {amount}."; reference "Audit {auditId}". Buttons: *Go to signatory groups* → shell; *Done*.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `GROUP_NOT_FOUND` (planned) | "We can't find that group. It may have been removed." | `group` | *Go to groups* |
| `GROUP_TOO_SMALL` (planned) | "Choose at least two approvers." | `members` | *Edit* |
| `REQUIRED_TOO_LOW` (planned) | "A group for large payments needs at least two signatures." | `members` | *Edit* |
| `REQUIRED_ABOVE_MEMBERS` (planned) | "You can't ask for more signatures than there are members." | `members` | *Edit* |
| `MEMBER_NOT_APPROVER` (planned) | "{name} doesn't have the Approver role. Edit the user's roles first." | `members` | *Edit* |
| `DUPLICATE_MEMBER` (planned) | "{name} is in the list twice." | `members` | *Edit* |
| `MEMBER_DISABLED` (planned) | "{name} is disabled. Choose someone else." | `members` | *Edit* |
| `GROUP_OVERLAP` (planned) | "Another group already applies from {amount}. Choose a different amount." | `group` | *Edit* |
| `ACCOUNT_NOT_FOUND` (existing) | "We can't find that account. Choose another." | `group` | *Choose account* |
| `USER_NOT_FOUND` (existing) | "We can't find that user. They may have been removed." | `members` | *Edit* |
| `INVALID_AMOUNT` (existing) | "Enter an amount in {currency} with at most {digits} decimal places." | `group` | *Change amount* |
| `OTP_INVALID` / `OTP_REQUIRED` / `STEP_UP_REQUIRED` / `PERMISSION_DENIED` / `WRONG_CONTEXT` / `SESSION_EXPIRED` | Standard messages | as in `manage-user` | as there |
| `CORE_UNAVAILABLE` (existing), `TIMEOUT`, `SERVICE_UNAVAILABLE` | as in `change-limits` | `confirm` | *Try again* |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | none | accounts, users with roles | `NOT_SUPPORTED` | Existing |
| `group` | `corp.signatories.get` | `{ groupId }` | the group | `GROUP_NOT_FOUND`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned |
| `otpSend`, `otpVerify`, `stepUp` | as in `manage-user` | | | | Existing / planned |
| `save` | `corp.signatories.update` | `{ groupId?, name, mode, memberIds (ordered), required, appliesAbove, accountIds }` (no `groupId` creates) | the group with `version`, plus `auditId` | `GROUP_NOT_FOUND`, `GROUP_TOO_SMALL`, `REQUIRED_TOO_LOW`, `REQUIRED_ABOVE_MEMBERS`, `MEMBER_NOT_APPROVER`, `DUPLICATE_MEMBER`, `MEMBER_DISABLED`, `GROUP_OVERLAP`, `ACCOUNT_NOT_FOUND`, `USER_NOT_FOUND`, `INVALID_AMOUNT`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned; `moneyMoving: false`, `requiresOtp: true` |

Engine rules this journey relies on (planned, in the corporate sandbox): `approvePayment` in a sequential group answers `NOT_YOUR_TURN` (planned; "It's not your turn yet. {name} must sign first.") when an earlier member has not signed; in a parallel group any member signs. The payment is released when `required` signatures are in (the existing release check applies). `SELF_APPROVAL` and `ALREADY_APPROVED` still apply.

#### 6. Permissions, step-up and limits

`biz.admin.signatories`; `stepup` plus one-time code. Check 3: Alex at Alpha forcing `corp.signatories.update` answers `PERMISSION_DENIED`. A group applying above 0 must ask for at least 2 signatures (the four-eyes principle for larger payments). Payments started before the edit keep the group version they started with.

#### 7. Result and links out

"Group saved" with audit id. Notifications: members newly added get "You are now a signatory in {Name} at {company}" (company-tagged); removed members get "You were removed from {Name} at {company}". Links out: *Go to signatory groups*, *Done*.

#### 8. Acceptance criteria

- **AC-1** An admin can change a group from parallel to sequential, with the members in order.
- **AC-2** In a sequential group, the second member cannot approve before the first (`NOT_YOUR_TURN`); in a parallel group any member can approve first.
- **AC-3** A parallel group needing 2 of 3 releases the payment on the second signature, from any two members.
- **AC-4** Only active Approvers can be members; others are refused with their message.
- **AC-5** A group that applies above an amount must need at least two signatures, and cannot need more than it has members.
- **AC-6** Two groups cannot apply from the same amount.
- **AC-7** A payment already waiting keeps the rule it started with.
- **AC-8** Saving needs consent, step-up and a correct one-time code, and writes an audit entry.
- **AC-9** A person without `biz.admin.signatories` cannot save, even when the call is forced.
- **AC-10** On timeout or unavailability nothing changes.
- **AC-11** The person who started a payment can never sign it, even if they are a member.

#### 9. Scenarios

| # | Persona and setup | Conditions | Covers | Expected |
|---|---|---|---|---|
| T-1 | `ravi` edits "Large payments" to sequential: `dana` then `lee`; Alex starts 60,000.00; `lee` tries first | none | AC-1, AC-2 | `lee` gets `NOT_YOUR_TURN`; after `dana` signs, `lee` signs and it releases. |
| T-2 | `ravi` sets "Large payments" parallel, 2 of 3 (`dana`, `lee`, `ravi_a`, planned approver); Alex starts 60,000.00; `lee` signs, then `dana` signs | none | AC-3 | Pending after one; released after two. |
| T-3 | `ravi` adds Alex (a Maker, not an Approver) as a member; then a disabled user | none | AC-4 | `MEMBER_NOT_APPROVER`; `MEMBER_DISABLED`; group unchanged. |
| T-4 | `ravi` sets required 1 with appliesAbove 50,000; then required 4 with 3 members | none | AC-5 | `REQUIRED_TOO_LOW`; `REQUIRED_ABOVE_MEMBERS`. |
| T-5 | `ravi` creates a second group above 50,000 | none | AC-6 | `GROUP_OVERLAP`. |
| T-6 | A payment of 60,000.00 waits (parallel 2 of 3); `ravi` changes the group to sequential | none | AC-7 | The waiting payment's progress still shows parallel rules. |
| T-7 | `ravi` saves with a wrong code 3 times; then correctly | none | AC-8 | First: unchanged. Second: saved; audit has the entry. |
| T-8 | Alex at Alpha forces `corp.signatories.update` | none | AC-9 | `PERMISSION_DENIED`. |
| T-9 | `ravi` saves a group | `timeout: ["corp.signatories.update"]` | AC-10 | Timeout message; group unchanged. |
| T-10 | `ravi` saves a group | `unavailable: ["corp.signatories.update"]` | AC-10 | `SERVICE_UNAVAILABLE`; group unchanged. |
| T-11 | `dana` is a member of a group and starts a payment (she is also a Maker, planned) | none | AC-11 | `dana` approving her own: `SELF_APPROVAL`. |

#### 10. Expected mutation-check survivors

Journey-side member-role and duplicate checks survive (the sandbox repeats them; T-3 proves the sandbox). Others: none expected.

---

## Business: More

Shell screens for the **More** tab, and the journeys `business-service-request` and (stretch) `kyb-onboarding`.

### Shell: Business profile

| | |
|---|---|
| Purpose | Show the company's details as the bank holds them, read-only. |
| Route | Web: `/{project}/business/{companyId}/more/profile`. Mobile: `Business/More/Profile`. |
| Data source | `businessProfile(ctx)` (planned) over `corp.profile.get` (planned; request none; response `{ id, name, legalName, registrationNo, taxId, address, country, currency, industry, signatories: string[], relationshipManager: { name, phone, email }, since }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | any business permission (everyone in the company) |

**Widgets**: Company card (name, legal name, registration number masked to the last 4, address); Banking card (currency, accounts count, approval rule, cut-off, from `corp.company.get`); Contacts card (relationship manager with *Call* and *Email* buttons; on web, a mailto link); *Request a change* → `business-service-request` `{type: "change_details"}` (needs `biz.requests.create`). Stretch: *Business onboarding* → `kyb-onboarding` (needs `biz.admin.users`).
**States**: loading skeleton cards; error and timeout as in Accounts. No empty state (a company always has a profile).

### Shell: Service requests

| | |
|---|---|
| Purpose | See requests the company made to the bank and their progress; start a new one. |
| Route | Web: `/{project}/business/{companyId}/more/requests`. Mobile: `Business/More/Requests`. |
| Data source | `businessRequests(ctx)` (planned) over `corp.requests.list` (planned; request `{ status? }`; response record keyed by id `{ id, type, subject, status ("received" or "in_progress" or "done" or "declined"), createdAt, createdBy, updatedAt, reply? }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | `biz.requests.create` to start; any business user to read their company's requests |

**Columns**: Reference, Type, Subject, Status (`statusChip`: Received blue, In progress amber, Done green, Declined grey), Created by, Updated. **Filter**: status chips, type select. **Sort**: Updated, newest first. **Page size** 25. **Buttons**: *New request* → `business-service-request`. Row → detail with a `timeline` (planned) of status changes and the bank's reply.
**States**: loading; empty "No requests yet." with *New request* (only with permission); error as above.

### Shell: Messages

| | |
|---|---|
| Purpose | Secure messages between the company and the bank. |
| Route | Web: `/{project}/business/{companyId}/more/messages`. Mobile: `Business/More/Messages`. |
| Data source | `businessMessages(ctx)` (planned) over `corp.messages.list` (planned; request `{ folder: "inbox" or "sent" }`; response record keyed by id `{ id, subject, from, at, read, preview }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only) and `corp.messages.get` (planned; request `{ messageId }`). |
| Permission | any business user (read); replying is outside Release 1 |

**Layout**: split view on web (list left, message right); list then detail on phones. **List columns**: unread dot, From, Subject, Date. **Sort**: newest first. **Filter**: folder (Inbox, Sent), unread only. **States**: loading; empty "No messages." (inbox) / "You haven't sent any messages." (sent); error as above. Messages are tagged with the company and never shown in Personal.

### Shell: Notifications

| | |
|---|---|
| Purpose | A list of things that need the person's attention, from every context they hold, each tagged with its company or "Personal". |
| Route | Web: bell in the top bar and `/{project}/business/{companyId}/more/notifications`. Mobile: `Business/More/Notifications`. |
| Data source | `notifications(session)` (planned) over `bank.notifications.list` (planned; request `{ contextId?, unreadOnly? }`; response record keyed by id `{ id, contextId, contextLabel, kind, title, body, at, read, link: { journey?, place?, params } }`; errors `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only) and `bank.notifications.read` (planned; request `{ id }`; marks read). |
| Permission | none beyond a session; a link inside is checked when followed |

**Rows**: a context badge (company name or "Personal"), title, one-line body, time ("2 h ago"), unread dot. **Filters**: this company (default), all my contexts, unread only. **Sort**: newest first. **Page size** 25.
**Rules**
- The list shows this company's notifications by default. "All my contexts" shows other contexts' notifications with only their title, never amounts, payees or account numbers (see the combined demo, step 12).
- Tapping a notification of another context never switches silently: a sheet says "This belongs to {company}. Switch to {company} to open it." with *Switch* and *Not now*. *Switch* runs the context switch (step-up if policy requires), then opens the link.
- Tapping one of this company opens its link: for "Payment awaiting your approval" → `approve-payments` `{paymentId}` (needs `biz.approvals.approve`).
**States**: loading; empty "You're all caught up."; error as above.

### Shell: Settings

| | |
|---|---|
| Purpose | Per-person preferences for this workspace, and the way back to Personal. |
| Route | Web: `/{project}/business/{companyId}/more/settings`. Mobile: `Business/More/Settings`. |
| Data source | `businessSettings(ctx)` (planned) over `bank.settings.get` and `bank.settings.set` (planned; request `{ key, value }`; keys `language`, `theme` ("light" or "dark" or "system"), `notifyEmail`, `notifyPush`, `approvalReminders`; response the settings; errors `INVALID_SETTING`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; `moneyMoving: false`, `requiresOtp: false`). |
| Permission | none beyond a session |

**Sections**: Language (English; Release 1 only English); Appearance (Light, Dark, Follow my device); Notifications (`toggle`s: Email, Push, "Remind me about payments waiting for my approval at 15:00 (before the {cutoff} cut-off)"); Security (*Change password* and others link to Personal's security journeys: a link into another context, see below); Session (*Sign out*). Language and light or dark mode are kept on a context switch (README 5.4).
**Note**: security journeys (`change-password`, `trusted-devices`, `change-quick-pin`) belong to Personal; here the buttons are *Open in Personal*, which offers to switch first.
**States**: loading; save error "We couldn't save that. Nothing was changed." with *Try again*; settings save at once on toggle and show a short toast "Saved".

---

### ★ Business service request — `business-service-request`

#### 1. Summary

| | |
|---|---|
| Slug | `business-service-request` |
| Purpose | A company user asks the bank for something that is not a payment: a new chequebook, a statement copy by post, a change of company details, a limit review, or a complaint. |
| Release | 1 |
| Workspace | Business |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | `cab.ts` (`contact-support`) for the form and reference number |
| Who may use it | `biz.requests.create` (Maker, Admin) |
| Journey type | Not money-moving. It changes no balance or limit; a change request is only a request. It still includes timeout and unavailable scenarios because it creates a record. |

#### 2. Entry points

| Place | Label | Values passed in | Permission |
|---|---|---|---|
| More › requests | New request | `{type?}` | `biz.requests.create` |
| More › profile | Request a change | `{type: "change_details"}` | `biz.requests.create` |
| Accounts › detail | Request a chequebook (row menu, planned) | `{type: "chequebook", accountId}` | `biz.requests.create` |
| Admin › limits | Ask the bank for a higher ceiling (planned) | `{type: "limit_review"}` | `biz.requests.create` |

#### 3. Screens

Stepper: **Type**, **Details**, **Review**, then the result.

**Screen `type` — "What do you need?"**: `select` (`rows`): "New chequebook", "Statement copy by post", "Change company details", "Review our limits", "Make a complaint", "Something else". Required. Error: "Choose what you need." Buttons: *Next* → `details`; *Cancel* → exit. If `{type}` is passed the journey opens on `details`.

**Screen `details` — "Tell us more"**

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Account | `accountPicker` | Yes for chequebook and statement copy | A permitted account | "Choose an account." |
| Subject | `textInput` | Yes | 5 to 80 characters | "Add a short subject (at least 5 characters)." |
| Details | `textInput` (`lines: 5`) | Yes | 10 to 1,000 characters | "Tell us a little more (at least 10 characters)." |
| Number of cheque leaves | `select` (`chips`: 25, 50, 100) | Yes for chequebook | One of the three | "Choose how many leaves." |
| Contact phone | `textInput` (pattern `^\+[0-9 ]{8,16}$`) | Yes | International format | "Enter a phone number with the country code." |

Copy: title "Tell us more"; helper for complaints: "Tell us what happened and when. A manager will reply within 3 working days." Alert (info) for "Change company details": "Changes to legal details may need documents. We'll contact you if we do."
Buttons: *Review* → `review`; *Back* → `type`.

**Screen `review`**: `reviewSummary`: Type, Account (if any), Subject, Details, Phone, Company. `consent` (`mustBeTrue`): "I confirm these details are correct and I'm allowed to ask for this for {company}." Buttons: *Send request* → `corp.requests.create`; *Edit* → `details`. No one-time code (open question 7).

**Screen `done`**: `result`: "Request sent"; body "We'll update you under More › Requests."; reference "Request {requestId}". Buttons: *Go to requests* → shell; *Send another* → `type`; *Done*.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` (existing) | "We can't find that account. Choose another." | `details` | *Choose account* |
| `REQUEST_TYPE_INVALID` (planned) | "That kind of request isn't available. Choose another." | `type` | *Edit* |
| `REQUEST_DUPLICATE` (planned) | "You already have an open request about this ({requestId}). Wait for our reply or add to that request." | `review` | *Go to requests* |
| `VALIDATION_FAILED` (planned) | "Check the highlighted fields and try again." | `details` | *Edit* |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard messages | `denied` | as there |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `review` | *Try again* |
| `SERVICE_UNAVAILABLE` (planned) | S-`SERVICE_UNAVAILABLE` | `review` | *Try again* / *Back* |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `accounts` | `corp.accounts.list` | none | accounts | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned |
| `create` | `corp.requests.create` | `{ type, accountId?, subject, details, leaves?, phone }` | `{ id, status: "received", createdAt }` | `ACCOUNT_NOT_FOUND`, `REQUEST_TYPE_INVALID`, `REQUEST_DUPLICATE`, `VALIDATION_FAILED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned; `moneyMoving: false`, `requiresOtp: false` |

#### 6. Permissions, step-up and limits

`biz.requests.create`; step-up `none`. Check 3: an Approver at Beta (Alex) forcing `corp.requests.create` answers `PERMISSION_DENIED`. Limit: 5 requests per user per day (`VALIDATION_FAILED` is not used for this; the sandbox answers `REQUEST_LIMIT_REACHED` (planned): "You have sent the most requests allowed today (5). Try again tomorrow.").

#### 7. Result and links out

Result with reference. Receipt: on-screen summary. Notifications: to the company's admins "New request at {company}: {subject}" (tagged); later, status changes raise "Your request {id} is {status}". Links out: *Go to requests*, *Send another*, *Done*.

#### 8. Acceptance criteria

- **AC-1** A Maker or Admin can send a request of each type, and it appears in Requests as Received.
- **AC-2** Subject, details and phone are validated, with the messages above.
- **AC-3** A chequebook request needs an account the person may see and a number of leaves.
- **AC-4** A second open request with the same type, account and subject is refused.
- **AC-5** A person without `biz.requests.create` cannot send, even when forced.
- **AC-6** A request sent at one company is not visible at another.
- **AC-7** On timeout or unavailability nothing is created.

#### 9. Scenarios

| # | Persona and setup | Conditions | Covers | Expected |
|---|---|---|---|---|
| T-1 | Alex at Alpha sends a chequebook request, Operating, 50 leaves | none | AC-1, AC-3 | Request listed as Received; result shows its id. |
| T-2 | Alex sends a complaint with subject "Hi" and details "short" | none | AC-2 | Stopped on `details` with both messages. |
| T-3 | Alex sends the same chequebook request again | none | AC-4 | `REQUEST_DUPLICATE` with the first id. |
| T-4 | Alex at Beta (Approver) forces `corp.requests.create` | none | AC-5 | `PERMISSION_DENIED`. |
| T-5 | Alex sends at Alpha; switches to Beta | none | AC-6 | Beta's requests list is empty of it. |
| T-6 | Alex sends a request | `timeout: ["corp.requests.create"]` | AC-7 | Timeout message; list unchanged. |
| T-7 | Alex sends a request | `unavailable: ["corp.requests.create"]` | AC-7 | `SERVICE_UNAVAILABLE`; list unchanged. |

#### 10. Expected mutation-check survivors

The journey-side length validations survive where the sandbox `VALIDATION_FAILED` repeats them (T-2 proves the sandbox). The leaves chips (`select`): none expected if T-1 covers them. Others: none expected.

---

### ★ KYB business onboarding (stretch) — `kyb-onboarding`

Stretch scope: only after the other 14 SME journeys are proved. It is written as a summary plus the screens, because several blocks it needs are Batch B (planned).

#### 1. Summary

| | |
|---|---|
| Slug | `kyb-onboarding` |
| Purpose | A company's administrator completes "know your business" checks: company details, owners, documents, declarations and signatures. |
| Release | 1 (stretch) |
| Workspace | Business (an existing company whose profile is `kyb_status: "incomplete"` or `"refresh_due"`) |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | `cab.ts` enrolment, plus planned `fileUpload`, `documentViewer`, `signature`, `idCapture` |
| Who may use it | `biz.admin.users` (Admin) |
| Journey type | File and security journey: timeout and unavailable scenarios. |

#### 2. Entry points

| Place | Label | Values passed in | Permission |
|---|---|---|---|
| More › profile | Business onboarding | none | `biz.admin.users` |
| Notification | "Your company details need a refresh" (planned) | none | `biz.admin.users` |

#### 3. Screens

Stepper: **Company**, **Owners**, **Documents**, **Declarations**, **Sign**, then the result. Progress is saved after each screen (`corp.kyb.save`), so the admin can leave and resume ("Resume your application" on the profile card).

| Screen | Blocks | Fields (label, required, rule, message) |
|---|---|---|
| `company` — "Company details" | `textInput`, `select` | Legal name (required, 2 to 120 chars, "Enter the company's legal name."); Registration number (required, 6 to 20 letters or digits, "Enter the registration number."); Country (required, "Choose a country."); Industry (required, "Choose an industry."); Registered address (required, 10 to 200 chars, "Enter the registered address."); Tax ID (required, 6 to 20 characters, "Enter the tax ID.") |
| `owners` — "Owners and directors" | `textInput`, `amountInput`, `toggle`, `idCapture` (planned) | One block per person, up to 6: Full name (required, "Enter the person's full name."); Role (Owner or Director, required); Ownership % (owners: 0.01 to 100; "Enter a percentage between 0.01 and 100."); Date of birth (`datePicker`, planned, 18 or older, "Owners and directors must be 18 or older."); ID photo and selfie (`idCapture`, required for owners of 25% or more, "We need a photo of the ID."). Rule: owners of 25% or more are named; total ownership listed must be at least 75% ("List owners holding at least 75% of the company between them.") |
| `documents` — "Documents" | `fileUpload` (planned) | Certificate of incorporation (required, PDF, JPG or PNG, at most 5 MB, "Upload the certificate of incorporation (PDF, JPG or PNG, up to 5 MB)."); Proof of address (required, same rule); Board resolution (optional) |
| `declarations` — "Declarations" | `documentViewer` (planned), `toggle` | Read the terms to the end (required, "Read the terms to the end to continue."); Tax residency (FATCA/CRS) self-certification (required, "Confirm your tax residency."); Source of funds (`select`, required, "Choose the main source of funds."); `consent` (`mustBeTrue`): "I confirm the information I gave is true and complete." |
| `sign` — "Sign" | `signature` (planned), `otp` | Signature drawn or typed (required, "Sign to continue."); one-time code |

Result `done`: "Application sent" / "We'll review it within 3 working days. You can keep using {company}." Reference "KYB {applicationId}". Buttons: *Go to profile*, *Done*.

#### 4. Sandbox errors

| Code | Message | Screen |
|---|---|---|
| `VALIDATION_FAILED` (planned) | "Check the highlighted fields and try again." | the screen that failed |
| `FILE_TOO_LARGE` (planned) | "That file is bigger than 5 MB. Choose a smaller file." | `documents` |
| `FILE_TYPE_NOT_ALLOWED` (planned) | "Upload a PDF, JPG or PNG file." | `documents` |
| `OWNERSHIP_INCOMPLETE` (planned) | "List owners holding at least 75% of the company between them." | `owners` |
| `UNDERAGE` (planned) | "Owners and directors must be 18 or older." | `owners` |
| `DOCUMENT_UNREADABLE` (planned; sandbox returns it for a file named `blurry.png`) | "We couldn't read that document. Upload a clearer copy." | `documents` |
| `APPLICATION_EXISTS` (planned) | "An application is already waiting for review." | `company` |
| `OTP_INVALID`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED`, `SESSION_EXPIRED` | Standard messages | as in `manage-user` |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | as in `manage-user` | the screen that failed |

#### 5. Adapters (all planned)

| Integration id | Adapter | Request | Response | Error codes |
|---|---|---|---|---|
| `status` | `corp.kyb.status` | none | `{ status, savedStep?, applicationId? }` | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `save` | `corp.kyb.save` | `{ step, data }` | `{ savedStep }` | `VALIDATION_FAILED`, `OWNERSHIP_INCOMPLETE`, `UNDERAGE`, `APPLICATION_EXISTS`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `upload` | `corp.kyb.upload` | `{ kind, fileName, mime, sizeKb }` | `{ documentId }` | `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `DOCUMENT_UNREADABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `otpSend`, `otpVerify`, `stepUp` | as in `manage-user` | | | existing / planned |
| `submit` | `corp.kyb.submit` | `{ signature }` | `{ applicationId, status: "in_review" }` | `VALIDATION_FAILED`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |

All have `moneyMoving: false`; `corp.kyb.submit` has `requiresOtp: true`.

#### 6. Permissions, step-up and limits

`biz.admin.users`; step-up `stepup` before `sign`. Uploads at most 5 MB each; 3 files per kind.

#### 7. Result and links out

Notifications: to all admins, "Business onboarding submitted"; later "Your company details are confirmed". Links out: *Go to profile*, *Done*.

#### 8. Acceptance criteria

- **AC-1** An admin can fill the five screens and submit; the profile shows "In review".
- **AC-2** Progress is saved and the admin can resume.
- **AC-3** Owners of 25% or more need an ID photo; listed ownership must reach 75%.
- **AC-4** Wrong file types, files over 5 MB and unreadable documents are refused with their messages.
- **AC-5** The terms must be read to the end before the declaration can be ticked.
- **AC-6** Submitting needs a signature, step-up and a correct one-time code.
- **AC-7** A second application cannot be started while one is in review.
- **AC-8** A person without `biz.admin.users` cannot start or submit.
- **AC-9** On timeout or unavailability no application is created and the saved progress is kept.

#### 9. Scenarios

| # | Persona and setup | Conditions | Covers | Expected |
|---|---|---|---|---|
| T-1 | `ravi` completes all screens, 2 owners (60% and 40%) | none | AC-1, AC-3, AC-5, AC-6 | Result "Application sent"; status In review. |
| T-2 | `ravi` leaves after `owners`, returns | none | AC-2 | Journey resumes at `documents`. |
| T-3 | `ravi` lists one owner at 50% | none | AC-3 | `OWNERSHIP_INCOMPLETE`. |
| T-4 | `ravi` uploads a `.exe`, a 6 MB file, `blurry.png` | none | AC-4 | Three different messages. |
| T-5 | `ravi` tries to tick before reading to the end | none | AC-5 | The checkbox is disabled; message shown. |
| T-6 | `ravi` starts a second application | none | AC-7 | `APPLICATION_EXISTS`. |
| T-7 | Alex at Alpha forces `corp.kyb.submit` | none | AC-8 | `PERMISSION_DENIED`. |
| T-8 | `ravi` submits | `timeout: ["corp.kyb.submit"]` | AC-9 | Timeout; no application; progress kept. |
| T-9 | `ravi` uploads | `unavailable: ["corp.kyb.upload"]` | AC-9 | `SERVICE_UNAVAILABLE`; progress kept. |

#### 10. Expected mutation-check survivors

The age check (journey side and sandbox side) survives on one side; the minimum-owner-count rule, if tested only in the sandbox, is listed. Full list to be written when built (stretch).

---

## Context switching and the entity selector

This section is a **shell spec**: the screens and rules around changing between Personal and the companies a person belongs to. It has no journey of its own; every step is a sandbox call plus a shell animation. It extends README 2.3 and 5.4.

**What exists today.** `BankApp` (`packages/bank-client/src/app.ts`) has `login()`, `logout()` and `selectPersona()` and one `MockBank` per persona. There is no `switchContext`, no session, no permissions. Corporate adapters take `userId` in the request. `logout()` makes a fresh `MockBank` (the sandbox resets). All context features are *planned*.

### Shell: Entity selector

| | |
|---|---|
| Purpose | Show where the person is, and let them move. |
| Where | Top bar of every screen after sign-in. Web: left of the page title. Mobile: the header title area (tap to open a bottom sheet). |
| Data source | `contexts(session)` (planned) over `bank.session.get`. |
| Permission | A session. |

**The closed selector** shows the current context: an avatar (Personal: initials; company: a coloured square with initials), the name ("Personal" or "Alpha Trading LLC"), and a **role badge** for a company ("Maker", "Approver", "Admin"; a person with two roles shows both). A small dot appears when another context has unread notifications.

**The open selector** lists: *Personal* (first), then each company the person belongs to, sorted by name. Each row: avatar, name, role badge(s), and a "n waiting" count when that company has payments waiting for this person's approval (counts only; no amounts). The current context shows a tick. Rows the session cannot enter (a disabled membership) are greyed with "Access removed. Ask an administrator." and cannot be tapped. At the bottom: *Sign out*.

**States**: loading skeleton rows while `bank.session.get` loads (the closed selector shows the name from the last answer); error "We couldn't load your companies. Try again." with *Try again*; a person with only Personal sees no list, only the label "Personal".
**Accessibility**: the selector is one button with an accessible name "Current: Alpha Trading LLC, Maker. Switch context."; the open list is a menu with focus trapped and Escape to close; badges have text, never colour alone.

### The switch, step by step

1. **Choose** a context in the selector (or follow a notification or link, see below).
2. **Same context**: nothing happens.
3. **Sandbox**: `bank.session.switch { contextId }` (planned).
   - Success: `{ contextId, label, workspace, role(s), permissions, limits, expiresAt }`.
   - `STEP_UP_REQUIRED`: the shell opens the **step-up sheet** (below), then calls `bank.session.stepUp`, then `bank.session.switch` again.
   - `PERMISSION_DENIED`: toast "Your access to {company} was removed. Ask an administrator." and the selector refreshes.
   - `TIMEOUT` / `SERVICE_UNAVAILABLE`: the person stays where they were; toast "We couldn't switch. You are still in {current}. Try again." with *Try again*.
4. **The moment**: a full-width overlay for at least 600 ms (and as long as step 3 takes) with the target's mark and the words **"Switching to Alpha Trading LLC…"** (Personal: "Switching to Personal…"). With reduced motion the overlay is a plain panel with no animation.
5. **Clear** (see the table below), then **load** the new context's menu and home from the new permissions.
6. **Cross-fade the theme** from Aurora to Graphite (or back) over 300 ms (instant with reduced motion). Web scopes theme variables by `data-workspace`; mobile passes the resolved brand to `ThemeProvider`.
7. **Land** on the last tab used in that workspace (default: Overview for Business, Home for Personal). A toast is not shown; the selector changes and an audit entry is written ("Alex Morgan switched to Alpha Trading LLC as Maker").

### The step-up sheet

Shown when the policy needs `stepup` (always for Personal to Business; also for Business to Business; not for Business to Personal).
- Title "Confirm it's you"; body "To open {company}, confirm with your {password | fingerprint | face}."
- A password field (or the biometrics prompt on mobile) then the six-digit code screen (`otp` block; code `482100` in the sandbox; 3 attempts).
- Buttons: *Confirm*, *Cancel* (stays in the current context).
- Errors: wrong password → "That password isn't right." (`STEP_UP_FAILED`, planned); wrong code → S-`OTP_INVALID`; third wrong code → "Too many wrong codes. Start again." and the sheet closes; the person is still in the old context and no data of the new one was loaded.
- A step-up stays valid for 5 minutes (`stepUpUntil`): a second switch within that time shows no sheet.

### What is cleared and what is kept

| Cleared on every switch | Kept on every switch |
|---|---|
| The active journey and its data | Language |
| Cached view-model data (balances, lists, notifications cache) | Light or dark mode |
| Open sheets and dialogs (including the selector) | The last tab used **per workspace** |
| Search text, filters, sorts and pages | The signed-in session (identity) |
| Drafts in forms | |
| Toasts and banners | |
| The previous context's deep-link `returnTo` | |
| In-memory sandbox handles tied to the old context (`otpVerified`, step-up for another context) | |

`BankApp.switchContext(contextId)` (planned) does steps 3 to 7 and ends with `tick + 1`. The one-time code verified for one context is not valid in another: `otpVerified` is reset on switch, so a payment after a switch always needs a new code.

### A link or notification into another context

Applies to: notifications, deep links (`bankworkx://business/<company>/j/<slug>?paymentId=…`, `/business/<companyId>/j/<slug>`), the ⌘K bar, and buttons that lead across (e.g. Settings › Open in Personal).
1. The shell reads the link's `contextId`. If it equals the current context, it opens at once (permission checked).
2. If different, a sheet says **"This belongs to {Beta Services Ltd}. Switch to {Beta Services Ltd} to open it."** with *Switch* and *Not now*. *Not now* leaves the person where they are with nothing changed.
3. *Switch* runs the switch above (with step-up), then opens the target (e.g. `approve-payments` at that payment).
4. If the target is gone (payment already handled), the destination shows "This payment has already been handled." with *Go to approvals* (S-`PAYMENT_NOT_PENDING` wording: "This payment is already {status}.").
5. If a journey is called while in the wrong context (forced), the sandbox answers `WRONG_CONTEXT` and the journey shows "This belongs to your {workspace} banking. Switch to {workspace} to continue." with *Switch*.

### Sandbox: identity adapters (planned, `identity.ts`)

| Adapter | Request | Response | Error codes | `moneyMoving` / `requiresOtp` |
|---|---|---|---|---|
| `bank.session.get` | none | `{ identity: { id, name }, activeContextId, contexts: [ { id, label, workspace: "personal" or "business", companyId?, roles: string[], permissions: string[], limits?, pendingCount?, access: "active" or "removed" } ], stepUpUntil?, expiresAt }` | `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | false / false |
| `bank.session.switch` | `{ contextId }` | the new active context, as in `contexts[]`, plus `auditId` | `STEP_UP_REQUIRED`, `PERMISSION_DENIED` (context unknown or access removed), `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | false / false |
| `bank.session.stepUp` | `{ method: "password" or "biometric", secret? }` then the usual `bank.otp.send` and `bank.otp.verify` | `{ stepUpUntil }` | `STEP_UP_FAILED` (planned; wrong password), `OTP_REQUIRED`, `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | false / true |

For Alex: contexts are `personal` (permissions in README 4.1), `alpha` (roles `["initiator"]`, permissions `biz.accounts.view`, `biz.accounts.export`, `biz.payments.initiate`, `biz.payments.bulk`, `biz.payroll.run`, `biz.payments.schedule`, `biz.payments.withdraw`, `biz.templates.manage`, `biz.suppliers.manage`, `biz.approvals.view`, `biz.requests.create`) and `beta` (roles `["approver"]`, permissions `biz.accounts.view`, `biz.accounts.export`, `biz.approvals.view`, `biz.approvals.approve`, `biz.audit.view`). Alpha has no `biz.approvals.approve`; Beta has no `biz.payments.initiate`.

Enforcement (README 2.3): every adapter reads the active context. A corporate adapter takes the acting user from the context and answers `PERMISSION_DENIED` when `input.userId` is a different person. A personal adapter called while a business context is active answers `WRONG_CONTEXT`. The existing Meezan flow (`userId` chosen in the journey) keeps working because that persona has no session contexts.

**Open questions on context switching are listed at the end of this part.**

---

## The combined Alex Morgan demo

The mandatory demo from the requirement: **one login**, a personal relationship, a **Maker** role at Alpha Trading LLC and an **Approver** role at Beta Services Ltd. The plan says it has 13 steps but does not list them. The 13 below are **proposed** (open question 1). The script runs on web and mobile and is proved by an end-to-end test.

### Seed and assumptions (all planned; sandbox seed file only)

| Item | Value |
|---|---|
| Sign-in | `alex.morgan` / `Bwx!Demo2026`; one-time code `482100` |
| Clock | Fixed at `2026-11-04T10:00:00Z` (a Wednesday, before the 16:00 UTC cut-off, a working day) so value date is today |
| Alex Personal | Main ••4410 USD 8,720.76; Savings ••7731 USD 15,254.37; daily limit 50,000 USD; beneficiary `ben_maria` ("Maria Lopez", ••5120, a BankWorkx® customer; planned seed) |
| Alpha Trading LLC | Currency USD; account `alpha_ops` "Operating" ••2001 USD 480,000.00; supplier `sup_harbour` "Harbour Packaging"; company limit 1,000,000.00, used 0; approval threshold 50,000.00; cut-off 16:00; Alex = Maker (`initiator`), personal daily limit 250,000.00; approvers `dana`, `lee`; admin `ravi` |
| Beta Services Ltd | Currency USD; account `beta_ops` "Operating" ••3001 USD 310,000.00; supplier `sup_nimbus` "Nimbus Logistics"; company limit 1,000,000.00, used 0; threshold 50,000.00; Alex = Approver; makers `priya`, `omar`; admin `noor`. One payment waiting: `priya` started USD 8,200.00 to Nimbus Logistics, reference "INV-2291" (id `pay_1` at Beta) |
| Ids | Each company has its own payment numbering (`pay_1` at Alpha and `pay_1` at Beta both exist). The test therefore reads payments **through the company context**, never by id alone (open question 8). |

### The 13 steps

For each step: screen, journey, permission used, expected sandbox state, and the assertion the end-to-end test makes. "Context" means the sandbox's active context. The abbreviation *E-n* refers to the test cases below.

**Step 1 — Sign in once**
- Screen: Landing › Sign in (Public). Journey: `sign-in` (Retail module; this demo uses its happy path).
- Permission: none (public).
- Sandbox state after: a session for identity `alex`, active context `personal`; `bank.session.get` returns three contexts (`personal`, `alpha`, `beta`); no company data loaded.
- Test assertion: `app.getState().screen` is `"app"`; `bank.session.get` returns exactly three contexts with Alex's roles (`personal`, `alpha` with `initiator`, `beta` with `approver`); `activeContextId` is `personal`; the session was created by a single sign-in (the sign-in count is 1 for the whole script).

**Step 2 — See the Personal home**
- Screen: Personal › Home (dashboard). Journey: none (shell).
- Permission: `accounts.view`.
- State: unchanged. Theme: Aurora.
- Assertion: the dashboard view-model lists Main ••4410 at 8,720.76 and Savings ••7731 at 15,254.37; `workspace` is `personal`; the selector shows "Personal"; no company name appears anywhere in the view-model (serialised to JSON, it contains neither "Alpha" nor "Beta" other than the context list in the selector).

**Step 3 — Make a personal transfer**
- Screen: Payments › hub › To a BankWorkx customer. Journey: `personal-transfer` (or `internal-transfer`; the demo uses `personal-transfer` per the plan, M1), 250.00 USD from Main to Maria Lopez.
- Permission: `payments.create`; step-up `otp`.
- State after: Main = 8,470.76; Personal daily limit used 250.00; one Personal transfer in Activity; `otpVerified` false again.
- Assertion: the `JourneyRunner` reaches the result screen; `bank.accounts.list` shows Main 8,470.76 and Savings unchanged at 15,254.37; `bank.limits.get` shows used 250; no corporate state changed (Alpha and Beta balances unchanged).

**Step 4 — Switch to Alpha as Maker, with step-up**
- Screen: top-bar selector › Alpha Trading LLC. Journey: none (context switch, shell spec above).
- Permission: context membership; step-up `stepup`.
- State: first `bank.session.switch { contextId: "alpha" }` answers `STEP_UP_REQUIRED`; after `bank.session.stepUp` and code `482100`, active context is `alpha`; `stepUpUntil` is 5 minutes ahead. Theme: Graphite.
- Assertion: the first switch attempt throws `STEP_UP_REQUIRED` and the context is still `personal`; a wrong code 3 times leaves the context `personal`; the right code makes `activeContextId` `alpha`; the selector shows "Alpha Trading LLC" with badge "Maker"; the shell shows the Overview tab; the menu contains Payments but **no Approvals action** and no Admin tab; `session.permissions` contains `biz.payments.initiate` and not `biz.approvals.approve`; Personal data (the transfer) is not in the view-model.

**Step 5 — Pay a supplier; the payment ends "Pending approval"**
- Screen: Overview › + Pay a supplier. Journey: `supplier-payment`, 12,500.00 USD from Operating to Harbour Packaging (United States, ACH, the default rail), purpose Goods or services, invoice number "INV-1042". Below 25,000.00 USD no code is asked.
- Permission: `biz.payments.initiate`; step-up `otp`; limits: Alex 250,000.00 per day, company 1,000,000.00.
- State after: Alpha `pay_1`: status `pending_approval`, `initiatedBy: "alex"`, `required: 1` (12,500.00 is below the 50,000.00 threshold), `approvals: []`, `valueDate: 2026-11-04`, `afterCutoff: false`; `alpha_ops` balance still 480,000.00 (nothing leaves until released); Alex's `usedToday` 12,500.00.
- Assertion: result screen title is "Pending approval" (the success copy of the supplier payment) and shows the payment id; `corp.payments.get` returns `pending_approval`; `balance` is 480,000.00; `companyUsedToday` is 0 (the company limit counts at release); the Personal Main balance is not changed by this (still 8,470.76 after the later switch, step 11).

**Step 6 — Alex cannot approve at Alpha, even when forced**
- Screen: Approvals › inbox (shell). Journey: `approve-payments` is **not offered**: the Approvals tab shows only "Waiting for others" (Alex's own payments, read-only) and no *Approve* button. The test forces the call.
- Permission: `biz.approvals.approve` is missing at Alpha.
- State after: unchanged; two refusals in the audit trail.
- Assertion (forced calls, after verifying a fresh code so the refusal is not `OTP_REQUIRED`): `corp.payments.approve { paymentId: "pay_1" }` answers `PERMISSION_DENIED`; the same call with `userId: "dana"` (pretending to be someone else) answers `PERMISSION_DENIED` (context and `userId` differ); and with the Alpha sandbox rules, if Alex's role were granted the call would answer `SELF_APPROVAL` (covered by a separate sandbox test, E-8). After the calls: `pay_1` still `pending_approval`, `approvals: []`, balance 480,000.00, and the audit trail has two Refused rows by `alex`.

**Step 7 — Switch to Beta as Approver**
- Screen: selector › Beta Services Ltd. Journey: none.
- Permission: membership; step-up `stepup` (still valid within 5 minutes, so the test also covers the case where it has expired: the clock is moved forward 6 minutes and a new step-up is required; E-5).
- State: active context `beta`; Alpha data cleared from the shell (cached view-models, draft, filters). Theme stays Graphite (same workspace type, different company); the selector shows "Beta Services Ltd" with badge "Approver".
- Assertion: `activeContextId` is `beta`; the view-model contains no Alpha payment (`pay_1` of Alpha, "Harbour Packaging") anywhere; `session.permissions` contains `biz.approvals.approve` and not `biz.payments.initiate`; forcing `corp.payments.initiate` at Beta answers `PERMISSION_DENIED`.

**Step 8 — Open the approvals inbox**
- Screen: Approvals › inbox. Journey: none (shell); the inbox is drawn from `corp.payments.pending`.
- Permission: `biz.approvals.view`.
- State: unchanged.
- Assertion: `corp.payments.pending` returns exactly one payment: `pay_1` of Beta, 8,200.00 USD, Nimbus Logistics, started by `priya`; the badge on the tab shows 1; it does not include Alpha's payment.

**Step 9 — Approve the payment**
- Screen: Approvals › inbox › payment. Journey: `approve-payments` (single), consent, one-time code.
- Permission: `biz.approvals.approve`; step-up `otp`.
- State after: Beta `pay_1`: `released`, `approvals` has `alex`, `required: 1` (8,200.00 is below the threshold), `releaseReference` "CORP-20261104-0001"; `beta_ops` 301,800.00; `companyUsedToday` 8,200.00; inbox now empty.
- Assertion: result screen "Payment released" with the release reference; `corp.payments.get` returns `released`; balance 301,800.00; `corp.payments.pending` returns none; Alex was not the initiator (`initiatedBy: "priya"`).

**Step 10 — Go back to Personal**
- Screen: selector › Personal. Journey: none.
- Permission: membership; no step-up for switching back (README 5.4).
- State: active context `personal`; Aurora theme; all Beta view-models, filters, drafts and the one-time code state cleared.
- Assertion: `activeContextId` is `personal`; the selector says "Personal"; the Personal tab is the last Personal tab used (Home); no step-up sheet appeared.

**Step 11 — No company data is visible in Personal**
- Screen: Personal › Home, Accounts, Payments › tracker, Activity, notifications (read). Journey: none.
- Permission: `accounts.view`.
- State: unchanged.
- Assertion (the "no company data" check): the view-models of Home, Accounts, Activity and Payments tracker, serialised to JSON, contain none of: "Alpha Trading", "Beta Services", "Harbour Packaging", "Nimbus Logistics", "INV-1042", "INV-2291", "12,500.00", "8,200.00", "CORP-", "beta_ops", "alpha_ops"; Personal Main is 8,470.76; calling `corp.payments.get` or `corp.payments.pending` from Personal answers `WRONG_CONTEXT`; calling a Personal adapter earlier at Beta answered `WRONG_CONTEXT` (E-9).

**Step 12 — A notification arrives for another context**
- Screen: Personal › notifications (and a banner). Journey: none for the list; tapping leads to `approve-payments` after a switch.
- Permission: a session; the link's own permission (`biz.approvals.approve`) is checked after the switch.
- State: while Alex is in Personal, `omar` (Beta Maker) starts a second payment, 3,150.00 USD to Nimbus Logistics, "INV-2305". The sandbox raises `bank.notifications` for Beta's approvers: `{ contextId: "beta", contextLabel: "Beta Services Ltd", kind: "approval_waiting", title: "Payment awaiting your approval, Beta Services Ltd", link: { journey: "approve-payments", params: { paymentId } } }`. The test makes `omar`'s call straight on the Beta sandbox (a test back door, not available to the app; open question 9).
- Assertion: the Personal notification list shows the item tagged "Beta Services Ltd" with exactly the title above and no amount or payee; `activeContextId` is still `personal`; tapping it opens the "This belongs to Beta Services Ltd. Switch to Beta Services Ltd to open it." sheet and does **not** switch by itself; choosing *Not now* leaves everything as it was; choosing *Switch* with step-up lands on the approvals inbox at that payment (this last part is the optional continuation of E-10 and then the script returns to Personal before step 13: the test calls `switchContext("personal")`).

**Step 13 — Sign out**
- Screen: More › Sign out (Personal). Journey: none.
- Permission: a session.
- State after: session ended; `BankApp.logout()` makes a fresh sandbox (existing behaviour: `freshBank()`); active context cleared; all cached data, drafts and toasts cleared.
- Assertion: `app.getState().screen` is `"login"`; `bank.session.get` answers `SESSION_EXPIRED`; calling any Personal or Business adapter answers `SESSION_EXPIRED`; signing in again starts at `personal` and the balances are reset to the seed (Main 8,720.76; Alpha payment gone: sandbox resets on sign-out as today); no stale company data (the app state contains no payment id).

### The end-to-end test

File: `packages/bank-client/src/combined-demo.test.ts` (planned), written with Vitest, as the other tests in the package. It drives `BankApp` (`packages/bank-client/src/app.ts`) with a bank brand `bankworkx` and the fixed clock, and `JourneyRunner` (`packages/renderer-core/src/runner.ts`) with `app.adapter` for each journey (`personal-transfer`, `supplier-payment`, `approve-payments`). It does not draw anything: it reads `app.getState()` and the view-models, as the existing `app.test.ts` does. The same script runs on web and mobile because both draw from `bank-client`; a thin check in each app (a render test in `apps/bank-web` and the mobile screen test) confirms the top bar shows the entity selector and badge.

Helper functions the test needs (planned): `signIn(app, "alex.morgan", "Bwx!Demo2026")`, `switchTo(app, contextId, { code: "482100" })`, `runJourney(app, slug, answers)` (fills the screens by block id, presses the buttons, returns the result view), `serialisedViews(app)` (JSON of every view-model for the "no company data" check), and `forced(app, adapter, input)` (calls `app.bank.call` directly, bypassing the UI, to prove check 3).

### Test case table

| # | Name | Steps | What it proves |
|---|---|---|---|
| E-1 | The whole script runs in order | 1 to 13 | The 13 steps pass end to end with one sign-in. |
| E-2 | Step-up is required to enter Alpha | 4 | First switch answers `STEP_UP_REQUIRED`; wrong password → `STEP_UP_FAILED`; wrong code 3 times → still Personal. |
| E-3 | Maker sees no approve action | 4, 6 | Alpha's menu lacks Approvals approve; `session.permissions` lacks `biz.approvals.approve`. |
| E-4 | Payment ends Pending approval and moves no money | 5 | `pending_approval`, balance 480,000.00, `companyUsedToday` 0. |
| E-5 | Step-up expires | 7 | After 6 minutes the Beta switch asks for step-up again. |
| E-6 | Forced approval at Alpha is refused | 6 | `PERMISSION_DENIED` for Alex's context and for `userId: "dana"`; payment unchanged; audit rows written. |
| E-7 | Approver cannot start a payment at Beta | 7 | Forced `corp.payments.initiate` answers `PERMISSION_DENIED`. |
| E-8 | Four-eyes holds even with the role | sandbox | With a test seed giving Alex both roles at Alpha, approving his own payment answers `SELF_APPROVAL` (existing rule). |
| E-9 | Personal adapters refused in a business context | 7, 8 | `bank.accounts.list` while at Beta answers `WRONG_CONTEXT`. |
| E-10 | Link into another context asks first | 12 | The sheet appears; *Not now* changes nothing; *Switch* needs step-up. |
| E-11 | Nothing leaks after switching back | 10, 11 | The JSON of all Personal view-models contains none of the banned strings; Personal adapters work; corporate adapters answer `WRONG_CONTEXT`. |
| E-12 | A one-time code does not carry across contexts | 9 to 10 | After a switch, `corp.payments.approve` or `bank.transfers.create` answers `OTP_REQUIRED` until a new code is verified. |
| E-13 | Sign-out ends everything | 13 | `SESSION_EXPIRED` for every adapter; app on login; sandbox reset. |
| E-14 | Timeout on switch keeps the person where they were | 4 | With `timeout: ["bank.session.switch"]` the context stays Personal and the retry works. |
| E-15 | Unavailable on approval changes nothing | 9 | With `unavailable: ["corp.payments.approve"]` the payment stays pending and money does not move. |
| E-16 | Same script, second bank API | all | The script repeats with `corpProvider: "bank-b"` (existing option) for Alpha and Beta, for the corporate steps (4 to 9), with the same visible results. (Optional; open question 10.) |

---

## Open questions

**About the 13 steps**
1. The plan says "13 steps" but lists none. The 13 here are proposed. Is the requirement's own list available? If it differs (for example, it may count "sign in" as two steps, password then code, or include "view receipt"), the table and the test change.
2. Step 3 uses `personal-transfer` (the plan's M1 list). `internal-transfer` fits a transfer to a BankWorkx® customer better. Which does the requirement mean?
3. Admin changes apply at once here. Should a second admin have to confirm (four-eyes for admin changes) in Release 1? It adds a pending state to `manage-user`, `change-limits` and `edit-signatory-group`.
4. Account permission changes (the grid) are a shell action here, not a journey. Should they be a journey (`change-account-permissions`) with full proof? That would make 16 SME journeys.
5. The audit trail has no export in Release 1. Should auditors be able to export it (it needs `biz.audit.view` plus `biz.accounts.export`)?
6. Should creating a statement raise a notification (in-app) when the file is ready? Release 1 says no because it is immediate.
7. `business-service-request` needs no one-time code. Is that right for "Change company details" and "Review our limits", which could be security relevant?
8. Payment ids are numbered per company (`pay_1` at both Alpha and Beta). Should the sandbox use globally unique ids (`pay_a_1`, `pay_b_1`) so a payment id never needs its company?
9. Step 12 needs a way for another user (`omar`) to act while Alex is signed in. The test calls the Beta sandbox directly. Should the "Sandbox conditions" panel offer a dev-only "Act as someone else" button for the live demo?
10. Should the 13-step test also run against Bank B (`corpProvider: "bank-b"`) as the existing 11 corporate tests do?

**About context switching**
11. Should Personal show the company name in a notification for another context ("Payment awaiting your approval, Beta Services Ltd")? It is a small disclosure of Alex's employment. This spec allows the company name and the generic title only.
12. Step-up validity is 5 minutes here. Is that the bank's policy, and should switching Business to Business within that time skip the step-up? This spec skips it.
13. Does a person who is Maker at Alpha need step-up to go from Alpha to Beta? This spec says yes unless the step-up is still valid.
14. In `TIMEOUT` on a switch, the sandbox does not apply it (README 1.5). A real bank may have applied it. Should the shell re-read `bank.session.get` after a timeout to find out where the person is?

**Grounding notes (could not be grounded in code today)**: `bank.session.*`, signatory groups, admin roles, audit trail, limits changes, statements, KYB and all `corp.accounts.*`, `corp.users.*` (apart from `corp.users.list`), `corp.limits.*`, `corp.signatories.*`, `corp.audit.*`, `corp.requests.*`, `corp.messages.*`, `bank.notifications.*` and `bank.settings.*` are new. Alex's contexts, Alpha, Beta and their users, balances and payments are the planned seed from README 1.7; the amounts and supplier names in the demo are proposals. The existing role names are `initiator` and `approver`; `admin` is new.

