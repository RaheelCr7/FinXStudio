"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleCheck, Eye, EyeOff, Layers, LoaderCircle, Plus, Redo2, Rocket, Settings2, Sparkles, TriangleAlert, Undo2, X } from "lucide-react";
import type { Journey } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { brands } from "@finx/ui-kit";
import { addBlock, addScreen, BLOCK_GROUPS, BLOCK_LABELS, KNOWN_ADAPTERS, sameContent, textOf } from "@/lib/edit";
import { BLOCK_ICONS } from "@/lib/blocks-ui";
import { FlowCanvas } from "./FlowCanvas";
import { Inspector } from "./Inspector";
import { Loc } from "./fields";
import { useCommands, type Command } from "./CommandPalette";

const Preview = dynamic(() => import("./Preview").then((m) => m.Preview), { ssr: false, loading: () => <div className="faint">Loading preview…</div> });

type Rec = { slug: string; draft: Journey; published?: Journey; history: { version: number; publishedAt: string; by: string }[] };
type SaveState = "saved" | "saving" | "error";

const AI_STATUS: Record<string, string> = { running: "building", needs_review: "needs review", done: "published", failed: "failed" };

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query); setMatch(mq.matches);
    const h = () => setMatch(mq.matches); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h);
  }, [query]);
  return match;
}

