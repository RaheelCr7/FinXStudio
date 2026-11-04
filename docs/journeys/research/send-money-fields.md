# Research: what a real transfer asks for (`personal-transfer`, "Send money")

Prototype: `design/bankworkx-r1/src/journeys/32-personal-transfer.js`. The field table is a global `TXF` in that file. Synthetic data only.

## 1. Sources and how far they can be trusted
Web searches this session (the tool returned snippets, not full standards, so every row marked "check" needs the scheme rulebook before a real build):
- Swift / ECB AMI-Pay / JPMorgan / Handelsbanken pages on ISO 20022 postal addresses: from November 2025 a hybrid address (town name and country mandatory, plus up to two address lines of 70 characters) is allowed in CBPR+; fully unstructured addresses are being phased out, with one vendor guide giving November 2026 for rejection (not confirmed against Swift). If a BIC identifies an agent, no bank address is needed. The data must exist at payment initiation (pain.001), not only at the bank.
- Treasury, court and city wire instruction sheets for Fedwire: beneficiary name, address and account are carried in the beneficiary tags, the receiver ABA in {3400}, and a free-text originator-to-beneficiary field of limited length (one sheet says 70 characters). Not the Federal Reserve format guide itself.
- UK bank help pages (Lloyds, Halifax, HSBC, Coutts): Confirmation of Payee applies to Faster Payments and CHAPS, compares the name and whether the account is personal or business, and some accounts need a reference to identify the owner. No page gave the 18-character reference limit; the 18 comes from 09 and the Faster Payments/Bacs convention (check).
- EU Instant Payments Regulation pages (sepamail, Betaalvereniging, Finologee): from 9 October 2025 the payer's bank must offer Verification of Payee on euro transfers, with four outcomes (match, close match, no match, not possible) and no automatic rejection on a mismatch.
- Jordan CliQ pages (JoPACC, AJIB, Investbank): a CliQ alias can be an alias name, an email or a mobile number, and the sender can also pay by IBAN. Local, JOD only. A purpose field was only found on payment requests.
- Not found by search: UAE Aani alias rules, UAEFTS message fields, SARIE field rules, FATF Recommendation 16 text. These rows use general knowledge and are marked (check). FATF R.16 is understood as: originator name, account and address or ID, and beneficiary name and account travel with every wire.

## 2. Decisions
1. **One question per screen.** Type, then where, then who, then the name check, then amount, then review. Each screen has one title, one short line, headed sections and one button.
2. **One table, `TXF`.** Every "new payee" form is generated from it (label, key, type, validator, hint, required). Adding a country or changing a rule is a data change.
3. **Address.** Asked in the payee form but optional except for SWIFT. A rail that needs an address (wire, CHAPS, UAEFTS, SARIE, JoPACC, SWIFT) asks for it on the amount screen if the saved payee has none. Street and town are required then; postcode is not.
4. **Name check.** US: account name check only when the sandbox registry knows the account. UK: Confirmation of Payee with a fifth outcome, wrong type of account (personal against business). EU: Verification of Payee. UAE, Saudi, Jordan: name check from the IBAN registry. SWIFT: usually "could not check". BankWorkx® customers and alias or mobile payments: the name comes back and the person confirms it ("found").
5. **Lookups.** BankWorkx® customer by mobile number, email, BankWorkx ID or 10-digit account number. Aani by UAE mobile. CliQ by alias or mobile. An alias payment can only use the instant rail.
6. **Purpose.** Required for UAE, Saudi, Jordan, SWIFT, CHAPS and Fedwire wires. Shown with a short code (FAM, GDS, SAL, RNT, EDU, INV, OTH). SWIFT also asks the relationship to the beneficiary, and the source of funds from USD 10,000.
7. **References.** UK 18 characters; US ACH memo 80; US wire message 140; everything else 140. Allowed characters as in 09.
8. **Sandbox countries.** Canada, India, Japan, Australia plus Switzerland (CHF, IBAN), Singapore (SGD) and Mexico (MXN, CLABE). Local bank codes: Canada institution and transit, India IFSC, Australia BSB. The file adds these to `INTL`, `FX`, `SYM` at load so other journeys can show a saved payee in them.
9. **Cooling-off, daily limit, sanctions hold, 60 s rate hold** follow 09 unchanged.

## 3. Master table: type x region
"Payee form" is what the payee screen asks. "Amount screen" is asked once the rail is known. R = required.

