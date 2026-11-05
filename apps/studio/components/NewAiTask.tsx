"use client";
import { useState } from "react";
import Link from "next/link";
import { commandFor, type Agent } from "@/lib/ai-command";
import { composeJourneyBrief, EMPTY_BRIEF, languageNames, TEMPLATES, type JourneyBrief } from "@/lib/ai-brief";
import { projectShape } from "@finx/ui-kit";
import { useProjects } from "./Projects";

type JourneyRef = { slug: string; name: string; focus?: string };
type Pick = { slug: string; name: string };

const MODES: { id: Agent; label: string; blurb: string }[] = [
  { id: "journey", label: "Build a journey", blurb: "Claude drafts the journey here, checks it, runs it in the sandbox, and leaves it for you to review." },
  { id: "review", label: "Check a journey", blurb: "Claude reads the journey, runs it in the sandbox, and reports what to fix: money safety, clarity, accessibility, translations. It changes nothing." },
  { id: "code", label: "Change the code", blurb: "For developers: Claude changes this repository on a branch, with tests, and opens a pull request." },
];

/**
 * "Build with AI": a guided brief, the exact `claude` command it becomes, and where to paste it. AI runs in Claude Code on
 * the person's own subscription, so Studio hands over the command instead of calling any AI service. With a journey in
 * view (the Builder's Ask Claude), the command already names it; on the AI assistant page it names the project.
 */
export function NewAiTask({ journey, journeys = [], compact }: { journey?: JourneyRef; /** journeys to check, on the page without one in view */ journeys?: Pick[]; compact?: boolean }) {
  const { current } = useProjects();
  const [mode, setMode] = useState<Agent>("journey");
  const [devs, setDevs] = useState(false);
  const [free, setFree] = useState(false);
  const [text, setText] = useState("");
  const [brief, setBrief] = useState<JourneyBrief>({ ...EMPTY_BRIEF, languages: languageNames(projectShape(current).languages) });
  const [template, setTemplate] = useState("");
  const [pick, setPick] = useState(journeys[0]?.slug ?? "");
  const [copied, setCopied] = useState(false);

  const guided = mode === "journey" && !journey && !free;
  const picked = journey ?? (mode === "review" ? journeys.find((j) => j.slug === pick) : undefined);
  const request = guided ? composeJourneyBrief(brief) : text;
  const command = commandFor(mode, request, mode === "code" ? undefined : picked, { id: current.id, name: current.name });
  const ready = guided ? brief.goal.trim().length > 0 : mode === "review" ? !!picked : text.trim().length > 0;
  const set = (k: keyof JourneyBrief) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setBrief({ ...brief, [k]: e.target.value }); setTemplate(""); };
  const useTemplate = (id: string) => { const t = TEMPLATES.find((x) => x.id === id); if (!t) return; setBrief({ ...t.brief, languages: brief.languages }); setTemplate(id); };

  async function copy() {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  const modes = MODES.filter((m) => m.id !== "code" || (devs && !journey));
  const blurb = MODES.find((m) => m.id === mode)!.blurb;
  return (
    <section className={compact ? "stack" : "card"} aria-label="Build with AI" style={{ gap: 12 }}>
      <div className="row wrap">
        <div className="seg" role="group" aria-label="What should Claude do?">
          {modes.map((m) => <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}
        </div>
        <div className="spacer" />
        {!journey && !devs ? <button className="link-btn" onClick={() => setDevs(true)}>For developers</button> : null}
      </div>
      <p className="muted" style={{ margin: 0 }}>{blurb}</p>

      <div className="ai-step"><span className="n">1</span>Describe it{journey ? <span className="faint">about “{journey.name}”{journey.focus ? `, ${journey.focus}` : ""}</span> : mode === "journey" ? <span className="faint">for <b>{current.name}</b> (switch project in the sidebar for another bank)</span> : null}</div>
      {guided ? (
        <>
          <div className="tpl" aria-label="Start from a template">Start from:{TEMPLATES.map((t) => <button key={t.id} aria-pressed={template === t.id} onClick={() => useTemplate(t.id)}>{t.label}</button>)}<span className="spacer" /><button className="link-btn" onClick={() => setFree(true)}>Write it in my own words</button></div>
          <div className="ai-grid">
            <label className="field wide">What should the customer be able to do? <small>one line, for example “Pay a utility bill from an account”</small>
              <input className="input" value={brief.goal} onChange={set("goal")} placeholder="Pay a utility bill from an account" />
            </label>
            <label className="field wide">The steps, in order <small>what they enter, choose and confirm</small>
              <textarea className="textarea" rows={2} value={brief.steps} onChange={set("steps")} placeholder="Pick the company, enter the reference, look the bill up, review it, tick consent, confirm with a one-time code" />
            </label>
            <label className="field">Rules <small>limits, who may do it, what needs a one-time code</small>
              <input className="input" value={brief.rules} onChange={set("rules")} placeholder="Daily limit checked before the review" />
            </label>
            <label className="field">When it fails <small>what the customer sees</small>
              <input className="input" value={brief.fails} onChange={set("fails")} placeholder="Already paid or no balance: say so, move no money" />
            </label>
            <label className="field">Languages <small>from the project; change if needed</small>
              <input className="input" value={brief.languages} onChange={set("languages")} placeholder="English" />
            </label>
          </div>
        </>
      ) : mode === "review" && !journey ? (
        <div className="ai-grid">
          <label className="field">Which journey?
            <select className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
              {journeys.length === 0 ? <option value="">No journeys yet</option> : journeys.map((j) => <option key={j.slug} value={j.slug}>{j.name}</option>)}
            </select>
          </label>
          <label className="field">Anything to focus on? <small>optional</small>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="the failure screens and the Arabic" />
          </label>
        </div>
      ) : (
        <label className="field">{mode === "review" ? "Anything to focus on? (optional)" : journey ? "What should change?" : mode === "code" ? "What should change in the code?" : "What should the journey do?"}
          <textarea className="textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={journey ? "If the amount is more than 2,000, show a warning screen before the review" : mode === "code" ? "Add a journey block that shows a download button" : "Pay a utility bill: pick the company, enter the reference, look the bill up, review, consent, one-time code. If it is already paid, say so and move no money."} />
          {mode === "journey" && !journey ? <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setFree(false)}>Back to the guided form</button> : null}
        </label>
      )}

      <div className="ai-step"><span className="n">2</span>Copy the command</div>
      <div className="cmd" role="group" aria-label="Command to run" aria-describedby="ai-ready">
        <code>{command}</code>
        <button className="btn sm" onClick={copy} aria-live="polite" disabled={!ready}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <p id="ai-ready" className="faint" style={{ margin: 0 }}>{ready ? "Ready to copy." : guided ? "Fill in the first line and the command is ready." : "Write what you want and the command is ready."}</p>

      <div className="ai-step"><span className="n">3</span>Paste it in Claude Code</div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Open Claude Code in the FinX Studio folder, paste the command and press Enter. The first time, it asks you to approve the <b>finx</b> tools.
        {mode === "journey" ? <> The run appears {compact ? <Link href="/agents" style={{ color: "var(--accent-text)" }}>on the AI assistant page</Link> : "below"} within a minute, and {journey ? "the change lands in this journey's draft" : <>the draft lands under Journeys for <b>{current.name}</b></>}. Nothing goes live until you publish it.</> : mode === "review" ? " The report appears as a run when it is done." : " The change arrives as a pull request on GitHub."}
      </p>
    </section>
  );
}
