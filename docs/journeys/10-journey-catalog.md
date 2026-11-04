# 10. Journey catalog

Every journey in this spec is a **catalog entry**. A bank switches entries on or off in its configuration, so one codebase serves a retail-only bank, a full retail-and-business bank, or a bank that does not offer cross-border payments. This file lists every entry, which are already built in the clickable prototype, and what a bank can configure.

## How the catalog works

- **One entry per journey**, keyed by its slug (`statement`, `bulk-payment`). An entry carries: slug, name, module, workspace (`public`, `personal`, `business`), category (the menu group it appears under), the permission it needs, whether it moves money, whether it is `core` (cannot be switched off), and its **options**.
- **Switch off.** A journey that is off disappears from every menu, quick action, notification link and command-bar result. If something opens it any other way (a deep link, an old notification), the bank refuses it with `JOURNEY_DISABLED` ("This isn't available at your bank.").
- **Options** are finer switches inside a journey, for example which payment regions are allowed, which statement formats are offered, which bulk file formats are accepted, or whether SEPA Instant is offered. They only show while the journey is on.
- **Core entries** cannot be switched off: `sign-in`. Everything else can.
- **Dependencies.** Switching off a journey hides the buttons that start it, so a screen that depends on it (for example the transfer types screen) hides that type. A journey that is on but whose launch point lies in a journey that is off stays reachable from other places.
- **Presets** in the prototype: Everything on; Retail bank (no Business); No cross-border (`international-transfer` off); Lean (only core and basic entries).
- **Where it lives.** The registry is `JR` in the prototype (`design/bankworkx-r1/src/js/47-engine.js`, gitignored). In the product it maps to the existing FinX catalog, with a per-bank `disabled` list and per-journey `options` stored with the bank's configuration and read by both the web and the mobile app, so both stay identical. The sandbox enforces the switch (`JOURNEY_DISABLED`), not just the menus.

Status column: **Built** means the entry exists in the prototype with research in `research/<slug>.md`; **Spec** means it is specified in the module file only.

