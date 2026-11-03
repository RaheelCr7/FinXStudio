# Branching model

| Branch | Purpose | Merges into |
|---|---|---|
| `main` | Stable, demo-able, tagged releases only | - |
| `develop` | Integration of finished phases | `main` (release PR) |
| `phase/*` | One long-lived branch per delivery phase (see plan section 10) | `develop` (phase PR when the phase is done) |
| `feature/*` | One feature or package, branched from the active phase branch | the phase branch (PR, `--no-ff`) |
| `fix/*` | Bug fixes, branched from the branch they fix | same |

## Phases (from the lean plan)
| Branch | Phase | Scope |
|---|---|---|
| `phase/l1-mvp-demo` | L1 MVP / minimal demo | Schema, engine, sandbox, FDS tokens, Expo app, one polished journey, Studio demo build, create-journey-live |
| `phase/l2-studio-core` | L2 | Projects + wizard, catalog, full Builder, versions/publish, roles, codegen v1, journeys up to 20 |
| `phase/l3-ai-layer` | L3 | FinX MCP server, skills, Copilot panel, Agents tab, design tokens import |
| `phase/l4-production-apps` | L4 | Full shell, security hardening, push, RTL, EAS builds, Build tab |
| `phase/l5-pilot-readiness` | L5 | Integrations page, adapter contract, E2E on 3 channels, a11y/perf, docs |

## Conventions
- Feature names: `feature/<area>-<short-name>`, e.g. `feature/journey-schema`, `feature/studio-builder-canvas`.
- Conventional commits: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `chore: ...`, `test: ...`.
- A feature merges only with tests green. A phase merges to `develop` only when its definition of done holds.
- Tags: `v0.1.0-mvp` at the end of L1; `v0.2.0` L2; and so on.

## Checks
GitHub Actions (`.github/workflows/ci.yml`) runs `pnpm typecheck` and `pnpm test` on every push to `main`, `develop` and `phase/**`, and on pull requests into them. A phase merges to `develop` only with this green.
