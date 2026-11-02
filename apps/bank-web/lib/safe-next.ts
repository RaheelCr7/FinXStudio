/** Where to go after signing in: the page the person came from, but only if it is inside this bank. Anything else (another site, a protocol-relative address) is ignored. */
export const safeNext = (next: string | null, project: string, fallback: string) =>
  next && next.startsWith(`/${project}/`) && !next.startsWith("//") && !next.includes("\\") && !/[\u0000-\u001f]/.test(next) ? next : fallback;
