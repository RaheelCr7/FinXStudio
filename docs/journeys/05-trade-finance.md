# Module 5: Trade Finance

Release 3. Workspace: Business "Graphite". Depth: structure plus the planned parts. Everything here is **(planned)** unless it says *existing*. All people, companies, banks and amounts are synthetic. Brand: BankWorkx®.

## Scope and who uses it

Trade finance is how a company pays and gets paid for goods that cross borders when buyer and seller do not fully trust each other. The bank stands in the middle with paper promises. This module covers:

- **Letters of credit (LC)**: the bank promises to pay the seller if the seller shows the right documents. *Import LC* = our company is the buyer and the bank issues. *Export LC* = our company is the seller and receives one.
- **Guarantees**: the bank promises to pay a third party if our company fails to do something (bid, advance, performance, payment).
- **Documentary collections**: documents travel through banks, but the bank gives no promise to pay.
- **Trade loans (financing)**: short loans tied to one trade (pre-shipment, post-shipment, import loan).
- **Document presentation and discrepancies**: checking documents against the LC terms, and what to do when they do not match.
- **Amendments** and **tracking**.

Who uses it: the finance team of a trading company (Maker role: starts requests, uploads documents), approvers (Approver role: approve), and admins (set limits, read audit). Demo company: **Alpha Trading LLC** (USD) where Alex is Maker; approvers `dana` and `lee`; admin `ravi`. Counterparties are synthetic: *Nordic Steel AB* (seller, Sweden), *Meridian Imports GmbH* (buyer, Germany), *Harbor Textiles Co.* (seller, Vietnam), their banks *Fjord Commerce Bank* and *Rhine Merchant Bank*. Trade is not offered to a company without a trade line (`TRADE_NOT_ENABLED`).

## Release

Release 3. It needs, from earlier releases: sandbox identity (step 2, `bank.session.*`), the Business shell, `approve-payments` pattern, and the blocks `dataTable`, `timeline`, `statusChip`, `datePicker`, `fileUpload`, `documentViewer` (Release 1/2 batches A and B).

## What exists today in code

| Thing | Where | Used here for |
|---|---|---|
| `CorporateSandbox` (maker-checker, whitelist, limits in company currency, cut-off 16:00 UTC, closed weekends and 9 Nov 2026, dual approval above a threshold) | `packages/mock-bank-api/src/corporate.ts`, `corporate-b.ts` | The approval rules trade instruments copy. `CorpRole` is `initiator`/`approver`; BankWorkx® Business calls them Maker/Approver. |
| `corp.users.list`, `corp.company.get`, `corp.payments.initiate/approve/reject/withdraw/pending/get` | `index.ts` | Pattern for `corp.trade.*`. Errors `NOT_AUTHORISED`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `PAYMENT_NOT_PENDING`, `USER_NOT_FOUND` are reused with their wording from `docs/CORPORATE.md`. |
| `bank.fx.rate`, `bank.fx.quote`, `bank.fx.convert` (Personal accounts; rates in `fx.ts` `PER_USD`; spread 0.5%; fee 0.2%; quote valid 30 s) | `fx.ts`, `index.ts` | Foreign-currency LCs and loans are priced with `midRate`/`customerRate` from `fx.ts`. Error codes `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND`, `SAME_CURRENCY`. |
| `bank.otp.send`, `bank.otp.verify` (code `482100`, `000000` always accepted, failures counted; engine counts only an integration named exactly `otpVerify`) | `index.ts` | Every money-moving or commitment-creating step. |
| Blocks `reviewSummary`, `consent`, `otp`, `result`, `select`, `textInput`, `amountInput`, `toggle`, `alert`, `accordion`, `balanceList` | `journey-schema/src/schema.ts` | All screens. |
| `bank.accounts.totals` | `index.ts` | None directly (Trade shows facility, not balances). |
| Nothing for LCs, guarantees, collections, trade loans, documents | – | All planned below. |

## Sandbox domains needed (planned)

A new class `TradeSandbox` (file `trade.ts`) behind adapters `corp.trade.*`, on top of `CorporateSandbox` (same company, users, cut-off and calendar). Pure logic with an injectable clock, named errors, and `Flaws` switches for the mutation check.

| Domain | What it holds and enforces |
|---|---|
| **Trade facility** | One trade line per company: Alpha 2,000,000 USD, used 640,000, expires 30 Jun 2027. Every LC, guarantee and loan reserves part of it until it ends (`TRADE_FACILITY_EXCEEDED`). Amounts in other currencies are counted in USD at the mid rate from `fx.ts`. |
| **Counterparties** | Seller/buyer/beneficiary records: name, country, bank name, BIC. Screened against a sandbox list; names containing "Embargo" or countries `KP`, `IR` answer `SANCTIONS_SCREENING_HIT`. |
| **Letters of credit** | Import and export. Status machine: `draft` → `pending_approval` → `issued` → (`advised` for export) → `documents_presented` → `discrepant` or `accepted` → `settled` / `expired` / `cancelled`. Terms: amount, currency, tenor (sight, 30/60/90/120 days), expiry, latest shipment date, ports, incoterm, required documents, presentation period (7–21 days, default 21). |
| **Amendments** | One open amendment at a time (`AMENDMENT_PENDING`). Increase of amount or extension of dates needs the approval rule again; for an export LC it also needs the beneficiary's acceptance (status `awaiting_beneficiary`). |
| **Documents and discrepancy engine** | Uploaded files get an id, type and extracted fields (simulated: amount, date, ports, goods description are read from file name tags such as `inv_amount=119500`). The checker compares to the LC: amount over LC (tolerance 5% if "about"), late shipment, late presentation (more than presentation period after shipment), missing document, wrong port, description mismatch, expired LC. Each difference is a discrepancy with a code and text. |
| **Guarantees** | Types: bid bond, advance payment, performance, payment. Amount, currency, beneficiary, expiry, claim-by date, counter-indemnity (our promise to the bank). Claims arrive from the beneficiary: the company has 5 working days to respond. |
| **Collections** | Outward (we send documents for a buyer to pay or accept) and inward (documents arrive for us). Instructions: documents against payment (D/P) or against acceptance (D/A). |
| **Trade loans** | Types: pre-shipment, post-shipment, import loan. Rate 6.25% a year, tenor up to 180 days, up to 90% of the underlying LC or invoice, repay by debit of a named account. |
| **Fees** | LC issuance 0.25% per quarter, minimum 150 USD; confirmation 0.15% per quarter; amendment 75 USD; discrepancy fee 60 USD per set; guarantee 1.00% a year, minimum 100 USD; collection 0.15%, minimum 50, maximum 500 USD; SWIFT charge 25 USD. Fees are debited from a chosen account on issue/acceptance. |
| **Approval rule** | Same as payments: Maker cannot approve own request (`SELF_APPROVAL`); more than 250,000 USD equivalent needs two different approvers. Cut-off 16:00 UTC: after it the instruction is dated the next working day. |
| **Notifications and messages** | Simulated SWIFT messages (MT700, MT707, MT760 shown in plain words, never as raw codes) appended to the timeline. |

## New adapters (planned)

Naming: `corp.trade.<domain>.<verb>`. All take the acting user from the active context. All refuse a wrong context with `PERMISSION_DENIED`. All list calls also answer `TIMEOUT` and `SERVICE_UNAVAILABLE` under planned sandbox conditions (README 1.5). "OTP" means `bank.otp.verify` must have succeeded just before (else `OTP_REQUIRED`).

