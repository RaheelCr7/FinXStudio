# BankWorkx® journey specification

This folder is **step 0** of the BankWorkx® plan: a written spec of every journey and shell screen for the eight banking modules. Later steps (sandbox, new blocks, shell, journeys) are written from it. It describes what to build and how to prove it. It changes no code.

Brand rule: the product is written **BankWorkx®**. All people, companies, numbers and amounts here are synthetic.

## Contents

| File | Module | Release | Workspace | Depth |
|---|---|---|---|---|
| [01-retail.md](01-retail.md) | 1. Retail (pre-login, sign-in, security, Personal "Aurora"): 57 journeys | 1 | Public + Personal | Full |
| [02-sme.md](02-sme.md) | 2. SME (Business "Graphite") and the combined Alex Morgan demo: 22 journeys | 1 | Business | Full |
| [03-wealth.md](03-wealth.md) | 3. Wealth: 10 journeys | 2 | Personal (Wealth section) | Structure + planned parts |
| [04-corporate.md](04-corporate.md) | 4. Corporate: 11 journeys | 2 | Business | Structure + planned parts |
| [05-trade-finance.md](05-trade-finance.md) | 5. Trade Finance: 12 journeys | 3 | Business | Structure + planned parts |
| [06-cash-liquidity.md](06-cash-liquidity.md) | 6. Cash & Liquidity: 11 journeys | 3 | Business | Structure + planned parts |
| [07-supply-chain-finance.md](07-supply-chain-finance.md) | 7. Supply Chain Finance: 11 journeys | 4 | Business | Structure + planned parts |
| [08-factoring.md](08-factoring.md) | 8. Factoring: 12 journeys | 4 | Business | Structure + planned parts |
| [09-payment-rails.md](09-payment-rails.md) | Shared reference for payments: US, Europe (SEPA), UK, Middle East and SWIFT rails, payee fields and checks, FX, limits, receipts, error codes | 1 | Personal + Business | Full |
| [10-journey-catalog.md](10-journey-catalog.md) | Journey catalog: every journey as a catalog entry a bank can switch on or off, with options, and what is built in the prototype | 1 | All | Full |
| [research/](research/) | One research note per built journey (sources, patterns by region, standards, decisions, fields, edge cases) | 1 | All | 22 notes |

Release 1 (modules 1 and 2) is at full depth: every screen, field, message, adapter and test. Releases 2–4 use the same structure, and name the sandbox domains, adapters (marked *planned*) and new components each needs.

Sources this spec is grounded in: the sandbox (`packages/mock-bank-api/src/`: `index.ts`, `corporate.ts`, `catalog.ts`, `cab.ts`, `finance.ts`), the journey schema (`packages/journey-schema/src/schema.ts`), existing journeys (`packages/journey-schema/src/fixtures/`: `bankworkx.ts`, `cab.ts`, `local-transfer.ts`, `convert-currency.ts`, `pay-bill.ts`, `corporate-payments.ts`, `bulk-payment.ts`, `payroll-run.ts`, `withdraw-payment.ts`), the client (`packages/bank-client/src/app.ts`) and the docs `docs/BANKWORKX.md`, `docs/CORPORATE.md`, `docs/CAB.md`.

---

## Journey design rules (decided at the first prototype review)

These override anything heavier in the module files. They apply to every journey.

1. **Looks like a shipped bank app.** One short title per screen and at most one short helper line. No explainer paragraphs, "why we ask" text, sandbox or demo notes, or scheme names (no ACH, SEPA, Faster Payments, CHAPS, SARIE, UETR and so on) in customer-facing text. A warning shows only when it applies. Customers see short plain messages; error codes stay in the sandbox and tests.
2. **Country-neutral, standard journeys.** Journeys are defined by *type*, not by country. Country names never appear in headings, chips, hints or copy; a Country field is data only. The bank's **home market** is a configuration setting, not something the customer picks. It decides which local identifiers a form asks for (routing number and account number; sort code and account number; IBAN), the national ID format and whether proof of address is required.
3. **Transfers have four types**, the same for every bank: between my accounts; to a BankWorkx® customer; to another bank (domestic); to another country (international). The customer picks a **speed class** (Standard, Same day, Instant), not a scheme. The bank maps each class to a real rail per market in configuration (see 09-payment-rails.md).
4. **One standard onboarding** covers every market: Get started, About you, Address, Verify your identity (document and selfie), Work and money, Tax, Choose your account, Review and agree, Status. Market differences are configuration.
5. **Everything is a catalog entry** (see 10-journey-catalog.md): a bank switches journeys on or off and sets options. Finer behaviour such as official statements, bank file formats, delegation and payslips are options, off or on by default as listed in each journey.
6. **Demo helpers live outside the journeys.** Sample data is filled by one control in the prototype toolbar (Autofill step), never by buttons or notes inside a journey.

**Status.** The prototype follows these rules for the core journeys. The journey blocks in 01-retail.md and 02-sme.md for these journeys (personal-transfer, single-transfer, transfer-types, open-account, accounts, account-details, statement, cards, card-controls, activate-card, pay-bill, schedule-payment, supplier-payment, bulk-payment, bulk-status, payroll-run, approve-payments, business-accounts, business-statement) were written from an earlier, heavier version and still name countries and schemes. They must be synced to the rules above before step 2.

## 1. Conventions

### 1.1 What is marked how

- **Existing**: in the code today. Named exactly as the code names it.
- **Existing, upgraded**: the journey exists (`fixtures/bankworkx.ts`) and gets consent, OTP and proof.
- **(planned)**: does not exist yet. Always marked, for adapters, blocks, journeys, sandbox domains and engine features.
- A ★ marks a **journey**: a server-driven flow with steps and a submit, carrying full proof. Everything else is a **shell screen** (a place), drawn by the app from view-models in `packages/bank-client`.

### 1.2 Names and ids

