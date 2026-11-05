import { bankworkxJourneys, type Journey } from "@finx/journey-schema";
import { JourneyRunner, localize, wholeExpression, type ChainRequest, type View } from "@finx/renderer-core";
import { MockBank, SIGNED_OUT, personas, type BankConfig, type Flaws, type ProviderId, type SandboxConditions } from "@finx/mock-bank-api";

/** One scripted action or check. Actions change state; expectations only check it. */
export type Step =
  | { set: Record<string, unknown> }
  | { press: string }
  | { expectScreen: string }
  | { expectText: string }
  /** The text is not on the screen (for example an option the bank switched off). */
  | { expectNoText: string }
  | { expectError: string }
  | { expectToast: string }
  /** The journey asked to open journey `journey` (navigate.toJourney) with these launch values (a subset is enough). Checked on the last such request. */
  | { expectOpens: { journey: string; with?: Record<string, unknown> } }
  /** Moves the sandbox clock forward (seconds), for rules that depend on time, such as a rate that is only held for 30 seconds. */
  | { advance: number }
  /** Reads the bank with a read adapter and checks one value: { adapter, input?, path, equals } (for example that no money has moved). An input value of the form {{path}} is read from the journey's data. */
  | { expectBank: { adapter: string; input?: Record<string, unknown>; path: string; equals: unknown } }
  /** Calls the bank directly, the way a forged request would, bypassing every screen, and expects it to refuse with this error code (a role without the permission, another context). */
  | { expectBankError: { adapter: string; input?: Record<string, unknown>; code: string } };

export type Frame = { step: number; did: string; screen: string; title: string; kind: string; errors: Record<string, string>; toast?: string; blocks: string[] };
export type SimResult = {
  ok: boolean;
  persona: string;
  lang: string;
  frames: Frame[];
  failures: string[];
  finalScreen: string;
  finalKind: string;
  exited: boolean;
  visited: string[];
  unvisited: string[];
  data: Record<string, unknown>;
  /** The journeys that were asked for by navigate.toJourney, in order, with the values they were given. Followed when found in `journeys`. */
  opened: { journey: string; launch: Record<string, unknown>; followed: boolean }[];
  /** The slug of the journey the walk ended in (the target when a chain was followed). */
  endedIn: string;
  bank: { balances: Record<string, number>; limitUsedToday: number };
};

