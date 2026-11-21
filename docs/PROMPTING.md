# Writing a brief for Claude

Studio never calls an AI itself. You run a `claude` command in Claude Code from this folder, and the skill named at the
start decides what kind of work you get. Pick the skill first, then write the brief for that kind of work.

| You want | Start with | What comes back |
|---|---|---|
| A banking flow a customer walks through (screens, checks, outcomes) | `/finx-journey` | A draft journey in Studio, linted and run in the sandbox, for you to review and publish |
| The same, with tests that prove numbered acceptance criteria | `/finx-generate` | A plan first (it waits for your yes), then the draft, scenarios and a mutation check |
| A check of a journey before publishing | `/finx-review` | A report with findings by severity. Nothing is changed |
| A change to the apps or Studio themselves: a page, a block, a look, a bug | `/finx-code` | A branch with tests and a pull request |

The most common mistake is asking `/finx-journey` for a design or a page. A journey is data drawn by the bank app in the
project's own look, so it has no code, no components, no animations and no layout of its own. A brief that talks about
colours, glass panels, globes, React or a build is a `/finx-code` brief.

## A journey brief (`/finx-journey`, `/finx-generate`)

Say, in plain sentences:

1. **Which project.** "For test bank". Without it the journey goes to the project selected in Studio's sidebar, or to Meezan.
2. **What the customer does, in order.** The screens or steps: what they enter, choose and confirm.
3. **The rules.** Limits, who may do it, what needs a one-time code, what is checked with the bank.
4. **What happens when it fails.** Wrong password, no balance, already paid, bank unavailable. Otherwise the simplest failure screens are chosen for you.
5. **Languages and currency**, only when they differ from the project's defaults.
6. **What to prove.** Which runs you want in the sandbox (the happy path, a blocked input, a failure, the other language).

```bash
claude '/finx-journey For test bank: a Sign in journey. Username and password, then the dashboard on success. Show attempts left after a wrong password and lock the profile after five wrong tries. Separate screens for a locked profile, an expired password and a profile not yet activated. English and Arabic. Run the happy path, a wrong password, the lockout and the whole flow in Arabic.'
```

```bash
claude '/finx-journey For test bank: pay a utility bill. Pick the company, enter the reference, look the bill up, review it, tick consent, confirm with a one-time code. If the bill is already paid or the account has no balance, say so and move no money.'
```

For `/finx-generate`, add numbered criteria so each one gets a scenario:

```bash
claude '/finx-generate For Meezan: supplier payment with maker-checker. AC-1 only an initiator can start one. AC-2 above 500,000 PKR two approvers are needed. AC-3 after the 3 pm cut-off the value date is the next business day. AC-4 three wrong one-time codes lock the payment.'
```

Leave out: the look, the layout, library names, and "publish". Claude only writes drafts; you publish from the Builder.

## A review brief (`/finx-review`)

Name the journey by its slug and say what to look at. The slug is in the Builder's address.

```bash
claude '/finx-review pay-a-bill focus on the failure screens and the Urdu'
```

## A code brief (`/finx-code`)

Say where, what, for whom, and what must stay the same:

1. **Where.** The app or package: `apps/bank-web`, `apps/studio`, `packages/renderer-web`.
2. **What it should look like and do.** Here the look belongs: layout, motion, states, wording.
3. **Scope.** One project or all of them. "For the test bank project only; other banks keep their current login."
4. **What not to change.** The sign-in flow, sandbox customers, no hardcoded credentials, no new dependencies.
5. **The checks.** Accessibility, both languages and right-to-left, phone and tablet, `pnpm typecheck` and `pnpm test`, a pull request.

```bash
claude '/finx-code In apps/bank-web, redesign the /test-bank/login page as a dark split screen for the test bank project only. Left: an animated wire globe on a canvas with soft parallax, the headline "The Future Starts Here.", test bank colours from its theme. Right: a glass panel with username, password with show/hide, remember me, forgot password, and a Sign in button with loading, success and error states. Keep the existing sign-in flow and sandbox customers, no hardcoded credentials, no new dependencies, respect prefers-reduced-motion. English and Arabic with right-to-left. Add page tests, run pnpm typecheck and pnpm test, open a pull request.'
```

Leave out: instructions to inspect the stack or choose libraries (the skill already knows the repo), and anything that
would publish, touch production, add an AI backend or an API key.

## Where to watch

Journey and review runs appear on Studio's **Agents** page; a code run ends as a pull request on GitHub. The Agents page
and the Builder's **Ask Claude** button write the command for you from a brief, so you can type it there and copy it.
