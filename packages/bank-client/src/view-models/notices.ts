import type { Link } from "../links";
import { PERSONAL, type ContextInfo } from "../session";

/** A notification as `bank.notifications.list` returns it: tagged with the place it belongs to. */
export type RawNotification = { id: string; context: string; text: string; at: string; read: boolean };
export type ContextNotice = {
  id: string; context: string; at: string; read: boolean;
  /** What the list shows. A notice from another place shows only where it is from: its details stay with that place. */
  text: string;
  /** The name of the place, when it is not the one the person is in. */
  from?: string;
  /** Where tapping it leads. A different context means the shell offers to switch first. */
  link?: Link;
};

/** Where a notification leads, by what it is about. Anything unrecognised just marks it read. */
export function noticeLink(n: RawNotification): Link | undefined {
  const ws = n.context === PERSONAL ? { workspace: "personal" as const } : { workspace: "business" as const, companyId: n.context };
  if (/awaiting your approval/i.test(n.text) && ws.workspace === "business") return { ...ws, tab: "approvals" };
  if (/payment .*(settled|rejected|released)/i.test(n.text) && ws.workspace === "business") return { ...ws, tab: "payments" };
  if (/salary|received|statement/i.test(n.text) && ws.workspace === "personal") return { ...ws, tab: "accounts" };
  if (/card/i.test(n.text) && ws.workspace === "personal") return { ...ws, tab: "cards" };
  return { ...ws, tab: ws.workspace === "business" ? "overview" : "home" };
}

/**
 * The notification centre for the active place, newest first. Items from the other places stay in the list so a person can jump
 * to them, but show a neutral line (never the amount or the payee), so nothing of a company is read out while in Personal or in another company.
 */
export function noticesFor(raw: RawNotification[], contexts: ContextInfo[], activeId: string, readIds: ReadonlySet<string> = new Set()): ContextNotice[] {
  const label = (id: string) => contexts.find((c) => c.id === id)?.label ?? id;
  return [...raw].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((n) => {
    const here = n.context === activeId;
    return {
      id: n.id, context: n.context, at: n.at, read: n.read || readIds.has(n.id), link: noticeLink(n),
      text: here ? n.text : "New activity", ...(here ? {} : { from: label(n.context) }),
    };
  });
}
export const unreadCount = (notices: ContextNotice[], context?: string) => notices.filter((n) => !n.read && (!context || n.context === context)).length;