## Retail (Release 1, 52 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `loan-calculator` | Loan calculator | Public: before sign-in | Spec | Yes |  |
| `deposit-calculator` | Deposit calculator | Public: before sign-in | Spec | Yes |  |
| `find-branch-atm` | Find a branch or ATM | Public: before sign-in | Spec | Yes |  |
| `contact-support` | Contact us | Public: before sign-in | Spec | Yes |  |
| `open-account` | Open an account | Public: before sign-in | Built | Yes | Offer the United States; Offer the United Kingdom; Offer the European Union; Offer the UAE and Middle East; US: accept an ITIN or a passport instead of an SSN; Allow joint accounts (second holder completes their own checks); Offer Shariah-compliant products (Middle East); UAE: allow UAE Pass instead of photographing the Emirates ID; Saudi Arabia: allow Nafath approval instead of an ID photo; Jordan: allow the Sanad digital ID; Send politically exposed persons to manual review |
| `track-application` | Track my application | Public: before sign-in | Spec | Yes |  |
| `register-digital-banking` | Register for digital banking | Public: before sign-in | Spec | Yes |  |
| `sign-in` | Sign in | Signing in and security | Built | No (core) | Offer one-time codes by text message (being phased out; app approval is safer); Offer Face ID / fingerprint quick sign-in; Offer passkeys; Offer a 6-digit quick PIN; Let people remember their username on this device; Passwords expire after 12 months (NIST advises against; some regulators expect it); Ask for a code when the sign-in looks unusual, even on a trusted device |
| `setup-quick-login` | Set up quick sign in | Signing in and security | Spec | Yes |  |
| `forgot-username` | Forgot username | Signing in and security | Spec | Yes |  |
| `reset-password` | Reset password | Signing in and security | Spec | Yes |  |
| `unlock-account` | Unlock account | Signing in and security | Spec | Yes |  |
| `change-password` | Change password | Signing in and security | Spec | Yes |  |
| `trusted-devices` | Trusted devices | Signing in and security | Spec | Yes |  |
| `change-quick-pin` | Change quick PIN | Signing in and security | Spec | Yes |  |
| `accounts` | Accounts overview | Personal: Accounts | Built | Yes | Offer the hide-balance eye; Show foreign currency accounts; Show Statement and Transfer on each account; Offer sort and filter |
| `account-details` | Account details | Personal: Accounts | Built | Yes | Offer Share details; Allow closure requests in the app; Offer Report a problem on transactions; Allow hiding an account |
| `statement` | Account statement | Personal: Accounts | Built | Yes | Offer CSV; Offer OFX and QIF for accounting apps; Offer official stamped statements; Charge a fee ($5.00) for official statements and balance certificates; Offer proof of address letters; Offer balance certificates; Offer paperless settings; Allow sending official documents straight to a third party |
| `account-nickname` | Rename an account | Personal: Accounts | Spec | Yes |  |
| `open-another-account` | Open another account | Personal: Accounts | Spec | Yes |  |
| `create-budget` | Create a budget | Personal: Accounts | Spec | Yes |  |
| `transfer-types` | Ways to send money | Personal: Payments | Built | Yes | Show the “Which should I use?” helper; Show the side-by-side table |
| `own-transfer` | Between my accounts | Personal: Payments | Built | Yes | Allow conversion between currencies; Charge the 0.20% conversion fee |
| `internal-transfer` | To a BankWorkx customer | Personal: Payments | Built (alias of `personal-transfer`) | Yes |  |
| `personal-transfer` | Send money | Personal: Payments | Built | Yes | Offer “Between my accounts”; Offer “To a BankWorkx® customer”; Offer “To another bank in the same region”; Offer “To another country” (SWIFT); Region: United States; Region: United Kingdom; Region: Europe (SEPA); Region: United Arab Emirates; Region: Saudi Arabia; Region: Jordan; Rail: ACH (standard); Rail: Same-day ACH; Rail: Instant (RTP® / FedNow®); Rail: Wire (Fedwire®); Rail: SEPA Credit Transfer; Rail: SEPA Instant; Rail: Faster Payments; Rail: CHAPS; Rail: Bacs; Rail: Aani instant payment; Rail: UAEFTS transfer; Rail: sarie instant; Rail: SARIE transfer; Rail: CliQ instant payment; Rail: JoPACC transfer; Rail: International (SWIFT); Allow currency conversion between my accounts; Run the name check (CoP, VoP and others); Allow “Later” and repeating payments; Apply the 24-hour $500 limit to new payees; Demo: SEPA Instant is unavailable; Demo: it is 16:30, after same-day cut-offs |
| `single-transfer` | Quick transfer | Personal: Payments | Built | Yes | Offer instant rails (RTP, SEPA Instant, Faster Payments, Aani, sarie, CliQ); Allow “Later” and repeating payments; Apply the 24-hour $500 limit to new payees; Demo: SEPA Instant is unavailable; Demo: it is 16:30, after same-day cut-offs |
| `international-transfer` | Abroad | Personal: Payments | Built (alias of `personal-transfer`) | Yes |  |
| `pay-bill` | Pay a bill | Personal: Payments | Built | Yes | Look up the amount due from the biller (off: the person types the amount); Allow the minimum and other amounts where the biller accepts them; Allow paying a bill from an account in another currency; Offer to save the biller; Offer auto-pay after the payment |
| `mobile-topup` | Mobile top-up | Personal: Payments | Spec | Yes |  |
| `manage-beneficiary` | Add, edit or delete a payee | Personal: Payments | Built | Yes | Run the name check (Verification of Payee, Confirmation of Payee); Let a person cancel scheduled payments while deleting a payee; Offer payee labels (Family, Friend, Landlord…) |
| `schedule-payment` | Schedule a payment | Personal: Payments | Built | Yes | Allow schedules between own accounts; Allow scheduling a saved bill (full balance or minimum due); Let the person choose “previous business day” for closed days; Offer “try once more next business day” when there isn’t enough money; Offer “skip only the next payment” when cancelling; Close changes at 09:00 the business day before (default 18:00) |
| `cancel-standing-order` | Cancel a standing order | Personal: Payments | Built (alias of `schedule-payment`) | Yes |  |
| `cards` | Cards | Personal: Cards | Built | Yes | Show spending summary; Show recent card transactions; Show digital wallet row; Show saved cards row (for add money) |
| `activate-card` | Activate card | Personal: Cards | Built | Yes | Ask for the 3-digit security code; Let the customer set the PIN during activation |
| `card-controls` | Card limits and controls | Personal: Cards | Built | Yes | Offer a gambling block (off where gambling is barred by law); Offer the magnetic stripe switch; Let customers lower the contactless limit; A freeze still allows existing recurring payments |
| `freeze-card` | Freeze card | Personal: Cards | Built (alias of `card-controls`) | Yes |  |
| `virtual-card` | Virtual card | Personal: Cards | Spec | Yes |  |
| `replace-card` | Replace card | Personal: Cards | Spec | Yes |  |
| `card-pin` | Card PIN | Personal: Cards | Spec | Yes |  |
| `dispute-transaction` | Dispute a transaction | Personal: Cards | Spec | Yes |  |
| `add-card` | Add card | Personal: Cards | Spec | Yes |  |
| `term-deposit` | Term deposit | Personal: Save & Borrow | Spec | Yes |  |
| `savings-goal` | Savings goal | Personal: Save & Borrow | Spec | Yes |  |
| `apply-loan` | Apply for a loan | Personal: Save & Borrow | Spec | Yes |  |
| `repay-loan` | Repay a loan | Personal: Save & Borrow | Spec | Yes |  |
| `invest` | Invest | Personal: Save & Borrow | Spec | Yes |  |
| `sell-investment` | Sell investment | Personal: Save & Borrow | Spec | Yes |  |
| `add-money` | Add money | Personal: Save & Borrow | Spec | Yes |  |
| `update-profile` | Update profile | Personal: More | Spec | Yes |  |
| `new-message` | New message | Personal: More | Spec | Yes |  |
| `service-request` | Service request | Personal: More | Spec | Yes |  |
| `connect-account` | Connect account | Personal: More | Spec | Yes |  |

