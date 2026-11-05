"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "../bankworkx/parts";
import { useApp, useAppState } from "../AppProvider";

/** Signs out on the web: tells the app (which tells the bank and clears the customer's state), clears the tab's storage, and replaces the page so Back cannot show a signed-in one. */
export function useSignOut() {
  const { app, project } = useApp();
  const router = useRouter();
  return () => {
    app.logout();
    try { sessionStorage.clear(); } catch { /* private mode */ }
    router.replace(`/${project.id}/login`);
  };
}

/**
 * What watches a signed-in session: taps, key presses and scrolls count as activity; "Still there?" warns before the timeout; "Sign out?" asks
 * once; and a banner says when the connection is gone. The countdown itself lives in the app store (bank-client), this only draws it.
 */
export function SessionWatch() {
  const { app } = useApp();
  const s = useAppState();
  const signOut = useSignOut();
  const [online, setOnline] = useState(true);
  const [back, setBack] = useState(false);

  // activity, at most once a second
  useEffect(() => {
    let last = 0;
    const on = () => { const n = Date.now(); if (n - last > 1000) { last = n; app.activity(); } };
    const events = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, on, { passive: true, capture: true });
    return () => { for (const e of events) window.removeEventListener(e, on, { capture: true }); };
  }, [app]);

  // offline: a banner that goes when the network is back (three seconds of "You're back online")
  useEffect(() => {
    setOnline(navigator.onLine);
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = () => { setBack(false); setOnline(false); };
    const on = () => { setOnline(true); setBack(true); t = setTimeout(() => setBack(false), 3000); };
    window.addEventListener("offline", off); window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); if (t) clearTimeout(t); };
  }, []);

  const warning = s.idle.phase === "warning" ? s.idle : null;
  return (
    <>
      {!online || back ? <div className={`ws-offline ${online ? "is-back" : ""}`} role="status">{online ? "You’re back online" : "You’re offline. We’ll reconnect when you are."}</div> : null}
      <Modal open={!!warning} onClose={() => void app.keepAlive()} title="Still there?">
        {warning ? (
          <div className="ws-form">
            <p>For your security we’ll sign you out in <b className="ws-count">{warning.left}</b> seconds. Anything you haven’t finished won’t be saved.</p>
            <span className="wb-sr" role="alert">Your session is about to end. Choose Stay signed in to keep it.</span>
            <div className="ws-actions">
              <button type="button" className="wb-btn wb-btn-ghost" onClick={signOut}>Sign out now</button>
              <button type="button" className="wb-btn wb-btn-primary" onClick={() => void app.keepAlive()} autoFocus>Stay signed in</button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal open={s.sheet === "signout"} onClose={() => app.closeSheet()} title="Sign out?">
        <div className="ws-form">
          <p>You’ll need to sign in again.</p>
          <div className="ws-actions">
            <button type="button" className="wb-btn wb-btn-ghost" onClick={() => app.closeSheet()}>Cancel</button>
            <button type="button" className="wb-btn wb-btn-danger" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