| Adapter | Request | Response | Error codes | moneyMoving | requiresOtp |
|---|---|---|---|---|---|
| `corp.trade.facility.get` | `{}` | `{ limit, used, reserved, available, currency, expiresOn }` | `TRADE_NOT_ENABLED` | no | no |
| `corp.trade.counterparties.list` | `{ q? }` | map keyed by id `{ id, name, country, bankName, bic }` | – | no | no |
| `corp.trade.lc.quote` | `{ direction:"import", amount, currency, tenor, confirmed, expiryDate }` | `{ quoteId, fee, feeCurrency, swiftFee, total, confirmationFee?, facilityAfter, expiresAt }` | `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `TRADE_FACILITY_EXCEEDED`, `EXPIRY_INVALID`, `SANCTIONS_SCREENING_HIT`, `TRADE_NOT_ENABLED` | no | no |
| `corp.trade.lc.issue` | `{ quoteId, requestKey, beneficiary:{name,country,bankName,bic}, terms, goods, documentsRequired[], feeAccountId, draftDocId? }` | `{ requestId, status:"pending_approval", approversRequired, valueDate, afterCutoff }` | all of `lc.quote` plus `SHIPMENT_DATE_INVALID`, `NOT_AUTHORISED`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS` (fee account), `DUPLICATE_REQUEST`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **no at this step** (reserves the facility; nothing debited until final approval) | yes |
| `corp.trade.lc.list` / `corp.trade.lc.get` | `{ direction?, status?, q?, expiringInDays? }` / `{ lcId }` | map of LC summaries / `{ ...lc, timeline[], documents[], amendments[] }` | `LC_NOT_FOUND` | no | no |
| `corp.trade.lc.amend` | `{ lcId, requestKey, changes:{amount?, expiryDate?, latestShipmentDate?, description?, ports?}, reason }` | `{ requestId, status, needsBeneficiaryAcceptance, fee }` | `LC_NOT_FOUND`, `LC_NOT_AMENDABLE`, `AMENDMENT_PENDING`, `NOTHING_CHANGED`, `EXPIRY_INVALID`, `SHIPMENT_DATE_INVALID`, `TRADE_FACILITY_EXCEEDED`, `OTP_REQUIRED`, `NOT_AUTHORISED` | no (fee debited when it takes effect) | yes |
| `corp.trade.amendment.respond` | `{ lcId, amendmentId, decision:"accept"/"refuse", reason? }` (export LC) | `{ status }` | `AMENDMENT_NOT_FOUND`, `AMENDMENT_NOT_PENDING`, `OTP_REQUIRED` | no | yes |
| `corp.trade.documents.upload` | `{ lcId?, collectionId?, kind, fileName, sizeBytes, contentBase64 }` | `{ docId, kind, pages, extracted:{...} }` | `FILE_TYPE_NOT_ALLOWED` (PDF, JPG, PNG, TIF), `FILE_TOO_LARGE` (over 10 MB), `FILE_UNREADABLE`, `LC_NOT_FOUND` | no | no |
| `corp.trade.documents.check` | `{ lcId, docIds[] }` | `{ ok, discrepancies:[{ code, document, text, severity }], daysLeft, deadline }` | `LC_NOT_FOUND`, `LC_EXPIRED`, `PRESENTATION_LATE`, `DOCUMENT_SET_INCOMPLETE` | no | no |
| `corp.trade.documents.present` | `{ lcId, docIds[], requestKey, coveringNote? }` | `{ presentationId, status:"documents_presented", discrepancyFee? }` | `LC_NOT_FOUND`, `LC_EXPIRED`, `PRESENTATION_LATE`, `DOCUMENT_SET_INCOMPLETE`, `DUPLICATE_REQUEST`, `OTP_REQUIRED` | no (fee only on discrepancy) | yes |
| `corp.trade.discrepancy.get` | `{ presentationId }` | `{ discrepancies[], documents[], amount, currency, respondBy }` | `PRESENTATION_NOT_FOUND` | no | no |
| `corp.trade.discrepancy.respond` | `{ presentationId, decision:"accept"/"refuse", reason?, settleAccountId?, requestKey }` | `{ status:"accepted"/"refused", maturityDate?, debitOn?, fee }` | `PRESENTATION_NOT_FOUND`, `DISCREPANCY_DEADLINE_PASSED`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_COMPANY_EXCEEDED`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **yes** on accept at sight (debits settle account on value date); no on refuse | yes |
| `corp.trade.guarantee.issue` | `{ requestKey, type, applicantAccountId, beneficiary, amount, currency, expiryDate, claimByDays, wording:"standard"/"custom", customWordingDocId?, counterIndemnityAccepted }` | `{ requestId, status:"pending_approval", fee, approversRequired }` | `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `TRADE_FACILITY_EXCEEDED`, `EXPIRY_INVALID`, `SANCTIONS_SCREENING_HIT`, `CUSTOM_WORDING_REVIEW` (needs legal review, request still accepted with status `in_review`), `DUPLICATE_REQUEST`, `NOT_AUTHORISED`, `OTP_REQUIRED` | no (fee at issue) | yes |
| `corp.trade.guarantee.list` / `.get` | as `lc.*` | – | `GUARANTEE_NOT_FOUND` | no | no |
| `corp.trade.guarantee.amend` | `{ guaranteeId, requestKey, changes:{amount?, expiryDate?}, reason }` | `{ requestId, status, fee }` | `GUARANTEE_NOT_FOUND`, `GUARANTEE_NOT_AMENDABLE`, `AMENDMENT_PENDING`, `NOTHING_CHANGED`, `EXPIRY_INVALID`, `TRADE_FACILITY_EXCEEDED`, `OTP_REQUIRED` | no | yes |
| `corp.trade.claim.respond` | `{ claimId, decision:"pay"/"dispute", reason?, payAccountId?, requestKey }` | `{ status:"paid"/"disputed", reference? }` | `CLAIM_NOT_FOUND`, `CLAIM_DEADLINE_PASSED`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **yes** on pay | yes |
| `corp.trade.collection.create` | `{ requestKey, direction:"outward", mode:"DP"/"DA", drawee:{name,country,bankName,bic}, amount, currency, tenorDays?, docIds[], instructions }` | `{ collectionId, status:"pending_approval", fee }` | `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `SANCTIONS_SCREENING_HIT`, `DOCUMENT_SET_INCOMPLETE`, `DUPLICATE_REQUEST`, `OTP_REQUIRED` | no | yes |
| `corp.trade.collection.respond` | `{ collectionId, decision:"pay"/"accept"/"refuse", payAccountId?, requestKey }` (inward) | `{ status, reference?, maturityDate? }` | `COLLECTION_NOT_FOUND`, `COLLECTION_NOT_OPEN`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **yes** on pay (D/P) | yes |
| `corp.trade.loan.quote` | `{ type, underlyingRef, amount, currency, tenorDays }` | `{ quoteId, advanceRate, maxAmount, rate, interest, fee, maturityDate, facilityAfter, expiresAt }` | `LOAN_NOT_ELIGIBLE`, `INVALID_AMOUNT`, `ABOVE_MAX_ADVANCE`, `TENOR_TOO_LONG`, `TRADE_FACILITY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED` | no | no |
| `corp.trade.loan.apply` | `{ quoteId, requestKey, creditAccountId, repayAccountId }` | `{ requestId, status:"pending_approval", approversRequired }` | all of `loan.quote`, `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `DUPLICATE_REQUEST`, `OTP_REQUIRED` | no (disbursed on final approval) | yes |
| `corp.trade.loan.repay` | `{ loanId, mode:"full"/"partial"/"rollover", amount?, newTenorDays?, payAccountId, requestKey }` | `{ reference, principalLeft, interestPaid, newMaturity? }` | `LOAN_NOT_FOUND`, `INVALID_AMOUNT`, `ABOVE_BALANCE_DUE`, `ROLLOVER_NOT_ALLOWED`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **yes** | yes |
| `corp.trade.loan.list` / `.get` | – | – | `LOAN_NOT_FOUND` | no | no |
| `corp.trade.pending` | `{ as:"approver"/"initiator" }` | map of trade requests waiting | – | no | no |
| `corp.trade.approve` / `corp.trade.reject` | `{ requestId, reason? }` | request with `approvals`, `required`, `status` | `REQUEST_NOT_FOUND`, `REQUEST_NOT_PENDING`, `NOT_AUTHORISED`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `LIMIT_COMPANY_EXCEEDED`, `TRADE_FACILITY_EXCEEDED`, `INSUFFICIENT_FUNDS` (fee account), `OTP_REQUIRED`, `CORE_UNAVAILABLE` | **yes** on the last approval (fee debit, disbursement) | yes (approve) |
| `corp.trade.withdraw` | `{ requestId }` | request | `REQUEST_NOT_FOUND`, `REQUEST_NOT_PENDING`, `NOT_AUTHORISED` | no | no |
| `corp.trade.tracking` | `{ kind?, status?, q?, from?, to? }` | list of events across instruments | – | no | no |

## New components (planned, beyond the README list)

| Component | Why |
|---|---|
| `dataTable` (README batch A) with **row actions** and a **status chip column** | LC, guarantee, collection and loan lists. Columns, filters and sort listed per shell screen. |
| `timeline` with **expandable events and attached documents** | LC life: issued, advised, documents presented, discrepancies, accepted, paid. |
| `fileUpload` (batch B) with **document kind** per file and a progress bar | Presentation sets: invoice, packing list, bill of lading, certificate of origin, insurance, inspection. Accepts PDF, JPG, PNG, TIF up to 10 MB; many files per set. |
| `documentViewer` (batch B) | Read the LC text, guarantee wording and discrepancy notice to the end before the confirm button wakes up. |
| `datePicker` (batch A) with **min/max and business-day hints** | Expiry and shipment dates. |
| `chart` (batch A) | Facility utilisation donut; exposure by month (bars). |
| **`checklist`** (new, optional) | Document set completeness: each required document with a tick, a file name and a "Replace" link. Can be drawn with `reviewSummary` rows plus `statusChip` until built. |
| **`countdown`** (new, small) | Time left to answer a discrepancy or a claim. Can be drawn as a `statusChip` with text until built. |
| `dialog` (existing) | Confirm "Withdraw request". |
| `signature` (batch B) | Used only by `request-guarantee` custom wording: typed name plus OTP as acceptance of the counter-indemnity. |
| Engine: `receipts` | Print the LC advice and the guarantee as a PDF-like receipt on web, share sheet on mobile. |
| Engine: `navigate.toJourney` + `returnTo` | From `present-documents` to `respond-to-discrepancies`; from `apply-trade-loan` to `repay-trade-loan`. |

## Information architecture

A new Business tab **Trade** (README 3.3 lists six tabs; this becomes the seventh and is shown only when the company has a trade line and the context holds `biz.trade.view`). On phones the tab sits under **More**.

Tab layout: sub-navigation **Overview · Letters of credit · Guarantees · Collections · Financing · Documents · Tracking**.

### Shell: Trade overview
- **Purpose:** one place to see what needs doing today and how much of the trade line is used.
- **Route:** web `/business/:company/trade`; mobile `TradeHome`. **Data:** `TradeOverviewVM` (planned) from `corp.trade.facility.get`, `corp.trade.lc.list`, `corp.trade.guarantee.list`, `corp.trade.loan.list`, `corp.trade.tracking`.
- **Widgets:** (1) *Trade line* donut (`chart`): used, reserved, available of 2,000,000 USD; button "Request more room" is a `business-service-request` with `{type:"trade-limit"}`. (2) *Needs your action* list: discrepancies to answer (with countdown), claims to answer, amendments to accept, collections to pay. (3) *Expiring in 30 days* (LCs and guarantees). (4) *Loans due in 14 days*. (5) *Recent activity* (last 8 timeline events).
- **Empty:** "No trade activity yet. Start with a letter of credit." Button: Issue a letter of credit (`issue-import-lc`). **Loading:** skeleton cards. **Error:** "We couldn't load your trade overview. Nothing was changed." Button Try again.
- **Drill-downs:** each row opens its detail screen.
- **Launch points on it:** + quick action list (see below).

### Shell: Letters of credit (list) and LC detail
- **Routes:** `/business/:company/trade/lc`, `/trade/lc/:lcId`; mobile `LcList`, `LcDetail`. **Data:** `LcListVM`, `LcDetailVM` from `corp.trade.lc.list/get`.
- **Table columns:** LC number, Direction (Import/Export chip), Counterparty, Amount and currency, Expiry, Latest shipment, Status chip, Open items (count). **Filters:** direction, status, currency, expiring in (7/30/90 days), counterparty search. **Sort:** expiry ascending by default; every column sortable. Phones: card list. **Page size** 20.
- **Empty:** "No letters of credit match these filters." Button Clear filters. **Error:** "We couldn't load your letters of credit." Button Try again.
- **Detail widgets:** header (number, status, amount, expiry); *Terms* (accordion: goods, ports, incoterm, documents required, presentation period); *Timeline* (`timeline`); *Documents* (table: kind, file, uploaded by, date); *Amendments* (table); *Messages* (read-only bank messages).
- **Buttons on detail (shown by state and permission):** Amend (`amend-lc`), Present documents (`present-documents`, export LC, status `advised`), Respond to discrepancies (`respond-to-discrepancies`, status `discrepant`), Apply for financing (`apply-trade-loan`), Download advice (receipt), Withdraw request (`corp.trade.withdraw`, only while pending, only the initiator).