## SME (Release 1, 17 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `business-accounts` | Business accounts | Business: Accounts | Built | Yes | Show the 13-week forecast; Show totals for other companies the person can see; Show account details for receiving money |
| `business-statement` | Business statement | Business: Accounts | Built | Yes | Offer PDF; Offer CSV; Offer Excel; Offer MT940 / MT942; Offer camt.053 / camt.052; Offer BAI2; Allow intraday reports; Allow scheduled delivery; Allow delivery by email; Allow secure file transfer (sFTP / host-to-host); Allow email to addresses outside the company |
| `supplier-payment` | Pay a supplier | Business: Payments | Built | Yes |  |
| `add-supplier` | Add a supplier | Business: Payments | Spec | Yes |  |
| `payment-template` | Payment template | Business: Payments | Spec | Yes |  |
| `schedule-business-payment` | Schedule a business payment | Business: Payments | Spec | Yes |  |
| `withdraw-payment` | Withdraw a payment | Business: Payments | Spec | Yes |  |
| `bulk-payment` | Bulk payment | Business: Bulk and payroll | Built | Yes | Accept CSV template files; Accept ISO 20022 pain.001 XML files; Accept NACHA files (US); Accept Bacs Standard 18 files (UK); Allow entering lines by hand; Allow pasting lines; Partial acceptance: send the good lines and keep the rest for repair; Allow dropping lines; Let approvers decide per line as well as per batch |
| `repair-bulk-lines` | Repair rejected lines | Business: Bulk and payroll | Spec | Yes |  |
| `bulk-status` | Batch status | Business: Bulk and payroll | Built | Yes |  |
| `payroll-run` | Payroll run | Business: Bulk and payroll | Built | Yes | Allow payroll upload from a CSV file; Allow bonus lines; Allow deduction lines; Compare with last month and ask for a reason on big changes; Build the WPS file for the UAE and Saudi Arabia; Offer to tell employees their payslip is ready |
| `approve-payments` | Approve payments | Business: Approvals | Built | Yes | Allow batch approval; Extra security check from 25,000.00; Allow “Ask for changes”; Allow passing a payment to another approver |
| `manage-user` | Invite, edit or disable a user | Business: Admin | Spec | Yes |  |
| `change-limits` | Change limits | Business: Admin | Spec | Yes |  |
| `edit-signatory-group` | Edit a signatory group | Business: Admin | Spec | Yes |  |
| `business-service-request` | Business service request | Business: More | Spec | Yes |  |
| `kyb-onboarding` | KYB business onboarding (stretch) | Business: More | Spec | Yes |  |

