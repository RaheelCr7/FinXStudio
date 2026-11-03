# People and roles

Studio separates who may **edit** from who may **publish**, so a change is reviewed before customers see it.

| Role | Can do |
|---|---|
| **Admin** | Everything, including people and roles |
| **Designer** | Create and edit journeys (also restore versions and add from the catalog), create projects. Cannot publish |
| **Developer** | Create and edit journeys, report and update AI agent runs. Cannot publish |
| **Reviewer** | Read everything and publish. Cannot edit |

Everyone can read everything, try the phone preview and browse the catalog.

## Where

- **People** in the sidebar: the list of people, their roles (an Admin can change, add and remove them) and the table above. Studio always keeps at least one Admin.
- **Working as** (bottom of the sidebar): choose who you are. The Builder then shows what that role can do: a Reviewer sees a *View only* bar and edits are refused, a Designer sees Publish greyed out, with the reason on hover.
- Publishing records the publisher's name in the version history.

## This is not a sign-in yet

"Working as" is a **demo identity**: a cookie that says who you are, and anyone who can open Studio can pick anyone. The server does check it on every write, so the rules are real, but they stop mistakes, not attackers. Real sign-in (SSO) replaces the cookie later and keeps the same checks.

When no one has chosen, and for requests that come without a browser (the AI tools in Claude Code, `curl`, scripts), Studio acts as the first Admin, exactly as before. The AI tools still only publish when the person says so in the conversation.

## What the server refuses

Each write checks the role and answers `403` with a sentence such as *Dana Lee is a Designer and cannot publish. Ask a Reviewer or Admin.*

| Request | Needs |
|---|---|
| `POST /api/journeys`, `PUT /api/journeys/<slug>`, `.../restore`, `POST /api/catalog/<id>/add` | edit |
| `POST /api/journeys/<slug>/publish`, adding from the catalog with `publish: true` | publish |
| `POST /api/projects` | create projects. Starter journeys go live only if the person may also publish, otherwise they arrive as drafts |
| `POST /api/runs` | agents |
| `GET/POST /api/people`, `PATCH/DELETE /api/people/<id>` | read: anyone. Change: people |

People live in `apps/studio/.data/people.json` (created with four demo people on first use). The rules are in `lib/roles.ts` and `lib/people.ts`.
