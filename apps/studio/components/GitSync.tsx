"use client";
import { useCallback, useEffect, useState } from "react";
import { GitBranch, LoaderCircle, RefreshCw, Rocket } from "lucide-react";
import { useProjects } from "./Projects";
import type { Plan, SyncResult, DeployResult, Resolution } from "@/lib/gitsync";

const STATE: Record<string, { label: string; cls: string }> = {
  in_sync: { label: "In sync", cls: "pos" }, push: { label: "Studio is newer", cls: "warn" }, pull: { label: "Git is newer", cls: "warn" },
  conflict: { label: "Conflict", cls: "neg" }, new_here: { label: "Not in git", cls: "warn" }, new_in_git: { label: "Only in git", cls: "warn" },
};

/** Keep a project's journeys in a git repository and deploy what is published. Drafts sync both ways; nothing is overwritten without a choice. */
export function GitSync() {
  const { current } = useProjects();
  const project = current.id;
  const [cfg, setCfg] = useState<{ dir: string; branch: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dir, setDir] = useState(""); const [branch, setBranch] = useState("");
  const [choices, setChoices] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState<string | null>("load");
  const [err, setErr] = useState(""); const [msg, setMsg] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const call = async (url: string, init?: RequestInit) => { const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } }); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Failed"); return d; };
  const load = useCallback(async (pull = false) => {
    setBusy("load"); setErr("");
    try { const d = await call(`/api/git?project=${encodeURIComponent(project)}${pull ? "&pull=1" : ""}`); setCfg(d.config); setPlan(d.plan); if (d.config) { setDir(d.config.dir); setBranch(d.config.branch); } else setPlan(null); }
    catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }, [project]);
  useEffect(() => { setChoices({}); setMsg([]); load(); }, [load]);

  const saveCfg = async () => { setBusy("cfg"); setErr(""); try { await call("/api/git", { method: "PUT", body: JSON.stringify({ project, dir, branch }) }); await load(); } catch (e) { setErr((e as Error).message); setBusy(null); } };
  const sync = async () => {
    setBusy("sync"); setErr("");
    try {
      const r: SyncResult = await call("/api/git/sync", { method: "POST", body: JSON.stringify({ project, resolutions: choices }) });
      setMsg([`Pushed ${r.pushed.length}, pulled ${r.pulled.length + r.created.length}${r.committed ? `, commit ${r.committed}` : ""}${r.pushedToRemote ? ", pushed to the remote" : ""}.`, ...r.skipped.map((s) => `${s.slug}: ${s.why}`), ...r.warnings]);
      setChoices({}); await load();
    } catch (e) { setErr((e as Error).message); setBusy(null); }
  };
  const deploy = async () => {
    if (!confirm(`Deploy the published journeys of ${current.name ?? project}? This commits them, tags the commit and pushes the tag.`)) return;
    setBusy("deploy"); setErr("");
    try { const r: DeployResult = await call("/api/git/deploy", { method: "POST", body: JSON.stringify({ project, note }) }); setMsg([`Deployed ${r.journeys.join(", ")} as ${r.tag}${r.pushedToRemote ? " (pushed)" : ""}.`, ...r.warnings]); await load(); }
    catch (e) { setErr((e as Error).message); setBusy(null); }
  };

  const conflicts = plan?.entries.filter((e) => e.state === "conflict") ?? [];
  const unresolved = conflicts.filter((c) => !choices[c.slug]);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1><GitBranch size={20} aria-hidden style={{ verticalAlign: "-3px" }} /> Git sync and deploy</h1><p className="faint" style={{ margin: "4px 0 0" }}>Keep {current.name ?? project}'s journeys in a git repository. Drafts sync both ways; published versions go out only when you deploy.</p></div>
        <div className="spacer" />
        <button className="btn" onClick={() => load(true)} disabled={!!busy || !cfg}>{busy === "load" ? <LoaderCircle size={15} className="spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}Pull and re-check</button>
      </div>
      {err ? <p role="alert" style={{ color: "var(--negative)" }}>{err}</p> : null}
      {msg.length ? <div className="card" role="status" style={{ marginTop: 12 }}>{msg.map((m, i) => <div key={i}>{m}</div>)}</div> : null}

      <section className="card" style={{ marginTop: 20 }} aria-label="Git folder">
        <strong>Git folder</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 2, minWidth: 260 }} value={dir} onChange={(e) => setDir(e.target.value)} placeholder="/Users/you/code/bank-journeys (a git clone)" aria-label="Path of the git clone" />
          <input className="input" style={{ flex: 1, minWidth: 140 }} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch (current if empty)" aria-label="Branch" />
          <button className="btn primary" onClick={saveCfg} disabled={!!busy || !dir}>{busy === "cfg" ? <LoaderCircle size={15} className="spin" aria-hidden /> : null}Save</button>
        </div>
        <p className="faint" style={{ margin: 0 }}>Files go to <code>finx/{project}/&lt;journey&gt;.json</code> in that clone, on that branch. Studio never switches branches, never force-pushes and never deletes files.</p>
      </section>

      {plan ? (
        <section className="card" style={{ marginTop: 20 }} aria-label="Journeys">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Journeys</strong><span className="faint">branch {plan.branch}{plan.remote ? "" : " · no remote"}{plan.fetched ? ` · ${plan.fetched}` : ""}</span><div className="spacer" />
            <button className="btn primary" onClick={sync} disabled={!!busy || !plan.entries.some((e) => e.state !== "in_sync")}>{busy === "sync" ? <LoaderCircle size={15} className="spin" aria-hidden /> : null}Sync now</button>
          </div>
          {plan.branch !== plan.config.branch ? <p role="alert" style={{ color: "var(--negative)", margin: 0 }}>The folder is on {plan.branch}, not {plan.config.branch}. Check out {plan.config.branch} there first.</p> : null}
          {plan.entries.length === 0 ? <p className="faint" style={{ margin: 0 }}>No journeys in this project yet.</p> : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {plan.entries.map((e) => (
                <li key={e.slug} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ minWidth: 200 }}>{e.name}</strong>
                  <span className={`chip ${STATE[e.state]!.cls}`}>{STATE[e.state]!.label}</span>
                  <span className="faint" style={{ flex: 1 }}>{e.detail}</span>
                  {e.state === "conflict" ? (
                    <span role="group" aria-label={`Resolve ${e.name}`} style={{ display: "flex", gap: 6 }}>
                      <button className="btn sm" aria-pressed={choices[e.slug] === "studio"} onClick={() => setChoices({ ...choices, [e.slug]: "studio" })}>Keep Studio's</button>
                      <button className="btn sm" aria-pressed={choices[e.slug] === "git"} onClick={() => setChoices({ ...choices, [e.slug]: "git" })}>Take git's</button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {unresolved.length ? <p className="faint" style={{ margin: 0 }}>{unresolved.length} conflict{unresolved.length === 1 ? "" : "s"} will be left untouched until you choose. Taking git's saves Studio's draft to <code>.data/git-backups</code> first.</p> : null}
        </section>
      ) : null}

      {cfg ? (
        <section className="card" style={{ marginTop: 20 }} aria-label="Deploy">
          <strong>Deploy the web app</strong>
          <p className="faint" style={{ margin: 0 }}>Writes the published journeys to <code>finx/{project}/published/</code>, commits, tags <code>deploy/{project}/&lt;time&gt;</code> and pushes the tag. The repository's deploy workflow builds the web app from the tag. Drafts are never deployed, and a journey with lint findings stops it.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 220 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the tag (optional)" aria-label="Deploy note" maxLength={200} />
            <button className="btn primary" onClick={deploy} disabled={!!busy}>{busy === "deploy" ? <LoaderCircle size={15} className="spin" aria-hidden /> : <Rocket size={15} aria-hidden />}Deploy</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
