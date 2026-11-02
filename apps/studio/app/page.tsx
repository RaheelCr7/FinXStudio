import Link from "next/link";
import { listJourneys } from "@/lib/store";
import { NewJourney } from "@/components/NewJourney";

export const dynamic = "force-dynamic";
const text = (t: any) => (typeof t === "string" ? t : t?.en ?? "");

export default async function Home() {
  const journeys = await listJourneys();
  return (
    <main className="page">
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>Journeys</h1>
          <p className="sub">Edit a journey visually, preview it on a phone, and publish it to the app.</p>
        </div>
        <div className="spacer" />
        <NewJourney />
      </div>
      <div className="grid">
        {journeys.map((j) => (
          <Link key={j.slug} href={`/journeys/${j.slug}`} className="card">
            <div className="row">
              <h3>{text(j.name)}</h3>
              <div className="spacer" />
              {j.publishedVersion == null ? <span className="chip">Draft</span> : j.draftDiffers ? <span className="chip warn">Unpublished changes</span> : <span className="chip pos">Published v{j.publishedVersion}</span>}
            </div>
            <div className="row wrap muted" style={{ fontSize: 13 }}>
              <span>{j.screens} screens</span><span>·</span><span>{j.channels.join(" + ")}</span>
              {j.issues ? <><span>·</span><span style={{ color: "var(--warning)" }}>{j.issues} lint issue{j.issues > 1 ? "s" : ""}</span></> : null}
            </div>
            <div className="faint">/{j.slug} · updated {new Date(j.updatedAt).toLocaleString()}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
