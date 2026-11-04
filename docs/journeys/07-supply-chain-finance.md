# Module 7: Supply Chain Finance

Release 4. Workspace: Business "Graphite". Depth: structure plus planned parts. All people, companies and amounts are synthetic. Brand: BankWorkx®.

## 1. Scope and who uses it

Supply chain finance (SCF) lets a **buyer** (a large company) invite its **suppliers** into a **programme** run by the bank. The supplier sends invoices. The buyer approves them. Once the buyer has approved an invoice, the bank has a promise from the buyer to pay on the due date. The supplier can then ask to be paid **early**, for a small discount. The buyer pays the bank at maturity (the due date).

Two programme types (both in this module):

| Type | Who funds the early payment | Who pays the discount | Priced on |
|---|---|---|---|
| **Reverse factoring** (`reverse_factoring`) | The bank | The supplier (a fee taken from the early payment) | The buyer's credit rating, so it is cheap for the supplier |
| **Dynamic discounting** (`dynamic_discounting`) | The buyer, from its own cash | The buyer keeps the discount | A sliding rate: the earlier the payment, the bigger the discount |

Users (roles are the Business roles in README 4.2, with the new permissions in section 4):

| Person | Company | Uses |
|---|---|---|
| Buyer admin | Alpha Trading LLC (`alpha`, buyer): `ravi` | Creates the programme, sets limits, invites suppliers |
| Buyer maker | Alex Morgan (Maker at Alpha) | Uploads invoices on the buyer's side |
| Buyer approvers | `dana`, `lee` (Alpha) | Approve invoices, approve repayments |
| Supplier maker | `priya` (Beta Services Ltd, `beta`, supplier) | Uploads invoices, requests early payment |
| Supplier admin | `noor` (Beta) | Accepts programme terms |

Alex is Approver at Beta (README 1.7), so the demo shows both sides: at Alpha he starts things, at Beta he approves the early-payment request. Nobody approves what they started (`SELF_APPROVAL`).

### How module 7 differs from module 8 (Factoring)

| | Module 7: Supply Chain Finance | Module 8: Factoring |
|---|---|---|
| Who starts it | The **buyer** (invites suppliers, approves invoices) | The **seller** (applies, assigns its invoices) |
| Who bears the credit risk | The bank bears the **buyer's** risk. The supplier is paid whatever happens to the buyer afterwards | Depends on the facility: **non-recourse** the bank bears the debtor's risk; **recourse** the seller does and must buy invoices back |
| Invoice is financed when | After the buyer has **approved** it (a firm promise to pay) | After the bank has **verified the debtor** (the buyer may not even know about the facility until notified) |
| Who is the bank's customer | Buyer is the sponsor; supplier joins on the buyer's terms | Seller is the customer; the buyer is a third party (the "debtor") |
| Who repays the bank | The buyer, at maturity | The buyer pays the bank directly (collections); the seller only repays on a recourse event |
| Pricing | Buyer's rate | Seller's rate plus service fee |

### Components modules 7 and 8 share

| Shared | Detail |
|---|---|
| Sandbox domain `invoices` (planned) | One invoice record (number, parties, amount, dates, status, file); module 7 adds `approvedAt`, module 8 adds `assignedAt` |
| Sandbox domain `counterparties` (planned) | Buyers and suppliers/debtors with limits and onboarding state |
| Blocks | `fileUpload`, `dataTable`, `statusChip`, `timeline`, `chart`, `datePicker` (README 2.2), plus the new ones in section 5 |
| Maker-checker | `CorporateSandbox` rules (docs/CORPORATE.md): roles, `SELF_APPROVAL`, limits, cut-off, threshold, release re-checks |
| Pricing helper (planned) | `discount = amount x rate x days / 360`, rounded to the currency's decimals |
| Approvals inbox | `approve-payments` gets new item kinds (see README changes needed) |

## 2. Release and what exists today

Release 4 (after Release 3, trade finance and liquidity).

**Exists in code today** (reused, not changed):
- `CorporateSandbox` in `packages/mock-bank-api/src/corporate.ts`: companies, users with roles, daily limits, whitelist, approval threshold (`dualApprovalAbove`), cut-off, holidays, `SELF_APPROVAL`, `ALREADY_APPROVED`, release re-check.
- Adapters `corp.company.get`, `corp.payments.initiate`, `.approve`, `.reject`, `.withdraw`, `.pending`, `.get`, `corp.bulk.check`, `corp.bulk.submit` (a pasted file is checked row by row, then submitted as one payment).
- `bank.otp.send` / `bank.otp.verify` (OTP failures are counted only for an integration named `otpVerify`).
- The journey `authorisation` field (`role`, `rolesFrom`, `deniedScreen`), `ctx.error`, `textInput` with `lines`, `result`, `consent`, `otp`, `reviewSummary`.

**Does not exist** (all planned): any invoice, supplier-programme or financing domain; file upload; tables; charts; session permissions. Everything below marked (planned) needs them.

## 3. Sandbox domains needed (planned)

| Domain | Contents |
|---|---|
| `invoices` | `Invoice { id, number, buyerId, supplierId, programmeId, currency, amount, issueDate, dueDate, status, fileName, uploadedBy, approvedBy?, disputeReason? }`. Status: `submitted`, `approved`, `rejected`, `disputed`, `financed`, `paid`, `overdue` |
| `scf` (programmes) | `Programme { id, buyerId, name, type, currency, limit, usedLimit, baseRate, margin, tenorMaxDays, status }`; `ProgrammeSupplier { programmeId, supplierId, state, termsVersion, supplierLimit, usedLimit }` (state: `invited`, `accepted`, `active`, `suspended`) |
| `scf.financing` | `Financing { id, invoiceId, mode, requestedBy, approvedBy?, grossAmount, discount, netAmount, rate, days, fundedAt?, maturityDate, repaidAt? }` |
| `scf.offers` | `Offer { id, invoiceId, ratePerYear, validUntil, state }` for dynamic discounting |
| `scf.ledger` | Programme limit use and release; funding and repayment entries; the buyer's repayment obligation per day |
| `conditions` | The sandbox conditions of README 1.5, applied to all adapters in section 4 |

Seed (planned): programme "Alpha Supplier Programme" `prog_alpha`, USD, limit 5,000,000, base rate 4.00 % + margin 2.00 % (6.00 % a year), longest term 120 days. Active suppliers: Beta Services Ltd (limit 1,000,000), Crescent Textiles Co. (limit 800,000). Invoices: `INV-1042` Beta to Alpha, USD 120,000.00, issued 2 Nov 2026, due 31 Dec 2026, approved. `INV-1043` Beta, USD 50,000.00, submitted (waiting for the buyer). `INV-0990` Crescent, USD 75,000.00, due 1 Dec 2026, approved. Suspended supplier: Indus Logistics Ltd. Company daily limit and cut-off as docs/CORPORATE.md.

## 4. New permissions

Prefix `biz.` as README 4.2. These add to the README table.

| Permission | Allows | Typical role |
|---|---|---|
| `biz.scf.view` | See the Supply chain section | Maker, Approver, Admin |
| `biz.scf.programme.manage` | Create a programme, change limits and rates | Admin (buyer) |
| `biz.scf.suppliers.manage` | Invite, suspend and reinstate suppliers | Admin (buyer) |
| `biz.scf.terms.accept` | Accept programme terms for the company | Admin (supplier) |
| `biz.invoices.upload` | Upload invoices | Maker (buyer or supplier) |
| `biz.invoices.approve` | Approve or reject an invoice as the buyer | Approver (buyer) |
| `biz.scf.finance.request` | Ask for early payment | Maker (supplier) |
| `biz.scf.offers.manage` | Make dynamic discounting offers | Maker (buyer) |
| `biz.scf.repay` | Start the repayment at maturity | Maker (buyer) |

