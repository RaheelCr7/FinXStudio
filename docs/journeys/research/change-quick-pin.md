# Change quick PIN (`change-quick-pin`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://www.nationwide.co.uk/ways-to-bank/banking-app/banking-app-security: Example of an app security page

## Patterns by market

| Market | Pattern |
|---|---|
| US | Change PIN in app security settings (unverified) |
| UK | Change passcode in settings after the old one (unverified) |
| EU | Old PIN then new PIN twice (unverified) |
| Middle East | Same (unverified) |

## Standards and rules
- Short PINs are weak, so the bank limits tries (here 3) and refuses repeats and runs.

## Decisions for BankWorkx®
- Current PIN, new PIN, confirm. No code, because the current PIN proves it is the person.
- Three wrong PINs turn quick sign-in off and the person sets it up again.
- If no PIN is set the screen offers Set up quick sign-in.

## Fields

| Field | Rule | Message |
|---|---|---|
| Current PIN | 6 digits; must match | That PIN isn’t right. |
| New PIN | 6 digits; not repeats or runs; different from current | That PIN is too easy to guess. |
| Confirm | Equals new | The PINs don’t match. |

## Edge cases
- PIN locked after 3 wrong: quick sign-in off.
- Service down: nothing changed.

## Open questions
- Should the PIN lock need a password sign-in to clear? Sandbox: set up again.
