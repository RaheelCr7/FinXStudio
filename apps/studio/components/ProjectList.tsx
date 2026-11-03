"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Copy, Plus, Smartphone, Terminal } from "lucide-react";
import { PRESETS } from "@finx/ui-kit";
import { Avatar } from "./ProjectSwitcher";
import { useProjects, type ProjectInfo } from "./Projects";
import { useWho } from "./Who";
import { NewProjectWizard, type Starter } from "./NewProjectWizard";

export type ProjectRow = ProjectInfo & { journeys: number; live: number };

export const buildCommands = (id: string) => [
  { label: "On the iPhone Simulator", cmd: `pnpm ios:sim --brand ${id} --install` },
  { label: "As an Android app", cmd: `pnpm android:apk --brand ${id} --install` },
  { label: "In a browser", cmd: `EXPO_PUBLIC_FINX_BRAND=${id} pnpm --filter @finx/bank-app web` },
];

function CopyLine({ label, cmd }: { label: string; cmd: string }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <div className="faint" style={{ marginBottom: 4 }}>{label}</div>
      <div className="cmd"><code>{cmd}</code>
        <button className="btn sm" aria-live="polite" onClick={async () => { try { await navigator.clipboard.writeText(cmd); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ } }}>{done ? <><Check size={13} aria-hidden />Copied</> : <><Copy size={13} aria-hidden />Copy</>}</button>
      </div>
    </div>
  );
}

export function ProjectList({ projects, starters, defaultNew }: { projects: ProjectRow[]; starters: Starter[]; defaultNew: boolean }) {
  const router = useRouter();
  const { current, setCurrent } = useProjects();
  const { can } = useWho();
  const [wizard, setWizard] = useState(defaultNew);
  const [showBuild, setShowBuild] = useState<string | null>(null);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Each project is one bank app: its own name, look, journeys and customers, built from the same platform.</p>
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setWizard(true)} disabled={!can("projects")} title={can("projects") ? undefined : "Your role cannot create projects"}><Plus size={16} aria-hidden /> New project</button>
      </div>

      <div className="grid">
        {projects.map((p) => (
          <div key={p.id} className="card pcard">
            <div className="band" style={{ background: `linear-gradient(135deg, ${p.brand.light.colors.heroFrom ?? p.accent}, ${p.accent})` }}>
              <Avatar p={p} size={44} />
            </div>
            <div className="body">
              <div className="row"><h3 style={{ flex: 1 }}>{p.name}</h3>{p.id === current.id ? <span className="chip accent dot">Current</span> : null}</div>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="chip">{PRESETS[p.preset].name} look</span><span className="chip">{p.currency}</span>
                <span className="chip pos">{p.live} live</span>{p.journeys - p.live > 0 ? <span className="chip warn">{p.journeys - p.live} draft</span> : null}
              </div>
              <div className="faint">App id <code>{p.bundleId}</code></div>
              <div className="row" style={{ marginTop: 2 }}>
                <button className="btn sm primary" onClick={() => { setCurrent(p.id); router.push("/"); }}>Open journeys <ArrowUpRight size={14} aria-hidden /></button>
                <button className="btn sm" aria-expanded={showBuild === p.id} onClick={() => setShowBuild(showBuild === p.id ? null : p.id)}><Smartphone size={14} aria-hidden />Build the app</button>
              </div>
              {showBuild === p.id ? (
                <div className="stack" style={{ gap: 8, marginTop: 4 }}>
                  {buildCommands(p.id).map((c) => <CopyLine key={c.cmd} {...c} />)}
                  <div className="faint"><Terminal size={12} aria-hidden style={{ verticalAlign: -1 }} /> Run these in the FinX Studio folder. The first build makes the app icons from the accent colour.</div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {wizard ? <NewProjectWizard starters={starters} onClose={() => { setWizard(false); if (defaultNew) router.replace("/projects"); }} /> : null}
    </div>
  );
}