## Wealth (Release 2, 10 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `wealth-risk-profile` | Risk profile questionnaire | Journeys | Spec | Yes |  |
| `wealth-proposal-accept` | Review and accept advice | Journeys | Spec | Yes |  |
| `wealth-fund-subscribe` | Buy fund units | Journeys | Spec | Yes |  |
| `wealth-fund-redeem` | Sell fund units | Journeys | Spec | Yes |  |
| `wealth-model-switch` | Switch model portfolio | Journeys | Spec | Yes |  |
| `wealth-fx-forward` | Currency forward | Journeys | Spec | Yes |  |
| `wealth-structured-note` | Structured note request | Journeys | Spec | Yes |  |
| `wealth-statement` | Wealth statements | Journeys | Spec | Yes |  |
| `wealth-tax-report` | Yearly tax report | Journeys | Spec | Yes |  |
| `wealth-contact-adviser` | Message or call with your adviser | Journeys | Spec | Yes |  |

## Corporate (Release 2, 11 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `corp-high-value-payment` | High-value payment | Journeys | Spec | Yes |  |
| `corp-intragroup-transfer` | Transfer between group entities | Journeys | Spec | Yes |  |
| `corp-payment-file` | Upload a payment file | Journeys | Spec | Yes |  |
| `corp-host-to-host` | Set up host-to-host | Journeys | Spec | Yes |  |
| `corp-approve-with-matrix` | Approve with the matrix | Journeys | Spec | Yes |  |
| `corp-approval-matrix` | Change the approval matrix | Journeys | Spec | Yes |  |
| `corp-delegation` | Delegate approval authority | Journeys | Spec | Yes |  |
| `corp-beneficiary` | Add a beneficiary with screening | Journeys | Spec | Yes |  |
| `corp-standing-instruction` | Standing instruction | Journeys | Spec | Yes |  |
| `corp-user-entitlements` | Users and entitlements across entities | Journeys | Spec | Yes |  |
| `corp-report-request` | Reports and statements | Journeys | Spec | Yes |  |

## Trade Finance (Release 3, 12 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `issue-import-lc` | Issue an import letter of credit | Letters of credit | Spec | Yes |  |
| `amend-lc` | Amend a letter of credit | Letters of credit | Spec | Yes |  |
| `present-documents` | Present documents under an export LC | Letters of credit | Spec | Yes |  |
| `respond-to-discrepancies` | Respond to discrepancies and settle | Letters of credit | Spec | Yes |  |
| `request-guarantee` | Request a bank guarantee | Guarantees | Spec | Yes |  |
| `amend-guarantee` | Amend a guarantee | Guarantees | Spec | Yes |  |
| `respond-to-guarantee-claim` | Respond to a guarantee claim | Guarantees | Spec | Yes |  |
| `documentary-collection` | Send documents for collection | Collections | Spec | Yes |  |
| `accept-collection` | Pay or accept an inward collection | Collections | Spec | Yes |  |
| `apply-trade-loan` | Apply for trade financing | Trade loans | Spec | Yes |  |
| `repay-trade-loan` | Repay or roll over a trade loan | Trade loans | Spec | Yes |  |
| `approve-trade-request` | Approve or reject a trade request | Approval | Spec | Yes |  |

