import type { ResultProps } from "../props";
import { Icon } from "./Icon";

export function Result({ tone, title, text, meta }: ResultProps) {
  const ok = tone === "success";
  return (
    <div className="fxc-result" role="status">
      <span className={`fxc-result-icon ${ok ? "is-ok" : "is-bad"}`} aria-hidden>{ok ? <Icon name="check" size={40} stroke={2.5} /> : <span>!</span>}</span>
      <h2 className="fxc-result-title">{title}</h2>
      {text ? <p className="fxc-result-text">{text}</p> : null}
      {meta ? <p className="fxc-result-meta">{meta}</p> : null}
    </div>
  );
}
