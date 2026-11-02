# Journey catalog

The catalog is a library of ready-made journeys. A project (bank app) adds one to get its own copy, then edits it like any journey it built itself.

## Where it is

- **Studio → Catalog** in the sidebar (or ⌘K → Catalog). It shows the catalog for the project selected in the switcher.
- Filter by category, search by words, press **Try** on a card to run the journey on a phone preview in that project's look and with its sandbox customers.
- **Add to project** copies it as a **draft**. Tick **Make live when added** first to publish it straight away. A journey the project already has shows **In project · Open**, so nothing is added twice.
- A yellow note, for example *Amounts in USD*, means the journey was made with another currency than the project's. Change the amounts after adding.

## What is in it

| Journey | Category | Made for |
|---|---|---|
| Send to beneficiary | Payments | Meezan |
| Pay a bill | Payments | Meezan |
| Add money | Accounts | BankWorkx |
| Connect account | Accounts | BankWorkx |
| Add card | Cards | BankWorkx |
| Create budget | Budgeting | BankWorkx |
| Invest | Investing | BankWorkx |

The catalog holds each journey exactly as shipped (`packages/journey-schema/src/catalog.ts`). Editing a journey in Studio never changes the catalog, and adding a journey twice is refused.

## What adding does

The copy gets the slug `<catalog id>-<project id>` (for example `add-money-meezan`), belongs only to that project, starts at version 0 as a draft, and has no link back to the catalog. It is not updated when the catalog changes.

## Add a journey to the catalog

1. Write the journey (in Studio, or with `/finx-journey`) and put it in `packages/journey-schema/src/fixtures/`.
2. Add an entry to `catalog` in `packages/journey-schema/src/catalog.ts`: category, a one-line summary, what it shows off, and who it was made for.
3. `pnpm test`: a test checks that every entry passes lint and has a unique id.

## For AI

`finx_list_catalog` and `finx_add_from_catalog` let Claude look for a close match before building from scratch. Adding only ever makes a draft; a person publishes.

## API

- `GET /api/catalog?project=<id>`: the entries, and `added` (the slug of the project's copy) for each.
- `POST /api/catalog/<id>/add` with `{ "project": "<id>", "publish": false }`: `201` with the new slug, `409` if the project already has it.
