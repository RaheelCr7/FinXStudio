"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "../Projects";
import { useWho } from "../Who";

type Style = "standard" | "stage";

/** How the web app's sign-in page frames the sign-in journey for this bank. Saved to the bank's look in brands.json. */
export function SignInStyle() {
  const router = useRouter();
  const { current } = useProjects();
  const { can } = useWho();
  const saved: Style = current.look?.signIn === "stage" ? "stage" : "standard";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const allowed = can("projects");

  async function choose(signIn: Style) {
    if (signIn === saved || busy) return;
    setBusy(true); setErr("");
    const res = await fetch(`/api/projects/${current.id}/sign-in`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signIn }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not save the sign-in page"); return; }
    router.refresh();
  }

  return (
    <section className="card" aria-label="Sign-in page" style={{ gap: 10 }}>
      <div className="row wrap" style={{ gap: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3>Sign-in page</h3>
          <p className="muted" style={{ margin: "4px 0 0" }}>How the web app frames the sign-in journey. The journey itself, with forgot password and unlock, is the same either way.</p>
        </div>
        <div className="seg" role="group" aria-label="Sign-in page style">
          <button aria-pressed={saved === "standard"} disabled={busy || !allowed} onClick={() => choose("standard")} title={allowed ? undefined : "Your role cannot change projects"}>Standard</button>
          <button aria-pressed={saved === "stage"} disabled={busy || !allowed} onClick={() => choose("stage")} title={allowed ? undefined : "Your role cannot change projects"}>Stage</button>
        </div>
      </div>
      <p className="faint" style={{ margin: 0 }}>{saved === "stage" ? "A dark stage: a globe drawn in the bank's accent and the bank's name beside a glass panel with the sign-in." : "The plain page: the sign-in journey on the bank's page colour."}</p>
      {err ? <p role="alert" style={{ margin: 0, color: "var(--negative)" }}>{err}</p> : null}
    </section>
  );
}
