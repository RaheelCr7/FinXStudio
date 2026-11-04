# Contributing

1. Branch from `develop`: `feat/<area>-<name>` or `fix/<name>` (see `docs/BRANCHING.md`). One PR per step.
2. Install and run: `pnpm install`, then `pnpm typecheck && pnpm test`. Studio: `cd apps/studio && pnpm dev` (port 3100).
3. Read `ARCHITECTURE.md` and `CODING.md` first. A new block, action or component also needs its spec, native twin, tests and doc.
4. Add specific paths when committing (`git add <paths>`), not `git add -A`, so unrelated files never ride along.
5. Commits use conventional prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
6. Open a PR into `develop` and fill in the template. CI (typecheck, test, web build) must be green.
7. Never publish a journey from a script or an agent. Publishing is a person's decision in Studio.

Security issues: do not open a public issue; follow `docs/SECURITY.md` (reporting).
