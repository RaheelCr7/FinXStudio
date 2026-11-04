# 0002 Logic lives in shared pure packages
**Status:** accepted

**Context.** Studio, the web app and the phone apps must behave identically, and behaviour must be testable without a device.

**Decision.** Rules, validation, formatting, dates, money and the journey runner live in pure TypeScript packages (`renderer-core`, `components/calendar.ts`, `ui-kit`) with no React or platform imports. Renderers and apps only draw and forward events.

**Consequences.** Most behaviour is covered by fast vitest tests. A visual exists in exactly one component; a bank-specific difference is a token, not a fork.
