"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { personaSummary } from "@finx/bank-client";
import { formatMoney } from "@finx/ui-kit";
import { safeNext } from "@/lib/safe-next";
import { useApp, useAppState } from "./AppProvider";

export function Login() {
  const { app, project } = useApp();
  const s = useAppState();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [submitting, setSubmitting] = useState(false);
  const bw = project.shell === "bankworkx";
  const ur = s.lang === "ur";

  return (
    <main className="wb-login" dir={ur ? "rtl" : "ltr"}>
      <div className="wb-login-card">
        <span className="wb-mark wb-mark-lg" aria-hidden>{project.name.slice(0, 1)}</span>
        <h1>{project.name}</h1>
        <p className="wb-muted">Sign in with a sandbox customer</p>
        <form onSubmit={(e) => { e.preventDefault(); setSubmitting(true); app.login(); router.push(safeNext(next, project.id, `/${project.id}/${bw ? (app.persona.identity ? "personal/home" : "dashboard") : "home"}`)); }}>
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
        <p className="wb-fine">Sandbox build · no real money moves</p>
      </div>
    </main>
  );
}
