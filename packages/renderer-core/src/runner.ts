import type { Journey, Screen, Block } from "@finx/journey-schema";
import { evaluate, getPath, setPath } from "./expr";
import { currencyInfo } from "@finx/ui-kit";
import { interpolate, localize, wholeExpression } from "./template";
import { ui } from "./strings";
import { cardExpiryValid, luhnValid } from "./card";
import { balanceRows } from "./blocks/pickers";
import { statusChip, timelineState, tableColumns, tableRow, liveSelection, chartView, selectionTotal, fileProblem, fileMessage, fileHint, acceptAttr, docParagraphs, signatureProblem, captureSteps, captureProblem, captureRows, receiptText, type FileKind, type Receipt } from "./blocks/index";

/** The actions of a list row with every {{item.…}} filled in from that row, so pressing it acts on the right entry. */
function bindItem(node: any, scope: any): any {
  if (typeof node === "string") return node.includes("{{item.") ? interpolate(node, scope) : node;
  if (Array.isArray(node)) return node.map((v) => bindItem(v, scope));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, bindItem(v, scope)]));
  return node;
}

/** session.permissions is the app's, not the journey's (a journey may keep its own answers elsewhere under session, such as session.userId). */
const isSession = (path: string) => path === "session" || path === "session.permissions" || path.startsWith("session.permissions.");

export type Adapter = (adapterId: string, input: Record<string, any>) => Promise<any>;
/** What happened during a run, for analytics. No answers or personal data: only where the person was and what stopped them. */
export type RunEvent =
  | { type: "screen"; screen: string; kind: "screen" | "branch" | "terminal" }
  | { type: "invalid"; screen: string; fields: string[] }
  | { type: "apiError"; screen: string; integration: string; code: string }
  | { type: "back"; screen: string }
  | { type: "exit"; screen: string }
  /** The journey asked to open another one. Only the target's name, never the values. */
  | { type: "chain"; screen: string; journey: string }
  /** A receipt was printed or shared. Only that it happened, never what it says. */
  | { type: "share"; screen: string };
