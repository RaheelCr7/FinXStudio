"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, CreditCard, KeyRound, Send, Sparkles } from "lucide-react";
import { projectShape } from "@finx/ui-kit";
import { commandFor, type Agent } from "@/lib/ai-command";
import { composeJourneyBrief, languageNames, TEMPLATES } from "@/lib/ai-brief";
import { useProjects } from "./Projects";

type JourneyRef = { slug: string; name: string; focus?: string };
type Pick = { slug: string; name: string };
const ICONS: Record<string, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = { "sign-in": KeyRound, "pay-a-bill": CreditCard, "send-money": Send };
const BLURB: Record<string, string> = { "sign-in": "Username, password, attempts left, locked and expired screens", "pay-a-bill": "Look the bill up, review, consent, one-time code", "send-money": "A saved payee, a daily limit, a one-time code" };

/**
 * One prompt and one button. The button copies the `claude` command and says where to paste it: AI runs in Claude Code on
 * the person's own subscription, so Studio hands over the command instead of calling any AI service. With a journey in
 * view (the Builder's Ask Claude) the command names it; on the AI assistant page it names the project.
 */
export function NewAiTask({ journey, journeys = [], compact }: { journey?: JourneyRef; /** journeys to check, on the page without one in view */ journeys?: Pick[]; compact?: boolean }) {
  const { current } = useProjects();
  const [mode, setMode] = useState<Agent>("journey");
  const [text, setText] = useState("");
  const [pick, setPick] = useState(journeys[0]?.slug ?? "");
  const [sent, setSent] = useState<"" | "copied" | "manual">("");

  const picked = journey ?? (mode === "review" ? journeys.find((j) => j.slug === pick) : undefined);
  const command = commandFor(mode, text, mode === "code" ? undefined : picked, { id: current.id, name: current.name });
  const ready = mode === "review" ? !!picked : text.trim().length > 0;
  const useTemplate = (id: string) => { const t = TEMPLATES.find((x) => x.id === id); if (t) { setText(composeJourneyBrief({ ...t.brief, languages: languageNames(projectShape(current).languages) })); setSent(""); } };
  async function go() {
    try { await navigator.clipboard.writeText(command); setSent("copied"); } catch { setSent("manual"); }
  }
  async function copyAgain() { try { await navigator.clipboard.writeText(command); setSent("copied"); } catch { /* the command is on screen to select */ } }

  const verb = mode === "review" ? "Check" : mode === "code" ? "Change" : journey ? "Change" : "Build";
  const placeholder = journey ? "What should change? For example: if the amount is more than 2,000, show a warning before the review."
    : mode === "code" ? "What should change in the code?"
    : mode === "review" ? "Anything to focus on? (optional)"
    : "Describe the journey: what the customer does, step by step, and what happens when something fails.";
  const where = mode === "code" ? "The change arrives as a pull request on GitHub."
    : mode === "review" ? "The report appears here when it is done."
    : journey ? "The change lands in this journey's draft. Nothing goes live until you publish it."
    : <>The draft appears under Journeys for <b>{current.name}</b>. Nothing goes live until you publish it.</>;

  return (
    <div className={compact ? "stack" : "ai-prompt"}>
      {!journey && mode === "journey" && !compact ? (
        <div className="ai-cards" aria-label="Start from an example">
          {TEMPLATES.map((t) => { const I = ICONS[t.id] ?? Sparkles; return <button key={t.id} className="ai-card" onClick={() => useTemplate(t.id)}><I size={18} aria-hidden /><b>{t.label}</b><span>{BLURB[t.id]}</span></button>; })}
        </div>
      ) : null}
      <div className="ai-box">
        {mode === "review" && !journey ? (
          <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Which journey?">
            {journeys.length === 0 ? <option value="">No journeys yet</option> : journeys.map((j) => <option key={j.slug} value={j.slug}>{j.name}</option>)}
          </select>
        ) : null}
        <textarea value={text} onChange={(e) => { setText(e.target.value); setSent(""); }} placeholder={placeholder} rows={compact ? 3 : 4} aria-label={mode === "review" ? "What to look at" : "What you want"} />
        <div className="row wrap">
          <div className="seg" role="group" aria-label="What should Claude do?">
            <button aria-pressed={mode === "journey"} onClick={() => { setMode("journey"); setSent(""); }}>{journey ? "Change" : "Build"}</button>
            <button aria-pressed={mode === "review"} onClick={() => { setMode("review"); setSent(""); }}>Check</button>
            {!journey ? <button aria-pressed={mode === "code"} onClick={() => { setMode("code"); setSent(""); }} title="For developers">Code</button> : null}
          </div>
          <div className="spacer" />
          <button className="btn primary" onClick={go} disabled={!ready}><Sparkles size={15} aria-hidden />{verb} with Claude</button>
        </div>
      </div>
      {sent ? (
        <div className="ai-next" role="status">
          <p><Check size={16} aria-hidden />{sent === "copied" ? "Copied." : "Copy the command below."} Paste it in Claude Code, in the FinX Studio folder, and press Enter. {where}{compact && mode !== "code" ? <> Watch it on the <Link href="/agents">AI assistant page</Link>.</> : null}</p>
          <details open={sent === "manual"}>
            <summary>{sent === "manual" ? "The command" : "Show the command"}</summary>
            <div className="cmd"><code>{command}</code><button className="btn sm" onClick={copyAgain}>Copy</button></div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
