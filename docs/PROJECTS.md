# Projects: one platform, many bank apps

A **project** is one bank app: its own name, look, app id, currency, journeys and sandbox customers. The journey engine, Studio and the block library are shared; only what makes a bank different is per project.

Today there are two: **Meezan Digital** (classic look, PKR) and **BankWorkx** (fintech look, USD).

## In Studio

- **Sidebar, top:** the current project. Click it to switch. The Journeys page then shows that project's journeys (*Show every project* lifts the filter).
- **Projects** (sidebar, or ⌘K → *Projects*): every project, how many journeys are live, its app id, and the commands to build its app.
- **New project:** a seven-step wizard with a live preview (light, dark, high contrast, left to right or right to left).
  1. **Basics:** a name and the app id (suggested, for example `com.acmebank.app`; it cannot change once the app is in a store).
  2. **Channels:** mobile and web. Tablet and watch are listed as coming later: they are saved with the project but nothing is built for them yet.
  3. **Country and languages:** pick a country and its draft profile fills the currency and usual languages (the profile names the regulator and links to it; it is a starting point to confirm with the bank, not compliance guidance). Choose any number of languages, the first being the default, or add your own with a code, name and direction.
  4. **Entities:** one entity by default. Turn on *group with more than one legal entity* to add entities, each with its own country, currency and languages.
  5. **Look:** a ready look (Classic, Fintech, Coloured bar, Islamic bank, Neobank, Corporate, High contrast), a brand colour, a *Roundness* slider and a *Density* slider, and an accessibility check (contrast of the button, link and text, and the smallest tap target) that says what to fix. A colour too light for white text is refused. After creation, Design has Personal and Business tabs with the same look step, to give each workspace its own look ([WORKSPACE-THEMES.md](WORKSPACE-THEMES.md)).
  6. **Starting journeys:** copies of working journeys from another bank with the same base look, published straight away (or left as drafts). The originals are not changed.
  7. **Review and create.** You get the build commands.
- **New journey** asks which project it is for, and starts as the current one. **Settings → Shown in** changes it later.
- The **phone preview** uses the journey's project: its look, currency and sandbox customers.

## What creating a project really does

It adds an entry to `packages/ui-kit/src/brands.json` (including its channels, languages, entities and the sizes the look sets; see [COMPONENTS.md](COMPONENTS.md)), the one file the design system, Studio and the build scripts all read. So a project made in Studio is a real, buildable app straight away:

```bash
pnpm ios:sim --brand acme-bank --install       # iPhone Simulator
pnpm android:apk --brand acme-bank --install   # Android
EXPO_PUBLIC_FINX_BRAND=acme-bank pnpm --filter @finx/bank-app web
```

The first build makes the app icons from the accent colour (needs Python with Pillow). The app opens with the project's name, colours and customers, and shows only the journeys that list the project.

## How a journey belongs to a project

A journey has an optional `apps` list holding project ids. A journey with none listed belongs to Meezan Digital, so everything from before projects existed keeps working. Journeys copied into a new project get a slug with the project appended (`add-money-acme-bank`), because slugs are unique across Studio for now.

## The AI tools

`finx_list_projects` lists the projects, and `finx_create_journey` takes an optional `project`. The `/finx-journey` skill asks which project when the brief does not say.

## Limits

- One brands file means a project belongs to this repository. Per-project repositories and separate Studio workspaces come later.
- A project is English-only unless its journeys add languages. Starting journeys keep the currency they were written in until edited.
- Roles, approval before publish and per-project environments are not built.
- Customer data for a new project uses the sandbox customers of its look. Real core banking comes later through adapters.

## Bank API

Each project chooses which bank API it runs against, on the **Bank API** page (needs the projects permission). Today there are two simulated APIs: the **Reference bank** (the default, stored as nothing) and **Bank B** (its own endpoints, field names and error codes, reached through a mapping file). The setting is `bankApi` in the project's entry in `packages/ui-kit/src/brands.json` and is read by Studio's phone preview and screenshots, the web banking app and the phone app, so a corporate customer's company sits behind that API there. The page's **Run their tests** button runs the tests of every journey in the project against the API you picked, without saving anything, to answer "would my journeys still work if I switched?". Connecting directly to a real bank's API, through Quantum Fabric, and Middleware X are shown as "coming later". Individual tests still name their own bank API when they need to (the proof page runs both).
