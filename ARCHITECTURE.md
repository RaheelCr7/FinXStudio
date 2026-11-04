# Architecture

FinX Studio turns a plain description of a banking journey into a validated, tested journey that runs in a bank's mobile and web apps. A journey is data (JSON), not code, so one journey runs unchanged on every channel and against any bank API that has an adapter.

## The pieces

| Layer | Packages and apps | Rule |
|---|---|---|
| Contract | `journey-schema` | The JSON schema, lint rules, fixtures. No UI, no network. Everything else depends on it. |
| Look | `ui-kit`, `components` | Tokens (data) and presentational components (props in, events out). No journey or bank knowledge. |
| Engine | `renderer-core` | Runs a journey: screens, validation, actions, rules, authorisation. Pure TypeScript, no React. |
| Renderers | `renderer-web`, `renderer-native` | Draw what the engine says, using `components`. No business rules. |
| Bank side | `mock-bank-api` | The sandbox bank (reference bank, Bank B, corporate, CAB) behind a typed provider interface. Never shipped to production. |
| Glue | `bank-client`, `codegen` | App-side client with the bank API setting; code export. |
| AI | `finx-mcp` | MCP tools and the generator proof (scenarios, mutation check, compliance report). Talks to Studio only through its API. |
| Apps | `apps/studio` (Next, port 3100), `apps/bank-web` (Next, 3200), `apps/bank-app` (Expo) | Product surfaces. |

Dependencies point downwards only: apps, then renderers, then engine, then schema. `components` and `ui-kit` never import the engine or the sandbox. `finx-mcp` never imports Studio.

## How a journey runs

1. Studio stores a journey as a draft; a person publishes a version (the AI never publishes).
2. An app asks for the published journey for its project, channel and language.
3. `renderer-core` builds the view model of the current screen. The renderer draws it.
4. User input goes back to the engine, which validates, evaluates rules, checks authorisation and calls integrations by id (for example `corp.payments.initiate`).
5. The integration id resolves to an adapter for the project's bank API (`bankApi` setting). The journey never sees the bank's field names; a mapping file translates them, including error codes.

## Two profiles

- **demo** (today's behaviour): the sandbox bank, a "Working as" switcher, plain http to a laptop Studio.
- **production**: hardening on (see `docs/SECURITY.md`). Every control ships off in demo and on in production behind one switch, so the demo never changes.

## Where to read more

`docs/AI-LAYER.md` (AI, MCP, skills), `docs/CORPORATE.md` (corporate sandbox and generator), `docs/PROJECTS.md` (projects and bank API), `docs/WEB.md`, `docs/COMPONENTS.md`, `docs/ROLES.md`, `docs/RULES.md`, and the decisions in `docs/adr/`.