| Thing | Pattern | Example |
|---|---|---|
| Journey slug | lower-case, hyphens | `freeze-card` |
| Screen id | lower camel case, unique in the journey | `reviewTransfer` |
| Integration id | what the journey calls the adapter | `createTransfer` |
| Acceptance criterion | `AC-n`, per journey, a sentence that must be true | `AC-3` |
| Scenario | `T-n`, per journey, says which `AC-n` it covers | `T-4` |
| Launch point | `place › label` | `Cards › card › Freeze` |
| Passed value | `{name}` in the entry-point tables | `{cardId}` |
| Permission | dotted lower case, see section 4 | `cards.manage` |

Journey fields (`packages/journey-schema/src/schema.ts`): `id`, `slug`, `name`, `version`, `status`, `channels`, `apps: ["bankworkx"]`, `locale`, `entryScreen`, `acceptance`, `scenarios`, `authorisation`, `dataModel`, `integrations`, `screens`. **Planned** field: `workspace: "personal" | "business" | "public"` (step 4 of the plan). Journeys the person can use before signing in are `public`.

### 1.3 The depth of a journey (the template)

Every ★ journey is written with these headings, in this order. A heading that does not apply says "None" and why.

1. **Summary table**: slug, purpose, release, workspace, status (new, or existing and its fixture), channels (web, mobile), starting pattern, who may use it.
2. **Entry points**: table of *place › label*, values passed in, permission needed. Every launch point comes from the link map (section 5) and must agree with it.
3. **Screens**, in order. For each screen: id and title; blocks used (schema block types, or *(planned)* blocks); a **fields table** (label, block, required, validation rule, error message); the **copy** (title, body, helper text, exact wording of alerts); **buttons and where each leads**; **states** (loading, empty, error).
4. **Sandbox errors**: one row per code the adapters can return: the message the person sees, the screen it shows on, and what the button does.
5. **Adapters**: integration id, adapter name, request, response, error codes, existing or *(planned)*.
6. **Permissions, step-up and limits.**
7. **Result and links out**: result screen, receipt contents, notifications raised, and where the buttons lead (shell places or other journeys).
8. **Acceptance criteria**: `AC-1 …`.
9. **Scenarios**: `T-1 …` with persona, setup, sandbox `conditions` where used, the criteria it covers, and the expected outcome. Every criterion is covered. Every money-moving, security or file journey includes a **timeout** scenario and an **unavailable** scenario.
10. **Expected mutation-check survivors**: what `finx_mutation_check` is expected to leave alive, with the reason (another layer already stops it, or the sandbox cannot produce it). "None expected" is allowed when true. The test fails on any survivor not listed.

A **shell screen** is specified to the same depth: purpose, route (web and mobile), data source (view-model), widgets, table columns, filters, sort order, empty state, loading state, error state, drill-downs (where each tap leads) and launch points on it.

### 1.4 Screen and block rules (every journey)

- **Loading**: skeleton for lists and cards; a disabled button with a spinner for submits. After 10 seconds without an answer the screen shows the timeout state.
- **Empty**: every list has an empty state: one sentence, and one button when there is an obvious next step.
- **Error**: a message in plain words, what happened to the person's money ("No money has left your account" or "Nothing was changed"), and one button (retry, edit, or back).
- **Success**: a `result` block with a reference, then buttons.
- Plain language, no jargon, sentence case. A button names the action ("Send $120.00"), not "Submit".
- Amounts use the account's currency and its decimal places (`packages/ui-kit` `currencyInfo`, `roundMoney`).
- Dates: `12 Nov 2026`; times 24-hour with the bank's time zone (UTC in the sandbox).
- Every money-moving journey has, in order: review screen, consent (`consent` block, `mustBeTrue`), one-time code (`otp` block, 6 digits, 3 attempts, resend after 30 s), result. Today's fixtures resend after 60 s; the upgrades move to 30 s.
- Accessibility: each field has a visible label; errors are announced; tap targets 44 pt; reduced motion respected.
- Languages: English first. Journeys carry `locale.supported: ["en"]` in Release 1; the CAB access journeys show the pattern for Arabic.

### 1.5 Sandbox conditions (planned)

`MockBank.conditions { latencyMs, timeout[], unavailable[], empty[] }`, set by a dev-only "Sandbox conditions" panel and by a scenario field `conditions`. Each list holds adapter names (or `bank.*` / `corp.*` prefixes).

- `timeout`: the adapter answers `TIMEOUT` after `latencyMs`. In the sandbox the request is **not applied** (state unchanged). The copy still tells the person to check Activity before trying a money-moving step again, because a real bank might have applied it (see open questions).
- `unavailable`: the adapter answers `SERVICE_UNAVAILABLE` at once.
- `empty`: list adapters answer an empty result, to test empty states.

### 1.6 Standard messages (used by every journey)

Journeys list their own messages in the *Sandbox errors* table. The messages below are the shared defaults; a journey may reword one but must say so. `Existing` codes are in `packages/mock-bank-api/src`; `(planned)` codes come with step 2 (identity and conditions).

