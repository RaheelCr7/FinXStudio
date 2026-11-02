# FinX Studio — Full Project Plan

## 1. Context and goal

FinX Studio is a new product (empty folder, no code yet). It is a **complete digital banking platform** built and operated with Claude Code:

- A **library of ready-made banking journeys** (onboarding/eKYC, transfers, bills, cards, loans, disputes, and more), each finished with screens, rules, failure paths, languages and tests.
- A **visual journey builder** where product teams customise journeys or create new ones, and developers extend them with code.
- **White-label end applications**: one codebase that ships as an **Android APK/AAB**, an **iOS IPA**, and a **React web app**, with a proper banking UI, branded per bank.
- **AI inside Studio** (Copilot and agents) that runs through **Claude Code under your existing subscription**, with no separate API account.
- **Generated, readable source code** so a bank's developers can take over any part, visible in Studio and in their own IDE.

Intended outcome: a bank picks a preset and journeys, brands the app, publishes, and gets installable apps and a web deployment; later it connects its real core (Temenos Fabric/Infinity first on the roadmap).

## 2. Decisions taken (with you)

| Topic | Decision |
|---|---|
| Core idea | Visual journey builder with a ready-made catalog |
| Users | Business/product teams and developers (role-based) |
| Delivery to apps | Server-driven UI: journeys are JSON, rendered by a shared renderer; changes go live without app releases |
| Backend for v1 | Built-in mock bank sandbox with personas; real cores via adapters later |
| End apps | Studio also produces the final apps: APK, IPA and web, white-label with a proper UI |
| AI runtime | Claude Code (subscription) + FinX MCP server + FinX skills. No Anthropic API key, no per-token bill |
| Code | Studio generates a real monorepo; developers edit it; Studio shows it in a Code tab |
| Design | Upload image/PDF/Figma; Studio re-skins the app and maps screens to journeys; journey logic untouched |
| Scope for build | **Lean scope** (section 10) with a **minimal demo first** (section 9); full roadmap after |
| Integrations | Adapter contract from day one; Temenos Fabric adapter when a sandbox exists |
| Prototype | Clickable 17-screen prototype published: https://claude.ai/artifact/LgiVaNmdFEDDTPgbHsf8tJ |

## 3. Product overview

### 3.1 Studio (web app for the bank's team)
- **Projects home**: a project = one bank app (web + Android + iOS). New-project wizard: name/bundle id/languages/currency/country rules → start from preset, blank, clone or import → pick journeys → look (default theme, uploaded design, existing theme) → backend (sandbox or adapters) → where code lives (zip, new repo, existing repo).
- **Catalog**: ready-made journeys with channel badges, verification status, languages; app presets (Retail bank, Digital wallet, Islamic bank, SME banking); enable/disable per project; customise creates a project copy linked to the catalog version for later upgrades.
- **Builder**: flow canvas (screens as nodes, conditional edges), screen composer (drag blocks, property panel: bindings, validation, visibility, branch rules, labels per language), rule builder with autocomplete, journey lint, live preview on web and phone frames with sandbox personas and a state inspector.
- **Copilot panel and Agents tab**: brief in → run in Claude Code → diff back → validate → apply. Agents tab is the task board, live log, review and approval inbox (section 6).
- **App configurator**: branding (name, bundle id, logo, icon, splash, colours, fonts, radius), navigation and journey placement per tab, home dashboard widgets, security policy (biometrics, passkeys, root detection, screenshot block, session timeout), languages, feature flags per channel. Saved as AppConfig JSON.
- **Design tab**: upload image/PDF/Figma/tokens → tokens and layout patterns extracted → new theme + re-layout → before/after preview → apply as a theme version. Screens in the upload can be mapped to journey steps so the app follows the design screen by screen.
- **Code tab**: generated repo browser (and editor in v2), generation diff, Git status, open-in-IDE links, CLI instructions.
- **Build tab**: pick app config version, journey set, environment, version → build → downloadable APK/AAB, IPA, web URL; install QR codes; build history; signing keys stay in CI secrets.
- **Versioning and governance**: draft → review → published; environments dev/UAT/prod; rollback; audit log; roles Admin, Designer, Developer, Reviewer.

