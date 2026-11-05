"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Boxes, ChevronRight, Flag, GitBranch, Play, Plus, Route, Search, Smartphone, Trash2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { Journey, LintIssue } from "@finx/journey-schema";
import { BLOCK_GROUPS, BLOCK_LABELS, blockSummary, deleteScreen, moveBlock, removeBlock, textOf, updateScreen } from "@/lib/edit";
import { BLOCK_HELP, BLOCK_ICONS } from "@/lib/blocks-ui";
import { BindField, Field, Loc, ScreenSelect } from "./fields";
import { RuleField } from "./RuleField";

type Props = {
  journey: Journey; screenId: string; blockIndex: number | null; issues: LintIssue[]; onChange: (j: Journey) => void;
  onSelectBlock: (i: number | null) => void; onSelectScreen: (id: string) => void; onAddBlock: (type: string) => void;
  /** Inside a tabbed dock that already provides the panel, so no panel of its own. */
  bare?: boolean;
};

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
            <button className="btn sm icon" disabled={i === 0} onClick={() => swap(i, -1)} aria-label="Move action up"><ArrowUp size={14} /></button>
            <button className="btn sm icon" disabled={i === actions.length - 1} onClick={() => swap(i, 1)} aria-label="Move action down"><ArrowDown size={14} /></button>
            <button className="btn sm icon danger" onClick={() => onChange(actions.filter((_, k) => k !== i))} aria-label="Remove action"><X size={14} /></button>
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
        <Loc label="Min error message" journey={journey} value={b.validation?.messages?.min ?? ""} onChange={(min) => onChange({ validation: { ...b.validation, messages: { ...(b.validation?.messages ?? {}), min } } })} />
        <Loc label="Max error message" journey={journey} value={b.validation?.messages?.max ?? ""} onChange={(max) => onChange({ validation: { ...b.validation, messages: { ...(b.validation?.messages ?? {}), max } } })} />
        <Loc label="Helper text" journey={journey} value={b.helper ?? ""} onChange={(helper) => onChange({ helper })} />
        <Field label="Quick amounts" hint="Numbers separated by commas, shown as one-tap chips. Leave empty for none."><input className="input mono" defaultValue={(b.quickAmounts ?? []).join(", ")} key={(b.quickAmounts ?? []).join(",")} onBlur={(e) => { const q = e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0); onChange({ quickAmounts: q.length ? q : undefined }); }} placeholder="50, 100, 150, 200" /></Field></>) : null}
      {b.type === "select" ? (<><Loc label="Label" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Data source (optional)" hint="e.g. ctx.billers. Leave empty to use the fixed options below."><input className="input mono" value={b.source ?? ""} onChange={(e) => onChange({ source: e.target.value || undefined })} /></Field>
        <Field label="Look"><select className="select" value={b.variant ?? "chips"} onChange={(e) => onChange({ variant: e.target.value === "chips" ? undefined : e.target.value })}><option value="chips">Small chips</option><option value="tiles">Large tiles</option></select></Field>
        {b.choices ? <div className="faint">{b.choices.length} choices with icons. Edit them with Claude Code or in the journey file.</div> : null}
        {!b.source && !b.choices ? <Field label="Options (one per line)"><textarea className="textarea" value={(b.options ?? []).join("\n")} onChange={(e) => onChange({ options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></Field> : null}</>) : null}
      {b.type === "textInput" ? (<><Loc label="Label" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <Loc label="Placeholder" journey={journey} value={b.placeholder ?? ""} onChange={(placeholder) => onChange({ placeholder })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Keyboard"><select className="select" value={b.keyboard ?? "default"} onChange={(e) => onChange({ keyboard: e.target.value })}>{["default", "number", "phone", "email"].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={b.secure === true} onChange={(e) => onChange({ secure: e.target.checked || undefined })} />Hide what is typed (for passwords)</label>
        <Field label="Format (regular expression)" hint="e.g. ^[0-9]{10,14}$"><input className="input mono" value={b.pattern ?? ""} onChange={(e) => onChange({ pattern: e.target.value || undefined })} /></Field>
        {b.pattern ? <Loc label="Message when format is wrong" journey={journey} value={b.patternMessage ?? ""} onChange={(patternMessage) => onChange({ patternMessage })} /> : null}</>) : null}
      {b.type === "consent" ? (<><Loc label="Text" journey={journey} value={b.text} onChange={(text) => onChange({ text })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Field label="Terms version"><input className="input" value={b.termsVersion} onChange={(e) => onChange({ termsVersion: e.target.value })} /></Field>
        <Loc label="Error when unticked" journey={journey} value={b.validation?.messages?.mustBeTrue ?? ""} onChange={(m) => onChange({ validation: { ...b.validation, mustBeTrue: true, messages: { ...(b.validation?.messages ?? {}), mustBeTrue: m } } })} /></>) : null}
      {b.type === "toggle" ? (<><Loc label="Label" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <Loc label="Helper text" journey={journey} value={b.helper ?? ""} onChange={(helper) => onChange({ helper })} /></>) : null}
      {b.type === "cardForm" ? (<><BindField journey={journey} value={b.bind} onChange={(bind) => onChange({ bind })} />
        <div className="faint">The form saves the card number, name, expiry and security code under this path, and checks each when a button validates.</div></>) : null}
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
      {b.type === "statusChip" ? (<>
        <Field label="Status (a value or {{template}})" hint="Known words such as paid, pending_approval or rejected get a colour and an icon."><input className="input mono" value={b.status} onChange={(e) => onChange({ status: e.target.value })} /></Field>
        <Loc label="Words (optional)" journey={journey} value={b.label ?? ""} onChange={(label) => onChange({ label: label || undefined })} />
        <Field label="Tone"><select className="select" value={b.tone ?? ""} onChange={(e) => onChange({ tone: e.target.value || undefined })}><option value="">From the status</option>{["positive", "warning", "negative", "info", "neutral"].map((t) => <option key={t}>{t}</option>)}</select></Field></>) : null}
      {b.type === "timeline" ? (<>
        <Loc label="Name (for screen readers)" journey={journey} value={b.label ?? ""} onChange={(label) => onChange({ label: label || undefined })} />
        <Field label="List to draw (optional)" hint="A path such as ctx.events. Leave empty to use the fixed steps below."><input className="input mono" value={b.source ?? ""} onChange={(e) => onChange({ source: e.target.value || undefined, item: e.target.value ? (b.item ?? { title: "{{item.title}}", time: "{{item.at}}" }) : undefined })} /></Field>
        {(b.items ?? []).map((it: any, i: number) => (
          <div key={i} className="card" style={{ padding: 10, gap: 8, borderRadius: 10 }}>
            <Loc label="Step" journey={journey} value={it.title} onChange={(title) => onChange({ items: b.items.map((x: any, k: number) => (k === i ? { ...x, title } : x)) })} />
            <Loc label="Note" journey={journey} value={it.text ?? ""} onChange={(text) => onChange({ items: b.items.map((x: any, k: number) => (k === i ? { ...x, text: text || undefined } : x)) })} />
            <Field label="Time (can use {{data}})"><input className="input mono" value={typeof it.time === "string" ? it.time : textOf(it.time)} onChange={(e) => onChange({ items: b.items.map((x: any, k: number) => (k === i ? { ...x, time: e.target.value || undefined } : x)) })} /></Field>
            <Field label="State"><input className="input mono" list="tl-states" value={it.state ?? ""} onChange={(e) => onChange({ items: b.items.map((x: any, k: number) => (k === i ? { ...x, state: e.target.value || undefined } : x)) })} placeholder="done" /><datalist id="tl-states">{["done", "current", "upcoming", "failed"].map((t) => <option key={t} value={t} />)}</datalist></Field>
            <button className="btn sm danger" onClick={() => onChange({ items: b.items.filter((_: any, k: number) => k !== i) })}>Remove step</button>
          </div>))}
        <button className="btn sm" onClick={() => onChange({ items: [...(b.items ?? []), { id: `step${(b.items ?? []).length + 1}`, title: "Step" }] })}>+ Add step</button></>) : null}
      {b.type === "dataTable" ? (<>
        <Loc label="Name" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <Field label="List to show"><input className="input mono" value={b.source} onChange={(e) => onChange({ source: e.target.value })} placeholder="ctx.payments" /></Field>
        {(b.columns ?? []).map((c: any, i: number) => (
          <div key={i} className="card" style={{ padding: 10, gap: 8, borderRadius: 10 }}>
            <Loc label="Heading" journey={journey} value={c.label} onChange={(label) => onChange({ columns: b.columns.map((x: any, k: number) => (k === i ? { ...x, label } : x)) })} />
            <div className="row"><Field label="Key"><input className="input mono" value={c.key} onChange={(e) => onChange({ columns: b.columns.map((x: any, k: number) => (k === i ? { ...x, key: e.target.value } : x)) })} /></Field>
              <Field label="Kind"><select className="select" value={c.type ?? "text"} onChange={(e) => onChange({ columns: b.columns.map((x: any, k: number) => (k === i ? { ...x, type: e.target.value === "text" ? undefined : e.target.value } : x)) })}>{["text", "number", "money", "date", "status"].map((t) => <option key={t}>{t}</option>)}</select></Field></div>
            {c.type === "money" ? <Field label="Currency (code)"><input className="input" value={c.currency ?? ""} onChange={(e) => onChange({ columns: b.columns.map((x: any, k: number) => (k === i ? { ...x, currency: e.target.value.toUpperCase().slice(0, 3) || undefined } : x)) })} /></Field> : null}
            <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={c.filter === true} onChange={(e) => onChange({ columns: b.columns.map((x: any, k: number) => (k === i ? { ...x, filter: e.target.checked || undefined } : x)) })} />Offer its values as filter chips</label>
            <button className="btn sm danger" disabled={b.columns.length <= 1} onClick={() => onChange({ columns: b.columns.filter((_: any, k: number) => k !== i) })}>Remove column</button>
          </div>))}
        <button className="btn sm" onClick={() => onChange({ columns: [...b.columns, { key: "field", label: "Column" }] })}>+ Add column</button>
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={b.search === true} onChange={(e) => onChange({ search: e.target.checked || undefined })} />Search box</label>
        <Field label="Rows per page"><input className="input" type="number" min={1} max={200} value={b.pageSize ?? ""} placeholder="25" onChange={(e) => onChange({ pageSize: e.target.value ? Math.min(200, Math.max(1, Number(e.target.value))) : undefined })} /></Field>
        <Field label="Save ticked rows in (optional)" hint="A data path such as approve.paymentIds. Adds tick boxes."><input className="input mono" list="dt-binds" value={b.bind ?? ""} onChange={(e) => onChange({ bind: e.target.value || undefined })} /><datalist id="dt-binds">{Object.keys(journey.dataModel ?? {}).map((k) => <option key={k} value={k} />)}</datalist></Field>
        {b.bind ? <Field label="Most rows that can be ticked"><input className="input" type="number" min={1} value={b.maxSelected ?? ""} onChange={(e) => onChange({ maxSelected: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })} /></Field> : null}
        <Loc label="When there are no rows" journey={journey} value={b.empty ?? ""} onChange={(empty) => onChange({ empty: empty || undefined })} />
        <div className="faint">Row actions and a total of the ticked amounts are set in the journey file or with Claude Code.</div></>) : null}
      {b.type === "chart" ? (<>
        <Loc label="Name" journey={journey} value={b.label} onChange={(label) => onChange({ label })} />
        <Field label="Drawing"><select className="select" value={b.kind} onChange={(e) => onChange({ kind: e.target.value })}><option value="line">Line</option><option value="donut">Ring</option></select></Field>
        <Field label="List to draw"><input className="input mono" value={b.source} onChange={(e) => onChange({ source: e.target.value })} placeholder="ctx.cashflow" /></Field>
        <div className="row"><Field label="Label key"><input className="input mono" value={b.x ?? ""} onChange={(e) => onChange({ x: e.target.value || undefined })} /></Field>
          <Field label="Labels are"><select className="select" value={b.xFormat ?? "text"} onChange={(e) => onChange({ xFormat: e.target.value === "text" ? undefined : e.target.value })}><option value="text">Text</option><option value="date">Dates</option></select></Field></div>
        {b.series.map((x: any, i: number) => (
          <div key={i} className="card" style={{ padding: 10, gap: 8, borderRadius: 10 }}>
            <Loc label="Series" journey={journey} value={x.label} onChange={(label) => onChange({ series: b.series.map((y: any, k: number) => (k === i ? { ...y, label } : y)) })} />
            <Field label="Key"><input className="input mono" value={x.key} onChange={(e) => onChange({ series: b.series.map((y: any, k: number) => (k === i ? { ...y, key: e.target.value } : y)) })} /></Field>
            <button className="btn sm danger" disabled={b.series.length <= 1} onClick={() => onChange({ series: b.series.filter((_: any, k: number) => k !== i) })}>Remove series</button>
          </div>))}
        <button className="btn sm" onClick={() => onChange({ series: [...b.series, { key: "value", label: "Series" }] })}>+ Add series</button>
        <Field label="Currency (code or {{path}})"><input className="input mono" value={b.currency ?? ""} onChange={(e) => onChange({ currency: e.target.value || undefined })} /></Field>
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={b.table === true} onChange={(e) => onChange({ table: e.target.checked || undefined })} />Offer “Show as table”</label></>) : null}
      <RuleField journey={journey} label="Show this block when" none="Always shown" value={b.visibleWhen} onChange={(visibleWhen) => onChange({ visibleWhen })} />
    </div>
  );
}

function Acc({ title, icon: Icon, count, defaultOpen, children }: { title: string; icon: LucideIcon; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="acc">
      <button aria-expanded={open} onClick={() => setOpen(!open)}><Icon size={15} aria-hidden style={{ color: "var(--text-3)" }} />{title}{count != null ? <span className="chip">{count}</span> : null}<ChevronRight size={15} className="chev" aria-hidden /></button>
      {open ? <div className="acc-body">{children}</div> : null}
    </div>
  );
}

/** Searchable list of block types, opened from the "Add block" button. */
function BlockPicker({ onPick, onClose }: { onPick: (type: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return BLOCK_GROUPS.flatMap((g) => g.types.map((t) => ({ t, g: g.name }))).filter(({ t, g }) => { const hay = `${BLOCK_LABELS[t]} ${BLOCK_HELP[t]} ${g}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
  }, [q]);
  useEffect(() => { setI(0); }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(flat.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const p = flat[i]; if (p) { onPick(p.t); onClose(); } }
  };
  let last = "";
  return (
    <div className="picker" ref={ref} onKeyDown={key} role="dialog" aria-label="Add a block">
      <div className="q"><Search size={15} aria-hidden /><input autoFocus placeholder="Search blocks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search blocks" /></div>
      <div className="list" role="listbox">
        {flat.length === 0 ? <div className="faint" style={{ padding: 16, textAlign: "center" }}>No block matches “{q}”.</div> : flat.map(({ t, g }, n) => {
          const Icon = BLOCK_ICONS[t]; const head = g !== last ? <div className="g">{g}</div> : null; last = g;
          return (
            <div key={t}>{head}
              <button className="it" role="option" aria-selected={n === i} onMouseMove={() => setI(n)} onClick={() => { onPick(t); onClose(); }}>
                <span className="bi">{Icon ? <Icon size={16} aria-hidden /> : null}</span>
                <span><b style={{ fontWeight: 600, fontSize: 13.5 }}>{BLOCK_LABELS[t]}</b><small>{BLOCK_HELP[t]}</small></span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Inspector({ journey, screenId, blockIndex, issues, onChange, onSelectBlock, onSelectScreen, onAddBlock, bare }: Props) {
  const [picker, setPicker] = useState(false);
  const screen = journey.screens.find((s) => s.id === screenId);
  const wrap = (children: React.ReactNode) => (bare ? <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div> : <div className="pane right">{children}</div>);
  if (!screen) return wrap(<div className="pad muted">Select a screen on the canvas.</div>);
  const mine = issues.filter((i) => i.screen === screenId);
  const edit = (fn: (s: any) => void) => onChange(updateScreen(journey, screenId, fn));
  const kind = screen.kind ?? "screen";
  const isStart = journey.entryScreen === screen.id;
  const KindIcon = isStart ? Play : kind === "branch" ? GitBranch : kind === "terminal" ? Flag : Smartphone;

  return wrap(
    <>
      <div style={{ padding: "16px 14px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        <span className="bi" style={{ width: 38, height: 38, borderRadius: 11, background: kind === "branch" ? "var(--warning-bg)" : kind === "terminal" ? "var(--positive-bg)" : "var(--accent-soft)", color: kind === "branch" ? "var(--warning)" : kind === "terminal" ? "var(--positive)" : "var(--accent-text)", display: "grid", placeItems: "center", flex: "none" }}><KindIcon size={18} aria-hidden /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: 16, letterSpacing: "-0.012em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{textOf(screen.title)}</div>
          <div className="faint">{isStart ? "Start screen · " : ""}{kind === "terminal" ? "End screen" : kind === "branch" ? "Branch" : "Screen"} · {screen.id}</div>
        </div>
      </div>
      {mine.length ? <div style={{ padding: "0 14px 8px" }}>{mine.map((i, k) => <div key={k} className="issue" role="status"><TriangleAlert size={14} aria-hidden />{i.message}</div>)}</div> : null}

      <Acc title="Screen" icon={Smartphone} defaultOpen={false}>
        <div className="stack">
          <Loc label="Title" journey={journey} value={screen.title} onChange={(title) => edit((s) => { s.title = title; })} />
          <Field label="Type"><select className="select" value={kind} onChange={(e) => edit((s) => { s.kind = e.target.value === "screen" ? undefined : e.target.value; })}>
            <option value="screen">Screen</option><option value="branch">Branch (alternate path)</option><option value="terminal">End screen</option></select></Field>
          {!isStart ? <button className="btn sm" onClick={() => onChange({ ...journey, entryScreen: screen.id })}><Play size={13} aria-hidden />Make this the start screen</button> : <span className="faint">This is the start screen</span>}
        </div>
      </Acc>

      <Acc title="Blocks" icon={Boxes} count={screen.blocks.length} defaultOpen>
        <div style={{ position: "relative" }}>
          {screen.blocks.map((b: any, i) => {
            const Icon = BLOCK_ICONS[b.type]; const on = blockIndex === i;
            return (
              <div key={i}>
                <div className={`block-row ${on ? "on" : ""}`} onClick={() => onSelectBlock(on ? null : i)} role="button" tabIndex={0} aria-expanded={on} onKeyDown={(e) => { if (e.key === "Enter") onSelectBlock(on ? null : i); }}
                  style={on ? { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}>
                  <span className="bi">{Icon ? <Icon size={16} aria-hidden /> : null}</span>
                  <span className="bt"><span className="t">{BLOCK_LABELS[b.type] ?? b.type}</span><span className="s">{blockSummary(b) || " "}</span></span>
                  <span className="acts">
                    <button className="btn sm ghost icon" disabled={i === 0} onClick={(e) => { e.stopPropagation(); onChange(moveBlock(journey, screenId, i, -1)); onSelectBlock(i - 1); }} aria-label="Move block up"><ArrowUp size={14} /></button>
                    <button className="btn sm ghost icon" disabled={i === screen.blocks.length - 1} onClick={(e) => { e.stopPropagation(); onChange(moveBlock(journey, screenId, i, 1)); onSelectBlock(i + 1); }} aria-label="Move block down"><ArrowDown size={14} /></button>
                    <button className="btn sm ghost icon danger" onClick={(e) => { e.stopPropagation(); onChange(removeBlock(journey, screenId, i)); onSelectBlock(null); }} aria-label="Delete block"><Trash2 size={14} /></button>
                  </span>
                </div>
                {on ? <div className="block-edit"><BlockEditor b={b} journey={journey} onChange={(patch) => edit((s) => { s.blocks[blockIndex!] = { ...s.blocks[blockIndex!], ...patch }; })} /></div> : null}
              </div>
            );
          })}
          {screen.blocks.length === 0 ? <div className="faint" style={{ margin: "2px 0 10px" }}>No blocks yet. Add the first one to build this screen.</div> : null}
          <button className="btn" style={{ width: "100%" }} onClick={() => setPicker(!picker)} aria-expanded={picker}><Plus size={15} aria-hidden />Add block</button>
          {picker ? <BlockPicker onPick={onAddBlock} onClose={() => setPicker(false)} /> : null}
        </div>
      </Acc>

      <Acc title="Next screen rules" icon={Route} count={screen.navigation?.rules?.length ?? 0}>
        <div className="faint" style={{ marginBottom: 8 }}>The first matching rule wins when a button navigates; otherwise the button's own target is used.</div>
        <div className="stack" style={{ gap: 8 }}>
          {(screen.navigation?.rules ?? []).map((r, i) => (
            <div key={i} className="card" style={{ padding: 10, gap: 8, borderRadius: 10, boxShadow: "none" }}>
              <RuleField journey={journey} label="Rule" alwaysValue="true" none="Always" value={r.when} onChange={(when) => edit((s) => { s.navigation.rules[i].when = when ?? "true"; })} />
              <ScreenSelect journey={journey} label="Go to" value={r.to} onChange={(to) => edit((s) => { s.navigation.rules[i].to = to; })} />
              <button className="btn sm danger" onClick={() => edit((s) => { s.navigation.rules.splice(i, 1); })}><Trash2 size={13} aria-hidden />Remove rule</button>
            </div>))}
          <button className="btn sm" onClick={() => edit((s) => { s.navigation ??= {}; s.navigation.rules ??= []; s.navigation.rules.push({ when: "true", to: journey.screens.find((x) => x.id !== s.id)?.id ?? s.id }); })}><Plus size={13} aria-hidden />Add rule</button>
        </div>
      </Acc>

      <Acc title="Danger zone" icon={Trash2}>
        <button className="btn sm danger" onClick={() => { const out = deleteScreen(journey, screenId); if (out) { onChange(out); onSelectScreen(out.entryScreen); onSelectBlock(null); } }}><Trash2 size={13} aria-hidden />Delete this screen</button>
      </Acc>
      <div style={{ height: 24 }} />
    </>
  );
}
