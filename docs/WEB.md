# Web banking app (Next.js)

`apps/bank-web` is a dedicated web version of the bank apps: real web layouts (a side menu, wide dashboards, addresses for every page), and every journey drawn with real form elements. It has the same features as the Expo app, for every project in Studio.

## Run it

```bash
cd apps/studio && pnpm dev          # Studio, port 3100
pnpm web:dev                         # the web app, http://127.0.0.1:3200
```

Open `http://127.0.0.1:3200/` and choose a bank, or go straight to `/meezan/login` or `/bankworkx/login`. Production: `pnpm web:build`, then `pnpm --filter @finx/bank-web start`.

| Variable | Default | Meaning |
|---|---|---|
| `FINX_STUDIO_URL` | `http://127.0.0.1:3100` | Where the server finds Studio (never sent to the browser) |
| `FINX_WEB_DEFAULT_PROJECT` | the first project | Which bank the root address leads to |
| `FINX_WEB_PROJECTS_TTL_MS` | `30000` | How long the list of projects from Studio is remembered |

## Pages

| Bank look | Pages |
|---|---|
| Classic (Meezan) | `/<project>/login`, `/home` (balance, daily limit, services, English and Urdu), `/j/<journey>` |
| Money management (BankWorkx) | `/dashboard`, `/accounts`, `/budgets`, `/budgets/<id>`, `/wallet`, `/invest`, `/invest/<symbol>`, `/j/<journey>` |

A bank with a real sign-in (the BankWorkx shell) signs in through the sign-in journey on a plain page, or, when the bank chose *Stage* on Studio's Design page (Colours tab, "Sign-in page"; stored as `look.signIn` in `brands.json`), framed by a dark stage (`components/login/`, `app/signin.css`): a wire globe drawn on a canvas in the bank's accent and the bank's words on one side, the journey in a glass panel on the other. The journeys it hands over to (forgot password, forgot username, unlock) open in the same panel. The scene is hidden from assistive technology, draws one still frame under *reduce motion*, stops while the tab is hidden, and is left out on phones. BankWorkx has these journeys bundled; another project with the *Fintech* look gets them once they are added to it in Studio (Catalog, *Sign in* and the journeys it hands over to), and until then its sign-in page says so and offers the sandbox customer picker.

On wide screens the BankWorkx pages sit in a side menu and two columns; on narrow ones the menu becomes a bottom bar. Quick actions, notifications, the account menu and paying a subscription are dialogs. Buy and Sell open the journey with the stock already chosen (`/j/invest?symbol=LMRB`), and finishing returns to the dashboard.

## Which banks it serves

Every project in Studio, without a rebuild. The server asks Studio for its projects (`GET /api/projects`, remembered for 30 seconds), takes only plain fields from the answer and works the theme out again itself, then serves `/<project>/...` with that bank's colours. If Studio cannot be reached it serves the banks bundled with the design system. A project with the *Fintech* look gets the BankWorkx pages; any other look gets the classic pages. Add a project in Studio and open `/<its-id>/login`.

## Sharing with the phone apps

Only the drawing is written twice. Everything else is shared, and tests keep it that way (`packages/bank-client/src/boundary.test.ts`):

| Shared (no react-native, no browser) | Drawn separately |
|---|---|
| `@finx/bank-client`: the app store (signed in or not, language, catalog from Studio, journey loading, payments, notices) and the view-models for every screen (totals, filters, budgets, portfolio, notifications…) | Expo screens (`apps/bank-app`) and Next pages (`apps/bank-web`) |
| `@finx/renderer-core`: the journey engine, `JourneyController`, and the block view-models (amount chips, card fields and autofill hints, one-time code cells, pickers) | `renderer-native` (React Native) and `renderer-web` (DOM) |
| `@finx/ui-kit`: tokens, the banks, chart geometry and icon drawings | SVG charts and icons in each renderer |

A new block type must be added to both renderers: each is typed against the schema, so a missing one fails typecheck, and a test compares the lists.

## Journeys on the web

`@finx/renderer-web` draws each block with real elements: labelled fields; error messages that are announced and tied to their field; radio groups for choices and accounts; a numeric keypad for amounts (a text input, not `type=number`); `autocomplete` hints on the card form (`cc-number`, `cc-name`, `cc-exp`, `cc-csc`) and a single real input for the one-time code so a code from an SMS can be filled in; a step list; Enter continues; focus moves to the screen title on each step and to the first mistake after a failed check; the card number keeps the caret where it was while spaces are added; Urdu reads right to left with logical CSS only.

## Security

- **Content Security Policy** with a one-time nonce per request (`proxy.ts`, `lib/security.ts`): scripts run only with the nonce, nothing loads from other sites, no framing, no plugins, no `<base>`. Strict in production (zero console errors checked); development relaxes `eval` and inline styles for hot reload only.
- Also: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS over https.
- **The browser never talks to Studio.** It asks this app (`/api/studio/...`), which only passes on reading the list of journeys and one published journey. The Studio address comes from the environment, never from a request, and journeys are checked (schema and lint) again in the browser before they run.
- Project ids are checked against a strict pattern and a list of reserved names; a project's colours are re-derived from validated fields, so nothing from Studio can put styles or scripts on a page.
- The session (which customer, which language) is kept in `sessionStorage`; the sandbox bank lives in memory, so a reload starts it fresh.

## Installable app

Each bank has a web app manifest (`/<project>/manifest.webmanifest`), an icon drawn from its colour and initial (`/api/icon/<project>`), and a small service worker (`public/sw.js`) that shows an offline page and stores only the app's own built files. It never stores pages, Studio's answers or anything about a customer.

## Checks

`pnpm typecheck` and `pnpm test` cover: the block components and every shipped journey screen in English and Urdu with axe (accessibility rules, except colour contrast which needs real layout); the player (focus, errors, Enter, RTL); every BankWorkx and Meezan page with axe; the Studio window, the theme and manifest routes, the security headers and the project list. CI also builds the app. Not covered: colour contrast in the browser, a keyboard-only pass by a person, Lighthouse, and browsers other than Chrome.

## Not there yet

Real sign-in and passkeys (none exist in the apps yet), a "change Studio server" setting (the server decides), PNG icons for older phones, deploy tooling, and the browser's Back button stepping through journey screens (it leaves the journey).