Approvals of financing requests and repayments use `biz.approvals.approve` (existing) and the same four-eyes and limit rules. Step-up levels (README 4.3): `otp` for upload, request and repay; `stepup` for creating a programme, changing limits and suspending a supplier.

## 5. New adapters (planned)

All Business adapters take the acting user from the active context (README 2.3) and answer `PERMISSION_DENIED` for another `userId`. Every adapter can also answer `TIMEOUT` and `SERVICE_UNAVAILABLE` (README 1.5, 1.6). "Money" is `moneyMoving`; "OTP" is `requiresOtp`.

| Adapter (planned) | Request | Response | Errors | Money | OTP |
|---|---|---|---|---|---|
| `corp.scf.programmes.list` | `{}` | `{programmes[]}` with limit, used, rate | none | no | no |
| `corp.scf.programme.get` | `{programmeId}` | programme, suppliers, utilisation | `PROGRAMME_NOT_FOUND` | no | no |
| `corp.scf.programme.create` | `{name, type, currency, limit, baseRate, margin, tenorMaxDays}` | `{programmeId, status:"active"}` | `LIMIT_INVALID`, `RATE_INVALID`, `CURRENCY_NOT_SUPPORTED`, `PERMISSION_DENIED` | no | yes |
| `corp.scf.programme.setLimit` | `{programmeId, limit}` | `{limit, usedLimit}` | `LIMIT_BELOW_USED`, `LIMIT_INVALID`, `PROGRAMME_NOT_FOUND` | no | yes |
| `corp.scf.suppliers.invite` | `{programmeId, name, email, supplierLimit}` | `{inviteId, state:"invited"}` | `SUPPLIER_ALREADY_IN_PROGRAMME`, `SUPPLIER_LIMIT_ABOVE_PROGRAMME`, `EMAIL_INVALID` | no | no |
| `corp.scf.suppliers.setState` | `{programmeId, supplierId, state:"suspended"\|"active"}` | `{state}` | `SUPPLIER_NOT_FOUND`, `OPEN_FINANCING` | no | yes |
| `corp.scf.terms.get` / `.accept` | `{programmeId}` / `{programmeId, termsVersion, accountId, signature}` | terms text, version / `{state:"active"}` | `TERMS_VERSION_CHANGED`, `ACCOUNT_NOT_FOUND`, `NOT_INVITED` | no | yes |
| `corp.invoices.check` | `{programmeId, rows[]}` (parsed CSV) | per row `{ok, code, message}`, totals | `NO_ROWS`, `TOO_MANY_ROWS` (max 200) and row codes below | no | no |
| `corp.invoices.submit` | `{programmeId, rows[]}` | `{invoiceIds[], count, total}` | `SUPPLIER_NOT_ACTIVE`, `PROGRAMME_LIMIT_EXCEEDED` | no | yes |
| `corp.invoices.decide` | `{invoiceId, decision:"approve"\|"reject", reason?}` | `{status}` | `INVOICE_NOT_FOUND`, `INVOICE_NOT_SUBMITTED`, `SELF_APPROVAL`, `NOT_AUTHORISED`, `REASON_REQUIRED` | no | yes (approve) |
| `corp.scf.quote` | `{invoiceId, payDate?}` | `{gross, discount, net, rate, days, maturityDate}` | `INVOICE_NOT_APPROVED`, `ALREADY_FINANCED`, `PAY_DATE_INVALID` | no | no |
| `corp.scf.finance.request` | `{invoiceId, accountId, payDate?}` | `{financingId, status:"pending_approval", net}` | the quote errors plus `SUPPLIER_LIMIT_EXCEEDED`, `PROGRAMME_LIMIT_EXCEEDED`, `ACCOUNT_NOT_FOUND`, `CURRENCY_NOT_SUPPORTED`, `OFFER_EXPIRED` | yes (when released) | yes |
| `corp.scf.finance.decide` | `{financingId, decision}` | `{status:"funded"\|"pending_approval"\|"rejected", fundedAt?}` | `FINANCING_NOT_PENDING`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `NOT_AUTHORISED`, `LIMIT_COMPANY_EXCEEDED`, (a payment after the cut-off is not an error: the value date moves) | yes | yes |
| `corp.scf.offer.create` | `{invoiceIds[], ratePerYear, validUntil}` | `{offerIds[]}` | `RATE_INVALID`, `INVOICE_NOT_APPROVED`, `VALID_UNTIL_INVALID`, `BUYER_FUNDS_INSUFFICIENT` | no | yes |
| `corp.scf.offer.respond` | `{offerId, decision}` | `{financingId?}` | `OFFER_EXPIRED`, `OFFER_NOT_FOUND` | yes (accept) | yes |
| `corp.scf.repayments.due` | `{programmeId?, from?, to?}` | `{items[] {financingId, invoiceNumber, amount, maturityDate, status}}` | none | no | no |
| `corp.scf.repay` | `{financingIds[], accountId}` | `{paymentId, status:"pending_approval", total}` | `NOTHING_DUE`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `CURRENCY_NOT_SUPPORTED` | yes | yes |
| `corp.invoices.dispute` | `{invoiceId, reason, note}` | `{status:"disputed"}` | `INVOICE_NOT_FOUND`, `ALREADY_FINANCED` | no | no |
| `corp.invoices.list` | `{role, status[], from?, to?, search?, page}` | `{rows[], total}` | none | no | no |

