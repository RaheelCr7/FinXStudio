import type { Journey, Screen, Block } from "@finx/journey-schema";
import { evaluate, getPath, setPath } from "./expr";
import { currencyInfo } from "@finx/ui-kit";
import { interpolate, localize } from "./template";
import { ui } from "./strings";
import { cardExpiryValid, luhnValid } from "./card";

export type Adapter = (adapterId: string, input: Record<string, any>) => Promise<any>;
export type RunnerOptions = { adapter: Adapter; lang?: string };
export type ViewBlock = Block & { _error?: string };
export type View = {
  screenId: string;
  title: string;
  kind: "screen" | "branch" | "terminal";
  blocks: Array<Record<string, any>>;
  toast?: string;
  busy: boolean;
  exited: boolean;
  stepIndex: number;
  stepCount: number;
  stepLabel: string;
  strings: Record<string, string>;
};

export class JourneyRunner {
  state: Record<string, any> = { ctx: {}, transfer: {}, otp: {}, result: {} };
  current: string;
  history: string[] = [];
  errors: Record<string, string> = {};
  toast?: string;
  busy = false;
  exited = false;
  private otpFailures = 0;
  private listeners = new Set<() => void>();
  lang: string;

  constructor(public journey: Journey, private opts: RunnerOptions) {
    this.lang = opts.lang ?? journey.locale.default;
    this.current = journey.entryScreen;
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((l) => l()); }

  get screen(): Screen { return this.journey.screens.find((s) => s.id === this.current)!; }
  get isRtl() { return (this.journey.locale.rtl ?? []).includes(this.lang); }
  setLang(l: string) { this.lang = l; this.emit(); }

  get(path: string) { return getPath(this.state, path); }
  set(path: string, value: any) { setPath(this.state, path, value); delete this.errors[path]; this.emit(); }

  private scope() { return this.state; }
  private tx(t: any) { return interpolate(localize(t, this.lang, this.journey.locale.default), this.scope()); }

  async start() { await this.enter(this.journey.entryScreen); }

  private async enter(id: string) {
    this.current = id;
    this.toast = undefined;
    this.emit();
    const s = this.screen;
    if (s.onEnter?.length) await this.runActions(s.onEnter, s);
    this.emit();
  }

  /** Validation: returns true when all bound blocks on the current screen are valid. */
  validate(): boolean {
    this.errors = {};
    for (const b of this.screen.blocks as any[]) {
      if (b.visibleWhen && !this.safeEval(b.visibleWhen)) continue;
      if (!b.bind) continue;
      if (b.type === "cardForm") { this.validateCard(b.bind); continue; }
      const v = this.get(b.bind);
      const def = this.journey.dataModel?.[b.bind];
      const empty = v == null || v === "" || v === false && b.type !== "consent";
      if (b.type === "consent") {
        if (b.validation?.mustBeTrue && v !== true) this.errors[b.bind] = this.tx(b.validation.messages?.mustBeTrue ?? ui(this.lang, "required"));
        continue;
      }
      if (def?.required && empty) { this.errors[b.bind] = ui(this.lang, "required"); continue; }
      if (b.type === "amountInput" && v != null) {
        const n = Number(v);
        const min = b.validation?.min != null ? this.num(b.validation.min) : undefined;
        const max = b.validation?.max != null ? this.num(b.validation.max) : undefined;
        const digits = currencyInfo(this.currencyOf(b)).decimals;
        if (!(n > 0)) this.errors[b.bind] = ui(this.lang, "enterAmount");
        else if (Math.abs(n * 10 ** digits - Math.round(n * 10 ** digits)) > 1e-6) this.errors[b.bind] = digits === 0 ? ui(this.lang, "amountWhole") : ui(this.lang, "amountDecimals", { n: digits });
        else if (min != null && n < min) this.errors[b.bind] = b.validation?.messages?.min ? this.tx(b.validation.messages.min) : ui(this.lang, "minimum", { n: min });
        else if (max != null && n > max) this.errors[b.bind] = this.tx(b.validation.messages?.max ?? ui(this.lang, "maximum", { n: max }));
      }
      if (b.type === "textInput" && v != null && v !== "" && b.pattern && !new RegExp(b.pattern).test(String(v))) this.errors[b.bind] = b.patternMessage ? this.tx(b.patternMessage) : ui(this.lang, "invalid");
      if (b.type === "otp" && v != null && String(v).length !== b.length) this.errors[b.bind] = ui(this.lang, "allDigits", { n: b.length });
      if (def?.pattern && v != null && !new RegExp(def.pattern).test(String(v))) this.errors[b.bind] ??= ui(this.lang, "invalid");
    }
    this.emit();
    return Object.keys(this.errors).length === 0;
  }