| Type / region | Payee form (R = required) | Amount screen adds | Validation | Message | Name check | Why |
|---|---|---|---|---|---|---|
| Between my accounts | From, To (R) | Amount, note; rate if the currencies differ | Different accounts; funds; mid-market rate held 30 s | Internal book transfer | None, both are yours | No third party, so no name, address or purpose |
| BankWorkx® customer | Find by (mobile, email, ID, account) and the value (R) | Amount, note | Format per method; must exist (`CUSTOMER_NOT_FOUND`) | Internal book transfer | Name and masked account shown back, tick to confirm | The bank holds the record; one identifier is enough |
| US | Name (R), account type, routing ABA (R, checksum), account (R, 4-17 digits); address optional (street, town, state, ZIP) | Rail (ACH, same-day, RTP/FedNow, wire); wire needs address and purpose; memo 80 or wire message 140 | ABA checksum; `INVALID_ROUTING` | NACHA file; Fedwire; RTP ISO 20022 | Account name check if known | ACH needs routing and account; wire adds beneficiary address and purpose for sanctions screening |
| UK | Name (R), personal or business, sort code (R), account (R, 8 digits); address optional | Rail (Faster Payments, CHAPS, Bacs); CHAPS needs address and purpose; reference 18 | Sort code 6 digits; account 8 | FPS, CHAPS pacs.008, Bacs | Confirmation of Payee: match, close, no match, wrong type, not possible | Sort code and account find the account; type lets CoP compare |
| Europe (SEPA) | Name (R), IBAN (R, mod 97, SEPA country); address optional (hybrid) | SCT or SCT Inst; reference 140; purpose optional (not asked) | `INVALID_IBAN`, `NOT_SEPA` | pacs.008 SEPA | Verification of Payee | IBAN gives bank and country; address, if sent, must be town, country and up to two lines |
| UAE | Pay by IBAN or mobile (Aani); name and IBAN (R) or mobile (R); city optional | Aani or UAEFTS; purpose (R); UAEFTS needs address | IBAN `AE`, 23 characters; mobile 05x | Aani IPP; UAEFTS | Name check; mobile returns the name | Purpose is a regulatory field; Aani finds people by mobile |
| Saudi Arabia | Name (R), IBAN (R, `SA`, 24); National ID or Iqama optional (10 digits); city optional | sarie instant or SARIE; purpose (R); SARIE needs address | `COUNTRY_MISMATCH` | sarie / SARIE ISO 20022 | Name check | Some banks ask for the national ID on large amounts (check) |
| Jordan | IBAN, CliQ alias or mobile; name and IBAN (R) or alias or mobile (R); city optional | CliQ or JoPACC; purpose (R); JoPACC needs address | IBAN `JO`, 30; alias 3-30 characters; mobile 07x | CliQ / JoPACC | Alias returns the name | CliQ is built on aliases; JOD only |
| SWIFT (7 countries) | Name (R), person or company, street and town (R), postcode, bank name (R), BIC (R, country check), local code where used (R), account or IBAN (R), intermediary BIC (R if ticked) | Purpose (R), relationship (R), source of funds (R from USD 10,000), charges SHA/OUR/BEN, reference 140 | BIC 8/11 and country; IFSC; BSB; transit; IBAN; CLABE | pacs.008 CBPR+ with UETR | Usually none | FATF R.16 and Swift need name, address, account, bank, purpose |

Payee-form field counts in `TXF` (required of total): own 2 of 2, internal 1 of 2, US 3 of 8, UK 3 of 7, EU 2 of 5, UAE 3 of 5, Saudi 2 of 4, Jordan 3 of 5, SWIFT 9 of 12. Conditional fields only show for the chosen method or country.

## 4. Edge cases covered
Saved payee already exists (`BENEFICIARY_EXISTS`); alias not found (`ALIAS_NOT_FOUND`); name close, none, wrong account type, not checkable; wire or CHAPS or SWIFT with no address; purpose missing; reference too long or with bad characters; BIC from another country; yen with decimals; over the rail limit; over balance; over the daily limit; new payee over USD 500; SEPA Instant down; same-day rail after cut-off; sanctions hold ("Test Sanctions"); timeout and service-down on submit; rate expiry on review.

## 5. Open questions
1. Is the UK reference 18 characters on CHAPS too? ISO 20022 CHAPS allows more. The prototype uses 18 for all UK rails.
2. UAEFTS, SARIE and JoPACC mandatory fields were not found online; address is treated as required by assumption.
3. Should a duplicate payee jump to the saved one instead of showing an error?
4. Saudi national ID threshold, and which banks ask.
5. The Back button leaves the journey instead of going back one step (engine; see the report).
