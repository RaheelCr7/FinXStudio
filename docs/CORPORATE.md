# Corporate payments (sandbox)

Step 1 of the corporate payment proof (plan, Stage 1). A simulated corporate bank: a company, its people and their roles, and the rules every corporate payment has to pass. Pure logic in `packages/mock-bank-api/src/corporate.ts`, with a named error for every rule so a journey can say what went wrong.

## The demo company
**Acme Trading Co.** (sandbox customer `acme`, Meezan look, one-time code 482100; it belongs to the `corp-demo` project, so it appears once a project with that id exists).

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

## Not built yet
- The authorisation model in the journey schema (roles, limits, approval chain as data a journey can read) and the matching actions.
- The API mapping layer and the second simulated API with other endpoints and error codes.
- The corporate journeys themselves (initiate, approve, release) and the generator.
