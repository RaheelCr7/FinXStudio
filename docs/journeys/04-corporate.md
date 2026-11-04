# Module 4: Corporate

## 1. Scope, release and users

**Release 2.** Corporate is the **Business "Graphite"** workspace made ready for large groups: many legal entities, many currencies, high-value payments, payment files sent by machine, an approval matrix instead of one threshold, and strong controls over who may do what. It is not a new app. A group appears as one **organisation** in the context switcher with several **entities** inside it. Module 2 (SME) already covers one small company; this module adds what a group needs.

Who uses it (cast, all synthetic, planned unless marked):

| Who | Role |
|---|---|
| **Northwind Group** (`northwind`) | A manufacturing group. Parent **Northwind Holdings plc** (USD). Subsidiaries: **Northwind Manufacturing GmbH** (EUR), **Northwind Logistics LLC** (AED), **Northwind Retail Ltd** (GBP) |
| **Maya Hart** (`maya`) | Group treasurer. Maker at all four entities; Admin at Holdings |
| **Tomas Berg** (`tomas`) | Finance controller. Approver (group A) at all four entities |
| **Ines Duarte** (`ines`) | Approver (group B) at Holdings and Manufacturing |
| **Kofi Mensah** (`kofi`) | Security administrator. Admin at all entities; cannot make or approve payments |
| **Lena Fischer** (`lena`) | Maker at Manufacturing only |
| **Alpha Trading LLC** and **Beta Services Ltd** | The SME demo companies of module 2. They keep working unchanged |
| **Acme Trading Co.** (`acme`, existing) | The existing sandbox company (PKR). All existing corporate journeys keep running on it |

Plain words used here:

| Word | Meaning |
|---|---|
| Entity | One legal company in the group, with its own accounts, users and limits |
| Organisation | The group as a whole; the thing a person signs in to |
| Approval matrix | A table that says, for a kind of payment and an amount range, who must approve and in what order |
| Signatory group | A named set of approvers (A, B) used by the matrix |
| Sequential / parallel | Sequential: step 1 then step 2. Parallel: all at once, in any order |
| High-value payment | A single large payment sent by a fast, final system (RTGS) or by SWIFT for abroad. Cannot be recalled |
| pain.001 | The standard ISO 20022 file a company sends to ask its bank to make many credit transfers |
| pain.002 | The standard reply: which payments in the file were accepted or rejected |
| camt.053 | The standard end-of-day statement file |
| Host-to-host | A secure machine-to-machine connection between the company's finance system and the bank. No person uploads the file |
| Sanctions screening | Checking a name against lists of people and firms the bank may not pay |
| Standing instruction | A payment that repeats on its own (for example monthly rent, or moving cash between group accounts) |
| Dual control | A change that needs two different people, as with payments |

## 2. What exists today in code

| Thing | Where | State |
|---|---|---|
| `CorporateSandbox`: one company, accounts, users with roles `initiator` / `approver`, whitelist, daily limits per user and company, one threshold (`dualApprovalAbove`), cut-off, holidays | `packages/mock-bank-api/src/corporate.ts` | Existing. Demo company Acme Trading Co. (PKR) |
| Rules and errors: `NOT_AUTHORISED`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `BENEFICIARY_NOT_WHITELISTED`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `INSUFFICIENT_FUNDS`, `INVALID_AMOUNT`, `PAYMENT_NOT_PENDING`, `PAYMENT_NOT_FOUND`, `USER_NOT_FOUND`, `EMPTY_BATCH`, `BATCH_TOO_LARGE`, `NO_VALID_LINES`, `INVALID_PERIOD`, `PAYROLL_ALREADY_RUN`; row codes `DUPLICATE_LINE`, `NOT_AN_EMPLOYEE`, `ABOVE_SALARY_CAP` | `corporate.ts` | Existing |
| Adapters `corp.users.list`, `corp.company.get`, `corp.payments.initiate`, `.approve`, `.reject`, `.withdraw`, `.pending`, `.get`, `corp.bulk.check`, `corp.bulk.submit`, `corp.payroll.check`, `corp.payroll.submit` | `index.ts`, `catalog.ts` | Existing. Acting person comes from `input.userId` |
| Bulk file: `beneficiary,amount,reference` per line, optional header, at most **50** lines (`MAX_BULK_LINES`) | `index.ts` (`parseBulkFile`) | Existing. Row messages: "Not on the company's approved list", "The amount is not valid for this account's currency", "Same payee, amount and reference as an earlier line", "Not on the company's payroll register", "More than 1.5 times this employee's monthly salary" |
| Payroll: register, salary cap 1.5, two approvers always, one run per `YYYY-MM` | `corporate.ts` | Existing |
| Second bank API ("Bank B") and the **mapping layer**: a JSON file per bank turns neutral calls into that bank's API and its error codes back into ours | `corporate-b.ts`, `mapping.ts`, `mappings/bank-b.corporate.json` | Existing. Every new `corp.*` adapter below needs a mapping entry and a Bank B operation, so the same scenarios pass on both banks (the gate in `docs/CORPORATE.md`) |
| Journeys `corporate-payment`, `corporate-approval`, `bulk-payment`, `payroll-run`, `withdraw-payment` | `fixtures/` | Existing. Each starts with a sandbox "Who am I" screen (`corp.users.list`) |
| Proof: `acceptance`, `scenarios`, `finx_run_scenarios`, `finx_mutation_check`; survivors listed in `packages/finx-mcp/src/scenarios.test.ts` | | Existing |

### 2.1 Upgrade of existing journeys (when Release 2 is built)

| Journey | Today | Upgrade |
|---|---|---|
| `corporate-payment` | Single threshold, role from the "Who am I" screen | Acting user from the active context (planned session). Entity shown in the header. Approval chain shown from the matrix. Rejected by `PERMISSION_DENIED` for a user without `biz.payments.initiate` |
| `corporate-approval` (= `approve-payments`) | One or two approvers | Matrix chain with sequential and parallel steps; delegation; step-up above a threshold. Spec: `corp-approve-with-matrix` below |
| `bulk-payment` | Pasted rows, 50 lines | Keeps working. File upload (`fileUpload`), pain.001, up to 5,000 lines (planned sandbox cap), spec: `corp-payment-file` |
| `payroll-run` | Pasted rows | Same upload. Keeps the 1.5 salary cap and two-approver rule (a matrix row of type payroll) |
| `withdraw-payment` | Initiator only | Unchanged. Applies to files and high-value payments while pending |

## 3. Sandbox domains needed (planned)

New files beside `corporate.ts`: `group.ts` (entities), `matrix.ts`, `files.ts`, `h2h.ts`, `screening.ts`, `standing.ts`, `reports.ts`. Each is pure logic with a clock and a `Flaws` list. The existing `CorporateSandbox` becomes one **entity**; an organisation holds several.

