# Module 2: SME (Business "Graphite") and the combined Alex Morgan demo

**Release 1. Workspace: Business.** Small and medium companies: a Maker starts payments, an Approver approves them, an Admin manages people and limits. The same person can hold different roles in different companies: Alex Morgan is Maker at Alpha Trading LLC and Approver at Beta Services Ltd, with a Personal relationship besides.

**What exists today:** the Meezan-only `CorporateSandbox` (`packages/mock-bank-api/src/corporate.ts`, `docs/CORPORATE.md`) with maker-checker, whitelist, limits, threshold, cut-off, bulk and payroll; Bank B behind the same `corp.*` adapters; five journeys in `packages/journey-schema/src/fixtures/` (`corporate-payments.ts` holds two). **What is planned:** workspaces and contexts, Alpha and Beta, an Admin role, shell screens, `dataTable`, `fileUpload`, `timeline`, `chart`, and the identity and conditions work (README 2.3, 1.5).

**Seed values** used throughout this file (planned, one table so the three parts agree): Alpha Trading LLC and Beta Services Ltd both USD; Alex's daily limit at Alpha 250,000.00; company daily limit 1,000,000.00 at each (bank ceiling 2,000,000.00); two approvers above 50,000.00; step-up amount 25,000.00; batch cap 20 items; file cap 256 KB.

## Journey index

| Group | Journeys |
|---|---|
| Accounts | `business-statement` |
| Payments | `supplier-payment`, `add-supplier`, `payment-template`, `schedule-business-payment`, `withdraw-payment` |
| Bulk and payroll | `bulk-payment`, `repair-bulk-lines`, `payroll-run` |
| Approvals | `approve-payments` |
| Admin | `manage-user`, `change-limits`, `edit-signatory-group` |
| More | `business-service-request`, `kyb-onboarding` (stretch) |

**15 journeys** (14 plus the stretch). Existing fixtures behind them: `corporate-payment` (becomes `supplier-payment`), `corporate-approval` (becomes `approve-payments`), `bulk-payment`, `payroll-run`, `withdraw-a-payment` (becomes `withdraw-payment`).

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

Shell screens for the **Accounts** tab of Business "Graphite", and the one journey on it, `business-statement`. All are Release 1. Data comes from view-models in `packages/bank-client` over the active context (the company the person switched to). Nothing here shows data from another company or from Personal.

Common to every screen on this tab: the permission `biz.accounts.view` is needed to see it; the Export buttons need `biz.accounts.export`. Without `biz.accounts.view` the tab is not in the menu, and a forced adapter call answers `PERMISSION_DENIED` (planned). Amounts are in each account's own currency and decimals (`currencyInfo`, `roundMoney`). Totals are never added across currencies (the same rule as `bank.accounts.totals` for Personal). Account rows only appear if the person's role includes that account (see *Admin › Account permissions*).

New sandbox adapters used by this tab (all *planned*, read-only, `moneyMoving: false`, `requiresOtp: false`):

| Adapter | Request | Response | Error codes |
|---|---|---|---|
| `corp.accounts.list` (planned) | none (company and user from the active context) | record keyed by account id: `{ id, name, maskedNumber, iban, currency, ledgerBalance, availableBalance, status ("active" or "dormant" or "blocked"), type ("current" or "savings" or "payroll" or "collection"), lastActivityAt }` | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `corp.accounts.get` (planned) | `{ accountId }` | one account as above, plus `holdsToday` (money reserved by payments waiting for approval), `signatories` (names), `openedAt` | `ACCOUNT_NOT_FOUND`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `corp.transactions.list` (planned) | `{ accountId?, from?, to?, direction?, minAmount?, maxAmount?, text?, status?, reference?, sort?, page?, pageSize? }` | `{ rows: record keyed by transaction id, total, page, pageSize, sumIn, sumOut, currency }`; row `{ id, accountId, bookedAt, valueDate, description, counterparty, reference, amount (signed), currency, runningBalance, status ("booked" or "pending"), paymentId? }` | `ACCOUNT_NOT_FOUND`, `INVALID_RANGE`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |

### Shell: Accounts table (multi-account, multi-currency)

| | |
|---|---|
| Purpose | One place to see every account the person may see at this company, in every currency. |
| Route | Web: `/{project}/business/{companyId}/accounts`. Mobile: `Business/Accounts`. |
| Data source | View-model `businessAccounts(ctx)` (planned) over `corp.accounts.list` and `corp.company.get`. |
| Permission | `biz.accounts.view` |

**Widgets, top to bottom**
1. **Totals strip**: one tile per currency the company holds, e.g. "USD 480,000.00 available · 3 accounts". No tile adds two currencies. A tile is a filter: tap it to show only that currency.
2. **Accounts table** (`dataTable`, planned; card list on phones).
3. **Holds line** under the table: "Payments waiting for approval hold USD 12,500.00 of your balance." Shown only when `holdsToday` is above zero. The money has not left; the sandbox releases or frees the hold on approve, reject or withdraw.

**Table columns** (web; on phones each row is a card showing 1, 2, 4 and 5)

| # | Column | Content | Sortable |
|---|---|---|---|
| 1 | Account | Name, then masked number below ("Operating ••2001") | Yes (A to Z) |
| 2 | Type | Current, Savings, Payroll or Collection (`statusChip`-style label) | Yes |
| 3 | Currency | ISO code | Yes |
| 4 | Available | Amount in the account currency, right-aligned | Yes |
| 5 | Ledger | Amount; greyed when equal to available | Yes |
| 6 | Status | `statusChip`: Active (green, tick icon), Dormant (amber, clock icon), Blocked (red, lock icon). Colour is never the only signal. | Yes |
| 7 | Last activity | `12 Nov 2026` | Yes |

**Filters**: currency (chips: All plus one per currency held), status (chips), type (chips), search box (matches name and masked number). **Default sort**: Available, high to low, within currency groups ordered by the company's base currency first. **Page size**: 25.

**States**
- Loading: five skeleton rows and three skeleton tiles.
- Empty (company has no accounts the person may see): "You don't have access to any accounts at {company} yet. Ask an administrator at {company}." No button.
- Filtered to nothing: "No accounts match. Clear filters." Button: *Clear filters*.
- Error (`SERVICE_UNAVAILABLE`): "This service is not available right now. Nothing was changed. Please try again in a few minutes." Button: *Try again*.
- Timeout (10 s): "This is taking longer than expected. Nothing was changed." Button: *Try again*.

**Drill-downs**: tap a row → *Account detail*. Tap a currency tile → filter. **Launch points on it**: *Accounts › list › Statement or report* (row menu) opens `business-statement` with `{accountId}`; permission `biz.accounts.export`.

### Shell: Account detail

| | |
|---|---|
| Purpose | One account: balances, recent activity, who signs for it, and quick actions. |
| Route | Web: `/{project}/business/{companyId}/accounts/{accountId}` (split view: list on the left, detail on the right at 1024 px and wider). Mobile: `Business/Accounts/Detail`. |
| Data source | `businessAccountDetail(ctx, accountId)` (planned) over `corp.accounts.get` and `corp.transactions.list { accountId, pageSize: 10 }`. |
| Permission | `biz.accounts.view` |

**Widgets**
1. **Header**: account name, masked number, IBAN with a *Copy* button, `statusChip`.
2. **Balance card**: Available (large, rolls up when it changes), Ledger, "Held for payments waiting approval". Labels: "Available balance", "Ledger balance", "On hold".
3. **30-day balance chart** (`chart`, planned; line): ledger balance per day. Alt text: "Balance over the last 30 days. Lowest {x}, highest {y}."
4. **Recent transactions**: the last 10 rows (date, description, signed amount), then *View all transactions*.
5. **Signatories**: the people who can approve payments from this account, from `signatories` (names and role badges).
6. **Actions row**: *Statement or report* (→ `business-statement`, `{accountId}`, needs `biz.accounts.export`), *Pay a supplier from this account* (→ `supplier-payment`, needs `biz.payments.initiate`, shown only to a Maker).

**States**: loading (skeleton balance card, chart and five rows); account not found or not permitted → "We can't find that account. Choose another." with *Back to accounts* (`ACCOUNT_NOT_FOUND`; `PERMISSION_DENIED` shows the S-`PERMISSION_DENIED` message); error and timeout as above. An account with no activity: "No transactions yet." (no button).

**Drill-downs**: a transaction row → *Transaction detail* (a side sheet on web, a full screen on mobile) with date, value date, description, counterparty, reference, amount, running balance, status, and, when `paymentId` is set, *View payment* (→ Payments tracker detail, needs `biz.accounts.view`).

### Shell: Transaction table with advanced filters and export

| | |
|---|---|
| Purpose | Find any transaction on any permitted account, narrow it down, and export what you see. |
| Route | Web: `/{project}/business/{companyId}/accounts/transactions`. Mobile: `Business/Accounts/Transactions`. |
| Data source | `businessTransactions(ctx, filters)` (planned) over `corp.transactions.list`. Filters are kept in the address on web (so a filtered view can be shared inside the company) and cleared on a context switch (README 5.4). |
| Permission | `biz.accounts.view`; Export needs `biz.accounts.export`. |

**Filters** (a filter bar on web; a *Filters* bottom sheet on phones)

| Filter | Block | Rule |
|---|---|---|
| Account | `select` (all permitted accounts, or "All accounts") | Default: all |
| Date range | `datePicker` range (planned) | Default: last 30 days. Presets: Today, Last 7 days, Last 30 days, This month, Last month, Custom. From not after To; range at most 12 months. Error: "Choose a start date that is before the end date." / "The range can be at most 12 months." |
| Direction | chips: All, Money in, Money out | Default: All |
| Amount | two `amountInput` (From, To) | From not above To. Error: "The smallest amount can't be above the largest." |
| Status | chips: All, Booked, Pending | Default: All |
| Text | `textInput` | Matches description, counterparty and reference, case-insensitive |
| Reference | `textInput` | Exact start of reference |

**Columns**: Date (booked), Value date, Account (name and ••number), Description, Counterparty, Reference, Money in (green, +), Money out (charcoal, −), Balance (running; only when one account is selected), Status (`statusChip`). Money in and out are separate columns so sign never relies on colour.

**Sort**: Date, newest first (default); every column sortable except Description. **Page size**: 50, with a footer "Showing 1 to 50 of {total}". A totals bar above the table shows "Money in {sumIn} · Money out {sumOut} · {n} transactions" for the filtered set, per currency when more than one is shown.

**Export** (button *Export*, top right): opens `business-statement` with `{accountId, from, to}` taken from the current filters (account "All accounts" is passed as no `accountId`). The journey pre-fills and skips to the review when all three are present. Without `biz.accounts.export` the button is hidden.

**States**
- Loading: ten skeleton rows.
- Empty (no filters set, no transactions): "No transactions yet."
- Empty (filters set): "No transactions match these filters." Button: *Clear filters*.
- Error and timeout: as for the Accounts table.
- Invalid filter: inline message under the field; the table keeps showing the last good result.

**Drill-downs**: row → transaction detail (as above); the Account cell → account detail.

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

### ★ Business statement and report download — `business-statement`

#### 1. Summary

| | |
|---|---|
| Slug | `business-statement` |
| Purpose | Make a statement or report for one or all accounts over a period, in PDF, CSV or Excel, and download it. |
| Release | 1 |
| Workspace | Business (`workspace: "business"`, planned field) |
| Status | New (planned). No fixture today. |
| Channels | Web, mobile |
| Starting pattern | `corporate-payments.ts` for the `callApi` and `ctx.error` pattern; `cab.ts` for the result screen. Money does not move. |
| Who may use it | A person with `biz.accounts.export` (Maker, Approver, Admin). |
| Type of journey | File journey (it produces a file), so it carries timeout and unavailable scenarios. |

#### 2. Entry points

| Place | Label | Values passed in | Permission |
|---|---|---|---|
| Accounts › detail | Statement or report | `{accountId}` | `biz.accounts.export` |
| Accounts › list › row menu | Statement or report | `{accountId}` | `biz.accounts.export` |
| Accounts › transactions | Export | `{accountId, from, to}` (`accountId` absent for "All accounts") | `biz.accounts.export` |
| Accounts › statements | New statement or report | none | `biz.accounts.export` |
| Accounts › reports | Create | `{reportType}` (planned value) | `biz.accounts.export` |
| ⌘K command bar | "Statement" | none | `biz.accounts.export` |

When `accountId`, `from` and `to` are all given, the journey opens on **Review** (the person can still press *Back*).

#### 3. Screens

Stepper: **What**, **Review**, then the result. Blocks: `stepper`, `select`, `datePicker` (planned), `alert`, `reviewSummary`, `button`, `result`.

**Screen `choose` — "Statement or report"**

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Type | `select` (`rows`): Account statement, Daily balance report, Payments report, Cash in and out | Yes | One of the four. Default: Account statement (or `{reportType}`). | "Choose what you want to create." |
| Account | `accountPicker` (source `ctx.accounts`, `showBalance: false`) plus an "All accounts" choice | Yes | A permitted account, or all | "Choose an account." |
| Period | `datePicker` range (planned) with presets Last 7 days, Last 30 days, This month, Last month, Custom | Yes | From and To given; From not after To; To not in the future; at most 12 months | "Choose a start and end date." / "Choose a start date that is before the end date." / "The end date can't be in the future." / "The range can be at most 12 months." |
| Format | `select` (`chips`): PDF, CSV, Excel | Yes | One of the three. Payments report: CSV or Excel only. | "Choose a format." |
| Include pending | `toggle`, default off | No | none | none |

Copy: title "Statement or report"; helper under Period: "Statements show booked transactions. Turn on 'Include pending' to add payments that are not booked yet."; helper under Format: "PDF is for reading and printing. CSV and Excel are for your accounting software." Alert (info), shown when the account list is empty: "You don't have access to any accounts at {company}. Ask an administrator at {company}."

Buttons: *Review* → `review` (runs `validate`); *Cancel* → `exit` (back to where the person started).
States: loading skeleton while `ctx.accounts` loads; error and timeout: see section 4 (shown on this screen, button *Try again* reloads the accounts).

**Screen `review` — "Check and create"**: `reviewSummary` rows: Type, Account (or "All accounts ({n})"), Period (`1 Oct 2026 to 31 Oct 2026`), Format, Pending included (Yes or No), Company ("{company name}"). Alert (info): "We'll make the file and keep it for 7 days. It lists {n} transactions." (`{n}` comes from `corp.transactions.list` totals; if above 5,000: alert (warning) "That is a lot of rows. Choose a shorter period." and the button is disabled.)

Buttons: *Create file* → calls `corp.statements.generate`, then `done`; *Edit* → `choose`.
States: submitting shows a spinner on the button and disables it. After 10 s: timeout state (section 4).

**Screen `done` — result**: `result` (success): title "Your file is ready"; body "{Type}, {Period}, {Format}. It stays available for 7 days under Accounts › Statements."; reference "Reference {statementId}". Buttons: *Download* (downloads the file; mobile opens the share sheet), *Create another* → `choose` (cleared), *Go to statements* → shell Accounts › Statements, *Done* → exit to where the person started.

#### 4. Sandbox errors

| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `choose` | *Choose account* → `choose` |
| `ACCOUNT_NOT_PERMITTED` (planned) | "You don't have access to that account. Ask an administrator at {company}." | `choose` | *Choose account* |
| `INVALID_RANGE` (planned) | "Choose dates that are no more than 12 months apart and not in the future." | `choose` | *Edit* → `choose` |
| `NO_TRANSACTIONS` (planned) | "There are no transactions in that period. Choose a longer period." | `review` | *Edit* → `choose` |
| `EXPORT_TOO_LARGE` (planned) | "That file would have more than 5,000 rows. Choose a shorter period." | `review` | *Edit* → `choose` |
| `PERMISSION_DENIED` | S-`PERMISSION_DENIED` (README 1.6): "Your role doesn't allow this. Ask an administrator at {company}." | `denied` (see section 6) | *Back* → exit |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `review` | *Try again* → `review` |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `review` | *Try again* → `review`; *Back* → `choose` |
| `WRONG_CONTEXT` | S-`WRONG_CONTEXT`, with {workspace} = "Business" | `denied` | *Switch* |
| `SESSION_EXPIRED` | S-`SESSION_EXPIRED` | `denied` | *Sign in* |

No money moves in this journey, so no message mentions money. `OTP_*`, `INSUFFICIENT_FUNDS` and `LIMIT_*` do not apply.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `accounts` | `corp.accounts.list` | none | accounts record | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned |
| `count` | `corp.transactions.list` | `{ accountId?, from, to, includePending, pageSize: 1 }` | `{ total, currency }` | `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_PERMITTED`, `INVALID_RANGE`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned |
| `generate` | `corp.statements.generate` | `{ kind: "statement" or "daily_balance" or "payments" or "cash_flow", accountId?, from, to, format: "pdf" or "csv" or "xlsx", includePending }` | `{ id, kind, accountId?, from, to, format, rows, sizeKb, createdAt, expiresAt, downloadRef }` | `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_PERMITTED`, `INVALID_RANGE`, `NO_TRANSACTIONS`, `EXPORT_TOO_LARGE`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned; `moneyMoving: false`, `requiresOtp: false` |

The generated file is a deterministic synthetic file (`downloadRef` resolves in the sandbox to a small generated PDF, CSV or XLSX), so a test can check its row count.

#### 6. Permissions, step-up and limits

- Permission: `biz.accounts.export`. Check 1: the launch points show only with it. Check 2: `authorisation` on the journey (role read from `session.permissions`, planned); a person without it sees screen `denied` ("You can't do this", S-`PERMISSION_DENIED`, button *Back*). Check 3: `corp.statements.generate` answers `PERMISSION_DENIED`.
- Account permission: the person can only pick accounts they may see (`ACCOUNT_NOT_PERMITTED` if forced).
- Step-up: `none` (read-only). Limits: none. Rate limit in the sandbox: 20 files per user per day; the 21st answers `EXPORT_LIMIT_REACHED` (planned) with "You have made the most files allowed today (20). Try again tomorrow." Screen `review`, button *Back*.

#### 7. Result and links out

Result: "Your file is ready" with the statement id. Receipt: none (a statement is itself the document). Notification raised: none in Release 1 (open question 6). Links out: *Download*, *Go to statements* (Accounts › Statements), *Create another*, *Done*.

#### 8. Acceptance criteria

- **AC-1** A Maker, Approver or Admin can create a statement for one account and a period and download it in PDF, CSV or Excel.
- **AC-2** A person can create a report for all accounts at the company, and only for accounts they may see.
- **AC-3** A period longer than 12 months, in the future, or with the start after the end is refused with a message, and nothing is created.
- **AC-4** A period with no transactions is refused with "There are no transactions in that period. Choose a longer period."
- **AC-5** A file with more than 5,000 rows is refused before it is made.
- **AC-6** A person without `biz.accounts.export` cannot create a file, even if the call is forced.
- **AC-7** The file's row count equals the count shown on the review screen.
- **AC-8** When the service times out or is unavailable, the person sees a retry, nothing is created, and no file appears in Statements.
- **AC-9** Opened from the transaction table's Export, the journey starts on the review with the filter's account and dates.
- **AC-10** A statement made at one company is never listed or downloadable at another company.

