# Research: add-supplier

Prototype: `design/bankworkx-r1/src/journeys/70-add-supplier.js`. Synthetic data. "Unverified" marks points not confirmed on an official page.

## Sources
| URL | Taken |
|---|---|
| https://www.bankofirelanduk.com/?p=30583 | New payees capped for a short window, then the normal limit returns (figures vary by bank). |
| https://www.lloydsbank.com/business/help-and-support/online-banking/online-payment-control.html | An administrator sets limits; payments above them need approval. |
| https://www.tide.co/en-IN/support/features/bank-transfer-faqs/what-is-the-24-hour-new-beneficiary-limit/ | 24-hour new-beneficiary limit exists in other markets too. |
| https://docs.oracle.com/en/industries/financial-services/banking-digital-experience/25.1.0.0.0/fxccs/withdraw-transactions-pending-approval.html | Maker-checker on setup data. |

## Patterns by market
| Market | Pattern |
|---|---|
| US | Routing number + account; no name check; admin or dual control on new payees (unverified for each bank). |
| UK | Sort code + account; name check; 24 to 48 hour cap on new payees at several banks. |
| Europe | IBAN; name check on euro payments. |
| Middle East | IBAN; name check; admin approval common (unverified). |

## Decisions
- Same bank-detail fields and rules as the payee form in Send money, so one set of validators serves both.
- The Maker only requests; an administrator approves. The supplier shows Pending and cannot be paid until then.
- A code confirms the request (it changes who can receive company money).
- A supplier under 24 hours old has a per-payment cap (5,000 in the prototype, a bank option). Shown on the review and receipt only when the option is on.
- Other-country suppliers add country, bank code (where the country has one), SWIFT/BIC and address.

## Fields
| Field | Rule | Message |
|---|---|---|
| Supplier name | 2+ chars, letters/numbers, unique in the list | Enter the supplier's name. / You already have a supplier with this name. |
| Routing / sort code / IBAN / account | As in Send money | As in Send money |
| Country, BIC, bank code | BIC country must match | That bank code doesn't match the country. |
| Address (other country) | Street and town required | Enter the supplier's street and number. |

## Edge cases
Same account already saved; name check close or no match (Add anyway); more than 10 pending requests; timeout (check Suppliers before retrying).

## Open questions
Does the bank allow an administrator to add directly without a second step? Is the 24-hour cap amount per bank or per company? Does an international supplier need a currency choice? (all unverified)
