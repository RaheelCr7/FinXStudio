# Module 3: Wealth

## 1. Scope, release and users

**Release 2.** Wealth is a section of the **Personal "Aurora"** workspace for private-banking clients (people with a relationship manager and a managed or advised portfolio). It is not a new app and not a new workspace: the same sign-in, the same context switcher, the same Home. The section shows only when the active context holds `wealth.view`.

Who uses it:

| Person | What they do here |
|---|---|
| Private-banking client (the cast member **Elena Voss**, `elena`, planned) | Looks at portfolios, accepts advice, buys and sells funds, switches model portfolios, asks for a currency forward or a structured note, downloads statements and the yearly tax report |
| Relationship manager (the adviser) | Is not a user of this app. Sends proposals and answers requests from a back-office tool that the sandbox plays (see "Sandbox domains") |
| Retail customer (**Alex Morgan**, `alex`) | Has no `wealth.view`. Wealth launch points do not show. A deep link answers `PERMISSION_DENIED` (README 1.6) |

This module builds on what exists: the BankWorkx® **Invest** feature (self-directed buying and selling of nine made-up stocks and funds). Wealth adds advice, a risk profile, funds with dealing rules, managed models, treasury products and reports. Nothing in Wealth is investment advice for real: all names, prices and people are synthetic.

Plain words used in this file:

| Word | Meaning |
|---|---|
| Mandate | The agreement for a portfolio. **Execution-only**: the client decides everything. **Advisory**: the adviser proposes, the client accepts or declines. **Discretionary**: the bank decides inside a model portfolio |
| Risk profile | A score from 1 (Conservative) to 5 (Aggressive) that comes from the questionnaire. It limits what the client may buy |
| Suitability check | The bank's test that a product fits the client's profile and does not put too much in one place |
| SRI | Summary risk indicator: a 1 to 7 risk number printed on every fund document |
| NAV | Net asset value: the price of one fund unit, set once per dealing day |
| Dealing day and cut-off | A fund is priced on certain days. An order placed before the cut-off gets that day's price. After it, the next dealing day's |
| Forward | An agreement today to exchange two currencies at a fixed rate on a later date |
| Structured note | A bond whose payout depends on an index. The client sees an indicative price first and the bank confirms it |

## 2. What exists today in code