### Shell: Guarantees, Collections, Financing, Documents, Tracking
| Screen | Route | Columns | Filters | Notes |
|---|---|---|---|---|
| Guarantees | `/trade/guarantees`, `/trade/guarantees/:id`; `GuaranteeList`, `GuaranteeDetail` | Number, Type, Beneficiary, Amount, Expiry, Claim-by date, Status chip, Claims open | type, status, expiring in | Detail buttons: Amend (`amend-guarantee`), Respond to claim (`respond-to-guarantee-claim`), Download. |
| Collections | `/trade/collections`, `/trade/collections/:id`; `CollectionList`, `CollectionDetail` | Reference, Direction chip, Other party, Amount, Mode (D/P, D/A), Due date, Status chip | direction, status | Buttons: New collection (`documentary-collection`), Pay or accept (`accept-collection`). |
| Financing | `/trade/loans`, `/trade/loans/:id`; `LoanList`, `LoanDetail` | Loan number, Type, Underlying (LC or invoice), Principal, Rate, Maturity, Days left, Status chip | type, status, due in | Buttons: Apply (`apply-trade-loan`), Repay or roll over (`repay-trade-loan`). |
| Documents | `/trade/documents` `DocumentLibrary` | File, Kind, Linked instrument, Uploaded by, Date, Size | kind, instrument, date range | Read only; open in `documentViewer`; no delete (audit). |
| Tracking | `/trade/tracking` `TradeTracking` | Time (UTC), Instrument, Event (plain words), By, Status chip | instrument kind, status, date range, search | Export CSV through `business-statement` is out of scope; a plain "Download CSV" shell button. |

All six share the states: loading = skeleton rows; empty = one sentence and the matching "New" button; error = "We couldn't load this. Nothing was changed." with Try again.

### Approvals inbox change
The Approvals tab inbox gains a **Type** filter (Payments, Trade). Trade requests appear with the instrument chip, amount, requester and approvals so far. Opening one runs `approve-trade-request`.

## Launch points (planned; to be added to README 5.3)

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Trade › overview | + Issue a letter of credit | `issue-import-lc` | – | `biz.trade.initiate` |
| Trade › overview | + Request a guarantee | `request-guarantee` | – | `biz.trade.initiate` |
| Trade › overview › needs action row | Open | `respond-to-discrepancies` / `respond-to-guarantee-claim` / `accept-collection` / `amend-lc` | `{presentationId}` / `{claimId}` / `{collectionId}` / `{lcId, amendmentId}` | `biz.trade.documents` / `biz.trade.documents` / `biz.trade.documents` / `biz.trade.amend` |
| Trade › LC list | Issue a letter of credit | `issue-import-lc` | – | `biz.trade.initiate` |
| Trade › LC detail | Amend | `amend-lc` | `{lcId}` | `biz.trade.amend` |
| Trade › LC detail (export, advised) | Present documents | `present-documents` | `{lcId}` | `biz.trade.documents` |
| Trade › LC detail (discrepant) | Respond to discrepancies | `respond-to-discrepancies` | `{presentationId}` | `biz.trade.documents` |
| Trade › LC detail | Apply for financing | `apply-trade-loan` | `{lcId}` | `biz.trade.finance` |
| Trade › guarantees | Request a guarantee | `request-guarantee` | – | `biz.trade.initiate` |
| Trade › guarantee detail | Amend | `amend-guarantee` | `{guaranteeId}` | `biz.trade.amend` |
| Trade › guarantee detail (claim open) | Respond to claim | `respond-to-guarantee-claim` | `{claimId}` | `biz.trade.documents` |
| Trade › collections | New collection | `documentary-collection` | – | `biz.trade.initiate` |
| Trade › collection detail (inward, open) | Pay or accept | `accept-collection` | `{collectionId}` | `biz.trade.documents` |
| Trade › financing | Apply | `apply-trade-loan` | `{lcId}` or `{invoiceRef}` | `biz.trade.finance` |
| Trade › loan detail | Repay or roll over | `repay-trade-loan` | `{loanId, mode}` | `biz.trade.finance` |
| Approvals › inbox (type Trade) | Open / Approve / Reject | `approve-trade-request` | `{requestId}` | `biz.approvals.approve` |
| Notification | "Discrepancies found: respond by {date}" | `respond-to-discrepancies` | `{companyId, presentationId}` | `biz.trade.documents` |
| Notification | "Guarantee claim received" | `respond-to-guarantee-claim` | `{companyId, claimId}` | `biz.trade.documents` |
| Overview › quick action + | Trade | the two "Issue" journeys above | – | `biz.trade.initiate` |

## New permissions (add to README 4.2)

| Permission | Allows | Typical role |
|---|---|---|
| `biz.trade.view` | See the Trade tab, instruments, documents and tracking | Maker, Approver, Admin |
| `biz.trade.initiate` | Start LC, guarantee and collection requests | Maker |
| `biz.trade.amend` | Request amendments; respond to amendments on export LCs | Maker |
| `biz.trade.documents` | Upload and present documents; answer discrepancies, claims and inward collections | Maker |
| `biz.trade.finance` | Apply for and repay trade loans | Maker |

Approving or rejecting a trade request uses the existing `biz.approvals.approve`. Reading the audit trail uses `biz.audit.view`. The Alex demo: at Alpha Alex holds all five trade permissions but not `biz.approvals.approve`; at Beta he holds `biz.trade.view` only.

## Journey index

| # | Slug | Name | Money / commitment | Release |
|---|---|---|---|---|
| 1 | `issue-import-lc` | Issue an import letter of credit | commitment + fee | 3 |
| 2 | `amend-lc` | Amend a letter of credit (and answer an amendment) | commitment | 3 |
| 3 | `present-documents` | Present documents under an export LC | none (file) | 3 |
| 4 | `respond-to-discrepancies` | Respond to discrepancies and settle an import LC | money | 3 |
| 5 | `request-guarantee` | Request a bank guarantee | commitment + fee | 3 |
| 6 | `amend-guarantee` | Amend a guarantee | commitment | 3 |
| 7 | `respond-to-guarantee-claim` | Respond to a guarantee claim | money | 3 |
| 8 | `documentary-collection` | Send documents for collection (outward) | file + fee | 3 |
| 9 | `accept-collection` | Pay or accept an inward collection | money | 3 |
| 10 | `apply-trade-loan` | Apply for trade financing | disbursement | 3 |
| 11 | `repay-trade-loan` | Repay or roll over a trade loan | money | 3 |
| 12 | `approve-trade-request` | Approve or reject a trade request | money (on last approval) | 3 |

Twelve journeys. Tracking and the lists are shell screens.

## Common screens used by every journey

To avoid repeating, these named screens are written once. A journey says which it uses and what it fills in.

| Id | Blocks and exact copy |
|---|---|
| `review` | `text` title "Review your request"; `reviewSummary` rows listed per journey; `alert` (tone info) "Nothing is sent to the bank until you confirm." Buttons: "Back" (previous screen), "Continue" (to `consent`). |
| `consent` | `consent` block, `mustBeTrue`, label per journey. Button: "Confirm and get a code" (disabled until ticked; calls `otpSend`, then `otp`). Error "Tick the box to continue." |
| `otp` | `otp` block (6 digits, 3 attempts, resend after 30 s) bound to `otpVerify`. Text "We sent a 6-digit code to {maskedPhone}." Buttons: "Verify and {action}" (calls `otpVerify`, then the submit adapter), "Resend code" (after 30 s). |
| `timeout` | `result` tone warning, title "We didn't get an answer in time". Text "Your request may have reached the bank. Check Trade › Tracking before you try again, so it isn't sent twice." Buttons: "Check tracking" (opens Tracking), "Try again" (back to `review`; the same `requestKey` is reused so a repeat cannot create a second request). |
| `unavailable` | `result` tone error, title "Trade service unavailable". Text "Nothing was changed. Please try again in a few minutes." Buttons: "Try again" (back to `review`), "Back to Trade" (`exit`). |
| `denied` | `result` tone error, title "You can't do this". Text "Your role doesn't allow this. Ask an administrator at {company}." Button "Back". |
| Result base | `result` block, reference line, buttons per journey. Receipt (engine) for issued instruments. |

Standard rows used in every *Sandbox errors* table below as "S-…": `S-OTP_INVALID`, `S-OTP_REQUIRED`, `S-TIMEOUT` (screen `timeout`), `S-SERVICE_UNAVAILABLE` (screen `unavailable`), `S-PERMISSION_DENIED` (screen `denied`), `S-CORE_UNAVAILABLE` (README 1.6). `requestKey` is a UUID the journey makes when it opens and sends with every submit; the sandbox answers `DUPLICATE_REQUEST` ("This request was already sent. See it in Tracking.") if the same key arrives twice, which makes the timeout retry safe.

---

## Letters of credit

### ★ Issue an import letter of credit — `issue-import-lc`

#### 1. Summary
| | |
|---|---|
| Slug | `issue-import-lc` |
| Purpose | Ask the bank to issue an LC in favour of a seller abroad, to pay for imported goods. |
| Release | 3 |
| Workspace | business |
| Status | New (planned) |
| Channels | web, mobile |
| Starting pattern | Multi-step form with review, consent, OTP (like `corporate-payments`) |
| Who | `biz.trade.initiate` (Maker). A different person approves. |

#### 2. Entry points
Trade › overview + / Trade › LC list: "Issue a letter of credit" (nothing passed). Command bar ⌘K: "Issue LC". Permission `biz.trade.initiate`.

#### 3. Screens
**`terms` — "Letter of credit terms".** `stepper` (5 steps). `alert` info "Your available trade line is {available} {currency}." (from `facility.get`).

| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| Seller's name | `textInput` | yes | 2–70 characters | "Enter the seller's name." |
| Seller's country | `select` (rows) | yes | not `KP`, `IR` (screened again by bank) | "Choose the seller's country." |
| Seller's bank | `textInput` | yes | 2–70 characters | "Enter the seller's bank." |
| Seller's bank code (BIC) | `textInput` `pattern` `^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$` | yes | 8 or 11 characters | "Enter the 8 or 11 letter bank code, for example FJRDSESS." |
| Currency | `select` (chips) | yes | USD, EUR, GBP, AED, SAR, JPY (from `fx.ts`) | "Choose a currency." |
| Amount | `amountInput` | yes | above 0, at most the currency's decimals, at most available line | "Enter an amount above 0." / "This is above your available trade line of {available}." |
| Payment | `select` (tiles) | yes | At sight; 30, 60, 90, 120 days after shipment | "Choose when the seller is paid." |
| Ask the seller's bank to confirm | `toggle` | no | default off; when on, shows the extra fee | – |
| Expiry date | `datePicker` | yes | 9 Nov 2026 to 2 Nov 2027 | "Choose a date from 9 Nov 2026 to 2 Nov 2027." |