| Code | Status | Message the person sees | Default button |
|---|---|---|---|
| `OTP_INVALID` | Existing (carries `attempt`) | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." | Try again / Start again |
| `OTP_REQUIRED` | Existing | "Confirm with your one-time code first." | Back to code |
| `ACCOUNT_NOT_FOUND` | Existing | "We can't find that account. Choose another." | Choose account |
| `INSUFFICIENT_FUNDS` | Existing | "There isn't enough money in {account}. Available: {balance}. No money has left your account." | Change amount |
| `LIMIT_EXCEEDED` | Existing | "This is above your daily limit of {limit}. You have {remaining} left today." | Change amount |
| `INVALID_AMOUNT` | Existing | Specific to the journey (see its table) | Change amount |
| `CORE_UNAVAILABLE` | Existing | "We couldn't complete this right now. No money has left your account." | Try again |
| `NOT_SUPPORTED` | Existing | "This isn't available for your profile." | Back |
| `TIMEOUT` | (planned) | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." For non-money steps: "This is taking longer than expected. Nothing was changed." | Check Activity / Try again |
| `SERVICE_UNAVAILABLE` | (planned) | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | Try again / Back |
| `PERMISSION_DENIED` | (planned) | "Your role doesn't allow this. Ask an administrator at {company}." | Back |
| `WRONG_CONTEXT` | (planned) | "This belongs to your {workspace} banking. Switch to {workspace} to continue." | Switch |
| `STEP_UP_REQUIRED` | (planned) | "For your security, confirm it's you first." | Confirm |
| `SESSION_EXPIRED` | (planned) | "You were signed out for your security. Sign in again to continue. Nothing you were doing was saved." | Sign in |

Payment codes (invalid IBAN, routing, sort code or BIC, `NOT_SEPA`, `COUNTRY_MISMATCH`, `RAIL_NOT_AVAILABLE`, `RAIL_LIMIT`, `QUOTE_EXPIRED`, `DAILY_LIMIT_EXCEEDED`, `PURPOSE_REQUIRED`, `PAYMENT_HELD`, `PAYMENT_RETURNED`, `NOT_APPROVED_IN_TIME` and others) are defined with their wording in [09-payment-rails.md](09-payment-rails.md) section 12.

Further planned codes used by the module files: `STEP_UP_FAILED`, `LOCKED`, `INVALID_PIN`, `DEVICE_LIMIT`, `RATE_LIMITED`, `BENEFICIARY_COOLING_OFF`, `FILE_*` (file checks), `REPAIR_NOT_ALLOWED`, `NOTHING_TO_REPAIR`, `NOT_YOUR_TURN`, `SELECTION_TOO_LARGE`, `EMPTY_SELECTION`. Step-up stays valid for 300 s; wrong passwords and PINs share one counter of 3.