| Thing | Where | State |
|---|---|---|
| Instruments (9 made-up stocks and funds, prices, charts, 1D 1W 1M 1Y) | `packages/mock-bank-api/src/invest.ts` | Existing |
| Holdings and watchlist per customer (`alexInvest`: LMRB 6.5 shares, GLBX 40, ORCH 20, TBND 5; watchlist APXC, SMTH, GRNF) | `invest.ts` | Existing |
| Adapters `bank.invest.instruments`, `bank.invest.buy`, `bank.invest.holdings`, `bank.invest.sell`, `bank.invest.watch` | `index.ts`, `catalog.ts` | Existing |
| Errors `INSTRUMENT_NOT_FOUND`, `INVALID_AMOUNT` ($1 to $50,000 to buy; at least $1 to sell), `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `NOT_HELD`, `INSUFFICIENT_HOLDING`, `NOT_SUPPORTED` | `index.ts` | Existing |
| Journeys `invest` and `sell-investment` | `fixtures/bankworkx.ts` | Existing. **No consent and no one-time code today.** Message on failure: "Nothing was bought and no money left your account" |
| Portfolio screens (value chart, Portfolio, Watchlist, Explore) | `docs/BANKWORKX.md` | Existing, BankWorkx® look |
| Currency rates and quotes with a 30 s life (`bank.fx.rate`, `bank.fx.quote`, `bank.fx.convert`; spread 0.5%, fee 0.2%) | `fx.ts`, `index.ts` | Existing. The forward journey reuses the quote pattern |
| OTP (`bank.otp.send`, `bank.otp.verify`, code `482100`) | `index.ts` | Existing |

Not built: risk profile, mandates, advice, funds with NAV and cut-off, models, treasury, documents, tax. The rest of this file is **planned**.

### 2.1 Upgrade of the two existing journeys

`invest` and `sell-investment` stay in Save & Borrow › Investments for retail customers. For a client who holds `wealth.view` they get, when the module is built:

| Upgrade | Detail |
|---|---|
| Suitability | `invest` calls `bank.wealth.suitability.check` (planned) before the review. A client without a risk profile is sent to `wealth-risk-profile` first |
| Consent | A `consent` block (`mustBeTrue`) after the review: "I understand that investments can go down as well as up." |
| One-time code | `otp` block above $10,000 (planned limit `wealth.otpAbove`); `bank.invest.buy` and `.sell` answer `OTP_REQUIRED` above it |
| Proof | AC and T lists in the same format as below. Mutation check must kill removal of the amount limits, the consent and the code check |

## 3. Sandbox domains needed (planned)

A new file `packages/mock-bank-api/src/wealth.ts` with pure rules, a clock and a `Flaws` list, like `corporate.ts`. The adviser is played by the sandbox: it creates proposals on request and answers requests after a set delay (`conditions.latencyMs`, README 1.5).

| Domain | What it holds | Rules the proof relies on |
|---|---|---|
| Client | Segment, adviser (Marcus Lindqvist), base currency USD, risk profile (score, valid until) | Profile expires after 12 months: `PROFILE_EXPIRED` blocks new buys |
| Portfolios | Each has a mandate, a custody account, a cash account, positions | Elena: Advisory ••9001 (USD 2,450,000), Discretionary ••9002 (USD 1,180,000, model Balanced Growth) |
| Positions and prices | Asset class (equity, bond, fund, cash, structured), quantity, cost, price, currency | Values in base currency with the day's rate (`fx.ts` table) |
| Performance | Time-weighted return, benchmark, per range 1M 3M YTD 1Y | Fixed pseudo-random series, like `invest.ts` |
| Questionnaire | 10 questions, scored; result profile | Score bands: 10-18 Conservative (1), 19-26 Moderately conservative (2), 27-34 Balanced (3), 35-42 Growth (4), 43-50 Aggressive (5) |
| Suitability | Product SRI against profile; concentration | Max SRI allowed: profile 1 = 2, 2 = 3, 3 = 4, 4 = 5, 5 = 7. One position may not exceed 25% of the portfolio (`CONCENTRATION_LIMIT`) |
| Proposals | Adviser trade lists with an expiry and a rationale | Valid 5 working days. Acceptance reprices at market and checks cash |
| Funds | Name, SRI, NAV, currency, minimum, dealing days, cut-off 14:00 UTC, settlement T+2, redemption notice, gate | See `wealth-fund-subscribe` |
| Models | Target allocation per model, drift band (5 points), switch rule | See `wealth-model-switch` |
| Treasury | Forward quotes (spot rate plus forward points), margin, value date 1 week to 12 months | Quote life 30 s. Uses `fx.ts` rates |
| Structured notes | Issuer, underlying, term, barrier, coupon, indicative price | Indicative until the bank confirms in 1 hour (sandbox: after `latencyMs`) |
| Documents | Statements, contract notes, key documents, tax reports | Each with id, type, period, size, checksum text |
| Tax | Realised gains, income, fees, per year | Synthetic jurisdiction "Sandbox Land"; no real tax law |

`conditions` (planned): any adapter below may be set to `timeout`, `unavailable` or `empty`.

## 4. New adapters (planned)

Style: `bank.wealth.<domain>.<verb>`. `moneyMoving`: moves or commits money. `requiresOtp`: needs `bank.otp.verify` first (else `OTP_REQUIRED`, which clears after one use like the existing adapters). Every adapter also answers `PERMISSION_DENIED` without `wealth.view`, `TIMEOUT` and `SERVICE_UNAVAILABLE` (README 1.5, 1.6). Those three are not repeated in the Errors column.

| Adapter | Request | Response | Errors | moneyMoving | requiresOtp |
|---|---|---|---|---|---|
| `bank.wealth.profile.get` | none | `{ clientId, name, segment, adviser: { name, phone }, baseCurrency, riskProfile: { score, label, validUntil } or null }` | none | no | no |
| `bank.wealth.portfolios.list` | none | map by id: `{ id, name, mandate, model?, value, currency, dayChange, dayChangePct, cashAccountId }` | none | no | no |
| `bank.wealth.portfolio.get` | `{ portfolioId, range: "1M"\|"3M"\|"YTD"\|"1Y" }` | `{ id, name, mandate, value, cash, invested, gain, gainPct, twr, benchmark: { name, twr }, allocation[], series[], pendingOrders }` | `PORTFOLIO_NOT_FOUND` | no | no |
| `bank.wealth.holdings.list` | `{ portfolioId, groupBy?: "assetClass"\|"currency"\|"none", assetClass? }` | map: `{ id, name, symbol, assetClass, qty, price, value, weightPct, cost, gain, gainPct, currency }` | `PORTFOLIO_NOT_FOUND` | no | no |
| `bank.wealth.transactions.list` | `{ portfolioId, from?, to?, type?, page }` | `{ rows[], total, page, pages }` | `PORTFOLIO_NOT_FOUND`, `INVALID_PERIOD` | no | no |
| `bank.wealth.questionnaire.get` | none | `{ version, questions[{ id, text, answers[{ id, text, points }] }], current? }` | none | no | no |
| `bank.wealth.questionnaire.submit` | `{ version, answers: { qid: aid }, horizonYears, canLose }` | `{ score, profile: { score, label }, validUntil, reference }` | `ANSWERS_INCOMPLETE`, `VERSION_OUTDATED`, `LOSS_CAPACITY_CONFLICT` | no | yes |
| `bank.wealth.suitability.check` | `{ portfolioId, symbol, side: "buy"\|"sell", amount }` | `{ ok, sri, maxSri, weightAfterPct, warnings[] }` | `PROFILE_MISSING`, `PROFILE_EXPIRED`, `SUITABILITY_BLOCKED`, `CONCENTRATION_LIMIT`, `INSTRUMENT_NOT_FOUND` | no | no |
| `bank.wealth.proposals.list` | `{ status?: "open"\|"accepted"\|"declined"\|"expired" }` | map: `{ id, portfolioId, title, createdAt, expiresAt, status, tradeCount, netCash }` | none | no | no |
| `bank.wealth.proposals.get` | `{ proposalId }` | `{ id, title, rationale, trades[{ n, side, symbol, name, qty, estPrice, estAmount, currency, sri }], fees, netCash, cashAfter, allocationBefore[], allocationAfter[], documents[], expiresAt, status }` | `PROPOSAL_NOT_FOUND` | no | no |
| `bank.wealth.proposals.accept` | `{ proposalId, tradeNumbers?: number[] }` (all if omitted) | `{ reference, executed[], rejected[{ n, code }], cashAfter, status }` | `PROPOSAL_NOT_FOUND`, `PROPOSAL_EXPIRED`, `PROPOSAL_NOT_OPEN`, `NO_TRADES_SELECTED`, `PRICE_MOVED`, `INSUFFICIENT_FUNDS`, `SUITABILITY_BLOCKED`, `OTP_REQUIRED` | yes | yes |
| `bank.wealth.proposals.decline` | `{ proposalId, reason? }` | `{ status: "declined" }` | `PROPOSAL_NOT_FOUND`, `PROPOSAL_NOT_OPEN` | no | no |
| `bank.wealth.proposals.ask` | `{ proposalId, message }` | `{ messageId }` | `PROPOSAL_NOT_FOUND`, `MESSAGE_EMPTY` | no | no |
| `bank.wealth.funds.list` | `{ q?, riskMax?, currency? }` | map: `{ id, symbol, name, sri, nav, navDate, currency, minInitial, minNext, nextDealing, cutoff, redemptionNotice }` | none | no | no |
| `bank.wealth.funds.quote` | `{ portfolioId, symbol, side: "subscribe"\|"redeem", amount?, units? }` | `{ quoteId, nav, navDate, dealingDate, cutoffPassed, units, amount, fee, settlement, expiresAt }` | `FUND_NOT_FOUND`, `BELOW_MINIMUM`, `INVALID_AMOUNT`, `NOT_HELD`, `INSUFFICIENT_HOLDING`, `FUND_CLOSED`, `GATE_APPLIED`, plus the suitability codes | no | no |
| `bank.wealth.funds.subscribe` | `{ quoteId, fromAccountId }` | `{ reference, orderId, status: "accepted", dealingDate, settlementDate, amount, fee }` | `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `OTP_REQUIRED` | yes | yes |
| `bank.wealth.funds.redeem` | `{ quoteId, toAccountId }` | `{ reference, orderId, status: "accepted", dealingDate, settlementDate, estProceeds }` | `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_HOLDING`, `OTP_REQUIRED` | yes | yes |
| `bank.wealth.orders.list` | `{ portfolioId?, status? }` | map: `{ id, symbol, side, amount, status, dealingDate, settlementDate }` | none | no | no |
| `bank.wealth.orders.cancel` | `{ orderId }` | `{ status: "cancelled" }` | `ORDER_NOT_FOUND`, `ORDER_NOT_CANCELLABLE` | no | no |
| `bank.wealth.models.list` | none | map: `{ id, name, riskScore, sri, allocation[], feePct, minSwitch }` | none | no | no |
| `bank.wealth.models.preview` | `{ portfolioId, modelId }` | `{ current[], target[], trades[], estTax?, estFees, driftAfter }` | `PORTFOLIO_NOT_FOUND`, `MODEL_NOT_FOUND`, `MODEL_NOT_ALLOWED`, `SAME_MODEL` | no | no |
| `bank.wealth.models.switch` | `{ portfolioId, modelId, previewId }` | `{ reference, status: "scheduled", effectiveDate }` | `PREVIEW_EXPIRED`, `MODEL_NOT_ALLOWED`, `SWITCH_PENDING`, `OTP_REQUIRED` | yes | yes |
| `bank.wealth.treasury.quote` | `{ sellCurrency, buyCurrency, amount, side: "sell"\|"buy", valueDate }` | `{ quoteId, spot, points, forwardRate, sellAmount, buyAmount, margin, collateralPct, collateral, expiresAt, ttlSeconds }` | `SAME_CURRENCY`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `INVALID_VALUE_DATE`, `ABOVE_TREASURY_LIMIT` | no | no |
| `bank.wealth.treasury.book` | `{ quoteId, collateralAccountId }` | `{ reference, dealId, status: "booked", forwardRate, valueDate, collateralHeld }` | `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `OTP_REQUIRED` | yes | yes |
| `bank.wealth.notes.list` | none | map of available notes: `{ id, name, issuer, underlying, termMonths, coupon, barrierPct, capitalProtectedPct, sri, minAmount, currency, window }` | none | no | no |
| `bank.wealth.notes.request` | `{ portfolioId, noteId, amount, fromAccountId }` | `{ reference, requestId, status: "indicative", indicativePrice, confirmBy }` | `NOTE_NOT_FOUND`, `NOTE_WINDOW_CLOSED`, `BELOW_MINIMUM`, `INSUFFICIENT_FUNDS`, `SUITABILITY_BLOCKED`, `COMPLEXITY_TEST_FAILED`, `OTP_REQUIRED` | yes (reserves cash) | yes |
| `bank.wealth.notes.status` | `{ requestId }` | `{ status: "indicative"\|"confirmed"\|"declined", price?, tradeDate? }` | `REQUEST_NOT_FOUND` | no | no |
| `bank.wealth.documents.list` | `{ type?, portfolioId?, from?, to? }` | map: `{ id, type, title, period, createdAt, sizeKb }` | `INVALID_PERIOD` | no | no |
| `bank.wealth.documents.get` | `{ documentId }` | `{ id, title, sizeKb, pages, url, text }` | `DOCUMENT_NOT_FOUND` | no | no |
| `bank.wealth.documents.acknowledge` | `{ documentId, readToEnd: true }` | `{ acknowledgedAt }` | `DOCUMENT_NOT_FOUND` | no | no |
| `bank.wealth.statement.request` | `{ portfolioId, from, to, format: "pdf"\|"csv" }` | `{ documentId, sizeKb }` | `PORTFOLIO_NOT_FOUND`, `INVALID_PERIOD`, `PERIOD_TOO_LONG` | no | no |
| `bank.wealth.tax.report` | `{ year }` | `{ documentId, year, realisedGain, income, fees, withheld, issuedAt }` | `YEAR_NOT_AVAILABLE`, `REPORT_NOT_READY` | no | no |
| `bank.wealth.adviser.request` | `{ topic, preferredDate?, preferredTime?, channel, message }` | `{ requestId, status: "received", answerBy }` | `MESSAGE_EMPTY`, `SLOT_UNAVAILABLE` | no | no |

## 5. New components (planned, beyond README 2.2)

| Component | Used for | Based on |
|---|---|---|
| `allocationChart` | Donut of asset classes with a target ring beside it | The `Donut` widget (README: `chart`) |
| `riskScale` | A 1 to 7 scale with the product marked and the client's limit shaded | New small widget |
| `compareTable` | Before and after columns for allocation and trades | `dataTable` with two value columns |
| `quoteCountdown` | Shows the seconds a quote is valid and asks for a new quote when it ends | The 30 s quote pattern of `bank.fx.quote` |
| `performanceChart` | Line of portfolio against benchmark, ranges 1M 3M YTD 1Y | `chart` (the `LineChart` widget) |
| `questionCard` | One question per card with a progress bar and Back | `select` with `variant: "tiles"` |

## 6. Information architecture

Entry: Home › Wealth widget, and Save & Borrow › a **Wealth** segment above Investments. Both show only with `wealth.view`. On the web the left rail gets a **Wealth** item. (See open question 1.)

Sub-navigation (segments inside Wealth): **Overview**, **Holdings**, **Orders**, **Advice**, **Documents**.

### Shell: Wealth overview
| Item | Spec |
|---|---|
| Purpose | One page that says what the client has, how it is doing and what needs attention |
| Route | Web `/personal/wealth`; mobile screen `WealthOverview` |
| Data | View-model `wealthOverview` = `bank.wealth.profile.get` + `bank.wealth.portfolios.list` + `bank.wealth.proposals.list` (open) + `bank.wealth.orders.list` (open) |
| Widgets | (1) Total wealth hero: value in USD, day change, 1M/3M/YTD/1Y chart (`performanceChart`). (2) Portfolio cards (one per portfolio): name, mandate chip, value, return YTD. (3) Allocation donut (`allocationChart`) across all portfolios. (4) "Needs your attention": open proposals with days left, risk profile expiring within 60 days, orders waiting. (5) Your adviser card: name, phone, buttons Message and Book a call. (6) Quick actions: Buy a fund, Sell a fund, Ask for a forward, Request a note |
| Loading | Skeleton hero and two skeleton cards |
| Empty | Client with no portfolio: "Your portfolios will show here once your adviser has set them up." Button: Contact your adviser (`wealth-contact-adviser`) |
| Error | "We couldn't load your wealth. Nothing was changed." Button: Try again |
| Drill-downs | Portfolio card to Portfolio detail; attention item to the proposal or order; adviser Message to `wealth-contact-adviser` |
| Launch points on it | Quick actions to the journeys in section 8; attention "Update your risk profile" to `wealth-risk-profile` |

### Shell: Portfolio detail
| Item | Spec |
|---|---|
| Route | Web `/personal/wealth/p/{portfolioId}`; mobile `WealthPortfolio` |
| Data | `bank.wealth.portfolio.get` with the range chosen |
| Widgets | Value and return, `performanceChart` against benchmark, allocation donut, cash and invested, mandate and model (with Switch model), pending orders strip, Statements button |
| Sort and filter | Range selector 1M, 3M, YTD, 1Y (default YTD) |
| States | As the overview. Unknown id: "We can't find that portfolio." Button: Back to Wealth |
| Drill-downs | Holdings button to Holdings; pending order to Orders; Switch model to `wealth-model-switch`; Statements to `wealth-statement` |

### Shell: Holdings
| Item | Spec |
|---|---|
| Route | Web `/personal/wealth/p/{portfolioId}/holdings`; mobile `WealthHoldings` |
| Data | `bank.wealth.holdings.list` |
| Widgets | `dataTable`: search box, filter chips by asset class (All, Equity, Bond, Fund, Cash, Structured), group switch (None, Asset class, Currency) |
| Columns | Name and symbol; Asset class (`statusChip`); Quantity; Price; Value (base currency); Weight %; Gain (amount and %), gain in green or red with an arrow, never colour alone |
| Sort | Value, high to low (default). Click a column to change. Weight, Gain, Name |
| Phone | Card list: name, value, weight, gain. Same filters in a sheet |
| Empty | "You don't hold anything in this portfolio yet." For a fund-capable client: button Buy a fund |
| Drill-downs | Row to Holding detail (price chart, position, key numbers: reuses the existing instrument page). Row actions: Buy more or Sell (`wealth-fund-subscribe` / `wealth-fund-redeem` for funds; `invest` / `sell-investment` for listed stocks) |

### Shell: Orders
`dataTable` of `bank.wealth.orders.list`. Columns: Reference, Product, Side (Subscribe, Redeem, Switch, Note), Amount, Status (`statusChip`: Accepted, Priced, Settled, Cancelled), Dealing date, Settlement date. Filter by status. Sort by newest. Empty: "No orders yet." Drill-down: row to an order page with a `timeline` (Accepted, Priced, Settled). Cancel button while the status is Accepted and the cut-off has not passed (`bank.wealth.orders.cancel`, answers `ORDER_NOT_CANCELLABLE`: "This order is already being processed and can't be cancelled.").

### Shell: Advice
List of proposals (`bank.wealth.proposals.list`). Columns: Title, Portfolio, Created, Expires (red when under 2 days), Trades, Net cash, Status chip. Filter by status (default Open). Empty: "No proposals from your adviser right now." Row opens `wealth-proposal-accept` with `{proposalId}`.

### Shell: Documents
`dataTable` of `bank.wealth.documents.list`. Columns: Title, Type (Statement, Contract note, Key document, Tax report), Period, Created, Size. Filters: type, portfolio, date range (`datePicker`). Sort: newest first. Empty: "No documents match." Row opens the `documentViewer`. Buttons: Request a statement (`wealth-statement`), Tax report (`wealth-tax-report`).

## 7. Shared pattern for money-moving wealth journeys ("Pattern W")

Every wealth journey that places an order (`wealth-proposal-accept`, `wealth-fund-subscribe`, `wealth-fund-redeem`, `wealth-model-switch`, `wealth-fx-forward`, `wealth-structured-note`) ends with the same four screens. A journey that only changes a setting (`wealth-risk-profile`) uses the last three.

| Screen id | Blocks | Copy and rules |
|---|---|---|
| `review` | `reviewSummary` rows specific to the journey; `alert` tone info | Alert text: "Investments can go down as well as up. You may get back less than you put in. This is a sandbox: no real money moves." Button: the action with the amount, for example "Subscribe $25,000.00" |
| `documents` (only where a key document exists) | `documentViewer` (planned) | Title "Read before you continue". Button "Continue" stays disabled until the end of the document is reached. Label under the button while disabled: "Scroll to the end to continue." On continue the journey calls `bank.wealth.documents.acknowledge` |
| `consent` | `consent` with `mustBeTrue` | Text specific to the journey. Button label: "Confirm". If not ticked: "Tick the box to continue." |
| `otp` | `otp` (6 digits, `keypad`, `masked`) | Title "Enter your code". Helper "We sent a 6-digit code to the phone ending 0142." Button "Verify". Resend after 30 s. Integration ids `otpSend`, `otpVerify` (the engine counts failures only for `otpVerify`). Wrong code: "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." |
| `result` | `result` tone success, `meta` "Ref {{result.reference}}" | Buttons per journey. Receipt (planned engine feature `receipts`): reference, product, amount, dates, fee, portfolio |

Standard step-up: orders of **100,000 USD or more** (equivalent) ask `bank.session.stepUp` first (planned) and answer `STEP_UP_REQUIRED`: "For your security, confirm it's you first."

Notifications raised (planned): on accept, on settlement, on a failed order. Text: "Your order {ref} was accepted." / "Your order {ref} settled on {date}."

## 8. Journey index

| # | Slug | Name | Kind | Money moves |
|---|---|---|---|---|
| 1 | `wealth-risk-profile` | Risk profile questionnaire | Setting, OTP | No |
| 2 | `wealth-proposal-accept` | Review and accept advice | Orders | Yes |
| 3 | `wealth-fund-subscribe` | Buy fund units | Order | Yes |
| 4 | `wealth-fund-redeem` | Sell fund units | Order | Yes |
| 5 | `wealth-model-switch` | Switch model portfolio | Instruction | Yes |
| 6 | `wealth-fx-forward` | Currency forward | Treasury | Yes (collateral) |
| 7 | `wealth-structured-note` | Structured note request | Order | Yes (cash reserved) |
| 8 | `wealth-statement` | Wealth statements | File | No |
| 9 | `wealth-tax-report` | Yearly tax report | File | No |
| 10 | `wealth-contact-adviser` | Message or call with your adviser | Request | No |

Portfolio overview and holdings are shell screens (section 6): they read but do not change anything, so they carry no acceptance criteria of their own. Their data comes from `bank.wealth.portfolios.list`, `bank.wealth.portfolio.get` and `bank.wealth.holdings.list`.

### Permissions (proposed additions to README 4.1)

| Permission | Allows | Check |
|---|---|---|
| `wealth.view` | See the Wealth section, portfolios, holdings, orders, documents | Launch point hidden without it |
| `wealth.profile.manage` | Do the risk questionnaire | `otp` |
| `wealth.advice.accept` | Accept or decline proposals | `otp`, `stepup` at 100,000 USD or more |
| `wealth.trade` | Buy and sell funds and notes, switch models | `otp`, `stepup` at 100,000 USD or more |
| `wealth.treasury` | Ask for forwards | `stepup` always |
| `wealth.documents` | Statements and tax report | none |
| `wealth.contact` | Message or call the adviser | none |

The existing `invest.trade` still gates `invest` and `sell-investment`.

## 9. Journeys

### ★ Risk profile questionnaire — `wealth-risk-profile`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-risk-profile` |
| Purpose | Work out how much risk the client can and wants to take, and store it. Every buy depends on it |
| Release / workspace | 2 / Personal (Wealth) |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | Wizard: one question per screen, then review, consent, code, result |
| Who | Holders of `wealth.profile.manage` |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Wealth overview › attention | Update your risk profile | – | `wealth.profile.manage` |
| Portfolio detail | Risk profile (when missing or expired) | – | `wealth.profile.manage` |
| `invest`, `wealth-fund-subscribe`, `wealth-structured-note` | On `PROFILE_MISSING` / `PROFILE_EXPIRED` | `returnTo` the calling journey (planned `navigate.toJourney` + `returnTo`) | `wealth.profile.manage` |

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `intro` | Your risk profile | `text`, `alert` info, `button` | Copy: "Ten short questions. They help us suggest only what fits you. It takes about 4 minutes." Alert: "If you already have a profile, a new one replaces it when you confirm." Loads `bank.wealth.questionnaire.get`; shows the current profile and its valid-until date if there is one | "Start" to `q1` |
| `q1` to `q10` | Question n of 10 | `questionCard` (`select` tiles), `stepper`; required | One answer per question. Error: "Choose an answer to continue." Questions 1 to 10 in this order: investing experience; time horizon; main goal; reaction to a 20% fall; share of wealth being invested; need for income; knowledge of funds; knowledge of bonds; knowledge of complex products; regular income covers costs | "Back", "Next" (last: "See result") |
| `horizon` | Time and loss | `select` chips (1, 3, 5, 10, 15+ years), `toggle` "I could not accept losing more than 10% of this money" | Required: horizon. The toggle sets `canLose=false` | "Continue" |
| `review` | Your result | `reviewSummary`, `riskScale`, `alert` | Rows: Score, Profile (label), Most risk you can take (SRI), Valid until (12 months ahead). Alert when the toggle is on and the score is 4 or 5: "You told us you can't accept large losses. We will use Balanced (3) unless you change your answers." | "Confirm profile" to `consent`; "Change answers" to `q1` |
| `consent` | Confirm | `consent` mustBeTrue | "I confirm my answers are true and complete. I understand the bank will rely on them." | "Confirm" to `otp` |
| `otp` | Enter your code | Pattern W | – | "Verify" |
| `success` | Profile saved | `result` | Title "Profile saved". Text "Your profile is {{result.profile.label}}, valid until {{result.validUntil | date}}." Meta "Ref {{result.reference}}" | "Back to Wealth", "Buy a fund" |
| `failed` | Not saved | `result` error | "We couldn't save your profile. Nothing was changed." | "Try again" |