/** A journey asking the app to open another one: the target's slug and the values to start it with, by data path. */
export type ChainRequest = { journey: string; launch: Record<string, any>; returnTo?: string };
export type RunnerOptions = {
  adapter: Adapter; lang?: string; onEvent?: (e: RunEvent) => void;
  /** Values at data paths that are there before the entry screen runs, so it can branch on them. */
  launch?: Record<string, any>;
  /** Opens another journey in place of this one (navigate.toJourney). Without it the request is refused with a message on the screen. */
  openJourney?: (req: ChainRequest) => void;
  /**
   * What the signed-in person may do in the place they are banking from, read-only: journeys read it as `session.permissions`
   * (`visibleWhen: "has(session.permissions, 'biz.payments.initiate')"`). It hides things; the bank still enforces every rule.
   */
  session?: { permissions?: string[] };
  /** The journey shared a receipt (the share action): the player prints it on the web or opens the share sheet on a phone. */
  onShare?: (receipt: Receipt) => void;
  /** The clock for what a journey checks against today (a date limit of "today", a card that has expired). The real clock, in the person's time zone, when left out; a simulator passes the sandbox clock (UTC) so a scenario does not depend on the day it runs. */
  now?: () => number;
};
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
  /** Set once this journey has handed over to another one; the app replaces the player. */
  chained?: ChainRequest;
  private otpFailures = 0;
  private listeners = new Set<() => void>();
  lang: string;

  constructor(public journey: Journey, private opts: RunnerOptions) {
    this.lang = opts.lang ?? journey.locale.default;
    this.current = journey.entryScreen;
    // read-only: nothing in a journey can write session.permissions (set, setData and launch values refuse it)
    if (opts.session) this.state.session = { permissions: Object.freeze([...(opts.session.permissions ?? [])]) };
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((l) => l()); }
  private note(e: RunEvent) { try { this.opts.onEvent?.(e); } catch { /* analytics must never break a journey */ } }

  get screen(): Screen { return this.journey.screens.find((s) => s.id === this.current)!; }
  get isRtl() { return (this.journey.locale.rtl ?? []).includes(this.lang); }
  setLang(l: string) { this.lang = l; this.emit(); }

  get(path: string) { return getPath(this.state, path); }
  set(path: string, value: any) { if (isSession(path)) return; setPath(this.state, path, value); delete this.errors[path]; this.emit(); }

  private scope() { return this.state; }
  private tx(t: any) { return interpolate(localize(t, this.lang, this.journey.locale.default), this.scope()); }

  async start() {
    // launch values come first: the entry screen's onEnter, branches and navigation rules can read them
    for (const [path, value] of Object.entries(this.opts.launch ?? {})) if (!isSession(path)) setPath(this.state, path, value);
    await this.enter(this.journey.entryScreen);
  }

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
      if (b.type === "documentViewer") { if (v !== true) this.errors[b.bind] = ui(this.lang, "docMustRead"); continue; }
      const def = this.journey.dataModel?.[b.bind];
      const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0) || v === false && b.type !== "consent";
      if (b.type === "consent") {
        if (b.validation?.mustBeTrue && v !== true) this.errors[b.bind] = this.tx(b.validation.messages?.mustBeTrue ?? ui(this.lang, "required"));
        continue;
      }
      if (def?.required && empty) { this.errors[b.bind] = ui(this.lang, "required"); continue; }
      if (b.type === "fileUpload" && v != null) {
        const problem = fileProblem(v as any, b.accept, b.maxKb);
        if (problem) this.errors[b.bind] = fileMessage(this.lang, problem, b.accept, b.maxKb);
      }
      if (b.type === "signature" && v != null) {
        const message = signatureProblem(this.lang, v, b.expectedName ? this.tx(b.expectedName) : undefined);
        if (message) this.errors[b.bind] = message;
      }
      if (b.type === "idCapture") {
        const message = captureProblem(this.lang, v, captureSteps(b.steps));
        if (message) this.errors[b.bind] = message;
      }
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
      if (b.type === "dateInput" && v != null && v !== "") {
        const t = String(v), now = this.today();
        // a limit is a date, "today", or a {{path}} to another answer (the end of a range cannot be before its start)
        const lim = (x?: string) => (x === "today" ? now : x && x.includes("{{") ? (this.tx(x) || undefined) : x);
        const real = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t) && !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().slice(0, 10) === t;
        if (!real) this.errors[b.bind] = ui(this.lang, "dateInvalid");
        else if (lim(b.min) && t < lim(b.min)!) this.errors[b.bind] = b.messages?.min ? this.tx(b.messages.min) : ui(this.lang, "dateTooEarly");
        else if (lim(b.max) && t > lim(b.max)!) this.errors[b.bind] = b.messages?.max ? this.tx(b.messages.max) : ui(this.lang, "dateTooLate");
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

  /** Today as yyyy-mm-dd: by the injected clock (UTC) when there is one, else the person's own date. */
  private today(): string {
    if (this.opts.now) return new Date(this.opts.now()).toISOString().slice(0, 10);
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /** Checks the four card fields and records one error per field. */
  private validateCard(bind: string) {
    const c = (this.get(bind) ?? {}) as Record<string, string>;
    if (!luhnValid(String(c.number ?? ""))) this.errors[`${bind}.number`] = ui(this.lang, "cardNumber");
    if (String(c.holder ?? "").trim().length < 2) this.errors[`${bind}.holder`] = ui(this.lang, "cardHolder");
    if (!cardExpiryValid(String(c.expiry ?? ""), this.opts.now ? new Date(this.opts.now()) : undefined, !!this.opts.now)) this.errors[`${bind}.expiry`] = ui(this.lang, "cardExpiry");
    if (!/^[0-9]{3,4}$/.test(String(c.cvv ?? ""))) this.errors[`${bind}.cvv`] = ui(this.lang, "cardCvv");
  }

  /** Builds the receipt of this screen and hands it to the player. Without a player that can print or share, nothing happens. */
  private share(a: any) {
    const blocks = (this.screen.blocks as any[]).filter((b) => !b.visibleWhen || this.safeEval(b.visibleWhen));
    const result = blocks.find((b) => b.type === "result");
    const title = a.title ? this.tx(a.title) : result ? this.tx(result.title) : this.tx(this.screen.title);
    const lines: { label: string; value: string }[] = a.rows
      ? a.rows.map((r: any) => ({ label: this.tx(r.label), value: this.tx(r.value) }))
      : [
        ...blocks.filter((b) => b.type === "reviewSummary").flatMap((b) => b.rows.map((r: any) => ({ label: this.tx(r.label), value: this.tx(r.value) }))),
        ...(result?.text ? [{ label: "", value: this.tx(result.text) }] : []), ...(result?.meta ? [{ label: "", value: this.tx(result.meta) }] : []),
      ];
    this.note({ type: "share", screen: this.current });
    this.opts.onShare?.({ title, lines, text: receiptText(title, lines) });
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
          if (!rule && a.toJourney) { this.chain(a); return; }
          const target = rule ?? a.to;
          if (!target) return;
          this.history.push(this.current);
          await this.enter(target);
          return;
        }
        case "setData": {
          // a value that is a whole {{expression}} is read from the journey's data now (for example the username that was found)
          const whole = wholeExpression(a.value);
          if (!isSession(a.path)) setPath(this.state, a.path, whole ? this.safeEval(whole) : a.value);
          break;
        }
        case "showToast": this.toast = this.tx(a.text); this.emit(); break;
        case "exit": this.exited = true; this.note({ type: "exit", screen: this.current }); this.emit(); return;
        case "share": this.share(a); break;
        case "callApi": {
          const integ = this.journey.integrations.find((i) => i.id === a.integration);
          if (!integ) throw new Error(`Unknown integration ${a.integration}`);
          const input = this.resolveInput(a.input ?? {});
          try {
            const res = await this.opts.adapter(integ.adapter, input);
            if (a.saveAs && !isSession(a.saveAs)) setPath(this.state, a.saveAs, res);
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

  /** Hands over to another journey. Values that are {{templates}} are read from this journey's data now; bank options (opt.*) go along, they belong to the bank. */
  private chain(a: any) {
    const launch: Record<string, any> = {};
    const opt = this.state.opt;
    if (opt && typeof opt === "object") for (const [k, v] of Object.entries(opt)) launch[`opt.${k}`] = v;
    for (const [path, v] of Object.entries<any>(a.with ?? {})) {
      const whole = wholeExpression(v);
      launch[path] = whole ? this.safeEval(whole) : typeof v === "string" && v.includes("{{") ? interpolate(v, this.scope()) : v;
    }
    const req: ChainRequest = { journey: a.toJourney, launch, ...(a.returnTo ? { returnTo: a.returnTo } : {}) };
    this.note({ type: "chain", screen: this.current, journey: a.toJourney });
    if (!this.opts.openJourney) { this.toast = ui(this.lang, "journeyNotLoaded"); this.emit(); return; }
    this.chained = req;
    this.emit();
    this.opts.openJourney(req);
  }

  private resolveInput(input: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      const expr = wholeExpression(v);
      if (expr) out[k] = this.safeEval(expr);
      else out[k] = v;
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
    for (const k of ["label", "text", "title", "subtitle", "hint", "helper", "meta", "placeholder", "name"]) if (k in b) out[k] = this.tx(b[k]);
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
    if (b.type === "dateInput") for (const k of ["min", "max"]) if (typeof b[k] === "string" && b[k].includes("{{")) out[k] = this.tx(b[k]) || undefined;
    if (b.type === "statusChip") {
      const value = this.tx(b.status);
      const o = b.statuses?.[value];
      out.chip = statusChip(value, { label: o?.label != null ? this.tx(o.label) : b.label != null ? this.tx(b.label) : undefined, tone: b.tone ?? o?.tone });
    }
    if (b.type === "timeline") {
      const entries = (b.items ?? []).filter((i: any) => !i.visibleWhen || this.safeEval(i.visibleWhen)).map((i: any) => ({
        id: i.id, title: this.tx(i.title), ...(i.text ? { text: this.tx(i.text) } : {}), ...(i.time ? { time: this.tx(i.time) } : {}), state: timelineState(i.state == null ? undefined : this.tx(i.state)),
      }));
      if (b.source && b.item) {
        const rows = Object.values(this.get(b.source) ?? {}).map((x: any, n) => {
          const say = (t: any) => interpolate(localize(t, this.lang, this.journey.locale.default), { ...this.scope(), item: x });
          return { id: String(x?.id ?? n), title: say(b.item.title), ...(b.item.text ? { text: say(b.item.text) } : {}), ...(b.item.time ? { time: say(b.item.time) } : {}), state: timelineState(b.item.state == null ? undefined : say(b.item.state)) };
        });
        entries.push(...rows);
      }
      out.entries = entries;
    }
    if (b.type === "dataTable") {
      const say = (t: any) => this.tx(t);
      const list = Object.values(this.get(b.source) ?? {});
      out.columns = tableColumns(b.columns, say);
      out.rows = list.map((x: any, n) => tableRow(x, String(x?.[b.rowKey ?? "id"] ?? n), b.columns, say, b.onRowPress ? bindItem(b.onRowPress, { ...this.scope(), item: x }) : undefined));
      out.selected = b.bind ? liveSelection(this.get(b.bind), out.rows) : [];
      out.selectable = !!b.bind;
      if (b.total) out.selectionTotal = selectionTotal(out.rows, out.selected, b.total.key, this.tx(b.total.currency));
      if (b.empty) out.empty = say(b.empty);
    }
    if (b.type === "fileUpload") {
      const accept: FileKind[] = b.accept;
      out.acceptAttr = acceptAttr(accept); out.hint = fileHint(this.lang, accept, b.maxKb);
    }
    if (b.type === "documentViewer") out.paragraphs = docParagraphs(this.tx(b.text));
    if (b.type === "signature") { out.modes = b.modes ?? ["type", "draw"]; if (b.expectedName) out.expectedName = this.tx(b.expectedName); }
    if (b.type === "idCapture") out.steps = captureRows(this.get(b.bind), captureSteps(b.steps), this.lang);
    if (b.type === "chart") {
      const say = (t: any) => this.tx(t);
      out.chart = chartView(Object.values(this.get(b.source) ?? {}), { ...b, xLabel: b.xLabel ? say(b.xLabel) : undefined }, say, b.currency ? this.tx(b.currency) : "");
    }
    if (b.type === "sectionHeader" && b.action) out.action = { ...b.action, label: this.tx(b.action.label) };
    return out;
  }
}