Corporate codes (existing, `corporate.ts`, shown through `ctx.error.message`): `NOT_AUTHORISED`, `SELF_APPROVAL`, `ALREADY_APPROVED`, `BENEFICIARY_NOT_WHITELISTED`, `LIMIT_USER_EXCEEDED`, `LIMIT_COMPANY_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `PAYMENT_NOT_PENDING`, `PAYMENT_NOT_FOUND`, `USER_NOT_FOUND`, `EMPTY_BATCH`, `BATCH_TOO_LARGE`, `NO_VALID_LINES`, `INVALID_PERIOD`, `PAYROLL_ALREADY_RUN`; row codes `DUPLICATE_LINE`, `NOT_AN_EMPLOYEE`, `ABOVE_SALARY_CAP`. Their wording is in `docs/CORPORATE.md`.

### 1.7 The synthetic cast (sandbox seed, planned unless marked)

**Business seed values** (one table so every file agrees; proposed, to be confirmed in step 2): Alpha and Beta both USD; Alex's daily limit at Alpha 250,000.00; company daily limit 1,000,000.00 at each company (bank ceiling 2,000,000.00); two approvers above 50,000.00; step-up amount 25,000.00; batch cap 20; file cap 256 KB; idle timeout 300 s with a 60 s warning; up to 5 trusted devices. Personal: cooling-off cap $500.00 equivalent in 24 hours for a beneficiary under 24 hours old.


| Who | Detail |
|---|---|
| **Alex Morgan** (`alex`, existing persona, extended) | Phone +1 415 555 0142 (existing). One-time code `482100` (existing). Accounts: Main ••4410 USD 8,720.76 and Savings ••7731 USD 15,254.37 (existing); EUR Travel ••5502 and AED Home ••8816 (planned). Daily limit 50,000 USD (existing). Demo sign-in `alex.morgan` / `Bwx!Demo2026` (planned; lives in the sandbox seed file only). |
| **Sam Rivera** (`sam`, existing) | New customer, nothing yet. Onboarding and empty states. |
| **Alpha Trading LLC** (`alpha`, planned, built on `CorporateSandbox`) | Currency USD. Alex is **Maker** (can start payments, cannot approve). Other users: `dana` (approver), `lee` (approver), `ravi` (admin). |
| **Beta Services Ltd** (`beta`, planned) | Currency USD. Alex is **Approver** (cannot start payments). Other users: `priya` (maker), `omar` (maker), `noor` (admin). Beta has a payment started by `priya` that waits for Alex. |
| **Jordan Lee** (`jordan`, planned) | Existing customer not yet registered for digital banking. Phone +1 415 555 0177, account `7700002208`, code 482100. Alex's account number for the already-registered path is `7700004410`. |
| **Demo sign-in extras** (planned) | `demo.locked`, `demo.expired`, `demo.inactive` for the lockout, expired and not-active paths. |
| **More Business users** (planned) | `sofia` (second approver at Beta, needed for sequential and parallel scenarios); `tess_m` (Maker at Alpha); Release 2–4 casts (`elena` for Wealth; Northwind Group with `maya`, `tomas`, `ines`, `kofi`, `lena` for Corporate) are in their module files. |
| **Demo users link** | The sign-in screen's "Demo users" link lists the personas with what each shows. |

Existing sandbox rules that the specs rely on: one-time code `482100` (and `000000` always accepted); `bank.otp.verify` counts failures; card numbers must pass the Luhn check (`4242 4242 4242 4242` and `5555 5555 5555 4444` pass); adding money $1–$50,000; budgets $10–$100,000; top-up 50–5,000 (existing PKR rule, to be generalised per currency); corporate rules in `docs/CORPORATE.md` (maker-checker, whitelist, limits, threshold, cut-off 16:00 UTC, weekends and 9 Nov 2026 closed).

---

## 2. Shared components

### 2.1 Blocks in the schema today
`text`, `stepper`, `accountPicker`, `beneficiaryPicker` (`allowAddNew`, `addNewJourney`), `amountInput` (`quickAmounts`, `validation`), `select` (`chips`, `tiles`, `rows`; `choices`), `textInput` (`secure`, `lines`, `pattern`), `toggle`, `cardForm`, `alert`, `reviewSummary`, `consent`, `otp` (`keypad`, `masked`), `result`, `hero`, `divider`, `balanceList`, `dialog`, `map`, `accordion`, `sectionHeader`, `shortcuts`, `menu`, `button`.
Actions: `validate`, `navigate` (`to`, `toJourney`, `returnTo`), `setData`, `callApi` (`onError`: `navigate`, `showToast`, `stay`, `lockAfter`, `lockTo`), `showToast`, `share`, `exit`. `toJourney` and `returnTo` exist in the schema; wiring them in the engine is step 4.

### 2.2 New blocks (planned, step 4), referred to by these names

| Batch | Block | Used for |
|---|---|---|
| A | `dataTable` | Sort, filter, search, pages, selectable rows; a card list on phones |
| A | `timeline` | Payment and application status history |
| A | `statusChip` | Status words with a colour and an icon |
| A | `datePicker` | Dates and date ranges (CAB types DD / MM / YYYY today) |
| A | `chart` | Reuses `LineChart` and `Donut` widgets |
| B | `fileUpload` | CSV, XML, PDF, images |
| B | `documentViewer` | A document the person must read to the end |
| B | `signature` | Drawn or typed signature, plus OTP |
| B | `idCapture` | Simulated ID document and selfie |
| Engine | `navigate.toJourney` + `returnTo` | Journey opens another and comes back |
| Engine | receipts | Print on web, share sheet on mobile |
| Engine | `session.permissions` | Read-only, usable in `visibleWhen` |

Modules 3–8 name any further components they need under "New components" in their own file.

### 2.3 Sandbox identity and enforcement (planned, step 2)
`identity.ts` adds `bank.session.get` (identity, contexts, each context's permissions and limits), `bank.session.switch {contextId}` (may answer `STEP_UP_REQUIRED`), `bank.session.stepUp`. Every adapter reads the **active context**. Business adapters take the acting user from the context and refuse a different `input.userId` (`PERMISSION_DENIED`). Personal adapters refuse while a business context is active (`WRONG_CONTEXT`). Existing Meezan corporate journeys with their in-journey "who" screen keep working. Fixes that come with it: `rejectPayment` must refuse the person who started the payment; `corp.payments.get` needs an access check; `release` must honour `flaws.companyLimit`.

---

## 3. Information architecture

Three places a person can be: **Public** (before sign-in), **Personal "Aurora"**, **Business "Graphite"**. A journey belongs to one. The Business menu never lists Personal journeys and the reverse.

### 3.1 Public (before sign-in)
Splash (mobile: forced-update and maintenance check) → Welcome carousel (3 cards) → Language choice → **Landing** with: Sign in, Open an account, Register for digital banking, Explore.

| Landing section | Shell screens | Journeys |
|---|---|---|
| Explore | Products (accounts, cards, deposits, loans) with a detail page each; Exchange rates (table); Legal pages (terms, privacy, cookies, licences) | `loan-calculator`, `deposit-calculator`, `find-branch-atm`, `contact-support` |
| New customer | Application tracker landing | `open-account`, `track-application` |
| Existing customer | Register landing | `register-digital-banking` |
| Sign-in | Returning sign-in (biometrics or quick PIN, password fallback) is a mode of `sign-in` | `sign-in`, `forgot-username`, `reset-password`, `unlock-account` |

### 3.2 Personal "Aurora" (bottom tabs on mobile, left rail on web)
Light and airy; bento widgets; floating pill tab bar; ⌘K command bar on web.

| Tab | Shell screens | Journeys |
|---|---|---|
| Home | Dashboard: balance hero, accounts, insights, upcoming payments, offers | none |
| Accounts | List; account detail; transaction history; transaction detail; spending analysis; budgets | `statement`, `account-nickname`, `open-another-account`, `create-budget` |
| Payments | Hub; beneficiaries; scheduled and recurring; payment tracker with receipts | `own-transfer`, `internal-transfer`, `personal-transfer`, `international-transfer`, `pay-bill`, `mobile-topup`, `manage-beneficiary`, `schedule-payment`, `cancel-standing-order` |
| Cards | Carousel; card detail; card transactions; controls overview | `activate-card`, `freeze-card`, `card-controls`, `virtual-card`, `replace-card`, `card-pin`, `dispute-transaction`, `add-card` |
| Save & Borrow | Deposits; savings goals; loans with schedules; investments | `term-deposit`, `savings-goal`, `apply-loan`, `repay-loan`, `invest`, `sell-investment`, `add-money` |
| More | Profile; secure messages; notification centre; service request tracker; settings; help; legal; sign out | `update-profile`, `new-message`, `service-request`, `connect-account`, `change-password`, `trusted-devices`, `change-quick-pin`, `setup-quick-login` |

### 3.3 Business "Graphite" (top bar: entity selector with role badge, switch back to Personal)
Dense and professional; split list-plus-detail on web; tables become card lists on phones.

| Tab | Shell screens | Journeys |
|---|---|---|
| Overview | Dashboard: consolidated balances, 13-week cash flow, approvals queue with cut-off timers, recent payments | none |
| Accounts | Accounts table (multi-currency); account detail; transaction table with advanced filters and export; statements; reports | `business-statement` |
| Payments | Hub; tracker (status timeline); templates; suppliers; scheduled; bulk and payroll history | `supplier-payment`, `bulk-payment`, `repair-bulk-lines`, `payroll-run`, `payment-template`, `schedule-business-payment`, `withdraw-payment`, `add-supplier` |
| Approvals | Inbox (filters, batch select); signatory progress; history | `approve-payments` |
| Admin | Users; roles; account permissions; limits; signatory groups; audit trail | `manage-user`, `change-limits`, `edit-signatory-group` |
| More | Business profile; service requests; messages; notifications; settings | `business-service-request`; stretch `kyb-onboarding` |

**Tabs added in Releases 2–4** (see the module files): Wealth is a segment inside Save & Borrow plus a Home widget in Personal (a sixth tab does not fit the phone tab bar). In Business: *Group* (entity hierarchy, Module 4), *Trade* (Module 5), *Cash* (Module 6) and *Finance* (Modules 7 and 8, sections Supply chain and Factoring). The Approvals inbox gets a Type filter (Payments, Trade, Treasury, Supply chain, Factoring) and new item kinds: `scf_financing`, `scf_repayment`, `factoring_advance`, `reserve_release`, `repurchase`, `pass_on`. Whether the phone tab bar can hold these is an open question.

Release 1 journey count: **Retail 52, SME 17 (14 + 1 stretch + 2 screens added in the prototype)**, checked against the module files (section 6).

---

## 4. Permission vocabulary

A permission is a dotted name returned by `bank.session.get` for the **active context**. A launch point shows only when the context holds the permission (check 1); the journey's `authorisation` checks again (check 2); the sandbox enforces the rule whatever the UI shows (check 3, `PERMISSION_DENIED`).

### 4.1 Personal context (Alex as a retail customer)
| Permission | Allows |
|---|---|
| `accounts.view` | See accounts, balances, transactions |
| `accounts.statement` | Download statements |
| `accounts.manage` | Nicknames, open another account |
| `payments.create` | Make transfers, bills, top-up |
| `payments.schedule` | Create, change and cancel scheduled and standing orders |
| `beneficiaries.manage` | Add, edit, delete beneficiaries |
| `cards.view` | See cards |
| `cards.manage` | Activate, freeze, limits and controls, virtual card, replace |
| `cards.pin` | Set or change card PIN |
| `cards.dispute` | Dispute a transaction |
| `savings.manage` | Term deposits, savings goals |
| `loans.apply` / `loans.repay` | Apply for a loan / repay or settle |
| `invest.trade` | Buy and sell |
| `profile.update` | Change contact details (step-up) |
| `messages.send` | Secure messages and service requests |
| `security.manage` | Password, devices, quick PIN |

### 4.2 Business context (prefix `biz.`)
| Permission | Allows | Typical role |
|---|---|---|
| `biz.accounts.view` | Accounts, balances, transactions | Maker, Approver, Admin |
| `biz.accounts.export` | Statements, reports, exports | Maker, Approver, Admin |
| `biz.payments.initiate` | Start single payments | Maker |
| `biz.payments.bulk` | Start bulk payments, repair lines | Maker |
| `biz.payroll.run` | Start payroll | Maker |
| `biz.payments.schedule` | Schedule payments | Maker |
| `biz.payments.withdraw` | Withdraw own pending payments | Maker |
| `biz.templates.manage` | Save and use templates | Maker |
| `biz.suppliers.manage` | Add and edit suppliers (approved list) | Maker; approval per policy |
| `biz.approvals.view` | See the approvals inbox | Approver, Maker (own only) |
| `biz.approvals.approve` | Approve or reject others' payments | Approver |
| `biz.admin.users` | Invite, edit, disable users | Admin |
| `biz.admin.limits` | Change limits | Admin |
| `biz.admin.signatories` | Edit signatory groups | Admin |
| `biz.audit.view` | Read the audit trail | Admin, Approver |
| `biz.requests.create` | Business service requests | Maker, Admin |

**Business roles** in the sandbox today are `initiator` (shown as Maker) and `approver`; Release 1 adds `admin` (planned).

**Permissions added by later modules** (each module file lists its own, with the launch points):
- Wealth (Personal): `wealth.view`, `wealth.profile.manage`, `wealth.advice.accept`, `wealth.trade`, `wealth.treasury`, `wealth.documents`, `wealth.contact`.
- Corporate: `biz.group.view`, `biz.payments.highvalue`, `biz.intragroup.initiate`, `biz.files.upload`, `biz.files.view`, `biz.h2h.manage`, `biz.admin.matrix`, `biz.delegations.manage`, `biz.beneficiaries.manage`, `biz.beneficiaries.approve`, `biz.standing.manage`, `biz.admin.entitlements`, `biz.reports.view`, `biz.reports.schedule`.
- Trade: `biz.trade.view`, `.initiate`, `.amend`, `.documents`, `.finance`.
- Cash: `biz.cash.view`, `.link`, `.forecast`, `.request`, `.transfer`, `.structure`, `.rules`; `biz.treasury.fx`, `biz.treasury.invest`.
- Supply chain: `biz.scf.view`, `.programme.manage`, `.suppliers.manage`, `.terms.accept`, `.finance.request`, `.offers.manage`, `.repay`; `biz.invoices.upload`, `biz.invoices.approve`.
- Factoring: `biz.factoring.view`, `.apply`, `.fund`, `.repurchase`, `.dispute`, `.report`; `biz.invoices.assign`.

Separation of duties (existing sandbox rule): nobody approves what they started (`SELF_APPROVAL`). The Alex demo relies on it: at Alpha he is Maker without `biz.approvals.approve`; at Beta he is Approver without `biz.payments.initiate`.

### 4.3 Step-up levels
| Level | Meaning | Used for |
|---|---|---|
| `none` | Session only | Reading |
| `otp` | One-time code at the final step | Transfers, bills, top-up, card controls that loosen limits |
| `stepup` | Re-confirm with password or biometrics, then a one-time code (`bank.session.stepUp`) | Switching to Business, changing password, profile, card PIN, trusted devices, admin changes, approving above a threshold |

### 4.4 Limits
Personal: daily transfer limit per currency (`bank.limits.get`; Alex 50,000 USD). Business: per-person and per-company daily limits in the company currency, approval threshold, signatory group rules, cut-off (`docs/CORPORATE.md`).

---

## 5. Link map

A launch point records: place, action label, journey, values passed in, permission needed. Both apps draw their buttons from one list (`packages/bank-client/src/launch-points.ts`, planned). Journey result screens lead back to the shell: *Track payment*, *View receipt*, *Go to approvals*, or *Done* (returns to where the person started). A link to another context switches first, asks for step-up if policy requires, then opens.

Ways into any journey: a shell button, the **+** quick actions, the ⌘K command bar, a notification, a deep link (`/personal/j/<slug>?cardId=…`, `bankworkx://business/<company>/j/<slug>?paymentId=…`).

