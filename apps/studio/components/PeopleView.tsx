"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { ACTIONS, ACTION_INFO, ACTION_LABEL, SELF_PUBLISH, SELF_PUBLISH_INFO, roleLabel, type Action, type RoleDef, type SelfPublish } from "@/lib/roles";
import type { Activity } from "@/lib/activity";
import { useProjects } from "./Projects";
import { useWho } from "./Who";

type Tab = "people" | "roles" | "rules" | "activity";
const TABS: { id: Tab; label: string }[] = [{ id: "people", label: "People" }, { id: "roles", label: "Roles" }, { id: "rules", label: "Approval rules" }, { id: "activity", label: "Activity" }];

const ACTION_SHORT = ACTION_LABEL;

export function PeopleView({ policies, activity }: { policies: Record<string, SelfPublish>; activity: Activity[] }) {
  const router = useRouter();
  const { you, can, roleName } = useWho();
  const manage = can("people");
  const [tab, setTab] = useState<Tab>("people");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  /** One request to Studio; refreshes the page data on success and returns the answer, or null after showing the error. */
  const call = useCallback(async (method: string, url: string, body?: unknown) => {
    setBusy(true); setErr("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "That did not work"); return null; }
    router.refresh(); return data ?? {};
  }, [router]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>People and roles</h1>
          <p className="sub">{manage ? "You can change this page." : `You are ${you.name}, a ${roleName(you)}: you can read this page, and someone who manages people changes it.`}</p>
        </div>
      </div>
      <div className="seg" role="tablist" aria-label="People sections" style={{ alignSelf: "flex-start", marginTop: 4, marginBottom: 4 }}>
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setErr(""); }}>{t.label}</button>)}
      </div>
      {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13.5 }}>{err}</div> : null}
      {tab === "people" ? <PeopleTab manage={manage} busy={busy} call={call} /> : null}
      {tab === "roles" ? <RolesTab manage={manage} busy={busy} call={call} /> : null}
      {tab === "rules" ? <RulesTab manage={manage} busy={busy} call={call} policies={policies} /> : null}
      {tab === "activity" ? <ActivityTab initial={activity} /> : null}
    </div>
  );
}

type Call = (method: string, url: string, body?: unknown) => Promise<any | null>;

/* ---------------------------------------------------------------- people */

