# Module 8: Factoring

Release 4. Workspace: Business "Graphite". Depth: structure plus planned parts. All people, companies and amounts are synthetic. Brand: BankWorkx®.

## 1. Scope and who uses it

Factoring lets a **seller** turn its unpaid invoices into cash now. The seller **assigns** (sells the right to collect) invoices to the bank. The bank checks the buyer (the **debtor**) is good for the money, pays the seller an **advance** (a share of the invoice, for example 80 %), collects from the debtor on the due date, and then pays the seller the rest (the **reserve**) minus fees and a discount charge.

Two kinds of facility (both in this module):

| Kind | Who bears the risk if the debtor does not pay | What the seller does then |
|---|---|---|
| **Recourse** (`recourse`) | The seller | Buys the invoice back (`repurchase-invoice`) after the recourse period (90 days past due in the sandbox) |
| **Non-recourse** (`non_recourse`) | The bank, if the debtor cannot pay (insolvency or no money). Not if the debtor disputes the invoice | Nothing, for a valid, undisputed invoice within the debtor's approved limit |

Users:

| Person | Company | Uses |
|---|---|---|
| Seller admin | Beta Services Ltd (`beta`, seller): `noor` | Applies for the facility, requests limit changes |
| Seller makers | `priya`, `omar` | Assign invoices, request advances, credit notes, disputes |
| Seller approver | Alex Morgan (Approver at Beta) | Approves advance and reserve requests, repurchases (not his own) |
| Debtor | Alpha Trading LLC (`alpha`): `dana` (approver) | Acknowledges assignments (optional journey, simulated) |

### How module 8 differs from module 7 (Supply Chain Finance)

See the table in module 7 ([07-supply-chain-finance.md](07-supply-chain-finance.md)). In one paragraph: in module 7 the **buyer** starts, invites its suppliers and approves every invoice, and the bank bears the buyer's credit risk. In module 8 the **seller** starts, the buyer is only a third party the bank checks, there is no buyer approval of each invoice, and credit risk depends on recourse or non-recourse.

### Components modules 7 and 8 share

`invoices` and `counterparties` sandbox domains; blocks `fileUpload`, `dataTable`, `statusChip`, `timeline`, `chart`, `datePicker`; the pricing helper (`amount x rate x days / 360`); `CorporateSandbox` maker-checker (roles, `SELF_APPROVAL`, limits, cut-off, threshold); the approvals inbox with new item kinds; the invoice CSV format and row check (`corp.invoices.check` in module 7 is the base; module 8 adds `corp.factoring.assignment.check`). Differences: module 8 has **debtors** and a **reserve**; module 7 has **programmes** and **suppliers**.

## 2. Release and what exists today

Release 4.

**Exists in code today** (reused): `CorporateSandbox` (`packages/mock-bank-api/src/corporate.ts`, docs/CORPORATE.md) with companies, users, roles, whitelist, per-person and company daily limits, threshold approval, cut-off 16:00 UTC, holidays (9 Nov 2026), `SELF_APPROVAL`, `ALREADY_APPROVED`, release re-check; adapters `corp.company.get`, `corp.payments.initiate/approve/reject/withdraw/pending/get`, `corp.bulk.check/submit`, `corp.payroll.check/submit`; `bank.otp.send/verify`; the journey `authorisation` field; `ctx.error`; blocks `textInput` (with `lines`), `reviewSummary`, `consent`, `otp`, `result`.

**Does not exist** (planned): invoices, debtors, facilities, reserves, collections; file upload; tables; charts; session permissions. Everything below depends on module 7's `invoices` domain and the Release 1 identity work (README 2.3).

## 3. Sandbox domains needed (planned)

| Domain | Contents |
|---|---|
| `invoices` (shared) | As in module 7, with `assignedAt`, `debtorId`, `faceAmount`, `creditNotes[]` |
| `counterparties` (shared) | Debtors: `Debtor { id, name, country, state: pending/verified/refused, debtorLimit, usedLimit, acknowledgedAt?, creditNote }` |
| `factoring` | `Facility { id, sellerId, kind, currency, limit, usedLimit, advanceRate, reserveRate, discountRate, serviceFeeRate, recourseDays, status }`; `Advance { id, invoiceId, amount, requestedBy, approvedBy?, status, valueDate }`; `Reserve { invoiceId, held, released }` |
| `factoring.collections` | `Collection { id, invoiceId, amount, receivedOn, direct: boolean }`; a dev-only adapter simulates a debtor payment |
| `factoring.disputes` | `Dispute { id, invoiceId, reason, state }` |
| `conditions` | README 1.5 applied to all adapters in section 5 |

Seed: Facility `FAC-BETA-1` for Beta, USD, recourse, limit 2,000,000, advance rate 80.00 %, reserve 20.00 %, discount rate 9.00 % a year on the advance for the days it is outstanding, service fee 0.50 % of face, recourse period 90 days past due. Debtors: Alpha Trading LLC (verified, limit 1,500,000, used 100,000), Orion Retail Ltd (pending), Vega Foods Ltd (refused). Invoices: `SIN-2001` to Alpha USD 100,000.00 issued 2 Nov 2026 due 18 Dec 2026 (`assigned`, not yet funded), `SIN-2002` to Alpha USD 40,000.00 (`funded`, advance 32,000.00), `SIN-2003` to Orion USD 25,000.00 (`submitted`, waiting for debtor verification).

Worked example (used in the specs): face 100,000.00; advance 80 % = 80,000.00; reserve 20,000.00. Debtor pays on day 45 after funding. Discount = 80,000 x 9 % x 45 / 360 = 900.00. Service fee = 0.50 % x 100,000 = 500.00. Reserve released = 20,000 - 900 - 500 = 18,600.00. Seller receives 80,000 + 18,600 = 98,600.00 in all.

## 4. New permissions

Prefix `biz.` (README 4.2). These add to the README table.

| Permission | Allows | Typical role |
|---|---|---|
| `biz.factoring.view` | See the Factoring section | Maker, Approver, Admin |
| `biz.factoring.apply` | Apply for a facility, request limit changes | Admin |
| `biz.invoices.assign` | Assign (submit) invoices and manage debtors | Maker |
| `biz.factoring.fund` | Request an advance or a reserve release | Maker |
| `biz.factoring.repurchase` | Start a repurchase or pass on a payment | Maker |
| `biz.factoring.dispute` | Raise disputes and credit notes | Maker |
| `biz.factoring.report` | Download facility reports | Maker, Approver, Admin |

Approvals of advances, reserve releases, repurchases and pass-on payments use `biz.approvals.approve` and the same four-eyes rule. `biz.invoices.upload` (module 7) is not used here: seller invoices are assigned, not uploaded to a programme. Step-up (README 4.3): `stepup` for applying and limit requests; `otp` for money steps.

## 5. New adapters (planned)

Every adapter can also answer `TIMEOUT` and `SERVICE_UNAVAILABLE`. Business adapters take the acting user from the active context (README 2.3).

