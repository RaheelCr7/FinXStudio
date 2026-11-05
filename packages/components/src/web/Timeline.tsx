import type { TimelineProps } from "../props";
import { Icon } from "./Icon";

const GLYPH = { done: "check", current: "clock", upcoming: "", failed: "x" } as const;

/** What happened and what is still to come, top to bottom, with a line joining the steps. */
export function Timeline({ label, items, strings }: TimelineProps) {
  return (
    <ol className="fxc-timeline" aria-label={label}>
      {items.map((it) => {
        const state = it.state ?? "done";
        return (
          <li key={it.id} className={`fxc-tl-item is-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="fxc-tl-dot" aria-hidden>{GLYPH[state] ? <Icon name={GLYPH[state]} size={12} stroke={3} /> : null}</span>
            <div className="fxc-tl-body">
              <div className="fxc-tl-title">{it.title}{strings ? <span className="fxc-sr"> ({strings[state]})</span> : null}</div>
              {it.text ? <div className="fxc-tl-text">{it.text}</div> : null}
              {it.time ? <div className="fxc-tl-time">{it.time}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
