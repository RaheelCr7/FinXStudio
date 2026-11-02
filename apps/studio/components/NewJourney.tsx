"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { useProjects } from "./Projects";

export function NewJourney({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const { projects, current } = useProjects();
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const app = chosen ?? current.id; // starts as the project you are working in
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("finx:new-journey", h); return () => window.removeEventListener("finx:new-journey", h);
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const close = () => { setOpen(false); setErr(""); setName(""); if (defaultOpen) router.replace("/"); };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) { setErr("Enter a name with at least 3 characters"); return; }
    setBusy(true); setErr("");
    const res = await fetch("/api/journeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, apps: [app] }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not create the journey"); return; }
    router.push(`/journeys/${data.slug}`);
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}><Plus size={16} aria-hidden /> New journey</button>
      {open ? (
        <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
          <form className="modal" onSubmit={create} aria-label="Create journey" role="dialog">
            <h2>New journey</h2>
            <p className="muted" style={{ margin: "0 0 16px" }}>Give it a name. You can change everything later.</p>
            <label className="field">Journey name
              <input ref={input} className="input" style={{ height: 40 }} placeholder="e.g. Pay a bill" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} />
            </label>
            <label className="field" style={{ marginTop: 12 }}>Which project is it for?
              <select className="select" style={{ height: 40 }} value={app} onChange={(e) => setChosen(e.target.value)}>
                {projects.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13, marginTop: 8 }}>{err}</div> : null}
            <div className="row" style={{ marginTop: 18 }}>
              <Link href="/agents" className="btn ghost" onClick={() => setOpen(false)}><Sparkles size={15} aria-hidden /> Let Claude draft it</Link>
              <div className="spacer" />
              <button type="button" className="btn" onClick={close}>Cancel</button>
              <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create journey"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
