"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@finx/renderer-web";
import { businessContexts, commandsFor, contextInitials, filterCommands, roleBadge, unreadCount, type Command } from "@finx/bank-client";
import { Modal } from "../bankworkx/parts";
import { useWs } from "./use-ws";

/** The entity selector's list: Personal and each company, with the role the person holds there. */
export function SwitcherDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app, s } = useWs();
  const info = s.session.info;
  return (
    <Modal open={open} onClose={onClose} title="Switch workspace">
      <ul className="ws-places">
        {(info?.contexts ?? []).map((c) => {
          const on = c.id === info!.activeContextId;
          return (
            <li key={c.id}>
              <button type="button" className={`ws-place ${on ? "is-on" : ""}`} aria-current={on ? "true" : undefined} onClick={() => { onClose(); if (!on) void app.switchContext(c.id); }}>
                <span className="ws-chip" aria-hidden>{c.workspace === "business" ? contextInitials(c) : "AM"}</span>
                <span><b>{c.workspace === "business" ? c.label : "Personal"}</b><small>{c.workspace === "business" ? "Business" : info!.identity.name}</small></span>
                {c.workspace === "business" ? <span className={`ws-role ws-role-${c.roles[0]?.toLowerCase()}`}>{roleBadge(c)}</span> : null}
                {on ? <Icon name="check" size={18} stroke={3} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {businessContexts(info).length === 0 ? <p className="wb-muted">You have no business accounts.</p> : null}
    </Modal>
  );
}

/**
 * "Confirm it's you": the password (or the quick PIN, when that is how this device signs in), then the code the bank sent. Opens when the bank asks
 * for it before a company, and before a security journey (Change password, Trusted devices, ...).
 */
export function StepUpDialog() {
  const { app, s } = useWs();
  const su = s.stepUp;
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const target = s.session.info?.contexts.find((c) => c.id === su?.contextId);
  useEffect(() => { if (!su) { setSecret(""); setCode(""); setUsePassword(false); } }, [su]);
  const pin = su?.method === "pin" && !usePassword;
  const why = su?.reason ?? (target && !su?.then ? `To open ${target.label}.` : "");
  return (
    <Modal open={!!su} onClose={() => app.cancelStepUp()} title="Confirm it's you">
      {su ? (
        <form className="ws-form" onSubmit={(e) => { e.preventDefault(); void (su.phase === "password" ? app.beginStepUp({ method: pin ? "pin" : "password", secret }) : app.confirmStepUp(code)); }}>
          <p className="wb-muted">For your security, confirm it’s you first. {why}</p>
          {su.phase === "password" ? (
            <>
              <label>{pin ? "Quick PIN" : "Password"}<input type="password" inputMode={pin ? "numeric" : undefined} maxLength={pin ? 6 : undefined} autoComplete={pin ? "off" : "current-password"} value={secret} onChange={(e) => setSecret(pin ? e.target.value.replace(/\D/g, "") : e.target.value)} autoFocus aria-invalid={!!su.error} aria-describedby={su.error ? "ws-su-error" : undefined} /></label>
              {pin ? <button type="button" className="wb-link" onClick={() => { setUsePassword(true); setSecret(""); }}>Use password instead</button> : null}
            </>
          ) : (
            <label>Code sent to {su.phone}<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus aria-invalid={!!su.error} aria-describedby={su.error ? "ws-su-error" : undefined} /></label>
          )}
          {su.error ? <p id="ws-su-error" className="ws-error" role="alert">{su.error}</p> : null}
          <div className="ws-actions">
            <button type="button" className="wb-btn wb-btn-ghost" onClick={() => app.cancelStepUp()}>Cancel</button>
            <button type="submit" className="wb-btn wb-btn-primary" disabled={su.busy || (su.phase === "password" ? secret === "" : code.length < 6)}>{su.busy ? "Checking..." : "Continue"}</button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

/** A link or notification into another place: asks before switching. */
export function OfferDialog() {
  const { app, s } = useWs();
  const link = s.offer;
  const label = link ? (link.workspace === "business" ? s.session.info?.contexts.find((c) => c.id === link.companyId)?.label : "Personal") : "";
  return (
    <Modal open={!!link} onClose={() => app.declineOffer()} title={`Switch to ${label}?`}>
      <p className="wb-muted">This opens in {label}. What you are doing here is closed first.</p>
      <div className="ws-actions">
        <button type="button" className="wb-btn wb-btn-ghost" onClick={() => app.declineOffer()}>Not now</button>
        <button type="button" className="wb-btn wb-btn-primary" onClick={() => void app.acceptOffer()}>Switch</button>
      </div>
    </Modal>
  );
}

/** The "Switching to ..." moment. The theme changes behind it, so it reads as a cross-fade (and as a plain pause with reduced motion). */
export function SwitchingOverlay() {
  const { s } = useWs();
  return (
    <div className={`ws-switching ${s.switching ? "is-on" : ""}`} role="status" aria-live="polite" aria-hidden={!s.switching}>
      <span className="ws-spinner" aria-hidden />
      <p>{s.switching ?? ""}</p>
    </div>
  );
}

export function NoticesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app, s, go } = useWs();
  useEffect(() => { if (open) void app.loadNotices(); }, [open, app]);
  const v = app.view("notices");
  const notices = app.notices();
  const follow = (n: (typeof notices)[number]) => {
    app.markRead(n.id);
    if (!n.link) return;
    onClose();
    if (app.followLink(n.link) === "go") go(n.link);
  };
  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      {!v || (v.status === "loading" && !v.data) ? <div className="ws-skel" aria-busy="true"><span className="wb-sr">Loading</span><i /><i /><i /></div>
        : v.status === "error" ? <div role="alert"><p>{v.error}</p><button type="button" className="wb-btn wb-btn-ghost" onClick={() => void app.loadNotices(true)}>Try again</button></div>
        : notices.length === 0 ? <p className="wb-muted">Nothing new.</p>
        : (
          <ul className="wb-notes">
            {notices.map((n) => (
              <li key={n.id}>
                <button type="button" className={`ws-note ${n.read ? "" : "is-unread"}`} onClick={() => follow(n)}>
                  <span>{n.text}{n.from ? <small>{n.from}</small> : null}</span>
                  {!n.read ? <span className="wb-sr">Unread</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      <span className="wb-sr" aria-live="polite">{unreadCount(notices)} unread</span>
    </Modal>
  );
}

/** ⌘K: type to go somewhere, start something, or switch place. */
export function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app, s, go, launch } = useWs();
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo(() => (app.context ? commandsFor({ context: app.context, entries: s.catalog.entries, settings: s.session.settings }, s.session.info?.contexts ?? []) : []), [app, s.session, s.catalog.entries, s.workspace]);
  const shown = useMemo(() => filterCommands(all, q), [all, q]);
  useEffect(() => { if (open) { setQ(""); setAt(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);
  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    if (c.kind === "go") go(c.link);
    else if (c.kind === "journey") launch(c.launch);
    else void app.switchContext(c.contextId);
  };
  return (
    <Modal open={open} onClose={onClose} title="Search or go to...">
      <div className="ws-cmd">
        <label className="wb-search"><Icon name="search" size={18} /><input ref={input} role="combobox" aria-expanded aria-controls="ws-cmd-list" aria-activedescendant={shown[at] ? `ws-cmd-${at}` : undefined} aria-label="Search or go to" placeholder="Search or go to..." value={q}
          onChange={(e) => { setQ(e.target.value); setAt(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAt((a) => Math.min(a + 1, shown.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAt((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); run(shown[at]); }
          }} /></label>
        <ul id="ws-cmd-list" role="listbox" className="ws-cmd-list">
          {shown.map((c, i) => (
            <li key={c.id} id={`ws-cmd-${i}`} role="option" aria-selected={i === at}>
              <button type="button" tabIndex={-1} className={i === at ? "is-on" : ""} onMouseEnter={() => setAt(i)} onClick={() => run(c)}><span>{c.label}</span><small>{c.hint}</small></button>
            </li>
          ))}
        </ul>
        {shown.length === 0 ? <p className="wb-muted">Nothing matches.</p> : null}
      </div>
    </Modal>
  );
}