| Adapter (planned) | Request | Response | Errors | Money | OTP |
|---|---|---|---|---|---|
| `corp.factoring.facility.get` | `{}` | facility, utilisation, headroom, reserves held | `NO_FACILITY` | no | no |
| `corp.factoring.facility.apply` | `{kind, requestedLimit, currency, turnover, debtorsCount, accountId, signature}` | `{applicationId, status:"in_review"}` | `LIMIT_INVALID`, `TURNOVER_INVALID`, `FACILITY_EXISTS`, `CURRENCY_NOT_SUPPORTED`, `ACCOUNT_NOT_FOUND` | no | yes |
| `corp.factoring.debtors.add` | `{name, country, registrationNo, contactEmail, requestedLimit}` | `{debtorId, state:"pending"}` | `DEBTOR_EXISTS`, `DEBTOR_IS_SELF`, `COUNTRY_NOT_SUPPORTED`, `EMAIL_INVALID`, `LIMIT_INVALID` | no | no |
| `corp.factoring.debtors.list` | `{state?}` | debtors with limit and use | none | no | no |
| `corp.factoring.assignment.check` | `{rows[]}` (CSV: `invoice_no,debtor,amount,issue_date,due_date`) | per row `{ok, code, message}`, totals | `NO_ROWS`, `TOO_MANY_ROWS` (200) and row codes below | no | no |
| `corp.factoring.assignment.submit` | `{rows[], noticeOfAssignment:true}` | `{invoiceIds[], count, total}` | `NO_FACILITY`, `FACILITY_LIMIT_EXCEEDED`, `DEBTOR_LIMIT_EXCEEDED` | no | yes |
| `corp.factoring.advance.quote` | `{invoiceIds[]}` | per invoice `{face, advance, reserve, discountPerDay, fee}`, totals | `INVOICE_NOT_ELIGIBLE`, `DEBTOR_NOT_VERIFIED`, `INVOICE_DISPUTED`, `HEADROOM_EXCEEDED` | no | no |
| `corp.factoring.advance.request` | `{invoiceIds[], accountId}` | `{advanceId, status:"pending_approval", total}` | quote errors plus `ACCOUNT_NOT_FOUND`, `CURRENCY_NOT_SUPPORTED`, `LIMIT_USER_EXCEEDED` | yes (bank pays seller on release) | yes |
| `corp.factoring.advance.decide` | `{advanceId, decision}` | `{status:"funded"\|"pending_approval"\|"rejected"}` | `ADVANCE_NOT_PENDING`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `NOT_AUTHORISED`, `HEADROOM_EXCEEDED` (re-checked) | yes | yes |
| `corp.factoring.reserve.get` | `{invoiceId?}` | per invoice `{held, fees, discount, releasable}` | none | no | no |
| `corp.factoring.reserve.release` | `{invoiceIds[], accountId}` | `{releaseId, status:"pending_approval", total}` | `RESERVE_NOT_RELEASABLE`, `ACCOUNT_NOT_FOUND` | yes | yes |
| `corp.factoring.repurchase.request` | `{invoiceIds[], accountId}` | `{repurchaseId, status:"pending_approval", total}` | `NOT_RECOURSE`, `RECOURSE_PERIOD_NOT_REACHED`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `ACCOUNT_NOT_FOUND` | yes (seller pays bank) | yes |
| `corp.factoring.passon.request` | `{invoiceId, amount, receivedOn, accountId}` | `{passOnId, status:"pending_approval"}` | `AMOUNT_ABOVE_OUTSTANDING`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `INVOICE_NOT_FOUND` | yes | yes |
| `corp.factoring.creditnote.submit` | `{invoiceId, number, amount, reason}` | `{creditNoteId, newFace, excessAdvance}` | `INVOICE_NOT_FOUND`, `CREDIT_ABOVE_OUTSTANDING`, `DUPLICATE_CREDIT_NOTE`, `INVALID_AMOUNT` | no | yes |
| `corp.factoring.dispute.raise` | `{invoiceId, reason, note}` | `{disputeId, status:"open"}` | `INVOICE_NOT_FOUND`, `DISPUTE_EXISTS`, `INVOICE_CLOSED` | no | no |
| `corp.factoring.limit.request` | `{scope:"facility"\|"debtor", debtorId?, requestedLimit, reason}` | `{requestId, status:"in_review"}` | `LIMIT_INVALID`, `LIMIT_BELOW_USED`, `DEBTOR_NOT_FOUND`, `REQUEST_EXISTS` | no | yes |
| `corp.factoring.report` | `{kind, from, to, format}` | `{fileName, bytes, rows}` | `INVALID_PERIOD`, `NOTHING_TO_REPORT` | no | no |
| `corp.factoring.invoices.list` | `{status[], debtorId?, from?, to?, search?, page}` | rows, total | none | no | no |
| `corp.factoring.simulateCollection` (dev-only) | `{invoiceId, amount, direct?}` | collection recorded | `INVOICE_NOT_FOUND` | sandbox only | no |

Row codes for `corp.factoring.assignment.check`: `DUPLICATE_INVOICE`, `DEBTOR_NOT_VERIFIED` (state pending or refused), `DEBTOR_LIMIT_EXCEEDED`, `INVALID_AMOUNT`, `DUE_DATE_PAST`, `TERM_TOO_LONG` (over 120 days), `CURRENCY_NOT_SUPPORTED`, `ALREADY_ASSIGNED`.

New messages:

| Code | Message the person sees |
|---|---|
| `DEBTOR_NOT_VERIFIED` | "{debtor} hasn't been verified yet. We can fund its invoices once it is." |
| `DEBTOR_LIMIT_EXCEEDED` | "This is above {debtor}'s limit. {remaining} is left. Nothing was changed." |
| `FACILITY_LIMIT_EXCEEDED` | "This is above your facility limit. {remaining} is left. Nothing was changed." |
| `HEADROOM_EXCEEDED` | "You can borrow up to {headroom} against these invoices today. Choose fewer invoices." |
| `INVOICE_DISPUTED` | "This invoice is in dispute and can't be funded until it is settled." |
| `RECOURSE_PERIOD_NOT_REACHED` | "You can buy this invoice back {days} days after the due date. That is {date}." |
| `NOT_RECOURSE` | "This invoice is covered by the bank. You don't need to buy it back." |

## 6. New components (planned, beyond README 2.2)

| Component | Used for |
|---|---|
| `fileUpload` | Invoice CSV; dispute evidence (PDF, image); credit note PDF |
| `dataTable`, `statusChip`, `timeline`, `chart`, `datePicker` | Lists, statuses, history, utilisation and ageing charts, dates |
| `statusChip` mapping (invoices) | assigned (grey), funded (blue), collected (green), overdue (amber), repurchase due (red), disputed (amber), closed (grey tick) |
| `moneyBreakdown` (planned new, shared with module 7) | Fixed list "Face value / Advance / Reserve held / Fees / You receive" |
| `ageingChart` (planned new; a `chart` variant) | Stacked bars by days outstanding: current, 1-30, 31-60, 61-90, 90+ |
| `documentViewer`, `signature` (batch B) | Facility terms and signature on application |

## 7. Information architecture