#### 9. Scenarios

| # | Persona and setup | Conditions | Covers | Expected |
|---|---|---|---|---|
| T-1 | Alex at Alpha (Maker). Account Operating, Last month, PDF | none | AC-1, AC-7 | `generate` returns a file; `rows` equals the review count; the result shows "Your file is ready". |
| T-2 | Alex at Alpha. "All accounts", CSV | none | AC-2 | The file has rows from every account Alex may see, and none from an account Alex is not permitted. |
| T-3 | Alex at Alpha. From 1 Nov 2026 to 1 Oct 2026; then 14 months; then a future end date | none | AC-3 | Each is stopped on `choose` with its message; `corp.statements.list` is unchanged. |
| T-4 | Alex at Alpha. Account with no activity, 1 week | none | AC-4 | `NO_TRANSACTIONS` message on `review`; *Edit* returns to `choose`. |
| T-5 | Alex at Alpha. A seeded account with 5,200 rows, 12 months | none | AC-5 | `EXPORT_TOO_LARGE` message; the button is disabled. |
| T-6 | A user who has `biz.accounts.view` only (Alpha test user `view_only`, planned) forces the call | none | AC-6 | `PERMISSION_DENIED`; screen `denied`; nothing created. |
| T-7 | Alex at Alpha opens from the transaction table with account, from, to | none | AC-9 | The journey's first screen is `review`, showing the three values. |
| T-8 | Alex at Alpha. Account Operating | `timeout: ["corp.statements.generate"]` | AC-8 | Timeout message with *Try again*; `expectBank` reads `corp.statements.list` and finds no new file. |
| T-9 | Alex at Alpha. Account Operating | `unavailable: ["corp.statements.generate"]` | AC-8 | `SERVICE_UNAVAILABLE` message; *Try again* works after the condition is cleared. |
| T-10 | Alex creates a file at Alpha, then switches to Beta | none | AC-10 | Beta's statements list does not contain it; forcing `downloadRef` at Beta answers `PERMISSION_DENIED`. |

#### 10. Expected mutation-check survivors

- Removing the 12-month check in the journey survives only if the sandbox `INVALID_RANGE` rule also stops it (layer 3): T-3 uses a 14-month range, so the sandbox rule is exercised; expected survivor: **the journey-side `validate` for range length** (the sandbox answers the same message). Reason: another layer already stops it.
- Removing the `toggle` "Include pending": none expected, T-1 does not use it; add a variation in T-2 (include pending on) so the count differs. If not added, the survivor is listed.
- All others: none expected.

---

## Business: Payments

This group is the **Payments** tab of Business "Graphite" (README 3.3). It has seven shell screens and five journeys. The tab is for people who can see payments. Launch points on it show only to the roles in README section 4.2.

Used throughout (sandbox facts, all grounded in `packages/mock-bank-api/src/corporate.ts` and `docs/CORPORATE.md`):

- A company payment is **started** by a Maker and **approved** by someone else. Starting moves no money. The last approval releases it. Nobody approves what they started (`SELF_APPROVAL`).
- Payment states in the sandbox: `pending_approval`, `released`, `rejected`. A withdrawn payment is stored as `rejected` with the reason "Withdrawn by the person who started it". The screens show four words: **Pending approval**, **Released**, **Rejected**, **Withdrawn**. (planned: **Scheduled** for a payment that has not started yet.)
- Cut-off is 16:00 UTC. Before it, on a working day, the value date is today. After it, on a weekend or on a closed day (9 Nov 2026), the value date is the next working day and `afterCutoff` is true. At exactly 16:00 it is still today.
- Alpha Trading LLC seed for these specs (README 1.7, planned): company currency USD; Alex Morgan is Maker with a daily limit of 250,000.00 USD; the company daily limit is 1,000,000.00 USD; a payment **above 50,000.00 USD** needs two different approvers (`dana`, `lee`); accounts Operating ••6100 (USD 250,000.00) and Reserve ••6101 (EUR 40,000.00). Approved suppliers: Nile Packaging Co. ••3301 and Delta Logistics ••7782 (domestic, USD), Rhine Components GmbH (Germany, EUR) and Orchid Textiles Ltd (United Kingdom, GBP) (international). Cedar Tools is added but **waiting for approval**, so it cannot be paid yet.
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

> Starting pattern: the existing `corporate-payment` journey (`packages/journey-schema/src/fixtures/corporate-payments.ts`, adapter `corp.payments.initiate`). This spec describes it **as built** first, then the upgrade for BankWorkx®. The Business version also carries the M1 combined-demo path (below).

#### 1. Summary

| | |
|---|---|
| Slug | `supplier-payment` |
| Purpose | A Maker pays an approved supplier, at home or abroad. The payment waits for approval; no money leaves the account. |
| Release | 1 |
| Workspace | Business (planned field `workspace: "business"`) |
| Status | **Existing, upgraded.** Built today as `corporate-payment` ("Start a payment", `entryScreen: "who"`, 11 criteria, 12 scenarios, English only, app `meezan`). The new journey adds international payments, the permission model and the context. |
| Channels | web, mobile |
| Starting pattern | `corporate-payment` plus the FX flow of `bank.fx.quote` (`packages/mock-bank-api/src/fx.ts`) for the international branch. |
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
2. **Payment type** (domestic or international) and, for international, **purpose** and an **FX rate screen**.
3. **Permission** `biz.payments.initiate` at all three checks; `denied` is reached by `PERMISSION_DENIED` too.
4. **Step-up** for a payment above the approval threshold, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE`, `SESSION_EXPIRED`.
5. **Links out**: Track payment, Save as template, "Add a new supplier" with `returnTo`, "Repeat" from the tracker with `{paymentId}`.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Overview › + quick action: Pay a supplier | none | `biz.payments.initiate` |
| Overview › Cut-off timer › Pay now | none | `biz.payments.initiate` |
| Payments › hub › Pay a supplier | `{supplierId}` optional | `biz.payments.initiate` |
| Payments › suppliers › row › Pay | `{supplierId}` | `biz.payments.initiate` |
| Payments › templates › Use | `{templateId}` | `biz.templates.manage` and `biz.payments.initiate` |
| Payments › tracker › payment › Repeat | `{paymentId}` | `biz.payments.initiate` |
| ⌘K command bar "Pay a supplier", or deep link `bankworkx://business/alpha/j/supplier-payment?supplierId=sup_nile` | `{supplierId}` optional | `biz.payments.initiate` |

When `{templateId}` or `{paymentId}` is passed the journey fills supplier, account, reference, purpose and (if saved) amount, and the person still goes through every screen. The amount is **not** copied from a repeated payment unless the person keeps it: the `amountInput` is pre-filled and editable.

#### 3. Screens

Screen ids: `start`, `fx` (international only), `review`, `stepup` (when needed), `otp`, `success`, `failed`, `unavailable`, `denied`, `wrongContext`. Loading rule for every screen that calls an adapter: the button is disabled with a spinner; after 10 seconds the screen shows `unavailable` with the TIMEOUT text.

**Screen `start` — "Payment details"**

Blocks: `stepper` (steps "Details", "Rate" (international only), "Review", "Code"), `select` (chips), `accountPicker`, `beneficiaryPicker`, `select` (rows), `amountInput`, `textInput`, `alert`, `button`. `onEnter`: `corp.company.get` (loads accounts, approved suppliers, `me.remainingToday`, `dualApprovalAbove`, `cutoff`).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Where is the supplier? (`pay.kind`: "In the same country" or "Abroad") | `select` chips, default "In the same country" | yes | one of the two | "Choose where the supplier is." |
| From (`pay.fromAccountId`) | `accountPicker`, balances shown | yes | an account in the company currency (USD) | "Choose an account." |
| Supplier (`pay.beneficiaryId`) | `beneficiaryPicker` (`allowAddNew: true`, `addNewJourney: "add-supplier"`), filtered by `pay.kind`; unapproved suppliers are listed greyed with "Waiting for approval" and cannot be chosen | yes | must be on the approved list | "Choose an approved supplier." |
| Amount (`pay.amount`) | `amountInput`, currency from the account; for abroad, "Amount to send" is in the **supplier's** currency (EUR) and the screen after shows the USD cost | yes | greater than 0; at most the currency's decimals (USD 2); at most `me.remainingToday` (domestic) | required: "Enter an amount."; decimals: "Enter an amount in USD with at most 2 decimal places."; max: "That is above your daily limit." |
| Reference (`pay.reference`) | `textInput`, placeholder "Invoice number" | yes | 1 to 35 characters: letters, numbers, spaces, `- / .` | required: "Enter a reference."; pattern: "Use letters, numbers, spaces and - / . only, up to 35 characters." |
| Purpose of payment (`pay.purpose`), abroad only | `select` rows: "Goods", "Services", "Equipment", "Other" | yes (abroad) | one of the four | "Choose a purpose." |

Copy: title "Pay a supplier". Helper under Amount: "Your limit left today: {remainingToday}." Info alert: "Payments need approval. Nothing leaves your account until it is approved." Warning alert when a chosen amount is above 50,000.00 USD (`dualApprovalAbove`): "This needs two approvers and you'll be asked to confirm it's you." (planned copy).
Buttons: "Continue" (validate, then `fx` for abroad or `review` for domestic); "Cancel" (exit). Link text under the supplier picker: "Add a new supplier" (`navigate.toJourney: "add-supplier"`, `returnTo: "start"`, planned engine feature).
States. Loading: skeleton for the pickers. Empty suppliers: "No approved suppliers yet." with a button "Add a new supplier". Error on load: `unavailable`.

**Screen `fx` — "Rate and cost" (abroad only)**

Blocks: `hero`, `reviewSummary`, `alert`, `button`. `onEnter`: `corp.fx.quote` (planned). The sandbox rate has a 0.5% spread, a 0.2% fee on the amount sent and a 30-second life (`FX_SPREAD`, `FX_FEE_RATE`, `QUOTE_TTL_SECONDS` in `fx.ts`).
Rows: "Supplier receives" ({EUR amount}); "Rate" ("1 USD = {rate} EUR"); "Fee" ({fee} USD); "You pay" ({total} USD); "Rate valid for" (a 30-second countdown).
Copy: info alert "This rate is held for 30 seconds." When the countdown ends, the alert turns amber: "The rate has expired." and the Continue button is replaced by "Get a new rate".
Buttons: "Continue" (to `review` or `stepup`); "Get a new rate" (calls the quote again); "Back" (to `start`).
States. Loading: spinner "Getting your rate". Error: `failed` with the code's message.

**Screen `review` — "Review payment"**

Blocks: `reviewSummary`, `alert`, `consent`, `button`.
Rows: From ("Operating ••6100"), To (supplier name, and for abroad "Rhine Components GmbH, Germany"), Amount ("USD 12,500.00"; abroad "EUR 11,300.00 (you pay USD 12,276.07 including the fee)"), Reference, Purpose (abroad), Approvers needed ("1" or "2"), Value date ("3 Nov 2026"; or "4 Nov 2026 (after the cut-off)").
Alerts: info "Payments made after 16:00 UTC, or on a day the bank is closed, go out on the next working day." After the cut-off or on a closed day the same screen shows the warning "It is past the cut-off, so this will go out on {valueDate}." Abroad: "Rates can move. Your rate is fixed for the time shown."
Consent (`pay.consent`, `termsVersion: "corporate-v1"`): "I confirm the payment details are correct". Rule `mustBeTrue`. Message: "Tick the confirmation first."
Buttons: "Confirm and send OTP" (validate; if the amount is above `dualApprovalAbove` go to `stepup`, else send the code and go to `otp`); "Back" (to `start` or `fx`).

**Screen `stepup` — "Confirm it's you" (planned)**

Shown only when the amount is above 50,000.00 USD (policy `stepUpAbove`, planned) and no step-up was done in the last 5 minutes. Blocks: `text`, `textInput` (secure, "Password"), `button`. Copy: title "Confirm it's you", body "For your security, confirm it's you before you send a payment above USD 50,000.00." Field "Password" (required, message "Enter your password."). Buttons "Confirm" (calls `bank.session.stepUp`, planned; then sends the code and goes to `otp`) and "Back". A wrong password shows "That password isn't right." and stays. `STEP_UP_REQUIRED` from the initiate call also lands here.

**Screen `otp` — "Verify"**

`otp` block (6 digits, 3 attempts, `resendAfterSeconds` 60 today; README 1.4 says 30, so the upgrade changes it to 30), hint "Enter the code sent to {maskedPhone}". Button "Verify and send for approval". Wrong code: toast "That code isn't right. {n} tries left." The third wrong code: `failed` with "Too many wrong codes. Start again." Field `otp.code`: required, pattern `^[0-9]{6}$`, message "Enter the 6-digit code."
Copy under the field: "We sent a code to {maskedPhone}." Link "Send a new code" (after 30 s).

**Screen `success` — "Sent for approval"**

`result` success. Title "Sent for approval". Text: "{amount} to {supplier} is now pending approval. It needs {n} approver(s). Nothing has left your account yet." Meta: "Payment {id} · value date {valueDate}". Info alert when `afterCutoff`: "It was started after the cut-off, so it goes out on {valueDate}." The status chip shows **Pending approval**.
Buttons: "Track payment" (opens Payment detail, `{paymentId}`); "Save as template" (`payment-template`, `{paymentId}`); "Pay another supplier" (restarts); "Done" (returns to where the person started). Notification raised: see section 7.

**Screens `failed`, `unavailable`, `denied`, `wrongContext`**: see section 4. All end with the sentence "No money has left your account." (except the TIMEOUT wording, section 4).

#### 4. Sandbox errors

Messages in the third column are the **upgraded** wording. "Today" is what the adapter message shows through `ctx.error.message` in the existing journey.

| Code | Adapter message today | What the person sees | Screen | Button |
|---|---|---|---|---|
| `OTP_INVALID` | "Incorrect code" (carries `attempt`) | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." | `otp` / `failed` | Try again / Start again |
| `OTP_REQUIRED` | "OTP not verified" | "Confirm with your one-time code first." | `otp` | Back to code |
| `ACCOUNT_NOT_FOUND` | "Account not found" | "We can't find that account. Choose another." | `failed` | Choose account (to `start`) |
| `USER_NOT_FOUND` | "No user {id} at {company}" | "We can't find your user at {company}. Sign in again." | `failed` | Sign in |
| `NOT_AUTHORISED` | "{name} is not allowed to initiate payments" | "Only a Maker can start a payment. You are {role}. No money has left your account." | `denied` | Close |
| `PERMISSION_DENIED` (planned) | none today | "Your role doesn't allow this. Ask an administrator at Alpha Trading LLC." | `denied` | Back |
| `WRONG_CONTEXT` (planned) | none today | "This belongs to your Business banking. Switch to Business to continue." | `wrongContext` | Switch |
| `STEP_UP_REQUIRED` (planned) | none today | "For your security, confirm it's you first." | `stepup` | Confirm |
| `BENEFICIARY_NOT_WHITELISTED` | "This beneficiary is not on the company's approved list" | "This supplier isn't on Alpha Trading LLC's approved list. Ask an approver to confirm them. No money has left your account." | `failed` | Choose supplier (to `start`) |
| `INVALID_AMOUNT` | "Enter an amount in {cur} with at most {n} decimal places" | "Enter an amount in {cur} with at most {n} decimal places." | `start` | Change amount |
| `CURRENCY_NOT_SUPPORTED` | "Payments are limited in {cur}: choose a {cur} account" | "Payments are limited in USD. Choose a USD account. No money has left your account." | `failed` | Choose account |
| `INSUFFICIENT_FUNDS` | "Insufficient funds" | "There isn't enough money in Operating ••6100. Available: {balance}. No money has left your account." | `failed` | Change amount |
| `LIMIT_USER_EXCEEDED` | "This is above {name}'s daily limit" | "This is above your daily limit of {dailyLimit}. You have {remainingToday} left today. No money has left your account." | `failed` | Change amount |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit" | "This is above Alpha Trading LLC's daily limit. Try a smaller amount or wait until tomorrow. No money has left your account." | `failed` | Change amount |
| `QUOTE_EXPIRED` (planned, abroad) | none | "The rate has expired. Get a new one." | `fx` | Get a new rate |
| `QUOTE_NOT_FOUND` / `QUOTE_USED` (planned) | none | "This rate can't be used. Get a new one." | `fx` | Get a new rate |
| `CORE_UNAVAILABLE` | "Core banking unavailable" | "We couldn't complete this right now. No money has left your account." | `failed` | Try again |
| `TIMEOUT` (planned) | none | "We didn't get an answer in time. Check Payments before you try again, so you don't pay twice. In the sandbox nothing was started." | `unavailable` | Check payments (opens the tracker) |
| `SERVICE_UNAVAILABLE` (planned) | none | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `unavailable` | Try again |
| `SESSION_EXPIRED` (planned) | none | "You were signed out for your security. Sign in again to continue. Nothing you were doing was saved." | `unavailable` | Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{ userId }` (today); `{}` after step 2 | company: `accounts`, `beneficiaries`, `me` (`roles`, `dailyLimit`, `usedToday`, `remainingToday`), `dualApprovalAbove`, `cutoff`, `companyDailyLimit`, `companyUsedToday` | `NOT_SUPPORTED` ("Not available for this customer"), `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing |
| `otpSend` | `bank.otp.send` | `{ channel: "sms" }` | `{ sent, maskedPhone, channel }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified: true }` | `OTP_INVALID` (with `attempt`) | Existing. The engine counts failures only for the id `otpVerify`. |
| `quote` | `corp.fx.quote` | `{ fromAccountId, beneficiaryId, amount, currency }` | `{ quoteId, from: {USD, total}, to: {EUR, amount}, midRate, rate, fee, expiresAt, ttlSeconds: 30 }` | `ACCOUNT_NOT_FOUND`, `BENEFICIARY_NOT_WHITELISTED`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: false` | **(planned)** |
| `initiate` | `corp.payments.initiate` | today `{ userId, fromAccountId, beneficiaryId, amount, reference }`. Upgrade: no `userId`; abroad adds `{ quoteId, purpose }` | the payment: `id`, `status: "pending_approval"`, `required` (1 or 2), `valueDate`, `afterCutoff`, `payee`, `amount`, `currency` | `OTP_REQUIRED`, `NOT_AUTHORISED`, `USER_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `BENEFICIARY_NOT_WHITELISTED`, `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CORE_UNAVAILABLE`; planned `PERMISSION_DENIED`, `WRONG_CONTEXT`, `STEP_UP_REQUIRED`, `QUOTE_EXPIRED`, `QUOTE_NOT_FOUND`, `QUOTE_USED`, `PURPOSE_REQUIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving`: **no** at this step (the debit happens at release); `requiresOtp`: yes. | Existing, extended |
| `stepUp` | `bank.session.stepUp` | `{ password }` | `{ level: "stepup", validUntil }` | `STEP_UP_FAILED`, `SESSION_EXPIRED` | **(planned)** |
| `templates` | `corp.templates.list` | `{}` | `{ items }` | see Templates shell | **(planned)** |

