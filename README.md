# FinX Studio

A digital banking platform: ready-made banking journeys, a visual journey builder, and white-label web, Android and iOS apps generated from the same configuration. AI assistance runs through Claude Code (no separate API).

Full plan: [docs/PROJECT-PLAN.md](docs/PROJECT-PLAN.md) · Branching: [docs/BRANCHING.md](docs/BRANCHING.md) · Demo: [docs/DEMO.md](docs/DEMO.md) · AI layer: [docs/AI-LAYER.md](docs/AI-LAYER.md)

Studio features: [Projects](docs/PROJECTS.md) · [Catalog](docs/CATALOG.md) · [Rules](docs/RULES.md) · [People and roles](docs/ROLES.md) · [Code tab](docs/CODE.md) · Second bank app: [BankWorkx](docs/BANKWORKX.md) · Devices: [iOS](docs/IOS.md), [Android](docs/ANDROID.md)

## Repo layout (as it grows)
```
apps/studio       Next.js: journeys and builder, projects, catalog, rules, people and roles, code tab, agents
apps/bank-app     Expo universal app (iOS, Android, web)
packages/         journey-schema, renderer-core, renderer-native, mock-bank-api, ui-kit, codegen, finx-mcp (AI tools)
docs/             plan, branching, specs
```

## Build journeys with Claude Code
Open this folder in Claude Code and run `/finx-journey <what the journey should do>`. It drafts the journey in Studio, lints it, tests it in the sandbox and leaves it for you to review and publish. No API key: it runs on your Claude subscription. See [docs/AI-LAYER.md](docs/AI-LAYER.md).

## Develop
```bash
corepack enable pnpm
pnpm install
pnpm test
```