### 5.1 Public

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Landing | Sign in | `sign-in` | – | none |
| Landing | Open an account | `open-account` | `{productId}` optional | none |
| Landing | Register for digital banking | `register-digital-banking` | – | none |
| Landing | Track my application | `track-application` | `{applicationId}` optional | none |
| Landing | Find a branch or ATM | `find-branch-atm` | `{kind}` | none |
| Landing | Contact us | `contact-support` | – | none |
| Products › any detail | Open this account | `open-account` | `{productId}` | none |
| Products › loan detail | Estimate repayments | `loan-calculator` | `{productId}` | none |
| Products › deposit detail | Estimate returns | `deposit-calculator` | `{productId}` | none |
| Sign-in screen | Forgot username | `forgot-username` | – | none |
| Sign-in screen | Forgot password | `reset-password` | `{username}` if typed | none |
| Sign-in screen | Account locked (result) | `unlock-account` | `{username}` | none |
| Sign-in screen | Register | `register-digital-banking` | – | none |
| Sign-in (after first success) | "Remember this device" | `setup-quick-login` | – | session |

Leads to: sign-in ends in the Personal Home (or the last used workspace); open-account ends in `track-application`; register ends in `sign-in`; reset and unlock end in `sign-in`.

### 5.2 Personal "Aurora"

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Home | + quick action: Send money | `personal-transfer` | – | `payments.create` |
| Home | + Pay a bill / Top up / Add money | `pay-bill` / `mobile-topup` / `add-money` | – | `payments.create` |
| Home | Upcoming payment › Edit | `schedule-payment` | `{scheduleId}` | `payments.schedule` |
| Home | Offer › Apply | `apply-loan` or `open-another-account` | `{offerId}` | `loans.apply` / `accounts.manage` |
| Accounts › list | Open another account | `open-another-account` | – | `accounts.manage` |
| Accounts › detail | Statement | `statement` | `{accountId}` | `accounts.statement` |
| Accounts › detail | Rename | `account-nickname` | `{accountId}` | `accounts.manage` |
| Accounts › detail | Transfer from this account | `own-transfer` / `personal-transfer` | `{accountId}` | `payments.create` |
| Accounts › transaction detail | Dispute | `dispute-transaction` | `{transactionId}` | `cards.dispute` |
| Accounts › transaction detail | Download receipt | shell receipt | `{transactionId}` | `accounts.view` |
| Accounts › budgets | New budget | `create-budget` | `{category}` | `accounts.manage` |
| Payments › hub | Between my accounts | `own-transfer` | – | `payments.create` |
| Payments › hub | To a BankWorkx customer | `internal-transfer` | `{beneficiaryId}` | `payments.create` |
| Payments › hub | Send money (US, Europe, UK, Middle East) | `personal-transfer` | `{beneficiaryId, region}` | `payments.create` |
| Payments › hub | Send money abroad (other countries, SWIFT) | `international-transfer` | `{beneficiaryId, country}` | `payments.create` |
| Payments › hub | Bills / Top-up | `pay-bill` / `mobile-topup` | `{billerId}` / `{carrierId}` | `payments.create` |
| Payments › beneficiaries | Add / Edit / Delete | `manage-beneficiary` | `{mode, beneficiaryId}` | `beneficiaries.manage` |
| Payments › beneficiaries › row | Send money | `personal-transfer` or `international-transfer`, chosen by the payee's region | `{beneficiaryId}` | `payments.create` |
| Payments › scheduled | New / Change | `schedule-payment` | `{scheduleId}` | `payments.schedule` |
| Payments › scheduled › standing order | Cancel | `cancel-standing-order` | `{scheduleId}` | `payments.schedule` |
| Payments › tracker › payment | Repeat payment | the originating journey | `{paymentId}` | `payments.create` |
| Journeys (transfer) | "Add a new beneficiary" | `manage-beneficiary` then `returnTo` the transfer | – | `beneficiaries.manage` |
| Cards › carousel | Activate | `activate-card` | `{cardId}` | `cards.manage` |
| Cards › card | Freeze / Unfreeze / Block | `freeze-card` | `{cardId, action}` | `cards.manage` |
| Cards › card | Limits and controls | `card-controls` | `{cardId}` | `cards.manage` |
| Cards › card | Virtual card | `virtual-card` | `{cardId}` | `cards.manage` |
| Cards › card | Replace card | `replace-card` | `{cardId, reason}` | `cards.manage` |
| Cards › card | Set or change PIN | `card-pin` | `{cardId}` | `cards.pin` |
| Cards › card › transaction | Report a problem | `dispute-transaction` | `{cardId, transactionId}` | `cards.dispute` |
| Cards › carousel | Add a card | `add-card` | – | `cards.manage` |
| Save & Borrow › deposits | Open / Renew / Close | `term-deposit` | `{mode, depositId}` | `savings.manage` |
| Save & Borrow › goals | New goal / Add money to goal | `savings-goal` | `{goalId}` | `savings.manage` |
| Save & Borrow › loans | Apply | `apply-loan` | `{productId}` | `loans.apply` |
| Save & Borrow › loan | Repay / Settle early | `repay-loan` | `{loanId, mode}` | `loans.repay` |
| Save & Borrow › investments | Buy / Sell | `invest` / `sell-investment` | `{symbol}` | `invest.trade` |
| Save & Borrow › investments | Add money | `add-money` | `{accountId}` | `payments.create` |
| More › profile | Edit details | `update-profile` | `{field}` | `profile.update` |
| More › messages | New message | `new-message` | `{topic, accountId}` | `messages.send` |
| More › requests | New request / Complaint | `service-request` | `{type}` | `messages.send` |
| More › settings › linked banks | Connect | `connect-account` | – | `accounts.manage` |
| More › settings › security | Change password | `change-password` | – | `security.manage` |
| More › settings › security | Trusted devices | `trusted-devices` | `{deviceId}` | `security.manage` |
| More › settings › security | Change quick PIN | `change-quick-pin` | – | `security.manage` |
| More › settings › security | Biometrics | `setup-quick-login` | – | `security.manage` |
| Notification (any) | Card activation reminder | `activate-card` | `{cardId}` | `cards.manage` |
| Notification | Application update | `track-application` (Public) | `{applicationId}` | none |
| Header | Switch to Business | context switch (step-up) | `{companyId}` | context |

