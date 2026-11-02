"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { displayName, homeView, isRtl } from "@finx/bank-client";
import { formatMoney } from "@finx/ui-kit";
import { localize } from "@finx/renderer-core";
import { useApp, useAppState } from "./AppProvider";

/** The Meezan home: balance, daily limit, and the services Studio has published. */
export function MeezanHome() {
  const { app, project } = useApp();
  const s = useAppState();
  const router = useRouter();
  const rtl = isRtl(s.lang);
  const persona = app.persona;
  const view = homeView(persona, s.catalog);
  const acc = view.account;

  return (
    <main className="wb-home" dir={rtl ? "rtl" : "ltr"} lang={s.lang}>
      <header className="wb-home-head">
        <div><p className="wb-muted">{rtl ? "خوش آمدید" : "Good morning"}</p><h1>{displayName(persona)}</h1></div>
        <div className="wb-actions">
          <button type="button" className="wb-btn wb-btn-ghost wb-btn-sm" lang={rtl ? "en" : "ur"} onClick={() => app.toggleLang()}>{rtl ? "English" : "اردو"}</button>
          <button type="button" className="wb-btn wb-btn-ghost wb-btn-sm" onClick={() => { app.logout(); router.push(`/${project.id}/login`); }}>Log out</button>
        </div>
      </header>

      {!view.hasAccounts ? (
        <section className="wb-card wb-card-warn" role="status"><b>Account opening was not approved</b><p>Your KYC was rejected. Contact support or try again with a new document.</p></section>
      ) : (
        <section className="wb-balance" key={s.tick} aria-label="Account balance">
          <p>{acc!.name} {acc!.maskedNumber}</p>
          <p className="wb-balance-amount">{formatMoney(acc!.balance, acc!.currency)}</p>
          <p>Daily limit used {formatMoney(view.limit.used)} of {formatMoney(view.limit.daily)}</p>
        </section>
      )}

      <h2>{rtl ? "سروسز" : "Services"}</h2>
      <ul className="wb-services">
        {s.catalog.entries.map((e) => {
          const name = localize(e.name, s.lang, "en");
          return (
            <li key={e.slug}>
              {view.hasAccounts
                ? <Link className="wb-service" href={`/${project.id}/j/${e.slug}`} prefetch={false}><span className="wb-service-icon" aria-hidden>{name.slice(0, 1)}</span><b>{name}</b><small>v{e.version}</small></Link>
                : <span className="wb-service is-disabled" aria-disabled="true"><span className="wb-service-icon" aria-hidden>{name.slice(0, 1)}</span><b>{name}</b><small>v{e.version}</small></span>}
            </li>
          );
        })}
      </ul>
      <p className={`wb-pill wb-pill-${view.sourcePill.tone}`}>{view.sourcePill.text}</p>
      <p className="wb-fine">Services come from the journeys published in FinX Studio. Publish a new journey there and it appears here.</p>
    </main>
  );
}
