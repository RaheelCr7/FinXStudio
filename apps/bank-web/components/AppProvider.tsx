"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { BankApp, IDLE, createLive, isRtl, type AppState } from "@finx/bank-client";
import { parseTrustedKeys } from "@finx/journey-schema";
import { sandboxAllowedFor, setSandboxPolicy } from "@finx/mock-bank-api";
import type { BrandLook, Preset } from "@finx/ui-kit";

export type ProjectInfo = { id: string; preset: Preset; name: string; shell: "meezan" | "bankworkx"; currency: string; /** How this bank's screens differ from the standard look. */ look?: BrandLook; /** Which bank API the project runs against (unset: the reference sandbox). */ bankApi?: string; /** The bank has a real sign-in (the sign-in journey); the sandbox customer picker is then for development only. */ signIn?: boolean };
type Ctx = { app: BankApp; project: ProjectInfo; /** False until a signed-in session has been looked for in this tab. */ ready: boolean };
const C = createContext<Ctx | null>(null);

const KEY = "finx.session";
type Saved = { project: string; personaId: string; lang: string; signedIn: boolean; scheme?: "system" | "light" | "dark" };
const readSaved = (project: string): Saved | null => { try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); return v?.project === project ? v : null; } catch { return null; } };
const write = (v: Saved) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: the session just will not survive a reload */ } };

/** The device the sandbox bank sees: the browser, which a customer can trust so that the next sign-in asks for no code. */
const BROWSER = { id: "dev_web", name: "This browser", kind: "browser" as const };
/**
 * The session timeout of a BankWorkx session: five quiet minutes, with a warning for the last one. NEXT_PUBLIC_FINX_IDLE_SECONDS shortens it for a
 * demo or a check on screen (a quarter of it, at most 60 seconds, is the warning); it is a setting of the build, never of the address.
 */
const idleConfig = () => {
  const n = Number(process.env.NEXT_PUBLIC_FINX_IDLE_SECONDS);
  const idleSeconds = Number.isFinite(n) && n >= 8 ? Math.floor(n) : IDLE.idleSeconds;
  return { idleSeconds, warningSeconds: Math.min(IDLE.warningSeconds, Math.max(4, Math.floor(idleSeconds / 4))) };
};
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One BankApp (shared with the Expo app) per bank, held in the browser. The sandbox bank lives in memory, so a reload starts it fresh:
 * only who is signed in and the language are remembered for the tab.
 */
function AppProviderInner({ project, children }: { project: ProjectInfo; children: React.ReactNode }) {
  const [app] = useState(() => new BankApp({ preset: project.preset, projectId: project.id, bankApi: project.bankApi, live: createLive({ brand: project.id, trustedKeys: parseTrustedKeys(process.env.NEXT_PUBLIC_FINX_TRUSTED_KEYS) }), studioUrl: "/api/studio", switchMs: reducedMotion() ? 250 : 900, signIn: project.signIn, device: BROWSER, ...(project.shell === "bankworkx" ? { idle: idleConfig() } : {}) }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readSaved(project.id);
    if (saved) {
      // a tab that was signed in picks its customer again (the sandbox restarts empty, so no password is asked); a tab that was not signed in picks nobody, so the sign-in starts clean
      if (saved.signedIn || app.getState().picker) app.selectPersona(saved.personaId);
      app.setLang(saved.lang);
      if (saved.scheme) app.setPrefs({ scheme: saved.scheme });
      if (saved.signedIn) app.login();
    }
    setReady(true);
  }, [app, project.id]);

  // remember who is signed in, and keep the page's language and direction in step with the chosen language
  useEffect(() => {
    if (!ready) return;
    const save = () => {
      const s = app.getState();
      write({ project: project.id, personaId: s.personaId, lang: s.lang, signedIn: s.screen !== "login", scheme: s.prefs.scheme });
      document.documentElement.lang = s.lang;
      document.documentElement.dir = isRtl(s.lang) ? "rtl" : "ltr";
      // light or dark is the customer's choice and survives switching places; "system" leaves it to the device
      if (s.prefs.scheme === "system") delete document.documentElement.dataset.mode; else document.documentElement.dataset.mode = s.prefs.scheme;
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

/**
 * A production build (NEXT_PUBLIC_FINX_ENV=production) does not run customers on the sandbox bank. Until it is connected to a real bank
 * it shows this notice instead, unless NEXT_PUBLIC_FINX_ALLOW_SANDBOX=1 marks it as a demo or pilot.
 */
const SANDBOX_OK = sandboxAllowedFor(process.env.NEXT_PUBLIC_FINX_ENV, process.env.NEXT_PUBLIC_FINX_ALLOW_SANDBOX);
setSandboxPolicy({ allowed: SANDBOX_OK });
export function AppProvider(props: { project: ProjectInfo; children: React.ReactNode }) {
  if (!SANDBOX_OK) return <main role="alert" style={{ padding: 32, maxWidth: 480, margin: "10vh auto", textAlign: "center" }}><h1 style={{ fontSize: 20 }}>Not available yet</h1><p>This app is not connected to a bank yet. Please contact your bank.</p></main>;
  return <AppProviderInner {...props} />;
}
