"use client";
import { useEffect, useRef } from "react";

/**
 * The sign-in page's backdrop: a slowly turning wire globe of data nodes with drifting satellites, drawn on one canvas in
 * the bank's accent colour. Decorative only (hidden from assistive technology). Under "reduce motion" it draws one still
 * frame; it stops drawing while the tab is hidden; the pointer offset the page tracks nudges the globe for a little depth.
 * A twin of Studio's own sign-in scene (apps/studio/components/signin): the two apps cannot import each other.
 */
export type Pointer = { x: number; y: number };

const POINTS = 420, SATELLITES = 44, LINK = 0.2, SAT_LINK = 120;

type Node3 = { x: number; y: number; z: number };

/** Evenly spread points on the unit sphere (Fibonacci lattice), and the pairs close enough to join. Both are fixed. */
function makeGlobe(): { nodes: Node3[]; pairs: [number, number][] } {
  const nodes: Node3[] = [], golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < POINTS; i++) {
    const y = 1 - (i / (POINTS - 1)) * 2, r = Math.sqrt(1 - y * y), a = golden * i;
    nodes.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < POINTS; i++) for (let j = i + 1; j < POINTS; j++) {
    const a = nodes[i]!, b = nodes[j]!, d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (d < LINK) pairs.push([i, j]);
  }
  return { nodes, pairs };
}

/** A deterministic pseudo-random sequence, so the scene is the same on every visit. */
function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** "r,g,b" from a hex colour; the brand's accent comes from the theme stylesheet. */
export function rgbOf(hex: string, fallback = "96,140,255"): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
/** The same colour pulled towards white, for highlights. */
export function lighter(rgb: string, amount = 0.45): string {
  return rgb.split(",").map((c) => Math.round(Number(c) + (255 - Number(c)) * amount)).join(",");
}

