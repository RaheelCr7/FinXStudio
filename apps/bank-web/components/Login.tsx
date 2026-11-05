"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JourneyPlayer } from "@finx/renderer-web";
import { personaSummary, type Live } from "@finx/bank-client";
import { formatMoney } from "@finx/ui-kit";
import { safeNext } from "@/lib/safe-next";
import { useApp, useAppState } from "./AppProvider";

/**
 * Sign in. A bank with a real sign-in (BankWorkx) runs the sign-in journey here: the journey signs the customer in at the sandbox bank and
 * the app then asks the bank who is signed in. The sandbox customer picker is for development: it is one link (or ?picker=1) away.
 * Every other bank keeps the picker as its sign-in.
 */
export function Login() {
  const { app, project } = useApp();
  const s = useAppState();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next");
  const bw = project.shell === "bankworkx";
  const home = () => safeNext(next, project.id, `/${project.id}/${bw ? (app.persona.identity ? "personal/home" : "dashboard") : "home"}`);
  // ?picker=1 asks for the sandbox customer picker; only a bank that has a real sign-in has anything to switch
  const wantPicker = search.get("picker") === "1";
  useEffect(() => { if (wantPicker) app.showPicker(true); }, [app, wantPicker]);

  if (!s.picker) return <SignInJourney onSignedIn={() => router.push(home())} />;
  return <Picker onLogin={() => { app.login(); router.push(home()); }} />;
}

/** The sign-in journey, and the journeys it hands over to (forgot password, forgot username, unlock): the one on screen is the one the customer is in. */
function SignInJourney({ onSignedIn }: { onSignedIn: () => void }) {
  const { app, project } = useApp();
  const s = useAppState();
  // which journey is on screen and the values it was opened with; n makes a journey that is opened again start again
  const [run, setRun] = useState<{ slug: string; launch?: Record<string, any>; n: number }>({ slug: "sign-in", n: 0 });
  const [live, setLive] = useState<Live | null | "loading">("loading");
  // signed out for their security: the sign-in journey says so (expired); a lock says it here
  const reason = s.notice === "expired" ? { "launch.reason": "expired" } : undefined;
  useEffect(() => {
    let alive = true;
    setLive("loading");
    void app.fetchJourney(run.slug).then((l) => { if (alive) setLive(l); });
    return () => { alive = false; };
  }, [app, run]);

  const open = (r: { journey: string; launch: Record<string, any> }) => setRun((cur) => ({ slug: app.resolveSlug(r.journey), launch: r.launch, n: cur.n + 1 }));
  // a journey ended: when the bank now serves a customer the app opens it, otherwise the sign-in starts again
  const ended = () => { if (app.finishSignIn()) onSignedIn(); else setRun((cur) => ({ slug: "sign-in", n: cur.n + 1 })); };

  if (live === "loading") return <main className="wb-loading" aria-busy="true"><span className="wb-sr">Opening</span></main>;
  return (
    <main className="wb-journey">
      <div className="wb-journey-card">
        {s.notice === "locked" ? <p className="wb-note" role="alert">Sign-in is locked to protect your account. Unlock it to continue.</p> : null}
        {live ? (
          <JourneyPlayer key={`${run.slug}:${run.n}`} journey={live.journey} adapter={app.adapter} lang={s.lang} launch={run.launch ?? reason} onOpenJourney={open} onClose={ended} onExit={ended} look={project.look} brandName={project.name} />
        ) : (
          <div className="wb-pad"><h1>Sign in is not available right now</h1><p className="wb-muted">The sign-in journey could not be loaded. You can still use the sandbox customer picker.</p></div>
        )}
      </div>
      <p className="wb-fine"><button type="button" className="wb-link" onClick={() => app.showPicker(true)}>Use the sandbox customer picker</button></p>
    </main>
  );
}

function Picker({ onLogin }: { onLogin: () => void }) {
  const { app, project } = useApp();
  const s = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const bw = project.shell === "bankworkx";
  const ur = s.lang === "ur";

  return (
    <main className="wb-login" dir={ur ? "rtl" : "ltr"}>
      <div className="wb-login-card">
        <span className="wb-mark wb-mark-lg" aria-hidden>{project.name.slice(0, 1)}</span>
        <h1>{project.name}</h1>
        <p className="wb-muted">Sign in with a sandbox customer</p>
        <form onSubmit={(e) => { e.preventDefault(); setSubmitting(true); onLogin(); }}>
          <fieldset className="wb-personas">
            <legend className="wb-sr">Sandbox customer</legend>
            {app.personas().map((p) => (
              <label key={p.id} className={`wb-persona ${p.id === s.personaId ? "is-on" : ""}`}>
                <input type="radio" name="persona" value={p.id} checked={p.id === s.personaId} onChange={() => app.selectPersona(p.id)} />
                <span><b>{p.name}</b><small>{bw ? (p.accounts.length ? `${p.accounts.length} accounts · ${p.finance?.cards.length ?? 0} card · budgets and subscriptions` : "No accounts yet: start from scratch") : personaSummary(p, (n) => formatMoney(n))}</small></span>
              </label>
            ))}
          </fieldset>
          <button className="wb-btn wb-btn-primary" type="submit" disabled={submitting}>Log in</button>
        </form>
        {!bw ? <button type="button" className="wb-btn wb-btn-ghost" lang={ur ? "en" : "ur"} onClick={() => app.toggleLang()}>{ur ? "English" : "اردو"}</button> : null}
        {bw && app.hasSignIn ? <button type="button" className="wb-btn wb-btn-ghost" onClick={() => app.showPicker(false)}>Back to sign in</button> : null}
        <p className="wb-fine">Sandbox build · no real money moves</p>
      </div>
    </main>
  );
}
