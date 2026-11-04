# Corporate payments (sandbox)

Step 1 of the corporate payment proof (plan, Stage 1). A simulated corporate bank: a company, its people and their roles, and the rules every corporate payment has to pass. Pure logic in `packages/mock-bank-api/src/corporate.ts`, with a named error for every rule so a journey can say what went wrong.

## The demo company
**Acme Trading Co.** (sandbox customer `acme`, in the Meezan look's customer list; one-time code 482100).

| Person | Roles | Daily limit |
|---|---|---|
| `sara` | initiator | 3,000,000 |
| `omar` | initiator | 500,000 |
| `hassan`, `layla` | approver | |
| `nadia` | initiator and approver | 500,000 |

Accounts: Operations (PKR) and a Dollar account (USD). Approved beneficiaries: Crescent Textiles, Indus Logistics, Karachi Packaging. Company daily limit 8,000,000; cut-off 16:00 (UTC); a payment above 1,000,000 needs two different approvers; the demo bank is closed on weekends and 9 November 2026.

## The rules
- **Maker-checker:** an initiator starts a payment, an approver approves it. **Nobody approves what they started**, even a person who holds both roles (`SELF_APPROVAL`). The same approver cannot approve twice (`ALREADY_APPROVED`).
- **Roles:** only an initiator may start (`NOT_AUTHORISED`), only an approver may approve. An approver may reject a pending payment, never one they started themselves (`NOT_AUTHORISED`: they withdraw it instead); the person who started a payment may withdraw it (`withdrawPayment`, a separate operation: only the initiator, only while pending), and their daily limit is given back either way.
- **Beneficiary whitelist:** only approved beneficiaries are paid (`BENEFICIARY_NOT_WHITELISTED`).
- **Limits:** per person per day (`LIMIT_USER_EXCEEDED`, used when the payment is started) and per company per day (`LIMIT_COMPANY_EXCEEDED`, used when the payment is released); the limits are written in the company's currency, so a payment from an account in another currency is refused (`CURRENCY_NOT_SUPPORTED`).
- **Approval threshold:** above the threshold a second, different approver is needed; the payment stays `pending_approval` until then.
- **Release:** the last approval moves the money. The balance and company limit are checked again then (the company limit rule can be switched off for a mutation check, and release honours that too); if they fail, that approval does not count and the payment stays pending.
- **Cut-off and value date:** before the cut-off on a working day the payment is value-dated today; after it, or on a weekend or holiday, the next working day (`afterCutoff` is set).
- **One-time code:** through the bank, starting and approving a payment need a verified code first (like a transfer); rejecting does not.

## The adapter contract
`CorporateBankAdapter` (`initiatePayment`, `approvePayment`, `rejectPayment`, `withdrawPayment`, `listPending`) is the interface any corporate bank API has to meet; the second simulated API and a real one come later behind it. Journeys reach it through the sandbox adapters `corp.company.get`, `corp.payments.initiate`, `.approve`, `.reject`, `.withdraw`, `.pending` and `.get` (listed with inputs, outputs and errors in the adapter catalog the AI tools read). The acting person is passed as `userId`. With a signed-in identity with several companies (Alex Morgan at Alpha and Beta, see [SANDBOX.md](SANDBOX.md)) the acting person comes from the active context instead, and a different `userId` is refused (`PERMISSION_DENIED`). `corp.payments.get` checks that a named `userId` works for the company (`NOT_AUTHORISED`). A role `admin` exists besides `initiator` and `approver`: it manages people and limits and moves no money.

## The journeys
Two catalog journeys (Payments, English only, run as the sandbox customer **Acme Trading Co.**): **Start a payment** (`corporate-payment`, for initiators) and **Approve payments** (`corporate-approval`, for approvers). Both begin with a sandbox "who am I" choice (a real bank app already knows who signed in).

- *Start a payment:* account, approved beneficiary (the company's whitelist), amount in the account's currency with the person's remaining daily limit shown and enforced, reference; a review with the number of approvers needed and the cut-off note; consent; one-time code; "Sent for approval" with the payment id and value date. Nothing leaves the account at this point.
- *Approve payments:* the pending list (what waits for this approver: not their own, not ones they already approved), review of one payment, consent, one-time code; "Payment released" when the last approver approves, "Approved" with how many are still needed otherwise. **Reject** takes an optional reason and gives the initiator's limit back.
- Whoever does not hold the role is sent to a "You can't do this" screen. Every refusal by the bank (limit, whitelist, wrong currency, four eyes …) is shown with its message and "No money has left the account".

New in the engine for this: a journey can declare **`authorisation`** (role, where the roles are read from, denied screen; lint `authorisation_missing` if a journey that starts or approves a company payment does not), a failed call saves **`ctx.error`** (`code`, `message`) for the next screen, and a block `source` may point inside a saved result (`ctx.company.accounts`).

## A second bank API, and the mapping layer (the stage gate)
**Bank B** (`corporate-b.ts`) is a second simulated corporate API in its own language: operations `payments.create / authorise / decline / list / get` and `company.profile`; its own names (`initiator`, `debit.accountNo`, `creditor.ref`, `remittanceInfo`, `authChain.signedBy`), states (`AWAITING_AUTH`, `EXECUTED`, `CANCELLED`), ids (`TXN-000001`), amounts as strings, and numbered error codes with their own wording (`ERR-4291` for a per-user cap). Its rule engine is the corporate sandbox's (a simulation: a real vendor has its own).

The **mapping layer** (`mapping.ts`) turns the bank-neutral shapes the journeys use into that API and back, from a **declarative file**: `mappings/bank-b.corporate.json` says which API call each operation makes, how each request field is built (paths, constants, conversions, conditions), how the response becomes a payment (value maps for states, lists, masks) and how each error code becomes ours (code and wording, with the facts filled in). A new bank is a new mapping file plus an adapter, not a new journey. `MockBank("acme", { corpProvider: "bank-b" })` puts Bank B behind the same `corp.*` adapters.

**The gate, checked by tests:**
- The same 11 journey tests (start, approve, two approvers, reject, four eyes, limits, wrong currency, three wrong codes, denied role) pass on both APIs.
- The journeys' bytes contain none of either bank's vocabulary, and running them leaves them unchanged.
- Both banks give the same company, the same payments (apart from each bank's own id), the same pending lists, the same balances, and the same refusals with the same code and wording, in a table of nine rules plus the approval steps.
- Every field a journey can read is mapped, and every error code Bank B can answer has a mapping.

## Tests that travel with a journey, and the mutation check
A journey can carry its own proof: **`acceptance`** (criteria `AC-1 …`, each a sentence that must be true) and **`scenarios`** (`T-1 …`): scripted walks through the journey against the sandbox bank, each saying which criteria it `covers`, with an optional `setup` (calls made on the bank first, such as a payment waiting for approval; `saveAs: "p"` keeps the answer so later inputs can say `{{setup.p.id}}`, because each bank API numbers its own payments), a fixed clock `now`, and the steps of `finx_simulate_journey` plus `expectBank` (read the bank with an adapter and check one value, for example that no money moved; `{{path}}` inputs are read from the journey's data). Lint reports a scenario that covers an unknown criterion and a criterion no scenario covers. In Studio, a journey that carries criteria shows a **Proof** button in its header: the page lists each criterion with the scenarios that cover it and whether they pass on every corporate bank API, and has a button that runs the mutation check.

- `finx_run_scenarios` (and `runScenarios` in `packages/finx-mcp/src/scenarios.ts`) runs them and reports, per criterion, **proved** (a passing scenario covers it), **failing** or **uncovered**; `provider: "bank-b"` runs the corporate adapters against the second API.
- `finx_mutation_check` breaks the journey one thing at a time (each validation step, each one-time-code check, each error path, each navigation rule, the confirmation, the amount limits, the role check) and, for company journeys, switches off one bank rule at a time (roles, approved list, user and company limits, second approver, four eyes, cut-off), then re-runs the scenarios. A mutant is **killed** when a scenario fails. A survivor is a mistake the tests would let through.
- **Both corporate journeys carry them**: 11 and 8 criteria, 12 and 10 scenarios, all proved on both bank APIs. The mutation check kills every mutant except the ones listed, with the reason for each, in `packages/finx-mcp/src/scenarios.test.ts` (another layer already stops the case, or the sandbox cannot produce it, for example the company limit of 8,000,000 is above the sum of every initiator's limit). The test fails on any new survivor, so changing a journey makes the tests prove themselves again.
- The `/finx-generate` skill is the workflow around this: plan and wait for a yes, draft, write scenarios, run, mutation check, report.

## Not built yet
- Bulk payments and payroll (more journeys for the generator to try).
- A checkpoint of a generator run that can be undone in one click (Studio's journey history covers published versions only), and a Studio view of scenarios and coverage.
- Choosing the bank API per project in Studio, and a real vendor behind a mapping file.


## Bulk payments

A company pays many approved suppliers from one file. The journey (`bulk-payment`, made by the generator and kept in the catalog) takes pasted rows, `beneficiary,amount,reference` per line (an optional header, blank lines and spaces are ignored), in a multi-line text box (`textInput` with `lines`).

- `corp.bulk.check` reads the file and checks every row, moving nothing: the beneficiary must be on the approved list, the amount valid for the account's currency, and a row identical to an earlier one is a duplicate. It answers with each row (`ok`, `code`, `message`), `problems` (only the failing rows, for a list), the count and total of what passes, and how many approvers it needs. A file with no rows, or more than 50, is refused.
- `corp.bulk.submit` (needs the one-time code) starts ONE payment of the rows that pass. It is a payment like any other (`lines` lists what it pays, `payee` reads "3 payments"): the total counts once against the person's and the company's limits, the approval rule applies to the total, one approval releases all of it, and approve, reject and withdraw use the usual `corp.payments.*` adapters.
- Both bank APIs do it: Bank B has `batches.validate` and `batches.create` with its own row shape (`creditorRef`, `amountValue`, `remark`), verdict codes (B-201 to B-203) and error codes (ERR-4101 to ERR-4103), all mapped in `bank-b.corporate.json`. The same 27 scenarios pass on both.
- Every payment the adapters return now carries `payee` (the supplier's name, or "N payments"), so the approval journey needs no lookup and shows a bulk payment correctly.

## Payroll runs

`corp.payroll.check` and `corp.payroll.submit` pay the company's employees for one pay period from a pasted file of `employee,amount,reference` rows. The company has a payroll register (`employees`, each with a monthly salary). A row is left out when the person is not on the register (`NOT_AN_EMPLOYEE`), is on the file twice (`DUPLICATE_LINE`), has an invalid amount, or is paid more than 1.5 times their monthly salary (`ABOVE_SALARY_CAP`; exactly 1.5 passes). The whole run is refused when the period is not `YYYY-MM` or is later than this month (`INVALID_PERIOD`), or when payroll for that period is already pending or released (`PAYROLL_ALREADY_RUN`); withdrawing or rejecting the run frees the period. A run is one payment against the limits and **always needs two approvers**, however small. The approver sees it as "Payroll 2026-10 · 3 employees". Both banks implement it; Bank B's words are in its mapping file. The generated journey is the catalog entry `payroll-run`.