Sandbox rule order inside `initiatePayment`: role, account, whitelist, amount, currency, funds, user limit, company limit. The journey must show the first refusal; scenarios depend on this order. The company limit is **checked** at start but **used** only at release, as the code does.

#### 6. Permissions, step-up and limits

- **Permission:** `biz.payments.initiate` (checks 1, 2 and 3). Launch points are hidden without it. `authorisation.role` is `initiator` today (read from `ctx.company.me.roles`); after step 2 it reads `session.permissions`.
- **Step-up level:** `otp` for every payment. `stepup` first for an amount above `dualApprovalAbove` (50,000.00 USD at Alpha, planned policy).
- **Limits:** per person per day (Alex 250,000.00 USD, `LIMIT_USER_EXCEEDED`, counted at start); per company per day (1,000,000.00 USD, `LIMIT_COMPANY_EXCEEDED`, counted at release). The company currency is USD, so an account in another currency is refused (`CURRENCY_NOT_SUPPORTED`). For payments abroad the limit counts the **USD cost** (amount plus fee).
- **Threshold:** above 50,000.00 USD two different approvers are needed; at 50,000.00 exactly, one.
- **Cut-off and value date:** see the group introduction. Weekends and 9 Nov 2026 are closed.
- **Whitelist:** only approved suppliers; one added by a Maker waits for approval (see `add-supplier`).
- **Other context:** a personal context is refused by `WRONG_CONTEXT`. A user from Beta (Alex as Approver) is refused by `PERMISSION_DENIED`.

#### 7. Result and links out

- **Result:** `success` with payment id, status **Pending approval**, value date. Receipt: not issued until release (planned engine feature `receipts`); the person sees "Receipt available once it is released" on Payment detail.
- **Notifications raised:** to every user holding `biz.approvals.approve` at the company (`dana`, `lee`): "Payment awaiting your approval, Alpha Trading LLC. {amount} to {supplier}, started by {name}." (deep link: switch context, then `approve-payments`, `{companyId, paymentId}`). To Alex: none on start.
- **Buttons:** Track payment (Payments › tracker › Payment detail), Save as template (`payment-template`), Pay another supplier, Done. "Go to approvals" is shown only when the person also holds `biz.approvals.approve`; Alex does not at Alpha.
- **M1 combined demo:** this journey is the first half. Alex at Alpha starts a payment, sees it Pending approval, cannot approve it (no permission, and `SELF_APPROVAL` as well), switches to Beta (with step-up) and approves **Priya's** payment there with `approve-payments`. At Beta the Pay a supplier card is not shown, because Alex has no `biz.payments.initiate` there.

#### 8. Acceptance criteria

- **AC-1** The acting person comes from the active context. The journey has no "who" screen, and a call that names a different user is refused (`PERMISSION_DENIED`).
- **AC-2** Only a context with `biz.payments.initiate` can start a payment; an Approver (Alex at Beta) is refused with "Your role doesn't allow this" and the launch point is hidden.
- **AC-3** Only a supplier on the company's approved list can be paid; a supplier waiting for approval or not on the list is refused and no money moves.
- **AC-4** A person cannot send more than their own daily limit; the remaining limit is shown and enforced.
- **AC-5** A payment above the company's daily limit is refused with the reason, and no money moves.
- **AC-6** A payment above 50,000.00 USD needs two approvers and a step-up; a payment of 50,000.00 USD or less needs one approver and no step-up.
- **AC-7** Starting a payment moves no money: the balance is unchanged and the payment is Pending approval.
- **AC-8** A payment started after 16:00 UTC, on a weekend or on 9 Nov 2026 goes out on the next working day, and the person is told so.
- **AC-9** A payment cannot be sent without the confirmation.
- **AC-10** A one-time code must be six digits, and three wrong codes stop the payment.
- **AC-11** A payment abroad needs a purpose, shows the rate, fee and total in USD, and a rate older than 30 seconds is refused.
- **AC-12** An account in another currency than the company's is refused, and not enough money is refused, each with the reason and "No money has left your account".
- **AC-13** A personal context cannot start a company payment (`WRONG_CONTEXT`).
- **AC-14** When the bank times out or is unavailable, nothing is started and the person is told what to do next.
- **AC-15** After success the person can follow the payment in the tracker, where it shows Pending approval with a timeline.

#### 9. Scenarios

Persona `alpha` is Alex Morgan as Maker at Alpha Trading LLC (planned). `now` is `2026-11-03T10:00:00Z` (Tuesday, before the cut-off) unless stated. Every scenario that moves nothing also checks the Operating balance with `expectBank` (`corp.company.get`, `accounts.alpha_ops.balance`, 250,000).

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-1 | Domestic payment goes to Pending approval | AC-1, AC-7, AC-15 | `alpha`; no setup; supplier Nile Packaging, USD 12,500.00, ref INV-1001 | The journey has no `who` screen; `success` shows "Sent for approval" and "waits for 1 approver"; Operating balance still 250,000.00; the tracker lists it as Pending approval |
| T-2 | A different user in the request is refused | AC-1 | `alpha`; call `corp.payments.initiate` with `userId: "dana"` | `PERMISSION_DENIED`; nothing started |
| T-3 | An Approver cannot start a payment | AC-2 | persona `beta-alex` (Approver at Beta) opens the journey by deep link | `denied` with "Your role doesn't allow this. Ask an administrator at Beta Services Ltd."; the hub shows no Pay a supplier card |
| T-4 | A supplier that is not approved is refused | AC-3 | `alpha`; supplier `sup_cedar` (waiting for approval) forced by deep link | `failed` with "This supplier isn't on Alpha Trading LLC's approved list" and "No money has left your account" |
| T-5 | Over the personal limit | AC-4 | `alpha`; USD 250,000.01 | Amount field shows "That is above your daily limit." and `start` stays; calling the adapter directly gives `LIMIT_USER_EXCEEDED` |
| T-6 | Remaining limit shrinks | AC-4 | `alpha`; setup: a payment of 60,000 already started today (and a second approver not yet); then 45,000 | helper shows "Your limit left today: USD 40,000.00"; 45,000 is refused |
| T-7 | Over the company limit | AC-5 | persona `alpha-near-limit` (planned variant: `companyUsedToday` 395,000.00); USD 6,000.00 | `failed`: "This is above Alpha Trading LLC's daily limit"; balance unchanged |
| T-8 | Over the threshold needs two approvers and a step-up | AC-6 | `alpha`; USD 60,000.00 | `stepup` appears before `otp`; `success` says "waits for 2 approver(s)" |
| T-9 | At the threshold needs one approver | AC-6 | `alpha`; USD 50,000.00 | no `stepup`; "waits for 1 approver" |
| T-10 | Before the cut-off, today | AC-8 | `alpha`; `now` 2026-11-03T15:59:00Z | value date 2026-11-03; no after-cut-off alert |
| T-11 | After the cut-off, next working day | AC-8 | `now` 2026-11-03T17:00:00Z | value date 2026-11-04; alert "It was started after the cut-off, so it goes out on 2026-11-04." |
| T-12 | Friday after the cut-off skips the weekend and the closed Monday | AC-8 | `now` 2026-11-06T17:00:00Z | value date 2026-11-10 |
| T-13 | Without the confirmation | AC-9 | `alpha`; press "Confirm and send OTP" without ticking | stays on `review`; error "Tick the confirmation first." |
| T-14 | A short code | AC-10 | `alpha`; code `123` | stays on `otp`; error "Enter the 6-digit code." |
| T-15 | Three wrong codes | AC-10 | `alpha`; code `999999` three times | after the third, `failed` with "Too many wrong codes. Start again."; balance unchanged; no payment listed |
| T-16 | Abroad: purpose and rate | AC-11 | `alpha`; supplier Rhine Components GmbH, EUR 11,300.00, purpose "Goods" | `fx` shows rate, fee 0.2% and "You pay" in USD; review shows purpose; `success` |
| T-17 | Abroad: no purpose | AC-11 | `alpha`; purpose left empty | `start` stays; error "Choose a purpose." |
| T-18 | Abroad: expired rate | AC-11 | `alpha`; `now` advanced 31 seconds after the quote | `QUOTE_EXPIRED` "The rate has expired. Get a new one."; nothing started |
| T-19 | Wrong currency account | AC-12 | `alpha`; account Reserve ••6101 (EUR) | `failed`: "Payments are limited in USD. Choose a USD account. No money has left your account." |
| T-20 | Not enough money | AC-12 | persona `alpha-low-balance` (planned variant: Operating 5,000.00); USD 10,000.00 | `failed`: "There isn't enough money in Operating ••6100. Available: USD 5,000.00." |
| T-21 | Personal context | AC-13 | persona `alex` with the **personal** context active; call `corp.payments.initiate` | `WRONG_CONTEXT`; message "This belongs to your Business banking. Switch to Business to continue." |
| T-22 | **Timeout** on starting | AC-14 | `alpha`; conditions `timeout: ["corp.payments.initiate"]`, `latencyMs: 10000` | `unavailable` with the TIMEOUT text; no payment in the tracker; balance unchanged |
| T-23 | **Unavailable** | AC-14 | `alpha`; conditions `unavailable: ["corp.company.get"]` | `unavailable` with "This service is not available right now. Nothing was changed."; button "Try again" |
| T-24 | M1 combined demo (first half) | AC-2, AC-7, AC-15 | persona `alex`; start at Alpha (USD 12,500.00), then switch to Beta | At Alpha the payment is Pending approval; at Beta the Approvals inbox lists Priya's payment and **not** Alpha's; the Beta hub has no Pay a supplier card |

#### 10. Expected mutation-check survivors

| Survivor | Reason |
|---|---|
| `flaws.companyLimit` off | Only killed because of the near-limit variant in T-7. Without that variant the company limit (1,000,000) is above the sum of every Maker's limit (250,000), so the sandbox cannot produce it, the same reason as in `scenarios.test.ts` for Acme. |
| `flaws.roles` off | Killed by T-3 (check 3), unless a second layer (the permission check) stops the Approver first. Then the role rule is a survivor with that reason: the `PERMISSION_DENIED` layer already stops the case. |
| `flaws.dualApproval` off | Killed by T-8 and T-9. |
| `flaws.cutoff` off | Killed by T-11 and T-12. |
| The `stepper` block label change | Cosmetic; no scenario depends on step labels. |

---

### ★ Add a supplier — `add-supplier`

#### 1. Summary

| | |
|---|---|
| Slug | `add-supplier` |
| Purpose | A Maker adds a supplier (domestic or international) to the company's list. Until an approver confirms them, the supplier cannot be paid. |
| Release | 1 |
| Workspace | Business |
| Status | **New (planned).** No fixture exists. The sandbox has a fixed whitelist today (`CorpCompany.whitelist`); this journey needs `corp.suppliers.*` (planned). |
| Channels | web, mobile |
| Starting pattern | The `beneficiaryPicker` block with `allowAddNew` and `addNewJourney`; the add-beneficiary flow of Personal (`manage-beneficiary`) for the field list. |
| Who may use it | `biz.suppliers.manage` (Maker; Admin by policy). |

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › suppliers › Add / Edit | `{supplierId}` optional | `biz.suppliers.manage` |
| Payments › hub › Add a supplier card | none | `biz.suppliers.manage` |
| `supplier-payment` › "Add a new supplier" | none; opens with `returnTo` | `biz.suppliers.manage` |
| `payment-template` › "Add a new supplier" | none; opens with `returnTo` | `biz.suppliers.manage` |

With `{supplierId}` the journey opens in **edit** mode: the account number is shown masked and cannot be viewed; changing the account number or name sends the supplier back to "Waiting for approval".

#### 3. Screens

Screen ids: `type`, `details`, `review`, `otp`, `success`, `failed`, `unavailable`, `denied`, `wrongContext`.

**Screen `type` — "Add a supplier"**
Blocks: `text`, `select` (tiles), `button`. Field `sup.kind`: tiles "In the same country" (hint "Pay in USD from a local account") and "Abroad" (hint "Pay in a foreign currency"). Required. Message: "Choose where the supplier is." Button "Continue" goes to `details`. "Cancel" exits.

**Screen `details` — "Supplier details"**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Supplier name (`sup.name`) | `textInput` | yes | 2 to 60 characters; letters, numbers, spaces and `& . , -` | "Enter the supplier's legal name." |
| Country (`sup.country`) | `select` (rows, search) | yes | abroad: one of the supported countries (Germany, United Kingdom, United Arab Emirates, Jordan) | "Choose a country." |
| Currency (`sup.currency`) | `select` (chips) | yes | domestic: USD fixed; abroad: EUR, GBP or AED | "Choose a currency." |
| Bank name (`sup.bank`) | `textInput` | yes | 2 to 60 characters | "Enter the bank's name." |
| Account number or IBAN (`sup.account`) | `textInput` | yes | domestic: 8 to 12 digits; abroad: an IBAN of 15 to 34 characters that passes the mod-97 check (sandbox rule, planned) | domestic: "Enter 8 to 12 digits."; abroad: "That IBAN isn't valid. Check it and try again." |
| Contact email (`sup.email`) | `textInput` | no | a valid email if given | "Enter a valid email address." |
| Note for approvers (`sup.note`) | `textInput` (`lines: 3`) | no | up to 140 characters | "Keep it to 140 characters." |

Copy: title "Supplier details". Info alert: "A new supplier must be confirmed by an approver before you can pay them." Buttons "Continue" (validate, then `review`) and "Back".

**Screen `review` — "Review supplier"**
`reviewSummary` rows: Name, Type, Country, Currency, Bank, Account (masked: "••3301"), Contact email, Note. `consent` (`sup.consent`): "I have checked these details with the supplier" (`mustBeTrue`, message "Tick the confirmation first."). Button "Confirm and send OTP" (sends code, to `otp`). "Edit" (back to `details`).

**Screen `otp`** as `supplier-payment`; button "Verify and add supplier".

**Screen `success` — "Supplier added"**
`result` success. Title "Supplier sent for approval". Text: "{name} is waiting for an approver. You can pay them once they are approved." Meta: "Supplier {id}". Status chip **Waiting for approval**. Buttons "View suppliers" (Payments › suppliers), "Back to your payment" (only when opened with `returnTo`; returns to the origin journey, where the supplier is listed greyed out), "Add another", "Done".

**Screens `failed`, `unavailable`, `denied`, `wrongContext`** as section 4.

States. Loading: spinner on buttons. Error: `failed` with "Nothing was changed."

#### 4. Sandbox errors

