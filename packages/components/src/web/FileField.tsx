import { useId, useState } from "react";
import type { FileFieldProps } from "../props";
import { Icon } from "./Icon";

/** Choose a file by button or by dropping it. The real file input is inside the button, so keyboard and screen readers use it as it is. */
export function FileField({ label, hint, helper, error, accept, file, onFile, onRemove, busy, strings }: FileFieldProps) {
  const id = useId();
  const [over, setOver] = useState(false);
  const describedBy = [hint ? `${id}-hint` : "", helper ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="fxc-field fxc-file">
      <span id={`${id}-label`} className="fxc-label">{label}</span>
      <div className={`fxc-file-zone ${over ? "is-over" : ""} ${error ? "has-error" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) onFile?.(f); }}>
        {file ? (
          <div className="fxc-file-chosen">
            <Icon name="check" size={18} stroke={2.5} />
            <span className="fxc-file-name"><b>{file.name}</b>{file.detail ? <small>{file.detail}</small> : null}</span>
            <button type="button" className="fxc-file-remove" onClick={onRemove}>{strings.remove}</button>
          </div>
        ) : <span className="fxc-file-drop">{strings.drop}</span>}
        <label className={`fxc-file-btn ${busy ? "is-busy" : ""}`}>
          <input type="file" className="fxc-sr" accept={accept} aria-labelledby={`${id}-label`} aria-describedby={describedBy} aria-invalid={error ? true : undefined} disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile?.(f); e.target.value = ""; }} />
          <span aria-hidden>{file ? strings.replace : strings.choose}</span>
        </label>
      </div>
      {hint ? <p id={`${id}-hint`} className="fxc-help">{hint}</p> : null}
      {helper ? <p id={`${id}-help`} className="fxc-help">{helper}</p> : null}
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
