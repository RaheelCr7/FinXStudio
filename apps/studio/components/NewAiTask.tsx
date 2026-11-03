"use client";
import { useState } from "react";

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function NewAiTask() {
  const [brief, setBrief] = useState("");
  const [copied, setCopied] = useState(false);
  const command = `claude ${shellQuote(`/finx-journey ${brief.trim() || "<describe the journey>"}`)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  return (
    <section className="card" aria-label="Start an AI task" style={{ gap: 12 }}>
      <div className="row"><h3>Start an AI task</h3><span className="chip accent">✦ Journey agent</span></div>
      <p className="muted" style={{ margin: 0 }}>Describe a journey. Claude Code builds the draft in Studio with the FinX tools, lints it, tests it in the sandbox, and leaves it here for your review. It runs on your own Claude subscription.</p>
      <label className="field">What should the journey do?
        <textarea className="textarea" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Create a mobile top-up journey with carrier selection, an amount between 50 and 5,000, and OTP confirmation" />
      </label>
      <div className="cmd" role="group" aria-label="Command to run">
        <code>{command}</code>
        <button className="btn sm" onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy"}</button>
      </div>
      <p className="faint" style={{ margin: 0 }}>Run it in the FinX Studio folder. The first time, Claude Code asks you to approve the <b>finx</b> tools. Publishing always asks again.</p>
    </section>
  );
}
