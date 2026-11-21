# Secure messages (messages view and new-message) (`new-message`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://www.nationwide.co.uk/ways-to-bank/banking-app/banking-app-security: Example of an app with in-app help (general)

## Patterns by market

| Market | Pattern |
|---|---|
| US | Secure message centre with inbox and compose (unverified) |
| UK | In-app messaging with topic (unverified) |
| EU | Mailbox in online banking (unverified) |
| Middle East | Secure mailbox (unverified) |

## Standards and rules
- Secure messages let a person talk about accounts without sending details by email.

## Decisions for BankWorkx®
- Inbox with unread dots, thread view with a reply box, New message with topic, subject, message and one optional file.
- A warning appears only for Fraud or security.
- Replies are not simulated; two threads are seeded.

## Fields

| Field | Rule | Message |
|---|---|---|
| Topic | Required | This is required. |
| Subject | 3 to 80 characters | Use at least 3 characters. |
| Message | 10 to 1000 characters | Write at least 10 characters. |
| File | PDF, JPG or PNG up to 5 MB | That file is over 5 MB. |

## Edge cases
- Empty inbox shows New message.
- Service down: reply says it could not send.

## Open questions
- Retention of messages and reply time promise (here 1 business day, unverified).