### 3.2 End applications (white-label bank apps)
- **One universal codebase** (Expo / React Native with web output) shipping to iOS, Android and web; Next.js is used for Studio. A dedicated Next.js bank web app is on the roadmap if a bank needs it.
- **Shell screens** (native, not journeys): splash, onboarding, login (password, biometrics, PIN, passkeys on web), home dashboard, accounts and history with statements, cards (view, freeze, PIN, limits), transfers and payments hub, notifications, profile and settings (languages incl. RTL, security, devices), help and support.
- **Journeys** plug into the shell via menus, quick actions and deep links; updated over the air from Studio.
- **Mobile specifics**: secure storage, biometrics, camera for eKYC, push notifications, deep links, root/jailbreak detection, screenshot blocking on sensitive screens, certificate pinning, EAS Build profiles (development, preview APK, production AAB/IPA), EAS Update for shell OTA.
- **Web specifics**: responsive, PWA installable, passkeys, CSP and security headers, accessibility ≥ 90.

### 3.3 Journey model (the core contract)
- **Journey**: id, slug, name, version, status, channels, locale (default, supported, RTL), theme, entryScreen, dataModel, integrations, screens, analytics, compliance.
- **Screen**: id, title (per language), kind (screen / branch / terminal), onEnter actions, blocks, navigation (default + rules).
- **Blocks** (about 25 in v1): text, image, text/number/phone/email/IBAN/amount inputs, OTP, date, select, checkbox/consent, document upload, ID capture, selfie/liveness, account picker, beneficiary picker, review summary, button, stepper, alert, signature, terms, result, transaction list, custom (developer-registered).
- **Actions**: navigate (to screen, to journey with return), callApi (integration id + input + saveAs + onError), setData, validate, showToast, share, exit.
- **Rules**: safe expression language for visibility, enable, branching and validation (e.g. `amount > limits.daily - limits.usedToday`).
- **Bindings**: `{{customer.firstName}}`-style into a per-journey state tree with formatters (`| money`).
- **Lint**: all screens reachable, all inputs bound, consent before submit, OTP before money moves, terminal screens present, translations complete.
- Every publish is an immutable version; renderers request `/journeys/{slug}?channel=&env=`.

### 3.4 Ready-made journey catalog (63 total; 20 at launch, rest on demand)
Modelled on leading digital banks (Revolut, Monzo, Chase, Nubank, HBL, Meezan, SadaPay, JazzCash).
- **Onboarding and access (8)**: open account (eKYC), register existing customer, login, forgot password, device binding, set up biometrics, change PIN/password, account recovery.
- **Accounts (7)**: overview, history and filters, e-statement, open additional account, nickname/settings, close account, spending insights.
- **Transfers and payments (12)**: own-account, local to beneficiary, add/manage beneficiaries, international (SWIFT, FX), pay a bill, mobile top-up, QR pay, request money, scheduled/recurring, split a bill, pay to mobile number (RAAST), transfer limits.
- **Cards (8)**: activate, view details, freeze/unfreeze, set/change PIN, limits and controls, report lost/stolen, virtual card, supplementary card.
- **Lending (6)**: personal loan, credit card application, auto/home financing, repayment/settlement, installments (BNPL), credit limit increase.
- **Savings and investments (5)**: savings goals, term deposit, mutual funds, gold/FX wallet, Islamic profit statements.
- **Services and self-care (8)**: cheque book, stop cheque, ATM/branch locator, update profile, tax certificate/balance letter, notification preferences, consent and privacy, refer a friend/rewards.
- **Support and disputes (5)**: dispute a transaction, complaint, chat and callback, chargeback status, fraud report and emergency block.
- **Compliance and periodic (4)**: KYC refresh, T&C re-acceptance, sanctions/PEP self-declaration, dormant reactivation.
- **Launch 20**: open account, login/biometrics, forgot password, device binding, account overview, transaction history, e-statement, own-account transfer, local transfer, add beneficiary, international transfer, pay a bill, mobile top-up, QR pay, transfer limits, activate card, freeze card, card limits/controls, report lost card, personal loan, dispute. Remaining 43 are added per bank project, about a day each, mostly via the journey skill.

### 3.5 Ways to create a journey
From the catalog (enable or customise) · from scratch in the Builder (blank or pattern template) · from a prompt with the journey skill · from an uploaded design (screens mapped to steps) · import JSON · developer-written (TypeScript DSL compiled to the same JSON).

## 3.6 UI quality bar: next-level design for FinX Studio and the bank apps

A named design system, **FinX Design System (FDS)**, shared by Studio and the generated apps, built as the first deliverable of the UI kit and treated as a product in itself. The bar is "best-in-class fintech" (Revolut, Monzo, Linear, Stripe-level polish), not "admin template".

