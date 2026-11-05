"use client";
import { useState } from "react";
import Link from "next/link";
import { projectShape } from "@finx/ui-kit";
import { commandFor, type Agent } from "@/lib/ai-command";
import { composeJourneyBrief, languageNames, TEMPLATES } from "@/lib/ai-brief";
import { useProjects } from "./Projects";

type JourneyRef = { slug: string; name: string; focus?: string };
type Pick = { slug: string; name: string };

/**
 * "Build with AI": one box for what you want, the `claude` command it becomes, and where to paste it. AI runs in Claude
 * Code on the person's own subscription, so Studio hands over the command instead of calling any AI service. With a
 * journey in view (the Builder's Ask Claude) the command names it; on the AI assistant page it names the project.
 */
export function NewAiTask({ journey, journeys = [], compact }: { journey?: JourneyRef; /** journeys to check, on the page without one in view */ journeys?: Pick[]; compact?: boolean }) {
  const { current } = useProjects();
  const [mode, setMode] = useState<Agent>("journey");
  const [devs, setDevs] = useState(false);
  const [text, setText] = useState("");
  const [template, setTemplate] = useState("");
  const [pick, setPick] = useState(journeys[0]?.slug ?? "");
  const [copied, setCopied] = useState(false);

  const picked = journey ?? (mode === "review" ? journeys.find((j) => j.slug === pick) : undefined);
  const command = commandFor(mode, text, mode === "code" ? undefined : picked, { id: current.id, name: current.name });
  const ready = mode === "review" ? !!picked : text.trim().length > 0;
  const useTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) { setText(composeJourneyBrief({ ...t.brief, languages: languageNames(projectShape(current).languages) })); setTemplate(id); }
  };
  async function copy() {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  const placeholder = journey ? "What should change? For example: if the amount is more than 2,000, show a warning screen before the review."
    : mode === "code" ? "What should change in the code? For example: add a journey block that shows a download button."
    : mode === "review" ? "Anything to focus on? For example: the failure screens and the Arabic. (optional)"
    : "What should the customer be able to do? Say the steps, the rules, and what happens when it fails. For example: pay a utility bill: pick the company, enter the reference, look the bill up, review, consent, one-time code. If it is already paid, say so and move no money.";
  const after = mode === "code" ? "The change arrives as a pull request on GitHub."
    : mode === "review" ? "The report appears here when it is done."
    : journey ? "The change lands in this journey's draft; nothing goes live until you publish it."
    : <>The draft appears under Journeys for <b>{current.name}</b>; nothing goes live until you publish it.</>;

  return (
    <section className={compact ? "stack" : "card"} aria-label="Build with AI" style={{ gap: 12 }}>
      <div className="row wrap">
        <div className="seg" role="group" aria-label="What should Claude do?">
          <button aria-pressed={mode === "journey"} onClick={() => setMode("journey")}>{journey ? "Change this journey" : "Build a journey"}</button>
          <button aria-pressed={mode === "review"} onClick={() => setMode("review")}>{journey ? "Check this journey" : "Check a journey"}</button>
          {devs && !journey ? <button aria-pressed={mode === "code"} onClick={() => setMode("code")}>Change the code</button> : null}
        </div>
        <div className="spacer" />
        {!journey && !devs ? <button className="link-btn" onClick={() => setDevs(true)}>For developers</button> : null}
      </div>

      {mode === "journey" && !journey ? (
        <div className="tpl" aria-label="Start from a template">Start from:{TEMPLATES.map((t) => <button key={t.id} aria-pressed={template === t.id} onClick={() => useTemplate(t.id)}>{t.label}</button>)}<span className="faint">or write your own below</span></div>
      ) : null}
      {mode === "review" && !journey ? (
        <label className="field">Which journey?
          <select className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
            {journeys.length === 0 ? <option value="">No journeys yet</option> : journeys.map((j) => <option key={j.slug} value={j.slug}>{j.name}</option>)}
          </select>
        </label>
      ) : null}
      <textarea className="textarea" rows={compact ? 3 : 4} value={text} onChange={(e) => { setText(e.target.value); setTemplate(""); }} placeholder={placeholder} aria-label={mode === "review" ? "What to look at" : "What you want"} />

      <div className="cmd" role="group" aria-label="Command to run">
        <code>{command}</code>
        <button className="btn sm primary" onClick={copy} aria-live="polite" disabled={!ready}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Paste this in Claude Code, in the FinX Studio folder. {after}{compact && mode !== "code" ? <> Watch it on the <Link href="/agents" style={{ color: "var(--accent-text)" }}>AI assistant page</Link>.</> : null}</p>
    </section>
  );
}
