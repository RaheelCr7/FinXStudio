"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, FolderKanban, Plus } from "lucide-react";
import { PRESETS } from "@finx/ui-kit";
import { useProjects, type ProjectInfo } from "./Projects";

export const Avatar = ({ p, size = 26 }: { p: Pick<ProjectInfo, "name" | "accent">; size?: number }) => (
  <span className="av" style={{ width: size, height: size, borderRadius: size * 0.28, fontSize: size * 0.46, background: `linear-gradient(135deg, ${p.accent}, color-mix(in srgb, ${p.accent} 55%, #000))` }}>{p.name.slice(0, 1).toUpperCase()}</span>
);

/** The sidebar's project block: shows the current bank app and switches between them. */
export function ProjectSwitcher() {
  const { projects, current, setCurrent } = useProjects();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const r = btn.current!.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6 });
    const down = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <>
      <button ref={btn} className="workspace" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={`${current.name} · switch project`}>
        <Avatar p={current} />
        <span className="t"><b>{current.name}</b><span>{PRESETS[current.preset].name} · {current.currency}</span></span>
        <ChevronsUpDown size={14} aria-hidden className="chev" />
      </button>
      {open ? (
        <div ref={menu} className="proj-menu" role="menu" style={{ left: pos.left, top: pos.top }}>
          <div className="mh">Projects</div>
          {projects.map((p) => (
            <button key={p.id} role="menuitemradio" aria-checked={p.id === current.id} className="mi" onClick={() => { setOpen(false); if (p.id !== current.id) setCurrent(p.id); }}>
              <Avatar p={p} size={28} />
              <span className="mt"><b>{p.name}</b><span>{p.bundleId}</span></span>
              {p.id === current.id ? <Check size={16} aria-hidden /> : null}
            </button>
          ))}
          <div className="sep" />
          <button role="menuitem" className="mi" onClick={() => { setOpen(false); router.push("/projects"); }}><span className="ic"><FolderKanban size={16} aria-hidden /></span><span className="mt"><b>All projects</b></span></button>
          <button role="menuitem" className="mi" onClick={() => { setOpen(false); router.push("/projects?new=1"); }}><span className="ic"><Plus size={16} aria-hidden /></span><span className="mt"><b>New project</b></span></button>
        </div>
      ) : null}
    </>
  );
}
