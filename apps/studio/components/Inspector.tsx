"use client";
import type { Journey, LintIssue } from "@finx/journey-schema";
import { BLOCK_LABELS, blockSummary, deleteScreen, moveBlock, removeBlock, textOf, updateScreen } from "@/lib/edit";
import { BindField, Field, Loc, ScreenSelect } from "./fields";

type Props = { journey: Journey; screenId: string; blockIndex: number | null; issues: LintIssue[]; onChange: (j: Journey) => void; onSelectBlock: (i: number | null) => void; onSelectScreen: (id: string) => void };

const ACTION_TYPES = ["validate", "navigate", "callApi", "showToast", "exit"] as const;

function ActionsEditor({ actions, journey, onChange }: { actions: any[]; journey: Journey; onChange: (a: any[]) => void }) {
  const set = (i: number, patch: any) => onChange(actions.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const swap = (i: number, d: number) => { const n = [...actions]; const [a] = n.splice(i, 1); n.splice(i + d, 0, a); onChange(n); };
  return (
    <div className="stack" style={{ gap: 8 }}>
      {actions.map((a, i) => (
        <div key={i} className="card" style={{ padding: 10, gap: 8, borderRadius: 10 }}>
          <div className="row">
            <select className="select" style={{ flex: 1 }} value={a.type} aria-label="Action type" onChange={(e) => {
              const t = e.target.value;
              onChange(actions.map((x, k) => k !== i ? x : t === "navigate" ? { type: t, to: journey.screens[0]?.id } : t === "callApi" ? { type: t, integration: journey.integrations[0]?.id ?? "" } : t === "showToast" ? { type: t, text: "Message" } : { type: t }));
            }}>{ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <button className="btn sm icon" disabled={i === 0} onClick={() => swap(i, -1)} aria-label="Move action up">↑</button>
            <button className="btn sm icon" disabled={i === actions.length - 1} onClick={() => swap(i, 1)} aria-label="Move action down">↓</button>
            <button className="btn sm icon danger" onClick={() => onChange(actions.filter((_, k) => k !== i))} aria-label="Remove action">✕</button>
          </div>
          {a.type === "navigate" ? <ScreenSelect journey={journey} label="Go to" value={a.to} onChange={(to) => set(i, { to })} /> : null}
          {a.type === "callApi" ? (
            <>
              <Field label="Integration">
                <select className="select" value={a.integration} onChange={(e) => set(i, { integration: e.target.value })}>
                  {journey.integrations.length === 0 ? <option value="">Add an integration first</option> : null}
                  {journey.integrations.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.adapter}</option>)}
                </select>
              </Field>
              <Field label="Save result as"><input className="input mono" value={a.saveAs ?? ""} onChange={(e) => set(i, { saveAs: e.target.value || undefined })} placeholder="ctx.accounts" /></Field>
              <ScreenSelect journey={journey} label="On error go to" allowNone value={a.onError?.navigate} onChange={(to) => set(i, { onError: to ? { ...(a.onError ?? {}), navigate: to } : undefined })} />
            </>
          ) : null}
          {a.type === "showToast" ? <Loc label="Message" journey={journey} value={a.text} onChange={(text) => set(i, { text })} /> : null}
        </div>
      ))}
      <select className="select" value="" aria-label="Add action" onChange={(e) => { if (!e.target.value) return; const t = e.target.value; onChange([...actions, t === "navigate" ? { type: t, to: journey.screens[0]?.id } : t === "callApi" ? { type: t, integration: journey.integrations[0]?.id ?? "" } : t === "showToast" ? { type: t, text: "Message" } : { type: t }]); }}>
        <option value="">+ Add action…</option>{ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}

function BlockEditor({ b, journey, onChange }: { b: any; journey: Journey; onChange: (patch: any) => void }) {
  const num = (v: string) => (v === "" ? undefined : isNaN(Number(v)) ? v : Number(v));
  return (
    <div className="stack">
      {b.type === "text" ? (<><Loc label="Text" journey={journey} value={b.text} onChange={(text) => onChange({ text })} multiline />
        <Field label="Style"><select className="select" value={b.variant ?? "body"} onChange={(e) => onChange({ variant: e.target.value })}><option value="title">Title</option><option value="body">Body</option><option value="caption">Caption</option></select></Field></>) : null}
      {b.type === "alert" ? (<><Field label="Tone"><select className="select" value={b.tone} onChange={(e) => onChange({ tone: e.target.value })}>{["info", "warning", "error", "success"].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Loc label="Text" journey={journey} value={b.text} onChange={(text) => onChange({ text })} multiline /></>) : null}
      {b.type === "result" ? (<><Field label="Tone"><select className="select" value={b.tone} onChange={(e) => onChange({ tone: e.target.value })}><option>success</option><option>error</option></select></Field>
        <Loc label="Title" journey={journey} value={b.title} onChange={(title) => onChange({ title })} />
        <Loc label="Text" journey={journey} value={b.text ?? ""} onChange={(text) => onChange({ text })} />
        <Loc label="Reference line" journey={journey} value={b.meta ?? ""} onChange={(meta) => onChange({ meta })} /></>) : null}
      {b.type === "button" ? (<><Loc label="Label" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <Field label="Style"><select className="select" value={b.variant ?? "primary"} onChange={(e) => onChange({ variant: e.target.value })}><option>primary</option><option>secondary</option><option>ghost</option></select></Field>
        <div className="label-section" style={{ margin: "4px 0" }}>When pressed</div>
        <ActionsEditor actions={b.actions} journey={journey} onChange={(actions) => onChange({ actions })} /></>) : null}
      {b.type === "amountInput" ? (<><Loc label="Label" journey={journey} value={b.label ?? ""} onChange={(label) => onChange({ label })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Currency"><input className="input" value={b.currency} onChange={(e) => onChange({ currency: e.target.value.toUpperCase().slice(0, 3) })} /></Field>
        <div className="row"><Field label="Min"><input className="input mono" value={b.validation?.min ?? ""} onChange={(e) => onChange({ validation: { ...b.validation, min: num(e.target.value) } })} /></Field>
          <Field label="Max (number or rule)"><input className="input mono" value={b.validation?.max ?? ""} onChange={(e) => onChange({ validation: { ...b.validation, max: num(e.target.value) } })} /></Field></div>
        <Loc label="Max error message" journey={journey} value={b.validation?.messages?.max ?? ""} onChange={(max) => onChange({ validation: { ...b.validation, messages: { ...(b.validation?.messages ?? {}), max } } })} />
        <Loc label="Helper text" journey={journey} value={b.helper ?? ""} onChange={(helper) => onChange({ helper })} /></>) : null}
      {b.type === "select" ? (<><Loc label="Label" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Data source (optional)" hint="e.g. ctx.billers. Leave empty to use the fixed options below."><input className="input mono" value={b.source ?? ""} onChange={(e) => onChange({ source: e.target.value || undefined })} /></Field>
        {!b.source ? <Field label="Options (one per line)"><textarea className="textarea" value={(b.options ?? []).join("\n")} onChange={(e) => onChange({ options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></Field> : null}</>) : null}
      {b.type === "textInput" ? (<><Loc label="Label" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <Loc label="Placeholder" journey={journey} value={b.placeholder ?? ""} onChange={(placeholder) => onChange({ placeholder })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Keyboard"><select className="select" value={b.keyboard ?? "default"} onChange={(e) => onChange({ keyboard: e.target.value })}>{["default", "number", "phone", "email"].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Format (regular expression)" hint="e.g. ^[0-9]{10,14}$"><input className="input mono" value={b.pattern ?? ""} onChange={(e) => onChange({ pattern: e.target.value || undefined })} /></Field>
        {b.pattern ? <Loc label="Message when format is wrong" journey={journey} value={b.patternMessage ?? ""} onChange={(patternMessage) => onChange({ patternMessage })} /> : null}</>) : null}
      {b.type === "consent" ? (<><Loc label="Text" journey={journey} value={b.text} onChange={(text) => onChange({ text })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Terms version"><input className="input" value={b.termsVersion} onChange={(e) => onChange({ termsVersion: e.target.value })} /></Field>
        <Loc label="Error when unticked" journey={journey} value={b.validation?.messages?.mustBeTrue ?? ""} onChange={(m) => onChange({ validation: { ...b.validation, mustBeTrue: true, messages: { ...(b.validation?.messages ?? {}), mustBeTrue: m } } })} /></>) : null}
      {b.type === "otp" ? (<><BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Digits"><input className="input" type="number" min={4} max={8} value={b.length} onChange={(e) => onChange({ length: Math.min(8, Math.max(4, Number(e.target.value) || 6)) })} /></Field>
        <Loc label="Hint" journey={journey} value={b.hint ?? ""} onChange={(hint) => onChange({ hint })} /></>) : null}
      {b.type === "accountPicker" || b.type === "beneficiaryPicker" ? (<><BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Data source"><input className="input mono" value={b.source} onChange={(e) => onChange({ source: e.target.value })} /></Field></>) : null}
      {b.type === "reviewSummary" ? (<div className="stack" style={{ gap: 8 }}>
        {b.rows.map((r: any, i: number) => (
          <div key={i} className="card" style={{ padding: 10, gap: 8, borderRadius: 10 }}>
            <Loc label="Label" journey={journey} value={r.label} onChange={(label) => onChange({ rows: b.rows.map((x: any, k: number) => (k === i ? { ...x, label } : x)) })} />
            <Field label="Value (can use {{data}})"><input className="input mono" value={typeof r.value === "string" ? r.value : textOf(r.value)} onChange={(e) => onChange({ rows: b.rows.map((x: any, k: number) => (k === i ? { ...x, value: e.target.value } : x)) })} /></Field>
            <button className="btn sm danger" onClick={() => onChange({ rows: b.rows.filter((_: any, k: number) => k !== i) })}>Remove row</button>
          </div>))}
        <button className="btn sm" onClick={() => onChange({ rows: [...b.rows, { label: "Label", value: "Value" }] })}>+ Add row</button></div>) : null}
      <Field label="Visible when (rule)" hint="Leave empty to always show"><input className="input mono" value={b.visibleWhen ?? ""} onChange={(e) => onChange({ visibleWhen: e.target.value || undefined })} placeholder="transfer.amount > 10000" /></Field>
    </div>
  );
}

export function Inspector({ journey, screenId, blockIndex, issues, onChange, onSelectBlock, onSelectScreen }: Props) {
  const screen = journey.screens.find((s) => s.id === screenId);
  if (!screen) return <div className="pane right muted">Select a screen on the canvas.</div>;
  const mine = issues.filter((i) => i.screen === screenId);
  const edit = (fn: (s: any) => void) => onChange(updateScreen(journey, screenId, fn));
  const block: any = blockIndex != null ? screen.blocks[blockIndex] : null;

  return (
    <div className="pane right">
      <div className="row"><div style={{ fontWeight: 600, fontSize: 15 }}>{textOf(screen.title)}</div><div className="spacer" /><span className="chip">{screen.id}</span></div>
      {mine.map((i, k) => <div key={k} className="issue" role="status">⚠ {i.message}</div>)}

      <div className="label-section">Screen</div>
      <div className="stack">
        <Loc label="Title" journey={journey} value={screen.title} onChange={(title) => edit((s) => { s.title = title; })} />
        <Field label="Type"><select className="select" value={screen.kind ?? "screen"} onChange={(e) => edit((s) => { s.kind = e.target.value === "screen" ? undefined : e.target.value; })}>
          <option value="screen">Screen</option><option value="branch">Branch (alternate path)</option><option value="terminal">End screen</option></select></Field>
        {journey.entryScreen !== screen.id ? <button className="btn sm" onClick={() => onChange({ ...journey, entryScreen: screen.id })}>Make this the start screen</button> : <span className="faint">This is the start screen</span>}
      </div>

      <div className="label-section">Blocks</div>
      {screen.blocks.map((b: any, i) => (
        <div key={i} className={`block-row ${blockIndex === i ? "on" : ""}`} onClick={() => onSelectBlock(blockIndex === i ? null : i)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onSelectBlock(i); }}>
          <span className="t">{BLOCK_LABELS[b.type] ?? b.type}</span><span className="s">{blockSummary(b)}</span>
          <button className="btn sm icon" disabled={i === 0} onClick={(e) => { e.stopPropagation(); onChange(moveBlock(journey, screenId, i, -1)); onSelectBlock(i - 1); }} aria-label="Move block up">↑</button>
          <button className="btn sm icon" disabled={i === screen.blocks.length - 1} onClick={(e) => { e.stopPropagation(); onChange(moveBlock(journey, screenId, i, 1)); onSelectBlock(i + 1); }} aria-label="Move block down">↓</button>
          <button className="btn sm icon danger" onClick={(e) => { e.stopPropagation(); onChange(removeBlock(journey, screenId, i)); onSelectBlock(null); }} aria-label="Delete block">✕</button>
        </div>
      ))}
      {screen.blocks.length === 0 ? <div className="faint">No blocks yet. Add one from the palette on the left.</div> : null}

      {block ? (<><div className="label-section">{BLOCK_LABELS[block.type] ?? block.type} properties</div>
        <BlockEditor b={block} journey={journey} onChange={(patch) => edit((s) => { s.blocks[blockIndex!] = { ...s.blocks[blockIndex!], ...patch }; })} /></>) : null}

      <div className="label-section">Next screen rules</div>
      <div className="faint" style={{ marginBottom: 8 }}>The first matching rule wins when a button navigates; otherwise the button's own target is used.</div>
      <div className="stack" style={{ gap: 8 }}>
        {(screen.navigation?.rules ?? []).map((r, i) => (
          <div key={i} className="card" style={{ padding: 10, gap: 8, borderRadius: 10 }}>
            <Field label="When"><input className="input mono" value={r.when} onChange={(e) => edit((s) => { s.navigation.rules[i].when = e.target.value; })} placeholder="amount > limit" /></Field>
            <ScreenSelect journey={journey} label="Go to" value={r.to} onChange={(to) => edit((s) => { s.navigation.rules[i].to = to; })} />
            <button className="btn sm danger" onClick={() => edit((s) => { s.navigation.rules.splice(i, 1); })}>Remove rule</button>
          </div>))}
        <button className="btn sm" onClick={() => edit((s) => { s.navigation ??= {}; s.navigation.rules ??= []; s.navigation.rules.push({ when: "true", to: journey.screens.find((x) => x.id !== s.id)?.id ?? s.id }); })}>+ Add rule</button>
      </div>

      <div className="label-section">Danger zone</div>
      <button className="btn sm danger" onClick={() => { const out = deleteScreen(journey, screenId); if (out) { onChange(out); onSelectScreen(out.entryScreen); onSelectBlock(null); } }}>Delete screen</button>
    </div>
  );
}
