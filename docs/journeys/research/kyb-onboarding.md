# kyb-onboarding: company applies for business banking

Sources (only search results read; pages not opened in full, so details are unverified where marked):
- https://www.cov.com/-/media/files/corporate/publications/2016/05/fincen_releases_final_rule_on_beneficial_ownership_and_risk_based_customer_due_diligence.pdf - US: owners of 25% or more, plus one controlling person
- https://www.gov.uk/government/publications/people-with-significant-control-summary-guidance/summary-guidance-for-companies-register-of-people-with-significant-control-pscs - UK: more than 25% of shares or votes, or control of the board
- EU and UAE: 25% beneficial owner test is the common standard (from memory, not verified here)

## Standards and rules
- Banks identify every person owning 25% or more and one person with control.
- Company documents (certificate, proof of address) and a tax declaration are standard.

## Decisions for BankWorkx
- Seven screens. List owners of 25% or more and directors; smaller owners as one combined figure so the total is 100%.
- Each person gets an email for an ID check (switchable).
- Documents: generic Upload placeholders. Tax ID format follows the home market, never named.

## Fields
| Field | Rule | Message |
|---|---|---|
| Legal name | 2 to 100 | This is required. |
| Registration number | 5 to 20 letters, digits | Use 5 to 20 letters or digits. |
| Date of incorporation | DD/MM/YYYY, past | Enter the date as DD/MM/YYYY. |
| Ownership | each 25 to 100; total 100 | Ownership adds up to N%. It must be 100%. |
| Director | at least one | Add at least one director. |
| Tax ID | by market | Enter the N digits. |

## Edge cases
- Ownership not 100, no director, future date, duplicate application, documents missing.

## Open questions
- Indirect ownership through other companies is not modelled.
- Thresholds of 10% for high-risk customers (unverified).