export function AmbientScene({ pointer, reducedMotion, accent }: { pointer: React.RefObject<Pointer>; reducedMotion: boolean; /** hex, the bank's accent */ accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current, host = canvas?.parentElement;
    if (!canvas || !host || typeof canvas.getContext !== "function") return;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.createRadialGradient !== "function") return;
    const BLUE = rgbOf(accent), CYAN = lighter(BLUE, 0.55), VIOLET = lighter(BLUE, 0.25);
    const { nodes, pairs } = makeGlobe();
    const rnd = seeded(7);
    const sats = Array.from({ length: SATELLITES }, () => ({ x: rnd(), y: rnd(), vx: (rnd() - 0.5) * 0.012, vy: (rnd() - 0.5) * 0.012, r: 1 + rnd() * 1.6, hue: rnd() }));
    const pulses = [12, 97, 180, 233, 301, 377];
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, t = 0;
    const eased: Pointer = { x: 0, y: 0 };
    const projected = new Float32Array(POINTS * 3);

    function resize() {
      const r = host!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now; t += dt;
      const target = pointer.current ?? { x: 0, y: 0 };
      eased.x += (target.x - eased.x) * 0.05; eased.y += (target.y - eased.y) * 0.05;

      ctx!.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.36, cx = w * 0.56 + eased.x * 16, cy = h * 0.46 + eased.y * 12;
      const spin = t * 0.09 + eased.x * 0.25, tilt = 0.38 + eased.y * 0.15;
      const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);

      // atmosphere behind the globe
      const halo = ctx!.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
      halo.addColorStop(0, `rgba(${BLUE},0.18)`); halo.addColorStop(0.55, `rgba(${VIOLET},0.06)`); halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = halo; ctx!.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);

      // rotate and project every node once
      for (let i = 0; i < POINTS; i++) {
        const n = nodes[i]!;
        const x1 = n.x * cs - n.z * sn, z1 = n.x * sn + n.z * cs;
        const y2 = n.y * ct - z1 * st, z2 = n.y * st + z1 * ct;
        projected[i * 3] = cx + x1 * R; projected[i * 3 + 1] = cy + y2 * R; projected[i * 3 + 2] = z2;
      }
      // links, dim at the back and brighter towards the viewer
      ctx!.lineWidth = 1;
      for (const [a, b] of pairs) {
        const z = (projected[a * 3 + 2]! + projected[b * 3 + 2]!) / 2;
        if (z < -0.35) continue;
        ctx!.strokeStyle = `rgba(${BLUE},${(0.06 + (z + 0.35) * 0.24).toFixed(3)})`;
        ctx!.beginPath(); ctx!.moveTo(projected[a * 3]!, projected[a * 3 + 1]!); ctx!.lineTo(projected[b * 3]!, projected[b * 3 + 1]!); ctx!.stroke();
      }
      // nodes
      for (let i = 0; i < POINTS; i++) {
        const z = projected[i * 3 + 2]!;
        if (z < -0.6) continue;
        const a = 0.12 + (z + 0.6) * 0.5, size = 0.9 + (z + 0.6) * 0.9;
        ctx!.fillStyle = `rgba(${i % 7 === 0 ? CYAN : BLUE},${a.toFixed(3)})`;
        ctx!.beginPath(); ctx!.arc(projected[i * 3]!, projected[i * 3 + 1]!, size, 0, Math.PI * 2); ctx!.fill();
      }
      // pulses: a few front nodes send out a ring in turn
      pulses.forEach((idx, k) => {
        const z = projected[idx * 3 + 2]!;
        if (z < 0.1) return;
        const phase = ((t * 0.45 + k * 0.37) % 1), x = projected[idx * 3]!, y = projected[idx * 3 + 1]!;
        ctx!.strokeStyle = `rgba(${CYAN},${((1 - phase) * 0.55 * z).toFixed(3)})`;
        ctx!.beginPath(); ctx!.arc(x, y, 3 + phase * 26, 0, Math.PI * 2); ctx!.stroke();
        ctx!.fillStyle = `rgba(${CYAN},${(0.6 * z).toFixed(3)})`;
        ctx!.beginPath(); ctx!.arc(x, y, 2.4, 0, Math.PI * 2); ctx!.fill();
      });
      // satellites: data nodes drifting around, joined when near each other
      for (const s of sats) {
        if (dt) { s.x += s.vx * dt; s.y += s.vy * dt; if (s.x < -0.05) s.x = 1.05; if (s.x > 1.05) s.x = -0.05; if (s.y < -0.05) s.y = 1.05; if (s.y > 1.05) s.y = -0.05; }
      }
      for (let i = 0; i < sats.length; i++) {
        const a = sats[i]!, ax = a.x * w + eased.x * 28, ay = a.y * h + eased.y * 20;
        for (let j = i + 1; j < sats.length; j++) {
          const b = sats[j]!, bx = b.x * w + eased.x * 28, by = b.y * h + eased.y * 20, d = Math.hypot(ax - bx, ay - by);
          if (d > SAT_LINK) continue;
          ctx!.strokeStyle = `rgba(${VIOLET},${((1 - d / SAT_LINK) * 0.28).toFixed(3)})`;
          ctx!.beginPath(); ctx!.moveTo(ax, ay); ctx!.lineTo(bx, by); ctx!.stroke();
        }
        ctx!.fillStyle = `rgba(${a.hue > 0.7 ? CYAN : VIOLET},0.75)`;
        ctx!.beginPath(); ctx!.arc(ax, ay, a.r, 0, Math.PI * 2); ctx!.fill();
      }
    }

    function loop(now: number) { draw(now); raf = requestAnimationFrame(loop); }
    function start() { if (reducedMotion) { last = 0; draw(performance.now()); return; } if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    const onVisibility = () => (document.hidden ? stop() : start());

    resize(); start();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { resize(); if (reducedMotion) draw(performance.now()); }) : null;
    ro?.observe(host);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); ro?.disconnect(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [pointer, reducedMotion, accent]);

  return <canvas ref={ref} className="wb-signin-canvas" aria-hidden="true" />;
}
