# Module 6: Cash & Liquidity

Release 3. Workspace: Business "Graphite". Depth: structure plus the planned parts. Everything is **(planned)** unless it says *existing*. All people, companies, banks and amounts are synthetic. Brand: BankWorkx®.

## Scope and who uses it

Cash and liquidity answers three questions for a company that has several accounts, banks, currencies and legal entities: **How much cash do we have right now? How much will we have? And how do we put it where it is needed or where it earns?**

Covered: cash position across banks and currencies; forecasting; sweeping (automatic moves to a target balance) and notional pooling (balances netted on paper, no money moves); intercompany transfers and funding requests; FX deals; short-term deposits and investments; liquidity rules (alerts when cash is low or idle).

Who uses it: the treasury or finance team of a group. **Maker** (starts transfers, deals, deposits, forecast items), **Approver** (approves), **Admin** (builds sweep and pool structures, sets rules). Demo group: **Alpha Trading LLC** (parent, USD), **Alpha Logistics FZE** (AED) and **Alpha Europe GmbH** (EUR). Alex is Maker at Alpha; approvers `dana` and `lee`; admin `ravi`. One external bank, *Cedar Valley Bank* (synthetic), holds a USD account that BankWorkx® reads from statements.

## Release

Release 3. Needs from earlier releases: sandbox identity and context (step 2), the Business shell, the approvals inbox, and blocks `dataTable`, `timeline`, `statusChip`, `datePicker`, `chart` (batch A), `fileUpload`, `documentViewer`, `signature` (batch B).

## What exists today in code

| Thing | Where | Used here for |
|---|---|---|
| `bank.accounts.totals` | `mock-bank-api/src/index.ts` (case `bank.accounts.totals`) | **Rule: balances are added per currency and never across currencies** (returns `{ id, currency, total, count }` keyed by currency). The cash position keeps this rule. Personal only today. |
| `bank.fx.rate`, `bank.fx.quote`, `bank.fx.convert` and `fx.ts` (`PER_USD` table, spread `FX_SPREAD` 0.5%, fee `FX_FEE_RATE` 0.2%, `QUOTE_TTL_SECONDS` 30, `midRate`, `customerRate`, `priceQuote`) | `fx.ts`, `index.ts` | Rate and pricing logic reused for business FX deals. Error codes `CURRENCY_NOT_SUPPORTED`, `SAME_CURRENCY`, `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND`, `OTP_REQUIRED`, `CORE_UNAVAILABLE`. Personal accounts only. |
| `bank.deposit.create` | `index.ts` | Name only: it is **"add money from a card"** (1 to 50,000), not a term deposit. Business deposits therefore use `corp.deposit.*` to avoid confusion. |
| `CorporateSandbox` and `corp.*` adapters (`corp.company.get` returns accounts, users, limits; `corp.payments.*`) | `corporate.ts`, `index.ts` | Accounts, roles, per-user and company daily limits (`LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`), dual approval above a threshold, cut-off 16:00 UTC, closed weekends and 9 Nov 2026, `SELF_APPROVAL`, `ALREADY_APPROVED`, `CURRENCY_NOT_SUPPORTED`. Limits are in the company currency. |
| Journey `convert-currency` (Personal; screens from, to, amount, review, otp, success, failed) | `fixtures/convert-currency.ts` | Pattern for `fx-deal`. |
| `bank.otp.send`, `bank.otp.verify` (code `482100`; `000000` always accepted; engine counts only an integration named exactly `otpVerify`) | `index.ts` | Every step that changes money or standing configuration. |
| Blocks `accountPicker`, `amountInput`, `select`, `textInput`, `toggle`, `reviewSummary`, `consent`, `otp`, `result`, `alert`, `balanceList`, `accordion`, `dialog` | `schema.ts` | All screens. |
| Nothing for multi-bank positions, forecasts, sweeps, pools, intercompany, business FX deals, deposits or rules | – | All planned. |

## Sandbox domains needed (planned)

A new class `TreasurySandbox` (file `treasury.ts`) on top of `CorporateSandbox`, with a **group** (several `CorpCompany` entities), exposed through `corp.cash.*`, `corp.fx.*`, `corp.deposit.*`, `corp.pool.*`, `corp.rules.*`. Pure logic, injectable clock, named errors, `Flaws` switches for the mutation check.

| Domain | What it holds and enforces |
|---|---|
| **Group and entities** | Alpha group of three entities; each has accounts. Seed (synthetic): Alpha Trading *Operating* USD ••1201 412,300.00; *Collections* EUR ••1202 96,400.00; *Payroll* USD ••1203 58,000.00. Alpha Logistics *Operating* AED ••2201 540,000.00. Alpha Europe *Operating* EUR ••3301 210,000.00. Intercompany agreements on file between the three (`INTERCOMPANY_NOT_ALLOWED` otherwise). |
| **External accounts and statements** | Cedar Valley Bank USD ••9001 150,000.00, as of 1 Nov 2026 from an uploaded statement. A position row has `source` `live` or `statement` and an `asOf` time; older than 36 hours is `stale`. Max 10 external accounts. |
| **Cash position** | Per account: `ledger`, `available`, `asOf`, `source`. Totals per currency (never added across currencies). An indicative **equivalent in group currency (USD)** is shown separately using the mid rates in `fx.ts` and labelled "indicative". |
| **Forecast** | Items: date, direction, amount, currency, category, certainty (`confirmed`, `expected`, `possible`), recurrence (none, weekly, monthly). System items (read only): scheduled payments, approved bulk and payroll runs, deposits maturing, loans due. 13 weeks, weeks start Monday. |
| **Sweeping** | Rules: `zero` (everything above 0 goes to the master account, shortfalls are funded), `target` (keep a target balance), `threshold` (move only the part above a ceiling). Same currency only (`CURRENCY_MISMATCH`). Runs at 17:00 UTC on working days. Different legal entities create an intercompany loan balance and need an agreement. Max 20 rules; loops refused (`SWEEP_LOOP`). Has a **dry run**. |
| **Notional pooling** | A header account and participant accounts. No money moves. The bank nets balances for interest: credit rate 3.00%, debit rate 7.00%, benefit shown per day. Net pool balance must stay at or above 0 (`POOL_NEGATIVE`); each participant has a net debit limit. Every participating entity must sign the cross-guarantee (`GUARANTEE_NOT_SIGNED`). Currencies: one pool currency; other-currency accounts are netted at the mid rate. |
| **Intercompany transfers** | Same currency only (`CURRENCY_MISMATCH`: use an FX deal first). Purpose: loan, dividend, cost recharge, trade settlement. Loans create an intercompany record with the agreed rate (4.50%). Per-user and company daily limits apply to the source entity. |
| **FX deals** | Spot (value date two working days on) and forward (to 365 days). Spot price from `customerRate`; forward rate = spot customer rate × (1 + (rate of buy currency − rate of sell currency) × days / 360), with sandbox deposit rates USD 4.50%, EUR 2.50%, AED 4.40%, GBP 4.00%, SAR 5.00%. A forward longer than 90 days needs a 5% margin on the sold amount (`MARGIN_REQUIRED`). Price held 30 s for the Maker; after confirmation the deal waits for approval with the price locked for 10 minutes (`DEAL_PRICE_EXPIRED` after). Balances move on the value date. Daily dealing limit per user 250,000 USD equivalent (`DEALING_LIMIT_EXCEEDED`). |
| **Short-term deposits** | Tenors: overnight, 7, 30, 90, 180 days. USD rates: 3.10%, 3.60%, 4.05%, 4.35%, 4.50% (EUR 1.70 points lower, AED 0.20 lower). Minimum 10,000. Interest = amount × rate × days / 360. Maturity instruction: pay out, roll principal, roll principal and interest. Early break: bank pays half the interest earned to date and a 100.00 fee. Overnight must be placed before cut-off. |
| **Liquidity rules** | Minimum balance, maximum balance (idle cash), forecast low point. Evaluated each morning at 06:00 UTC and after each statement load. A breach raises one notification per rule per breach. Rules never move money. |
| **Funding requests** | A request from one entity to another (or to treasury): amount, currency, needed-by date, reason. Statuses `open`, `funded`, `declined`, `withdrawn`. |
| **Approval rule** | Same as payments: Maker cannot approve own item (`SELF_APPROVAL`); more than 250,000 USD equivalent needs two different approvers (`dualApprovalAbove`). |

## New adapters (planned)

All take the acting user from the active context and refuse a wrong context (`PERMISSION_DENIED`). All can answer `TIMEOUT` and `SERVICE_UNAVAILABLE` under planned sandbox conditions. "OTP" means `bank.otp.verify` succeeded just before (else `OTP_REQUIRED`).