Buttons: "Next" (validates, calls `quote`; on success to `goods`), "Cancel" (`exit`). Loading: "Next" shows a spinner while pricing. Error: see section 4.

**`goods` — "Goods and shipment".**
| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| Description of goods | `textInput` `lines: 4` | yes | 10–600 chars | "Describe the goods in 10 to 600 characters." |
| Quantity and unit | `textInput` | no | max 40 chars | "Keep it under 40 characters." |
| Port of loading | `textInput` | yes | 2–60 chars | "Enter the port of loading." |
| Port of discharge | `textInput` | yes | 2–60 chars | "Enter the port of discharge." |
| Latest shipment date | `datePicker` | yes | after today, at least 5 days before expiry | "Latest shipment must be on or before {expiry − 5 days}." |
| Delivery terms (incoterm) | `select` | yes | EXW, FOB, CFR, CIF, DAP | "Choose the delivery terms." |
| Partial shipments allowed | `toggle` | no | default on | – |
| Transhipment allowed | `toggle` | no | default off | – |
Buttons: Back, Next.

**`documents` — "Documents the seller must show".** `toggle` rows: Commercial invoice (on, locked, helper "Always required"), Packing list, Bill of lading, Certificate of origin, Insurance certificate, Inspection certificate. `select` "Days to present after shipment": 7, 14, 21 (default 21; error "Choose from 7 to 21 days."). `fileUpload` "Pro-forma invoice (optional up to 100,000 USD equivalent; required above)": PDF/JPG/PNG up to 10 MB; errors "This file type isn't allowed. Use PDF, JPG, PNG or TIF." / "This file is over 10 MB." / "We couldn't read this file. Try another." / "Add the pro-forma invoice for an LC above 100,000." `select` "Pay fees from" (`accountPicker`, company accounts; error "Choose an account for the fees.").

**`review`** (common): rows Seller, Seller's bank, Amount, Payment, Expiry, Latest shipment, Goods, Documents required, Fee {fee} {feeCurrency}, SWIFT charge 25.00 USD, Confirmation fee (if on), Trade line after: {facilityAfter}; `alert` warning "This creates a promise of {amount} {currency} in the seller's favour. It counts against your trade line until it ends." Buttons Back, Continue.
**`consent`**: "I confirm these terms are correct. I ask the bank to issue this letter of credit and to debit the fees from {account} when it is issued."
**`otp`**: action "send for approval".
**`success`** (`result` success): "Sent for approval". Text "{approversRequired} approver(s) must approve before the bank issues it. Nothing has left your account." Reference `LCR-20261102-0931`. Buttons: "Track request" (Trade › Tracking), "Go to Trade" (`exit`), "Done".
**`failed`**: per error code (section 4).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `INVALID_AMOUNT` | "Enter an amount in {currency} with at most {digits} decimal places." | `terms` | Change amount |
| `CURRENCY_NOT_SUPPORTED` | "We don't offer letters of credit in that currency." | `terms` | Choose currency |
| `TRADE_FACILITY_EXCEEDED` | "This is above your available trade line of {available}. Ask for a higher line or lower the amount." | `terms` | Change amount / Request more room |
| `EXPIRY_INVALID` | "Choose a date from 9 Nov 2026 to 2 Nov 2027." | `terms` | Change date |
| `SHIPMENT_DATE_INVALID` | "Latest shipment must be at least 5 days before expiry." | `goods` | Change date |
| `SANCTIONS_SCREENING_HIT` | "We can't process this request. Contact your relationship manager. Nothing was changed." | `failed` | Back to Trade |
| `TRADE_NOT_ENABLED` | "Trade finance isn't set up for {company}. Ask your relationship manager." | `denied` | Back |
| `NOT_AUTHORISED` | "{user} is not allowed to start trade requests." | `denied` | Back |
| `ACCOUNT_NOT_FOUND` / `INSUFFICIENT_FUNDS` | "We can't find that account. Choose another." / "There isn't enough money in {account} for the fees. Available: {balance}." | `documents` | Choose account |
| `DUPLICATE_REQUEST` | "This request was already sent. See it in Tracking." | `failed` | Check tracking |
| `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`, `FILE_UNREADABLE` | as field errors above | `documents` | Replace file |
| `QUOTE_EXPIRED` (fee quote valid 5 minutes) | "The fee quote has run out. We have priced it again." | `review` | Review again |
| `S-OTP_INVALID`, `S-OTP_REQUIRED`, `S-CORE_UNAVAILABLE`, `S-TIMEOUT`, `S-SERVICE_UNAVAILABLE`, `S-PERMISSION_DENIED` | standard | as listed | – |

#### 5. Adapters
| Integration id | Adapter | Notes |
|---|---|---|
| `facility` | `corp.trade.facility.get` | on entry |
| `accounts` | `corp.company.get` (existing) | fee accounts |
| `quote` | `corp.trade.lc.quote` | on `terms` Next |
| `upload` | `corp.trade.documents.upload` | on file pick |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` (existing) | |
| `issue` | `corp.trade.lc.issue` | after OTP |

#### 6. Permissions, step-up, limits
`biz.trade.initiate`; step-up `otp`; the Maker's daily personal limit (`LIMIT_USER_EXCEEDED`) does not apply because no cash moves; trade line applies. Approval: one approver, or two if the USD equivalent is above 250,000. Cut-off 16:00 UTC; after it the value date is the next working day and the review shows "After today's cut-off: dated {date}."

#### 7. Result and links out
Result `success` above. Receipt: request id, terms summary, fees quoted, approvers needed. Notifications: to approvers "LC request awaiting your approval, {company}" (links to `approve-trade-request`); to the Maker when issued "Letter of credit {number} issued". Buttons lead: Track request → Trade › Tracking filtered to the request; Done → Trade overview.

#### 8. Acceptance criteria
- AC-1: A request within the trade line is accepted and waits for approval; no fee is debited yet.
- AC-2: A request above the available trade line is refused with `TRADE_FACILITY_EXCEEDED` and nothing is reserved.
- AC-3: Expiry must be 7 to 365 days away and latest shipment at least 5 days before expiry.
- AC-4: A seller or country on the sanctions list is refused and no request exists.
- AC-5: Without a verified code the request is refused; three wrong codes end the journey.
- AC-6: A timeout leaves no request, or exactly one request when the retry arrives with the same `requestKey`.
- AC-7: Above 250,000 USD equivalent two different approvers are required.

#### 9. Scenarios
| Id | Covers | Persona and setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex at Alpha; 100,000 USD at sight, expiry 20 Dec 2026, shipment 1 Dec 2026 | `pending_approval`, approversRequired 1, facility reserved 100,000, fee account balance unchanged |
| T-2 | AC-2 | line available 1,360,000; request 1,400,000 | `TRADE_FACILITY_EXCEEDED`, stays on `terms` |
| T-3 | AC-3 | expiry 5 Nov 2026; then shipment 18 Dec for expiry 20 Dec | `EXPIRY_INVALID`; `SHIPMENT_DATE_INVALID` |
| T-4 | AC-4 | seller "Embargo Metals Ltd" | `SANCTIONS_SCREENING_HIT`, no request in Tracking |
| T-5 | AC-5 | submit without OTP; then three wrong codes | `OTP_REQUIRED`; `OTP_INVALID` x3 then "Start again" |
| T-6 | AC-6 | conditions `timeout: [corp.trade.lc.issue]` then clear and retry | `timeout` screen; after retry exactly one request |
| T-7 | AC-6 | conditions `unavailable: [corp.trade.lc.quote]` | `unavailable` screen, nothing changed |
| T-8 | AC-7 | amount 300,000 | approversRequired 2 |
| T-9 | AC-1 | Alex at Beta (no `biz.trade.initiate`) | launch point hidden; direct deep link gives `PERMISSION_DENIED` |

#### 10. Expected mutation-check survivors
Bank rules switched off one at a time (`facility`, `sanctions`, `expiryWindow`, `dualApproval`, `dedupe`) are each killed by T-2, T-4, T-3, T-8, T-6. Expected survivors: the `quoteTtl` rule (the sandbox quote lasts 5 minutes and no scenario waits that long without a clock hook: add one if the engine gets `now`), and the SWIFT-fee constant (same fee shown in review and result; the test reads review only).

---

### ★ Amend a letter of credit — `amend-lc`

#### 1. Summary
| | |
|---|---|
| Slug | `amend-lc` |
| Purpose | Change an LC we issued (import), or accept or refuse a change the buyer's bank sent on an LC we received (export). |
| Release / workspace / status | 3 / business / New (planned) |
| Starting pattern | Mode screen then form, review, consent, OTP |
| Who | `biz.trade.amend` |

#### 2. Entry points
Trade › LC detail › Amend `{lcId}` (import, status `issued`); Trade › overview › needs action row (export amendment) `{lcId, amendmentId}`; notification "Amendment received". Permission `biz.trade.amend`.

#### 3. Screens
**`mode`** (skipped when launched with `amendmentId`): `select` tiles "Change this letter of credit" / "Answer a change we received" (only offered when one is waiting).
**`changes`** (import): `reviewSummary` of current terms (read only). Fields:
| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| New amount | `amountInput` | no | above 0; at most +25% of current without a new request; within facility | "Enter an amount above 0." / "Increases above 25% need a new letter of credit." |
| New expiry | `datePicker` | no | after current expiry, at most 365 days from today | "Choose a date after {expiry} and before 2 Nov 2027." |
| New latest shipment | `datePicker` | no | before the (new) expiry less 5 days | "Latest shipment must be at least 5 days before expiry." |
| Goods description | `textInput` `lines: 4` | no | 10–600 chars | "Describe the goods in 10 to 600 characters." |
| Reason | `textInput` | yes | 10–200 chars | "Tell the bank why you are changing it (10 to 200 characters)." |
Rule: at least one change (`NOTHING_CHANGED`: "You haven't changed anything.").
**`respondAmendment`** (export): `documentViewer` with the amendment text (must reach end before buttons wake); `select` rows Accept / Refuse; if Refuse, `textInput` "Reason" (5–200 chars, "Tell us why you refuse (5 to 200 characters).").
**`review`**, **`consent`** ("I confirm the changes are correct and ask the bank to send them. The amendment fee of 75.00 USD will be debited."), **`otp`** (action "send amendment"), **`success`** "Amendment sent for approval" reference `AMR-20261102-0932` (import) or "You {accepted/refused} the amendment" (export).

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `LC_NOT_FOUND` | "We can't find that letter of credit." | `denied`-style `failed` | Back to Trade |
| `LC_NOT_AMENDABLE` | "This letter of credit can't be changed because it is {status}." | `failed` | Back |
| `AMENDMENT_PENDING` | "A change is already waiting. Wait for it to finish or withdraw it first." | `failed` | Open amendment |
| `NOTHING_CHANGED` | "You haven't changed anything." | `changes` | Edit |
| `EXPIRY_INVALID`, `SHIPMENT_DATE_INVALID` | as in `issue-import-lc` | `changes` | Change date |
| `TRADE_FACILITY_EXCEEDED` | "The new amount is above your available trade line of {available}." | `changes` | Change amount |
| `AMENDMENT_NOT_FOUND` / `AMENDMENT_NOT_PENDING` | "That change isn't waiting for an answer any more." | `failed` | Back |
| `S-…` standard six | | | |

#### 5. Adapters
`lc` `corp.trade.lc.get`; `amend` `corp.trade.lc.amend`; `respond` `corp.trade.amendment.respond`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.amend`; `otp`; approval rule as issue for import amendments that raise the amount or extend dates; export acceptance needs no approver (it creates no new liability) unless amount affects our financing.

