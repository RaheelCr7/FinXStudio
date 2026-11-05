"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { actionMeta, displayName, initials, notifications, orderedActions, usd } from "@finx/bank-client";
import { Icon, IconTile, Pill } from "@finx/renderer-web";
import { localize } from "@finx/renderer-core";
import { useApp, useAppState } from "../AppProvider";
import { Modal } from "./parts";

const NAV = [
  { href: "dashboard", label: "Dashboard", icon: "home" },
  { href: "accounts", label: "Accounts", icon: "accounts" },
  { href: "budgets", label: "Budgets", icon: "budgets" },
  { href: "wallet", label: "Wallet", icon: "wallet" },
  { href: "invest", label: "Invest", icon: "trend" },
];

/** The BankWorkx frame: a side menu on wide screens and a bottom bar on narrow ones, the quick-action, notification and account dialogs, and notices. */
export function BankworkxShell({ children }: { children: React.ReactNode }) {
  const { app, project } = useApp();
  const s = useAppState();
  const path = usePathname();
  const router = useRouter();
  const persona = app.persona;
  const fin = persona.finance;
  const sub = fin?.subscriptions.find((x) => x.id === s.subId) ?? null;
  const first = persona.accounts[0];
  const [, setBusy] = useState(false);

  return (
    <div className="wb-app">
      <a className="wb-skip" href="#main">Skip to content</a>
      <nav className="wb-nav" aria-label="Main">
        <Link href={`/${project.id}/dashboard`} className="wb-brand"><span className="wb-mark" aria-hidden>{project.name.slice(0, 1)}</span><span>{project.name}</span></Link>
        <ul>
          {NAV.map((n) => {
            const href = `/${project.id}/${n.href}`;
            const on = path === href || path.startsWith(`${href}/`);
            return <li key={n.href}><Link href={href} aria-current={on ? "page" : undefined} className={on ? "is-on" : ""}><Icon name={n.icon} size={22} /><span>{n.label}</span></Link></li>;
          })}
        </ul>
      </nav>

      <div className="wb-stage">
        <header className="wb-top">
          <button type="button" className="wb-user" onClick={() => app.openSheet("menu")} aria-label={`Account menu, ${displayName(persona)}`}>
            <span className="wb-avatar" aria-hidden>{initials(persona)}</span>
            <span><small>Welcome back,</small><b>{displayName(persona)}</b></span>
          </button>
          <div className="wb-top-actions">
            <button type="button" className="wb-btn wb-btn-primary wb-btn-sm" onClick={() => app.openSheet("fab")}><Icon name="plus" size={16} stroke={2.6} /> New</button>
            <button type="button" className="wb-icon-btn" aria-label="Notifications" onClick={() => app.openSheet("notes")}><Icon name="bell" size={22} /><span className="wb-dot" aria-hidden /></button>
          </div>
        </header>
        <main id="main" className="wb-main" tabIndex={-1}>{children}</main>
      </div>

      <Modal open={s.sheet === "fab"} onClose={() => app.closeSheet()} title="What would you like to do?">
        {s.catalog.entries.length === 0 ? <p className="wb-muted">No actions are available right now.</p> : (
          <ul className="wb-action-list">
            {orderedActions(s.catalog.entries).map((e) => {
              const meta = actionMeta(e.slug);
              return (
                <li key={e.slug}>
                  <Link className="wb-action" href={`/${project.id}/j/${e.slug}`} prefetch={false} onClick={() => app.closeSheet()}>
                    <IconTile icon={meta.icon} size={46} />
                    <span><b>{localize(e.name, "en", "en")}</b><small>{meta.text || `Version ${e.version}`}</small></span>
                    <Icon name="chevronRight" size={18} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pill tone={s.catalog.source === "studio" ? "positive" : "neutral"}>{s.catalog.source === "studio" ? "Live from Studio" : "Offline copies"}</Pill>
      </Modal>

      <Modal open={s.sheet === "notes"} onClose={() => app.closeSheet()} title="Notifications">
        <ul className="wb-notes">
          {notifications(fin, usd).map((n, i) => <li key={i} className={`is-${n.tone}`}><IconTile icon={n.icon} size={38} /><span>{n.text}</span></li>)}
        </ul>
      </Modal>

      <Modal open={s.sheet === "menu"} onClose={() => { if (app.getState().sheet === "menu") app.closeSheet(); }} title={displayName(persona) || "Menu"}>
        <p className="wb-muted">Signed in as a sandbox customer. No real money moves.</p>
        <button type="button" className="wb-btn wb-btn-danger" onClick={() => app.askSignOut()}>Log out</button>
      </Modal>

      <Modal open={!!sub} onClose={() => app.cancelPayment()} title="Pay subscription">
        {sub ? (
          <div className="wb-pay">
            <div className="wb-pay-row"><span className="wb-sub-logo" style={{ background: sub.color }} aria-hidden>{sub.name[0]}</span><span><b>{sub.name}</b><small>Monthly subscription</small></span><b className="wb-num">{usd(sub.amount)}</b></div>
            <p className="wb-box">From <b>{first?.name} {first?.maskedNumber}</b> · {usd(first?.balance ?? 0)} available</p>
            <button type="button" className="wb-btn wb-btn-primary" disabled={s.paying} onClick={async () => { setBusy(true); await app.confirmPayment(); setBusy(false); }}>{s.paying ? "Paying…" : `Pay ${usd(sub.amount)}`}</button>
          </div>
        ) : null}
      </Modal>

      <div className="wb-toast-zone" aria-live="polite">
        {s.toast ? <div className={`wb-toast ${s.toast.ok ? "is-ok" : "is-bad"}`} role={s.toast.ok ? "status" : "alert"}><Icon name={s.toast.ok ? "check" : "x"} size={14} stroke={3} />{s.toast.text}</div> : null}
      </div>
    </div>
  );
}
