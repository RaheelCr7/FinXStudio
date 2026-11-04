# The sandbox bank (`packages/mock-bank-api`)

The in-process bank that journeys, tests and the demo apps call. Everything is synthetic. The AI reads its contract from `src/catalog.ts` (every adapter with `errors[]`, `moneyMoving`, `requiresOtp`); this page explains how the pieces fit.

## Layout
| Folder or file | Holds |
|---|---|
| `src/index.ts` | The sandbox customers (`personas`), `SandboxConditions`, and `MockBank`: the single entry point, `call(adapter, input, { journey? })`. It applies conditions, the journey switch and the session, then hands the call to the retail or the business side |
| `src/retail/` | Personal banking. `retail.ts` is `RetailSandbox` (the `bank.*` adapters: accounts, transfers, payees and payments to others, bills, top-ups, cards, spending, investing), with `payees.ts`, `payments.ts` (rails, speeds, home markets), `bills.ts`, `topup.ts`, `fx.ts`, `finance.ts`, `invest.ts`, the Cairo Amman Bank access sandbox `cab.ts`, and Alex's records: `data.ts`, `alex.ts`, `records.ts` |
| `src/business/` | Company banking. `corporate.ts` (the maker-checker rules), the two simulated bank APIs behind the same contract, `business.ts` (`BusinessSandbox`: the `corp.*` adapters, permissions, company quotes), `alpha-beta.ts` (the two demo companies) |
| `src/identity.ts` | One login, several places: contexts, permission names, step-up |
| `src/conditions.ts`, `src/config.ts`, `src/policy.ts` | Which adapters a condition names; what a bank configures; the guard against running the sandbox in production |

## One login, several places (`identity.ts`)
A customer with an `identity` (Alex Morgan) has a **session**: the active context is `personal`, `alpha` (Maker) or `beta` (Approver). `bank.session.get` returns the contexts with their permission names (docs/journeys/README.md section 4) and limits. `bank.session.switch {contextId}` answers `STEP_UP_REQUIRED` when moving into a company without a step-up in the last 5 minutes; `bank.session.stepUp {method, secret?}` checks the password (`STEP_UP_FAILED`) and, once the one-time code is verified, opens the 5-minute window. Switching resets the verified code. Demo password: `Bwx!Demo2026` (sandbox seed only).

Every adapter reads the active context:
- `bank.*` adapters refuse in a company, `corp.*` adapters refuse in Personal: `WRONG_CONTEXT`.
- A company adapter takes the acting user from the context. A different `userId` in the input, or an adapter the context's permissions do not allow, is `PERMISSION_DENIED` and goes to the audit trail as Refused. The company's own rules (`NOT_AUTHORISED`, `SELF_APPROVAL`) stay as a second line.
- A company persona without an identity (Acme, Meezan journeys) works as before: the journey passes `userId`.

## Alex Morgan, personal
Accounts `acc_main` (USD current), `acc_save` (USD savings), `acc_eur` (EUR Travel) and `acc_aed` (AED Home), the same four as the Payments cast. `balance` is the **ledger** balance, `available` is what can be spent (a pending item lowers only `available`). BankWorkx screens that add balances together count the app's currency only. The saved payees, schedule and rails are the Payments cast's (`payees.ts`, `payments.ts`). Also: 26 account transactions, three issued cards (one waiting to be activated), two term deposits, two goals, a loan with schedule, two standing orders, messages, notifications tagged by context, a service request, two onboarding applications (one draft to resume). Records are read with the `bank.*.list` and `.get` adapters; `bank.accounts.rename` and `bank.applications.save` change them. Other writes (card controls, deposits, loans, goals) arrive with the journeys that need them.

## Alpha Trading LLC and Beta Services Ltd
Both USD, company limit 1,000,000, two approvers above 50,000, a confirmation code from 25,000 (`codeAbove`). Alex's daily limit at Alpha is 250,000. Alpha: Operating ••2001 USD 480,000 and Reserve ••2044 EUR 95,200; Alex's payment `PAY-2040` (18,900) waits and `PAY-1187` settled. Beta: Operating ••3001 USD 310,000 and Payroll ••3002 USD 64,300; `PAY-2041` (8,200, one approver) and `PAY-2039` (64,500, two approvers, Lee Park has approved) wait for Alex. Other people: `dana`, `lee`, `ravi` (admin), `tess_m` at Alpha; `priya`, `omar`, `sofia`, `lee`, `noor` (admin) at Beta. Each company also has suppliers (with the country and currency they are paid in), templates, signatory groups (sequential and parallel), a payroll register and an audit trail, read with `corp.suppliers.list`, `corp.templates.list`, `corp.signatories.list`, `corp.audit.list`. New payments continue the numbering from `PAY-2042`.

## Payments to others, and the home market (`retail/payments.ts`)
A person pays with `bank.payees.*` and `bank.payments.quote` / `.create` (internal, domestic, international; Standard, Same day, Instant, Priority). A company pays an approved supplier with `corp.payments.quote` / `.create`: the same speeds and rails, the supplier's currency converted at the BankWorkx rate, the dollar total tested against the person and company limits, a purpose and an invoice reference always required, a confirmation code only from `codeAbove`, and the payment then waits for approval. The bank's `homeMarket` (`us` by default) decides which rails serve the *domestic* speed classes (`DOMESTIC_RAILS`: us ach/sach/rtp, uk bacs/chaps/fps, eu sct/sinst, ae uaefts/aani, sa sarie/sarieI, jo jopacc/cliq); for a company a supplier is domestic when it is in the home market's country. Payee forms still ask for US-style details whatever the home market: wiring the local identifiers (sort code, IBAN) to the market is not done yet.

## Conditions (`SandboxConditions`)
`new MockBank(persona, { conditions })` or `bank.conditions = …`: `timeout` answers `TIMEOUT` (or, with a `latencyMs` under 10 seconds, answers slowly and moves the sandbox clock on); `unavailable` answers `SERVICE_UNAVAILABLE` at once, and `rail:<id>` takes one payment rail down; `empty` makes list adapters answer `{}`; `frozen`, `transferFails` and `limitUsed` prepare the customer. Names may be prefixes (`corp.`, `bank.payments.`) or end in `*`. A journey scenario sets them with `conditions`.

## Switching journeys off (`config.ts`)
`config.disabled` is the bank's list of journey slugs it has switched off. `call(adapter, input, { journey: "slug" })` answers `JOURNEY_DISABLED` for a disabled journey (core journeys such as `sign-in` cannot be disabled). `config.options` holds per-journey options. `bank.app.config` returns the home market, the disabled list, the options and the speed mapping, so both apps read the same configuration.
