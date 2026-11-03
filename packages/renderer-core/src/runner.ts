import type { Journey, Screen, Block } from "@finx/journey-schema";
import { evaluate, getPath, setPath } from "./expr";
import { currencyInfo } from "@finx/ui-kit";
import { interpolate, localize } from "./template";
import { ui } from "./strings";
import { cardExpiryValid, luhnValid } from "./card";
import { balanceRows } from "./blocks/pickers";

/** The actions of a list row with every {{item.…}} filled in from that row, so pressing it acts on the right entry. */
function bindItem(node: any, scope: any): any {
  if (typeof node === "string") return node.includes("{{item.") ? interpolate(node, scope) : node;
  if (Array.isArray(node)) return node.map((v) => bindItem(v, scope));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, bindItem(v, scope)]));
  return node;
}

export type Adapter = (adapterId: string, input: Record<string, any>) => Promise<any>;
/** What happened during a run, for analytics. No answers or personal data: only where the person was and what stopped them. */
export type RunEvent =
  | { type: "screen"; screen: string; kind: "screen" | "branch" | "terminal" }
  | { type: "invalid"; screen: string; fields: string[] }
  | { type: "apiError"; screen: string; integration: string; code: string }
  | { type: "back"; screen: string }
  | { type: "exit"; screen: string };
export type RunnerOptions = { adapter: Adapter; lang?: string; onEvent?: (e: RunEvent) => void };
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
  private note(e: RunEvent) { try { this.opts.onEvent?.(e); } catch { /* analytics must never break a journey */ } }

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
    this.note({ type: "screen", screen: id, kind: s.kind ?? "screen" });
    if (s.onEnter?.length) await this.runActions(s.onEnter, s);
    // a journey for one role: once the person's roles are known, anyone without the role is sent to the denied screen
    const au = this.journey.authorisation;
    if (au && id !== au.deniedScreen && this.current === id) {
      const roles = this.get(au.rolesFrom);
      if (Array.isArray(roles) && !roles.includes(au.role)) { this.history.push(id); await this.enter(au.deniedScreen); return; }
    }
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
      if ((b.type === "otp" || b.type === "dialog") && v != null && String(v).length !== b.length) this.errors[b.bind] = ui(this.lang, "allDigits", { n: b.length });
      if (def?.pattern && v != null && !new RegExp(def.pattern).test(String(v))) this.errors[b.bind] ??= ui(this.lang, "invalid");
    }
    this.emit();
    const bad = Object.keys(this.errors);
    if (bad.length) this.note({ type: "invalid", screen: this.current, fields: bad });
    return bad.length === 0;
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
        case "exit": this.exited = true; this.note({ type: "exit", screen: this.current }); this.emit(); return;
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
            // what went wrong, for the screen that follows: {{ctx.error.message}} and routes on {{ctx.error.code}}
            this.note({ type: "apiError", screen: this.current, integration: a.integration, code: String(err?.code ?? "ERROR") });
            setPath(this.state, "ctx.error", { code: err?.code ?? "ERROR", message: err?.message ?? "Something went wrong", integration: a.integration });
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
    if (prev) { const from = this.current; this.current = prev; this.toast = undefined; this.note({ type: "back", screen: from }); this.emit(); }
  }

  /** A render-ready view model, with all text localized and interpolated and invisible blocks removed. */
  view(): View {
    const s = this.screen;
    // the stepper is journey-level: declared once on any screen, shown on every step screen
    const stepper = this.journey.screens.flatMap((x) => x.blocks).find((b) => b.type === "stepper") as any;
    const steps: string[] = stepper?.steps ?? [];
    const idx = steps.indexOf(s.id);
    const blocks = (s.blocks as any[])
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => !b.visibleWhen || this.safeEval(b.visibleWhen))
      // where the block sits in the screen's own list, so a click in a preview can find it in the builder (not part of the block's data)
      .map(({ b, i }) => Object.defineProperty(this.viewBlock(b), "srcIndex", { value: i, enumerable: false }));
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
    for (const k of ["label", "text", "title", "subtitle", "hint", "helper", "meta", "placeholder"]) if (k in b) out[k] = this.tx(b[k]);
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
    if (b.type === "menu" || b.type === "shortcuts") out.items = (b.items ?? []).map((i: any) => ({ ...i, label: this.tx(i.label), ...(i.text ? { text: this.tx(i.text) } : {}) }));
    if (b.type === "menu" && b.source && b.item) {
      // one row per entry of the list; {{item.x}} in the row's texts and actions reads that entry
      out.items = Object.values(this.get(b.source) ?? {}).map((x: any, n) => {
        const scope = { ...this.scope(), item: x };
        const say = (t: any) => interpolate(localize(t, this.lang, this.journey.locale.default), scope);
        return { id: String(x?.id ?? n), label: say(b.item.label), ...(b.item.text ? { text: say(b.item.text) } : {}), ...(b.item.icon ? { icon: b.item.icon } : {}), actions: bindItem(b.item.actions, scope) };
      });
    }
    if (b.type === "toggle" && b.link) out.link = { ...b.link, label: this.tx(b.link.label) };
    if (b.type === "balanceList") out.rows = balanceRows({ items: Object.values(this.get(b.source) ?? {}) });
    if (b.type === "accordion") out.items = b.items.map((i: any) => ({ id: i.id, title: this.tx(i.title), text: this.tx(i.text) }));
    if (b.type === "dialog") out.buttons = b.buttons.map((x: any) => ({ label: this.tx(x.label), variant: x.variant, actions: x.actions }));
    if (b.type === "map") {
      out.pins = Object.values(this.get(b.source) ?? {}).filter((x: any) => Number.isFinite(Number(x?.lat)) && Number.isFinite(Number(x?.lng))).map((x: any, n) => {
        const scope = { ...this.scope(), item: x };
        return { id: String(x?.id ?? n), label: String(x?.name ?? x?.id ?? n), lat: Number(x.lat), lng: Number(x.lng), actions: [...(b.bind ? [{ type: "setData", path: b.bind, value: String(x?.id ?? n) }] : []), ...bindItem(b.onSelect ?? [], scope)] };
      });
      out.selected = b.bind ? this.get(b.bind) : undefined;
    }
    if (b.type === "sectionHeader" && b.action) out.action = { ...b.action, label: this.tx(b.action.label) };
    return out;
  }
}