| Adapter | Request | Response | Error codes | moneyMoving | requiresOtp |
|---|---|---|---|---|---|
| `corp.cash.position` | `{ asOf?, entityIds?, currency?, includeExternal? }` | map keyed by account id `{ id, entityId, bank, name, maskedNumber, currency, ledger, available, source, asOf, stale }` plus `totals` keyed by currency `{ currency, total, count }` and `equivalent: { currency:"USD", total, indicative:true }` | `ENTITY_NOT_FOUND` | no | no |
| `corp.cash.history` | `{ accountId?, currency?, from, to }` | daily closing balances | `INVALID_PERIOD` (existing code reused), `ACCOUNT_NOT_FOUND` | no | no |
| `corp.cash.external.add` | `{ bankName, accountNumber, currency, nickname, entityId, statementFile }` | `{ accountId, source:"statement", asOf }` | `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`, `FILE_UNREADABLE`, `ACCOUNT_MISMATCH`, `CURRENCY_NOT_SUPPORTED`, `DUPLICATE_ACCOUNT`, `EXTERNAL_LIMIT`, `OTP_REQUIRED` | no | yes |
| `corp.cash.external.statement` | `{ accountId, statementFile }` | `{ asOf, closing, newTransactions }` | `FILE_*`, `ACCOUNT_MISMATCH`, `ACCOUNT_NOT_FOUND` | no | no |
| `corp.cash.forecast.get` | `{ weeks:13, entityIds?, currency? }` | `{ weeks:[{ start, inflow, outflow, closing, closingConfirmedOnly }], lowPoint:{ week, amount }, items[] }` | `ENTITY_NOT_FOUND` | no | no |
| `corp.cash.forecast.save` | `{ itemId?, requestKey, entityId, accountId?, direction, amount, currency, date, category, certainty, recurrence, note? }` | `{ itemId }` | `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `DATE_INVALID`, `ITEM_NOT_FOUND`, `ITEM_READ_ONLY`, `DUPLICATE_REQUEST` | no | yes (changing a forecast changes decisions and alerts; `otp`) |
| `corp.cash.forecast.delete` | `{ itemId }` | `{}` | `ITEM_NOT_FOUND`, `ITEM_READ_ONLY` | no | yes |
| `corp.cash.transfer.quote` | `{ fromAccountId, toEntityId, toAccountId, amount, purpose }` | `{ valueDate, afterCutoff, approversRequired, loanRate?, limitsLeft }` | `ACCOUNT_NOT_FOUND`, `CURRENCY_MISMATCH`, `INTERCOMPANY_NOT_ALLOWED`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `VALUE_DATE_INVALID` | no | no |
| `corp.cash.transfer.initiate` | `{ requestKey, fromAccountId, toEntityId, toAccountId, amount, purpose, reference, valueDate?, fundingRequestId? }` | `{ requestId, status:"pending_approval", valueDate, approversRequired }` | all of `transfer.quote` plus `LIMIT_COMPANY_EXCEEDED`, `NOT_AUTHORISED`, `DUPLICATE_REQUEST`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **no at this step**; yes on the last approval | yes |
| `corp.cash.funding.create` | `{ requestKey, fromEntityId, toEntityId, accountId, amount, currency, neededBy, reason, note?, attachmentDocId? }` | `{ fundingRequestId, status:"open" }` | `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `DATE_INVALID`, `INTERCOMPANY_NOT_ALLOWED`, `DUPLICATE_REQUEST`, `NOT_AUTHORISED` | no | no |
| `corp.cash.funding.list` / `.decline` / `.withdraw` | `{ status? }` / `{ id, reason }` / `{ id }` | requests | `REQUEST_NOT_FOUND`, `REQUEST_NOT_OPEN`, `NOT_AUTHORISED` | no | no |
| `corp.fx.rate` | `{ from, to, valueDate? }` | `{ midRate, rate, forwardRate?, forwardPoints?, spreadPercent }` | `CURRENCY_NOT_SUPPORTED`, `VALUE_DATE_INVALID`, `TENOR_TOO_LONG` | no | no |
| `corp.fx.quote` | `{ sellAccountId, buyAccountId, amount, amountSide:"sell"/"buy", valueDate? }` | `{ quoteId, sell:{currency,amount}, buy:{currency,amount}, midRate, rate, fee, feeCurrency, valueDate, type:"spot"/"forward", margin?, expiresAt, ttlSeconds:30 }` | `ACCOUNT_NOT_FOUND`, `SAME_CURRENCY`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `VALUE_DATE_INVALID`, `TENOR_TOO_LONG`, `MARGIN_REQUIRED`, `DEALING_LIMIT_EXCEEDED` | no | no |
| `corp.fx.book` | `{ quoteId, requestKey }` | `{ dealId, status:"pending_approval", priceLockedUntil, approversRequired }` | `QUOTE_NOT_FOUND`, `QUOTE_USED`, `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `DUPLICATE_REQUEST`, `NOT_AUTHORISED`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **no at booking**; yes at value date | yes |
| `corp.deposit.rates` | `{ currency }` | tenors with rates | `CURRENCY_NOT_SUPPORTED` | no | no |
| `corp.deposit.quote` | `{ accountId, amount, tenor, maturity }` | `{ quoteId, rate, interest, maturityDate, total, expiresAt }` | `ACCOUNT_NOT_FOUND`, `INVALID_AMOUNT`, `BELOW_MINIMUM`, `INSUFFICIENT_FUNDS`, `TENOR_NOT_AVAILABLE`, `CUTOFF_PASSED` (overnight), `CURRENCY_NOT_SUPPORTED` | no | no |
| `corp.deposit.place` | `{ quoteId, requestKey, maturityInstruction, payoutAccountId? }` | `{ requestId, status:"pending_approval", approversRequired }` | `QUOTE_NOT_FOUND`, `QUOTE_USED`, `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `DUPLICATE_REQUEST`, `OTP_REQUIRED`, `NOT_AUTHORISED` | **no at this step**; yes on the last approval (principal leaves the account) | yes |
| `corp.deposit.list` / `.get` | – | deposits | `DEPOSIT_NOT_FOUND` | no | no |
| `corp.deposit.redeem` | `{ depositId, mode:"early"/"change-instruction", maturityInstruction?, requestKey }` | `{ requestId, payout, interest, penalty, fee }` | `DEPOSIT_NOT_FOUND`, `DEPOSIT_NOT_ACTIVE`, `ALREADY_MATURING`, `DUPLICATE_REQUEST`, `OTP_REQUIRED`, `NOT_AUTHORISED` | **yes** on the last approval (early) | yes |
| `corp.pool.get` / `.list` | – | pools with participants, net balance, benefit | `POOL_NOT_FOUND` | no | no |
| `corp.pool.simulate` | `{ participants[], currency, creditRate, debitRate }` | `{ netBalance, interestBenefitPerDay, breaches[] }` | `POOL_NEGATIVE`, `CURRENCY_NOT_SUPPORTED`, `ACCOUNT_NOT_FOUND` | no | no |
| `corp.pool.save` | `{ requestKey, mode:"create"/"change"/"close", poolId?, name, headerAccountId, participants:[{accountId, netDebitLimit}], creditRate, debitRate, effectiveDate }` | `{ requestId, status:"pending_agreements"/"pending_approval" }` | `POOL_NAME_TAKEN`, `POOL_NEGATIVE`, `ACCOUNT_IN_POOL`, `INTERCOMPANY_NOT_ALLOWED`, `DATE_INVALID`, `GUARANTEE_NOT_SIGNED`, `DUPLICATE_REQUEST`, `OTP_REQUIRED`, `NOT_AUTHORISED` | no (no money moves; interest is credited later) | yes |
| `corp.pool.accept` | `{ requestId, signedName }` | `{ status }` | `REQUEST_NOT_FOUND`, `REQUEST_NOT_OPEN`, `SIGNATURE_MISMATCH`, `OTP_REQUIRED` | no | yes |
| `corp.cash.sweep.list` / `.get` | – | rules with last runs | `RULE_NOT_FOUND` | no | no |
| `corp.cash.sweep.simulate` | `{ type, masterAccountId, participants[], target?, ceiling?, onDate }` | `{ moves:[{from,to,amount,currency}], intercompanyCreated[] }` | `CURRENCY_MISMATCH`, `SWEEP_LOOP`, `ACCOUNT_NOT_FOUND`, `INTERCOMPANY_NOT_ALLOWED`, `INVALID_AMOUNT` | no | no |
| `corp.cash.sweep.save` | `{ requestKey, mode:"create"/"change"/"pause"/"delete", ruleId?, name, type, masterAccountId, participants[], target?, ceiling?, startDate }` | `{ requestId, status:"pending_approval" }` | all of `sweep.simulate` plus `RULE_LIMIT` (20), `DATE_INVALID`, `DUPLICATE_REQUEST`, `OTP_REQUIRED`, `NOT_AUTHORISED` | no at save; **yes** each time the rule runs | yes |
| `corp.rules.list` / `.save` / `.delete` | `{ ruleId?, requestKey, name, kind:"min"/"max"/"forecast-low", scope:{accountId/entityId/group}, currency, threshold, horizonDays?, channels[], active }` | `{ ruleId }` | `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `RULE_NAME_TAKEN`, `RULE_LIMIT` (50), `ACCOUNT_NOT_FOUND`, `RULE_NOT_FOUND`, `DUPLICATE_REQUEST`, `OTP_REQUIRED`, `NOT_AUTHORISED` | no | yes |
| `corp.treasury.pending` / `.approve` / `.reject` | `{ as }` / `{ requestId }` / `{ requestId, reason? }` | request with `approvals`, `required`, `status`, `kind` | `REQUEST_NOT_FOUND`, `REQUEST_NOT_PENDING`, `NOT_AUTHORISED`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `DEAL_PRICE_EXPIRED`, `LIMIT_COMPANY_EXCEEDED`, `INSUFFICIENT_FUNDS`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **yes** on the last approval for transfer, deposit | yes (approve) |
| `corp.treasury.withdraw` | `{ requestId }` | request | `REQUEST_NOT_FOUND`, `REQUEST_NOT_PENDING`, `NOT_AUTHORISED` | no | no |
| `corp.cash.activity` | `{ kind?, status?, from?, to?, q? }` | events across the module | – | no | no |

## New components (planned, beyond the README list)

| Component | Why |
|---|---|
| `dataTable` with **grouping** (by entity, bank or currency) and **subtotal rows per currency** | Cash position table. Never a total across currencies. |
| `chart` line with **confirmed-only vs all band** and **zero line**; `chart` stacked bar | 13-week forecast; position by bank/currency. |
| `statusChip`, `timeline`, `datePicker` with **business-day hints and holidays** | Statuses, deal history, value dates. |
| `fileUpload` | Statements (MT940 `.sta`, CAMT.053 `.xml`, CSV), 5 MB. |
| `documentViewer`, `signature` | Pool cross-guarantee and agreement terms. |
| **`rateTicker`** (new, small) | Live rate with a 30-second countdown and a "Refresh" button on `fx-deal`. Can be built from `text` + a timer in the engine; a block is cleaner. |
| **`tree`** (new) | Structure view of sweep masters and pool participants (header, participants, balances). Can fall back to `accordion` + `dataTable`. |
| **`stepperInput`** (optional) | Quick +/- on thresholds; not required. |
| Engine: `navigate.toJourney` + `returnTo`, receipts | From a funding request to `intercompany-transfer`; print confirmation of a deal. |
| Engine: clock hook for scenarios (`now`) | Needed for quote expiry, price lock, cut-off, value dates and maturity. |

## Information architecture

A new Business tab **Cash** (the eighth tab in README 3.3 terms, after Trade; on phones under **More**). Shown when the context holds `biz.cash.view`. Sub-navigation: **Position · Forecast · Structure · Treasury · Funding · Rules · Activity**.

### Shell: Cash position
- **Purpose:** the answer to "how much cash do we have now?", across entities, banks and currencies.
- **Route:** web `/business/:company/cash`; mobile `CashPosition`. **Data:** `CashPositionVM` from `corp.cash.position`.
- **Widgets:** (1) *Per currency* cards (`balanceList`): one card per currency with total and account count, **never added together**; a separate small line "About {equivalent} in USD (indicative)". (2) *By bank* stacked bar (`chart`). (3) *Position table* (`dataTable`). (4) *Alerts* strip: rules breached, stale statements, unfunded requests. (5) *Today's moves*: sweeps and transfers dated today.
- **Table columns:** Entity, Bank, Account (name and ••last4), Currency, Ledger balance, Available balance, Source (chip `Live` or `Statement`), As of (date and time UTC), Status (`stale` chip over 36 hours). Group rows by currency with a subtotal row. **Filters:** entity, bank, currency, source, "include external" (default on), search. **Sort:** currency, then available descending. Phones: card per account.
- **Empty:** "No accounts to show yet. Add a bank account to see your position." Button: Add a bank account (`add-external-account`). **Loading:** skeleton cards and rows. **Error:** "We couldn't load your cash position. Nothing was changed." Try again. **Stale:** `alert` "Some balances are from a statement and may be out of date: {n} accounts." Button: Upload latest statement.
- **Drill-downs:** a row opens Accounts › account detail (existing Business place); a currency card filters the table; an alert opens Rules.

### Shell: Forecast
- **Route:** `/cash/forecast`; mobile `CashForecast`. **Data:** `ForecastVM` from `corp.cash.forecast.get`.
- **Widgets:** 13-week line chart (closing balance, confirmed-only line, zero line, low point marked); filters bar (entity, currency); *Low point* card ("Lowest: 12,400.00 USD in week of 21 Dec 2026"); weekly table (Week starting, Inflow, Outflow, Net, Closing, Closing if confirmed only); *Items* table.
- **Items columns:** Date, Direction chip, Category, Entity, Amount and currency, Certainty chip, Recurrence, Source (`Manual` or `System`), Note. **Filters:** direction, category, certainty, source, date range. **Sort:** date ascending. System rows are read only (lock icon). Row actions: Edit/Delete (manual only) → `manage-forecast-item`.
- **Empty:** "No forecast items. Add expected receipts and payments." Button Add an item. **Currency rule:** the chart shows one currency at a time; a selector defaults to the group currency; "All currencies (USD equivalent, indicative)" is a clearly labelled option.

### Shell: Structure (sweeps and pools)
- **Route:** `/cash/structure`; mobile `CashStructure`. **Data:** `StructureVM` from `corp.cash.sweep.list`, `corp.pool.list`.
- **Widgets:** two tabs *Sweeps* and *Pools*; `tree` of master/participants; *Next run* card (17:00 UTC on {date}); *Last runs* table.
- **Sweeps columns:** Name, Type chip (zero / target / threshold), Master account, Participants (count), Target or ceiling, Status chip (`active`, `paused`, `pending approval`), Last run, Last moved amount. **Pools columns:** Name, Currency, Header account, Participants, Net balance, Interest benefit per day, Status chip (`active`, `pending agreements`, `pending approval`). **Filters:** status, type, currency. **Sort:** name.
- **Empty:** "No sweep rules yet." Button New sweep rule; "No pools yet." Button New pool. **Buttons:** New/Change/Pause (`setup-sweep-rule`), New/Change/Close (`setup-notional-pool`) shown with `biz.cash.structure`.

### Shell: Treasury (FX deals and deposits)
- **Route:** `/cash/treasury`; mobile `CashTreasury`. **Data:** `TreasuryVM` from `corp.fx.*` (deal list within `corp.cash.activity`), `corp.deposit.list`.
- **Widgets:** *Rates* card (mid and our rate for USD/EUR, USD/AED, EUR/AED, USD/GBP, USD/SAR, updated time, "Indicative"); *Open deals* table; *Deposits* table.
- **Deals columns:** Deal id, Type (Spot/Forward), Sell, Buy, Rate, Value date, Status chip (`pending approval`, `booked`, `settled`, `lapsed`). **Deposit columns:** Deposit id, Account, Amount, Rate, Start, Maturity, Days left, Interest at maturity, Instruction, Status chip. **Filters:** status, currency, maturing in (7/30/90). **Sort:** value date or maturity ascending.
- **Empty:** "No deals yet." / "No deposits yet. Put idle cash to work." Buttons: New FX deal (`fx-deal`), New deposit (`place-short-term-deposit`).

### Shell: Funding requests
- **Route:** `/cash/funding`; mobile `CashFunding`. **Data:** `FundingVM` from `corp.cash.funding.list`.
- **Columns:** Requested, From (entity that is asked), To (entity that needs money), Amount, Needed by, Reason, Status chip. **Filters:** status, entity. **Sort:** needed-by ascending. **Row actions** (by role): *Fund it* → `intercompany-transfer` with `{fundingRequestId}`; *Decline* opens a `dialog` with a required reason (5–200 characters, "Tell them why (5 to 200 characters).") calling `corp.cash.funding.decline` (a shell action, not a journey); *Withdraw* for the requester. **Empty:** "No funding requests." Button Request funding (`request-funding`).

### Shell: Rules and alerts
- **Route:** `/cash/rules`; mobile `CashRules`. **Data:** `corp.rules.list`.
- **Columns:** Name, Kind chip, Scope, Currency, Threshold, Delivery, Active (switch, with confirm dialog), Last breach. **Filters:** kind, active. **Empty:** "No rules yet. Get an alert before cash runs low." Button New rule (`set-liquidity-rule`).

### Shell: Activity
- **Route:** `/cash/activity`; **Data:** `corp.cash.activity`. **Columns:** Time (UTC), Kind, Summary (plain words), Entity, By, Status chip. **Filters:** kind, status, date range, search. A transfer, deal or deposit `timeout` is checked here. **Empty:** "Nothing here yet."

### Approvals inbox change
The Approvals inbox Type filter gains **Treasury** (transfers, deals, deposits, sweep and pool structures). Opening one runs `approve-treasury-instruction`.

All shell screens: loading = skeleton; error = "We couldn't load this. Nothing was changed." with Try again.

## Launch points (planned; to be added to README 5.3)

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Cash › position (empty or header) | Add a bank account | `add-external-account` | `{entityId}` | `biz.cash.link` |
| Cash › position › stale alert | Upload latest statement | `add-external-account` (mode refresh) | `{accountId}` | `biz.cash.link` |
| Cash › forecast | Add an item / Edit | `manage-forecast-item` | `{itemId}` | `biz.cash.forecast` |
| Cash › position › account row | Move money | `intercompany-transfer` | `{fromAccountId}` | `biz.cash.transfer` |
| Cash › funding | Fund it | `intercompany-transfer` | `{fundingRequestId}` | `biz.cash.transfer` |
| Cash › funding | Request funding | `request-funding` | `{entityId}` | `biz.cash.request` |
| Cash › alerts (low balance) | Request funding | `request-funding` | `{accountId}` | `biz.cash.request` |
| Cash › treasury | New FX deal | `fx-deal` | `{pair}` | `biz.treasury.fx` |
| Cash › position › currency card | Convert | `fx-deal` | `{currency}` | `biz.treasury.fx` |
| Cash › treasury | New deposit | `place-short-term-deposit` | `{accountId}` | `biz.treasury.invest` |
| Cash › position › idle-cash alert | Put it to work | `place-short-term-deposit` | `{accountId, amount}` | `biz.treasury.invest` |
| Cash › treasury › deposit row | Redeem / Change maturity | `redeem-short-term-deposit` | `{depositId, mode}` | `biz.treasury.invest` |
| Cash › structure › sweeps | New / Change / Pause | `setup-sweep-rule` | `{ruleId, mode}` | `biz.cash.structure` |
| Cash › structure › pools | New / Change / Close | `setup-notional-pool` | `{poolId, mode}` | `biz.cash.structure` |
| Cash › rules | New / Edit | `set-liquidity-rule` | `{ruleId}` | `biz.cash.rules` |
| Approvals › inbox (type Treasury) | Open / Approve / Reject | `approve-treasury-instruction` | `{requestId}` | `biz.approvals.approve` |
| Overview › 13-week cash flow widget | Open forecast | shell (Cash › forecast) | – | `biz.cash.view` |
| Notification | "Liquidity alert: {rule}" | shell Cash › position, filtered | `{ruleId}` | `biz.cash.view` |
| Notification | "Funding requested by {entity}" | shell Cash › funding | `{fundingRequestId}` | `biz.cash.transfer` |
| Notification | "Treasury item awaiting your approval, {company}" | switch context, then `approve-treasury-instruction` | `{companyId, requestId}` | `biz.approvals.approve` |
| Notification | "Deposit matures in 3 days" | `redeem-short-term-deposit` | `{depositId, mode:"change-instruction"}` | `biz.treasury.invest` |

## New permissions (add to README 4.2)

| Permission | Allows | Typical role |
|---|---|---|
| `biz.cash.view` | See Cash: position, forecast, structure, treasury, activity | Maker, Approver, Admin |
| `biz.cash.link` | Add external accounts and upload statements | Admin, Maker |
| `biz.cash.forecast` | Add, edit and delete manual forecast items | Maker |
| `biz.cash.request` | Request funding | Maker (every entity) |
| `biz.cash.transfer` | Start intercompany transfers | Maker (treasury) |
| `biz.treasury.fx` | Start FX deals | Maker (dealer) |
| `biz.treasury.invest` | Place and redeem short-term deposits | Maker (treasury) |
| `biz.cash.structure` | Build sweep rules and notional pools | Admin |
| `biz.cash.rules` | Create liquidity rules | Admin, Maker |

Approving uses the existing `biz.approvals.approve`; the audit trail uses `biz.audit.view`. Demo: at Alpha, Alex holds `biz.cash.view`, `biz.cash.link`, `biz.cash.forecast`, `biz.cash.request`, `biz.cash.transfer`, `biz.treasury.fx`, `biz.treasury.invest`, `biz.cash.rules` but not `biz.cash.structure` and not `biz.approvals.approve`; `ravi` holds `biz.cash.structure`. At Beta Alex holds `biz.cash.view` only.

## Journey index

| # | Slug | Name | Money | Release |
|---|---|---|---|---|
| 1 | `add-external-account` | Add an outside bank account to the cash position | none (read only) | 3 |
| 2 | `manage-forecast-item` | Add, change or delete a forecast item | none | 3 |
| 3 | `request-funding` | Ask another entity for funding | none (request) | 3 |
| 4 | `intercompany-transfer` | Move money between group entities | money (on approval) | 3 |
| 5 | `fx-deal` | Buy or sell currency: spot or forward | money (value date) | 3 |
| 6 | `place-short-term-deposit` | Put cash into a short-term deposit | money (on approval) | 3 |
| 7 | `redeem-short-term-deposit` | Break a deposit early or change what happens at maturity | money | 3 |
| 8 | `setup-sweep-rule` | Create, change or pause a sweep rule | standing instruction | 3 |
| 9 | `setup-notional-pool` | Create, change or close a notional pool | standing instruction (interest) | 3 |
| 10 | `set-liquidity-rule` | Alert me when cash is low, idle or forecast to run low | none (configuration) | 3 |
| 11 | `approve-treasury-instruction` | Approve or reject a treasury item | money (on last approval) | 3 |

Eleven journeys.

## Common screens used by every journey

| Id | Blocks and exact copy |
|---|---|
| `review` | `text` title "Review"; `reviewSummary` rows per journey; `alert` info "Nothing is sent to the bank until you confirm." Buttons "Back", "Continue" (to `consent`). |
| `consent` | `consent` block, `mustBeTrue`, label per journey. Button "Confirm and get a code". Error "Tick the box to continue." |
| `otp` | `otp` block (6 digits, 3 attempts, resend after 30 s) bound to `otpVerify`. Text "We sent a 6-digit code to {maskedPhone}." Button "Verify and {action}". |
| `timeout` | `result` warning: "We didn't get an answer in time". Money steps: "Your request may have reached the bank. Check Cash › Activity before you try again, so it isn't sent twice." Other steps: "This is taking longer than expected. Nothing was changed." Buttons "Check activity" / "Try again" (back to `review`; the same `requestKey` is reused). |
| `unavailable` | `result` error: "Treasury service unavailable". "Nothing was changed. Please try again in a few minutes." Buttons "Try again" / "Back to Cash". |
| `denied` | `result` error: "You can't do this". "Your role doesn't allow this. Ask an administrator at {company}." Button "Back". |

Standard rows `S-OTP_INVALID`, `S-OTP_REQUIRED`, `S-TIMEOUT`, `S-SERVICE_UNAVAILABLE`, `S-PERMISSION_DENIED`, `S-CORE_UNAVAILABLE` (README 1.6) are written "standard". `requestKey` is a UUID made when the journey opens; a repeated key gives `DUPLICATE_REQUEST`: "This request was already sent. See it in Activity."

---

## Cash position and forecast

### ★ Add an outside bank account — `add-external-account`

#### 1. Summary
| | |
|---|---|
| Slug / status | `add-external-account` / New (planned), Release 3, business |
| Purpose | Bring an account held at another bank into the cash position by uploading its statement (and later refreshing it). Read only: BankWorkx® cannot move money in it. |
| Channels | web, mobile (upload from files) |
| Who | `biz.cash.link` |

#### 2. Entry points
Cash › position: Add a bank account `{entityId}`; stale alert: Upload latest statement `{accountId}` (mode refresh). Permission `biz.cash.link`.

#### 3. Screens
**`details`**
| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| Entity | `select` | yes | entities of the group | "Choose the company that owns the account." |
| Bank name | `textInput` | yes | 2–60 chars | "Enter the bank's name." |
| Account number or IBAN | `textInput` `pattern` `^[A-Z0-9 ]{8,34}$` | yes | 8–34 letters and digits | "Enter 8 to 34 letters and digits." |
| Currency | `select` | yes | `fx.ts` list | "Choose the account's currency." |
| Nickname | `textInput` | no | max 30 chars | "Keep the nickname under 30 characters." |
**`statement`**: `fileUpload` ".sta, .mt940, .xml (CAMT.053), .csv", up to 5 MB, one file (error "Add the latest statement."). `alert` info "BankWorkx® reads the account number, currency and closing balance from the file. They must match what you typed." Upload errors: `FILE_TYPE_NOT_ALLOWED` "This file type isn't allowed. Use MT940, CAMT.053 or CSV."; `FILE_TOO_LARGE` "This file is over 5 MB."; `FILE_UNREADABLE` "We couldn't read this file. Try the original from your bank."
**`review`**: rows Entity, Bank, Account (••last4), Currency, Closing balance {closing} as of {date} (read from file). **`consent`**: "I confirm I am allowed to share this account's information in BankWorkx®. It is read only." **`otp`** (action "add account"). **`success`**: "Account added" reference `EXT-20261102-0950`, text "It appears in your cash position as Statement, as of {date}. Upload a new statement to keep it fresh."

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `ACCOUNT_MISMATCH` | "The file is for a different account ({fileAccount}, {fileCurrency}). Check the file or the details." | `statement` | Replace file |
| `CURRENCY_NOT_SUPPORTED` | "We don't support that currency." | `details` | Change |
| `DUPLICATE_ACCOUNT` | "This account is already in your cash position." | `details` | Back |
| `EXTERNAL_LIMIT` | "You can add up to 10 outside accounts." | `details` | Back |
| `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`, `FILE_UNREADABLE` | as above (files named `virus.*` give `FILE_UNREADABLE`) | `statement` | Replace file |
| standard OTP/timeout/unavailable/denied rows | | | |

#### 5. Adapters
`entities` `corp.company.get` (existing; group planned); `add` `corp.cash.external.add`; `refresh` `corp.cash.external.statement`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.cash.link`; `otp` (a standing change). No approver: nothing moves.