States: loading questionnaire shows a skeleton; empty not applicable.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `ANSWERS_INCOMPLETE` | "Some answers are missing. Go back and answer every question." | `review` | Change answers |
| `VERSION_OUTDATED` | "The questions were updated. Please start again." | `intro` | Start |
| `LOSS_CAPACITY_CONFLICT` | The review alert above (the sandbox lowers the profile and returns the reason) | `review` | Confirm profile |
| `OTP_REQUIRED` / `OTP_INVALID` | Standard messages S-OTP (README 1.6) | `otp` | Back to code / Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-SERVICE_UNAVAILABLE | `failed` | Try again |
| `PERMISSION_DENIED` | Standard S-PERMISSION_DENIED | Not allowed screen | Back |

#### 5. Adapters
| Integration id | Adapter | Notes |
|---|---|---|
| `questionnaire` | `bank.wealth.questionnaire.get` (planned) | On `intro` entry |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` (existing) | |
| `submit` | `bank.wealth.questionnaire.submit` (planned) | requiresOtp, not moneyMoving |

#### 6. Permissions, step-up, limits
`wealth.profile.manage`; level `otp`. A profile can be redone at most 3 times a day (`RATE_LIMITED`, planned: "You have already updated your profile 3 times today. Try again tomorrow.").

#### 7. Result and links out
Receipt: profile, score, valid until, reference. Notification: "Your risk profile was updated." Buttons lead to Wealth overview, or back to the journey that sent the client (`returnTo`).

#### 8. Acceptance criteria
- AC-1: The score maps to the profile bands in section 3 (10-18 gives 1 ... 43-50 gives 5).
- AC-2: The client cannot continue a question without an answer.
- AC-3: A profile is stored only after consent and a correct one-time code.
- AC-4: A client who says they cannot accept large losses never gets a profile above Balanced (3).
- AC-5: A new profile is valid for 12 months and replaces the old one.
- AC-6: A timeout or an unavailable service stores nothing and says so.

#### 9. Scenarios
| Id | Covers | Persona and setup | Steps and expected |
|---|---|---|---|
| T-1 | AC-1, AC-5 | `elena`, no profile | Answers worth 30 points. Profile Balanced (3), valid until 12 months from the clock date |
| T-2 | AC-1 | `elena` | Answers worth 18 and 43: Conservative and Aggressive |
| T-3 | AC-2 | `elena` | Press Next with no answer: "Choose an answer to continue." and stays |
| T-4 | AC-3 | `elena` | Wrong code three times: "Too many wrong codes. Start again." `expectBank`: profile unchanged |
| T-5 | AC-4 | `elena` | 45 points with the toggle on: profile 3 and the alert shows |
| T-6 | AC-6 | `elena`, `conditions.timeout: ["bank.wealth.questionnaire.submit"]` | After the code: timeout message; profile unchanged |
| T-7 | AC-6 | `elena`, `conditions.unavailable: ["bank.wealth.questionnaire.get"]` | Intro shows "This service is not available right now. Nothing was changed." |

#### 10. Expected mutation-check survivors
None expected. Possible survivor: removing the 3-per-day limit (no scenario redoes the profile 4 times). Add T-8 to kill it, or list it.

---

### ★ Review and accept advice — `wealth-proposal-accept`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-proposal-accept` |
| Purpose | Look at a trade list from the adviser, ask a question, accept all or some of it, or decline it |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned) |
| Channels | Web, mobile |
| Starting pattern | Detail, choose, review, consent, code, result |
| Who | `wealth.advice.accept`; only advisory portfolios (a discretionary portfolio has no proposals) |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Wealth › Advice › row | Open | `{proposalId}` | `wealth.advice.accept` |
| Wealth overview › attention | Proposal waiting | `{proposalId}` | `wealth.advice.accept` |
| Notification | "{adviser} sent you a proposal" | `{proposalId}` | `wealth.advice.accept` |

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `detail` | Proposal from {adviser} | `text`, `alert`, `compareTable`, `allocationChart`, `dataTable` (trades) | Copy: the adviser's rationale. Alert tone warning when under 2 days left: "This proposal ends on {expiresAt}. Prices move until you accept." Trade columns: select tick, Side, Product, Quantity, Estimated price, Estimated amount, Risk (SRI). Net cash and cash after shown | "Accept selected", "Ask a question", "Decline" |
| `ask` | Ask your adviser | `textInput` lines 4 | Required, 1 to 500 characters. Error "Write your question." | "Send" to `detail` with toast "Question sent" |
| `decline` | Decline this proposal | `select` chips (Not now, Don't agree, Other), `textInput` optional | Reason optional | "Decline proposal" to `declined` |
| `review` | Review your order | Pattern W `review` | Rows: Trades selected (n of m), Estimated buys, Estimated sells, Fees, Cash after. Alert: "Final prices are set when the orders are placed and may differ from these." | "Accept {n} trades" |
| `consent` | Confirm | `consent` | "I want these trades placed on my behalf at the market price. I have read the key documents." | "Confirm" |
| `otp` | Enter your code | Pattern W | – | "Verify" |
| `success` | Orders placed | `result` | "{{result.executed | count}} orders placed". Text lists any rejected trade: "Trade {n} was not placed: {reason}." | "Track orders" (Wealth › Orders), "Back to Wealth" |
| `declined` | Proposal declined | `result` | "You declined this proposal. Nothing was bought or sold." | "Back to Advice" |
| `failed` | Not placed | `result` error | "We couldn't place these orders. Nothing was bought or sold and no money has left your account." | "Back to proposal" |

States: detail loads with skeleton; unknown id gives `PROPOSAL_NOT_FOUND`.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `PROPOSAL_NOT_FOUND` | "We can't find that proposal." | `failed` | Back to Advice |
| `PROPOSAL_EXPIRED` | "This proposal has ended. Ask your adviser for a new one." | `failed` | Ask a question (opens `wealth-contact-adviser`) |
| `PROPOSAL_NOT_OPEN` | "This proposal was already {accepted or declined}." | `failed` | Back to Advice |
| `NO_TRADES_SELECTED` | "Choose at least one trade." | `detail` | stay |
| `PRICE_MOVED` | "The price of {product} moved more than 2% since the proposal. Review the new estimate." | `detail` | Review again |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Available: {balance}. No money has left your account." | `failed` | Change selection |
| `SUITABILITY_BLOCKED` | "{product} is above your risk profile. It was not placed." | `success` (as a rejected line) or `failed` if all rejected | Back |
| `OTP_REQUIRED`, `OTP_INVALID`, `STEP_UP_REQUIRED` | Standard | `otp` | – |
| `TIMEOUT` | "We didn't get an answer in time. Check Orders before you try again, so you don't buy twice." | `failed` | Check Orders |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`proposal` = `bank.wealth.proposals.get`; `ask` = `bank.wealth.proposals.ask`; `decline` = `bank.wealth.proposals.decline`; `accept` = `bank.wealth.proposals.accept` (moneyMoving, requiresOtp); `otpSend`, `otpVerify` existing. All except OTP are planned.

#### 6. Permissions, step-up, limits
`wealth.advice.accept`; `otp`; `stepup` when the estimated total is 100,000 USD or more. Daily limit does not apply to investments, but buys cannot exceed the cash of the portfolio. One position may not exceed 25% of the portfolio after the trades (`CONCENTRATION_LIMIT` appears as a rejected trade).

#### 7. Result and links out
Receipt: reference, trades with quantity and price, fees, cash after. Notifications: orders accepted, and on settlement. Buttons: Track orders, Back to Wealth.

#### 8. Acceptance criteria
- AC-1: Only an open, unexpired proposal can be accepted.
- AC-2: Only the trades the client ticked are placed.
- AC-3: Nothing is placed without consent and a correct one-time code.
- AC-4: A trade above the client's risk profile or above the 25% limit is not placed and the client is told which and why.
- AC-5: A declined proposal places nothing and cannot be accepted afterwards.
- AC-6: If cash is not enough, nothing is placed and no money leaves the account.
- AC-7: A timeout or unavailable service places nothing and says so.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-2 | `elena`, open proposal P1 with 4 trades | Accept trades 1 and 3: two orders; trades 2 and 4 not placed |
| T-2 | AC-1 | Clock 6 working days after creation | `PROPOSAL_EXPIRED` message |
| T-3 | AC-3 | P1 | Three wrong codes; `expectBank` orders empty |
| T-4 | AC-4 | P2 contains a product with SRI 6 and profile 3 | That trade rejected: "…is above your risk profile…"; others placed |
| T-5 | AC-4 | P3 buys 30% of the portfolio in one fund | `CONCENTRATION_LIMIT` row |
| T-6 | AC-5 | P1 | Decline, then open again: `PROPOSAL_NOT_OPEN` |
| T-7 | AC-6 | Cash account balance 1,000 | `INSUFFICIENT_FUNDS`; orders empty |
| T-8 | AC-7 | `conditions.timeout: ["bank.wealth.proposals.accept"]` | Timeout copy; orders empty |
| T-9 | AC-7 | `conditions.unavailable: ["bank.wealth.proposals.get"]` | Unavailable message on `detail` |

#### 10. Expected mutation-check survivors
None expected if T-4 and T-5 stay. Possible: the "under 2 days" warning colour (cosmetic; no scenario reads it).

---

### ★ Buy fund units — `wealth-fund-subscribe`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-fund-subscribe` |
| Purpose | Buy units of a fund from the fund list, at the fund's own dealing rules |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned). Funds on the existing `invest` list (GLBX, GRNF, TBND) are reused with dealing rules added |
| Channels | Web, mobile |
| Pattern | Choose, quote, review, documents, consent, code, result |
| Who | `wealth.trade`; execution-only and advisory portfolios (a discretionary portfolio answers `NOT_SUPPORTED`) |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Wealth overview | Buy a fund | – | `wealth.trade` |
| Holdings › row | Buy more | `{portfolioId, symbol}` | `wealth.trade` |
| Wealth › Advice (instrument page) | Buy | `{symbol}` | `wealth.trade` |

#### 3. Screens
| Id | Title | Blocks | Fields | Buttons |
|---|---|---|---|---|
| `choose` | Buy a fund | `select` rows (source `ctx.funds`), `accountPicker` (portfolio's cash account), `amountInput` | Fund (required: "Choose a fund."). Pay from (required). Amount in the fund's currency, quick amounts 5,000 / 10,000 / 25,000 / 50,000; min is the fund's `minInitial` (or `minNext` if held). Errors: "Enter an amount." / "The smallest amount for this fund is {min}." Helper: "You get units at the next price. Orders before 14:00 UTC on a dealing day get that day's price." | "Get a quote" calls `funds.quote` and goes to `review` |
| `review` | Review | Pattern W `review`, `quoteCountdown`, `riskScale` | Rows: Fund, Risk (SRI n of 7, your limit m), Amount, Fee, Estimated units, Price (NAV) and date, Dealing date, Settlement date. Alert when `cutoffPassed`: "It is after 14:00 UTC. Your order will be priced on {dealingDate}." Alert when SRI is within 1 of the limit: "This fund is close to the most risk your profile allows." | "Subscribe {amount}" |
| `documents` | Read before you continue | `documentViewer` | The fund's key information document | "Continue" |
| `consent` | Confirm | `consent` | "I want to buy this fund. I understand the price is set on the dealing date and may differ from today's." | "Confirm" |
| `otp` | Enter your code | Pattern W | | |
| `success` | Order accepted | `result` | "Order accepted". Text: "We will buy {amount} of {fund} on {dealingDate}. The money leaves your account on {settlementDate}." Meta "Ref". Note: the units show after pricing | "Track order", "Back to Wealth" |
| `failed` | Order not placed | `result` error | "We couldn't place this order. No money has left your account." | "Back" |

Empty list: "No funds match." (filter by risk and currency).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `FUND_NOT_FOUND` | "We can't find that fund. Choose another." | `choose` | stay |
| `FUND_CLOSED` | "This fund isn't open for new money right now." | `choose` | Choose another |
| `BELOW_MINIMUM` | "The smallest amount for this fund is {min}." | `choose` | Change amount |
| `INVALID_AMOUNT` | "Enter an amount in {currency} with at most 2 decimal places." | `choose` | Change amount |
| `PROFILE_MISSING` | "We need your risk profile first." | `choose` | Start questionnaire (`wealth-risk-profile`, `returnTo`) |
| `PROFILE_EXPIRED` | "Your risk profile is more than 12 months old. Update it to continue." | `choose` | Update profile |
| `SUITABILITY_BLOCKED` | "This fund is above the risk your profile allows (fund {sri}, your limit {max}). It can't be bought." | `choose` | Choose another |
| `CONCENTRATION_LIMIT` | "This would put more than 25% of your portfolio in one fund. The most you can buy is {max}." | `choose` | Change amount |
| `QUOTE_EXPIRED` | "The quote ended. Get a new one." | `review` | Get a new quote |
| `QUOTE_USED` / `QUOTE_NOT_FOUND` | "This quote was already used." / "We can't find that quote." | `failed` | Start again |
| `ACCOUNT_NOT_FOUND` | Standard | `choose` | |
| `INSUFFICIENT_FUNDS` | Standard | `failed` | Change amount |
| `LIMIT_EXCEEDED` | Standard | `failed` | Change amount |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "We didn't get an answer in time. Check Orders before you try again, so you don't buy twice." | `failed` | Check Orders |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`funds` = `bank.wealth.funds.list`; `accounts` = `bank.accounts.list` (existing); `quote` = `bank.wealth.funds.quote`; `acknowledge` = `bank.wealth.documents.acknowledge`; `subscribe` = `bank.wealth.funds.subscribe` (moneyMoving, requiresOtp); OTP existing.

#### 6. Permissions, step-up, limits
`wealth.trade`; `otp`; `stepup` at 100,000 USD or more. The daily transfer limit (`bank.limits.get`) is not used. Fund minimums and the 25% rule are in the quote.

#### 7. Result and links out
Receipt: reference, fund, amount, fee, NAV used (once priced), dealing and settlement dates. Notifications: accepted, priced, settled. Buttons: Track order (Orders), Back to Wealth.

#### 8. Acceptance criteria
- AC-1: A quote shows the dealing date; after 14:00 UTC it says the next dealing day.
- AC-2: A fund above the client's risk limit cannot be bought.
- AC-3: Below the minimum is refused with the minimum shown.
- AC-4: One position may not go above 25% of the portfolio.
- AC-5: An order needs the documents read, consent and a correct code.
- AC-6: An expired quote cannot be used, and a quote cannot be used twice.
- AC-7: Not enough cash places no order.
- AC-8: Timeout and unavailable place no order.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-5 | `elena` at 10:00 UTC on a dealing day | Dealing date today; order accepted |
| T-2 | AC-1 | Clock 15:30 UTC | Alert shows next dealing date |
| T-3 | AC-2 | profile 2 (max SRI 3), fund GRNF (high risk) | `SUITABILITY_BLOCKED` |
| T-4 | AC-3 | Fund minimum 5,000 | Amount 1,000: below-minimum message |
| T-5 | AC-4 | Portfolio 100,000; amount 30,000 | `CONCENTRATION_LIMIT` with max 25,000 |
| T-6 | AC-5 | | Three wrong codes; `expectBank` orders empty |
| T-7 | AC-6 | Clock +31 s after quote | `QUOTE_EXPIRED`; second use `QUOTE_USED` |
| T-8 | AC-7 | Cash 1,000 | `INSUFFICIENT_FUNDS`; orders empty |
| T-9 | AC-8 | `timeout: ["bank.wealth.funds.subscribe"]` | Timeout copy; orders empty |
| T-10 | AC-8 | `unavailable: ["bank.wealth.funds.quote"]` | Unavailable on `choose` |

#### 10. Expected mutation-check survivors
Skipping `documents.acknowledge` is expected to survive unless T-5 checks that the acknowledgement was stored: add `expectBank` on `bank.wealth.documents.list`. Otherwise none.

---

### ★ Sell fund units — `wealth-fund-redeem`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-fund-redeem` |
| Purpose | Sell units of a fund; proceeds arrive after settlement |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned). Sibling of `sell-investment` (existing) |
| Channels | Web, mobile |
| Who | `wealth.trade` |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Holdings › fund row | Sell | `{portfolioId, symbol}` | `wealth.trade` |
| Wealth overview | Sell a fund | – | `wealth.trade` |

#### 3. Screens
| Id | Title | Blocks | Fields | Buttons |
|---|---|---|---|---|
| `choose` | Sell a fund | `select` rows (`ctx.holdings`), `select` chips (Amount / All units), `amountInput`, `accountPicker` "Pay into" | Holding required: "Choose a fund to sell." Amount required unless All units: "Enter an amount." Up to the value held: "You only hold {value} of {symbol}." (`INSUFFICIENT_HOLDING`). Helper: "Proceeds arrive 2 working days after the sale is priced." Funds with notice: "This fund needs {n} days' notice. Your sale will be priced on {date}." | "Get a quote" |
| `review` | Review | Pattern W `review`, `quoteCountdown` | Rows: Fund, Units, Estimated proceeds, Fee, Dealing date, Settlement date. Alert tone info: "The final amount is set at the fund's price on the dealing date." If the quote reports `GATE_APPLIED`: alert warning "This fund limits sales this month. We can sell {pct}% of your order now and the rest next month." | "Sell {amount}" |
| `consent` | Confirm | `consent` | "I want to sell these units and I understand the price is set on the dealing date." | |
| `otp` | | Pattern W | | |
| `success` | Sale accepted | `result` | "We will sell on {dealingDate}. The money arrives in your account on {settlementDate}." | "Track order", "Back to Wealth" |
| `failed` | Sale not placed | `result` error | "We couldn't place this sale. Nothing was sold." | "Back" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `NOT_HELD` | "Choose something you own to sell." | `choose` | stay |
| `INSUFFICIENT_HOLDING` | "You only hold {value} of {symbol}." | `choose` | Change amount |
| `INVALID_AMOUNT` | "Enter an amount of at least {minimum}." | `choose` | Change amount |
| `FUND_CLOSED` | "This fund isn't taking sales right now." | `choose` | Back |
| `GATE_APPLIED` | the gate alert above (not an error; the quote returns `gatePct`) | `review` | Continue |
| `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND` | As `wealth-fund-subscribe` | `review` / `failed` | |
| `ACCOUNT_NOT_FOUND` | Standard | `choose` | |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "We didn't get an answer in time. Check Orders before you try again, so you don't sell twice." | `failed` | Check Orders |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`holdings` = `bank.wealth.holdings.list`; `quote` = `bank.wealth.funds.quote` (side redeem); `redeem` = `bank.wealth.funds.redeem` (moneyMoving: pays out on settlement; requiresOtp); OTP existing.

#### 6. Permissions, step-up, limits
`wealth.trade`; `otp`; `stepup` at 100,000 USD or more. Selling all units closes the holding (as `bank.invest.sell` does today).

#### 7. Result and links out
Receipt: reference, units, estimated proceeds, dates. Notification on settlement: "{amount} from your sale arrived in {account}."

#### 8. Acceptance criteria
- AC-1: The client cannot sell more than they hold.
- AC-2: Selling all units sells every unit and leaves no remainder.
- AC-3: A fund with a notice period shows the later dealing date.
- AC-4: A gated fund shows how much will be sold now.
- AC-5: A sale needs consent and a correct code.
- AC-6: Timeout and unavailable sell nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Holds 10,000 of GLBX | Amount 12,000: "You only hold $10,000.00 of GLBX." |
| T-2 | AC-2 | | All units: holding gone after settlement |
| T-3 | AC-3 | Fund with 5 days' notice | Dealing date +5 working days |
| T-4 | AC-4 | Gate 50% | Review shows the gate alert |
| T-5 | AC-5 | | Three wrong codes; orders empty |
| T-6 | AC-6 | `timeout: ["bank.wealth.funds.redeem"]` | Timeout copy |
| T-7 | AC-6 | `unavailable: ["bank.wealth.funds.quote"]` | Unavailable message |

#### 10. Expected mutation-check survivors
Possible: the "at least minimum" amount rule if no scenario sells below it (add one). Otherwise none.

---

### ★ Switch model portfolio — `wealth-model-switch`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-model-switch` |
| Purpose | Move a discretionary portfolio to another model (more or less risk) |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned) |
| Channels | Web, mobile |
| Who | `wealth.trade`; discretionary portfolios only |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Portfolio detail | Switch model | `{portfolioId}` | `wealth.trade` |

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `choose` | Choose a model | `select` tiles (`ctx.models`) with name, risk, fee, `riskScale` | Required: "Choose a model." The current model is marked "Current" and cannot be chosen (`SAME_MODEL`). A model above the profile limit is greyed with "Above your risk profile" | "Preview" |
| `preview` | What will change | `compareTable` (current and target), `allocationChart`, `dataTable` (trades) | Shows trades, estimated fees, drift after. Alert info: "The bank will make these trades within 2 working days. The portfolio may be partly invested in cash meanwhile." | "Continue" |
| `consent` | Confirm | `consent` | "I want to move my portfolio to {model}. I understand fees and market changes may apply." | |
| `otp` | | Pattern W | | |
| `success` | Switch scheduled | `result` | "We will move your portfolio to {model} on {effectiveDate}." | "Back to portfolio" |
| `failed` | Not scheduled | `result` error | "We couldn't schedule this switch. Nothing was changed." | "Back" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `MODEL_NOT_FOUND` | "We can't find that model." | `choose` | |
| `MODEL_NOT_ALLOWED` | "This model is above your risk profile (model {sri}, your limit {max})." | `choose` | Choose another |
| `SAME_MODEL` | "Your portfolio is already in this model." | `choose` | |
| `PREVIEW_EXPIRED` | "The preview ended. Preview again." | `preview` | Preview |
| `SWITCH_PENDING` | "A switch is already in progress for this portfolio." | `failed` | Back |
| `PORTFOLIO_NOT_FOUND` | "We can't find that portfolio." | `failed` | Back |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "This is taking longer than expected. Check the portfolio before you try again." | `failed` | Check portfolio |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`models` = `bank.wealth.models.list`; `preview` = `bank.wealth.models.preview`; `switch` = `bank.wealth.models.switch` (moneyMoving, requiresOtp); OTP existing.

