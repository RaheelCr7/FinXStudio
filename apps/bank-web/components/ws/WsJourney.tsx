"use client";
import { useEffect, useState } from "react";
import { JourneyPlayer } from "@finx/renderer-web";
import { journeyAllowed, launchFromValues, type Live } from "@finx/bank-client";
import { Notice } from "./ScreenView";
import { useWs, wsHref } from "./use-ws";

/** A journey inside the workspace frame. Closing returns to the tab the person was on. */
export function WsJourney({ slug, values }: { slug: string; values: Record<string, string> }) {
  const { app, project, s, ctx, router, here, go } = useWs();
  const [live, setLive] = useState<Live | null | "loading">("loading");
  const allowed = !!ctx && journeyAllowed(slug, { context: ctx, entries: s.catalog.entries, settings: s.session.settings });
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    setLive("loading");
    void app.fetchJourney(slug).then((l) => { if (alive) setLive(l); });
    return () => { alive = false; };
  }, [app, slug, allowed]);
  const leave = () => { app.clearLaunch(); app.bump(); go(here({ tab: s.shellTab })); };
  // a journey asked to open another (navigate.toJourney): the values wait in the app until the next one loads
  const openOther = (r: { journey: string; launch: Record<string, any> }) => { app.setLaunch(r.journey, r.launch); router.replace(wsHref(project.id, here({ journey: app.resolveSlug(r.journey), values: {} }))); };
  if (!allowed) return <Notice icon="lock" title="Not available" text="This isn't available to you here." action="Back" onAction={leave} />;
  if (live === "loading") return <div className="ws-skel" aria-busy="true"><span className="wb-sr">Opening</span><i className="is-hero" /><i /></div>;
  if (!live) return <Notice icon="warn" title="Not available right now" action="Back" onAction={leave} />;
  // the address carries plain names: only the ones the journey's launch points declare get through, as launch.<name>
  const launch = { ...launchFromValues(slug, values), ...(app.launchFor(slug) ?? {}) };
  return (
    <div className="ws-journey">
      <JourneyPlayer key={live.journey.slug} journey={live.journey} session={ctx ? { permissions: ctx.permissions } : undefined} adapter={app.adapter} lang={s.lang} launch={Object.keys(launch).length ? launch : undefined} onOpenJourney={openOther} onClose={leave} onExit={leave} look={project.look} brandName={project.name} />
    </div>
  );
}