| Code | What the person sees | Screen | Button |
|---|---|---|---|
| `OTP_INVALID`, `OTP_REQUIRED` | Standard messages S-`OTP_INVALID`, S-`OTP_REQUIRED` (README 1.6) | `otp` / `failed` | Try again / Start again |
| `SUPPLIER_EXISTS` (planned) | "You already have a supplier with this account number: {name}. Nothing was changed." | `failed` | Edit details |
| `INVALID_ACCOUNT` (planned) | "That account number isn't valid. Check it and try again." | `details` | Edit details |
| `COUNTRY_NOT_SUPPORTED` (planned) | "We can't pay suppliers in {country} yet. Nothing was changed." | `failed` | Edit details |
| `SUPPLIER_LIMIT` (planned) | "You have reached 200 suppliers. Remove one to add another. Nothing was changed." | `failed` | View suppliers |
| `NOT_AUTHORISED` | "Only a Maker can add a supplier. Nothing was changed." | `denied` | Close |
| `PERMISSION_DENIED` (planned) | Standard message S-`PERMISSION_DENIED` | `denied` | Back |
| `WRONG_CONTEXT` (planned) | Standard message S-`WRONG_CONTEXT` | `wrongContext` | Switch |
| `STEP_UP_REQUIRED` (planned) | Standard message S-`STEP_UP_REQUIRED` | `stepup` (as `supplier-payment`) | Confirm |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. Nothing was changed." | `failed` | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `unavailable` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | Standard message S-`SERVICE_UNAVAILABLE` | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `addSupplier` | `corp.suppliers.add` | `{ kind, name, country, currency, bank, account, email?, note? }` | `{ id, name, status: "waiting_approval", maskedNumber, addedBy, addedAt }` | `OTP_REQUIRED`, `SUPPLIER_EXISTS`, `INVALID_ACCOUNT`, `COUNTRY_NOT_SUPPORTED`, `SUPPLIER_LIMIT`, `NOT_AUTHORISED`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `STEP_UP_REQUIRED`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: true` (it changes who the company can pay) | **(planned)** |
| `updateSupplier` | `corp.suppliers.update` | `{ supplierId, ...fields }` | the supplier; changing name or account returns `status: "waiting_approval"` | as above plus `SUPPLIER_NOT_FOUND` | **(planned)** |
| `suppliers` | `corp.suppliers.list` | `{ status? }` | `{ items }` | `PERMISSION_DENIED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | **(planned)** |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as `supplier-payment` | as `supplier-payment` | `OTP_INVALID` | Existing |

The approver confirms or declines a supplier with `corp.suppliers.decide` (planned; request `{ supplierId, decision: "approve" | "decline" }`, same-person rule as payments: the Maker who added a supplier cannot approve them, `SELF_APPROVAL`). That action belongs to `approve-payments` (Approvals inbox item type "Supplier"). See open questions.

#### 6. Permissions, step-up and limits

`biz.suppliers.manage`. Step-up `otp`. No amount limits. At most 200 suppliers per company. An international supplier in an unsupported country is refused.

#### 7. Result and links out

Result `success` as above. Receipt: none. Notifications: to approvers "Supplier awaiting your approval, Alpha Trading LLC. {name}, added by {name}." When approved: to the Maker "{name} was approved. You can pay them now." Links: View suppliers, the origin journey via `returnTo`, Done.

#### 8. Acceptance criteria

- **AC-1** Only a context with `biz.suppliers.manage` can add a supplier; others are refused.
- **AC-2** A new supplier is created as "Waiting for approval" and cannot be paid until an approver confirms them.
- **AC-3** A supplier with the same account number as an existing one is refused.
- **AC-4** An international supplier's IBAN must be valid, and a domestic account number must be 8 to 12 digits.
- **AC-5** The supplier is not added without the confirmation and a correct six-digit code; three wrong codes stop it.
- **AC-6** The Maker who added a supplier cannot approve them.
- **AC-7** Opened from `supplier-payment`, the journey returns to the payment with the supplier listed but not selectable.
- **AC-8** When the bank times out or is unavailable, nothing is added and the person is told so.

#### 9. Scenarios

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-1 | Add a domestic supplier | AC-1, AC-2 | `alpha`; Nile Packaging copy "Orion Metals", account 55220011 | `success` "Supplier sent for approval"; list shows Waiting for approval; paying them gives `BENEFICIARY_NOT_WHITELISTED` |
| T-2 | Approver cannot add | AC-1 | `beta-alex` | `denied` (`PERMISSION_DENIED`) |
| T-3 | Duplicate account | AC-3 | `alpha`; account 00003301 matches an existing supplier | `SUPPLIER_EXISTS`; `failed` |
| T-4 | Bad IBAN | AC-4 | `alpha`; IBAN `DE00 0000 0000 0000 0000 00` | error "That IBAN isn't valid. Check it and try again." |
| T-5 | Short domestic account | AC-4 | `alpha`; `1234` | error "Enter 8 to 12 digits." |
| T-6 | Missing confirmation and wrong codes | AC-5 | `alpha`; untick; then `999999` three times | "Tick the confirmation first."; then "Too many wrong codes. Start again."; no supplier added |
| T-7 | Maker cannot approve their own supplier | AC-6 | `alpha`; setup adds a supplier as Alex; Alex tries `corp.suppliers.decide` | `SELF_APPROVAL` |
| T-8 | Return to the payment | AC-7 | `alpha`; start `supplier-payment`, "Add a new supplier", finish | back on `start`; the new supplier is greyed "Waiting for approval" |
| T-9 | **Timeout** | AC-8 | `alpha`; conditions `timeout: ["corp.suppliers.add"]` | `unavailable`; no supplier listed |
| T-10 | **Unavailable** | AC-8 | `alpha`; conditions `unavailable: ["corp.suppliers.add"]` | `unavailable` "Nothing was changed." |

#### 10. Expected mutation-check survivors

None expected, except: the 200-supplier limit (no scenario fills 200 suppliers; the sandbox seed holds 5). Listed as a survivor with that reason.

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
| Purpose | A Maker sets up a payment that starts on a future date, or repeats. Every run is a normal payment that still needs approval. |
| Release | 1 |
| Workspace | Business |
| Status | **New (planned).** No fixture; the Personal `schedule-payment` is the sibling. Needs `corp.schedules.*`. |
| Channels | web, mobile |
| Starting pattern | `corporate-payment` (the same rules per run) plus `datePicker` (planned). |
| Who may use it | `biz.payments.schedule` and `biz.payments.initiate` (a schedule starts payments as the Maker). |

A schedule is a standing instruction. Each run starts at **09:00 UTC** on the run date (before the 16:00 cut-off), as a payment started by the person who made the schedule, and waits for approval like any payment. A run never moves money by itself.

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| Payments › hub › Schedule a payment | `{templateId}` optional | `biz.payments.schedule` |
| Payments › templates › Schedule | `{templateId}` | `biz.payments.schedule` |
| Payments › scheduled › Schedule a payment | none | `biz.payments.schedule` |
| `payment-template` result › Schedule it | `{templateId}` | `biz.payments.schedule` |

#### 3. Screens

Screen ids: `details`, `when`, `review`, `stepup`, `otp`, `success`, `failed`, `unavailable`, `denied`, `wrongContext`.

**Screen `details` — "What to pay"**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Use a template (`sch.templateId`) | `select` rows (templates), "Don't use a template" first | no | an existing template | "Choose a template or fill in the details." |
| Supplier (`sch.beneficiaryId`) | `beneficiaryPicker` | yes | approved supplier | "Choose an approved supplier." |
| From (`sch.fromAccountId`) | `accountPicker` | yes | a USD account | "Choose an account." |
| Amount (`sch.amount`) | `amountInput` | yes | greater than 0; at most the person's daily limit (250,000.00); currency's decimals | "Enter an amount." / "That is above your daily limit of USD 250,000.00." / "Enter an amount in USD with at most 2 decimal places." |
| Reference (`sch.reference`) | `textInput` | yes | as `supplier-payment` | "Enter a reference." |

Copy: title "Schedule a payment". Info alert: "Each time, the payment waits for approval. If it isn't approved before the cut-off at 16:00 UTC it goes out the next working day." Abroad suppliers are not offered in Release 1 (rates cannot be fixed in advance); the picker shows them greyed with "Abroad payments can't be scheduled yet." Buttons "Continue", "Cancel".

**Screen `when` — "When"**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| How often (`sch.frequency`) | `select` chips: "Once", "Every week", "Every month" | yes | one of three | "Choose how often." |
| First payment on (`sch.startDate`) | `datePicker` (planned) | yes | tomorrow or later; no more than 24 months ahead | "Choose a date from tomorrow." / "Choose a date within 24 months." |
| Ends (`sch.ends`) | `select` chips: "Never", "After a number of payments", "On a date" (not for "Once") | yes if repeating | one of three | "Choose when it ends." |
| Number of payments (`sch.count`) | `textInput` | if "After a number" | whole number 2 to 60 | "Enter a number from 2 to 60." |
| End date (`sch.endDate`) | `datePicker` | if "On a date" | after the first payment, within 24 months | "Choose a date after the first payment." |

Copy: title "When". Helper under the date: "If this is a weekend or a day the bank is closed, it starts on the next working day." A warning appears for such a date: "9 Nov 2026 is a day the bank is closed. This will start on 10 Nov 2026." (the date shifts by the same rule as the value date). A monthly schedule on the 31st: "On shorter months it runs on the last day." Buttons "Continue", "Back".

**Screen `review` — "Review schedule"**
`reviewSummary` rows: Supplier, From, Amount, Reference, How often, First payment, Ends, "Approval needed" ("1 approver" or "2 approvers" if the amount is above 50,000.00). Alert info "Nothing leaves your account now." `consent` (`sch.consent`): "I understand each payment still needs approval and I can stop this at any time" (`mustBeTrue`, "Tick the confirmation first."). Button "Confirm and send OTP" (to `stepup` when amount is above 50,000.00, else `otp`). "Back".

**Screen `stepup`** as `supplier-payment`. **Screen `otp`** as `supplier-payment`; button "Verify and schedule".

**Screen `success` — "Payment scheduled"**
`result` success: title "Payment scheduled", text "{amount} to {supplier}, {frequency}, from {firstRun}. Each payment waits for approval.", meta "Schedule {id}". Buttons "View scheduled payments" (Payments › scheduled), "Schedule another", "Done".

#### 4. Sandbox errors

| Code | What the person sees | Screen | Button |
|---|---|---|---|
| `OTP_INVALID`, `OTP_REQUIRED` | Standard (README 1.6) | `otp` / `failed` | Try again / Start again |
| `SCHEDULE_DATE_INVALID` (planned) | "Choose a date from tomorrow, within 24 months." | `when` | Change date |
| `SCHEDULE_LIMIT` (planned) | "You have 25 active schedules, the most allowed. Stop one to add another. Nothing was changed." | `failed` | View scheduled |
| `BENEFICIARY_NOT_WHITELISTED` | "This supplier isn't on Alpha Trading LLC's approved list. Nothing was changed." | `failed` | Choose supplier |
| `LIMIT_USER_EXCEEDED` | "This is above your daily limit of USD 250,000.00. Nothing was changed." | `failed` | Change amount |
| `CURRENCY_NOT_SUPPORTED` | "Payments are limited in USD. Choose a USD account. Nothing was changed." | `failed` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount in USD with at most 2 decimal places." | `details` | Change amount |
| `ACCOUNT_NOT_FOUND` | Standard (README 1.6) | `failed` | Choose account |
| `NOT_AUTHORISED` / `PERMISSION_DENIED` (planned) | Standard S-`PERMISSION_DENIED` | `denied` | Back |
| `WRONG_CONTEXT`, `STEP_UP_REQUIRED` (planned) | Standard | `wrongContext` / `stepup` | Switch / Confirm |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. Nothing was changed." | `failed` | Try again |
| `TIMEOUT` (planned) | "We didn't get an answer in time. Check Scheduled before you try again, so you don't create it twice." | `unavailable` | Check Scheduled |
| `SERVICE_UNAVAILABLE` (planned) | Standard | `unavailable` | Try again |

At run time (not in the journey): a run that fails (limit reached, supplier disabled, not enough money) starts no payment, marks the schedule `failed_last_run` and raises a notification (section 7). The run uses the same rules and messages as `supplier-payment`.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status |
|---|---|---|---|---|---|
| `company`, `otpSend`, `otpVerify` | as `supplier-payment` | | | | Existing |
| `templates` | `corp.templates.list` | `{}` | `{ items }` | see shell | **(planned)** |
| `createSchedule` | `corp.schedules.create` | `{ templateId?, beneficiaryId, fromAccountId, amount, reference, frequency, startDate, ends, count?, endDate? }` | `{ id, status: "active", nextRunDate, ... }` | `OTP_REQUIRED`, `SCHEDULE_DATE_INVALID`, `SCHEDULE_LIMIT`, `BENEFICIARY_NOT_WHITELISTED`, `LIMIT_USER_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `NOT_AUTHORISED`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `STEP_UP_REQUIRED`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. `moneyMoving: false`, `requiresOtp: true` | **(planned)** |
| `runSchedules` | `corp.schedules.run` | `{ now }` (sandbox clock) | the payments started and any failures | `PERMISSION_DENIED` | **(planned, sandbox-only; used by scenarios to move time forward)** |

#### 6. Permissions, step-up and limits

`biz.payments.schedule` and `biz.payments.initiate`. Step-up `otp`; `stepup` when the amount is above 50,000.00. At most 25 active schedules per company; 24 months ahead at most. Limits and the whitelist are checked at creation **and again at each run**.

#### 7. Result and links out

Result `success`. Receipt: none. Notifications: on creation, none; at each run, to the Maker "Scheduled payment started: {amount} to {supplier}. It's waiting for approval." and to approvers "Payment awaiting your approval, Alpha Trading LLC."; on a failed run, to the Maker "A scheduled payment didn't start: {message}. Nothing was paid." Buttons: View scheduled payments, Schedule another, Done.

#### 8. Acceptance criteria

- **AC-1** Only a context with `biz.payments.schedule` and `biz.payments.initiate` can schedule a payment.
- **AC-2** The first date must be tomorrow or later and within 24 months; a weekend or closed day shifts to the next working day, and the person is told.
- **AC-3** Only an approved supplier and a USD account can be scheduled; the amount cannot exceed the person's daily limit.
- **AC-4** Creating a schedule moves no money and starts no payment.
- **AC-5** Each run starts a payment that waits for approval and counts against the limits.
- **AC-6** A run that fails starts nothing and tells the Maker why.
- **AC-7** A schedule is not created without the confirmation and a correct six-digit code; three wrong codes stop it.
- **AC-8** A schedule above 50,000.00 USD per payment needs a step-up.
- **AC-9** When the bank times out or is unavailable, no schedule is created and the person is told so.

#### 9. Scenarios

| Id | Name | Covers | Persona, setup, conditions | Outcome |
|---|---|---|---|---|
| T-1 | Monthly payment from a template | AC-1, AC-4 | `alpha`; template "Monthly packaging" (USD 12,500.00); every month from 2026-11-20; ends never | `success`; no payment exists; balance unchanged |
| T-2 | Approver cannot schedule | AC-1 | `beta-alex` | `denied` |
| T-3 | Date in the past | AC-2 | `alpha`; start date 2026-11-03 | "Choose a date from tomorrow." |
| T-4 | Closed Monday shifts | AC-2 | `alpha`; start date 2026-11-09 | warning "9 Nov 2026 is a day the bank is closed. This will start on 10 Nov 2026."; schedule next run 2026-11-10 |
| T-5 | Over 24 months | AC-2 | `alpha`; start 2029-01-01 | "Choose a date within 24 months." |
| T-6 | Unapproved supplier, euro account, over the limit | AC-3 | `alpha`; Cedar Tools; Reserve ••6101; USD 250,000.01 | each refused with its message; nothing created |
| T-7 | A run starts a payment | AC-5 | `alpha`; schedule once for 2026-11-04; run `corp.schedules.run` at 2026-11-04T09:00:00Z | one payment Pending approval, started by Alex, value date 2026-11-04; Alex's used limit rises by the amount |
| T-8 | A failed run | AC-6 | `alpha`; schedule for 2026-11-04; supplier disabled before the run | no payment; schedule `failed_last_run`; notification text "A scheduled payment didn't start" |
| T-9 | Confirmation and codes | AC-7 | `alpha`; untick; then `999999` three times | "Tick the confirmation first."; then "Too many wrong codes. Start again."; no schedule |
| T-10 | Large amount needs step-up | AC-8 | `alpha`; USD 60,000.00 | `stepup` before `otp` |
| T-11 | **Timeout** | AC-9 | conditions `timeout: ["corp.schedules.create"]` | `unavailable`; Scheduled list unchanged |
| T-12 | **Unavailable** | AC-9 | conditions `unavailable: ["corp.schedules.create"]` | `unavailable` "Nothing was changed." |

#### 10. Expected mutation-check survivors

| Survivor | Reason |
|---|---|
| 25-schedule limit | No scenario creates 25 schedules; listed with the reason that the seed has 2. |
| Monthly "last day of a short month" rule | No scenario starts a schedule on the 31st. Add T-13 if this should be proved. |
| Everything else | None expected. |

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

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `bulk-payment` |
| Purpose | A Maker pays many approved suppliers from one file. Every row is checked first. Only the rows that pass are sent, as one payment, for approval. |
| Release | 1 |
| Workspace | Business (`workspace: "business"` *(planned)*) |
| Status | Existing: `fixtures/bulk-payment.ts` (id `jrn_bulk_payment`, 10 acceptance criteria, 27 scenarios, made by the generator, passes on both corporate bank APIs). Upgraded here: file upload, table, context permissions, timeout and unavailable states. |
| Channels | web, mobile |
| Starting pattern | Upload → check → review → consent → one-time code → result |
| Who may use it | A user whose active context holds `biz.payments.bulk` (Alex Morgan as Maker at Alpha). Not Alex at Beta. |

#### 2. Entry points
| Place › label | Passes | Permission |
|---|---|---|
| Overview › **+** › Upload payments | – | `biz.payments.bulk` |
| Payments › hub › Upload a file | – | `biz.payments.bulk` |
| Deep link `bankworkx://business/alpha/j/bulk-payment` | – | `biz.payments.bulk` |
| ⌘K command bar › "Upload payments" | – | `biz.payments.bulk` |
The launch point is hidden without the permission (check 1). A forced link opens the refusal screen (check 2).

#### 3. Screens

**As built today (`fixtures/bulk-payment.ts`).** Ten screens: `who` (sandbox: choose who you are), `start` (Payment file), `check` (Check the file), `nothing` (branch: Nothing to pay), `review` (Review bulk payment), `otp` (Verify), `success` (Sent for approval), `failed`, `unavailable`, `denied`. A `stepper` shows `start, check, review, otp`. Bound data: `session.userId`, `bulk.fromAccountId`, `bulk.file`, `bulk.go`, `bulk.reference`, `bulk.consent`, `otp.code`. Pasted rows are `beneficiary,amount,reference`; an optional header row, blank lines and spaces are ignored; a bad amount becomes an invalid amount, not a crash.

**Upgrade.** `who` is removed. `start` gains the planned `fileUpload` block beside the existing paste box. `check` shows the rows in a `dataTable`. `failed` gains buttons for the new codes. A new screen `repairOffer` is not needed: the `success` screen links to `repair-bulk-lines`. The screens below are the upgraded ones; "as built" copy is kept word for word and the new copy is marked *(new)*.

##### Screen `start` — "Payment file"
Blocks: `stepper` (`start, check, review, otp`), `accountPicker`, `select` (chips: "Upload a file" / "Paste rows") *(new)*, `fileUpload` *(planned)*, `textInput` (`lines: 8`), `text` (caption), two conditional `alert`s, two `button`s.

| Label | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Pay from | `accountPicker` `bind: bulk.fromAccountId`, `showBalance`, source `ctx.company.accounts` | Yes | An account of the company | "Choose the account to pay from." (new). The bank adds `CURRENCY_NOT_SUPPORTED` if it is not USD. |
| How do you want to add the payments | `select` chips `bulk.mode` *(new)* | Yes, default "Upload a file" | one of two | – |
| Payment file | `fileUpload` *(planned)* `bind: bulk.upload`, `accept: [".csv", ".xml"]`, max 256 KB *(proposed)* | Yes when mode is upload | Extension `.csv` or `.xml`; size at most 256 KB; readable text | "Choose a CSV or XML file." / "That file is too big. The limit is 256 KB." / "We can't read that file. Check that it is a CSV or XML file." |
| Payment file (paste) | `textInput` `bind: bulk.file`, `lines: 8`, placeholder `sup_textile,250000,INV-1001`, pattern `^[\s\S]*\S[\s\S]*$` | Yes when mode is paste | At least one non-space character | "Paste the payment file first: one row per payment" (exact, `patternMessage`) |

Copy:
- Title: "Payment file". Caption under the file box: "One row per payment: beneficiary,amount,reference. Up to 50 rows. Only suppliers on the company's approved list can be paid."
- Upload help *(new)*: "CSV: one row per payment, columns beneficiary, amount, reference. XML: one `<Payment>` element per payment with `<Beneficiary>`, `<Amount>` and `<Reference>`. Download a sample." (link opens a sample file; a CSV and an XML sample ship with the sandbox)
- Conditional alert when `ctx.error.code == 'EMPTY_BATCH'`: "The file has no payment rows. Add at least one row: beneficiary,amount,reference."
- Conditional alert when `ctx.error.code == 'BATCH_TOO_LARGE'`: "The file has more than 50 rows. Split it into files of 50 rows or fewer."
- *(new)* Conditional alert for the file codes (table in section 4).

Buttons:
| Button | Does | Leads to |
|---|---|---|
| **Check** (primary) | `validate`; clears `bulk.go` and `ctx.error`; if mode is upload, calls `importBulk` (turns the file into rows); calls `checkBulk`; on error toast "The file was not accepted" and stays | `check` |
| **Close** (secondary) | `exit` | where the person started |

States: Loading: **Check** shows a spinner and is disabled; after 10 s the timeout state (alert + **Try again**). Empty: nothing chosen yet shows the helper text only. Error: see section 4.

##### Screen `check` — "Check the file"
Blocks: `reviewSummary`, `text`, `alert`s, `dataTable` *(planned)* (as built this is two `menu` lists: all problems), `button`s.

`reviewSummary` rows (exact): "Will be paid" = "{validCount} of {validCount + invalidCount} rows"; "Total" = amount in the account currency; "Approvers needed" = "{requiredApprovers} approver(s)".

| Condition | Element | Exact text |
|---|---|---|
| `requiredApprovers > 1` | caption | "Above {dualApprovalAbove} a bulk payment needs two approvers." |
| `invalidCount > 0 && validCount > 0` | alert, warning | "{invalidCount} row(s) cannot be paid and will be left out. Fix the file and check again, or continue with only the rows that pass." |
| `validCount == 0` | alert, error | "No row in this file can be paid. Fix the file and check again." |
| `invalidCount > 0` | section header | "Rows that cannot be paid" |
| `validCount > 0 && total > me.remainingToday` | alert, warning | "The total is above what you can still send today ({remainingToday}). The bank will refuse it: take some rows out first." |

`dataTable` *(planned)* columns (replaces the problem list; the whole file is shown, not only problems):
| Column | Content | Sort / filter |
|---|---|---|
| Row | `n` | sort |
| Payee | `payee` (name) or the raw id when unknown | search |
| Amount | `amount` in account currency | sort |
| Reference | `reference` | search |
| Result | `statusChip`: "Will be paid" (green) or the row message (red, with an icon) | filter: All / Will be paid / Left out |
Default sort: row number. Default filter: All. Page size 25 (a file has at most 50 rows). Tap a red row to see the message and the hint "Fix this row in your file, then check again." (the old behaviour of returning to `start` stays as the button **Fix the file**). Empty state is not reachable (an empty file is refused earlier).