#### 6. Permissions, step-up, limits
`wealth.trade`; `otp`; `stepup` when portfolio value is 100,000 USD or more (always, in practice). Minimum switch size per model (`minSwitch`).

#### 7. Result and links out
Receipt: reference, old and new model, effective date. Notification when the portfolio has been moved.

#### 8. Acceptance criteria
- AC-1: A model above the client's risk limit cannot be chosen.
- AC-2: The same model cannot be chosen.
- AC-3: The preview shows trades and fees before anything is committed.
- AC-4: Only one switch can be in progress.
- AC-5: A switch needs consent and a correct code.
- AC-6: Timeout and unavailable schedule nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | profile 3, model with SRI 6 | `MODEL_NOT_ALLOWED` |
| T-2 | AC-2 | | `SAME_MODEL` |
| T-3 | AC-3 | | Preview lists trades; `expectBank` portfolio unchanged |
| T-4 | AC-4 | Switch already scheduled | `SWITCH_PENDING` |
| T-5 | AC-5 | | Wrong codes; not scheduled |
| T-6 | AC-6 | `timeout: ["bank.wealth.models.switch"]` | Timeout copy; no switch |
| T-7 | AC-6 | `unavailable: ["bank.wealth.models.preview"]` | Unavailable on `choose` |

#### 10. Expected mutation-check survivors
None expected.

