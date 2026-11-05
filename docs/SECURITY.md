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
| T | A journey is altered in transit or at rest | Schema validation and lint on load | Done: Ed25519 signature made when a person publishes; apps with the bank's public key refuse anything else (demo accepts unsigned) |
| T | A bad request body corrupts Studio data | Per-route checks, schema validation | Done in production: 2 MB body limit, rate limit, origin-checked writes |
| R | A change cannot be traced to a person | Activity log exists | Done in production: hash-chained audit log; four-eyes publish by default |
| I | Personal data or secrets reach logs, repo or AI | CODING.md rules, `.gitignore` | Secret scan in CI (report-only now), log review |
| I | Sandbox bank code ships to production | Separate package | Production builds refuse to run on it unless a labelled demo says so (done); bundle audit reports it (done); removing the code from bundles needs `bank-sdk` (planned) |
| D | Oversized input exhausts memory (parse, zod) | zod bumped to a patched 4.x | Request size limits, rate limits (planned) |
| E | A role does more than allowed | Roles and authorisation in schema and engine; bank re-checks | Server-side role checks on Studio routes; agents' service token can never publish; four-eyes at the bank |
| E | Prompt injection through AI-read content | Skills treat content as data; agents only draft | Humans publish; no AI key or production access |

## Requirements checklist
Mapped as the product matures; status is honest, not aspirational.
- **OWASP ASVS (Studio, web app):** authentication and session (planned), access control (partial), input validation (schema and per-route), error handling and logging (partial), configuration and headers (planned: report-only CSP first), dependency hygiene (CI report now).
- **OWASP MASVS L2 (mobile):** storage (Keychain/Keystore wrapper, done), network (TLS only, done; certificate pinning not yet), platform (root/jailbreak check and screen-capture blocking, done), resilience (obfuscation, tamper detection: not yet). See "Mobile app in production".
- **PCI DSS v4.0.1:** apply only where card data is touched; none is stored today.
- **Regulator:** set per bank (for example SBP for Pakistan). Open decision: the first bank's regulator baseline.

## CI gates
Reports run in `.github/workflows/security.yml` and do not block merges yet: dependency audit, secret scan, CodeQL. When the first findings are cleared they become required. Dependabot opens update PRs weekly. Still to add: licence check, CycloneDX SBOM, SHA-pinned actions.

Current findings (3 Nov 2026): the production dependency audit flagged zod 3.23.8 (high, memory exhaustion on oversized collections; fixed by moving `journey-schema` to zod 4.6.7), and two moderate `glob`/`minimatch` advisories that come in through Expo's build tooling (not shipped in the app bundle); tracked until Expo updates.

## Controls roadmap (in order)
1. **Done (production profile): Studio sign-in, sessions, CSRF defence, rate and size limits, security headers (CSP report-only), hash-chained audit log, four-eyes publish by default.** See "Studio in production" below. Passwords are set on the People page (Manage access). Still to add: TOTP second factor, SSO, a shared rate-limit store when Studio runs on more than one server.
2. **Mobile: done except certificate pinning** (secure storage, root/jailbreak check, screenshot blocking, TLS only). See "Mobile app in production".
3. **Done: signed journeys.** See "Signed journeys" below.
4. **Partly done: the sandbox in production builds.** See "The sandbox bank in production builds" below. Excluding the code itself waits for `bank-sdk`.
5. Done: `.gitignore` covers `.env*`, `*.pem`, `.data/`.

## Studio in production
Set `FINX_PROFILE=production` and the following. Demo behaviour is untouched when it is not set.

