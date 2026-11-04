# 0003 Banks are reached through a typed adapter contract
**Status:** accepted

**Context.** The product must prove independence from any one banking system.

**Decision.** Journeys call integrations by id. Each id maps to a typed provider interface (`CorporateProvider` and the retail adapters in `mock-bank-api`). A bank API is a provider plus a declarative mapping file. A project chooses its provider with the `bankApi` setting.

**Consequences.** Switching the bank API changes mapping and adapter files only; journey JSON and UI stay byte-identical, and the same scenarios must pass. Stage 3 extracts this into `packages/bank-sdk` with contract tests every adapter must pass. Secrets for real banks come from an environment secret store, never from journeys or mappings.