---

### ★ Currency forward — `wealth-fx-forward`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-fx-forward` |
| Purpose | Fix today the rate for exchanging two currencies on a later date, for example to protect a euro bill due in 6 months |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned). Builds on the quote pattern of `bank.fx.quote` and the rates in `fx.ts` |
| Channels | Web, mobile |
| Who | `wealth.treasury` only (private-banking clients with a treasury agreement). Included because clients with foreign-currency costs ask for it; it can be dropped from Release 2 (open question 3) |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Wealth overview | Ask for a forward | – | `wealth.treasury` |
| Portfolio detail › cash | Hedge this currency | `{currency}` | `wealth.treasury` |

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `terms` | Currency forward | `select` chips (Sell / Buy), `select` (sell currency, buy currency), `amountInput`, `datePicker` (value date), `accountPicker` (collateral account) | Currencies required and different (`SAME_CURRENCY`). Amount > 0, at most 2 decimals (JPY none). Value date: 7 days to 12 months ahead, a working day. Error: "Choose a date between {from} and {to}." Helper: "We hold {collateralPct}% of the amount as security until the deal ends." | "Get a rate" |
| `quote` | Your rate | `reviewSummary`, `quoteCountdown`, `alert` | Rows: You sell, You buy, Spot rate, Forward points, Your forward rate, Value date, Security held. Alert info: "This rate is valid for 30 seconds." After it: alert warning "The rate ended." with "Get a new rate" | "Book this forward" |
| `consent` | Confirm | `consent` | "I understand this is a binding deal. If I cancel it early I may have to pay a cost. I have read the product terms." | |
| `otp` | | Pattern W (always after `stepup`) | | |
| `success` | Forward booked | `result` | "You will exchange {sell} for {buy} on {valueDate} at {rate}. {collateral} is held as security." | "View deal" (Wealth › Orders), "Back to Wealth" |
| `failed` | Not booked | `result` error | "We couldn't book this forward. Nothing was held or booked." | "Back" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `SAME_CURRENCY` | "Choose two different currencies." | `terms` | |
| `CURRENCY_NOT_SUPPORTED` | "We don't offer forwards in {currency}." | `terms` | |
| `INVALID_AMOUNT` | "Enter an amount with at most {n} decimal places." | `terms` | |
| `INVALID_VALUE_DATE` | "Choose a date between {from} and {to}, on a working day." | `terms` | |
| `ABOVE_TREASURY_LIMIT` | "This is above your treasury limit of {limit}." | `terms` | Change amount |
| `QUOTE_EXPIRED` / `QUOTE_USED` / `QUOTE_NOT_FOUND` | "The rate ended. Get a new one." / "This quote was already used." / "We can't find that quote." | `quote` / `failed` | Get a new rate |
| `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS` | Standard (security cannot be held) | `terms` / `failed` | |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "We didn't get an answer in time. Check your deals before you try again, so you don't book twice." | `failed` | Check deals |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`quote` = `bank.wealth.treasury.quote`; `book` = `bank.wealth.treasury.book` (moneyMoving: holds collateral; requiresOtp); OTP existing; `accounts` existing.