Business section **Finance › Factoring** (README changes needed: shared Finance tab; shown when the context holds `biz.factoring.view`). Web prefix `/business/{company}/finance/factoring`; mobile stack "Factoring".

### Shell: Facility overview
- **Purpose**: how much can be borrowed today and what is owed. **Data**: `factoringOverview` (planned) from `corp.factoring.facility.get`.
- **Widgets**: (1) Facility gauge: used vs limit ("USD 32,000.00 of 2,000,000.00"). (2) Tiles: Available to borrow (headroom), Invoices waiting for funding, Reserve held, Due in 7 days. (3) `ageingChart` of funded invoices. (4) "Needs your action" list (up to 5): debtor not verified, invoice overdue, repurchase due, dispute open.
- **Empty (no facility)**: "You don't have a factoring facility yet." button "Apply for factoring" (`apply-factoring-facility`). **Loading**: skeleton. **Error**: "We couldn't load your facility. Nothing was changed." "Try again".
- **Launch points**: Assign invoices, Get an advance, Request a limit change.

### Shell: Invoices
- **Route**: `/invoices`. **Data**: `factoringInvoices`. **Columns**: Invoice no., Debtor, Face value, Due date, Status (`statusChip`), Advance, Reserve held, Days outstanding. **Filters**: status (multi), debtor, due-date range, search. **Sort**: Due date ascending. Row selection: "Get advance on {n}" opens `request-advance`. **Empty**: "No invoices yet. Assign your first invoices." button. **Row tap**: detail with `timeline` (assigned, verified, advance requested, funded, collected, reserve released), credit notes, disputes, documents.
- **Launch points**: Assign (`assign-invoices`), Advance (`request-advance`), Credit note (`submit-credit-note`), Dispute (`dispute-factored-invoice`), Buy back (`repurchase-invoice`), Pass on a payment (`pass-on-payment`).

### Shell: Debtors
- **Route**: `/debtors`. **Columns**: Debtor, Country, State (`statusChip`: pending, verified, refused), Limit, Used, Available, Acknowledged on. **Filters**: state, search. **Sort**: Used descending. **Empty**: "No debtors yet. Add the companies you invoice." button "Add a debtor". **Row tap**: debtor detail with invoices, limit bar and "Request a limit change" (`request-limit-change`).
- **Launch points**: Add (`add-debtor`).

### Shell: Collections and reserves
- **Route**: `/collections`. **Columns**: Date, Invoice, Debtor, Amount received, Paid to (bank / direct to you), Fees, Discount, Reserve released. **Filters**: date range, debtor. **Sort**: Date descending. **Empty**: "No payments received yet." **Row tap**: invoice detail. Launch: "Release reserve" (`release-reserve`) when releasable. Banner for direct payments: "This debtor paid you directly. Pass it on to the bank." button `pass-on-payment`.

### Shell: Reports
Download list of past reports; button "New report" (`factoring-report`).

## 8. Journey index

| # | Slug | Name | Who | Money | Permission |
|---|---|---|---|---|---|
| 1 | `apply-factoring-facility` ★ | Apply for factoring | Seller admin | No | `biz.factoring.apply` |
| 2 | `add-debtor` ★ | Add and verify a debtor | Seller maker | No | `biz.invoices.assign` |
| 3 | `assign-invoices` ★ | Assign invoices | Seller maker | No | `biz.invoices.assign` |
| 4 | `request-advance` ★ | Get an advance | Seller maker | Yes (bank pays seller) | `biz.factoring.fund` |
| 5 | `release-reserve` ★ | Release the reserve | Seller maker | Yes (bank pays seller) | `biz.factoring.fund` |
| 6 | `pass-on-payment` ★ | Pass on a payment you received | Seller maker | Yes (seller pays bank) | `biz.factoring.repurchase` |
| 7 | `repurchase-invoice` ★ | Buy back an invoice (recourse) | Seller maker | Yes (seller pays bank) | `biz.factoring.repurchase` |
| 8 | `submit-credit-note` ★ | Report a credit note | Seller maker | No | `biz.factoring.dispute` |
| 9 | `dispute-factored-invoice` ★ | Raise an invoice dispute | Seller maker | No | `biz.factoring.dispute` |
| 10 | `request-limit-change` ★ | Ask for a higher limit | Seller admin | No | `biz.factoring.apply` |
| 11 | `factoring-report` ★ | Download a facility report | Any with `biz.factoring.report` | No | `biz.factoring.report` |
| 12 | `acknowledge-assignment` ★ | Acknowledge a notice of assignment (debtor side, simulated) | Debtor approver | No | `biz.approvals.approve` |

12 journeys. Journey 12 runs in the debtor's company when it is also a BankWorkx® business customer (Alpha); for other debtors the sandbox replies through `corp.factoring.simulateCollection`-style dev tools.

Link map additions (README changes needed, section 5.3):

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Finance › Factoring › overview (empty) | Apply for factoring | `apply-factoring-facility` | – | `biz.factoring.apply` |
| Finance › Factoring › debtors | Add a debtor | `add-debtor` | – | `biz.invoices.assign` |
| Finance › Factoring › debtors › row | Request a limit change | `request-limit-change` | `{debtorId}` | `biz.factoring.apply` |
| Finance › Factoring › overview | Request a limit change | `request-limit-change` | `{scope:"facility"}` | `biz.factoring.apply` |
| Finance › Factoring › invoices | Assign invoices | `assign-invoices` | – | `biz.invoices.assign` |
| Finance › Factoring › invoices › selection | Get advance | `request-advance` | `{invoiceIds}` | `biz.factoring.fund` |
| Notification | "Invoices verified. You can get an advance" | `request-advance` | `{invoiceIds}` | `biz.factoring.fund` |
| Finance › Factoring › collections | Release reserve | `release-reserve` | `{invoiceIds}` | `biz.factoring.fund` |
| Finance › Factoring › collections (banner) | Pass it on | `pass-on-payment` | `{invoiceId, amount}` | `biz.factoring.repurchase` |
| Finance › Factoring › invoices › row (recourse, overdue) | Buy back | `repurchase-invoice` | `{invoiceIds}` | `biz.factoring.repurchase` |
| Finance › Factoring › invoices › row | Credit note | `submit-credit-note` | `{invoiceId}` | `biz.factoring.dispute` |
| Finance › Factoring › invoices › row | Dispute | `dispute-factored-invoice` | `{invoiceId}` | `biz.factoring.dispute` |
| Finance › Factoring › reports | New report | `factoring-report` | – | `biz.factoring.report` |
| Notification (debtor) | "{seller} has assigned invoices to the bank" | `acknowledge-assignment` | `{assignmentId}` | `biz.approvals.approve` |

Common to every journey below: `workspace: "business"`, `channels: ["web","mobile"]`, `locale.supported: ["en"]`, `apps: ["bankworkx"]`; standard messages S-`TIMEOUT`, S-`SERVICE_UNAVAILABLE`, S-`PERMISSION_DENIED`, S-`OTP_INVALID`, S-`OTP_REQUIRED`, S-`STEP_UP_REQUIRED`, S-`SESSION_EXPIRED` (README 1.6). Money-moving journeys use the order review, consent (`mustBeTrue`), one-time code (6 digits, 3 attempts, resend 30 s), result, then the approver step through the approvals inbox.

