"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { displayName } from "@finx/bank-client";
import { formatMoney } from "@finx/ui-kit";
import { useApp, useAppState } from "../AppProvider";

/** Minutes a session may sit idle, and how long before that the warning appears. Same defaults as the bank's own page. */
export const IDLE_MS = 5 * 60_000;
export const WARN_MS = 4 * 60_000;

/** Signs the person out after they stop using the page, and warns first. Any key, click or scroll counts as activity. */
export function useIdle(onExpire: () => void, idleMs = IDLE_MS, warnMs = WARN_MS) {
  const [left, setLeft] = useState<number | null>(null);
  const last = useRef(0);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    last.current = Date.now();
    const touch = () => { if (left === null) last.current = Date.now(); };
    const events = ["keydown", "pointerdown", "scroll"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    const tick = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= idleMs) { setLeft(null); expire.current(); } else if (idle >= warnMs) setLeft(Math.ceil((idleMs - idle) / 1000)); else setLeft(null);
    }, 1000);
    return () => { clearInterval(tick); for (const e of events) window.removeEventListener(e, touch); };
  }, [idleMs, warnMs, left]);
  return { secondsLeft: left, extend: () => { last.current = Date.now(); setLeft(null); } };
}

export function CorporateHome({ idleMs = IDLE_MS, warnMs = WARN_MS }: { idleMs?: number; warnMs?: number }) {
  const { app, project } = useApp();
  const s = useAppState();
  const router = useRouter();
  const leave = (expired: boolean) => { app.logout(); router.push(`/${project.id}/login${expired ? "?expired=1" : ""}`); };
  const idle = useIdle(() => leave(true), idleMs, warnMs);
  const accounts = app.persona.accounts;

  return (
    <main className="cb-home" key={s.tick}>
      <header className="cb-home-head">
        <div><p className="cb-muted">Signed in</p><h1>{displayName(app.persona)}</h1></div>
        <button type="button" className="cb-btn" onClick={() => leave(false)}>Sign out</button>
      </header>
      <h2>Accounts</h2>
      <ul className="cb-accounts">
        {accounts.map((a) => (
          <li key={a.id} className="cb-account">
            <span>{a.name} <small className="cb-muted">{a.maskedNumber}</small></span>
            <b>{formatMoney(a.balance, a.currency, "en-GB")}</b>
          </li>
        ))}
      </ul>
      <p className="cb-muted">Payments and approvals are the next journeys to add. Your session ends after {Math.round(idleMs / 60000)} minutes without activity.</p>
      {idle.secondsLeft !== null ? (
        <div className="cb-scrim" role="presentation">
          <div className="cb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cb-idle-title">
            <h2 id="cb-idle-title">Session timeout</h2>
            <p>Your session is about to expire. Do you want to extend your session?</p>
            <p className="cb-count" role="timer" aria-live="off">{idle.secondsLeft}s</p>
            <div className="cb-dialog-actions">
              <button type="button" className="cb-btn" onClick={() => leave(false)}>Sign out</button>
              <button type="button" className="cb-btn cb-btn-primary" onClick={idle.extend} autoFocus>Extend session</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
