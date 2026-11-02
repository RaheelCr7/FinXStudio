# Code tab

**Studio → Code** shows the source of the selected project as a folder of files, and **Download source** gives it as a zip to hand to a developer or commit to Git. It is read only: change things in Studio, then export again.

## What is in it

```
README.md               how to use it
finx.project.json       the project's identity and look (name, bundle id, accent, currency…)
.env.example            the Studio address and the project id
theme/tokens.json       the light and dark colours worked out from the accent
journeys/<slug>.json    one file per journey: the live version, or the draft when never published
src/journeys.ts         loads the journeys with their types
src/custom/             yours: Studio never touches it
.finx/manifest.json     every file, its tag and a checksum, and the journey versions
```

A journey that has been published is exported as its live version, not as unpublished edits. A never-published journey is exported as its draft and marked *draft, not published*.

## Who owns each file

| Tag | Meaning |
|---|---|
| Generated | Studio rewrites it on every export. Change it in Studio |
| Extendable | Created once, then yours. A later export must not overwrite it |
| Custom | Yours from the start |

The same input always gives the same files (and the same zip), so a re-export only shows real changes in Git.

## What it is not

It is the project's configuration, journeys and theme. The app shell, the journey renderer and the native iOS and Android projects come from the FinX platform repository and its build scripts (`pnpm ios:sim`, `pnpm android:apk`); the README in the export says how the two fit together. There is no editing here, no two-way sync with a Git repository, and no "what changed since the last export" view yet.

## API

- `GET /api/projects/<id>/code`: every file with path, tag, note and content.
- `GET /api/projects/<id>/zip`: the zip.

The generator is `packages/codegen` (`generateProject`, `zip`). The Studio address written into the export is `FINX_STUDIO_URL`, or the address you opened Studio on.
