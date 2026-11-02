import type { Journey } from "@finx/journey-schema";
import { JourneyRunner, localize, type View } from "@finx/renderer-core";
import { MockBank, personas } from "@finx/mock-bank-api";

/** One scripted action or check. Actions change state; expectations only check it. */
export type Step =
  | { set: Record<string, unknown> }
  | { press: string }
  | { expectScreen: string }
  | { expectText: string }
  | { expectError: string }
  | { expectToast: string };

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
    case "otp": return `otp[${b.bind}]="${b.value ?? ""}"`;
    case "amountInput": return `amount[${b.bind}]=${b.value ?? ""}${b.helper ? ` helper "${clip(b.helper, 60)}"` : ""}`;
    case "select": return `select[${b.bind}]=${b.value ?? ""} options: ${(b.items ?? []).map((i: any) => i.name).join(", ")}`;
    case "toggle": return `toggle[${b.bind}]=${b.value === true} "${clip(b.label, 40)}"`;
    case "cardForm": { const v = b.value ?? {}; return `cardForm[${b.bind}] number "${v.number ?? ""}" holder "${v.holder ?? ""}" expiry "${v.expiry ?? ""}"${Object.values(b.errors ?? {}).some(Boolean) ? ` errors: ${Object.entries(b.errors).filter(([, m]) => m).map(([k, m]) => `${k}: ${m}`).join("; ")}` : ""}`; }
    case "textInput": return `input[${b.bind}]="${b.value ?? ""}" label "${clip(b.label, 40)}"`;
    case "accountPicker": case "beneficiaryPicker": return `${b.type}[${b.bind}]=${b.value ?? ""} (${(b.items ?? []).length} choices)`;
    case "button": return `button "${clip(b.label, 40)}"`;
    default: return b.type;
  }
}

function visibleStrings(view: View): string[] {
  const out: string[] = [view.title];
  for (const b of view.blocks as any[]) {
    for (const k of ["label", "text", "title", "hint", "helper", "meta", "placeholder", "error"]) if (typeof b[k] === "string") out.push(b[k]);
    if (typeof b.value === "string") out.push(b.value);
    for (const r of b.rows ?? []) out.push(r.label, r.value);
    for (const i of b.items ?? []) if (i?.name) out.push(i.name); else if (i?.displayName) out.push(i.displayName);
  }
  return out.filter(Boolean);
}

export async function simulate(opts: { journey: Journey; persona: string; lang: string; steps: Step[] }): Promise<SimResult> {
  const { journey, persona, lang, steps } = opts;
  if (!(persona in personas)) throw new Error(`Unknown persona "${persona}". Use one of: ${Object.keys(personas).join(", ")}`);
  if (!journey.locale.supported.includes(lang)) throw new Error(`Language "${lang}" is not supported by this journey (supported: ${journey.locale.supported.join(", ")})`);
  if (steps.length > MAX_STEPS) throw new Error(`Too many steps (${steps.length}). The limit is ${MAX_STEPS}.`);

  const bank = new MockBank(persona);
  const runner = new JourneyRunner(journey, { adapter: (id, input) => bank.call(id, input), lang });
  const frames: Frame[] = [];
  const failures: string[] = [];
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

  try { await runner.start(); } catch (e) { failures.push(`The journey failed to start: ${(e as Error).message}`); }
  let view = snap(0, "start");
  let stopped = failures.length > 0;

  for (let i = 0; i < steps.length && !stopped; i++) {
    const n = i + 1;
    const step = steps[i] as any;
    if ("set" in step) {
      for (const [path, value] of Object.entries(step.set)) runner.set(path, value);
      view = snap(n, `set ${Object.keys(step.set).join(", ")}`);
    } else if ("press" in step) {
      const buttons = (runner.view().blocks as any[]).filter((b) => b.type === "button");
      const raw = (runner.screen.blocks as any[]).filter((b) => b.type === "button");
      const want = String(step.press).trim().toLowerCase();
      const idx = buttons.findIndex((b, k) => String(b.label).trim().toLowerCase() === want || localize(raw[k]?.label, journey.locale.default, journey.locale.default).trim().toLowerCase() === want);
      if (idx < 0) {
        view = snap(n, `press "${step.press}"`);
        fail(n, `press "${step.press}": there is no such button on screen "${view.screenId}". Buttons here: ${buttons.map((b) => `"${b.label}"`).join(", ") || "none"}`, view);
        stopped = true;
        break;
      }
      try {
        await runner.press(buttons[idx].actions);
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
      } else if ("expectError" in step) {
        did = `expect validation error "${step.expectError}"`;
        const q = String(step.expectError).toLowerCase();
        if (!Object.entries(runner.errors).some(([k, m]) => k.toLowerCase() === q || m.toLowerCase().includes(q))) fail(n, `${did}: there is no such error on screen "${view.screenId}"`, view);
      } else if ("expectToast" in step) {
        did = `expect message "${step.expectToast}"`;
        if (!view.toast || !view.toast.toLowerCase().includes(String(step.expectToast).toLowerCase())) fail(n, `${did}: the message shown is ${view.toast ? `"${view.toast}"` : "none"}`, view);
      } else {
        failures.push(`Step ${n} is not a known action. Use set, press, expectScreen, expectText, expectError or expectToast.`);
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
    data,
    bank: { balances: Object.fromEntries(bank.persona.accounts.map((a) => [a.id, a.balance])), limitUsedToday: bank.persona.limits.usedToday },
  };
}
