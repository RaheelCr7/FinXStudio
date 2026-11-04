"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import { useWho } from "./Who";

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Sidebar footer: who you are working as. Switching shows what each role can and cannot do. */
export function UserSwitcher() {
  const { people, you, setYou, roleName, production } = useWho();
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); };
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  useEffect(() => {
    if (!open) return;
    const r = btn.current!.getBoundingClientRect();
    setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    const down = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <>
      <button ref={btn} className="workspace who" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={`${you.name} · ${roleName(you)}${production ? "" : " · switch person"}`}>
        <span className="av" style={{ width: 26, height: 26, borderRadius: 8, fontSize: 11, background: "var(--accent-solid)" }}>{initials(you.name)}</span>
        <span className="t"><b>{you.name}</b><span>{roleName(you)}</span></span>
        <ChevronsUpDown size={14} aria-hidden className="chev" />
      </button>
      {open ? (
        <div ref={menu} className="proj-menu" role="menu" style={{ left: pos.left, bottom: pos.bottom, top: "auto" }}>
          <div className="mh">{production ? "Signed in" : "Working as"}</div>
          {(production ? people.filter((p) => p.id === you.id) : people).map((p) => (
            <button key={p.id} role="menuitemradio" aria-checked={p.id === you.id} className="mi" onClick={() => { setOpen(false); if (p.id !== you.id) setYou(p.id); }}>
              <span className="av" style={{ width: 28, height: 28, borderRadius: 8, fontSize: 11, background: "var(--text-3)" }}>{initials(p.name)}</span>
              <span className="mt"><b>{p.name}</b><span>{roleName(p)}</span></span>
              {p.id === you.id ? <Check size={16} aria-hidden /> : null}
            </button>
          ))}
          <div className="sep" />
          <button role="menuitem" className="mi" onClick={() => { setOpen(false); router.push("/people"); }}><span className="ic"><Users size={16} aria-hidden /></span><span className="mt"><b>People and roles</b></span></button>
          {production
            ? <button role="menuitem" className="mi" onClick={signOut}><span className="mt"><b>Sign out</b></span></button>
            : <div className="faint" style={{ padding: "4px 10px 8px", fontSize: 11.5 }}>A demo identity: the demo profile has no sign-in.</div>}
        </div>
      ) : null}
    </>
  );
}
