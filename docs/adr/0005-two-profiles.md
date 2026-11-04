# 0005 Demo and production profiles
**Status:** accepted

**Context.** Hardening (sign-in, signed journeys, pinning, audit) would break the laptop demo if always on.

**Decision.** One switch selects the profile. Demo keeps today's behaviour. Production turns every control on. Controls are built off-by-default and proved in production mode by their own tests.

**Consequences.** Demo flows and existing tests stay green while the security programme grows. A control is not "done" until it has a test that runs with the production profile on.