  /** Checks the four card fields and records one error per field. */
  private validateCard(bind: string) {
    const c = (this.get(bind) ?? {}) as Record<string, string>;
    if (!luhnValid(String(c.number ?? ""))) this.errors[`${bind}.number`] = ui(this.lang, "cardNumber");
    if (String(c.holder ?? "").trim().length < 2) this.errors[`${bind}.holder`] = ui(this.lang, "cardHolder");
    if (!cardExpiryValid(String(c.expiry ?? ""))) this.errors[`${bind}.expiry`] = ui(this.lang, "cardExpiry");
    if (!/^[0-9]{3,4}$/.test(String(c.cvv ?? ""))) this.errors[`${bind}.cvv`] = ui(this.lang, "cardCvv");
  }

  private num(x: number | string): number { return typeof x === "number" ? x : Number(this.safeEval(x)); }
  private safeEval(expr: string): any { try { return evaluate(expr, this.scope()); } catch { return undefined; } }

  private nextAfterNav(defaultTo?: string): string | undefined {
    for (const r of this.screen.navigation?.rules ?? []) if (this.safeEval(r.when)) return r.to;
    return defaultTo;
  }

  async press(actions: any[]) {
    if (this.busy) return;
    this.busy = true; this.emit();
    try { await this.runActions(actions, this.screen); }
    finally { this.busy = false; this.emit(); }
  }

  private async runActions(actions: any[], screen: Screen): Promise<void> {
    for (const a of actions) {
      switch (a.type) {
        case "validate":
          if (!this.validate()) return;
          break;
        case "navigate": {
          const rule = this.screen.navigation?.rules ? this.nextAfterNav(undefined) : undefined;
          const target = rule ?? a.to;
          if (!target) return;
          this.history.push(this.current);
          await this.enter(target);
          return;
        }
        case "setData": setPath(this.state, a.path, a.value); break;
        case "showToast": this.toast = this.tx(a.text); this.emit(); break;
        case "exit": this.exited = true; this.emit(); return;
        case "share": break;
        case "callApi": {
          const integ = this.journey.integrations.find((i) => i.id === a.integration);
          if (!integ) throw new Error(`Unknown integration ${a.integration}`);
          const input = this.resolveInput(a.input ?? {});
          try {
            const res = await this.opts.adapter(integ.adapter, input);
            if (a.saveAs) setPath(this.state, a.saveAs, res);
            if (a.integration === "otpVerify") this.otpFailures = 0;
          } catch (err: any) {
            const oe = a.onError;
            if (!oe) throw err;
            if (a.integration === "otpVerify") this.otpFailures += 1;
            if (oe.showToast) this.toast = this.tx(oe.showToast);
            if (oe.lockAfter && this.otpFailures >= oe.lockAfter && oe.lockTo) { this.history.push(this.current); await this.enter(oe.lockTo); return; }
            if (oe.navigate) { this.history.push(this.current); await this.enter(oe.navigate); return; }
            this.emit();
            return; // stay on screen, stop the action chain
          }
          break;
        }
      }
    }
  }

