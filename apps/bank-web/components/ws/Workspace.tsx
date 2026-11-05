"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { needsSwitch, parseLink, tabAllowed, tabLabel } from "@finx/bank-client";
import { Notice, ScreenView } from "./ScreenView";
import { WsJourney } from "./WsJourney";
import { useWs } from "./use-ws";

/** The page inside the frame: the link in the address, drawn once the app is in the place the link belongs to. */
export function Workspace() {
  const { app, project, s, ctx, router } = useWs();
  const path = usePathname();
  const link = parseLink(path.slice(`/${project.id}`.length));
  const active = s.session.info?.activeContextId;
  const mismatch = !!link && !!active && needsSwitch(link, active);
  // the place that was active when this address was opened: an address left behind by a switch is not a request to switch back
  const opened = useRef<{ path: string; active?: string }>({ path });
  if (opened.current.path !== path) opened.current = { path, active };
  else if (opened.current.active === undefined && active) opened.current = { path, active };
  const stale = mismatch && opened.current.active !== active;

  // an address into another place (a typed address, a reload, a shared link): offer to switch first
  useEffect(() => { if (link && mismatch && !stale && !s.offer && !s.stepUp && !s.switching) app.followLink(link); }, [app, path, mismatch, stale]); // eslint-disable-line react-hooks/exhaustive-deps
  // remember the tab for the place
  useEffect(() => { if (link?.tab && !mismatch && s.session.status === "ready") app.setShellTab(link.tab); }, [app, link?.tab, mismatch, s.session.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!link) return <Notice icon="info" title="Page not found" action="Home" onAction={() => router.replace(`/${project.id}/personal/home`)} />;
  if (stale) return <div className="ws-skel" aria-busy="true"><span className="wb-sr">Loading</span><i className="is-hero" /></div>;
  if (mismatch) {
    const label = link.workspace === "business" ? s.session.info?.contexts.find((c) => c.id === link.companyId)?.label : "Personal";
    return <Notice icon="lock" title={label ? `Switch to ${label}` : "Not available"} text={label ? undefined : "You don't have access to that."} action={label ? "Switch" : "Back to Personal"} onAction={() => (label ? void app.followLink(link) : router.replace(`/${project.id}/personal/home`))} />;
  }
  if (link.journey !== undefined) return <WsJourney key={link.journey} slug={link.journey} values={link.values} />;
  const tab = link.tab;
  if (!tabAllowed(ctx, tab) && ctx) return <ScreenView tab={tab} allowed={false} title={tabLabel(link.workspace, tab)} />;
  return <ScreenView key={`${active}:${tab}`} tab={tab} allowed title={tabLabel(link.workspace, tab)} />;
}
