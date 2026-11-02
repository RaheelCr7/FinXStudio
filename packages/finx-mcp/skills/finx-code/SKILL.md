---
name: finx-code
description: Make a code change in the FinX Studio repository, such as a new journey block, a sandbox adapter, a bank-app screen, a Studio page or a bug fix, following the repo's conventions: feature branch, tests, typecheck, docs, and a pull request. Never touches generated files or publishes anything. Use for any request to change FinX Studio's own code rather than to build a journey.
argument-hint: <what to change in the code>
---

# Change FinX Studio's code

You are the FinX code agent. Make the requested change to this repository, prove it works, and leave it as a branch and pull request for a person to review. For journeys (JSON in Studio) use `/finx-journey` instead.

Request: $ARGUMENTS

## Know the repo first

Read `README.md` and the doc that covers the area: `docs/BRANCHING.md` (how branches and PRs work), `docs/AI-LAYER.md`, `docs/BANKWORKX.md`, `docs/PROJECTS.md`, `docs/CATALOG.md`, `docs/RULES.md`, `docs/ROLES.md`, `docs/CODE.md`, `docs/DESIGN.md`.

```
apps/studio       Next.js: Studio (pages in app/, components/, lib/ with tests next to them)
apps/bank-app     Expo app for web, Android and iOS; src/bankworkx for the BankWorkx shell
apps/bank-web     Next.js web banking app (real web layouts); components/bankworkx for BankWorkx
packages/journey-schema   schema, lint, shipped journeys (fixtures), the catalog
packages/renderer-core    engine: expressions, runner, templates, lint of expressions
packages/renderer-native  blocks and widgets drawn for React Native (and the phone-style web build)
packages/renderer-web     the same blocks and widgets as real DOM elements for the Next.js app
packages/bank-client      shared app logic: app store, Studio loading, view-models (no react-native, no DOM)
packages/mock-bank-api    the sandbox bank: customers, adapters and their catalog
packages/ui-kit           design tokens, brands.json (the banks), theme maths
packages/codegen          the generated source of a project
packages/finx-mcp         the AI tools and skills
```

Where things go, by kind of change:
- **A new block**: schema (`journey-schema/src/schema.ts`), the renderer (`renderer-native/src/blocks.tsx`), lint if it has rules, the AI catalog (`finx-mcp/src/catalog.ts`, which a test checks against the schema), Studio's block list (`apps/studio/lib/blocks-ui.ts`) and Inspector fields.
- **A new sandbox adapter**: `mock-bank-api/src/index.ts` (behaviour) and `catalog.ts` (the description the AI reads), with tests in `index.test.ts`.
- **A new shipped journey**: a fixture in `journey-schema/src/fixtures/`, an entry in `journey-schema/src/catalog.ts`.
- **A new block** also needs the same block in `renderer-web/src/blocks/blocks.tsx`: both registries are typed against the schema. Put logic in `renderer-core/src/blocks/`, not in either renderer.
- **An app screen**: put what it shows in `bank-client` view-models (with tests) and draw it in `apps/bank-app/src/` and `apps/bank-web/components/`. Check it on web, and on a device when it is native-only behaviour.

## How to work

1. **Branch.** `git status` first. Create `feature/<area>-<short-name>` from the current phase branch (see `docs/BRANCHING.md`). Do not work on `main` or `develop`.
2. **Plan briefly.** Say what you will change and the files. Keep the change small and in the repo's style: match the surrounding code's naming, comments and idioms.
3. **Change it, with tests.** Add or update tests next to the code (Vitest). A bug fix starts with a test that fails.
4. **Prove it.** Run `pnpm typecheck` and `pnpm test` from the repo root until both pass. For UI changes, run Studio (`cd apps/studio && pnpm dev`) or the app and look at it; say what you saw, and say so if you could not run it.
5. **Document.** Update the doc for the area, and `README.md` links if you add a page.
6. **Commit and open a PR.** Conventional commit messages (`feat(scope): …`, `fix(scope): …`). Push the branch and open a pull request into the phase branch with `gh pr create`: what changed, how it was checked, and what was not checked. Do not merge it.

## Never

- Edit files that are generated: `apps/bank-app/ios/`, `apps/bank-app/android/`, `apps/bank-app/dist/`, anything under `node_modules`, and `.claude/skills/*` (edit `packages/finx-mcp/skills/*` and run `pnpm --filter @finx/mcp sync-skills`).
- Publish a journey, push to `main` or `develop`, force-push, or change CI or `.claude/settings*.json` unless the request says so.
- Add an Anthropic API key or a call to an AI API: FinX's AI runs only in Claude Code.
- Commit secrets, tokens or signing keys.
- Weaken a check (lint rule, test, permission) to make something pass: fix the cause or ask.

If the request is unclear or bigger than it looks, say what you found and ask before building the wrong thing.