| Domain | What it holds | Rules the proof relies on |
|---|---|---|
| Group and entities | Tree: organisation, entity, parent. Each entity has currency, accounts (several currencies), users, limits, cut-off, holidays | A person acts in one entity at a time (the active context). Group view reads all entities the person may see |
| Accounts | Per entity, in AED, EUR, GBP, USD, with balances | Limits are written in the entity currency, as today (`CURRENCY_NOT_SUPPORTED` stays for a different currency than the entity's limit currency; planned: a limit per currency is open question 3) |
| Approval matrix | Rows `{ entityId, type, currency, from, to, steps[{ group, need, mode }] }` and signatory groups | The first matching row wins. No row gives `NO_MATRIX_ROW`. `required` of today = a one-step row. Payroll always two steps |
| Payment types | `domestic`, `highvalue` (RTGS, final), `swift`, `intragroup`, `bulk`, `payroll` | High-value starts at 250,000 in the entity currency (sandbox) |
| Files | Uploaded or host-to-host files with id, format, checksum, counts, status | Statuses: Received, Validated, Rejected, Pending approval, Sent, Partly accepted, Completed. A file is never applied twice (`DUPLICATE_FILE`) |
| Host-to-host | One connection per entity: key fingerprint, schedule, test result | Needs a successful test before it can be enabled |
| Beneficiaries | Lifecycle: Draft, Screening, Pending approval, Active, Blocked, Removed | Names are screened against a synthetic list (for example "Orion Shipping FZE" gives a hit; "Alder Packaging GmbH" is clear) |
| Standing instructions | Frequency, start, end, amount, payer, payee | Checked again each run; a failed run is skipped and reported |
| Delegations | Delegate, period (at most 30 days), scope | The delegate's own limits apply; nobody approves what they started |
| Entitlements | Per user, per entity: roles, accounts, limits | A change needs a second admin (dual control) |
| Reports | Catalogue, scheduled deliveries, files | camt.053 and CSV; delivered to the portal or host-to-host |
| Conditions | `conditions { latencyMs, timeout[], unavailable[], empty[] }` (README 1.5) | Every adapter below may be set |

## 4. New adapters (planned)

Style: `corp.<domain>.<verb>`. The acting person and entity come from the **active context** (README 2.3); no adapter takes `userId`. Every adapter also answers `PERMISSION_DENIED`, `WRONG_CONTEXT`, `TIMEOUT`, `SERVICE_UNAVAILABLE` and `SESSION_EXPIRED` (README 1.6); those are not repeated in the Errors column. `moneyMoving` here means "can release money once approved". Money-moving adapters need the OTP verified first (`OTP_REQUIRED`), like the existing ones.

| Adapter | Request | Response | Errors | moneyMoving | requiresOtp |
|---|---|---|---|---|---|
| `corp.group.get` | none | `{ organisationId, name, entities[{ id, name, parentId, currency, role, permissions[] }] }` | none | no | no |
| `corp.group.summary` | `{ entityIds?: string[], asOf? }` | `{ totals[{ currency, balance }], entities[{ id, name, balances[], pendingCount, cutoff }], rates }` | `ENTITY_NOT_FOUND` | no | no |
| `corp.accounts.list` | `{ entityId?, currency? }` | map: `{ id, entityId, name, maskedNumber, currency, balance, available }` | `ENTITY_NOT_FOUND` | no | no |
| `corp.transactions.list` | `{ accountId, from, to, minAmount?, maxAmount?, q?, page }` | `{ rows[], total, pages }` | `ACCOUNT_NOT_FOUND`, `INVALID_PERIOD` | no | no |
| `corp.highvalue.quote` | `{ fromAccountId, beneficiaryId, amount, currency, rail: "rtgs"\|"swift", chargeBearer: "OUR"\|"SHA"\|"BEN", purposeCode, valueDate }` | `{ quoteId, rail, fee, fx?: { rate, expiresAt }, creditAmount, valueDate, afterCutoff, approvals: { steps[], total }, finalNotice }` | `ACCOUNT_NOT_FOUND`, `BENEFICIARY_NOT_WHITELISTED`, `BENEFICIARY_NOT_ACTIVE`, `INVALID_AMOUNT`, `BELOW_HIGH_VALUE`, `CURRENCY_NOT_SUPPORTED`, `INVALID_PURPOSE_CODE`, `INVALID_VALUE_DATE`, `NO_MATRIX_ROW`, `INSUFFICIENT_FUNDS` | no | no |
| `corp.highvalue.initiate` | `{ quoteId, reference }` | the payment (existing shape plus `type`, `rail`, `chain[]`) | `QUOTE_EXPIRED`, `QUOTE_USED`, `QUOTE_NOT_FOUND`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `INSUFFICIENT_FUNDS`, `NOT_AUTHORISED`, `OTP_REQUIRED` | yes | yes |
| `corp.intragroup.quote` | `{ fromAccountId, toAccountId, amount, purpose: "loan"\|"dividend"\|"cost"\|"cash-pool" }` | `{ quoteId, fx?, creditAmount, documentRequired, approvals }` | `ACCOUNT_NOT_FOUND`, `SAME_ACCOUNT`, `ENTITY_NOT_IN_GROUP`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `NO_MATRIX_ROW` | no | no |
| `corp.intragroup.initiate` | `{ quoteId, reference, documentId? }` | the payment | `QUOTE_EXPIRED`, `QUOTE_USED`, `DOCUMENT_REQUIRED`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `OTP_REQUIRED` | yes | yes |
| `corp.files.validate` | `{ format: "pain.001"\|"csv", fileName, content, fromAccountId }` | `{ fileId, format, messageId, groups, count, total, currency, controlSumOk, lines[{ n, ok, code?, message? }], problems, requiredApprovers, chain[] }` | `FILE_EMPTY`, `FILE_TOO_LARGE`, `FILE_FORMAT_UNKNOWN`, `FILE_XML_INVALID`, `CONTROL_SUM_MISMATCH`, `DUPLICATE_FILE`, `BATCH_TOO_LARGE`, `NO_VALID_LINES`, `ACCOUNT_NOT_FOUND`, `NOT_AUTHORISED` | no | no |
| `corp.files.submit` | `{ fileId, reference }` | the payment (type `bulk`, `fileId`, `lines`) | `FILE_NOT_FOUND`, `FILE_NOT_VALIDATED`, `DUPLICATE_FILE`, `INSUFFICIENT_FUNDS`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `OTP_REQUIRED` | yes | yes |
| `corp.files.list` | `{ status?, channel?, from?, to?, q?, page }` | `{ rows[{ id, name, format, channel, receivedAt, count, total, currency, status }], total, pages }` | `INVALID_PERIOD` | no | no |
| `corp.files.get` | `{ fileId }` | file plus `timeline[]`, `report` (pain.002: per line accepted or rejected with reason code) | `FILE_NOT_FOUND` | no | no |
| `corp.h2h.get` | none | `{ status: "none"\|"testing"\|"active"\|"disabled", keyFingerprint, schedule, lastFile, lastTest }` | none | no | no |
| `corp.h2h.register` | `{ publicKey, fingerprint, schedule: "hourly"\|"daily"\|"on-arrival", formats[], notifyEmail }` | `{ connectionId, status: "testing", bankKeyFingerprint, endpoint }` | `KEY_INVALID`, `KEY_TOO_WEAK`, `KEY_ALREADY_USED`, `FORMAT_NOT_SUPPORTED`, `OTP_REQUIRED` | no | yes |
| `corp.h2h.test` | `{ connectionId }` | `{ ok, steps[{ name, ok }], testFileId }` | `CONNECTION_NOT_FOUND`, `TEST_FAILED` | no | no |
| `corp.h2h.enable` | `{ connectionId }` | `{ status: "active" }` | `CONNECTION_NOT_FOUND`, `TEST_NOT_PASSED`, `OTP_REQUIRED` | no | yes |
| `corp.matrix.get` | `{ entityId? }` | `{ version, groups[], rows[], pendingChange? }` | `ENTITY_NOT_FOUND` | no | no |
| `corp.matrix.propose` | `{ rows[], groups[], effectiveDate, reason }` | `{ changeId, status: "pending_approval", diff[] }` | `MATRIX_INVALID`, `MATRIX_GAP`, `MATRIX_OVERLAP`, `GROUP_TOO_SMALL`, `CHANGE_PENDING`, `OTP_REQUIRED` | no | yes |
| `corp.matrix.approve` | `{ changeId }` | `{ status: "active"\|"pending_approval" }` | `CHANGE_NOT_FOUND`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `PAYMENT_NOT_PENDING`, `OTP_REQUIRED` | no | yes |
| `corp.matrix.reject` | `{ changeId, reason }` | `{ status: "rejected" }` | `CHANGE_NOT_FOUND`, `NOT_AUTHORISED` | no | no |
| `corp.approvals.queue` | `{ entityId?, type?, minAmount?, maxAmount?, ageDays?, page }` | `{ rows[{ id, entityId, payee, amount, currency, type, initiatedBy, initiatedAt, step, chain[], cutoffIn }], total }` | none | no | no |
| `corp.delegations.list` | none | map: `{ id, from, to, entity, start, end, status }` | none | no | no |
| `corp.delegations.create` | `{ toUserId, entityId, start, end, reason }` | `{ delegationId, status }` | `USER_NOT_FOUND`, `DELEGATE_NOT_APPROVER`, `PERIOD_TOO_LONG`, `INVALID_PERIOD`, `DELEGATION_OVERLAP`, `OTP_REQUIRED` | no | yes |
| `corp.delegations.revoke` | `{ delegationId }` | `{ status: "revoked" }` | `DELEGATION_NOT_FOUND` | no | no |
| `corp.beneficiaries.list` | `{ status?, q?, entityId?, page }` | map with `status`, `screening` | none | no | no |
| `corp.beneficiaries.add` | `{ name, country, bank, bic, account (IBAN or number), currency, address, type }` | `{ beneficiaryId, status: "screening"\|"pending_approval"\|"blocked", screening: { result, matches[] } }` | `NAME_REQUIRED`, `IBAN_INVALID`, `BIC_INVALID`, `COUNTRY_NOT_SUPPORTED`, `BENEFICIARY_EXISTS`, `SANCTIONS_HIT`, `OTP_REQUIRED` | no | yes |
| `corp.beneficiaries.approve` | `{ beneficiaryId }` | `{ status: "active" }` | `BENEFICIARY_NOT_FOUND`, `SELF_APPROVAL`, `BENEFICIARY_NOT_PENDING`, `OTP_REQUIRED` | no | yes |
| `corp.standing.create` | `{ fromAccountId, payee (beneficiary or account), amount, currency, frequency, startDate, endDate?, reference }` | `{ instructionId, status: "pending_approval", nextRun, chain[] }` | `ACCOUNT_NOT_FOUND`, `BENEFICIARY_NOT_WHITELISTED`, `INVALID_AMOUNT`, `INVALID_START_DATE`, `INVALID_END_DATE`, `CURRENCY_NOT_SUPPORTED`, `NO_MATRIX_ROW`, `OTP_REQUIRED` | yes (future runs) | yes |
| `corp.standing.update` / `.cancel` | `{ instructionId, ... }` | `{ status }` | `INSTRUCTION_NOT_FOUND`, `INSTRUCTION_NOT_ACTIVE`, `NOT_AUTHORISED` | yes / no | yes / no |
| `corp.standing.list` | `{ status? }` | map | none | no | no |
| `corp.admin.users.list` | `{ entityId?, q?, role?, status? }` | rows `{ id, name, email, status, entities[{ id, role, accounts, limit }], lastSignIn }` | none | no | no |
| `corp.admin.users.change` | `{ userId?, name, email, grants[{ entityId, role, accountIds[], dailyLimit }], status }` | `{ changeId, status: "pending_approval" }` | `USER_EXISTS`, `EMAIL_INVALID`, `ROLE_CONFLICT`, `LIMIT_ABOVE_ENTITY`, `LAST_ADMIN`, `CHANGE_PENDING`, `OTP_REQUIRED` | no | yes |
| `corp.admin.changes.approve` | `{ changeId }` | `{ status: "applied" }` | `CHANGE_NOT_FOUND`, `SELF_APPROVAL`, `OTP_REQUIRED` | no | yes |
| `corp.reports.catalogue` | none | map: `{ id, name, kind, formats[], filters[] }` | none | no | no |
| `corp.reports.request` | `{ reportId, entityIds[], accountIds[], from, to, format }` | `{ requestId, fileId, rows, sizeKb }` | `REPORT_NOT_FOUND`, `INVALID_PERIOD`, `PERIOD_TOO_LONG`, `TOO_MANY_ROWS`, `FORMAT_NOT_SUPPORTED` | no | no |
| `corp.reports.schedule` | `{ reportId, entityIds[], frequency, time, format, channel: "portal"\|"h2h"\|"email", recipients[] }` | `{ scheduleId, nextRun }` | `REPORT_NOT_FOUND`, `H2H_NOT_ACTIVE`, `EMAIL_INVALID`, `SCHEDULE_LIMIT` | no | yes |

Bank B (planned): each adapter has an operation in `bank-b.corporate.json` and a Bank B call with its own names and numbered errors (for example `ERR-5101` for `CONTROL_SUM_MISMATCH`). The same scenarios must pass on both banks.

## 5. New components (planned, beyond README 2.2)

| Component | Used for | Based on |
|---|---|---|
| `entityTree` | Hierarchy of entities with currency, role badge and a checkbox for the group view | `accordion` + `statusChip` |
| `approvalChain` | Steps (sequential and parallel) with who has approved, who is next, and time left to cut-off | `timeline` |
| `matrixEditor` | Edit matrix rows, check gaps and overlaps live | `dataTable` with editable cells |
| `fileReport` | Per-line result of a file: counts, control sum, filter on problems, download of rejected lines | `dataTable` + `statusChip` |
| `diffView` | Before and after for matrix and entitlement changes | `compareTable` (module 3) |
| `screeningResult` | Clear / Review / Hit with the matched name and list | `statusChip` + `alert` |
| `keyInput` | Paste a public key; show its fingerprint and strength | `textInput` lines + `reviewSummary` |
| `cutoffTimer` | Counts down to the cut-off for the entity (UTC) | `statusChip` |

## 6. Information architecture

The Business workspace of module 2 is kept. Corporate adds the following. All tables are `dataTable` (planned): on a phone they become card lists.

### Shell: Entity selector and group hierarchy
| Item | Spec |
|---|---|
| Purpose | Choose which entity the person is acting in; see the whole group |
| Route | A sheet from the top bar (web: popover). Page: web `/business/{org}/group`; mobile `GroupHierarchy` |
| Data | `corp.group.get` (view-model `groupContexts`) |
| Widgets | `entityTree`: each row shows entity name, currency, the person's role badge (Maker, Approver, Admin, or "View only"), and a dot if approvals wait. A search box. A "Group view" toggle |
| Behaviour | Tap an entity: calls `bank.session.switch` (planned). Needs `stepup` when moving from the last-used workspace or between organisations; within the same organisation and the same step-up window it does not ask again. Switching clears the active journey, drafts, filters (README 5.4) |
| States | Loading: skeleton rows. Empty (no entity): "You don't have access to any entity yet. Ask an administrator." Error: "We couldn't load your companies. Nothing was changed." Button: Try again |
| Launch points on it | None. It is the context switch |

### Shell: Group overview (Overview tab)
| Item | Spec |
|---|---|
| Route | Web `/business/{org}`; mobile `Overview` |
| Data | `corp.group.summary` for the selected entities; approvals from `corp.approvals.queue` |
| Widgets | Consolidated balance (by currency, with a total in the group currency at the day's rate), 13-week cash flow (`chart`), entity table, approvals queue with `cutoffTimer`, files in progress, quick actions |
| Entity table columns | Entity; Currency; Balance; Pending approvals; Files today; Cut-off. Sort by Balance high to low (default). Filter: entities (checkboxes) |
| Empty | No payments: "Nothing waiting. Start a payment." Button Pay a supplier |
| Drill-downs | Entity row switches the context; approvals row opens `corp-approve-with-matrix` with `{paymentId, entityId}`; files row opens Payments › Files |
| Launch points | + Pay (high-value), + Upload file, + Intra-group transfer |

### Shell: Accounts (group table)
`dataTable` of `corp.accounts.list` with columns Entity, Account, Number, Currency, Balance, Available; filters Entity, Currency; search; sort Entity then Balance. Row opens account detail with `corp.transactions.list` (filters: dates, amount range, text, direction; export through `corp-report-request`). Empty: "No accounts match." Launch points: row › Statement (`corp-report-request`, `{accountId}`), Transfer from this account (`corp-intragroup-transfer`, `{accountId}`).

### Shell: Payments hub and tracker
Hub tiles: Single payment, High-value payment, Upload a file, Payroll, Intra-group, Standing instructions, Templates, Beneficiaries. Tracker: `dataTable` columns Reference, Type (`statusChip`), Entity, Payee, Amount, Value date, Status, Step (for example "Waiting for Group A, 1 of 2"); filters Status, Type, Entity, Date; sort newest first. A payment opens a detail page with an `approvalChain` and a `timeline`. Withdraw uses `withdraw-payment` (existing).

### Shell: Files
`dataTable` of `corp.files.list`. Columns: File name, Format, Channel (Portal or Host-to-host), Received, Payments, Total, Status (`statusChip`). Filters: status, channel, date range. Sort: newest first. A row opens the file page with `fileReport` and a `timeline` (Received, Validated, Pending approval, Sent, Completed). Empty: "No files yet. Upload one." Button Upload a file (`corp-payment-file`). Error: "We couldn't load your files. Nothing was changed."

### Shell: Approvals inbox
`dataTable` of `corp.approvals.queue`, selectable rows. Columns: Entity, Payee or file, Type, Amount, Started by, Started, Step, Time to cut-off. Filters: entity, type, amount range, older than N days. Sort: cut-off soonest first. Batch bar: Approve selected (up to 20), Reject selected. A row opens `corp-approve-with-matrix`. Empty: "Nothing waits for you." Banner when a delegation is active: "You are approving for {name} until {date}."

### Shell: Admin
Tabs: **Users** (`corp.admin.users.list`; columns Name, Email, Status, Entities, Roles, Last sign-in; filters entity, role, status), **Approval matrix** (current rows per entity; Edit starts `corp-approval-matrix`), **Delegations** (`corp.delegations.list`), **Host-to-host** (`corp.h2h.get`), **Audit trail** (`biz.audit.view`, README), **Pending changes** (matrix, user and beneficiary changes waiting for a second person).

### Shell: Reports
`dataTable` of generated reports (`corp.files.list` with channel Report) and of scheduled deliveries. Buttons: New report (`corp-report-request`), Schedule (`corp-report-request`, mode schedule).

## 7. Shared pattern for payment journeys ("Pattern C")

Money-moving corporate journeys follow the existing proof (`corporate-payment`): details, review, consent, one-time code, result "Sent for approval". Nothing leaves the account until the last approver acts.

| Screen id | Blocks | Copy and rules |
|---|---|---|
| `review` | `reviewSummary`, `approvalChain`, `alert` | Rows specific to the journey plus "Approvals needed" (for example "2 approvers: Group A then Group B"), "Value date", and from the entity. Alert (when `afterCutoff`): "It is after {cutoff} UTC or the bank is closed. Your payment will be sent on {valueDate}." Alert (always): "Nothing leaves {account} until it is approved." Button names the action: "Send {amount} for approval" |
| `consent` | `consent` mustBeTrue | "I confirm the details are correct and I am allowed to start this payment for {entity}." Not ticked: "Tick the box to continue." |
| `otp` | `otp` | Integration ids `otpSend` and `otpVerify`. Messages as README 1.6. After 3 wrong codes: "Too many wrong codes. Start again." |
| `success` | `result`, `approvalChain` | "Sent for approval". Text: "{{result.payee}} · {{result.amount}}. {{result.required}} approval(s) needed. Value date {{result.valueDate | date}}." Meta "Ref {{result.id}}". Buttons: "Track payment" (tracker detail), "Start another", "Done" |
| `denied` | `result` | `PERMISSION_DENIED` (README 1.6) |

Step-up (planned): `stepup` for any payment of 1,000,000 or more in the entity currency, for any new beneficiary's first payment, and for all admin changes. Then `otp`.

Standard error rows used by every payment journey (wording from the sandbox): `NOT_AUTHORISED` "{name} is not allowed to initiate payments"; `BENEFICIARY_NOT_WHITELISTED` "This beneficiary is not on the company's approved list"; `LIMIT_USER_EXCEEDED` "This is above {name}'s daily limit"; `LIMIT_COMPANY_EXCEEDED` "This is above the company's daily limit"; `CURRENCY_NOT_SUPPORTED` "Payments are limited in {currency}: choose a {currency} account"; `INSUFFICIENT_FUNDS` "Insufficient funds"; `INVALID_AMOUNT` "Enter an amount in {currency} with at most {n} decimal places". Each is followed by "No money has left the account." The journey tables below say **Pattern C errors** for these and list only the extra rows.

## 8. Journey index

| # | Slug | Name | Kind | Money moves |
|---|---|---|---|---|
| 1 | `corp-high-value-payment` | High-value payment (RTGS or SWIFT) | Payment | Yes |
| 2 | `corp-intragroup-transfer` | Transfer between group entities | Payment | Yes |
| 3 | `corp-payment-file` | Upload a payment file (pain.001 or CSV) | File | Yes |
| 4 | `corp-host-to-host` | Set up host-to-host | Security, file | No |
| 5 | `corp-approve-with-matrix` | Approve with the matrix (upgrade of `approve-payments`) | Approval | Yes |
| 6 | `corp-approval-matrix` | Change the approval matrix | Admin, dual control | No |
| 7 | `corp-delegation` | Delegate approval authority | Admin | No |
| 8 | `corp-beneficiary` | Add a beneficiary with screening | Beneficiary | No |
| 9 | `corp-standing-instruction` | Standing instruction | Payment | Yes (future) |
| 10 | `corp-user-entitlements` | Users and entitlements across entities | Admin, dual control | No |
| 11 | `corp-report-request` | Reports and statements (camt.053, CSV) | File | No |

Entity switching and the group hierarchy are a shell screen (section 6), not a journey: switching changes no data and uses `bank.session.switch`.

### Permissions (proposed additions to README 4.2)

| Permission | Allows | Typical role |
|---|---|---|
| `biz.group.view` | Group overview, entity tree, consolidated balances | All roles at the organisation |
| `biz.payments.highvalue` | Start high-value and SWIFT payments | Maker (treasury) |
| `biz.intragroup.initiate` | Start transfers between entities | Maker (treasury) |
| `biz.files.upload` | Upload payment files | Maker |
| `biz.files.view` | See files and their status | Maker, Approver, Admin |
| `biz.h2h.manage` | Set up and disable host-to-host | Admin (security) |
| `biz.admin.matrix` | Propose and approve matrix changes | Admin |
| `biz.delegations.manage` | Create and revoke delegations of own authority | Approver |
| `biz.beneficiaries.manage` | Add and edit beneficiaries | Maker |
| `biz.beneficiaries.approve` | Approve beneficiaries | Approver |
| `biz.standing.manage` | Create, change and cancel standing instructions | Maker |
| `biz.admin.entitlements` | Grant and remove access per entity | Admin |
| `biz.reports.view` | Request reports and statements (extends `biz.accounts.export`) | All roles |
| `biz.reports.schedule` | Schedule deliveries | Maker, Admin |

Existing `biz.admin.users`, `biz.audit.view`, `biz.approvals.approve`, `biz.payments.initiate`, `biz.payments.bulk`, `biz.payroll.run`, `biz.payments.withdraw` keep their meaning.

## 9. Journeys

### ★ High-value payment — `corp-high-value-payment`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-high-value-payment` |
| Purpose | Send one large payment by a fast, final rail (RTGS in the entity's country, or SWIFT abroad) with a purpose code, a charge choice and a visible approval chain |
| Release / workspace / status | 2 / Business / New (planned). Extends `corporate-payment` |
| Channels | Web, mobile (review and approve only on phone is acceptable; open question 5) |
| Starting pattern | Details, quote, review, consent, code, result (Pattern C) |
| Who | `biz.payments.highvalue`; acting user from the context |

#### 2. Entry points
| Place | Label | Passes | Permission |
|---|---|---|---|
| Overview | + Pay (high-value) | – | `biz.payments.highvalue` |
| Payments › hub | High-value payment | `{beneficiaryId}` optional | `biz.payments.highvalue` |
| Payments › tracker › payment | Repeat | `{paymentId}` | `biz.payments.highvalue` |
| Overview › cut-off timer | Pay now | – | `biz.payments.highvalue` |

#### 3. Screens
| Id | Title | Blocks | Fields | Buttons |
|---|---|---|---|---|
| `details` | High-value payment | `accountPicker` (entity accounts), `beneficiaryPicker` (`allowAddNew`, `addNewJourney: corp-beneficiary`), `amountInput`, `select` chips (rail: Domestic fast (RTGS) / International (SWIFT)), `select` (purpose code), `select` chips (charges: Shared, I pay all, Receiver pays), `datePicker` (value date), `textInput` (reference) | Account required: "Choose an account." Beneficiary required, must be Active: "Choose an approved beneficiary." Amount: at least the high-value floor of 250,000 in the entity currency: "High-value payments start at {floor}. Use a normal payment for less." At most 2 decimals (JPY none). Purpose code required from a list (for example SALA salary, SUPP supplier, TRAD trade, INTC intra-company): "Choose a purpose." Value date: today or later, a working day, at most 30 days ahead: "Choose a working day in the next 30 days." Reference: 1 to 35 characters, letters, digits and `- . / ,` only: "Use up to 35 letters or digits." Helper under amount: "Your remaining daily limit is {remaining}." | "Get quote" |
| `quote` | Check the cost | `reviewSummary`, `alert` | Rows: Fee, Exchange rate (SWIFT in another currency, valid 30 s), Amount received, Charges. Alert warning: "This payment cannot be recalled once it is sent." | "Continue" |
| `review` | Review | Pattern C `review` with `approvalChain` | Rows: From (entity, account), To (beneficiary, bank, country), Amount, Purpose, Charges, Value date, Approvals needed (chain from the matrix, for example "Group A, then Group B") | "Send {amount} for approval" |
| `consent`, `otp`, `success`, `denied` | Pattern C | | | |
| `failed` | Payment not sent | `result` error | Message by code and "No money has left the account." | "Back to details" |

States: while quoting, the button shows a spinner. After 10 s: timeout state.

#### 4. Sandbox errors
Pattern C errors, and:
| Code | Message | Screen | Button |
|---|---|---|---|
| `BELOW_HIGH_VALUE` | "High-value payments start at {floor}. Use a normal payment for less." | `details` | Use normal payment (`corporate-payment`) |
| `BENEFICIARY_NOT_ACTIVE` | "{name} is still being checked or was blocked. It can't be paid yet." | `details` | Choose another |
| `INVALID_PURPOSE_CODE` | "Choose a purpose." | `details` | |
| `INVALID_VALUE_DATE` | "Choose a working day in the next 30 days." | `details` | |
| `NO_MATRIX_ROW` | "No approval rule covers this payment. Ask an administrator at {entity}." | `failed` | Back |
| `QUOTE_EXPIRED` | "The rate ended. Get a new quote." | `quote` | Get new quote |
| `QUOTE_USED` / `QUOTE_NOT_FOUND` | "This quote was already used." / "We can't find that quote." | `failed` | Start again |
| `OTP_REQUIRED`, `OTP_INVALID`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "We didn't get an answer in time. Check the payment tracker before you try again, so you don't send twice." | `failed` | Check tracker |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`company` = `corp.company.get` (existing: limits, remaining); `quote` = `corp.highvalue.quote`; `initiate` = `corp.highvalue.initiate` (moneyMoving, requiresOtp); `otpSend`/`otpVerify` existing.

#### 6. Permissions, step-up, limits
`biz.payments.highvalue`; `stepup` at 1,000,000 or more, then `otp`. Per-person and company daily limits as today; the limit is used when the payment is started and again at release (existing rules).

#### 7. Result and links out
Receipt (planned): reference, entity, payee, amount, rail, charges, value date, chain. Notifications: to approvers "Payment awaiting your approval, {entity}"; to the maker on release or rejection. Buttons: Track payment, Start another, Done.

#### 8. Acceptance criteria
- AC-1: A payment below the high-value floor is refused.
- AC-2: Only an Active beneficiary can be paid.
- AC-3: The approval chain on the review screen is the one the matrix gives for that amount.
- AC-4: Nothing leaves the account until the last approver acts.
- AC-5: A person without `biz.payments.highvalue`, or an approver who started it, cannot start or approve.
- AC-6: A quote expires after 30 seconds and is single-use.
- AC-7: Timeout and unavailable start no payment.

#### 9. Scenarios
| Id | Covers | Persona and setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `maya` at Holdings, 100,000 | `BELOW_HIGH_VALUE` |
| T-2 | AC-2 | Beneficiary in Screening | `BENEFICIARY_NOT_ACTIVE` |
| T-3 | AC-3, AC-4 | 1,500,000 | Chain shows Group A then Group B; `expectBank` balance unchanged; status pending |
| T-4 | AC-5 | `tomas` (approver only) | Launch point hidden; direct call `PERMISSION_DENIED` |
| T-5 | AC-6 | Clock +31 s | `QUOTE_EXPIRED`, then `QUOTE_USED` |
| T-6 | AC-4 | Limit 1,000,000 used | `LIMIT_USER_EXCEEDED` |
| T-7 | AC-7 | `timeout: ["corp.highvalue.initiate"]` | Timeout copy; payments empty |
| T-8 | AC-7 | `unavailable: ["corp.highvalue.quote"]` | Unavailable on `details` |
| T-9 | AC-4 | Wrong code three times | Not started |

#### 10. Expected mutation-check survivors
Reference character rule (no scenario sends an illegal character): add one or list it. Weekend value date rule survives unless T-2 adds a Saturday.

---

### ★ Transfer between group entities — `corp-intragroup-transfer`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-intragroup-transfer` |
| Purpose | Move money from an account of one entity to an account of another entity in the same group, with a purpose and, where needed, a supporting document |
| Release / workspace / status | 2 / Business / New (planned) |
| Channels | Web, mobile |
| Who | `biz.intragroup.initiate` at the paying entity; the receiving entity need not grant anything |

#### 2. Entry points
Overview › + Intra-group transfer; Payments › hub; Accounts › row › Transfer from this account (`{accountId}`); Group overview › entity row (`{toEntityId}`).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `details` | Transfer in the group | `accountPicker` (from), `entityTree` (single select), `accountPicker` (to, filtered to that entity), `amountInput`, `select` chips (Loan, Dividend, Cost sharing, Cash pooling), `textInput` | From required. To entity must differ from the paying entity ("Choose another entity."). To account required. Amount > 0. If the accounts have different currencies the rate is shown at quote. Purpose required. Helper: "Both companies are in {org}." | "Get quote" |
| `document` | Supporting document | `fileUpload` (PDF, 5 MB) | Shown only when `documentRequired` (Loan or Dividend above 1,000,000): "Attach the signed agreement." Required then: "Attach the agreement to continue." | "Continue" |
| `review`, `consent`, `otp`, `success`, `denied` | Pattern C | Rows add: To entity, To account, Rate, Amount received | | |
| `failed` | Transfer not sent | `result` error | | "Back" |

#### 4. Sandbox errors
Pattern C errors, and:
| Code | Message | Button |
|---|---|---|
| `SAME_ACCOUNT` | "Choose two different accounts." | stay |
| `ENTITY_NOT_IN_GROUP` | "That company isn't part of {org}." | Choose another |
| `DOCUMENT_REQUIRED` | "Attach the signed agreement." | Attach |
| `CURRENCY_NOT_SUPPORTED` | Pattern C wording, with the paying entity's currency | Change account |
| `NO_MATRIX_ROW`, `QUOTE_EXPIRED`, `QUOTE_USED` | As `corp-high-value-payment` | |
| `TIMEOUT` | "We didn't get an answer in time. Check the payment tracker before you try again, so you don't send twice." | Check tracker |
| `SERVICE_UNAVAILABLE` | Standard | Try again |

#### 5. Adapters
`quote` = `corp.intragroup.quote`; `initiate` = `corp.intragroup.initiate` (moneyMoving, requiresOtp); `accounts` = `corp.accounts.list`; `group` = `corp.group.get`.

#### 6. Permissions, step-up, limits
`biz.intragroup.initiate`; `otp`; `stepup` at 1,000,000 or more. Counts against the paying entity's daily limits. Approval from the paying entity's matrix only.

#### 7. Result and links out
Receipt: both entities, accounts, rate, purpose, document name. Notification to receiving entity's Overview: "{amount} received from {entity}." Buttons: Track payment, Done.

#### 8. Acceptance criteria
- AC-1: The paying and receiving entities must differ and both belong to the group.
- AC-2: A loan or dividend over 1,000,000 cannot be sent without the agreement.
- AC-3: The amount received equals the amount sent at the quoted rate, to the receiving currency's decimals.
- AC-4: The transfer uses the paying entity's matrix and limits.
- AC-5: Timeout and unavailable send nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `maya`, same entity both sides | "Choose another entity." |
| T-2 | AC-1 | Account of Acme | `ENTITY_NOT_IN_GROUP` |
| T-3 | AC-2 | Loan 2,000,000 | `DOCUMENT_REQUIRED` until a file is attached |
| T-4 | AC-3 | USD 100,000 to EUR | Received = amount × rate to 2 decimals |
| T-5 | AC-4 | Over daily limit | `LIMIT_USER_EXCEEDED` |
| T-6 | AC-5 | `timeout: ["corp.intragroup.initiate"]` | Timeout copy; balances unchanged |
| T-7 | AC-5 | `unavailable: ["corp.intragroup.quote"]` | Unavailable on `details` |

#### 10. Expected mutation-check survivors
Purpose list content (no scenario uses Cost sharing or Cash pooling) may survive; list it.

---

### ★ Upload a payment file — `corp-payment-file`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-payment-file` |
| Purpose | Upload a file of many payments (pain.001 or CSV), see which lines pass, and send the good ones for approval as one payment |
| Release / workspace / status | 2 / Business / New (planned). Extends `bulk-payment` (existing, pasted rows). Repairing rejected lines stays in `repair-bulk-lines` (Release 1) |
| Channels | Web (upload); mobile shows status and approves only |
| Who | `biz.files.upload` and `biz.payments.bulk` |

#### 2. Entry points
Overview › + Upload file; Payments › hub › Upload a file; Files › Upload a file.

#### 3. Screens

**File formats (planned)**

| Format | What the sandbox reads |
|---|---|
| **pain.001.001.03** (XML) | `GrpHdr`: `MsgId` (unique, up to 35), `CreDtTm`, `NbOfTxs`, `CtrlSum`. One or more `PmtInf`: `PmtInfId`, `PmtMtd` = `TRF`, `ReqdExctnDt`, `Dbtr/Nm`, `DbtrAcct/Id/IBAN`, then `CdtTrfTxInf` blocks: `PmtId/EndToEndId`, `Amt/InstdAmt` with `Ccy`, `Cdtr/Nm`, `CdtrAcct/Id/IBAN`, `RmtInf/Ustrd`. Creditor name must match an Active beneficiary. All amounts in one currency per `PmtInf` |
| **CSV** | `beneficiary,amount,reference` per line, the same as `bulk-payment` today, with an optional header; UTF-8; `.csv` |
| Limits | 5 MB; up to 5,000 lines (sandbox cap; today's `MAX_BULK_LINES` is 50 and stays for the pasted `bulk-payment`) |

A small valid pain.001 sample ships with the sandbox so tests do not depend on a real file.

**Screens**
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `choose` | Payment file | `accountPicker` (pay from), `select` chips (pain.001, CSV), `fileUpload`, `textInput` (reference) | Account required. File required: "Choose a file to upload." Wrong type for the chosen format: "This is not a {format} file." Over 5 MB: "The file is larger than 5 MB." | "Check file" |
| `report` | Check the file | `fileReport`, `alert`, `reviewSummary` | Rows: File name, Format, Message id, Payments (count), Total, Control sum ("matches" or "does not match"), Approvals needed. Problem lines listed (line number, payee, code, message from the row table). Alert warning when some lines fail: "{n} lines can't be paid and will be left out. {m} lines will be paid." | "Send {m} payments for approval", "Download rejected lines", "Choose another file" |
| `nothing` | Nothing to pay | `result` | "None of the lines in this file can be paid. Nothing was sent." | "Choose another file" |
| `review`, `consent`, `otp`, `success`, `denied` | Pattern C | Rows: From, File, Payments, Total, Left out, Approvals | | |
| `failed` | File not sent | `result` error | "The file was not sent. No money has left the account." | "Back" |

#### 4. Sandbox errors
Pattern C errors, and:
| Code | Message | Screen | Button |
|---|---|---|---|
| `FILE_EMPTY` | "The file is empty." | `choose` | Choose another |
| `FILE_TOO_LARGE` | "The file is larger than 5 MB." | `choose` | |
| `FILE_FORMAT_UNKNOWN` | "This is not a {format} file." | `choose` | |
| `FILE_XML_INVALID` | "The file isn't valid XML. Line {line}: {detail}." | `choose` | |
| `CONTROL_SUM_MISMATCH` | "The file says it totals {declared} but the lines add up to {actual}. Fix the file and upload it again." | `report` | Choose another file |
| `DUPLICATE_FILE` | "A file with this message id was already sent on {date}." | `choose` | Choose another |
| `EMPTY_BATCH` | "The file has no payment lines" | `choose` | |
| `BATCH_TOO_LARGE` | "A file may have at most {max} payment lines" | `choose` | |
| `NO_VALID_LINES` | "None of the lines can be paid" | `nothing` | |
| Row codes `BENEFICIARY_NOT_WHITELISTED`, `INVALID_AMOUNT`, `DUPLICATE_LINE` | The existing row messages (section 2) | `report` | |
| `FILE_NOT_VALIDATED` / `FILE_NOT_FOUND` | "Check the file again before sending." / "We can't find that file." | `report` | Check file |
| `TIMEOUT` | "We didn't get an answer in time. Check Files before you try again, so you don't send the file twice." | `failed` | Check Files |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`validate` = `corp.files.validate`; `submit` = `corp.files.submit` (moneyMoving, requiresOtp); `accounts`, `company`; `otpSend`, `otpVerify`.

#### 6. Permissions, step-up, limits
`biz.files.upload` and `biz.payments.bulk`; `otp`; `stepup` at 1,000,000 or more. The file counts once against the person's and the entity's limits (as `corp.bulk.submit` does). Approval from the matrix row for type `bulk`.

#### 7. Result and links out
Receipt: file name, message id, counts, total, left out. Notifications: to approvers; to the maker when the bank's pain.002 report arrives (see `Files` shell). Buttons: Track file, Done.

#### 8. Acceptance criteria
- AC-1: Every line is checked and a failing line is left out with its reason; the rest are sent as one payment.
- AC-2: A file whose control sum does not match its lines is refused.
- AC-3: The same message id cannot be sent twice.
- AC-4: Nothing is sent without consent and a correct code.
- AC-5: The total counts once against the person's and entity's limits.
- AC-6: Timeout and unavailable send nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | pain.001 with 5 lines, 1 not on the list | 4 paid, line 3 with its message; total of the 4 |
| T-2 | AC-2 | `CtrlSum` 1,000 vs lines 1,200 | `CONTROL_SUM_MISMATCH` |
| T-3 | AC-3 | Submit twice | Second `DUPLICATE_FILE` |
| T-4 | AC-4 | Wrong codes | Nothing sent |
| T-5 | AC-5 | Limit just below total | `LIMIT_USER_EXCEEDED`; limit unchanged |
| T-6 | AC-6 | `timeout: ["corp.files.submit"]` | Timeout copy; files not Sent |
| T-7 | AC-6 | `unavailable: ["corp.files.validate"]` | Unavailable on `choose` |
| T-8 | AC-1 | CSV with all lines failing | `nothing` screen |

#### 10. Expected mutation-check survivors
The XML error line number text (scenarios read the code, not the line), and the 5 MB limit unless a scenario sends a larger file. List or add T-9.

---

### ★ Set up host-to-host — `corp-host-to-host`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-host-to-host` |
| Purpose | Connect the company's finance system to the bank so files go in and status files come back without a person uploading them |
| Release / workspace / status | 2 / Business / New (planned) |
| Channels | Web only (a person pastes a public key) |
| Who | `biz.h2h.manage` (security administrator, for example `kofi`) |

#### 2. Entry points
Admin › Host-to-host › Set up or Change (`{entityId}`); Files › empty state "Send files automatically".

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `status` | Host-to-host | `reviewSummary`, `statusChip` | Shows current state (None, Testing, Active, Disabled), key fingerprint, schedule, last file, last test | "Set up" or "Change key", "Disable" |
| `key` | Your key | `keyInput`, `select` chips (schedule: On arrival, Hourly, Daily 06:00 UTC), `select` multi (formats: pain.001, CSV, camt.053 out), `textInput` (notification email) | Key required: "Paste your public key." Must be valid: "That isn't a valid public key." At least 3072 bits (RSA) or an EC key: "Use a key of at least 3072 bits." Not used by another entity: "This key is already used by another company." Email valid: "Enter a valid email address." At least one format: "Choose at least one format." Shows the fingerprint to compare on the company side | "Continue" |
| `consent` | Confirm | `consent` | "I confirm this key belongs to {company} and that files sent with it can start payments." | |
| `otp` | | Pattern C `otp` | After `stepup` | |
| `test` | Test the connection | `button`, `dataTable` (steps) | Steps: Reach the bank, Check your key, Send a test file, Receive the reply. Each shows a tick or a cross with the reason | "Run test", "Enable" (only after all ticks) |
| `success` | Host-to-host is on | `result` | "Files you send with this key now arrive in Files. Payments in them still need approval." | "Go to Files" |
| `failed` | Not set up | `result` error | "Nothing was changed. Files cannot be sent automatically yet." | "Try again" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `KEY_INVALID` | "That isn't a valid public key." | `key` | |
| `KEY_TOO_WEAK` | "Use a key of at least 3072 bits." | `key` | |
| `KEY_ALREADY_USED` | "This key is already used by another company." | `key` | |
| `FORMAT_NOT_SUPPORTED` | "That format isn't supported." | `key` | |
| `CONNECTION_NOT_FOUND` | "We can't find that connection. Start again." | `status` | |
| `TEST_FAILED` | "The test failed at: {step}. {detail}." | `test` | Run test |
| `TEST_NOT_PASSED` | "Run a successful test first." | `test` | Run test |
| `OTP_REQUIRED`, `OTP_INVALID`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`status` = `corp.h2h.get`; `register` = `corp.h2h.register` (requiresOtp); `test` = `corp.h2h.test`; `enable` = `corp.h2h.enable` (requiresOtp). None moneyMoving.

#### 6. Permissions, step-up, limits
`biz.h2h.manage`; `stepup` then `otp`. Dual control for a key change (second admin approves in Pending changes, open question 4). A makers' `biz.files.upload` is not needed to set up.

#### 7. Result and links out
Notification to all admins: "Host-to-host was turned on for {entity}." Audit trail entry. Buttons: Go to Files.

#### 8. Acceptance criteria
- AC-1: A key that is invalid, too weak or used elsewhere is refused with its own message.
- AC-2: The connection cannot be enabled until a test passes.
- AC-3: Setting up needs step-up, consent and a correct code.
- AC-4: Files arriving through host-to-host appear in Files with channel Host-to-host and still need approval.
- AC-5: Timeout and unavailable change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Keys: garbage, 2048-bit, one already registered | Three messages |
| T-2 | AC-2 | Enable before test | `TEST_NOT_PASSED` |
| T-3 | AC-3 | Wrong codes | Status stays None |
| T-4 | AC-4 | After enable, sandbox delivers a file | Row with channel Host-to-host, status Validated, payment pending |
| T-5 | AC-5 | `timeout: ["corp.h2h.register"]` | Timeout copy; status None |
| T-6 | AC-5 | `unavailable: ["corp.h2h.test"]` | Unavailable on `test` |

#### 10. Expected mutation-check survivors
The schedule choice (sandbox ignores timing) and the notification email check unless T-1 adds a bad email.

---

### ★ Approve with the matrix — `corp-approve-with-matrix`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-approve-with-matrix` |
| Purpose | Review and approve or reject payments, files and standing instructions, following a matrix with steps in order or in parallel, and acting for a delegator when delegated |
| Release / workspace / status | 2 / Business / Existing journey `corporate-approval` (= `approve-payments`), upgraded. Today: pending list, review, consent, one-time code, "Payment released" or "Approved" with how many approvals remain; reject takes an optional reason |
| Channels | Web, mobile |
| Who | `biz.approvals.approve` |

#### 2. Entry points
Overview › approvals queue; Approvals › inbox (Open, Approve, Reject, Select several); notification "Payment awaiting your approval, {entity}" (switches context first); Payments › tracker (approver).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `inbox` | Waiting for you | `dataTable` (selectable) | As the Approvals shell. Never shows what the person started (existing `listPending` rule) or already approved | Open, "Approve selected" |
| `detail` | Payment {id} | `reviewSummary`, `approvalChain`, `alert` | Rows: Entity, From, To or file name and counts, Amount, Type, Started by, Value date, Step ("Step 1 of 2: Group A"). Chain shows who approved and who is next. Alert if a delegation applies: "You are approving for {name} until {date}." Alert if the cut-off is under 1 hour: "Cut-off in {n} minutes. After it the value date moves to {nextDate}." | "Approve", "Reject" |
| `reject` | Reject | `textInput` lines 3 (optional) | Max 200 characters: "Use up to 200 characters." | "Reject payment" |
| `consent` | Confirm | `consent` | "I have checked this payment and I approve it." | |
| `otp` | | Pattern C | `stepup` at 1,000,000 or more | |
| `success` | Approved / Payment released | `result` | If the chain is complete: "Payment released" and "The money moves on {valueDate}." Else "Approved" and "{n} more approval(s) needed: {groups}." | "Next payment", "Done" |
| `rejected` | Payment rejected | `result` | "The payment was rejected. No money has left the account. {maker}'s daily limit was given back." | "Back to inbox" |
| `failed` | Not approved | `result` error | Message by code | "Back" |

#### 4. Sandbox errors
Existing:
| Code | Message | Button |
|---|---|---|
| `NOT_AUTHORISED` | "{name} is not allowed to approve payments" | Back |
| `SELF_APPROVAL` | "You cannot approve a payment you started" | Back to inbox |
| `ALREADY_APPROVED` | "You have already approved this payment" | Back to inbox |
| `PAYMENT_NOT_PENDING` | "This payment is already {status}" | Back to inbox |
| `PAYMENT_NOT_FOUND` | "No payment {id}" shown as "We can't find that payment." | Back to inbox |
| `INSUFFICIENT_FUNDS` | "Insufficient funds" (the approval does not count; payment stays pending) | Back |
| `LIMIT_COMPANY_EXCEEDED` | "This is above the company's daily limit" (same) | Back |
Planned:
| Code | Message | Button |
|---|---|---|
| `NOT_YOUR_STEP` | "This payment is waiting for {group} first." | Back to inbox |
| `OTP_REQUIRED`, `OTP_INVALID`, `STEP_UP_REQUIRED` | Standard | |
| `TIMEOUT` | "We didn't get an answer in time. Check the payment before you try again, so you don't approve twice." | Check payment |
| `SERVICE_UNAVAILABLE` | Standard | Try again |

#### 5. Adapters
`queue` = `corp.approvals.queue` (planned; today `corp.payments.pending`); `payment` = `corp.payments.get` (existing); `approve` = `corp.payments.approve` (existing; moneyMoving at the last step; requiresOtp); `reject` = `corp.payments.reject` (existing, no OTP); OTP existing. Planned fixes from README 2.3: `rejectPayment` refuses the person who started it; `corp.payments.get` checks access.

#### 6. Permissions, step-up, limits
`biz.approvals.approve`; `otp`; `stepup` at 1,000,000 or more. An approver cannot approve what they started. In a parallel step any one person of the group may act, until `need` is met. Release re-checks balance and the entity limit (existing).

#### 7. Result and links out
Notifications: maker "Payment {id} was released" or "rejected"; next group "Payment awaiting your approval". Buttons: Next payment, Done, Track payment.

#### 8. Acceptance criteria
- AC-1: Only members of the current step's group can approve it.
- AC-2: Nobody approves what they started, and nobody approves twice.
- AC-3: Money moves only when the last step is complete, and the balance is checked again then.
- AC-4: Rejecting moves no money and gives the maker's limit back.
- AC-5: Above the threshold, approving needs step-up, consent and a correct code.
- AC-6: A delegate approves with their own limits and still cannot approve what they started.
- AC-7: Timeout and unavailable leave the payment pending.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | 2-step payment: Group A then B; `ines` (B) opens first | `NOT_YOUR_STEP` |
| T-2 | AC-2 | `maya` started it and also approver | `SELF_APPROVAL`; second try by `tomas` twice `ALREADY_APPROVED` |
| T-3 | AC-3 | `tomas` then `ines` | After step 1 "Approved, 1 more"; after step 2 released; balance reduced once |
| T-4 | AC-3 | Balance falls below amount before step 2 | `INSUFFICIENT_FUNDS`; still pending |
| T-5 | AC-4 | `tomas` rejects | Rejected; maker's `usedToday` back |
| T-6 | AC-5 | 2,000,000 | `STEP_UP_REQUIRED` without step-up; three wrong codes; still pending |
| T-7 | AC-6 | `ines` delegates to `tomas` | `tomas` approves step 2 and is blocked from his own |
| T-8 | AC-7 | `timeout: ["corp.payments.approve"]` | Payment still pending |
| T-9 | AC-7 | `unavailable: ["corp.approvals.queue"]` | Unavailable on `inbox` |

#### 10. Expected mutation-check survivors
The cut-off warning text (cosmetic) may survive. All role, four-eyes, limit and release checks are expected to be killed (as today on the Acme journeys: 11 and 8 criteria, all proved on both bank APIs).

---

### ★ Change the approval matrix — `corp-approval-matrix`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-approval-matrix` |
| Purpose | Edit who must approve which payments, by entity, type, currency and amount, with dual control on the change itself |
| Release / workspace / status | 2 / Business / New (planned). Generalises today's single `dualApprovalAbove` threshold and the payroll rule "always two approvers" |
| Channels | Web only |
| Who | `biz.admin.matrix`; a second person with the same permission approves |

#### 2. Entry points
Admin › Approval matrix › Edit (`{entityId}`); Admin › Pending changes (to approve a proposal: opens the `review` screen in approver mode).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `current` | Approval matrix, {entity} | `matrixEditor` (read), `statusChip` | Columns: Payment type (Single, High-value, Bulk, Payroll, Intra-group, Standing), Currency, From, To, Steps (for example "Group A (1) then Group B (1)"), Mode (Sequential, Parallel). Banner if a change is waiting: "A change proposed by {name} is waiting for a second administrator." | "Edit", "Back" |
| `edit` | Edit the matrix | `matrixEditor`, `dataTable` (signatory groups), `alert` | Row: type required; from < to; to may be "no limit"; at least 1 step; each step has a group and `need` (1 or more) not greater than the group size. Rules shown live: no gaps (every amount from 0 up has a row), no overlap, payroll rows keep at least 2 steps ("Payroll always needs two approvers."), every group has at least 2 people ("A group needs at least two people."). Effective date: today or later, a working day. Reason: required, up to 200 characters ("Say why you are changing this.") | "Review change" |
| `review` | Review the change | `diffView`, `alert` | Before and after per row. Alert info: "A second administrator must approve this. Until then the old rules apply." | "Send for approval" |
| `consent` | Confirm | `consent` | "I confirm this change to the approval rules of {entity}." | |
| `otp` | | Pattern C | `stepup` always | |
| `success` | Change sent for approval | `result` | "{name} or another administrator must approve it. It starts on {effectiveDate}." | "Back to Admin" |
| `approve` | Approve the change | `diffView`, `consent`, `button` | The same diff for the second person. Buttons Approve / Reject (reason required: "Say why you are rejecting it.") | |
| `done` | Change active / rejected | `result` | "The new rules apply from {date}." / "The change was rejected. The old rules stay." | "Back to Admin" |
| `failed` | Not sent | `result` error | "Nothing was changed. The old rules still apply." | "Back" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `MATRIX_GAP` | "No rule covers amounts from {from} to {to} for {type}. Add a row." | `edit` | Fix rows |
| `MATRIX_OVERLAP` | "Two rows cover {range} for {type}. Change one." | `edit` | |
| `MATRIX_INVALID` | "Check row {n}: {detail}." | `edit` | |
| `GROUP_TOO_SMALL` | "A group needs at least two people." | `edit` | |
| `CHANGE_PENDING` | "A change is already waiting. Approve or reject it first." | `current` | Open change |
| `CHANGE_NOT_FOUND` | "We can't find that change." | `approve` | Back |
| `SELF_APPROVAL` | "You cannot approve a change you proposed" | `approve` | Back |
| `ALREADY_APPROVED` | "You have already approved this change" | `approve` | |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`matrix` = `corp.matrix.get`; `propose` = `corp.matrix.propose` (requiresOtp); `approve` = `corp.matrix.approve` (requiresOtp); `reject` = `corp.matrix.reject`. Not moneyMoving, but they decide who can release money.

#### 6. Permissions, step-up, limits
`biz.admin.matrix`; `stepup` then `otp` for propose and approve. The proposer cannot approve.

#### 7. Result and links out
Notification to other matrix admins: "Approval rules for {entity} need your review." Audit trail. Payments already pending keep the chain they were started with.

#### 8. Acceptance criteria
- AC-1: A matrix with a gap or an overlap cannot be proposed.
- AC-2: Payroll rows keep at least two steps and every group has at least two people.
- AC-3: A change is not active until a second administrator approves, and the proposer cannot.
- AC-4: Payments already started keep their old chain; new ones use the new matrix.
- AC-5: Timeout and unavailable change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `kofi` removes the 250,000+ row | `MATRIX_GAP` |
| T-2 | AC-1 | Two rows overlapping | `MATRIX_OVERLAP` |
| T-3 | AC-2 | Payroll with one step; group of one | Both messages |
| T-4 | AC-3 | `kofi` proposes, approves himself | `SELF_APPROVAL`; second admin approves; active |
| T-5 | AC-4 | Payment pending, then change | Pending payment chain unchanged; a new payment uses the new rows |
| T-6 | AC-5 | `timeout: ["corp.matrix.propose"]` | Matrix unchanged |
| T-7 | AC-5 | `unavailable: ["corp.matrix.get"]` | Unavailable on `current` |

#### 10. Expected mutation-check survivors
The effective-date working-day rule if no scenario picks a weekend; add one or list it.

---

### ★ Delegate approval authority — `corp-delegation`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-delegation` |
| Purpose | An approver names a colleague who can approve in their place for a period (holiday, sick leave) |
| Release / workspace / status | 2 / Business / New (planned) |
| Channels | Web, mobile |
| Who | `biz.delegations.manage` (an approver). The delegate must hold `biz.approvals.approve` |

#### 2. Entry points
Admin › Delegations › New; Approvals inbox › banner "Going away? Delegate your approvals."

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `form` | Delegate your approvals | `select` (delegate: people in the same entity who can approve), `select` (entity), `datePicker` range, `textInput` (reason) | Delegate required: "Choose a colleague." Delegate cannot be yourself. Period: starts today or later; ends after the start; at most 30 days: "A delegation can last at most 30 days." Reason required, up to 100 characters. Helper: "{name} approves with their own limits. They still cannot approve payments they started." | "Review" |
| `review` | Review | `reviewSummary`, `alert` | Rows: Delegate, Entity, From, To. Alert: "You stay responsible for approvals made on your behalf." | "Delegate" |
| `consent`, `otp` | Pattern C | `stepup` always | | |
| `success` | Delegation set | `result` | "{name} can approve for you from {start} to {end}. You can end it any time." | "Back to Delegations" |
| `failed` | Not set | `result` error | "Nothing was changed." | "Try again" |
| `revoke` | End delegation | `dialog` | "End this delegation now? {name} will no longer approve for you." | "End delegation" (no OTP) |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `USER_NOT_FOUND` | "No user {id} at {entity}" shown as "We can't find that colleague." | `form` | |
| `DELEGATE_NOT_APPROVER` | "{name} can't approve payments at {entity}. Choose another colleague." | `form` | |
| `PERIOD_TOO_LONG` | "A delegation can last at most 30 days." | `form` | |
| `INVALID_PERIOD` | "The end date must be after the start date." | `form` | |
| `DELEGATION_OVERLAP` | "You already delegate for part of this period." | `form` | |
| `DELEGATION_NOT_FOUND` | "We can't find that delegation." | `revoke` | |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`people` = `corp.admin.users.list`; `create` = `corp.delegations.create` (requiresOtp); `revoke` = `corp.delegations.revoke`; `list` = `corp.delegations.list`. Not moneyMoving.

#### 6. Permissions, step-up, limits
`biz.delegations.manage`; `stepup` then `otp`. Delegate's limits apply (existing per-person daily limit); delegation does not raise them.

#### 7. Result and links out
Notification to delegate: "You can approve for {name} until {end}." Approvals inbox shows the banner. Audit trail. Ends by itself at the end date.

#### 8. Acceptance criteria
- AC-1: A delegate must be able to approve at that entity, and not be the delegator.
- AC-2: A delegation is at most 30 days and cannot overlap another.
- AC-3: A delegate's approval counts as theirs under their own limits and cannot cover a payment they started.
- AC-4: After the end date or a revoke, the delegate can no longer approve for the delegator.
- AC-5: Timeout and unavailable create nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `ines` picks `lena` (maker only) | `DELEGATE_NOT_APPROVER` |
| T-2 | AC-2 | 31 days / overlap | Both errors |
| T-3 | AC-3 | `ines` to `tomas`; `tomas` started a payment | `SELF_APPROVAL` on that one; others approved |
| T-4 | AC-4 | Clock after end date | `NOT_AUTHORISED` for the delegate's act-for |
| T-5 | AC-5 | `timeout: ["corp.delegations.create"]` | No delegation |
| T-6 | AC-5 | `unavailable: ["corp.admin.users.list"]` | Unavailable on `form` |

#### 10. Expected mutation-check survivors
None expected.

---

### ★ Add a beneficiary with screening — `corp-beneficiary`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-beneficiary` |
| Purpose | Add a payee for the group, check the name against sanctions lists, and have a second person approve it before it can be paid |
| Release / workspace / status | 2 / Business / New (planned). Group version of `add-supplier` (Release 1, SME) |
| Channels | Web, mobile |
| Who | `biz.beneficiaries.manage` to add; `biz.beneficiaries.approve` to approve |

#### 2. Entry points
Payments › Beneficiaries › Add / Edit (`{beneficiaryId}`); any payment journey's "Add a new beneficiary" (`returnTo`, `addNewJourney: corp-beneficiary`); Admin › Pending changes (approve).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `details` | New beneficiary | `textInput` (name), `select` (country), `select` chips (Company, Person), `textInput` (bank name), `textInput` (BIC), `textInput` (account or IBAN), `select` (currency), `textInput` lines 2 (address) | Name required, 2 to 70 characters, no digits only: "Enter the payee's full legal name." BIC 8 or 11 characters: "Enter a valid BIC." IBAN: length and check digits for the country: "That isn't a valid IBAN." Country must be supported: "We can't pay to {country} yet." Address required for SWIFT: "Enter the payee's address." Duplicate name and account: "This payee is already on your list." | "Check and add" |
| `screening` | Checking {name} | `screeningResult`, `alert` | Spinner for up to 10 s. Result Clear: "No match found." Review: "We found a name like {match} on the {list} list. A compliance officer will look at it." Hit: "{name} matches {match} on the {list} list. This payee can't be added." | Clear: "Continue". Review: "Send for review". Hit: "Back" |
| `review` | Review | `reviewSummary` | All fields, screening result | "Send for approval" |
| `consent` | Confirm | `consent` | "I confirm these details come from the payee and are correct." | |
| `otp` | | Pattern C | `stepup` | |
| `success` | Beneficiary sent for approval | `result` | "{name} can be paid once a second person approves it." (For Review: "Compliance will check the name first.") | "Add another", "Done" (returns to the calling journey when present) |
| `approve` | Approve beneficiary | `reviewSummary`, `screeningResult`, `consent` | For the second person. Buttons Approve / Reject | |
| `blocked` | Not added | `result` error | "{name} can't be added. Nothing was saved." | "Done" |
| `failed` | Not saved | `result` error | "Nothing was saved." | "Try again" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `NAME_REQUIRED` | "Enter the payee's full legal name." | `details` | |
| `IBAN_INVALID` / `BIC_INVALID` | The field messages above | `details` | |
| `COUNTRY_NOT_SUPPORTED` | "We can't pay to {country} yet." | `details` | |
| `BENEFICIARY_EXISTS` | "This payee is already on your list." | `details` | View payee |
| `SANCTIONS_HIT` | The Hit text above | `blocked` | Done |
| `BENEFICIARY_NOT_FOUND` / `BENEFICIARY_NOT_PENDING` | "We can't find that payee." / "This payee was already approved or rejected." | `approve` | Back |
| `SELF_APPROVAL` | "You cannot approve a payee you added" | `approve` | Back |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was saved." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | "The name check is not available right now. The payee was not saved. Please try again in a few minutes." | `failed` | Try again |

#### 5. Adapters
`add` = `corp.beneficiaries.add` (requiresOtp; runs the screening); `approve` = `corp.beneficiaries.approve` (requiresOtp); `list` = `corp.beneficiaries.list`. Existing `corp.company.get` currently returns the whitelist (`beneficiaries`) and stays the source for payments; an Active beneficiary appears there, which keeps `BENEFICIARY_NOT_WHITELISTED` working in all payment journeys.

#### 6. Permissions, step-up, limits
`biz.beneficiaries.manage`; `stepup` then `otp`. Approval by a different person with `biz.beneficiaries.approve`. First payment to a new beneficiary needs `stepup` (section 7 of the pattern).

#### 7. Result and links out
Status chips: Screening, Pending approval, Active, Blocked. Notification to approvers; to the maker when Active. Buttons: Done (to the payment journey that sent them).

#### 8. Acceptance criteria
- AC-1: Invalid names, BICs, IBANs and unsupported countries are refused with their own messages.
- AC-2: A name that matches the sanctions list is not saved and the reason is shown.
- AC-3: A name that nearly matches goes to review and cannot be paid until cleared.
- AC-4: A beneficiary can be paid only when Active (approved by a different person).
- AC-5: Timeout and unavailable save nothing; an unavailable screening never lets a payee through.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Bad IBAN, bad BIC, country with no rail | Three messages |
| T-2 | AC-2 | Name "Orion Shipping FZE" | `SANCTIONS_HIT`; list unchanged |
| T-3 | AC-3 | Name "Orion Shipping GmbH" | Review; payment attempt `BENEFICIARY_NOT_ACTIVE` |
| T-4 | AC-4 | `maya` adds "Alder Packaging GmbH"; `maya` approves; `tomas` approves | `SELF_APPROVAL`; then Active; payment possible |
| T-5 | AC-5 | `timeout: ["corp.beneficiaries.add"]` | Not saved |
| T-6 | AC-5 | `unavailable: ["corp.beneficiaries.add"]` | Not saved; not Active |

#### 10. Expected mutation-check survivors
Duplicate check (if no scenario adds the same payee twice): add one.

---

### ★ Standing instruction — `corp-standing-instruction`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-standing-instruction` |
| Purpose | Create, change or cancel a payment that repeats (monthly rent, a fixed cash sweep between entities) |
| Release / workspace / status | 2 / Business / New (planned). A business version of `schedule-business-payment` (Release 1), with a matrix approval for the whole series |
| Channels | Web, mobile |
| Who | `biz.standing.manage` |

#### 2. Entry points
Payments › hub › Standing instructions › New / Change / Cancel (`{instructionId, mode}`); Payments › tracker › payment › Make this repeat.

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `mode` | Standing instruction | `select` tiles (New, Change, Cancel), `select` (existing, when Change or Cancel) | Required: "Choose what to do." | "Continue" |
| `details` | Details | `accountPicker`, `beneficiaryPicker` or account (for sweeps), `amountInput`, `select` chips (Monthly, Quarterly, Yearly), `datePicker` (first date), `datePicker` (end date, optional), `textInput` (reference) | First date: a working day at least 2 working days ahead: "Choose a working day at least 2 working days from now." End date after first date: "The end date must be after the first payment." Day 29 to 31: "Monthly payments on day 29 to 31 go on the last working day of short months." Amount > 0, currency of the account. Payee must be Active | "Review" |
| `review` | Review | Pattern C `review` | Rows: From, To, Amount, Frequency, First payment, Last payment (or "Until cancelled"), Runs (count), Approvals for the series, "Each run is checked again on the day." Alert warning: "If there isn't enough money on the day, that payment is skipped and you are told." | "Send for approval" |
| `consent`, `otp`, `success`, `denied` | Pattern C | `success`: "Standing instruction sent for approval. First payment {date}." | | |
| `cancel` | Cancel | `dialog` | "Cancel this standing instruction? Payments already sent are not affected." | "Cancel instruction" |
| `failed` | Not saved | `result` error | "Nothing was changed. No payments are scheduled." | "Back" |

#### 4. Sandbox errors
Pattern C errors, and:
| Code | Message | Button |
|---|---|---|
| `INVALID_START_DATE` | "Choose a working day at least 2 working days from now." | |
| `INVALID_END_DATE` | "The end date must be after the first payment." | |
| `INSTRUCTION_NOT_FOUND` | "We can't find that instruction." | Back |
| `INSTRUCTION_NOT_ACTIVE` | "This instruction was already cancelled." | Back |
| `NO_MATRIX_ROW` | As `corp-high-value-payment` | |
| Skipped run (notification, not an error) | "Your standing payment of {amount} to {payee} on {date} was skipped: {reason}." | |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | |
| `TIMEOUT` | "This is taking longer than expected. Check Standing instructions before you try again." | Check list |
| `SERVICE_UNAVAILABLE` | Standard | Try again |

#### 5. Adapters
`create` = `corp.standing.create` (moneyMoving for future runs, requiresOtp); `update` = `corp.standing.update` (same); `cancel` = `corp.standing.cancel` (no OTP); `list` = `corp.standing.list`.

#### 6. Permissions, step-up, limits
`biz.standing.manage`; `otp`; `stepup` when the amount times the number of runs in the next 12 months is 5,000,000 or more. Each run counts against the limits on its day (existing rules).

#### 7. Result and links out
Notifications on approval, each run, each skip. Buttons: Track, Done.

#### 8. Acceptance criteria
- AC-1: The first payment is a working day at least 2 working days away.
- AC-2: The series needs approval from the matrix before the first run.
- AC-3: A run with too little money or an exceeded limit is skipped and reported, and later runs continue.
- AC-4: A cancelled instruction makes no more payments.
- AC-5: Timeout and unavailable create or change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Tomorrow; Saturday | Message both times |
| T-2 | AC-2 | | Status Pending approval; no run before approval |
| T-3 | AC-3 | `now` set to run day; balance too low | Run skipped with reason; next month runs |
| T-4 | AC-4 | Cancel then run day | No payment |
| T-5 | AC-5 | `timeout: ["corp.standing.create"]` | None created |
| T-6 | AC-5 | `unavailable: ["corp.standing.list"]` | Unavailable on `mode` |

#### 10. Expected mutation-check survivors
Day 29 to 31 handling survives unless a scenario starts on 31 January; add T-7.

---

### ★ Users and entitlements across entities — `corp-user-entitlements`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-user-entitlements` |
| Purpose | Invite or change a person and say, entity by entity, what they may do (role, accounts, limit), with a second administrator approving |
| Release / workspace / status | 2 / Business / New (planned). Group version of `manage-user` (Release 1) |
| Channels | Web only |
| Who | `biz.admin.users` to propose; `biz.admin.entitlements` to approve |

#### 2. Entry points
Admin › Users › Invite / Edit / Disable (`{userId}`); Admin › Pending changes (approve).

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `person` | Person | `textInput` (name), `textInput` (email), `select` chips (Active, Disabled) | Name required: "Enter the person's name." Email valid and not already used: "Enter a valid email address." / "This email already has access." | "Next" |
| `grants` | Access by entity | `entityTree` (multi-select), per entity: `select` chips (Maker, Approver, Admin, View only), `select` (accounts), `amountInput` (daily limit) | At least one entity: "Choose at least one company." A person cannot be Maker and Approver in the same payment path unless the entity allows it; Maker plus Approver shows the note "They can start and approve, but never the same payment." Limit not above the entity's per-person maximum: "The limit can't be more than {max} at {entity}." Admin cannot be combined with Maker at the same entity: "Administrators can't also start payments." | "Review change" |
| `review` | Review | `diffView`, `alert` | Before and after per entity. Alert: "A second administrator must approve this." | "Send for approval" |
| `consent`, `otp` | Pattern C | `stepup` | "I confirm this person should have this access." | |
| `success` | Change sent for approval | `result` | "The change applies once approved. Until then nothing changes." | "Back to Users" |
| `approve` | Approve change | `diffView`, `consent` | Approve / Reject (reason required) | |
| `failed` | Not sent | `result` error | "Nothing was changed." | "Back" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `USER_EXISTS` | "This email already has access." | `person` | Edit that person |
| `EMAIL_INVALID` | "Enter a valid email address." | `person` | |
| `ROLE_CONFLICT` | "Administrators can't also start payments." | `grants` | |
| `LIMIT_ABOVE_ENTITY` | "The limit can't be more than {max} at {entity}." | `grants` | |
| `LAST_ADMIN` | "{entity} must keep at least two administrators." | `grants` | |
| `USER_NOT_FOUND` | "No user {id} at {entity}" shown as "We can't find that person." | `person` | Back |
| `CHANGE_PENDING` | "A change for this person is already waiting." | `grants` | Open change |
| `CHANGE_NOT_FOUND` | "We can't find that change." | `approve` | Back |
| `SELF_APPROVAL` | "You cannot approve a change you proposed" | `approve` | Back |
| `OTP_*`, `STEP_UP_REQUIRED` | Standard | `otp` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`users` = `corp.admin.users.list`; `change` = `corp.admin.users.change` (requiresOtp); `approve` = `corp.admin.changes.approve` (requiresOtp). Today `corp.users.list` (sandbox "who am I") stays for the older journeys.

#### 6. Permissions, step-up, limits
`biz.admin.users` and `biz.admin.entitlements`; `stepup` then `otp`. Dual control: proposer cannot approve. Disabling takes effect at once for sign-in once approved; pending payments they started stay pending.

#### 7. Result and links out
Invitation email (sandbox: a notification). Audit trail records both people. Buttons: Back to Users.

#### 8. Acceptance criteria
- AC-1: Access is set per entity; a person has no access to an entity not chosen.
- AC-2: A limit above the entity's maximum, an Admin who is also a Maker, and removing the last administrator are refused.
- AC-3: A change is applied only after a different administrator approves.
- AC-4: A disabled user cannot approve or start anything.
- AC-5: Timeout and unavailable change nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | Grant `lena` Maker at Manufacturing only | `lena` at Holdings: `WRONG_CONTEXT` or no access |
| T-2 | AC-2 | Limit 10,000,000 vs max 5,000,000; Admin plus Maker; remove second admin | Three messages |
| T-3 | AC-3 | `kofi` proposes, approves himself | `SELF_APPROVAL`; second admin approves; applied |
| T-4 | AC-4 | Disable `tomas` | His approval `PERMISSION_DENIED` |
| T-5 | AC-5 | `timeout: ["corp.admin.users.change"]` | No change |
| T-6 | AC-5 | `unavailable: ["corp.admin.users.list"]` | Unavailable |

#### 10. Expected mutation-check survivors
None expected.

---

### ★ Reports and statements — `corp-report-request`

#### 1. Summary
| Item | Value |
|---|---|
| Slug | `corp-report-request` |
| Purpose | Get an account statement or report for one or many entities in a standard file (camt.053, CSV, PDF), once or on a schedule |
| Release / workspace / status | 2 / Business / New (planned). Extends `business-statement` (Release 1) for groups |
| Channels | Web, mobile (view and download) |
| Who | `biz.reports.view`; scheduling needs `biz.reports.schedule` |

#### 2. Entry points
Accounts › row › Statement (`{accountId}`); Accounts › transactions › Export (`{accountId, from, to}`); Reports › New report / Schedule.

#### 3. Screens
| Id | Title | Blocks | Fields and rules | Buttons |
|---|---|---|---|---|
| `choose` | Report | `select` (report type: Statement, Transactions, Balances, Payment status), `entityTree` (multi), `select` (accounts), `datePicker` range, `select` chips (camt.053, CSV, PDF), `select` chips (Once, Schedule) | Report required. At least one account. Period: from not after to; to not in the future; at most 12 months: "Choose a period of 12 months or less." Format must suit the report: camt.053 only for Statement ("camt.053 is only for statements."). Schedule: frequency (Daily, Weekly, Monthly), time (UTC), channel (Portal, Host-to-host, Email), recipients (email) | "Create report" or "Schedule" |
| `ready` | Your report | `result`, `reviewSummary` | Rows: Report, Companies, Accounts, Period, Format, Rows, Size. Over 100,000 rows: `TOO_MANY_ROWS` | "Download", "Back to Reports" |
| `scheduled` | Report scheduled | `result` | "The first report arrives on {date} at {time} UTC by {channel}." | "Back to Reports" |
| `otp` (schedule only) | | Pattern C | `otp` | |
| `failed` | Not created | `result` error | "Nothing was changed." | "Try again" |

#### 4. Sandbox errors
| Code | Message | Screen | Button |
|---|---|---|---|
| `REPORT_NOT_FOUND` | "We can't find that report." | `choose` | |
| `INVALID_PERIOD` | "The end date must be after the start date." / "You can't choose a future date." | `choose` | |
| `PERIOD_TOO_LONG` | "Choose a period of 12 months or less." | `choose` | |
| `FORMAT_NOT_SUPPORTED` | "camt.053 is only for statements." | `choose` | |
| `TOO_MANY_ROWS` | "This report has more than 100,000 rows. Choose a shorter period or fewer accounts." | `choose` | |
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `choose` | |
| `H2H_NOT_ACTIVE` | "Host-to-host isn't turned on for {entity}." | `choose` | Set up (`corp-host-to-host`) |
| `EMAIL_INVALID` | "Enter a valid email address." | `choose` | |
| `SCHEDULE_LIMIT` | "You can schedule at most 20 reports." | `choose` | |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |

#### 5. Adapters
`catalogue` = `corp.reports.catalogue`; `request` = `corp.reports.request`; `schedule` = `corp.reports.schedule` (requiresOtp); `accounts` = `corp.accounts.list`. None moneyMoving.

#### 6. Permissions, step-up, limits
`biz.reports.view` (and `biz.accounts.export` for statements); `otp` to schedule. Only entities the person can see (group view) can be chosen.

#### 7. Result and links out
File opens in the `documentViewer` or downloads. Scheduled files appear in Files with channel Report or Host-to-host. Buttons: Back to Reports.

#### 8. Acceptance criteria
- AC-1: A report covers only the chosen accounts and period, and only entities the person can see.
- AC-2: Period and format rules are enforced.
- AC-3: The camt.053 file balances: opening plus entries equals closing, per account.
- AC-4: Scheduling to host-to-host needs an active connection.
- AC-5: Timeout and unavailable create nothing.

#### 9. Scenarios
| Id | Covers | Setup | Expected |
|---|---|---|---|
| T-1 | AC-1 | `lena` asks for Holdings accounts | Not offered; direct call `PERMISSION_DENIED` |
| T-2 | AC-2 | 13 months; CSV transactions as camt.053 | Both messages |
| T-3 | AC-3 | `maya`, statement for a month | Opening + entries = closing |
| T-4 | AC-4 | Schedule to host-to-host before setup | `H2H_NOT_ACTIVE` |
| T-5 | AC-5 | `timeout: ["corp.reports.request"]` | No file |
| T-6 | AC-5 | `unavailable: ["corp.reports.catalogue"]` | Unavailable |

#### 10. Expected mutation-check survivors
Schedule limit of 20 (no scenario makes 21): add one or list it.

---

## 10. Open questions

1. Multi-currency limits: today limits and the approval threshold are written in one company currency (`CURRENCY_NOT_SUPPORTED` refuses accounts in another). For groups, should limits be per currency or converted at the day's rate? The matrix rows in this file carry a currency; confirm.
2. Does a group need a **consolidated daily limit** above the entity limits? The sandbox has per-person and per-entity limits only.
3. Rails: which real RTGS and SWIFT behaviours should the sandbox copy (cut-off by currency, charges OUR/SHA/BEN)? Charges here are simulated.
4. Dual control for host-to-host key changes: proposed (second administrator), not yet in `corp-host-to-host`. Confirm and add.
5. Should high-value payments be startable on a phone, or only approved there?
6. The 5,000-line file cap and 5 MB limit are sandbox values. What does the target bank allow?
7. On `TIMEOUT` the sandbox does not apply the request (README 1.5). A real bank may have. Copy tells the person to check the tracker or Files first. Confirm.
8. The existing "Who am I" screen in the five existing corporate journeys is replaced by the active context in Release 2 (README 2.3). Keep both for Acme until all journeys are migrated?
9. Screening list: the sandbox uses a small synthetic list. Name matching rules (exact, near) need a compliance owner's view.
10. Payroll files: should payroll also accept pain.001 (with salary payment purpose), or stay on the register-based CSV?