#### 6. Permissions, step-up, limits
`wealth.treasury`; `stepup` always, then `otp`. Treasury limit per client (sandbox: 2,000,000 USD equivalent).

#### 7. Result and links out
Receipt: reference, deal id, rate, value date, security held. Notification 2 days before value date: "Your forward {dealId} settles on {date}."

#### 8. Acceptance criteria
- AC-1: The forward rate equals the spot rate plus the forward points for the chosen date.
- AC-2: The two currencies must differ, and the date must be 7 days to 12 months ahead on a working day.
- AC-3: A quote lasts 30 seconds and can be used once.
- AC-4: Security (collateral) is held at booking; not enough cash books nothing.
- AC-5: A deal needs a step-up, consent and a correct code.
- AC-6: Timeout and unavailable book nothing and hold nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `elena`, EUR/USD, 6 months | Forward rate = spot + points |
| T-2 | AC-2 | | Same currency refused; date 3 days ahead refused; Saturday refused |
| T-3 | AC-3 | Clock +31 s | `QUOTE_EXPIRED`; then second booking `QUOTE_USED` |
| T-4 | AC-4 | Cash 100 | `INSUFFICIENT_FUNDS`; `expectBank` collateral 0 |
| T-5 | AC-5 | | No step-up gives `STEP_UP_REQUIRED`; wrong codes book nothing |
| T-6 | AC-6 | `timeout: ["bank.wealth.treasury.book"]` | Timeout copy; deals empty |
| T-7 | AC-6 | `unavailable: ["bank.wealth.treasury.quote"]` | Unavailable on `terms` |