Buttons: **Continue with the rows that pass** (primary: sets `bulk.go = true`, goes to `review`); **Fix the file** (secondary: `bulk.go = false`, goes to `start`). Navigation rule: if `bulk.go && validCount == 0` go to `nothing`.

##### Screen `nothing` — branch
Alert, error: "No row in this file can be paid, so there is nothing to send for approval. Fix the file and check again." Button **Fix the file** to `start`.

##### Screen `review` — "Review bulk payment"
Blocks: `reviewSummary`, `textInput`, `alert`, `consent`, `button`s.

`reviewSummary` rows: "From" = account name and masked number; "Payments" = `validCount`; "Total"; "Left out" = "{invalidCount} row(s)"; "Approvers needed" = "{requiredApprovers} approver(s)".

| Label | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Name for this batch (optional) | `textInput` `bulk.reference`, placeholder "Suppliers November" | No | up to 35 characters *(new)* | "Use 35 characters or fewer." |
| I confirm the payments in this file are correct | `consent` `bulk.consent`, `termsVersion: "corporate-bulk-v1"` | Yes | `mustBeTrue` | "Tick the confirmation first" (exact) |

Alert, info (exact): "The whole file is sent for approval as one payment and counts as one payment against your and the company's daily limits. No money moves until it is approved."
Buttons: **Confirm and send OTP** (sends the code with `otpSend`; on error toast "We couldn't send the code. Try again." and stays) → `otp`; **Back** → `check` (sets `bulk.go = false`).

##### Screen `otp` — "Verify"
`otp` block: `length: 6`, `maxAttempts: 3`, `resendAfterSeconds: 60` (as built; README 1.4 says 30 s: the fixture keeps 60 until reworded), hint "Enter the code sent to {maskedPhone}". Button **Verify and send for approval**: `validate`, then `otpVerify` (on error toast "Incorrect code", stay, lock after 3 to `failed`), then `submitBulk`, then `success`. `otp.code` must match `^[0-9]{6}$`. Resend failure toast: "We couldn't send a new code. Try again."

##### Screen `success` — "Sent for approval" (terminal)
`result` (success): title "Sent for approval"; text "{payee} totalling {amount} now wait for {required} approver(s) as one bulk payment. Nothing has left the account yet."; meta "Payment {id} · value date {valueDate}". Alert, info, only when `afterCutoff`: "It was started after the cut-off, so it goes out on {valueDate}."
New in the upgrade: alert, warning, when `leftOutCount > 0`: "{n} row(s) were left out. You can fix them and send them as a second payment." Buttons: **Track payment** (Payments › tracker › payment `{paymentId}`), **Repair rejected lines** (only when `leftOutCount > 0`, opens `repair-bulk-lines` with `{paymentId}`), **View receipt** (receipts, planned engine feature), **Done** (primary, `exit`).

##### Screen `failed` — "Bulk payment not sent" (terminal)
`result` (error): title "Bulk payment not sent", text `{ctx.error.message}`; caption "Nothing was sent for approval. No money has left the account." Buttons: **Try again** (clears `bulk.go`, to `start`), **Close**.

##### Screen `unavailable` — "Not available" (terminal)
`result` (error): title "Not available for this customer"; text "Bulk payments are only for company customers. {ctx.error.message}". Buttons **Try again** (to `start` after the upgrade; to `who` today), **Close**.

##### Screen `denied` — "Not allowed" (terminal)
`result` (error): title "You can't do this"; text "Only an initiator can send a bulk payment." Upgrade wording: "Your role doesn't allow this. Ask an administrator at {company}." Button **Close**.

#### 4. Sandbox errors
Rows marked *(planned)* come with steps 2 (identity, conditions) and the new file adapter.
| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `NOT_AUTHORISED` | "{name} is not allowed to initiate payments" (bank text, shown through `ctx.error.message`) | `denied` / `failed` | Close |
| `PERMISSION_DENIED` *(planned)* | S-PERMISSION_DENIED: "Your role doesn't allow this. Ask an administrator at Alpha Trading LLC." | `denied` | Back to Overview |
| `USER_NOT_FOUND` | "No user {id} at {company}" | `denied` | Close |
| `ACCOUNT_NOT_FOUND` | "Account not found" | `start` toast "The file was not accepted" | Choose account |
| `EMPTY_BATCH` | "The file has no payment rows. Add at least one row: beneficiary,amount,reference." (the bank says "The file has no payment lines") | `start` alert | stay |
| `BATCH_TOO_LARGE` | "The file has more than 50 rows. Split it into files of 50 rows or fewer." (the bank says "A file may have at most 50 payment lines") | `start` alert | stay |
| `NO_VALID_LINES` | "None of the lines can be paid" | `failed` | Try again |
| `CURRENCY_NOT_SUPPORTED` | "Payments are limited in USD: choose a USD account" | `failed` | Try again (to `start`) |
| `INSUFFICIENT_FUNDS` | "Insufficient funds" + caption "No money has left the account." | `failed` | Try again |
| `LIMIT_USER_EXCEEDED` | "This is above Alex Morgan's daily limit" | `failed` | Try again |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit" | `failed` | Try again |
| `OTP_REQUIRED` | S-OTP_REQUIRED: "Confirm with your one-time code first." (bank text "OTP not verified") | `failed` | Back to code |
| `OTP_INVALID` | Toast "Incorrect code" with the standard "{n} tries left"; after three, `failed`: "Too many wrong codes. Start again." | `otp` / `failed` | Try again / Start again |
| `CORE_UNAVAILABLE` | S-CORE_UNAVAILABLE: "We couldn't complete this right now. No money has left your account." (bank text "Core banking unavailable") | `failed` | Try again |
| `NOT_SUPPORTED` | "Not available for this customer" | `unavailable` | Try again |
| `FILE_FORMAT_UNSUPPORTED` *(planned)* | "That file type isn't supported. Use a CSV or XML file." | `start` alert | Choose another file |
| `FILE_TOO_LARGE` *(planned)* | "That file is too big. The limit is 256 KB." | `start` alert | Choose another file |
| `FILE_UNREADABLE` *(planned)* | "We can't read that file. Check that it is a CSV or XML file with the columns shown in the help." | `start` alert | Choose another file |
| `TIMEOUT` *(planned)* at `checkBulk` | "This is taking longer than expected. Nothing was changed." | `start` alert | Try again |
| `TIMEOUT` *(planned)* at `submitBulk` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `failed` | Check Activity (Payments › tracker) |
| `SERVICE_UNAVAILABLE` *(planned)* | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `failed` | Try again |
| `SESSION_EXPIRED` *(planned)* | S-SESSION_EXPIRED | sign-in | Sign in |
| Row codes | the row table at the top of this module | `check` rows | Fix the file |

#### 5. Adapters
| Integration id | Adapter | Request | Response | Error codes | Money moving | OTP | Status |
|---|---|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{ userId }` | company, accounts, `me`, limits, `dualApprovalAbove`, `cutoff` | `NOT_SUPPORTED` | No | No | Existing |
| `importBulk` | `corp.bulk.import` | `{ userId, format: "csv" or "xml", content }` | `{ file }` (rows normalised to `beneficiary,amount,reference` lines), `rowCount` | `FILE_FORMAT_UNSUPPORTED`, `FILE_TOO_LARGE`, `FILE_UNREADABLE`, `PERMISSION_DENIED`, `NOT_SUPPORTED` | No | No | Planned |
| `checkBulk` | `corp.bulk.check` | `{ userId, fromAccountId, file }` | `{ lines{}, problems{}, validCount, invalidCount, total, requiredApprovers, currency }` | `NOT_AUTHORISED`, `ACCOUNT_NOT_FOUND`, `EMPTY_BATCH`, `BATCH_TOO_LARGE` | No | No | Existing |
| `otpSend` | `bank.otp.send` | `{ channel: "sms" }` | `{ maskedPhone }` | – | No | – | Existing |
| `otpVerify` | `bank.otp.verify` | `{ code }` | ok | `OTP_INVALID` (carries `attempt`) | No | – | Existing |
| `submitBulk` | `corp.bulk.submit` | `{ userId, fromAccountId, file, reference }` | the payment: `id`, `status: "pending_approval"`, `amount`, `currency`, `required`, `valueDate`, `afterCutoff`, `payee` ("N payments"), `lines`; planned: `leftOut[]` | `OTP_REQUIRED`, `NOT_AUTHORISED`, `NO_VALID_LINES`, `EMPTY_BATCH`, `BATCH_TOO_LARGE`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `CORE_UNAVAILABLE` | Moves no money; creates a pending payment | Yes (OTP verified first, reset after use) | Existing; `leftOut` *(planned)* |

Bank B parity: both corporate bank APIs answer the same journey. Bank B's calls are `batches.validate` and `batches.create` with its own row shape (`creditorRef`, `amountValue`, `remark`), row verdicts `B-201` (not on the approved list), `B-202` (invalid amount), `B-203` (duplicate) and errors `ERR-4101` (empty), `ERR-4102` (too large), `ERR-4103` (no valid lines), all mapped to our codes in `mappings/bank-b.corporate.json`. The planned `corp.bulk.import` is journey-side parsing and needs no Bank B call. The planned `leftOut` list needs one mapping entry (Bank B's verdicts for failed rows). The journey bytes must not contain any Bank B word (`gate` test).

#### 6. Permissions, step-up and limits
- Permission: `biz.payments.bulk` (three checks: launch point, the journey's `authorisation`, the sandbox). Today's `authorisation` is `{ role: "initiator", rolesFrom: "ctx.company.me.roles", deniedScreen: "denied" }`; the upgrade reads `session.permissions` *(planned)* instead.
- Step-up level: `otp` (one-time code at the last step). No further step-up for a Maker.
- Limits: the whole file counts once against Alex's daily limit (250,000 at Alpha) and Alpha's daily limit (1,000,000). The person's limit is used when the file is sent; the company's when it is released. A file may have 1 to 50 rows. Two approvers above 50,000 total (one up to and including it).
- Cut-off: after 16:00 UTC, on a weekend or on 9 Nov 2026 the value date is the next working day (`afterCutoff`).
- File: 256 KB, `.csv` or `.xml` *(proposed)*.

#### 7. Result and links out
- Result: `success` (pending approval, nothing moved), reference "Payment {id}", value date.
- Receipt *(planned engine receipts)*: payment id, name of the batch, from-account, payee count, total, approvers needed, value date, started by and when, "Left out: {n} rows".
- Notifications raised: to every user who can approve at the company, "Payment awaiting your approval, Alpha Trading LLC" (deep link to `approve-payments` with `{companyId, paymentId}`); to the Maker, none on send.
- Links out: **Track payment**, **View receipt**, **Repair rejected lines** (`repair-bulk-lines`), **Done**.

#### 8. Acceptance criteria
- AC-1. Only a user whose context holds `biz.payments.bulk` can start a bulk payment; Alex at Beta is refused, even when the call is forced.
- AC-2. An empty file (nothing pasted, only spaces, or only a header row) or one with more than 50 rows is refused on `start` with a clear message; exactly 50 rows is accepted.
- AC-3. Every row is checked, and each failing row is listed with its row number and why (not on the approved list, invalid amount, duplicate).
- AC-4. The person sees how many rows will be paid, their total and the approvers needed: 1 up to and including 50,000 and 2 above it.
- AC-5. When no row can be paid the person cannot continue; when some fail, only the rows that pass are sent.
- AC-6. Sending needs a correct six-digit one-time code; a wrong or short code sends nothing; three wrong codes end the journey with nothing sent.
- AC-7. The whole file counts as one payment against the person's and the company's daily limits; when the bank refuses (limit, funds, currency) the reason is shown and nothing is sent.
- AC-8. A customer who is not a company is told it is not available.
- AC-9. Without the confirmation the bulk payment cannot be sent.
- AC-10. After the cut-off the payment goes out the next working day and the person is told the date; before it, the same day.
- AC-11. A CSV file and an XML file with the same rows give the same check result; a file of the wrong type, too big or unreadable is refused with its message and nothing is checked.
- AC-12. When rows are left out, the result offers **Repair rejected lines** and the payment keeps the list of left-out rows with their codes.
- AC-13. When the bank times out on sending, nothing is sent and the person is told to check Activity before trying again; when it is unavailable, the person is told nothing was changed.
- AC-14. The journey gives the same results on Bank B as on the reference bank.

#### 9. Scenarios
The 27 existing scenarios (T-1 to T-27 in the fixture) carry over, re-pointed to Alpha and USD amounts, with the three "who am I" scenarios (T-1 to T-3) replaced by T-1 and T-2 below. The table lists the scenarios that define the upgrade and one representative for each existing group. `persona` `alex-alpha` = Alex Morgan, active context Alpha (Maker); `alex-beta` = Alex, active context Beta (Approver); clock `2026-11-03T10:00:00Z` unless stated.

| Id | Name | Covers | Persona and setup | Conditions | Expected |
|---|---|---|---|---|---|
| T-1 | Alex as Maker at Alpha can start a bulk payment | AC-1 | `alex-alpha` | – | `start` opens; **Check** is enabled |
| T-2 | Alex at Beta is refused, also when the journey is forced | AC-1 | `alex-beta`; open the journey directly | – | `denied` with "Your role doesn't allow this. Ask an administrator at Beta Services Ltd."; forced `corp.bulk.submit` answers `PERMISSION_DENIED`; no payment exists |
| T-3 | Nothing, only spaces, header only, 51 rows | AC-2 | `alex-alpha` | – | stays on `start`; messages as in section 3; no call to the bank beyond the check |
| T-4 | Exactly 50 rows is accepted | AC-2, AC-4 | `alex-alpha`, 50 rows of `sup_textile,1000,R<n>` | – | `check` shows "50 of 50 rows" and "USD 50,000.00" and "1 approver(s)" |
| T-5 | Failing rows listed with row number and why | AC-3 | rows: valid, `sup_unknown`, `sup_logistics,abc`, a repeat of row 1, valid | – | "2 of 5 rows" will be paid; table shows "Not on the company's approved list", "The amount is not valid for this account's currency", "Same payee, amount and reference as an earlier line" |
| T-6 | Zero, negative and 3-decimal amounts are invalid | AC-3 | rows `0`, `-500`, `10.123`, `10.12` | – | only `10.12` passes (USD has 2 decimals) |
| T-7 | Exactly 50,000 needs one approver, above needs two | AC-4 | two files: 50,000.00 and 50,000.01 | – | "1 approver(s)" then "2 approver(s)"; bank `required` equals the screen |
| T-8 | Fix the file and check again | AC-4 | one bad row, **Fix the file**, new file | – | second check "3 of 3 rows" |
| T-9 | No payable row cannot continue | AC-5 | all rows bad | – | alert "No row in this file can be paid. Fix the file and check again."; if forced, `nothing` |
| T-10 | Only passing rows are sent | AC-5, AC-7 | 2 good, 1 bad | – | payment `lines` has 2 rows, total of those 2; `leftOut` has 1 |
| T-11 | Clean file sent, nothing moves | AC-4, AC-6, AC-7 | `alex-alpha`, 3 good rows | – | `success`; payment `pending_approval`; balance unchanged |
| T-12 | Wrong code, three wrong codes, short code | AC-6 | `alex-alpha` | – | "Incorrect code" toast; third wrong code lands on `failed`; `otp.code` of 3 digits stays on `otp`; no payment |
| T-13 | Two rows each under the limit, together over | AC-7 | rows 150,000 + 150,000 (limit 250,000) | – | `failed` "This is above Alex Morgan's daily limit"; no payment |
| T-14 | A file exactly at the daily limit is sent; earlier payments count | AC-7 | 250,000 file; second run with 10,000 already used | – | sent; refused |
| T-15 | A file from a EUR account | AC-7 | EUR Collections as source | – | `failed` "Payments are limited in USD: choose a USD account" |
| T-16 | A customer who is not a company | AC-8 | persona `sam` (no company) | – | `unavailable` "Not available for this customer" |
| T-17 | Not ticking the confirmation | AC-9 | – | – | stays on `review` with "Tick the confirmation first" |
| T-18 | After and before the cut-off | AC-10 | clock `2026-11-03T17:00:00Z` and `2026-11-03T10:00:00Z` | – | "value date 2026-11-04" with the cut-off alert; "value date 2026-11-03" |
| T-19 | CSV and XML give the same result | AC-11 | the same 4 rows in both formats | – | equal `validCount`, `total` and row codes |
| T-20 | Wrong type, too big, unreadable | AC-11 | `.pdf`; 300 KB file; text with no commas | – | the three messages; `checkBulk` not called |
| T-21 | Left-out rows are offered for repair | AC-12 | 1 bad row of 3 | – | `success` shows "1 row(s) were left out" and **Repair rejected lines**; `corp.payments.get` shows `leftOut[0].code` |
| T-22 | Timeout on send | AC-13 | `alex-alpha`, good file | `timeout: ["corp.bulk.submit"]`, `latencyMs: 10000` | `failed` with the "Check Activity" wording; no payment; limit not used |
| T-23 | Timeout on check | AC-13 | – | `timeout: ["corp.bulk.check"]` | `start` alert "This is taking longer than expected. Nothing was changed." |
| T-24 | Service unavailable | AC-13 | – | `unavailable: ["corp.bulk.submit"]` | `failed` "This service is not available right now. Nothing was changed. Please try again in a few minutes."; no payment |
| T-25 | Same results on Bank B | AC-14 | run T-5, T-10, T-11 | `provider: "bank-b"` | identical outcomes and wording |

#### 10. Expected mutation-check survivors
Carried over from `packages/finx-mcp/src/scenarios.test.ts` (key `bulk-payment`), unchanged in meaning:
- `no-error-path` for the company lookup after "who am I": gone in the upgrade because the screen is gone; the lookup is replaced by `bank.session.get`, which cannot fail for a signed-in person.
- `no-error-path` for the two calls the sandbox never fails (code sender and resend): "The sandbox never fails here", except where T-22 to T-24 now reach them with `conditions`. Those mutants are expected to be killed in the upgrade.
- `bank-roles`: the journey's own permission check sends a person without the role to `denied` before the bank is called, so the bank's own check is covered by its unit tests.
- `bank-companyLimit`: Alpha's company limit (1,000,000) is above the most Alex can send (250,000); kill it by adding a second Maker's setup if wanted.
All other mutants are expected to be killed (row checks, 50-line limit, duplicate check, consent, code check, threshold, cut-off).

---
### ★ Repair rejected lines — `repair-bulk-lines` (planned)

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `repair-bulk-lines` |
| Purpose | A bulk payment left some rows out (not on the approved list, a bad amount, a duplicate). The Maker corrects those rows and sends them as a second payment, without uploading the whole file again. |
| Release | 1 |
| Workspace | Business |
| Status | New *(planned)*. Needs the sandbox change that keeps the left-out rows on the payment (`leftOut`) and the `repairOf` link. |
| Channels | web, mobile |
| Starting pattern | List the left-out rows → edit each row → check → review → consent → one-time code → result |
| Who may use it | A user whose context holds `biz.payments.bulk` (Alex as Maker at Alpha). |

Decision: a repair is a **new payment** with its own approval, linked to the original by `repairOf`. The original keeps its rows and its approval; it is never changed. This keeps four-eyes simple and the audit trail honest.

#### 2. Entry points
| Place › label | Passes | Permission |
|---|---|---|
| Payments › tracker › bulk payment › Repair rejected lines (shown only when `leftOut` is not empty) | `{paymentId}` | `biz.payments.bulk` |
| `bulk-payment` result screen › Repair rejected lines | `{paymentId}` | `biz.payments.bulk` |
| Notification "Bulk payment sent with {n} rows left out" | `{paymentId}` | `biz.payments.bulk` |
| Deep link `bankworkx://business/alpha/j/repair-bulk-lines?paymentId=pay_7` | `{paymentId}` | `biz.payments.bulk` |
The journey cannot be opened without `paymentId`. Without it, `start` shows "Open a bulk payment from Payments first." with a button **Go to Payments**.