---

## 9. Journeys

### ★ Apply for factoring — `apply-factoring-facility`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `apply-factoring-facility`: ask the bank for a factoring facility |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / form wizard, 3 steps, terms, signature, OTP |
| Who | `biz.factoring.apply`; `stepup` |

#### 2. Entry points
Finance › Factoring › overview (empty) › Apply for factoring.

#### 3. Screens
**`about` "About your sales"**

| Field | Block | Required | Rule | Error |
|---|---|---|---|---|
| Facility kind | `select` tiles: "Recourse (lower cost, you keep the risk)", "Non-recourse (higher cost, the bank takes the risk)" | yes | one | "Choose a facility kind." |
| Yearly sales to businesses | `amountInput` | yes | 100,000 to 100,000,000 | "Enter yearly sales between USD 100,000.00 and USD 100,000,000.00." |
| Number of regular buyers | `textInput` | yes | whole number 1–500 | "Enter a whole number from 1 to 500." |
| Currency | `select` | yes | one | "Choose a currency." |

**`facility` "What you need"**: Requested limit (`amountInput`, 50,000 to 10,000,000: "Enter a limit between USD 50,000.00 and USD 10,000,000.00."); Account for advances (`accountPicker`, required). Info alert: "The bank sets the final limit and rates after review. Indicative: advance up to 80 %, discount 9.00 % a year, service fee 0.50 %."

**`terms`**: `documentViewer` (read to the end). **`sign`**: `signature` + `consent` "I apply for this facility for {company} and confirm the information is true." **`otp`**. **`done`**: `result` "Application received" with reference; status in review (the sandbox approves it at once for the seed company).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `LIMIT_INVALID` | limit message above | `facility` | Change limit |
| `TURNOVER_INVALID` | sales message above | `about` | Change |
| `FACILITY_EXISTS` | "{company} already has a factoring facility." | `about` | Go to Factoring |
| `CURRENCY_NOT_SUPPORTED` | "Factoring in {currency} isn't available yet." | `about` | Change currency |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `facility` | Choose account |
| `TIMEOUT` / `SERVICE_UNAVAILABLE` | standard non-money wording | `sign` | Try again |

