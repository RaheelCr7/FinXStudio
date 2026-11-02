"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, Clock, FilePlus2, Globe, Languages, Layers, Search, Smartphone, Sparkles } from "lucide-react";
import type { Shape } from "@/lib/graph";
import { NewJourney } from "./NewJourney";

export type Row = {
  slug: string; name: any; publishedVersion: number | null; draftDiffers: boolean; screens: number; channels: string[];
  updatedAt: string; issues: number; languages: string[]; apps: string[]; shape: Shape;
};
type Filter = "all" | "live" | "changes" | "draft" | "issues";

const en = (t: any) => (typeof t === "string" ? t : t?.en ?? "");
const ur = (t: any) => (typeof t === "object" && t ? t.ur ?? "" : "");

/** "3 hours ago" style time, computed after mount so server and browser output never disagree. */
function Ago({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
    const hit = steps.find(([, s]) => Math.abs(secs) >= s);
    setText(hit ? rtf.format(Math.round(secs / hit[1]), hit[0]) : "just now");
  }, [iso]);
  return <>{text || " "}</>;
}

const NODE = { w: 190, h: 64 };
/** The thumbnail: nodes as rounded boxes joined by curves, coloured like the real canvas. */
function FlowThumb({ shape }: { shape: Shape }) {
  const X = 250, Y = 96;
  const pos = new Map(shape.nodes.map((n) => [n.id, { x: n.x * X, y: n.y * Y, n }]));
  const xs = shape.nodes.map((n) => n.x * X), ys = shape.nodes.map((n) => n.y * Y);
  // Small journeys are centred in a minimum frame so their boxes stay the same size as everyone else's
  const rawW = Math.max(...xs, 0) + NODE.w + 80, rawH = Math.max(...ys, 0) + NODE.h + 80;
  const w = Math.max(rawW, 1500), h = Math.max(rawH, 400);
  const minX = Math.min(0, ...xs) - 40 - (w - rawW) / 2, minY = Math.min(0, ...ys) - 40 - (h - rawH) / 2;
  const stroke = (k: string, entry: boolean) => entry ? "var(--accent)" : k === "terminal" ? "var(--positive)" : k === "branch" ? "var(--warning)" : "var(--border-strong)";
  const fill = (k: string) => k === "terminal" ? "var(--positive-bg)" : k === "branch" ? "var(--warning-bg)" : "var(--surface)";
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Flow of the journey" style={{ padding: 6 }}>
      {shape.edges.map((e, i) => {
        const a = pos.get(e.from), b = pos.get(e.to); if (!a || !b) return null;
        const x1 = a.x + NODE.w, y1 = a.y + NODE.h / 2, x2 = b.x, y2 = b.y + NODE.h / 2, m = Math.max(40, Math.abs(x2 - x1) / 2);
        const back = x2 <= x1;
        const d = back ? `M${a.x + NODE.w / 2} ${a.y + NODE.h} C${a.x + NODE.w / 2} ${a.y + NODE.h + 60} ${b.x + NODE.w / 2} ${b.y + NODE.h + 60} ${b.x + NODE.w / 2} ${b.y + NODE.h}` : `M${x1} ${y1} C${x1 + m} ${y1} ${x2 - m} ${y2} ${x2} ${y2}`;
        return <path key={i} d={d} fill="none" stroke={e.kind === "error" ? "var(--negative)" : e.kind === "rule" ? "var(--warning)" : "var(--text-3)"} strokeOpacity={e.kind === "flow" ? 0.55 : 0.7} strokeWidth={4} strokeDasharray={e.kind === "flow" ? undefined : "10 8"} />;
      })}
      {shape.nodes.map((n) => (
        <g key={n.id}>
          <rect x={n.x * X} y={n.y * Y} width={NODE.w} height={NODE.h} rx={16} fill={fill(n.kind)} stroke={stroke(n.kind, n.entry)} strokeWidth={n.entry ? 5 : 3} />
          <rect x={n.x * X + 22} y={n.y * Y + 17} width={96} height={10} rx={5} fill="var(--text-3)" opacity={0.45} />
          <rect x={n.x * X + 22} y={n.y * Y + 37} width={58} height={9} rx={4.5} fill="var(--border-strong)" />
        </g>
      ))}
    </svg>
  );
}

function Status({ r }: { r: Row }) {
  if (r.publishedVersion == null) return <span className="chip dot">Draft</span>;
  if (r.draftDiffers) return <span className="chip warn dot">Unpublished changes</span>;
  return <span className="chip pos dot">Live · v{r.publishedVersion}</span>;
}