#### 7. Result and links out
Receipt: account, balance date. Notification to admins "Outside account added by {user}". Buttons: View position (Cash › position, filtered to the account), Add another, Done.

#### 8. Acceptance criteria
- AC-1: A matching statement adds the account with source `statement`, its closing balance and as-of date.
- AC-2: A statement for another account or currency is refused.
- AC-3: Wrong, oversized or unreadable files are refused with the right message.
- AC-4: The same account cannot be added twice and no more than 10 may exist.
- AC-5: Without a verified code, or on timeout or unavailable, nothing is added.
- AC-6: The new balance is counted in its own currency total only, never in another currency.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-6 | Alex; Cedar Valley USD ••9001, statement closing 150,000.00 as of 1 Nov | row added; USD total +150,000.00; EUR total unchanged |
| T-2 | AC-2 | file for EUR | `ACCOUNT_MISMATCH` |
| T-3 | AC-3 | `.exe`; 6 MB; `virus.sta` | three messages |
| T-4 | AC-4 | add twice; set 10 existing | `DUPLICATE_ACCOUNT`; `EXTERNAL_LIMIT` |
| T-5 | AC-5 | no code; `timeout: [corp.cash.external.add]`; `unavailable` | `OTP_REQUIRED`; timeout screen, none or one account on retry; unavailable, none |
| T-6 | AC-5 | Alex at Beta | launch point hidden; deep link `PERMISSION_DENIED` |

