# FinX Studio

A digital banking platform: ready-made banking journeys, a visual journey builder, and white-label web, Android and iOS apps generated from the same configuration. AI assistance runs through Claude Code (no separate API).

Full plan: [docs/PROJECT-PLAN.md](docs/PROJECT-PLAN.md) · Branching: [docs/BRANCHING.md](docs/BRANCHING.md)

## Repo layout (as it grows)
```
apps/studio       Next.js: builder, catalog, configurator, code/build tabs
apps/bank-app     Expo universal app (iOS, Android, web)
packages/         journey-schema, renderer-core, mock-bank-api, ui-kit, bank-sdk, codegen, finx-mcp, ...
docs/             plan, branching, specs
```

## Develop
```bash
corepack enable pnpm
pnpm install
pnpm test
```
