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

**Catalog**: slug `business-accounts`, workspace business, category Accounts, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Permission `accounts.view`, does not move money. Option: **Show account numbers for receiving money** (`details`, default on). Prototype file `design/bankworkx-r1/src/journeys/45-business-accounts.js`. It is a screen in the Accounts tab (`view`, tab `acc`), not a stepped journey.

> Lean. The 13-week forecast chart, the totals for other companies and the long filter panel of the earlier version are gone. The screen is: total balance, the accounts table, one transactions list with a period row and a search box.

#### 1. Summary

| | |
|---|---|
| Slug | `business-accounts` |
| Purpose | Total balance, accounts with available and ledger balances, the numbers others use to pay the account, and a searchable list of transactions. |
| Release | 1 |
| Workspace | Business |
| Status | Existing, upgraded (`corp.company.get` returns accounts; the transaction list is (planned)). |
| Channels | web (accounts and detail together), mobile (list, then detail with **‹ Back**) |
| Who may use it | `accounts.view` at the company. What each person may do per account is separate (section 6). |
| Seed | Alpha: Operating ••2001 USD 480,000.00 and Reserve ••2044 EUR 95,200.00. Beta: Operating ••3001 USD 310,000.00 and Payroll ••3002 USD 64,300.00. About 64 synthetic transactions over the last 95 days, a few pending. |

**Home market configuration** (the identifiers shown under "Show account numbers for receiving money"; the account name is always the company name).

| Market | First line | Second line |
|---|---|---|
| Market A (routing number and account) | Routing number | Account number |
| Market B (sort code and account) | Sort code | Account number |
| Market C (IBAN) | IBAN | BIC |
| Market D (IBAN, mobile alias) | IBAN | BIC |

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Accounts tab | none | `accounts.view` |
| Overview › Consolidated balance | none | `accounts.view` |
| Command bar › Accounts | none | `accounts.view` |
| Other screens that open one account | `{accountId}` | `accounts.view` |

#### 3. Screen

- **Total balance** (hero): the sum of ledger balances converted to the company currency, and the company name.
- **Accounts table**: columns Account (name, and the chip "View only" when transactions are not allowed), Number (••last 4), Currency, Available, Ledger. Tapping a row selects it (tapping again clears it). Available is the ledger balance less pending outgoing items and payments waiting for approval (and an amount held for pending items).
- **Account detail** (shown for the selected account): name and ••last 4, chip "View only" if applicable, rows Currency, Available, Ledger; when `details` is on, the two identifier rows of the Home market table above and **Account name**, plus the button **Copy details** (toast "Account details copied"); the button **Pay from this account** when the person may pay from it (starts `supplier-payment`).
- **Transactions** (heading "Transactions", with " · {account}" when one is selected):
  - Period buttons **7 days**, **30 days** (default), **90 days**, **This month**; a **Search** box (counterparty or reference); a button **Export** when the person may export (opens `business-statement` with the account and the period).
  - Table with columns Date ("3 Nov"), Description (counterparty with the reference under it), Account (with the chip "Pending" where relevant; when one account is selected this column is Status: "Pending" or "Booked"), Amount (negative for payments, positive for receipts and interest). Up to 25 rows.
  - Empty: "No transactions" / "Try another period or search."
- **Account not allowed**: when the selected account hides its transactions, a card with "You can see the balance of this account, but not its transactions."
- **No accounts**: "No accounts yet" / "Ask an administrator for access."
- **Bank unavailable**: "We couldn’t load your accounts" / "We couldn’t load your accounts. Try again." with the button **Try again**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Period | buttons | no | one of four | none |
| Search | text | no | none | none |

Loading: the table shows its skeleton while the tab reads accounts. Messages here are plain; no codes appear.

#### 4. Errors

| Code | Message | Where |
|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn’t load your accounts. Try again." | whole screen |
| `ACCOUNT_NOT_PERMITTED` | "You can see the balance of this account, but not its transactions." | transactions area |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." with **Try again** (planned) | whole screen |

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Accounts and balances | `corp.company.get` (accounts); `corp.accounts.list` for per-account rights | Existing / (planned) |
| Transactions | `corp.transactions.list` | (planned) |
| Account numbers for receiving money | `corp.accounts.details` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. Per account the person has four rights: see the balance, see transactions, export, pay from. Alpha (Alex, Maker): Operating all four; Reserve balance, transactions and export but not pay. Beta (Alex, Approver): Operating balance, transactions and export; Payroll balance only (chip "View only"). No code, no limit.

#### 7. Result and links out

Links: **Export** (`business-statement`), **Pay from this account** (`supplier-payment`), **Copy details** (toast only). No notification.

#### 8. Acceptance criteria

- AC-1: The total balance and each account's available and ledger balances are shown.
- AC-2: An account without the transactions right shows "View only" and the not-allowed card, with no list.
- AC-3: The period buttons and the search box narrow the list; an empty result shows the empty state.
- AC-4: Account numbers for receiving money show only when `details` is on, in the identifiers of the home market.
- AC-5: Export and Pay from this account show only to people with those rights.
- AC-6: A bank that cannot be reached shows the retry state and no balances.
- AC-7: A company with no accounts shows the empty state.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Open Accounts | Total in USD; two rows | AC-1 |
| T-2 | Same | Select Operating | Detail with Pay from this account; list titled "Transactions · Operating" | AC-1, AC-5 |
| T-3 | Same | Select Reserve | No Pay from this account; Export shown | AC-5 |
| T-4 | Alex at Beta | Select Payroll | "View only"; not-allowed card; no Export | AC-2, AC-5 |
| T-5 | Same | Period 7 days, search "Payroll" | Shorter list; nonsense text shows the empty state | AC-3 |
| T-6 | `details` off, then on; home market A, B, C | Select an account | Rows follow the market table | AC-4 |
| T-7 | Bank unavailable | Open | Retry state | AC-6 |
| T-8 | Company without accounts (test seed) | Open | "No accounts yet" | AC-7 |
| T-9 | Timeout (planned) | Open | Retry state | none yet |

#### 10. Expected mutation-check survivors

- The 25-row cap: survives (the seed has more rows but the count is not asserted).
- The held amount in Available: survives, only the sign is asserted.
- Search by reference versus counterparty only: survives.
- The BIC values: survive, they are placeholders.

---

### ★ Business statement — `business-statement`

**Catalog**: slug `business-statement`, workspace business, category Accounts, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Permission `accounts.view`, does not move money. Prototype name on screen: "Statements and reports". Options: **Offer bank statement files** (`bankFormats`, default off; the three bank formats BAI2, MT940 and camt.053), **Allow intraday statements** (`intraday`, default off), **Allow scheduled statements** (`schedule`, default on), **Allow email to addresses outside the company** (`external`, default off). Prototype file `design/bankworkx-r1/src/journeys/46-business-statement.js`.

> Lean. Statements are sent by email only: once or on a schedule, as PDF, CSV or Excel. Delivery by secure file transfer, the separate format switches and the long filter panel are gone. The bank formats are the only format names on screen and appear only when `bankFormats` is on.

#### 1. Summary

| | |
|---|---|
| Slug | `business-statement` |
| Purpose | Send a statement for one or several accounts by email, once or on a schedule. |
| Release | 1 |
| Workspace | Business |
| Status | New (`corp.statements.generate` is planned). |
| Channels | web, mobile |
| Who may use it | `accounts.view`; only accounts the person may export are listed. Alpha (Alex): Operating and Reserve. Beta (Alex): Operating only. |
| Seed | One schedule exists: "Weekly PDF", weekly on Monday, to finance@alpha-trading.example (finance@beta-services.example at Beta). The default recipient is alex.morgan@ at the company's domain. |

**Home market configuration**: none. The same formats and screens on every market (the bank decides whether the bank formats are offered).

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Accounts › Export (`business-accounts`) | `{accountId}` optional, `{from}`, `{to}` (opens with Custom period) | `accounts.view` |
| Accounts › detail › Statement | `{accountId}` | `accounts.view` |
| Command bar › Statement | none | `accounts.view` |
| Receipt button "Schedule this" | `{reportType: "sched"}` | `accounts.view` |

With `{accountId}` only that account is ticked; otherwise all listed accounts are ticked.

#### 3. Screens

Progress text "Step n of 2 · Statements and reports".

