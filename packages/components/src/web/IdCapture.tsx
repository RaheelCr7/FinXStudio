import type { IdCaptureProps } from "../props";
import { Icon } from "./Icon";

/** A simulated capture of an identity document and a selfie: each step has a frame and a button; no camera is used. */
export function IdCapture({ label, error, steps, onCapture, strings }: IdCaptureProps) {
  return (
    <fieldset className="fxc-field fxc-idcap">
      <legend className="fxc-label">{label}</legend>
      <p className="fxc-help">{strings.simulated}</p>
      <ul className="fxc-idcap-steps">
        {steps.map((s) => (
          <li key={s.id} className={`fxc-idcap-step ${s.done ? "is-done" : ""}`}>
            <div className={`fxc-idcap-frame is-${s.id}`} aria-hidden><Icon name={s.done ? "check" : s.id === "selfie" ? "user" : "card"} size={28} stroke={1.75} /></div>
            <div className="fxc-idcap-text">
              <b>{s.label}</b>
              <small>{s.done ? <>{strings.done}{s.ref ? ` · ${s.ref}` : ""}</> : s.hint}</small>
            </div>
            <button type="button" className="fxc-tbl-chip" onClick={() => onCapture?.(s.id)} aria-label={`${s.done ? strings.retake : strings.capture}: ${s.label}`}>{s.done ? strings.retake : strings.capture}</button>
          </li>
        ))}
      </ul>
      {error ? <p className="fxc-error" role="alert">{error}</p> : null}
    </fieldset>
  );
}