export function JourneyList({ journeys, defaultNew }: { journeys: Row[]; defaultNew: boolean }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const counts = useMemo(() => ({
    all: journeys.length,
    live: journeys.filter((j) => j.publishedVersion != null && !j.draftDiffers).length,
    changes: journeys.filter((j) => j.publishedVersion != null && j.draftDiffers).length,
    draft: journeys.filter((j) => j.publishedVersion == null).length,
    issues: journeys.filter((j) => j.issues > 0).length,
  }), [journeys]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return journeys.filter((j) => {
      const hay = `${en(j.name)} ${j.slug}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
      return f === "all" || (f === "live" && j.publishedVersion != null && !j.draftDiffers) || (f === "changes" && j.publishedVersion != null && j.draftDiffers) || (f === "draft" && j.publishedVersion == null) || (f === "issues" && j.issues > 0);
    });
  }, [journeys, q, f]);

  const tabs: [Filter, string][] = [["all", "All"], ["live", "Live"], ["changes", "Changed"], ["draft", "Drafts"], ["issues", "Needs attention"]];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Journeys</h1>
          <p className="sub">{counts.all === 0 ? "Build your first journey, or describe it and let Claude draft it." : `${counts.all} journey${counts.all === 1 ? "" : "s"} · ${counts.live} live${counts.changes ? ` · ${counts.changes} with unpublished changes` : ""}${counts.draft ? ` · ${counts.draft} draft${counts.draft === 1 ? "" : "s"}` : ""}`}</p>
        </div>
        <div className="spacer" />
        <Link href="/agents" className="btn"><Sparkles size={15} aria-hidden /> Create with Claude</Link>
        <NewJourney defaultOpen={defaultNew} />
      </div>

      {journeys.length > 0 ? (
        <div className="toolbar">
          <div className="search"><Search size={16} aria-hidden /><input className="input" placeholder="Search journeys" aria-label="Search journeys" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="seg" role="group" aria-label="Filter journeys">
            {tabs.filter(([k]) => k === "all" || counts[k] > 0).map(([k, label]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{label}<span className="n">{counts[k]}</span></button>)}
          </div>
        </div>
      ) : null}

      {journeys.length === 0 ? (
        <div className="card empty">
          <span className="glyph"><FilePlus2 size={24} aria-hidden /></span>
          <h3>No journeys yet</h3>
          <p className="muted" style={{ margin: 0, maxWidth: "44ch" }}>A journey is one customer task, like sending money or paying a bill. Start from a blank one here, or describe it and Claude drafts it for you.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty"><h3>No journeys match</h3><p className="muted" style={{ margin: 0 }}>Try another search or filter.</p></div>
      ) : (
        <div className="grid">
          {shown.map((j) => (
            <Link key={j.slug} href={`/journeys/${j.slug}`} className="card jcard" aria-label={`Open ${en(j.name)}`}>
              <div className="thumb"><FlowThumb shape={j.shape} /><span className="open">Open <ArrowUpRight size={14} aria-hidden /></span></div>
              <div className="body">
                <div className="row"><h3 style={{ flex: 1 }}>{en(j.name)}</h3><Status r={j} /></div>
                <div className="row" style={{ marginTop: -2 }}><span className="chip accent">{(j.apps.length ? j.apps : ["meezan"]).map((a) => (a === "bankworkx" ? "BankWorkx" : a === "meezan" ? "Meezan Digital" : a)).join(" · ")}</span></div>
                {ur(j.name) ? <div className="ur" dir="rtl" lang="ur" style={{ textAlign: "left" }}>{ur(j.name)}</div> : null}
                <div className="meta">
                  <span title="Screens"><Layers size={14} aria-hidden />{j.screens} screens</span>
                  <span title="Channels">{j.channels.includes("mobile") ? <Smartphone size={14} aria-hidden /> : <Globe size={14} aria-hidden />}{j.channels.join(" + ")}</span>
                  <span title="Languages"><Languages size={14} aria-hidden />{j.languages.map((l) => l.toUpperCase()).join(" · ")}</span>
                  <span title="Last edited"><Clock size={14} aria-hidden /><Ago iso={j.updatedAt} /></span>
                  {j.issues ? <span style={{ color: "var(--warning)", fontWeight: 600 }}><CircleAlert size={14} aria-hidden />{j.issues} to fix</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
