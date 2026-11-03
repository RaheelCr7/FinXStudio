"use client";
import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Download, File, FileJson, FileText, Folder } from "lucide-react";
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
          <p className="sub">The source of <b>{current.name}</b>, generated from what is in Studio now. Read only: change things in Studio, then export again.</p>
        </div>
        <div className="spacer" />
        <a className="btn primary" href={`/api/projects/${projectId}/zip`} download><Download size={15} aria-hidden /> Download source</a>
      </div>

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