export function Builder({ initial, aiRun }: { initial: Rec; aiRun?: { id: string; status: string; title: string } | null }) {
  const [journey, setJourney] = useState<Journey>(initial.draft);
  const [published, setPublished] = useState<Journey | undefined>(initial.published);
  const [past, setPast] = useState<Journey[]>([]);
  const [future, setFuture] = useState<Journey[]>([]);
  const [selScreen, setSelScreen] = useState(initial.draft.entryScreen);
  const [selBlock, setSelBlock] = useState<number | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [saveErr, setSaveErr] = useState("");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [dock, setDock] = useState<"edit" | "preview">("edit");
  const [leftTab, setLeftTab] = useState<"screens" | "settings">("screens");
  const [problems, setProblems] = useState(false);
  const [newScreen, setNewScreen] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const wide = useMedia("(min-width: 1600px)");
  const router = useRouter();
  const lastSaved = useRef(JSON.stringify(initial.draft));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const problemsRef = useRef<HTMLDivElement>(null);

  const issues = useMemo(() => lintAll(journey), [journey]);
  const flash = useCallback((text: string, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(null), 4200); }, []);

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
  useEffect(() => {
    if (!problems) return;
    const h = (e: MouseEvent) => { if (problemsRef.current && !problemsRef.current.contains(e.target as Node)) setProblems(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setProblems(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [problems]);

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

  const doPublish = useCallback(async () => {
    if (issues.length) { setProblems(true); flash(`Fix ${issues.length} problem${issues.length > 1 ? "s" : ""} before publishing`, false); return; }
    setPublishing(true);
    if (!(await flush(journey))) { setPublishing(false); return; }
    const res = await fetch(`/api/journeys/${journey.slug}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setPublishing(false); flash(data.error ?? "Publish failed", false); return; }
    const rec = await (await fetch(`/api/journeys/${journey.slug}?env=draft`)).json();
    setPublished(rec.published); setJourney(rec.draft); lastSaved.current = JSON.stringify(rec.draft);
    setPublishing(false); flash(`Published v${data.version} to UAT. Apps load it the next time the journey opens.`);
    router.refresh();
  }, [issues, journey, flush, flash, router]);

  const status = !published ? { t: "Draft · never published", c: "chip dot" } : sameContent(journey, published) ? { t: `Live · v${published.version}`, c: "chip pos dot" } : { t: `Unpublished changes · live is v${published.version}`, c: "chip warn dot" };

  const onAddBlock = useCallback((type: string) => {
    const { journey: j, index } = addBlock(journey, selScreen, type);
    commit(j); setSelBlock(index);
  }, [journey, selScreen, commit]);
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
  const goScreen = useCallback((id: string) => { setSelScreen(id); setSelBlock(null); setLeftTab("screens"); }, []);
  const togglePreview = useCallback(() => { if (wide) setShowPreview((v) => !v); else setDock((d) => (d === "preview" ? "edit" : "preview")); }, [wide]);
  const previewOn = wide ? showPreview : dock === "preview";

  const commands: Command[] = useMemo(() => [
    { id: "b:publish", title: "Publish to UAT", group: "This journey", icon: Rocket, keywords: "release live", run: doPublish },
    { id: "b:undo", title: "Undo", group: "This journey", icon: Undo2, run: undo },
    { id: "b:redo", title: "Redo", group: "This journey", icon: Redo2, run: redo },
    { id: "b:preview", title: previewOn ? "Hide phone preview" : "Show phone preview", group: "This journey", icon: Eye, keywords: "phone", run: togglePreview },
    { id: "b:problems", title: issues.length ? `Show ${issues.length} problem${issues.length > 1 ? "s" : ""}` : "Show problems (none)", group: "This journey", icon: TriangleAlert, keywords: "lint issues", run: () => setProblems(true) },
    ...journey.screens.map((s) => ({ id: `b:s:${s.id}`, title: textOf(s.title), hint: `Screen ${s.id}`, group: "Screens", icon: Layers, keywords: s.id, run: () => goScreen(s.id) })),
    ...BLOCK_GROUPS.flatMap((g) => g.types).map((t) => ({ id: `b:add:${t}`, title: `Add block: ${BLOCK_LABELS[t]}`, group: "Add to this screen", icon: BLOCK_ICONS[t], keywords: "insert new", run: () => onAddBlock(t) })),
  ], [doPublish, undo, redo, previewOn, togglePreview, issues.length, journey.screens, goScreen, onAddBlock]);
  useCommands(commands);

  const gridClass = `builder ${wide && showPreview ? "both" : ""}`;

  return (
    <>
      <div className="topbar">
        <div className="crumbs">
          <Link href="/" aria-label="Back to journeys">Journeys</Link><ChevronRight size={14} aria-hidden style={{ color: "var(--text-3)" }} />
          <span className="cur">{textOf(journey.name)}</span>
        </div>
        <span className={status.c}>{status.t}</span>
        {aiRun ? <Link href={`/agents/${aiRun.id}`} className="chip accent" title={aiRun.title}><Sparkles size={12} aria-hidden /> AI draft · {AI_STATUS[aiRun.status] ?? aiRun.status}</Link> : null}
        <span className="savestate" aria-live="polite">
          {save === "saving" ? <><LoaderCircle size={14} className="spin" aria-hidden />Saving…</> : save === "error" ? <span style={{ color: "var(--negative)" }}><TriangleAlert size={14} aria-hidden style={{ verticalAlign: -2 }} /> {saveErr}</span> : <><Check size={14} aria-hidden />Saved</>}
        </span>
        <div className="spacer" />
        <button className="btn ghost icon" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo (⌘Z)"><Undo2 size={16} /></button>
        <button className="btn ghost icon" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (⇧⌘Z)"><Redo2 size={16} /></button>
        <span className="vsep" />
        <div ref={problemsRef} style={{ position: "relative" }}>
          <button className="btn" onClick={() => setProblems(!problems)} aria-expanded={problems}>
            {issues.length ? <><TriangleAlert size={15} aria-hidden style={{ color: "var(--warning)" }} />{issues.length} problem{issues.length > 1 ? "s" : ""}</> : <><CircleCheck size={15} aria-hidden style={{ color: "var(--positive)" }} />No problems</>}
          </button>
          {problems ? (
            <div className="card" style={{ position: "absolute", right: 0, top: 40, width: 400, zIndex: 40, boxShadow: "var(--shadow-lg)", gap: 6 }} role="dialog" aria-label="Journey problems">
              {issues.length === 0 ? <div className="issue ok"><CircleCheck size={15} aria-hidden />All checks pass: reachable screens, consent, OTP before money moves, bindings, translations.</div> : issues.map((i, k) => (
                <button key={k} className="issue" style={{ border: 0, textAlign: "left", cursor: i.screen ? "pointer" : "default", marginBottom: 0 }} onClick={() => { if (i.screen) { goScreen(i.screen); setProblems(false); } }}>
                  <TriangleAlert size={15} aria-hidden /><span>{i.message}{i.screen ? <span style={{ opacity: 0.7 }}> · {i.screen}</span> : null}</span>
                </button>))}
            </div>
          ) : null}
        </div>
        <button className="btn" onClick={togglePreview} aria-pressed={previewOn} title="Phone preview">{previewOn ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}Preview</button>
        <button className="btn primary" onClick={doPublish} disabled={publishing}>{publishing ? <><LoaderCircle size={15} className="spin" aria-hidden />Publishing…</> : <><Rocket size={15} aria-hidden />Publish to UAT</>}</button>
      </div>

      <div className={gridClass}>
        <aside className="pane left" aria-label="Screens and settings">
          <div className="pane-head">
            <div className="seg" role="tablist" aria-label="Left panel">
              <button role="tab" aria-selected={leftTab === "screens"} onClick={() => setLeftTab("screens")}><Layers size={14} aria-hidden />Screens<span className="n">{journey.screens.length}</span></button>
              <button role="tab" aria-selected={leftTab === "settings"} onClick={() => setLeftTab("settings")}><Settings2 size={14} aria-hidden />Settings</button>
            </div>
          </div>
          {leftTab === "screens" ? (
            <div className="screen-list">
              {journey.screens.map((s, n) => {
                const bad = issues.filter((i) => i.screen === s.id).length;
                return (
                  <div key={s.id} className={`screen-row ${s.id === selScreen ? "on" : ""}`} role="button" tabIndex={0} aria-current={s.id === selScreen}
                    onClick={() => { setSelScreen(s.id); setSelBlock(null); }} onKeyDown={(e) => { if (e.key === "Enter") { setSelScreen(s.id); setSelBlock(null); } }}>
                    <span className="n">{n + 1}</span>
                    <span className="tt"><b>{textOf(s.title)}</b><span>{s.id === journey.entryScreen ? "Start · " : ""}{s.kind === "terminal" ? "End screen" : s.kind === "branch" ? "Branch" : "Screen"} · {s.blocks.length} block{s.blocks.length === 1 ? "" : "s"}</span></span>
                    {bad ? <span title={`${bad} problem${bad > 1 ? "s" : ""}`} style={{ color: "var(--warning)", display: "grid" }}><TriangleAlert size={15} aria-label="Has problems" /></span> : null}
                  </div>
                );
              })}
              {newScreen === null ? <button className="btn" style={{ marginTop: 8 }} onClick={() => setNewScreen("")}><Plus size={15} aria-hidden />Add screen after this</button> : (
                <form onSubmit={onAddScreen} className="stack" style={{ gap: 8, marginTop: 8, padding: 4 }}>
                  <input className="input" autoFocus placeholder="Screen name" aria-label="Screen name" value={newScreen} onChange={(e) => setNewScreen(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setNewScreen(null); }} />
                  <div className="row"><button className="btn sm primary">Add screen</button><button type="button" className="btn sm" onClick={() => setNewScreen(null)}>Cancel</button></div>
                </form>
              )}
            </div>
          ) : (
            <div className="pad">
              <div className="label-section" style={{ marginTop: 0 }}>Journey</div>
              <Loc label="Name" journey={journey} value={journey.name} onChange={(name) => commit({ ...journey, name })} />
              <div className="faint" style={{ marginTop: 8 }}>/{journey.slug} · {journey.locale.supported.join(", ")}</div>

              <div className="label-section">Shown in</div>
              {Object.values(brands).map((br) => {
                const current = journey.apps?.length ? journey.apps : ["meezan"];
                const on = current.includes(br.id);
                return (
                  <label key={br.id} className="row" style={{ gap: 8, padding: "4px 0", fontSize: 13.5 }}>
                    <input type="checkbox" checked={on} onChange={(e) => {
                      const next = e.target.checked ? [...current, br.id] : current.filter((x) => x !== br.id);
                      if (next.length === 0) { flash("A journey must be shown in at least one app", false); return; }
                      commit({ ...journey, apps: next });
                    }} />{br.name}
                  </label>
                );
              })}
              <div className="faint">An app only shows the journeys that list it. A journey with none listed belongs to Meezan Digital.</div>

              <div className="label-section">Integrations</div>
              {journey.integrations.length === 0 ? <div className="faint" style={{ marginBottom: 8 }}>No integrations yet. Add one to let buttons call the bank.</div> : null}
              {journey.integrations.map((i) => (
                <div key={i.id} className="row" style={{ marginBottom: 6, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 9 }}>
                  <span style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis" }}><b>{i.id}</b> <span className="muted">{i.adapter.replace("bank.", "")}</span></span>
                  <button className="btn sm ghost icon danger" aria-label={`Remove ${i.id}`} onClick={() => commit({ ...journey, integrations: journey.integrations.filter((x) => x.id !== i.id) })}><X size={14} /></button>
                </div>
              ))}
              <select className="select" value="" aria-label="Add integration" onChange={(e) => addIntegration(e.target.value)}>
                <option value="">+ Add integration…</option>
                {KNOWN_ADAPTERS.filter((a) => !journey.integrations.some((i) => i.id === a.id)).map((a) => <option key={a.id} value={a.adapter}>{a.adapter.replace("bank.", "")}</option>)}
              </select>

              {initial.history.length ? <><div className="label-section">Publish history</div>{[...initial.history].reverse().slice(0, 6).map((h) => <div key={h.version} className="row" style={{ padding: "4px 0", fontSize: 12.5 }}><span className="chip pos">v{h.version}</span><span className="muted">{h.publishedAt.slice(0, 10)}</span><span className="faint">{h.by}</span></div>)}</> : null}
            </div>
          )}
        </aside>

        <section className="canvas" aria-label="Journey flow">
          <FlowCanvas journey={journey} selected={selScreen} issues={issues} onSelect={(id) => { setSelScreen(id); setSelBlock(null); }} />
        </section>

        {wide ? (
          <>
            <Inspector journey={journey} screenId={selScreen} blockIndex={selBlock} issues={issues} onChange={commit} onSelectBlock={setSelBlock} onSelectScreen={(id) => setSelScreen(id)} onAddBlock={onAddBlock} />
            {showPreview ? <aside className="pane right preview-pane" aria-label="Preview"><Preview journey={journey} /></aside> : null}
          </>
        ) : (
          <aside className="pane right" aria-label={dock === "preview" ? "Preview" : "Inspector"} style={{ display: "flex", flexDirection: "column" }}>
            <div className="pane-head">
              <div className="seg" role="tablist" aria-label="Right panel">
                <button role="tab" aria-selected={dock === "edit"} onClick={() => setDock("edit")}>Edit</button>
                <button role="tab" aria-selected={dock === "preview"} onClick={() => setDock("preview")}>Phone preview</button>
              </div>
            </div>
            {dock === "preview" ? <div className="preview-pane" style={{ flex: 1, minHeight: 0 }}><Preview journey={journey} /></div> : (
              <Inspector bare journey={journey} screenId={selScreen} blockIndex={selBlock} issues={issues} onChange={commit} onSelectBlock={setSelBlock} onSelectScreen={(id) => setSelScreen(id)} onAddBlock={onAddBlock} />
            )}
          </aside>
        )}
      </div>
      {toast ? <div className="toast" role="status"><span className={`ok ${toast.ok ? "" : "warn"}`}>{toast.ok ? <Check size={15} aria-hidden strokeWidth={3} /> : <TriangleAlert size={14} aria-hidden />}</span>{toast.text}</div> : null}
    </>
  );
}