#### 10. Expected mutation-check survivors
Survivor: the 36-hour stale threshold (displayed on position, not here); killed in the position view test, listed as "belongs to shell tests".

---

### ★ Add, change or delete a forecast item — `manage-forecast-item`

#### 1. Summary
| | |
|---|---|
| Slug / status | `manage-forecast-item` / New (planned), Release 3, business |
| Purpose | Tell BankWorkx® about money you expect to receive or pay that the bank cannot see yet, so the 13-week forecast is honest. |
| Who | `biz.cash.forecast` |

#### 2. Entry points
Cash › forecast: Add an item / Edit / Delete `{itemId}`. System rows cannot be edited.

#### 3. Screens
**`mode`** (only when `itemId` given): Edit / Delete (`select` rows).
**`item`**
| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| Direction | `select` chips | yes | In or Out | "Choose in or out." |
| Entity and account | `accountPicker` | yes | any account of the group | "Choose an account." |
| Amount | `amountInput` | yes | above 0, currency decimals | "Enter an amount above 0." |
| Date | `datePicker` | yes | from 2 Nov 2026 to 31 Jan 2027 (13 weeks plus 4) | "Choose a date from 2 Nov 2026 to 31 Jan 2027." |
| Category | `select` | yes | Customer receipt, Supplier payment, Payroll, Tax, Loan, Other | "Choose a category." |
| How sure are you? | `select` tiles | yes | Confirmed, Expected, Possible | "Choose how sure you are." |
| Repeats | `select` | yes | Never, Every week, Every month (until 31 Jan 2027) | "Choose how often it repeats." |
| Note | `textInput` | no | max 120 | "Keep the note under 120 characters." |
**`impact`**: a small `chart` previews the closing balance of that account/currency with and without the item and states the new low point ("Lowest becomes 9,200.00 USD in week of 21 Dec 2026"). **`review`**, **`consent`** ("I confirm this item is my best estimate. It changes the forecast and the alerts that use it."), **`otp`**, **`success`** "Forecast updated" `FCI-20261102-0951`. Delete: review "Delete this item?" and a `dialog`.

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `INVALID_AMOUNT` | "Enter an amount in {currency} with at most {digits} decimal places." | `item` |
| `CURRENCY_NOT_SUPPORTED` | "We can't forecast in that currency." | `item` |
| `DATE_INVALID` | "Choose a date from 2 Nov 2026 to 31 Jan 2027." | `item` |
| `ITEM_NOT_FOUND` | "That item no longer exists." | `failed` |
| `ITEM_READ_ONLY` | "This item comes from a scheduled payment. Change it there." | `failed` |
| `DUPLICATE_REQUEST` | standard | |
| standard OTP/timeout/unavailable/denied rows | | |

