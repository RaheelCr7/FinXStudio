"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, Pause, Play, X } from "lucide-react";
import type { Journey } from "@finx/journey-schema";
import { ScreenShot } from "./ScreenShot";
import { useSlides } from "./JourneySlider";

const en = (t: any) => (typeof t === "string" ? t : t?.en ?? "");

/** A bigger look at a journey: the screens playing in a phone, and the list of steps beside it. Click a step to stop on it. */
export function JourneyOverview({ journey, slug, onClose }: { journey: Journey; slug: string; onClose: () => void }) {
  const s = useSlides(journey, { every: 3200 });
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") s.go(1);
      else if (e.key === "ArrowLeft") s.go(-1);
    };
    document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key);
  }, [onClose, s.go]);
  const slide = s.slides[s.index];
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal overview" role="dialog" aria-modal="true" aria-label={`${en(journey.name)} screens`} ref={s.root}>
        <header className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{en(journey.name)}</h2>
            <div className="faint">{s.slides.length} screens · {journey.status === "published" ? `Live v${journey.version}` : "Draft"}</div>
          </div>
          <button ref={close} className="btn ghost icon" onClick={onClose} aria-label="Close"><X size={16} aria-hidden /></button>
        </header>
        <div className="overview-body">
          <div className="overview-phone">
            {slide ? <ScreenShot journey={journey} screenId={slide.id} scale={0.86} /> : null}
          </div>
          <div className="overview-side">
            <ol className="overview-steps" aria-label="Steps">
              {s.slides.map((x, i) => (
                <li key={x.id}>
                  <button className={i === s.index ? "on" : ""} aria-current={i === s.index ? "step" : undefined} onClick={() => { s.setIndex(i); s.setPaused(true); }}>
                    <span className="n">{x.ending === "success" ? <CircleCheck size={15} aria-hidden /> : x.ending === "failure" ? <CircleX size={15} aria-hidden /> : i + 1}</span>
                    <span>{x.title}<small>{x.kind === "terminal" ? (x.ending === "failure" ? "End · does not complete" : "End · done") : "Step"}</small></span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="row" style={{ gap: 6, marginTop: "auto" }}>
              <button className="btn icon" onClick={() => s.go(-1)} aria-label="Previous screen"><ArrowLeft size={15} aria-hidden /></button>
              <button className="btn icon" onClick={() => s.setPaused(!s.paused)} aria-label={s.paused ? "Play" : "Pause"} aria-pressed={!s.paused}>{s.paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}</button>
              <button className="btn icon" onClick={() => s.go(1)} aria-label="Next screen"><ArrowRight size={15} aria-hidden /></button>
              <div className="spacer" />
              <Link href={`/journeys/${slug}`} className="btn primary">Open in Builder</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
