"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Journey } from "@finx/journey-schema";
import { slidesOf, stepIndex } from "@/lib/slides";
import { ScreenShot } from "./ScreenShot";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Steps through a journey's screens by itself, one at a time. It runs only while it is on screen and not hovered, and not at all
 * for people who asked for less motion (they use the dots).
 */
export function useSlides(journey: Journey, opts: { every?: number; auto?: boolean } = {}) {
  const slides = useMemo(() => slidesOf(journey), [journey]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const auto = (opts.auto ?? true) && !prefersReducedMotion();
  useEffect(() => {
    const el = root.current; if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.3 });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!auto || paused || !visible || slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => stepIndex(i, slides.length)), opts.every ?? 2600);
    return () => clearInterval(t);
  }, [auto, paused, visible, slides.length, opts.every]);
  const go = useCallback((by: number) => setIndex((i) => stepIndex(i, slides.length, by)), [slides.length]);
  return { slides, index: Math.min(index, Math.max(slides.length - 1, 0)), setIndex, go, paused, setPaused, root, auto };
}

/** The picture on a journey card: the current screen in a phone, its name, and dots for the steps. */
export function CardSlider({ journey }: { journey: Journey }) {
  const s = useSlides(journey);
  const slide = s.slides[s.index];
  if (!slide) return null;
  return (
    <div className="shot" ref={s.root} onMouseEnter={() => s.setPaused(true)} onMouseLeave={() => s.setPaused(false)}>
      <div className="shot-stage"><ScreenShot journey={journey} screenId={slide.id} scale={0.5} /></div>
      <div className="shot-caption" aria-live="off">
        <span className="shot-step">{s.index + 1} / {s.slides.length}</span>
        <span className="shot-title">{slide.title}</span>
      </div>
      <div className="shot-dots" aria-hidden>
        {s.slides.map((x, i) => <i key={x.id} className={`${i === s.index ? "on" : ""} ${x.ending ?? ""}`} />)}
      </div>
    </div>
  );
}