#### 10. Expected mutation-check survivors
Possible: JPY decimals (no JPY scenario); add one or list it.

---

### ★ Structured note request — `wealth-structured-note`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-structured-note` |
| Purpose | Ask to buy a structured note (a bond whose payout depends on an index) with a complexity test, an indicative price and bank confirmation |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned). Included only for clients who pass the complexity test (open question 3) |
| Channels | Web, mobile |
| Who | `wealth.trade` and a profile of 3 or more |

#### 2. Entry points
Wealth overview › Request a note; Wealth › Advice proposal line (when the adviser proposes a note).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `choose` | Structured notes | `dataTable` (`ctx.notes`), `select` rows | Columns: Name, Issuer, Underlying, Term, Coupon, Capital protected %, SRI, Minimum, Window closes. Required: "Choose a note." | "Continue" |
| `test` | Do you understand this product? | 3 × `select` (tiles) multiple choice, `alert` | Questions: what happens if the index falls below the barrier; can you sell before the end; who is the issuer. Pass: all correct. Alert: "This test is required for complex products." Wrong: `COMPLEXITY_TEST_FAILED` "Some answers aren't right. Read the document and try again." | "Continue" |
| `amount` | Amount | `amountInput`, `accountPicker` | Minimum = note minimum. Error: "The smallest amount is {min}." | "Review" |
| `review` | Review | Pattern W `review` with `riskScale` | Rows: Note, Issuer, Amount, Indicative price, Term, Coupon, Barrier, Cash reserved. Alert warning: "You can lose some or all of your money if the index falls below the barrier." | "Request {amount}" |
| `documents` | Read before you continue | `documentViewer` | Term sheet and key document, both | "Continue" |
| `consent` | Confirm | `consent` | "I have read the term sheet. The final price will be confirmed by the bank within 1 hour. I may cancel only before it is confirmed." | |
| `otp` | | Pattern W | | |
| `success` | Request received | `result` | "The bank will confirm the price by {confirmBy}. {amount} is reserved in your account until then." | "Track request" (Orders) |
| `failed` | Not requested | `result` error | "We couldn't send this request. Nothing was reserved." | "Back" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `NOTE_NOT_FOUND` | "We can't find that note." | `choose` | |
| `NOTE_WINDOW_CLOSED` | "This note is no longer open for orders." | `choose` | Choose another |
| `COMPLEXITY_TEST_FAILED` | As above | `test` | Try again |
| `BELOW_MINIMUM` | "The smallest amount is {min}." | `amount` | |
| `SUITABILITY_BLOCKED` | "This note is above the risk your profile allows. It can't be requested." | `choose` | |
| `PROFILE_MISSING` / `PROFILE_EXPIRED` | As `wealth-fund-subscribe` | `choose` | Update profile |
| `INSUFFICIENT_FUNDS` | Standard | `failed` | |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "We didn't get an answer in time. Check Orders before you try again, so you don't reserve cash twice." | `failed` | Check Orders |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`notes` = `bank.wealth.notes.list`; `request` = `bank.wealth.notes.request` (moneyMoving, requiresOtp); `status` = `bank.wealth.notes.status` (polled on the tracker); `acknowledge`; OTP.

#### 6. Permissions, step-up, limits
`wealth.trade`; `otp`; `stepup` at 100,000 USD or more. Only while the note's window is open.

#### 7. Result and links out
Receipt: reference, request id, note, amount reserved, confirm-by. Notification when confirmed: "Your note {name} was confirmed at {price}." or declined: "The bank could not confirm your note. {amount} is back in your account."

#### 8. Acceptance criteria
- AC-1: A client who fails the complexity test cannot continue.
- AC-2: A note above the client's risk limit or after its window cannot be requested.
- AC-3: Cash is reserved when the request is sent, and released if the bank declines.
- AC-4: The client must read both documents, consent and enter a correct code.
- AC-5: Timeout and unavailable reserve nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | One wrong test answer | `COMPLEXITY_TEST_FAILED`; stays |
| T-2 | AC-2 | profile 2; note SRI 5 | `SUITABILITY_BLOCKED` |
| T-3 | AC-2 | Clock after window | `NOTE_WINDOW_CLOSED` |
| T-4 | AC-3 | Request 50,000; bank declines (sandbox flag) | Reserved then released; `expectBank` cash back |
| T-5 | AC-4 | | Three wrong codes; nothing reserved |
| T-6 | AC-5 | `timeout: ["bank.wealth.notes.request"]` | Timeout copy; cash unchanged |
| T-7 | AC-5 | `unavailable: ["bank.wealth.notes.list"]` | Unavailable on `choose` |

#### 10. Expected mutation-check survivors
None expected.

---