#### 7. Result and links out
Receipt: amendment number, before/after table. Notifications: approvers (import); Maker when beneficiary accepts or refuses. Buttons: Track → LC detail timeline; Done → LC detail.

#### 8. Acceptance criteria
- AC-1: An import change is sent for approval and the LC stays unchanged until approved and accepted.
- AC-2: Only one change can be open per LC.
- AC-3: A change that raises the amount beyond the trade line is refused.
- AC-4: Accepting or refusing an export amendment records the decision and the reason.
- AC-5: Without OTP nothing is sent; timeout and unavailable change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex, LC `ILC-1`, new expiry +30 days | `pending_approval`; LC expiry unchanged |
| T-2 | AC-2 | second amend on same LC | `AMENDMENT_PENDING` |
| T-3 | AC-3 | amount +300,000 with 100,000 available | `TRADE_FACILITY_EXCEEDED` |
| T-4 | AC-4 | export LC with open amendment; refuse with reason | status `refused`, reason on timeline |
| T-5 | AC-5 | no OTP; then `timeout: [corp.trade.lc.amend]`; then `unavailable` | `OTP_REQUIRED`; timeout screen; unavailable screen; amendments list unchanged |

#### 10. Expected mutation-check survivors
None expected for rule switches `onePending`, `facility`. Survivor: the 25% rule if no scenario tests exactly 25.01% (add boundary scenario T-6; until then listed).

---

### ★ Present documents under an export LC — `present-documents`

#### 1. Summary
| | |
|---|---|
| Slug | `present-documents` |
| Purpose | Upload the shipping documents for an export LC, check them against its terms before sending, and present them to the bank. |
| Release / workspace / status | 3 / business / New (planned) |
| Starting pattern | File upload with a pre-check (new) |
| Who | `biz.trade.documents` |

#### 2. Entry points
Trade › LC detail (export, status `advised`) › Present documents `{lcId}`. Notification "Shipment date reached". Permission `biz.trade.documents`.

#### 3. Screens
**`checklist` — "Documents to present".** `alert` info "Present within {presentationDays} days of shipment and before the LC expires on {expiry}. Days left: {daysLeft}." `checklist` (or `reviewSummary`) rows, one per required document with a `fileUpload` each.
| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| Commercial invoice | `fileUpload` | yes | PDF/JPG/PNG/TIF, 10 MB, 1 file | "Add the commercial invoice." |
| Packing list, Bill of lading, Certificate of origin, Insurance, Inspection | `fileUpload` | as the LC requires | same | "Add the {document}." |
| Shipment date on the bill of lading | `datePicker` | yes | not after latest shipment shown as warning, not block | "This date is after the latest shipment date of {date}. The bank will find a discrepancy." |
| Covering note | `textInput` `lines: 3` | no | max 300 | "Keep the note under 300 characters." |
Upload errors: `FILE_TYPE_NOT_ALLOWED` "This file type isn't allowed. Use PDF, JPG, PNG or TIF."; `FILE_TOO_LARGE` "This file is over 10 MB. Compress it or split it."; `FILE_UNREADABLE` "We couldn't read this file. Try a clearer copy." Buttons: "Check my documents" (calls `check`), "Save and close" (keeps uploads 7 days), "Cancel".
**`precheck` — "Check result".** If `ok`: `result`-like `alert` success "No differences found. You can present." Otherwise a table (`dataTable`): Document, Difference, Severity. Example row: "Commercial invoice | Amount 119,500.00 USD is more than the LC amount 100,000.00 USD (limit 105,000.00 with 5% tolerance)". Buttons: "Fix and re-check" (back to `checklist`), "Present anyway" (shown only when no blocking error; text "The bank may refuse. A discrepancy fee of 60.00 USD applies.").
**`review`**, **`consent`** ("I confirm these documents are true copies and ask the bank to examine them under {lcNumber}."), **`otp`** (action "present documents"), **`success`** "Documents presented" reference `PRS-20261102-0933` with "The issuing bank has 5 working days to examine them." Failure copy per code.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `LC_NOT_FOUND` | "We can't find that letter of credit." | `failed` | Back to Trade |
| `LC_EXPIRED` | "This letter of credit expired on {date}. Documents can't be presented." | `failed` | Back |
| `PRESENTATION_LATE` | "These documents are late: shipment was {n} days ago and the limit is {presentationDays}. The bank can refuse them." | `precheck` | Present anyway / Cancel |
| `DOCUMENT_SET_INCOMPLETE` | "Missing: {list}. Add them to continue." | `checklist` | Add documents |
| `DUPLICATE_REQUEST` | "These documents were already presented. See Tracking." | `failed` | Check tracking |
| `FILE_*` | as above | `checklist` | Replace file |
| `S-OTP_INVALID`, `S-OTP_REQUIRED`, `S-TIMEOUT`, `S-SERVICE_UNAVAILABLE`, `S-PERMISSION_DENIED` | standard | | |

#### 5. Adapters
`lc` `corp.trade.lc.get`; `upload` `corp.trade.documents.upload` (per file); `check` `corp.trade.documents.check`; `present` `corp.trade.documents.present`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.documents`; `otp`; no approver needed (documents are not a payment) but audited; files are scanned (sandbox rejects names containing `virus` with `FILE_UNREADABLE`).

#### 7. Result and links out
Receipt: presentation id, list of documents with sizes and times, deadline for the bank. Notifications: Maker "Documents presented"; later "Bank accepted documents" or "Discrepancies found". Buttons: Track → LC detail timeline; Done.

#### 8. Acceptance criteria
- AC-1: A complete, correct set is presented and the LC moves to `documents_presented`.
- AC-2: A missing required document blocks the pre-check.
- AC-3: Differences found by the checker are shown before presenting, each with its document and reason.
- AC-4: Late presentation is warned and, if the person goes on, the discrepancy is recorded.
- AC-5: Wrong file types, over-size and unreadable files are refused with the right message.
- AC-6: Without OTP, or on timeout or unavailable, nothing is presented.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; export LC 100,000 USD; invoice tag `inv_amount=100000`, all documents | check `ok`, presented, status `documents_presented` |
| T-2 | AC-2 | no bill of lading | `DOCUMENT_SET_INCOMPLETE` "Missing: Bill of lading." |
| T-3 | AC-3 | `inv_amount=119500` | discrepancy `AMOUNT_EXCEEDS_LC` shown |
| T-4 | AC-4 | shipment 30 days ago, window 21 | `PRESENTATION_LATE`, present anyway creates `discrepant` |
| T-5 | AC-5 | upload `notes.exe`; 12 MB file; `virus.pdf` | three messages |
| T-6 | AC-6 | no OTP; `timeout: [corp.trade.documents.present]`; `unavailable: [corp.trade.documents.check]` | `OTP_REQUIRED`; timeout screen then one presentation after retry; unavailable screen |

#### 10. Expected mutation-check survivors
Switching off tolerance (5%) survives if T-3 only tests 19.5% over; add T-3b at +4% (accepted) and +6% (rejected). Until added: survivor `tolerance`, reason "boundary not tested".

---

### ★ Respond to discrepancies and settle — `respond-to-discrepancies`

#### 1. Summary
| | |
|---|---|
| Slug | `respond-to-discrepancies` |
| Purpose | As the buyer (import LC), read the differences the bank found in the seller's documents, and accept them (and pay or set the due date) or refuse them. |
| Release / workspace / status | 3 / business / New (planned) |
| Starting pattern | Document review with decision, consent, OTP |
| Who | `biz.trade.documents`; approval when settlement above the Maker's limit |

#### 2. Entry points
Trade › LC detail (status `discrepant`) › Respond `{presentationId}`; notification "Discrepancies found: respond by {date}"; Trade › overview needs-action row. Permission `biz.trade.documents`.

#### 3. Screens
**`notice` — "Discrepancies".** `alert` warning "The documents have {n} difference(s). You must answer by {respondBy} ({daysLeft} days left)." `dataTable` Document | Difference | Severity. `documentViewer` for the discrepancy notice (confirm wakes after scroll end). Buttons: "Continue".
**`decision`** — `select` rows: "Accept the differences" / "Refuse the documents". Accept: `accountPicker` "Pay from" (for sight LCs) required ("Choose the account to pay from."). Refuse: `textInput` Reason lines 3, 10–300 chars ("Tell the bank why you refuse (10 to 300 characters)."). A `toggle` "Hold the documents at my disposal" for refuse.
**`review`**: rows Decision, Amount {amount} {currency}, Pay from, Value date (and "dated next working day" after 16:00 UTC), Discrepancy fee 60.00 USD, Total debit. For accept at usance: "Payment due {maturityDate}". **`consent`** (accept): "I accept the differences listed. I ask the bank to pay {amount} {currency} on {date} and debit {account}. I understand this may be hard to undo." (refuse): "I refuse the documents for the reasons given." **`otp`**; **`success`**: "Documents accepted" (reference `SET-20261102-0934`, "Paid {amount}" or "Payment due {date}") or "Documents refused".

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `PRESENTATION_NOT_FOUND` | "We can't find those documents." | `failed` | Back |
| `DISCREPANCY_DEADLINE_PASSED` | "The time to answer ran out on {date}. The bank has returned the documents." | `failed` | Back to LC |
| `ACCOUNT_NOT_FOUND` | standard | `decision` | Choose account |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Available: {balance}. No money has left your account." | `decision` | Change account |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit. Try again tomorrow or ask an administrator." | `failed` | Back |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. No money has left your account." | `failed` | Try again |
| `S-OTP_*`, `S-TIMEOUT` (money wording: "Check Activity before you try again, so you don't pay twice."), `S-SERVICE_UNAVAILABLE`, `S-PERMISSION_DENIED` | standard | | |

#### 5. Adapters
`disc` `corp.trade.discrepancy.get`; `accounts` `corp.company.get`; `respond` `corp.trade.discrepancy.respond`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.documents`; `otp`, and `stepup` if the amount is over 250,000 USD equivalent (README 4.3 approving above a threshold). Company daily limit applies on accept at sight. Cut-off 16:00 UTC.

