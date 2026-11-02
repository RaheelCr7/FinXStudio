# Projects: one platform, many bank apps

A **project** is one bank app: its own name, look, app id, currency, journeys and sandbox customers. The journey engine, Studio and the block library are shared; only what makes a bank different is per project.

Today there are two: **Meezan Digital** (classic look, PKR) and **BankWorkx** (fintech look, USD).

## In Studio

- **Sidebar, top:** the current project. Click it to switch. The Journeys page then shows that project's journeys (*Show every project* lifts the filter).
- **Projects** (sidebar, or ⌘K → *Projects*): every project, how many journeys are live, its app id, and the commands to build its app.
- **New project:** a four-step wizard.
  1. **Basics:** a name, the app id (suggested, for example `com.acmebank.app`; it cannot change once the app is in a store), and the currency.
  2. **Look:** *Classic* or *Fintech*, and a brand colour. A phone mock shows the result as you choose. A colour too light for white text is refused, and dark mode gets a lighter version of it automatically.
  3. **Starting journeys:** copies of working journeys from another bank with the same look, published straight away (or left as drafts). The originals are not changed.
  4. **Review and create.** You get the build commands.
- **New journey** asks which project it is for, and starts as the current one. **Settings → Shown in** changes it later.
- The **phone preview** uses the journey's project: its look, currency and sandbox customers.

## What creating a project really does

It adds an entry to `packages/ui-kit/src/brands.json`, the one file the design system, Studio and the build scripts all read. So a project made in Studio is a real, buildable app straight away:

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
