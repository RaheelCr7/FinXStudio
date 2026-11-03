"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Download, ExternalLink, File, FileJson, FileText, Folder, FolderDown, GitCommitHorizontal } from "lucide-react";
import type { GeneratedFile, Tag } from "@finx/codegen";
import { useProjects } from "./Projects";

const TAGS: Record<Tag, { label: string; cls: string; help: string }> = {
  generated: { label: "Generated", cls: "chip", help: "Studio rewrites this on every export. Change it in Studio." },
  extendable: { label: "Extendable", cls: "chip accent", help: "Created once. After the first export it is yours." },
  custom: { label: "Custom", cls: "chip pos", help: "Yours from the start. Studio never touches it." },
};
type Node = { name: string; path: string; file?: GeneratedFile; kids: Node[] };

function tree(files: GeneratedFile[]): Node[] {
  const root: Node = { name: "", path: "", kids: [] };
  for (const f of files) {
    let cur = root;
    f.path.split("/").forEach((seg, i, all) => {
      const path = all.slice(0, i + 1).join("/");
      let n = cur.kids.find((k) => k.name === seg);
      if (!n) { n = { name: seg, path, kids: [] }; cur.kids.push(n); }
      if (i === all.length - 1) n.file = f;
      cur = n;
    });
  }
  const sort = (ns: Node[]) => { ns.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name)); ns.forEach((n) => sort(n.kids)); };
  sort(root.kids);
  return root.kids;
}

type Workspace = {
  dir: string; exists: boolean; vscodeUrl: string; push?: string;
  git: { initialised: boolean; branch?: string; remote?: string; changes?: number; last?: { hash: string; subject: string; when: string } };
};

/** The project's folder on this computer: save the files there, open it in VS Code, commit to Git. Studio never pushes. */
function WorkspacePanel({ projectId, name }: { projectId: string; name: string }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setMessage(`Studio export: ${name}`); }, [name]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/workspace`);
    if (r.ok) { setWs(await r.json()); setOff(false); } else setOff(true);
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, done: (res: any) => string) {
    setBusy(true); setNote(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/workspace`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) setNote({ ok: false, text: data.error ?? "That did not work" });
      else { setWs(data); setNote({ ok: true, text: done(data.result) }); }
    } catch { setNote({ ok: false, text: "Could not reach Studio" }); }
    setBusy(false);
  }
  async function copyPush() { if (!ws?.push) return; try { await navigator.clipboard.writeText(ws.push); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }

  if (off) return <div className="card" style={{ marginBottom: 12 }}><div className="faint">Folders, VS Code and Git are available when Studio is open on the computer it runs on (localhost). Use Download source here.</div></div>;
  if (!ws) return null;
  const g = ws.git;
  return (
    <section className="card" style={{ marginBottom: 12 }} aria-label="Project folder">
      <div className="row wrap" style={{ gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <b>Project folder</b>
          <div className="faint mono" style={{ overflowWrap: "anywhere" }}>{ws.dir}</div>
        </div>
        <div className="spacer" />
        <button className="btn" disabled={busy} onClick={() => act({ action: "export" }, (r) => `Saved. ${r.written.length} file${r.written.length === 1 ? "" : "s"} written${r.kept.length ? `, ${r.kept.length} of yours left alone` : ""}${r.written.length === 0 ? ", nothing had changed" : ""}.`)}><FolderDown size={15} aria-hidden /> {ws.exists ? "Update folder" : "Save to folder"}</button>
        <a className="btn" href={ws.exists ? ws.vscodeUrl : undefined} aria-disabled={!ws.exists} style={ws.exists ? undefined : { opacity: 0.5, pointerEvents: "none" }} title={ws.exists ? "Open the folder in VS Code" : "Save to the folder first"}><ExternalLink size={15} aria-hidden /> Open in VS Code</a>
      </div>
      {ws.exists ? (
        <div className="stack" style={{ marginTop: 8 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="chip">{g.initialised ? `Git · ${g.branch}` : "Not in Git yet"}</span>
            {g.initialised ? <span className={g.changes ? "chip warn" : "chip pos"}>{g.changes ? `${g.changes} change${g.changes === 1 ? "" : "s"} not committed` : "Everything committed"}</span> : null}
            {g.last ? <span className="faint">Last: {g.last.subject} · {g.last.hash}</span> : null}
          </div>
          <form className="row wrap" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); void act({ action: "commit", message }, (r) => r?.nothingToCommit ? "Nothing to commit: the folder matches the last commit." : `Committed ${r.hash}.`); }}>
            <input className="input" style={{ flex: 1, minWidth: 220 }} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Commit message" maxLength={200} />
            <button className="btn primary" disabled={busy || !message.trim()}><GitCommitHorizontal size={15} aria-hidden /> Commit</button>
          </form>
          {g.initialised ? (
            <form className="row wrap" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); void act({ action: "remote", url: remote }, () => "Remote connected."); }}>
              <input className="input" style={{ flex: 1, minWidth: 220 }} value={remote} onChange={(e) => setRemote(e.target.value)} placeholder={g.remote ?? "https://github.com/owner/repo.git"} aria-label="Git remote address" />
              <button className="btn" disabled={busy || !remote.trim()}>{g.remote ? "Change remote" : "Connect remote"}</button>
            </form>
          ) : null}
          {ws.push ? (
            <div className="row wrap" style={{ gap: 8 }}>
              <code className="mono faint" style={{ overflowWrap: "anywhere", flex: 1 }}>{ws.push}</code>
              <button className="btn sm" onClick={copyPush} aria-live="polite">{copied ? <><Check size={13} aria-hidden />Copied</> : <><Copy size={13} aria-hidden />Copy push command</>}</button>
            </div>
          ) : null}
          <div className="faint">Studio never pushes. Run the command above in a terminal with your own Git login.</div>
        </div>
      ) : null}
      <div role="status" style={{ marginTop: note ? 8 : 0, color: note ? (note.ok ? "var(--positive)" : "var(--negative)") : undefined }}>{note?.text}</div>
    </section>
  );
}