#### 7. Result and links out
Receipt: decision, amount, value date, fee, reference. Notifications: Approvers FYI; Maker. Buttons: Track → LC detail; "Apply for financing" (only for accepted usance LC) → `apply-trade-loan` `{lcId}`; Done.

#### 8. Acceptance criteria
- AC-1: Accepting at sight debits the chosen account on the value date and the LC moves to `settled`.
- AC-2: Accepting at usance records the maturity date and debits nothing now.
- AC-3: Refusing records the reason and debits nothing.
- AC-4: After the deadline no decision can be made.
- AC-5: Insufficient funds stops an accept with no debit.
- AC-6: Timeout or unavailable leaves the decision open; a retry cannot pay twice.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; sight LC 100,000; Main balance enough | balance down by 100,060.00; `settled` |
| T-2 | AC-2 | 60-day LC | maturity = value date + 60; balance unchanged |
| T-3 | AC-3 | refuse, reason 20 chars | `refused`; balance unchanged |
| T-4 | AC-4 | now = deadline + 1 day | `DISCREPANCY_DEADLINE_PASSED` |
| T-5 | AC-5 | account balance 50,000 | `INSUFFICIENT_FUNDS`; balance unchanged |
| T-6 | AC-6 | `timeout: [corp.trade.discrepancy.respond]`, then retry with same key | timeout screen; balance debited once |
| T-7 | AC-6 | `unavailable` | unavailable screen, nothing changed |

#### 10. Expected mutation-check survivors
Survivor: the discrepancy fee (60.00) if no scenario asserts the exact debit; T-1 asserts it, so none expected.

---

## Guarantees

### ★ Request a bank guarantee — `request-guarantee`

#### 1. Summary
| | |
|---|---|
| Slug | `request-guarantee` |
| Purpose | Ask the bank to issue a guarantee (bid, advance payment, performance or payment) in favour of a third party. |
| Release / workspace / status | 3 / business / New (planned) |
| Who | `biz.trade.initiate` |

#### 2. Entry points
Trade › overview + Request a guarantee; Trade › guarantees › Request a guarantee. Nothing passed. Permission `biz.trade.initiate`.