**Step 1: Accounts and period** (button **Continue**)

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Type | chips "End of day", "Today so far" (only when `intraday` is on) | no | default End of day | none |
| Accounts | one tick per account, "{name} ••{last 4} · {currency}" | at least one | accounts the person may export | "Choose at least one account." |
| Period | chips: Last 7 days, This month, Last month (default), Last 3 months, Custom (hidden for Today so far) | yes | one of five | none |
| From | date, placeholder "Start date" (Custom) | yes | on or before To | field required |
| To | date, placeholder "End date" (Custom) | yes | not before From; at most 24 months | "The end date is before the start date." / "Choose up to 24 months at a time." |

**Step 2: Format and delivery** (button **Send**; busy "Preparing…", about 0.8 s)

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Format | chips PDF, CSV, Excel; with `bankFormats` also BAI2, MT940, camt.053 (for Today so far: MT942 and camt.052 in place of the last two) | yes | an offered format | "That format isn’t available." |
| Delivery | chips "Send once"; "Schedule" when `schedule` is on | yes | default Send once | none |
| How often | chips Daily, Weekly, Monthly (Schedule) | yes | one | none |
| Day | select Monday, Tuesday, Friday (Weekly) | yes | one | none |
| Day | select 1st, 5th, Last business day (Monthly) | yes | one | none |
| Send to | text area, placeholder "name@company.example", hint "Up to 5 addresses, separated by commas.", max 200 | yes | 1 to 5 valid addresses; at the company's domain unless `external` is on | "Check the email addresses. Use up to 5, separated by commas." / "You can only send to addresses at your company." |

A schedule is refused when ten already exist: "You already have 10 schedules. Remove one first." For a one-off statement the period, accounts and recipients are checked on Send: a period over 24 months, no permitted account, or no booked transactions in the period ("There are no transactions in that period. Choose another period."). End-of-day statements count booked items only; Today so far also includes pending ones.

**Result (one-off)** "Statement sent", line "It is on its way to {recipients}.", chip with the format name. Receipt rows: Accounts, Period ("Today so far" or "{from} to {to}"), Format, Sent to; then the reference. Buttons **Schedule this**, **Send another**, **Done**.

**Result (schedule)** "Schedule created", line "{format} statements will be sent {daily, weekly or monthly}.", chip "{n} of 10 schedules". Rows: Accounts, Format, How often (for example "Weekly, Monday"), First one (for example "Mon 9 Nov"), Sent to. Buttons **New statement**, **Done**.

#### 4. States and errors

| Code | Message | Where |
|---|---|---|
| `INVALID_RANGE` | "The end date is before the start date." | To field |
| `PERIOD_TOO_LONG` | "Choose up to 24 months at a time." | To field, Send |
| `NO_TRANSACTIONS` | "There are no transactions in that period. Choose another period." | banner on Send |
| `ACCOUNT_NOT_PERMITTED` | "You can’t export this account." | banner on Send |
| `FORMAT_NOT_ENABLED` | "That format isn’t available." | banner on Send |
| `INVALID_RECIPIENT` | "Check the email addresses. Use up to 5, separated by commas." | Send to field |
| `EXTERNAL_RECIPIENT_BLOCKED` | "You can only send to addresses at your company." | Send to field |
| `SCHEDULE_LIMIT` | "You already have 10 schedules. Remove one first." | Delivery |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was changed." | banner on Send |
| `SERVICE_UNAVAILABLE` | Sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." | sheet |

Loading: spinner on Send. Empty: no exportable account means the list of accounts is empty and Continue stays blocked.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Accounts the person may export | `corp.accounts.list` | (planned) |
| Transactions of the period | `corp.transactions.list` | (planned) |
| Build and email the statement | `corp.statements.generate` | (planned) |
| Create, list and remove schedules | `corp.statements.schedule` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view` plus the export right on each account. No code (nothing is sent to a new payee and no money moves). Up to 5 recipients, up to 10 schedules, up to 24 months. Each send or schedule is written to the audit trail ("Sent a {format} statement for {accounts}", "Created a {frequency} {format} statement").

#### 7. Result and links out

Links: **Schedule this**, **Send another**, **New statement**. Notification: none (the email is the delivery; "statement ready" in the app is (planned)).

#### 8. Acceptance criteria

- AC-1: Only accounts the person may export are listed; at least one must be ticked.
- AC-2: A custom period needs both dates, in order, within 24 months.
- AC-3: PDF, CSV and Excel are always offered; the bank formats appear only when `bankFormats` is on, and no format name other than these appears otherwise.
- AC-4: Recipients are 1 to 5 valid addresses at the company unless `external` is on.
- AC-5: A one-off statement with no booked transactions in the period is refused with the message.
- AC-6: A schedule can be created when `schedule` is on and fewer than ten exist, and its result shows the first run.
- AC-7: Today so far appears only with `intraday` and includes pending items.
- AC-8: Timeout and unavailable send nothing.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Defaults (all accounts, Last month, PDF), Send | "Statement sent"; recipient alex.morgan@alpha-trading.example | AC-1, AC-3 |
| T-2 | Alex at Beta | Open | Only Operating listed (Payroll absent) | AC-1 |
| T-3 | Same | Custom period To before From | "The end date is before the start date." | AC-2 |
| T-4 | Same | Custom period of 3 years | "Choose up to 24 months at a time." | AC-2 |
| T-5 | `bankFormats` on, then off | Step 2 | BAI2, MT940, camt.053 appear and disappear | AC-3 |
| T-6 | Same | Send to bob@outside.example | "You can only send to addresses at your company."; allowed with `external` on | AC-4 |
| T-7 | Same | Six addresses | "Check the email addresses. Use up to 5, separated by commas." | AC-4 |
| T-8 | Custom period with no transactions | Send | "There are no transactions in that period…" | AC-5 |
| T-9 | Schedule: Weekly, Friday | Send | "Schedule created"; first one "Fri 6 Nov"; "2 of 10 schedules" | AC-6 |
| T-10 | Ten schedules exist | Schedule, Send | "You already have 10 schedules. Remove one first." | AC-6 |
| T-11 | `intraday` on | Today so far, MT942 | Offered; pending items included | AC-7 |
| T-12 | Timeout; unavailable | Send | Banner; sheet; nothing sent | AC-8 |

#### 10. Expected mutation-check survivors

- The 731-day limit by one day: survives (no scenario at the edge).
- The default format PDF and default period: survive, scenarios choose explicitly.
- Day choices (Tuesday): survive, only Friday is asserted.
- The domain suffix check being case-sensitive: survives.

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

**Catalog**: slug `supplier-payment`, workspace business, category Payments, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Options: none. Permission `pay.create`, moves money. Prototype file `design/bankworkx-r1/src/journeys/36-supplier-payment.js`: a normal engine journey (`JR.define`, three steps, then a code prompt only from 25,000.00). It replaces the earlier region wizard; there is no separate rate screen, charges choice, cooling-off note, repeat choice or consent tick.

> The screens never name a country, a payment scheme or a file standard. The speeds shown are Standard, Same day and Instant. Which rail sits behind each speed, its fee, its limit and its arrival text come from the bank's rail configuration (`09-payment-rails.md`, now the bank-configuration reference).

#### 1. Summary

| | |
|---|---|
| Slug | `supplier-payment` |
| Purpose | A Maker pays a saved (whitelisted) supplier from the company's Operating account. The payment goes to approvers before it is sent. Nothing leaves the account until it is approved. |
| Release | 1 |
| Workspace | Business (planned field `workspace: "business"`) |
| Status | Existing, upgraded. Built today as `corporate-payment` (`packages/journey-schema/src/fixtures/corporate-payments.ts`, adapter `corp.payments.initiate`); the prototype journey is the reference for BankWorkx®. |
| Channels | web, mobile |
| Who may use it | The context holds `pay.create`. At Alpha Trading LLC: Alex Morgan (Maker). Not offered to Approvers (Alex at Beta): the launch buttons are hidden. |
| Seed | Alpha suppliers: Harbour Packaging (USD), Nordic Supplies AB (EUR), Whitby Logistics (GBP), Gulf Trade FZE (AED). Account: Operating ••2001 USD 480,000.00. Person limit 250,000.00 a day, two approvers above 50,000.00, extra code from 25,000.00 (all in USD). |

**Home market configuration**: none. The supplier's own saved region decides the currency and which speeds exist; the screens look the same on Market A, B, C and D. A supplier's account is shown only as the currency and the last 4 digits ("USD · ••8841").

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › New supplier payment | none | `pay.create` |
| Payments › Suppliers › row › Pay | `{supplierId}` | `pay.create` |
| Accounts › detail › Pay from this account (`business-accounts`) | none | `pay.create` and pay-from right on the account |
| Command bar › Pay a supplier | none | `pay.create` |

Parameters: `{supplierId}` (supplier chosen, step 1 skipped), `{amount}` (pre-fills the amount). The Payments tab lists the saved suppliers; adding one is the `add-supplier` journey.

#### 3. Screens

Progress text "Step n of 3 · Pay a supplier" (n of 2 when `{supplierId}` was passed). Each screen has **Back** (the first has **Cancel**). A step that calls the bank shows a spinner and the busy text.

**Step 1: Choose supplier** (skipped when a supplier was passed)

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Supplier | cards: name, then "{currency} · ••{last 4}" | yes | one of the saved suppliers | "Choose a supplier." |

Below the cards: the button **Request a new supplier** (opens `add-supplier`). Button **Continue**. Empty list: only the request button.

**Step 2: Amount and speed**. Busy text "Checking…" (about 0.5 s). Button **Review**. A live summary box under the fields.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| To / From | rows | no | To: supplier name and "{currency} · ••{last 4}". From: "Operating ••2001". | none |
| Amount | amount with the supplier's currency symbol, placeholder "0.00"; label becomes "Amount (EUR)" when the supplier is paid in another currency | yes | greater than 0; fits the chosen speed's limit; the payment (with fee) is within the available balance; USD equivalent plus today's payments by this person is within 250,000.00 | "That is over the limit for this payment. Try a smaller amount." / "Not enough in Operating. Available: {amount}." / "That is over your limit of $250,000.00 a day." |
| Speed | cards, one per speed the supplier's region offers (Standard, Same day, Instant). Left: name and arrival ("In seconds", "Today", or the bank's arrival text for Standard). Right: fee, or "Free". | yes | the first speed that fits is chosen; a speed the amount does not fit is dimmed with "Over the limit" and cannot be chosen | as above |
| Reference | text, hint "Invoice or PO number", max 35 | yes | letters, digits, space and `. , ' - / ( ) + : #` | "Use letters, numbers and spaces only." |
| Purpose | select, placeholder "Choose a purpose": Goods, Services, Rent, Utilities, Taxes and duties, Other | yes | one of the list | field required |
| Pay date | chips "Today", "Later" | no | default Today | none |
| Date | select of working days in the next 30 days | yes when Later | working day | field required |

