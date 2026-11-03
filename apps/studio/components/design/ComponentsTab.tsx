"use client";
import React, { useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { catalog, type ComponentSpec } from "@finx/components";
import { useProjects } from "../Projects";
import { nativeComponents } from "@finx/components/native";
import { NativeThemed, Themed } from "./Preview";

const GROUPS = ["Actions", "Inputs", "Navigation", "Lists", "Verification"] as const;

/** Every shared component with all its states, in the current bank's look. The same components draw the real screens. */
export function ComponentsTab() {
  const { current } = useProjects();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [rtl, setRtl] = useState(false);
  const [platform, setPlatform] = useState<"web" | "native">("web");
  const [name, setName] = useState(catalog[0]!.name);
  const spec = useMemo(() => catalog.find((c) => c.name === name) as ComponentSpec, [name]);

  return (
    <div className="design-wrap" style={{ gridTemplateColumns: "minmax(0,220px) minmax(0,1fr)" }}>
      <nav className="stack" style={{ gap: 14 }} aria-label="Components">
        {GROUPS.map((g) => {
          const items = catalog.filter((c) => c.group === g);
          return items.length ? (
            <div key={g} className="stack" style={{ gap: 4 }}>
              <div className="faint" style={{ fontWeight: 600 }}>{g}</div>
              {items.map((c) => <button key={c.name} className="btn" style={{ justifyContent: "flex-start" }} aria-current={c.name === name ? "true" : undefined} onClick={() => setName(c.name)}>{c.name}</button>)}
            </div>
          ) : null;
        })}
      </nav>

      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}><h2 style={{ margin: 0 }}>{spec.name}</h2><p className="muted" style={{ margin: 0 }}>{spec.purpose}</p></div>
          <div className="seg" role="group" aria-label="Appearance">
            <button aria-pressed={mode === "light"} onClick={() => setMode("light")}><Sun size={14} aria-hidden />Light</button>
            <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")}><Moon size={14} aria-hidden />Dark</button>
          </div>
          <div className="seg" role="group" aria-label="Platform">
            <button aria-pressed={platform === "web"} onClick={() => setPlatform("web")}>Web</button>
            <button aria-pressed={platform === "native"} onClick={() => setPlatform("native")}>Phone app</button>
          </div>
          <div className="seg" role="group" aria-label="Direction">
            <button aria-pressed={!rtl} onClick={() => setRtl(false)}>LTR</button>
            <button aria-pressed={rtl} onClick={() => setRtl(true)}>RTL</button>
          </div>
        </div>

        <div className="comp-states">
          {spec.states.map((st) => (
            <figure key={st.name} className="comp-state">
              <figcaption className="faint">{st.name}</figcaption>
              {platform === "web" ? (
                <Themed project={current} mode={mode} rtl={rtl} tokens={current.components} style={{ padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
                  <spec.Component {...st.props} />
                </Themed>
              ) : (
                <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--border)", background: "#fff" }}>
                  <NativeThemed project={current} mode={mode} rtl={rtl}>{(() => { const N = (nativeComponents as Record<string, React.ComponentType<any>>)[spec.name]!; return <N {...st.props} />; })()}</NativeThemed>
                </div>
              )}
            </figure>
          ))}
        </div>

        <div className="card" style={{ gap: 8 }}>
          <h3>Properties</h3>
          <table className="table"><thead><tr><th>Name</th><th>Type</th><th>Default</th><th>What it does</th></tr></thead>
            <tbody>{spec.props.map((p) => <tr key={p.name}><td className="mono">{p.name}</td><td className="mono">{p.type}</td><td className="mono">{p.default ?? ""}</td><td>{p.description}</td></tr>)}</tbody></table>
        </div>
        <div className="card" style={{ gap: 6 }}>
          <h3>Accessibility</h3>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>{spec.a11y.map((a) => <li key={a}>{a}</li>)}</ul>
          {spec.tokens ? <div className="faint">Sizes set in the Sizes tab: {spec.tokens.join(", ")}</div> : null}
        </div>
      </div>
    </div>
  );
}
