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

## Bank configuration

A bank sets, besides the on/off switches and options:
- **Home market.** One setting that decides local identifiers and formats (account number labels, national ID format, proof of address). Journeys never name the country; they read the market.
- **Speed mapping.** Which real payment rail serves each speed class (Standard, Same day, Instant) in the bank's market, with its fee, limit and cut-off.

## Retail (Release 1, 57 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `loan-calculator` | Loan calculator | Public: before sign-in | Built | Yes | Include home loans; Show a Start application button |
| `deposit-calculator` | Deposit calculator | Public: before sign-in | Built | Yes | Offer interest paid every month; Show a Start application button |
| `find-branch-atm` | Find a branch or ATM | Public: before sign-in | Built | Yes | Include cash machines; Offer an “Open now” filter |
| `contact-support` | Contact us | Public: before sign-in | Built | Yes | Offer chat; Offer a call; Offer secure messages to signed-in customers |
| `open-account` | Open an account | Public: before sign-in | Built | Yes | Offer the savings account; Offer the Islamic account; Ask for a proof of address when the local rules need it; Allow save and resume; Send income over 1M to manual review |
| `track-application` | Track my application | Public: before sign-in | Built | Yes | Ask for a one-time code before showing the status |
| `register-digital-banking` | Register for digital banking | Public: before sign-in | Built | Yes | Let people identify with a card number; Offer to trust this device |
| `sign-in` | Sign in | Signing in and security | Built | No (core) | Offer one-time codes by text message (being phased out; app approval is safer); Offer Face ID / fingerprint quick sign-in; Offer passkeys; Offer a 6-digit quick PIN; Let people remember their username on this device; Passwords expire after 12 months (NIST advises against; some regulators expect it); Ask for a code when the sign-in looks unusual, even on a trusted device |
| `setup-quick-login` | Set up quick sign in | Signing in and security | Built | Yes | Offer Face ID / fingerprint; Offer passkeys; Offer a 6-digit quick PIN |
| `forgot-username` | Forgot username | Signing in and security | Built | Yes | Let people identify with an email address |
| `reset-password` | Reset password | Signing in and security | Built | Yes | Offer unlock without a new password |
| `unlock-account` | Unlock account | Signing in and security | Built (alias of `reset-password`) | Yes |  |
| `forgot-password` | Forgot password | Signing in and security | Built (alias of `reset-password`) | Yes |  |
| `change-password` | Change password | Signing in and security | Built | Yes | Sign out other devices after a change |
| `trusted-devices` | Trusted devices | Signing in and security | Built | Yes | Limit trusted devices to 5; Offer "Sign out other devices" |
| `change-quick-pin` | Change quick PIN | Signing in and security | Built | Yes |  |
| `accounts` | Accounts overview | Personal: Accounts | Built | Yes | Offer the hide-balance toggle; Show foreign currency accounts |
| `account-details` | Account details | Personal: Accounts | Built | Yes | Offer Share for account numbers; Allow closure requests in the app; Offer Report a problem on transactions; Allow hiding an account |
| `statement` | Account statement | Personal: Accounts | Built | Yes | Offer official stamped statements; Offer proof of address letters; Offer balance certificates; Charge a fee for official statements and balance certificates; Offer paperless statements; Offer OFX and QIF files |
| `account-nickname` | Rename an account | Personal: Accounts | Spec | Yes |  |
| `open-another-account` | Open another account | Personal: Accounts | Built | Yes | Offer the savings account; Offer currency accounts |
| `create-budget` | Create a budget | Personal: Accounts | Built | Yes | Offer the 80% alert; Offer the 100% alert |
| `budgets` | Budgets | Personal: Accounts | Built | Yes |  |
| `transfer-types` | Ways to send money | Personal: Payments | Built | Yes |  |
| `own-transfer` | Between my accounts | Personal: Payments | Built | Yes | Allow conversion between currencies; Charge the 0.20% conversion fee |
| `internal-transfer` | To a BankWorkx customer | Personal: Payments | Built (alias of `personal-transfer`) | Yes |  |
| `personal-transfer` | Send money | Personal: Payments | Built | Yes | Offer “Between my accounts”; Offer “To a BankWorkx® customer”; Offer “To another bank”; Offer “To another country”; Speed: Standard; Speed: Same day (where the market has it); Speed: Instant (where the market has it); Speed: Priority (international); Let the customer choose who pays the bank charges (international); Allow currency conversion between my accounts; Run the payee name check where the market has one; Allow “Later” and repeating payments; Apply the 24-hour limit to new payees |
| `single-transfer` | Quick transfer | Personal: Payments | Built | Yes | Offer the Instant speed; Allow “Later” and repeating payments; Apply the 24-hour limit to new payees |
| `international-transfer` | Abroad | Personal: Payments | Built (alias of `personal-transfer`) | Yes |  |
| `pay-bill` | Pay a bill | Personal: Payments | Built | Yes | Look up the amount due from the biller (off: the person types the amount); Allow the minimum and other amounts where the biller accepts them; Allow paying a bill from an account in another currency; Offer to save the biller; Offer auto-pay after the payment |
| `mobile-topup` | Mobile top-up | Personal: Payments | Built | Yes | Let people save numbers |
| `manage-beneficiary` | Add, edit or delete a payee | Personal: Payments | Built | Yes | Run the name check where the market has one; Let a person cancel scheduled payments while deleting a payee; Offer payee labels (Family, Friend, Landlord…) |
| `schedule-payment` | Schedule a payment | Personal: Payments | Built | Yes | Allow schedules between own accounts; Allow scheduling a saved bill (full bill or minimum due); Offer “skip only the next payment” when cancelling; If there is not enough money, retry once on the next business day (off: skip and notify); Send one reminder the day before each payment; Close changes at 09:00 the business day before (default 18:00) |
| `cancel-standing-order` | Cancel a standing order | Personal: Payments | Built (alias of `schedule-payment`) | Yes |  |
| `cards` | Cards | Personal: Cards | Built | Yes | Show recent card transactions; Show the Wallet action |
| `activate-card` | Activate card | Personal: Cards | Built | Yes | Ask for the 3-digit security code; Let the customer set the PIN during activation |
| `card-controls` | Card limits and controls | Personal: Cards | Built | Yes | Offer trip dates when International is on |
| `freeze-card` | Freeze card | Personal: Cards | Built (alias of `card-controls`) | Yes |  |
| `virtual-card` | Virtual card | Personal: Cards | Built | Yes | Offer a 3 year card as well as single use |
| `replace-card` | Replace a card | Personal: Cards | Built | Yes | Charge a fee for express delivery |
| `card-pin` | Card PIN | Personal: Cards | Built | Yes | Refuse easy PINs (repeats and sequences) |
| `dispute-transaction` | Report a problem with a payment | Personal: Cards | Built | Yes | Let people add a receipt or screenshot; Offer to block the card when a payment isn’t recognised |
| `add-card` | Add a card | Personal: Cards | Built | Yes | Accept American Express; Let saved cards be used for paying as well as adding money |
| `save-borrow` | Save | Personal: Save & Borrow | Built | Yes | Show savings goals; Show term deposits; Show loans; Show investments |
| `term-deposit` | Term deposit | Personal: Save & Borrow | Built | Yes | Offer interest paid monthly; Allow early closure (with a charge) |
| `savings-goal` | Savings goal | Personal: Save & Borrow | Built | Yes | Offer automatic monthly top-ups; Allow taking money out of a goal |
| `apply-loan` | Apply for a loan | Personal: Save & Borrow | Built | Yes | Send borderline applications to manual review; Charge a 1% arrangement fee |
| `repay-loan` | Repay a loan | Personal: Save & Borrow | Built | Yes | Allow paying any amount; Allow settling in full; Charge a 1% early settlement fee |
| `invest` | Invest | Personal: Save & Borrow | Built | Yes | Ask for risk acknowledgement on high-risk funds; Offer high-risk funds |
| `sell-investment` | Sell an investment | Personal: Save & Borrow | Built | Yes | Charge a 0.25% selling fee |
| `add-money` | Add money | Personal: Save & Borrow | Built | Yes | Offer top-up from a card; Charge the 1.5% card fee; Offer bank transfer details |
| `update-profile` | Update profile | Personal: More | Built | Yes | Send a code to the new mobile number too; Confirm a new email by link before it applies; Check an address change before it applies; Ask for proof of address |
| `new-message` | New message | Personal: More | Built | Yes | Allow one attachment |
| `messages` | Messages | Personal: More | Built | Yes |  |
| `service-request` | Service request | Personal: More | Built | Yes | Offer cheque book orders; Offer letters; Offer account type changes |
| `my-requests` | My requests | Personal: More | Built | Yes |  |
| `connect-account` | Connect account | Personal: More | Built | Yes | Allow credit card accounts |

