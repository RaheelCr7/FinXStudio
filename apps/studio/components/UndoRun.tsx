"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Undo2 } from "lucide-react";

type Row = { slug: string; name: string; created: boolean; gone: boolean; editedSince: boolean; published: boolean };

/** The checkpoint of an agent run: which journeys it touched, and one click to put them back as they were before it started. */
export function UndoRun({ runId, journeys }: { runId: string; journeys: Row[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "force">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const live = journeys.filter((j) => !j.gone);

  const go = async (force: boolean) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/runs/${runId}/undo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      const d = await r.json();
      if (r.status === 409 && /edited after/.test(d.error)) { setStep("force"); setMsg(d.error); }
      else if (!r.ok) { setStep("idle"); setMsg(d.error ?? "Could not undo"); }
      else router.refresh();
    } catch { setMsg("Could not reach Studio"); }
    setBusy(false);
  };

  if (!journeys.length) return null;
  return (
    <div className="card" style={{ marginTop: 20 }} aria-label="Checkpoint">
      <div className="row wrap">
        <div><div className="faint">Checkpoint</div><h3>What this run changed</h3></div>
        <div className="spacer" />
        {step === "idle" ? <button className="btn" onClick={() => setStep("confirm")} disabled={!live.length}><Undo2 size={15} aria-hidden />Undo this run</button> : null}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {journeys.map((j) => (
          <li key={j.slug}>{j.name} <span className="faint">/{j.slug}</span> · {j.gone ? "already removed" : j.created ? "created by this run: undo removes it" : "changed by this run: undo restores the draft from before"}{j.editedSince ? " · edited by a person since" : ""}{j.created && j.published ? " · published, so it stays" : ""}</li>
        ))}
      </ul>
      {step !== "idle" ? (
        <div className="row wrap" style={{ gap: 8 }}>
          <span>{step === "force" ? "Overwrite those edits too?" : "Put everything back as it was before this run? Published versions are not touched."}</span>
          <div className="spacer" />
          <button className="btn" onClick={() => { setStep("idle"); setMsg(""); }} disabled={busy}>Keep the run</button>
          <button className="btn primary" onClick={() => go(step === "force")} disabled={busy}>{busy ? <LoaderCircle size={15} className="spin" aria-hidden /> : null}{step === "force" ? "Undo anyway" : "Yes, undo it"}</button>
        </div>
      ) : null}
      {msg ? <p role="alert" style={{ margin: 0, color: "var(--negative)" }}>{msg}</p> : null}
    </div>
  );
}
