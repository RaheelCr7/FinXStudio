"use client";
import { useEffect, useMemo, useState } from "react";
import type { Journey } from "@finx/journey-schema";
import { MockBank, personas } from "@finx/mock-bank-api";
import { JourneyPlayer, ThemeProvider } from "@finx/renderer-native";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function Preview({ journey }: { journey: Journey }) {
  const [persona, setPersona] = useState("ayesha");
  const [lang, setLang] = useState("en");
  const [dark, setDark] = useState(false);
  const [seed, setSeed] = useState(0);
  const live = useDebounced(journey, 450);
  const adapter = useMemo(() => {
    const bank = new MockBank(persona);
    return (id: string, input: Record<string, any>) => bank.call(id, input);
  }, [persona, seed]);
  const restart = () => setSeed((s) => s + 1);
  const supported = journey.locale.supported;

  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <div className="row wrap" style={{ width: 340, gap: 6 }}>
        <label className="field" style={{ flex: 1 }}>
          <span style={{ position: "absolute", left: -9999 }}>Customer</span>
          <select className="select" value={persona} onChange={(e) => { setPersona(e.target.value); restart(); }} aria-label="Sandbox customer">
            {Object.values(personas).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="row" style={{ gap: 4 }}>
          {supported.length > 1 ? <button className="btn sm" onClick={() => setLang(lang === "en" ? supported.find((l) => l !== "en") ?? "en" : "en")} aria-label="Switch preview language">{lang === "en" ? "اردو" : "English"}</button> : null}
          <button className="btn sm" onClick={() => setDark(!dark)} aria-label="Toggle dark preview">{dark ? "Light" : "Dark"}</button>
          <button className="btn sm" onClick={restart}>Restart</button>
        </div>
      </div>
      <div className="phone" role="region" aria-label="Phone preview">
        <div className="screen">
          <div>
            <ThemeProvider mode={dark ? "dark" : "light"}>
              <JourneyPlayer key={seed} journey={live} adapter={adapter} lang={lang} onClose={restart} onExit={restart} />
            </ThemeProvider>
          </div>
        </div>
      </div>
      <div className="faint">Live preview · sandbox data · v{journey.version} draft</div>
    </div>
  );
}
