"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { safeNext } from "@/lib/safe-next";
import { useApp, useAppState } from "../AppProvider";

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Incorrect username or password.",
  USER_LOCKED: "Your profile is locked. Please contact the bank.",
};

/**
 * Corporate sign-in, rebuilt from a Temenos Digital Banking R26 sign-in page: a welcome panel on the left and the sign-in card on
 * the right, with the help links under the form, a language choice (asked to confirm) and the copyright footer.
 */
export function CorporateLogin() {
  const { app, project } = useApp();
  const s = useAppState();
  const router = useRouter();
  const params = useSearchParams();
  const ids = { user: useId(), pass: useId(), err: useId() };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(params.get("expired") ? "Your session has expired. Please sign in to continue." : null);
  const [langAsk, setLangAsk] = useState(false);
  const ready = username.trim() !== "" && password !== "";
  const base = `/${project.id}`;
  const other = s.lang === "ur" ? { code: "en", label: "English" } : { code: "ur", label: "اردو" };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    try {
      app.bank.auth.signIn(username, password);
      router.push(safeNext(params.get("next"), project.id, `${base}/home`));
      app.login();
    } catch (err: any) {
      setError(MESSAGES[err?.code] ?? "Sign in is not available right now.");
      setPassword("");
    }
  }

  return (
    <div className="cb-login">
      <section className="cb-welcome" aria-hidden="true">
        <span className="cb-logo">{project.name}</span>
        <h2>Welcome to {project.name}</h2>
        <p>Pay, approve and manage your business accounts in one place.</p>
      </section>
      <main className="cb-panel">
        <div className="cb-lang">
          <button type="button" className="cb-lang-btn" onClick={() => setLangAsk(true)}>Language: <b>{s.lang === "ur" ? "اردو" : "English"}</b></button>
        </div>
        <form className="cb-card" onSubmit={submit} noValidate aria-describedby={error ? ids.err : undefined}>
          <h1>Welcome</h1>
          {error ? <p id={ids.err} className="cb-error" role="alert">{error}</p> : null}
          <label htmlFor={ids.user}>Username</label>
          <input id={ids.user} className="cb-input" value={username} autoComplete="username" autoCapitalize="none" spellCheck={false} onChange={(e) => { setUsername(e.target.value); setError(null); }} />
          <label htmlFor={ids.pass}>Password</label>
          <span className="cb-field">
            <input id={ids.pass} className="cb-input" type={show ? "text" : "password"} value={password} autoComplete="current-password" onChange={(e) => { setPassword(e.target.value); setError(null); }} />
            <button type="button" className="cb-eye" aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button>
          </span>
          <label className="cb-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
          <button className="cb-submit" type="submit" disabled={!ready}>Sign in</button>
          <nav className="cb-links" aria-label="Help signing in">
            <Link href={`${base}/access/enroll`}>Enroll</Link>
            <Link href={`${base}/access/activate-profile`}>Activate your profile</Link>
            <Link href={`${base}/access/cant-sign-in`}>Can&apos;t sign in?</Link>
          </nav>
          <p className="cb-hint">Sandbox: sign in as <code>jsmith.ops</code> with <code>Passw0rd!</code></p>
        </form>
        <footer className="cb-foot">© Copyright {project.name}. All rights reserved.</footer>
      </main>
      {langAsk ? (
        <div className="cb-scrim" role="presentation">
          <div className="cb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cb-lang-title">
            <h2 id="cb-lang-title">Language</h2>
            <p>Are you sure you want to change language to {other.label}?</p>
            <div className="cb-dialog-actions">
              <button type="button" className="cb-btn" onClick={() => setLangAsk(false)} autoFocus>No</button>
              <button type="button" className="cb-btn cb-btn-primary" onClick={() => { app.setLang(other.code); setLangAsk(false); }}>Yes</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
