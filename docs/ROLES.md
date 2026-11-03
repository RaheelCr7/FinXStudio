# People and roles

Studio separates who may **edit** from who may **publish**, so a change is reviewed before customers see it.

| Role | Can do |
|---|---|
| **Admin** | Everything, including people and roles |
| **Designer** | Create and edit journeys (also restore versions and add from the catalog), create projects. Cannot publish |
| **Developer** | Create and edit journeys, report and update AI agent runs. Cannot publish |
| **Reviewer** | Read everything and publish. Cannot edit |

Everyone can read everything, try the preview and browse the catalog.

## Beyond the four roles

The **People and roles** page has four tabs.

- **People:** each person has a **main role** and, optionally, a **different role in a project**. A person can be a Designer in BankWorkx and a Reviewer in Meezan. A project role replaces the main role in that project only. Creating projects and managing people always follow the main role. A journey shared by two projects can be acted on if the person's role in either project allows it.
- **Roles:** your own roles, made by ticking what they can do (edit journeys, publish, create projects, AI agents, manage people). The four built-in roles are fixed. A role someone still holds cannot be deleted, and a change that would leave nobody able to manage people is refused.
- **Approval rules:** per project, who may publish *a change they made themselves*: **Only Admins** (the default, which is how Studio already behaved), **Never** (a second person always publishes, Admins included), or **Anyone who can publish**. A journey that nobody has changed since it was published is never held back, and neither is a change of unknown authorship (for example made by the AI tools, which act as the first Admin).
- **Activity:** a log of who published, restored, created or edited journeys (one entry per person, journey and ten minutes for edits), changed roles, access or approval rules, created or restyled projects. Filter by person, project and kind. The log only grows (the newest 2000 entries are kept), and a failing log never stops the work it describes.

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
| `POST /api/projects`, `PATCH /api/projects/<id>` (brand colour) | create projects. Starter journeys go live only if the person may also publish, otherwise they arrive as drafts |
| `POST /api/runs` | agents |
| `GET/POST /api/people`, `PATCH/DELETE /api/people/<id>` | read: anyone. Change: people |

| `GET/POST /api/roles`, `PATCH/DELETE /api/roles/<id>` | read: anyone. Change: people |
| `PATCH /api/projects/<id>/policy` | people |
| `GET /api/activity?person=&project=&kind=&before=&limit=` | anyone |

People live in `apps/studio/.data/people.json` (created with four demo people on first use); your own roles in `roles.json`, approval rules in `policies.json` and the log in `activity.json`, beside it. The rules are in `lib/roles.ts` (what a role allows, in one project or all, and the approval rule), `lib/people.ts`, `lib/access.ts` (roles and approval rules) and `lib/activity.ts`.