### ★ Wealth statements — `wealth-statement`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-statement` |
| Purpose | Get a statement for a portfolio and a period, as PDF or CSV; also opens contract notes and key documents from the list |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned). Sibling of `account-statement` (Release 1) |
| Channels | Web (download), mobile (share sheet) |
| Who | `wealth.documents` |

#### 2. Entry points
Wealth › Documents › Request a statement; Portfolio detail › Statements (passes `{portfolioId}`).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `choose` | Statement | `select` (portfolio), `datePicker` range, `select` chips (Last month, Last quarter, Year to date, Custom), `select` chips (PDF, CSV) | Portfolio required. Custom: from and to required, to not before from ("The end date must be after the start date."), at most 12 months ("Choose a period of 12 months or less."), not in the future ("You can't choose a future date.") | "Create statement" |
| `ready` | Your statement is ready | `result`, `reviewSummary` | Rows: Portfolio, Period, Format, Size. Text "{{result.sizeKb}} KB" | "Download" (web) / "Share" (mobile), "Open" (`documentViewer`), "Back to Documents" |
| `failed` | Not created | `result` error | "We couldn't create your statement. Nothing was changed." | "Try again" |

Empty period: the statement is created and says "No activity in this period." on page 1.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `PORTFOLIO_NOT_FOUND` | "We can't find that portfolio." | `choose` | |
| `INVALID_PERIOD` | The messages in the field table | `choose` | Change dates |
| `PERIOD_TOO_LONG` | "Choose a period of 12 months or less." | `choose` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |
| `PERMISSION_DENIED` | Standard | Not allowed | Back |

#### 5. Adapters
`portfolios` = `bank.wealth.portfolios.list`; `statement` = `bank.wealth.statement.request`; `document` = `bank.wealth.documents.get`. None moneyMoving, none requiresOtp.

#### 6. Permissions, step-up, limits
`wealth.documents`; level none. A client can create 20 statements a day (`RATE_LIMITED`: "You have created many statements today. Try again tomorrow.").

#### 7. Result and links out
File opens in `documentViewer` or downloads. A copy appears in Wealth › Documents with a notification-free listing. Buttons: Back to Documents.

#### 8. Acceptance criteria
- AC-1: A statement covers exactly the chosen portfolio and period.
- AC-2: A period over 12 months, backwards, or in the future is refused.
- AC-3: PDF and CSV both produce a file with the same totals.
- AC-4: A client sees only their own portfolios.
- AC-5: Timeout and unavailable create no document.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-3 | `elena`, last quarter, both formats | Two documents; same closing value |
| T-2 | AC-2 | | Each invalid period shows its message |
| T-3 | AC-4 | Portfolio id of another client | `PORTFOLIO_NOT_FOUND` |
| T-4 | AC-5 | `timeout: ["bank.wealth.statement.request"]` | Timeout copy; documents unchanged |
| T-5 | AC-5 | `unavailable: ["bank.wealth.portfolios.list"]` | Unavailable message |

#### 10. Expected mutation-check survivors
Cosmetic copy of the empty-period note may survive (no scenario reads it); list it.

---

### ★ Yearly tax report — `wealth-tax-report`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-tax-report` |
| Purpose | Download the yearly report of gains, income, fees and tax withheld, for the client's tax return |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned) |
| Channels | Web, mobile |
| Who | `wealth.documents` |

#### 2. Entry points
Wealth › Documents › Tax report; Wealth overview › attention in January ("Your {year} tax report is ready").

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `year` | Tax report | `select` chips (last 5 years), `alert` | Year required. Alert info: "This report is for information. It uses sandbox figures and is not tax advice." | "Show report" |
| `summary` | Your {year} report | `reviewSummary`, `dataTable`, `alert` | Rows: Realised gains, Income (interest, dividends, coupons), Fees, Tax withheld. Table by portfolio. Alert for the current year: "The year isn't over. These figures are to date." | "Download PDF", "Download CSV", "Back" |
| `failed` | Not available | `result` error | Message by code | "Back" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `YEAR_NOT_AVAILABLE` | "We have no report for {year}." | `year` | Choose a year |
| `REPORT_NOT_READY` | "The {year} report isn't ready yet. It is usually ready by 31 January." | `year` | Back |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |
| `PERMISSION_DENIED` | Standard | Not allowed | Back |

#### 5. Adapters
`report` = `bank.wealth.tax.report`; `document` = `bank.wealth.documents.get`. Not moneyMoving, no OTP.

#### 6. Permissions, step-up, limits
`wealth.documents`. Opening the report for a year other than the last two needs `stepup` (it contains the full history).

#### 7. Result and links out
Download or share. Notification (planned): "Your {year} tax report is ready."

#### 8. Acceptance criteria
- AC-1: The totals equal the sum of the transactions of that year.
- AC-2: A year that has no report, or one not ready, is explained and nothing is shown.
- AC-3: The current year is marked "to date".
- AC-4: Timeout and unavailable show nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `elena`, 2025 | Gains equal the sum of her sandbox sales |
| T-2 | AC-2 | 2019 / 2026 before 31 Jan | `YEAR_NOT_AVAILABLE` / `REPORT_NOT_READY` |
| T-3 | AC-3 | 2026 | Alert shows |
| T-4 | AC-4 | `timeout: ["bank.wealth.tax.report"]` | Timeout copy |
| T-5 | AC-4 | `unavailable: ["bank.wealth.tax.report"]` | Unavailable copy |

#### 10. Expected mutation-check survivors
The step-up for years older than two (section 6) has no criterion; it is expected to survive until AC-5 and a scenario are added. Otherwise none.

---

### ★ Message or call with your adviser — `wealth-contact-adviser`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `wealth-contact-adviser` |
| Purpose | Send the adviser a message, or ask for a call or a meeting at a time |
| Release / workspace / status | 2 / Personal (Wealth) / New (planned). Close to `new-message` (Release 1) with a topic list and times |
| Channels | Web, mobile |
| Who | `wealth.contact` |

#### 2. Entry points
Wealth overview › adviser card (Message, Book a call); proposal screen (Ask a question when expired); Holdings row (Talk about this: passes `{symbol}`).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `form` | Contact {adviser} | `select` chips (Message, Call, Meeting), `select` (topic: My portfolio, A proposal, A product, My profile, Other), `datePicker`, `select` chips (Morning, Afternoon), `textInput` lines 5 | Topic and message required. Message 1 to 1,000 characters. Errors: "Choose a topic." "Write your message." "The message is too long." For Call or Meeting: date required, a working day within 30 days: "Choose a working day in the next 30 days." | "Send request" |
| `success` | Request sent | `result` | "{adviser} will get back to you by {answerBy}." Meta "Ref" | "Back to Wealth" |
| `failed` | Not sent | `result` error | "We couldn't send your request. Nothing was sent." | "Try again" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `MESSAGE_EMPTY` | "Write your message." | `form` | |
| `SLOT_UNAVAILABLE` | "That time isn't free. Choose another." | `form` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was sent." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`profile` = `bank.wealth.profile.get` (adviser name); `request` = `bank.wealth.adviser.request`. Not moneyMoving.

#### 6. Permissions, step-up, limits
`wealth.contact`; level none. Messages are shown in More › secure messages.

#### 7. Result and links out
Notification when answered. Buttons: Back to Wealth.

#### 8. Acceptance criteria
- AC-1: A request without a topic or a message is not sent.
- AC-2: A call or meeting needs a free working day within 30 days.
- AC-3: A sent request appears with a reference and an answer-by time.
- AC-4: Timeout and unavailable send nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | | Both messages appear; nothing sent |
| T-2 | AC-2 | Saturday / day 40 / taken slot | Errors |
| T-3 | AC-3 | | Reference and answer-by shown |
| T-4 | AC-4 | `timeout` and `unavailable` on `bank.wealth.adviser.request` | Messages as above |

#### 10. Expected mutation-check survivors
None expected.

---

## 10. Open questions

1. Where does Wealth sit in the Personal navigation: a segment in Save & Borrow (proposed), a sixth bottom tab, or only a Home widget? A sixth tab does not fit the phone tab bar.
2. Suitability rules are written MiFID-style in plain words. Which real rule set (and which jurisdiction) should the sandbox copy later, and does Cairo Amman Bank or the next customer need a different one?
3. Should `wealth-fx-forward` and `wealth-structured-note` be in Release 2 or move to a later release? Both need a treasury and a product-governance agreement that many banks run outside the app.
4. Discretionary portfolios: should the client see the bank's individual trades or only the model and the result?
5. Settlement: when `TIMEOUT` happens on an order, the sandbox does not apply it (README 1.5). A real bank may have. The copy tells the client to check Orders first. Confirm this is acceptable.
6. Do the existing `invest` and `sell-investment` journeys stay separate from the wealth funds, or merge into one list when the client has `wealth.view`?
7. The one-time code above $10,000 for `invest` (section 2.1) is a proposal. Confirm the figure.
8. Is a statement fee ever charged? The sandbox says no.
