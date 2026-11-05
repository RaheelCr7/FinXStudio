"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { filtersOn, NO_FILTERS, type HistoryQuery, type HistoryRow, type LaunchPoint } from "@finx/bank-client";
import { Modal } from "../bankworkx/parts";
import { Notice } from "./ScreenView";
import { useWs } from "./use-ws";

const unavailable = (code?: string) => code === "SERVICE_UNAVAILABLE" || code === "TIMEOUT";
const RESULTS = [["all", "All"], ["ok", "Signed in"], ["failed", "Failed"]] as const;
const PERIODS = [[7, "Last 7 days"], [30, "Last 30 days"], [90, "Last 90 days"]] as const;

/**
 * Settings > Security (web: /personal/more/settings/security). The password, the ways to sign in, the trusted devices and a record of recent sign-ins.
 * Every button starts a journey, and only the ones the place may use are drawn. Fingerprint and face sign-in are not on the web in Release 1.
 */
export function SecurityView() {
  const { app, s, launch, project } = useWs();
  const [q, setQ] = useState<HistoryQuery>(NO_FILTERS);
  const [open, setOpen] = useState<HistoryRow | null>(null);
  const sec = app.securityView(), vm = sec?.data;
  const points = app.launchPoints({ place: "more.security" });
  const lp = (label: string): LaunchPoint | undefined => points.find((p) => p.label === label);
  const button = (label: string, text = label, ghost = true) => { const p = lp(label); return p ? <button type="button" className={`wb-btn wb-btn-sm ${ghost ? "wb-btn-ghost" : "wb-btn-primary"}`} onClick={() => launch(p)}>{text}</button> : null; };

  useEffect(() => { void app.loadSecurityView(); }, [app, s.tick]);
  useEffect(() => { if (vm) void app.loadHistoryView(q, vm.device.id); }, [app, q, vm?.device.id, s.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const hv = app.historyView(q), h = hv?.data;
  const set = (patch: Partial<HistoryQuery>) => setQ((cur) => ({ ...cur, page: 1, ...patch }));

  let top: React.ReactNode;
  if (!sec || (sec.status === "loading" && !vm)) top = <div className="ws-skel" aria-busy="true"><span className="wb-sr">Loading</span><i /><i /><i /></div>;
  else if (sec.status === "error" && !vm) top = <Notice role="alert" icon="warn" title={sec.code === "TIMEOUT" ? "This is taking longer than expected" : unavailable(sec.code) ? "This service is not available right now" : "Could not load"} text={unavailable(sec.code) ? "Nothing was changed. Please try again in a few minutes." : sec.error} action="Try again" onAction={() => void app.loadSecurityView(true)} />;
  else if (vm) top = (
    <>
      <section className="ws-section" aria-labelledby="sec-password">
        <div className="ws-section-head"><h2 id="sec-password">Password</h2>{button("Change password")}</div>
        <ul className="ws-rows"><li className="ws-row"><div className="ws-row-main"><span className="ws-row-text"><b>Password</b><small>{vm.password}</small></span></div></li></ul>
      </section>
      <section className="ws-section" aria-labelledby="sec-signin">
        <div className="ws-section-head"><h2 id="sec-signin">Sign in with</h2></div>
        <ul className="ws-rows">
          <li className="ws-row"><div className="ws-row-main"><span className="ws-row-text"><b>Quick PIN</b><small>{vm.quickPin.label}</small></span>{vm.quickPin.set ? button("Change quick PIN", "Change") : button("Quick sign-in", "Set up")}</div></li>
          <li className="ws-row"><div className="ws-row-main"><span className="ws-row-text"><b>Default sign in</b><small>{vm.defaultSignIn.label}</small></span>{button("Quick sign-in", "Change")}</div></li>
        </ul>
      </section>
      <section className="ws-section" aria-labelledby="sec-devices">
        <div className="ws-section-head"><h2 id="sec-devices">Trusted devices</h2>{button("Trusted devices", "Manage")}</div>
        <ul className="ws-rows"><li className="ws-row"><div className="ws-row-main"><span className="ws-row-text"><b>Trusted devices</b><small>{vm.devices.text}</small></span></div></li></ul>
      </section>
    </>
  );

  const pages = h?.pages ?? 1;
  let history: React.ReactNode;
  if (!hv || (hv.status === "loading" && !h)) history = <div className="ws-skel" aria-busy="true"><span className="wb-sr">Loading</span><i /><i /><i /></div>;
  else if (hv.status === "error" && !h) history = <Notice role="alert" icon="warn" title={hv.code === "TIMEOUT" ? "This is taking longer than expected" : "This service is not available right now"} text="Nothing was changed. Please try again in a few minutes." action="Try again" onAction={() => void app.loadHistoryView(q, vm?.device.id ?? "", true)} />;
  else if (h && h.rows.length === 0) history = (
    <div className="ws-empty"><p>{h.none ? "Your sign-ins will appear here." : "No sign-ins to show for these filters."}</p>{!h.none ? <button type="button" className="wb-btn wb-btn-sm wb-btn-ghost" onClick={() => setQ(NO_FILTERS)}>Clear filters</button> : null}</div>
  );
  else if (h) history = (
    <>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <caption className="wb-sr">Recent sign-ins</caption>
          <thead><tr>
            <th scope="col"><button type="button" className="ws-sort" onClick={() => set({ order: q.order === "newest" ? "oldest" : "newest" })} aria-label={`Date and time, ${q.order === "newest" ? "newest first" : "oldest first"}. Change the order`}>Date and time {q.order === "newest" ? "↓" : "↑"}</button></th>
            <th scope="col">Result</th><th scope="col">Method</th><th scope="col">Device</th><th scope="col">Place</th><th scope="col">Network address</th>
          </tr></thead>
          <tbody>
            {h.rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" data-label="Date and time"><button type="button" className="ws-link-row" onClick={() => setOpen(r)}>{r.when}</button></th>
                <td data-label="Result"><span className={`ws-tag ws-tag-${r.result.tone}`}>{r.result.label}</span></td>
                <td data-label="Method">{r.method}</td>
                <td data-label="Device">{r.device}{r.thisDevice ? <small> · This device</small> : null}</td>
                <td data-label="Place">{r.place}</td>
                <td data-label="Network address">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="ws-pager" aria-label="Pages">
        <button type="button" className="wb-btn wb-btn-sm wb-btn-ghost" disabled={q.page <= 1} onClick={() => setQ({ ...q, page: q.page - 1 })}>Previous</button>
        <span>Page {q.page} of {pages} · {h.total} {h.total === 1 ? "sign-in" : "sign-ins"}</span>
        <button type="button" className="wb-btn wb-btn-sm wb-btn-ghost" disabled={q.page >= pages} onClick={() => setQ({ ...q, page: q.page + 1 })}>Next</button>
      </nav>
    </>
  );

  const devices = vm?.deviceList ?? [];
  const notMe = lp("This wasn't me");
  return (
    <div className="ws-screen">
      <div className="ws-title"><h1>Security</h1><Link className="wb-link" href={`/${project.id}/personal/more`}>Back to More</Link></div>
      {top}
      <section className="ws-section" aria-labelledby="sec-history">
        <div className="ws-section-head"><h2 id="sec-history">Login history</h2>{filtersOn(q) ? <button type="button" className="wb-link" onClick={() => setQ(NO_FILTERS)}>Clear filters</button> : null}</div>
        <div className="ws-filters">
          <label>Result<select value={q.result} onChange={(e) => set({ result: e.target.value as HistoryQuery["result"] })}>{RESULTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <label>Period<select value={q.days} onChange={(e) => set({ days: Number(e.target.value) as HistoryQuery["days"] })}>{PERIODS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <label>Device<select value={q.deviceId} onChange={(e) => set({ deviceId: e.target.value })}><option value="">All</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        </div>
        {history}
      </section>

      <Modal open={!!open} onClose={() => setOpen(null)} title="Sign-in details">
        {open ? (
          <div className="ws-form">
            <dl className="ws-dl">
              <dt>Date and time</dt><dd>{open.when}</dd><dt>Result</dt><dd><span className={`ws-tag ws-tag-${open.result.tone}`}>{open.result.label}</span></dd><dt>Method</dt><dd>{open.method}</dd>
              <dt>Device</dt><dd>{open.device}{open.thisDevice ? " · This device" : ""}</dd><dt>Place</dt><dd>{open.place}</dd><dt>Network address</dt><dd>{open.ip}</dd><dt>How you signed in</dt><dd>{open.how}</dd>
            </dl>
            <p className="wb-muted">We also recommend you change your password if this wasn’t you.</p>
            <div className="ws-actions">
              {notMe ? <button type="button" className="wb-btn wb-btn-ghost" onClick={() => { setOpen(null); launch(notMe); }}>This wasn’t me</button> : <span className="wb-muted">Not you? Call us on +1 800 555 0100 (sandbox number).</span>}
              {lp("Change password") ? <button type="button" className="wb-btn wb-btn-primary" onClick={() => { setOpen(null); launch(lp("Change password")!); }}>Change password</button> : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
