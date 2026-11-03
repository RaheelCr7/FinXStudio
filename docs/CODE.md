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

## Project folder, VS Code and Git

When Studio is open on the computer it runs on (localhost), the Code tab has a **Project folder** panel:

- **Save to folder** writes the files to `~/FinX Projects/<project id>` (change the place with `FINX_WORKSPACES_DIR`). The tags apply: generated files are rewritten when they changed; extendable and custom files are created once and then left alone, so a developer's edits survive every later save.
- **Open in VS Code** opens that folder with a `vscode://` link.
- **Commit** starts a Git repository in the folder if there is none (branch `main`) and commits what changed, using your own Git name and email when set. Nothing is committed when nothing changed.
- **Connect remote** sets `origin` to an https or ssh address. Studio **never pushes**: it shows the `git push` command to run in a terminal with your own Git login, so no token ever passes through Studio.

Saving and committing need a role that can edit (Admin, Designer or Developer). The folder actions are refused for any address other than localhost. A project id is checked and every file path is kept inside the project folder.

## What it is not

It is the project's configuration, journeys and theme. The app shell, the journey renderer and the native iOS and Android projects come from the FinX platform repository and its build scripts (`pnpm ios:sim`, `pnpm android:apk`); the README in the export says how the two fit together. There is no editing here, no two-way sync with a Git repository, and no "what changed since the last export" view yet.

## API

- `GET /api/projects/<id>/code`: every file with path, tag, note and content.
- `GET /api/projects/<id>/zip`: the zip.
- `GET /api/projects/<id>/workspace`: the folder's place and Git state. `POST` with `{ action: "export" }`, `{ action: "commit", message }` or `{ action: "remote", url }`.

The generator is `packages/codegen` (`generateProject`, `zip`). The Studio address written into the export is `FINX_STUDIO_URL`, or the address you opened Studio on.