function PeopleTab({ manage, busy, call }: { manage: boolean; busy: boolean; call: Call }) {
  const { people, you, roles, roleName } = useWho();
  const { projects } = useProjects();
  const [name, setName] = useState("");
  const [role, setRole] = useState("designer");
  const [open, setOpen] = useState<string | null>(null);
  const options = roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="tbl">
        <thead><tr><th>Name</th><th>Main role</th><th>Projects</th><th /></tr></thead>
        <tbody>
          {people.map((p) => {
            const extra = Object.entries(p.access ?? {});
            const isOpen = open === p.id;
            return (
              <FragmentRows key={p.id}>
                <tr>
                  <td><b>{p.name}</b>{p.id === you.id ? <span className="chip accent" style={{ marginLeft: 8 }}>You</span> : null}</td>
                  <td>
                    {manage ? (
                      <select className="select" style={{ width: 170 }} value={p.role} disabled={busy} aria-label={`Main role of ${p.name}`} onChange={(e) => call("PATCH", `/api/people/${p.id}`, { role: e.target.value })}>{options}</select>
                    ) : roleName(p)}
                  </td>
                  <td>
                    <button className="btn sm ghost" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                      {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                      {extra.length ? `Different in ${extra.length} project${extra.length === 1 ? "" : "s"}` : "Same in every project"}
                    </button>
                  </td>
                  <td style={{ textAlign: "right" }}>{manage ? <button className="btn sm danger" disabled={busy} onClick={() => { if (window.confirm(`Remove ${p.name}?`)) call("DELETE", `/api/people/${p.id}`); }} aria-label={`Remove ${p.name}`}><Trash2 size={14} aria-hidden />Remove</button> : null}</td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td colSpan={4} style={{ background: "var(--surface-2)" }}>
                      <div className="stack" style={{ gap: 8, padding: "4px 0" }}>
                        <div className="faint">A role in a project replaces the main role there. Creating projects and managing people always follow the main role.</div>
                        {projects.map((pr) => (
                          <div key={pr.id} className="row" style={{ gap: 10 }}>
                            <span style={{ width: 150 }}>{pr.name}</span>
                            {manage ? (
                              <select className="select" style={{ width: 270 }} value={p.access?.[pr.id] ?? ""} disabled={busy} aria-label={`${p.name} in ${pr.name}`} onChange={(e) => call("PATCH", `/api/people/${p.id}`, { access: { [pr.id]: e.target.value || null } })}>
                                <option value="">Same as main role ({roleLabel(p.role, roles)})</option>
                                {options}
                              </select>
                            ) : <span>{p.access?.[pr.id] ? roleLabel(p.access[pr.id]!, roles) : `${roleLabel(p.role, roles)} (main role)`}</span>}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </FragmentRows>
            );
          })}
        </tbody>
      </table>
      {manage ? (
        <form className="row" style={{ padding: 12, borderTop: "1px solid var(--border)", gap: 8, flexWrap: "wrap" }} onSubmit={async (e) => { e.preventDefault(); if (await call("POST", "/api/people", { name, role })) setName(""); }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Name of a new person" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="select" style={{ width: 170 }} aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>{options}</select>
          <button className="btn primary" disabled={busy || name.trim().length < 2}><Plus size={15} aria-hidden />Add person</button>
        </form>
      ) : null}
    </div>
  );
}
const FragmentRows = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/* ----------------------------------------------------------------- roles */

function RolesTab({ manage, busy, call }: { manage: boolean; busy: boolean; call: Call }) {
  const { people, roles } = useWho();
  const [editing, setEditing] = useState<RoleDef | "new" | null>(null);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <p className="sub" style={{ margin: 0 }}>A role is a set of things someone can do. The four built-in roles are fixed; add your own for anything else.</p>
        <div className="spacer" />
        {manage ? <button className="btn primary" onClick={() => setEditing("new")}><Plus size={15} aria-hidden />New role</button> : null}
      </div>
      {editing ? <RoleForm key={editing === "new" ? "new" : editing.id} role={editing === "new" ? null : editing} busy={busy} onCancel={() => setEditing(null)} onSave={async (v) => { if (await call(editing === "new" ? "POST" : "PATCH", editing === "new" ? "/api/roles" : `/api/roles/${editing.id}`, v)) setEditing(null); }} /> : null}
      <div className="grid">
        {roles.map((r) => {
          const holders = people.filter((p) => p.role === r.id || Object.values(p.access ?? {}).includes(r.id));
          return (
            <section key={r.id} className="card" aria-label={r.label}>
              <div className="row"><h3 style={{ flex: 1 }}>{r.label}</h3>{r.builtin ? <span className="chip"><Lock size={11} aria-hidden />Built in</span> : <span className="chip accent">Custom</span>}</div>
              <p className="muted" style={{ margin: 0 }}>{r.blurb || "No description."}</p>
              <div className="row wrap" style={{ gap: 6 }}>{r.actions.map((a) => <span key={a} className="chip pos" title={ACTION_INFO[a]}>{ACTION_SHORT[a]}</span>)}</div>
              <div className="faint">{holders.length ? `${holders.length} ${holders.length === 1 ? "person" : "people"}: ${holders.map((p) => p.name).join(", ")}` : "Nobody has this role yet"}</div>
              {manage && !r.builtin ? (
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => setEditing(r)} disabled={busy}><Pencil size={13} aria-hidden />Edit</button>
                  <button className="btn sm danger" disabled={busy} onClick={() => { if (window.confirm(`Delete the role ${r.label}?`)) call("DELETE", `/api/roles/${r.id}`); }}><Trash2 size={13} aria-hidden />Delete</button>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RoleForm({ role, busy, onCancel, onSave }: { role: RoleDef | null; busy: boolean; onCancel: () => void; onSave: (v: { label: string; blurb: string; actions: Action[] }) => void }) {
  const [label, setLabel] = useState(role?.label ?? "");
  const [blurb, setBlurb] = useState(role?.blurb ?? "");
  const [actions, setActions] = useState<Action[]>(role?.actions ?? ["edit"]);
  const toggle = (a: Action) => setActions((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); onSave({ label, blurb, actions }); }} aria-label={role ? `Edit ${role.label}` : "New role"}>
      <h3>{role ? `Edit ${role.label}` : "New role"}</h3>
      <label className="field">Name<input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoFocus /></label>
      <label className="field">Description <span className="faint">(optional)</span><input className="input" value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={140} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label-section">What this role can do</legend>
        <div className="stack" style={{ gap: 6 }}>
          {ACTIONS.map((a) => (
            <label key={a} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={actions.includes(a)} onChange={() => toggle(a)} style={{ marginTop: 3 }} />
              <span><b>{ACTION_SHORT[a]}</b><span className="faint"> · {ACTION_INFO[a]}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" disabled={busy || label.trim().length < 2 || !actions.length}>{role ? "Save role" : "Create role"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------- approval rules */

function RulesTab({ manage, busy, call, policies }: { manage: boolean; busy: boolean; call: Call; policies: Record<string, SelfPublish> }) {
  const { projects } = useProjects();
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="sub" style={{ margin: 0 }}>Who may publish a change they made themselves. Publishing already needs a role that can publish; this rule adds a second pair of eyes where you want one.</p>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Project</th><th>Publishing your own change</th></tr></thead>
          <tbody>
            {projects.map((p) => {
              const value = policies[p.id] ?? "admin";
              return (
                <tr key={p.id}>
                  <td style={{ verticalAlign: "top" }}><b>{p.name}</b></td>
                  <td>
                    {manage ? (
                      <select className="select" style={{ width: 240 }} value={value} disabled={busy} aria-label={`Rule for ${p.name}`} onChange={(e) => call("PATCH", `/api/projects/${p.id}/policy`, { selfPublish: e.target.value })}>
                        {SELF_PUBLISH.map((r) => <option key={r} value={r}>{SELF_PUBLISH_INFO[r].label}</option>)}
                      </select>
                    ) : <b>{SELF_PUBLISH_INFO[value].label}</b>}
                    <div className="faint" style={{ marginTop: 4, maxWidth: 560 }}>{SELF_PUBLISH_INFO[value].help}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- activity */

const PHRASE: Record<string, string> = {
  "journey.publish": "published", "journey.edit": "edited", "journey.create": "created", "journey.restore": "restored an earlier version of", "journey.add": "added from the catalog",
  "person.add": "added", "person.role": "changed the role of", "person.access": "changed project access for", "person.rename": "renamed", "person.remove": "removed",
  "role.create": "created the role", "role.update": "changed the role", "role.delete": "deleted the role",
  "project.create": "created the project", "project.update": "restyled the project", "policy.update": "changed the approval rule of",
  "workspace.export": "saved to a folder", "workspace.commit": "committed", "workspace.remote": "connected Git for",
};
const KINDS = [["", "Everything"], ["journey", "Journeys"], ["person", "People"], ["role", "Roles"], ["project", "Projects"], ["policy", "Approval rules"], ["workspace", "Code"]] as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function ActivityTab({ initial }: { initial: Activity[] }) {
  const { people } = useWho();
  const { projects, byId } = useProjects();
  const [person, setPerson] = useState(""), [project, setProject] = useState(""), [kind, setKind] = useState("");
  const [rows, setRows] = useState<Activity[]>(initial);
  const [more, setMore] = useState(initial.length >= 50);
  const [loading, setLoading] = useState(false);
  const query = useMemo(() => { const q = new URLSearchParams({ limit: "50" }); if (person) q.set("person", person); if (project) q.set("project", project); if (kind) q.set("kind", kind); return q; }, [person, project, kind]);

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    const q = new URLSearchParams(query); if (before) q.set("before", before);
    const res = await fetch(`/api/activity?${q}`); const data = await res.json().catch(() => ({ activity: [] }));
    setLoading(false);
    const got: Activity[] = data.activity ?? [];
    setRows((cur) => (before ? [...cur, ...got] : got)); setMore(got.length >= 50);
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <select className="select" style={{ width: 170 }} aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)}><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="select" style={{ width: 170 }} aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="select" style={{ width: 170 }} aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      {rows.length === 0 ? <div className="card empty"><h3>No activity yet</h3><p className="muted" style={{ margin: 0 }}>Publishing, restoring, role changes and other work appear here as it happens.</p></div> : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Activity">
            {rows.map((a) => (
              <li key={a.id} className="row" style={{ gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                <span className="faint" style={{ width: 118, flex: "none", fontVariantNumeric: "tabular-nums" }}>{when(a.at)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.actor.name}</b> {PHRASE[a.action] ?? a.action} <b>{a.target}</b>
                  {a.detail ? <span className="muted"> · {a.detail}</span> : null}
                  {a.projectIds?.length ? <span className="faint"> · {a.projectIds.map((id) => byId(id)?.name ?? id).join(", ")}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {more ? <button className="btn" style={{ alignSelf: "flex-start" }} disabled={loading} onClick={() => load(rows.at(-1)?.at)}>{loading ? "Loading…" : "Show older"}</button> : null}
    </div>
  );
}
