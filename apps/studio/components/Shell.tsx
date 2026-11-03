"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FilePlus2, FolderKanban, LibraryBig, Code2, Palette, Users, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Sun, Workflow } from "lucide-react";
import { CommandsProvider, useCommandPalette, type Command } from "./CommandPalette";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { UserSwitcher } from "./UserSwitcher";
import { useProjects } from "./Projects";

type Theme = "system" | "light" | "dark";
type Side = "open" | "rail";
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: the choice just won't persist */ } },
};

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { projects, current, setCurrent } = useProjects();
  const inBuilder = path.startsWith("/journeys/");
  const [theme, setTheme] = useState<Theme>("system");
  const [side, setSide] = useState<Side | null>(null);
  const [mac, setMac] = useState(false); // decided after mount so server and browser markup match

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const t = store.get("finx.theme"); if (t === "light" || t === "dark") setTheme(t);
    const s = store.get("finx.sidebar"); if (s === "open" || s === "rail") setSide(s);
  }, []);
  const applyTheme = useCallback((t: Theme) => {
    setTheme(t); store.set("finx.theme", t);
    if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  }, []);
  const dark = theme !== "light";
  const rail = (side ?? (inBuilder ? "rail" : "open")) === "rail";
  const toggleSide = useCallback(() => { const n: Side = rail ? "open" : "rail"; setSide(n); store.set("finx.sidebar", n); }, [rail]);

  const base: Command[] = useMemo(() => [
    { id: "go:journeys", title: "Journeys", group: "Go to", icon: Workflow, hint: "All journeys", run: () => router.push("/") },
    { id: "go:projects", title: "Projects", group: "Go to", icon: FolderKanban, hint: "Bank apps", run: () => router.push("/projects") },
    { id: "new:project", title: "New project", group: "General", icon: FilePlus2, keywords: "create bank app add", run: () => router.push("/projects?new=1") },
    ...projects.filter((p) => p.id !== current.id).map((p) => ({ id: `sw:${p.id}`, title: `Switch to ${p.name}`, group: "Projects", icon: FolderKanban, hint: p.bundleId, keywords: "project bank app", run: () => setCurrent(p.id) })),
    { id: "go:catalog", title: "Catalog", group: "Go to", icon: LibraryBig, hint: "Ready-made journeys", keywords: "templates library add", run: () => router.push("/catalog") },
    { id: "go:design", title: "Design", group: "Go to", icon: Palette, hint: "Colours from a picture", keywords: "colours theme brand upload image logo", run: () => router.push("/design") },
    { id: "go:code", title: "Code", group: "Go to", icon: Code2, hint: "Generated source of this project", keywords: "export source download repo", run: () => router.push("/code") },
    { id: "go:people", title: "People and roles", group: "Go to", icon: Users, hint: "Who can edit and publish", keywords: "users permissions team", run: () => router.push("/people") },
    { id: "go:agents", title: "Agents", group: "Go to", icon: Sparkles, hint: "AI work", run: () => router.push("/agents") },
    { id: "new", title: "New journey", group: "General", icon: FilePlus2, keywords: "create add", run: () => { if (path === "/") window.dispatchEvent(new Event("finx:new-journey")); else router.push("/?new=1"); } },
    { id: "theme:light", title: "Light theme", group: "General", icon: Sun, keywords: "appearance", run: () => applyTheme("light") },
    { id: "theme:dark", title: "Dark theme", group: "General", icon: Moon, keywords: "appearance", run: () => applyTheme("dark") },
    { id: "theme:system", title: "Match system theme", group: "General", icon: Monitor, keywords: "appearance auto", run: () => applyTheme("system") },
    { id: "side", title: rail ? "Expand sidebar" : "Collapse sidebar", group: "General", icon: rail ? PanelLeftOpen : PanelLeftClose, run: toggleSide },
  ], [router, path, applyTheme, rail, toggleSide, projects, current.id, setCurrent]);

  return (
    <CommandsProvider base={base}>
      <div className={`app ${rail ? "rail" : ""}`}>
        <aside className="sidebar" aria-label="Main">
          <Link href="/" className="brand" aria-label="FinX Studio home"><span className="mark">F</span><span className="lbl">FinX Studio</span></Link>
          <ProjectSwitcher />
          <SearchButton mac={mac} />
          <nav className="nav" aria-label="Sections">
            <Link href="/" className={path === "/" || inBuilder ? "on" : ""} aria-current={path === "/" || inBuilder ? "page" : undefined} title="Journeys"><Workflow size={18} aria-hidden /><span className="lbl">Journeys</span></Link>
            <Link href="/catalog" className={path.startsWith("/catalog") ? "on" : ""} aria-current={path.startsWith("/catalog") ? "page" : undefined} title="Catalog"><LibraryBig size={18} aria-hidden /><span className="lbl">Catalog</span></Link>
            <Link href="/projects" className={path.startsWith("/projects") ? "on" : ""} aria-current={path.startsWith("/projects") ? "page" : undefined} title="Projects"><FolderKanban size={18} aria-hidden /><span className="lbl">Projects</span></Link>
            <Link href="/design" className={path.startsWith("/design") ? "on" : ""} aria-current={path.startsWith("/design") ? "page" : undefined} title="Design"><Palette size={18} aria-hidden /><span className="lbl">Design</span></Link>
            <Link href="/code" className={path.startsWith("/code") ? "on" : ""} aria-current={path.startsWith("/code") ? "page" : undefined} title="Code"><Code2 size={18} aria-hidden /><span className="lbl">Code</span></Link>
            <Link href="/people" className={path.startsWith("/people") ? "on" : ""} aria-current={path.startsWith("/people") ? "page" : undefined} title="People"><Users size={18} aria-hidden /><span className="lbl">People</span></Link>
            <Link href="/agents" className={path.startsWith("/agents") ? "on" : ""} aria-current={path.startsWith("/agents") ? "page" : undefined} title="Agents"><Sparkles size={18} aria-hidden /><span className="lbl">Agents</span></Link>
          </nav>
          <div className="side-foot">
            <UserSwitcher />
            <button className="collapse-btn" onClick={() => applyTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}<span className="lbl">{dark ? "Light theme" : "Dark theme"}</span>
            </button>
            <button className="collapse-btn" onClick={toggleSide} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} title={rail ? "Expand sidebar" : "Collapse sidebar"}>
              {rail ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span className="lbl">Collapse</span>
            </button>
          </div>
        </aside>
        <main className={`main ${inBuilder ? "fill" : ""}`}>{children}</main>
      </div>
    </CommandsProvider>
  );
}

function SearchButton({ mac }: { mac: boolean }) {
  const { setOpen } = useCommandPalette();
  return (
    <button className="search-btn" onClick={() => setOpen(true)} aria-label="Search and commands" title="Search (⌘K)">
      <Search size={16} aria-hidden /><span className="lbl">Search…</span><kbd>{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}