| Variable | Purpose |
|---|---|
| `FINX_SESSION_SECRET` | 32+ random characters; signs session cookies. Studio refuses to sign in without it. |
| `FINX_BOOTSTRAP_ADMIN_PASSWORD` | Used once, when nobody has a password yet, as the first Admin's password (12+ characters). Change it at once on the People page (open your own card, Manage access, Your password), then remove the variable. |
| `FINX_STUDIO_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to write (production does not trust localhost). |
| `FINX_SERVICE_TOKEN` | 32+ characters; the FinX MCP server sends its `FINX_STUDIO_TOKEN` (same value) as `Authorization: Bearer`. |
| `FINX_SERVICE_PERSON` | The person id agents act as. Pick someone without the publish permission; agents can never publish regardless. |
| `FINX_DATA_DIR` | Where Studio keeps its data (people, credentials, audit log). Back it up; protect it. |

The sign-in page (`/login`, `apps/studio/components/signin/`) is the same screen in both profiles: in production it posts to `/api/auth/login`; in demo, which has no passwords, it says so on the page and only plays the states before opening the workspace. Nothing is sent in demo. "Remember me" keeps the person id on that device, never a password.

What it does: pages redirect to `/login`; the API answers 401 without a session or service token, except sign-in and what the apps need (published journeys, the project list); the demo identity cookie is ignored; browser writes must carry an allowed `Origin` and the session cookie is `HttpOnly; Secure; SameSite=Strict`; five failed sign-ins lock that person and address for 15 minutes; every response carries security headers; the activity log is also written to `audit.log`, a hash chain whose integrity `GET /api/audit` verifies (admins only); a project nobody has configured requires someone else to publish a change.

Limits worth knowing: the rate limit and lockout live in one server's memory; the audit log proves tampering after the fact but a person with write access to the data directory can still delete the whole file, so ship it to write-once storage; CSP stays report-only until its reports are clean.

## Signed journeys
A journey is signed with Ed25519 at the moment a person publishes it, and the signature is stored with the published copy. Studio serves it as a `signature` field (`alg`, `keyId`, `value`, `signedAt`). The signed bytes are `finx-journey-v1\n` plus the journey as canonical JSON (keys sorted, no `signature`), so changing a screen, a rule, an integration mode or the version breaks it, and a signature cannot be moved to another journey.

| Where | Setting | Notes |
|---|---|---|
| Studio | `FINX_SIGNING_KEY` | 64 hex characters, secret, server only. In the production profile Studio refuses to publish without it. |
| Web app | `NEXT_PUBLIC_FINX_TRUSTED_KEYS` | Public key(s), comma separated. Set at build time. |
| Phone apps | `EXPO_PUBLIC_FINX_TRUSTED_KEYS` | Same, set when building. |

Make a key pair with `node apps/studio/scripts/gen-signing-key.mjs`. The public key is not secret, but it must reach the apps by a path that does not go through Studio (the build), otherwise whoever controls Studio could also swap the key. `GET /api/signing` (admins) shows which key Studio is using, to compare with what the apps trust.

An app with at least one trusted key shows a journey from Studio only if its signature checks out; anything else (unsigned, wrong key, changed) is refused and the copy bundled in the app is used, so the app keeps working with older content. An app with no trusted keys (the demo) accepts unsigned journeys as before.

Rotating a key: add the new public key to the apps while the old one is still trusted, ship the apps, then switch `FINX_SIGNING_KEY` and republish, then drop the old key in a later app release. Limits: journeys published before signing was switched on stay unsigned until republished; a signature proves who published and that nothing changed since, not that the content is wise, so review and lint still matter; the bank's apps need updating if the key is ever compromised.

## Mobile app in production
Build with `FINX_ENV=production` (app configuration: https only, no server change, no cleartext) and `EXPO_PUBLIC_FINX_ENV=production` (what the app code reads; `scripts/build-*.mjs` set both). Demo and UAT builds are unchanged: the hardening code returns at once and never loads its native modules.

| Control | What it does | Limits |
|---|---|---|
| TLS only | The OS refuses plain http (iOS ATS, Android cleartext off), and at start the app refuses a built-in server address that is not https. | Does not pin a certificate. |
| Screen capture | Android: `FLAG_SECURE` (no screenshots or recording, blank app-switcher thumbnail). iOS: hides the app while the screen is recorded or mirrored. | iOS cannot stop the screenshot button; no app can. |
| Rooted or jailbroken device | `expo-device` signal. Default: the app refuses to start (`EXPO_PUBLIC_FINX_INTEGRITY=warn` shows a banner instead, `off` skips it). A check that cannot run (web, simulator) allows the app. | A hint, not proof: a determined attacker hides a root. Pair with server-side risk checks and, later, Play Integrity and App Attest. |
| Secret storage | `src/hardening/secure-storage.ts` puts secrets in the Keychain (when unlocked, this device only) or Keystore; never AsyncStorage. The web and a binary without the module keep them in memory only. | Nothing secret is stored today (sessions live in memory); this is the place for a future token or device binding. |
| Backups | Android `allowBackup` is already off. | |

Not done: **certificate pinning**. It needs a native module (for example `react-native-ssl-public-key-pinning`), two pins per host (current and backup) and a rotation process agreed with the bank's operations, so it is added with the first real bank. Also not done: code obfuscation, tamper detection of the app binary, Play Integrity and App Attest.

The new native modules (`expo-secure-store`, `expo-screen-capture`, `expo-device`) need a native rebuild (`pod install` and a new dev client) to be present; a binary built earlier still runs the demo because they are loaded lazily and only in production.

## The sandbox bank in production builds
Today the apps run on the in-memory sandbox bank, and its types and market data are used throughout the web and phone apps, so the code cannot yet be left out of a bundle. What is done instead:

- **A production build will not run customers on it.** `NEXT_PUBLIC_FINX_ENV=production` (web) or `EXPO_PUBLIC_FINX_ENV=production` (phone) turns the sandbox off: the web app shows "Not available yet", the phone app shows "Cannot start", and `MockBank` itself refuses to be created (`packages/mock-bank-api/src/policy.ts`). A labelled demo or pilot sets `NEXT_PUBLIC_FINX_ALLOW_SANDBOX=1` / `EXPO_PUBLIC_FINX_ALLOW_SANDBOX=1`. Demo, UAT, Studio and tests are unchanged.
- **A bundle audit.** `node scripts/audit-bundle.mjs <folder> [--strict]` searches a build for the sandbox's marker string. The security workflow runs it on a production-flavoured web build; it reports the sandbox as present until `bank-sdk` lands. A release of a bank on a real API must pass `--strict` (see `docs/RELEASE.md`).
- **Still to do (bank-sdk):** move the bank contract and types into `packages/bank-sdk`, keep the sandbox as one adapter in a separate entry point, and let a production build register only a real adapter. Then the strict audit passes.
