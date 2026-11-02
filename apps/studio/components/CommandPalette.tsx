"use client";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CornerDownLeft, Search, Workflow, type LucideIcon } from "lucide-react";

export type Command = { id: string; title: string; group: string; hint?: string; icon?: LucideIcon; keywords?: string; run: () => void };
type Ctx = { open: boolean; setOpen: (v: boolean) => void; register: (owner: string, cmds: Command[]) => () => void };
const C = createContext<Ctx | null>(null);

/** The order groups appear in. Anything not listed comes after, in the order it was registered. */
const GROUP_ORDER = ["This journey", "Screens", "Journeys", "Go to", "General", "Add to this screen"];

export function CommandsProvider({ children, base }: { children: React.ReactNode; base: Command[] }) {
  const [open, setOpen] = useState(false);
  const [registry, setRegistry] = useState<Record<string, Command[]>>({});
  const register = useCallback((owner: string, cmds: Command[]) => {
    setRegistry((r) => ({ ...r, [owner]: cmds }));
    return () => setRegistry((r) => { const { [owner]: _gone, ...rest } = r; return rest; });
  }, []);
  const all = useMemo(() => [...Object.values(registry).flat(), ...base], [registry, base]);
  const value = useMemo(() => ({ open, setOpen, register }), [open, register]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  return <C.Provider value={value}>{children}{open ? <Palette commands={all} close={() => setOpen(false)} /> : null}</C.Provider>;
}

export function useCommandPalette() {
  const ctx = useContext(C); if (!ctx) throw new Error("useCommandPalette needs CommandsProvider");
  return ctx;
}
/** Adds commands to the palette while the calling component is on screen. Pass a memoised array. */
export function useCommands(cmds: Command[]) {
  const { register } = useCommandPalette();
  const owner = useId();
  useEffect(() => register(owner, cmds), [register, owner, cmds]);
}

function matches(c: Command, words: string[]) {
  const hay = `${c.title} ${c.group} ${c.keywords ?? ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

function Palette({ commands, close }: { commands: Command[]; close: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [journeys, setJourneys] = useState<Command[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/journeys").then((r) => r.json()).then((rows: any[]) => {
      if (!live || !Array.isArray(rows)) return;
      setJourneys(rows.map((j) => {
        const name = typeof j.name === "string" ? j.name : j.name?.en ?? j.slug;
        return { id: `j:${j.slug}`, title: name, group: "Journeys", hint: j.publishedVersion == null ? "Draft" : `v${j.publishedVersion}`, icon: Workflow, keywords: j.slug, run: () => router.push(`/journeys/${j.slug}`) };
      }));
    }).catch(() => {});
    return () => { live = false; };
  }, [router]);

  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const pool = [...commands, ...journeys].filter((c) => matches(c, words));
    const rank = (g: string) => { const k = GROUP_ORDER.indexOf(g); return k < 0 ? GROUP_ORDER.length : k; };
    return pool.map((c, n) => ({ c, n })).sort((a, b) => rank(a.c.group) - rank(b.c.group) || a.n - b.n).map((x) => x.c);
  }, [q, commands, journeys]);

  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" }); }, [i]);

  const run = (c?: Command) => { if (!c) return; close(); setTimeout(c.run, 0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(rows.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(rows[i]); }
  };

  let lastGroup = "";
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }} onKeyDown={onKey}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="q"><Search size={18} aria-hidden /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search journeys, screens and actions…" aria-label="Search commands" role="combobox" aria-expanded aria-controls="palette-list" /><kbd>esc</kbd></div>
        <div className="list" id="palette-list" role="listbox" ref={listRef}>
          {rows.length === 0 ? <div className="none">Nothing matches “{q}”.</div> : rows.map((c, n) => {
            const head = c.group !== lastGroup ? <div key={`g:${c.group}`} className="grp">{c.group}</div> : null;
            lastGroup = c.group;
            const Icon = c.icon;
            return (
              <div key={c.id}>
                {head}
                <button className="it" role="option" data-i={n} aria-selected={n === i} onMouseMove={() => setI(n)} onClick={() => run(c)}>
                  <span className="ico">{Icon ? <Icon size={15} aria-hidden /> : null}</span>
                  <span>{c.title}</span>
                  {c.hint ? <span className="h">{c.hint}</span> : null}
                </button>
              </div>
            );
          })}
        </div>
        <div className="foot"><span><ArrowUp size={12} aria-hidden /> <ArrowDown size={12} aria-hidden /> move</span><span><CornerDownLeft size={12} aria-hidden /> open</span><span>esc close</span></div>
      </div>
    </div>
  );
}
