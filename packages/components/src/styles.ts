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
@media (prefers-reduced-motion: reduce) { .fxc-btn, .fxc-switch, .fxc-switch::before { transition: none; } }
`;

const defaults = componentCssVars(defaultComponentTokens);
/** Every size variable falls back to its default, so the components still look right on a page that has not set the tokens. */
export const componentsCss = raw.replace(/var\((--fxc-[a-z-]+)\)/g, (_, name: string) => `var(${name}, ${defaults[name]})`);