#### 5. Adapters
`accounts` `corp.cash.position`; `preview` `corp.cash.forecast.get`; `save` `corp.cash.forecast.save`; `delete` `corp.cash.forecast.delete`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.cash.forecast`; `otp`. No approver. Audit entry.

#### 7. Result and links out
Receipt not needed. Notification: none (alerts that change raise their own). Buttons: View forecast (Cash › forecast), Add another, Done.

#### 8. Acceptance criteria
- AC-1: A new item changes the forecast of its own currency only.
- AC-2: A recurring item appears on every matching date up to 31 Jan 2027.
- AC-3: System items cannot be edited or deleted.
- AC-4: Dates outside the window and amounts of 0 are refused.
- AC-5: Delete removes the item and its recurrences.
- AC-6: Without a code, or on timeout or unavailable, the forecast is unchanged.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; Out 50,000 USD on 15 Dec | USD low point down 50,000; EUR forecast unchanged |
| T-2 | AC-2 | monthly 10,000 from 15 Nov | items on 15 Nov, 15 Dec, 15 Jan |
| T-3 | AC-3 | edit a scheduled-payment row | `ITEM_READ_ONLY` |
| T-4 | AC-4 | date 1 Mar 2027; amount 0 | `DATE_INVALID`; `INVALID_AMOUNT` |
| T-5 | AC-5 | delete the monthly item | all three gone |
| T-6 | AC-6 | no code; timeout; unavailable | unchanged each time |

#### 10. Expected mutation-check survivors
Survivor: the 13-week window end (31 Jan 2027) unless T-4 tests 31 Jan accepted and 1 Feb refused; add both.

---

## Funding and transfers

### ★ Ask another entity for funding — `request-funding`

#### 1. Summary
| | |
|---|---|
| Slug / status | `request-funding` / New (planned), Release 3, business |
| Purpose | A subsidiary tells treasury (or a sister company) it needs money by a date. Moves no money. Treasury fills it by `intercompany-transfer`. |
| Who | `biz.cash.request` |

#### 2. Entry points
Cash › funding: Request funding `{entityId}`; low-balance alert: Request funding `{accountId}`.

#### 3. Screens
**`request`**
| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| Ask | `select` | yes | an entity with an intercompany agreement | "Choose who to ask." |
| Money goes into | `accountPicker` | yes | account of the active entity | "Choose the account to fund." |
| Amount | `amountInput` | yes | above 0 | "Enter an amount above 0." |
| Needed by | `datePicker` | yes | today to 60 days, a working day | "Choose a working day within 60 days." |
| Reason | `select` | yes | Payroll, Supplier payments, Tax, Short-term gap, Other | "Choose a reason." |
| Note | `textInput` `lines: 3` | if reason is Other | 10–300 chars | "Add a note of 10 to 300 characters." |
| Support | `fileUpload` | no | PDF/JPG/PNG up to 10 MB | file errors as in module 5 |
`alert` info (shown when launched from an alert): "Forecast shows {account} falling to {amount} on {date}." **`review`**, **`success`** "Request sent" `FND-20261102-0952`, "{entity} will see it in Funding requests. Nothing has moved." (no consent or code: it moves no money and commits nothing; `none`).

#### 4. Sandbox errors
`INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `DATE_INVALID` ("Choose a working day within 60 days."), `INTERCOMPANY_NOT_ALLOWED` ("There is no agreement between {a} and {b} for funding."), `DUPLICATE_REQUEST`, `NOT_AUTHORISED`, standard timeout ("This is taking longer than expected. Nothing was changed."), unavailable, denied.

#### 5. Adapters
`entities`, `forecast` `corp.cash.forecast.get`, `create` `corp.cash.funding.create`.

#### 6. Permissions, step-up, limits
`biz.cash.request`; `none` (no money, no standing change); audit entry; max 5 open requests per entity (`REQUEST_LIMIT`: "You already have 5 open requests." added to the adapter).

#### 7. Result and links out
Notification to holders of `biz.cash.transfer` in the asked entity. Buttons: View requests (Cash › funding), Done. Lead on: *Fund it* (treasury) → `intercompany-transfer`.

#### 8. Acceptance criteria
- AC-1: A valid request is stored `open` and nobody's balance changes.
- AC-2: A request to an entity with no agreement is refused.
- AC-3: A past or non-working date is refused.
- AC-4: The requester can withdraw an open request; treasury can decline with a reason.
- AC-5: Timeout and unavailable create nothing; a repeated key creates one.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex (Alpha Logistics) asks Alpha Trading 200,000 AED by 20 Nov | `open`; balances unchanged |
| T-2 | AC-2 | ask an entity outside the group | `INTERCOMPANY_NOT_ALLOWED` |
| T-3 | AC-3 | needed-by 1 Nov; 7 Nov (Saturday) | `DATE_INVALID` |
| T-4 | AC-4 | withdraw; decline with 4-char then 10-char reason | withdrawn; field error then `declined` |
| T-5 | AC-5 | `timeout`, retry same key; `unavailable` | one request; none |

#### 10. Expected mutation-check survivors
None expected for agreement and date rules. Survivor: `REQUEST_LIMIT` (5) unless a scenario seeds 5 requests; add T-6.

---

### ★ Move money between group entities — `intercompany-transfer`

#### 1. Summary
| | |
|---|---|
| Slug / status | `intercompany-transfer` / New (planned), Release 3, business |
| Purpose | Send money from an account of the active entity to an account of another group entity in the same currency, as a loan, dividend, cost recharge or trade settlement. |
| Who | `biz.cash.transfer`. Approver approves. |

#### 2. Entry points
Cash › position › account row: Move money `{fromAccountId}`; Cash › funding: Fund it `{fundingRequestId}`.

#### 3. Screens
**`from`**: `accountPicker` From (active entity; shows available balance); error "Choose the account to send from."
**`to`**: Entity `select` ("Choose the company to send to."), account `accountPicker` of that entity ("Choose the account to send to."). If currency differs: `alert` warning "These accounts use different currencies. Make an FX deal first." Button "Make an FX deal" (`fx-deal`, `returnTo`).
**`amount`**: `amountInput` above 0, at most available and remaining limits ("Enter an amount above 0."); Purpose `select` (Loan, Dividend, Cost recharge, Trade settlement; "Choose the purpose."); Reference `textInput` 3–35 chars, letters, digits, space and `- / ? : ( ) . , ' +` ("Use 3 to 35 letters, numbers or simple symbols."); Value date `datePicker` (today or a working day within 30 days). Info rows: "Available: {balance}", "Your daily limit left: {remaining}", "Company limit left: {companyRemaining}". When purpose is Loan: `alert` info "This is a loan at 4.50% a year. It is recorded between {from} and {to}."
**`review`**: rows From, To, Amount, Purpose, Reference, Value date ("Dated {next working day} because it is after 16:00 UTC" when late), Approvers needed ("1" or "2: above 250,000 USD"). **`consent`**: "I confirm {from entity} sends {amount} {currency} to {to entity} for the purpose shown, and I understand it needs approval before it moves." **`otp`** (action "send for approval"). **`success`** "Sent for approval" `ICT-20261102-0953`, "No money has moved yet."

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `from`/`to` | Choose account |
| `CURRENCY_MISMATCH` | "These accounts use different currencies. Make an FX deal first." | `to` | Make an FX deal |
| `INTERCOMPANY_NOT_ALLOWED` | "There is no agreement for {purpose} between {a} and {b}." | `to` | Back |
| `INVALID_AMOUNT` | "Enter an amount in {currency} with at most {digits} decimal places." | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Available: {balance}. No money has left your account." | `amount` | Change amount |
| `LIMIT_USER_EXCEEDED` | "This is above your daily limit of {limit}. You have {remaining} left today." | `amount` | Change amount |
| `LIMIT_COMPANY_EXCEEDED` | "This is above {company}'s daily limit. Try again tomorrow or ask an administrator." | `failed` | Back |
| `VALUE_DATE_INVALID` | "Choose a working day within 30 days." | `amount` | Change date |
| `NOT_AUTHORISED` | "{user} is not allowed to start transfers." | `denied` | Back |
| `DUPLICATE_REQUEST` | standard | | |
| standard OTP rows; `S-CORE_UNAVAILABLE` "We couldn't complete this right now. No money has left your account."; money `S-TIMEOUT`; `S-SERVICE_UNAVAILABLE`; `S-PERMISSION_DENIED` | standard | | |

#### 5. Adapters
`position` `corp.cash.position`; `quote` `corp.cash.transfer.quote`; `initiate` `corp.cash.transfer.initiate`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.cash.transfer`; `otp`; per-user and company daily limits in the **source entity's** currency; dual approval above 250,000 USD equivalent; cut-off 16:00 UTC; `SELF_APPROVAL` stops the Maker approving.

#### 7. Result and links out
Receipt: request, accounts, amount, purpose, value date, approvers. Notifications: approvers; both entities' treasury on release. Buttons: Track (Cash › activity), Go to approvals (if also an approver), Done. When started from a funding request, the request moves to `funded` on release.

#### 8. Acceptance criteria
- AC-1: A valid transfer waits for approval and moves nothing yet.
- AC-2: The last approval debits the source and credits the destination by the same amount.
- AC-3: Different currencies are refused with a pointer to FX deals.
- AC-4: Amounts above the user's or the company's daily limit are refused.
- AC-5: Above 250,000 USD equivalent needs two different approvers.
- AC-6: A transfer for a purpose with no agreement is refused.
- AC-7: Timeout never moves money twice; unavailable moves none; wrong codes end the journey.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; from Payroll USD ••1203 (Alpha Trading) to a USD account of Alpha Logistics (seeded for this test); 20,000 USD, Cost recharge | pending; balances unchanged |
| T-2 | AC-2 | `dana` approves T-1 | source −20,000; destination +20,000 |
| T-3 | AC-3 | USD to EUR account | `CURRENCY_MISMATCH` |
| T-4 | AC-4 | amount above Alex's remaining; company limit seeded low | `LIMIT_USER_EXCEEDED`; `LIMIT_COMPANY_EXCEEDED` |
| T-5 | AC-5 | 300,000 USD | approversRequired 2; one approver leaves it pending |
| T-6 | AC-6 | dividend to an entity with loans-only agreement | `INTERCOMPANY_NOT_ALLOWED` |
| T-7 | AC-7 | `timeout: [corp.cash.transfer.initiate]` then retry; `unavailable`; three wrong codes | one request; none; "Start again" |

#### 10. Expected mutation-check survivors
None expected for `currency`, `limits`, `dualApproval`, `agreement`. Survivor: loan rate 4.50% unless a scenario reads the intercompany record; add assertion in T-2 for a Loan purpose.

---

## Treasury: FX and deposits

### ★ Buy or sell currency — `fx-deal`

#### 1. Summary
| | |
|---|---|
| Slug / status | `fx-deal` / New (planned), Release 3, business. Pattern: the Personal `convert-currency` fixture. |
| Purpose | Exchange one currency for another between the company's own accounts, now (spot) or on a future date (forward). |
| Who | `biz.treasury.fx`. Approver approves. |

#### 2. Entry points
Cash › treasury: New FX deal `{pair}`; Cash › position › currency card: Convert `{currency}`; `intercompany-transfer` `to` screen with `returnTo`.

#### 3. Screens
**`accounts`**: `accountPicker` "Sell from" ("Choose the account to sell from.") and "Buy into" ("Choose the account to buy into."). Same currency: error "Choose two accounts in different currencies." (`SAME_CURRENCY`).
**`amount`**: `select` chips "I want to sell" / "I want to buy"; `amountInput` ("Enter an amount in {currency} with at most {digits} decimal places."); `select` "When": Spot (value date {T+2}) / Forward; Forward shows `datePicker` (3 Nov 2026 to 2 Nov 2027, a working day after spot date; "Choose a working day after {spotDate} and before 2 Nov 2027."). Info: Available, Dealing limit left.
**`quote`**: `rateTicker` shows rate, mid rate, fee (0.2% of sold amount), you sell, you buy, value date, for forwards "Forward points" and "Margin held: {5% of amount}" when longer than 90 days. Countdown 30 s; at 0 the button changes to "Get a new rate". Buttons: "Back", "Continue" (disabled at 0).
**`review`** adds "Needs {n} approver(s)" and `alert` info "After you confirm, the rate is held for 10 minutes while approvers decide." **`consent`**: "I agree to {sell} {sellCcy} for {buy} {buyCcy} at {rate} on {valueDate}. I understand this cannot be undone once approved." **`otp`** (action "book the deal"). **`success`** "Deal sent for approval" `FXD-20261102-0954`, "Rate held until {time}. Balances change on {valueDate}."

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `accounts` | Choose account |
| `SAME_CURRENCY` | "Choose two accounts in different currencies." | `accounts` | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "We do not convert that currency pair" | `accounts` | Back |
| `INVALID_AMOUNT` | "Enter an amount in {currency} with at most {digits} decimal places." | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account} for the amount and the fee. Available: {balance}. No money has left your account." | `amount` | Change amount |
| `VALUE_DATE_INVALID` | "Choose a working day after {spotDate} and before 2 Nov 2027." | `amount` | Change date |
| `TENOR_TOO_LONG` | "Forwards can run to 365 days." | `amount` | Change date |
| `MARGIN_REQUIRED` | "A forward over 90 days needs a margin of {margin} {currency} in {account}. Available: {balance}." | `quote` | Change amount |
| `DEALING_LIMIT_EXCEEDED` | "This is above your daily dealing limit of 250,000 USD (about). You have {remaining} left." | `amount` | Change amount |
| `QUOTE_EXPIRED` | "The rate has expired. Get a new one." | `quote` | Get a new rate |
| `QUOTE_USED` / `QUOTE_NOT_FOUND` | "This rate was already used." / "We can't find that rate. Get a new one." | `quote` | Get a new rate |
| `NOT_AUTHORISED`, `DUPLICATE_REQUEST` | standard | | |
| standard OTP rows; `S-CORE_UNAVAILABLE`; money `S-TIMEOUT`; `S-SERVICE_UNAVAILABLE`; `S-PERMISSION_DENIED` | standard | | |

#### 5. Adapters
`accounts` `corp.cash.position`; `rate` `corp.fx.rate`; `quote` `corp.fx.quote`; `book` `corp.fx.book`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.treasury.fx`; `otp`; dealing limit 250,000 USD equivalent a day per user; dual approval above 250,000 USD equivalent; balances move on the value date; rates from `fx.ts`.

