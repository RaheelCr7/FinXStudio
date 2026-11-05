"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Journey } from "@finx/journey-schema";
import { JourneyController, ui, type Adapter, type BlockType, type ChainRequest, type JourneyEvent, type Receipt } from "@finx/renderer-core";
import type { BrandLook } from "@finx/ui-kit";
import { AppBar, componentsCss } from "@finx/components";
import { Button, registry } from "./blocks/blocks";
import { LookContext } from "./look";

export type JourneyPlayerProps = {
  journey: Journey;
  adapter: Adapter;
  lang?: string;
  /** Answers to fill in when the journey opens, by data path. */
  initial?: Record<string, any>;
  /** Values there before the first screen runs, by data path (the entry screen can branch on them). */
  launch?: Record<string, any>;
  /** The journey asked to open another one (navigate.toJourney); without it a message is shown. */
  onOpenJourney?: (req: ChainRequest) => void;
  /** What the person may do where they bank from; journeys read it as `session.permissions` (read-only). */
  session?: { permissions?: string[] };
  /** A journey shared a receipt. By default the page prints it (the browser's print dialog also saves a PDF). */
  onShare?: (receipt: Receipt) => void;
  /** Receives screen views, mistakes, bank failures and exits (never answers), for analytics. */
  onEvent?: (e: JourneyEvent) => void;
  /** The close button, and back from the first screen. */
  onClose?: () => void;
  /** The journey asked to exit (its last screen's button). */
  onExit?: () => void;
  /** How this bank's screens differ from the standard look, and its name for the banner. */
  look?: BrandLook;
  brandName?: string;
};

/**
 * Plays a journey on the web. The engine and every decision about the screen live in @finx/renderer-core (JourneyController);
 * this draws it with real form elements: labels, error messages that are announced, a step list, Enter to continue,
 * and focus that moves to the screen title (or the first mistake) so keyboard and screen-reader users are never left behind.
 */
export function JourneyPlayer({ journey, adapter, lang, initial, launch, onOpenJourney, onEvent, onClose, onExit, look, brandName, session, onShare }: JourneyPlayerProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const share = useRef(onShare);
  share.current = onShare;
  const controller = useMemo(() => new JourneyController(journey, { adapter, lang, initial, launch, onOpenJourney, onEvent, session, onShare: (r) => (share.current ? share.current(r) : setReceipt(r)) }), [journey, adapter]);
  // print the receipt once it is on the page, then take it away again
  useEffect(() => {
    if (!receipt) return;
    const done = () => setReceipt(null);
    window.addEventListener("afterprint", done, { once: true });
    window.print?.();
    return () => window.removeEventListener("afterprint", done);
  }, [receipt]);
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => controller.subscribe(force), [controller]);
  useEffect(() => { void controller.start(); }, [controller]);
  useEffect(() => { if (lang) controller.setLang(lang); }, [lang, controller]);

  const layout = controller.layout();
  const { view: v, body, buttons } = layout;
  useEffect(() => { if (v.exited) onExit?.(); }, [v.exited]);

  const title = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // a new screen: move focus to its title, so a screen reader reads where it landed
  useEffect(() => { title.current?.focus({ preventScroll: false }); window.scrollTo?.({ top: 0 }); }, [v.screenId]);
  // a failed check: move focus to the first field with a mistake
  const errorKey = body.map((b) => b.error ?? Object.values(b.errors ?? {}).filter(Boolean).join(",")).join("|").replace(/\|/g, "");
  useEffect(() => { if (errorKey) bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errorKey]);

  const primary = buttons.find((b) => (b.variant ?? "primary") === "primary");
  const common = { busy: v.busy, lang: layout.lang, strings: v.strings };
  const back = ui(layout.lang, "back"), close = ui(layout.lang, "close");

  const bar = look?.chrome === "bar";
  const hero = bar && layout.hero;
  const block = (b: any, i: number) => {
    const C = registry[b.type as BlockType];
    return C ? <div key={`${v.screenId}-${i}`} className="fx-block"><C b={b} set={(p, val) => controller.set(p, val)} press={(a) => controller.press(a)} {...common} /></div> : null;
  };
  const buttonRow = buttons.map((b, i) => <Button key={`${v.screenId}-b${i}`} b={b} set={() => {}} press={(a) => controller.press(a)} {...common} submit={b === primary} />);
  // on the bank's banner screen the shortcuts sit last, below the buttons; everywhere else buttons are pinned under the body
  const shortcuts = hero ? body.filter((b) => b.type === "shortcuts") : [];
  const main = hero ? body.slice(1).filter((b) => b.type !== "shortcuts") : body;

  return (
    <LookContext.Provider value={{ look, name: brandName }}>
    <div className="fx-player" dir={layout.rtl ? "rtl" : "ltr"} lang={layout.lang} data-chrome={bar ? "bar" : undefined} data-hero={hero ? "" : undefined}
      style={bar ? ({ ...(look?.pageBg ? { "--page-bg": look.pageBg } : {}), ...(look?.bar ? { "--bar-bg": look.bar } : {}) } as React.CSSProperties) : undefined}>
      <style>{componentsCss}</style>
      {bar ? (
        <div className="fx-player-head">
          <AppBar tone="bar" title={v.title} titleRef={title} onBack={layout.canGoBack ? () => controller.stepBack() : undefined} onClose={onClose} labels={{ back, close }} />
        </div>
      ) : (
      <header className="fx-player-head">
        <div className="fx-player-bar">
          {layout.canGoBack ? <button type="button" className="fx-icon-btn" aria-label={back} onClick={() => controller.stepBack()}><span aria-hidden className="fx-flip">‹</span></button> : null}
          <div className="fx-player-title">
            <h1 ref={title} tabIndex={-1}>{v.title}</h1>
            {layout.steps ? <p className="fx-player-step">{layout.steps.label}</p> : null}
          </div>
          <button type="button" className="fx-icon-btn" aria-label={close} onClick={onClose}><span aria-hidden>✕</span></button>
        </div>
        {layout.steps ? (
          <ol className="fx-steps" aria-label={layout.steps.label}>
            {layout.steps.done.map((done, i) => <li key={i} className={done ? "is-done" : ""} aria-current={i === v.stepIndex ? "step" : undefined} />)}
          </ol>
        ) : null}
      </header>
      )}

      {/* announced when the screen changes, without moving the visible layout */}
      <p className="fx-sr" role="status" aria-live="polite">{layout.steps ? `${v.title}. ${layout.steps.label}` : ""}</p>
      {v.toast ? <div className="fx-toast-error" role="alert">{v.toast}</div> : null}

      {layout.dialogs.map((b, i) => block(b, 800 + i))}
      {hero ? block(body[0], 0) : null}
      <form className="fx-player-form" noValidate onSubmit={(e) => { e.preventDefault(); if (primary && !v.busy) void controller.press(primary.actions); }}>
        <div className="fx-player-body" ref={bodyRef}>
          {main.map(block)}
          {hero ? buttonRow : null}
          {shortcuts.map((b, i) => block(b, 900 + i))}
        </div>
        {hero ? null : <footer className="fx-player-foot">{buttonRow}</footer>}
      </form>
      {receipt ? (
        <div className="fx-receipt" role="document" aria-label={receipt.title}>
          <h1>{receipt.title}</h1>
          <dl>{receipt.lines.map((l, i) => l.label ? <div key={i}><dt>{l.label}</dt><dd>{l.value}</dd></div> : <div key={i}><dd className="fx-receipt-note">{l.value}</dd></div>)}</dl>
        </div>
      ) : null}
    </div>
    </LookContext.Provider>
  );
}
