# AI layer: Claude Code, the FinX MCP server and the FinX skills

FinX Studio has no AI backend and needs no Anthropic API key. AI runs in **your Claude Code session, on your own Claude subscription**. FinX gives Claude Code these things:

| Piece | Where | What it does |
|---|---|---|
| FinX MCP server | `packages/finx-mcp` | Tools to read, create, change, lint, test and report on journeys in Studio |
| `/finx-journey` skill | `.claude/skills/finx-journey` | The workflow: brief in, reviewed and tested draft out |
| `/finx-review` skill | `.claude/skills/finx-review` | Reviews a journey (money safety, clarity, accessibility, security, translations, sandbox runs) and reports findings. Read only |
| `/finx-generate` skill | `.claude/skills/finx-generate` | Builds a journey from a brief and acceptance criteria with the tests that prove it: plan first (waits for a yes), draft, scenarios that cover numbered criteria, run, mutation check. Never publishes |
| `/finx-code` skill | `.claude/skills/finx-code` | Changes this repository's code on a feature branch with tests, docs and a pull request |
| Agents board | Studio, `/agents` | Shows each AI run, its progress and result, and links to the draft for review |
| Ask Claude | Studio, in the Builder | Writes the exact Claude Code command for this journey (change it or review it); the Agents page does the same for any task |

## Quick start

```bash
pnpm install
cd apps/studio && pnpm dev            # Studio on http://localhost:3100
```

Open this folder in Claude Code. The first time, approve the project's `finx` MCP server when asked. Then:

```
/finx-journey Create a mobile top-up journey with carrier selection, an amount between 50 and 5,000, and OTP confirmation
```

Watch it at `http://localhost:3100/agents`. When the run is *Needs your review*, open the draft in the builder, check it, and press **Publish to UAT**. Publishing from Studio completes the run.

You can also start from Studio: the Agents page and the Builder's **Ask Claude** button turn your request into the exact `claude` command to run, for a journey change, a review, or a code change. Studio never calls an AI service itself.

```
/finx-review pay-a-bill focus on the failure screens
/finx-code Add a block that shows a download button
```

**Checkpoints.** Once a session has reported a run, every draft it writes is tagged with the run (an `X-Finx-Run` header the FinX server adds). Studio keeps each journey as it was before the run's first write, and the run's page on the Agents board shows what it changed with an **Undo this run** button: a journey the run changed gets its old draft back, a journey the run created is removed. A journey a person edited after the run is left alone unless you confirm *Undo anyway*, and a journey the run created that has since been published stays (restore an older version instead). Published versions are never touched by an undo.

A review run appears on the Agents board as *Review agent*, done, with the report as its summary. A code run ends as a pull request. Design colours do not need Claude: see [DESIGN.md](DESIGN.md).

## The tools

| Tool | Changes things? | Purpose |
|---|---|---|
| `finx_get_catalog` | no | The authoring reference: blocks, actions, expressions, data, Urdu rules, integrations, personas, lint rules, patterns |
| `finx_get_example` | no | A shipped, lint-clean journey to copy structure from |
| `finx_list_journeys`, `finx_get_journey` | no | Read what is in Studio, with lint issues |
| `finx_list_catalog` | read only | The ready-made journeys a project can add, and which it already has |
| `finx_add_from_catalog` | writes a draft | Copies a catalog journey into a project as a draft (never published) |
| `finx_list_projects` | read only | The bank apps (projects) in Studio, to choose which one a journey is for |
| `finx_create_journey` | draft only | New draft with a valid skeleton, in a project when one is named |
| `finx_save_draft` | draft only | Validates (every schema error with its path), saves, returns lint issues, advice and misspelled-field warnings |
| `finx_patch_journey` | draft only | Small edits with JSON Patch, all or nothing |
| `finx_lint_journey` | no | Checks a journey without saving |
| `finx_simulate_journey` | no | Runs a scripted scenario through the real engine against the sandbox bank: every screen, failed checks, visited and unvisited screens, balance changes |
| `finx_publish_journey` | **publishes to UAT** | Only with `confirmedByUser: true`, only when the person asked, only if lint is clean |
| `finx_run_scenarios` | no | Runs the tests saved in a journey (`scenarios`), reports pass/fail and which acceptance criteria are proved, failing or uncovered; optionally against the second bank API |
| `finx_mutation_check` | no | Breaks the journey and the bank's rules on purpose, one thing at a time, and lists the mistakes the tests would let through |
| `finx_report_run` | Agents board | Progress notes and the final summary |

The server also offers the same instructions as an MCP prompt named `journey`, for clients that connect to the server without the skill.

## Safety model

- **Drafts only.** Agents never change what customers see. A person publishes, in Studio or by explicitly telling Claude to. Publishing always needs `confirmedByUser: true` and your approval in Claude Code, and is refused while lint issues exist.
- **Strong checks before a person sees it.** Schema, structure rules (reachable screens, consent and OTP before money moves, bindings, translations) and expression checks (syntax, data paths, formatters, sources, with did-you-mean hints). Studio refuses to publish with any issue.
- **Tested before handover.** The skill runs the happy path, a validation failure, a failure path and an Urdu run in the sandbox.
- **Read-only mode.** Start the server with `FINX_MCP_READONLY=1` and every tool that changes a journey refuses.
- **Studio's write API is not open to web pages.** Browser requests from origins other than localhost (or `FINX_STUDIO_ALLOWED_ORIGINS`) are refused, so a web page you visit cannot publish to your local Studio. Studio listens on localhost by default.
- **Content is data.** Tool descriptions and the skill tell the agent to treat journey text and Studio content as data, never as instructions.
- **Limits.** Journeys are limited to 30 screens and 200 KB. Journeys may only use sandbox integrations that exist.