#### 7. Result and links out
Receipt: deal id, pair, rate, amounts, value date. Notifications: approvers; Maker "Deal approved / lapsed". Buttons: Track (Cash › treasury), Go to approvals, Done.

#### 8. Acceptance criteria
- AC-1: The quote follows `fx.ts`: customer rate = mid × (1 − 0.5%), fee 0.2% of the sold amount, each rounded to its currency's decimals.
- AC-2: A rate older than 30 seconds cannot be booked.
- AC-3: A booked deal moves balances on the value date, by exactly the quoted amounts, and not before.
- AC-4: A forward longer than 90 days needs the margin.
- AC-5: A deal not approved within 10 minutes lapses and moves nothing.
- AC-6: Dealing limit and funds are enforced.
- AC-7: Timeout never books two deals; unavailable books none.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; sell 100,000 USD buy EUR spot | rate 0.9154 (0.92 × 0.995), buy 91,540.00 EUR, fee 200.00 USD |
| T-2 | AC-2 | clock +31 s | `QUOTE_EXPIRED` |
| T-3 | AC-3 | approve; clock to value date | USD −100,200.00; EUR +91,540.00; unchanged before |
| T-4 | AC-4 | forward 120 days, margin account short | `MARGIN_REQUIRED` |
| T-5 | AC-5 | clock +11 min before approval | `DEAL_PRICE_EXPIRED`; status `lapsed` |
| T-6 | AC-6 | sell 300,000 USD; sell above balance | `DEALING_LIMIT_EXCEEDED`; `INSUFFICIENT_FUNDS` |
| T-7 | AC-7 | `timeout: [corp.fx.book]` + retry; `unavailable`; three wrong codes | one deal; none; "Start again" |

#### 10. Expected mutation-check survivors
Survivor: forward-points day count (360) unless T-4 asserts a forward rate; add a forward scenario with exact rate. Spot date rule (T+2) survives if the clock only starts on a Monday; start T-3 on a Thursday to kill it.

---

### ★ Put cash into a short-term deposit — `place-short-term-deposit`

#### 1. Summary
| | |
|---|---|
| Slug / status | `place-short-term-deposit` / New (planned), Release 3, business |
| Purpose | Earn interest on idle cash for a fixed period (overnight to 180 days). |
| Who | `biz.treasury.invest`. Approver approves. |

#### 2. Entry points
Cash › treasury: New deposit `{accountId}`; idle-cash alert: Put it to work `{accountId, amount}`.

#### 3. Screens
**`amount`**: `accountPicker` "Take the money from" ("Choose the account."), `amountInput` (minimum 10,000: "The minimum is 10,000.00 {currency}."), `select` tiles tenor (Overnight, 7 days, 30 days, 90 days, 180 days; "Choose how long."), with the rate shown on each tile (from `deposit.rates`). **`maturity`**: `select` rows "Pay principal and interest to {account}" / "Roll the principal, pay interest out" / "Roll principal and interest"; payout `accountPicker` for the first two ("Choose where to pay."). **`quote`**: `reviewSummary` Rate, Start, Maturity, Interest (amount × rate × days / 360), Total at maturity; `alert` info "This rate is held for 30 seconds" with refresh. **`review`**, **`consent`** ("I agree to deposit {amount} {ccy} for {tenor} at {rate}. I can only take it out early by paying a penalty."), **`otp`** (action "place deposit"), **`success`** "Sent for approval" `DEP-20261102-0955`, "Your money stays in {account} until the last approval."

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `amount` |
| `INVALID_AMOUNT` | "Enter an amount in {currency} with at most {digits} decimal places." | `amount` |
| `BELOW_MINIMUM` | "The minimum is 10,000.00 {currency}." | `amount` |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Available: {balance}. No money has left your account." | `amount` |
| `TENOR_NOT_AVAILABLE` | "That period isn't available in {currency}." | `amount` |
| `CUTOFF_PASSED` | "Overnight deposits close at 16:00 UTC. Choose 7 days or more, or try tomorrow." | `amount` |
| `CURRENCY_NOT_SUPPORTED` | "We don't offer deposits in that currency." | `amount` |
| `QUOTE_EXPIRED` / `QUOTE_USED` / `QUOTE_NOT_FOUND` | "The rate has expired. Get a new one." / "This rate was already used." / "We can't find that rate." | `quote` |
| `LIMIT_USER_EXCEEDED`, `NOT_AUTHORISED`, `DUPLICATE_REQUEST` | standard | |
| standard OTP rows; `S-CORE_UNAVAILABLE`; money `S-TIMEOUT`; `S-SERVICE_UNAVAILABLE`; `S-PERMISSION_DENIED` | standard | |

#### 5. Adapters
`accounts`; `rates` `corp.deposit.rates`; `quote` `corp.deposit.quote`; `place` `corp.deposit.place`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.treasury.invest`; `otp`; user daily limit applies to the principal; dual approval above 250,000 USD equivalent; overnight before 16:00 UTC.

#### 7. Result and links out
Receipt: deposit terms. Notifications: approvers; Maker on release and "matures in 3 days". Buttons: Track, Done.

#### 8. Acceptance criteria
- AC-1: Interest equals amount × rate × days / 360, rounded to the currency's decimals.
- AC-2: Below 10,000 is refused.
- AC-3: On the last approval the principal leaves the account and the deposit is `active`; before it, the balance is unchanged.
- AC-4: Overnight after cut-off is refused.
- AC-5: Funds are checked again at approval; if short the approval does not count.
- AC-6: Timeout never places two deposits; unavailable places none.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; 100,000 USD, 90 days | rate 4.35%, interest 1,087.50 |
| T-2 | AC-2 | 9,999.99 | `BELOW_MINIMUM` |
| T-3 | AC-3 | `dana` approves | balance −100,000; deposit `active` |
| T-4 | AC-4 | clock 16:30 UTC, overnight | `CUTOFF_PASSED` |
| T-5 | AC-5 | empty the account before approval | `INSUFFICIENT_FUNDS`; still pending |
| T-6 | AC-6 | `timeout` + retry; `unavailable`; no code | one; none; `OTP_REQUIRED` |

#### 10. Expected mutation-check survivors
None expected for rate arithmetic and minimum. Survivor: AED/EUR rate offsets unless a scenario uses EUR; add T-7 (EUR 30 days: 4.05 − 1.70 = 2.35%).

---

### ★ Break a deposit early or change its maturity instruction — `redeem-short-term-deposit`

#### 1. Summary
| | |
|---|---|
| Slug / status | `redeem-short-term-deposit` / New (planned), Release 3, business |
| Purpose | Two modes: `early` (take the money out now and lose part of the interest) and `change-instruction` (change what happens at maturity). |
| Who | `biz.treasury.invest` |

#### 2. Entry points
Cash › treasury › deposit row: Redeem / Change maturity `{depositId, mode}`; notification "Deposit matures in 3 days".

#### 3. Screens
**`deposit`**: `reviewSummary` of the deposit (amount, rate, start, maturity, days left, interest earned so far). **`early`**: `alert` warning "If you break this deposit now you receive the principal plus half the interest earned to date, and pay a fee of 100.00 {ccy}." Rows: Principal {p}, Interest earned {i}, Penalty (half) −{i/2}, Fee −100.00, You receive {p + i/2 − 100}. Payout to the deposit's source account. **`change`**: `select` rows (three instructions as in placement); payout `accountPicker`. **`review`**, **`consent`** (early): "I agree to break this deposit early and accept the penalty and fee."; (change): "I agree to change what happens at maturity." **`otp`** (action "redeem" or "save"), **`success`** "Sent for approval" `RDM-20261102-0956` / "Instruction saved".

#### 4. Sandbox errors
`DEPOSIT_NOT_FOUND` ("We can't find that deposit."), `DEPOSIT_NOT_ACTIVE` ("This deposit has already ended."), `ALREADY_MATURING` ("This deposit matures today or tomorrow. It will pay out on its own."), `ACCOUNT_NOT_FOUND`, `NOT_AUTHORISED`, `DUPLICATE_REQUEST`, `CORE_UNAVAILABLE` (standard), standard OTP, money timeout, unavailable, denied.

#### 5. Adapters
`deposit` `corp.deposit.get`; `redeem` `corp.deposit.redeem`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.treasury.invest`; `otp`; early break needs approval (money moves on the last approval); `change-instruction` needs no approval (no money moves now) but is audited.

