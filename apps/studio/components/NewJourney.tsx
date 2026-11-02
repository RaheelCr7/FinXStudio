"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewJourney() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) { setErr("Enter a name with at least 3 characters"); return; }
    setBusy(true); setErr("");
    const res = await fetch("/api/journeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not create the journey"); return; }
    router.push(`/journeys/${data.slug}`);
  }

  if (!open) return <button className="btn primary" onClick={() => setOpen(true)}>+ New journey</button>;
  return (
    <form onSubmit={create} className="row" aria-label="Create journey">
      <label className="field" style={{ width: 260 }}>
        <span style={{ position: "absolute", left: -9999 }}>Journey name</span>
        <input className="input" autoFocus placeholder="e.g. Pay a bill" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} />
      </label>
      <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
      <button type="button" className="btn" onClick={() => { setOpen(false); setErr(""); }}>Cancel</button>
      {err ? <span role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{err}</span> : null}
    </form>
  );
}
