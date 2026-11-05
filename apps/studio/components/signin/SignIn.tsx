"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { AmbientScene, type Pointer } from "./AmbientScene";
import { normalisePerson, rememberPerson, rememberedPerson, signInOutcome, validateSignIn, type FieldErrors } from "@/lib/signin";

/**
 * The sign-in screen. In the production profile it signs in through POST /api/auth/login (password, signed session).
 * The demo profile has no passwords, so there the screen says so and only plays the states (checking, signed in) before
 * opening the workspace; nothing is sent and nothing is checked. That is the only place the two differ.
 */
export type SignInMode = "production" | "demo";
type Phase = "idle" | "busy" | "ok";

const SUCCESS_PAUSE_MS = 700, DEMO_CHECK_MS = 900;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function SignIn({ mode }: { mode: SignInMode }) {
  const [person, setPerson] = useState(""), [password, setPassword] = useState(""), [remember, setRemember] = useState(false);
  const [shown, setShown] = useState(false), [help, setHelp] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({}), [alert, setAlert] = useState(""), [phase, setPhase] = useState<Phase>("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointer = useRef<Pointer>({ x: 0, y: 0 });
  const root = useRef<HTMLElement>(null), personRef = useRef<HTMLInputElement>(null), passwordRef = useRef<HTMLInputElement>(null);
  const ids = { person: useId(), password: useId(), help: useId(), demo: useId() };

  useEffect(() => {
    const saved = rememberedPerson(window.localStorage);
    if (saved) { setPerson(saved); setRemember(true); }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply(); mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // depth on desktop: the pointer's offset from the centre, eased by CSS and by the scene
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (reducedMotion || e.pointerType !== "mouse") return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2, y = (e.clientY / window.innerHeight - 0.5) * 2;
    pointer.current = { x, y };
    root.current?.style.setProperty("--px", x.toFixed(3)); root.current?.style.setProperty("--py", y.toFixed(3));
  }, [reducedMotion]);
  const onPointerLeave = useCallback(() => { pointer.current = { x: 0, y: 0 }; root.current?.style.setProperty("--px", "0"); root.current?.style.setProperty("--py", "0"); }, []);

  const busy = phase !== "idle";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found = validateSignIn({ person, password });
    setErrors(found); setAlert("");
    if (found.person) { personRef.current?.focus(); return; }
    if (found.password) { passwordRef.current?.focus(); return; }
    setPhase("busy");
    if (mode === "demo") {
      await wait(DEMO_CHECK_MS);
      rememberPerson(window.localStorage, person, remember);
      setPhase("ok"); await wait(SUCCESS_PAUSE_MS);
      window.location.assign("/");
      return;
    }
    let outcome: ReturnType<typeof signInOutcome>;
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ person: normalisePerson(person), password }) });
      const retry = Number(r.headers.get("Retry-After"));
      outcome = signInOutcome(r.status, await r.json().catch(() => null), Number.isFinite(retry) ? retry : undefined);
    } catch { outcome = { kind: "error", locked: false, message: "Could not reach Studio. Check your connection and try again." }; }
    if (outcome.kind === "ok") {
      rememberPerson(window.localStorage, person, remember);
      setPhase("ok"); await wait(SUCCESS_PAUSE_MS);
      window.location.assign("/");
      return;
    }
    setPhase("idle"); setAlert(outcome.message); setPassword("");
    if (!outcome.locked) passwordRef.current?.focus();
  }

  const label = phase === "busy" ? (mode === "demo" ? "Opening workspace…" : "Checking…") : phase === "ok" ? "Signed in" : "Sign in";

  return (
    <main ref={root} className="signin" data-mode={mode} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <section className="si-stage">
        <div className="si-mesh" aria-hidden="true" />
        <div className="si-grid" aria-hidden="true" />
        <AmbientScene pointer={pointer} reducedMotion={reducedMotion} />
        <div className="si-copy">
          <p className="si-eyebrow" style={{ "--i": 0 } as React.CSSProperties}><span className="si-dot" aria-hidden="true" />FinX Studio</p>
          <p className="si-headline" style={{ "--i": 1 } as React.CSSProperties}>The Future <em>Starts Here.</em></p>
          <p className="si-tagline" style={{ "--i": 2 } as React.CSSProperties}>One intelligent platform. Infinite possibilities.</p>
          <ul className="si-pills" style={{ "--i": 3 } as React.CSSProperties} aria-label="What Studio covers">
            <li>Journeys</li><li>Rules</li><li>Sandbox</li><li>Audit</li>
          </ul>
        </div>
      </section>

      <section className="si-side">
        <form className="si-panel" noValidate onSubmit={submit} aria-busy={busy} data-phase={phase}>
          <div className="si-brand"><span className="si-mark" aria-hidden="true"><span /></span>FinX Studio</div>
          <h1 className="si-title">Welcome back</h1>
          <p className="si-sub">Sign in to your workspace.</p>
          {mode === "demo" ? (
            <p className="si-demo" id={ids.demo} role="note"><span className="si-demo-tag">Demo profile</span>Sign-in is simulated here: nothing is checked or sent. Production asks for a password.</p>
          ) : null}

          <div className="si-field">
            <label className="si-label" htmlFor={ids.person}>Person id</label>
            <div className="si-input-wrap">
              <input ref={personRef} id={ids.person} className="si-input" value={person} onChange={(e) => { setPerson(e.target.value); if (errors.person) setErrors({ ...errors, person: undefined }); }}
                autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="your id, for example alex" disabled={busy}
                aria-invalid={errors.person ? true : undefined} aria-describedby={[errors.person ? `${ids.person}-err` : "", mode === "demo" ? ids.demo : ""].filter(Boolean).join(" ") || undefined} />
            </div>
            {errors.person ? <p className="si-err" id={`${ids.person}-err`}><AlertCircle size={14} aria-hidden="true" />{errors.person}</p> : null}
          </div>

          <div className="si-field">
            <label className="si-label" htmlFor={ids.password}>Password</label>
            <div className="si-input-wrap">
              <input ref={passwordRef} id={ids.password} className="si-input" type={shown ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                autoComplete="current-password" placeholder="••••••••••" disabled={busy}
                aria-invalid={errors.password ? true : undefined} aria-describedby={errors.password ? `${ids.password}-err` : undefined} />
              <button type="button" className="si-eye" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"} disabled={busy}>
                {shown ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {errors.password ? <p className="si-err" id={`${ids.password}-err`}><AlertCircle size={14} aria-hidden="true" />{errors.password}</p> : null}
          </div>

          <div className="si-row">
            <label className="si-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} />Remember me</label>
            <button type="button" className="si-link" onClick={() => setHelp((h) => !h)} aria-expanded={help} aria-controls={ids.help}>Forgot password?</button>
          </div>
          {help ? <p className="si-help" id={ids.help}>Passwords are set on the People page. Ask an admin to reset yours; they will tell you the new one in person.</p> : null}

          {alert ? <div className="si-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{alert}</span></div> : null}

          <button type="submit" className="si-btn" data-phase={phase} disabled={busy}>
            <span className="si-btn-ink" aria-hidden="true" />
            {phase === "busy" ? <span className="si-spinner" aria-hidden="true" /> : null}
            {phase === "ok" ? <Check size={18} aria-hidden="true" /> : null}
            <span>{label}</span>
          </button>
          <p className="sr-only" aria-live="polite">{phase === "busy" ? "Checking your details" : phase === "ok" ? "Signed in, opening your workspace" : ""}</p>

          <footer className="si-foot"><span>Sessions last 8 hours</span><span aria-hidden="true">·</span><span>Sign-ins are logged</span></footer>
        </form>
      </section>
    </main>
  );
}
