# The sandbox bank (`packages/mock-bank-api`)

The in-process bank that journeys, tests and the demo apps call. Everything is synthetic. The AI reads its contract from `src/catalog.ts` (every adapter with `errors[]`, `moneyMoving`, `requiresOtp`); this page explains how the pieces fit.

## Layout
| Folder or file | Holds |
|---|---|
| `src/index.ts` | The sandbox customers (`personas`), `MockBank` (the single entry point, `call(adapter, input, { journey? })`), exports |
| `src/retail/` | Personal banking: `retail.ts` (the `bank.*` adapters), `payments.ts` (payee check, quote and send), `records.ts` (transactions, statements, cards, deposits, goals, loans, schedules, messages, profile, applications), `alex.ts` (Alex Morgan's data), plus finance, invest, fx and the Cairo Amman Bank access sandbox (`cab.ts`) |
| `src/business/` | Company banking: `corporate.ts` (maker-checker rules), the two simulated bank APIs behind the same contract, `business.ts` (the `corp.*` adapters), `alpha-beta.ts` (the two demo companies) |
| `src/identity.ts` | One login, several places: contexts, permission names, step-up |
| `src/rails.ts`, `src/quote.ts` | Payment rails, speed classes, payee validation, name check, pricing (shared by personal and company payments) |
| `src/conditions.ts`, `src/config.ts` | Things that go wrong on purpose; what a bank configures |

## One login, several places (`identity.ts`)
A customer with an `identity` (Alex Morgan) has a **session**: the active context is `personal`, `alpha` (Maker) or `beta` (Approver). `bank.session.get` returns the contexts with their permission names (docs/journeys/README.md section 4) and limits. `bank.session.switch {contextId}` answers `STEP_UP_REQUIRED` when moving into a company without a step-up in the last 5 minutes; `bank.session.stepUp {method, secret?}` checks the password (`STEP_UP_FAILED`) and, once the one-time code is verified, opens the 5-minute window. Switching resets the verified code. Demo password: `Bwx!Demo2026` (sandbox seed only).

Every adapter reads the active context:
- `bank.*` adapters refuse in a company, `corp.*` adapters refuse in Personal: `WRONG_CONTEXT`.
- A company adapter takes the acting user from the context. A different `userId` in the input, or an adapter the context's permissions do not allow, is `PERMISSION_DENIED` and goes to the audit trail as Refused. The company's own rules (`NOT_AUTHORISED`, `SELF_APPROVAL`) stay as a second line.
- A company persona without an identity (Acme, Meezan journeys) works as before: the journey passes `userId`.

## Alex Morgan, personal
Accounts `acc_main` (USD current), `acc_save` (USD savings), `acc_eur`, `acc_gbp`. `balance` is the **ledger** balance, `available` is what can be spent (a pending item lowers only `available`). BankWorkx screens that add balances together count the app's currency only. Also: 26 transactions, four saved payees, three issued cards (one waiting to be activated), two term deposits, two goals, a loan with schedule, two standing orders, messages, notifications tagged by context, a service request, two onboarding applications (one draft to resume). Records are read with the `bank.*.list` and `.get` adapters; `bank.accounts.rename` and `bank.applications.save` change them. Other writes (card controls, deposits, loans, goals) arrive with the journeys that need them.

## Alpha Trading LLC and Beta Services Ltd
Both USD, company limit 1,000,000, two approvers above 50,000, a confirmation code from 25,000 (`codeAbove`). Alex's daily limit at Alpha is 250,000. Alpha: Operating ••2001 USD 480,000 and Reserve ••2044 EUR 95,200; Alex's payment `PAY-2040` (18,900) waits and `PAY-1187` settled. Beta: Operating ••3001 USD 310,000 and Payroll ••3002 USD 64,300; `PAY-2041` (8,200, one approver) and `PAY-2039` (64,500, two approvers, Lee Park has approved) wait for Alex. Other people: `dana`, `lee`, `ravi` (admin), `tess_m` at Alpha; `priya`, `omar`, `sofia`, `lee`, `noor` (admin) at Beta. Each company also has suppliers (with the country and currency they are paid in), templates, signatory groups (sequential and parallel), a payroll register and an audit trail, read with `corp.suppliers.list`, `corp.templates.list`, `corp.signatories.list`, `corp.audit.list`. New payments continue the numbering from `PAY-2042`.

## Payments (`rails.ts`, docs/journeys/09-payment-rails.md)
`bank.payees.validate`, `.check`, `.save` and `bank.payments.quote`, `.create` for a person; `corp.payments.quote`, `.create` for a company. The customer chooses a **speed class** (`standard`, `sameDay`, `instant`); `DEFAULT_SPEED_MAP` says which rail serves each class in each market (a bank overrides it with `config.speedMap`). The payee's country decides the market, currency and identifier fields; the bank's `homeMarket` decides which country a payee without one is in. A quote holds the price for 60 seconds. Amounts above a rail's maximum move to the next rail that fits (`RAIL_LIMIT` if forced); a rail taken down with `unavailable: ["rail:sinst"]` is `RAIL_NOT_AVAILABLE`. A payee named `Test Sanctions` is held (`status: "held"`, `code: "PAYMENT_HELD"`).

## Conditions (`conditions.ts`)
`new MockBank(persona, { conditions })` or `bank.conditions = …`: `latencyMs` slows every call; `timeout` answers `TIMEOUT` after the latency and applies nothing; `unavailable` answers `SERVICE_UNAVAILABLE` at once (`rail:<id>` takes one rail down); `empty` makes list adapters answer `{}`. Names may be prefixes (`corp.`, `bank.payments.`) or end in `*`. A journey scenario sets them with `conditions`; the setup calls and `expectBank` reads are not affected.

## Switching journeys off (`config.ts`)
`config.disabled` is the bank's list of journey slugs it has switched off. `call(adapter, input, { journey: "slug" })` answers `JOURNEY_DISABLED` for a disabled journey (core journeys such as `sign-in` cannot be disabled). `config.options` holds per-journey options. `bank.app.config` returns the home market, the disabled list, the options and the speed mapping, so both apps read the same configuration.
