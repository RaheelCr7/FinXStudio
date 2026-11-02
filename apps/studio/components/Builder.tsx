"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { lintJourney, type Journey } from "@finx/journey-schema";
import { addBlock, addScreen, BLOCK_GROUPS, BLOCK_LABELS, KNOWN_ADAPTERS, sameContent, textOf } from "@/lib/edit";
import { FlowCanvas } from "./FlowCanvas";
import { Inspector } from "./Inspector";
import { Loc } from "./fields";

const Preview = dynamic(() => import("./Preview").then((m) => m.Preview), { ssr: false, loading: () => <div className="faint">Loading preview…</div> });

type Rec = { slug: string; draft: Journey; published?: Journey; history: { version: number; publishedAt: string; by: string }[] };
type SaveState = "saved" | "saving" | "error";

export function Builder({ initial }: { initial: Rec }) {
  const [journey, setJourney] = useState<Journey>(initial.draft);
  const [published, setPublished] = useState<Journey | undefined>(initial.published);
  const [past, setPast] = useState<Journey[]>([]);
  const [future, setFuture] = useState<Journey[]>([]);
  const [selScreen, setSelScreen] = useState(initial.draft.entryScreen);
  const [selBlock, setSelBlock] = useState<number | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [saveErr, setSaveErr] = useState("");
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState(true);
  const [problems, setProblems] = useState(false);
  const [newScreen, setNewScreen] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const lastSaved = useRef(JSON.stringify(initial.draft));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const issues = useMemo(() => lintJourney(journey), [journey]);
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(""), 3600); }, []);

  const commit = useCallback((next: Journey) => {
    setPast((p) => [...p.slice(-49), journey]); setFuture([]); setJourney(next);
  }, [journey]);
  const undo = useCallback(() => { const p = past[past.length - 1]; if (!p) return; setPast(past.slice(0, -1)); setFuture([journey, ...future]); setJourney(p); }, [past, future, journey]);
  const redo = useCallback(() => { const n = future[0]; if (!n) return; setFuture(future.slice(1)); setPast([...past, journey]); setJourney(n); }, [past, future, journey]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault(); e.shiftKey ? redo() : undo();
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  const flush = useCallback(async (j: Journey) => {
    const body = JSON.stringify(j);
    if (body === lastSaved.current) { setSave("saved"); return true; }
    setSave("saving");
    try {
      const res = await fetch(`/api/journeys/${j.slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
      const data = await res.json();
      if (!res.ok) { setSave("error"); setSaveErr(data.error ?? "Save failed"); return false; }
      lastSaved.current = body; setSave("saved"); setSaveErr(""); return true;
    } catch { setSave("error"); setSaveErr("Cannot reach the server"); return false; }
  }, []);

  useEffect(() => {
    if (JSON.stringify(journey) === lastSaved.current) return;
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { flush(journey); }, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [journey, flush]);

  async function doPublish() {
    if (issues.length) { setProblems(true); flash(`Fix ${issues.length} problem${issues.length > 1 ? "s" : ""} before publishing`); return; }
    setPublishing(true);
    if (!(await flush(journey))) { setPublishing(false); return; }
    const res = await fetch(`/api/journeys/${journey.slug}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setPublishing(false); flash(data.error ?? "Publish failed"); return; }
    const rec = await (await fetch(`/api/journeys/${journey.slug}?env=draft`)).json();
    setPublished(rec.published); setJourney(rec.draft); lastSaved.current = JSON.stringify(rec.draft);
    setPublishing(false); flash(`Published v${data.version} to UAT. Apps load it the next time the journey opens.`);
  }

  const status = !published ? { t: "Draft · never published", c: "chip" } : sameContent(journey, published) ? { t: `Published v${published.version}`, c: "chip pos" } : { t: `Unpublished changes · live is v${published.version}`, c: "chip warn" };

  function onAddBlock(type: string) {
    const { journey: j, index } = addBlock(journey, selScreen, type);
    commit(j); setSelBlock(index);
  }
  function onAddScreen(e: React.FormEvent) {
    e.preventDefault();
    if (!newScreen || newScreen.trim().length < 2) return;
    const { journey: j, id } = addScreen(journey, newScreen.trim(), selScreen);
    commit(j); setSelScreen(id); setSelBlock(null); setNewScreen(null);
  }
  function addIntegration(adapter: string) {
    const k = KNOWN_ADAPTERS.find((a) => a.adapter === adapter); if (!k || journey.integrations.some((i) => i.id === k.id)) return;
    commit({ ...journey, integrations: [...journey.integrations, { id: k.id, adapter: k.adapter, mode: "sandbox" }] });
  }

  return (
    <>
      <div className="subbar">
        <Link href="/" className="btn sm" aria-label="Back to journeys">← Journeys</Link>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{textOf(journey.name)}</div>
        <span className={status.c}>{status.t}</span>
        <span className="faint" aria-live="polite">{save === "saving" ? "Saving…" : save === "error" ? <span style={{ color: "var(--negative)" }}>{saveErr}</span> : "All changes saved"}</span>
        <div className="spacer" />
        <button className="btn sm" onClick={undo} disabled={!past.length} aria-label="Undo">↶ Undo</button>
        <button className="btn sm" onClick={redo} disabled={!future.length} aria-label="Redo">↷ Redo</button>
        <div style={{ position: "relative" }}>
          <button className={`btn sm ${issues.length ? "" : ""}`} onClick={() => setProblems(!problems)} aria-expanded={problems}>
            {issues.length ? <span style={{ color: "var(--warning)" }}>⚠ {issues.length} problem{issues.length > 1 ? "s" : ""}</span> : <span style={{ color: "var(--positive)" }}>✓ No problems</span>}
          </button>
          {problems ? (
            <div className="card" style={{ position: "absolute", right: 0, top: 36, width: 380, zIndex: 20, boxShadow: "0 12px 32px rgba(14,18,23,.18)" }} role="dialog" aria-label="Journey problems">
              {issues.length === 0 ? <div className="issue ok">All checks pass: reachable screens, consent, OTP before money moves, bindings, translations.</div> : issues.map((i, k) => (
                <button key={k} className="issue" style={{ border: 0, textAlign: "left", cursor: i.screen ? "pointer" : "default" }} onClick={() => { if (i.screen) { setSelScreen(i.screen); setSelBlock(null); setProblems(false); } }}>
                  <span>⚠</span><span>{i.message}{i.screen ? <span style={{ opacity: 0.7 }}> · {i.screen}</span> : null}</span>
                </button>))}
            </div>
          ) : null}
        </div>
        <button className="btn sm" onClick={() => setPreview(!preview)} aria-pressed={preview}>{preview ? "Hide preview" : "Show preview"}</button>
        <button className="btn primary" onClick={doPublish} disabled={publishing}>{publishing ? "Publishing…" : "Publish to UAT"}</button>
      </div>

      <div className={`builder ${preview ? "with-preview" : ""}`}>
        <aside className="pane left" aria-label="Screens and blocks">
          <div className="label-section" style={{ marginTop: 0 }}>Screens</div>
          {journey.screens.map((s) => (
            <div key={s.id} className={`screen-row ${s.id === selScreen ? "on" : ""}`} role="button" tabIndex={0} onClick={() => { setSelScreen(s.id); setSelBlock(null); }} onKeyDown={(e) => { if (e.key === "Enter") { setSelScreen(s.id); setSelBlock(null); } }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{textOf(s.title)}</span>
              {s.kind === "terminal" ? <span className="chip pos">end</span> : s.kind === "branch" ? <span className="chip warn">branch</span> : null}
              {issues.some((i) => i.screen === s.id) ? <span title="Has problems" style={{ color: "var(--warning)" }}>⚠</span> : null}
            </div>
          ))}
          {newScreen === null ? <button className="btn sm" style={{ marginTop: 8, width: "100%", justifyContent: "center" }} onClick={() => setNewScreen("")}>+ Add screen after this</button> : (
            <form onSubmit={onAddScreen} className="stack" style={{ gap: 6, marginTop: 8 }}>
              <input className="input" autoFocus placeholder="Screen name" aria-label="Screen name" value={newScreen} onChange={(e) => setNewScreen(e.target.value)} />
              <div className="row"><button className="btn sm primary">Add</button><button type="button" className="btn sm" onClick={() => setNewScreen(null)}>Cancel</button></div>
            </form>
          )}

          <div className="label-section">Add block to “{textOf(journey.screens.find((s) => s.id === selScreen)?.title ?? "")}”</div>
          {BLOCK_GROUPS.map((g) => (
            <div key={g.name} style={{ marginBottom: 8 }}>
              <div className="faint" style={{ marginBottom: 4 }}>{g.name}</div>
              {g.types.map((t) => <button key={t} className="palette-item" onClick={() => onAddBlock(t)}><span aria-hidden>＋</span>{BLOCK_LABELS[t]}</button>)}
            </div>
          ))}

          <div className="label-section">Integrations</div>
          {journey.integrations.map((i) => (
            <div key={i.id} className="row" style={{ marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}><b>{i.id}</b> <span className="muted">{i.adapter.replace("bank.", "")}</span></span>
              <button className="btn sm icon danger" aria-label={`Remove ${i.id}`} onClick={() => commit({ ...journey, integrations: journey.integrations.filter((x) => x.id !== i.id) })}>✕</button>
            </div>
          ))}
          <select className="select" value="" aria-label="Add integration" onChange={(e) => addIntegration(e.target.value)}>
            <option value="">+ Add integration…</option>
            {KNOWN_ADAPTERS.filter((a) => !journey.integrations.some((i) => i.id === a.id)).map((a) => <option key={a.id} value={a.adapter}>{a.adapter.replace("bank.", "")}</option>)}
          </select>

          <div className="label-section">Journey</div>
          <Loc label="Name" journey={journey} value={journey.name} onChange={(name) => commit({ ...journey, name })} />
          <div className="faint" style={{ marginTop: 8 }}>/{journey.slug} · {journey.locale.supported.join(", ")}</div>
          {initial.history.length ? <><div className="label-section">History</div>{[...initial.history].reverse().slice(0, 4).map((h) => <div key={h.version} className="faint">v{h.version} · {h.publishedAt.slice(0, 10)} · {h.by}</div>)}</> : null}
        </aside>

        <section className="canvas" aria-label="Journey flow">
          <FlowCanvas journey={journey} selected={selScreen} issues={issues} onSelect={(id) => { setSelScreen(id); setSelBlock(null); }} />
        </section>

        <Inspector journey={journey} screenId={selScreen} blockIndex={selBlock} issues={issues} onChange={commit} onSelectBlock={setSelBlock} onSelectScreen={(id) => setSelScreen(id)} />

        {preview ? <aside className="pane right preview-pane" style={{ background: "var(--surface-2)", display: "flex", justifyContent: "center" }} aria-label="Preview"><Preview journey={journey} /></aside> : null}
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
