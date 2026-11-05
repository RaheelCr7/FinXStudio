"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Undo2 } from "lucide-react";
import { accentProblem, applyLook, completeColors, lookById, lookReport, moodTokens, resolveBrand, workspaceDef, type BrandDef, type WorkspaceId, type WorkspaceTheme } from "@finx/ui-kit";
import { useProjects } from "../Projects";
import { useWho } from "../Who";
import { LookEditor, type Mood } from "./LookEditor";
import { LookPreview } from "./LookPreview";

const TITLE: Record<WorkspaceId, string> = { personal: "Personal", business: "Business" };
const HELP: Record<WorkspaceId, string> = {
  personal: "The customer's own banking. Banks often make this side lighter and softer.",
  business: "A company the customer acts for. Banks often make this side denser and more formal.",
};

/** A balance card in the look's gradient, since that is where workspaces differ most at a glance. */
function BalanceCard({ def, mode }: { def: BrandDef; mode: "light" | "dark" }) {
  const brand = resolveBrand("draft", def);
  const c = completeColors((mode === "dark" ? brand.dark : brand.light).colors);
  return (
    <div style={{ background: `linear-gradient(135deg, ${c.heroFrom}, ${c.heroTo})`, color: "#FFFFFF", borderRadius: brand.radius.xl, padding: 18, display: "flex", flexDirection: "column", gap: 4 }} aria-label="Balance card preview">
      <span style={{ fontSize: 12, opacity: 0.85 }}>Total balance</span>
      <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>12,480.50</span>
    </div>
  );
}

/**
 * The look of one workspace, edited with the same look step as a new project, against the same accessibility report.
 * Saving writes the workspace's entry under the bank in brands.json; "Follow the bank's look" removes it.
 */
