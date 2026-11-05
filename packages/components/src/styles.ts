import { componentCssVars, defaultComponentTokens } from "@finx/ui-kit";

/**
 * The stylesheet of the shared components. It reads colours from --c-* and radii from --r-* (the bank's theme) and sizes
 * from --fxc-* (the component tokens). Logical properties only, so right-to-left mirrors without extra rules.
 */
const raw = `
.fxc-sr { position: absolute; inline-size: 1px; block-size: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
[dir="rtl"] .fxc-flip { transform: scaleX(-1); }
.fxc-btn:focus-visible, .fxc-bar-btn:focus-visible, .fxc-row:focus-visible, .fxc-key:focus-visible, .fxc-input-action:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }

.fxc-btn { inline-size: 100%; min-block-size: var(--fxc-button-height); padding: 8px 16px; border-radius: var(--fxc-button-radius); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform .08s, opacity .15s; }
.fxc-btn:active { transform: scale(.985); }
.fxc-btn:disabled { opacity: .6; cursor: not-allowed; }
.fxc-btn[aria-busy="true"] { cursor: progress; }
.fxc-btn-primary { border: 0; background: var(--bar-bg, var(--c-accent)); color: var(--c-accent-on); }
.fxc-btn-primary:hover:not(:disabled) { opacity: .92; }
.fxc-btn-secondary { border: var(--fxc-button-border) solid var(--bar-bg, var(--c-border-strong)); background: transparent; color: var(--bar-bg, var(--c-text)); }

.fxc-field { margin: 0; min-inline-size: 0; }
.fxc-label { display: block; margin-block-end: 8px; font-size: 13px; font-weight: 500; color: var(--c-text-muted); }
.fxc-help { margin: 8px 0 0; font-size: 13px; color: var(--c-text-muted); }
.fxc-error { margin: 6px 0 0; font-size: 13px; color: var(--c-negative); }
.fxc-input-wrap { position: relative; }
.fxc-input { inline-size: 100%; block-size: var(--fxc-field-height); box-sizing: border-box; padding-inline: 14px; border-radius: var(--fxc-field-radius); border: var(--fxc-field-border) solid var(--c-border-strong); background: var(--c-surface); color: var(--c-text); font: inherit; font-size: 16px; }
.fxc-date-btn { display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: start; cursor: pointer; }
.fxc-date-empty { color: var(--c-text-muted); }
.fxc-field.is-outlined .fxc-date-btn { font-size: 14px; }
.fxc-cal { margin-block-start: 8px; padding: 12px; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
.fxc-cal-head { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-block-end: 8px; }
.fxc-cal-title { flex: 1; text-align: center; font-weight: 700; font-size: 15px; }
.fxc-cal-nav { min-inline-size: 36px; min-block-size: 36px; border: 0; border-radius: 50%; background: transparent; color: var(--c-text); font: inherit; font-size: 18px; cursor: pointer; }
.fxc-cal-nav:hover { background: var(--c-surface-muted, rgba(128,128,128,.12)); }
.fxc-cal-week, .fxc-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
.fxc-cal-week { font-size: 12px; color: var(--c-text-muted); margin-block-end: 4px; }
.fxc-cal-day { min-block-size: 38px; border: 0; border-radius: 50%; background: transparent; color: var(--c-text); font: inherit; font-size: 14px; cursor: pointer; }
.fxc-cal-day.is-out { color: var(--c-text-muted); opacity: .55; }
.fxc-cal-day.is-today { box-shadow: inset 0 0 0 1px var(--c-accent); }
.fxc-cal-day[aria-pressed=true] { background: var(--c-accent); color: var(--c-accent-on, #fff); opacity: 1; }
.fxc-cal-day:disabled { opacity: .3; cursor: not-allowed; }
.fxc-cal-nav:focus-visible, .fxc-cal-day:focus-visible, .fxc-date-btn:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 1px; }
.fxc-select { appearance: none; padding-inline-end: 40px; cursor: pointer; }
.fxc-input-wrap { position: relative; }
.fxc-select-chevron { position: absolute; inset-block: 0; inset-inline-end: 12px; display: grid; place-items: center; pointer-events: none; color: var(--c-text-muted); }
.fxc-avatar { display: grid; justify-items: center; gap: 4px; text-align: center; }
.fxc-avatar-disc { display: grid; place-items: center; inline-size: 72px; block-size: 72px; border-radius: 50%; background: color-mix(in srgb, var(--c-accent) 14%, transparent); color: var(--c-accent); font-size: 26px; font-weight: 700; }
.fxc-avatar-name { font-size: 16px; font-weight: 700; }
.fxc-avatar-text { font-size: 13px; color: var(--c-text-muted); }
.fxc-textarea { block-size: auto; padding-block: 12px; resize: vertical; line-height: 1.45; }
.fxc-input:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); }
.fxc-input.has-error { border-color: var(--c-negative); box-shadow: 0 0 0 1px var(--c-negative); }
.fxc-input.has-action { padding-inline-end: 72px; }
.fxc-input:disabled { opacity: .6; }
.fxc-input-action { position: absolute; inset-block: 0; inset-inline-end: 8px; padding: 0 8px; border: 0; background: none; color: var(--c-accent); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; border-radius: 6px; display: grid; place-items: center; }
.fxc-field.is-outlined .fxc-input { font-size: 14px; border-color: var(--c-border); }
.fxc-field.is-outlined .fxc-input-action { color: var(--c-text-muted); inset-inline-end: 4px; }

.fxc-bar { display: flex; align-items: center; gap: 8px; min-block-size: var(--fxc-bar-height); padding-inline: 12px; background: var(--c-bg); color: var(--c-text); }
.fxc-bar.is-bar { background: var(--bar-bg, var(--c-accent)); color: #fff; }
.fxc-bar .fxc-bar-title { flex: 1; min-inline-size: 0; margin: 0; font-size: 16px; line-height: 22px; font-weight: 600; letter-spacing: 0; text-align: center; }
.fxc-bar-btn, .fxc-bar-gap { inline-size: 40px; block-size: 40px; flex: none; }
.fxc-bar-btn { border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; display: grid; place-items: center; }
.fxc-bar-title:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 4px; }
.fxc-bar-btn:hover { background: color-mix(in srgb, currentColor 14%, transparent); }

.fxc-row-wrap { list-style: none; }
.fxc-row { inline-size: 100%; display: flex; align-items: center; gap: 12px; padding: 0 14px; min-block-size: var(--fxc-row-height); border: 1px solid var(--c-border); border-radius: var(--fxc-row-radius); background: var(--c-surface); color: var(--c-text); font: inherit; text-align: start; cursor: pointer; }
.fxc-row:hover:not(:disabled) { background: var(--c-surface-muted); }
.fxc-row:disabled { opacity: .6; cursor: not-allowed; }
.fxc-row-icon { color: var(--c-text-muted); }
.fxc-row-title { flex: 1; font-size: 14px; font-weight: 600; }
.fxc-row-help { margin: 6px 4px 0; font-size: 11px; color: var(--c-text-muted); }

.fxc-keypad { display: grid; grid-template-columns: repeat(3, var(--fxc-keypad-key)); gap: var(--fxc-keypad-gap-y) var(--fxc-keypad-gap-x); justify-content: center; }
.fxc-key { block-size: var(--fxc-keypad-key-height); border: 0; border-radius: 999px; background: var(--c-surface-muted); color: var(--c-text); font: inherit; font-size: 18px; font-weight: 600; cursor: pointer; display: grid; place-items: center; }
.fxc-key:hover, .fxc-key:active { background: color-mix(in srgb, var(--c-accent) 18%, var(--c-surface)); }
.fxc-dashes { display: flex; gap: 12px; justify-content: center; }
.fxc-dash { inline-size: 36px; display: flex; flex-direction: column; align-items: center; border-block-end: 2px solid var(--c-border-strong); }
.fxc-dash.is-active { border-block-end-color: var(--c-accent); }
.fxc-dash > span { block-size: 28px; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.fxc-text { flex: 1; display: flex; flex-direction: column; min-inline-size: 0; }
.fxc-title { font-size: 15px; font-weight: 600; color: var(--c-text); }
.fxc-sub { margin-block-start: 2px; font-size: 13px; color: var(--c-text-muted); font-variant-numeric: tabular-nums; }
.fxc-link { border: 0; background: none; padding: 0; color: var(--c-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.fxc-footer { margin: 4px 0 0; color: var(--c-accent); font-weight: 600; }

.fxc-alert { padding: 14px; border-radius: var(--r-md); font-size: 14px; line-height: 1.45; }
.fxc-alert-info { background: var(--c-info-bg); color: var(--c-info); }
.fxc-alert-warning { background: var(--c-warning-bg); color: var(--c-warning); }
.fxc-alert-error { background: var(--c-negative-bg); color: var(--c-negative); }
.fxc-alert-success { background: var(--c-positive-bg); color: var(--c-positive); }

.fxc-result { display: flex; flex-direction: column; align-items: center; padding-block-start: 32px; text-align: center; }
.fxc-result-icon { inline-size: 88px; block-size: 88px; border-radius: 50%; display: grid; place-items: center; font-size: 40px; }
.fxc-result-icon.is-ok { background: var(--c-positive-bg); color: var(--c-positive); }
.fxc-result-icon.is-bad { background: var(--c-negative-bg); color: var(--c-negative); }
.fxc-result-title { margin: 20px 0 0; font-size: 24px; font-weight: 600; }
.fxc-result-text { margin: 8px 0 0; color: var(--c-text-muted); font-size: 15px; line-height: 1.5; }
.fxc-result-meta { margin: 14px 0 0; padding: 5px 12px; border-radius: var(--r-pill); background: var(--c-surface-muted); color: var(--c-text-muted); font-size: 12px; font-family: ui-monospace, Menlo, monospace; }

.fxc-summary { margin: 0; padding: 0 16px; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
.fxc-summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; }
.fxc-summary-row + .fxc-summary-row { border-block-start: 1px solid var(--c-border); }
.fxc-summary dt { color: var(--c-text-muted); font-size: 14px; }
.fxc-summary dd { margin: 0; font-size: 14px; font-weight: 600; text-align: end; font-variant-numeric: tabular-nums; }

.fxc-switch-row { position: relative; display: flex; align-items: center; gap: 14px; cursor: pointer; }
.fxc-switch-input { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; margin: 0; opacity: 0; cursor: pointer; }
.fxc-switch { inline-size: 50px; block-size: 30px; border-radius: 15px; padding: 3px; box-sizing: border-box; background: var(--c-border-strong); display: flex; align-items: center; justify-content: flex-start; flex: none; transition: background .15s; }
.fxc-switch::before { content: ""; inline-size: 24px; block-size: 24px; border-radius: 50%; background: #fff; transition: transform .15s; }
.fxc-switch-input:checked + .fxc-switch { background: var(--c-accent2); }
.fxc-switch-input:checked + .fxc-switch::before { transform: translateX(20px); }
[dir="rtl"] .fxc-switch-input:checked + .fxc-switch::before { transform: translateX(-20px); }
.fxc-switch-row:has(.fxc-switch-input:focus-visible) .fxc-switch { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }
.fxc-switch-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.fxc-check-row { position: relative; display: flex; align-items: flex-start; gap: 12px; font-size: 15px; line-height: 1.5; cursor: pointer; }
.fxc-check-input { position: absolute; inset-block-start: 0; inset-inline-start: 0; inline-size: 24px; block-size: 24px; margin: 0; opacity: 0; cursor: pointer; }
.fxc-check { inline-size: 24px; block-size: 24px; border-radius: 7px; border: 2px solid var(--c-border-strong); display: grid; place-items: center; color: transparent; flex: none; }
.fxc-check-input:checked + .fxc-check { background: var(--c-accent); border-color: var(--c-accent); color: var(--c-accent-on); }
.fxc-check-input:focus-visible + .fxc-check { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }
.fxc-check-input[aria-invalid="true"] + .fxc-check { border-color: var(--c-negative); }

.fxc-choices { border: 0; padding: 0; margin: 0; min-inline-size: 0; }
.fxc-radio-input { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; margin: 0; opacity: 0; cursor: pointer; }
.fxc-chip:has(.fxc-radio-input:focus-visible), .fxc-card:has(.fxc-radio-input:focus-visible), .fxc-tile:has(.fxc-radio-input:focus-visible) { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }
.fxc-choices.is-chips, .fxc-quick { display: flex; flex-wrap: wrap; gap: 8px; }
.fxc-choices.is-chips > legend { inline-size: 100%; }
.fxc-quick { margin-block-start: 14px; }
.fxc-quick .fxc-chip { border-radius: var(--r-md); font-weight: 700; font-size: 15px; }
.fxc-quick .fxc-chip.is-on { background: var(--c-accent2); border-color: var(--c-accent2); color: #fff; }
.fxc-chip { position: relative; display: inline-flex; align-items: center; justify-content: center; min-inline-size: 64px; min-block-size: 40px; padding: 6px 16px; border-radius: var(--r-pill); border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; font-variant-numeric: tabular-nums; }
.fxc-chip.is-on { border-color: var(--c-accent); background: var(--c-accent-soft); color: var(--c-accent); border-width: 2px; padding: 5px 15px; }
.fxc-card { position: relative; display: flex; align-items: center; gap: 12px; padding: 14px; margin-block-end: 10px; border-radius: var(--r-lg); background: var(--c-surface); border: 1px solid var(--c-border); cursor: pointer; }
.fxc-card.is-on { border: 2px solid var(--c-accent); padding: 13px; }
.fxc-avatar { inline-size: 40px; block-size: 40px; border-radius: var(--r-md); background: var(--c-accent-soft); color: var(--c-accent); display: grid; place-items: center; font-size: 13px; font-weight: 600; flex: none; }
.fxc-avatar.is-round { border-radius: 50%; }
.fxc-choices.is-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.fxc-choices.is-tiles > legend, .fxc-choices.is-tiles > .fxc-error { grid-column: 1 / -1; }
.fxc-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 14px; border-radius: var(--r-lg); background: var(--c-surface); border: 2px solid var(--c-border); cursor: pointer; }
.fxc-tile.is-on { border-color: var(--c-accent2); }
.fxc-letter { inline-size: 40px; block-size: 40px; border-radius: 13px; display: grid; place-items: center; background: var(--c-accent); color: #fff; font-weight: 800; font-size: 16px; }
.fxc-icon-tile { inline-size: 40px; block-size: 40px; display: inline-grid; place-items: center; border-radius: 32%; flex: none; background: var(--c-accent-soft); color: var(--c-accent); }
.fxc-icon-tile.is-on { background: var(--c-accent2-soft); color: var(--c-accent2); }
.fxc-tick { position: absolute; inset-block-start: 10px; inset-inline-end: 10px; inline-size: 22px; block-size: 22px; border-radius: 50%; background: var(--c-accent2); color: #fff; display: grid; place-items: center; }
.fxc-choices.is-rows { display: block; }
.fxc-listrow { position: relative; display: flex; align-items: center; gap: 12px; padding: 14px 0; border-block-end: 1px solid var(--c-border); cursor: pointer; }
.fxc-radio-dot { inline-size: 22px; block-size: 22px; border-radius: 50%; border: 2px solid var(--c-border-strong); box-sizing: border-box; display: grid; place-items: center; flex: none; }
.fxc-listrow.is-on .fxc-radio-dot { border-color: var(--c-accent); }
.fxc-listrow.is-on .fxc-radio-dot::after { content: ""; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c-accent); }
.fxc-listrow:has(.fxc-radio-input:focus-visible) .fxc-radio-dot { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }

.fxc-amount { display: flex; align-items: baseline; gap: 8px; padding-block-end: 8px; border-block-end: 2px solid var(--c-border-strong); }
.fxc-amount:focus-within { border-color: var(--c-accent); }
.fxc-amount.has-error { border-color: var(--c-negative); }
.fxc-amount-symbol { font-size: 20px; font-weight: 500; color: var(--c-text-muted); }
.fxc-amount-input { flex: 1; min-inline-size: 0; padding: 0; border: 0; background: transparent; color: var(--c-text); font: inherit; font-size: 40px; font-weight: 600; font-variant-numeric: tabular-nums; outline: none; }
.fxc-amount-input::placeholder { color: var(--c-text-faint); }

.fxc-code { position: relative; }
.fxc-code-cells { display: flex; justify-content: space-between; gap: 6px; }
.fxc-code-cell { inline-size: 46px; block-size: 56px; border-radius: var(--r-md); border: 1px solid var(--c-border-strong); background: var(--c-surface); display: grid; place-items: center; font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.fxc-code-cell.is-active { border: 2px solid var(--c-accent); }
.fxc-code-cell.has-error { border-color: var(--c-negative); }
.fxc-code-input { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; opacity: 0; font-size: 16px; }
.fxc-code:has(.fxc-code-input:focus-visible) .fxc-code-cell.is-active { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }

.fxc-sectionhead { display: flex; align-items: center; justify-content: space-between; }
.fxc-sectionhead h2 { margin: 0; font-size: 16px; font-weight: 700; }
.fxc-sectionhead-link { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--c-text); font: inherit; font-size: 13px; cursor: pointer; }
.fxc-shortcuts { display: flex; justify-content: space-around; padding: 14px 8px 4px; margin-block-start: auto; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 24px 24px 0 0; margin-inline: -20px; margin-block-end: -20px; }
.fxc-shortcut { display: flex; flex-direction: column; align-items: center; gap: 8px; min-inline-size: 88px; border: 0; background: none; color: var(--c-text); font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; padding-block-end: 14px; }
.fxc-shortcut-tile { inline-size: 50px; block-size: 50px; border-radius: 14px; display: grid; place-items: center; background: color-mix(in srgb, var(--c-accent) 65%, #000); color: #fff; }
.fxc-hero { background: var(--bar-bg, var(--c-accent)); block-size: 200px; display: flex; align-items: center; justify-content: center; }
.fxc-hero-logo { inline-size: 230px; block-size: 70px; object-fit: contain; }
.fxc-hero-name { color: var(--c-accent-on); font-size: 26px; font-weight: 700; }
.fxc-switch-row:focus-within, .fxc-shortcut:focus-visible, .fxc-sectionhead-link:focus-visible, .fxc-link:focus-visible { outline-offset: 2px; }
.fxc-shortcut:focus-visible, .fxc-sectionhead-link:focus-visible, .fxc-link:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); }

.fxc-divider { display: flex; align-items: center; gap: 12px; color: var(--c-text-muted); font-size: 13px; font-weight: 500; }
.fxc-divider::before, .fxc-divider::after { content: ""; flex: 1; border-block-start: 1px solid var(--c-border); }
.fxc-dialog-scrim { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,.45); }
.fxc-dialog { inline-size: 100%; max-inline-size: 340px; display: grid; gap: 12px; justify-items: center; text-align: center; padding: 24px 20px 20px; border-radius: var(--r-xl); background: var(--c-surface); color: var(--c-text); box-shadow: 0 12px 40px rgba(0,0,0,.3); outline: none; }
.fxc-dialog-icon { display: grid; place-items: center; inline-size: 52px; block-size: 52px; border-radius: 50%; background: color-mix(in srgb, var(--c-accent) 14%, transparent); color: var(--c-accent); }
.fxc-dialog-title { margin: 0; font-size: 18px; font-weight: 700; }
.fxc-dialog-text { margin: 0; font-size: 14px; line-height: 20px; color: var(--c-text-muted); }
.fxc-dialog-actions { inline-size: 100%; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 10px; margin-block-start: 4px; }
.fxc-map { position: relative; inline-size: 100%; border-radius: var(--r-lg); border: 1px solid var(--c-border); overflow: hidden; background-color: color-mix(in srgb, var(--c-accent) 5%, var(--c-surface)); background-image: linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px); background-size: 44px 44px; }
.fxc-pin { position: absolute; transform: translate(-50%, -100%); padding: 0; border: 0; background: transparent; color: var(--c-negative); cursor: pointer; line-height: 0; }
.fxc-pin.is-selected { color: var(--c-accent); }
.fxc-pin:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; border-radius: 6px; }
.fxc-divider-line { margin: 0; border: 0; border-block-start: 1px solid var(--c-border); }
.fxc-accordion { border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); overflow: hidden; }
.fxc-acc-item + .fxc-acc-item { border-block-start: 1px solid var(--c-border); }
.fxc-acc-head { margin: 0; font: inherit; }
.fxc-acc-btn { inline-size: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-block-size: 52px; padding: 12px 16px; border: 0; background: transparent; color: var(--c-text); font: inherit; font-size: 15px; font-weight: 600; text-align: start; cursor: pointer; }
.fxc-acc-btn:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: -3px; }
.fxc-acc-item.is-open .fxc-acc-btn { color: var(--c-accent); }
.fxc-acc-body { padding: 0 16px 16px; color: var(--c-text-muted); font-size: 14px; line-height: 1.5; }

.fxc-sectionhead-text { min-inline-size: 0; }
.fxc-sectionhead-sub { margin: 2px 0 0; font-size: 12px; color: var(--c-text-muted); }
.fxc-balances { list-style: none; margin: 0; padding: 0; }
.fxc-balance { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 14px 0; border-block-end: 1px solid var(--c-border); }
.fxc-balance-main { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-inline-size: 0; }
.fxc-balance-title { font-size: 14px; font-weight: 600; color: var(--c-text); }
.fxc-balance-tag { padding: 1px 10px; border: 1px solid var(--c-border-strong); border-radius: var(--r-pill); font-size: 11px; color: var(--c-text-muted); }
.fxc-balance-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
.fxc-balance-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--c-text); }
.fxc-balance-caption { font-size: 11px; color: var(--c-text-muted); }

.fxc-status { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px 2px 7px; border-radius: var(--r-pill); font-size: 12px; font-weight: 600; line-height: 1.5; white-space: nowrap; }
.fxc-status.is-positive { background: var(--c-positive-bg); color: var(--c-positive); }
.fxc-status.is-warning { background: var(--c-warning-bg); color: var(--c-warning); }
.fxc-status.is-negative { background: var(--c-negative-bg); color: var(--c-negative); }
.fxc-status.is-info { background: var(--c-info-bg); color: var(--c-info); }
.fxc-status.is-neutral { background: var(--c-surface-muted); color: var(--c-text-muted); }

.fxc-timeline { list-style: none; margin: 0; padding: 0; }
.fxc-tl-item { position: relative; display: flex; gap: 12px; padding-block-end: 18px; }
.fxc-tl-item:last-child { padding-block-end: 0; }
.fxc-tl-item:not(:last-child)::before { content: ""; position: absolute; inset-block: 24px 0; inset-inline-start: 11px; inline-size: 2px; background: var(--c-border-strong); }
.fxc-tl-item.is-done:not(:last-child)::before { background: var(--c-positive); }
.fxc-tl-item.is-upcoming:not(:last-child)::before { background: none; border-inline-start: 2px dashed var(--c-border-strong); }
.fxc-tl-dot { flex: none; inline-size: 24px; block-size: 24px; border-radius: 50%; display: grid; place-items: center; box-sizing: border-box; border: 2px solid var(--c-border-strong); background: var(--c-surface); color: var(--c-text-muted); }
.fxc-tl-item.is-done .fxc-tl-dot { background: var(--c-positive); border-color: var(--c-positive); color: var(--c-surface); }
.fxc-tl-item.is-current .fxc-tl-dot { border-color: var(--c-accent); color: var(--c-accent); }
.fxc-tl-item.is-failed .fxc-tl-dot { background: var(--c-negative); border-color: var(--c-negative); color: var(--c-surface); }
.fxc-tl-item.is-upcoming .fxc-tl-dot { border-style: dashed; }
.fxc-tl-body { min-inline-size: 0; padding-block-start: 2px; }
.fxc-tl-title { font-size: 14px; font-weight: 600; color: var(--c-text); }
.fxc-tl-item.is-upcoming .fxc-tl-title { color: var(--c-text-muted); font-weight: 500; }
.fxc-tl-item.is-failed .fxc-tl-title { color: var(--c-negative); }
.fxc-tl-text { margin-block-start: 2px; font-size: 13px; color: var(--c-text-muted); }
.fxc-tl-time { margin-block-start: 2px; font-size: 12px; color: var(--c-text-muted); font-variant-numeric: tabular-nums; }

.fxc-table { display: flex; flex-direction: column; gap: 12px; min-inline-size: 0; }
.fxc-tbl-search { display: flex; align-items: center; gap: 8px; padding-inline: 12px; border: var(--fxc-field-border) solid var(--c-border-strong); border-radius: var(--fxc-field-radius); background: var(--c-surface); color: var(--c-text-muted); }
.fxc-tbl-input { flex: 1; min-inline-size: 0; block-size: calc(var(--fxc-field-height) - 4px); border: 0; background: transparent; color: var(--c-text); font: inherit; font-size: 15px; }
.fxc-tbl-input:focus { outline: none; }
.fxc-tbl-search:focus-within { border-color: var(--c-accent); }
.fxc-tbl-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.fxc-tbl-filter-label { font-size: 13px; font-weight: 500; color: var(--c-text-muted); margin-inline-end: 4px; }
.fxc-tbl-chip { min-block-size: 32px; padding: 4px 12px; border: 1px solid var(--c-border-strong); border-radius: var(--r-pill); background: var(--c-surface); color: var(--c-text); font: inherit; font-size: 13px; cursor: pointer; }
.fxc-tbl-chip.is-on { background: var(--c-accent); border-color: var(--c-accent); color: var(--c-accent-on); }
.fxc-tbl-sortby { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--c-text-muted); }
.fxc-tbl-select { flex: 1; min-block-size: 36px; padding-inline: 8px; border: 1px solid var(--c-border-strong); border-radius: var(--r-md); background: var(--c-surface); color: var(--c-text); font: inherit; font-size: 14px; }
.fxc-tbl-selection { margin: 0; padding: 8px 12px; border-radius: var(--r-md); background: var(--c-accent-soft); color: var(--c-text); font-size: 13px; font-weight: 600; }
.fxc-tbl-scroll { overflow-x: auto; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
.fxc-tbl { inline-size: 100%; border-collapse: collapse; font-size: 14px; color: var(--c-text); }
.fxc-tbl th, .fxc-tbl td { padding: 10px 14px; text-align: start; border-block-end: 1px solid var(--c-border); vertical-align: middle; }
.fxc-tbl tbody tr:last-child td { border-block-end: 0; }
.fxc-tbl th { font-size: 12px; font-weight: 600; color: var(--c-text-muted); white-space: nowrap; background: var(--c-surface-muted); }
.fxc-tbl .is-end { text-align: end; font-variant-numeric: tabular-nums; }
.fxc-tbl tr.is-selected td { background: var(--c-accent-soft); }
.fxc-tbl-selectcol { inline-size: 40px; }
.fxc-tbl-sort { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
.fxc-tbl-sort:focus-visible, .fxc-tbl-open:focus-visible, .fxc-tbl-chip:focus-visible, .fxc-tbl-pagebtn:focus-visible, .fxc-tbl-link:focus-visible, .fxc-tbl-check:focus-visible, .fxc-tbl-select:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }
.fxc-tbl-open { padding: 0; border: 0; background: transparent; color: var(--c-accent); font: inherit; font-weight: 600; text-align: start; cursor: pointer; }
.fxc-tbl-check { inline-size: 18px; block-size: 18px; accent-color: var(--c-accent); cursor: pointer; }
.fxc-tbl-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.fxc-tbl-card { padding: 12px 14px; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
.fxc-tbl-card.is-selected { border-color: var(--c-accent); background: var(--c-accent-soft); }
.fxc-tbl-card-head { display: flex; align-items: center; gap: 10px; font-size: 15px; color: var(--c-text); }
.fxc-tbl-fields { display: grid; gap: 6px; margin: 10px 0 0; }
.fxc-tbl-fields > div { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.fxc-tbl-fields dt { font-size: 12px; color: var(--c-text-muted); }
.fxc-tbl-fields dd { margin: 0; font-size: 14px; color: var(--c-text); text-align: end; font-variant-numeric: tabular-nums; }
.fxc-tbl-empty { padding: 24px 12px; text-align: center; color: var(--c-text-muted); font-size: 14px; border: 1px dashed var(--c-border-strong); border-radius: var(--r-lg); }
.fxc-tbl-empty p { margin: 0 0 8px; }
.fxc-tbl-link { padding: 4px 8px; border: 0; background: transparent; color: var(--c-accent); font: inherit; font-weight: 600; cursor: pointer; }
.fxc-tbl-pages { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 13px; color: var(--c-text-muted); font-variant-numeric: tabular-nums; }
.fxc-tbl-summary { margin: 0; text-align: center; font-size: 13px; color: var(--c-text-muted); }
.fxc-tbl-pagebtn { inline-size: 36px; block-size: 36px; display: grid; place-items: center; border: 1px solid var(--c-border-strong); border-radius: var(--r-md); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
.fxc-tbl-pagebtn:disabled { opacity: .45; cursor: not-allowed; }

.fxc-file-zone { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; padding: 14px; border: 1.5px dashed var(--c-border-strong); border-radius: var(--r-lg); background: var(--c-surface); }
.fxc-file-zone.is-over { border-color: var(--c-accent); background: var(--c-accent-soft); }
.fxc-file-zone.has-error { border-color: var(--c-negative); }
.fxc-file-drop { font-size: 13px; color: var(--c-text-muted); }
.fxc-file-chosen { display: flex; align-items: center; gap: 10px; inline-size: 100%; color: var(--c-positive); }
.fxc-file-name { display: flex; flex-direction: column; min-inline-size: 0; flex: 1; color: var(--c-text); font-size: 14px; overflow-wrap: anywhere; }
.fxc-file-name small { color: var(--c-text-muted); font-size: 12px; }
.fxc-file-remove { padding: 4px 8px; border: 0; background: transparent; color: var(--c-negative); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.fxc-file-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; min-block-size: 40px; padding: 8px 16px; border: var(--fxc-button-border) solid var(--c-border-strong); border-radius: var(--fxc-button-radius); background: var(--c-surface); color: var(--c-text); font-size: 15px; font-weight: 600; cursor: pointer; }
.fxc-file-btn:focus-within { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }
.fxc-file-btn.is-busy { opacity: .6; cursor: progress; }
.fxc-file-remove:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }

.fxc-doc-title { margin: 0 0 8px; font-size: 15px; font-weight: 600; color: var(--c-text); }
.fxc-doc-body { overflow-y: auto; padding: 14px 16px; border: 1px solid var(--c-border-strong); border-radius: var(--r-lg); background: var(--c-surface); color: var(--c-text); font-size: 14px; line-height: 1.55; }
.fxc-doc-body.has-error { border-color: var(--c-negative); }
.fxc-doc-body:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 2px; }
.fxc-doc-para h4 { margin: 12px 0 4px; font-size: 14px; font-weight: 700; }
.fxc-doc-para:first-child h4 { margin-block-start: 0; }
.fxc-doc-para p { margin: 0 0 10px; }
.fxc-doc-state { display: flex; align-items: center; gap: 4px; margin: 8px 0 0; font-size: 13px; color: var(--c-text-muted); }
.fxc-doc-state.is-read { color: var(--c-positive); font-weight: 600; }

.fxc-sig { border: 0; padding: 0; margin: 0; min-inline-size: 0; }
.fxc-sig-modes { display: inline-flex; padding: 3px; margin-block-end: 10px; border-radius: var(--r-pill); background: var(--c-surface-muted); }
.fxc-sig-mode { position: relative; padding: 6px 16px; border-radius: var(--r-pill); font-size: 13px; font-weight: 600; color: var(--c-text-muted); cursor: pointer; }
.fxc-sig-mode.is-on { background: var(--c-surface); color: var(--c-accent); box-shadow: 0 1px 2px rgb(0 0 0 / .12); }
.fxc-sig-mode:focus-within { outline: 3px solid color-mix(in srgb, var(--c-accent) 55%, transparent); outline-offset: 1px; }
.fxc-sig-preview { margin-block-start: 8px; padding: 10px 14px; border-block-end: 1px solid var(--c-border-strong); font: italic 28px/1.3 "Snell Roundhand", "Segoe Script", "Brush Script MT", cursive; color: var(--c-text); overflow-wrap: anywhere; }
.fxc-sig-pad { display: block; inline-size: 100%; aspect-ratio: 300 / 120; touch-action: none; border: 1px solid var(--c-border-strong); border-radius: var(--r-lg); background: var(--c-surface); cursor: crosshair; }
.fxc-sig-pad.has-error { border-color: var(--c-negative); }
.fxc-sig-line { stroke: var(--c-border-strong); stroke-width: 1; stroke-dasharray: 4 4; }
.fxc-sig-ink { stroke: var(--c-text); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }

.fxc-idcap { border: 0; padding: 0; margin: 0; min-inline-size: 0; }
.fxc-idcap-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.fxc-idcap-step { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
.fxc-idcap-step.is-done { border-color: var(--c-positive); }
.fxc-idcap-frame { flex: none; inline-size: 64px; block-size: 44px; display: grid; place-items: center; border: 1.5px dashed var(--c-border-strong); border-radius: var(--r-md); color: var(--c-text-muted); }
.fxc-idcap-frame.is-selfie { inline-size: 44px; border-radius: 50%; }
.fxc-idcap-step.is-done .fxc-idcap-frame { border-style: solid; border-color: var(--c-positive); color: var(--c-positive); }
.fxc-idcap-text { flex: 1; min-inline-size: 0; display: flex; flex-direction: column; font-size: 14px; color: var(--c-text); }
.fxc-idcap-text small { color: var(--c-text-muted); font-size: 12px; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .fxc-btn, .fxc-switch, .fxc-switch::before { transition: none; } }
`;

const defaults = componentCssVars(defaultComponentTokens);
/** Every size variable falls back to its default, so the components still look right on a page that has not set the tokens. */
export const componentsCss = raw.replace(/var\((--fxc-[a-z-]+)\)/g, (_, name: string) => `var(${name}, ${defaults[name]})`);
