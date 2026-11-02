"use client";
import { useId, useMemo, useState } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import type { Journey } from "@finx/journey-schema";
import { checkExpression, evaluate, pathsOf, setPath } from "@finx/renderer-core";
import { OPS, describeRule, isUnary, knownPaths, operand, parseRule, printRule, sampleValue, type Condition, type RuleModel } from "@/lib/rules";

const unquote = (s: string) => s.replace(/^(['"])(.*)\1$/, "$2");

/**
 * A rule edited as sentences ("amount is more than 10000 and note has a value") instead of code.
 * Rules the visual form cannot show stay editable as text, and any rule can be tried with sample values.
 */
export function RuleField({ journey, label, hint, value, onChange, alwaysValue, none = "Always" }: {
  journey: Journey; label: string; hint?: string; value: string | undefined; onChange: (v: string | undefined) => void; alwaysValue?: string; none?: string;
}) {
  const listId = useId();
  const paths = useMemo(() => knownPaths(journey), [journey]);
  const model = useMemo(() => parseRule(value, alwaysValue), [value, alwaysValue]);
  const [text, setText] = useState(false);
  const [test, setTest] = useState(false);
  const [sample, setSample] = useState<Record<string, string>>({});
  const asText = text || model === null;
  const src = (value ?? "").trim();
  const syntax = src ? checkExpression(src) : null;

  const commit = (m: RuleModel) => { const out = printRule(m, alwaysValue); onChange(out === "" ? undefined : out); };
  const setCond = (i: number, patch: Partial<Condition>) => commit({ ...model!, conditions: model!.conditions.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const add = () => commit({ ...model!, conditions: [...model!.conditions, { left: paths[0] ?? "", op: "==", right: '""' }] });

  const used = useMemo(() => { try { return src ? [...new Set(pathsOf(src))] : []; } catch { return []; } }, [src]);
  const result = useMemo(() => {
    if (!test || !src || syntax) return null;
    const scope: any = {};
    for (const p of used) { const v = sampleValue(sample[p] ?? ""); if (v !== undefined) setPath(scope, p, v); }
    try { return !!evaluate(src, scope); } catch (e) { return (e as Error).message; }
  }, [test, src, syntax, used, sample]);

  return (
    <div className="field rule-field">
      <span className="row" style={{ gap: 6 }}>{label}<span className="spacer" />
        {src ? <button type="button" className={`btn ghost sm ${test ? "on" : ""}`} aria-pressed={test} onClick={() => setTest((t) => !t)} title="Try the rule with sample values"><FlaskConical size={13} aria-hidden />Test</button> : null}
        {model ? <button type="button" className="btn ghost sm" aria-pressed={text} onClick={() => setText((t) => !t)}>{text ? "Use form" : "Edit as text"}</button> : null}
      </span>

      {asText ? (
        <>
          <input className="input mono" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} placeholder="transfer.amount > 10000" aria-label={`${label} (text)`} />
          {model === null && !syntax ? <span className="faint">This rule uses brackets or a mix of and/or, so it is shown as text.</span> : null}
        </>
      ) : (
        <div className="rule-rows">
          {model!.conditions.length === 0 ? <div className="faint">{none}. Add a condition to limit it.</div> : null}
          {model!.conditions.map((c, i) => (
            <div key={i} className="rule-row">
              {i > 0 ? (
                <select className="select join" value={model!.join} onChange={(e) => commit({ ...model!, join: e.target.value as "&&" | "||" })} aria-label="Join conditions">
                  <option value="&&">and</option><option value="||">or</option>
                </select>
              ) : <span className="join faint">When</span>}
              <input className="input mono" list={listId} value={c.left} onChange={(e) => setCond(i, { left: e.target.value })} aria-label="Data" placeholder="data" />
              <select className="select" value={c.op} onChange={(e) => setCond(i, { op: e.target.value as Condition["op"] })} aria-label="Comparison">
                {OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
              </select>
              {isUnary(c.op) ? null : <input className="input mono" list={listId} value={unquote(c.right)} onChange={(e) => setCond(i, { right: operand(e.target.value, paths) })} aria-label="Compared with" placeholder="value or data" />}
              <button type="button" className="btn ghost icon sm" onClick={() => commit({ ...model!, conditions: model!.conditions.filter((_, k) => k !== i) })} aria-label="Remove condition"><Trash2 size={13} /></button>
            </div>
          ))}
          <datalist id={listId}>{paths.map((p) => <option key={p} value={p} />)}</datalist>
          <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={add}><Plus size={13} aria-hidden />Add condition</button>
        </div>
      )}

      {syntax ? <span role="alert" style={{ color: "var(--negative)", fontWeight: 400 }}>{syntax}</span>
        : <span className="faint" style={{ fontWeight: 400 }}>{model && !asText ? describeRule(model, none) : src ? "" : hint ?? none}</span>}

      {test && src && !syntax ? (
        <div className="rule-test">
          {used.length === 0 ? <div className="faint">This rule does not read any data.</div> : used.map((p) => (
            <label key={p} className="row" style={{ gap: 8, fontWeight: 400 }}><code style={{ flex: "0 0 45%", overflow: "hidden", textOverflow: "ellipsis" }}>{p}</code>
              <input className="input" value={sample[p] ?? ""} onChange={(e) => setSample({ ...sample, [p]: e.target.value })} placeholder="sample value" aria-label={`Sample for ${p}`} /></label>
          ))}
          <div className="row">{typeof result === "boolean" ? <span className={`chip dot ${result ? "pos" : ""}`}>{result ? "True: it applies" : "False: it does not apply"}</span> : <span className="chip warn">{result}</span>}</div>
        </div>
      ) : null}
    </div>
  );
}
