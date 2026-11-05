import { useEffect, useId, useRef } from "react";
import type { DocumentViewerProps } from "../props";
import { reachedEnd } from "../signature";
import { Icon } from "./Icon";

/** A text to read to the end. The box scrolls and can be focused, so the keyboard scrolls it; the line under it says whether the end was reached. */
export function DocumentViewer({ title, paragraphs, read, onRead, height = 240, error, strings }: DocumentViewerProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const check = () => {
    const el = box.current;
    if (!read && el && reachedEnd(el.scrollTop, el.clientHeight, el.scrollHeight)) onRead?.();
  };
  // a text that fits without scrolling is read as soon as it is shown; a box that is hidden or not laid out yet is checked again when it gets a size
  useEffect(() => {
    check();
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(check);
    watch.observe(el);
    return () => watch.disconnect();
  }, [read, paragraphs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fxc-field fxc-doc">
      <h3 id={`${id}-title`} className="fxc-doc-title">{title}</h3>
      <div ref={box} className={`fxc-doc-body ${error ? "has-error" : ""}`} style={{ blockSize: height }} tabIndex={0} role="region" aria-labelledby={`${id}-title`} aria-describedby={`${id}-state`} onScroll={check}>
        {paragraphs.map((p, i) => (
          <div key={i} className="fxc-doc-para">{p.heading ? <h4>{p.heading}</h4> : null}{p.text ? <p>{p.text}</p> : null}</div>
        ))}
      </div>
      <p id={`${id}-state`} className={`fxc-doc-state ${read ? "is-read" : ""}`} role="status">{read ? <><Icon name="check" size={14} stroke={3} /> {strings.done}</> : strings.progress}</p>
      {error ? <p className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
