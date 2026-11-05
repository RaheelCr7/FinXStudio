import { useEffect, useId, useRef, useState } from "react";
import type { SignaturePadProps } from "../props";
import { PAD, pointCount, strokesFromPath, strokesToPath, type SignaturePoint } from "../signature";

/** Sign by typing a name or by drawing. Typing is always available to a keyboard; the drawing box is a pointer-only extra. */
export function SignaturePad({ label, helper, error, modes, mode, onMode, name = "", onName, path = "", onPath, strings }: SignaturePadProps) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<SignaturePoint[][]>(() => strokesFromPath(path));
  const live = useRef<SignaturePoint[][] | null>(null);
  // the signature was cleared or set from outside
  useEffect(() => { if (path !== strokesToPath(strokes)) setStrokes(strokesFromPath(path)); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (e: React.PointerEvent): SignaturePoint => {
    const r = svg.current!.getBoundingClientRect();
    const n = (v: number) => (Number.isFinite(v) ? v : 0);
    return { x: n(((e.clientX - r.left) / (r.width || PAD.width)) * PAD.width), y: n(((e.clientY - r.top) / (r.height || PAD.height)) * PAD.height) };
  };
  const commit = (next: SignaturePoint[][]) => { setStrokes(next); onPath?.(strokesToPath(next), pointCount(next)); };
  return (
    <fieldset className="fxc-field fxc-sig" aria-describedby={[helper ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}>
      <legend className="fxc-label">{label}</legend>
      {modes.length > 1 ? (
        <div className="fxc-sig-modes" role="radiogroup" aria-label={strings.modes}>
          {modes.map((m) => (
            <label key={m} className={`fxc-sig-mode ${mode === m ? "is-on" : ""}`}>
              <input type="radio" className="fxc-sr" name={`${id}-mode`} checked={mode === m} onChange={() => onMode?.(m)} />
              <span>{m === "type" ? strings.type : strings.draw}</span>
            </label>
          ))}
        </div>
      ) : null}
      {mode === "type" ? (
        <>
          <input className={`fxc-input fxc-sig-typed ${error ? "has-error" : ""}`} aria-label={strings.name} placeholder={strings.name} value={name} autoComplete="off" aria-invalid={error ? true : undefined} onChange={(e) => onName?.(e.target.value)} />
          {name.trim() ? <div className="fxc-sig-preview" aria-hidden>{name}</div> : null}
        </>
      ) : (
        <>
          <svg ref={svg} className={`fxc-sig-pad ${error ? "has-error" : ""}`} viewBox={`0 0 ${PAD.width} ${PAD.height}`} role="img" aria-label={strings.pad}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); live.current = [...strokes, [at(e)]]; setStrokes(live.current); }}
            onPointerMove={(e) => { if (!live.current) return; const cur = live.current; cur[cur.length - 1] = [...cur[cur.length - 1]!, at(e)]; live.current = [...cur]; setStrokes(live.current); }}
            onPointerUp={() => { if (live.current) { commit(live.current); live.current = null; } }} onPointerCancel={() => { live.current = null; }}>
            <line x1="12" x2={PAD.width - 12} y1={PAD.height - 24} y2={PAD.height - 24} className="fxc-sig-line" />
            <path d={strokesToPath(strokes)} className="fxc-sig-ink" fill="none" />
          </svg>
          <button type="button" className="fxc-tbl-link" disabled={!strokes.length} onClick={() => commit([])}>{strings.clear}</button>
        </>
      )}
      {helper ? <p id={`${id}-help`} className="fxc-help">{helper}</p> : null}
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </fieldset>
  );
}