#### 3. Screens
##### Screen `start` — "Rows to fix"
Blocks: `text` (title), `reviewSummary` (original payment), `dataTable` *(planned)* with editable cells, `alert`, `button`s.

On entry: `corp.payments.get {paymentId}` and `corp.bulk.leftOut {paymentId}` *(planned)*. The summary rows: "Original payment" = payment id and batch name; "Sent" = date; "Paid so far" = "{lines} of {lines + leftOut} rows, {amount}"; "Status" = `statusChip`.

Table columns:
| Column | Block | Editable | Validation | Error message |
|---|---|---|---|---|
| Row (in the original file) | text | No | – | – |
| Payee | `textInput`, or `select` of the approved list when the code is `BENEFICIARY_NOT_WHITELISTED` | Yes | Must be one of the company's approved suppliers (`ctx.company.beneficiaries`) | "Choose a supplier from the approved list." |
| Amount | `amountInput` in the account currency | Yes | Greater than 0, at most 2 decimals for USD | "Enter an amount in USD with at most 2 decimal places." |
| Reference | `textInput` | Yes | Up to 35 characters | "Use 35 characters or fewer." |
| Why it was left out | `statusChip` with the row message (see row table) | No | – | – |
| Keep | `toggle`, default on | Yes | – | – |
A row switched off is dropped from the repair (left out again, not retried).

Copy: title "Fix the rows that were left out"; body "{n} row(s) of payment {id} were not paid. Correct them here and send them as a new payment. The first payment is not changed." Alert, info: "A repaired payment needs approval again. It counts once against your daily limit."
Alert, warning, when the original is `pending_approval`: "The first payment is still waiting for approval. You can send the repair now; each payment is approved on its own."
Buttons: **Check rows** (primary: runs `checkBulk` with the corrected rows written as a file; goes to `check`), **Cancel** (secondary: `exit`).

States: Loading skeleton for the table. Empty (no left-out rows): "Nothing to repair. Every row of this payment was paid." with button **Back to payment**. Error: section 4.

##### Screen `check` — "Check the corrected rows"
Same layout and exact copy as `bulk-payment` `check` (summary rows "Will be paid", "Total", "Approvers needed"; problems list "Rows that cannot be paid"; warning for the daily-limit total). Buttons: **Continue with the rows that pass** → `review`; **Fix the rows** → `start`. If no row passes: alert "No row can be paid yet. Fix the rows and check again." and the continue button is disabled.

##### Screen `review` — "Review repair"
`reviewSummary`: "Repairs" = original payment id; "From" = same account as the original (not editable); "Payments" = count; "Total"; "Approvers needed". Alert, info: "This is a new payment. No money moves until it is approved." `consent` bound to `repair.consent`, text "I confirm the corrected payments are right", `mustBeTrue`, message "Tick the confirmation first". Buttons: **Confirm and send OTP** → `otp`; **Back** → `check`.

##### Screen `otp` — "Verify"
As `bulk-payment` `otp`. Button **Verify and send for approval** calls `otpVerify`, then `submitBulk` with `repairOf`.

##### Screen `success` — "Repair sent for approval" (terminal)
`result` success: title "Repair sent for approval"; text "{payee} totalling {amount} now wait for {required} approver(s). Nothing has left the account yet."; meta "Payment {id} repairs {originalId} · value date {valueDate}". If rows are still left out: alert warning "{n} row(s) are still left out." Buttons: **Track payment**, **Repair rejected lines** (again, if any left), **Done**.

##### Screens `failed`, `denied`
`failed` as `bulk-payment` (title "Repair not sent"; caption "Nothing was sent for approval. No money has left the account."). `denied`: "Your role doesn't allow this. Ask an administrator at {company}."

#### 4. Sandbox errors
All the codes of `bulk-payment` section 4 apply to the check and send steps with the same messages. Additional ones:
| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `PAYMENT_NOT_FOUND` | "No payment {id}" | `failed` | Back to Payments |
| `REPAIR_NOT_ALLOWED` *(planned)* | "This payment can't be repaired because it was rejected or withdrawn. Start a new bulk payment." | `failed` | Start a bulk payment (`bulk-payment`) |
| `NOTHING_TO_REPAIR` *(planned)* | "Nothing to repair. Every row of this payment was paid." | `start` empty state | Back to payment |
| `TIMEOUT` *(planned)* | check: "This is taking longer than expected. Nothing was changed."; send: "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `start` / `failed` | Try again / Check Activity |
| `SERVICE_UNAVAILABLE` *(planned)* | S-SERVICE_UNAVAILABLE | `failed` | Try again |

#### 5. Adapters
| Integration id | Adapter | Request | Response | Error codes | Money moving | OTP | Status |
|---|---|---|---|---|---|---|---|
| `payment` | `corp.payments.get` | `{ paymentId }` | the payment | `PAYMENT_NOT_FOUND` | No | No | Existing (needs an access check, README 2.3) |
| `leftOut` | `corp.bulk.leftOut` | `{ userId, paymentId }` | `{ rows[]: n, beneficiaryId, amount, reference, code, message, repaired }`, `originalCount` | `PAYMENT_NOT_FOUND`, `REPAIR_NOT_ALLOWED`, `NOTHING_TO_REPAIR`, `PERMISSION_DENIED` | No | No | Planned |
| `checkBulk` | `corp.bulk.check` | as `bulk-payment` | as `bulk-payment` | as `bulk-payment` | No | No | Existing |
| `submitBulk` | `corp.bulk.submit` | as `bulk-payment` plus `repairOf: paymentId` | the payment with `repairOf`; marks the repaired rows `repaired: true` on the original | as `bulk-payment` plus `REPAIR_NOT_ALLOWED` | Creates a pending payment | Yes | `repairOf` *(planned)* |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as `bulk-payment` | | `OTP_INVALID` | No | – | Existing |
Sandbox change *(planned)*: `initiateBulk` stores the failed rows on the payment as `leftOut` (today it keeps only the rows that passed). Bank B parity: mapping of the failed rows' verdicts `B-201` to `B-203`.

#### 6. Permissions, step-up and limits
Permission `biz.payments.bulk`. Step-up `otp`. The repair counts as a new payment against the daily limits (Alex 250,000, Alpha 1,000,000). A row repaired once is marked `repaired` and cannot be sent twice from the same original (the duplicate check also catches the same payee, amount and reference inside one file, not across payments; across payments `repaired` is the guard).

#### 7. Result and links out
Result `success`; receipt shows "Repairs {originalId}"; notification to approvers as for any payment ("Payment awaiting your approval, Alpha Trading LLC"); links **Track payment** (the tracker shows the repair linked under the original), **Repair rejected lines**, **Done**.

#### 8. Acceptance criteria
- AC-1. Only a user with `biz.payments.bulk` can repair; a user without it is refused, also when the call is forced.
- AC-2. The journey lists exactly the rows the original left out, each with its row number, its values and the reason.
- AC-3. A corrected row is checked again by the bank with the same rules as in `bulk-payment`; rows that still fail are listed and left out again.
- AC-4. A repair is a new payment with its own approval and counts once against the daily limits; the original payment is not changed.
- AC-5. A row that has been repaired cannot be repaired a second time; when nothing is left the person is told.
- AC-6. A rejected or withdrawn payment cannot be repaired.
- AC-7. Sending needs a confirmation and a correct six-digit one-time code; three wrong codes end the journey with nothing sent.
- AC-8. On a timeout or when the service is unavailable nothing is sent and the person is told what to do.

#### 9. Scenarios
Persona `alex-alpha` unless stated. Setup creates, as Alex with a verified code, payment `{{setup.p}}` from the file `sup_textile,100000,A / sup_unknown,5000,B / sup_logistics,abc,C` (rows 2 and 3 are left out); clock `2026-11-03T10:00:00Z`.
| Id | Name | Covers | Setup and steps | Conditions | Expected |
|---|---|---|---|---|---|
| T-1 | Maker repairs two rows | AC-2, AC-3, AC-4 | open with `paymentId`; set row 2 payee `sup_packaging`, row 3 amount `2500`; **Check rows**; consent; code `482100` | – | `success`; new payment `repairOf` the original; original `status` and `lines` unchanged; original `leftOut` rows marked `repaired` |
| T-2 | The table shows exactly the left-out rows | AC-2 | open with `paymentId` | – | two rows, codes `BENEFICIARY_NOT_WHITELISTED` and `INVALID_AMOUNT`, with the row messages |
| T-3 | A row still wrong is left out again | AC-3 | set row 2 to `sup_unknown2` | – | `check` shows "1 of 2 rows" and the message "Not on the company's approved list" |
| T-4 | Switch a row off | AC-3 | set row 3 Keep off | – | only row 2 is sent |
| T-5 | Repair counts against the limit | AC-4 | setup uses 200,000 of Alex's 250,000 first; repair 60,000 | – | `failed` "This is above Alex Morgan's daily limit" |
| T-6 | Cannot repair twice | AC-5 | repair both rows; open again | – | empty state "Nothing to repair. Every row of this payment was paid." |
| T-7 | Rejected original | AC-6 | setup: Dana at Alpha rejects the original | – | `failed` "This payment can't be repaired because it was rejected or withdrawn. Start a new bulk payment." |
| T-8 | Alex at Beta, forced | AC-1 | `alex-beta` | – | `PERMISSION_DENIED`; no new payment |
| T-9 | No confirmation, wrong code, three wrong codes | AC-7 | – | – | "Tick the confirmation first"; "Incorrect code"; `failed`, no payment |
| T-10 | Timeout on send | AC-8 | – | `timeout: ["corp.bulk.submit"]` | `failed` with the "Check Activity" wording; no new payment |
| T-11 | Unavailable | AC-8 | – | `unavailable: ["corp.bulk.leftOut"]` | `start` error "This service is not available right now. Nothing was changed. Please try again in a few minutes." |

