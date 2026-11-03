"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, RotateCcw, Sun } from "lucide-react";
import type { Journey } from "@finx/journey-schema";
import { MockBank, personasFor } from "@finx/mock-bank-api";
import { brands, type Brand } from "@finx/ui-kit";
import { useProjects } from "./Projects";
import { JourneyPlayer, ThemeProvider } from "@finx/renderer-native";
import { JourneyPlayer as WebPlayer, themeVars } from "@finx/renderer-web";
import "@finx/renderer-web/src/styles/renderer.css";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const PHONE = { w: 340, h: 690 };

export function Preview({ journey }: { journey: Journey }) {
  // A journey previews with the look and sandbox customers of the project (bank app) it belongs to; none listed means Meezan
  const { byId } = useProjects();
  const brand: Brand = byId(journey.apps?.[0] ?? "meezan")?.brand ?? brands.meezan!;
  const people = personasFor(brand.preset);
  const [persona, setPersona] = useState(people[0]!.id);
  const [lang, setLang] = useState("en");
  const [dark, setDark] = useState(false);
  const [seed, setSeed] = useState(0);
  // A journey made for both channels previews on a phone or as a web page; one made for a single channel shows only that.
  const hasWeb = journey.channels.includes("web"), hasMobile = journey.channels.includes("mobile");
  const [chosen, setChosen] = useState<"phone" | "web">("phone");
  const view: "phone" | "web" = hasWeb && hasMobile ? chosen : hasWeb ? "web" : "phone";
  const [scale, setScale] = useState(1);
  const fit = useRef<HTMLDivElement>(null);
  const live = useDebounced(journey, 450);
  const adapter = useMemo(() => {
    const bank = new MockBank(persona);
    return (id: string, input: Record<string, any>) => bank.call(id, input);
  }, [persona, seed]);
  const restart = () => setSeed((s) => s + 1);
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
          <button className="btn sm icon" onClick={restart} aria-label="Restart preview" title="Restart"><RotateCcw size={14} /></button>
        </div>
      </div>
      {hasWeb && hasMobile ? (
        <div className="seg" role="group" aria-label="Preview as">
          <button aria-pressed={view === "phone"} onClick={() => { setChosen("phone"); restart(); }}>Phone</button>
          <button aria-pressed={view === "web"} onClick={() => { setChosen("web"); restart(); }}>Web</button>
        </div>
      ) : null}
      {view === "web" ? (
        <div className="web-frame" role="region" aria-label="Web preview">
          <div className="web-bar" aria-hidden><i /><i /><i /><span>{(byId(journey.apps?.[0] ?? "meezan")?.name ?? "bank").toLowerCase().replace(/[^a-z0-9]+/g, "")}.example/j/{journey.slug}</span></div>
          <div className="web-body" style={themeVars(brand, dark ? "dark" : "light")}>
            <div className="web-card">
              <WebPlayer key={seed} journey={live} adapter={adapter} lang={lang} onClose={restart} onExit={restart} />
            </div>
          </div>
        </div>
      ) : (
      <div className="phone-fit" ref={fit}>
        <div style={{ width: PHONE.w * scale, height: PHONE.h * scale, flex: "none" }}>
          <div className="phone" role="region" aria-label="Phone preview" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <div className="screen">
              <div>
                <ThemeProvider mode={dark ? "dark" : "light"} brand={brand}>
                  <JourneyPlayer key={seed} journey={live} adapter={adapter} lang={lang} onClose={restart} onExit={restart} />
                </ThemeProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
      <div className="faint" style={{ textAlign: "center" }}>Live preview · sandbox data · v{journey.version} draft</div>
    </>
  );
}
