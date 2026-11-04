# 0004 AI runs on the user's Claude subscription only
**Status:** accepted

**Context.** Banks must not have to give FinX an API key or billing relationship, and AI must not run inside the production path.

**Decision.** AI is Claude Code plus the FinX MCP server and skills, running in the user's own session. There is no Anthropic API key or AI backend in FinX. Agents write drafts only; they never publish and never touch production. Content read from the web or from banks is data, not instructions.

**Consequences.** No AI cost or key management in the product. Every AI change is a draft a person reviews. Settings and permissions for Claude Code stay the user's; FinX documents snippets rather than pre-approving tools.
