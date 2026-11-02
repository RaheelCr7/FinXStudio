/**
 * Which browser origins may call Studio. Browsers always send an Origin header on cross-site writes, so refusing
 * unknown origins stops a malicious web page from publishing journeys to a developer's local Studio.
 * Requests without an Origin header (the MCP server, curl, native apps) are allowed.
 */
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function originAllowed(origin: string | null | undefined, extra: string = process.env.FINX_STUDIO_ALLOWED_ORIGINS ?? ""): boolean {
  if (!origin) return true;
  if (LOCAL.test(origin)) return true;
  return extra.split(",").map((s) => s.trim()).filter(Boolean).includes(origin);
}
