"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon, IconTile } from "@finx/renderer-web";
import { dayLabel, signedMoney } from "@finx/bank-client";
import type { Txn } from "@finx/mock-bank-api";

/** A dialog on the page. Uses the browser's own <dialog>, which traps focus, closes on Escape and returns focus when it closes. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="wb-dialog" aria-labelledby="wb-dialog-title" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open ? (
        <div className="wb-dialog-body">
          <div className="wb-dialog-head"><h2 id="wb-dialog-title">{title}</h2><button type="button" className="wb-icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" size={20} /></button></div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export const SectionTitle = ({ title, action, onAction, href }: { title: string; action?: string; onAction?: () => void; href?: string }) => (
  <div className="wb-section-title"><h2>{title}</h2>{action ? (href ? <a href={href}>{action}</a> : <button type="button" onClick={onAction}>{action}</button>) : null}</div>
);

/** Icon and colour of a spending category, as a tile in that colour. */
export function categoryTile(cat: string): { icon: string; color: string } {
  switch (cat) {
    case "income": return { icon: "briefcase", color: "var(--c-accent)" };
    case "shopping": return { icon: "bag", color: "#E8872B" };
    case "food": case "coffee": return { icon: "food", color: "var(--c-chart5)" };
    case "rent": return { icon: "home", color: "var(--c-chart2)" };
    case "groceries": return { icon: "bag", color: "var(--c-chart3)" };
    case "health": return { icon: "shield", color: "var(--c-chart6)" };
    case "vehicle": case "transport": return { icon: "trend", color: "var(--c-chart1)" };
    case "entertainment": return { icon: "repeat", color: "var(--c-chart6)" };
    case "investing": return { icon: "trend", color: "var(--c-chart2)" };
    default: return { icon: "bag", color: "var(--c-accent)" };
  }
}

export function TxnRow({ t, money, open, onToggle }: { t: Txn; money: (n: number) => string; open?: boolean; onToggle?: () => void }) {
  const cat = categoryTile(t.category);
  const out = t.amount < 0;
  return (
    <li className="wb-txn">
      <button type="button" className="wb-txn-main" aria-expanded={open} onClick={onToggle}>
        <span className="wb-cat" style={{ ["--tone" as string]: cat.color }} aria-hidden><Icon name={cat.icon} size={20} /></span>
        <span className="wb-txn-text"><b>{t.title}</b><small>{dayLabel(t.daysAgo)}{t.time ? ` · ${t.time}` : ""}</small></span>
        <span className={`wb-txn-amount ${out ? "is-out" : "is-in"}`}>{signedMoney(t.amount, money)}<Icon name={out ? "down" : "up"} size={14} /></span>
      </button>
      {open ? <div className="wb-txn-more"><p>Category: <b>{t.category}</b></p><p>Reference: <b>{t.id.toUpperCase()}</b></p></div> : null}
    </li>
  );
}

export { IconTile };