Leads to (Personal): transfers → *Track payment* (Payments › tracker), *View receipt*, *Done* (Home or origin). Cards journeys → card detail. Deposits and loans → their detail. Profile, messages, requests → the matching list.

### 5.3 Business "Graphite"

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Overview | + quick action: Pay a supplier | `supplier-payment` | – | `biz.payments.initiate` |
| Overview | + Upload payments / Run payroll | `bulk-payment` / `payroll-run` | – | `biz.payments.bulk` / `biz.payroll.run` |
| Overview | Approvals queue (widget) › payment | `approve-payments` | `{paymentId}` | `biz.approvals.approve` |
| Overview | Cut-off timer › Pay now | `supplier-payment` | – | `biz.payments.initiate` |
| Accounts › detail | Statement or report | `business-statement` | `{accountId}` | `biz.accounts.export` |
| Accounts › transactions | Export | `business-statement` | `{accountId, from, to}` | `biz.accounts.export` |
| Payments › hub | Pay a supplier | `supplier-payment` | `{supplierId}` (the supplier's region decides the rails; see [09-payment-rails.md](09-payment-rails.md)) | `biz.payments.initiate` |
| Payments › hub | Upload a file | `bulk-payment` | – | `biz.payments.bulk` |
| Payments › hub | Run payroll | `payroll-run` | `{period}` | `biz.payroll.run` |
| Payments › hub | Schedule | `schedule-business-payment` | `{templateId}` | `biz.payments.schedule` |
| Payments › tracker › payment | Withdraw | `withdraw-payment` | `{paymentId}` | `biz.payments.withdraw` |
| Payments › tracker › bulk payment | Repair rejected lines | `repair-bulk-lines` | `{paymentId}` | `biz.payments.bulk` |
| Payments › tracker › payment | Save as template | `payment-template` | `{paymentId}` | `biz.templates.manage` |
| Payments › tracker › payment | Repeat | `supplier-payment` | `{paymentId}` | `biz.payments.initiate` |
| Payments › templates | New / Use | `payment-template` / `supplier-payment` | `{templateId}` | `biz.templates.manage` |
| Payments › suppliers | Add / Edit | `add-supplier` | `{supplierId}` | `biz.suppliers.manage` |
| Journeys (`supplier-payment`) | "Add a new supplier" | `add-supplier` then `returnTo` | – | `biz.suppliers.manage` |
| Approvals › inbox | Open / Approve / Reject / Select several | `approve-payments` | `{paymentId}` or `{paymentIds}` | `biz.approvals.approve` |
| Approvals › history | View | shell payment detail | `{paymentId}` | `biz.approvals.view` |
| Admin › users | Invite / Edit | `manage-user` | `{userId}` | `biz.admin.users` |
| Admin › limits | Change | `change-limits` | `{userId or accountId}` | `biz.admin.limits` |
| Admin › signatory groups | Edit | `edit-signatory-group` | `{groupId}` | `biz.admin.signatories` |
| More › requests | New request | `business-service-request` | `{type}` | `biz.requests.create` |
| More › profile | Business onboarding (stretch) | `kyb-onboarding` | – | `biz.admin.users` |
| Notification | "Payment awaiting your approval, {company}" | switch context, then `approve-payments` | `{companyId, paymentId}` | `biz.approvals.approve` |
| Header | Switch to Personal | context switch | – | context |

Leads to (Business): initiation → *Track payment* (tracker detail with timeline), *View receipt*, *Go to approvals* (if the person also approves), *Done*. Approvals → inbox or tracker. Admin → the Admin list. Statement → the file, then Accounts.

### 5.4 Context-switch rules (apply to every link)
Switching clears the active journey, cached data, open sheets, search, filters, drafts and toasts; it keeps language, light or dark mode and the last tab per workspace. Switching to Business needs `stepup`. A link into another context offers to switch first.

---

### 5.5 Launch points added by the module files
The module files carry the full entry-point tables; these are the additions to the tables above, so the apps' one list is complete. Slugs in the tables above that differ from existing fixtures: see the slug mapping below.

| Place | Launch point | Journey | Passes | Permission |
|---|---|---|---|---|
| Public › Landing › Explore | Loan calculator / Deposit calculator | `loan-calculator` / `deposit-calculator` | `{productId}` | none |
| Public › Landing | Account locked? | `unlock-account` | `{username}` | none |
| Public › Sign-in screen | Help | `contact-support` | – | none |
| Public › Application tracker | Continue application / Upload documents | `open-account` | `{applicationId}` | none |
| Public › Application tracker | Activate digital banking | `register-digital-banking` | `{applicationId}` | none |
| Personal › Accounts › detail | Ask about this account | `new-message` | `{accountId}` | `messages.send` |
| Personal › Accounts › transaction history | Export | `statement` | `{accountId}` | `accounts.statement` |
| Personal › Accounts › detail | Transfer between my accounts | `own-transfer` | `{accountId}` | `payments.create` |
| Personal › Payments › beneficiaries › row | Schedule instead | `schedule-payment` | `{beneficiaryId}` | `payments.schedule` |
| Personal › Home › Insights › Budgets tile | New budget | `create-budget` | `{category}` | `accounts.manage` |
| Personal › Home | See all your money | `connect-account` | – | `accounts.manage` |
| Personal › More › profile | Request a change | `service-request` | `{type: "name-change"}` | `messages.send` |
| Personal › More › help | Send a secure message | `new-message` | `{topic}` | `messages.send` |
| Personal › More › login history › row | This wasn't me | `new-message` | `{topic: "security"}` | `messages.send` |
| Personal › Cards › card | Open virtual card | `virtual-card` | `{cardId}` | `cards.manage` |
| Personal journeys | `freeze-card` → `replace-card`; `replace-card` → `dispute-transaction` | as named | `{cardId}` | `cards.manage` / `cards.dispute` |
| Business › Payments › scheduled | Stop | `schedule-business-payment` | `{scheduleId}` | `biz.payments.schedule` |
| Business › tracker / `bulk-payment` result / notification | Repair rejected lines | `repair-bulk-lines` | `{paymentId}` | `biz.payments.bulk` |
| Business › Payments › bulk and payroll history | New run | `payroll-run` | `{period}` | `biz.payroll.run` |
| Business › Approvals › inbox | Reject several | `approve-payments` | `{paymentIds}` | `biz.approvals.approve` |
| Business › Approvals › inbox | Supplier awaiting approval | `approve-payments` (item kind Supplier) | `{supplierId}` | `biz.approvals.approve` |
| Business › Accounts › statements / reports | New statement or report / Create | `business-statement` | `{accountId}` | `biz.accounts.export` |
| Business › Accounts › detail | Request a chequebook | `business-service-request` | `{type}` | `biz.requests.create` |
| Business › Admin › users › row | Disable / Enable / Resend invite | `manage-user` | `{userId}` | `biz.admin.users` |
| Business › Admin › account permissions | Edit roles | `manage-user` | `{userId}` | `biz.admin.users` |
| Business › Admin › users › row | Change limit | `change-limits` | `{userId}` | `biz.admin.limits` |
| Business › Admin › signatory groups | New group | `edit-signatory-group` | – | `biz.admin.signatories` |
| Business › Admin › limits | Ask the bank for a higher ceiling | `business-service-request` | `{type: "limit_review"}` | `biz.requests.create` |
| Business › More › profile | Request a change | `business-service-request` | `{type}` | `biz.requests.create` |
| Business › More › settings | Open in Personal | context switch | – | context |

In 5.3 the passed value of *Admin › limits › Change* is `{userId}` only (account-level limits are out of Release 1).

**Slug mapping to existing fixtures.** Personal: `fund-transfer-local` → `personal-transfer`, `convert-currency` → `own-transfer`, `pay-a-bill` → `pay-bill`. Business: `corporate-payment` → `supplier-payment`, `corporate-approval` → `approve-payments`, `withdraw-a-payment` → `withdraw-payment` (`bulk-payment` and `payroll-run` unchanged). Old slugs stay as aliases for Meezan. Public deep links use `/public/j/<slug>`.

Modules 3–8 launch points are in each module file (section "Entry points" of each journey and its link-map table).

## 6. Release 1 count check
Retail 57 + SME 22 = 79 journeys, checked by counting the `### ★` headings in the files. Releases 2–4: Wealth 10, Corporate 11, Trade Finance 12, Cash & Liquidity 11, Supply Chain Finance 11, Factoring 12 (67).

## 7. How the proof works (existing)
`acceptance` (AC-n) and `scenarios` (T-n, with `covers`, optional `setup`, `now`, `provider`, steps and `expectBank`) travel with the journey. `finx_run_scenarios` reports each criterion proved, failing or uncovered. `finx_mutation_check` breaks the journey and the bank rules one at a time; a mutant is killed when a scenario fails; survivors are listed in `packages/finx-mcp/src/scenarios.test.ts` with the reason. See `docs/CORPORATE.md`.

## 8. Open questions (collected from all files)
Each module file also ends with its own list. The ones that change several files:
1. **Timeout semantics.** Should sandbox `TIMEOUT` apply the change or not? Specified as *not applied*, with copy that tells the person to check Activity before retrying money steps. Raised by every module.
2. **OTP resend** 60 s (fixtures) vs 30 s (this spec).
3. **Seed numbers** (limits, thresholds, fees, rates, tenors, step-up amounts, day counts) are proposals, not from code. Confirm before step 2.
4. **Navigation space.** Does the phone tab bar fit Group, Trade, Cash and Finance, or do they sit under More or a segment?
5. **Naming clashes.** Existing `bank.cards.*` and `bank.deposit.create` mean saved cards and add-money; the planned issued-card and term-deposit domains use `bank.cards.issued…` and `bank.deposits.*`; business deposits use `corp.deposit.*`.
6. **Approval engine.** One shared approvals inbox for payments, trade, treasury, supply chain and factoring, or separate calls?
7. **Engine OTP counter** counts only an integration named `otpVerify`; journeys with two verify screens (for example `update-profile`) need this confirmed.
8. **Payment rails.** Fees, limits, cut-offs, rates and the sandbox name-check registry in [09-payment-rails.md](09-payment-rails.md) are placeholders. Open points are listed at its end: one daily limit or one per rail, paying from the Euro and Dirham accounts, name checks for US payments, Middle East instant limits, and whether the shell shows one Send money button or two.