**Design language**
- Typography: a distinctive display face for numbers and headings (tabular figures for money), a clean sans for body; a type scale and rhythm, never default system look. Arabic/Urdu faces matched in weight and rhythm.
- Colour: deep, calm palette with one brand accent per bank, semantic colours for money in/out, states and risk; full **dark mode** on Studio and apps; AA contrast everywhere.
- Surfaces: layered elevation, soft shadows, 12–20 px radii, subtle borders; glass/blur only where it aids hierarchy.
- Iconography: one consistent stroke icon set, custom banking icons (cards, RAAST, QR, eKYC) drawn in the same style.
- Motion: purposeful micro-interactions (balance count-up, card flip, success check draw, list reorders, canvas node snapping), 150–300 ms curves, reduced-motion respected; skeleton loading, never spinners; haptics on mobile at key moments (OTP success, card freeze).
- Data display: money formatted with tabular figures and locale; spending rings and bars with the same visual grammar; empty states illustrated and helpful.

**Studio feel**
- Fast and keyboard-first: command palette (Cmd+K) for everything, shortcuts on the canvas, inline editing, instant preview updates, optimistic saves.
- Canvas: smooth pan/zoom, snapping, auto-layout, minimap, branch edges styled by type (rule, error), hover cards with screen thumbnails; drag-to-connect; multi-select.
- Live preview: device frames (iPhone, Android, desktop) with real dimensions, dark/light toggle, locale toggle (EN/UR RTL), persona switcher, state inspector, step-through debugger; presentation mode for demos.
- Delight details: onboarding tour, contextual tips, celebratory publish moment, version timeline with visual diffs.
- Accessibility: full keyboard navigation, focus states, screen-reader labels, colour-blind safe palettes.

**App feel**
- Native-grade navigation (stack and tab transitions, gestures), 60 fps lists, pull-to-refresh, bottom sheets for actions, biometric prompts styled to the brand, animated cards and balances, receipts that look designed, themed system bars and splash, app icon and store screenshots generated from the theme.
- Per-bank theming covers all of the above through tokens; design import maps a bank's suite onto FDS.

**Process to reach the bar**
- Design tokens and components reviewed against reference apps before any screen is built; a visual QA pass (spacing, type, states, motion) is part of definition of done for every screen; `/finx-review` includes a visual checklist; a dedicated polish pass closes each phase.
- The current prototype is re-skinned to FDS as its first application, so the demo already shows the bar.

## 4. Architecture and tech stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo, TypeScript everywhere |
| Studio | Next.js 15 (App Router), Tailwind, shadcn/ui, React Flow (`@xyflow/react`) for the canvas, `@dnd-kit` for the composer, Monaco for the Code tab |
| Schema | Zod (+ JSON Schema export): journey, app config, theme |
| Persistence | Prisma + SQLite (dev) → Postgres; models: Workspace, Project, Environment, Journey, Version, Theme, AppConfig, Repo, User, AuditLog, AgentRun |
| Renderer | `renderer-core` (state, expressions, actions, validation) + `renderer-native` (React Native components, web via react-native-web) |
| End app | Expo (React Native) universal app, expo-router, EAS Build/Update |
| UI kit | Design tokens + components shared by Studio previews and the app |
| Bank SDK | Typed adapter contract (accounts, transfers, beneficiaries, KYC, OTP, cards, loans, identity); mock sandbox is the first adapter |
| Codegen | `packages/codegen` generates the project monorepo from templates; files tagged generated / extendable / custom |
| AI | `packages/finx-mcp` (MCP server, local + remote with Studio login) and FinX skills for Claude Code |
| CI/Build | GitHub Actions + EAS: APK/AAB, IPA, web deploy; Studio Build tab reads artifacts |
| Auth | NextAuth (credentials in dev; SSO later); roles per project |

Repo layout:
```
apps/studio            Next.js: builder, catalog, configurator, code/build tabs, API, mock sandbox
apps/bank-app          Expo universal app (iOS, Android, web): white-label shell + renderer
packages/journey-schema, app-config-schema, blocks, renderer-core, renderer-native,
         ui-kit, bank-sdk, mock-bank-api, codegen, finx-mcp, finx-skills, cli
docs/                  journey spec, block authoring, app build and release, skills guide
```

## 5. Generated code and developer handoff
- Each project generates a monorepo (app, journeys as JSON + types, theme, app config, adapters, tests, CI, README). Shell screens are plain React Native components developers can edit.
- File tagging: **generated** (rewritten on regenerate), **extendable** (generated once, then owned by developers), **custom** (never touched). Regeneration rewrites only generated files and opens a PR for the rest.
- Git integration: project ↔ repo, branch per environment, each publish = commit (+ PR when extendable files change); Studio pulls the repo so developer additions (custom blocks, screens) show in Studio.
- Eject: vendor renderer and UI kit into the repo; the app runs without Studio; journeys bundled or OTA, per project.
- CLI `finx`: pull, push, journey create, block create, preview, build android|ios|web. TypeScript DSL `defineJourney({...})` ↔ JSON.