#### 7. Result and links out
Receipt: payout breakdown. Buttons: Track, Done.

#### 8. Acceptance criteria
- AC-1: Early payout = principal + half the interest earned to date − 100.00 fee.
- AC-2: A deposit maturing within 1 working day cannot be broken early.
- AC-3: Changing the instruction takes effect without approval and applies at maturity.
- AC-4: A deposit already ended cannot be redeemed.
- AC-5: Timeout never pays out twice; unavailable changes nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; 100,000 USD at 4.05% for 30 days, day 15 | interest to date 168.75; payout 100,000 + 84.38 − 100.00 = 99,984.38 |
| T-2 | AC-2 | day 29 | `ALREADY_MATURING` |
| T-3 | AC-3 | switch to roll principal | stored; at maturity only interest paid out |
| T-4 | AC-4 | redeem twice | `DEPOSIT_NOT_ACTIVE` |
| T-5 | AC-5 | `timeout` + retry; `unavailable`; no code | one payout; none; `OTP_REQUIRED` |

#### 10. Expected mutation-check survivors
Survivor: rounding of half-interest (84.375 rounds to 84.38) unless T-1 asserts the exact payout; it does, so none expected.

---

## Structure: sweeping and pooling

### ★ Create, change or pause a sweep rule — `setup-sweep-rule`

#### 1. Summary
| | |
|---|---|
| Slug / status | `setup-sweep-rule` / New (planned), Release 3, business |
| Purpose | Move cash automatically each working day at 17:00 UTC between a master account and participant accounts. |
| Who | `biz.cash.structure` (Admin). Approver approves. |

#### 2. Entry points
Cash › structure › sweeps: New / Change / Pause `{ruleId, mode}`.

#### 3. Screens
**`type`**: `select` tiles Zero balance ("Everything above zero goes to the master. Shortfalls are funded from it."), Target balance ("Keep {target} in each account."), Threshold ("Only the part above {ceiling} moves."). **`accounts`**: Master `accountPicker` ("Choose the master account."); Participants: `dataTable` with row select of same-currency accounts ("Choose at least one account to sweep."; max 10); target/ceiling `amountInput` (zero or above; "Enter an amount of 0 or more."). A different entity shows `alert` info "This creates an intercompany loan between {a} and {b} at 4.50%." **`when`**: `datePicker` first run (next working day to 30 days: "Choose a working day within 30 days."); read-only line "Runs every working day at 17:00 UTC". **`simulate`**: `dataTable` Moves if it ran on {date}: From, To, Amount, Currency; "Intercompany balances created". **`review`**, **`consent`** ("I agree that BankWorkx® moves money between these accounts each working day by this rule."), **`otp`** (action "save rule"), **`success`** "Sent for approval" `SWP-20261102-0957` ("It starts on {date} once approved."). Pause: review only "Pause this rule? It will not run until you resume it." Delete is a separate button with dialog.

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `CURRENCY_MISMATCH` | "Every account in a sweep must use the same currency ({currency})." | `accounts` |
| `SWEEP_LOOP` | "This rule would move money in a circle. Remove {account} from one side." | `accounts` |
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `accounts` |
| `INTERCOMPANY_NOT_ALLOWED` | "There is no agreement for loans between {a} and {b}." | `accounts` |
| `INVALID_AMOUNT` | "Enter an amount of 0 or more." | `accounts` |
| `RULE_LIMIT` | "You can have up to 20 sweep rules." | `type` |
| `RULE_NOT_FOUND` | "That rule no longer exists." | `failed` |
| `DATE_INVALID` | "Choose a working day within 30 days." | `when` |
| `NOT_AUTHORISED`, `DUPLICATE_REQUEST` | standard | |
| standard OTP rows, timeout ("Nothing was changed."), unavailable, denied | standard | |

#### 5. Adapters
`accounts` `corp.cash.position`; `rules` `corp.cash.sweep.list`; `simulate` `corp.cash.sweep.simulate`; `save` `corp.cash.sweep.save`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.cash.structure`; `stepup` (standing instruction that moves money, README 4.3 admin changes) then code; approval: one, or two if the largest simulated daily move exceeds 250,000 USD equivalent. Each run is audited and bounded by company daily limit (run skipped with reason `LIMIT_COMPANY_EXCEEDED`).

#### 7. Result and links out
Receipt: rule summary and first run date. Notifications: approvers; after each run a summary to holders of `biz.cash.view`. Buttons: View structure, Done.

#### 8. Acceptance criteria
- AC-1: Dry run lists exactly the moves a run would make and changes no balance.
- AC-2: After approval, a run moves each account to its target (zero: to 0; target: to target; threshold: only the part above the ceiling).
- AC-3: Mixed currencies are refused.
- AC-4: A circular rule is refused.
- AC-5: Sweeps across entities create an intercompany balance and need an agreement.
- AC-6: A paused rule does not run.
- AC-7: Timeout or unavailable changes nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `ravi`; target 50,000 on Payroll ••1203 (58,000), master Operating | one move 8,000 USD; balances unchanged |
| T-2 | AC-2 | approve, clock to 17:00 | Payroll 50,000; Operating +8,000 |
| T-3 | AC-3 | include Collections EUR | `CURRENCY_MISMATCH` |
| T-4 | AC-4 | A master of B, B master of A | `SWEEP_LOOP` |
| T-5 | AC-5 | participant in Alpha Logistics (USD) | intercompany balance created; no agreement variant refused |
| T-6 | AC-6 | pause then run | no move |
| T-7 | AC-7 | `timeout: [corp.cash.sweep.save]` + retry same key; `unavailable` | one rule; none |

#### 10. Expected mutation-check survivors
Survivor: `threshold` type behaviour if T-1/T-2 only cover target; add a threshold scenario. Run time 17:00 survives unless the clock is set to 16:59 (not run) and 17:00 (run); add both.

---

### ★ Create, change or close a notional pool — `setup-notional-pool`

#### 1. Summary
| | |
|---|---|
| Slug / status | `setup-notional-pool` / New (planned), Release 3, business |
| Purpose | Net the balances of several accounts on paper so the group pays interest only on the net amount. No money moves. |
| Who | `biz.cash.structure` (Admin). Each participating entity accepts. |

#### 2. Entry points
Cash › structure › pools: New / Change / Close `{poolId, mode}`; join request notification "Alpha Europe GmbH is invited to a pool" (mode accept) opens the acceptance screen.

#### 3. Screens
**`basics`**: Name `textInput` 3–40 chars ("Enter a name of 3 to 40 characters."), Currency `select` ("Choose the pool currency."), Header account `accountPicker` ("Choose the header account."), Effective date `datePicker` (next working day to 60 days). **`participants`**: `dataTable` with row select, per row Net debit limit `amountInput` (0 or more; "Enter a limit of 0 or more.") for accounts of any group entity; other-currency accounts are netted at the mid rate (shown). **`simulate`**: Net balance, Interest benefit per day (sum of positives × 3.00% / 360 offset against negatives × 7.00% / 360 compared with no pool), table of each participant balance. Alert error if net would be negative. **`terms`**: `documentViewer` of the cross-guarantee and `signature` (typed name must match the signer, plus OTP). **`review`**, **`consent`** ("Each company in this pool guarantees the others' debit balances up to the limits shown."), **`otp`** (action "send for agreement"), **`success`** "Sent for agreement" `NPL-20261102-0958` ("Each company's administrator must accept before approval."). **Accept mode** (`corp.pool.accept`): `documentViewer`, `signature` (name), OTP, result "You joined {pool}".

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `POOL_NAME_TAKEN` | "Another pool already uses this name." | `basics` |
| `POOL_NEGATIVE` | "The pool would have a net balance of {net}. The net balance must be zero or more." | `simulate` |
| `ACCOUNT_IN_POOL` | "{account} is already in another pool." | `participants` |
| `INTERCOMPANY_NOT_ALLOWED` | "There is no agreement between {a} and {b}." | `participants` |
| `CURRENCY_NOT_SUPPORTED` | "We don't offer pools in that currency." | `basics` |
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `participants` |
| `DATE_INVALID` | "Choose a working day within 60 days." | `basics` |
| `GUARANTEE_NOT_SIGNED` | "Every company must sign before the pool starts." | `success` (shown as status) |
| `SIGNATURE_MISMATCH` | "Type your full name exactly as shown: {name}." | `terms` |
| `POOL_NOT_FOUND`, `REQUEST_NOT_FOUND`, `REQUEST_NOT_OPEN` | "That pool or invitation isn't open any more." | `failed` |
| `NOT_AUTHORISED`, `DUPLICATE_REQUEST` | standard | |
| standard OTP rows, timeout, unavailable, denied | standard | |

#### 5. Adapters
`accounts`; `pools` `corp.pool.list`; `simulate` `corp.pool.simulate`; `save` `corp.pool.save`; `accept` `corp.pool.accept`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.cash.structure`; `stepup` then code plus typed signature; approval one (two if the sum of net debit limits exceeds 250,000 USD equivalent) after all agreements are signed. Closing a pool needs the same.

#### 7. Result and links out
Receipt: pool terms and the signature list. Notifications: each participating entity's admins "Invitation to pool {name}"; all on start. Buttons: View structure, Done.