Summary box: when the supplier is paid in another currency, "Rate: 1 USD = {rate} {currency}"; always **You pay** (the USD amount plus the fee). Text before an amount is entered: "Enter an amount." If the supplier has no speed (region switched off by the bank) the card area says "No speeds are available right now."

**Step 3: Review**. Button **Send for approval**.

| Row | Value |
|---|---|
| Supplier | name |
| Amount | in the supplier's currency |
| You pay | USD total with fee |
| Speed | Standard, Same day or Instant |
| Arrives (or Pay date when Later) | arrival text or date like "Thu 5 Nov" |
| Reference | as typed |
| Approval | "Needs 1 approval" or "Needs 2 approvals" |

The limits are checked again when the person continues (see section 4).

**Code prompt** (only when the USD equivalent is 25,000.00 or more; below it no code is asked, the saved-supplier list is the control). A keypad sheet. Title "Authorise {amount} to {supplier}". Line "Code sent to ••• 4410." The sandbox code is 482100.

**Result** "Sent for approval", line "{amount} to {supplier}", amber chip "Waiting for 1 approval" or "Waiting for 2 approvals". Receipt rows: Supplier, Amount, You pay, Speed, Arrives or Pay date, Approval; then the BankWorkx® reference. Buttons **Track payment** (opens the payment in Payments), **Pay another supplier**, **Done**.

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `SUPPLIER_NOT_APPROVED` | "Choose a supplier from your list." | step 1 banner | fix and continue |
| `RAIL_LIMIT` | "That is over the limit for this payment. Try a smaller amount." | step 2 field, review banner | change amount |
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in the account." (field: "Not enough in Operating. Available: {amount}.") | step 2, review | change amount |
| `LIMIT_USER_EXCEEDED` | "That is over your daily limit." (field: "That is over your limit of $250,000.00 a day.") | step 2, review | change amount |
| `STEP_UP_FAILED` | "We couldn’t confirm this payment. Nothing was sent. Start again." | code sheet | start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice." | banner on step 2 or after the code | check Payments |
| `SERVICE_UNAVAILABLE` | Sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." | sheet | Try again / Cancel |

Loading: the spinner on step 2 (about 0.5 s). Empty: no suppliers means only "Request a new supplier". The same-day cut-off, rate hold time and cooling-off note of the earlier version are not on screen (bank configuration, planned).

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Company, accounts, suppliers, remaining limit | `corp.company.get` | Existing |
| Start the payment (waits for approval) | `corp.payments.initiate` (needs the code first; errors `NOT_AUTHORISED`, `BENEFICIARY_NOT_WHITELISTED`, `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`) | Existing, `packages/mock-bank-api/src/corporate.ts` |
| Quote for a foreign currency (rate, fee, speed limits) | `corp.payments.quote` | (planned) |
| Speeds and fees per supplier region | bank rail configuration (`09-payment-rails.md`) | (planned) |

#### 6. Permissions, step-up and limits

