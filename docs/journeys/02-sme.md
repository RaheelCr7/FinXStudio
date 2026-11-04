# Module 2: SME (Business "Graphite") and the combined Alex Morgan demo

**Release 1. Workspace: Business.** Small and medium companies: a Maker starts payments, an Approver approves them, an Admin manages people and limits. The same person can hold different roles in different companies: Alex Morgan is Maker at Alpha Trading LLC and Approver at Beta Services Ltd, with a Personal relationship besides.

**What exists today:** the Meezan-only `CorporateSandbox` (`packages/mock-bank-api/src/corporate.ts`, `docs/CORPORATE.md`) with maker-checker, whitelist, limits, threshold, cut-off, bulk and payroll; Bank B behind the same `corp.*` adapters; five journeys in `packages/journey-schema/src/fixtures/` (`corporate-payments.ts` holds two). **What is planned:** workspaces and contexts, Alpha and Beta, an Admin role, shell screens, `dataTable`, `fileUpload`, `timeline`, `chart`, and the identity and conditions work (README 2.3, 1.5).

**Seed values** used throughout this file (planned, one table so the three parts agree): Alpha Trading LLC and Beta Services Ltd both USD; Alex's daily limit at Alpha 250,000.00; company daily limit 1,000,000.00 at each (bank ceiling 2,000,000.00); two approvers above 50,000.00; step-up amount 25,000.00; batch cap 20 items; file cap 256 KB.

## Journey index

| Group | Journeys |
|---|---|
| Accounts | `business-accounts`, `business-statement` |
| Payments | `supplier-payment`, `add-supplier`, `payment-template`, `templates` (view), `schedule-business-payment`, `business-schedules` (view), `withdraw-payment`, `payment-tracker` (view) |
| Bulk and payroll | `bulk-payment`, `repair-bulk-lines` (alias of `bulk-payment`), `bulk-status`, `payroll-run` |
| Approvals | `approve-payments` |
| Admin | `admin` (view), `manage-user`, `change-limits`, `edit-signatory-group` |
| More | `business-service-request`, `business-requests` (view), `kyb-onboarding` (public, Open a business account) |

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
| Approvals queue | Hidden (no `biz.approvals.approve`) | Shown, with the payments started by `priya` and `omar` waiting for Alex (the sandbox seeds several waiting payments, one of them needing two approvers) |
| My payments waiting | Shown (payments Alex started) | Hidden |
| Admin tab | Shown, but only "You don’t have access" and a preview button (no people, limits or groups) | Same |
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

This group is the **Payments** tab of Business "Graphite" (README 3.3). In the prototype the tab is the button **New supplier payment** and five segments: **Tracker** (view `payment-tracker`), **Templates** (view `templates`), **Scheduled** (view `business-schedules`), **Suppliers** and **Bulk & payroll** (shell screens below). It has five journeys and three views. The views are described in their own blocks after the journeys they belong to. The tab is for people who can see payments. Launch points on it show only to the roles in README section 4.2.

Used throughout (sandbox facts, all grounded in `packages/mock-bank-api/src/corporate.ts` and `docs/CORPORATE.md`):

- A company payment is **started** by a Maker and **approved** by someone else. Starting moves no money. The last approval releases it. Nobody approves what they started (`SELF_APPROVAL`).
- Payment states in the sandbox: `pending_approval`, `released`, `rejected`. A withdrawn payment is stored as `rejected` with the reason "Withdrawn by the person who started it". The screens show five words: **Pending approval**, **Released to bank**, **Settled**, **Rejected**, **Withdrawn** (the sandbox has no settled state yet, planned). Scheduled payments have their own badges in the Scheduled segment: Active, Waiting for approval, Paused.
- Cut-off is 16:00 UTC. Before it, on a working day, the value date is today. After it, on a weekend or on a closed day (9 Nov 2026), the value date is the next working day and `afterCutoff` is true. At exactly 16:00 it is still today.
- Alpha Trading LLC seed in the prototype (`src/js/30-data.js`): company currency USD; Alex Morgan is Maker with a daily limit of 250,000.00 USD; a payment **above 50,000.00 USD** needs two approvers (Dana Cruz, Lee Park), and a code is asked from 25,000.00; accounts Operating ••2001 (USD 480,000.00) and Reserve ••2044 (EUR 95,200.00). Suppliers: Harbour Packaging, Nordic Supplies AB, Whitby Logistics and Gulf Trade FZE, each paid in its own currency (the screens show the currency and the last 4 digits only). Beta has Nimbus Logistics and Rhine Freight GmbH, and Alex is an Approver there. A supplier asked for with `add-supplier` waits for an administrator before it can be paid.
- The acting person comes from the **active context**. The prototype has no "who am I" screen; the sandbox adapters still take a `userId`.

New adapters in this group follow the corporate style: `corp.<domain>.<verb>`. All of them are **(planned)** and read the acting user and company from the active context.

### Shell: Payments tab

| | |
|---|---|
| **Purpose** | One place to start a payment and reach the lists. |
| **Route** | Web `/business/{company}/payments`. Mobile screen `BusinessPaymentsHub` (Payments tab, first screen). |
| **Permission** | `accounts.view` to see the tab. The button needs `pay.create`. |

**Top to bottom (prototype, `payB` in `src/js/80-business.js`).** With `pay.create`: the button **New supplier payment** (`supplier-payment`). Without it a note: "Your role here is {role}. It can’t create payments, so this button isn’t offered. The bank refuses it too." Then the segments **Tracker** (default), **Templates**, **Scheduled**, **Suppliers**, **Bulk & payroll**. The cut-off line ("Today’s payment cut-off is 16:00 UTC") and the recent payments are on the Overview tab, not here.

**Not in the prototype (planned):** the cut-off banner with "Pay now", the action cards (upload a file, run payroll, schedule, use a template, add a supplier), the "Your limit today" bar and the "Needs your attention" list. The buttons for those actions sit inside the segments instead. **Launch points on it**: README 5.3 rows "Payments › hub".

### Shell: Payment detail (with status timeline)

> Prototype: the detail is the right-hand pane of the Tracker (see `payment-tracker`: id, status chip, amount, supplier, reference, a four-step timeline, Withdraw, View receipt). The Approvals tab shows the same card with its own Withdraw button and a demo approve button. The fuller screen below is planned.

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

### Shell: Suppliers

> Prototype: the **Suppliers** segment is a plain list inside the Payments tab: one row per supplier (name, region and masked account) with a chip "Whitelisted", and the button **Add supplier** (`add-supplier`, with `pay.create`). Columns, filters, sort, Pay and Edit below are planned, and the chip should show "Waiting for approval" for a supplier asked for with `add-supplier` (today it shows "Whitelisted").

| | |
|---|---|
| **Purpose** | The company's approved list of suppliers (the "whitelist"). Only these can be paid. |
| **Route** | Web `/business/{company}/payments/suppliers`. Mobile `PaymentSuppliers`. |
| **Data source** | Today: the `beneficiaries` map inside `corp.company.get` (existing, only approved suppliers). Upgrade: `corp.suppliers.list` (planned). Request `{ status? }`. Response `{ items: Supplier[] }`, `Supplier` is `{ id, name, kind, country, currency, bank, maskedNumber, status, addedBy, addedAt }` with `status` one of `approved`, `waiting_approval`, `disabled`. Error codes as the Templates list. `moneyMoving: false`, `requiresOtp: false`. Permission `biz.suppliers.manage` to edit; `biz.accounts.view` to read. |

**Columns**: Name, Type (Domestic or International), Country, Currency, Account (masked, "••3301"), Status chip (Approved green, Waiting for approval amber, Disabled grey), Added by, Added. **Filters**: Status chips, Type, Search. **Sort**: Name, A to Z. **Row buttons**: Pay (opens `supplier-payment` with `{supplierId}`; hidden unless approved), Edit (opens `add-supplier` with `{supplierId}`). **Top button**: "Add a supplier" (opens `add-supplier`).
**States.** Empty: "No suppliers yet. Add one before you can pay them." Button "Add a supplier". Loading: skeleton rows. Error: "We couldn't load your suppliers. Nothing was changed." Button "Try again".
**Launch points on it.** README 5.3 row "Payments › suppliers" (Add, Edit).

### Shell: Bulk and payroll history

> Prototype: the **Bulk & payroll** segment shows a card "Upload a payment file" ("CSV or XML. Each line is checked before anything is sent.") with the buttons Upload or enter payments, Run payroll, View batches (`bulk-status`) and Reports, then a short History card (October payroll, Supplier batch 18). The table below is planned.

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

**Catalog**: slug `add-supplier`, workspace business, category Payments, core no, a bank can switch it off (yes). Options (all on by default): `allowAbroad` "Allow suppliers with a bank in another country"; `nameCheck` "Run the name check where the market has one"; `newCap` "Cap payments to a supplier in its first 24 hours"; `allowPerson` "Allow a supplier who is a person". Permission `pay.create`; moves no money, but asks for the code. Prototype file `design/bankworkx-r1/src/journeys/70-add-supplier.js`: a normal engine journey (`JR.define`, four steps, the address step only for a bank in another country). It reuses the payee form, the checks and the name check of Send money (`personal-transfer`, `32-personal-transfer.js`).

> The screens never name a country or a payment scheme. What changes with the bank's home market is only the bank-detail fields and the checks (section 1, Home market configuration). A supplier is asked for here, not added: an administrator approves it first.

#### 1. Summary

| | |
|---|---|
| Slug | `add-supplier` |
| Purpose | A Maker asks to add a supplier to the company's list. An administrator approves the request before the supplier can be paid. |
| Release | 1 |
| Workspace | Business (planned field `workspace: "business"`) |
| Status | Built in the prototype. No company-supplier adapter exists in the sandbox yet (section 5). |
| Channels | web, mobile |
| Who may use it | The context holds `pay.create`. At Alpha Trading LLC: Alex Morgan (Maker). Not offered to Approvers (Alex at Beta): the buttons are hidden. |
| Seed | Alpha suppliers: Harbour Packaging, Nordic Supplies AB, Whitby Logistics, Gulf Trade FZE. Sample values in the Autofill: supplier name "Brightline Packaging", address "12 Harbour Road", "Springfield", "10001". |

