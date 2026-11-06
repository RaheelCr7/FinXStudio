"use client";
import type { LandingPoint } from "@finx/bank-client";

/**
 * What a person can do before signing in, under the sign-in: open an account, register for digital banking, track an application (the three actions the Landing has beside Sign in,
 * which is the screen itself) and, under Explore, the calculators, the branch finder and contact. Each opens a journey of the app in place of the sign-in; none needs a session.
 */
export function Landing({ points, onOpen }: { points: LandingPoint[]; onOpen: (p: LandingPoint) => void }) {
  const main = points.filter((p) => p.group === "main"), link = points.filter((p) => p.group === "link"), explore = points.filter((p) => p.group === "explore");
  if (!points.length) return null;
  return (
    <nav className="wb-landing" aria-label="Before you sign in">
      {main.length ? (
        <div className="wb-landing-actions">
          {main.map((p) => <button key={p.id} type="button" className="wb-landing-btn" onClick={() => onOpen(p)}>{p.label}</button>)}
        </div>
      ) : null}
      {link.map((p) => <p key={p.id} className="wb-landing-link"><button type="button" className="wb-link" onClick={() => onOpen(p)}>{p.label}</button></p>)}
      {explore.length ? (
        <section aria-labelledby="wb-explore">
          <h2 id="wb-explore" className="wb-landing-head">Explore</h2>
          <ul className="wb-landing-rows">
            {explore.map((p) => (
              <li key={p.id}>
                <button type="button" className="wb-landing-row" onClick={() => onOpen(p)}>
                  <span className="wb-landing-title">{p.label}</span>
                  {p.text ? <span className="wb-landing-text">{p.text}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </nav>
  );
}
