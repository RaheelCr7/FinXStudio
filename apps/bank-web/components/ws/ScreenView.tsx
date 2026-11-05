"use client";
import { useEffect, useState } from "react";
import { Icon, ProgressBar } from "@finx/renderer-web";
import { isRowLevel, isSectionLevel, screenIsEmpty, type LaunchPoint, type Row, type Screen, type Section, type ShellTab } from "@finx/bank-client";
import { useWs } from "./use-ws";

function Skeleton() {
  return <div className="ws-skel" aria-busy="true"><span className="wb-sr">Loading</span><i className="is-hero" /><i /><i /><i /></div>;
}

export function Notice({ icon, title, text, action, onAction, role }: { icon: string; title: string; text?: string; action?: string; onAction?: () => void; role?: "alert" }) {
  return (
    <div className="ws-notice" role={role}>
      <span className="ws-notice-icon" aria-hidden><Icon name={icon} size={24} /></span>
      <h2>{title}</h2>
      {text ? <p className="wb-muted">{text}</p> : null}
      {action ? <button type="button" className="wb-btn wb-btn-primary" onClick={onAction}>{action}</button> : null}
    </div>
  );
}

function Buttons({ points, passed, small }: { points: LaunchPoint[]; passed?: Record<string, string>; small?: boolean }) {
  const { launch } = useWs();
  if (points.length === 0) return null;
  return <div className="ws-btns">{points.map((lp) => <button key={lp.id} type="button" className={`wb-btn ${small ? "wb-btn-sm wb-btn-ghost" : "wb-btn-primary"}`} onClick={() => launch(lp, passed)}>{lp.label}</button>)}</div>;
}

function RowView({ row }: { row: Row }) {
  const { app } = useWs();
  const [open, setOpen] = useState(false);
  const points = row.place ? app.launchPoints({ place: row.place }).filter(isRowLevel) : [];
  const body = (
    <>
      <span className="ws-row-text"><b>{row.title}</b>{row.subtitle ? <small>{row.subtitle}</small> : null}{row.progress !== undefined ? <ProgressBar value={row.progress} max={100} label={row.title} tone={row.tone === "negative" ? "negative" : "positive"} /> : null}</span>
      {row.tag ? <span className={`ws-tag ws-tag-${row.tone ?? "neutral"}`}>{row.tag}</span> : null}
      {row.value ? <span className={`ws-value ${row.tone === "positive" ? "wb-pos" : ""}`}>{row.value}</span> : null}
      {points.length ? <Icon name={open ? "chevronDown" : "chevronRight"} size={16} /> : null}
    </>
  );
  return (
    <li className="ws-row">
      {points.length ? <button type="button" className="ws-row-main" aria-expanded={open} onClick={() => setOpen(!open)}>{body}</button> : <div className="ws-row-main">{body}</div>}
      {open ? <Buttons points={points} passed={row.passes} small /> : null}
    </li>
  );
}

function SectionView({ section }: { section: Section }) {
  const { app } = useWs();
  const points = section.place ? app.launchPoints({ place: section.place }).filter(isSectionLevel) : [];
  return (
    <section className="ws-section" aria-labelledby={`ws-s-${section.id}`}>
      <div className="ws-section-head"><h2 id={`ws-s-${section.id}`}>{section.title}</h2>{points.length ? <Buttons points={points} small /> : null}</div>
      {section.rows.length === 0 ? <p className="ws-section-empty wb-muted">{section.empty}</p> : <ul className="ws-rows">{section.rows.map((r) => <RowView key={r.id} row={r} />)}</ul>}
    </section>
  );
}

/** One tab: loading, error (with a retry), empty, no access, or the data. */
export function ScreenView({ tab, allowed, title }: { tab: ShellTab; allowed: boolean; title: string }) {
  const { app, s, project, router } = useWs();
  const active = s.session.info?.activeContextId;
  useEffect(() => { if (allowed) void app.loadShell(tab); }, [app, tab, allowed, active, s.tick]);
  const view = allowed ? s.views[app.viewKey(tab)] : undefined;
  const screen = view?.data as Screen | undefined;
  const head = app.launchPoints({ place: tab }).filter(isSectionLevel);
  const hub = app.launchPoints({ place: `${tab}.hub` });
  let body: React.ReactNode;
  if (!allowed) body = <Notice icon="lock" title="No access" text="Your role here doesn't include this." />;
  else if (view?.status === "error" && (!screen || view.code === "SESSION_EXPIRED")) {
    body = view.code === "SESSION_EXPIRED"
      ? <Notice role="alert" icon="clock" title="You were signed out" text="For your security. Sign in again to continue." action="Sign in" onAction={() => { app.logout(); router.push(`/${project.id}/login`); }} />
      : <Notice role="alert" icon="warn" title="Could not load" text={view.error} action="Try again" onAction={() => void app.loadShell(tab, true)} />;
  } else if (!screen) body = <Skeleton />;
  else if (screenIsEmpty(screen)) body = <Notice icon="info" title="Nothing here yet" />;
  else {
    body = (
      <>
        {screen.hero ? (
          <section className="ws-hero" aria-label={screen.hero.label}>
            <p>{screen.hero.label}</p>
            <b className="ws-hero-amount">{screen.hero.value}</b>
            {screen.hero.lines.length ? <ul className="ws-hero-lines">{screen.hero.lines.map((l) => <li key={l.label}>{l.value}</li>)}</ul> : null}
          </section>
        ) : null}
        <div className="ws-sections">{screen.sections.map((x) => <SectionView key={x.id} section={x} />)}</div>
      </>
    );
  }
  return (
    <div className="ws-screen" aria-busy={view?.status === "loading"}>
      <div className="ws-title"><h1>{title}</h1>{view?.status === "loading" && screen ? <span className="ws-refresh" role="status">Updating...</span> : null}</div>
      {view?.status === "error" && screen && view.code !== "SESSION_EXPIRED" ? <div className="ws-banner" role="alert"><span>{view.error}</span><button type="button" className="wb-btn wb-btn-sm wb-btn-ghost" onClick={() => void app.loadShell(tab, true)}>Try again</button></div> : null}
      {allowed && head.length ? <Buttons points={head} /> : null}
      {allowed && hub.length ? <div className="ws-hub">{hub.map((lp) => <HubButton key={lp.id} lp={lp} />)}</div> : null}
      {body}
    </div>
  );
}

function HubButton({ lp }: { lp: LaunchPoint }) {
  const { launch } = useWs();
  return <button type="button" className="ws-hub-btn" onClick={() => launch(lp)}><Icon name={lp.icon ?? "send"} size={20} /><span>{lp.label}</span></button>;
}