Row codes returned by `corp.invoices.check` (planned): `DUPLICATE_INVOICE` (same supplier and number), `SUPPLIER_NOT_IN_PROGRAMME`, `INVALID_AMOUNT`, `DUE_DATE_PAST`, `TERM_TOO_LONG` (longer than the programme's longest term), `CURRENCY_NOT_SUPPORTED`.

New messages (used in the journeys below; others use the standard rows of README 1.6):

| Code | Message the person sees |
|---|---|
| `PROGRAMME_LIMIT_EXCEEDED` | "This is above the programme limit. {remaining} is left. Nothing was changed." |
| `SUPPLIER_LIMIT_EXCEEDED` | "This is above {supplier}'s limit. {remaining} is left. Nothing was changed." |
| `INVOICE_NOT_APPROVED` | "{buyer} hasn't approved this invoice yet. You can ask for early payment once it is approved." |
| `ALREADY_FINANCED` | "This invoice has already been paid early." |
| `OFFER_EXPIRED` | "This offer ended on {date}. Ask {buyer} for a new one." |
| `LIMIT_BELOW_USED` | "The limit can't be below what is already in use ({used})." |
| `SELF_APPROVAL` | "You can't approve something you started." (existing wording, docs/CORPORATE.md) |

## 6. New components (planned, beyond README 2.2)

| Component | Used for |
|---|---|
| `fileUpload` (README batch B) | Invoice CSV and PDF. Options: `accept: [".csv",".pdf"]`, `maxBytes: 5242880`, `maxFiles: 1` for CSV and 20 for PDFs, `status: ready/uploading/failed` |
| `dataTable` (batch A) | Invoice and financing lists |
| `statusChip` (batch A) | Invoice status colours. Mapping: submitted (grey), approved (blue), rejected (red), disputed (amber), financed (green), paid (green, tick), overdue (red) |
| `timeline` (batch A) | Financing history: requested, approved, funded, due, repaid |
| `chart` (batch A) | Programme utilisation donut; maturity ladder bar chart |
| `moneyBreakdown` (planned new) | A fixed list "Invoice, Discount, You receive" with an optional rate and days line. Pure display, built on `reviewSummary` if that is enough |
| `rateSlider` (planned new, optional) | Choose a payment date between today and maturity; shows the discount as it moves. May be a `datePicker` plus a live `reviewSummary` if a slider is too much |
| `documentViewer` (batch B) | Programme terms the supplier must read to the end |
| `signature` (batch B) | Accepting programme terms |

## 7. Information architecture

New Business section **Finance › Supply chain** (README changes needed: a "Finance" tab, shared with modules 5, 6 and 8; shown when the context holds `biz.scf.view`). Same section for buyer and supplier; widgets differ by the company's role in the programme. Web path prefix `/business/{company}/finance/supply-chain`; mobile stack "Supply chain".

### Shell: Programme overview (buyer)
- **Purpose**: see how the programme is used. **Route**: `/overview`, mobile "Supply chain". **Data**: view-model `scfOverview` (planned) from `corp.scf.programmes.list` and `corp.scf.repayments.due`.
- **Widgets**: (1) Utilisation donut `chart`: used / limit; label "USD 1,250,000 of 5,000,000 used". (2) Four tiles: Active suppliers, Invoices awaiting your approval, Early payments this month, Repayments due in 7 days. (3) Maturity ladder bar chart: next 12 weeks, repayment total per week. (4) "Needs your action" list: up to 5 rows (invoice awaiting approval, repayment due) with a button each.
- **Empty**: "No programme yet." button "Create a programme" (`create-scf-programme`, needs `biz.scf.programme.manage`). **Loading**: skeleton tiles. **Error**: "We couldn't load your programme. Nothing was changed." button "Try again".
- **Drill-downs**: tile to the matching list; ladder bar to Repayments filtered to that week.
- **Launch points**: "Edit limit" (`change-programme-limit`), "Invite a supplier" (`invite-supplier`), "Make an offer" (`dynamic-discount-offer`).

### Shell: Suppliers
- **Route**: `/suppliers`. **Data**: `scfSuppliers` (planned). **Columns**: Supplier, State (`statusChip`), Limit, Used, Available, Invited on, Actions menu. **Filters**: State (all, invited, active, suspended), search by name. **Sort**: Used (high to low) default; any column. **Empty**: "No suppliers yet. Invite your first supplier." button "Invite a supplier". **Row tap**: supplier detail with their invoices and limit bar.
- **Launch points**: Invite (`invite-supplier`); row menu Suspend or Reinstate (`suspend-supplier`).

### Shell: Invoices
- **Route**: `/invoices`. **Data**: `scfInvoices` from `corp.invoices.list`. **Columns**: Invoice no., Counterparty, Amount, Issue date, Due date, Status (`statusChip`), Early payment (Not requested / Offer open / Paid early on {date}), Actions. **Filters**: Status (multi), date range (`datePicker`, due date), amount range, search. **Sort**: Due date ascending default. Bulk select: buyer's approver can select `submitted` rows and press "Approve selected" (opens `approve-invoices`). **Empty**: "No invoices match. Clear filters" / for none at all: supplier "Upload your first invoice", buyer "Suppliers haven't sent invoices yet." **Row tap**: invoice detail with `timeline` and the file.
- **Launch points**: "Upload invoices" (`upload-invoices`), "Approve" (`approve-invoices`), "Get paid early" (`request-early-payment`), "Dispute" (`dispute-invoice`).

### Shell: Financing and repayments
- **Route**: `/financing`. **Columns**: Reference, Invoice, Net paid, Discount, Rate, Funded on, Maturity, Status (`statusChip`: pending approval, funded, due, repaid, late). **Filters**: status, maturity range. **Sort**: Maturity ascending. **Row tap**: detail with `timeline`. Buyer sees a "Repay" button on due rows (`repay-at-maturity`). **Empty**: "No early payments yet."

### Shell: Terms and reports
Programme terms (read-only text, version, accepted-by list). "Download programme report" opens `programme-report` is out of scope; a plain shell export (CSV) of the invoices and financing tables.

## 8. Journey index

| # | Slug | Name | Who | Money | Permission |
|---|---|---|---|---|---|
| 1 | `create-scf-programme` ★ | Create a programme | Buyer admin | No | `biz.scf.programme.manage` |
| 2 | `invite-supplier` ★ | Invite a supplier | Buyer admin | No | `biz.scf.suppliers.manage` |
| 3 | `join-programme` ★ | Join a programme (supplier onboarding) | Supplier admin | No | `biz.scf.terms.accept` |
| 4 | `upload-invoices` ★ | Upload invoices | Buyer or supplier maker | No | `biz.invoices.upload` |
| 5 | `approve-invoices` ★ | Approve invoices (buyer) | Buyer approver | No | `biz.invoices.approve` |
| 6 | `request-early-payment` ★ | Get paid early | Supplier maker | Yes | `biz.scf.finance.request` |
| 7 | `dynamic-discount-offer` ★ | Offer early payment (dynamic discounting) | Buyer maker | Yes (on acceptance) | `biz.scf.offers.manage` |
| 8 | `repay-at-maturity` ★ | Repay at maturity | Buyer maker | Yes | `biz.scf.repay` |
| 9 | `change-programme-limit` ★ | Change programme and supplier limits | Buyer admin | No | `biz.scf.programme.manage` |
| 10 | `dispute-invoice` ★ | Dispute an invoice | Buyer approver or supplier | No | `biz.invoices.approve` (buyer) / `biz.invoices.upload` (supplier) |
| 11 | `suspend-supplier` ★ | Suspend or reinstate a supplier | Buyer admin | No | `biz.scf.suppliers.manage` |

11 journeys. `approve-invoices` also handles batch selection. Financing and repayment approvals (step 2 of maker-checker) go through the existing approvals inbox, not through separate journeys.

Link map additions (README changes needed, section 5.3):

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Finance › Supply chain › overview | Create a programme | `create-scf-programme` | – | `biz.scf.programme.manage` |
| Finance › Supply chain › suppliers | Invite a supplier | `invite-supplier` | `{programmeId}` | `biz.scf.suppliers.manage` |
| Finance › Supply chain › suppliers › row | Suspend / Reinstate | `suspend-supplier` | `{supplierId, action}` | `biz.scf.suppliers.manage` |
| Notification | "{buyer} invited you to a programme" | `join-programme` | `{programmeId}` | `biz.scf.terms.accept` |
| Finance › Supply chain › invoices | Upload invoices | `upload-invoices` | `{programmeId}` | `biz.invoices.upload` |
| Finance › Supply chain › invoices › row | Approve / Select several | `approve-invoices` | `{invoiceId}` or `{invoiceIds}` | `biz.invoices.approve` |
| Finance › Supply chain › invoices › row | Get paid early | `request-early-payment` | `{invoiceId}` | `biz.scf.finance.request` |
| Notification | "Invoice {no} approved. Get paid early" | `request-early-payment` | `{invoiceId}` | `biz.scf.finance.request` |
| Finance › Supply chain › invoices › row | Dispute | `dispute-invoice` | `{invoiceId}` | see index |
| Finance › Supply chain › overview | Make an offer | `dynamic-discount-offer` | `{invoiceIds}` | `biz.scf.offers.manage` |
| Notification (supplier) | "{buyer} offers early payment" | `request-early-payment` | `{offerId}` | `biz.scf.finance.request` |
| Finance › Supply chain › financing › row | Repay | `repay-at-maturity` | `{financingIds}` | `biz.scf.repay` |
| Notification (buyer) | "Repayment due {date}" | `repay-at-maturity` | `{financingIds}` | `biz.scf.repay` |
| Finance › Supply chain › overview | Edit limit | `change-programme-limit` | `{programmeId, supplierId?}` | `biz.scf.programme.manage` |

Common to all journeys below: standard messages S-`TIMEOUT`, S-`SERVICE_UNAVAILABLE`, S-`PERMISSION_DENIED`, S-`OTP_INVALID`, S-`OTP_REQUIRED`, S-`STEP_UP_REQUIRED`, S-`SESSION_EXPIRED` (README 1.6). Each journey says `workspace: "business"`, `channels: ["web","mobile"]`, `locale.supported: ["en"]`, `apps: ["bankworkx"]`. Money-moving journeys follow the order review, consent (`mustBeTrue`), one-time code (6 digits, 3 attempts, resend after 30 s), result.

---

## 9. Journeys

### ★ Create a programme — `create-scf-programme`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `create-scf-programme`: set up a supplier programme: type, currency, limit, pricing |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / form wizard, 3 steps, then consent and OTP |
| Who | `biz.scf.programme.manage`; step-up `stepup` |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Finance › Supply chain › overview (empty) | Create a programme | – | `biz.scf.programme.manage` |

#### 3. Screens
**`basics` "Programme basics"**: stepper 1 of 3.

| Field | Block | Required | Rule | Error |
|---|---|---|---|---|
| Programme name | `textInput` | yes | 3–60 characters | "Enter a name of 3 to 60 characters." |
| Type | `select` tiles: "Bank-funded (reverse factoring)", "Buyer-funded (dynamic discounting)" | yes | one of two | "Choose a programme type." |
| Currency | `select` | yes | one company currency | "Choose a currency." |

Helper under Type: "In a bank-funded programme the bank pays your suppliers early and you repay the bank on the due date. In a buyer-funded programme you pay early from your own cash and keep the discount."

**`limits` "Limit and pricing"**: Programme limit (`amountInput`, required, 100,000 to 50,000,000: "Enter a limit between USD 100,000.00 and USD 50,000,000.00."); Longest term (`select` chips 30, 60, 90, 120, 180 days, default 120); Base rate (`textInput` pattern `^\d{1,2}(\.\d{1,2})?$`, 0.50 to 20.00: "Enter a rate between 0.50 and 20.00."); Margin (same rule, 0 to 10). Alert (info): "Suppliers pay the base rate plus the margin a year, for the days between early payment and the due date." Hidden for buyer-funded programmes: rate fields are replaced by "Maximum annual discount" (default 12.00).

**`review` "Review programme"**: `reviewSummary` rows: Name, Type, Currency, Limit, Longest term, Rate (base + margin = total). Button "Continue" to `consent`.

**`consent`**: `consent` text "I confirm {company} wants to open this programme and that these limits and rates are right." `mustBeTrue`. Button "Create programme". **`otp`**: `otp` block. **`done`**: `result` "Programme created". Reference = programme id.

States: submit button shows spinner; after 10 s the timeout state; `result` error variants below.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `LIMIT_INVALID` | "Enter a limit between USD 100,000.00 and USD 50,000,000.00." | `limits` | Change limit |
| `RATE_INVALID` | "Enter a rate between 0.50 and 20.00." | `limits` | Change rate |
| `CURRENCY_NOT_SUPPORTED` | "Programmes in {currency} aren't available yet. Choose another currency." | `basics` | Change currency |
| `PERMISSION_DENIED` | S-`PERMISSION_DENIED` | denied screen | Back |
| `STEP_UP_REQUIRED` | S-`STEP_UP_REQUIRED` | step-up sheet | Confirm |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | review | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | review | Try again |

#### 5. Adapters
`createProgramme` -> `corp.scf.programme.create` (planned). `otpSend` -> `bank.otp.send`; `otpVerify` -> `bank.otp.verify` (existing).

#### 6. Permissions, step-up, limits
`biz.scf.programme.manage`, `stepup`, then `otp`. Programme limit must not exceed the bank-approved credit line (sandbox: 50,000,000).

#### 7. Result and links out
Result "Programme created. No suppliers yet." Receipt: name, type, currency, limit, rate, reference, date. Notification to company admins "Programme {name} created". Buttons: "Invite a supplier" (`invite-supplier` with `{programmeId}`), "Done" (Supply chain overview).

#### 8. Acceptance criteria
- AC-1 A programme is created only after consent and a correct one-time code.
- AC-2 A limit outside 100,000 to 50,000,000 is refused with the exact message.
- AC-3 A person without `biz.scf.programme.manage` sees the denied screen and nothing is created.
- AC-4 The programme's type, rate and limit on the result match what was reviewed.

#### 9. Scenarios
| T | Covers | Persona / setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-4 | `ravi` (admin, Alpha); valid inputs; code 482100 | Programme exists, active, values equal the review |
| T-2 | AC-1 | `ravi`; three wrong codes | "Too many wrong codes. Start again."; no programme |
| T-3 | AC-2 | `ravi`; limit 99,999 | `limits` shows the message; adapter not called |
| T-4 | AC-3 | Alex (Maker) | Denied screen; no programme |
| T-5 | AC-1 | conditions `timeout:[corp.scf.programme.create]` | Timeout state; no programme (state unchanged) |
| T-6 | AC-1 | conditions `unavailable:[corp.scf.programme.create]` | Unavailable message; no programme |

#### 10. Expected survivors
The rate cross-check (margin above 10) survives: the adapter and the screen both enforce it, so removing one is not seen. The sandbox cannot produce a credit-line refusal below 50,000,000. Others: none expected.

---

### ★ Invite a supplier — `invite-supplier`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `invite-supplier`: invite a supplier into a programme with a starting limit |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / one form, review, result (no OTP: nothing moves; step-up not needed) |
| Who | `biz.scf.suppliers.manage` |

#### 2. Entry points
Finance › Supply chain › suppliers › Invite a supplier (`{programmeId}`); after `create-scf-programme` (`{programmeId}`).

#### 3. Screens
**`details` "Invite a supplier"**

| Field | Block | Required | Rule | Error |
|---|---|---|---|---|
| Supplier name | `textInput` | yes | 2–80 characters | "Enter the supplier's company name." |
| Contact email | `textInput` | yes | pattern email | "Enter a valid email address." |
| Starting limit | `amountInput` | yes | above 0 and at most the programme limit | "Enter a limit up to {programmeLimit}." |
| Message | `textInput` lines 3 | no | up to 300 characters | "Keep the message under 300 characters." |

Helper: "We email an invitation. The supplier reads and accepts the terms before it can use the programme."

**`review`**: `reviewSummary` (supplier, email, limit, programme). Button "Send invitation" calls `inviteSupplier`. **`done`**: `result` "Invitation sent". Reference = invite id.

States: Sending spinner; timeout after 10 s.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `SUPPLIER_ALREADY_IN_PROGRAMME` | "{supplier} is already in this programme." | `details` | Change supplier |
| `SUPPLIER_LIMIT_ABOVE_PROGRAMME` | "A supplier limit can't be above the programme limit of {limit}." | `details` | Change limit |
| `EMAIL_INVALID` | "Enter a valid email address." | `details` | Edit |
| `PROGRAMME_NOT_FOUND` | "We can't find that programme." | `details` | Back |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `review` | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `review` | Try again |

#### 5. Adapters
`inviteSupplier` -> `corp.scf.suppliers.invite` (planned).

#### 6. Permissions, step-up, limits
`biz.scf.suppliers.manage`, `none`. The sum of supplier limits may exceed the programme limit (they share it).

#### 7. Result and links out
Notification to the supplier's admin (`join-programme`). Buttons: "Invite another" (restart), "Done" (suppliers list).

#### 8. Acceptance criteria
- AC-1 An invited supplier shows as `invited` and has no access to financing.
- AC-2 A second invitation to the same supplier is refused.
- AC-3 A starting limit above the programme limit is refused.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `ravi`, new supplier "Delta Fabrics Ltd" | State `invited`; financing attempt on its invoice is refused |
| T-2 | AC-2 | Beta already active | `SUPPLIER_ALREADY_IN_PROGRAMME` message |
| T-3 | AC-3 | limit 6,000,000 | Message with "5,000,000.00" |
| T-4 | AC-1 | `timeout:[corp.scf.suppliers.invite]` | Timeout state; no invitation |
| T-5 | AC-1 | `unavailable:[corp.scf.suppliers.invite]` | Unavailable message; no invitation |

#### 10. Expected survivors
Email pattern check survives: the adapter validates it too. Others none expected.

---

### ★ Join a programme (supplier onboarding) — `join-programme`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `join-programme`: the supplier reads the terms, picks the account that receives money, and signs |
| Release / workspace / status | 4 / Business (supplier company) / new (planned) |
| Channels / pattern | web, mobile / read, choose, sign, OTP, result |
| Who | `biz.scf.terms.accept`; step-up `stepup` |

#### 2. Entry points
Notification "{buyer} invited you to a programme" (`{programmeId}`); Finance › Supply chain (supplier, state "Invited") › Review invitation.

#### 3. Screens
**`terms` "Programme terms"**: `documentViewer` (planned) shows the terms (version `{termsVersion}`). The "Continue" button stays disabled until the end is reached. Alert (info): "Read to the end to continue." Summary box: Buyer, Your starting limit, Rate, Longest term.

**`account` "Where should we pay you?"**: `accountPicker` (required): "Choose the account that receives early payments." Only accounts in the programme currency. Error "Choose an account in {currency}."

**`sign` "Sign"**: `signature` (planned): typed full name must equal the signer's name (`Priya` and so on): "Type your full name exactly as shown: {name}". `consent`: "I accept the programme terms for {supplierCompany}." `mustBeTrue`. **`otp`**. **`done`**: `result` "You're in the programme" with limit.

States: terms loading skeleton; if terms changed while reading: error row `TERMS_VERSION_CHANGED`.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `TERMS_VERSION_CHANGED` | "The terms were updated. Please read the new version." | `terms` | Read again |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `account` | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "Choose an account in {currency}." | `account` | Choose account |
| `NOT_INVITED` | "We can't find an invitation for {company}." | `terms` | Back |
| `OTP_INVALID` | S-`OTP_INVALID` | `otp` | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `sign` | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `sign` | Try again |

#### 5. Adapters
`getTerms` -> `corp.scf.terms.get`; `acceptTerms` -> `corp.scf.terms.accept` (both planned); accounts from `corp.company.get` (existing).

#### 6. Permissions, step-up, limits
`biz.scf.terms.accept` (supplier admin only), `stepup` then `otp`.

#### 7. Result and links out
State becomes `active`. Notification to the buyer admin. Buttons: "Upload an invoice" (`upload-invoices`), "Done".

#### 8. Acceptance criteria
- AC-1 The supplier becomes `active` only after reading the terms, signing and a correct code.
- AC-2 A typed name that does not match is refused.
- AC-3 If terms change, the old acceptance is refused.
- AC-4 A maker without `biz.scf.terms.accept` cannot accept.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `noor`, invited, valid | `active` |
| T-2 | AC-2 | wrong name | Error; still `invited` |
| T-3 | AC-3 | terms bumped to v2 during flow | `TERMS_VERSION_CHANGED` |
| T-4 | AC-4 | `priya` | Denied screen |
| T-5 | AC-1 | `timeout:[corp.scf.terms.accept]` | Timeout; still `invited` |
| T-6 | AC-1 | `unavailable:[corp.scf.terms.accept]` | Unavailable message; still `invited` |

#### 10. Expected survivors
"Read to the end" is a block rule and the sandbox cannot tell whether it was read: the mutation that skips it survives (UI-only rule). Others none expected.

---

### ★ Upload invoices — `upload-invoices`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `upload-invoices`: send invoices to a programme by CSV (many) or PDF (one) |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile (PDF and typed rows only on phone) / upload, check, fix, submit |
| Who | `biz.invoices.upload` (supplier uploads own; buyer uploads on behalf of a supplier) |

#### 2. Entry points
Finance › Supply chain › invoices › Upload invoices (`{programmeId}`); `join-programme` result.

#### 3. Screens
**`choose` "Add invoices"**: `select` rows "Upload a CSV file", "Type or paste rows". CSV columns: `invoice_no,supplier,amount,issue_date,due_date` (supplier column only when the buyer uploads). Link "Download a sample file".

**`file` "Upload file"**: `fileUpload` (planned): CSV up to 5 MB, 200 rows. Errors: "That file is too big. Keep it under 5 MB." / "Upload a .csv file." / "The first row must be: invoice_no, supplier, amount, issue_date, due_date." No file: button disabled. Pasted-rows alternative uses `textInput` with `lines` (as `bulk-payment`).

**`check` "Check your invoices"**: `dataTable` with one row per invoice and a `statusChip` OK or the reason. Summary alert: "{ok} ready, {bad} need attention. Total {total}." Buttons "Submit {ok} invoices" (disabled if 0) and "Fix and upload again" (`file`). Row messages:

| Code | Message |
|---|---|
| `DUPLICATE_INVOICE` | "This invoice number was already sent." |
| `SUPPLIER_NOT_IN_PROGRAMME` | "{supplier} isn't an active supplier in this programme." |
| `INVALID_AMOUNT` | "Enter an amount above 0 with up to 2 decimals." |
| `DUE_DATE_PAST` | "The due date is in the past." |
| `TERM_TOO_LONG` | "The due date is more than {days} days away." |
| `CURRENCY_NOT_SUPPORTED` | "The programme works in {currency}." |

**`consent`**: "I confirm these invoices are genuine and not sold to anyone else." **`otp`**. **`done`**: `result` "{n} invoices sent for approval".

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `NO_ROWS` | "The file has no invoices." | `file` | Choose file |
| `TOO_MANY_ROWS` | "A file can hold up to 200 invoices. This one has {n}." | `file` | Choose file |
| `SUPPLIER_NOT_ACTIVE` | "{supplier} can't send invoices right now." | `check` | Back |
| `PROGRAMME_LIMIT_EXCEEDED` | "This is above the programme limit. {remaining} is left. Nothing was changed." | `check` | Back |
| `TIMEOUT` (check) | "This is taking longer than expected. Nothing was changed." | `check` | Try again |
| `TIMEOUT` (submit) | "Invoices may have been sent. Check Invoices before you try again." | `check` | Check Invoices |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `check` | Try again |

#### 5. Adapters
`checkInvoices` -> `corp.invoices.check`; `submitInvoices` -> `corp.invoices.submit` (both planned).

#### 6. Permissions, step-up, limits
`biz.invoices.upload`, `otp`. File: 5 MB, 200 rows. Only `.csv` and `.pdf`.

#### 7. Result and links out
Invoices `submitted`. Notification to the buyer approvers. Buttons: "View invoices" (Invoices list filtered Submitted), "Upload more" (`choose`), "Done".

#### 8. Acceptance criteria
- AC-1 Only rows that pass the check are submitted; rows that fail are never created.
- AC-2 A repeated invoice number is flagged and not created twice.
- AC-3 A file over 5 MB or not a CSV is refused before checking.
- AC-4 Nothing is submitted without consent and a correct code.
- AC-5 Submitted invoices are `submitted`, not `approved`.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-4, AC-5 | `priya`, 3 good + 1 past-due row | 3 created, status `submitted` |
| T-2 | AC-2 | row `INV-1042` again | Flagged; count unchanged |
| T-3 | AC-3 | 6 MB file; a `.xlsx` | Refused with messages |
| T-4 | AC-4 | wrong code x3 | No invoices created |
| T-5 | AC-1 | `timeout:[corp.invoices.submit]` | Check-Invoices message; none created |
| T-6 | AC-1 | `unavailable:[corp.invoices.submit]` | Unavailable; none created |

#### 10. Expected survivors
File size and type checks survive if the sandbox `fileUpload` stub does not carry real bytes; they are covered by the block's own tests. Others none expected.

---

### ★ Approve invoices (buyer) — `approve-invoices`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `approve-invoices`: the buyer confirms it will pay an invoice on the due date |
| Release / workspace / status | 4 / Business (buyer) / new (planned) |
| Channels / pattern | web, mobile / list, review, consent, OTP, result; batch select |
| Who | `biz.invoices.approve`; not the person who uploaded (`SELF_APPROVAL`) |

#### 2. Entry points
Finance › Supply chain › invoices › row Approve / Select several (`{invoiceId}` or `{invoiceIds}`); Overview › "Needs your action".

#### 3. Screens
**`list` "Invoices waiting for you"**: `dataTable` selectable; columns Invoice no., Supplier, Amount, Due date, Uploaded by. Empty: "No invoices are waiting for your approval." **`review`**: `reviewSummary` for one (or "{n} invoices, total {total}") and `documentViewer` link to the PDF. Radio `select`: Approve / Reject. If Reject: `textInput` required, 5–200 characters, "Tell the supplier why (5 to 200 characters)." **`consent`** (approve only): "I confirm {buyer} will pay {total} on the due dates shown, to the bank." **`otp`**. **`done`**: "Approved" or "Rejected".

Alert on approve (warning): "Once approved, the supplier can be paid early by the bank. You will owe the bank on the due date, even if you later have a dispute with the supplier."

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `SELF_APPROVAL` | "You can't approve something you started." | `review` | Back |
| `NOT_AUTHORISED` | "Your role doesn't allow you to approve." | denied | Back |
| `INVOICE_NOT_SUBMITTED` | "This invoice has already been dealt with." | `list` | Refresh |
| `REASON_REQUIRED` | "Tell the supplier why (5 to 200 characters)." | `review` | Edit |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `review` | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `review` | Try again |

#### 5. Adapters
`listInvoices` -> `corp.invoices.list`; `decideInvoice` -> `corp.invoices.decide` (planned).

#### 6. Permissions, step-up, limits
`biz.invoices.approve`; `otp` for approve, none for reject. Four eyes: not the uploader. Above a threshold set on the programme (sandbox: 500,000 per invoice) two different approvers: the invoice stays `submitted` with "1 of 2 approvals".

#### 7. Result and links out
Approved invoices notify the supplier "Invoice {no} approved. Get paid early". Buttons: "Back to invoices", "Done".

#### 8. Acceptance criteria
- AC-1 Approve needs consent and a correct code.
- AC-2 The uploader cannot approve their own upload.
- AC-3 Reject needs a reason and creates no obligation.
- AC-4 An invoice above the threshold needs two different approvers.
- AC-5 An already decided invoice cannot be decided again.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `dana`, INV-1043 | `approved` |
| T-2 | AC-2 | buyer maker uploads on behalf, same person approves | `SELF_APPROVAL` |
| T-3 | AC-3 | reject without reason / with reason | message / `rejected` |
| T-4 | AC-4 | invoice 600,000; `dana` then `lee` | after `dana` still `submitted`; after `lee` `approved` |
| T-5 | AC-5 | approve twice | `INVOICE_NOT_SUBMITTED` |
| T-6 | AC-1 | `timeout:[corp.invoices.decide]` | Timeout; invoice unchanged |
| T-7 | AC-1 | `unavailable:[corp.invoices.decide]` | Unavailable; unchanged |

#### 10. Expected survivors
Reject skips the consent and OTP by design: the mutant that adds OTP to reject is not a defect. Others none expected.

---

### ★ Get paid early — `request-early-payment`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `request-early-payment`: a supplier asks to be paid an approved invoice before the due date |
| Release / workspace / status | 4 / Business (supplier) / new (planned) |
| Channels / pattern | web, mobile / choose invoices, choose date, quote, consent, OTP, result; goes to approval |
| Who | `biz.scf.finance.request`; approval by a supplier approver (`biz.approvals.approve`) |

#### 2. Entry points
Invoices › row Get paid early (`{invoiceId}`); notifications (`{invoiceId}` or `{offerId}` for dynamic discounting).

#### 3. Screens
**`pick` "Choose invoices"**: `dataTable` selectable, only `approved` and unfinanced, columns Invoice no., Buyer, Amount, Due date, Days to go. Empty: "No invoices are ready. Once your buyer approves an invoice you can get paid early."

**`when` "When do you want the money?"**: `datePicker` (planned). Rule: between the next working day and the due date. Error "Choose a date between {earliest} and {due}." Default: next working day (value date follows the cut-off rule: after 16:00 UTC or on a weekend the next working day). For dynamic discounting offers the date is fixed by the offer. `select` account (`accountPicker`) for the money, required.

**`quote` "Your early payment"**: `reviewSummary`:
Invoice amount, Discount ({rate} a year for {days} days), **You receive**. Example: INV-1042, USD 120,000.00, paid on 3 Nov 2026, due 31 Dec 2026 (58 days), 6.00 %: Discount USD 1,160.00, You receive USD 118,840.00. The quote refreshes when the date changes. Alert (info): "{buyer} pays the bank on {dueDate}. You don't repay anything."

**`consent`**: "I ask {bank} to buy this invoice for {net} and agree to the discount of {discount}." `mustBeTrue`. **`otp`**. **`done`**: `result` "Sent for approval" (reference, value date). Nothing arrives until the approver releases it (maker-checker as `corp.payments.initiate`).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `INVOICE_NOT_APPROVED` | "{buyer} hasn't approved this invoice yet." | `pick` | Choose another |
| `ALREADY_FINANCED` | "This invoice has already been paid early." | `pick` | Choose another |
| `PAY_DATE_INVALID` | "Choose a date between {earliest} and {due}." | `when` | Change date |
| `SUPPLIER_LIMIT_EXCEEDED` / `PROGRAMME_LIMIT_EXCEEDED` | section 5 messages | `quote` | Change invoices |
| `OFFER_EXPIRED` | "This offer ended on {date}. Ask {buyer} for a new one." | `pick` | Back |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `when` | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "Choose an account in {currency}." | `when` | Choose account |
| `TIMEOUT` | "We didn't get an answer in time. Check Early payments before you try again, so you don't ask twice." | `quote` | Check early payments |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `quote` | Try again |

#### 5. Adapters
`getQuote` -> `corp.scf.quote`; `requestFinancing` -> `corp.scf.finance.request` (planned); approval via `corp.scf.finance.decide` (see approvals).

#### 6. Permissions, step-up, limits
`biz.scf.finance.request`, `otp`. Supplier limit and programme limit checked at request and again at release. Discount rounding half-up to 2 decimals. Supplier's person limit does not apply (money comes in).

#### 7. Result and links out
Financing `pending_approval`. Supplier approver notified; on funding the supplier gets "USD 118,840.00 has arrived" and the buyer "{supplier} was paid early. You pay USD 120,000.00 on 31 Dec 2026". Buttons: "Track early payment" (Financing detail), "Go to approvals" (if allowed), "Done". Receipt: invoice, gross, discount, net, rate, days, value date, reference.

#### 8. Acceptance criteria
- AC-1 Only buyer-approved, unfinanced invoices can be financed.
- AC-2 The net amount equals gross minus gross x rate x days / 360.
- AC-3 The request does not move money; release happens only after a different approver approves.
- AC-4 An amount above the supplier or programme limit is refused with the limit shown.
- AC-5 Wrong code three times starts nothing.
- AC-6 A request after the cut-off or on a weekend or 9 Nov 2026 is value-dated the next working day.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-2 | `priya`, INV-1042, now = Tue 3 Nov 2026 10:00, pay 3 Nov | 58 days; discount 1,160.00; net 118,840.00 |
| T-2 | AC-1 | INV-1043 (submitted) | `INVOICE_NOT_APPROVED` |
| T-3 | AC-3 | approve by `priya` herself | `SELF_APPROVAL`; balance unchanged |
| T-4 | AC-3 | `noor` approves | funded, balance +net |
| T-5 | AC-4 | supplier limit 100,000, invoice 120,000 | `SUPPLIER_LIMIT_EXCEEDED` |
| T-6 | AC-5 | 3 wrong codes | no financing |
| T-7 | AC-6 | now = Sat 7 Nov 2026 | value date Tue 10 Nov 2026 (9 Nov closed: 10 Nov) |
| T-8 | AC-3 | `timeout:[corp.scf.finance.request]` | message; no financing |
| T-9 | AC-3 | `unavailable:[corp.scf.finance.request]` | unavailable; no financing |

#### 10. Expected survivors
The rounding direction survives if the seeded amounts divide evenly; add a scenario with 50,000.00 at 12 % for 40 days (666.67) to kill it. Others none expected.

---

### ★ Offer early payment (dynamic discounting) — `dynamic-discount-offer`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `dynamic-discount-offer`: the buyer offers to pay approved invoices early from its own cash, at a sliding discount |
| Release / workspace / status | 4 / Business (buyer) / new (planned) |
| Channels / pattern | web, mobile / choose invoices, set rate and end date, review, consent, OTP, result |
| Who | `biz.scf.offers.manage` |

#### 2. Entry points
Overview › Make an offer (`{invoiceIds}`); Invoices › select approved rows › Offer early payment.

#### 3. Screens
**`pick`**: approved invoices of suppliers in a `dynamic_discounting` programme. **`terms` "Set the offer"**: Annual discount rate (`textInput`, 1.00 to {programme max}, "Enter a rate between 1.00 and {max}."), Offer valid until (`datePicker`, tomorrow to 30 days, "Choose a date up to 30 days from today."). Live preview: "If {supplier} accepts on {date}: pays {net}, you keep {discount}." Alert (info): "The money comes from {account} when the supplier accepts. Check it has enough." **`review`**, **`consent`** ("I offer to pay these invoices early at the rate shown."), **`otp`**, **`done`** "Offer sent".

Buyer funds only when the supplier accepts (`corp.scf.offer.respond`, in `request-early-payment` with `{offerId}`); the payment is a normal corporate payment and passes maker-checker, limits, cut-off.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `RATE_INVALID` | "Enter a rate between 1.00 and {max}." | `terms` | Change rate |
| `VALID_UNTIL_INVALID` | "Choose a date up to 30 days from today." | `terms` | Change date |
| `INVOICE_NOT_APPROVED` | section 5 | `pick` | Choose another |
| `BUYER_FUNDS_INSUFFICIENT` | "{account} has {balance}. The invoices need {total} if all are accepted." | `review` | Change invoices (a warning, not a block) |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard | `review` | Try again |

#### 5. Adapters
`createOffer` -> `corp.scf.offer.create` (planned). Acceptance: `corp.scf.offer.respond` (planned, moneyMoving, requiresOtp).

#### 6. Permissions, step-up, limits
`biz.scf.offers.manage`, `otp`. Money moves on acceptance, not on offer, so the offer itself is not `moneyMoving`.

#### 7. Result and links out
Supplier notified. Offers expire at 23:59 UTC on the end date. Buttons: "View offers" (Invoices filter Offer open), "Done".

#### 8. Acceptance criteria
- AC-1 An offer needs consent and a correct code; no money moves.
- AC-2 A rate outside the allowed range is refused.
- AC-3 An expired offer cannot be accepted.
- AC-4 The discount shown is the discount charged on acceptance.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex (Maker, Alpha), 1 invoice | offer open; Alpha balance unchanged |
| T-2 | AC-2 | rate 0.5 | message |
| T-3 | AC-3 | clock after end date | `OFFER_EXPIRED` |
| T-4 | AC-4 | 50,000.00 at 12.00 %, 40 days | discount 666.67, net 49,333.33 |
| T-5 | AC-1 | `timeout:[corp.scf.offer.create]` | no offer |
| T-6 | AC-1 | `unavailable:[corp.scf.offer.create]` | no offer |

#### 10. Expected survivors
Funds warning survives: it only warns. Others none expected.

---

### ★ Repay at maturity — `repay-at-maturity`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `repay-at-maturity`: the buyer pays the bank the full invoice amounts that have fallen due |
| Release / workspace / status | 4 / Business (buyer) / new (planned) |
| Channels / pattern | web, mobile / choose, review, consent, OTP, result; approval |
| Who | `biz.scf.repay`; approval by a different `biz.approvals.approve` person |

#### 2. Entry points
Financing › row Repay (`{financingIds}`); notification "Repayment due {date}".

#### 3. Screens
**`due` "What's due"**: `dataTable`, selectable, preselected rows due today or overdue. Columns Invoice no., Supplier, Amount, Maturity, Status. Empty: "Nothing is due." **`pay` "Pay from"**: `accountPicker` (company currency). Shows "Available {balance}". **`review`**: rows, Total, Value date. Alert if overdue (warning): "Late repayments may add charges. The programme terms show how much." **`consent`**: "I confirm {buyer} pays {total} to {bank} for these invoices." **`otp`**. **`done`** "Sent for approval".

Repayment is one corporate payment: it counts once against the person's daily limit (`LIMIT_USER_EXCEEDED`), and at release against the company limit (`LIMIT_COMPANY_EXCEEDED`), above the threshold two approvers are needed.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `NOTHING_DUE` | "Nothing is due." | `due` | Back |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Available: {balance}. No money has left your account." | `pay` | Change account |
| `LIMIT_USER_EXCEEDED` | docs/CORPORATE.md wording | `review` | Change selection |
| `LIMIT_COMPANY_EXCEEDED` | docs/CORPORATE.md wording | result | Done |
| `CURRENCY_NOT_SUPPORTED` | docs/CORPORATE.md wording | `pay` | Choose account |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `review` | Check Activity |
| `SERVICE_UNAVAILABLE` | "This service is not available right now. No money has left your account. Please try again in a few minutes." | `review` | Try again |

#### 5. Adapters
`listDue` -> `corp.scf.repayments.due`; `repay` -> `corp.scf.repay` (planned); approval via `corp.payments.approve` (existing, extended for repayments).

#### 6. Permissions, step-up, limits
`biz.scf.repay`, `otp`. Cut-off 16:00 UTC; after it the value date is the next working day and a payment that is value-dated after maturity is flagged late.

#### 7. Result and links out
On release, financings become `repaid`, programme limit is freed. Buyer receipt: total, invoices, value date, reference. Buttons: "Track payment", "Go to approvals", "Done".

#### 8. Acceptance criteria
- AC-1 Repayment moves money only after a different approver approves.
- AC-2 Repaying frees the programme and supplier limits by the amounts repaid.
- AC-3 Insufficient funds are refused and nothing moves.
- AC-4 A repayment made after cut-off is value-dated next working day and marked late if past maturity.
- AC-5 Consent and a correct code are required.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-2, AC-5 | Alex starts; `dana` approves | released; limit used reduced by 120,000 |
| T-2 | AC-1 | Alex tries to approve | `NOT_AUTHORISED` |
| T-3 | AC-3 | balance 1,000 | `INSUFFICIENT_FUNDS` |
| T-4 | AC-4 | now = Thu 31 Dec 2026 16:30 | value date Fri 1 Jan 2027; marked late |
| T-5 | AC-5 | 3 wrong codes | no payment |
| T-6 | AC-1 | `timeout:[corp.scf.repay]` | Check Activity message; no payment |
| T-7 | AC-1 | `unavailable:[corp.scf.repay]` | unavailable; no payment |

#### 10. Expected survivors
Late-flag survives if no scenario reads it: T-4 must check it. Company limit at release is hard to reach in the seed (company limit above total of makers), same as docs/CORPORATE.md: survivor listed.

---

### ★ Change programme and supplier limits — `change-programme-limit`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `change-programme-limit`: raise or lower the programme limit or one supplier's limit |
| Release / workspace / status | 4 / Business (buyer) / new (planned) |
| Channels / pattern | web / form, review, consent, step-up, OTP, result |
| Who | `biz.scf.programme.manage`; `stepup` |

#### 2. Entry points
Overview › Edit limit (`{programmeId}`); Suppliers › row (`{programmeId, supplierId}`).

#### 3. Screens
**`target`**: `select` "Whole programme" / a supplier. **`limit` "New limit"**: shows current limit, used, available. New limit `amountInput`, required. Rule: at least what is used. Error "The limit can't be below what is already in use ({used})." Supplier limit may not exceed the programme limit: "A supplier limit can't be above the programme limit of {limit}." Reason `select` (required): Review, Seasonal, Risk, Other. **`review`**, **`consent`** "I confirm this change.", **`otp`**, **`done`** "Limit changed". Raising the programme limit above the bank credit line (sandbox 50,000,000) is refused.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `LIMIT_BELOW_USED` | section 5 | `limit` | Change limit |
| `LIMIT_INVALID` | "Enter a limit between USD 100,000.00 and USD 50,000,000.00." | `limit` | Change limit |
| `SUPPLIER_LIMIT_ABOVE_PROGRAMME` | see `invite-supplier` | `limit` | Change limit |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `review` | Try again |

#### 5. Adapters
`setLimit` -> `corp.scf.programme.setLimit` (planned, supplier variant `corp.scf.suppliers.setLimit`, planned).

#### 6. Permissions, step-up, limits
`biz.scf.programme.manage`, `stepup` then `otp`. Audit entry written (`biz.audit.view`).

#### 7. Result and links out
Notification to supplier admins when their limit changes. Buttons: "Done" (overview).

#### 8. Acceptance criteria
- AC-1 A limit below the amount in use is refused.
- AC-2 A supplier limit above the programme limit is refused.
- AC-3 A change is applied only after step-up, consent and OTP.
- AC-4 A maker cannot change limits.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | used 1,250,000; set 1,000,000 | message |
| T-2 | AC-2 | Beta to 6,000,000 | message |
| T-3 | AC-3 | `ravi` valid | new limit, audit entry |
| T-4 | AC-4 | Alex | denied |
| T-5 | AC-3 | `timeout:[corp.scf.programme.setLimit]` | limit unchanged |
| T-6 | AC-3 | `unavailable:[corp.scf.programme.setLimit]` | limit unchanged |

#### 10. Expected survivors
None expected.

---

### ★ Dispute an invoice — `dispute-invoice`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `dispute-invoice`: either side flags an invoice as wrong before it is paid early |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / reason, note, optional file, result |
| Who | buyer: `biz.invoices.approve`; supplier: `biz.invoices.upload` |

#### 2. Entry points
Invoices › row Dispute (`{invoiceId}`).

#### 3. Screens
**`reason`**: Reason `select` rows (required): Goods not received, Wrong amount, Wrong price, Duplicate invoice, Other. Note `textInput` lines 4 (required for Other, otherwise optional; 10–500 characters; "Tell us more (10 to 500 characters)."). Evidence `fileUpload` (PDF or image, up to 3 files, 5 MB each, optional). Alert (warning): "A disputed invoice can't be paid early until it is settled." **`confirm`**: `consent` "I confirm the details are true." **`done`** "Dispute raised": invoice becomes `disputed`. No OTP (no money moves). A dispute cannot be raised once the invoice is financed: `ALREADY_FINANCED` "This invoice has already been paid early. Contact support to raise a problem." The bank resolves disputes outside this module (open question).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `INVOICE_NOT_FOUND` | "We can't find that invoice." | `reason` | Back |
| `ALREADY_FINANCED` | as above | `reason` | Contact support |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `confirm` | Try again |

#### 5. Adapters
`disputeInvoice` -> `corp.invoices.dispute` (planned).

#### 6. Permissions, step-up, limits
As summary; step-up `none`.

#### 7. Result and links out
Counterparty notified; invoice status `disputed`; early payment option hidden. Buttons: "View invoice", "Done".

#### 8. Acceptance criteria
- AC-1 A disputed invoice cannot be financed.
- AC-2 A financed invoice cannot be disputed here.
- AC-3 Reason Other needs a note.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `dana` disputes INV-1043 then `priya` requests | refused |
| T-2 | AC-2 | financed INV-0990 | `ALREADY_FINANCED` |
| T-3 | AC-3 | Other, no note | message |
| T-4 | AC-1 | `timeout:[corp.invoices.dispute]` | status unchanged |
| T-5 | AC-1 | `unavailable:[corp.invoices.dispute]` | status unchanged |

#### 10. Expected survivors
Evidence file limits survive (stub upload). Others none expected.

---

### ★ Suspend or reinstate a supplier — `suspend-supplier`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `suspend-supplier`: stop or restart a supplier's new early payments |
| Release / workspace / status | 4 / Business (buyer) / new (planned) |
| Channels / pattern | web / reason, consent, step-up, OTP, result |
| Who | `biz.scf.suppliers.manage`; `stepup` |

#### 2. Entry points
Suppliers › row Suspend / Reinstate (`{supplierId, action}`).

#### 3. Screens
**`reason`**: Reason `select` (required; for suspend only): Credit concern, Dispute, Contract ended, Other; note 10–200 characters required for Other. Summary shows open early payments: "{n} early payments ({amount}) stay as they are and must still be repaid." **`consent`**: "I confirm {supplier} can't ask for new early payments." **`otp`**. **`done`**: "{supplier} suspended". Reinstate skips the reason.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `SUPPLIER_NOT_FOUND` | "We can't find that supplier." | `reason` | Back |
| `OPEN_FINANCING` | informational only for suspend (not an error); for removal: "{n} early payments are still open." | `reason` | Back |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `consent` | Try again |

#### 5. Adapters
`setSupplierState` -> `corp.scf.suppliers.setState` (planned).

#### 6. Permissions, step-up, limits
`biz.scf.suppliers.manage`, `stepup` then `otp`.

#### 7. Result and links out
Supplier notified. Existing approved, unfinanced invoices cannot be financed. Buttons: "Done".

#### 8. Acceptance criteria
- AC-1 A suspended supplier cannot request early payment.
- AC-2 Already funded items are unchanged and still repayable.
- AC-3 Reinstating restores access.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | suspend Beta; `priya` requests | refused with `SUPPLIER_NOT_ACTIVE` |
| T-2 | AC-2 | funded item exists | still due |
| T-3 | AC-3 | reinstate | request works |
| T-4 | AC-1 | `timeout:[corp.scf.suppliers.setState]` | state unchanged |
| T-5 | AC-1 | `unavailable:[corp.scf.suppliers.setState]` | state unchanged |

#### 10. Expected survivors
None expected.

---

## 10. Open questions

1. **Timeout semantics.** In the sandbox a timed-out request is not applied. A real bank may have applied it. For early payment, the copy tells people to check first. Confirm this wording with the bank.
2. **Day count.** The specs use actual days over 360. Some banks use 365. Which does the sample bank use?
3. **Who sees what.** A supplier must not see the buyer's other suppliers. Confirm the sandbox hides them (view-model rules).
4. **Programme types in one programme.** Can one programme offer both reverse factoring and dynamic discounting? These specs assume one type per programme.
5. **Invoice approval threshold.** 500,000 per invoice is an assumption.
6. **Disputes** after financing are handled by the bank outside this module. Is a later `resolve-dispute` journey needed?
7. **Nav.** One "Finance" tab shared by modules 5, 6, 7 and 8, or one tab each? Phone tab bar space is tight.
8. **Daily limit.** Does an early payment count against the supplier's daily limit? Assumed no (money comes in).

## 11. README changes needed (summary)

- 4.2: add the nine `biz.scf.*` and `biz.invoices.*` permissions in section 4.
- 3.3: add "Finance" tab (Supply chain, Factoring, and modules 5 and 6 sections).
- 5.3: add the launch points in section 8.
- `approve-payments`: new item kinds `scf_financing`, `scf_repayment`.