## 6. AI layer: Copilot and agents on your subscription
- **No API account.** AI runs in **Claude Code** (desktop, terminal or cloud sessions) under a Claude subscription: yours now; each Studio user's own seat later (bring-your-own-subscription). Studio works fully without AI.
- **FinX MCP server** exposes Studio to Claude Code: read/write journeys, lint, sandbox run, catalog, app config, theme tokens, preview, versions, test and CI results, post run reports.
- **FinX skills are the agents** (each with guardrails: branch only, never publish to production, PR with tests):
  - `/finx-journey`: build or change a journey from a brief until lint and sandbox pass.
  - `/finx-code`: shell screens, custom blocks, adapters, tests → PR with CI green.
  - `/finx-review`: UX, accessibility, compliance (consent, PCI handling), security, translation gaps.
  - Later: `/finx-test` (Playwright/Maestro, bug repro), `/finx-design` (tokens and re-layout from uploads), `/finx-integrate` (adapter from an API spec, e.g. Temenos Fabric docs), `/finx-release` (versions, changelog, pipeline, store checklist).
- **Studio Agents tab**: brief → "Open in Claude Code" deep link or command → live progress and result via MCP → diff/PR/tests/screenshots → approve or return. Audit log per run. Scheduled runs use Claude Code routines.
- **Limits**: subscription usage windows can pause heavy runs; runs need a logged-in Claude Code session; no unattended server-side agents. Switching to API/Bedrock billing later is an opt-in that reuses the same MCP tools (out of scope now).

## 7. Design import
Inputs: Figma file/link, images, PDFs, brand guideline, tokens file. Output: tokens (colours, type, spacing, radii, shadows, icons) and layout patterns → theme + UI-kit variant + block and shell re-layout → before/after on web and phone → theme version. Screen mapping to journey steps (v2). Journey logic never changes. Multiple themes per project, chosen per build.

## 8. Integrations roadmap (Temenos first)
- **Adapter contract** in `bank-sdk`; journeys call integration ids, never vendor APIs; adapters configured per environment; contract tests run every adapter against the same journey suite as the sandbox.
- **Temenos Fabric**: Identity Service (OAuth2 sessions), Object/Integration Services (accounts, transfers, beneficiaries, cards). **Temenos Infinity** coexistence: embed FinX journeys in an Infinity app, run FinX apps on Fabric, or migrate journey by journey with an import tool. **Transact (T24)** via Fabric or Temenos APIs.
- Also behind the contract: Finacle, Mambu, Thought Machine, FLEXCUBE, in-house; KYC vendors; OTP/SMS gateways; RAAST/1LINK rails.
- Studio Integrations page: register adapters, test connection, map ids, view call logs. Fabric adapter needs a Temenos sandbox from your side.

## 9. Minimal demo first: one polished journey + create a new journey live (8–10 working days)
**What the bank sees (15 min):**
1. **Local transfer to beneficiary** finished to hand-built quality on web (React) and phone (Android preview APK, iOS simulator), English + Urdu RTL, with the daily-limit branch, consent, OTP, success and failed paths. Shown beside a hand-built React screen: no quality gap, because renderer blocks are hand-crafted React components on the UI kit.
2. **Studio**: open it in the Builder, change a label and a rule, preview on both frames, publish to UAT, and the running phone app picks it up without reinstall.
3. **Create a new journey live**: (a) from scratch in the Builder ("Pay a bill", four screens, one rule, publish); (b) with `/finx-journey` from Claude Code through the MCP server ("mobile top-up with carrier selection and OTP") → appears in Studio, passes lint, runs in sandbox, publishes. Both run immediately on web and phone.

**Day by day:** D1–2 monorepo, schema, engine, sandbox with 3 personas, the 12 blocks needed, FDS tokens and core components (typography, colour, dark mode, motion primitives) · D3–4 Local transfer polished on web and mobile, preview APK · D5–7 Studio demo build (list, Builder, preview, publish, OTA pickup), FinX MCP server + `/finx-journey`, new-journey-from-scratch path, bill/top-up blocks · D8 polish, demo script, dry run (+1–2 days buffer or a Next.js web shell if the bank insists on Next.js).
**Effort:** 8–10 working days, about 50–60 build hours, about an hour a day of your review.

