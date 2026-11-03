"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MousePointerClick, Moon, RotateCcw, Sparkles, Sun } from "lucide-react";
import type { Journey } from "@finx/journey-schema";
import { MockBank, defaultPersonaFor, personasFor } from "@finx/mock-bank-api";
import { brands, type Brand } from "@finx/ui-kit";
import { useProjects } from "./Projects";
import { blockAt } from "@/lib/pick";
import { JourneyPlayer, ThemeProvider } from "@finx/renderer-native";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const PHONE = { w: 340, h: 690 };

/** `onPick`: when given, the preview has a Select mode where clicking a block selects it instead of pressing it. `onAsk` asks Claude about the picked block. */
export function Preview({ journey, onPick, picked, onAsk, select = false, onSelectMode }: { journey: Journey; onPick?: (screen: string, index: number) => void; picked?: string | null; onAsk?: () => void; /** Select mode is kept by the builder, so it survives switching panels */ select?: boolean; onSelectMode?: (on: boolean) => void }) {
  const setSelect = (on: boolean) => onSelectMode?.(on);
  // A journey previews with the look and sandbox customers of the project (bank app) it belongs to; none listed means Meezan
  const { byId } = useProjects();
  const brand: Brand = byId(journey.apps?.[0] ?? "meezan")?.brand ?? brands.meezan!;
  const people = personasFor(brand.preset, brand.id);
  const [persona, setPersona] = useState(defaultPersonaFor(people, journey.integrations).id);
  const [lang, setLang] = useState("en");
  const [dark, setDark] = useState(false);
  const [seed, setSeed] = useState(0);
  const [scale, setScale] = useState(1);
  const fit = useRef<HTMLDivElement>(null);
  const live = useDebounced(journey, 450);
  const adapter = useMemo(() => {
    const bank = new MockBank(persona);
    return (id: string, input: Record<string, any>) => bank.call(id, input);
  }, [persona, seed]);
  const restart = () => setSeed((s) => s + 1);
  // runs played here are recorded (screens, mistakes, failures; never answers), batched so typing is never slowed down
  const queue = useRef<unknown[]>([]);
  const flush = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEvent = useCallback((e: unknown) => {
    queue.current.push(e);
    if (flush.current) return;
    flush.current = setTimeout(() => {
      const events = queue.current.splice(0); flush.current = null;
      fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events, source: "preview" }) }).catch(() => {});
    }, 800);
  }, []);
  const supported = journey.locale.supported;

  // Shrink the phone to fit the panel (never grow it), so the whole device is always visible.
  useEffect(() => {
    const el = fit.current; if (!el) return;
    const measure = () => setScale(Math.max(0.5, Math.min(1, el.clientHeight / PHONE.h, el.clientWidth / PHONE.w)));
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);

  return (
    <>
      <div className="row wrap" style={{ width: "100%", maxWidth: 360, gap: 6, justifyContent: "center" }}>
        <select className="select" style={{ flex: 1, minWidth: 140, height: 30, fontSize: 13 }} value={persona} onChange={(e) => { setPersona(e.target.value); restart(); }} aria-label="Sandbox customer">
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="row" style={{ gap: 4 }}>
          {supported.length > 1 ? <button className="btn sm" onClick={() => setLang(lang === "en" ? supported.find((l) => l !== "en") ?? "en" : "en")} aria-label="Switch preview language">{lang === "en" ? "اردو" : "English"}</button> : null}
          <button className="btn sm icon" onClick={() => setDark(!dark)} aria-label={dark ? "Light preview" : "Dark preview"} title={dark ? "Light preview" : "Dark preview"}>{dark ? <Sun size={14} /> : <Moon size={14} />}</button>
          {onPick ? <button className="btn sm icon" onClick={() => setSelect(!select)} aria-pressed={select} aria-label="Select blocks by clicking them" title="Select: click a block to edit it"><MousePointerClick size={14} /></button> : null}
          <button className="btn sm icon" onClick={restart} aria-label="Restart preview" title="Restart"><RotateCcw size={14} /></button>
        </div>
      </div>
      <div className="phone-fit" ref={fit}>
        <div style={{ width: PHONE.w * scale, height: PHONE.h * scale, flex: "none" }}>
          <div className="phone" role="region" aria-label="Phone preview" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <div className={`screen ${select ? "pick-mode" : ""}`}
              onClickCapture={select && onPick ? (e) => { const at = blockAt(e.target); e.preventDefault(); e.stopPropagation(); if (at) onPick(at.screen, at.index); } : undefined}>
              <div>
                <ThemeProvider mode={dark ? "dark" : "light"} brand={brand}>
                  <JourneyPlayer key={seed} journey={live} adapter={adapter} lang={lang} onEvent={onEvent} onClose={restart} onExit={restart} />
                </ThemeProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
      {select ? <div className="row wrap" style={{ justifyContent: "center", gap: 8 }}><span className="faint">{picked ? `Selected: ${picked}` : "Click a block to select it"}</span>{picked && onAsk ? <button className="btn sm" onClick={onAsk}><Sparkles size={13} aria-hidden />Ask Claude about this block</button> : null}</div> : null}
      <div className="faint" style={{ textAlign: "center" }}>Live preview · sandbox data · v{journey.version} draft</div>
    </>
  );
}
