"use client";
import { useState } from "react";
import { ColoursTab } from "./DesignView";
import { TokensTab } from "./design/TokensTab";
import { ComponentsTab } from "./design/ComponentsTab";
import { WorkspaceTab } from "./design/WorkspaceTab";
import { useProjects } from "./Projects";

const TABS = [
  { id: "colours", label: "Colours" },
  { id: "tokens", label: "Sizes" },
  { id: "components", label: "Components" },
  { id: "personal", label: "Personal" },
  { id: "business", label: "Business" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** One place for a bank's design: its colours, the sizes of the shared components, a gallery of those components, and the look of its Personal and Business workspaces. */
export function DesignShell() {
  const { current } = useProjects();
  const [tab, setTab] = useState<Tab>("colours");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Design</h1>
          <p className="sub">How <b>{current.name}</b> looks, and the building blocks every screen is made from.</p>
        </div>
        <div className="seg" role="tablist" aria-label="Design">
          {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
      </div>
      <div role="tabpanel" className="stack" style={{ gap: 18 }}>
        {tab === "colours" ? <ColoursTab /> : tab === "tokens" ? <TokensTab /> : tab === "components" ? <ComponentsTab /> : <WorkspaceTab key={`${current.id}-${tab}`} workspace={tab} />}
      </div>
    </div>
  );
}
