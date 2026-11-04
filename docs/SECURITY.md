# Security programme

FinX is built so a bank can run an independent test and find it uneventful. We do not claim to "pass all security checks"; we keep a documented, repeatable evidence trail. This file is the threat model, the controls roadmap and how to report a problem.

Two profiles (see `docs/adr/0005-two-profiles.md`): **demo** keeps today's behaviour; **production** turns the controls below on. A control is done only when a test proves it in production mode.

## Reporting
Do not open a public issue for a vulnerability. Email the maintainer (see the repository owner's profile) with steps to reproduce. Expect an acknowledgement within a few working days.

## Assets and trust boundaries
| Asset | Where | Boundary |
|---|---|---|
| Journeys (what the app shows and does) | Studio store, delivered to apps | Studio to app; app treats a journey as untrusted input |
| Customer data and money movement | Bank API via adapters | App/adapter to bank; mock bank never in production |
| Studio (authoring, publish, roles) | `apps/studio` | Browser to Studio API |
| Bank credentials, signing keys | environment secret store | Never in repo, journeys or mappings |
| AI layer | Claude Code + MCP in the user's session | MCP to Studio API; web and bank content is data |

## Threat model (STRIDE)
| | Threat | Today | Control (status) |
|---|---|---|---|
| S | Someone acts as another Studio user | "Working as" switcher in demo | Done in production: password sign-in, signed 8-hour sessions, lockout |
| S | A fake server serves journeys to the app | Plain http in demo | TLS only, certificate pinning (planned) |
| T | A journey is altered in transit or at rest | Schema validation and lint on load | Signed journeys; unsigned accepted in demo only (planned) |
| T | A bad request body corrupts Studio data | Per-route checks, schema validation | Done in production: 2 MB body limit, rate limit, origin-checked writes |
| R | A change cannot be traced to a person | Activity log exists | Done in production: hash-chained audit log; four-eyes publish by default |
| I | Personal data or secrets reach logs, repo or AI | CODING.md rules, `.gitignore` | Secret scan in CI (report-only now), log review |
| I | Sandbox bank code ships to production | Separate package | Excluded from production bundles, checked in build (planned) |
| D | Oversized input exhausts memory (parse, zod) | zod bumped to a patched 4.x | Request size limits, rate limits (planned) |
| E | A role does more than allowed | Roles and authorisation in schema and engine; bank re-checks | Server-side role checks on Studio routes; agents' service token can never publish; four-eyes at the bank |
| E | Prompt injection through AI-read content | Skills treat content as data; agents only draft | Humans publish; no AI key or production access |

## Requirements checklist
Mapped as the product matures; status is honest, not aspirational.
- **OWASP ASVS (Studio, web app):** authentication and session (planned), access control (partial), input validation (schema and per-route), error handling and logging (partial), configuration and headers (planned: report-only CSP first), dependency hygiene (CI report now).
- **OWASP MASVS L2 (mobile):** secure storage, network (TLS, pinning), platform (root/jailbreak, screenshot blocking), resilience; all planned for the production profile.
- **PCI DSS v4.0.1:** apply only where card data is touched; none is stored today.
- **Regulator:** set per bank (for example SBP for Pakistan). Open decision: the first bank's regulator baseline.

## CI gates
Reports run in `.github/workflows/security.yml` and do not block merges yet: dependency audit, secret scan, CodeQL. When the first findings are cleared they become required. Dependabot opens update PRs weekly. Still to add: licence check, CycloneDX SBOM, SHA-pinned actions.

Current findings (3 Nov 2026): the production dependency audit flagged zod 3.23.8 (high, memory exhaustion on oversized collections; fixed by moving `journey-schema` to zod 4.6.7), and two moderate `glob`/`minimatch` advisories that come in through Expo's build tooling (not shipped in the app bundle); tracked until Expo updates.

## Controls roadmap (in order)
1. **Done (production profile): Studio sign-in, sessions, CSRF defence, rate and size limits, security headers (CSP report-only), hash-chained audit log, four-eyes publish by default.** See "Studio in production" below. Still to add: a People-page form for passwords, TOTP second factor, SSO, a shared rate-limit store when Studio runs on more than one server.
2. Mobile: secure storage, certificate pinning, root/jailbreak detection, screenshot blocking, TLS only.
3. Signed journeys: a tampered screen is refused; demo accepts unsigned; bundled fallback stays.
4. `mock-bank-api` excluded from production bundles.
5. Done: `.gitignore` covers `.env*`, `*.pem`, `.data/`.

## Studio in production
Set `FINX_PROFILE=production` and the following. Demo behaviour is untouched when it is not set.

| Variable | Purpose |
|---|---|
| `FINX_SESSION_SECRET` | 32+ random characters; signs session cookies. Studio refuses to sign in without it. |
| `FINX_BOOTSTRAP_ADMIN_PASSWORD` | Used once, when nobody has a password yet, as the first Admin's password (12+ characters). Change it at once with `PUT /api/people/<id>/password`, then remove the variable. |
| `FINX_STUDIO_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to write (production does not trust localhost). |
| `FINX_SERVICE_TOKEN` | 32+ characters; the FinX MCP server sends its `FINX_STUDIO_TOKEN` (same value) as `Authorization: Bearer`. |
| `FINX_SERVICE_PERSON` | The person id agents act as. Pick someone without the publish permission; agents can never publish regardless. |
| `FINX_DATA_DIR` | Where Studio keeps its data (people, credentials, audit log). Back it up; protect it. |

What it does: pages redirect to `/login`; the API answers 401 without a session or service token, except sign-in and what the apps need (published journeys, the project list); the demo identity cookie is ignored; browser writes must carry an allowed `Origin` and the session cookie is `HttpOnly; Secure; SameSite=Strict`; five failed sign-ins lock that person and address for 15 minutes; every response carries security headers; the activity log is also written to `audit.log`, a hash chain whose integrity `GET /api/audit` verifies (admins only); a project nobody has configured requires someone else to publish a change.

Limits worth knowing: the rate limit and lockout live in one server's memory; the audit log proves tampering after the fact but a person with write access to the data directory can still delete the whole file, so ship it to write-once storage; CSP stays report-only until its reports are clean.
