# Coding standards

Short on purpose. Where a rule can be a lint rule or a test, it is one; these are the rules that cannot.

## Money
- Never use floating point for money. Amounts are integer minor units or go through the shared money helpers; format only with the shared formatter (currency decimals differ: JPY 0, JOD 3).
- Never compare or add amounts of different currencies.
- Rounding is explicit and tested at 0, 2 and 3 decimals.

## Secrets and personal data
- No secrets, keys, tokens or real customer data in the repo, journeys, mappings, fixtures, logs or error messages. `.env*`, `*.pem`, `.data/` stay ignored.
- Do not log account numbers, balances, names, phone numbers or one-time codes.
- Sandbox values are obviously fake and live only in `mock-bank-api` and fixtures.

## Boundaries
- Treat everything that crosses a boundary as untrusted: journeys from the server, request bodies in Studio API routes, bank responses, anything from the web or from AI. Validate with the schema or an explicit check at the edge.
- Dependency direction follows `ARCHITECTURE.md`. No cycles. `mock-bank-api` is never imported by production code paths.
- Studio API routes check the caller's role before acting and write an activity-log entry for changes.

## Journeys and AI
- A journey that moves money needs: a one-time code before the money moves, a consent the person must tick, and a failure path for every bank call (lint enforces this).
- AI output is always a draft. Nothing publishes without a person.
- Generated or changed journeys carry executable scenarios that cite acceptance criteria.

## UI
- Every exported component has a spec, a native twin, props, styles and a gallery state; accessibility checks must pass.
- Right-to-left and long text are tested, not assumed. Tap targets and contrast follow `ui-kit` checks.

## Tests
- A bug fix starts with a failing test. Tests do not depend on wall-clock time or random values (pass `now`).
- `pnpm typecheck` and `pnpm test` stay green on every PR. Do not weaken or skip a test to make it pass; say why in the PR if one must change.

## Style
- Match the surrounding code (naming, comment density). Comments explain why, not what.
- Prefer small, pure functions in shared packages over logic in components.
