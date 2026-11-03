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
.fxc-btn-secondary { border: 1px solid var(--bar-bg, var(--c-border-strong)); background: transparent; color: var(--bar-bg, var(--c-text)); }

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
@media (prefers-reduced-motion: reduce) { .fxc-btn { transition: none; } }
`;

const defaults = componentCssVars(defaultComponentTokens);
/** Every size variable falls back to its default, so the components still look right on a page that has not set the tokens. */
export const componentsCss = raw.replace(/var\((--fxc-[a-z-]+)\)/g, (_, name: string) => `var(${name}, ${defaults[name]})`);
