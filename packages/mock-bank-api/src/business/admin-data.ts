import type { CorpRole } from "./corporate";

/**
 * What the Admin sandbox keeps beyond the company's own books (corporate.ts): the full record of each person (email, mobile number, role, accounts, status), the changes that wait
 * for a second administrator and the activity log. All of it is made up. The seeds are the spec's (docs/BANKWORKX.md, "Business: Admin and More"); the dates are fixed, "today" of the
 * demo is Tuesday 3 November 2026.
 */
export type Role = "maker" | "approver" | "both" | "viewer" | "admin";
export type Status = "active" | "invited" | "disabled" | "waiting";
export type Person = { id: string; name: string; email: string; phone: string; role: Role; limit: number; accounts: string[]; status: Status; changeId?: string };
export type Change = { id: string; by: string; at: string; text: string; done: string; kind: "limit" | "user" | "group"; data: Record<string, any>; status: "waiting" | "approved" | "declined"; personId?: string; which?: string; group?: string };
export type LogRow = { at: string; who: string; what: string; result: "Done" | "Waiting" | "Refused" };

export const ROLES: Role[] = ["maker", "approver", "both", "viewer", "admin"];
export const ROLE_TEXT: Record<Role, string> = { maker: "Maker", approver: "Approver", both: "Maker and approver", viewer: "Viewer", admin: "Administrator" };
export const rolesOf = (role: Role): CorpRole[] => ({ maker: ["initiator"], approver: ["approver"], both: ["initiator", "approver"], viewer: [], admin: ["admin"] } as Record<Role, CorpRole[]>)[role];
export const roleOf = (roles: CorpRole[]): Role => (roles.includes("admin") ? "admin" : roles.includes("initiator") && roles.includes("approver") ? "both" : roles.includes("initiator") ? "maker" : roles.includes("approver") ? "approver" : "viewer");

/** The bank's own ceiling for the company daily limit: the company cannot raise it (only the bank can). */
export const CEILING = 2_000_000;
/** Who acts when the administrator preview is on: the company's administrator of the spec. */
export const PREVIEW_AS: Record<string, string> = { alpha: "ravi", beta: "noor" };
export const MAX_REQUESTS_PER_DAY = 5;

const P = (id: string, name: string, role: Role, limit: number, phone: string, domain: string, status: Status = "active"): Omit<Person, "accounts"> => ({ id, name, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${domain}`, phone, role, limit, status });
const ALPHA_DOMAIN = "alpha.example", BETA_DOMAIN = "beta.example";

/** The people of each company, in the order of the spec. Accounts are all the company's accounts. */
export const PEOPLE_SEED: Record<string, Omit<Person, "accounts">[]> = {
  alpha: [
    P("alex", "Alex Morgan", "maker", 250_000, "+1 415 555 0142", ALPHA_DOMAIN), P("dana", "Dana Cruz", "approver", 0, "+1 415 555 0121", ALPHA_DOMAIN), P("lee", "Lee Park", "approver", 0, "+1 415 555 0122", ALPHA_DOMAIN),
    P("maria", "Maria Silva", "approver", 0, "+1 415 555 0123", ALPHA_DOMAIN), P("priya", "Priya Nair", "maker", 100_000, "+1 415 555 0124", ALPHA_DOMAIN), P("omar", "Omar Haddad", "maker", 150_000, "+1 415 555 0125", ALPHA_DOMAIN),
    P("sam", "Sam Okafor", "approver", 0, "+1 415 555 0100", ALPHA_DOMAIN, "invited"), P("ravi", "Ravi Menon", "admin", 0, "+1 415 555 0126", ALPHA_DOMAIN), P("mina", "Mina Das", "admin", 0, "+1 415 555 0127", ALPHA_DOMAIN),
  ],
  beta: [
    P("alex", "Alex Morgan", "approver", 0, "+1 415 555 0142", BETA_DOMAIN), P("lee", "Lee Park", "approver", 0, "+1 415 555 0122", BETA_DOMAIN), P("maria", "Maria Silva", "approver", 0, "+1 415 555 0123", BETA_DOMAIN),
    P("sam", "Sam Okafor", "approver", 0, "+1 415 555 0100", BETA_DOMAIN), P("priya", "Priya Nair", "maker", 100_000, "+1 415 555 0124", BETA_DOMAIN), P("omar", "Omar Haddad", "maker", 150_000, "+1 415 555 0125", BETA_DOMAIN),
    P("noor", "Noor Sayegh", "admin", 0, "+1 415 555 0131", BETA_DOMAIN), P("karim", "Karim Aziz", "admin", 0, "+1 415 555 0132", BETA_DOMAIN),
  ],
};

/** The groups of the spec: who approves above and up to the two-approver limit. The members are person ids. */
export const GROUP_SEED: Record<string, { over: { mode: "seq" | "par" | "any"; members: string[] }; upto: { mode: "seq" | "par" | "any"; members: string[] } }> = {
  alpha: { over: { mode: "seq", members: ["dana", "lee"] }, upto: { mode: "any", members: ["dana", "lee"] } },
  beta: { over: { mode: "seq", members: ["alex", "lee"] }, upto: { mode: "any", members: ["alex", "lee"] } },
};

/** The change that waits for a second administrator at the start of the day. */
export const CHANGE_SEED: Record<string, Change[]> = {
  alpha: [{ id: "CHG-1042", by: "mina", at: "2026-11-03T09:20:00Z", text: "Raise the extra code threshold from $25,000.00 to $30,000.00", done: "Raise the extra code threshold from $25,000.00 to $30,000.00", kind: "limit", data: { which: "code", value: 30_000 }, status: "waiting", which: "code" }],
  beta: [{ id: "CHG-1043", by: "karim", at: "2026-11-03T08:50:00Z", text: "Raise the two-approver threshold from $50,000.00 to $60,000.00", done: "Raise the two-approver threshold from $50,000.00 to $60,000.00", kind: "limit", data: { which: "two", value: 60_000 }, status: "waiting", which: "two" }],
};

/** The activity log of both companies at the start of the day, newest first. */
export const LOG_SEED: LogRow[] = [
  { at: "2026-11-03T10:14:00Z", who: "Alex Morgan", what: "Signed in to Alpha Trading LLC as Maker", result: "Done" },
  { at: "2026-11-03T09:58:00Z", who: "ravi", what: "Changed Dana Cruz’s daily limit from 100,000.00 to 150,000.00", result: "Done" },
  { at: "2026-11-02T16:02:00Z", who: "Omar Haddad", what: "Started payment PAY-2039 of USD 64,500.00", result: "Done" },
  { at: "2026-11-02T11:20:00Z", who: "ravi", what: "Invited Priya Nair as Maker", result: "Done" },
  { at: "2026-11-01T08:45:00Z", who: "unknown", what: "Sign in attempt", result: "Refused" },
];
export const LOG_LENGTH = 15;