export function WorkspaceTab({ workspace }: { workspace: WorkspaceId }) {
  const router = useRouter();
  const { current } = useProjects();
  const { can } = useWho();
  const saved = current.workspaces?.[workspace];
  const [on, setOn] = useState(!!saved);
  // starting a workspace look begins from the bank's own look, so nothing changes until a choice is made
  const [draft, setDraft] = useState<WorkspaceTheme>(saved ?? { preset: current.preset, accent: current.accent });
  const [lookId, setLookId] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [previous, setPrevious] = useState<{ theme: WorkspaceTheme | null } | null>(null);

  const accent = draft.accent ?? current.accent;
  const accentErr = accentProblem(accent.toUpperCase());
  const dirty = on ? JSON.stringify(draft) !== JSON.stringify(saved ?? null) : !!saved;

  // the bank's definition with this draft laid over it, as an app would resolve it
  const preview: BrandDef = useMemo(() => {
    const { brand: _brand, ...bank } = current as BrandDef & { brand?: unknown };
    const safe = accentErr ? { ...draft, accent: current.accent } : draft;
    return workspaceDef({ ...bank, workspaces: { ...(bank.workspaces ?? {}), [workspace]: safe } }, workspace);
  }, [current, draft, workspace, accentErr]);
  const checks = useMemo(() => lookReport(preview), [preview]);

  const chooseLook = (id: string) => {
    const a = applyLook(lookById(id)!);
    setLookId(id); setMood(null);
    setDraft({ ...(draft.name ? { name: draft.name } : {}), ...(draft.mode ? { mode: draft.mode } : {}), preset: a.preset, accent: a.accent, ...(a.look ? { look: a.look } : {}), ...(a.radius ? { radius: a.radius } : {}), ...(a.components ? { components: a.components } : {}) });
  };
  const tune = (m: Mood | null) => {
    setMood(m);
    const { radius: _r, components: _c, ...rest } = draft;
    const base: Pick<WorkspaceTheme, "radius" | "components"> = m ? moodTokens(m.roundness, m.density) : lookId ? applyLook(lookById(lookId)!) : {};
    setDraft({ ...rest, ...(base.radius ? { radius: base.radius } : {}), ...(base.components ? { components: base.components } : {}) });
  };

  async function save(theme: WorkspaceTheme | null, remember = true) {
    setBusy(true); setErr("");
    const res = await fetch(`/api/projects/${current.id}/workspaces`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace, theme }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not save the look"); return; }
    setPrevious(remember ? { theme: data.previous } : null);
    setOn(!!data.theme);
    if (data.theme) setDraft(data.theme);
    router.refresh();
  }

  return (
    <div className="design-wrap">
      <div className="stack" style={{ gap: 14 }}>
        <div className="card" style={{ gap: 10 }}>
          <h3>{TITLE[workspace]}</h3>
          <div className="faint">{HELP[workspace]}</div>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
            <span><b>Give {TITLE[workspace]} its own look</b><div className="faint">Off: it uses {current.name}&rsquo;s own look.</div></span>
          </label>
        </div>
        {on ? (
          <>
            <div className="card" style={{ gap: 10 }}>
              <label className="row" style={{ gap: 10, justifyContent: "space-between" }}>
                <span>Name of the look</span>
                <input className="input" style={{ width: 180 }} maxLength={30} value={draft.name ?? ""} aria-label="Name of the look" placeholder="For example Aurora" onChange={(e) => { const { name: _n, ...rest } = draft; setDraft(e.target.value ? { ...rest, name: e.target.value } : rest); }} />
              </label>
              <label className="row" style={{ gap: 10, justifyContent: "space-between" }}>
                <span>Opens in</span>
                <select className="select" style={{ width: 180 }} aria-label="Appearance it opens in" value={draft.mode ?? ""} onChange={(e) => { const { mode: _m, ...rest } = draft; setDraft(e.target.value ? { ...rest, mode: e.target.value as "light" | "dark" } : rest); }}>
                  <option value="">Follow the device</option><option value="light">Light</option><option value="dark">Dark</option>
                </select>
              </label>
            </div>
            <LookEditor lookId={lookId} accent={accent} accentErr={accentErr} mood={mood} defaultRoundness={preview.radius?.md ?? 12} checks={checks}
              onLook={chooseLook} onAccent={(a) => setDraft({ ...draft, accent: a })} onMood={tune} />
          </>
        ) : null}
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <h3 style={{ flex: 1 }}>Preview{on && draft.name ? ` · ${draft.name}` : ""}</h3>
          <div className="seg" role="group" aria-label="Appearance">
            <button aria-pressed={mode === "light"} onClick={() => setMode("light")}><Sun size={14} aria-hidden />Light</button>
            <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")}><Moon size={14} aria-hidden />Dark</button>
          </div>
        </div>
        <div style={{ maxWidth: 380 }} className="stack">
          <BalanceCard def={on ? preview : current} mode={mode} />
          <LookPreview def={on ? preview : current} mode={mode} />
        </div>
        <div className="card" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn primary" disabled={!dirty || busy || (on && !!accentErr) || !can("projects")} title={can("projects") ? undefined : "Your role cannot change a project's look"} onClick={() => save(on ? draft : null)}>
              {busy ? "Saving…" : on ? `Save the ${TITLE[workspace]} look` : `Follow ${current.name}’s look`}
            </button>
            {dirty ? <button className="btn" onClick={() => { setOn(!!saved); setDraft(saved ?? { preset: current.preset, accent: current.accent }); setLookId(null); setMood(null); }}>Discard changes</button> : null}
          </div>
          <div className="faint">Every journey keeps working; only colours, corners and sizes change. Apps pick the change up the next time they are built.</div>
          {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{err}</div> : null}
          {previous ? <div className="row" role="status" style={{ gap: 8 }}><span className="chip pos dot">Saved</span><button className="btn sm" disabled={busy} onClick={() => save(previous.theme, false)}><Undo2 size={13} aria-hidden />Undo</button></div> : null}
        </div>
      </div>
    </div>
  );
}