#### 3. Screens
**`type`** `select` tiles: Bid bond, Advance payment, Performance, Payment. Helper under each, e.g. Bid bond "Shows you are serious when you bid on a contract."
**`details`**
| Field | Block | Required | Validation | Error |
|---|---|---|---|---|
| Beneficiary name | `textInput` | yes | 2–70 chars | "Enter the beneficiary's name." |
| Beneficiary country, address | `select`, `textInput` | yes | address 5–120 chars | "Enter the beneficiary's address." |
| Currency | `select` | yes | list from `fx.ts` | "Choose a currency." |
| Amount | `amountInput` | yes | above 0, at most available line | "Enter an amount above 0." / "This is above your available trade line of {available}." |
| Expiry date | `datePicker` | yes | 30 Nov 2026 to 2 Nov 2028 | "Choose a date from 30 Nov 2026 to 2 Nov 2028." |
| Days to claim after expiry | `select` | yes | 0, 30, 90 | "Choose how long the beneficiary may claim after expiry." |
| Underlying contract reference | `textInput` | yes | 3–40 chars | "Enter the contract reference." |
| Fee account (the account that is debited) | `accountPicker` | yes | | "Choose an account for the fees." |
**`wording`** `select` tiles "Bank standard wording" / "Our own wording". Own wording: `fileUpload` (PDF, 10 MB) required ("Add your wording as a PDF.") with `alert` info "The bank's legal team reviews custom wording. This can take 2 working days." Standard: `documentViewer` shows the wording; must reach the end.
**`indemnity`** `documentViewer` of the counter-indemnity ("We promise to repay the bank anything it pays under this guarantee"), `signature` (typed full name must equal the user's name; error "Type your full name exactly as shown: {name}.").
**`review`**, **`consent`** ("I confirm the details are correct and I accept the counter-indemnity."), **`otp`**, **`success`** "Sent for approval" (or "Sent for legal review" for custom wording) reference `GRR-20261102-0935`.

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `TRADE_FACILITY_EXCEEDED`, `EXPIRY_INVALID`, `SANCTIONS_SCREENING_HIT`, `TRADE_NOT_ENABLED`, `DUPLICATE_REQUEST` | as in `issue-import-lc` | their screens | |
| `CUSTOM_WORDING_REVIEW` (not an error: status `in_review`) | "Your wording needs a legal review. We will tell you within 2 working days." | `success` | Track |
| `NOT_AUTHORISED` | "{user} is not allowed to start trade requests." | `denied` | Back |
| `S-OTP_*`, `S-TIMEOUT`, `S-SERVICE_UNAVAILABLE`, `S-CORE_UNAVAILABLE` | standard | | |

#### 5. Adapters
`facility`, `accounts`, `upload`, `issue` = `corp.trade.guarantee.issue`, `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.initiate`; `otp` plus the typed signature; approval 1 or 2 (above 250,000 USD equivalent); fee 1.00% a year, minimum 100.00 USD, shown on review.

#### 7. Result and links out
Receipt: request id, terms, fee quote, counter-indemnity accepted at {time}. Notifications to approvers. Buttons: Track; Done.

#### 8. Acceptance criteria
- AC-1: A valid request goes for approval and reserves the amount on the trade line.
- AC-2: Counter-indemnity needs the exact typed name and the code; otherwise nothing is sent.
- AC-3: Custom wording makes the request `in_review`, standard wording does not.
- AC-4: Above the trade line, or sanctioned beneficiary, is refused.
- AC-5: Timeout and unavailable leave exactly zero or one request.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; performance 50,000 USD, expiry 31 Dec 2027 | `pending_approval`, reserved 50,000 |
| T-2 | AC-2 | name typed "alex morgan" | field error; with exact name and wrong code x3 "Start again" |
| T-3 | AC-3 | custom wording PDF | status `in_review` |
| T-4 | AC-4 | amount above available; beneficiary "Embargo Works" | `TRADE_FACILITY_EXCEEDED`; `SANCTIONS_SCREENING_HIT` |
| T-5 | AC-5 | `timeout` then retry same key; `unavailable` | one request; nothing |

#### 10. Expected mutation-check survivors
Survivor: `claimByDays` options (0/30/90) since no scenario checks the stored claim-by date; add an assertion in T-1 to kill it.

---

### ★ Amend a guarantee — `amend-guarantee`

#### 1. Summary
| | |
|---|---|
| Slug / status | `amend-guarantee` / New (planned), Release 3, business |
| Purpose | Extend the expiry or change the amount of a guarantee we asked for. |
| Who | `biz.trade.amend` |

#### 2. Entry points
Trade › guarantee detail › Amend `{guaranteeId}`; notification "Guarantee expires in 14 days: extend?".

#### 3. Screens
**`changes`**: current terms (`reviewSummary`). Fields: New amount (`amountInput`, optional; "Enter an amount above 0."; decrease is allowed only with beneficiary consent, shown as `alert` "The beneficiary must agree to a lower amount."), New expiry (`datePicker`, after current, at most 2 Nov 2028; "Choose a date after {expiry}."), Reason (`textInput`, 10–200; "Tell the bank why (10 to 200 characters)."). At least one change ("You haven't changed anything."). **`review`** with amendment fee 75.00 USD and pro-rata guarantee fee, **`consent`** ("I ask the bank to change this guarantee. The beneficiary may have to agree."), **`otp`**, **`success`** "Amendment sent for approval" `GAM-20261102-0936`.

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `GUARANTEE_NOT_FOUND` | "We can't find that guarantee." | `failed` |
| `GUARANTEE_NOT_AMENDABLE` | "This guarantee can't be changed because it is {status}." | `failed` |
| `AMENDMENT_PENDING`, `NOTHING_CHANGED`, `EXPIRY_INVALID`, `TRADE_FACILITY_EXCEEDED` | as `amend-lc` | `changes` |
| `S-OTP_*`, `S-TIMEOUT`, `S-SERVICE_UNAVAILABLE`, `S-PERMISSION_DENIED` | standard | |

#### 5. Adapters
`guarantee` `corp.trade.guarantee.get`; `amend` `corp.trade.guarantee.amend`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.amend`; `otp`; approval as issue when the amount or expiry grows.

#### 7. Result and links out
Receipt with before/after. Buttons: Track → guarantee detail; Done.

#### 8. Acceptance criteria
- AC-1: An extension is sent for approval; the guarantee is unchanged until effective.
- AC-2: Only one open amendment per guarantee.
- AC-3: A bigger amount beyond the trade line is refused.
- AC-4: Timeout, unavailable and missing code change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; extend 90 days | pending; expiry unchanged |
| T-2 | AC-2 | second amend | `AMENDMENT_PENDING` |
| T-3 | AC-3 | amount +2,000,000 | `TRADE_FACILITY_EXCEEDED` |
| T-4 | AC-4 | no OTP; timeout; unavailable | `OTP_REQUIRED`; timeout; unavailable; unchanged |

#### 10. Expected mutation-check survivors
Survivor: pro-rata fee arithmetic (shown, not asserted); mark it asserted in T-1 to kill.

---

### ★ Respond to a guarantee claim — `respond-to-guarantee-claim`

#### 1. Summary
| | |
|---|---|
| Slug / status | `respond-to-guarantee-claim` / New (planned), Release 3, business |
| Purpose | The beneficiary demanded payment. Either pay it or dispute it within 5 working days. |
| Who | `biz.trade.documents` |

#### 2. Entry points
Trade › guarantee detail (claim open) › Respond `{claimId}`; notification "Guarantee claim received".

#### 3. Screens
**`claim`**: `alert` warning "{beneficiary} claims {amount} {currency}. Answer by {date} ({days} working days left). If you do nothing the bank pays and debits you." `documentViewer` of the claim letter. **`decision`**: `select` rows "Pay the claim" / "Dispute the claim". Pay: `accountPicker` "Pay from" ("Choose the account to pay from."). Dispute: `textInput` lines 4, 20–500 chars ("Explain why the claim is wrong (20 to 500 characters)."), optional `fileUpload` evidence (PDF, 10 MB). **`review`** (amount, account, value date), **`consent`** pay: "I agree that the bank pays this claim and debits {account}. This follows our counter-indemnity." dispute: "I dispute this claim for the reasons given." **`otp`**, **`success`** "Claim paid" `CLM-20261102-0937` or "Claim disputed".

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `CLAIM_NOT_FOUND` | "We can't find that claim." | `failed` |
| `CLAIM_DEADLINE_PASSED` | "The time to answer ran out on {date}. The bank has already paid {amount}." | `failed` |
| `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `CORE_UNAVAILABLE` | standard (INSUFFICIENT_FUNDS: "There isn't enough money in {account}. Available: {balance}. No money has left your account.") | `decision` / `failed` |
| `S-OTP_*`, `S-TIMEOUT`, `S-SERVICE_UNAVAILABLE`, `S-PERMISSION_DENIED` | standard | |

#### 5. Adapters
`claim` `corp.trade.guarantee.get`; `accounts`; `respond` `corp.trade.claim.respond`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.documents`; `stepup` for paying a claim (README 4.3, money out under a commitment) then code; company daily limit applies to a payment; cut-off 16:00 UTC.

#### 7. Result and links out
Receipt: claim, decision, amount. Notification to approvers/admin. Buttons: Track → guarantee detail; Done.

#### 8. Acceptance criteria
- AC-1: Paying debits the chosen account and records the payment.
- AC-2: Disputing needs a reason and debits nothing.
- AC-3: After the deadline no answer is accepted.
- AC-4: Insufficient funds stops the payment with no debit.
- AC-5: Timeout never pays twice; unavailable changes nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; claim 40,000 | account −40,000; claim `paid` |
| T-2 | AC-2 | dispute 19-char reason; then 25 chars | field error; then `disputed` |
| T-3 | AC-3 | now = deadline+1 | `CLAIM_DEADLINE_PASSED` |
| T-4 | AC-4 | balance 10,000 | `INSUFFICIENT_FUNDS` |
| T-5 | AC-5 | timeout then retry same key; unavailable | one debit; nothing |

#### 10. Expected mutation-check survivors
None expected.

---

## Collections

### ★ Send documents for collection — `documentary-collection`

#### 1. Summary
| | |
|---|---|
| Slug / status | `documentary-collection` / New (planned), Release 3, business |
| Purpose | We are the seller. Send our documents to the buyer's bank, which hands them over against payment (D/P) or acceptance of a time draft (D/A). The bank gives no promise to pay. |
| Who | `biz.trade.initiate` |

#### 2. Entry points
Trade › collections › New collection. Permission `biz.trade.initiate`.

#### 3. Screens
**`buyer`**: Buyer name (`textInput`, 2–70, "Enter the buyer's name."), Country (`select`), Buyer's bank and BIC (as `issue-import-lc`), Currency, Invoice amount (`amountInput`, "Enter an amount above 0."), Mode `select` tiles "Documents against payment (D/P)" "Documents against acceptance (D/A)"; D/A shows Days `select` 30, 60, 90 ("Choose the days."). **`documents`**: `fileUpload` for invoice (required), bill of lading (required), others; "Add the invoice." / "Add the bill of lading."; errors for files as `present-documents`. **`instructions`**: `toggle` Protest if unpaid, `toggle` Waive bank charges to the buyer, `textInput` lines 3 Special instructions (max 300). **`review`** with fee (0.15%, minimum 50, maximum 500 USD), **`consent`** ("I ask the bank to send these documents on these instructions. The bank does not promise that the buyer pays."), **`otp`**, **`success`** "Sent for approval" `COL-20261102-0938`.

#### 4. Sandbox errors
`INVALID_AMOUNT` ("Enter an amount in {currency} with at most {digits} decimal places."), `CURRENCY_NOT_SUPPORTED`, `SANCTIONS_SCREENING_HIT`, `DOCUMENT_SET_INCOMPLETE` ("Missing: {list}."), `DUPLICATE_REQUEST`, `FILE_*`, `NOT_AUTHORISED` (denied), and the standard six.

#### 5. Adapters
`upload`, `create` `corp.trade.collection.create`, `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.initiate`; `otp`; approval rule as LC but no trade-line reserve (no bank commitment).

#### 7. Result and links out
Receipt: collection id, documents, instructions. Notifications: approvers; later "Buyer paid" or "Buyer has not paid; protest?". Buttons: Track → collection detail; Done.

#### 8. Acceptance criteria
- AC-1: A valid outward collection goes for approval; no trade line is used.
- AC-2: Invoice and bill of lading are mandatory.
- AC-3: D/A requires a tenor of 30, 60 or 90 days.
- AC-4: Sanctioned buyer is refused.
- AC-5: Timeout, unavailable and missing code change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; D/P 25,000 EUR | pending; facility used unchanged |
| T-2 | AC-2 | no bill of lading | `DOCUMENT_SET_INCOMPLETE` |
| T-3 | AC-3 | D/A without days | validation error |
| T-4 | AC-4 | buyer "Embargo Trading" | `SANCTIONS_SCREENING_HIT` |
| T-5 | AC-5 | no OTP; timeout; unavailable | each changes nothing |

#### 10. Expected mutation-check survivors
Survivor: fee cap of 500 USD (no scenario above 333,333 USD); add T-6 with 400,000 to kill.

---

### ★ Pay or accept an inward collection — `accept-collection`

#### 1. Summary
| | |
|---|---|
| Slug / status | `accept-collection` / New (planned), Release 3, business |
| Purpose | We are the buyer. Documents arrived. Pay now (D/P) or accept a time draft (D/A) to receive them, or refuse. |
| Who | `biz.trade.documents` |

#### 2. Entry points
Trade › collection detail (inward, open) › Pay or accept `{collectionId}`; notification "Documents arrived for collection".

#### 3. Screens
**`documents`**: `reviewSummary` (drawer, amount, mode, due date) and `documentViewer` list of the received documents. **`decision`**: D/P: "Pay now" / "Refuse"; D/A: "Accept and pay on {maturity}" / "Refuse". Pay: `accountPicker` (error "Choose the account to pay from."). Refuse: reason (`textInput`, 10–300; "Tell the bank why you refuse (10 to 300 characters)."). **`review`**, **`consent`** ("I agree to pay {amount} {currency} on {date}." / "I refuse these documents."), **`otp`**, **`success`** "Paid, documents released" `PAY-20261102-0939` / "Accepted, due {date}" / "Refused".

#### 4. Sandbox errors
`COLLECTION_NOT_FOUND` ("We can't find that collection."), `COLLECTION_NOT_OPEN` ("This collection was already answered or has been returned."), `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS` (standard wording), `CORE_UNAVAILABLE`, `LIMIT_COMPANY_EXCEEDED`, and the standard six (money TIMEOUT wording).

#### 5. Adapters
`collection` (get via `corp.trade.tracking` + detail), `accounts`, `respond` `corp.trade.collection.respond`, `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.documents`; `otp`; `stepup` above 250,000 USD equivalent; company daily limit on D/P.

#### 7. Result and links out
Receipt with reference. Buttons: Track; "Apply for financing" (if D/A) → `apply-trade-loan` `{invoiceRef}`; Done.

#### 8. Acceptance criteria
- AC-1: D/P debits the chosen account and releases the documents.
- AC-2: D/A records a due date and debits nothing now.
- AC-3: Refuse needs a reason and debits nothing.
- AC-4: An already-answered collection cannot be answered again.
- AC-5: Insufficient funds, timeout, unavailable never lose or double money.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; D/P 25,000 | debit 25,000; `paid` |
| T-2 | AC-2 | D/A 60 days | due +60; no debit |
| T-3 | AC-3 | refuse with 9-char reason; then 12 chars | field error; `refused` |
| T-4 | AC-4 | answer twice | second gives `COLLECTION_NOT_OPEN` |
| T-5 | AC-5 | balance low; timeout+retry; unavailable | `INSUFFICIENT_FUNDS`; one debit; none |

#### 10. Expected mutation-check survivors
None expected.

---

## Trade loans

### ★ Apply for trade financing — `apply-trade-loan`

#### 1. Summary
| | |
|---|---|
| Slug / status | `apply-trade-loan` / New (planned), Release 3, business |
| Purpose | Borrow short-term against an LC or an invoice: pre-shipment (to buy or make goods), post-shipment (waiting for the buyer to pay), import loan (to pay the seller now and repay later). |
| Who | `biz.trade.finance` |

#### 2. Entry points
Trade › LC detail › Apply for financing `{lcId}`; Trade › financing › Apply `{lcId}` or `{invoiceRef}`; `respond-to-discrepancies` result (usance LC).

#### 3. Screens
**`type`** `select` tiles with helper text for the three types; eligible ones only (from LC status).
**`underlying`**: `select` of LCs eligible (`lcId` prefilled) or `textInput` invoice reference (3–40, "Enter the invoice reference."). **`amount`**: `amountInput` (above 0; at most 90% of underlying: "You can borrow at most {max} against this letter of credit (90%)."), Tenor `select` 30, 60, 90, 120, 180 days ("Choose from 30 to 180 days."), Credit account and Repay account (`accountPicker`; "Choose the account to receive the loan." / "Choose the account to repay from."). Button "See the cost" calls `quote`.
**`quote`**: `reviewSummary` rows Principal, Interest rate 6.25% a year, Interest for the term (principal × 6.25% × days / 360), Arrangement fee 0.20% (minimum 50.00), Maturity date, Total to repay, Trade line used after. `alert` info "This price is held for 5 minutes." Buttons Back, Continue.
**`consent`** ("I ask the bank to lend {principal} {currency} for {days} days. I will repay {total} on {maturity} by debit of {account}."), **`otp`**, **`success`** "Sent for approval" `TLR-20261102-0940` ("The loan is paid into {account} after the last approval.").

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `LOAN_NOT_ELIGIBLE` | "This {type} loan isn't available for this letter of credit." | `type` |
| `INVALID_AMOUNT` | "Enter an amount in {currency} with at most {digits} decimal places." | `amount` |
| `ABOVE_MAX_ADVANCE` | "You can borrow at most {max} against this letter of credit (90%)." | `amount` |
| `TENOR_TOO_LONG` | "The loan can't run past 180 days or the letter of credit's final date." | `amount` |
| `TRADE_FACILITY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED` | as above | `amount` |
| `QUOTE_EXPIRED` | "The price has run out. We have priced it again." | `quote` |
| `QUOTE_USED`, `QUOTE_NOT_FOUND` | "This price was already used." / "We can't find that price." | `quote` |
| `ACCOUNT_NOT_FOUND`, `DUPLICATE_REQUEST` | standard | |
| standard six | | |

#### 5. Adapters
`lcs` `corp.trade.lc.list`; `accounts`; `quote` `corp.trade.loan.quote`; `apply` `corp.trade.loan.apply`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.finance`; `otp`; approval 1 or 2; the loan reserves the trade line; money is paid in on the last approval (a disbursement into our own account, still a controlled step).

#### 7. Result and links out
Receipt: quote and terms. Notification: approvers; Maker "Loan paid". Buttons: Track → loan detail; Done.

#### 8. Acceptance criteria
- AC-1: A valid application goes for approval at the quoted price.
- AC-2: More than 90% of the underlying is refused.
- AC-3: Tenor beyond 180 days is refused.
- AC-4: An expired quote cannot be used; a repriced quote can.
- AC-5: Timeout, unavailable and missing code create no loan.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; LC 100,000 accepted; borrow 80,000 for 90 days | interest 1,250.00 (80,000×6.25%×90/360); pending |
| T-2 | AC-2 | borrow 95,000 | `ABOVE_MAX_ADVANCE` max 90,000 |
| T-3 | AC-3 | 200 days | `TENOR_TOO_LONG` |
| T-4 | AC-4 | clock +6 minutes then Continue | `QUOTE_EXPIRED`; new quote works |
| T-5 | AC-5 | no OTP; timeout then retry; unavailable | none; one; none |

#### 10. Expected mutation-check survivors
Survivor: day-count basis (360 vs 365) only if T-1 uses a different tenor; T-1 uses 90 days, killed. Arrangement fee minimum 50.00 survives unless a scenario borrows under 25,000; add T-6.

---

### ★ Repay or roll over a trade loan — `repay-trade-loan`

#### 1. Summary
| | |
|---|---|
| Slug / status | `repay-trade-loan` / New (planned), Release 3, business |
| Purpose | Pay a loan back in full or part, or roll it over for a new tenor. |
| Who | `biz.trade.finance` |

#### 2. Entry points
Trade › loan detail › Repay or roll over `{loanId, mode}`; notification "Loan due in 3 days".

#### 3. Screens
**`mode`** `select` tiles Pay in full, Pay part, Roll over (only when allowed). **`amount`**: Pay in full shows total due (read only); Pay part: `amountInput` (above 0 and below balance due: "Enter an amount above 0." / "This is more than the {due} due. Choose Pay in full."); Roll over: `select` new tenor 30–180 ("Choose from 30 to 180 days."), interest due now paid. `accountPicker` Pay from ("Choose the account to pay from."). **`review`** (principal, interest, total, new maturity), **`consent`** ("I agree that the bank debits {amount} {currency} from {account} to repay this loan."), **`otp`**, **`success`** "Loan repaid" `REP-20261102-0941` / "Loan rolled over to {date}".

#### 4. Sandbox errors
`LOAN_NOT_FOUND`, `INVALID_AMOUNT`, `ABOVE_BALANCE_DUE` ("This is more than the {due} due. Choose Pay in full."), `ROLLOVER_NOT_ALLOWED` ("This loan can't be rolled over: the letter of credit it rests on has ended."), `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS` (standard), `CORE_UNAVAILABLE`, `TRADE_FACILITY_EXCEEDED` (on rollover), and the standard six.

#### 5. Adapters
`loan` `corp.trade.loan.get`; `accounts`; `repay` `corp.trade.loan.repay`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.trade.finance`; `otp`; `stepup` above 250,000 USD; company daily limit applies; cut-off 16:00 UTC.

#### 7. Result and links out
Receipt: interest paid, principal left. Buttons: Track → loan detail; Done.

#### 8. Acceptance criteria
- AC-1: Paying in full debits principal plus interest and closes the loan and frees the trade line.
- AC-2: A part payment lowers the principal and keeps the maturity.
- AC-3: A rollover pays interest now and sets a new maturity.
- AC-4: Insufficient funds debits nothing.
- AC-5: Timeout never debits twice; unavailable changes nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Alex; loan 80,000 | balance down by 81,250.00; facility reserved −80,000 |
| T-2 | AC-2 | pay 30,000 | principal 50,000 |
| T-3 | AC-3 | roll 60 days | interest debited; maturity moved |
| T-4 | AC-4 | balance 10,000 | `INSUFFICIENT_FUNDS` |
| T-5 | AC-5 | timeout+retry; unavailable | one debit; none |

#### 10. Expected mutation-check survivors
None expected.

---

## Approval

### ★ Approve or reject a trade request — `approve-trade-request`

#### 1. Summary
| | |
|---|---|
| Slug / status | `approve-trade-request` / New (planned), Release 3, business |
| Purpose | An Approver checks a trade request someone else made, and approves or rejects it. The last approval makes it real: fee debit, disbursement, issue. |
| Who | `biz.approvals.approve` |

#### 2. Entry points
Approvals › inbox (type Trade) › Open / Approve / Reject `{requestId}`; notification "Trade request awaiting your approval, {company}" (switch context first).

#### 3. Screens
**`request`**: `reviewSummary` per instrument type (LC terms, guarantee terms, collection, loan quote), made by, made at, approvals so far ("1 of 2"), value date, trade line after. `documentViewer` for attachments. `select` rows "Approve" / "Reject". Reject shows `textInput` Reason (optional, max 200). **`consent`** ("I have read this request and approve it."), **`otp`**, **`success`** "Approved" or "Approved: {n} more needed" or "Released: {instrument} {number}" or "Rejected".

#### 4. Sandbox errors
| Code | Message | Screen |
|---|---|---|
| `NOT_AUTHORISED` | "{user} is not allowed to approve." | `denied` |
| `SELF_APPROVAL` | "You can't approve a request you started." | `failed` |
| `ALREADY_APPROVED` | "You already approved this. Another approver is needed." | `failed` |
| `REQUEST_NOT_FOUND`, `REQUEST_NOT_PENDING` | "That request isn't waiting for approval any more." | `failed` |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit; your approval was not counted." | `failed` |
| `TRADE_FACILITY_EXCEEDED` | "The trade line no longer covers this. Your approval was not counted." | `failed` |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account} for the fees. Your approval was not counted." | `failed` |
| standard six | | |

#### 5. Adapters
`pending` `corp.trade.pending`; `approve` `corp.trade.approve`; `reject` `corp.trade.reject`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.approvals.approve`; `otp`; `stepup` when the USD equivalent is above 250,000 or the approver is the second approver of a dual request. Same-person rule (`SELF_APPROVAL`).

#### 7. Result and links out
Receipt on release. Notifications: Maker. Buttons: Next request (inbox), Track, Done.

#### 8. Acceptance criteria
- AC-1: A different approver's approval releases a single-approval request and debits the fee.
- AC-2: A dual request needs two different approvers.
- AC-3: Nobody approves their own request.
- AC-4: Reject records the reason and returns the reserved trade line.
- AC-5: If balance or line fails at the last approval, the approval does not count.
- AC-6: Timeout and unavailable change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `dana` approves Alex's 100,000 LC | LC `issued`; fee debited |
| T-2 | AC-2 | 300,000; `dana` then `dana` again; then `lee` | `ALREADY_APPROVED`; released on `lee` |
| T-3 | AC-3 | Alex (if approver at Beta) approves own | `SELF_APPROVAL` |
| T-4 | AC-4 | `lee` rejects | reserve returned |
| T-5 | AC-5 | fee account emptied before approval | `INSUFFICIENT_FUNDS`; still pending |
| T-6 | AC-6 | timeout then retry; unavailable | one approval; none |

#### 10. Expected mutation-check survivors
None expected for `fourEyes`, `dualApproval`, `roles`. Survivor: second-approver `stepup` if the sandbox stepUp is not modelled for scenarios; listed until `bank.session.stepUp` exists.

---

## Open questions

1. Should trade requests share the payment approval engine (one inbox, one queue) or have their own? This spec adds `corp.trade.pending/approve/reject` and a Type filter; sharing is cleaner but changes `approve-payments`.
2. Is the trade line one number for the company, or one per instrument type? This spec uses one.
3. How are documents verified in a real bank (human desk, or OCR)? The sandbox reads tags from file names; the real adapter would return extracted fields and an examiner's notes.
4. Does the company need a counterparty address book (add-supplier-like) for trade? This spec uses free entry with the planned `corp.trade.counterparties.list`.
5. Sanctions screening wording must be approved by compliance: it must not tell the person the reason ("tipping off").
6. Timeout semantics: in the sandbox the request is not applied on `TIMEOUT` (README 1.5), but the copy tells people to check Tracking; confirm with the bank whether a real timeout may have applied.
7. Currency set: only `fx.ts` currencies; JOD and others for the CAB bank are in the table but untested.
8. Amendments that reduce amount or shorten dates need the beneficiary's consent in practice; the sandbox only models the Maker side for import LCs.

## README changes needed
- Section 3.3: add the **Trade** tab (Overview · Letters of credit · Guarantees · Collections · Financing · Documents · Tracking).
- Section 4.2: add `biz.trade.view`, `biz.trade.initiate`, `biz.trade.amend`, `biz.trade.documents`, `biz.trade.finance`.
- Section 5.3: add the launch points above; Approvals inbox gets a Type filter.
- Contents table: Module 5 journey count 12.
