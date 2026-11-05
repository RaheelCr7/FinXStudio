"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JourneyPlayer } from "@finx/renderer-web";
import { slugIs, type Live } from "@finx/bank-client";
import { instrumentOf } from "@finx/mock-bank-api";
import { useApp, useAppState } from "./AppProvider";

/** One journey on its own page. Closing or finishing returns to the bank's home. */
export function JourneyScreen() {
  const { slug } = useParams<{ slug: string }>();
  const { app, project } = useApp();
  const s = useAppState();
  const router = useRouter();
  // the stock someone was looking at, when they came from its page. Only a known symbol is accepted from the address.
  const symbol = useSearchParams().get("symbol");
  const initial = symbol && instrumentOf(symbol) ? (slugIs(slug, "invest") ? { "invest.symbol": symbol } : slugIs(slug, "sell-investment") ? { "sell.symbol": symbol } : undefined) : undefined;
  const [live, setLive] = useState<Live | null | "loading">("loading");
  useEffect(() => {
    let alive = true;
    setLive("loading");
    void app.fetchJourney(slug).then((l) => { if (alive) setLive(l); });
    return () => { alive = false; };
  }, [app, slug]);

  // values another journey gave this one (navigate.toJourney), set by the app before the address changed
  const launch = app.launchFor(slug);
  // a journey asked to open another: the address changes, the values wait in the app until the next journey loads
  const openOther = (r: { journey: string; launch: Record<string, any> }) => { app.setLaunch(r.journey, r.launch); router.replace(`/${project.id}/j/${app.resolveSlug(r.journey)}`); };
  const leave = () => { app.clearLaunch(); app.bump(); router.push(`/${project.id}/${project.shell === "bankworkx" ? "dashboard" : "home"}`); };
  if (live === "loading") return <main className="wb-loading" aria-busy="true"><span className="wb-sr">Opening</span></main>;
  if (!live) return <main className="wb-journey"><div className="wb-journey-card wb-pad"><h1>That journey is not available right now</h1><p className="wb-muted">It may not be published for this bank yet.</p><button className="wb-btn wb-btn-primary" onClick={leave}>Back</button></div></main>;
  return (
    <main className="wb-journey">
      <div className="wb-journey-card">
        <JourneyPlayer key={live.journey.slug} journey={live.journey} adapter={app.adapter} lang={s.lang} initial={initial} launch={launch} onOpenJourney={openOther} onClose={leave} onExit={leave} look={project.look} brandName={project.name} />
      </div>
    </main>
  );
}
