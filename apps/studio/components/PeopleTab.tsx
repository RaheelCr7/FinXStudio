"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Plus, Search, Trash2, X } from "lucide-react";
import { ACTIONS, ACTION_LABEL, roleLabel } from "@/lib/roles";
import { avatarTone, effectiveActions, initials, recentBy, roleHeld, summarise } from "@/lib/people-view";
import type { Activity } from "@/lib/activity";
import { useProjects } from "./Projects";
import { useWho, type PersonInfo } from "./Who";

type Call = (method: string, url: string, body?: unknown) => Promise<any | null>;
type View = "cards" | "matrix";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const PHRASE: Record<string, string> = {
  "journey.publish": "Published", "journey.edit": "Edited", "journey.create": "Created", "journey.restore": "Restored", "journey.add": "Added",
  "person.add": "Added", "person.role": "Changed the role of", "person.access": "Changed access for", "person.remove": "Removed", "role.create": "Created the role", "role.update": "Changed the role",
  "project.create": "Created", "project.update": "Restyled", "policy.update": "Changed the rule of", "workspace.export": "Saved", "workspace.commit": "Committed", "workspace.remote": "Connected Git for",
};

function Avatar({ person, size = 40 }: { person: PersonInfo; size?: number }) {
  return <span className={`avatar tone-${avatarTone(person.id)}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>{initials(person.name)}</span>;
}

export function PeopleTab({ manage, busy, call, activity }: { manage: boolean; busy: boolean; call: Call; activity: Activity[] }) {
  const { people, you, roles, roleName } = useWho();
  const { projects } = useProjects();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [view, setView] = useState<View>("cards");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const stats = useMemo(() => summarise(people, projects, roles), [people, projects, roles]);
  const shown = people.filter((p) => (!roleFilter || p.role === roleFilter) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const open = people.find((p) => p.id === openId) ?? null;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stats">
        <div className="stat"><b>{stats.people}</b><span>People</span></div>
        <div className="stat"><b>{stats.publishers}</b><span>Can publish</span></div>
        <div className="stat"><b>{stats.managers}</b><span>Manage people</span></div>
        <div className="stat"><b>{stats.special}</b><span>With project-specific roles</span></div>
      </div>

      <div className="toolbar">
        <div className="search"><Search size={16} aria-hidden /><input className="input" placeholder="Search people" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 170 }} aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === "cards"} onClick={() => setView("cards")}>Cards</button>
          <button aria-pressed={view === "matrix"} onClick={() => setView("matrix")}>Access by project</button>
        </div>
        <div className="spacer" />
        {manage ? <button className="btn primary" onClick={() => setAdding(true)}><Plus size={15} aria-hidden />Add person</button> : null}
      </div>

      {adding ? <AddPerson busy={busy} onCancel={() => setAdding(false)} onAdd={async (name, role) => { if (await call("POST", "/api/people", { name, role })) setAdding(false); }} /> : null}

      {shown.length === 0 ? <div className="card empty"><h3>No one matches</h3><p className="muted" style={{ margin: 0 }}>Try another name or role.</p></div> : view === "cards" ? (
        <div className="people-grid">
          {shown.map((p) => {
            const last = recentBy(p.id, activity, 1)[0];
            const can = effectiveActions(p, undefined, roles);
            return (
              <section key={p.id} className="card person" aria-label={p.name}>
                <div className="row" style={{ gap: 12 }}>
                  <Avatar person={p} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row" style={{ gap: 8 }}><h3 style={{ fontSize: 15 }}>{p.name}</h3>{p.id === you.id ? <span className="chip accent">You</span> : null}</div>
                    <div className="faint">{roleName(p)}{Object.keys(p.access ?? {}).length ? ` · different in ${Object.keys(p.access!).length}` : ""}</div>
                  </div>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {can.length ? can.map((a) => <span key={a} className="chip pos">{ACTION_LABEL[a]}</span>) : <span className="faint">Read only</span>}
                </div>
                <div className="access-chips">
                  {projects.map((pr) => { const h = roleHeld(p, pr.id); return <span key={pr.id} className={`chip ${h.special ? "accent" : ""}`} title={h.special ? `${pr.name}: ${roleLabel(h.role, roles)} instead of ${roleName(p)}` : `${pr.name}: main role`}>{pr.name} · {roleLabel(h.role, roles)}</span>; })}
                </div>
                <div className="faint person-last"><Clock size={12} aria-hidden />{last ? `${PHRASE[last.action] ?? last.action} ${last.target} · ${when(last.at)}` : "No activity yet"}</div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => setOpenId(p.id)}>{manage ? "Manage access" : "View access"}</button>
                  {manage ? <button className="btn sm danger" disabled={busy} onClick={() => { if (window.confirm(`Remove ${p.name}?`)) void call("DELETE", `/api/people/${p.id}`); }} aria-label={`Remove ${p.name}`}><Trash2 size={13} aria-hidden />Remove</button> : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="tbl matrix">
            <thead><tr><th>Person</th><th>Main role</th>{projects.map((pr) => <th key={pr.id}>{pr.name}</th>)}</tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td><button className="linklike" onClick={() => setOpenId(p.id)}><Avatar person={p} size={26} /><b>{p.name}</b></button></td>
                  <td>{roleName(p)}</td>
                  {projects.map((pr) => { const h = roleHeld(p, pr.id); return <td key={pr.id}><span className={`chip ${h.special ? "accent" : ""}`}>{roleLabel(h.role, roles)}</span></td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? <ManagePanel person={open} manage={manage} busy={busy} call={call} activity={activity} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

function AddPerson({ busy, onCancel, onAdd }: { busy: boolean; onCancel: () => void; onAdd: (name: string, role: string) => void }) {
  const { roles } = useWho();
  const [name, setName] = useState(""), [role, setRole] = useState("designer");
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); onAdd(name, role); }} aria-label="Add a person">
      <h3>Add a person</h3>
      <div className="row wrap" style={{ gap: 8 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Full name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <select className="select" style={{ width: 190 }} aria-label="Main role" value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <button className="btn primary" disabled={busy || name.trim().length < 2}><Plus size={15} aria-hidden />Add</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
      <div className="faint">You can give them a different role in a project afterwards.</div>
    </form>
  );
}

/** One person: their main role, their role in each project, what that lets them do there, and what they did lately. */
function ManagePanel({ person, manage, busy, call, activity, onClose }: { person: PersonInfo; manage: boolean; busy: boolean; call: Call; activity: Activity[]; onClose: () => void }) {
  const { roles, roleName, you, production } = useWho();
  const { projects } = useProjects();
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  const options = roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>);
  const recent = recentBy(person.id, activity, 5);
  return (
    <div className="scrim" style={{ justifyContent: "flex-end", alignItems: "stretch" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Access for ${person.name}`}>
        <header className="row" style={{ gap: 12 }}>
          <Avatar person={person} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ margin: 0 }}>{person.name}</h2><div className="faint">{roleName(person)} · main role</div></div>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close" autoFocus><X size={16} aria-hidden /></button>
        </header>

        <section className="stack" style={{ gap: 8 }}>
          <div className="label-section">Roles</div>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ width: 150 }}>Main role</span>
            {manage ? <select className="select" style={{ width: 260 }} value={person.role} disabled={busy} aria-label={`Main role of ${person.name}`} onChange={(e) => call("PATCH", `/api/people/${person.id}`, { role: e.target.value })}>{options}</select> : <b>{roleName(person)}</b>}
          </div>
          {projects.map((pr) => (
            <div key={pr.id} className="row" style={{ gap: 10 }}>
              <span style={{ width: 150 }}>{pr.name}</span>
              {manage ? (
                <select className="select" style={{ width: 260 }} value={person.access?.[pr.id] ?? ""} disabled={busy} aria-label={`${person.name} in ${pr.name}`} onChange={(e) => call("PATCH", `/api/people/${person.id}`, { access: { [pr.id]: e.target.value || null } })}>
                  <option value="">Same as main role ({roleName(person)})</option>{options}
                </select>
              ) : <span>{roleName(person, pr.id)}</span>}
            </div>
          ))}
          <div className="faint">A project role replaces the main role in that project. Creating projects and managing people follow the main role.</div>
        </section>

        {production && (manage || person.id === you.id) ? <PasswordForm person={person} own={person.id === you.id} busy={busy} call={call} /> : null}

        <section className="stack" style={{ gap: 8 }}>
          <div className="label-section">What they can do</div>
          <div className="card" style={{ padding: 0, overflow: "auto" }}>
            <table className="tbl matrix">
              <thead><tr><th /><th>{"Everywhere else"}</th>{projects.map((pr) => <th key={pr.id}>{pr.name}</th>)}</tr></thead>
              <tbody>
                {ACTIONS.map((a) => (
                  <tr key={a}>
                    <td>{ACTION_LABEL[a]}</td>
                    <td className="tick">{effectiveActions(person, undefined, roles).includes(a) ? <Check size={15} className="ok" aria-label="Allowed" /> : <span className="faint" aria-label="Not allowed">–</span>}</td>
                    {projects.map((pr) => <td key={pr.id} className="tick">{effectiveActions(person, pr.id, roles).includes(a) ? <Check size={15} className="ok" aria-label="Allowed" /> : <span className="faint" aria-label="Not allowed">–</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="stack" style={{ gap: 6 }}>
          <div className="label-section">Recent activity</div>
          {recent.length ? recent.map((a) => <div key={a.id} className="row" style={{ gap: 10, alignItems: "flex-start" }}><span className="faint" style={{ width: 112, flex: "none" }}>{when(a.at)}</span><span>{PHRASE[a.action] ?? a.action} <b>{a.target}</b>{a.detail ? <span className="muted"> · {a.detail}</span> : null}</span></div>) : <div className="faint">Nothing yet.</div>}
        </section>
      </aside>
    </div>
  );
}

/** Production sign-in: set or change a password. You give your current one for your own; a manager can set anyone's. */
function PasswordForm({ person, own, busy, call }: { person: PersonInfo; own: boolean; busy: boolean; call: Call }) {
  const [current, setCurrent] = useState(""), [pw, setPw] = useState(""), [again, setAgain] = useState("");
  const [done, setDone] = useState(false);
  const tooShort = pw.length > 0 && pw.length < 12, mismatch = again.length > 0 && again !== pw;
  const ready = pw.length >= 12 && pw === again && (!own || current.length > 0);
  return (
    <form className="stack" style={{ gap: 8 }} aria-label={`Password for ${person.name}`} onSubmit={async (e) => {
      e.preventDefault(); setDone(false);
      if (await call("PUT", `/api/people/${person.id}/password`, own ? { current, password: pw } : { password: pw })) { setDone(true); setCurrent(""); setPw(""); setAgain(""); }
    }}>
      <div className="label-section">{own ? "Your password" : `Password for ${person.name}`}</div>
      {own ? <label className="field">Current password<input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setDone(false); }} /></label> : null}
      <label className="field">New password <span className="faint">(at least 12 characters)</span><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setDone(false); }} aria-invalid={tooShort} /></label>
      <label className="field">Type it again<input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setDone(false); }} aria-invalid={mismatch} /></label>
      {tooShort ? <div className="faint" role="status">Use at least 12 characters. A few random words work well.</div> : null}
      {mismatch ? <div className="faint" role="status">The two passwords are different.</div> : null}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" disabled={busy || !ready}>{own ? "Change my password" : "Set password"}</button>
        {done ? <span role="status" className="ok">Password saved.</span> : null}
      </div>
      {!own ? <div className="faint">They can change it themselves after signing in. The old password stops working at once.</div> : null}
    </form>
  );
}
