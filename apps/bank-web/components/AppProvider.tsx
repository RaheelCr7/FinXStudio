"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { BankApp, createLive, isRtl, type AppState } from "@finx/bank-client";
import type { Preset } from "@finx/ui-kit";

export type ProjectInfo = { id: string; preset: Preset; name: string; shell: "meezan" | "bankworkx"; currency: string };
type Ctx = { app: BankApp; project: ProjectInfo; /** False until a signed-in session has been looked for in this tab. */ ready: boolean };
const C = createContext<Ctx | null>(null);

const KEY = "finx.session";
type Saved = { project: string; personaId: string; lang: string; signedIn: boolean };
const readSaved = (project: string): Saved | null => { try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); return v?.project === project ? v : null; } catch { return null; } };
const write = (v: Saved) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: the session just will not survive a reload */ } };

/**
 * One BankApp (shared with the Expo app) per bank, held in the browser. The sandbox bank lives in memory, so a reload starts it fresh:
 * only who is signed in and the language are remembered for the tab.
 */
export function AppProvider({ project, children }: { project: ProjectInfo; children: React.ReactNode }) {
  const [app] = useState(() => new BankApp({ preset: project.preset, live: createLive({ brand: project.id }), studioUrl: "/api/studio" }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readSaved(project.id);
    if (saved) {
      app.selectPersona(saved.personaId);
      app.setLang(saved.lang);
      if (saved.signedIn) app.login();
    }
    setReady(true);
  }, [app, project.id]);

  // remember who is signed in, and keep the page's language and direction in step with the chosen language
  useEffect(() => {
    if (!ready) return;
    const save = () => {
      const s = app.getState();
      write({ project: project.id, personaId: s.personaId, lang: s.lang, signedIn: s.screen !== "login" });
      document.documentElement.lang = s.lang;
      document.documentElement.dir = isRtl(s.lang) ? "rtl" : "ltr";
    };
    save();
    return app.subscribe(save);
  }, [app, project.id, ready]);

  useEffect(() => () => app.dispose(), [app]);
  return <C.Provider value={{ app, project, ready }}>{children}</C.Provider>;
}

export function useApp() { const v = useContext(C); if (!v) throw new Error("useApp needs AppProvider"); return v; }
/** The app store's current state, redrawing the component when it changes. */
export function useAppState(): AppState { const { app } = useApp(); return useSyncExternalStore(app.subscribe, app.getState, app.getState); }
