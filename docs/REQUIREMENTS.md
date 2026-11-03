# Requirements

The front door of the generator (plan, Stage 1). A requirement is captured, refined and **approved** before anything is generated from it. This page covers the core: the record, its rules, and the API. The Studio pages and the FinX tools for Claude Code come next.

## The record
`packages/journey-schema/src/requirement.ts`. Stored in `.data/requirements.json` (next to the journeys).

| Part | What it holds |
|---|---|
| `title`, `intent` | What the bank wants and why |
| `actors` (A-1 …) | Who is involved: initiator, approver, releaser |
| `steps` (S-1 …) | What happens, in order |
| `rules` (R-1 …) | Limits, cut-off times, whitelists, approval thresholds (`kind`) |
| `fields` (F-1 …), `operations` (O-1 …) | The data, and what the bank's system must do |
| `compliance`, `failures` (X-1 …) | Compliance needs; what can go wrong |
| `criteria` (AC-1 …) | What must be true. Each gets `tests` filled in by the generator |
| `questions` (Q-1 …) | Gaps asked about, and the answers |
| `status`, `version`, `approvedBy/At` | draft, questions or approved; counts up when an approved requirement changes |

New list items only need their words: the ids (A-1, S-2, AC-3 …) are given on save.

## The rules
- **Not ready to approve** until it has an intent of at least a sentence, an actor, a step, an acceptance criterion, and no open question. `readiness()` says what is missing, in words.
- **Questions:** anyone who may edit (or Claude Code) asks about a gap; the requirement waits (`questions`). Answering the last open question puts it back to `draft`.
- **Approval** needs the *publish* permission (the Reviewer and Admin roles). The approver and time are recorded.
- **Changing an approved requirement** (content, not just saving the same words) takes it back to `draft`, clears the approval and counts the version up, so a journey built from the old version can see it is out of date. Asking a question does the same.
- **Nothing is generated from an unapproved requirement:** `assertApproved()` throws with the reason; the generator calls it first.
- `uncovered()` lists the criteria with no test yet (the coverage view and the generator's gate use it).

## API (Studio)
| | |
|---|---|
| `GET /api/requirements?project=<id>` | list, newest change first, each with `blockers` |
| `POST /api/requirements` | create a draft (`title`, `intent`, optional parts and `projectId`) |
| `GET / PATCH / DELETE /api/requirements/<id>` | read, edit, delete a draft (an approved one cannot be deleted) |
| `POST /api/requirements/<id>/questions` | ask `{ text }` |
| `PATCH /api/requirements/<id>/questions` | answer `{ questionId, answer }` |
| `POST /api/requirements/<id>/approve` | approve (publish permission) |

Every change is written to the activity log.

## Next
Studio pages (list, editor, questions, approval, coverage view), the FinX MCP tools (`finx_get_requirement`, `finx_save_requirement`, `finx_ask_requirement`) and the `/finx-requirements` skill, then the generator that reads an approved requirement and carries each criterion id into journeys, rules and tests.