`pay.create`. Code only from 25,000.00 USD equivalent. Person limit 250,000.00 per day (counts this person's payments today that are not rejected or withdrawn); company limit counted at release. Two approvers above 50,000.00. The USD equivalent is used for foreign-currency payments.

#### 7. Result and links out

The payment is recorded as waiting (id `PAY-n`, "Today 10:42"), so it shows in Payments and in the Approvers' inbox. Notification (planned): "Payment awaiting your approval" to the approvers. Links: Track payment (Payments tab, that payment), Pay another supplier (this journey), `add-supplier`.

#### 8. Acceptance criteria

- AC-1: Only saved suppliers can be chosen; a new supplier is requested through `add-supplier`.
- AC-2: The speed cards come from the supplier's region; a speed whose limit is below the amount is dimmed and cannot be chosen.
- AC-3: Reference and Purpose are required before Review.
- AC-4: An amount above the balance or above the person's daily limit is refused with the message of section 4.
- AC-5: Below 25,000.00 USD equivalent no code is asked; from it the code sheet names the amount and the supplier.
- AC-6: Two approvals are needed above 50,000.00 USD equivalent, one otherwise, and the review and the receipt say so.
- AC-7: The result is "Sent for approval" with a waiting chip and no money moves.
- AC-8: A timeout shows the check-Payments message and creates no payment; an unavailable bank shows the sheet and creates no payment.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Harbour Packaging, 12,500.00, Standard, INV-1042, Goods; send | No code; "Sent for approval"; chip "Waiting for 1 approval"; balance unchanged | AC-1, AC-3, AC-5, AC-7 |
| T-2 | Alex at Alpha | Nordic Supplies AB, 30,000.00 EUR | Rate row shown; code sheet "Authorise €30,000.00 to Nordic Supplies AB"; code 482100; waiting | AC-5 |
| T-3 | Alex at Alpha | Harbour Packaging, 60,000.00 | Standard is dimmed "Over the limit" and Same day is chosen; "Needs 2 approvals" on review and receipt | AC-2, AC-6 |
| T-4 | Alex at Alpha | Amount above every speed limit the bank sets | The message "That is over the limit for this payment. Try a smaller amount." | AC-2 |
| T-5 | Alex at Alpha | Amount 600,000.00 | "Not enough in Operating. Available: …" | AC-4 |
| T-6 | Alex at Alpha, 240,000.00 sent earlier today | Another 20,000.00 | "That is over your limit of $250,000.00 a day." | AC-4 |
| T-7 | Alex at Alpha | Leave Reference or Purpose empty | Review stays disabled | AC-3 |
| T-8 | Alex at Alpha, wrong code three times | Code sheet | "We couldn’t confirm this payment. Nothing was sent. Start again."; no payment | AC-5 |
| T-9 | Timeout on submit | Review | Banner "Check Payments before you try again, so you don’t pay twice."; no payment | AC-8 |
| T-10 | Bank unavailable | Review | Sheet "We couldn’t reach the bank"; no payment | AC-8 |
| T-11 | Alex at Beta | Open Payments | No Pay a supplier button | AC-1 |

#### 10. Expected mutation-check survivors

- Changing the 25,000 or 50,000 constants by one cent: survives, because the sandbox amounts in T-1 to T-3 are far from the edge (an edge scenario at exactly 25,000.00 is planned).
- Changing the pay-date list length (30 days): survives, the list is not asserted.
- Removing the "#" from the reference pattern: survives, no scenario types it.
- Swapping the order of the speed cards: survives, only the chosen speed is asserted.

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

**Catalog**: slug `bulk-payment`, workspace business, category Payments, core no, a bank can switch it off (yes). Permission `pay.create`, moves money. Options (all shown in the catalog panel): **Allow entering payments by hand** (default on), **Also accept bank file formats** (`bankFormats`, default off), **Offer the Same day speed** (`allowSameDay`, default on), **Offer the Instant speed** (`allowInstant`, default on). Prototype file `design/bankworkx-r1/src/journeys/40-bulk-payment.js`, with `bulk-status` and the resend mode in the same file.

> Lean and country-neutral. Screens never name a country or a payment scheme. One standard for every bank: the account format in each line decides which checks apply. Bank file formats (for example the bank's own XML file) are only offered, and only named on screen as "Bank file", when `bankFormats` is on. Pasting lines, per-line approval, partial acceptance and the sample-file picker by scheme name of the earlier version are gone.

#### 1. Summary

| | |
|---|---|
| Slug | `bulk-payment` |
| Purpose | Pay many approved payees from a file or a short list. Every payment is checked first; then the batch goes for approval as one payment. Payments the bank rejected are fixed and resent with this same journey (resend mode). |
| Release | 1 |
| Workspace | Business |
| Status | Existing, upgraded (`corp.bulk.check`, `corp.bulk.submit` exist). The prototype is the reference. |
| Channels | web, mobile |
| Who may use it | `pay.create`: Alex at Alpha (Maker). Not offered at Beta. |
| Limits | Up to 50 payments, file up to 256 KB, person 250,000.00 a day, company 1,000,000.00 a day (USD equivalent), two approvers above 50,000.00, extra code from 25,000.00. |

**Home market configuration** (the only place a country fact appears). The template asks for the identifiers of the account format; the check in each line reads the account format it finds.

| Market | Account format in a line | Checks |
|---|---|---|
| Market A (routing number and account) | routing number in "Bank code" plus account number | routing number passes its check digit; account number 4 to 17 digits |
| Market B (sort code and account) | sort code in "Bank code" (6 digits, dashes allowed) plus 8-digit account number | both formats |
| Market C (IBAN) | IBAN in "Account number or IBAN", "Bank code" empty | check digits and length |
| Market D (IBAN, mobile alias) | IBAN as Market C; a mobile alias is not used in bulk files | check digits and length |

The template sample row follows the home market (Market A gets a routing-number row, the others an IBAN row). The currency of a line follows its account format; the speed's rail, fee and limit are bank configuration (`09-payment-rails.md`). The edit panel names the code field "Routing number", "Sort code" or "Bank code" to match.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › Bulk & payroll › Upload or enter payments | none | `pay.create` |
| Overview › + › Bulk payment | none | `pay.create` |
| Batch status › Fix and resend | `{repairOf}` (batch id) | `pay.create` |

#### 3. Screens

Progress text "Step n of 4 · Bulk payment" (3 steps in resend mode). Each screen has Back (the first has Cancel).

**Step 1: Add payments** (not shown in resend mode). Intro "Upload a file or enter the payments." Busy "Checking the payments…" (about 0.7 s). Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| How | chips "Upload a file", "Enter payments" (shown only when `allowEnter` is on) | no | default Upload | none |
| Pay from | select: "Operating ••2001 · $480,000.00", "Reserve ••2044 · €95,200.00" | yes | one of the company accounts | "Choose the account to pay from." |
| Format | chips "Template (CSV)", "Bank file" (only when `bankFormats` is on and Upload is chosen) | no | default Template (CSV) | none |
| File | file field, placeholder "Choose a file (up to 256 KB)" | yes (Upload) | readable file of the chosen format | "Choose a file first." / "Use a CSV file." / "Use a bank file." |
| Download template | link; the file is `payment_template.csv` with the header "Payee name, Account number or IBAN, Bank code, Amount, Reference" and one sample row | no | none | toast "Downloaded" |
| Payee | select, placeholder "Choose a payee" (saved suppliers) | yes to add (Enter) | one supplier | "Choose a payee and enter an amount" (toast) |
| Amount | amount, placeholder "0.00" | yes to add | above zero | same toast |
| Reference | text, placeholder "INV-1001", max 35 | no | none | none |
| Add payment | button (Enter) | no | at most 50 payments | toast "A batch can have up to 50 payments." |

When Enter is chosen a card "{n} added" lists each payment with a **Remove** button. Continuing with nothing added shows "Add at least one payment."

File refusals (the field shows the message and the step cannot continue): "You already sent this file on 30 Oct." (same file sent before), "We can’t read this file type.", "This file is too big. The limit is 256 KB.", "There are no payments in this file." A file with more than 50 payments shows the banner "A batch can have up to 50 payments."

**Step 2: Check payments**. Intro "Fix or remove anything marked, then continue." Three tiles: **Valid**, **Need fixing**, **Total** (USD). If lines need fixing: buttons **Fix lines** (opens the first one) and **Remove all errors**. A table with columns Payee, Account (••last 4, or "None"), Amount (with currency), Status. Status is a green "Ready" chip or a red "Needs fixing" chip with the first message below. Tapping a row opens its edit card "Payment {n}": the messages for the line, then fields **Payee name**, **Account number**, **Routing number** / **Sort code** / **Bank code** (shown when the line has one or uses those formats), **Amount**; buttons **Done**, **Use saved details** (only when the line does not match the saved account), **Remove**. Button **Continue** stays disabled until nothing needs fixing: "Fix or remove the payments that need fixing." (or "Add at least one payment.").

Messages per payment (one short sentence each, no codes on screen):

| Check | Message |
|---|---|
| Payee name empty / over 70 characters | "Enter the payee name." / "The name is too long." |
| Amount not a number with up to 2 decimals above zero | "Enter an amount above zero." |
| Account not recognised, or number wrong | "Check the account number." |
| Bank code wrong | "Check the routing number." / "Check the sort code." |
| Payee not on the approved list | "Not an approved payee." |
| Account differs from the saved supplier's | "Doesn’t match the saved account details." |
| Above the person's limit (USD equivalent) | "Above your payment limit." |
| Same payee, account, amount and reference as an earlier line | "Same as payment {n}." |
| Message returned by the bank (resend mode) | the bank's own sentence, until the line is edited |

**Step 3: Speed and date**. Fields:

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Speed | cards: Standard ("1 to 3 business days"), Same day ("Today", when `allowSameDay` is on), Instant ("In seconds", when `allowInstant` is on). Right side: total fee or "No fee". | yes | a speed is disabled with "Some payments are too large" when a line exceeds the rail limit | field required |
| Send | chips "Today", "Later" (hidden for Instant) | no | Instant always sends today | none |
| Date | select of working days, next 30 days | yes when Later | working day | "Choose a date." |

**Step 4: Review**. Busy "Checking limits and funds…" (about 0.8 s). A summary card: "Total" (or "Total in USD, about" when several currencies) and "{n} payments". Rows: Pay from, Payments, Amounts (several currencies only), Speed, Send ("Today" or the date), Fees ("None" or amount), **You pay** (in the account's currency), **Approvals needed** (1, or 2 above 50,000.00). Field **Batch name (optional)**, placeholder "Suppliers November", max 35. Button **Submit for approval**. Checks on continue: nothing payable, person limit, company limit, funds.

**Code prompt** (always asked for a batch). Title "Authorise {USD total} in {n} payments". Line "Code sent to ••• 4410." plus "This amount needs an extra code." from 25,000.00.

**Result** "Sent for approval", line "{n} payments, {totals}. Nothing has left the account yet.", amber chip "Waiting for 1 approver" or "Waiting for 2 approvers". Receipt rows: Batch, Payments, Total, You pay, Speed, Send, Approvals needed; then the BankWorkx® reference. Buttons **View batch** (opens `bulk-status`), **Track in Payments**, **Done**.

**Resend mode** (`{repairOf}`): step 1 is skipped. The account is the original batch's; the batch name is "Resend of {name}" (35 characters at most); the lines are the original's failed lines, each carrying the bank's message. Everything else is the same. If the batch is not paid or has no failed lines, step 2 shows the empty state "Nothing to resend" / "All payments in this batch went through." and Continue says "There is nothing to resend." After sending, the resent lines are marked "Resent" on the original, so they cannot be sent twice.

#### 4. States and errors

| Code | Message | Where | Button |
|---|---|---|---|
| `EMPTY_BATCH` | "Add at least one payment." | step 1 | add payments |
| `BATCH_TOO_LARGE` | "A batch can have up to 50 payments." | step 1 | change file |
| `NO_VALID_LINES` | "None of the payments can be sent." | review | go back |
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in this account." | review | change account |
| `LIMIT_USER_EXCEEDED` | "This is above your payment limit." | review | remove lines |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company limit." | review | wait or reduce |
| `DATE_NOT_WORKING_DAY` | "Choose a working day." | step 3 | change date |
| `REPAIR_NOT_ALLOWED` | "There is nothing to resend." | resend step 2 | back |
| `TIMEOUT` | "We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice." | banner | check Payments |
| `SERVICE_UNAVAILABLE` | sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." | sheet | Try again / Cancel |

Loading: spinners on steps 1 and 4. Empty: the check table shows "No payments" / "Go back to add some."

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Company, accounts, approved payees | `corp.company.get` | Existing |
| Check the lines | `corp.bulk.check` (file text in, per-line result out; codes `EMPTY_BATCH`, `BATCH_TOO_LARGE`) | Existing, `corporate.ts` |
| Send as one batch for approval | `corp.bulk.submit` (needs the code first; `NO_VALID_LINES`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`) | Existing |
| Account-format checks (routing number, sort code, IBAN) and bank-file parsing | the bank's account validation service | (planned) |
| Resend failed lines from a settled batch | `corp.bulk.submit` with the batch id | (planned) |

#### 6. Permissions, step-up and limits

`pay.create`. The code is always asked; from 25,000.00 USD equivalent the prompt adds "This amount needs an extra code." Person limit counts the person's batches and payments today that are not rejected or withdrawn. Company limit counts everyone's. Two approvers above 50,000.00.

#### 7. Result and links out

The batch is recorded as one waiting payment "Bulk · {n} payments" (id `PAY-n`) and shows in Payments and the approvers' inbox. Notification (planned): "Payment awaiting your approval". Links: `bulk-status`, Payments tracker. Resend marks the original lines "Resent".

#### 8. Acceptance criteria

- AC-1: A file of at most 256 KB and 50 payments is read; an unreadable, oversized, repeated or empty file is refused with the message of step 1.
- AC-2: Every line is checked and shows one short message; the batch cannot continue until each marked line is fixed or removed.
- AC-3: A line whose payee is not on the approved list, or whose account differs from the saved one, is marked.
- AC-4: Duplicate lines are marked "Same as payment {n}."
- AC-5: Speeds offered follow the options; a speed too small for a line is disabled; Instant has no date.
- AC-6: Review shows total, fees, what the account pays and approvals needed; limits and funds are checked on submit.
- AC-7: A code is always asked; the result is "Sent for approval" and no money moves.
- AC-8: Resending failed lines creates a new batch and marks them "Resent" on the original.
- AC-9: With `bankFormats` off no bank file choice appears and no format name is on screen.
- AC-10: A timeout shows the check-Payments message; an unavailable bank shows the sheet; neither creates a batch.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha; sandbox clean file (5 lines) | Upload, Continue, Continue, Standard, Submit, code 482100 | All 5 "Ready"; "Sent for approval"; waiting chip | AC-1, AC-2, AC-6, AC-7 |
| T-2 | Alex at Alpha; sandbox file with errors (10 lines) | Upload | Tiles show valid and need fixing; messages for name, amount, account, payee, match, limit, duplicate; Continue disabled | AC-2, AC-3, AC-4 |
| T-3 | Same | Remove all errors, continue | Only valid lines go on | AC-2 |
| T-4 | Sandbox files: already sent, unreadable type, 3.4 MB, empty | choose each | Messages of step 1 | AC-1 |
| T-5 | `allowSameDay` and `allowInstant` off | Step 3 | Only Standard | AC-5 |
| T-6 | Choose Instant | Step 3 | No Send or Date | AC-5 |
| T-7 | `bankFormats` on, Bank file chosen with a CSV | Step 1 | "Use a bank file." | AC-9 |
| T-8 | Batch PAY-1190 with one failed line | Fix and resend, fix, send | New batch "Resend of Supplier batch 19"; original line "Resent" | AC-8 |
| T-9 | Batch with nothing failed | Resend | "Nothing to resend" | AC-8 |
| T-10 | Batch over 250,000.00 | Submit | "This is above your payment limit." | AC-6 |
| T-11 | Timeout, then unavailable | Submit | Timeout banner; sheet; no batch | AC-10 |

#### 10. Expected mutation-check survivors

- The 70-character name limit and the 35-character batch name: survive, no scenario reaches the edge.
- Changing 50 lines or 256 KB by one: survives (the sandbox files are far from the edge; an edge file is planned).
- The Market B pattern of dashes in a sort code: survives, only one sample line uses it.
- The order of the three speed cards: survives.

---

### ★ Repair rejected lines — `repair-bulk-lines`

**Catalog**: slug `repair-bulk-lines`, workspace business, category Payments, core no, a bank can switch it off (only together with `bulk-payment`, of which it is a mode). Options: those of `bulk-payment`. No file of its own in the prototype.

Alias of `bulk-payment`: reached by launching `bulk-payment` with `{repairOf: paymentId}` from Batch status › **Fix and resend**, or from an old `repair-bulk-lines` link. The full text is in `bulk-payment` ("Resend mode").

What differs from a new batch:

- No "Add payments" step. The journey starts at **Check payments**. The account is the original batch's and the name is "Resend of {name}" (35 characters at most).
- The lines are the original's failed lines, each showing the bank's own sentence (for example "The account name didn’t match.") until it is edited. All the checks, the speed, the review and the code are the same.
- If the batch has nothing left to resend, the step shows the empty state **Nothing to resend** / "All payments in this batch went through." and Continue says "There is nothing to resend." (`REPAIR_NOT_ALLOWED`).
- On submit a new batch is made and the resent lines show "Resent" on the original, so they cannot be sent twice. Acceptance criterion and scenarios: AC-8, T-8 and T-9 of `bulk-payment`.

---

### ★ Batch status — `bulk-status`

**Catalog**: slug `bulk-status`, workspace business, category Payments, core no, a bank can switch it off (yes; the View batch button then disappears). Options: none (it follows `bulk-payment`; the Fix and resend button needs `bulk-payment` on). It is a screen inside the Payments tab (`view`, tab `pay`, not in the Lean preset), not a stepped journey. Permission `pay.create`; does not move money. Prototype file `design/bankworkx-r1/src/journeys/40-bulk-payment.js`.

#### 1. Summary

| | |
|---|---|
| Slug | `bulk-status` |
| Purpose | Shows one bulk batch: its name, total, status, the status of every payment in it, a report to download and the way to fix and resend payments that failed. |
| Release / workspace | 1 / Business |
| Status | Built as a screen. No stepped journey and no code. |
| Channels | web, mobile |
| Who may use it | `pay.create`: Alex at Alpha. |
| Parameters | `{id}` of a batch; with none, the company's latest bulk batch. |

**Home market configuration**: none. The account column shows only "••" and the last 4 digits.

Seed: two earlier batches at Alpha. `PAY-1180` "Supplier batch 18", 30 Oct, 6 payments, all paid, approved by Dana Cruz. `PAY-1190` "Supplier batch 19", 28 Oct, 4 payments, approved by Lee Park; the fourth (Gulf Trade FZE) failed at the bank with the message "The account name didn’t match." A batch just sent from `bulk-payment` appears first as "Waiting for approval".

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › Bulk & payroll › a batch | `{id}` | `pay.create` |
| `bulk-payment` receipt › View batch | `{id}` | `pay.create` |

#### 3. Screen

One screen, no steps.

- **Card**: batch name, status chip, the total in USD, and "{n} payments · {id}". Buttons: **Fix and resend** (only when some payments failed and are not yet resent; starts `bulk-payment` in resend mode with `{repairOf}`) and a link **Download report**.
- **Status chip**: "Waiting for approval", "Sent to bank", "Paid", "Partly paid" (settled with failed payments), or the payment's own status (rejected, withdrawn).
- **Table** with columns Payee, Account, Amount, Status. Payee is "{n}. {name}"; Account is "••" and the last 4 digits; Amount is the line amount and currency. Status chip per payment: Waiting for approval, Sent to bank, Paid, Failed (with the bank's sentence in red under it), Resent, Cancelled (batch rejected), Withdrawn.
- **Other batches** list below (name, "{n} payments · {date}", status chip); tapping one shows it.
- **Report**: a CSV file named `{id}_report.csv` with columns Line, Payee, Amount, Currency, Status, Note (the bank's sentence). Toast "Downloaded".

There are no input fields.

States. Empty: "No batches yet" / "Batches you send show here." with the button **New bulk payment**. Loading and error: the screen reads the company's payments from the tab; a failed read is the shared bank-down sheet (planned for this screen; the prototype does not call a service here). The download shows "Download works in the browser" when the device cannot save a file.

#### 4. Errors

No message of its own (`PERMISSION_DENIED` hides the entry). `TIMEOUT` and `SERVICE_UNAVAILABLE` are (planned) and would show the tab's retry state.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| List the company's payments | `corp.payments.list` | (planned) |
| One payment with its lines | `corp.payments.get` | Existing |
| Report download | built in the client from the batch | Existing in prototype |

#### 6. Permissions, step-up and limits

`pay.create`. No code. No limit.

#### 7. Result and links out

Links: **Fix and resend** (`bulk-payment` resend mode), **New bulk payment** (empty state), other batches. No notification.

#### 8. Acceptance criteria

- AC-1: The card shows name, total, line count, id and a status chip that follows the batch.
- AC-2: Every payment has its own status chip; failed ones show the bank's sentence.
- AC-3: Fix and resend appears only when a payment failed and is not resent.
- AC-4: The report has one row per payment with the columns of section 3.
- AC-5: With no batches the empty state and its button show.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Open `PAY-1190` | "Partly paid"; line 4 "Failed" with its sentence; Fix and resend shown | AC-1, AC-2, AC-3 |
| T-2 | Same | Open `PAY-1180` | "Paid"; no Fix and resend | AC-1, AC-3 |
| T-3 | Same | Fix and resend, fix, send, return | Line 4 shows "Resent"; Fix and resend gone | AC-3 |
| T-4 | Same | Download report | CSV with 4 rows and the Note on line 4 | AC-4 |
| T-5 | Company with no batches | Open | Empty state | AC-5 |
| T-6 | Send a new batch | Open it | "Waiting for approval" on card and every line | AC-1, AC-2 |
| T-7 | Timeout and unavailable | (planned) | Retry state; nothing changes | none yet |

#### 10. Expected mutation-check survivors

- Chip colours: survive, scenarios check text only.
- Order of "Other batches": survives.
- Timeout and unavailable: no behaviour in the prototype, so no mutant exists (planned).

---

### ★ Payroll run — `payroll-run`

**Catalog**: slug `payroll-run`, workspace business, category Payments, core no, a bank can switch it off (yes). Permission `pay.create`, moves money. Options: **Allow bonus lines** (`allowBonus`, default on), **Allow deduction lines** (`allowDeduction`, default on), **Ask for a reason when the total changes by more than 20%** (`varianceCheck`, default on), **Offer to send payslips** (`payslips`, default on). Prototype file `design/bankworkx-r1/src/journeys/41-payroll-run.js`.

> Lean and country-neutral. The run starts from the employee register (net pay already worked out in the company's payroll system; tax and insurance are not calculated here). There is no payroll file upload, no wage-protection file and no sample file picker; those were removed. The rail behind each currency (fee and cut-off) is bank configuration (`09-payment-rails.md`) and never named on screen.

#### 1. Summary

| | |
|---|---|
| Slug | `payroll-run` |
| Purpose | Pay employees for one pay period from the register: change an amount, add a bonus or deduction, take someone out, review and send for approval. |
| Release | 1 |
| Workspace | Business |
| Status | Existing, upgraded (`corp.payroll.check`, `corp.payroll.submit` exist, but they read a pasted file; the register-based flow is (planned) in the adapters). |
| Channels | web, mobile |
| Who may use it | `pay.create`: Alex at Alpha. Not offered at Beta. |
| Seed | Register for Alpha Trading LLC, 9 people in USD, GBP, AED, SAR and JOD. Eight have bank details and are in the run by default; Faris Qasem has none and is listed under "Not in this run" with the chip "No bank details". An earlier run for October 2026 (`PAY-1120`, 8 employees, paid) exists. |
| Limits | Maximum pay per person 1.5 times the monthly salary; person 250,000.00 a day; company 1,000,000.00 a day; two approvers above 50,000.00; extra code from 25,000.00 (USD equivalent). |

**Home market configuration**: none on screen. Each employee is paid in the currency on the register and the bank account behind it; the fee and the latest start time come from the bank's rail configuration (planned detail in `09-payment-rails.md`). Market A, B, C and D see identical screens.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › Bulk & payroll › Run payroll | none | `pay.create` |
| Overview › + › Run payroll | `{period}` optional (default November 2026) | `pay.create` |

#### 3. Screens

Progress text "Step n of 3 · Payroll run". Back on every step (Cancel on the first).

**Step 1: Pay period and date** (button **Continue**)

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Pay period | select: November 2026, October 2026, September 2026 | yes | not already sent (waiting, sent or paid); not later than this month | "Payroll for this period was already sent." / "Choose this month or an earlier one." |
| Pay date | select of working days, next 25 days | yes | working day | "Choose the pay date." |
| Pay from | select, "Operating ••2001 · $480,000.00" and the other account | yes | a company account | "Choose the account to pay from." |

**Step 2: Employees** (intro "Check each person’s pay."; button **Review**)

- A summary card: **Total** (per currency, joined by "+"; "None" when nobody is in), "{n} employees · from {account}" and, when funds allow, "balance after {amount}". If the debit exceeds the balance the card adds "There isn’t enough money in this account."
- When `varianceCheck` is on and the total differs from last month's by more than 20%: a notice "The total is up {n}% on last month." (or "down") and the required field **Reason for the change** (textarea, max 140, placeholder "For example: bonus month"; message "Add a short reason.").
- A table with columns Employee (name, department, and under it each line "Bonus +{amount}" or "Deduction -{amount}" with **Remove**), Net pay (an editable amount with the currency below it), Pay, Actions. Pay is net pay plus bonuses minus deductions. Actions: **Bonus** (when `allowBonus`), **Deduction** (when `allowDeduction`), **Remove** (takes the person out of the run).
- Row messages: "Enter an amount with up to 2 decimals.", "Pay must be above zero.", "Above the maximum of {1.5 times monthly salary}."
- Adding a line opens a card with the person's name, a choice **Bonus** / **Deduction** (only the allowed ones), **Amount ({currency})** (placeholder "0.00") and buttons **Add** and **Cancel**. Zero or empty shows the toast "Enter an amount above zero".
- **Not in this run** card lists removed people with **Add back**, or the chip "No bank details".
- Empty: "Nobody in this run" / "Add someone back to continue." The step cannot continue with nobody ("Add at least one person.") or with rows marked ("Fix or remove the people marked.").

**Step 3: Review** (busy "Checking limits and funds…", about 0.8 s; button **Submit for approval**). A card with the total and "{n} employees". Rows: Pay period, Pay date, Employees, Pay from, Fees ("None" or amount), **You pay** (in the account's currency), Approvals needed. A switch **Send payslips** (default on; only when `payslips` is on). On continue: limits and funds are checked.

**Code prompt** (always asked). Title "Authorise payroll {period}: {USD total}". Line "Code sent to ••• 4410." plus "This amount needs an extra code." from 25,000.00.

**Result** "Sent for approval", line "Payroll for {period}, {totals}. Nothing has left the account yet.", chip "Waiting for 1 approver" or "Waiting for 2 approvers". Receipt rows: Pay period, Pay date, Employees, Total, You pay, Approvals needed; then the BankWorkx® reference. Buttons **Track payment**, **Done**.

#### 4. States and errors

| Code | Message | Where | Button |
|---|---|---|---|
| `PAYROLL_ALREADY_RUN` | "Payroll for this period was already sent." | step 1 | choose another period |
| `EMPTY_BATCH` | "Add at least one person." | step 2 | add back |
| `NO_VALID_LINES` | "None of the payments can be sent." | review | go back |
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in this account." | step 2, review | change account |
| `LIMIT_USER_EXCEEDED` | "This is above your payment limit." | review | reduce |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company limit." | review | wait |
| `DATE_NOT_WORKING_DAY` | "Choose a working day." | step 1 | change date |
| `TIMEOUT` | "We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice." | banner | check Payments |
| `SERVICE_UNAVAILABLE` | sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." | sheet | Try again / Cancel |

Row codes used by the check (not shown as codes): `ABOVE_SALARY_CAP`, `NOT_AN_EMPLOYEE`, `DUPLICATE_LINE`.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Company, accounts | `corp.company.get` | Existing |
| Employee register with last month's net pay | `corp.payroll.register` | (planned) |
| Check a run | `corp.payroll.check` (`INVALID_PERIOD`, `PAYROLL_ALREADY_RUN`, `EMPTY_BATCH`) | Existing, takes pasted text today |
| Send the run | `corp.payroll.submit` (needs the code; `NO_VALID_LINES`, limits, funds) | Existing |
| Payslip notice to employees | `corp.payroll.payslips` | (planned) |

#### 6. Permissions, step-up and limits

`pay.create`. The code is always asked. Two approvers above 50,000.00 USD equivalent, otherwise one (the earlier rule of two for every run is replaced in the prototype; confirm in open questions). Amounts convert to USD at the bank's rate for the limit checks.

#### 7. Result and links out

The run is recorded as one waiting payment "Payroll {period} · {n} employees" (kind payroll), shown in Payments and the approvers' inbox. Notification (planned): "Payment awaiting your approval". Payslip notice to employees after release (planned, only if the switch was on). Links: Track payment.

#### 8. Acceptance criteria

- AC-1: A period already sent, or in the future, cannot be chosen.
- AC-2: The register is the source; people without bank details are not in the run but can be seen.
- AC-3: Pay is net plus bonus minus deduction; a pay above 1.5 times the monthly salary, zero or invalid is marked and blocks the step.
- AC-4: Bonus and Deduction buttons follow the options; Remove and Add back work.
- AC-5: A total more than 20% from last month asks for a reason when `varianceCheck` is on.
- AC-6: A debit above the balance blocks the step with the message.
- AC-7: A code is always asked; the result is "Sent for approval" and no money moves.
- AC-8: Approvals needed is 2 above 50,000.00 USD equivalent, otherwise 1.
- AC-9: Timeout and unavailable create no run.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | November 2026, next working day, Operating; Review; Submit; code 482100 | 8 employees; total about 30,858 USD equivalent; extra code line; "Sent for approval", 1 approver | AC-2, AC-7, AC-8 |
| T-2 | Same | Choose October 2026 | "Payroll for this period was already sent." | AC-1 |
| T-3 | Same | Set Ali Hamdan net pay to 6000 | "Above the maximum of $5,400.00." | AC-3 |
| T-4 | Same | Add bonus 500 to Sana Malik | Pay 5,300.00; line under the name | AC-3, AC-4 |
| T-5 | `allowBonus` off | Step 2 | No Bonus button | AC-4 |
| T-6 | Same | Remove Hina Rauf, then Add back | Total changes and returns | AC-4 |
| T-7 | Same | Remove Sana Malik, Hina Rauf and Bilal Ahmed | "The total is down {n}% on last month." and the Reason field; empty blocks Review | AC-5 |
| T-8 | Operating balance below the debit | Step 2 | Funds message; Review blocked | AC-6 |
| T-9 | Remove everyone | Step 2 | "Nobody in this run"; "Add at least one person." | AC-2 |
| T-10 | Timeout, then unavailable | Review | Banner; sheet; no run | AC-9 |

#### 10. Expected mutation-check survivors

- The 20% threshold at exactly 20%: survives (no scenario sits on the edge).
- The 1.5 cap at exactly 1.5: survives.
- The 25-day pay date window: survives.
- Payslips switch default: survives, not asserted.

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

**Catalog**: slug `approve-payments`, workspace business, category Approvals, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Permission `pay.approve`, moves money (the last approval releases the payment). Options: **Allow approving several at once** (`batch`, default on), **Ask for a code from 25,000.00** (`stepUp`, default on), **Allow passing a payment to another approver** (`delegation`, default off). Prototype file `design/bankworkx-r1/src/journeys/44-approve-payments.js`. It is a screen in the Approvals tab (`view`, tab `apr`), not a stepped journey.

> Lean. The earlier version had a long filter panel, per-line approval, "ask for changes" and a consent tick; the prototype has a search box, three status buttons, a detail with Approve, Reject and (optionally) Pass to someone, and a History tab.

#### 1. Summary

| | |
|---|---|
| Slug | `approve-payments` |
| Purpose | Review payments colleagues started, then approve or reject them one by one or several at once. An extra code is asked from 25,000.00. |
| Release | 1 |
| Workspace | Business |
| Status | Existing, upgraded (`corp.payments.pending`, `.approve`, `.reject` exist). |
| Channels | web (list beside detail), mobile (list, then detail) |
| Who may use it | `pay.approve`: Alex at Beta (Approver). At Alpha (Maker) the screen shows the no-access card (section 3). |
| Cut-off | 16:00; the sandbox clock is 10:42, so "Cut-off in 5h 18m" shows on payments due today (amber under 90 minutes, red under 30). |

**Home market configuration**: none. Amounts are shown in the company currency with "The payee gets about {amount}" under foreign-currency payments. Account lines show a masked number only.

Seed at Beta (people: Priya Nair and Omar Haddad start payments; Lee Park, Maria Silva, Sam Okafor also approve): `PAY-2041` 8,200.00 Nimbus Logistics, Priya, name matches; `PAY-2039` 64,500.00 Nimbus Logistics, Omar, two approvals, Lee Park approved first, so Alex is next; `PAY-2043` 27,500.00 Rhine Freight GmbH, Priya, close name match; `PAY-2044` 9,800.00 Nimbus Logistics, started by Alex; `PAY-2046` 56,000.00 Rhine Freight GmbH, two approvals; `PAY-2047` 72,000.00 Nimbus Logistics, two approvals, Lee Park must approve first; `PAY-2048` 6,100.00 Gulf Trade FZE, no name match; `PAY-2036` rejected (history); `PAY-2012` paid (history).

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Overview › Approvals queue | none | `pay.approve` |
| Approvals tab | none | `pay.approve` |
| Notification › Payment awaiting your approval | `{paymentId}` (opens that payment) | `pay.approve` (checked after a context switch) |

#### 3. Screen

**Inbox | History** (two buttons, "Inbox ({n})" and "History").

*Inbox.* A search box (placeholder "Search"; matches payee, starter, id, reference and amount), three buttons **All**, **Ready for you**, **Waiting**, and the list. When `batch` is on, a row that can be approved and whose name check matches has a checkbox; with any selected a bar shows "{n} selected", **Clear** and **Approve {n}**.

Each row: "{amount} to {payee}", the starter's name, then chips: "Started by you", "You approved" or "Waiting for others" (when you cannot act), "Needs 2 approvals", and "Cut-off in …" (due today) or "Due {date}".

*Detail* (beside the list on desktop, a full screen with **‹ Back** on mobile): payee and amount, "The payee gets about {amount}" when foreign; rows Account, Purpose, Speed, Reference, Started by; Name check (only when not a match): chip "Close match" or "No match" with a sentence such as "The bank’s record says “Rhine Fracht GmbH”."; Reason (rejected payments). An **Approvals** card lists each signatory with "Approved", "Next", "Waiting" or "Can approve", with "(you)" after your own name, and the cut-off chip. Under it:

- When you can act: buttons **Approve {amount}**, **Reject**, and **Pass to someone** (when `delegation` is on); the line "You’ll be asked for a code." when the amount is 25,000.00 or more and `stepUp` is on.
- When you cannot: one sentence instead of buttons: "You started this payment. Another approver must approve it.", "You approved this payment. Waiting for the next approver.", "Waiting for {name} to approve first.", "Passed to {name}.", or the matching refusal.

*Approve.* If the name check is not a match, a panel shows the chip and the sentence, the tick **I checked the payee details** and buttons **Approve {amount}** and **Cancel**; without the tick: "Confirm that you checked the payee details." From 25,000.00 (and when `stepUp` is on) a code sheet follows: title "Approve {amount}", line "Code sent to ••• 4410." For several at once: title "Approve {n} payments", line "One code covers them all. Sent to ••• 4410." Several at once only include payments you can act on whose name matches.

*Reject.* A panel "Reason" with buttons **Wrong amount**, **Wrong payee**, **Unknown supplier**, **Duplicate**, **Other**. **Other** shows **Note** (3 rows, max 300, at least 10 characters). Buttons **Reject payment** and **Cancel**. Without a reason: "Choose a reason."

*Pass to someone.* A select **Pass to** (Lee Park, Maria Silva, Sam Okafor, without yourself), then **Pass on** and **Cancel**. The person who started it, or someone who already approved, is refused.

*Result screen* (replaces the list; button **Back to approvals**):

| Action | Title | Line | Chip | Receipt |
|---|---|---|---|---|
| Approve, last approval | "Approved" (or "{n} payments approved") | "{amount} to {payee}" | "Sent to the bank" | Payments, Total, Sent to the bank "{x} of {y}" |
| Approve, more needed | "Approved, one more needed" | same | "Waiting for another approver" | same |
| Reject | "Payment rejected" | "{amount} to {payee}. Nothing was sent." | "Rejected" | Payment, Reason, Told {starter} |
| Pass on | "Passed to {name}" | "{name} can now approve this payment." | "Passed on" | Payment, Passed to |

Each result also shows the BankWorkx® reference (prefix APR).

*History.* A table with columns Payment (id and time), Payee (and starter), Amount, Status; tapping a row opens the detail.

*No access (Alpha, Maker).* Card "You don’t have access to the approvals inbox" / "Your role at this company doesn’t include it. The bank checks this on its side too, so hiding the button isn’t the only guard." and, below, "Your requests waiting for approval" with each of your own waiting payments ("{id} · {n} of {need} approved"; tapping opens it in Payments).

#### 4. States and errors

| Code | Message | Where |
|---|---|---|
| `PERMISSION_DENIED` | "You can’t approve payments at this company." | no-access card; refusal |
| `SELF_APPROVAL` | "You started this payment, so another approver must approve it." | detail |
| `ALREADY_APPROVED` | "You already approved this payment." | detail |
| `OUT_OF_SEQUENCE` | "Another approver goes first." | detail |
| `APPROVAL_EXPIRED` | "The cut-off has passed. This payment can’t be approved today." | detail |
| `DELEGATED` | "This payment was passed to another approver." | detail |
| `NOT_PENDING` | "This payment is no longer waiting for approval." | detail |
| `NAME_CHECK_ACK` | "Confirm that you checked the payee details." | confirm panel |
| `REASON_REQUIRED` | "Choose a reason." | reject panel |
| `DELEGATE_CONFLICT` | "That person started this payment. Choose someone else." | pass panel |
| `DELEGATE_ALREADY_APPROVED` | "That person already approved this payment. Choose someone else." | pass panel |
| `STEPUP_FAILED` | "The code didn’t work. Nothing was approved." | code sheet |
| `SERVICE_UNAVAILABLE` | Sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." (screen text: "We couldn’t reach the bank. Nothing was approved. Try again.") | sheet |

Empty states: "All caught up" / "No payments are waiting for approval."; "Nothing found" / "Try another search or status."; "Pick a payment" / "Open one to approve or reject it."; "No history yet" / "Payments you approve or reject are listed here." A timeout on approve (planned in this view) would say "We didn’t get an answer in time. Check Payments before you try again, so you don’t approve twice."

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Waiting payments | `corp.payments.pending` | Existing |
| One payment | `corp.payments.get` | Existing |
| Approve (the last approval releases) | `corp.payments.approve` (needs the code; `SELF_APPROVAL`, `ALREADY_APPROVED`, `PAYMENT_NOT_PENDING`, `INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`) | Existing |
| Reject with a reason | `corp.payments.reject` | Existing |
| Pass to someone | `corp.payments.delegate` | (planned) |
| Name check result on a payee | `corp.payees.nameCheck` | (planned) |
| History | `corp.payments.list` | (planned) |

#### 6. Permissions, step-up and limits

`pay.approve`. Four-eyes: not your own payment, not twice. Sequential payments go in order. The code is asked from 25,000.00 (option). The company limit is counted at release. The audit trail records Approved, Rejected and Passed with the time (3 Nov 10:42).

#### 7. Result and links out

Approve releases the payment at the last approval and sends it to the bank. Reject tells the starter (notification planned: "Your payment was rejected"). Links: the result's **Back to approvals**, Payments tab for the starter's own requests.

#### 8. Acceptance criteria

- AC-1: Only a holder of `pay.approve` sees the inbox; others see the no-access card and their own waiting requests.
- AC-2: A payment you started, or already approved, shows the sentence and no Approve button.
- AC-3: A sequential payment shows "Waiting for {name} to approve first." until that person has approved.
- AC-4: Approving needs a code from 25,000.00 when `stepUp` is on, and none below.
- AC-5: A name check that is not a match needs the tick before approval, and cannot be included in a multiple approval.
- AC-6: A payment needing two approvals shows "Approved, one more needed" after the first.
- AC-7: Reject needs a reason; "Other" needs a note of at least 10 characters.
- AC-8: With `batch` off no checkboxes show; with `delegation` off no Pass to someone button.
- AC-9: After the cut-off no approval is possible.
- AC-10: Unavailable bank: nothing is approved.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Beta | Open `PAY-2041`, Approve | No code (8,200.00); "Approved", "Sent to the bank" | AC-4, AC-6 |
| T-2 | Same | Open `PAY-2039`, Approve, code 482100 | Code asked (64,500.00); two signed; "Sent to the bank" | AC-3, AC-4 |
| T-3 | Same | Open `PAY-2044` | "You started this payment…"; no buttons | AC-2 |
| T-4 | Same | Open `PAY-2047` | "Waiting for Lee Park to approve first." | AC-3 |
| T-5 | Same | Open `PAY-2043`, Approve | Panel with the close-match sentence; without the tick the message | AC-5 |
| T-6 | Same | Tick two matching rows, Approve 2 | One code if any is 25,000.00 or more; "2 payments approved" | AC-4, AC-8 |
| T-7 | Same | Open `PAY-2046`, Approve | "Approved, one more needed" | AC-6 |
| T-8 | Same | Reject `PAY-2048` with no reason, then "Wrong payee" | "Choose a reason."; then "Payment rejected" | AC-7 |
| T-9 | Alex at Alpha | Open Approvals | No-access card and own waiting payments | AC-1 |
| T-10 | Clock after 16:00 (planned) | Open a payment due today | Cut-off message | AC-9 |
| T-11 | Bank unavailable | Approve | Sheet; payment still waiting | AC-10 |
| T-12 | `delegation` on | Pass `PAY-2041` to Lee Park | "Passed to Lee Park" | AC-8 |

#### 10. Expected mutation-check survivors

- The cut-off chip colour thresholds (30 and 90 minutes): survive, only the text is asserted.
- The search fields searched: survives beyond payee name.
- The list of reasons: survives, only two are used.
- Timeout: no behaviour in the prototype (planned).

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
- Screen: Overview › + Pay a supplier. Journey: `supplier-payment`, 12,500.00 USD from Operating to Harbour Packaging (Standard speed, the default), purpose Goods or services, invoice number "INV-1042". Below 25,000.00 USD no code is asked.
- Permission: `biz.payments.initiate`; step-up `otp`; limits: Alex 250,000.00 per day, company 1,000,000.00.
- State after: Alpha `pay_1`: status `pending_approval`, `initiatedBy: "alex"`, `required: 1` (12,500.00 is below the 50,000.00 threshold), `approvals: []`, `valueDate: 2026-11-04`, `afterCutoff: false`; `alpha_ops` balance still 480,000.00 (nothing leaves until released); Alex's `usedToday` 12,500.00.
- Assertion: result screen title is "Sent for approval" with the chip "Waiting for 1 approval" and shows the payment id; `corp.payments.get` returns `pending_approval`; `balance` is 480,000.00; `companyUsedToday` is 0 (the company limit counts at release); the Personal Main balance is not changed by this (still 8,470.76 after the later switch, step 11).

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
- Screen: Approvals › inbox › payment. Journey: `approve-payments` (single). 8,200.00 is below 25,000.00, so no code is asked (from 25,000.00 a code is).
- Permission: `biz.approvals.approve`; step-up none below 25,000.00.
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

