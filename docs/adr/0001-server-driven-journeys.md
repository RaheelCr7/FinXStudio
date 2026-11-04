# 0001 Journeys are data, not code
**Status:** accepted

**Context.** Banks need many journeys on iOS, Android and web, changed often, reviewed by non-developers, and checked for money safety before release.

**Decision.** A journey is a JSON document (screens, blocks, actions, rules, translations, tests) validated by `journey-schema` and run by `renderer-core`. Only blocks, actions and rule operators the schema allows can appear. Generators and AI may emit only these.

**Consequences.** One journey, every channel; lint and executable tests can judge it; no free-form code to rot. The client must treat a journey as untrusted input (validate, allowlist, later sign). New capability means a new block or action in the schema, with a spec, a native twin and tests.