#### 8. Acceptance criteria
- AC-1: The simulation shows net balance and benefit and moves nothing.
- AC-2: A pool whose net balance would be below zero is refused.
- AC-3: An account can be in only one pool.
- AC-4: The pool starts only when every participating entity has signed and approvers approved.
- AC-5: Signing needs the exact typed name and a verified code.
- AC-6: No account balance changes at any step.
- AC-7: Timeout and unavailable change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-6 | `ravi`; USD pool: Operating 412,300, Payroll 58,000, Logistics USD sub-account | net shown; all balances unchanged |
| T-2 | AC-2 | add an account with −600,000 | `POOL_NEGATIVE` |
| T-3 | AC-3 | account already in pool | `ACCOUNT_IN_POOL` |
| T-4 | AC-4 | only parent signed | status `pending_agreements`; after all sign and `dana` approves: `active` |
| T-5 | AC-5 | wrong name; 3 wrong codes | `SIGNATURE_MISMATCH`; "Start again" |
| T-6 | AC-7 | `timeout: [corp.pool.save]` + retry; `unavailable` | one request; none |

#### 10. Expected mutation-check survivors
Survivor: interest benefit arithmetic when the scenario asserts only that it is positive; assert the exact figure in T-1 (benefit = (credit interest saved) computed from sandbox rates).

---

## Rules and approval

### ★ Alert me when cash is low, idle or forecast to run low — `set-liquidity-rule`

#### 1. Summary
| | |
|---|---|
| Slug / status | `set-liquidity-rule` / New (planned), Release 3, business |
| Purpose | Create, change or turn off a rule that sends a notification when a balance or the forecast crosses a line. Rules never move money. |
| Who | `biz.cash.rules` |

#### 2. Entry points
Cash › rules: New / Edit `{ruleId}`; low-balance alert: Edit this rule.

#### 3. Screens
**`kind`**: `select` tiles "Balance falls below" (min), "Balance rises above" (max, idle cash), "Forecast falls below within N days" (forecast-low). **`scope`**: `select` Account / Entity / Whole group; `accountPicker` or entity `select` ("Choose what to watch."); Currency `select` (required for entity and group; error "Choose the currency to watch."). Group rules watch each currency separately, never a mixed total. **`threshold`**: `amountInput` (above 0; "Enter an amount above 0."); forecast-low: Days `select` 7, 14, 30, 91 ("Choose how far ahead."). **`delivery`**: `toggle` In the app (on, locked), `toggle` Email, `textInput` Name (3–40 chars, "Enter a name of 3 to 40 characters."). **`review`** with `reviewSummary` and a line "Today this rule would {be breached / not be breached} (balance {x})". **`consent`**: "I confirm I want these alerts sent to the people who can see Cash." **`otp`** (action "save rule"). **`success`** "Rule saved" `RUL-20261102-0959`. Turn off/Delete via dialog.

#### 4. Sandbox errors
`INVALID_AMOUNT` ("Enter an amount above 0."), `CURRENCY_NOT_SUPPORTED`, `RULE_NAME_TAKEN` ("You already have a rule with this name."), `RULE_LIMIT` ("You can have up to 50 rules."), `ACCOUNT_NOT_FOUND`, `RULE_NOT_FOUND`, `NOT_AUTHORISED`, `DUPLICATE_REQUEST`, standard OTP, timeout ("This is taking longer than expected. Nothing was changed."), unavailable, denied.

#### 5. Adapters
`accounts` `corp.cash.position`; `list` `corp.rules.list`; `save` `corp.rules.save`; `delete` `corp.rules.delete`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.cash.rules`; `otp`; no approver; audited.

#### 7. Result and links out
Notification when the rule breaches: "Liquidity alert: {name}: {account} is {amount}". Buttons: View rules, Done. Alert actions: Request funding (`request-funding`), Put it to work (`place-short-term-deposit`).

#### 8. Acceptance criteria
- AC-1: A saved rule fires once when its line is crossed and again only after it recovers and crosses again.
- AC-2: A group or entity rule evaluates each currency separately.
- AC-3: A forecast-low rule uses the forecast within its horizon.
- AC-4: A name already in use, or a 51st rule, is refused.
- AC-5: A rule never changes a balance.
- AC-6: Timeout and unavailable save nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; min 50,000 USD on Payroll (58,000); then balance 49,000; again 49,500; recover 60,000; fall 40,000 | one alert at 49,000; none at 49,500; second alert at 40,000 |
| T-2 | AC-2 | group min 100,000 | USD and EUR evaluated separately; no mixed total used |
| T-3 | AC-3 | forecast-low 30 days with Out 400,000 on 15 Dec | alert raised |
| T-4 | AC-4 | duplicate name; 51st rule | `RULE_NAME_TAKEN`; `RULE_LIMIT` |
| T-5 | AC-5 | after alerts | balances unchanged |
| T-6 | AC-6 | `timeout`, `unavailable` | none saved; retry once saves one |

#### 10. Expected mutation-check survivors
Survivor: email delivery toggle (sandbox only records it); listed with reason "no email channel in sandbox".

---

### ★ Approve or reject a treasury item — `approve-treasury-instruction`

#### 1. Summary
| | |
|---|---|
| Slug / status | `approve-treasury-instruction` / New (planned), Release 3, business |
| Purpose | An Approver reviews an intercompany transfer, FX deal, deposit, early redemption, sweep rule or pool that someone else started, and approves or rejects it. The last approval makes it real. |
| Who | `biz.approvals.approve` |

#### 2. Entry points
Approvals › inbox (type Treasury): Open / Approve / Reject `{requestId}`; notification "Treasury item awaiting your approval, {company}" (switch context first).

#### 3. Screens
**`request`**: `reviewSummary` by kind (transfer: accounts, amount, purpose, value date; deal: pair, rate, amounts, value date, **price lock countdown**; deposit: terms; sweep/pool: summary and dry-run table); started by; approvals so far "1 of 2"; limits left. `select` rows Approve / Reject; Reject shows reason (optional, max 200). **`consent`**: "I have read this and approve it." **`otp`** (action "approve"). **`success`**: "Approved" / "Approved: {n} more needed" / "Done: {what happened}" / "Rejected".

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `NOT_AUTHORISED` | "{user} is not allowed to approve." | `denied` |
| `SELF_APPROVAL` | "You can't approve something you started." | `failed` |
| `ALREADY_APPROVED` | "You already approved this. Another approver is needed." | `failed` |
| `REQUEST_NOT_FOUND`, `REQUEST_NOT_PENDING` | "That item isn't waiting for approval any more." | `failed` |
| `DEAL_PRICE_EXPIRED` | "The rate for this deal has run out. The deal has lapsed and nothing moved." | `failed` |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit; your approval was not counted." | `failed` |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Your approval was not counted." | `failed` |
| standard six | | |

#### 5. Adapters
`pending` `corp.treasury.pending`; `approve` `corp.treasury.approve`; `reject` `corp.treasury.reject`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.approvals.approve`; `otp`; `stepup` above 250,000 USD equivalent or for sweep and pool structures (standing instructions); `SELF_APPROVAL`.

#### 7. Result and links out
Receipt on release. Notification to the Maker. Buttons: Next item (inbox), Track (Cash › activity), Done.

#### 8. Acceptance criteria
- AC-1: A single approval releases a single-approval item and moves money (or books the deal or deposit) exactly once.
- AC-2: Two different approvers are needed above 250,000 USD equivalent.
- AC-3: Nobody approves their own item.
- AC-4: Reject records the reason and moves nothing.
- AC-5: A deal whose price lock has run out lapses on approval and moves nothing.
- AC-6: If funds or limits fail at the last approval, the approval does not count.
- AC-7: Timeout never approves twice; unavailable changes nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `dana` approves Alex's 20,000 transfer | balances move once |
| T-2 | AC-2 | 300,000; `dana` twice; then `lee` | `ALREADY_APPROVED`; released on `lee` |
| T-3 | AC-3 | maker approves own (a user holding both roles) | `SELF_APPROVAL` |
| T-4 | AC-4 | `lee` rejects with reason | `rejected`; balances unchanged |
| T-5 | AC-5 | clock +11 min after deal | `DEAL_PRICE_EXPIRED`; `lapsed` |
| T-6 | AC-6 | source emptied; company limit used up | `INSUFFICIENT_FUNDS`; `LIMIT_COMPANY_EXCEEDED`; still pending |
| T-7 | AC-7 | `timeout: [corp.treasury.approve]` + retry; `unavailable` | approved once; none |

#### 10. Expected mutation-check survivors
None expected for `fourEyes`, `dualApproval`, `roles`, `priceLock`. Survivor: `stepup` for structures until `bank.session.stepUp` exists in the sandbox.

---

## Open questions

1. **Group model.** Today a company is one `CorpCompany`. Cash needs a group with several entities and a way for one user to see (read only) and act on another entity's accounts. This spec lets the acting entity be the source and treats destinations as read only. Is a "group treasury" context needed instead?
2. **Position freshness.** A real bank has intraday and prior-day data; the sandbox has a single `asOf`. Should the position show two columns (opening and current)?
3. **Rate lock vs approval.** A dealer normally books at once. This spec locks the price for 10 minutes while an approver decides. Confirm the policy with the bank (dealing limits instead of approval for small deals?).
4. **Notional pooling legality.** In many places it needs a legal agreement per entity. The sandbox models it as a typed signature and OTP. Real signing may need a document service.
5. **Interest compensation.** The sandbox gives a simple daily benefit. Real banks add margins, caps and tax rules.
6. **Sweeps across entities.** They create loans. Do we show an intercompany ledger screen? Not in this release.
7. **Statement formats.** MT940, CAMT.053, CSV: which flavours does the first bank actually deliver? Open-banking links are out of scope.
8. **Timeout semantics.** In the sandbox a `TIMEOUT` is not applied (README 1.5); the copy still tells people to check Activity.
9. **Name clash.** `bank.deposit.create` means "add money from a card" today; this module therefore uses `corp.deposit.*`. Should the Personal one be renamed?
10. **Forecast sources.** System items need `schedule-business-payment` (Module 2) and receivables data (Module 8). Until then only manual items and approved payments feed it.

## README changes needed
- Section 3.3: add the **Cash** tab (Position · Forecast · Structure · Treasury · Funding · Rules · Activity); Approvals inbox Type filter gains Treasury.
- Section 4.2: add `biz.cash.view`, `biz.cash.link`, `biz.cash.forecast`, `biz.cash.request`, `biz.cash.transfer`, `biz.treasury.fx`, `biz.treasury.invest`, `biz.cash.structure`, `biz.cash.rules`.
- Section 5.3: add the launch points above.
- Section 1.7: the Alpha group (three entities and Cedar Valley Bank account) and the account list in "Sandbox domains".
- Contents table: Module 6 journey count 11.