#### 5. Adapters
`applyFacility` -> `corp.factoring.facility.apply` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.apply`, `stepup` then `otp`. Only one facility per company.

#### 7. Result and links out
Notification to company admins. Buttons: "Add a debtor" (`add-debtor`), "Done".

#### 8. Acceptance criteria
- AC-1 An application is accepted only after terms are read, signed and a correct code entered.
- AC-2 A company with a facility cannot apply again.
- AC-3 A limit outside the range is refused.
- AC-4 A maker without the permission cannot apply.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `noor`, company without facility | application `in_review` |
| T-2 | AC-2 | Beta has `FAC-BETA-1` | `FACILITY_EXISTS` |
| T-3 | AC-3 | limit 40,000 | message |
| T-4 | AC-4 | `priya` | denied |
| T-5 | AC-1 | `timeout:[corp.factoring.facility.apply]` | no application |
| T-6 | AC-1 | `unavailable:[corp.factoring.facility.apply]` | no application |

#### 10. Expected survivors
"Read to the end" is a block rule the sandbox cannot see: survives. Others none expected.

---

### ★ Add and verify a debtor — `add-debtor`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `add-debtor`: tell the bank which companies you invoice, so it can check them and set a limit |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / one form, review, result |
| Who | `biz.invoices.assign`; `none` (nothing moves) |

#### 2. Entry points
Debtors › Add a debtor; `assign-invoices` (error `DEBTOR_NOT_VERIFIED`) › Add this debtor, then `returnTo`.

#### 3. Screens
**`details`**

| Field | Block | Required | Rule | Error |
|---|---|---|---|---|
| Company name | `textInput` | yes | 2–80 characters | "Enter the company's name." |
| Country | `select` | yes | supported list | "Choose a country." |
| Registration number | `textInput` | yes | 4–20 letters, numbers, hyphens | "Enter the registration number (4 to 20 characters)." |
| Contact email | `textInput` | yes | email | "Enter a valid email address." |
| Limit you would like | `amountInput` | yes | 10,000 up to the facility limit | "Enter a limit up to {facilityLimit}." |

Helper: "We check the company. This usually takes one working day. The company isn't told until you assign invoices."
**`review`**, **`done`** "Debtor added: waiting for verification". No consent (informational), no OTP. In the sandbox the debtor is verified after the next `corp.factoring.debtors.list` call (Alpha), refused (Vega), or stays pending (Orion), by name.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `DEBTOR_EXISTS` | "{debtor} is already on your list." | `details` | Change |
| `DEBTOR_IS_SELF` | "You can't add your own company." | `details` | Change |
| `COUNTRY_NOT_SUPPORTED` | "We don't buy invoices from companies in {country} yet." | `details` | Change |
| `EMAIL_INVALID` | "Enter a valid email address." | `details` | Edit |
| `LIMIT_INVALID` | "Enter a limit up to {facilityLimit}." | `details` | Edit |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `review` | Try again |

#### 5. Adapters
`addDebtor` -> `corp.factoring.debtors.add` (planned).

#### 6. Permissions, step-up, limits
`biz.invoices.assign`. A refused debtor shows state "Refused" with no reason (the bank does not give reasons); the reason is in open questions.

#### 7. Result and links out
Buttons: "Add another", "Assign invoices" (disabled until verified), "Done".

#### 8. Acceptance criteria
- AC-1 A new debtor starts as `pending`.
- AC-2 The same debtor cannot be added twice.
- AC-3 A company cannot add itself.
- AC-4 Invoices to a pending or refused debtor cannot be assigned.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `priya` adds "Delta Foods Ltd" | `pending` |
| T-2 | AC-2 | Alpha again | `DEBTOR_EXISTS` |
| T-3 | AC-3 | Beta | `DEBTOR_IS_SELF` |
| T-4 | AC-4 | assign invoice to Vega | row `DEBTOR_NOT_VERIFIED` |
| T-5 | AC-1 | `timeout:[corp.factoring.debtors.add]` | none added |
| T-6 | AC-1 | `unavailable:[corp.factoring.debtors.add]` | none added |

#### 10. Expected survivors
Registration-number pattern survives (adapter has no format rule in the first version). Others none expected.

---

### ★ Assign invoices — `assign-invoices`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `assign-invoices`: send invoices to the bank so it can fund them |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile (typed rows) / upload, check, fix, consent, OTP |
| Who | `biz.invoices.assign`; `otp` |

#### 2. Entry points
Invoices › Assign invoices; `add-debtor` result.

#### 3. Screens
**`file`**: `fileUpload` CSV (`invoice_no,debtor,amount,issue_date,due_date`, up to 5 MB, 200 rows) or paste rows (`textInput` with `lines`). Errors as module 7 (`upload-invoices`): "That file is too big. Keep it under 5 MB.", "Upload a .csv file.", header message. Optional PDF per invoice attached later.

**`check`**: `dataTable` rows with `statusChip` OK / reason. Alert: "{ok} ready, {bad} need attention. Total {total}." Row messages:

| Code | Message |
|---|---|
| `DUPLICATE_INVOICE` | "This invoice number was already sent." |
| `ALREADY_ASSIGNED` | "This invoice is already assigned to the bank." |
| `DEBTOR_NOT_VERIFIED` | section 5 message, with link "Add this debtor" (`add-debtor`) |
| `DEBTOR_LIMIT_EXCEEDED` | section 5 message |
| `INVALID_AMOUNT` | "Enter an amount above 0 with up to 2 decimals." |
| `DUE_DATE_PAST` | "The due date is in the past." |
| `TERM_TOO_LONG` | "The due date is more than 120 days away." |
| `CURRENCY_NOT_SUPPORTED` | "Your facility works in {currency}." |

**`consent`**: "I confirm these invoices are genuine, are not sold or pledged to anyone else, and I assign them to {bank}. {Debtor} will be told that payment goes to {bank}." `mustBeTrue`. **`otp`**. **`done`**: `result` "{n} invoices assigned" (status `assigned`; the debtor is notified; funding available once verified, not before).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `NO_ROWS` | "The file has no invoices." | `file` | Choose file |
| `TOO_MANY_ROWS` | "A file can hold up to 200 invoices. This one has {n}." | `file` | Choose file |
| `NO_FACILITY` | "You don't have a factoring facility yet." | `file` | Apply |
| `FACILITY_LIMIT_EXCEEDED` | section 5 | `check` | Back |
| `DEBTOR_LIMIT_EXCEEDED` | section 5 | `check` | Back |
| `TIMEOUT` (submit) | "Invoices may have been assigned. Check Invoices before you try again." | `check` | Check Invoices |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `check` | Try again |

#### 5. Adapters
`checkAssignment` -> `corp.factoring.assignment.check`; `submitAssignment` -> `corp.factoring.assignment.submit` (planned).

#### 6. Permissions, step-up, limits
`biz.invoices.assign`, `otp`. Facility limit counts face value of funded invoices only; debtor limit counts face value of assigned and funded invoices to that debtor.

#### 7. Result and links out
Notices of assignment go to debtors. Buttons: "Get an advance" (`request-advance`), "View invoices", "Done".

#### 8. Acceptance criteria
- AC-1 Only rows that pass the check are assigned.
- AC-2 An invoice to a pending or refused debtor is rejected in the check.
- AC-3 An invoice already assigned cannot be assigned again.
- AC-4 An amount above the debtor limit is refused with the remaining limit.
- AC-5 Consent and a correct code are required.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-5 | `priya`; 2 good rows + 1 for Vega | 2 assigned |
| T-2 | AC-2 | row for Orion | flagged |
| T-3 | AC-3 | `SIN-2001` again | `ALREADY_ASSIGNED` |
| T-4 | AC-4 | Alpha, 1,450,000 | `DEBTOR_LIMIT_EXCEEDED` (1,400,000 left) |
| T-5 | AC-5 | 3 wrong codes | none assigned |
| T-6 | AC-1 | `timeout:[corp.factoring.assignment.submit]` | none assigned |
| T-7 | AC-1 | `unavailable:[corp.factoring.assignment.submit]` | none assigned |

#### 10. Expected survivors
File size and type checks (stub upload). Others none expected.

---

### ★ Get an advance — `request-advance`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `request-advance`: ask the bank to pay a share of assigned invoices now |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / choose, quote, consent, OTP, approval |
| Who | `biz.factoring.fund`; approval by a different `biz.approvals.approve` person |

#### 2. Entry points
Invoices › selected rows › Get advance (`{invoiceIds}`); notification after verification.

#### 3. Screens
**`pick`**: `dataTable`, only `assigned` or `verified` invoices to verified debtors, not disputed. Columns Invoice no., Debtor, Face value, Due date, Advance at 80 %. Empty: "No invoices are ready. Assign invoices to a verified debtor first." **`account`**: `accountPicker` for the money. **`quote`**: `moneyBreakdown`: Face value 100,000.00; Advance (80 %) **80,000.00**; Held in reserve 20,000.00; Service fee 0.50 % (500.00, taken at collection); Discount 9.00 % a year on 80,000.00 (about 20.00 a day, taken at collection). Alert: "The bank collects from {debtor} on {dueDate}. You get the reserve back after fees." For recourse add (warning): "If {debtor} hasn't paid 90 days after the due date you must buy the invoice back." **`consent`**: "I ask {bank} to pay me {total} now for these invoices." **`otp`**. **`done`**: "Sent for approval". Nothing arrives until a different approver approves; value date follows cut-off.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `INVOICE_NOT_ELIGIBLE` | "{no} isn't ready for funding." | `pick` | Choose another |
| `DEBTOR_NOT_VERIFIED` | section 5 | `pick` | Choose another |
| `INVOICE_DISPUTED` | section 5 | `pick` | Choose another |
| `HEADROOM_EXCEEDED` | section 5 | `quote` | Change invoices |
| `LIMIT_USER_EXCEEDED` | docs/CORPORATE.md wording | `quote` | Change invoices |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `account` | Choose account |
| `CURRENCY_NOT_SUPPORTED` | docs/CORPORATE.md wording | `account` | Choose account |
| `TIMEOUT` | "We didn't get an answer in time. Check Advances before you try again, so you don't ask twice." | `quote` | Check Advances |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `quote` | Try again |

#### 5. Adapters
`getQuote` -> `corp.factoring.advance.quote`; `requestAdvance` -> `corp.factoring.advance.request`; approver `corp.factoring.advance.decide` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.fund`, `otp`. Headroom = facility limit - funded advances. Re-checked at release; if it fails the approval does not count and the advance stays pending (same as docs/CORPORATE.md release rule). Above 500,000 two approvers.

#### 7. Result and links out
On release: invoices `funded`, reserve held, seller account credited, notification "USD 80,000.00 has arrived". Receipt: invoices, face, advance, reserve, rates, value date, reference. Buttons: "Track advance", "Go to approvals", "Done".

#### 8. Acceptance criteria
- AC-1 Advance = face x advance rate, reserve = face minus advance.
- AC-2 No money moves before a different approver approves.
- AC-3 Invoices to unverified debtors or in dispute cannot be funded.
- AC-4 An advance above facility headroom is refused, also again at release.
- AC-5 Consent and a correct code are required.
- AC-6 After the cut-off, on a weekend or on 9 Nov 2026 the value date is the next working day.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-5 | `priya`, SIN-2001 | quote 80,000.00 / 20,000.00 |
| T-2 | AC-2 | Alex approves | funded; balance +80,000.00 |
| T-3 | AC-2 | `priya` approves her own | `SELF_APPROVAL`; balance unchanged |
| T-4 | AC-3 | SIN-2003 (Orion) | refused |
| T-5 | AC-4 | headroom 50,000 | `HEADROOM_EXCEEDED`; and a flaw switched on at release keeps it pending |
| T-6 | AC-5 | 3 wrong codes | nothing requested |
| T-7 | AC-6 | now = Sat 7 Nov 2026 | value date Tue 10 Nov 2026 |
| T-8 | AC-2 | `timeout:[corp.factoring.advance.request]` | nothing requested |
| T-9 | AC-2 | `unavailable:[corp.factoring.advance.request]` | nothing requested |