## Cash & Liquidity (Release 3, 11 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `add-external-account` | Add an outside bank account | Cash position and forecast | Spec | Yes |  |
| `manage-forecast-item` | Add, change or delete a forecast item | Cash position and forecast | Spec | Yes |  |
| `request-funding` | Ask another entity for funding | Funding and transfers | Spec | Yes |  |
| `intercompany-transfer` | Move money between group entities | Funding and transfers | Spec | Yes |  |
| `fx-deal` | Buy or sell currency | Treasury: FX and deposits | Spec | Yes |  |
| `place-short-term-deposit` | Put cash into a short-term deposit | Treasury: FX and deposits | Spec | Yes |  |
| `redeem-short-term-deposit` | Break a deposit early or change its maturity instruction | Treasury: FX and deposits | Spec | Yes |  |
| `setup-sweep-rule` | Create, change or pause a sweep rule | Structure: sweeping and pooling | Spec | Yes |  |
| `setup-notional-pool` | Create, change or close a notional pool | Structure: sweeping and pooling | Spec | Yes |  |
| `set-liquidity-rule` | Alert me when cash is low, idle or forecast to run low | Rules and approval | Spec | Yes |  |
| `approve-treasury-instruction` | Approve or reject a treasury item | Rules and approval | Spec | Yes |  |

## Supply Chain Finance (Release 4, 11 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `create-scf-programme` | Create a programme | Journeys | Spec | Yes |  |
| `invite-supplier` | Invite a supplier | Journeys | Spec | Yes |  |
| `join-programme` | Join a programme (supplier onboarding) | Journeys | Spec | Yes |  |
| `upload-invoices` | Upload invoices | Journeys | Spec | Yes |  |
| `approve-invoices` | Approve invoices (buyer) | Journeys | Spec | Yes |  |
| `request-early-payment` | Get paid early | Journeys | Spec | Yes |  |
| `dynamic-discount-offer` | Offer early payment (dynamic discounting) | Journeys | Spec | Yes |  |
| `repay-at-maturity` | Repay at maturity | Journeys | Spec | Yes |  |
| `change-programme-limit` | Change programme and supplier limits | Journeys | Spec | Yes |  |
| `dispute-invoice` | Dispute an invoice | Journeys | Spec | Yes |  |
| `suspend-supplier` | Suspend or reinstate a supplier | Journeys | Spec | Yes |  |

## Factoring (Release 4, 12 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `apply-factoring-facility` | Apply for factoring | Journeys | Spec | Yes |  |
| `add-debtor` | Add and verify a debtor | Journeys | Spec | Yes |  |
| `assign-invoices` | Assign invoices | Journeys | Spec | Yes |  |
| `request-advance` | Get an advance | Journeys | Spec | Yes |  |
| `release-reserve` | Release the reserve | Journeys | Spec | Yes |  |
| `pass-on-payment` | Pass on a payment you received | Journeys | Spec | Yes |  |
| `repurchase-invoice` | Buy back an invoice (recourse) | Journeys | Spec | Yes |  |
| `submit-credit-note` | Report a credit note | Journeys | Spec | Yes |  |
| `dispute-factored-invoice` | Raise an invoice dispute | Journeys | Spec | Yes |  |
| `request-limit-change` | Ask for a higher limit | Journeys | Spec | Yes |  |
| `factoring-report` | Download a facility report | Journeys | Spec | Yes |  |
| `acknowledge-assignment` | Acknowledge a notice of assignment (debtor side, simulated) | Journeys | Spec | Yes |  |

## Prototype entries without their own block in a module file

None.

Catalog entries in the module files: 136. Built in the prototype: 26 (26 with a block in a module file). Aliases count as entries so a bank can switch each route separately.

## Open questions

1. Should a bank be able to rename an entry or reorder its menu group, or only switch it on or off?
2. Should options be typed (switch, list of allowed values, a number such as a limit) so the catalog panel can validate them?
3. Entries that move money and entries that only show information may need different approval before a bank can switch them on in production.
4. Prototype permission names (`pay.create`, `pay.approve`, `accounts.view`) differ from the README vocabulary (`biz.*`, `payments.create`). One list must win before step 2.
