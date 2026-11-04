"use client";
import { useState } from "react";

/** Production sign-in. Shown without the workspace chrome (the layout hides it for this page). */
export default function Login() {
  const [person, setPerson] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ person, password }) });
    if (r.ok) { window.location.assign("/"); return; }
    setError((await r.json().catch(() => ({}))).error ?? "Could not sign in"); setBusy(false);
  }
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 340, display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Sign in to FinX Studio</h1>
        <label style={{ display: "grid", gap: 4 }}>Person id<input value={person} onChange={(e) => setPerson(e.target.value)} autoComplete="username" autoCapitalize="none" required /></label>
        <label style={{ display: "grid", gap: 4 }}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error ? <div role="alert" style={{ color: "var(--danger, #c33)" }}>{error}</div> : null}
        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
