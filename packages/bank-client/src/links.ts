import type { WorkspaceId } from "@finx/ui-kit";
import { isTab, type ShellTab } from "./view-models/menus";

/**
 * Where a link points: a tab of a workspace (a company's, for Business), or a journey in it. The same shape is read from a web
 * address (/personal/cards, /business/alpha/j/supplier-payment?paymentId=...) and from a mobile deep link (bankworkx://business/alpha/approvals).
 * Everything in a link is untrusted: only known tabs, safe slugs and short plain values get through.
 */
export type Link = { workspace: WorkspaceId; companyId?: string } & ({ tab: ShellTab; /** A page inside the tab: Settings > Security (personal/more/settings/security). */ sub?: "security"; journey?: undefined; values?: undefined } | { journey: string; values: Record<string, string>; tab?: undefined; sub?: undefined });

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const COMPANY = /^[a-z0-9][a-z0-9_-]{0,30}$/;
const KEY = /^[a-zA-Z][a-zA-Z0-9]{0,30}$/;
const MAX_VALUE = 120;

/** The values a link may carry: plain strings with safe names, nothing else. */
export function cleanValues(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of params) if (KEY.test(k) && v.length > 0 && v.length <= MAX_VALUE && !(k in out)) out[k] = v;
  return out;
}

/** Reads a path ("/personal/cards", "business/alpha/j/approve-payments?paymentId=PAY-2041") or a deep link ("bankworkx://personal/cards"). Null when it is not one of ours. */
export function parseLink(input: string, scheme?: string): Link | null {
  let rest = input.trim();
  const m = rest.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (m) { if (scheme && m[1]!.toLowerCase() !== scheme.toLowerCase()) return null; rest = m[2]!; }
  const hash = rest.indexOf("#");
  const [pathPart, query = ""] = (hash < 0 ? rest : rest.slice(0, hash)).split("?");
  const parts = pathPart!.split("/").filter(Boolean);
  const workspace = parts.shift();
  if (workspace !== "personal" && workspace !== "business") return null;
  let companyId: string | undefined;
  if (workspace === "business") { companyId = parts.shift(); if (!companyId || !COMPANY.test(companyId)) return null; }
  const base = workspace === "business" ? { workspace, companyId } as const : { workspace } as const;
  if (parts.length === 0) return { ...base, tab: workspace === "business" ? "overview" : "home" } as Link;
  if (parts[0] === "j") {
    const slug = parts[1];
    if (!slug || !SLUG.test(slug) || parts.length > 2) return null;
    return { ...base, journey: slug, values: cleanValues(new URLSearchParams(query)) } as Link;
  }
  // Settings > Security: only for Personal
  if (workspace === "personal" && parts.length === 3 && parts[0] === "more" && parts[1] === "settings" && parts[2] === "security") return { ...base, tab: "more", sub: "security" } as Link;
  if (parts.length !== 1 || !isTab(workspace, parts[0]!)) return null;
  return { ...base, tab: parts[0] as ShellTab } as Link;
}

const enc = encodeURIComponent;
/** The path of a link, without the project or scheme prefix: the reverse of parseLink. */
export function linkPath(link: Link): string {
  const root = link.workspace === "business" ? `/business/${enc(link.companyId ?? "")}` : "/personal";
  if (link.journey !== undefined) {
    const q = new URLSearchParams(Object.entries(link.values).filter(([k, v]) => KEY.test(k) && v !== "")).toString();
    return `${root}/j/${enc(link.journey)}${q ? `?${q}` : ""}`;
  }
  return link.sub === "security" ? `${root}/more/settings/security` : `${root}/${link.tab}`;
}
export const deepLink = (scheme: string, link: Link) => `${scheme}://${linkPath(link).slice(1)}`;

/** The context id a link belongs to: "personal", or the company. */
export const linkContext = (link: Link) => (link.workspace === "business" ? link.companyId! : "personal");
/** Whether following the link means changing the active context first (the shell then offers to switch). */
export const needsSwitch = (link: Link, activeContextId: string) => linkContext(link) !== activeContextId;
