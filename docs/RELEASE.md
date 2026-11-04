# Release checklist

A release is a documented evidence trail, not a promise that nothing can go wrong. Every box needs a link or a note.

## Code
- [ ] `pnpm typecheck` and `pnpm test` green on the release commit; web build green
- [ ] Demo flows work on web, iOS Simulator and Android (Send to beneficiary, Invest buy)
- [ ] Production profile tests green (once the production switch exists)
- [ ] `mock-bank-api` absent from production bundles: `node scripts/audit-bundle.mjs <build folder> --strict` passes for web and phone builds, and the build does not set `*_ALLOW_SANDBOX`

## Security
- [ ] Dependency audit, secret scan and CodeQL: no open high findings, or each one accepted in writing
- [ ] SBOM generated and stored with the release
- [ ] `docs/SECURITY.md` threat model reviewed; checklist status updated
- [ ] MASVS L2 self-assessment completed for the mobile app
- [ ] Independent penetration test done; findings fixed or accepted
- [ ] Journeys signed with the production key; unsigned journey refused (tested)

## Quality
- [ ] Accessibility report per bank (contrast, tap size, labels, font scaling) attached
- [ ] Performance budget met on a mid-range Android device
- [ ] Compliance panel report saved for each published journey

## Operations
- [ ] Rollback plan written and tried (previous journey versions, previous app build)
- [ ] Secrets in the environment store; none in repo, journeys or mappings
- [ ] Release tagged; changelog written