export const MAX_STEPS = 80;
const clip = (s: unknown, n = 70) => { const t = String(s ?? ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

function describeBlock(b: Record<string, any>): string | null {
  switch (b.type) {
    case "stepper": return null;
    case "text": return `text "${clip(b.text)}"`;
    case "alert": return `alert(${b.tone}) "${clip(b.text)}"`;
    case "result": return `result(${b.tone}) "${clip(b.title)}"${b.text ? ` "${clip(b.text)}"` : ""}${b.meta ? ` [${clip(b.meta)}]` : ""}`;
    case "reviewSummary": return `review ${b.rows.map((r: any) => `${clip(r.label, 24)}: ${clip(r.value, 30)}`).join("; ")}`;
    case "consent": return `consent[${b.bind}]=${b.value === true} "${clip(b.text, 50)}"`;
    // a hidden field (a password, a PIN) is never written into a transcript: only that it has something in it
    case "otp": return `otp[${b.bind}]="${b.masked ? "•".repeat(String(b.value ?? "").length) : b.value ?? ""}"`;
    case "amountInput": return `amount[${b.bind}]=${b.value ?? ""}${b.helper ? ` helper "${clip(b.helper, 60)}"` : ""}`;
    case "select": return `select[${b.bind}]=${b.value ?? ""} options: ${(b.items ?? []).map((i: any) => i.name).join(", ")}`;
    case "toggle": return `toggle[${b.bind}]=${b.value === true} "${clip(b.label, 40)}"`;
    case "cardForm": { const v = b.value ?? {}; return `cardForm[${b.bind}] number "${v.number ?? ""}" holder "${v.holder ?? ""}" expiry "${v.expiry ?? ""}"${Object.values(b.errors ?? {}).some(Boolean) ? ` errors: ${Object.entries(b.errors).filter(([, m]) => m).map(([k, m]) => `${k}: ${m}`).join("; ")}` : ""}`; }
    case "textInput": return `input[${b.bind}]="${b.secure ? "•".repeat(String(b.value ?? "").length) : b.value ?? ""}" label "${clip(b.label, 40)}"`;
    case "accountPicker": case "beneficiaryPicker": return `${b.type}[${b.bind}]=${b.value ?? ""} (${(b.items ?? []).length} choices)`;
    case "button": return `button "${clip(b.label, 40)}"`;
    case "statusChip": return `status(${b.chip?.tone}) "${b.chip?.label}"`;
    case "timeline": return `timeline ${(b.entries ?? []).map((e: any) => `${e.state}: ${clip(e.title, 30)}`).join("; ")}`;
    case "dataTable": return `table "${clip(b.label, 30)}" ${(b.rows ?? []).length} rows${b.selectable ? `, ticked: ${(b.selected ?? []).join(",") || "none"}` : ""}`;
    case "chart": return `chart(${b.kind}) "${clip(b.label, 30)}" ${b.chart?.series?.[0]?.points?.length ?? 0} points`;
    case "fileUpload": return `file[${b.bind}]=${b.value?.name ?? ""}`;
    case "documentViewer": return `document[${b.bind}] read=${b.value === true} "${clip(b.title, 40)}"`;
    case "signature": return `signature[${b.bind}]=${b.value?.mode ?? ""}`;
    case "idCapture": return `idCapture[${b.bind}] ${(b.steps ?? []).map((x: any) => `${x.id}${x.done ? "✓" : "…"}`).join(" ")}`;
    default: return b.type;
  }
}

function visibleStrings(view: View): string[] {
  const out: string[] = [view.title];
  for (const b of view.blocks as any[]) {
    for (const k of ["label", "text", "title", "subtitle", "hint", "helper", "meta", "placeholder", "error", "name"]) if (typeof b[k] === "string") out.push(b[k]);
    if (typeof b.value === "string") out.push(b.value);
    for (const r of b.rows ?? []) out.push(r.label, r.value);
    // a table's cells and chips, a status chip, the steps of a timeline, the paragraphs of a document, the steps of an ID capture
    if (b.type === "dataTable") for (const r of b.rows ?? []) for (const c of Object.values<any>(r.cells ?? {})) out.push(c.text);
    if (b.type === "statusChip" && b.chip) out.push(b.chip.label);
    for (const e of b.entries ?? []) out.push(e.title, e.text, e.time);
    for (const p of b.paragraphs ?? []) out.push(p.heading, p.text);
    if (b.type === "idCapture") for (const x of b.steps ?? []) out.push(x.label);
    // a choice (its name and the line under it), a payee, or a row of a list (its label and the line under it)
    for (const i of b.items ?? []) { if (i?.name) out.push(i.name); else if (i?.displayName) out.push(i.displayName); if (b.type === "select" && i?.sub) out.push(i.sub); if (b.type === "menu") { if (i?.label) out.push(i.label); if (i?.text) out.push(i.text); } }
  }
  return out.filter(Boolean);
}

export type SimOptions = {
  journey: Journey; persona: string; lang: string; steps: Step[];
  /** The corporate bank API behind corp.* adapters (reference by default). */
  provider?: ProviderId;
  /** The sandbox clock, in milliseconds since 1970. */
  now?: number;
  /** The company to be working in when the walk starts (a context of the signed-in person, such as "alpha"): the step-up and the switch are done first, as the shell does them. Only for a customer with several places. */
  context?: string;
  /** Calls made on the bank before the walk starts. */
  setup?: { adapter: string; input?: Record<string, unknown>; saveAs?: string }[];
  /** Rules switched off in the sandbox, for mutation checks. */
  flaws?: Flaws;
  /** Things that go wrong in the sandbox on purpose (a timeout, an unavailable adapter, a frozen account). */
  conditions?: SandboxConditions;
  /** How the bank is set up: its options per journey (for example sign-in: forceExpiry, riskStepUp). */
  config?: Partial<BankConfig>;
  /** Values the journey is opened with, by data path: they are there before the entry screen runs. */
  launch?: Record<string, unknown>;
  /** Where to find a journey that this one opens (navigate.toJourney, by slug; a copy for a bank, add-money-acme, matches add-money). Default: the shipped BankWorkx journeys. A target not found here is recorded, not followed. */
  journeys?: Journey[];
};

export async function simulate(opts: SimOptions): Promise<SimResult> {
  const { journey, persona, lang, steps } = opts;
  // "signed-out" starts with nobody signed in, for a journey that runs before sign-in (sign-in, recovery): the customer is loaded when it signs one in
  if (!(persona in personas) && persona !== SIGNED_OUT) throw new Error(`Unknown persona "${persona}". Use one of: ${[...Object.keys(personas), SIGNED_OUT].join(", ")}`);
  if (!journey.locale.supported.includes(lang)) throw new Error(`Language "${lang}" is not supported by this journey (supported: ${journey.locale.supported.join(", ")})`);
  if (steps.length > MAX_STEPS) throw new Error(`Too many steps (${steps.length}). The limit is ${MAX_STEPS}.`);

  const bank = new MockBank(persona, { corpProvider: opts.provider, corpFlaws: opts.flaws, conditions: opts.conditions, config: opts.config });
  if (opts.now !== undefined) bank.now = () => opts.now!;
  const setupFailures: string[] = [];
  // working in a company from the start: the same calls the shell makes (a one-time code, the password, the switch), before anything is arranged or walked
  if (opts.context) {
    const identity = bank.persona.identity;
    const held = bank.conditions; bank.conditions = {};
    try {
      if (!identity) throw new Error(`${persona} has no companies to switch into`);
      await bank.call("bank.otp.send", {});
      await bank.call("bank.otp.verify", { code: bank.persona.behaviour.otpCode });
      await bank.call("bank.session.stepUp", { method: "password", secret: identity.password });
      await bank.call("bank.session.switch", { contextId: opts.context });
    } catch (e) { setupFailures.push(`Switching into "${opts.context}" failed: ${(e as Error).message}`); }
    bank.conditions = held;
  }
  // what a setup call answered, by the name it was saved under: later inputs read it as {{setup.name.id}}, so a scenario never
  // hard-codes an id that differs from one bank API to the next (pay_1 on one, TXN-000001 on another)
  const saved: Record<string, unknown> = {};
  const pick = (path: string) => path.split(".").reduce((o: any, k) => o?.[k], { setup: saved });
  const resolve = (v: unknown): unknown => {
    if (typeof v === "string") { const e = wholeExpression(v); return e?.startsWith("setup.") ? pick(e) : v; }
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
    return v;
  };
  for (const [k, call] of (opts.setup ?? []).entries()) {
    try {
      const answer = await bank.call(call.adapter, resolve(call.input ?? {}) as Record<string, any>);
      if (call.saveAs) saved[call.saveAs] = answer;
    } catch (e) { setupFailures.push(`Setup ${k + 1} (${call.adapter}) failed: ${(e as Error).message}`); }
  }
  const catalog = opts.journeys ?? bankworkxJourneys;
  const find = (want: string) => catalog.find((j) => j.slug === want) ?? catalog.find((j) => j.slug.startsWith(`${want}-`));
  const opened: SimResult["opened"] = [];
  let asked: ChainRequest | null = null;
  // what the signed-in person may do where they bank from, as the sandbox says it (journeys read it as session.permissions); only for customers with several places
  let permissions: string[] | undefined;
  const refreshPermissions = async () => {
    try {
      const s: any = await bank.call("bank.session.get", {});
      permissions = s.contexts.find((c: any) => c.id === s.activeContextId)?.permissions;
    } catch { permissions = undefined; }
  };
  await refreshPermissions();
  const make = (j: Journey, launch?: Record<string, unknown>) => new JourneyRunner(j, { adapter: (id, input) => bank.call(id, input), lang, now: () => bank.now(), launch: launch as Record<string, any> | undefined, openJourney: (r) => { asked = r; }, ...(permissions ? { session: { permissions } } : {}) });
  let runner = make(journey, opts.launch);
  let cur = journey;
  /** A journey asked to open another: switch to it when it can be found (and it supports the language), else just remember the request. */
  const follow = async () => {
    for (let hops = 0; asked && hops < 5; hops++) {
      const req: ChainRequest = asked; asked = null;
      const target = find(req.journey);
      const usable = !!target && target.locale.supported.includes(lang);
      opened.push({ journey: req.journey, launch: req.launch, followed: usable });
      if (!usable) return;
      cur = target!; await refreshPermissions(); runner = make(cur, req.launch);
      await runner.start();
    }
  };
  // a bank call made by a step: an input value that is exactly {{path}} is read from the journey's data (for example the id of the payment just chosen)
  const bankInput = (input: Record<string, unknown> = {}) => Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === "string" && /^\{\{\s*setup\./.test(v) ? resolve(v) : typeof v === "string" && /^\{\{[^}]+\}\}$/.test(v) ? runner.get(v.slice(2, -2).trim()) : v])) as Record<string, any>;
  const frames: Frame[] = [];
  const failures: string[] = [...setupFailures];
  const visited = new Set<string>();

  const snap = (step: number, did: string) => {
    const v = runner.view();
    visited.add(v.screenId);
    frames.push({
      step, did, screen: v.screenId, title: v.title, kind: v.kind, errors: { ...runner.errors }, toast: v.toast,
      blocks: (v.blocks as any[]).map(describeBlock).filter((x): x is string => !!x),
    });
    return v;
  };
  const fail = (step: number, what: string, v: View) => {
    const errs = Object.entries(runner.errors);
    failures.push(`Step ${step} ${what}${errs.length ? ` (validation errors: ${errs.map(([k, m]) => `${k}: ${m}`).join("; ")})` : ""}${v.toast ? ` (toast: "${v.toast}")` : ""}`);
  };

  try { await runner.start(); await follow(); } catch (e) { failures.push(`The journey failed to start: ${(e as Error).message}`); }
  let view = snap(0, "start");
  let stopped = failures.length > 0;

  for (let i = 0; i < steps.length && !stopped; i++) {
    const n = i + 1;
    const step = steps[i] as any;
    if ("set" in step) {
      for (const [path, value] of Object.entries(step.set)) runner.set(path, resolve(value));
      view = snap(n, `set ${Object.keys(step.set).join(", ")}`);
    } else if ("advance" in step) {
      const ms = Number(step.advance) * 1000;
      if (!(ms >= 0)) { failures.push(`Step ${n}: advance needs a number of seconds`); stopped = true; break; }
      const t = bank.now() + ms; bank.now = () => t;
      view = snap(n, `advance ${step.advance} seconds`);
    } else if ("press" in step) {
      // a button, or a row of a menu (a list row, a shortcut) with that label
      const shown = runner.view().blocks as any[];
      // (a row of a table that opens on press is found by its key, for example the payment id)
      const rows = [
        ...shown.filter((b) => b.type === "menu" || b.type === "shortcuts").flatMap((b) => (b.items ?? []).map((i: any) => ({ type: "button", label: i.label, actions: i.actions }))),
        ...shown.filter((b) => b.type === "dataTable").flatMap((b) => (b.rows ?? []).filter((r: any) => r.actions?.length).map((r: any) => ({ type: "button", label: r.id, actions: r.actions }))),
      ];
      const buttons = [...shown.filter((b) => b.type === "button"), ...rows];
      // the same button as written in the journey (not translated), found by where it sits on the screen: a button that is hidden must not be mistaken for one that is shown
      const raw = [...shown.filter((b) => b.type === "button").map((b) => (runner.screen.blocks as any[])[b.srcIndex]), ...rows];
      const want = String(step.press).trim().toLowerCase();
      const idx = buttons.findIndex((b, k) => String(b.label).trim().toLowerCase() === want || localize(raw[k]?.label, cur.locale.default, cur.locale.default).trim().toLowerCase() === want);
      if (idx < 0) {
        view = snap(n, `press "${step.press}"`);
        fail(n, `press "${step.press}": there is no such button on screen "${view.screenId}". Buttons here: ${buttons.map((b) => `"${b.label}"`).join(", ") || "none"}`, view);
        stopped = true;
        break;
      }
      try {
        await runner.press(buttons[idx].actions);
        await follow();
        view = snap(n, `press "${buttons[idx].label}"`);
      } catch (e) {
        view = snap(n, `press "${buttons[idx].label}"`);
        fail(n, `press "${buttons[idx].label}" raised an error: ${(e as Error).message}. A callApi action failed and has no onError, so the journey cannot recover. Add onError to that callApi.`, view);
        stopped = true;
      }
    } else {
      view = runner.view();
      let did = "";
      if ("expectScreen" in step) {
        did = `expect screen "${step.expectScreen}"`;
        if (runner.current !== step.expectScreen) fail(n, `${did}: the journey is on "${runner.current}" instead`, view);
      } else if ("expectText" in step) {
        did = `expect text "${step.expectText}"`;
        if (!visibleStrings(view).some((s) => s.toLowerCase().includes(String(step.expectText).toLowerCase()))) fail(n, `${did}: not found on screen "${view.screenId}". Visible: ${visibleStrings(view).map((s) => clip(s, 40)).slice(0, 12).join(" | ")}`, view);
      } else if ("expectNoText" in step) {
        did = `expect no text "${step.expectNoText}"`;
        if (visibleStrings(view).some((s) => s.toLowerCase().includes(String(step.expectNoText).toLowerCase()))) fail(n, `${did}: it is on screen "${view.screenId}"`, view);
      } else if ("expectError" in step) {
        did = `expect validation error "${step.expectError}"`;
        const q = String(step.expectError).toLowerCase();
        if (!Object.entries(runner.errors).some(([k, m]) => k.toLowerCase() === q || m.toLowerCase().includes(q))) fail(n, `${did}: there is no such error on screen "${view.screenId}"`, view);
      } else if ("expectBankError" in step) {
        const e = step.expectBankError;
        did = `expect bank ${e.adapter} to refuse with ${e.code}`;
        try {
          await bank.call(e.adapter, bankInput(e.input));
          fail(n, `${did}: the bank accepted it`, view);
        } catch (err) {
          const got = (err as { code?: string }).code;
          if (got !== e.code) fail(n, `${did}: it answered ${got ?? (err as Error).message}`, view);
        }
      } else if ("expectBank" in step) {
        const e = step.expectBank;
        did = `expect bank ${e.adapter} ${e.path} = ${JSON.stringify(e.equals)}`;
        try {
          const got = e.path.split(".").reduce((o: any, k: string) => o?.[k], await bank.call(e.adapter, bankInput(e.input)));
          if (JSON.stringify(got) !== JSON.stringify(e.equals)) fail(n, `${did}: it is ${JSON.stringify(got)}`, view);
        } catch (err) { fail(n, `${did}: the bank call failed: ${(err as Error).message}`, view); }
      } else if ("expectOpens" in step) {
        const e = step.expectOpens;
        did = `expect it opens journey "${e.journey}"${e.with ? ` with ${JSON.stringify(e.with)}` : ""}`;
        const last = opened[opened.length - 1];
        if (!last || last.journey !== e.journey) fail(n, `${did}: ${last ? `the last journey it opened is "${last.journey}"` : "no other journey was opened"}`, view);
        else {
          const wrong = Object.entries(e.with ?? {}).filter(([k, v]) => JSON.stringify(last.launch[k]) !== JSON.stringify(v));
          if (wrong.length) fail(n, `${did}: it was opened with ${wrong.map(([k]) => `${k} = ${JSON.stringify(last.launch[k])}`).join(", ")}`, view);
        }
      } else if ("expectToast" in step) {
        did = `expect message "${step.expectToast}"`;
        if (!view.toast || !view.toast.toLowerCase().includes(String(step.expectToast).toLowerCase())) fail(n, `${did}: the message shown is ${view.toast ? `"${view.toast}"` : "none"}`, view);
      } else {
        failures.push(`Step ${n} is not a known action. Use set, press, advance, expectScreen, expectText, expectNoText, expectError, expectToast, expectOpens, expectBank or expectBankError.`);
        stopped = true;
        break;
      }
      frames.push({ ...frames[frames.length - 1]!, step: n, did });
    }
  }

  const finalView = runner.view();
  const { ctx: _ctx, ...data } = runner.state;
  return {
    ok: failures.length === 0,
    persona, lang, frames,
    failures: failures.slice(0, 10),
    finalScreen: finalView.screenId, finalKind: finalView.kind, exited: finalView.exited,
    visited: [...visited], unvisited: journey.screens.map((s) => s.id).filter((id) => !visited.has(id)),
    data, opened, endedIn: cur.slug,
    bank: { balances: Object.fromEntries(bank.persona.accounts.map((a) => [a.id, a.balance])), limitUsedToday: bank.persona.limits.usedToday },
  };
}
