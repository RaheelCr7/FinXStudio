"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Globe, Languages, Layers, Play, Plus, Search, Smartphone, X } from "lucide-react";
import type { Journey } from "@finx/journey-schema";
import type { Shape } from "@/lib/graph";
import { FlowThumb } from "./JourneyList";
import { useProjects } from "./Projects";

const Preview = dynamic(() => import("./Preview").then((m) => m.Preview), { ssr: false, loading: () => <div className="faint">Loading preview…</div> });

export type Entry = {
  id: string; name: string; category: string; summary: string; highlights: string[]; madeFor: string;
  screens: number; languages: string[]; channels: string[]; currencies: string[]; journey: Journey; added: string | null; shape: Shape;
};

export function CatalogView({ entries, categories }: { entries: Entry[]; categories: string[] }) {
  const router = useRouter();
  const { current, byId } = useProjects();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [trying, setTrying] = useState<Entry | null>(null);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((e) => (cat === "all" || e.category === cat) && words.every((w) => `${e.name} ${e.summary} ${e.category} ${e.highlights.join(" ")}`.toLowerCase().includes(w)));
  }, [entries, q, cat]);
  useEffect(() => {
    if (!trying) return;
    const h = (ev: KeyboardEvent) => { if (ev.key === "Escape") setTrying(null); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [trying]);
  const inProject = entries.filter((e) => e.added).length;

  async function add(e: Entry) {
    setBusy(e.id); setErr("");
    const res = await fetch(`/api/catalog/${e.id}/add`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: current.id, publish: live }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setErr(data.error ?? "Could not add the journey"); return; }
    router.refresh();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Catalog</h1>
          <p className="sub">Ready-made journeys for <b>{current.name}</b>. Adding one gives the project its own copy to edit. {inProject ? `${inProject} of ${entries.length} already in this project.` : `${entries.length} available.`}</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="search"><Search size={16} aria-hidden /><input className="input" placeholder="Search the catalog" aria-label="Search the catalog" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg" role="group" aria-label="Category">
          <button aria-pressed={cat === "all"} onClick={() => setCat("all")}>All<span className="n">{entries.length}</span></button>
          {categories.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}<span className="n">{entries.filter((e) => e.category === c).length}</span></button>)}
        </div>
        <div className="spacer" />
        <label className="row" style={{ gap: 8, fontSize: 13.5 }}><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Make live when added</label>
      </div>
      {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13.5 }}>{err}</div> : null}

      {shown.length === 0 ? (
        <div className="card empty"><h3>Nothing matches</h3><p className="muted" style={{ margin: 0 }}>Try another search or category.</p></div>
      ) : (
        <div className="grid">
          {shown.map((e) => {
            const money = e.currencies.length > 0 && !e.currencies.includes(current.currency);
            return (
              <div key={e.id} className="card jcard">
                <button className="thumb" style={{ border: 0, padding: 0, cursor: "pointer" }} onClick={() => setTrying(e)} aria-label={`Try ${e.name}`}>
                  <FlowThumb shape={e.shape} /><span className="open">Try it <Play size={13} aria-hidden /></span>
                </button>
                <div className="body">
                  <div className="row"><h3 style={{ flex: 1 }}>{e.name}</h3><span className="chip">{e.category}</span></div>
                  <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{e.summary}</p>
                  <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{e.highlights.map((h) => <span key={h} className="chip accent">{h}</span>)}</div>
                  <div className="meta">
                    <span title="Screens"><Layers size={14} aria-hidden />{e.screens} screens</span>
                    <span title="Channels">{e.channels.includes("mobile") ? <Smartphone size={14} aria-hidden /> : <Globe size={14} aria-hidden />}{e.channels.join(" + ")}</span>
                    <span title="Languages"><Languages size={14} aria-hidden />{e.languages.map((l) => l.toUpperCase()).join(" · ")}</span>
                  </div>
                  {money ? <div className="chip warn" title={`Made with ${e.currencies.join(", ")} amounts. ${current.name} uses ${current.currency}. Change the amounts after adding.`}>Amounts in {e.currencies.join(", ")}</div> : null}
                  <div className="row" style={{ marginTop: 4 }}>
                    <span className="faint" style={{ fontSize: 12.5 }}>Made for {byId(e.madeFor)?.shortName ?? e.madeFor}</span>
                    <div className="spacer" />
                    <button className="btn sm" onClick={() => setTrying(e)}><Play size={13} aria-hidden /> Try</button>
                    {e.added ? <Link href={`/journeys/${e.added}`} className="btn sm"><Check size={14} aria-hidden /> In project · Open</Link>
                      : <button className="btn sm primary" disabled={busy === e.id} onClick={() => add(e)}><Plus size={14} aria-hidden /> {busy === e.id ? "Adding…" : "Add to project"}</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {trying ? (
        <div className="scrim" style={{ paddingTop: "4vh" }} onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setTrying(null); }}>
          <div className="modal" role="dialog" aria-label={`Try ${trying.name}`} style={{ width: "min(420px, calc(100vw - 32px))", padding: 14 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <h2 style={{ flex: 1, margin: 0 }}>{trying.name}</h2>
              <button className="btn ghost icon" onClick={() => setTrying(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="preview-pane" style={{ height: "min(760px, 80vh)", borderRadius: 12 }}>
              <Preview journey={{ ...trying.journey, apps: [current.id] }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