## Permissions

Claude Code asks before using each tool. That is deliberate and the choice is yours. If you want fewer prompts, add rules like these to **your own** `.claude/settings.local.json` (not committed). Keep publishing on `ask`:

```json
{
  "permissions": {
    "allow": [
      "mcp__finx__finx_get_catalog", "mcp__finx__finx_get_example", "mcp__finx__finx_list_journeys",
      "mcp__finx__finx_get_journey", "mcp__finx__finx_create_journey", "mcp__finx__finx_save_draft",
      "mcp__finx__finx_patch_journey", "mcp__finx__finx_lint_journey", "mcp__finx__finx_simulate_journey",
      "mcp__finx__finx_report_run"
    ],
    "ask": ["mcp__finx__finx_publish_journey"]
  }
}
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `FINX_STUDIO_URL` | `http://localhost:3100` | Where Studio is |
| `FINX_MCP_READONLY` | off | `1` blocks every change to journeys |
| `FINX_STUDIO_TOKEN` | none | Sent as a bearer token. Reserved for when Studio gets sign-in |
| `FINX_STUDIO_ALLOWED_ORIGINS` | none | Extra browser origins allowed to call Studio's API |

The server is registered in `.mcp.json`. Other MCP clients can run `node_modules/.bin/tsx packages/finx-mcp/src/server.ts` over stdio.

## Verify it

```bash
pnpm --filter @finx/mcp test      # tools over the real MCP protocol, catalog vs schema, skill vs tools
pnpm --filter @finx/mcp smoke     # starts the real stdio server against a running Studio (read-only)
```

If you change the skill, edit `packages/finx-mcp/skills/finx-journey/SKILL.md` and run `pnpm --filter @finx/mcp sync-skills`. A test fails if the installed copy drifts.

## Verified end to end

Two real headless Claude Code runs (`claude -p "/finx-journey …"`, Claude Sonnet 5.5, only the FinX tools allowed, no publish) against a live Studio:

| Run | Brief | Result |
|---|---|---|
| Create | "Create a Quick recharge journey for prepaid mobile users: pick a carrier, enter a mobile number and an amount between PKR 50 and 5,000, pay from one of my accounts, confirm with an OTP" | 14 turns, 44 s. A 5-screen draft with no lint issues, no advice. Four simulations: happy path with inline validation checks, three wrong OTPs, customer `bilal`'s core failure, Urdu. It did not publish |
| Change | "If the amount is more than PKR 2,000, show a warning screen before the review, with a Back button" | 13 turns, 36 s. One patch (a rule and a branch screen), lint clean, five simulations including the exact PKR 2,000 boundary and a full Urdu run |

A person then reviewed the draft in Studio and published it. Publishing completed the run on the Agents board, the journey appeared in the app's Services, and it ran there: warning screen, review, consent, OTP, "Recharge complete". The CLI reported notional costs of about $0.39 and $0.29 per run; on a subscription these count against usage limits, not an invoice.

A third headless run checked `/finx-review pay-a-bill focus on the failure screens and Urdu` (read-only tools only). It reported "ready with notes" with twelve findings, among them a real bug (after three wrong codes, *Try again* returns with consent and the wrong code still filled in) and Urdu wording problems, and it ran five simulations, including the Urdu happy path and the core-failure customer. It changed nothing and marked its run done on the Agents board.

What the runs found, and what changed because of it:

- The agent wrote a custom *minimum amount* message that the engine ignored. The engine now honors it, and the catalog documents it.
- It tested Urdu only to the review screen. The skill now asks for the whole happy path in Urdu.
- Run reports failed with an unexplained 404 because the Studio dev server had a stale route table after dependencies were installed. The client now says which endpoint is missing and to restart Studio.
- The run timeline stayed empty when the agent sent no notes. Studio now records status changes itself.

## Limits today

- Runs need a logged-in Claude Code session. There are no unattended server-side agents.
- Heavy use is bounded by your subscription's usage limits.
- Only sandbox integrations exist (accounts, beneficiaries, limits, OTP, transfers, bills, top-up). Real core connectors, such as Temenos Fabric, come later behind the same contract.
- Some block options are declarative only for now: OTP `maxAttempts` and `resendAfterSeconds`, `navigation.default`, `share`, and `navigate.toJourney`. The catalog says which.

## Troubleshooting

- **The `finx` tools are missing:** approve the project MCP server in Claude Code, and run from the repo root (`.mcp.json` uses a path relative to it).
- **"Cannot reach FinX Studio":** start Studio (`cd apps/studio && pnpm dev`) or set `FINX_STUDIO_URL`.
- **HTTP 403 "Origin not allowed":** a browser page on another origin called the API. Add it to `FINX_STUDIO_ALLOWED_ORIGINS` if intended.
