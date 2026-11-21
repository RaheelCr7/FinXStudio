# Research: add, edit, delete a payee (`manage-beneficiary`)

Prototype: `design/bankworkx-r1/src/journeys/31-manage-beneficiary.js`.

## 1. Sources
- ECB instant payments regulation page and Finextra explainer: Verification of Payee is mandatory for euro credit transfers (euro area from 9 October 2025). Took: label and outcomes.
- NatWest and Coutts help pages: Confirmation of Payee runs when a new Faster Payment or CHAPS payee is set up or changed. Took: re-check on edit.
- PSR APP scam reimbursement coverage (GBP 85,000 cap from 7 October 2024): reason UK banks add friction at the payee step. UK Treasury delay proposal (72 hours when fraud is suspected): the only "cooling-off" material found; I found no standard new-payee cooling-off rule in a public source, so the 24 hour USD 500 limit is a BankWorkx® design from 09 section 10.
- PSD2 SCA vendor guides: trusted beneficiaries (a whitelist the customer maintains) can be exempt from authentication at the payment, but adding one needs strong authentication. Took: a code is required to add or change account details.
- Central Bank / scheme pages for IBAN country use in the UAE, Saudi Arabia and Jordan, and sample IBANs in `09-payment-rails.md`.

## 2. Patterns found
| Pattern | US | UK | Europe | Middle East |
|---|---|---|---|---|
| Fields | Name, routing, account, type | Name, sort code, account | Name, IBAN | Name, IBAN, country |
| Validation | ABA checksum | Sort code length, CoP | IBAN checksum, VoP | IBAN checksum and country prefix |
| Name check | Optional, patchy | Confirmation of Payee: match, close, no match, could not check | Verification of Payee, same four outcomes | Varies |
| Extra friction | Alerts, Zelle limits for new | Warnings on new payees, delays | Code on add | OTP, sometimes a waiting period |
| Delete | Confirm dialog | Confirm | Confirm | Confirm |

## 3. Standards and rules
- **Confirmation of Payee (UK) and Verification of Payee (EU)**: four outcomes: match, close match (show the real name), no match, could not check. The customer must be allowed to continue after a warning, and the warning must be clear that the money may go to the wrong person.
- **IBAN**: country code, two check digits, up to 30 characters; mod-97 equals 1; each country has a fixed length.
- **ABA routing**: nine digits with the 3-7-1 checksum.
- **UK sort code**: six digits; account number eight.
- **BIC**: 8 or 11 characters.
- **Strong customer authentication**: adding or changing account details is sensitive and needs a code; a nickname change does not; deleting does not.

## 4. Decisions and why
1. Region-specific fields and green "valid" notes while typing, with the exact error and code. Reason: fix at the field, not after a bank rejection.
2. Name check after the details, with the four outcomes. A tick is needed for anything but a match; "Use '{name}'" corrects a close match. Saved as Verified only on a match (or after correcting).
3. A new or changed payee is limited to USD 500 for 24 hours; the review and result say so; the quick transfer enforces it and shows the allowance.
4. Changing only the nickname or label skips the check, the code and the cooling-off.
5. Delete is blocked if a schedule uses the payee (`BENEFICIARY_IN_USE`); if the bank allows it, a switch cancels those schedules too. Reason: silently dropping a rent payment is worse than asking.
6. Duplicate details are refused (`BENEFICIARY_EXISTS`); limit 50 payees.
7. A label chip (Family, Friend, Landlord, Business, Other) is optional and bank-switchable.
8. A "Fill with a sample payee" button for demos.

## 5. Field table
| Field | Rule | Message / code |
|---|---|---|
| Name on the account | 2 to 70 characters | "Enter the name on the account. (PAYEE_NAME_REQUIRED)" |
| Nickname | 24 characters | "Use 24 characters or fewer." |
| BankWorkx® account number | 10 digits, must exist | "We can't find a BankWorkx® account with that number. Check it and try again. (CUSTOMER_NOT_FOUND)" |
| Routing (ABA) | 9 digits, checksum | "That routing number isn't valid. Check the 9 digits. (INVALID_ROUTING)" |
| Account (US) | 4 to 17 digits | "An account number has 4 to 17 digits. (INVALID_ACCOUNT)" |
| IBAN | Mod-97, length for country | "That IBAN doesn't look right. Check each character. (INVALID_IBAN)" |
| IBAN (Europe) | SEPA country | "(NOT_SEPA)" |
| IBAN (Middle East) | Starts with the chosen country | "That IBAN starts with AE, but you chose Saudi Arabia. (COUNTRY_MISMATCH)" |
| Sort code | 6 digits | "A sort code has 6 digits, like 20-00-00. (INVALID_SORT_CODE)" |
| Account (UK) | 8 digits | "A UK account number has 8 digits. (INVALID_ACCOUNT)" |
| BIC | 8 or 11 characters | "A SWIFT/BIC has 8 or 11 letters and numbers. (INVALID_BIC)" |
| Account or IBAN (SWIFT) | 6 to 34 letters, digits, spaces, dashes | "That account number looks too short or too long. (INVALID_ACCOUNT)" |
| Name check tick | Needed unless match | "Check the payee before you continue. (PAYEE_NOT_CHECKED)" |
| Consent | Required | "Tick to confirm." |
| Delete | Not in use by a schedule | "{name} is used by {n} scheduled payment(s). Cancel it first. (BENEFICIARY_IN_USE)" |

## 6. Edge cases
- Close match then "Use": name replaced, check re-run, becomes Verified.
- Name check switched off at the bank: every result is "couldn't check".
- Editing the IBAN of a payee with a schedule: the schedule keeps pointing to the payee; the payee becomes new for 24 hours and the schedule's next run is limited to USD 500 (to be tested in `schedule-payment`).
- BankWorkx® customer payee is stored as a US-region record in this prototype so the existing wizard does not break.
- SWIFT payees can never be Verified (name check unavailable).

## 7. Open questions
- Should a long-standing, repeatedly used payee ever stop being "new" earlier than 24 hours?
- Should edits to a payee used by a schedule pause that schedule until the 24 hours pass?
- Is 50 the right payee limit?
- Differences from 09: none in rules; the label chip and duplicate/limit codes come from the retail spec.