## SME (Release 1, 22 entries)

| Slug | Journey | Category | Status | Can a bank switch it off? | Options a bank can set |
|---|---|---|---|---|---|
| `business-accounts` | Business accounts | Business: Accounts | Built | Yes | Show account numbers for receiving money |
| `business-statement` | Business statement | Business: Accounts | Built | Yes | Offer bank statement files (BAI2, MT940, camt.053); Allow intraday statements; Allow scheduled statements; Allow email to addresses outside the company |
| `supplier-payment` | Pay a supplier | Business: Payments | Built | Yes |  |
| `add-supplier` | Add a supplier | Business: Payments | Built | Yes | Allow suppliers with a bank in another country; Run the name check where the market has one; Cap payments to a supplier in its first 24 hours; Allow a supplier who is a person |
| `payment-template` | Payment templates | Business: Payments | Built | Yes | Allow a template without an amount |
| `templates` | Templates list | Business: Payments | Built | Yes |  |
| `schedule-business-payment` | Schedule a supplier payment | Business: Payments | Built | Yes | Offer “Every 3 months”; Tell the Maker the day before each payment; Close changes at 09:00 the business day before (default 18:00) |
| `business-schedules` | Scheduled supplier payments | Business: Payments | Built | Yes |  |
| `withdraw-payment` | Withdraw a payment | Business: Payments | Built | Yes | Ask why the payment is withdrawn |
| `payment-tracker` | Payment tracker | Business: Payments | Built | Yes |  |
| `bulk-payment` | Bulk payment | Business: Bulk and payroll | Built | Yes | Allow entering payments by hand; Also accept bank file formats; Offer the Same day speed; Offer the Instant speed |
| `repair-bulk-lines` | Repair rejected lines | Business: Bulk and payroll | Spec | Yes |  |
| `bulk-status` | Batch status | Business: Bulk and payroll | Built | Yes |  |
| `payroll-run` | Payroll run | Business: Bulk and payroll | Built | Yes | Allow bonus lines; Allow deduction lines; Ask for a reason when the total changes by more than 20%; Offer to send payslips |
| `approve-payments` | Approve payments | Business: Approvals | Built | Yes | Allow approving several at once; Ask for a code from 25,000.00; Allow passing a payment to another approver |
| `admin` | Admin | Business: Admin | Built | Yes | Show the activity log |
| `manage-user` | Invite, edit or disable a user | Business: Admin | Built | Yes | Second administrator approves new administrators; Ask for a reason when disabling |
| `change-limits` | Change limits | Business: Admin | Built | Yes | Second administrator approves increases |
| `edit-signatory-group` | Edit an approval group | Business: Admin | Built | Yes | Second administrator approves group changes; Allow approvers in order |
| `business-service-request` | Business service request | Business: More | Built | Yes | Offer cheque books |
| `business-requests` | Service requests | Business: More | Built | Yes |  |
| `kyb-onboarding` | Open a business account | Business: More | Built | Yes | Ask for an ownership chart; Email each owner and director an ID check |

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

None: every prototype entry has a block.

Catalog entries in the module files: 146. Built in the prototype: 77 (77 with a block in a module file). Aliases count as entries so a bank can switch each route separately. All Release 1 blocks (Retail and SME) were synced to the design rules; Releases 2 to 4 are structure only.

## Open questions

1. Should a bank be able to rename an entry or reorder its menu group, or only switch it on or off?
2. Should options be typed (switch, list of allowed values, a number such as a limit) so the catalog panel can validate them?
3. Entries that move money and entries that only show information may need different approval before a bank can switch them on in production.
4. Prototype permission names (`pay.create`, `pay.approve`, `accounts.view`, `admin`) differ from the README vocabulary (`biz.*`, `payments.create`). One list must win before step 2.
