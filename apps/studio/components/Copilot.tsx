"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { NewAiTask } from "./NewAiTask";

/** The Builder's "Ask Claude" button: a panel that writes the Claude Code command for this journey, and links to its latest AI run. */
export function Copilot({ slug, name, run, focus, openTick }: { slug: string; name: string; run?: { id: string; status: string; title: string } | null; /** a block picked in the preview */ focus?: string; /** changes when something else asks for the panel to open */ openTick?: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openTick) setOpen(true); }, [openTick]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog"><Sparkles size={15} aria-hidden />Ask Claude</button>
      {open ? (
        <div className="card" role="dialog" aria-label="Ask Claude about this journey" style={{ position: "absolute", right: 0, top: 40, width: 420, maxWidth: "88vw", zIndex: 40, boxShadow: "var(--shadow-lg)", gap: 10 }}>
          <div className="row"><b style={{ flex: 1 }}>Ask Claude about “{name}”</b><button className="btn ghost icon sm" aria-label="Close" onClick={() => setOpen(false)}><X size={14} /></button></div>
          {focus ? <p className="faint" style={{ margin: 0 }}>About {focus}</p> : null}
          <NewAiTask journey={{ slug, name, focus }} compact />
          {run ? <Link href={`/agents/${run.id}`} className="faint" style={{ color: "var(--accent-text)" }}>Latest AI run on this journey: {run.title} ({run.status.replace("_", " ")})</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