#### 10. Expected survivors
The company-limit re-check at release is hard to reach (facility limit above makers' limits): listed, as in docs/CORPORATE.md. Others none expected.

---

### ★ Release the reserve — `release-reserve`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `release-reserve`: get the rest of the invoice back after the debtor has paid |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / choose, breakdown, consent, OTP, approval |
| Who | `biz.factoring.fund` |

#### 2. Entry points
Collections › Release reserve (`{invoiceIds}`).

#### 3. Screens
**`pick`**: `dataTable` of `collected` invoices with reserve not yet released. Columns Invoice no., Debtor, Collected on, Reserve held, Fees, Discount, You receive. Empty: "No reserves are ready to release." **`review`**: `moneyBreakdown` per the worked example: Reserve held 20,000.00; Discount (45 days) -900.00; Service fee -500.00; **You receive 18,600.00**. **`account`**, **`consent`** "I confirm these amounts.", **`otp`**, **`done`** "Sent for approval".

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `RESERVE_NOT_RELEASABLE` | "{no} can't be released yet. The reserve is paid after {debtor} has paid in full." | `pick` | Choose another |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `account` | Choose account |
| `TIMEOUT` | "We didn't get an answer in time. Check Collections before you try again, so you don't ask twice." | `review` | Check Collections |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `review` | Try again |

#### 5. Adapters
`getReserve` -> `corp.factoring.reserve.get`; `releaseReserve` -> `corp.factoring.reserve.release` (planned); approver via the approvals inbox.

#### 6. Permissions, step-up, limits
`biz.factoring.fund`, `otp`; four eyes. A reserve smaller than fees releases 0.00; any shortfall stays owed (see open questions).

#### 7. Result and links out
Invoice `closed` after payout. Buttons: "View collection", "Done".

#### 8. Acceptance criteria
- AC-1 The amount released equals reserve - discount - fees, to 2 decimals.
- AC-2 A reserve cannot be released before the debtor paid in full.
- AC-3 No money moves before a different approver approves.
- AC-4 The same reserve cannot be released twice.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | SIN-2001 funded 80,000; simulated full collection day 45 | 18,600.00 |
| T-2 | AC-2 | no collection | refused |
| T-3 | AC-3 | maker approves self | `SELF_APPROVAL` |
| T-4 | AC-4 | release twice | `RESERVE_NOT_RELEASABLE` |
| T-5 | AC-3 | `timeout:[corp.factoring.reserve.release]` | none released |
| T-6 | AC-3 | `unavailable:[corp.factoring.reserve.release]` | none released |

#### 10. Expected survivors
None expected if T-1 uses the worked example (it kills sign and rounding mutants).

---

### ★ Pass on a payment you received — `pass-on-payment`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `pass-on-payment`: a debtor paid the seller instead of the bank; the seller sends it on |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / details, consent, OTP, approval |
| Who | `biz.factoring.repurchase` |

#### 2. Entry points
Collections banner › Pass it on (`{invoiceId, amount}`).

#### 3. Screens
**`details`**

| Field | Block | Required | Rule | Error |
|---|---|---|---|---|
| Invoice | `select` | yes | funded invoice | "Choose an invoice." |
| Amount received | `amountInput` | yes | above 0, at most outstanding face | "Enter an amount up to {outstanding}." |
| Date received | `datePicker` | yes | not in the future | "The date can't be in the future." |
| Pay from | `accountPicker` | yes | enough money | "Choose an account." |

Alert (warning): "The money belongs to {bank}. Pass it on within 2 working days." **`consent`** "I confirm {debtor} paid this and I pass it to {bank}." **`otp`**. **`done`**: "Sent for approval".

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `AMOUNT_ABOVE_OUTSTANDING` | "Enter an amount up to {outstanding}." | `details` | Change amount |
| `INVALID_AMOUNT` | "Enter an amount above 0 with up to 2 decimals." | `details` | Change amount |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` | `details` | Change account |
| `INVOICE_NOT_FOUND` | "We can't find that invoice." | `details` | Back |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `details` | Check Activity |
| `SERVICE_UNAVAILABLE` | "This service is not available right now. No money has left your account." | `details` | Try again |

#### 5. Adapters
`passOn` -> `corp.factoring.passon.request` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.repurchase`, `otp`, four eyes, counts against the person's daily limit (`LIMIT_USER_EXCEEDED`).

#### 7. Result and links out
On release the collection is recorded as `direct`, outstanding falls. Buttons: "View collection", "Done".

#### 8. Acceptance criteria
- AC-1 The amount passed on reduces the invoice's outstanding amount.
- AC-2 An amount above outstanding is refused.
- AC-3 Money moves only after a different approver.
- AC-4 Insufficient funds are refused and nothing moves.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1, AC-3 | `priya` 40,000; Alex approves | outstanding 0 |
| T-2 | AC-2 | 41,000 | message |
| T-3 | AC-4 | balance 100 | `INSUFFICIENT_FUNDS` |
| T-4 | AC-3 | `timeout:[corp.factoring.passon.request]` | no payment |
| T-5 | AC-3 | `unavailable:[corp.factoring.passon.request]` | no payment |

#### 10. Expected survivors
Future-date check survives (UI only). Others none expected.

---

### ★ Buy back an invoice (recourse) — `repurchase-invoice`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `repurchase-invoice`: on a recourse facility, buy back an invoice the debtor did not pay |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / choose, breakdown, consent, OTP, approval |
| Who | `biz.factoring.repurchase` |

#### 2. Entry points
Invoices › overdue row (recourse) › Buy back (`{invoiceIds}`); notification "Repurchase due".

#### 3. Screens
**`pick`**: overdue funded invoices beyond the recourse period. Empty: "No invoices need buying back." **`review`**: `moneyBreakdown`: Advance paid 80,000.00; Discount to date (9 % for {days} days); Fees; **You pay**. Example at 135 days (45 + 90): discount 80,000 x 9 % x 135 / 360 = 2,700.00; fee 500.00; you pay 80,000 + 2,700 + 500 = 83,200.00. The reserve of 20,000.00 is paid back to you after the repurchase (`reserve.release`, not part of this payment). Alert (warning): "After you buy this invoice back, you collect from {debtor} yourself." **`account`**, **`consent`**, **`otp`**, **`done`**.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `NOT_RECOURSE` | section 5 | `pick` | Back |
| `RECOURSE_PERIOD_NOT_REACHED` | section 5 | `pick` | Back |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` | `account` | Change account |
| `LIMIT_USER_EXCEEDED` | docs/CORPORATE.md wording | `review` | Change selection |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `review` | Check Activity |
| `SERVICE_UNAVAILABLE` | "This service is not available right now. No money has left your account." | `review` | Try again |

#### 5. Adapters
`requestRepurchase` -> `corp.factoring.repurchase.request` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.repurchase`, `otp`, four eyes, daily limit.

#### 7. Result and links out
On release: invoice `repurchased`, facility headroom freed. Buttons: "Release reserve" (`release-reserve`), "Done".

#### 8. Acceptance criteria
- AC-1 A non-recourse invoice cannot be bought back.
- AC-2 A recourse invoice cannot be bought back before the recourse period ends.
- AC-3 The amount = advance + discount to date + fees.
- AC-4 Money moves only after a different approver.
- AC-5 Insufficient funds refuse and move nothing.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | non-recourse facility variant | `NOT_RECOURSE` |
| T-2 | AC-2 | day 60 | `RECOURSE_PERIOD_NOT_REACHED` |
| T-3 | AC-3, AC-4 | day 135 | 83,200.00 after approval |
| T-4 | AC-5 | balance 1,000 | refused |
| T-5 | AC-4 | `timeout:[corp.factoring.repurchase.request]` | no payment |
| T-6 | AC-4 | `unavailable:[corp.factoring.repurchase.request]` | no payment |

#### 10. Expected survivors
None expected.

---

### ★ Report a credit note — `submit-credit-note`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `submit-credit-note`: tell the bank you reduced an invoice (returned goods, discount) |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / details, evidence, consent, OTP |
| Who | `biz.factoring.dispute`; `otp` |

#### 2. Entry points
Invoices › row › Credit note (`{invoiceId}`).

#### 3. Screens
**`details`**

| Field | Block | Required | Rule | Error |
|---|---|---|---|---|
| Credit note number | `textInput` | yes | 3–30 characters, unique | "Enter the credit note number (3 to 30 characters)." |
| Amount | `amountInput` | yes | above 0, up to outstanding | "Enter an amount up to {outstanding}." |
| Reason | `select` | yes | Returned goods, Price change, Damaged goods, Other | "Choose a reason." |
| Document | `fileUpload` | yes | PDF, 5 MB | "Attach the credit note as a PDF." |

Result of the calculation shown before sending: New invoice value, New advance limit (80 %), Excess advance (if the advance already paid is higher). Example: face 100,000.00, advance 80,000.00, credit note 5,000.00: new value 95,000.00, 80 % is 76,000.00, **excess advance 4,000.00**. Alert (warning): "You were paid 4,000.00 more than 80 % of the new value. We take this into account before paying out the reserve and before new advances." **`consent`** "I confirm this credit note is genuine and the debtor has received it." **`otp`**. **`done`**: new value and excess.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `CREDIT_ABOVE_OUTSTANDING` | "Enter an amount up to {outstanding}." | `details` | Change amount |
| `DUPLICATE_CREDIT_NOTE` | "This credit note number was already sent." | `details` | Change |
| `INVALID_AMOUNT` | "Enter an amount above 0 with up to 2 decimals." | `details` | Change amount |
| `INVOICE_NOT_FOUND` | "We can't find that invoice." | `details` | Back |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `consent` | Try again |

#### 5. Adapters
`submitCreditNote` -> `corp.factoring.creditnote.submit` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.dispute`, `otp`. Counts against headroom: negative headroom blocks new advances (not payouts).

#### 7. Result and links out
Reserve and fees recomputed. Buttons: "View invoice", "Done".

#### 8. Acceptance criteria
- AC-1 New value = face - credit note; excess = max(0, advance - rate x new value).
- AC-2 A credit note above the outstanding value is refused.
- AC-3 The same number cannot be used twice.
- AC-4 A credit note on an invoice in collection recomputes the reserve release.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | SIN-2001 funded, note 5,000.00 | 95,000.00; excess 4,000.00 |
| T-2 | AC-2 | note 120,000 | message |
| T-3 | AC-3 | repeat number | message |
| T-4 | AC-4 | then full collection of 95,000 on day 45 | reserve released 13,625.00 (95,000 - 80,000 - 475 - 900) |
| T-5 | AC-1 | `timeout:[corp.factoring.creditnote.submit]` | unchanged |
| T-6 | AC-1 | `unavailable:[corp.factoring.creditnote.submit]` | unchanged |

#### 10. Expected survivors
None expected.

---

### ★ Raise an invoice dispute — `dispute-factored-invoice`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `dispute-factored-invoice`: tell the bank the debtor disputes or may dispute an invoice |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / reason, note, evidence, result |
| Who | `biz.factoring.dispute`; `none` |

#### 2. Entry points
Invoices › row › Dispute (`{invoiceId}`); debtor reply notification.

#### 3. Screens
**`reason`**: Reason `select` rows (required): Goods not received, Wrong amount, Quality problem, Debtor says already paid, Other. Note `textInput` lines 4 (10–500 characters; "Tell us more (10 to 500 characters)."). Evidence `fileUpload` (optional, 3 files). Alert (warning): "While an invoice is in dispute we pause funding and collection. A disputed invoice is not covered by the bank, even on a non-recourse facility." **`consent`**: "I confirm the details are true." **`done`**: "Dispute raised".

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `DISPUTE_EXISTS` | "There is already a dispute on this invoice." | `reason` | View dispute |
| `INVOICE_CLOSED` | "This invoice is closed." | `reason` | Back |
| `INVOICE_NOT_FOUND` | "We can't find that invoice." | `reason` | Back |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `consent` | Try again |

#### 5. Adapters
`raiseDispute` -> `corp.factoring.dispute.raise` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.dispute`, `none`.

#### 7. Result and links out
Invoice `disputed`; funding blocked; for a funded invoice the debtor limit is held. Buttons: "View invoice", "Done".

#### 8. Acceptance criteria
- AC-1 A disputed invoice cannot be funded.
- AC-2 A second dispute on the same invoice is refused.
- AC-3 A dispute removes non-recourse cover for that invoice (shown in the invoice detail).

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | dispute SIN-2001; request advance | `INVOICE_DISPUTED` |
| T-2 | AC-2 | twice | `DISPUTE_EXISTS` |
| T-3 | AC-3 | non-recourse funded invoice; debtor insolvent after dispute | seller owes repurchase |
| T-4 | AC-1 | `timeout:[corp.factoring.dispute.raise]` | no dispute |
| T-5 | AC-1 | `unavailable:[corp.factoring.dispute.raise]` | no dispute |

#### 10. Expected survivors
AC-3 is a bank rule shown as text; if the sandbox does not model insolvency the mutant that flips cover survives. Others none expected.

---

### ★ Ask for a higher limit — `request-limit-change`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `request-limit-change`: ask for a higher facility limit or debtor limit |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web / form, consent, step-up, OTP |
| Who | `biz.factoring.apply`; `stepup` |

#### 2. Entry points
Overview › Request a limit change; Debtors › row.

#### 3. Screens
**`details`**: Scope (`select`: Facility / one debtor), Debtor (shown if scope is debtor), New limit (`amountInput`; above current, at most 10,000,000 for the facility: "Enter a limit above {current} and up to {max}."), Reason (`select` required, `textInput` note 10–300). Info: "A person at the bank reviews the request. We'll notify you." **`consent`**, **`otp`**, **`done`** "Request sent" (status `in_review`).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `LIMIT_INVALID` | limit message above | `details` | Change limit |
| `LIMIT_BELOW_USED` | "The limit can't be below what is already in use ({used})." | `details` | Change limit |
| `DEBTOR_NOT_FOUND` | "We can't find that debtor." | `details` | Back |
| `REQUEST_EXISTS` | "There is already a request waiting for review." | `details` | Back |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `consent` | Try again |

#### 5. Adapters
`requestLimit` -> `corp.factoring.limit.request` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.apply`, `stepup` then `otp`.

#### 7. Result and links out
Buttons: "Done". Sandbox decision applied by a dev-only action.

#### 8. Acceptance criteria
- AC-1 A request is recorded `in_review` and the limit does not change by itself.
- AC-2 A second open request is refused.
- AC-3 A limit below current use is refused.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `noor` | `in_review`; limit unchanged |
| T-2 | AC-2 | again | `REQUEST_EXISTS` |
| T-3 | AC-3 | 10,000 | message |
| T-4 | AC-1 | `timeout:[corp.factoring.limit.request]` | none |
| T-5 | AC-1 | `unavailable:[corp.factoring.limit.request]` | none |

#### 10. Expected survivors
None expected.

---

### ★ Download a facility report — `factoring-report`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `factoring-report`: download invoices, advances, collections or ageing as CSV or PDF |
| Release / workspace / status | 4 / Business / new (planned) |
| Channels / pattern | web, mobile / choose, period, download |
| Who | `biz.factoring.report`; `none` |

#### 2. Entry points
Reports › New report.

#### 3. Screens
**`choose`**: Report (`select` rows: Invoices, Advances, Collections and reserves, Ageing), Period (`datePicker` range; not in the future, at most 12 months: "Choose a period of up to 12 months."), Format (`select` chips: CSV, PDF). **`done`**: `result` with file name and size; button "Download" (file save) and "Share" on mobile.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `INVALID_PERIOD` | "Choose a period of up to 12 months, ending today or earlier." | `choose` | Change period |
| `NOTHING_TO_REPORT` | "There is nothing to report for this period." | `choose` | Change period |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `choose` | Try again |

#### 5. Adapters
`createReport` -> `corp.factoring.report` (planned).

#### 6. Permissions, step-up, limits
`biz.factoring.report`. Export is audited.

#### 7. Result and links out
Buttons: "Download", "Done".

#### 8. Acceptance criteria
- AC-1 The file totals equal the on-screen tables for the same period.
- AC-2 A period over 12 months or in the future is refused.
- AC-3 An empty period gives the empty message, not an empty file.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | invoices report 1 Nov to 30 Nov 2026 | totals equal |
| T-2 | AC-2 | 13 months | message |
| T-3 | AC-3 | `empty:[corp.factoring.invoices.list]` | `NOTHING_TO_REPORT` |
| T-4 | AC-1 | `timeout:[corp.factoring.report]` | no file |
| T-5 | AC-1 | `unavailable:[corp.factoring.report]` | no file |

#### 10. Expected survivors
Format choice (CSV vs PDF) survives if the sandbox returns one stub. Others none expected.

---

### ★ Acknowledge a notice of assignment (debtor side, simulated) — `acknowledge-assignment`

#### 1. Summary
| | |
|---|---|
| Slug / purpose | `acknowledge-assignment`: the debtor confirms it has been told payment goes to the bank, and agrees the invoices |
| Release / workspace / status | 4 / Business (debtor company) / new (planned) |
| Channels / pattern | web, mobile / review, confirm, result |
| Who | `biz.approvals.approve` (debtor approver, e.g. `dana` at Alpha) |

#### 2. Entry points
Notification "{seller} has assigned invoices to the bank" (`{assignmentId}`).

#### 3. Screens
**`review`**: `dataTable` of invoices (no., amount, due date) and the bank payment details. Alert (warning): "From now on pay these invoices to {bank} only. Paying {seller} won't settle them." **`choose`** `select` rows: "I confirm these invoices" / "I dispute one or more" (leads to a note, 10–300 characters: "Tell us what is wrong (10 to 300 characters)."). **`consent`**: "I confirm {debtor} will pay these invoices to {bank}." **`done`**: "Thank you". Sets `acknowledgedAt`; dispute choice raises a dispute on the listed invoices.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `ASSIGNMENT_NOT_FOUND` | "We can't find that notice." | `review` | Back |
| `ALREADY_ACKNOWLEDGED` | "You have already answered this notice." | `review` | Back |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | standard non-money | `consent` | Try again |

#### 5. Adapters
`acknowledge` -> `corp.factoring.assignment.acknowledge` (planned; request `{assignmentId, decision, note?}`, response `{status}`, errors above, `moneyMoving` no, `requiresOtp` no).

#### 6. Permissions, step-up, limits
`biz.approvals.approve`, `none`. Not offered to the seller's own users.

#### 7. Result and links out
Seller notified; debtor state may move from `pending` to `verified`. Buttons: "Done".

#### 8. Acceptance criteria
- AC-1 Acknowledging sets the invoices' acknowledged date and notifies the seller.
- AC-2 A dispute choice needs a note and raises a dispute.
- AC-3 A notice can be answered once.

#### 9. Scenarios
| T | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `dana`, notice for SIN-2001 | acknowledged |
| T-2 | AC-2 | dispute, no note | message |
| T-3 | AC-3 | answer twice | `ALREADY_ACKNOWLEDGED` |
| T-4 | AC-1 | `timeout:[corp.factoring.assignment.acknowledge]` | unanswered |
| T-5 | AC-1 | `unavailable:[corp.factoring.assignment.acknowledge]` | unanswered |

#### 10. Expected survivors
None expected.

---

## 10. Open questions

1. **Timeout semantics.** A timed-out request is not applied in the sandbox, but a real bank may have applied it. Copy tells people to check first. Confirm with the bank.
2. **Reserve shortfall.** If fees plus discount are larger than the reserve, who pays the rest and when? These specs release 0.00 and keep the shortfall as owed.
3. **Day count.** Actual days over 360 assumed (same as module 7). Confirm.
4. **Debtor refusal reason.** The bank gives none. Does the seller need one for the debtor conversation?
5. **Notice to the debtor.** Is the notice sent at assignment (as here, "disclosed") or only when needed ("undisclosed")? Confidential factoring would change the debtor journey.
6. **Direct payment detection.** How does the bank know a debtor paid the seller? Here the seller reports it; a bank might see it on the account. Needs a decision.
7. **Credit notes after payout.** Not handled once the reserve has been released.
8. **Recourse period.** 90 days past due is an assumption.
9. **Nav.** One "Finance" tab for modules 5 to 8 or separate tabs.

## 11. README changes needed (summary)

- 4.2: add the seven `biz.factoring.*` and `biz.invoices.assign` permissions.
- 3.3: add the "Finance" tab with Supply chain and Factoring sections.
- 5.3: add the launch points in section 8.
- `approve-payments`: new item kinds `factoring_advance`, `reserve_release`, `repurchase`, `pass_on`.
