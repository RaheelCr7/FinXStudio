"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Undo2 } from "lucide-react";
import { CURRENCY_LIST, formatMoney, validateCustomCurrency, type CurrencyInfo, type ProjectShape } from "@finx/ui-kit";
import { useProjects } from "./Projects";
import { useWho } from "./Who";

type Draft = { currencies: string[]; baseCurrency: string; customCurrencies: CurrencyInfo[] };
const draftOf = (s: ProjectShape): Draft => ({ currencies: s.currencies, baseCurrency: s.baseCurrency, customCurrencies: s.customCurrencies });
const same = (a: Draft, b: Draft) => JSON.stringify([[...a.currencies].sort(), a.baseCurrency, a.customCurrencies]) === JSON.stringify([[...b.currencies].sort(), b.baseCurrency, b.customCurrencies]);

/** Which currencies a project offers, which one is the base, and the bank's own currencies. Saved to the bank's entry in brands.json. */
export function CurrenciesView() {
  const { current } = useProjects();
  const { can } = useWho();
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previous, setPrevious] = useState<ProjectShape | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [add, setAdd] = useState({ code: "", name: "", symbol: "", decimals: 2 });

  useEffect(() => {
    let live = true;
    setSaved(null); setDraft(null); setPrevious(null); setErr("");
    fetch(`/api/projects/${current.id}/shape`).then((r) => r.json()).then((s: ProjectShape) => { if (live) { setSaved(draftOf(s)); setDraft(draftOf(s)); } }).catch(() => live && setErr("Could not load the currencies"));
    return () => { live = false; };
  }, [current.id]);

  const all: CurrencyInfo[] = useMemo(() => [...(draft?.customCurrencies ?? []).map((c) => ({ ...c, custom: true })), ...CURRENCY_LIST], [draft?.customCurrencies]);
  const shown = all.filter((c) => !q || `${c.code} ${c.name}`.toLowerCase().includes(q.toLowerCase()));
  const problem = add.code || add.name || add.symbol ? validateCustomCurrency({ ...add }, draft?.customCurrencies) : "Fill in the code, name and symbol";
  const dirty = !!draft && !!saved && !same(draft, saved);
  if (!draft || !saved) return <div className="page"><p className="faint" role="status">{err || "Loading…"}</p></div>;

  const offer = (code: string, on: boolean) => setDraft({ ...draft, currencies: on ? [...draft.currencies, code] : draft.currencies.filter((c) => c !== code) });
  const addCustom = () => {
    if (problem) return;
    const code = add.code.toUpperCase();
    setDraft({ ...draft, customCurrencies: [...draft.customCurrencies, { code, name: add.name.trim(), symbol: add.symbol.trim(), decimals: add.decimals, custom: true }], currencies: [...draft.currencies, code] });
    setAdd({ code: "", name: "", symbol: "", decimals: 2 });
  };
  const removeCustom = (code: string) => setDraft({ ...draft, customCurrencies: draft.customCurrencies.filter((c) => c.code !== code), currencies: draft.currencies.filter((c) => c !== code) });

  async function save(body: object, remember = true) {
    setBusy(true); setErr("");
    const res = await fetch(`/api/projects/${current.id}/shape`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not save the currencies"); return; }
    setPrevious(remember ? data.previous : null);
    setSaved(draftOf(data.shape)); setDraft(draftOf(data.shape));
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Currencies</h1>
          <p className="sub">Which currencies <b>{current.name}</b> offers. The base currency is the one amounts are shown in unless a journey or account says otherwise.</p>
        </div>
      </div>
      <div className="design-wrap">
        <div className="stack" style={{ gap: 14 }}>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} aria-hidden />
            <input className="input" style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search currencies" aria-label="Search currencies" />
          </label>
          <div className="card" style={{ padding: 0 }}>
            <table className="table" style={{ width: "100%" }}>
              <thead><tr><th scope="col">Offer</th><th scope="col">Currency</th><th scope="col">Looks like</th><th scope="col">Decimals</th><th scope="col">Base</th></tr></thead>
              <tbody>
                {shown.map((c) => {
                  const on = draft.currencies.includes(c.code), base = draft.baseCurrency === c.code;
                  return (
                    <tr key={c.code}>
                      <td><input type="checkbox" checked={on || base} disabled={base || !can("projects")} aria-label={`Offer ${c.code}`} onChange={(e) => offer(c.code, e.target.checked)} /></td>
                      <td><b className="mono">{c.code}</b> <span className="faint">{c.name}</span>{c.custom ? <> <span className="chip">Added</span> <button className="btn sm" disabled={base || !can("projects")} onClick={() => removeCustom(c.code)} aria-label={`Remove ${c.code}`}>Remove</button></> : null}</td>
                      <td className="mono">{formatMoney(1234.5, c.code, "en-US", draft.customCurrencies)}</td>
                      <td className="mono">{c.decimals}</td>
                      <td><input type="radio" name="base" checked={base} disabled={!(on || base) || !can("projects")} aria-label={`Make ${c.code} the base currency`} onChange={() => setDraft({ ...draft, baseCurrency: c.code, currencies: [...new Set([...draft.currencies, c.code])] })} /></td>
                    </tr>
                  );
                })}
                {shown.length === 0 ? <tr><td colSpan={5} className="faint">No currency matches “{q}”.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="card" style={{ gap: 10 }}>
            <h3>Add your own currency</h3>
            <div className="faint">For a coin, a points scheme or a currency not in the list.</div>
            <label className="row" style={{ justifyContent: "space-between" }}><span>Code</span><input className="input mono" style={{ width: 100 }} maxLength={4} value={add.code} onChange={(e) => setAdd({ ...add, code: e.target.value.toUpperCase() })} aria-label="Currency code" placeholder="GLD" /></label>
            <label className="row" style={{ justifyContent: "space-between" }}><span>Name</span><input className="input" style={{ width: 180 }} value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} aria-label="Currency name" placeholder="Gold coin" /></label>
            <label className="row" style={{ justifyContent: "space-between" }}><span>Symbol</span><input className="input" style={{ width: 100 }} maxLength={5} value={add.symbol} onChange={(e) => setAdd({ ...add, symbol: e.target.value })} aria-label="Currency symbol" placeholder="◎" /></label>
            <label className="row" style={{ justifyContent: "space-between" }}><span>Decimals</span>
              <select className="input" style={{ width: 100 }} value={add.decimals} onChange={(e) => setAdd({ ...add, decimals: Number(e.target.value) })} aria-label="Decimals">{[0, 2, 3].map((d) => <option key={d} value={d}>{d}</option>)}</select>
            </label>
            {add.code || add.name || add.symbol ? <div className="mono">{problem ?? `Looks like ${formatMoney(1234.5, add.code.toUpperCase(), "en-US", [{ code: add.code.toUpperCase(), name: add.name, symbol: add.symbol, decimals: add.decimals }])}`}</div> : null}
            <button className="btn" disabled={!!problem || !can("projects")} onClick={addCustom}><Plus size={13} aria-hidden />Add currency</button>
          </div>

          <div className="card" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={!dirty || busy || !can("projects")} title={can("projects") ? undefined : "Your role cannot change a project"} onClick={() => save({ currencies: draft.currencies, customCurrencies: draft.customCurrencies, baseCurrency: draft.baseCurrency })}>{busy ? "Saving…" : `Save for ${current.name}`}</button>
              {dirty ? <button className="btn" onClick={() => setDraft(saved)}>Discard changes</button> : null}
            </div>
            <div className="faint">{draft.currencies.length} offered · base {draft.baseCurrency}. Journeys keep the currency they were written in until edited. Apps pick the change up the next time they are built.</div>
            {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{err}</div> : null}
            {previous ? <div className="row" role="status" style={{ gap: 8 }}><span className="chip pos dot">Saved</span><button className="btn sm" disabled={busy} onClick={() => save(previous, false)}><Undo2 size={13} aria-hidden />Undo</button></div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