  private resolveInput(input: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      if (typeof v === "string" && /^\{\{\s*[^}]+\s*\}\}$/.test(v)) {
        const expr = v.replace(/^\{\{\s*|\s*\}\}$/g, "");
        out[k] = this.safeEval(expr);
      } else out[k] = v;
    }
    return out;
  }

  back() {
    const prev = this.history.pop();
    if (prev) { this.current = prev; this.toast = undefined; this.emit(); }
  }

  /** A render-ready view model, with all text localized and interpolated and invisible blocks removed. */
  view(): View {
    const s = this.screen;
    // the stepper is journey-level: declared once on any screen, shown on every step screen
    const stepper = this.journey.screens.flatMap((x) => x.blocks).find((b) => b.type === "stepper") as any;
    const steps: string[] = stepper?.steps ?? [];
    const idx = steps.indexOf(s.id);
    const blocks = (s.blocks as any[])
      .filter((b) => !b.visibleWhen || this.safeEval(b.visibleWhen))
      .map((b) => this.viewBlock(b));
    return {
      screenId: s.id, title: this.tx(s.title), kind: s.kind ?? "screen", blocks, toast: this.toast,
      busy: this.busy, exited: this.exited, stepIndex: idx, stepCount: steps.length,
      stepLabel: idx >= 0 ? ui(this.lang, "step", { n: idx + 1, total: steps.length }) : "",
      strings: Object.fromEntries(["account", "payTo", "addBeneficiary", "wait", "back", "close"].map((k) => [k, ui(this.lang, k)])),
    };
  }

  /** The currency of an amount block: a code (JOD), or a path to one ({{account.currency}}) read from the journey's data. */
  private currencyOf(b: any): string { return /\{\{/.test(String(b.currency ?? "")) ? this.tx(b.currency) : String(b.currency ?? ""); }

  private viewBlock(b: any): Record<string, any> {
    const out: Record<string, any> = { ...b };
    if (b.type === "amountInput") { out.currency = this.currencyOf(b); out.decimals = currencyInfo(out.currency).decimals; }
    for (const k of ["label", "text", "title", "hint", "helper", "meta", "placeholder"]) if (k in b) out[k] = this.tx(b[k]);
    if (b.bind) { out.value = this.get(b.bind); out.error = this.errors[b.bind]; }
    if (b.type === "reviewSummary") out.rows = b.rows.map((r: any) => ({ label: this.tx(r.label), value: this.tx(r.value) }));
    if (b.type === "accountPicker") out.items = Object.values(this.get(b.source) ?? {}).filter((a: any) => !b.filter || evaluate(b.filter, { account: a }));
    if (b.type === "select") {
      out.items = b.choices
        ? b.choices.map((o: any) => ({ id: o.id, name: this.tx(o.label), icon: o.icon, sub: o.text ? this.tx(o.text) : undefined }))
        : b.source ? Object.values(this.get(b.source) ?? {}).map((x: any) => ({ id: x.id, name: x.name, color: x.color, sub: x.sub })) : (b.options ?? []).map((o: string) => ({ id: o, name: o }));
    }
    if (b.type === "cardForm") out.errors = Object.fromEntries(["number", "holder", "expiry", "cvv"].map((k) => [k, this.errors[`${b.bind}.${k}`]]));
    if (b.type === "beneficiaryPicker") out.items = Object.values(this.get(b.source) ?? {});
    if (b.type === "button") out.label = this.tx(b.label);
    if (b.type === "menu" || b.type === "shortcuts") out.items = b.items.map((i: any) => ({ ...i, label: this.tx(i.label), ...(i.text ? { text: this.tx(i.text) } : {}) }));
    if (b.type === "toggle" && b.link) out.link = { ...b.link, label: this.tx(b.link.label) };
    if (b.type === "accordion") out.items = b.items.map((i: any) => ({ id: i.id, title: this.tx(i.title), text: this.tx(i.text) }));
    if (b.type === "sectionHeader" && b.action) out.action = { ...b.action, label: this.tx(b.action.label) };
    return out;
  }
}