## 10. Lean build (chosen scope) and timeline
Cuts versus the full vision: one universal codebase (not two apps) · 20 journeys at launch (not 63) · 3 skills (not 7) · governance extras, Code-tab two-way sync and design screen-mapping deferred · English + Urdu first.

| Phase | Scope | Effort |
|---|---|---|
| L1 Minimal demo | Section 9 | 2 wk |
| L2 Studio core | Projects + wizard, catalog, full Builder, rules, preview, versions/publish, roles, codegen v1 + Code tab (read-only), journeys up to 20 | 5–6 wk |
| L3 AI layer | MCP server complete, `/finx-code`, `/finx-review`, Copilot panel, Agents tab, design tokens import | 2 wk |
| L4 Production apps | Full shell, security hardening, push, Urdu RTL, EAS builds (APK/AAB/IPA) + web deploy, Build tab | 4–5 wk |
| L5 Pilot readiness | Integrations page + adapter contract, end-to-end tests on 3 channels, performance and accessibility pass, docs, store checklists | 1–2 wk |

**Total: 14–17 working weeks (3.5–4 months), roughly 400–480 build hours.** A "week" = 5 working days ≈ 25–30 hours of Claude Code sessions (8–12 sessions, often 2–3 in parallel by area, landing PRs) plus 1–2 hours/day of your review. Parallel sessions shorten calendar time, not total effort. Subscription usage windows and review speed are the two things that stretch a week.

**Milestones:** day 10 bank demo · week 7 Studio usable with generated code in a repo · week 9 AI layer live · week 14 APK/IPA/web from the Build tab · week 16 pilot-ready.

**Extended roadmap (after lean):** remaining 43 journeys · Next.js bank web app if needed · test/design/integration/release skills · analytics, A/B, comments, i18n editor · design screen mapping · Code tab two-way sync, CLI and DSL · Temenos Fabric adapter · Arabic. Full-scope estimate for reference: 30–38 weeks.

## 11. Ways of working
- **Tracks and sessions**: demo track (L1) first; Studio-core track in parallel from day 1; later apps track and journeys track. Each track is a Claude Code session on its own branch, merged by PR. The same FinX skills are used on our own repo before banks use them.
- **Your role**: daily 1–2 hour review; decisions on branding and journey priorities; weekly checkpoint demo; accounts when needed.
- **Definition of done** for a journey: schema valid, lint pass, happy path + at least one failure path running in the sandbox on web and mobile, EN + UR strings, Playwright/Maestro test, reviewed.

## 12. Prerequisites you provide
- Expo account (free) for EAS builds; Apple Developer account ($99/yr) for IPA signing/TestFlight; Google Play Console ($25) for store publishing. Debug/preview APKs need none of these.
- A GitHub (or GitLab) organisation for repos and CI.
- Later: Temenos Fabric sandbox; bank branding assets; any design suite (image/PDF/Figma) you want followed, ideally before day 1 so the demo is in that look.

## 13. Risks and mitigations
- **Journey depth**: real journeys take longer than drafts → definition of done, 20 at launch, journey skill for the rest.
- **Subscription limits**: heavy agent days can pause → parallel sessions across time, batch heavy runs, scheduled routines overnight.
- **Store/signing delays**: Apple approval takes days → start account setup in week 1; demo on preview APK and simulator.
- **Generic look**: generated shells look neutral → design import early; your design suite before day 1.
- **Core integration unknowns**: adapter contract and contract tests; Fabric work starts only with a sandbox.
- **Security/compliance**: no secrets in journeys or clones, PCI-safe fields, consent with timestamps and terms version, audit log on publish and agent runs.

## 14. Verification
- Unit: schema, expression evaluator, action runner, block validators (Vitest).
- Renderer: Storybook + Testing Library per block; JSON → UI snapshots.
- Studio: Playwright: create project, edit journey, preview, publish; MCP server tool tests; skill dry runs on fixture journeys.
- App: Maestro flows on iOS Simulator and Android emulator; preview APK on a physical Android; web via Playwright; Lighthouse accessibility ≥ 90.
- Catalog: each launch journey has an automated sandbox run (happy + failure) on web and mobile, gated in CI; Studio catalog shows pass status per channel.
- Build: Build tab triggers CI and APK, IPA and web URL appear in history.
- Manual: walk the demo script in the built-in browser and the iOS Simulator before each checkpoint.

## 15. Where implementation starts
Day 1 of the minimal demo: monorepo, journey schema, renderer engine, mock sandbox, UI kit basics, and the Expo universal app skeleton; Local transfer is the first journey. The Studio-core session starts the same day on the projects model and Builder scaffolding.