#### 10. Expected mutation-check survivors
- `bank-roles` and `bank-companyLimit`: the same reasons as `bulk-payment` (the journey's permission check comes first; Alpha's company limit is above one Maker's limit).
- `no-error-path` for `corp.payments.get` on entry: the payment always exists for a link from the tracker; a forced bad id is covered by `PAYMENT_NOT_FOUND` in the bank's unit tests.
Everything else is expected to be killed.

---

### ★ Payroll run — `payroll-run`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `payroll-run` |
| Purpose | A Maker pays the company's employees for one pay period from a file, checked row by row against the payroll register, and sent for approval as one run that always needs two different approvers. |
| Release | 1 |
| Workspace | Business |
| Status | Existing: `fixtures/payroll-run.ts` (id `jrn_payroll_run`, 13 criteria, 28 scenarios). Upgraded here: file upload, table, context permissions, timeout and unavailable states, period from the launch point. |
| Channels | web, mobile |
| Starting pattern | Period and file → check → review → consent → one-time code → result |
| Who may use it | A user whose context holds `biz.payroll.run` (Alex as Maker at Alpha). |

#### 2. Entry points
| Place › label | Passes | Permission |
|---|---|---|
| Overview › **+** › Run payroll | – | `biz.payroll.run` |
| Payments › hub › Run payroll | `{period}` optional (default: the current month, `2026-11` on the sandbox clock) | `biz.payroll.run` |
| Payments › bulk and payroll history › New run | – | `biz.payroll.run` |
| Deep link `bankworkx://business/alpha/j/payroll-run?period=2026-10` | `{period}` | `biz.payroll.run` |

#### 3. Screens
**As built today.** `who`, `start` (Payroll file), `check` (Check the payroll), `nothing`, `review` (Review payroll run), `otp`, `success`, `failed`, `unavailable`, `denied`. Bound data: `session.userId`, `pay.period`, `pay.fromAccountId`, `pay.file`, `pay.go`, `pay.consent`, `otp.code`. Pasted rows are `employee,amount,reference`.
**Upgrade.** `who` removed; `start` gets `fileUpload` and a month picker; `check` shows the whole file in a `dataTable`; the period can arrive from the launch point.

##### Screen `start` — "Payroll file"
Blocks: `stepper` (`start, check, review, otp`), `textInput` (period) or `datePicker` *(planned)* in month mode, `accountPicker`, `select` chips (upload or paste) *(new)*, `fileUpload` *(planned)*, `textInput` (`lines: 8`), `text`, conditional `alert`s, `button`s.
| Label | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Pay period (YYYY-MM) | `textInput` `bind: pay.period`, placeholder `2026-10`, pattern `^[0-9]{4}-[0-9]{2}$` (upgrade: `datePicker` month mode) | Yes | Format YYYY-MM here; the bank decides whether it is a real month and not later than this month | "Enter the pay period as YYYY-MM, for example 2026-10" (exact `patternMessage`) |
| Pay from | `accountPicker` `bind: pay.fromAccountId`, `showBalance` | Yes | An account of the company | "Choose the account to pay from." (new) |
| Payroll file | `textInput` `bind: pay.file`, `lines: 8`, placeholder `emp_ali,3600,Salary October` | Yes (paste mode) | At least one non-space character | "Paste the payroll file first: one row per employee" (exact) |
| Payroll file (upload) | `fileUpload` *(planned)* `bind: pay.upload`, `.csv` or `.xml`, 256 KB | Yes (upload mode) | as `bulk-payment` | the three file messages of `bulk-payment` section 4 |
Caption (exact): "One row per employee: employee,amount,reference. Up to 50 rows. Only employees on the payroll register can be paid, once each, and at most 1.5 times their monthly salary."
Alerts: `INVALID_PERIOD` or `PAYROLL_ALREADY_RUN` show `{ctx.error.message}`; `EMPTY_BATCH`: "The file has no employee rows. Add at least one row: employee,amount,reference."; `BATCH_TOO_LARGE`: "The file has more than 50 rows. Split it into files of 50 rows or fewer."
Buttons: **Check** → runs `checkPayroll`, goes to `check`; **Close** → `exit`. States as `bulk-payment` `start`.

##### Screen `check` — "Check the payroll"
`reviewSummary` rows (exact): "Pay period" = period; "Will be paid" = "{validCount} of {validCount + invalidCount} rows"; "Total"; "Approvers needed" = "{requiredApprovers} different approvers". Caption: "A payroll run always needs 2 different approvers, whatever its total."
Alerts: warning when some rows fail "{n} row(s) cannot be paid and will be left out. Fix the file and check again, or continue with only the rows that pass."; error when none pass "No row in this file can be paid. Fix the file and check again."; warning for the daily-limit total as in `bulk-payment`.
`dataTable` *(planned)* (as built: a "Rows in the file" list plus a "Rows left out and why" list):
| Column | Content | Sort / filter |
|---|---|---|
| Row | `n` | sort |
| Employee | `payee` (name) or raw id | search |
| Amount | in the account currency | sort |
| Salary cap | "up to {1.5 x salary}" *(new)* | – |
| Reference | `reference` | search |
| Result | "will be paid" or the row message | filter All / Will be paid / Left out |
Buttons: **Continue with the rows that pass** → `review` (rule: if `pay.go && validCount == 0` go to `nothing`); **Fix the file** → `start`.

##### Screen `nothing` — branch
As `bulk-payment` `nothing`. Exact: "No row in this file can be paid, so there is nothing to send for approval. Fix the file and check again."

##### Screen `review` — "Review payroll run"
Summary rows: "Pay period", "From", "Employees paid", "Total", "Left out" = "{n} row(s)", "Approvers needed" = "{n} different approvers". Alert, info (exact): "The whole payroll is sent for approval as one run and counts once against your and the company's daily limits. It needs 2 different approvers. No money moves until the second one approves." `consent` `pay.consent`, `termsVersion: "corporate-payroll-v1"`, text "I confirm the salaries in this payroll are correct", message "Tick the confirmation first". Buttons **Confirm and send OTP** → `otp`; **Back** → `check`.

##### Screen `otp`, `success`, `failed`, `unavailable`, `denied`
`otp`: as `bulk-payment` (button **Verify and send for approval**, calls `otpVerify` then `submitPayroll`). `success` (exact): title "Sent for approval"; text "{payee} totalling {amount} now waits for {required} different approvers. Nothing has left the account yet."; meta "Payment {id} · value date {valueDate}"; payee reads "Payroll 2026-10 · 3 employees". Buttons: **Track payment**, **View receipt**, **Go to approvals** (not shown: Alex at Alpha cannot approve), **Done**. `failed`: title "Payroll not sent", text `{ctx.error.message}`, caption "Nothing was sent for approval. No money has left the account.", buttons **Try again** (to `start`) and **Close**. `unavailable`: "Not available for this customer" / "Payroll runs are only for company customers. {ctx.error.message}". `denied`: upgrade wording "Your role doesn't allow this. Ask an administrator at {company}." (today: "Only an initiator can send a payroll run.").

#### 4. Sandbox errors
| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `INVALID_PERIOD` | "Choose a pay period as YYYY-MM, not later than this month" | `start` alert | stay |
| `PAYROLL_ALREADY_RUN` | "Payroll for {period} has already been started" | `start` alert | stay; the period is free again after the run is withdrawn or rejected |
| `NOT_AUTHORISED`, `PERMISSION_DENIED` *(planned)*, `USER_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `NOT_SUPPORTED` | as `bulk-payment` | `denied` / `start` / `unavailable` | as there |
| `EMPTY_BATCH`, `BATCH_TOO_LARGE` | as in the alerts above | `start` | stay |
| `NO_VALID_LINES` | "None of the lines can be paid" | `failed` | Try again |
| `CURRENCY_NOT_SUPPORTED` | "Payments are limited in USD: choose a USD account" | `failed` | Try again |
| `INSUFFICIENT_FUNDS` | "Insufficient funds" | `failed` | Try again |
| `LIMIT_USER_EXCEEDED` | "This is above Alex Morgan's daily limit" | `failed` | Try again |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit" | `failed` | Try again |
| `OTP_REQUIRED`, `OTP_INVALID`, `CORE_UNAVAILABLE` | standard messages S-OTP_REQUIRED, S-OTP_INVALID, S-CORE_UNAVAILABLE | `otp` / `failed` | as standard |
| Row codes | table at the top of this module | `check` | Fix the file |
| File codes *(planned)* | as `bulk-payment` | `start` | Choose another file |
| `TIMEOUT` *(planned)* | check: "This is taking longer than expected. Nothing was changed." Send: "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `start` / `failed` | Try again / Check Activity |
| `SERVICE_UNAVAILABLE` *(planned)* | S-SERVICE_UNAVAILABLE | `failed` | Try again |

#### 5. Adapters
| Integration id | Adapter | Request | Response | Error codes | Money moving | OTP | Status |
|---|---|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{ userId }` | company, accounts, `employees`, `me`, limits | `NOT_SUPPORTED` | No | No | Existing |
| `importBulk` | `corp.bulk.import` | `{ userId, format, content }` | `{ file, rowCount }` (rows `employee,amount,reference`) | file codes | No | No | Planned |
| `checkPayroll` | `corp.payroll.check` | `{ userId, fromAccountId, period, file }` | `{ lines{}, problems{}, validCount, invalidCount, total, requiredApprovers: 2, period, currency }` | `NOT_AUTHORISED`, `ACCOUNT_NOT_FOUND`, `INVALID_PERIOD`, `PAYROLL_ALREADY_RUN`, `EMPTY_BATCH`, `BATCH_TOO_LARGE` | No | No | Existing |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | | | `OTP_INVALID` | No | – | Existing |
| `submitPayroll` | `corp.payroll.submit` | `{ userId, fromAccountId, period, file }` | the payment: `status: "pending_approval"`, `required: 2`, `period`, `payee` ("Payroll 2026-10 · 3 employees"), `lines` | `OTP_REQUIRED`, `NOT_AUTHORISED`, `INVALID_PERIOD`, `PAYROLL_ALREADY_RUN`, `NO_VALID_LINES`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `CORE_UNAVAILABLE` | Creates a pending payment, moves no money | Yes | Existing |
Rules enforced by the bank: the period matches `^(\d{4})-(0[1-9]|1[0-2])$` and is not later than the current month; a period is taken while a run for it is pending or released (a rejected or withdrawn run frees it); a line may be at most `SALARY_CAP_FACTOR = 1.5` times the monthly salary (exactly 1.5 passes); an employee appears once per run; the run is one payment against the limits and has `required: 2` however small. Bank B parity: verdicts `B-201` to `B-205` (the last two are `NOT_AN_EMPLOYEE` and `ABOVE_SALARY_CAP`) and errors `ERR-4111` (period), `ERR-4112` (already run), plus `ERR-4101` to `ERR-4103`; all mapped in `bank-b.corporate.json`.

#### 6. Permissions, step-up and limits
- Permission `biz.payroll.run`. Step-up `otp`.
- Limits: one payment against Alex's limit (250,000) and Alpha's (1,000,000); 1 to 50 rows; always 2 different approvers regardless of the dual-approval threshold.
- Salary cap 1.5 x the monthly salary on the register: Ali 5,400.00; Sana 7,200.00; Bilal 4,500.00; Hina 9,600.00.
- No cut-off rule of its own: a late run just gets the next working day as value date.

#### 7. Result and links out
Result `success`; receipt: period, employees paid, total, approvers needed (2), value date, left out; notification to approvers "Payment awaiting your approval, Alpha Trading LLC"; links **Track payment** (tracker shows "Payroll 2026-11 · 3 employees" with the two-signature timeline), **View receipt**, **Done**.

#### 8. Acceptance criteria
- AC-1. Only a user whose context holds `biz.payroll.run` can start a payroll run; Alex at Beta is refused, also when forced.
- AC-2. A customer who is not a company is told it is not available.
- AC-3. A period not written as YYYY-MM is refused on the screen; a period that is not a real month or is later than this month is refused with the bank's reason; this month or an earlier month is accepted.
- AC-4. A period already started is refused with the bank's reason; when that run is withdrawn or rejected, the period is free again.
- AC-5. Each row left out is listed with why (not on the register, paid twice, above 1.5 x salary, invalid amount); the total counts only the rows that pass; only those rows are sent.
- AC-6. Exactly 1.5 x the monthly salary is paid; one cent above is left out.
- AC-7. When no row can be paid the person cannot continue and nothing is sent.
- AC-8. The run needs 2 different approvers, even for a small total, and the bank records 2.
- AC-9. Sending moves no money; after one approval it is still pending; the second, different approver releases it and the money moves.
- AC-10. The total counts once against the daily limit: rows each under it but together over it are refused with the reason; a total exactly at the limit is sent.
- AC-11. Sending needs a correct six-digit code; a wrong or short code sends nothing; three wrong codes end the journey.
- AC-12. The approval list shows the run as "Payroll 2026-10 · N employees".
- AC-13. Without the confirmation the run cannot be sent.
- AC-14. A file of the wrong type, too big or unreadable is refused and nothing is checked; CSV and XML give the same result.
- AC-15. On a timeout nothing is sent and the person is told to check Activity; when unavailable, nothing was changed.
- AC-16. The journey gives the same results on Bank B.

#### 9. Scenarios
Persona `alex-alpha` unless stated; clock `2026-11-03T10:00:00Z`; period `2026-10` unless stated. The 28 existing scenarios carry over with USD amounts (the three "who am I" ones become T-1 and T-2).
| Id | Name | Covers | Setup and steps | Conditions | Expected |
|---|---|---|---|---|---|
| T-1 | Maker can start a run; Alex at Beta cannot | AC-1 | `alex-alpha` opens; `alex-beta` opens and forces `corp.payroll.submit` | – | `start` opens; `denied` and `PERMISSION_DENIED`; no payment |
| T-2 | An approver-only user is refused | AC-1 | `dana` at Alpha (approver, cannot initiate) opens it | – | `denied` |
| T-3 | Not a company | AC-2 | persona `sam` | – | "Not available for this customer" |
| T-4 | Period format, non-month, next month, this month | AC-3 | `2026-1`, `2026-13`, `2026-12`, `2026-11` | – | format message; "Choose a pay period as YYYY-MM, not later than this month" for `2026-13` and `2026-12`; `2026-11` accepted |
| T-5 | Period already started; withdrawn; rejected | AC-4 | start `2026-10`, start again; withdraw; reject by Dana | – | "Payroll for 2026-10 has already been started"; after withdraw or reject the check passes |
| T-6 | Each row left out has a reason | AC-5 | rows: `emp_ali,3600`, `emp_sana,7200.01`, `emp_zzz,1000`, `emp_bilal,abc`, `emp_ali,100` | – | the four messages in the row table; total counts Ali only |
| T-7 | Zero and negative amounts | AC-5 | `emp_ali,0`, `emp_sana,-1` | – | both "The amount is not valid for this account's currency" |
| T-8 | Exactly 1.5 x pays; one cent above is out | AC-6 | `emp_ali,5400.00` then `emp_ali,5400.01` | – | passes; "More than 1.5 times this employee's monthly salary" |
| T-9 | No row can be paid | AC-7 | all rows bad; **Continue** is forced | – | alert; `nothing` |
| T-10 | Small run needs 2 approvers, moves nothing; one approval still pending; second releases | AC-8, AC-9 | Alex sends `emp_bilal,1000`; Dana approves; Lee approves | – | `required` 2; after sending and after Dana: `pending_approval`, balance unchanged; after Lee: `released`, balance down by 1,000 |
| T-11 | Rows each under the limit, together over | AC-10 | rows 130,000 + 130,000 | – | `failed` "This is above Alex Morgan's daily limit" |
| T-12 | Total exactly at the limit | AC-10 | total 250,000.00 | – | sent |
| T-13 | Wrong code, three wrong codes, short code | AC-11 | – | – | "Incorrect code"; `failed`; stays on `otp` |
| T-14 | Approver sees the run's name | AC-12 | Dana opens `approve-payments` | – | row "Payroll 2026-10 · 3 employees" |
| T-15 | No confirmation | AC-13 | – | – | "Tick the confirmation first" |
| T-16 | Wrong type, too big, unreadable; CSV equals XML | AC-14 | `.pdf`, 300 KB, junk; same 3 rows in CSV and XML | – | file messages; equal results |
| T-17 | Timeout on send | AC-15 | good file | `timeout: ["corp.payroll.submit"]` | `failed` "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice."; period still free |
| T-18 | Unavailable on check and on send | AC-15 | – | `unavailable: ["corp.payroll.check"]`, then `["corp.payroll.submit"]` | `start` and `failed` show "This service is not available right now. Nothing was changed. Please try again in a few minutes."; no payment |
| T-19 | Bank B | AC-16 | run T-6, T-8, T-10 | `provider: "bank-b"` | same outcomes and wording |

#### 10. Expected mutation-check survivors
From `scenarios.test.ts` (key `payroll-run`):
- `no-error-path` for the company lookup: replaced by `bank.session.get`, which cannot fail for a signed-in person.
- `no-error-path` for the code sender and its resend: killed in the upgrade by T-17 and T-18 `conditions`.
- `bank-roles`: the journey's permission check comes first.
- `bank-whitelist`: a payroll run pays the payroll register, not the approved suppliers, so this rule does not apply (the employee checks have their own mutants).
- `bank-companyLimit`: Alpha's company limit is above what one Maker can send.
- `bank-cutoff`: no cut-off rule for payroll; a late run only gets the next working day's value date.

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

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `approve-payments` |
| Purpose | An Approver reviews one or several payments started by others, then approves or rejects them. The last approval moves the money. |
| Release | 1 |
| Workspace | Business |
| Status | Existing: the pattern `corporate-approval` in `fixtures/corporate-payments.ts` (id `jrn_corporate_approval`, 9 criteria, 11 scenarios, `meezan` app, company Acme). Upgraded here: opens from the inbox with a payment or a selection, no "who am I", permissions from the context, step-up above a threshold, batch approve with a result for every payment, timeout and unavailable states. |
| Channels | web, mobile |
| Starting pattern | Review → consent → (step-up) → one-time code → result; batch: select → review list → consent → step-up → one code → per-payment result list |
| Who may use it | A user whose context holds `biz.approvals.approve` (Alex Morgan as Approver at Beta). Not Alex at Alpha. |

#### 2. Entry points
| Place › label | Passes | Permission |
|---|---|---|
| Overview › Approvals queue › payment | `{paymentId}` | `biz.approvals.approve` |
| Approvals › inbox › Open, Approve, Reject | `{paymentId}` | `biz.approvals.approve` |
| Approvals › inbox › Select several › Approve {n} / Reject {n} | `{paymentIds}` | `biz.approvals.approve` |
| Notification "Payment awaiting your approval, {company}" | `{companyId, paymentId}` (switches context first) | `biz.approvals.approve` |
| Payment detail › Approve / Reject | `{paymentId}` | `biz.approvals.approve` |
| Deep link `bankworkx://business/beta/j/approve-payments?paymentId=pay_3` | `{paymentId}` | `biz.approvals.approve` |
If neither `paymentId` nor `paymentIds` is passed, the journey starts on the list screen `start` (as today). One payment goes to `review`; two or more go to `reviewBatch`.

#### 3. Screens

**As built today (`corporateApproval`).** Ten screens: `who` (sandbox: choose who you are), `start` ("Waiting for you"), `review` ("Review payment"), `otp` ("Verify"), `reject` ("Reject payment"), `approved` ("Approved", terminal), `rejected` ("Rejected", terminal), `failed` ("Not completed", terminal), `unavailable`, `denied` ("Not allowed", terminal). Bound data: `session.userId`, `appr.paymentId`, `appr.consent`, `appr.reason`, `otp.code`. Reads `corp.payments.pending`, `corp.payments.get`; writes `corp.payments.approve`, `corp.payments.reject`.

**Upgrade.** `who` removed. `start` is only used when the journey is opened without a payment. New screens `reviewBatch`, `stepUp` and `batchResult`. Everything else keeps its exact copy.

##### Screen `start` — "Waiting for you"
Shown only when no payment was passed. On enter: `corp.payments.pending {userId}` saved as `ctx.pending`; on error go to `unavailable`.
- Empty (exact): "Nothing is waiting for your approval." (`visibleWhen: len(ctx.pending) == 0`).
- List: a `menu` over `ctx.pending`. Row label "{amount} to {payee}" (for example "USD 120,000.00 to Crescent Textiles", "USD 35,600.00 to 3 payments"); row text "{reference} · started by {initiatedBy} · {approvals} of {required} approved"; icon `send`. Tapping a row saves `appr.paymentId`, loads `corp.payments.get`, goes to `review`.
- Upgrade: the row is a `dataTable` *(planned)* with checkboxes; **Review selected** goes to `reviewBatch`.
- Button **Close** (secondary) → `exit`.

##### Screen `review` — "Review payment" (single)
Blocks: `reviewSummary`, `alert`s, `consent`, `button`s.
`reviewSummary` rows (exact labels): "From" = account name and masked number; "To" = `payee`; "Amount"; "Reference"; "Started by"; "Approved so far" = "{n} of {required}"; "Value date". Upgrade adds: "Risk note" only when the amount is above the step-up threshold: "Large payment. You will be asked to confirm it's you."
For bulk and payroll the summary adds "Rows" = count and a link "View the rows" opening the `lines` table.
| Label | Block | Required | Validation | Error message |
|---|---|---|---|---|
| I have checked this payment and approve it | `consent` `appr.consent`, `termsVersion: "corporate-v1"` | Yes | `mustBeTrue` | "Tick the confirmation first" (exact) |
Alert, info (new) when `afterCutoff`: "It was started after the cut-off, so it goes out on {valueDate}."
Buttons:
| Button | Does | Leads to |
|---|---|---|
| **Approve and send OTP** (primary) | `validate`; if the amount is at or above the step-up threshold *(planned)* go to `stepUp`, else `otpSend` (toast "We couldn't send the code. Try again." and stay on error) | `otp` or `stepUp` |
| **Reject** (secondary) | – | `reject` |
| **Back** (ghost, only if opened from the list) | – | `start` |
States: Loading: skeleton summary. Error: toast "We couldn't load the payment. Try again." and **Back**. Empty: not reachable.

##### Screen `reviewBatch` — "Review {n} payments" *(new)*
Blocks: `text` (title), `dataTable` *(planned)*, `reviewSummary`, `alert`s, `consent`, `button`s.
Table columns: Payment (payee and reference), Amount, Started by, Progress ("{approvals} of {required}"), Value date, Include (`toggle`, default on). Rows can be switched off here. A row that this person cannot approve (it is theirs, or already approved) never appears: the inbox does not offer it.
`reviewSummary`: "Payments" = count included; "Total" = sum in the company currency (all selected must be in it; payments always are, `CURRENCY_NOT_SUPPORTED` blocks others); "Needs a second approver after you" = count with `required` 2 and one approval so far.
Alerts: info "You are approving {n} payments with one code. Each is checked on its own; if one can't be released, the others are not affected." Warning when the total is at or above the step-up threshold: "Large total. You will be asked to confirm it's you."
`consent` `appr.consent`: text "I have checked these payments and approve them", message "Tick the confirmation first".
Buttons: **Approve {n} and send OTP** (primary) → `stepUp` or `otp`; **Reject {n}** (secondary) → `reject`; **Back** → inbox (`exit`).
Limit: at most 20 payments *(proposed)*; more answers `SELECTION_TOO_LARGE` *(planned)*.
Empty (all switched off): button disabled, caption "Switch on at least one payment."

##### Screen `stepUp` — "Confirm it's you" *(new)*
Shown when the single amount, or the batch total, is at or above the company's step-up amount (*planned*, proposed seed: 25,000 USD at Beta). Blocks: `text` title "Confirm it's you", body "For your security, confirm it's you first. This is a large approval.", `textInput` secure "Password" (`bind: stepup.password`, required, message "Enter your password."), `button` **Confirm** (calls `stepUp`, goes to `otpSend` then `otp`), **Cancel** → `review` or `reviewBatch`. Failure `STEP_UP_REQUIRED`: "For your security, confirm it's you first." (button Confirm). A wrong password shows "That password isn't right." (code `STEP_UP_FAILED` *(planned)*, three tries then `failed`).

##### Screen `otp` — "Verify"
`otp` block: `length: 6`, `maxAttempts: 3`, `resendAfterSeconds: 60`, hint "Enter the code sent to {maskedPhone}". Button label: **Verify and approve** (single) / **Verify and approve {n}** (batch). Actions: `validate`; `otpVerify` (on error toast "Incorrect code", stay, lock after 3 to `failed`); then single: `approve` → `approved`; batch: `approveMany` *(planned)* → `batchResult`. `otp.code` must match `^[0-9]{6}$`.

##### Screen `reject` — "Reject payment"
Title "Why are you rejecting it?". `textInput` `appr.reason`, label "Reason (optional)", placeholder "Wrong supplier" (upgrade: up to 140 characters, message "Use 140 characters or fewer."). Buttons: **Reject payment** (calls `reject`, or `rejectMany` *(planned)* for a selection, goes to `rejected`), **Back** (to `review`/`reviewBatch`). No one-time code is needed for a rejection (existing rule). The reason is shown to the Maker.

##### Screen `approved` — "Approved" (terminal, single)
Two `result` blocks, one shown at a time:
- `status == 'released'`: title "Payment released"; text "{releaseReference}: {amount} has been sent."
- `status != 'released'`: title "Approved"; text "It needs {required} approvers: {n} so far. It is released when the next one approves."
Upgrade: the signatory-progress shell is shown under the result. Buttons: **Back to the list** (to `start`, or to Approvals › inbox), **Track payment**, **View receipt**, **Close**.

##### Screen `batchResult` — "Approvals done" *(new, terminal)*
The per-item result list. It always appears after a batch, whatever happened, because one code covers many payments and the person must see each outcome.
- Header `result` block, tone by outcome: all succeeded (success) "All {n} approved"; some failed (warning) "{ok} of {n} approved, {bad} not approved"; none succeeded (error) "None of the {n} payments could be approved".
- Text: "No payment was approved twice. Payments that were not approved are untouched."
- A `dataTable` *(planned)* "What happened to each payment": 
| Column | Content |
|---|---|
| Payment | `payee` and reference |
| Amount | with currency |
| Result | `statusChip`: Released (green, with `releaseReference`), Approved, waiting for second approver (amber, "{n} of {required}"), Not approved (red, with the reason below) |
| Reason | Empty on success; otherwise the message of the code (table in section 4) |
| Action | For a failure that can be retried (`INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`): **Try again later** (opens the payment detail); for others none |
- Failed rows are listed first. The summary under the table: "Released: {n} · Waiting for a second approver: {n} · Not approved: {n}".
- Buttons: **Back to approvals** (primary; the list drops the payments no longer pending), **Retry the {k} that failed** (shown only when at least one failed with a retryable code; it returns to `reviewBatch` with only those rows on and needs a new code), **Close**.
- Partial failure rules: the bank processes the payments in the order of the list (oldest first); one failure never stops the others; an earlier release in the same batch uses part of the company's daily limit, so a later payment can fail with `LIMIT_COMPANY_EXCEEDED` even though it would have passed alone (the result says so: "This is above the company's daily limit. Earlier payments in this batch used part of it."). A payment that fails at release has its approval taken back (existing: `approvals.pop()`), so nothing is half-approved.

##### Screen `rejected` — "Rejected" (terminal)
Single: `result` success, title "Payment rejected", text "Nothing has left the account. The person who started it can see your reason." Batch *(new)*: the same per-item list as `batchResult` with the title "{ok} of {n} rejected". Buttons: **Back to the list**, **Close**.

##### Screen `failed` — "Not completed" (terminal)
`result` error: title "Not completed", text `{ctx.error.message}`; caption "No money has left the account." Buttons: **Try again** (to `start`), **Close**. Upgrade: the button depends on the code (section 4).

##### Screen `unavailable` and `denied` (terminal)
`unavailable`: title "We can't open this right now", text `{ctx.error.message}`; **Try again**, **Close**. `denied` today: title "You can't do this", text "Only an approver can use this. You are signed in as {name}." Upgrade wording: "Your role doesn't allow this. Ask an administrator at {company}." with button **Back to Overview**.

#### 4. Sandbox errors
Bank text is what the sandbox says today; "Shown as" is what the person sees. Rows marked *(planned)* arrive with step 2 and the new adapters.
| Code | Shown as | Screen | Button |
|---|---|---|---|
| `NOT_AUTHORISED` | "{name} is not allowed to approve payments" (bank text; for reject "{name} is not allowed to reject payments") | `failed` / `denied` | Close |
| `PERMISSION_DENIED` *(planned)* | S-PERMISSION_DENIED: "Your role doesn't allow this. Ask an administrator at {company}." | `denied` | Back to Overview |
| `SELF_APPROVAL` | "You cannot approve a payment you started" | single: `failed`; batch: row reason | Back to the list |
| `ALREADY_APPROVED` | "You have already approved this payment" | single: `failed`; batch: row reason | Back to the list |
| `PAYMENT_NOT_PENDING` | "This payment is already {released/rejected}" (bank: "This payment is already released") | `failed` / row reason | Back to the list |
| `PAYMENT_NOT_FOUND` | "No payment {id}" | `failed` / row reason | Back to the list |
| `USER_NOT_FOUND` | "No user {id} at {company}" | `denied` | Close |
| `INSUFFICIENT_FUNDS` | "Insufficient funds" (the approval is taken back; the payment stays pending) + "No money has left the account." | `failed` / row reason | Back to the list |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit" (approval taken back; stays pending) | `failed` / row reason | Back to the list |
| `OTP_REQUIRED` | S-OTP_REQUIRED: "Confirm with your one-time code first." (bank: "OTP not verified") | `failed` | Back to code |
| `OTP_INVALID` | Toast "Incorrect code" + "{n} tries left"; after 3: "Too many wrong codes. Start again." | `otp` / `failed` | Try again / Start again |
| `CORE_UNAVAILABLE` | S-CORE_UNAVAILABLE | `failed` | Try again |
| `NOT_SUPPORTED` | "Not available for this customer" | `unavailable` | Try again |
| `STEP_UP_REQUIRED` *(planned)* | S-STEP_UP_REQUIRED: "For your security, confirm it's you first." | `stepUp` | Confirm |
| `STEP_UP_FAILED` *(planned)* | "That password isn't right." | `stepUp` | Confirm |
| `NOT_YOUR_TURN` *(planned, sequential groups)* | "This payment is waiting for an earlier approver first." | `failed` / row reason | Back to the list |
| `SELECTION_TOO_LARGE` *(planned)* | "You can approve up to 20 payments at a time." | inbox hint / `failed` | Back to the list |
| `EMPTY_SELECTION` *(planned)* | "Choose at least one payment." | `start` | stay |
| `TIMEOUT` *(planned)* | Single or batch approve: "We didn't get an answer in time. Check Activity before you try again, so you don't approve twice." Reject: "This is taking longer than expected. Nothing was changed." | `failed` | Check Activity / Try again |
| `SERVICE_UNAVAILABLE` *(planned)* | S-SERVICE_UNAVAILABLE: "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `failed` | Try again |
| `SESSION_EXPIRED` *(planned)* | S-SESSION_EXPIRED | sign-in | Sign in |
| `WRONG_CONTEXT` *(planned)* | S-WRONG_CONTEXT, from a notification opened in the other workspace | switch | Switch |

Planned fix that comes with this journey (README 2.3): `rejectPayment` must also answer `SELF_APPROVAL`-style refusal for the person who started the payment; today only the role is checked. A Maker who wants their own payment back uses `withdraw-payment`.

#### 5. Adapters
| Integration id | Adapter | Request | Response | Error codes | Money moving | OTP | Status |
|---|---|---|---|---|---|---|---|
| `company` | `corp.company.get` | `{ userId }` | company, accounts, `me`, limits, `dualApprovalAbove`, `cutoff` | `NOT_SUPPORTED` | No | No | Existing |
| `pending` | `corp.payments.pending` | `{ userId, as? }` | object keyed by payment id (payments with `payee`) | `USER_NOT_FOUND`, `NOT_SUPPORTED` | No | No | Existing |
| `payment` | `corp.payments.get` | `{ paymentId }` | the payment | `PAYMENT_NOT_FOUND` | No | No | Existing (access check *planned*) |
| `stepUp` | `bank.session.stepUp` | `{ password }` | `{ stepUpUntil }` | `STEP_UP_FAILED` | No | No | Planned |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{ channel }` / `{ code }` | | `OTP_INVALID` | No | – | Existing |
| `approve` | `corp.payments.approve` | `{ userId, paymentId }` | the payment: `released` with `releaseReference`, or `pending_approval` with `approvals` | `OTP_REQUIRED`, `NOT_AUTHORISED`, `PAYMENT_NOT_FOUND`, `PAYMENT_NOT_PENDING`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`, `CORE_UNAVAILABLE` | Yes: the last approval moves the money | Yes (reset after each approval) | Existing |
| `approveMany` | `corp.payments.approveMany` | `{ userId, paymentIds[] (1 to 20) }` | `{ results[]: { paymentId, ok, status, releaseReference?, approvals?, code?, message? }, released, pending, failed }` | whole call: `OTP_REQUIRED`, `NOT_AUTHORISED`, `PERMISSION_DENIED`, `EMPTY_SELECTION`, `SELECTION_TOO_LARGE`, `STEP_UP_REQUIRED`, `CORE_UNAVAILABLE`; per payment: `PAYMENT_NOT_FOUND`, `PAYMENT_NOT_PENDING`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`, `NOT_YOUR_TURN` | Yes | Yes: one verified code covers the whole call and is used up when the call ends | Planned |
| `reject` | `corp.payments.reject` | `{ userId, paymentId, reason? }` | the payment, `rejected` | `NOT_AUTHORISED`, `PAYMENT_NOT_FOUND`, `PAYMENT_NOT_PENDING` | No (gives the Maker's daily limit back) | No | Existing |
| `rejectMany` | `corp.payments.rejectMany` | `{ userId, paymentIds[], reason? }` | `{ results[] }` as above | as `reject` | No | No | Planned |
Behaviour of `approveMany` (specified so the sandbox, the journey and Bank B agree): each payment is processed by the same code as `corp.payments.approve`; the order is `initiatedAt`, then id; a failure is recorded in `results` and the loop goes on; the call itself succeeds (`ok` per row); only the whole-call codes above throw. Bank B parity: implemented as a loop over Bank B's `payments.authorise` inside the mapping layer, with its own per-item error codes mapped (`ERR-4093` self approval, `ERR-4094` already approved, `ERR-4095` not pending, `ERR-4091` funds, `ERR-4292` company limit).

#### 6. Permissions, step-up and limits
- Permission `biz.approvals.approve` (three checks: launch point, `authorisation`, sandbox). Today: `authorisation { role: "approver", rolesFrom: "ctx.company.me.roles", deniedScreen: "denied" }`.
- Separation of duties: `SELF_APPROVAL` and `ALREADY_APPROVED`, enforced in the bank whatever the screen shows. This is the proof for the Alex demo: Alex as Approver at Beta approves a payment started by `priya`; Alex as Maker at Alpha is refused even when the call is forced (today the sandbox says `NOT_AUTHORISED`; with the identity step it says `PERMISSION_DENIED`; both must be accepted by the scenario until step 2 lands).
- Step-up level: `otp` for amounts under the step-up amount; `stepup` (password, then code) at or above it *(planned, proposed seed 25,000 USD per payment; for a batch the total of the included payments)*.
- Limits: approving does not use the approver's own limit. It uses the company's daily limit when the money is released (Beta proposed 1,000,000 USD); the funds are checked again at release.
- Two approvers: above `dualApprovalAbove` (proposed 50,000 USD), and always for payroll.
- Batch: 1 to 20 payments *(proposed)*, one code, one step-up, a result for each.

#### 7. Result and links out
- Single result: `approved` ("Payment released" or "Approved"), or `rejected`. Batch result: `batchResult`.
- Receipt *(planned)*: payment id, payee, amount, started by, approved by (all names and times), release reference, value date.
- Notifications raised: to the Maker "Your payment {id} was approved" / "was released" / "was rejected: {reason}"; to the next approver in line "Payment awaiting your approval, {company}" when one approval is still needed.
- Links out: **Back to the list** (Approvals › inbox), **Track payment** (Payments › tracker), **View receipt**, **Close** (returns to where the person started).

#### 8. Acceptance criteria
- AC-1. Only a user whose context holds `biz.approvals.approve` can approve or reject; Alex as Maker at Alpha is refused, also when the call is forced.
- AC-2. An approver is never offered a payment they started or already approved.
- AC-3. Approving a payment that needs one approver releases it and moves the money.
- AC-4. A payment that needs two approvers is not released by the first; the second, different approver releases it.
- AC-5. Rejecting records the reason, moves no money and gives the Maker's daily limit back.
- AC-6. Approving needs the confirmation and a correct six-digit one-time code; three wrong codes end the journey with nothing approved.
- AC-7. Alex as Approver at Beta approves the payment started by `priya` and sees it released (or pending the second approver) with its reference.
- AC-8. A bulk payment or a payroll run is shown as one payment (how many payees or employees, the total) and one approval counts for all of it.
- AC-9. At or above the step-up amount the person must confirm with their password before the code.
- AC-10. A batch is approved with one code; every selected payment gets its own result; a failure of one does not stop or undo the others; a payment that fails stays pending and untouched.
- AC-11. In a batch, an earlier release can use up the company's daily limit; the later payment then fails with the limit message and stays pending.
- AC-12. In a batch, a payment that was already released by someone else, or that the person already approved, shows its own reason and the rest go through.
- AC-13. On a timeout, nothing is approved and the person is told to check Activity before trying again; when unavailable, the person is told nothing was changed.
- AC-14. Sequential signatory order is respected: a later signatory cannot approve before the earlier one (planned groups).
- AC-15. The journey gives the same results on Bank B.

#### 9. Scenarios
Personas: `alex-beta` = Alex Morgan with the active context Beta Services Ltd (Approver); `alex-alpha` = Alex with the context Alpha Trading LLC (Maker); `priya`, `omar` = Beta makers; `noor` = Beta admin; `dana`, `lee` = Alpha approvers. Setup lines use the real adapters, always with a verified code first (`bank.otp.send`, `bank.otp.verify {code: "482100"}`), `saveAs: "p"`. Clock `2026-11-03T10:00:00Z`. The 11 existing scenarios of `corporate-approval` carry over (re-pointed to Beta and USD).
| Id | Name | Covers | Persona and setup | Conditions | Expected |
|---|---|---|---|---|---|
| T-1 | Alex at Beta approves a payment started by priya | AC-7, AC-3 | `alex-beta`; setup: `priya` starts 12,000 USD to `sup_logistics`, reference "INV-9" | – | open from `{paymentId}`; consent; code `482100`; `approved`, "Payment released"; Beta's balance down 12,000 |
| T-2 | Alex at Alpha is refused even when forced | AC-1 | `alex-alpha`; setup: Alex (Maker) starts 5,000 USD; forced `corp.payments.approve` on it | – | `denied` with "Your role doesn't allow this. Ask an administrator at Alpha Trading LLC."; the forced call answers `NOT_AUTHORISED` today and `PERMISSION_DENIED` after step 2; the payment is still `pending_approval` |
| T-3 | A person never sees their own payment | AC-2 | `dana` is Approver; a user with both roles starts a payment | – | the list shows "Nothing is waiting for your approval." |
| T-4 | Self approval is refused in the bank | AC-2 | forced `corp.payments.approve` by the starter | – | `SELF_APPROVAL` "You cannot approve a payment you started" |
| T-5 | Already approved is refused | AC-2, AC-4 | 60,000 USD payment (needs two); `alex-beta` approves; forced second approve | – | `ALREADY_APPROVED` "You have already approved this payment"; payment still pending |
| T-6 | First of two does not release; second does | AC-4 | 60,000 USD; Alex approves; a second Beta approver (`sofia`, a planned seed addition) approves | – | after Alex: "It needs 2 approvers: 1 so far."; balance unchanged; after the second: `released` |
| T-7 | Reject records the reason and keeps the money | AC-5 | 8,000 USD; `alex-beta` presses **Reject** with "Wrong supplier" | – | `rejected`; `corp.payments.get` `rejectReason` "Wrong supplier"; balance unchanged; Priya's `usedToday` reduced by 8,000 |
| T-8 | No confirmation, wrong code, three wrong codes, short code | AC-6 | single payment | – | "Tick the confirmation first"; "Incorrect code"; `failed` after three; stays on `otp` for 3 digits; payment still pending |
| T-9 | Bulk and payroll are one payment | AC-8 | `priya` sends a bulk of 2 rows (40,000 + 20,000); another Maker sends a payroll | – | row "USD 60,000.00 to 2 payments" and "Payroll 2026-10 · 3 employees"; approving the bulk releases all rows once |
| T-10 | Step-up above the threshold | AC-9 | 30,000 USD payment (above 25,000) | – | after consent the `stepUp` screen shows; wrong password "That password isn't right."; right password then code; `approved` |
| T-11 | Below the threshold needs no step-up | AC-9 | 12,000 USD | – | goes straight to `otp` |
| T-12 | Batch approve: all succeed | AC-10 | three payments of 5,000, 7,000, 9,000 from `priya` and `omar`; select all; consent; one code | – | `batchResult` "All 3 approved"; three "Released" rows with references; one code used; balance down 21,000 |
| T-13 | Batch with partial failure | AC-10, AC-12 | three payments; before Alex acts, another Beta approver releases payment 2 (setup) | – | `batchResult` "2 of 3 approved, 1 not approved"; the failed row first with "This payment is already released"; the other two released |
| T-14 | Batch: a payment Alex already approved is in the selection | AC-12 | three payments; one needs two approvers and Alex approved it earlier; the three ids are passed by deep link | – | that row "You have already approved this payment"; the other two go through |
| T-15 | Batch: company limit used up by earlier payments | AC-11 | company daily limit set so the first two releases fit and the third does not | – | third row "This is above the company's daily limit. Earlier payments in this batch used part of it."; it stays `pending_approval`; balance down by the first two only |
| T-16 | Batch: funds run out at release | AC-10 | the third payment is larger than the remaining balance | – | third row "Insufficient funds"; approvals of the third `[]`; the first two released |
| T-17 | Batch needs one code and one step-up | AC-9, AC-10 | 3 payments totalling 40,000 (each under 25,000) | – | step-up screen appears (total above threshold); one code |
| T-18 | Batch limits | AC-10 | select 21 payments | – | "You can approve up to 20 payments at a time."; `SELECTION_TOO_LARGE` if forced |
| T-19 | Retry the failed ones | AC-10 | after T-13 press **Retry the 1 that failed** | – | `reviewBatch` with one row on; a new code is asked |
| T-20 | Timeout on approve | AC-13 | single payment | `timeout: ["corp.payments.approve"]` | `failed` "We didn't get an answer in time. Check Activity before you try again, so you don't approve twice."; payment still pending, no approval recorded |
| T-21 | Timeout on batch | AC-13 | three payments | `timeout: ["corp.payments.approveMany"]` | same message; none approved |
| T-22 | Unavailable | AC-13 | single and batch | `unavailable: ["corp.payments.approve"]` / `["corp.payments.approveMany"]` | "This service is not available right now. Nothing was changed. Please try again in a few minutes."; no approval |
| T-23 | Sequential order | AC-14 | group with two steps; step 2 user tries first | – | not in the inbox; forced approve answers `NOT_YOUR_TURN` |
| T-24 | Bank B | AC-15 | run T-1, T-6, T-7, T-13 | `provider: "bank-b"` | same outcomes and wording |
| T-25 | Open from a notification into the wrong workspace | AC-1 | `alex-alpha` opens a link for Beta | – | switch prompt (S-WRONG_CONTEXT); after switching, step-up and the review screen |

#### 10. Expected mutation-check survivors
From `scenarios.test.ts` (key `corporate-approval`), updated for the upgrade:
- `no-error-path` for the calls that never fail in the sandbox (company lookup, people list, code sender): killed where T-20 to T-22 reach them with `conditions`; otherwise "The sandbox never fails here".
- `no-error-path` after a right code, for a payment someone else released at the same moment: killed in the upgrade by T-13, which sets the race up in the setup (the old comment said it could not be arranged from one session).
- `no-error-path` when rejecting a payment already closed: killed by T-13 on `rejectMany` if added; else survives with "A refusal when rejecting a payment that closed cannot be arranged from one session".
- `bank-roles`: the journey's own permission check sends a person without the role to `denied` first; the bank's check is covered by its unit tests.
- `bank-companyLimit`: killed by T-15 (the per-item limit failure).
- `bank-fourEyes`: expected to survive in the single-payment path ("The pending list never offers a person their own payment"), and killed by T-4 and T-14, which force the call.
Any other survivor fails the test.

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
| Alpha Trading LLC | Currency USD; account `alpha_ops` "Operating" ••2001 USD 480,000.00; supplier `sup_harbour` "Harbour Packaging"; company limit 1,000,000.00, used 0; approval threshold 50,000.00; cut-off 16:00; Alex = Maker (`initiator`), personal daily limit 100,000.00; approvers `dana`, `lee`; admin `ravi` |
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
- Screen: Overview › + Pay a supplier. Journey: `supplier-payment`, 12,500.00 USD from Operating to Harbour Packaging, reference "INV-1042".
- Permission: `biz.payments.initiate`; step-up `otp`; limits: Alex 250,000.00 per day, company 1,000,000.00.
- State after: Alpha `pay_1`: status `pending_approval`, `initiatedBy: "alex"`, `required: 1` (12,500.00 is below the 50,000.00 threshold), `approvals: []`, `valueDate: 2026-11-04`, `afterCutoff: false`; `alpha_ops` balance still 480,000.00 (nothing leaves until released); Alex's `usedToday` 12,500.00.
- Assertion: result screen title is "Sent for approval" (the success copy of the supplier payment, 02a part) and shows the payment id; `corp.payments.get` returns `pending_approval`; `balance` is 480,000.00; `companyUsedToday` is 0 (the company limit counts at release); the Personal Main balance is not changed by this (still 8,470.76 after the later switch, step 11).

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