**Home market configuration** (the fields come from the bank's home market; abroad, from the country the Maker picks):

| Market | Bank details asked | Checks | Name check | Saved account shown as |
|---|---|---|---|---|
| Market A (routing number and account) | Routing number (9 digits), Account number (4 to 17 digits), Account type: Checking or Savings | routing number check digit | none | "{routing number} · ••{last 4}" |
| Market B (sort code and account) | Sort code (like 20-00-00), Account number (8 digits), Account type: Personal or Business | six digits, eight digits | yes, also catches a wrong account type | "{sort code} · ••{last 4}" |
| Market C (IBAN) | IBAN | IBAN check, and the IBAN must be inside the payment area | yes | "DE89 •••• 3000" (first 4, last 4) |
| Market D (IBAN, mobile alias) | IBAN | IBAN check, and the IBAN must be a home-market one | yes | first 4, last 4 |

A bank in another country asks for: Country, then IBAN (countries that use one) or Account number, a Bank code (only for countries that have one; its label, hint and rule come from the country) and SWIFT / BIC code. It is shown as "{BIC} · ••{last 4}". The countries listed leave out the home country.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › Suppliers › Add supplier | none | `pay.create` |
| Pay a supplier › Choose supplier › Request a new supplier (`supplier-payment`) | none | `pay.create` |
| Payment template › Choose supplier, empty list › Add a supplier (`payment-template`) | none | `pay.create` |

No parameters. Editing a supplier is not in the prototype (planned).

#### 3. Screens

Progress text "Step n of 4 · Add a supplier" (n of 3 for a bank in the same country). Each screen has **Back** (the first has **Cancel**). A step that calls the bank shows a spinner and the busy text.

**Step 1: New supplier**. Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Supplier name | text, max 70 | yes | 2 or more characters; letters, digits, space and `. , ' ’ & ( ) / -` | "Enter the supplier’s name." / "Use letters, numbers and spaces in the name." |
| Type | chips Company, Person (shown when `allowPerson` is on) | no | default Company | none |
| Their bank is | chips "In the same country", "In another country" (shown when `allowAbroad` is on) | no | default same country; changing it clears the bank fields | none |

On Continue the journey refuses a name that is already on the list (any case) and a tenth waiting request (section 4).

**Step 2: Bank details**. Busy text "Checking the details…" (about 0.6 s). Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Country | select, placeholder "Choose a country" (other country only) | yes | one of the list | field required |
| Name on the account | text, max 70; starts as the supplier name | yes | as the supplier name | "Enter the name on the account." |
| Routing number (Market A) | text, max 9, hint "9 digits" | yes | 9 digits, check digit | "That routing number isn’t valid. Check the 9 digits." |
| Account number (Market A) | text, max 17 | yes | 4 to 17 digits | "An account number has 4 to 17 digits." |
| Account type (Market A) | chips Checking, Savings | no | default Checking | none |
| Sort code (Market B) | text, max 8, hint "20-00-00" | yes | 6 digits, dashes optional | "A sort code has 6 digits, like 20-00-00." |
| Account number (Market B) | text, max 8, hint "8 digits" | yes | 8 digits | "An account number has 8 digits." |
| Account type (Market B) | chips Personal, Business | no | default Business, or Personal when Type is Person | none |
| IBAN (Markets C and D; and a country that uses one) | text, max 42 | yes | valid IBAN of the right length; Market C inside the payment area, Market D a home-market IBAN; abroad it must start with the chosen country | "That IBAN doesn’t look right. Check each character." / "That IBAN can’t be used for this payment." |
| Account number (other country, no IBAN) | text, max 34 | yes | 6 to 34 letters, digits, space or dash (one country needs 18 digits) | "That account number looks too short or too long." / "An account number has 18 digits." |
| Bank code (some countries) | text, max 14; label, hint and rule per country | yes | the country's pattern | the country's message |
| SWIFT / BIC code (other country) | text, max 11, hint "8 or 11 characters" | yes | 4 letters, 2 letter country, 2 characters, optional 3 | "A SWIFT/BIC has 8 or 11 letters and numbers." / "That bank code doesn’t match the country." |

Name check box (same-country bank, in markets that have a name check, when `nameCheck` is on, once the identifier is valid and the name has 2 or more characters). It updates as the Maker types.

| Result | Box | Extra |
|---|---|---|
| Match | "The name matches" | none |
| Close | "The name is close", "The account holder is {registered name}." | button **Use “{registered name}”** fills the name; tick **Add anyway** to continue |
| Wrong type (Market B) | "Wrong type of account", "This is a {personal or business} account." | button **Switch to {type}**; or **Add anyway** |
| No match | "The name doesn’t match", "The account is held by someone else." | tick **Add anyway** |
| Not known | no box | none |

Continue stays blocked with "Confirm to continue." until **Add anyway** is ticked for a close, wrong-type or no-match result. The step then refuses an account already on the list (section 4).

**Step 3: Supplier address** (other country only). Button **Review**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Street and number | text, max 70 | yes | letters, digits, space and `. , ' ’ # & ( ) / -` | "Enter the supplier’s street and number." / "Use letters, numbers and spaces." |
| Town or city | text, max 35 (half width) | yes | as above | field required |
| Postcode | text, max 16 (half width) | no | as above | "Use letters, numbers and spaces." |

**Step 4: Review**. Button **Send for approval**.

| Row | Value |
|---|---|
| Supplier | name |
| Type | Company or Person (when `allowPerson` is on) |
| Account name | only when it differs from the supplier name |
| Country | other country only |
| Account | masked, as in section 1 |
| Address | street, town, postcode (other country only) |
| Approval | "An administrator" |
| First 24 hours | "Up to $5,000.00 a payment" (only when `newCap` is on) |

**Code prompt** (always asked, a keypad sheet). Title "Authorise adding {supplier} as a supplier". Line "Code sent to ••• 4410." The sandbox code is 482100.

**Result** "Sent for approval", line "{supplier} can be paid once an administrator approves it.", amber chip "Waiting for an administrator". Receipt rows: Supplier, Account, Country (other country only), Approval, First 24 hours (when on); then the BankWorkx® reference. Buttons **View suppliers** (Payments › Suppliers), **Add another supplier**.

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `SUPPLIER_NAME_EXISTS` | "You already have a supplier with this name." | step 1 banner | change the name |
| `TOO_MANY_PENDING` | "You have 10 suppliers waiting for approval. Wait for an answer before you add more." | step 1 banner | Cancel |
| `SUPPLIER_EXISTS` | "You already have a supplier with these bank details." | step 2 banner | change the details |
| `ADDRESS_REQUIRED` | "We need the supplier’s address for a bank in another country." | defined; the address fields are required, so the form stops it first | fix |
| `STEP_UP_FAILED` | "We couldn’t confirm this request. Nothing was sent. Start again." | code sheet | start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Suppliers before you try again, so you don’t add it twice." | banner on step 2 | check Suppliers |
| `SERVICE_UNAVAILABLE` | Sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." (the app's shared sheet) | sheet on step 2 | Try again / Cancel |

Loading: the spinner on step 2 (about 0.6 s). The check on the account runs only on that step, so a timeout or an unavailable bank shows there; after the code the request is saved at once. Empty: none. The 24-hour cap shows on the review and the receipt only; paying is not stopped by it yet (planned, section 7).

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Check the account details (routing number, sort code, IBAN, SWIFT / BIC, no second copy) | `bank.payees.validate` | Existing, `packages/mock-bank-api/src/payees.ts` (the prototype checks in the page) |
| Name check | `bank.payees.check` (returns match, close, none or na; errors `TIMEOUT`, `SERVICE_UNAVAILABLE`) | Existing |
| Ask for the supplier, list requests | `corp.suppliers.request`, `corp.suppliers.list` | (planned) |
| Approve or reject a request | `corp.suppliers.approve`, `corp.suppliers.reject` (administrator) | (planned) |
| Company list used by Pay a supplier | `corp.company.get` (fixed list `CorporateSandbox.whitelist`, error `BENEFICIARY_NOT_WHITELISTED`) | Existing, `packages/mock-bank-api/src/corporate.ts` |

#### 6. Permissions, step-up and limits

`pay.create`. A code is always asked. At most 10 requests wait at once. A person never approves a supplier they asked for (administrator action, planned). The request is stored with the status "waiting", the asker and an audit line "Asked to add supplier {name}".

#### 7. Result and links out

The supplier is added to the company list marked waiting, with age 0 hours. Notification (planned): "A supplier is waiting for your approval" to the administrator. Links: View suppliers, Add another supplier. The administrator's approve and reject (`ASUP.approve`, `ASUP.reject` in the file) are not wired to the Admin tab yet (planned). When approved the supplier can be chosen in Pay a supplier, Payment templates and Schedule a supplier payment; a waiting one is refused there with `SUPPLIER_NOT_APPROVED`. Under 24 hours old, a payment to it is capped at 5,000.00 when `newCap` is on (cap enforcement in Pay a supplier is planned).

#### 8. Acceptance criteria

- AC-1: Only a Maker with `pay.create` can start it.
- AC-2: The bank-detail fields and checks follow the bank's home market; a bank in another country asks for country, account, SWIFT / BIC and an address.
- AC-3: A name already on the list, an account already on the list and a tenth waiting request are refused with the messages of section 4.
- AC-4: Where the market has a name check, a close, wrong-type or no-match result needs **Add anyway** before Continue.
- AC-5: A code is always asked, naming the supplier.
- AC-6: The result is "Sent for approval" with a waiting chip; the supplier cannot be paid yet.
- AC-7: A timeout shows the check-Suppliers message and an unavailable bank shows the sheet; nothing is saved.
- AC-8: Each of the four options hides what it names (type, other country, name check, 24-hour line).

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha, Market A | Name "Brightline Packaging", same country, routing number and account from Autofill; send with code 482100 | Review shows Account "{routing} · ••{last 4}", Approval "An administrator"; "Sent for approval" | AC-2, AC-5, AC-6 |
| T-2 | Alex at Alpha, Market B | Sort code and account of a registered holder, name slightly different | "The name is close"; Continue blocked until Use or Add anyway | AC-4 |
| T-3 | Alex at Alpha | Another country: country, IBAN, SWIFT / BIC, address | Address step shown; review has Country and Address | AC-2 |
| T-4 | Alex at Alpha | Name "harbour packaging" | "You already have a supplier with this name." | AC-3 |
| T-5 | Alex at Alpha | Bank details of Harbour Packaging | "You already have a supplier with these bank details." | AC-3 |
| T-6 | Alex at Alpha, 10 requests waiting (test seed) | Step 1 Continue | "You have 10 suppliers waiting for approval. Wait for an answer before you add more." | AC-3 |
| T-7 | Alex at Alpha, wrong code three times | Code sheet | "We couldn’t confirm this request. Nothing was sent. Start again."; no supplier | AC-5 |
| T-8 | Timeout on the bank step | Continue | Banner "Check Suppliers before you try again, so you don’t add it twice."; nothing saved | AC-7 |
| T-9 | Bank unavailable | Continue | Sheet "We couldn’t reach the bank"; nothing saved | AC-7 |
| T-10 | Alex at Beta | Open Payments › Suppliers | No Add supplier button | AC-1 |
| T-11 | Options off | Switch off `allowPerson`, `allowAbroad`, `nameCheck`, `newCap` | No Type chips, no "Their bank is", no name box, no "First 24 hours" row | AC-8 |

#### 10. Expected mutation-check survivors

- Changing the limit of 10 waiting requests to 11: survives, T-6 uses the test seed at exactly 10 (an edge at 9 is planned).
- Changing the 5,000.00 cap: survives, the cap is shown only and no scenario reads the number.
- Removing a character from the name pattern: survives, no scenario types it.
- Dropping the registry lookup for one market: survives, only T-2 exercises the name check.

---

### ★ Payment templates — `payment-template`

**Catalog**: slug `payment-template`, workspace business, category Payments, core no, a bank can switch it off (yes). Options: `amountOptional` "Allow a template without an amount" (on by default; the prototype does not read it yet, a template can always be saved without an amount). Permission `pay.create`; moves no money, no code. Prototype file `design/bankworkx-r1/src/journeys/71-templates-schedule.js`: a normal engine journey with three modes (`create`, `use`, `delete`). The list of templates is the view `templates` (next block).

> The screens never name a country or a payment scheme. Money is shown in the supplier's own currency.

#### 1. Summary

| | |
|---|---|
| Slug | `payment-template` |
| Purpose | A Maker saves a payment made often (supplier, amount, reference, purpose), starts it again in two taps, or deletes a template. A template holds no money and no approval. |
| Release | 1 |
| Workspace | Business (planned field `workspace: "business"`) |
| Status | Built in the prototype. No template adapter exists in the sandbox yet (section 5). |
| Channels | web, mobile |
| Who may use it | The context holds `pay.create`. At Alpha Trading LLC: Alex Morgan (Maker). Not offered to Approvers (Alex at Beta). |
| Seed | Two templates at Alpha: "Monthly packaging" (Harbour Packaging, $4,500.00, PO-STANDING, Goods) and "Quarterly freight" (Whitby Logistics, no amount, FREIGHT-Q, Services). Templates are shared by the company's Makers. At most 20 per company. |

**Home market configuration**: none. The supplier's saved currency decides the symbol.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › Templates › Save a template | `{mode: create}` | `pay.create` |
| Payments › Templates › row › Use | none (starts Pay a supplier at once) | `pay.create` |
| Payments › Templates › row › Delete | `{mode: delete, templateId}` | `pay.create` |
| Payment receipt › Save as template | (planned) | `pay.create` |

Parameters: `{mode}` is `create`, `use` or `delete`; `{templateId}` selects the template (with a template and no mode the mode is `use`); `{supplierId}`, `{amount}`, `{ref}`, `{why}`, `{name}` pre-fill a new template. The **Use** button of the list does not open this journey; it calls the same hand-over (section 7) directly. The journey's `use` mode is for a deep link.

#### 3. Screens

Progress text "Step n of N · Payment templates", N counting the screens of the mode. Each screen has **Back** (the first has **Cancel**).

**Mode create**

**Step 1: Choose supplier**. Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Supplier | cards: name, then "{currency} · ••{last 4}" | yes | one of the approved suppliers (a waiting one is not listed) | "Choose a supplier." |

Empty list: "No suppliers yet" / "Add a supplier first." with the button **Add a supplier** (opens `add-supplier`).

**Step 2: Template details**. Button **Review**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Template name | text, max 30 | yes | not the name of another template (any case) | "Name the template." / "You already have a template with this name." |
| Amount | amount with the supplier's symbol, hint "Leave empty to enter it each time", placeholder "0.00" | no | not above 250,000.00 | "That is over your limit of $250,000.00 a payment." |
| Reference | text, hint "Invoice or PO number", max 35 | no | letters, digits, space and `. , ' - / ( ) + : #` | "Use letters, numbers and spaces only." |
| Purpose | select, placeholder "Choose a purpose": Goods, Services, Rent, Utilities, Taxes and duties, Other | no | one of the list | none |

**Step 3: Review**. Busy text "Saving…" (about 0.4 s). Button **Save template**. Rows: Name, Supplier, Amount (or "Each time"), Reference (if set), Purpose (if set).

**Result** "Template saved", line "{name} for {supplier}.", green chip "Saved". Rows: Name, Supplier, Amount (or "Amount each time"), Reference, Purpose. Buttons **Use it now**, **Back to templates**.

**Mode use** (one screen, then a result)

**Use template**. Busy text "Checking…" (about 0.4 s). A card shows the template name and supplier, then rows Amount ("Amount each time" when none), Reference, Purpose. Button **Continue to payment**. Result "Ready to pay", line "{name}", green chip "Ready", rows Supplier, Amount; button **Continue to payment** (opens `supplier-payment`).

**Mode delete** (one screen, then a result)

**Delete this template?** Same card. Button **Delete template**. Result "Template deleted", line "{name} is gone. Payments already sent are not affected.", chip "Deleted", row Template; button **Back to templates**.

If the template cannot be found the card says "Template not found" / "It may have been deleted."

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `TEMPLATE_NOT_FOUND` | "We can’t find that template." | use or delete screen banner | Back |
| `TEMPLATE_NAME_EXISTS` | "You already have a template with this name." | field message, step 2 | change the name |
| `TEMPLATE_LIMIT` | "You can have up to 20 templates. Delete one to add another." | review banner | Delete one in Templates |
| `SUPPLIER_NOT_APPROVED` | "That supplier isn’t on your list or is waiting for approval." | review or use banner | choose another |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was changed." | banner | Try again |
| `SERVICE_UNAVAILABLE` | Sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." | sheet | Try again / Cancel |

Loading: the busy text above. Empty: only the supplier step has an empty state. Using a template whose supplier was removed or is waiting shows a short message in the page, "That supplier isn’t on your list any more." or "That supplier is waiting for approval."

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Save, list and delete templates | `corp.templates.save`, `corp.templates.list`, `corp.templates.delete` | (planned) |
| Approved suppliers | `corp.company.get` | Existing, `packages/mock-bank-api/src/corporate.ts` |
| Start the payment | `supplier-payment` (`corp.payments.initiate`) | Existing |

#### 6. Permissions, step-up and limits

`pay.create`. No code (saving a template moves nothing; the payment it starts asks for its own approval and code). 20 templates per company.

#### 7. Result and links out

The template is stored for the company, with the person who saved it. **Use** opens `supplier-payment` with `{supplierId, amount, templateId}`; the amount is empty for an "Amount each time" template. Reference and purpose are saved but not carried into the payment yet (planned). Links: Use it now, Back to templates (Payments › Templates).

#### 8. Acceptance criteria

- AC-1: Only a Maker with `pay.create` can create, use or delete a template.
- AC-2: A template needs an approved supplier and a name; the amount, reference and purpose are optional.
- AC-3: A second template with the same name (any case) is refused; a 21st template is refused.
- AC-4: A template without an amount shows "Amount each time" and the payment asks for the amount.
- AC-5: Use opens Pay a supplier with the supplier and amount filled in.
- AC-6: Delete asks first and does not touch payments already sent.
- AC-7: A template whose supplier is not approved cannot be used.
- AC-8: A timeout changes nothing; an unavailable bank shows the sheet and changes nothing.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Save a template: Harbour Packaging, "Weekly supplies", 1,200.00, PO-STANDING, Goods | "Template saved"; the list shows it with "$1,200.00" | AC-2 |
| T-2 | Alex at Alpha | Save with no amount | List shows "Amount each time" | AC-2, AC-4 |
| T-3 | Alex at Alpha | Name "monthly packaging" | "You already have a template with this name." | AC-3 |
| T-4 | Alex at Alpha, 20 templates (test seed) | Review, Save | "You can have up to 20 templates. Delete one to add another." | AC-3 |
| T-5 | Alex at Alpha | Use "Monthly packaging" | Pay a supplier opens at step 2 with Harbour Packaging and 4,500.00 | AC-5 |
| T-6 | Alex at Alpha | Delete "Quarterly freight" | "Template deleted"; the list no longer shows it | AC-6 |
| T-7 | Alex at Alpha, supplier waiting (test seed) | Open the list | Chip "Waiting for approval" instead of Use | AC-7 |
| T-8 | Alex at Beta | Open Payments › Templates | No Save a template, Use or Delete | AC-1 |
| T-9 | Timeout on Save | Review | Banner "Nothing was changed."; list unchanged | AC-8 |
| T-10 | Bank unavailable | Review | Sheet "We couldn’t reach the bank"; list unchanged | AC-8 |

#### 10. Expected mutation-check survivors

- Changing the limit of 20 templates to 21: survives, T-4 uses a seed at exactly 20 (an edge at 19 is planned).
- Changing the 250,000.00 amount limit by one cent: survives, no scenario types it.
- Removing "#" from the reference pattern: survives, no scenario types it.
- Dropping reference and purpose from the saved template: survives, only the name, supplier and amount are asserted.

---

### ★ Templates list — `templates`

**Catalog**: slug `templates`, workspace business, category Payments, core no, a bank can switch it off (yes). A view, not a journey: the **Templates** tab of Payments. Options: none. Permission `accounts.view` to see it; the buttons need `pay.create`. Prototype file `design/bankworkx-r1/src/journeys/71-templates-schedule.js` (`JR.define` with `view: true, tab: 'pay'`).

#### 1. Summary

| | |
|---|---|
| Slug | `templates` |
| Purpose | Show the company's saved payments with Use and Delete, and a way to save a new one. |
| Release | 1 |
| Workspace | Business |
| Status | Built in the prototype. |
| Who may see it | Anyone who can see Payments (`accounts.view`). The buttons show only with `pay.create`. |
| Route | Web `/business/{company}/payments/templates` (planned). Mobile screen `PaymentTemplates` (planned). In the prototype it is the Templates segment of the Payments tab. |

**Home market configuration**: none.

#### 2. Entry points and parameters

Payments › Templates segment. No parameters. Launch points on it: **Save a template** (`payment-template`, create), **Use** (`supplier-payment`), **Delete** (`payment-template`, delete).

#### 3. Screen

From top to bottom:

1. Button **Save a template** (only with `pay.create`).
2. One card of rows, in the order saved. Each row: bill icon, template name, then "{supplier} · {amount}" where the amount is the saved amount in the supplier's currency or "Amount each time", or "Supplier removed" in place of the supplier. At the end of the row, with `pay.create`: **Use** (a small button) and **Delete**. When the supplier is waiting for approval the Use button is replaced by an amber chip "Waiting for approval"; when the supplier is gone, by a grey chip "Unavailable". A row itself is not a link.

Sort: the order saved. No filters or search (planned: Name, Last used).

Empty (no templates): "No templates yet" / "Save a payment you make often." (the **Save a template** button stays above). Loading and error states are not in the prototype (planned: skeleton rows; "We couldn’t load your templates. Nothing was changed." with **Try again**).

#### 4. Actions and drill-downs

- **Use**: opens `supplier-payment` with the supplier and amount; refused with a short message when the supplier is gone or waiting (see `payment-template`).
- **Delete**: opens `payment-template` in delete mode.
- **Save a template**: opens `payment-template` in create mode.
- After saving or deleting, the receipt button **Back to templates** returns to this view.

#### 5. Adapters

`corp.templates.list` (planned); suppliers from `corp.company.get` (existing).

#### 6. Acceptance criteria

- AC-1: The list shows the company's templates with the supplier and the amount or "Amount each time".
- AC-2: Use and Delete show only with `pay.create`; an Approver sees the list without buttons.
- AC-3: A template whose supplier is waiting shows "Waiting for approval" and no Use button.
- AC-4: With no templates the empty state shows.

#### 7. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Open Templates | Two rows: "Monthly packaging", "Harbour Packaging · $4,500.00"; "Quarterly freight", "Whitby Logistics · Amount each time" | AC-1 |
| T-2 | Alex at Beta | Open Templates | Empty state "No templates yet" and no Save a template button (Beta has no templates in the seed) | AC-2, AC-4 |
| T-3 | Alex at Alpha, supplier waiting (test seed) | Open Templates | Chip "Waiting for approval", no Use | AC-3 |

#### 8. Expected mutation-check survivors

- Changing the order of the rows: survives, the order is not asserted.
- Changing the chip colour: survives, only the text is asserted.

---

### ★ Schedule a supplier payment — `schedule-business-payment`

**Catalog**: slug `schedule-business-payment`, workspace business, category Payments, core no, a bank can switch it off (yes). Options: `allowQuarterly` "Offer “Every 3 months”" (on); `reminder` "Tell the Maker the day before each payment" (on; the prototype shows no reminder yet, planned); `strictCutoff` "Close changes at 09:00 the business day before (default 18:00)" (off). Permission `pay.create`; flagged as money (a timeout or an unavailable bank is treated like a payment) though no money moves at scheduling. Prototype file `design/bankworkx-r1/src/journeys/71-templates-schedule.js`: a normal engine journey with three modes (`new`, `edit`, `cancel`). It uses the supplier and speed rules of `supplier-payment` (`36-supplier-payment.js`) and the date helpers of `schedule-payment`. The list is the view `business-schedules` (next block).

> The screens never name a country or a payment scheme. A scheduled payment always goes at the Standard speed; the bank's rail configuration decides fee, limit and arrival text (`09-payment-rails.md`).

#### 1. Summary

| | |
|---|---|
| Slug | `schedule-business-payment` |
| Purpose | A Maker schedules a payment to a saved supplier once, weekly, monthly or every 3 months. Approvers approve it once before the first payment. Before each payment the bank checks again: balance, limits, and that the supplier is still approved. |
| Release | 1 |
| Workspace | Business (planned field `workspace: "business"`) |
| Status | The screens are built in the prototype. The run engine (a payment starting on its date) and the approval of a schedule by approvers are not (planned). |
| Channels | web, mobile |
| Who may use it | The context holds `pay.create`. At Alpha Trading LLC: Alex Morgan (Maker). Not offered to Approvers (Alex at Beta). |
| Seed | Alpha: BSC-3001 Harbour Packaging $4,500.00 monthly, next Tue 1 Dec, active, 3 payments made, last "Paid 3 Nov"; BSC-3002 Whitby Logistics £12,000.00 every 3 months, starts Mon 4 Jan 2027, ends after 8 payments, "0 of 1 approved". Person limit 250,000.00 a payment, two approvers above 50,000.00, code from 25,000.00 (USD equivalent). Today in the prototype is Tue 3 Nov 2026, 10:42. |

**Home market configuration**: none. The currency comes from the supplier's saved region. Working days are Monday to Friday.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › Scheduled › Schedule a payment | none (mode new) | `pay.create` |
| Payments › Scheduled › row › Change | `{scheduleId, mode: edit}` | `pay.create` |
| Payments › Scheduled › row › Cancel | `{scheduleId, mode: cancel}` | `pay.create` |
| Pay a supplier › Pay date › Repeat | (planned) | `pay.create` |

Parameters: `{supplierId}` (supplier chosen, step 1 skipped), `{amount}` (pre-fills the amount), `{scheduleId}` with `{mode}` `edit` or `cancel`.

#### 3. Screens

Progress text "Step n of N · Schedule a supplier payment", N counting the screens of the mode. Each screen has **Back** (the first has **Cancel**).

**Mode new**

**Step 1: Choose supplier** (skipped when a supplier was passed). Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Supplier | cards: name, then "{currency} · ••{last 4}" | yes | one of the approved suppliers | "Choose a supplier." |

**Step 2: Amount and reference**. A card shows the supplier and "{currency} · ••{last 4}". Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Amount | amount with the supplier's symbol, placeholder "0.00"; label "Amount (EUR)" when the supplier is paid in another currency | yes | greater than 0; fits the Standard limit; USD equivalent within 250,000.00 | "That is over the limit for this payment. Try a smaller amount." / "That is over your limit of $250,000.00 a payment." |
| Reference | text, hint "Invoice or PO number", max 35 | yes | letters, digits, space and `. , ' - / ( ) + : #` | "Use letters, numbers and spaces only." |
| Purpose | select, placeholder "Choose a purpose": Goods, Services, Rent, Utilities, Taxes and duties, Other | yes | one of the list | field required |

**Step 3: How often**. Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| (frequency) | chips Once, Weekly, Monthly, Every 3 months (the last when `allowQuarterly` is on) | no | default Monthly; Once clears the end | none |
| Start date (label "Date" for Once) | select of working days from tomorrow, placeholder "Choose a date" | yes | after today; within 12 months; a weekday | "Choose a date from tomorrow." / "Choose a date within 12 months." / "Choose a weekday." |
| Ends (not for Once) | cards Never, On a date, After a number of payments | no | default Never | none |
| Last payment on | select of the run dates after the first (On a date only) | yes | after the start; one of the list | "Choose the last payment." / "Choose an end date after the start." / "Choose a date from the list." |
| Number of payments | number, placeholder "For example 12", hint "From 2 to {max}." (After a number only) | yes | whole number from 2 to 104 (weekly), 60 (monthly), 40 (every 3 months) | "Enter how many payments." / "Enter a number from 2 to {max}." |

A monthly payment keeps its day of the month (the last day of a short month); a date on a weekend moves to the next working day.

**Step 4: Review**. Busy text "Checking…" (about 0.6 s). Button **Send for approval**.

| Row | Value |
|---|---|
| Supplier | name |
| Amount | in the supplier's currency |
| Reference, Purpose | as entered |
| How often | Once, Weekly, Monthly, Every 3 months |
| Date (Once) or Starts | like "Tue 1 Dec 2026" |
| Ends | Never, a date, or "{n} payments" (not for Once) |
| Next dates | the next three, like "Tue 1 Dec · Wed 6 Jan · Mon 1 Feb" (not for Once) |
| Approval | "Needs 1 approval before the first payment" or "Needs 2 approvals before the first payment" |
| Before each payment | "Balance, limit and supplier are checked" |

**Code prompt** (only when the USD equivalent is 25,000.00 or more). Title "Authorise {amount} to {supplier}, {how often in lower case}". Line "Code sent to ••• 4410." The sandbox code is 482100.

**Result** "Sent for approval", line "{amount} to {supplier}, {how often}, from {Tue 1 Dec}.", amber chip "Waiting for 1 approval" or "Waiting for 2 approvals". Receipt rows: Supplier, Amount, How often, Date or Starts, Ends, Approval; then the BankWorkx® reference. Buttons **View scheduled**, **Schedule another**.

**Mode edit** (Change)

Step 1 **Change payment**: a card with the payment (supplier, reference, status chip, Amount, How often, Next payment, Ends). Busy text "Getting your payment…" (about 0.45 s). Button **Continue**. Then the Amount and reference screen (supplier fixed, filled in), **Next payment** (the date, and Ends; the frequency cannot change), Review and, from 25,000.00 USD, the code. Result **Change sent for approval**, line "The payment to {supplier} waits until it is approved.", amber chip "Waiting for {n} approval(s)". The payment goes back to waiting; earlier approvals are cleared. Button **View scheduled**.

**Mode cancel**

One screen **Cancel this payment?** with the card. Busy text "Cancelling…" (about 0.45 s). Button **Cancel payment**. No code. Result **Payment cancelled**, line "No more payments will go to {supplier}.", green chip "Cancelled". Rows Supplier, Amount, How often, Cancelled on ("3 Nov 2026"). Buttons **Back to scheduled**, **Schedule a payment**.

**Cut-off for changes.** Change and Cancel are refused once the next payment is due today or earlier, and from 18:00 on the business day before it (from 09:00 when `strictCutoff` is on). The screen where it fails is the first one for Change and the only one for Cancel, and again at Review.

**Checked again before every payment** (`BSCH.check`, shown on the list, the run itself is planned): "The supplier is no longer on your list." / "The amount is over the limit for this payment." / "The amount is over the daily limit." / "There isn’t enough money in the account." A failed run starts nothing and tells the Maker.

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `SCHEDULE_NOT_FOUND` | "We can’t find that payment." | first screen banner | Back |
| `SCHEDULE_NOT_ACTIVE` | "This payment has already ended or been cancelled." | first screen banner | Back |
| `SCHEDULE_RUNNING` | "This payment is being processed. Try again later." | first screen banner | Back |
| `SCHEDULE_CUTOFF_PASSED` | "This payment can’t be changed any more. Change it after it runs." | first screen or review banner | Back |
| `SCHEDULE_LIMIT` | "You can have up to 20 scheduled payments. Cancel one to add another." | review banner | Cancel one in Scheduled |
| `SUPPLIER_NOT_APPROVED` | "Choose a supplier from your list." | review banner | choose another |
| `RAIL_LIMIT` | "That is over the limit for this payment. Try a smaller amount." | amount field, review banner | change amount |
| `LIMIT_USER_EXCEEDED` | "That is over your limit." (field: "That is over your limit of $250,000.00 a payment.") | amount field, review banner | change amount |
| `DATE_TOO_SOON` | "Choose a date from tomorrow." | review banner | change the date |
| `END_BEFORE_START` | "Choose an end date after the start." | field | change |
| `INVALID_COUNT` | "Enter a valid number of payments." | defined; the field message covers it | change |
| `STEP_UP_FAILED` | "We couldn’t confirm this payment. Nothing was scheduled. Start again." | code sheet | start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Scheduled payments before you try again, so you don’t schedule it twice." | banner | check Scheduled |
| `SERVICE_UNAVAILABLE` | Sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." (journey text: "We couldn’t reach the bank. Nothing was scheduled.") | sheet | Try again / Cancel |

Loading: the busy texts above. Empty: no approved supplier gives an empty card list on step 1 (no extra button yet, planned).

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Suppliers, accounts, remaining limit | `corp.company.get` | Existing |
| Create, change, cancel and list schedules | `corp.schedules.create`, `corp.schedules.update`, `corp.schedules.cancel`, `corp.schedules.list` | (planned) |
| Start each payment on its date (waits for approval like any payment) | `corp.payments.initiate` | Existing, `packages/mock-bank-api/src/corporate.ts` |
| Quote and speed limits | `corp.payments.quote`, bank rail configuration (`09-payment-rails.md`) | (planned) |

#### 6. Permissions, step-up and limits

`pay.create`. Code only from 25,000.00 USD equivalent, never for Cancel. Person limit 250,000.00 per payment at scheduling (the daily total is checked again when a payment runs). Two approvers above 50,000.00 USD equivalent. At most 20 active schedules. Dates: tomorrow up to 12 months ahead, working days.

#### 7. Result and links out

A new schedule is stored as "awaiting" with the approvals needed. Approvers approve it once (planned in Approve payments; `BSCH.approve` exists in the file) and it becomes "active"; each run is then checked again. A change sends it back to "awaiting". Cancel ends it at once. Notification (planned): "Payment awaiting your approval" to the approvers; the reminder the day before each payment when `reminder` is on. Links: View scheduled, Schedule another, Back to scheduled.

#### 8. Acceptance criteria

- AC-1: Only saved, approved suppliers can be chosen; the amount, reference and purpose are required.
- AC-2: The date is a working day from tomorrow within 12 months; Ends and the number of payments follow the limits of section 3.
- AC-3: The review shows the next three dates and how many approvals are needed; the code is asked only from 25,000.00 USD equivalent and never for Cancel.
- AC-4: The result is "Sent for approval" with a waiting chip; no money moves.
- AC-5: Change goes back for approval and clears earlier approvals; Cancel is immediate and asks for no code.
- AC-6: Change and Cancel are refused after the cut-off, or while a payment is running.
- AC-7: A 21st active schedule is refused.
- AC-8: A timeout shows the check-Scheduled message and an unavailable bank shows the sheet; nothing is created or changed.
- AC-9: The list warns when the next payment would be skipped, with the reason.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Harbour Packaging, 4,500.00, INV-2041, Goods, Monthly, start Tue 1 Dec; send | No code; "Sent for approval"; chip "Waiting for 1 approval"; the list shows "Waiting for approval", "0 of 1 approved" | AC-1, AC-3, AC-4 |
| T-2 | Alex at Alpha | Nordic Supplies AB, 30,000.00 EUR, Once | Code sheet "Authorise €30,000.00 to Nordic Supplies AB, once"; code 482100; waiting | AC-3 |
| T-3 | Alex at Alpha | Harbour Packaging, 60,000.00, Monthly | Review "Needs 2 approvals before the first payment" | AC-3 |
| T-4 | Alex at Alpha | Start date today | Date field "Choose a date from tomorrow." | AC-2 |
| T-5 | Alex at Alpha | Ends: After a number, 1 payment | "Enter a number from 2 to 60." | AC-2 |
| T-6 | Alex at Alpha | Change BSC-3001 to 5,000.00 | "Change sent for approval"; list shows "Waiting for approval" | AC-5 |
| T-7 | Alex at Alpha | Cancel BSC-3002 | "Payment cancelled"; the row is gone from the list; no code | AC-5 |
| T-8 | Alex at Alpha, `strictCutoff` on, a schedule starting Wed 4 Nov | Change it | "This payment can’t be changed any more. Change it after it runs." | AC-6 |
| T-9 | Alex at Alpha, 20 active schedules (test seed) | Review, Send | "You can have up to 20 scheduled payments. Cancel one to add another." | AC-7 |
| T-10 | Alex at Alpha, wrong code three times | Code sheet | "We couldn’t confirm this payment. Nothing was scheduled. Start again."; no schedule | AC-3 |
| T-11 | Timeout on Review | Send | Banner "Check Scheduled payments before you try again, so you don’t schedule it twice."; nothing created | AC-8 |
| T-12 | Bank unavailable | Review | Sheet "We couldn’t reach the bank"; nothing created | AC-8 |
| T-13 | Alex at Alpha, Harbour Packaging disabled after BSC-3001 became active (test) | Open Scheduled | Warning "The supplier is no longer on your list. The next payment would be skipped." | AC-9 |
| T-14 | Alex at Beta | Open Payments › Scheduled | No Schedule a payment, Change or Cancel | AC-1 |

#### 10. Expected mutation-check survivors

- Changing the 25,000 or 50,000 constants by one cent: survives, T-1 to T-3 are far from the edge.
- Changing the 20-schedule limit to 21: survives, T-9 sits at exactly 20.
- Changing the 18:00 / 09:00 cut-off hours: survives, the scenario time is 10:42 and only the strict case is asserted.
- Changing the maximum payment counts (104, 60, 40): survives, only the monthly maximum appears in T-5.
- Removing "#" from the reference pattern: survives, no scenario types it.

---

### ★ Scheduled supplier payments — `business-schedules`

**Catalog**: slug `business-schedules`, workspace business, category Payments, core no, a bank can switch it off (yes). A view, not a journey: the **Scheduled** tab of Payments. Options: none. Permission `accounts.view` to see it; Schedule, Change and Cancel need `pay.create`. Prototype file `design/bankworkx-r1/src/journeys/71-templates-schedule.js` (`JR.define` with `view: true, tab: 'pay'`).

#### 1. Summary

| | |
|---|---|
| Slug | `business-schedules` |
| Purpose | Show scheduled and repeating supplier payments, whether they are waiting for approval, and whether the next one would be skipped. |
| Release | 1 |
| Workspace | Business |
| Status | Built in the prototype. |
| Who may see it | Anyone who can see Payments (`accounts.view`). The buttons show only with `pay.create`. |
| Route | Web `/business/{company}/payments/scheduled` (planned). Mobile screen `ScheduledPayments` (planned). In the prototype it is the Scheduled segment of the Payments tab. |

**Home market configuration**: none.

#### 2. Entry points and parameters

Payments › Scheduled segment. No parameters.

#### 3. Screen

1. Button **Schedule a payment** (only with `pay.create`).
2. One card per schedule, in the order saved; cancelled and ended schedules are not listed. A card has: the supplier's first letter, the supplier name and the reference, and a badge at the end (Active green, Waiting for approval amber, Paused grey; Paused is not set by the prototype yet). Under it: a line "{amount} · {how often} · next {Tue 1 Dec}" (the next date is the first run, moved to a working day); then one of: "{n} of {need} approved" (waiting for approval); an amber box "{reason} The next payment would be skipped." (an active schedule that fails the check before the next run, reasons in `schedule-business-payment`); or the last result, like "Paid 3 Nov". With `pay.create`: buttons **Change** and **Cancel**.

Sort: the order saved. No filters (planned: status chips). Empty: "Nothing scheduled" / "Payments you schedule show here." (the button stays above). Loading and error states are not in the prototype (planned: skeleton cards; "We couldn’t load your scheduled payments. Nothing was changed." with **Try again**).

#### 4. Actions and drill-downs

**Schedule a payment** opens `schedule-business-payment` (new). **Change** opens it in edit mode, **Cancel** in cancel mode, both with `{scheduleId}`. After a result, **View scheduled** and **Back to scheduled** return here. A "last run" link to the payment it started is planned.

#### 5. Adapters

`corp.schedules.list` (planned). The warning text uses the same check as the run (planned run engine).

#### 6. Acceptance criteria

- AC-1: The list shows each schedule with supplier, amount, how often, next date and badge.
- AC-2: A schedule waiting for approval shows "{n} of {need} approved".
- AC-3: An active schedule that would fail shows the reason and "The next payment would be skipped."
- AC-4: Change and Cancel show only with `pay.create`.
- AC-5: Cancelled schedules are not listed; with none left the empty state shows.

#### 7. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Open Scheduled | Two cards: Harbour Packaging "$4,500.00 · Monthly · next Tue 1 Dec", Active, "Paid 3 Nov"; Whitby Logistics "£12,000.00 · Every 3 months · next Mon 4 Jan", Waiting for approval, "0 of 1 approved" | AC-1, AC-2 |
| T-2 | Alex at Alpha, balance below 4,500.00 (test) | Open Scheduled | Warning "There isn’t enough money in the account. The next payment would be skipped." | AC-3 |
| T-3 | Alex at Beta | Open Scheduled | No Change, Cancel or Schedule a payment | AC-4 |
| T-4 | Alex at Alpha, both cancelled | Open Scheduled | "Nothing scheduled" | AC-5 |

#### 8. Expected mutation-check survivors

- Changing the badge colours: survives, only the text is asserted.
- Changing the order of the cards: survives, not asserted.

---

### ★ Withdraw a payment — `withdraw-payment`

**Catalog**: slug `withdraw-payment`, workspace business, category Payments, core no, a bank can switch it off (yes). Options: `askReason` "Ask why the payment is withdrawn" (on). Permission `pay.create`; moves no money, no code. Prototype file `design/bankworkx-r1/src/journeys/72-withdraw-tracker.js`: a normal engine journey (`JR.define`, one or two steps). The place where it is started is the view `payment-tracker` (next block).

> The screens never name a country or a payment scheme. Only the Maker's own payments that still wait for approval can be withdrawn; once a payment is released to the bank it can't be (a recall through the bank is outside this journey).

#### 1. Summary

| | |
|---|---|
| Slug | `withdraw-payment` |
| Purpose | A Maker takes back a payment they started while it still waits for approval. Nothing is sent. |
| Release | 1 |
| Workspace | Business (planned field `workspace: "business"`) |
| Status | Existing, upgraded. The sandbox already has the rule (`withdrawPayment` in `packages/mock-bank-api/src/corporate.ts`, adapter `corp.payments.withdraw`, built today as the fixture `withdraw-a-payment`); the prototype journey is the reference for BankWorkx®. |
| Channels | web, mobile |
| Who may use it | The context holds `pay.create`, and the payment was started by the same person. At Alpha Trading LLC: Alex Morgan (Maker). Not offered to Approvers (Alex at Beta). |
| Seed | Alpha: PAY-2040, $18,900.00 to Harbour Packaging, Ref PO-5612, started Today 09:30, 0 of 1 approved (Alex's, pending). PAY-1187 is settled and cannot be withdrawn. |

**Home market configuration**: none.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › Tracker › payment › Withdraw | `{paymentId}` | `pay.create`, own pending payment |
| Payments › Tracker › Pending | none (pick one) (planned button) | `pay.create` |

With `{paymentId}` the pick step is skipped.

#### 3. Screens

Progress text "Step n of 2 · Withdraw a payment" (1 of 1 when a payment was passed). Each screen has **Back** (the first has **Cancel**).

**Step 1: Withdraw a payment** (skipped when a payment was passed). Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Payment | cards: "{amount} to {supplier}", then "{id} · {started}", and a chip "{n} of {need} approved" | yes | one of this person's payments that are pending and not fully approved | "Choose a payment." |

Empty list: "Nothing to withdraw" / "Only payments waiting for approval can be withdrawn."

**Step 2: Withdraw this payment?** A card with the payment: "{amount} to {supplier}", "{id} · Ref {reference}", status chip. Busy text "Withdrawing…" (about 0.5 s). Button **Withdraw payment**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Reason (optional) | select, placeholder "Choose a reason": Wrong amount, Wrong supplier, Wrong reference, Not needed any more, Other (shown when `askReason` is on) | no | one of the list | none |
| Note | text, max 100 (shown when the reason is Other) | no | none | none |

No code is asked.

**Result** "Payment withdrawn", line "Nothing was sent to {supplier}.", green chip "Withdrawn". Receipt rows: Payment, To, Amount, Reason (if given); then the BankWorkx® reference. Buttons **Back to payments** (Payments › Tracker), **New supplier payment**.

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `PAYMENT_NOT_FOUND` | "We can’t find that payment." | step 2 banner | Back |
| `NOT_YOUR_PAYMENT` | "You can only withdraw payments you started." | step 2 banner | Back |
| `PAYMENT_RELEASED` | "This payment has already been released to the bank. It can’t be withdrawn." | step 2 banner | Back to payments |
| `PAYMENT_NOT_PENDING` | "This payment is no longer waiting for approval." | step 2 banner | Back to payments |
| `TIMEOUT` | "We didn’t get an answer in time. Check Payments before you try again." | banner | check Payments |
| `SERVICE_UNAVAILABLE` | Sheet "We couldn’t reach the bank": "Nothing was sent and you haven’t been charged. Try again in a moment." (journey text: "We couldn’t reach the bank. Nothing was changed.") | sheet | Try again / Cancel |

Loading: the busy text above. Empty: the pick step's "Nothing to withdraw". A payment that an approver released while the screen was open is refused with `PAYMENT_RELEASED`.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| List this person's pending payments | `corp.payments.pending` with `as: initiator` | Existing, `packages/mock-bank-api/src/corporate.ts` |
| Withdraw (errors `PAYMENT_NOT_PENDING`, `NOT_AUTHORISED`; the payment becomes `rejected` with the reason "Withdrawn by the person who started it"; the person's daily limit is given back) | `corp.payments.withdraw` | Existing |
| Reason and note stored with the withdrawal | extra field on `corp.payments.withdraw` | (planned) |

#### 6. Permissions, step-up and limits

`pay.create`. Only the person who started it (`NOT_YOUR_PAYMENT`; the sandbox says `NOT_AUTHORISED`). A partly approved payment can still be withdrawn; a fully approved or released one cannot. No code. Withdrawing gives the amount back to the person's daily limit.

#### 7. Result and links out

The payment's status becomes Withdrawn ("Withdrawn · {reason}" on its timeline) and it leaves the Approvers' inbox. An audit line is added: "Withdrew payment {id} of {amount}". Notification (planned): the approvers are told it was withdrawn. Links: Back to payments (Tracker), New supplier payment.

#### 8. Acceptance criteria

- AC-1: Only the Maker's own pending payments can be withdrawn; others are refused with the message of section 4.
- AC-2: The confirm screen shows the payment and, when `askReason` is on, an optional reason; Other adds a note.
- AC-3: The result is "Payment withdrawn", status Withdrawn, and says nothing was sent.
- AC-4: A released or settled payment can't be withdrawn.
- AC-5: With nothing to withdraw the pick step shows the empty state.
- AC-6: A timeout shows the check-Payments message and changes nothing; an unavailable bank shows the sheet and changes nothing.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Tracker › PAY-2040 › Withdraw; reason "Wrong amount"; confirm | "Payment withdrawn"; "Nothing was sent to Harbour Packaging."; row Reason "Wrong amount"; tracker shows Withdrawn | AC-2, AC-3 |
| T-2 | Alex at Alpha | Same, reason "Other", note "Wrong invoice" | Receipt reason "Wrong invoice" | AC-2 |
| T-3 | Alex at Alpha, `askReason` off | Withdraw | No reason field | AC-2 |
| T-4 | Alex at Alpha, PAY-1187 (settled) | Open it in the tracker | No Withdraw button | AC-4 |
| T-5 | Alex at Alpha, PAY-2040 released meanwhile (test) | Confirm | "This payment has already been released to the bank. It can’t be withdrawn." | AC-4 |
| T-6 | Alex at Alpha, a payment started by someone else (test) | Confirm | "You can only withdraw payments you started." | AC-1 |
| T-7 | Alex at Alpha, no pending payments | Start with no payment | "Nothing to withdraw" | AC-5 |
| T-8 | Timeout on confirm | Withdraw | Banner "Check Payments before you try again."; status unchanged | AC-6 |
| T-9 | Bank unavailable | Withdraw | Sheet "We couldn’t reach the bank"; status unchanged | AC-6 |
| T-10 | Alex at Beta | Open Tracker | No Withdraw button | AC-1 |

#### 10. Expected mutation-check survivors

- Removing the note's 100-character limit: survives, no scenario types a long note.
- Changing the list of reasons: survives, only "Wrong amount" and "Other" are used.
- Letting a payment with all approvals but not yet released be withdrawn: caught by T-5 only if the test seed sets it up.

---

### ★ Payment tracker — `payment-tracker`

**Catalog**: slug `payment-tracker`, workspace business, category Payments, core no, a bank can switch it off (yes). A view, not a journey: the **Tracker** tab of Payments, the first tab. Options: none. Permission `accounts.view`; Withdraw needs `pay.create`. Prototype file `design/bankworkx-r1/src/journeys/72-withdraw-tracker.js` (`JR.define` with `view: true, tab: 'pay'`), embedded by the Payments tab in `src/js/80-business.js`.

#### 1. Summary

| | |
|---|---|
| Slug | `payment-tracker` |
| Purpose | Find any payment the company started and see where it is: waiting for approval, released, settled, rejected or withdrawn, with a status timeline and, for the Maker's own pending payments, Withdraw. |
| Release | 1 |
| Workspace | Business |
| Status | Built in the prototype. The sandbox has `corp.payments.get` and `corp.payments.pending`; a full list is planned (section 5). |
| Who may see it | Anyone who can see Payments (`accounts.view`): a Maker sees every payment of the company. |
| Route | Web `/business/{company}/payments/tracker` and `/business/{company}/payments/tracker/{paymentId}`; deep link `bankworkx://business/{company}/payments/{paymentId}` (all planned). Mobile screens `PaymentTracker` and `PaymentDetail` (planned). In the prototype it is the Tracker segment of the Payments tab. |
| Seed | Alpha: PAY-2040 (pending, $18,900.00, Harbour Packaging), PAY-1187 (settled, $12,450.00), PAY-1180 and PAY-1190 (settled supplier batches); rows keep the stored order and a payment started later goes to the top. Beta: PAY-2041 and PAY-2039 (pending), PAY-2012 (settled). |

**Home market configuration**: none. The cut-off shown is 16:00 UTC.

#### 2. Entry points and parameters

Payments › Tracker segment, the Overview recent payments and the Approvals inbox rows (they open the payment through `S.sub`). A "Track payment" button on the result of Pay a supplier opens the payment here. Launch points on it: **Withdraw** (`withdraw-payment`, `{paymentId}`).

#### 3. Screen

At the top of the Payments tab, whatever segment is chosen: with `pay.create` the button **New supplier payment** (`supplier-payment`); without it a note "Your role here is {role}. It can’t create payments, so this button isn’t offered. The bank refuses it too." Below it the segments **Tracker**, **Templates**, **Scheduled**, **Suppliers**, **Bulk & payroll**. Tracker is the first.

**List.** A row of filter chips: All, Pending, Released, Settled, Rejected, Withdrawn (one at a time; All by default). Under it a table of the company's payments, newest started first, with these columns on the web (cards on phones, the first value as the title):

| Column | Content |
|---|---|
| Payment | the id like `PAY-2040`, and the start time under it ("Today 09:30") |
| To | supplier, or "Bulk · {n} payments" |
| Amount | in dollars, right aligned |
| Status | a chip |

Status chips: **Pending approval** (amber), **Released to bank** (blue), **Settled** (green), **Rejected** (red), **Withdrawn** (grey). The filter chip "Released" matches only Released to bank.

Empty with no payments: "No payments yet" / "Payments you start will show here with their status." Empty after a filter: "Nothing here" / "No payment has this status." Loading and error states are not in the prototype (planned: 8 skeleton rows; "We couldn’t load your payments. Nothing was changed." with **Try again**).

**Detail.** On wide screens the list is on the left and the detail of the selected payment on the right (the first row is selected at first; "Pick a payment" / "Its status timeline appears here." when none). On phones a tap opens the detail with **‹ Back**. The detail card has: the id and the status chip; the amount; "To {supplier} · Ref {reference}" and the speed when known; the status timeline; then buttons.

| Timeline step | Text | State |
|---|---|---|
| Created | "{name} · {started}" | done |
| Approval | "{n} of {need} approved ({names})"; or "Rejected"; or "Withdrawn" plus " · {reason}" | current while pending; done once approved; red when rejected or withdrawn |
| Released to bank | "Before the 16:00 cut-off" | current when released; done when settled |
| Settled | none | done when settled |

Released to bank and Settled are shown only for payments that were not rejected or withdrawn. Buttons: **Withdraw** (only for the Maker's own payment that is pending and not fully approved, with `pay.create`; opens `withdraw-payment` with `{paymentId}`); **View receipt** (settled or released; the prototype only shows "Receipt downloaded", the real receipt is planned).

**Planned, not in the prototype** (from the earlier shell text): filters by date range, type, started by, and search; sort by column; a "Mine" toggle; the columns Approvals, Value date and Started by; the overflow actions Save as template, Repeat and Repair rejected lines (the last for bulk payments; today it is the **Fix and resend** button of Batch status); a full timeline with each approver's time and "Goes out on {date} because it was started after the cut-off"; a Lines table for bulk and payroll; "Go to approvals" for a person who is also an Approver.

#### 4. States and errors

A payment that cannot be found: "Payment not found." in the card. Timeout and unavailable: shown by the page (planned, see above). No money moves here.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| One payment: status, amounts, who started it, who approved, value date, release reference or rejection reason | `corp.payments.get` | Existing, `packages/mock-bank-api/src/corporate.ts` |
| The Maker's pending payments (`as: initiator`) | `corp.payments.pending` | Existing |
| List all payments with filters and paging (`status`, `from`, `to`, `kind`, `startedBy`, `q`, `sort`, `page`; 25 a page) | `corp.payments.list` | (planned) |
| Withdrawn and Settled as states (the sandbox stores a withdrawn payment as `rejected` with the reason "Withdrawn by the person who started it", and has no `settled`) | status mapping in the view-model | (planned) |
| Access check: the payment must belong to the active company, else `PERMISSION_DENIED` | `corp.payments.get` | (planned) |

#### 6. Acceptance criteria

- AC-1: The list shows the company's payments with id, start time, supplier, amount and a status chip.
- AC-2: The filter chips narrow the list by status; All shows everything.
- AC-3: The detail shows a timeline that matches the status, including who approved and the withdraw reason.
- AC-4: Withdraw shows only on the Maker's own pending payments that are not fully approved, and only with `pay.create`.
- AC-5: A withdrawn payment shows Withdrawn and no release steps.
- AC-6: With no payments the empty state shows; with a filter that matches none, "Nothing here".
- AC-7: An Approver sees the same list and no Withdraw.

#### 7. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Open Payments | Tracker is shown; first row selected; the chips and a table with PAY-2040 "Pending approval" | AC-1 |
| T-2 | Alex at Alpha | Chip Settled | Only settled payments; PAY-2040 is gone | AC-2 |
| T-3 | Alex at Alpha | Chip Rejected | "Nothing here" / "No payment has this status." | AC-6 |
| T-4 | Alex at Alpha | Open PAY-2040 | Timeline: Created "Alex Morgan · Today 09:30", Approval "0 of 1 approved"; button Withdraw | AC-3, AC-4 |
| T-5 | Alex at Alpha | Open PAY-1187 | Timeline ends at Settled; no Withdraw; View receipt | AC-3, AC-4 |
| T-6 | Alex at Alpha | Withdraw PAY-2040 | Row shows Withdrawn; timeline "Withdrawn · {reason}"; no Released or Settled steps | AC-5 |
| T-7 | Alex at Beta | Open Payments | The same list for Beta; no New supplier payment button, a role note instead; no Withdraw | AC-7 |
| T-8 | A company with no payments (test seed) | Open Payments | "No payments yet" | AC-6 |

#### 8. Expected mutation-check survivors

- Changing the cut-off text "Before the 16:00 cut-off": survives, not asserted.
- Changing the order of the chips: survives, only their effect is asserted.
- Changing the colour of a chip: survives, only the words are asserted.

---

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

Alias of `bulk-payment`: reached by launching `bulk-payment` with `{repairOf: paymentId}` from Batch status › **Fix and resend**, or from an old `repair-bulk-lines` link. The prototype registers no separate alias entry for it (`06-aliases.js` has none), so today it has no switch of its own and is turned off with `bulk-payment` (a catalog alias row is planned). It works only for a settled batch that still has failed lines. The full text is in `bulk-payment` ("Resend mode").

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

The **Admin** tab and three journeys: `manage-user`, `change-limits`, `edit-signatory-group`. Release 1. The tab is a view (`admin`) with four sections: People, Limits, Approval groups and Activity log. The three journeys are started from buttons on it. Every change goes through a code prompt, is written to the activity log, and (while the option is on) waits for a **second administrator** to approve it when it raises a limit, adds or changes an administrator, or changes an approval group.

> The earlier version of this section described six shell screens (Users, Roles, Account permissions, Limits, Signatory groups, Audit trail), a role list of Maker, Approver and Admin, an audit export and a `biz.audit.view` permission. The prototype has none of those: one `admin` view, five roles (Maker, Approver, Maker and approver, Viewer, Administrator) and one activity log. Account-by-account permissions, a roles page and an export are not in Release 1.

**What exists today in the sandbox.** `CorporateSandbox` knows users with `roles` (`initiator`, `approver`), `dailyLimit` and `usedToday`, and the company has `companyDailyLimit`, `dualApprovalAbove` and `cutoff` (`corp.company.get`, `corp.users.list`, `packages/mock-bank-api/src/corporate.ts`). There is no way to change any of it. Every adapter named in this section that changes data is (planned); the prototype keeps people, limits, groups and the change queue on the company record in memory, and a sandbox reset clears them.

**Seed values** (identical to the prototype; USD, one table for the section):

| | Alpha Trading LLC | Beta Services Ltd |
|---|---|---|
| People | Alex Morgan (Maker, limit $250,000.00), Dana Cruz (Approver), Lee Park (Approver), Maria Silva (Approver), Priya Nair (Maker, $100,000.00), Omar Haddad (Maker, $150,000.00), Sam Okafor (Approver, Invited), Ravi Menon (Administrator), Mina Das (Administrator) | Alex Morgan (Approver), Lee Park, Maria Silva, Sam Okafor (Approvers), Priya Nair (Maker, $100,000.00), Omar Haddad (Maker, $150,000.00), Noor Sayegh (Administrator), Karim Aziz (Administrator) |
| Limits | Per person $250,000.00; company daily $1,000,000.00; bank ceiling $2,000,000.00; two approvers above $50,000.00; extra code from $25,000.00 | the same |
| Approval groups | "Payments over 50,000": in order, Dana Cruz then Lee Park. "Payments up to 50,000": any one of Dana Cruz, Lee Park | "Payments over 50,000": in order, Alex Morgan then Lee Park. "Payments up to 50,000": any one of Alex Morgan, Lee Park |
| Waiting for a second administrator | CHG-1042, sent by Mina Das, "Raise the extra code threshold from $25,000.00 to $30,000.00", 3 Nov 09:20 | CHG-1043, sent by Karim Aziz, "Raise the two-approver threshold from $50,000.00 to $60,000.00", 3 Nov 08:50 |
| Requests | REQ-30418, Cheque book, "Cheque book, Operating", Done, Priya Nair, 28 Oct | none |

The acting administrator in the preview is **Ravi** at Alpha and **Noor** at Beta. Alex Morgan is Maker at Alpha and Approver at Beta and is never an administrator, so he does not see the tab's content at either company.

### ★ Admin — `admin`

**Catalog**: slug `admin`, workspace business, category Admin, core no, a bank can switch it off (yes), kept in the Lean preset (basic). A view (tab `adm`), not a journey. Permission `admin`. Options: *Show the activity log* (default on). Prototype file `design/bankworkx-r1/src/journeys/75-admin.js` (it also holds the shared people, limits and group data, `ADM`, used by the three journeys).

#### 1. Summary

| | |
|---|---|
| Slug | `admin` |
| Purpose | An administrator sees who can act at the company, the limits in force and the approval groups, starts the three admin journeys, decides on changes another administrator sent, and reads the activity log. |
| Release | 1 |
| Workspace | Business (tab **Admin**, between Approvals and More) |
| Status | Built in the prototype. Replaces the earlier shell screens. |
| Channels | web, mobile |
| Who may use it | A context that holds `admin`. Alex Morgan does not, at either company. |
| Journey type | View with three launch points and an approve or decline action. No code prompt on the view itself; the three journeys ask for it. |

**Home market configuration**: none. All amounts are in the company's currency (USD for Alpha and Beta).

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Tab bar › Admin | none | none to open; the content needs `admin` |
| Section People › Invite user | `manage-user` `{mode: "invite"}` | `admin` |
| People › row › Edit | `manage-user` `{mode: "edit", userId}` | `admin` |
| People › row › Disable | `manage-user` `{mode: "disable", userId}` | `admin` |
| People › row › Enable (disabled people) | `manage-user` `{mode: "enable", userId}` | `admin` |
| Limits › Change limits | `change-limits` `{}` | `admin` |
| Approval groups › card › Edit group | `edit-signatory-group` `{group: "over" or "upto"}` | `admin` |

Switching context closes the preview (see "Administrator preview").

#### 3. Screens

**Without access.** A person who does not hold `admin` sees a lock screen: title "You don’t have access", line "Only administrators can manage people and limits.", button **Preview as {Ravi at Alpha, Noor at Beta} (administrator)**. The button switches the preview on (section "Administrator preview"). Nothing else is shown.

**With access** (a real administrator, or the preview). From top to bottom:

1. **Preview bar** (only in the preview): "Previewing as {name}, an administrator." and a link **Exit**.
2. **Waiting for a second administrator** card (only when something is waiting). One row per waiting change: the text in bold ("Raise the extra code threshold from $25,000.00 to $30,000.00"), a small line "Sent by {name} · {date and time}" ("Sent by you" for the acting administrator's own), then either the buttons **Approve** and **Decline**, or, for a change the acting administrator sent, the chip "Waiting for another administrator". Approve applies the change at once, writes "Approved {text} ({id})" to the activity log and shows the toast "Approved. The change is live." Decline writes "Declined …" and shows "Declined. Nothing was changed." A person cannot decide on their own change (toast "Another administrator has to approve this.", not reachable from the buttons). Declining an invitation for a new administrator removes that person.
3. **Section buttons**: People, Limits, Approval groups, and Activity log (only while the option is on). The first section, People, is open when the tab is entered.

**People.** Button **Invite user** above a table with columns Person, Role, Daily limit, Status and an actions column.

| Column | Content |
|---|---|
| Person | Name; the acting administrator's own row adds "(you)" |
| Role | Maker, Approver, Maker and approver, Viewer, Administrator |
| Daily limit | The amount for a Maker or a Maker and approver, otherwise "-" |
| Status | Chip: "Active" green, "Invited" blue, "Disabled" grey, "Change waiting" amber (a change by this person's record is waiting for a second administrator), "Waiting for approval" amber (a new administrator not yet approved) |
| Actions | **Edit** and **Disable**; for a disabled person only **Enable**. None on your own row, on a row with a change waiting, or on a person waiting for approval |

Order is the order of creation (a new person goes to the bottom). There is no search, filter or paging in the prototype (planned if lists grow). No empty state is needed: an administrator always exists.

**Limits.** One card with five rows and a button **Change limits**:

| Row | Alpha and Beta |
|---|---|
| Limit per person | $250,000.00 |
| Company daily limit | $1,000,000.00 |
| Ceiling set by the bank | $2,000,000.00 |
| Two approvers above | $50,000.00 (Beta: $60,000.00 once CHG-1043 is approved) |
| Extra code from | $25,000.00 (Alpha: $30,000.00 once CHG-1042 is approved) |

**Approval groups.** Two cards, "Payments over {amount}" and "Payments up to {amount}" (the amount follows the two-approver limit, shown without decimals: "Payments over 50,000"). Each card has one line of who and how, and the button **Edit group**.

| Mode | Line |
|---|---|
| Any one | "Any one of Dana Cruz, Lee Park" |
| In order | "In order: Dana Cruz, then Lee Park" |
| Several together | "2 of 3 together: Dana Cruz, Lee Park, Maria Silva" |

**Activity log.** A table with columns When, Who, What, Result, newest first, the latest 15 entries. Seed entries (shared by both companies): "3 Nov 10:14 · Alex Morgan · Signed in to Alpha Trading LLC as Maker · Done", "3 Nov 09:58 · ravi · Changed Dana Cruz’s daily limit from 100,000.00 to 150,000.00 · Done", "2 Nov 16:02 · Omar Haddad · Started payment PAY-2039 of USD 64,500.00 · Done", "2 Nov 11:20 · ravi · Invited Priya Nair as Maker · Done", "1 Nov 08:45 · unknown · Sign in attempt · Refused (the chip says only "Refused"; the code stays in the data)". New entries are written by the admin journeys and by Approve and Decline ("Invited Sam Okafor as Maker (sam.okafor@example.com)", "Changed {name}: role, accounts", "Disabled {name}. Reason: {reason}", "Enabled {name}", "Raise the company daily limit from $1,000,000.00 to $1,200,000.00"). Result chip: "Done" green; "Waiting" amber (a change that waits for a second administrator); anything else "Refused" red. Empty state (planned in code, not reachable with the seed): "No activity yet" / "Changes made by administrators are listed here."

**Administrator preview.** The prototype has no real administrator sign-in. The preview button adds the `admin` permission to every company for this session and acts as Ravi (Alpha) or Noor (Beta). **Exit** removes it. Switching to another context or workspace, or resetting the sandbox, ends the preview. In the product the tab simply shows content to a person whose role holds `admin`.

#### 4. States and errors

| State | What the person sees |
|---|---|
| No access | The lock screen above |
| Loading | none in the prototype (data is local); the product shows skeleton rows (planned) |
| Empty | Activity log only, as above |
| Error | Not shown on this view; the journeys show their own errors |
| Timeout, unavailable | Not applicable to the view (planned: "We couldn’t load this. Nothing was changed." with **Try again**) |

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Company limits and approval rule | `corp.company.get` | Existing |
| People | `corp.users.list` (extension to the full record below is planned) | Existing, thin |
| Full people record `{ id, name, email, phone, role, limit, accounts, status }`, limits, groups, waiting changes, activity | `corp.users.get`, `corp.limits.get`, `corp.signatories.list`, `corp.changes.list`, `corp.audit.list` | (planned) |
| Approve or decline a waiting change | `corp.changes.decide` (errors `PERMISSION_DENIED`, `SELF_APPROVAL`, `CHANGE_NOT_FOUND`) | (planned) |

#### 6. Permissions, step-up and limits

`admin` to see the content. The preview is a prototype device only. Approve and Decline need no extra code in the prototype (planned: a code prompt, as for the journeys). A person never decides on their own change.

#### 7. Result and links out

Approve or Decline shows a toast and refreshes the view. Links out: the three admin journeys. No notification in the prototype (planned: "A change is waiting for your approval" to the other administrators).

#### 8. Acceptance criteria

- AC-1: A person without `admin` sees "You don’t have access" and the preview button, and no people, limits or groups.
- AC-2: The preview shows People, Limits, Approval groups and Activity log, with the seed values of the active company.
- AC-3: A change sent by another administrator shows Approve and Decline; the acting administrator's own change shows only "Waiting for another administrator".
- AC-4: Approve applies the change and writes an activity entry; Decline leaves everything as it was.
- AC-5: Switching company ends the preview, and the other company shows its own people and its own waiting change.
- AC-6: With the option *Show the activity log* off, the Activity log section is not offered.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Open Admin | Lock screen with "Preview as Ravi (administrator)" and no data | AC-1 |
| T-2 | Alex at Alpha | Preview | Bar "Previewing as Ravi Menon, an administrator."; People lists nine people, Sam Okafor Invited, Ravi "(you)" without buttons | AC-2 |
| T-3 | Preview at Alpha | Look at the waiting card | CHG-1042 by Mina Das with Approve and Decline | AC-3 |
| T-4 | Preview at Alpha | Approve CHG-1042; open Limits | Toast "Approved. The change is live."; Extra code from $30,000.00; log has the entry | AC-4 |
| T-5 | Preview at Alpha | Decline CHG-1042 | Toast "Declined. Nothing was changed."; Extra code from $25,000.00 | AC-4 |
| T-6 | Preview at Alpha, then switch to Beta | Open Admin | Lock screen again; after preview, Noor and CHG-1043 by Karim Aziz; Alpha's people are not shown | AC-5 |
| T-7 | Preview, option off | Open Admin | Three sections only | AC-6 |
| T-8 | Preview at Alpha | Send a limit increase with `change-limits`, return | The waiting card shows it with "Waiting for another administrator" and no Approve | AC-3 |

#### 10. Expected mutation-check survivors

- The activity log length of 15: survives, no scenario writes sixteen entries.
- The order of the section buttons: survives, only the content is asserted.
- The minute counter of new log entries ("3 Nov 11:05" and up): survives, times are not asserted.
- Chip colours: survive, only the text is asserted.

---

### ★ Invite, edit or disable a user — `manage-user`

**Catalog**: slug `manage-user`, workspace business, category Admin, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Permission `admin`, does not move money. Options: *Second administrator approves new administrators* (default on), *Ask for a reason when disabling* (default on). Prototype file `design/bankworkx-r1/src/journeys/76-users-limits.js`, a normal engine journey with modes.

#### 1. Summary

| | |
|---|---|
| Slug | `manage-user` |
| Purpose | An administrator invites a person, changes a person's name, mobile number, role, accounts or daily limit, disables a person, or enables a disabled one. Anything that involves an administrator needs a second administrator to approve. |
| Release | 1 |
| Workspace | Business |
| Status | Built in the prototype; sandbox adapters (planned). |
| Channels | web, mobile |
| Who may use it | A context holding `admin`: Ravi Menon (Alpha), Noor Sayegh (Beta), reached through the administrator preview of the `admin` view. |
| Journey type | Security journey (it changes who can move money): a code prompt, timeout and unavailable scenarios. |

**Home market configuration**: none. The mobile number hint uses an international format for every market.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Admin › People › Invite user | `{mode: "invite"}` | `admin` |
| Admin › People › row › Edit | `{mode: "edit", userId}` | `admin` |
| Admin › People › row › Disable | `{mode: "disable", userId}` | `admin` |
| Admin › People › row › Enable (disabled people) | `{mode: "enable", userId}` | `admin` |

No resend-invite mode and no entry from an account permission grid (both of the earlier version are gone).

#### 3. Screens

Progress text "Step n of m · Manage a user". **Invite** and **Edit** have steps Who is it?, Role and access, Review. **Disable** has Why disable? (only while the option is on) and Review. **Enable** has Review only. Each step has Back (the first has Cancel). A step that calls the bank shows a spinner and "Checking…" (about 0.55 s).

**Step "Who is it?"** (invite and edit). Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Full name | text, max 60 | yes | starts with a letter; letters, space, apostrophe, hyphen, full stop; 2 to 60 characters | "Enter their full name." |
| Work email (invite) | email, hint "We send the invitation here.", max 80 | yes | valid email; not already a person at this company | "Enter a valid work email, like name@company.com." / "This email already has access. Edit that person instead." |
| Work email (edit) | read-only row | no | cannot be changed | none |
| Mobile number | tel, hint "With the country code. Used for codes." | yes | `+` then 8 to 16 digits and spaces | "Enter a mobile number with the country code, like +1 415 555 0100." |

Edit opens with the person's current values. Autofill sample: Sam Okafor, sam.okafor@example.com, +1 415 555 0100.

**Step "Role and access"** (invite and edit). Button **Review**, disabled while the notes below show a red message or "Change something to continue."

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Role | cards: Maker "Starts payments"; Approver "Approves payments others start"; Maker and approver "Starts and approves, never their own"; Viewer "Sees accounts and payments"; Administrator "Manages people and limits" (with the amber chip "Needs a second approval" while the option is on) | yes, default Maker on invite | one of the five | "Choose a role." |
| Accounts | one switch per company account, labelled "Operating ••2001", "Reserve ••2044" (Alpha); all on by default | yes | at least one on | "Choose at least one account." |
| Daily limit | amount in $, hint "Up to $250,000.00 for one person.", placeholder "0.00" | yes, shown only for Maker and for Maker and approver | greater than 0; not above the company daily limit; not above the per-person limit | "That is above the company limit of $1,000,000.00." / "The most one person can have is $250,000.00." |

Live notes under the fields: red "Choose at least one account."; grey "Change something to continue." (edit with no change); grey "They can start and approve payments, but never approve their own." (Maker and approver); grey "A second administrator has to approve this." (Administrator); red "{name} has {n} payment(s) waiting for approval. Remove the Maker role after they are approved or rejected." (edit that removes the Maker role from a person with waiting payments).

**Step "Why disable?"** (disable, option on). Button **Review**. If the person has payments waiting, a notice: "{n} payment(s) waiting. They stay as they are after {name} is disabled."

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Reason | chips: Left the company, Changed role, Security concern, Other | yes | one | "Choose a reason." |
| Note | text area, max 200, shown for Other | yes for Other | at least 5 characters | "Add a few words." |

**Step "Review"**. Busy "Checking…". Button **Confirm**. Rows by mode:

| Mode | Rows |
|---|---|
| Invite | Name, Work email, Mobile, Role, Accounts ("All accounts" or the names), Daily limit (Makers only), Company, and "Approval: Second administrator needed" for an administrator |
| Edit | Person, then one row per change as "before → after" (Name, Mobile, Role, Accounts, Daily limit), then the approval row when an administrator is involved |
| Disable | Person, Role, "Status: Active → Disabled", Reason, approval row for an administrator |
| Enable | Person, Role, "Status: Disabled → Active", approval row for an administrator |

Checks when **Confirm** is tapped (section 4). **Code prompt** (always): a keypad sheet. Title "Invite {name}", "Save changes for {name}", "Disable {name}" or "Enable {name}"; line "Code sent to ••• 4410." The sandbox code is 482100.

**Result.**

| Case | Title and line | Chip | Rows | Buttons |
|---|---|---|---|---|
| Approval needed (any involvement of an administrator, option on) | "Sent for approval" / "Another administrator has to approve this before it takes effect." | "Waiting for approval" (amber) | Person, then Role and Email (invite), Changed (edit, the changed labels), Status and Reason (disable), Status (enable); Company; Approval "Second administrator" | Back to people |
| Invite | "Invitation sent" / "We emailed {email}. They can sign in after they accept." | Invited | Person, Role, Email, Company | Back to people, Invite another |
| Edit | "Changes saved" | Saved | Person, Changed, Company | Back to people |
| Disable | "{name} is disabled" / "They are signed out now." | Disabled | Person, Status, Reason, Company | Back to people |
| Enable | "{name} can sign in again" | Active | Person, Status, Company | Back to people |

"Involves an administrator" means: inviting an administrator; editing, disabling or enabling a person who is an administrator; or changing a person to be one. While waiting, a new administrator shows the chip "Waiting for approval" in People and an existing person shows "Change waiting", with no buttons. Approval is done on the `admin` view (Approve or Decline).

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `USER_EXISTS` | "This email already has access. Edit that person instead." | email field | change the email |
| `LIMIT_ABOVE_COMPANY` | "The limit is above what the company allows." | review banner (invite) | back |
| `CANNOT_DISABLE_SELF` | "You can’t disable yourself. Ask another administrator." | review banner | back |
| `LAST_ADMIN` | "The company must keep one active administrator. Add another one first." | review banner (disable, or removing the Administrator role) | back |
| `USER_HAS_PENDING_PAYMENTS` | "This person has payments waiting for approval. Remove the Maker role after they are approved or rejected." | review banner | back |
| `USER_NOT_FOUND` | "We can’t find that person. They may have been removed." | review banner | back |
| `PERMISSION_DENIED` | "You can’t manage people at this company." | lock or banner | back |
| `STEPUP_FAILED` | "The code didn’t work. Nothing was changed." | code sheet, after three wrong codes | start again |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was changed." | banner | try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | sheet or banner | try again |

Loading: spinner on the review step. Empty: not applicable.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| People list (to check duplicates) | `corp.users.list` | Existing, `packages/mock-bank-api/src/corporate.ts` |
| Invite, edit, disable, enable | `corp.users.invite`, `corp.users.update`, `corp.users.disable`, `corp.users.enable` (errors above) | (planned) |
| Queue a change for a second administrator | `corp.changes.create` | (planned) |
| Code | `bank.otp.send`, `bank.otp.verify` | Existing in the OTP sandbox |

#### 6. Permissions, step-up and limits

`admin`. A code for every confirmed change. Daily limit between 0 and the company limit and the per-person limit. At least one active administrator must remain. A person cannot disable themselves.

#### 7. Result and links out

The change is written to the activity log: "Invited {name} as {role} ({email})", "Changed {name}: {labels}", "Disabled {name}. Reason: {reason}", "Enabled {name}", or, when it waits, the same text with the result "Waiting". Notification (planned): the invited person gets an email; the other administrators are told a change is waiting. Links: Back to people (Admin tab, People), Invite another (this journey).

#### 8. Acceptance criteria

- AC-1: An invitation needs a name, a valid new work email, a mobile number, a role, at least one account and, for a Maker, a daily limit within the company and per-person limits.
- AC-2: An email already in use is refused with the message of section 4.
- AC-3: Edit shows only what changed as "before → after" and cannot be reviewed without a change.
- AC-4: Removing the Maker role from a person with waiting payments is refused; disabling such a person is allowed and the payments stay as they are.
- AC-5: An administrator cannot disable themselves and the last active administrator cannot be disabled or demoted.
- AC-6: Anything involving an administrator ends in "Sent for approval" and changes nothing until a second administrator approves; with the option off it applies at once.
- AC-7: The code prompt names the action; three wrong codes change nothing.
- AC-8: Every outcome is written to the activity log.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Ravi (preview at Alpha) | Invite Sam Okafor, Maker, all accounts, 100,000.00; code 482100 | "Invitation sent"; chip Invited; a new row in People; log "Invited Sam Okafor as Maker (…)" | AC-1, AC-8 |
| T-2 | Ravi | Invite a Maker with 1,200,000.00, then 300,000.00 | "That is above the company limit of $1,000,000.00." then "The most one person can have is $250,000.00."; no one added | AC-1 |
| T-3 | Ravi | Invite using Dana Cruz’s email (dana.cruz@alpha.example) | "This email already has access. Edit that person instead." | AC-2 |
| T-4 | Ravi | Edit Dana Cruz to Maker and approver with limit 15,000.00 | Review shows Role and Daily limit as "before → after"; "Changes saved"; grey note about never approving their own | AC-3, AC-8 |
| T-5 | Ravi | Open Edit and change nothing | Review stays disabled with "Change something to continue." | AC-3 |
| T-6 | Noor (Beta), Priya Nair has a payment waiting | Edit Priya to Approver | Review refused: "This person has payments waiting for approval…" | AC-4 |
| T-7 | Noor | Disable Priya, reason Left the company | "Priya Nair is disabled"; the payment still waits | AC-4 |
| T-8 | Ravi; and a sandbox run with a single active administrator | Look at Ravi’s own row; force a disable of the only administrator | No buttons on the own row; the forced calls answer `CANNOT_DISABLE_SELF` and `LAST_ADMIN` with their messages and change nothing | AC-5 |
| T-9 | Ravi | Invite an Administrator | "Sent for approval"; People shows "Waiting for approval"; Approve on the admin view needs another administrator | AC-6 |
| T-10 | Ravi, option *Second administrator approves new administrators* off | Same | Applies at once, "Invitation sent" | AC-6 |
| T-11 | Ravi | Disable Lee Park; wrong code three times | "The code didn’t work. Nothing was changed."; Lee still Active | AC-7 |
| T-12 | Ravi | Disable Lee Park with option *Ask for a reason* on, choose Other, note "ok" | "Add a few words." | AC-1 |
| T-13 | Timeout on submit | Review | "We didn’t get an answer in time. Nothing was changed." | AC-7 |
| T-14 | Bank unavailable | Review | "We couldn’t reach the bank. Nothing was changed." | AC-7 |
| T-15 | Alex at Alpha | Open Admin | Lock screen, no Invite button | AC-6 |

#### 10. Expected mutation-check survivors

- The mobile number length (8 to 16): survives, one sample is used.
- Changing the order of the five roles: survives, the chosen role is asserted, not the order.
- The 5-character minimum on the note: survives unless T-12 uses the edge.
- The "(you)" marker: survives, no scenario asserts the label.

---

### ★ Change limits — `change-limits`

**Catalog**: slug `change-limits`, workspace business, category Admin, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Permission `admin`, does not move money. Options: *Second administrator approves increases* (default on). Prototype file `design/bankworkx-r1/src/journeys/76-users-limits.js`.

#### 1. Summary

| | |
|---|---|
| Slug | `change-limits` |
| Purpose | An administrator changes one of four company settings: the limit per person, the company daily limit, the amount above which two approvers are needed, and the amount from which an extra code is asked. A decrease applies at once; an increase waits for a second administrator. |
| Release | 1 |
| Workspace | Business |
| Status | Built in the prototype; sandbox adapters (planned). The earlier version (a reason field, a per-user limit, an account limit, a minimum below today’s use) is gone. |
| Channels | web, mobile |
| Who may use it | A context holding `admin` (Ravi at Alpha, Noor at Beta through the preview). |
| Journey type | Security journey: code prompt, timeout and unavailable scenarios. |
| Seed | Per person $250,000.00; company $1,000,000.00; bank ceiling $2,000,000.00; two approvers above $50,000.00; extra code from $25,000.00. Alpha has CHG-1042 waiting (extra code to $30,000.00); Beta has CHG-1043 waiting (two approvers to $60,000.00). |

**Home market configuration**: none; amounts are in the company currency.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Admin › Limits › Change limits | none | `admin` |

The journey accepts `{which}` (`person`, `company`, `two`, `code`) to skip the first step; no button passes it yet. A single person’s own limit is changed in `manage-user` (edit), not here.

#### 3. Screens

Progress text "Step n of 3 · Change limits" (2 of 2 when `{which}` was passed). Back on every step; the first has Cancel.

**Step 1: What to change?** (skipped with `{which}`). Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| What to change | cards with the current amount on the right: "Limit per person" (sub "Most one person can send in a day"), "Company daily limit" ("Most the company can send in a day"), "Two approvers above" ("Payments above this need two approvers"), "Extra code from" ("Payments from this amount need a code") | yes | one | "Choose what to change." |

**Step 2: New amount.** Button **Review**. A live box beside or under the field: **Now** (current amount) and **New** (the entered amount, "-" until valid); for the person limit a row "Company daily limit", for the company limit a row "Ceiling set by the bank"; when valid a row "Increase" or "Decrease" with the difference, and the line "A second administrator has to approve this." (increase, option on) or "This applies straight away." (decrease).

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| New {limit per person / company daily limit / two-approver threshold / extra code threshold} | amount in $, placeholder "0.00" | yes | greater than 0; different from now; person limit not above the company daily limit; company limit not above the bank ceiling and not below the highest of the other three; a threshold not above the company daily limit | "That is the same as now. Enter a different amount." / "It can’t be above the company daily limit of $1,000,000.00." / "The bank’s ceiling is $2,000,000.00." / "It can’t be below $250,000.00, the highest limit or threshold set now." |

Autofill sample: 200000.

**Step 3: Review.** Busy "Checking…" (about 0.55 s). Button **Confirm**.

| Row | Value |
|---|---|
| Setting | the setting’s name |
| Now | current amount |
| New | new amount |
| Change | "Increase of $…" or "Decrease of $…" |
| Takes effect | "After a second administrator approves" (increase, option on) or "Straight away" |
| Company | company name |

**Code prompt.** Title "Change {limit per person / company daily limit / two-approver threshold / extra code threshold} to {amount}", line "Code sent to ••• 4410." The sandbox code is 482100.

**Result.**

| Case | Title and line | Chip | Rows | Button |
|---|---|---|---|---|
| Increase, option on | "Sent for approval" / "Another administrator has to approve this increase. Your current limit stays until then." | "Waiting for approval" | Setting, Now, New, Company, Approval "Second administrator" | Back to limits |
| Decrease, or option off | "Limit changed" / "{Setting} is now {amount}." | Applied | Setting, Now, New, Company | Back to limits |

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `CHANGE_PENDING` | "A change to this is already waiting for approval." | review banner (a waiting change already covers this setting; Alpha’s extra code and Beta’s two-approver limit at the start) | back |
| `LIMIT_ABOVE_CEILING` | "The bank’s ceiling is lower than that." | review banner | back |
| `PERMISSION_DENIED` | "You can’t change limits at this company." | banner | back |
| `STEPUP_FAILED` | "The code didn’t work. Nothing was changed." | code sheet | start again |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was changed." | banner | try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | sheet or banner | try again |

The field messages of step 2 are checked again on Confirm. Loading: spinner on the review step. Empty: not applicable.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Company limits and approval rule | `corp.company.get` | Existing |
| Set a limit | `corp.limits.set` (request `{ which, value }`; errors above) | (planned) |
| Queue an increase | `corp.changes.create` | (planned) |

#### 6. Permissions, step-up and limits

`admin`. A code for every confirmed change. Increases need a second administrator while the option is on; decreases never do. The bank ceiling cannot be raised here. A payment that is already waiting keeps the rule it started with (planned: `required` is fixed at start).

#### 7. Result and links out

Activity log entry "Raise the {setting} from $X to $Y" or "Lower the …"; the result is Done, or Waiting for an increase. When a second administrator approves, the limit changes at once and the log gets "Approved raise the … (CHG-n)". Notification (planned): the other administrators are told a change is waiting. Link: Back to limits.

#### 8. Acceptance criteria

- AC-1: The four settings are listed with their current amounts.
- AC-2: A new amount that equals the current one, is zero, or breaks a rule of step 2 is refused with its message and the Review button stays disabled.
- AC-3: The live box shows Now, New and the difference, and says whether a second administrator is needed.
- AC-4: An increase ends in "Sent for approval" and the limit stays as it was; a decrease ends in "Limit changed" and the new amount shows under Limits.
- AC-5: A setting that already has a change waiting cannot be changed again (`CHANGE_PENDING`).
- AC-6: The code prompt names the setting and the amount; three wrong codes change nothing.
- AC-7: Approving a waiting increase on the admin view applies it.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Ravi at Alpha | Limit per person to 200,000.00; code 482100 | Live box "Decrease $50,000.00 · This applies straight away."; "Limit changed"; Limits shows $200,000.00 | AC-1, AC-3, AC-4 |
| T-2 | Ravi at Alpha | Company daily limit to 1,200,000.00 | "Sent for approval", chip "Waiting for approval"; Limits still $1,000,000.00; the card on Admin shows "Waiting for another administrator" | AC-4 |
| T-3 | Ravi at Alpha | Limit per person to 1,200,000.00; to 250,000.00; company to 2,500,000.00; company to 200,000.00 | The four field messages in order; Review disabled each time | AC-2 |
| T-4 | Ravi at Alpha | Extra code from, any amount | Review: "A change to this is already waiting for approval." | AC-5 |
| T-5 | Ravi at Alpha | Approve CHG-1042 on the admin view | Extra code from $30,000.00 | AC-7 |
| T-6 | Ravi at Alpha | Two approvers above to 40,000.00; wrong code three times | "The code didn’t work. Nothing was changed."; Limits unchanged | AC-6 |
| T-7 | Timeout on submit | Review | "We didn’t get an answer in time. Nothing was changed."; unchanged | AC-6 |
| T-8 | Bank unavailable | Review | "We couldn’t reach the bank. Nothing was changed."; unchanged | AC-6 |
| T-9 | Ravi at Alpha, option off | Company daily limit to 1,200,000.00 | Applies at once, "Limit changed" | AC-4 |
| T-10 | Alex at Alpha | Open Admin | Lock screen, no Change limits button | AC-1 |

#### 10. Expected mutation-check survivors

- The "below the highest of the other three" rule: survives unless a scenario sets the company limit below the person limit (T-3 does).
- The cents on the difference row: survive, amounts are round.
- The sample value 200000: survives, it is autofill only.
- The order of the four cards: survives.

---

### ★ Edit an approval group — `edit-signatory-group`

**Catalog**: slug `edit-signatory-group`, workspace business, category Admin, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Permission `admin`, does not move money. Options: *Second administrator approves group changes* (default on), *Allow approvers in order* (default on). Prototype file `design/bankworkx-r1/src/journeys/77-groups-requests.js`.

#### 1. Summary

| | |
|---|---|
| Slug | `edit-signatory-group` |
| Purpose | An administrator chooses who approves payments in one of the two approval groups ("Payments over 50,000" and "Payments up to 50,000") and how: any one of them, in order, or several together. A second administrator approves the change. |
| Release | 1 |
| Workspace | Business |
| Status | Built in the prototype; sandbox adapters (planned). The earlier group fields (name, account list, threshold, version) are gone: the two groups are fixed by the two-approver limit. |
| Channels | web, mobile |
| Who may use it | A context holding `admin` (Ravi at Alpha, Noor at Beta through the preview). |
| Journey type | Security journey: code prompt, timeout and unavailable scenarios. |
| Seed | Alpha: over, in order, Dana Cruz then Lee Park; up to, any one of Dana Cruz, Lee Park. Beta: the same with Alex Morgan and Lee Park. Candidates are active people with the Approver or Maker and approver role: Alpha Dana, Lee, Maria; Beta Alex, Lee, Maria, Sam. |

**Home market configuration**: none.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Admin › Approval groups › card › Edit group | `{group: "over" or "upto"}` | `admin` |

Parameters also accepted: `{mode}` (`any`, `seq`, `par`) and `{need}` (for tests). Without `{group}` the first step asks which group.

#### 3. Screens

Progress text "Step n of 3 · Edit approval group" (2 of 2 with `{group}`). Back on every step; the first has Cancel.

**Step 1: Which group?** (skipped with `{group}`). Button **Continue**. A required card choice, message "Choose a group.": "Payments over 50,000" and "Payments up to 50,000", each with its current line ("In order: Dana Cruz, then Lee Park").

**Step 2: Approvers.** Button **Review**, disabled while a red message shows. The group name sits at the top; under it the live message of the rule that fails (red), or "Change something to continue." (grey).

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| How they approve | chips: Any one; In order (only while *Allow approvers in order* is on); Several together. Hint: "One approver is enough." / "One after another, in the order below." / "A set number of them approve, in any order." | yes | one | "Choose how they approve." |
| How many must approve | chips 2 to the number of chosen approvers (at least 2), shown for Several together | no | 1 to the number of approvers | "Choose how many must approve, up to {n}." |
| Approvers | one switch per candidate (up to 6), by name | yes | at least one on | "Choose at least one approver." |
| Goes first | select, placeholder "Choose who goes first", shown for In order with two or more approvers | no | one of the chosen | none (the first switched-on person goes first if left empty) |

Rules shown as messages, in this order: at least one approver; Several together needs a number up to the count; the group "Payments over {amount}" needs at least two approvers ("Payments over 50,000 need two approvers. Choose In order or Several together."); "Add at least {n} approvers."; a lone Maker ("The person who starts payments can’t be the only approver."); "If {name} starts a payment, there would not be enough other approvers."; and "Change something to continue." when the result equals the current group. In order means every chosen person, in the order given; Any one needs one.

**Step 3: Review.** Busy "Checking…" (about 0.55 s). Button **Confirm**.

| Row | Value |
|---|---|
| Group | "Payments over 50,000" |
| Now | the current line |
| New | the new line ("Several together" reads "2 of 3 together: Dana Cruz, Lee Park, Maria Silva") |
| Takes effect | "After a second administrator approves" (option on) or "Straight away" |
| Payments waiting | "Keep their current approvers" (only when payments are waiting at this company) |

**Code prompt.** Title "Change payments over 50,000" (the group name in lower case), line "Code sent to ••• 4410." The sandbox code is 482100.

**Result.**

| Case | Title and line | Chip | Rows | Button |
|---|---|---|---|---|
| Option on | "Sent for approval" / "Another administrator has to approve this. The current group stays until then." | "Waiting for approval" | Group, Approvers (names), How ("Any one", "In order" or "2 of 3"), Company, Approval "Second administrator" | Back to groups |
| Option off | "Group updated" / "{Group} now has the new approvers." | Applied | Group, Approvers, How, Company | Back to groups |

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `CHANGE_PENDING` | "A change to this group is already waiting for approval." | review banner | back |
| `NOT_ENOUGH_APPROVERS` | "There would not be enough approvers." | review banner (the step 2 messages are checked again) | back |
| `SEPARATION` | "The person who starts a payment can’t approve it." | review banner | back |
| `PERMISSION_DENIED` | "You can’t change approval groups at this company." | banner | back |
| `STEPUP_FAILED` | "The code didn’t work. Nothing was changed." | code sheet | start again |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was changed." | banner | try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | sheet or banner | try again |

Loading: spinner on the review step. Empty: not applicable.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Approvers today (one, or two above the limit) | `corp.company.get`, `corp.users.list` | Existing |
| Group list and update | `corp.signatories.list`, `corp.signatories.update` (errors above) | (planned) |
| Queue the change | `corp.changes.create` | (planned) |

#### 6. Permissions, step-up and limits

`admin`. A code for every confirmed change. A group over the two-approver limit needs two approvers. A payment already waiting keeps its current approvers; only payments started after the change use the new group (planned in the sandbox: the payment stores the group it started with).

#### 7. Result and links out

Activity log "Change approvers for payments over 50,000 to: In order: Dana Cruz, then Lee Park" with result Waiting (or Done when the option is off). When the second administrator approves, the group changes and the log gets the "Approved" entry. Notification (planned): the other administrators are told. Link: Back to groups.

#### 8. Acceptance criteria

- AC-1: Edit group opens on step 2 with the group’s current mode and approvers.
- AC-2: Any one, In order and Several together can be chosen (In order only while the option is on); Several together asks how many.
- AC-3: Each rule of step 2 shows its message and keeps Review disabled; an unchanged group says "Change something to continue."
- AC-4: The group over 50,000 cannot be set to Any one.
- AC-5: The result is "Sent for approval" and the current group stays; with the option off it is "Group updated".
- AC-6: A group that already has a change waiting is refused with `CHANGE_PENDING`.
- AC-7: The code prompt names the group; three wrong codes change nothing.
- AC-8: Payments already waiting keep their approvers (the review says so).

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Ravi at Alpha | Edit group over; Several together, 2 of Dana, Lee, Maria; code 482100 | Review "New: 2 of 3 together: …"; "Sent for approval"; Approval groups still show the old line | AC-1, AC-2, AC-5 |
| T-2 | Ravi at Alpha | Edit group over; choose Any one | Red "Payments over 50,000 need two approvers. Choose In order or Several together."; Review disabled | AC-4 |
| T-3 | Ravi at Alpha | Edit group up to; switch off both approvers | "Choose at least one approver." | AC-3 |
| T-4 | Ravi at Alpha | Open Edit group on "Payments up to 50,000" and change nothing | "Change something to continue." | AC-3 |
| T-5 | Ravi at Alpha | In order, three approvers, Goes first Lee Park | Review "In order: Lee Park, then Dana Cruz, then Maria Silva" | AC-2 |
| T-6 | Ravi at Alpha, option *Allow approvers in order* off | Open Edit group | In order is not offered | AC-2 |
| T-7 | Ravi at Alpha, a change to this group is already waiting | Review | "A change to this group is already waiting for approval." | AC-6 |
| T-8 | Ravi at Alpha, payments waiting | Review | Row "Payments waiting: Keep their current approvers" | AC-8 |
| T-9 | Ravi at Alpha | Confirm; wrong code three times | "The code didn’t work. Nothing was changed." | AC-7 |
| T-10 | Ravi at Alpha, option off | Confirm | "Group updated"; Approval groups show the new line | AC-5 |
| T-11 | Timeout on submit | Review | "We didn’t get an answer in time. Nothing was changed." | AC-7 |
| T-12 | Bank unavailable | Review | "We couldn’t reach the bank. Nothing was changed." | AC-7 |
| T-13 | Alex at Alpha | Open Admin | Lock screen, no Edit group button | AC-1 |

#### 10. Expected mutation-check survivors

- The upper limit of six approver switches: survives, no company has six candidates.
- The "Goes first" default when left empty: survives unless T-5 omits it.
- The order of the three mode chips: survives.
- The wording of the group name when the two-approver limit changes (for example 60,000 at Beta after CHG-1043): survives, no scenario reads it.

---

## Business: More

Shell screens for the **More** tab, the view `business-requests`, the journey `business-service-request`, and the public journey `kyb-onboarding` (Open a business account, reached from the landing page).

### Shell: Business profile

| | |
|---|---|
| Purpose | Show the company's details as the bank holds them, read-only. |
| Route | Web: `/{project}/business/{companyId}/more/profile`. Mobile: `Business/More/Profile`. |
| Data source | `businessProfile(ctx)` (planned) over `corp.profile.get` (planned; request none; response `{ id, name, legalName, registrationNo, taxId, address, country, currency, industry, signatories: string[], relationshipManager: { name, phone, email }, since }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; read-only). |
| Permission | any business permission (everyone in the company) |

**Widgets**: Company card (name, legal name, registration number masked to the last 4, address); Banking card (currency, accounts count, approval rule, cut-off, from `corp.company.get`); Contacts card (relationship manager with *Call* and *Email* buttons; on web, a mailto link); *Request a change* → `business-service-request` `{type: "change_details"}` (needs `biz.requests.create`). The journey `kyb-onboarding` is not started from here: it is a public journey reached from the landing page (Business › Open a business account).
**States**: loading skeleton cards; error and timeout as in Accounts. No empty state (a company always has a profile).

### Shell: Service requests

This screen is the view `business-requests` (block below, after `business-service-request`).

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

**Catalog**: slug `business-service-request`, workspace business, category More, core no, a bank can switch it off (yes), kept in the Lean preset (basic). Permission `accounts.view`, does not move money. Options: *Offer cheque books* (default on). Prototype file `design/bankworkx-r1/src/journeys/77-groups-requests.js`.

#### 1. Summary

| | |
|---|---|
| Slug | `business-service-request` |
| Purpose | A person at the company asks the bank for something that is not a payment: add an account, close an account, update company details, order a cheque book, or something else. The request is listed under Service requests. |
| Release | 1 |
| Workspace | Business |
| Status | Built in the prototype; adapter `corp.requests.create` (planned). The earlier "change details", "review our limits" and attachment steps are gone, and no code is asked. |
| Channels | web, mobile |
| Who may use it | Any person with `accounts.view` at the company (Alex at Alpha and at Beta). |
| Seed | Alpha accounts Operating ••2001 USD and Reserve ••2044 EUR; Beta Operating ••3001 and Payroll ••3002. The requests are recorded as "Alex Morgan". |

**Home market configuration**: none. The account currencies offered are USD, EUR, GBP and AED.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| More › Service requests › New request (also the button on an empty list) | none | `accounts.view` |
| Accounts › detail › Order a cheque book | `{type: "cheque", accountId}` | `accounts.view` (the account screen has no such button yet; the entry exists in the journey) |

With `{type}` the first step is skipped.

#### 3. Screens

Progress text "Step n of 3 · Service request" (2 of 2 with `{type}`). Back on every step; the first has Cancel.

**Step 1: What do you need?** Button **Continue**. A required card choice, message "Choose what you need.": Add an account, Close an account, Update company details, Cheque book (only while the option is on), Other.

**Step 2: Tell us more.** Button **Review**. Fields shown by type:

| Field | Shown for | Type | Required | Rule | Message |
|---|---|---|---|---|---|
| Currency | Add | select USD, EUR, GBP, AED, placeholder "Choose a currency" | yes | one | field required |
| What it is for | Add | select: Day-to-day payments, Payroll, Tax, Savings, Other | yes | one | field required |
| Account | Close, Cheque book | select of the company’s accounts ("Operating ••2001 · USD") | yes | one; Close needs two or more accounts | "Choose an account." / "You can’t close the only account." |
| Move the balance to | Close, when the account has a balance | select of the other accounts | yes | one | field required |
| Reason | Close | select: No longer needed, Moving to another bank, Company is closing, Other | yes | one | field required |
| What to update | Update | select: Registered address, Contact details, Company name, Owners or directors, Signatories | yes | one | field required |
| Number of leaves | Cheque book | chips 25, 50, 100 | yes | one | "Choose how many leaves." |
| Delivery | Cheque book | select: Collect at a branch, Post to the registered address | yes | one | field required |
| Subject | Other | text, max 80 | yes | at least 5 characters | "Add a short subject (at least 5 characters)." |
| Details | Update, Other | text area, max 1000 | yes | at least 10 characters | "Tell us a little more (at least 10 characters)." |
| Contact phone | all | tel, hint "With the country code." | yes | `+` then 8 to 16 digits and spaces | "Enter a phone number with the country code, like +1 415 555 0100." |

Autofill samples: Question about statements; Please change our registered address to the new office.; +1 415 555 0100.

**Step 3: Review.** Busy "Sending…" (about 0.65 s). Button **Send request**.

| Row | Value |
|---|---|
| Request | the type name |
| About | the subject: "New EUR account", "Close Reserve ••2044", "Update registered address", "Cheque book, Operating", or the typed subject |
| Leaves, Delivery | Cheque book only |
| Balance goes to | Close with a balance |
| Phone | as typed |
| Company | company name |

A required tick: "I confirm these details are correct and I’m allowed to ask for this for {company}." (message "Confirm to send."). No code is asked.

**Result** "Request sent", line "We’ll update you under Service requests.", chip "Received", then the reference (REQ-nnnnn). Rows: Request, About, Company. Buttons **Go to requests** (opens `business-requests`), **Send another**.

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `REQUEST_DUPLICATE` | "You already have an open request about this. Wait for our reply." | review banner (same type and subject, not yet Done or Declined) | back |
| `REQUEST_LIMIT_REACHED` | "You have sent the most requests allowed today (5). Try again tomorrow." | review banner | back |
| `ACCOUNT_NOT_FOUND` | "We can’t find that account. Choose another." | review banner | back |
| `PERMISSION_DENIED` | "You can’t send requests at this company." | banner | back |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was sent." | banner | try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was sent." | banner | try again |

Loading: spinner on the review step. Empty: not applicable.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Accounts of the company | `corp.company.get` | Existing |
| Create a request | `corp.requests.create` (request `{ type, subject, details?, accountId?, phone }`; response `{ id, status: "received" }`; errors above) | (planned) |
| List requests | `corp.requests.list` | (planned), see `business-requests` |

#### 6. Permissions, step-up and limits

`accounts.view`. No code (open question 7 asks whether company details and limits should need one). Up to 5 requests a day per person; no second open request with the same type and subject.

#### 7. Result and links out

A new request is added at the top of Service requests with status Received and date "Today". Notification (planned): the bank’s operations team; the person gets an update when the status changes. Links: Go to requests, Send another.

#### 8. Acceptance criteria

- AC-1: The five types are offered; Cheque book only while the option is on.
- AC-2: The fields of step 2 follow the type; every required one blocks Review.
- AC-3: The only account cannot be closed; closing an account with a balance asks where it goes.
- AC-4: A request cannot be sent without the confirmation tick.
- AC-5: The result gives a reference and the request appears at the top of Service requests as Received.
- AC-6: A second open request with the same type and subject, and a sixth request in a day, are refused with their messages.
- AC-7: A timeout or an unavailable bank sends nothing.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | Add an account: EUR, Savings, +1 415 555 0100; tick; send | "Request sent", chip Received, About "New EUR account"; the list shows it first | AC-1, AC-2, AC-5 |
| T-2 | Alex at Alpha | Close an account: Reserve, move the balance to Operating, reason Other | Review "Balance goes to Operating ••2001"; sent | AC-3 |
| T-3 | A company with one account | Close an account | "You can’t close the only account." | AC-3 |
| T-4 | Alex at Alpha | Cheque book, Operating, 50 leaves, branch | About "Cheque book, Operating"; REQ-30418 already Done, so no duplicate | AC-1, AC-6 |
| T-5 | Alex at Alpha | Other: subject "Hi" | "Add a short subject (at least 5 characters)." | AC-2 |
| T-6 | Alex at Alpha | Leave the tick off | Send disabled with "Confirm to send." | AC-4 |
| T-7 | Alex at Alpha | Send the same Update request twice | "You already have an open request about this. Wait for our reply." | AC-6 |
| T-8 | Alex at Alpha, five requests sent today | Send another | "You have sent the most requests allowed today (5). Try again tomorrow." | AC-6 |
| T-9 | Option off | Open | Cheque book is not offered | AC-1 |
| T-10 | Timeout on submit | Review | "We didn’t get an answer in time. Nothing was sent."; no request | AC-7 |
| T-11 | Bank unavailable | Review | "We couldn’t reach the bank. Nothing was sent." | AC-7 |

#### 10. Expected mutation-check survivors

- The 5-per-day limit: survives unless T-8 sends exactly five.
- The list of "What to update" values: survives, one value is used.
- The 25/50/100 leaf counts: survive, one is used.
- The rule that the new request goes to the top: survives if only one request exists.

---

### ★ Service requests — `business-requests`

**Catalog**: slug `business-requests`, workspace business, category More, core no, a bank can switch it off (yes), kept in the Lean preset (basic). A view (tab `more`), not a journey. Permission `accounts.view`. Options: none. Prototype file `design/bankworkx-r1/src/journeys/77-groups-requests.js`.

#### 1. Summary

| | |
|---|---|
| Slug | `business-requests` |
| Purpose | Lists the requests sent to the bank from this company and where each one stands, and starts a new one. |
| Release | 1 |
| Workspace | Business (More tab) |
| Status | Built in the prototype; adapter `corp.requests.list` (planned). Replaces the earlier "Shell: Service requests" screen (filters, sort, a detail timeline and reply text are not in the prototype). |
| Channels | web, mobile |
| Who may use it | Any person with `accounts.view`. |
| Seed | Alpha: REQ-30418, Cheque book, "Cheque book, Operating", Done, 28 Oct. Beta: none. |

**Home market configuration**: none.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| More › Service requests | none | `accounts.view` |
| Result of `business-service-request` › Go to requests | none | `accounts.view` |

The More row appears only while this entry is on. Turning off `business-service-request` hides the New request button but keeps the list.

#### 3. Screens

**List.** Heading "Service requests" with the button **New request** on the right (starts `business-service-request`). A table with columns:

| Column | Content |
|---|---|
| Reference | the id ("REQ-30418") and the date below in small text ("28 Oct", "Today") |
| Type | Add an account, Close an account, Update company details, Cheque book, Other |
| About | the subject |
| Status | chip: Received (blue), In progress (amber), Done (green), Declined (grey) |

Newest first (a request sent now goes to the top). No filter, search, paging or detail page in the prototype (planned: a status filter and a detail with the bank’s reply).

#### 4. States and errors

| State | What the person sees |
|---|---|
| Empty (Beta, or no requests) | "No requests yet" / "Requests you send to the bank are listed here." with the button **New request** |
| Loading, error, timeout | not shown in the prototype (planned: skeleton rows; "We couldn’t load this. Nothing was changed." with **Try again**) |

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| List this company’s requests | `corp.requests.list` (request `{ status? }`; response record keyed by id `{ id, type, subject, status, createdAt, createdBy }`; errors `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`) | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. Read-only. Requests are kept per company: Alpha’s never show at Beta.

#### 7. Result and links out

Link: New request (`business-service-request`). Notification (planned): "Your request REQ-n is Done".

#### 8. Acceptance criteria

- AC-1: The list shows the company’s own requests with reference, type, about and status chip, newest first.
- AC-2: A request just sent appears at the top with the status Received and the date "Today".
- AC-3: An empty list shows the empty message and a New request button.
- AC-4: Requests of the other company are not shown.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Alex at Alpha | More › Service requests | One row, REQ-30418, Cheque book, chip Done | AC-1 |
| T-2 | Alex at Alpha | Send a request, tap Go to requests | New row first with Received and "Today"; REQ-30418 second | AC-2 |
| T-3 | Alex at Beta | More › Service requests | "No requests yet" and a New request button | AC-3, AC-4 |
| T-4 | Alex at Alpha, then Beta | Switch company | Beta shows none of Alpha’s requests | AC-4 |

#### 10. Expected mutation-check survivors

- The chip colour per status: survives, only the text is asserted.
- The small date line: survives unless the date is asserted.
- The "In progress" and "Declined" statuses: survive, the seed has only Done.

---

### ★ Open a business account — `kyb-onboarding`

**Catalog**: slug `kyb-onboarding`, workspace public (before sign-in), category Onboarding, core no, a bank can switch it off (yes), not in the Lean preset. Options: *Ask for an ownership chart* (default off), *Email each owner and director an ID check* (default on; listed in the catalog but not read by any screen yet). Prototype file `design/bankworkx-r1/src/journeys/78-kyb.js`. The catalog row in `10-journey-catalog.md` still files it under Business: More.

#### 1. Summary

| | |
|---|---|
| Slug | `kyb-onboarding` |
| Purpose | A company applies for business banking without signing in: company details, owners and directors, what the business does, documents, a tax declaration, a review with two agreements, and a status tracker. |
| Release | 1 (the earlier "stretch") |
| Workspace | Public (Landing › Business) |
| Status | Built in the prototype; adapter `corp.kyb.submit` (planned). The earlier save-and-resume, e-signature, upload-checks and per-owner screens are gone. |
| Channels | web, mobile |
| Who may use it | Anyone before sign-in. No permission, no code. |
| Journey type | Onboarding: timeout and unavailable scenarios. |

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Landing › Business › Open a business account | none | none |

#### 3. Screens

Progress text "Step n of 6 · Open a business account". Back on every step (the first has Cancel). A step that calls the bank shows a spinner and the busy text.

**Home market configuration**

| | Market A (routing number and account) | Market B (sort code and account) | Market C (IBAN) | Market D (IBAN, mobile alias) |
|---|---|---|---|---|
| Tax ID | 9 digits | 10 digits | 8 to 14 letters or digits | 15 digits |
| Tax ID message | "Enter the 9 digits." | "Enter the 10 digits." | "Use 8 to 14 letters or digits." | "Enter the 15 digits." |
| Autofill sample | 123456789 | 1234567890 | DE12345678 | 100123456700003 |
| Money bands use | $ | £ | € | AED |
| Postal code | required | required | required | optional |

**Step 1: Your company.** Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Legal name | text, max 100 | yes | at least 2 characters | field required |
| Trading name (if different) | text, max 100 | no | | none |
| Registration number | text, max 20 | yes | 5 to 20 letters, digits, `-`, `/`, space | "Use 5 to 20 letters or digits." |
| Type of company | select: Private company, Public company, Partnership, Sole trader, Non-profit organisation | yes | one | field required |
| Date of incorporation | text, placeholder "DD/MM/YYYY" | yes | a real date; not in the future; year 1900 or later | "Enter the date as DD/MM/YYYY." / "The date can’t be in the future." / "Check the year." |
| Country of registration | select of 16 countries | yes | one | field required |
| Registered address | text, max 80 | yes | | field required |
| City | text, max 40, half width | yes | | field required |
| Postal code | text, max 12, half width | per market | | field required |

Autofill samples: Harbour Trading Ltd, Harbour, REG-2015-0412, 14/03/2015, 12 Example Street, Springfield, 62704.

**Step 2: Owners and directors.** Button **Continue**, disabled while a red line shows. Up to five people; person 1 starts as "Owner and director". Buttons **Add another person** (until five) and **Remove last** (when more than one).

| Field (per person) | Type | Required | Rule | Message |
|---|---|---|---|---|
| Full name | text, max 60 | yes | starts with a letter; letters, space, apostrophe, hyphen, full stop | "Enter their full name." |
| Email | email, hint "We send an ID check here.", max 80 | yes | valid email | "Enter a valid email, like name@company.com." |
| Role | select: Owner and director, Owner, Director | yes | one | field required |
| Ownership (%) | number, hint "25 to 100. Smaller owners go under other owners." | yes, for Owner roles | 25 to 100 | "Enter 25 to 100." |

After the people: **Other owners (%)**, number, hint "Owners with less than 25% each, combined.", 0 to 75, default 0, message "Enter 0 to 75." A live box: "Ownership listed {n}%" and either "Ownership adds up to 100%." or a red line "Ownership adds up to {n}%. It must be 100%." / "Add at least one director." Autofill: Maya Chen, maya.chen@example.com, 100.

**Step 3: Your business.** Button **Continue**. All required, selects unless noted:

| Field | Values or rule | Message |
|---|---|---|
| Industry | Retail and wholesale, Transport and logistics, Construction, Food and hospitality, Professional services, Technology, Manufacturing, Health and education, Other | field required |
| What the company does | text area, max 300, at least 10 characters | "Tell us a little more." |
| Main country of trade | the country list | field required |
| Yearly turnover | four bands in the market’s money sign: Under 100,000; 100,000 to 500,000; 500,000 to 2M; Over 2M | field required |
| Expected money in each month | Under 50,000; 50,000 to 250,000; 250,000 to 1M; Over 1M | field required |
| Payments each month | Up to 20, 21 to 100, 101 to 500, Over 500 | field required |
| Where the money comes from | Sales to customers, Investors or owners, Loans, Grants, Other | field required |

**Step 4: Documents.** Intro "PDF, JPG or PNG, up to 10 MB." Button **Continue**. Uploads: Registration certificate (required, "Add the certificate."), Proof of registered address (required, "Add a proof of address."), Ownership chart (optional, shown only while the option is on). Autofill adds sample files (document-1.pdf 1.2 MB, document-2.pdf 0.9 MB, document-3.pdf 0.6 MB).

**Step 5: Tax declaration.** Button **Continue**.

| Field | Type | Required | Rule | Message |
|---|---|---|---|---|
| Country of tax residence | select, country list | yes | one | field required |
| Tax ID | text, max 20, placeholder as the market table | yes | the market’s pattern; spaces and hyphens ignored | the market’s message |
| Does most of the income come from investments? | chips No, Yes (default No) | no | | none |

**Step 6: Review and agree.** Busy "Sending…" (about 0.9 s). Button **Submit**. Rows: Company, Registration number, Type, Registered in, People (the count), Industry, Tax ID ("•••• " and the last 3 characters). Two required ticks: "I agree to the terms and the privacy notice." (message "Please agree to continue.") and "I confirm these details are true and I can apply for the company." (message "Please confirm to continue."). No code is asked.

**Step 7: Your application** (after submit). A tick, "Application received", "Reference KYB-nnnnn", and a tracker: Received (done: "We have your application."), Checking your documents (current: "This usually takes 1 to 2 working days."), Identity checks ("We email each owner and director."), Account ready ("You can sign in and pay."). Button **Finish**.

**Result** "You’re all set", line "We’ll email you when your account is ready.", amber chip "Checking your documents", the reference, rows Company and Registration number.

#### 4. States and errors (codes are for tests; the person sees the message)

| Code | Message | Where | Button |
|---|---|---|---|
| `DUPLICATE_APPLICATION` | "We already have an application for this registration number." (the prototype triggers it with the registration number DUPLICATE) | review banner | back |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was sent. Try again." | sheet or banner | try again |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was sent." | banner | try again |

Loading: spinner on step 6. Empty: not applicable.

#### 5. Adapters

| Integration | Adapter | Status |
|---|---|---|
| Submit the application with documents | `corp.kyb.submit` (errors above) | (planned) |
| Upload a document | `corp.kyb.upload` | (planned) |
| Email the ID check to each person | `bank.notify.send` | (planned) |

Nothing in the mock bank handles company applications today.

#### 6. Permissions, step-up and limits

None before sign-in. Documents up to 10 MB, PDF, JPG or PNG. At most five named people plus a combined share for smaller owners. The tax ID is shown masked on review and in the result.

#### 7. Result and links out

A reference KYB-nnnnn is created. Notification (planned): an email to the applicant and an ID-check email to each owner and director (option). Links: none (the Finish button returns to the landing page).

#### 8. Acceptance criteria

- AC-1: The six steps run in order; each required field blocks Continue with its message.
- AC-2: Owners and directors cannot continue unless ownership adds up to 100% and at least one person is a director.
- AC-3: The tax ID follows the bank’s home market and the money bands use its sign; the screens name no country.
- AC-4: The registration certificate and proof of address are required; the ownership chart appears only while its option is on.
- AC-5: Submit needs both ticks.
- AC-6: The tax ID is masked on review.
- AC-7: A registration number already applied for is refused with the message of section 4.
- AC-8: A timeout or an unavailable bank sends nothing.

#### 9. Scenarios

| # | Persona and setup | Steps | Expected | Covers |
|---|---|---|---|---|
| T-1 | Visitor, Market A | Autofill all steps; tick both; Submit; Finish | Tracker "Application received"; result "You’re all set"; chip "Checking your documents" | AC-1, AC-5 |
| T-2 | Visitor | Two people at 60% and 40%, other owners 0 | Continue enabled | AC-2 |
| T-3 | Visitor | One owner at 50%, other owners 0 | "Ownership adds up to 50%. It must be 100%." | AC-2 |
| T-4 | Visitor | One person with role Owner only, 100% | "Add at least one director." | AC-2 |
| T-5 | Visitor, Market B | Tax ID 123 | "Enter the 10 digits." | AC-3 |
| T-6 | Visitor, Market D | Open step 1 | Postal code is optional | AC-3 |
| T-7 | Visitor | Leave a document out; then option on | Required ones block; the chart field appears only with the option | AC-4 |
| T-8 | Visitor | Review without ticks | Submit disabled with the two messages | AC-5 |
| T-9 | Visitor | Review | Tax ID shown as "•••• 789" | AC-6 |
| T-10 | Visitor | Registration number DUPLICATE | "We already have an application for this registration number." | AC-7 |
| T-11 | Timeout on submit | Submit | "We didn’t get an answer in time. Nothing was sent." | AC-8 |
| T-12 | Bank unavailable | Submit | "We couldn’t reach the bank. Nothing was sent. Try again." | AC-8 |

#### 10. Expected mutation-check survivors

- The five-person maximum: survives unless a scenario adds a sixth.
- The money band edges: survive, the band label is not asserted.
- The year 1900 check: survives.
- The option *Email each owner and director an ID check*: survives, no screen reads it.

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
| Alpha Trading LLC | Currency USD; account `alpha_ops` "Operating" ••2001 USD 480,000.00; supplier `sup_harbour` "Harbour Packaging"; company limit 1,000,000.00, used 0; approval threshold 50,000.00; cut-off 16:00; Alex = Maker (`initiator`), personal daily limit 250,000.00; approvers `dana`, `lee`; administrators `ravi` and `mina` (change CHG-1042 from `mina` waiting: extra code from 25,000.00 to 30,000.00) |
| Beta Services Ltd | Currency USD; account `beta_ops` "Operating" ••3001 USD 310,000.00; supplier `sup_nimbus` "Nimbus Logistics"; company limit 1,000,000.00, used 0; threshold 50,000.00; Alex = Approver; makers `priya`, `omar`; administrators `noor` and `karim` (change CHG-1043 from `karim` waiting: two approvers above 50,000.00 to 60,000.00). One payment waiting: `priya` started USD 8,200.00 to Nimbus Logistics, reference "INV-2291" (id `pay_1` at Beta) |
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
- Assertion: the first switch attempt throws `STEP_UP_REQUIRED` and the context is still `personal`; a wrong code 3 times leaves the context `personal`; the right code makes `activeContextId` `alpha`; the selector shows "Alpha Trading LLC" with badge "Maker"; the shell shows the Overview tab; the menu contains Payments but **no Approvals action**, and the Admin tab shows only "You don’t have access"; `session.permissions` contains `biz.payments.initiate` and not `biz.approvals.approve`; Personal data (the transfer) is not in the view-model.

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
3. In the prototype a second administrator must approve limit increases, any change involving an administrator and any approval group change (options, on by default). Should decreases and other changes need one too?
4. Account permission changes (the grid) are a shell action here, not a journey. Should they be a journey (`change-account-permissions`) with full proof? That would make 16 SME journeys.
5. The activity log on the Admin tab has no export in Release 1. Should administrators be able to export it?
6. Should creating a statement raise a notification (in-app) when the file is ready? Release 1 says no because it is immediate.
7. `business-service-request` needs no one-time code. Is that right for "Update company details", which could be security relevant?
8. Payment ids are numbered per company (`pay_1` at both Alpha and Beta). Should the sandbox use globally unique ids (`pay_a_1`, `pay_b_1`) so a payment id never needs its company?
9. Step 12 needs a way for another user (`omar`) to act while Alex is signed in. The test calls the Beta sandbox directly. Should the "Sandbox conditions" panel offer a dev-only "Act as someone else" button for the live demo?
10. Should the 13-step test also run against Bank B (`corpProvider: "bank-b"`) as the existing 11 corporate tests do?

**About context switching**
11. Should Personal show the company name in a notification for another context ("Payment awaiting your approval, Beta Services Ltd")? It is a small disclosure of Alex's employment. This spec allows the company name and the generic title only.
12. Step-up validity is 5 minutes here. Is that the bank's policy, and should switching Business to Business within that time skip the step-up? This spec skips it.
13. Does a person who is Maker at Alpha need step-up to go from Alpha to Beta? This spec says yes unless the step-up is still valid.
14. In `TIMEOUT` on a switch, the sandbox does not apply it (README 1.5). A real bank may have applied it. Should the shell re-read `bank.session.get` after a timeout to find out where the person is?

**Grounding notes (could not be grounded in code today)**: `bank.session.*`, signatory groups, admin roles, audit trail, limits changes, statements, KYB and all `corp.accounts.*`, `corp.users.*` (apart from `corp.users.list`), `corp.limits.*`, `corp.signatories.*`, `corp.audit.*`, `corp.requests.*`, `corp.messages.*`, `bank.notifications.*` and `bank.settings.*` are new. Alex's contexts, Alpha, Beta and their users, balances and payments are the planned seed from README 1.7; the amounts and supplier names in the demo are proposals. The existing role names are `initiator` and `approver`; `admin` is new.

