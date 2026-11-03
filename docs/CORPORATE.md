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
- **Roles:** only an initiator may start (`NOT_AUTHORISED`), only an approver may approve. An approver may reject any pending payment but their own; the person who started a payment may withdraw it, and their daily limit is given back.
- **Beneficiary whitelist:** only approved beneficiaries are paid (`BENEFICIARY_NOT_WHITELISTED`).
- **Limits:** per person per day (`LIMIT_USER_EXCEEDED`, used when the payment is started) and per company per day (`LIMIT_COMPANY_EXCEEDED`, used when the payment is released); the limits are written in the company's currency, so a payment from an account in another currency is refused (`CURRENCY_NOT_SUPPORTED`).
- **Approval threshold:** above the threshold a second, different approver is needed; the payment stays `pending_approval` until then.
- **Release:** the last approval moves the money. The balance and company limit are checked again then; if they fail, that approval does not count and the payment stays pending.
- **Cut-off and value date:** before the cut-off on a working day the payment is value-dated today; after it, or on a weekend or holiday, the next working day (`afterCutoff` is set).
- **One-time code:** through the bank, starting and approving a payment need a verified code first (like a transfer); rejecting does not.

## The adapter contract
`CorporateBankAdapter` (`initiatePayment`, `approvePayment`, `rejectPayment`, `listPending`) is the interface any corporate bank API has to meet; the second simulated API and a real one come later behind it. Journeys reach it through the sandbox adapters `corp.company.get`, `corp.payments.initiate`, `.approve`, `.reject`, `.pending` and `.get` (listed with inputs, outputs and errors in the adapter catalog the AI tools read). The acting person is passed as `userId`.

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

## Not built yet
- Bulk payments, payroll, and the generator that writes these journeys from a brief and criteria. The mutation check of the gate (change a limit or skip the approver and the generated tests fail) needs the generator's tests.
- Choosing the bank API per project in Studio (a "Connection" setting); today it is chosen when the sandbox bank is created.
- A real vendor behind a mapping file (Temenos, Finacle, open banking): the contract and the mapping format are ready for one.
