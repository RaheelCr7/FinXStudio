"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AmbientScene, type Pointer } from "./AmbientScene";

/**
 * The frame around a bank's real sign-in: a dark stage with the globe and the bank's words on one side, a glass panel
 * with the sign-in journey (and the journeys it hands over to: forgot password, forgot username, unlock) on the other.
 * The journey inside keeps the bank's own look; the stage takes the bank's accent from the theme stylesheet.
 * Depth comes from --px/--py (the pointer's offset, set on desktop only) and from the canvas scene.
 */
export function SignInStage({ bank, children, after }: { bank: string; children: React.ReactNode; /** below the panel, for example the sandbox picker link */ after?: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const pointer = useRef<Pointer>({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [accent, setAccent] = useState("#4f7dff");

  useEffect(() => {
    // the bank's accent, as the theme stylesheet sets it
    const v = root.current ? getComputedStyle(root.current).getPropertyValue("--c-accent").trim() : "";
    if (v) setAccent(v);
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply(); mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (reducedMotion || e.pointerType !== "mouse") return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2, y = (e.clientY / window.innerHeight - 0.5) * 2;
    pointer.current = { x, y };
    root.current?.style.setProperty("--px", x.toFixed(3)); root.current?.style.setProperty("--py", y.toFixed(3));
  }, [reducedMotion]);
  const onPointerLeave = useCallback(() => { pointer.current = { x: 0, y: 0 }; root.current?.style.setProperty("--px", "0"); root.current?.style.setProperty("--py", "0"); }, []);

  return (
    <main ref={root} className="wb-signin" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <section className="wb-signin-stage" aria-label={`Welcome to ${bank}`}>
        <div className="wb-signin-mesh" aria-hidden="true" />
        <div className="wb-signin-grid" aria-hidden="true" />
        <AmbientScene pointer={pointer} reducedMotion={reducedMotion} accent={accent} />
        <div className="wb-signin-copy">
          <p className="wb-signin-eyebrow" style={{ "--i": 0 } as React.CSSProperties}><span className="wb-signin-dot" aria-hidden="true" />{bank}</p>
          <p className="wb-signin-headline" style={{ "--i": 1 } as React.CSSProperties}>The Future <em>Starts Here.</em></p>
          <p className="wb-signin-tagline" style={{ "--i": 2 } as React.CSSProperties}>One intelligent platform. Infinite possibilities.</p>
        </div>
      </section>
      <section className="wb-signin-side">
        <div className="wb-signin-panel">{children}</div>
        {after}
      </section>
    </main>
  );
}
