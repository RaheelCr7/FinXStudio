"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { ACTION_INFO, ROLES, ROLE_INFO, can, type Action, type Role } from "@/lib/roles";
import { useWho } from "./Who";

const ACTIONS = Object.keys(ACTION_INFO) as Action[];

export function PeopleView() {
  const router = useRouter();
  const { people, you, can: youCan } = useWho();
  const admin = youCan("people");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("designer");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(method: string, url: string, body?: unknown) {
    setBusy(true); setErr("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "That did not work"); return false; }
    router.refresh(); return true;
  }
  async function add(e: React.FormEvent) { e.preventDefault(); if (await call("POST", "/api/people", { name, role })) setName(""); }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>People and roles</h1>
          <p className="sub">Who can edit, who can publish. {admin ? "You are an Admin, so you can change this page." : `You are ${you.name}, a ${ROLE_INFO[you.role].label}: you can read this page, and an Admin changes it.`}</p>
        </div>
      </div>
      {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13.5 }}>{err}</div> : null}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Role</th><th /></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td><b>{p.name}</b>{p.id === you.id ? <span className="chip accent" style={{ marginLeft: 8 }}>You</span> : null}</td>
                <td>
                  {admin ? (
                    <select className="select" style={{ width: 170 }} value={p.role} disabled={busy} aria-label={`Role of ${p.name}`} onChange={(e) => call("PATCH", `/api/people/${p.id}`, { role: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                    </select>
                  ) : ROLE_INFO[p.role].label}
                </td>
                <td style={{ textAlign: "right" }}>{admin ? <button className="btn sm danger" disabled={busy} onClick={() => { if (window.confirm(`Remove ${p.name}?`)) call("DELETE", `/api/people/${p.id}`); }} aria-label={`Remove ${p.name}`}><Trash2 size={13} aria-hidden />Remove</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {admin ? (
          <form className="row" style={{ padding: 12, borderTop: "1px solid var(--border)", gap: 8, flexWrap: "wrap" }} onSubmit={add}>
            <input className="input" style={{ maxWidth: 260 }} placeholder="Name of a new person" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="select" style={{ width: 170 }} aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}</select>
            <button className="btn primary" disabled={busy || name.trim().length < 2}><Plus size={15} aria-hidden />Add person</button>
          </form>
        ) : null}
      </div>

      <details style={{ marginTop: 24 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>What each role can do</summary>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Role</th>{ACTIONS.map((a) => <th key={a} style={{ textAlign: "center", maxWidth: 150 }}>{ACTION_INFO[a]}</th>)}</tr></thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r}>
                <td><b>{ROLE_INFO[r].label}</b><div className="faint" style={{ fontWeight: 400 }}>{ROLE_INFO[r].blurb}</div></td>
                {ACTIONS.map((a) => <td key={a} style={{ textAlign: "center" }}>{can(r, a) ? <Check size={16} style={{ color: "var(--positive)" }} aria-label="Allowed" /> : <span className="faint" aria-label="Not allowed">–</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </details>
      <p className="faint" style={{ marginTop: 12 }}>Editors cannot publish and reviewers cannot edit, so a change is always published by someone other than the person who made it, unless an Admin does both. Studio has no sign-in yet: &ldquo;Working as&rdquo; in the sidebar is a demo identity. The AI tools and scripts act as the first Admin.</p>
    </div>
  );
}
