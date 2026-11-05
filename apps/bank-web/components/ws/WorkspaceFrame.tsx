"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@finx/renderer-web";
import { contextInitials, menuFor, roleBadge, unreadCount, type ShellTab } from "@finx/bank-client";
import { WorkspaceScope } from "../WorkspaceScope";
import { Modal } from "../bankworkx/parts";
import { CommandBar, NoticesDialog, OfferDialog, StepUpDialog, SwitcherDialog, SwitchingOverlay } from "./Dialogs";
import { Notice } from "./ScreenView";
import { useWs, wsHref } from "./use-ws";

const SCHEMES = [["system", "Auto"], ["light", "Light"], ["dark", "Dark"]] as const;

/**
 * The frame of the workspace shell: navigation for the active place (a side rail on wide screens, a bar at the bottom on phones),
 * the command bar, the entity selector, notifications, and the dialogs for switching. Its theme is the workspace's (data-workspace).
 */
export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const { app, project, s, ctx, router, here, go } = useWs();
  const [switcher, setSwitcher] = useState(false);
  const [notes, setNotes] = useState(false);
  const [cmd, setCmd] = useState(false);
  const info = s.session.info;
  const business = s.workspace === "business";

  useEffect(() => { if (s.session.status === "idle") void app.loadSession(); }, [app, s.session.status]);
  useEffect(() => { if (s.session.status === "unavailable") router.replace(`/${project.id}/dashboard`); }, [s.session.status, router, project.id]);
  useEffect(() => { if (s.session.status === "ready") void app.loadNotices(); }, [app, s.session.status, info?.activeContextId, s.tick]);

  // after a switch the app shows the new place: the link that asked for it, else the place's last tab
  const was = useRef<string | undefined>(undefined);
  useEffect(() => {
    const now = info?.activeContextId;
    if (was.current !== undefined && now !== undefined && now !== was.current && !s.arrived) go(here({ tab: s.shellTab }));
    was.current = now;
  }, [info?.activeContextId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!s.arrived) return;
    router.push(wsHref(project.id, s.arrived));
    app.clearArrived();
  }, [s.arrived, app, router, project.id]);

  // ⌘K / Ctrl+K opens the command bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (s.session.status === "error") return <main className="wb-pad"><Notice role="alert" icon="warn" title="Could not load your accounts" text={s.session.error} action="Try again" onAction={() => void app.loadSession()} /></main>;
  if (s.session.status !== "ready" || !ctx || !info) return <main className="wb-loading" aria-busy="true"><span className="wb-sr">Loading</span></main>;

  const menu = menuFor(ctx, { approvals: app.approvalsBadge });
  const unread = unreadCount(app.notices());
  const base = (tab: ShellTab) => wsHref(project.id, here({ tab }));

  return (
    <div className="wb-app ws-app" data-ws={s.workspace}>
      <WorkspaceScope workspace={s.workspace} />
      <a className="wb-skip" href="#main">Skip to content</a>
      <nav className="wb-nav ws-nav" aria-label="Main">
        <Link href={base(menu[0]!.id)} className="wb-brand"><span className="wb-mark" aria-hidden>{project.name.slice(0, 1)}</span><span>{project.name}</span></Link>
        <ul>
          {menu.map((m) => {
            const href = base(m.id);
            const on = s.shellTab === m.id;
            return (
              <li key={m.id}>
                <Link href={href} aria-current={on ? "page" : undefined} className={on ? "is-on" : ""}>
                  <Icon name={m.icon} size={22} /><span>{m.label}</span>
                  {m.badge ? <span className="ws-badge" aria-label={`${m.badge} waiting`}>{m.badge}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <button type="button" className="ws-side-btn" onClick={() => setSwitcher(true)}><Icon name="repeat" size={20} /><span>Switch workspace</span></button>
      </nav>

      <div className="wb-stage">
        <header className="wb-top ws-top">
          <button type="button" className="ws-cmd-btn" onClick={() => setCmd(true)} aria-label="Search or go to"><Icon name="search" size={18} /><span>Search or go to...</span><kbd>⌘K</kbd></button>
          <div className="wb-top-actions">
            <button type="button" className="ws-entity" onClick={() => setSwitcher(true)} aria-label={`Workspace: ${business ? ctx.label : "Personal"}. Switch`}>
              <span className="ws-chip" aria-hidden>{business ? contextInitials(ctx) : "AM"}</span>
              <span className="ws-entity-text"><b>{business ? ctx.label : info.identity.name}</b><small>{business ? "Business" : "Personal"}</small></span>
              {business ? <span className={`ws-role ws-role-${ctx.roles[0]?.toLowerCase()}`}>{roleBadge(ctx)}</span> : null}
              <Icon name="chevronDown" size={16} />
            </button>
            <button type="button" className="wb-icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => setNotes(true)}><Icon name="bell" size={22} />{unread ? <span className="wb-dot" aria-hidden /> : null}</button>
            <button type="button" className="wb-icon-btn" aria-label="Menu" onClick={() => app.openSheet("menu")}><Icon name="menu" size={22} /></button>
          </div>
        </header>
        <main id="main" className="wb-main ws-main" tabIndex={-1}>{children}</main>
      </div>

      <SwitcherDialog open={switcher} onClose={() => setSwitcher(false)} />
      <NoticesDialog open={notes} onClose={() => setNotes(false)} />
      <CommandBar open={cmd} onClose={() => setCmd(false)} />
      <StepUpDialog />
      <OfferDialog />
      <SwitchingOverlay />

      <Modal open={s.sheet === "menu"} onClose={() => { if (app.getState().sheet === "menu") app.closeSheet(); }} title={info.identity.name}>
        <fieldset className="ws-scheme">
          <legend>Appearance</legend>
          {SCHEMES.map(([id, name]) => <label key={id}><input type="radio" name="scheme" checked={s.prefs.scheme === id} onChange={() => app.setPrefs({ scheme: id })} /><span>{name}</span></label>)}
        </fieldset>
        <button type="button" className="wb-btn wb-btn-danger" onClick={() => app.askSignOut()}>Log out</button>
      </Modal>

      <div className="wb-toast-zone" aria-live="polite">
        {s.toast ? <div className={`wb-toast ${s.toast.ok ? "is-ok" : "is-bad"}`} role={s.toast.ok ? "status" : "alert"}><Icon name={s.toast.ok ? "check" : "x"} size={14} stroke={3} />{s.toast.text}</div> : null}
      </div>
    </div>
  );
}
