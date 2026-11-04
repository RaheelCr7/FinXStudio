# business-service-request: ask the bank for something

Sources (only search results read; pages not opened in full, so details are unverified where marked):
- https://www.gov.uk/government/publications/guidance-to-the-people-with-significant-control-requirements-for-companies-and-limited-liability-partnerships - background only (company detail changes may need documents; not verified for banks)

## Standards and rules
- Service requests get a reference and a visible status (Received, In progress, Done, Declined).
- Closing an account needs the balance moved; the only account cannot be closed.

## Decisions for BankWorkx
- Five types; account and amount-free details; phone with country code; consent line; no code.
- Duplicate open request refused; five a day per person.
- A My requests list (business-requests view) per company.

## Fields
| Field | Rule | Message |
|---|---|---|
| Account | required for close, cheque book | Choose an account. |
| Move balance to | required if balance above 0 | This is required. |
| Leaves | 25, 50, 100 | Choose how many leaves. |
| Subject | 5 to 80 | Add a short subject (at least 5 characters). |
| Details | 10 to 1,000 | Tell us a little more (at least 10 characters). |
| Phone | +, 8 to 16 digits | Enter a phone number with the country code. |

## Edge cases
- Duplicate, daily limit, closing last account, switching company.

## Open questions
- Who may close accounts (administrators only?) - bank policy; unverified.
