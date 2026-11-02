"use client";
import { useState } from "react";

import { commandFor, type Agent } from "@/lib/ai-command";

const AGENTS: Record<Agent, { label: string; skill: string; blurb: string; placeholder: string; ctxPlaceholder?: string }> = {
  journey: {
    label: "Build or change a journey", skill: "finx-journey",
    blurb: "Claude Code builds the draft in Studio with the FinX tools, lints it, tests it in the sandbox, and leaves it here for your review.",
    placeholder: "Create a mobile top-up journey with carrier selection, an amount between 50 and 5,000, and OTP confirmation",
    ctxPlaceholder: "Describe the change, e.g. if the amount is more than 2,000, show a warning screen before the review",
  },
  review: {
    label: "Review a journey", skill: "finx-review",
    blurb: "Claude Code reads the journey, tests it in the sandbox and reports findings on money safety, clarity, accessibility, security and translations. It changes nothing.",
    placeholder: "pay-a-bill, focus on the failure screens",
    ctxPlaceholder: "Anything to focus on? (optional)",
  },
  code: {
    label: "Change Studio's code", skill: "finx-code",
    blurb: "Claude Code changes this repository on a feature branch with tests and opens a pull request for you to review.",
    placeholder: "Add a Tax certificate journey block that shows a download button",
  },
};

/**
 * Turns a request into the exact `claude` command to run. AI runs in Claude Code on your own subscription, so Studio hands over the
 * command instead of calling any AI service. With a journey, the command already names it.
 */
export function NewAiTask({ journey, compact }: { journey?: { slug: string; name: string }; compact?: boolean }) {
  const [agent, setAgent] = useState<Agent>("journey");
  const [brief, setBrief] = useState("");
  const [copied, setCopied] = useState(false);
  const a = AGENTS[agent];
  const withJourney = !!journey && agent !== "code";
  const command = commandFor(agent, brief, journey);

  async function copy() {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  return (
    <section className={compact ? "" : "card"} aria-label="Start an AI task" style={{ gap: 12, display: "flex", flexDirection: "column" }}>
      {compact ? null : <div className="row"><h3>Start an AI task</h3><span className="chip accent">✦ Claude Code</span></div>}
      <div className="seg" role="group" aria-label="What should Claude do?">
        {(Object.keys(AGENTS) as Agent[]).filter((k) => !(journey && k === "code")).map((k) => <button key={k} aria-pressed={agent === k} onClick={() => setAgent(k)}>{AGENTS[k].label}</button>)}
      </div>
      <p className="muted" style={{ margin: 0 }}>{a.blurb} It runs on your own Claude subscription.</p>
      <label className="field">{agent === "review" ? "What should it look at?" : "What should it do?"}
        <textarea className="textarea" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={withJourney ? a.ctxPlaceholder : a.placeholder} />
      </label>
      <div className="cmd" role="group" aria-label="Command to run">
        <code>{command}</code>
        <button className="btn sm" onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy"}</button>
      </div>
      <p className="faint" style={{ margin: 0 }}>Run it in the FinX Studio folder. The first time, Claude Code asks you to approve the <b>finx</b> tools. Publishing always asks again.</p>
    </section>
  );
}
