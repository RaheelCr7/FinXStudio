# Service requests (`service-request`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://www.nationwide.co.uk/ways-to-bank/banking-app/banking-app-security: General app reference only

## Patterns by market

| Market | Pattern |
|---|---|
| US | Order checks, request letters, with a tracked status (unverified) |
| UK | Order paying-in book, letters via secure message (unverified) |
| EU | Requests via secure mailbox (unverified) |
| Middle East | Cheque book and letters often in app (unverified) |

## Standards and rules
- A request is recorded with a reference and has a status the person can follow.

## Decisions for BankWorkx®
- Types: cheque book, letter, lost card (routes to card journeys), change account type, other. Each can be switched off.
- My requests lists status (Received, In progress, Done, Cancelled); Received can be cancelled.
- No step-up: none moves money.

## Fields

| Field | Rule | Message |
|---|---|---|
| Account | Required | This is required. |
| Leaves | 25 or 50 | - |
| Branch | Required when collecting | This is required. |
| Subject / details | 3 and 10 characters minimum | Use at least 3 characters. |

## Edge cases
- Duplicate cheque book for an account with one open is refused.
- Lost card without a card journey shows a call message.

## Open questions
- Fees for cheque books and letters (not shown).
