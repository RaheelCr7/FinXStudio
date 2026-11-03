"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, RotateCcw, Sun, Undo2 } from "lucide-react";
import { resolveComponentTokens, type ComponentTokenOverrides, type ComponentTokens } from "@finx/ui-kit";
import { AppBar, Button, Keypad, ListRow, TextField } from "@finx/components";
import { useProjects } from "../Projects";
import { useWho } from "../Who";
import { Themed } from "./Preview";

const FIELDS: { group: keyof ComponentTokens; title: string; sizes: { key: string; label: string }[] }[] = [
  { group: "field", title: "Text field", sizes: [{ key: "height", label: "Height" }, { key: "radius", label: "Corner radius" }, { key: "border", label: "Border width" }] },
  { group: "button", title: "Button", sizes: [{ key: "height", label: "Height" }, { key: "radius", label: "Corner radius" }] },
  { group: "bar", title: "App bar", sizes: [{ key: "height", label: "Height" }] },
  { group: "row", title: "List row", sizes: [{ key: "height", label: "Height" }, { key: "radius", label: "Corner radius" }] },
  { group: "keypad", title: "Keypad", sizes: [{ key: "key", label: "Key width" }, { key: "keyHeight", label: "Key height" }, { key: "gapX", label: "Gap across" }, { key: "gapY", label: "Gap down" }] },
];

const same = (a: ComponentTokens, b: ComponentTokens) => JSON.stringify(a) === JSON.stringify(b);

/** The sizes of the shared components, edited against a live preview. Saving writes them to the bank's entry in brands.json. */
export function TokensTab() {
  const router = useRouter();
  const { current } = useProjects();
  const { can } = useWho();
  const standard = resolveComponentTokens(undefined, current.brand.radius);
  const saved = resolveComponentTokens(current.components, current.brand.radius);
  const [draft, setDraft] = useState<ComponentTokens>(saved);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [previous, setPrevious] = useState<ComponentTokenOverrides | null>(null);
  const dirty = !same(draft, saved);
  const bar = current.look?.chrome === "bar";
  const outlined = current.look?.fields === "outlined";

  const set = (group: keyof ComponentTokens, key: string, raw: string) => {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return;
    setDraft({ ...draft, [group]: { ...draft[group], [key]: Math.max(0, Math.min(200, n)) } });
  };

  async function save(sizes: ComponentTokens | ComponentTokenOverrides, remember = true) {
    setBusy(true); setErr("");
    const res = await fetch(`/api/projects/${current.id}/components`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ components: sizes }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not save the sizes"); return; }
    setPrevious(remember ? data.previous : null);
    setDraft(resolveComponentTokens(data.components, current.brand.radius));
    router.refresh();
  }

  return (
    <div className="design-wrap">
      <div className="stack" style={{ gap: 14 }}>
        {FIELDS.map((f) => (
          <div key={f.group} className="card" style={{ gap: 10 }}>
            <h3>{f.title}</h3>
            {f.sizes.map((s) => {
              const def = (standard[f.group] as Record<string, number>)[s.key]!;
              const val = (draft[f.group] as Record<string, number>)[s.key]!;
              return (
                <label key={s.key} className="row" style={{ gap: 10, justifyContent: "space-between" }}>
                  <span>{s.label}</span>
                  <span className="row" style={{ gap: 6 }}>
                    {val !== def ? <span className="faint" title="The standard size">was {def}</span> : null}
                    <input className="input mono" style={{ width: 72 }} type="number" min={0} max={200} value={val} aria-label={`${f.title} ${s.label.toLowerCase()} in pixels`} onChange={(e) => set(f.group, s.key, e.target.value)} />
                    <span className="faint">px</span>
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <h3 style={{ flex: 1 }}>Preview</h3>
          <div className="seg" role="group" aria-label="Appearance">
            <button aria-pressed={mode === "light"} onClick={() => setMode("light")}><Sun size={14} aria-hidden />Light</button>
            <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")}><Moon size={14} aria-hidden />Dark</button>
          </div>
        </div>
        <Themed project={current} mode={mode} tokens={draft} style={{ border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", maxWidth: 380 }}>
          <AppBar title="Enroll / Activate" tone={bar ? "bar" : "plain"} onBack={() => {}} onClose={() => {}} />
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <TextField label="Username" value="" look={outlined ? "outlined" : "standard"} />
            <TextField label="Password" value="password1" secure look={outlined ? "outlined" : "standard"} />
            <ListRow label="Enroll your account" icon="user" text="Enroll now to create your digital banking profile" />
            <Keypad />
            <Button label="Continue" />
            <Button label="Cancel" variant="secondary" />
          </div>
        </Themed>
        <div className="card" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn primary" disabled={!dirty || busy || !can("projects")} title={can("projects") ? undefined : "Your role cannot change a project's look"} onClick={() => save(draft)}>{busy ? "Saving…" : `Save for ${current.name}`}</button>
            <button className="btn" disabled={same(draft, standard)} onClick={() => setDraft(standard)}><RotateCcw size={13} aria-hidden />Standard sizes</button>
            {dirty ? <button className="btn" onClick={() => setDraft(saved)}>Discard changes</button> : null}
          </div>
          <div className="faint">Sizes are shared by every screen and both apps. Journeys are not affected. Apps pick the change up the next time they are built.</div>
          {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{err}</div> : null}
          {previous ? <div className="row" role="status" style={{ gap: 8 }}><span className="chip pos dot">Saved</span><button className="btn sm" disabled={busy} onClick={() => save(previous, false)}><Undo2 size={13} aria-hidden />Undo</button></div> : null}
        </div>
      </div>
    </div>
  );
}
