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
  // what the bank allows may have changed while a journey ran (the administrator preview turns on inside Admin): read the session once before saying no
  const [reread, setReread] = useState<"no" | "asking" | "done">("no");
  useEffect(() => { if (ctx && !allowed && reread === "no") { setReread("asking"); void app.loadSession().finally(() => setReread("done")); } }, [ctx, allowed, reread, app]);
  const security = slug === "change-password" || slug === "trusted-devices" || slug === "change-quick-pin" || slug === "setup-quick-login";
  // a security journey opened by its address (a link, a typed address) asks for the step-up too; Cancel leaves
  const gate = allowed && app.needsStepUp(slug) && !s.arrived;
  useEffect(() => { if (gate && !s.stepUp) void app.askStepUp(here({ journey: slug, values }), "To go on."); }, [gate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!allowed || gate) return;
    let alive = true;
    setLive("loading");
    void app.fetchJourney(slug).then((l) => { if (alive) setLive(l); });
    return () => { alive = false; };
  }, [app, slug, allowed, gate]);
  const leave = () => { app.clearLaunch(); app.bump(); if (security) router.push(wsHref(project.id, { workspace: "personal", tab: "more", sub: "security" })); else go(here({ tab: s.shellTab })); };
  // a journey asked to open another (navigate.toJourney): the values wait in the app until the next one loads
  const openOther = (r: { journey: string; launch: Record<string, any> }) => { app.setLaunch(r.journey, r.launch); router.replace(wsHref(project.id, here({ journey: app.resolveSlug(r.journey), values: {} }))); };
  if (ctx && !allowed && reread !== "done") return <div className="ws-skel" aria-busy="true"><span className="wb-sr">Opening</span><i className="is-hero" /><i /></div>;
  if (!allowed) return <Notice icon="lock" title="Not available" text="This isn't available to you here." action="Back" onAction={leave} />;
  if (gate) return <Notice icon="lock" title="Confirm it’s you first" text="For your security, we ask before this." action="Back" onAction={() => { app.cancelStepUp(); leave(); }} />;
  if (live === "loading") return <div className="ws-skel" aria-busy="true"><span className="wb-sr">Opening</span><i className="is-hero" /><i /></div>;
  if (!live) return <Notice icon="warn" title="Not available right now" action="Back" onAction={leave} />;
  // the address carries plain names: only the ones the journey's launch points declare get through, as launch.<name>
  const launch = { ...launchFromValues(slug, values), ...(app.launchFor(slug) ?? {}) };
  return (
    <div className="ws-journey">
      <JourneyPlayer key={live.journey.slug} journey={live.journey} session={ctx ? { permissions: ctx.permissions } : undefined} adapter={app.adapter} lang={s.lang} launch={Object.keys(launch).length ? launch : undefined} onOpenJourney={openOther} onEvent={(e) => { if (e.type === "screen" && e.kind === "terminal") app.journeyFinished(); }} onClose={leave} onExit={leave} look={project.look} brandName={project.name} />
    </div>
  );
}