const icon = (p: string) => (p.endsWith(".json") ? <FileJson size={14} aria-hidden /> : p.endsWith(".md") ? <FileText size={14} aria-hidden /> : <File size={14} aria-hidden />);

export function CodeView({ projectId, files }: { projectId: string; files: GeneratedFile[] }) {
  const { current } = useProjects();
  const nodes = useMemo(() => tree(files), [files]);
  const [sel, setSel] = useState(files.find((f) => f.path === "README.md")?.path ?? files[0]?.path ?? "");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const file = files.find((f) => f.path === sel);
  const lines = useMemo(() => (file?.content ?? "").replace(/\n$/, "").split("\n"), [file]);

  const row = (n: Node, depth: number): React.ReactNode => {
    const pad = { paddingLeft: 10 + depth * 14 };
    if (n.file) {
      return <button key={n.path} className={`code-row ${n.path === sel ? "on" : ""}`} style={pad} onClick={() => setSel(n.path)} title={n.file.note}>{icon(n.name)}<span className="nm">{n.name}</span><span className={`dot ${n.file.tag}`} aria-label={TAGS[n.file.tag].label} /></button>;
    }
    const shut = closed.has(n.path);
    return (
      <div key={n.path}>
        <button className="code-row dir" style={pad} aria-expanded={!shut} onClick={() => setClosed((s) => { const c = new Set(s); shut ? c.delete(n.path) : c.add(n.path); return c; })}>
          {shut ? <ChevronRight size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}<Folder size={14} aria-hidden /><span className="nm">{n.name}</span>
        </button>
        {shut ? null : n.kids.map((k) => row(k, depth + 1))}
      </div>
    );
  };

  async function copy() { if (!file) return; try { await navigator.clipboard.writeText(file.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Code</h1>
          <p className="sub">The source of <b>{current.name}</b>, generated from what is in Studio now. Read only here: change things in Studio, then save to the folder again.</p>
        </div>
        <div className="spacer" />
        <a className="btn primary" href={`/api/projects/${projectId}/zip`} download><Download size={15} aria-hidden /> Download source</a>
      </div>

      <WorkspacePanel projectId={projectId} name={current.name} />

      <div className="code-wrap">
        <nav className="code-tree card" aria-label="Files">{nodes.map((n) => row(n, 0))}</nav>
        <section className="code-main card" aria-label={file?.path}>
          {file ? (
            <>
              <header className="code-head">
                <b className="mono">{file.path}</b>
                <span className={TAGS[file.tag].cls} title={TAGS[file.tag].help}>{TAGS[file.tag].label}</span>
                {file.note ? <span className="faint">{file.note}</span> : null}
                <span className="spacer" />
                <button className="btn sm" onClick={copy} aria-live="polite">{copied ? <><Check size={13} aria-hidden />Copied</> : <><Copy size={13} aria-hidden />Copy</>}</button>
              </header>
              <div className="faint" style={{ padding: "6px 14px", borderBottom: "1px solid var(--border)" }}>{TAGS[file.tag].help}</div>
              <pre className="code-pre" tabIndex={0}><code>{lines.map((l, i) => <div key={i} className="ln"><span className="no" aria-hidden>{i + 1}</span><span className="tx">{l || " "}</span></div>)}</code></pre>
            </>
          ) : <div className="faint" style={{ padding: 20 }}>No files.</div>}
        </section>
      </div>
      <p className="faint" style={{ marginTop: 12 }}>This is the project&rsquo;s configuration, journeys and theme, not the whole app: the shell, renderer and native projects come from the FinX platform repository. See <code>README.md</code> above for how the two fit together.</p>
    </div>
  );
}
