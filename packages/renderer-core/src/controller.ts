import type { Journey } from "@finx/journey-schema";
import { JourneyRunner, type Adapter, type View } from "./runner";

export type JourneyControllerOptions = {
  adapter: Adapter;
  lang?: string;
  /** Answers to fill in when the journey opens, by data path, for example the item the customer was looking at. */
  initial?: Record<string, any>;
};

/** What a renderer needs to draw the current screen of a journey. */
export type PlayerLayout = {
  view: View;
  /** Blocks drawn in the scrolling body (everything except buttons). */
  body: Array<Record<string, any>>;
  /** Buttons, drawn in the footer. */
  buttons: Array<Record<string, any>>;
  terminal: boolean;
  /** The screen opens with the bank's banner (a hero block), so the bank draws it without its usual app bar. */
  hero: boolean;
  /** Whether the screen shows a back button: a step that can go back, never an end screen. */
  canGoBack: boolean;
  rtl: boolean;
  lang: string;
  /** The progress bar: how many steps, and how many are done. Empty when the screen is not a numbered step. */
  steps: { count: number; done: boolean[]; label: string } | null;
};

/**
 * One journey being played. It wraps the engine (`JourneyRunner`) with the decisions every renderer makes the same way:
 * how the screen splits into body and buttons, when to show a back button, what the back key does, and how initial answers are applied.
 * The native and web players only draw what `layout()` says.
 */
export class JourneyController {
  readonly runner: JourneyRunner;
  constructor(journey: Journey, private opts: JourneyControllerOptions) {
    this.runner = new JourneyRunner(journey, { adapter: opts.adapter, lang: opts.lang });
  }

  /** Opens the first screen, then fills in any initial answers. */
  async start() {
    await this.runner.start();
    for (const [path, value] of Object.entries(this.opts.initial ?? {})) this.runner.set(path, value);
  }
  subscribe = (fn: () => void) => this.runner.subscribe(fn);
  setLang(lang: string) { this.runner.setLang(lang); }
  set(path: string, value: any) { this.runner.set(path, value); }
  press(actions: any[]) { return this.runner.press(actions); }

  get canStepBack() { return this.runner.screen.kind !== "terminal" && this.runner.history.length > 0; }
  /** The back button and the Android back key: step back when a step can, otherwise report that the player should close. */
  stepBack(): boolean {
    if (!this.canStepBack) return false;
    this.runner.back();
    return true;
  }

  layout(): PlayerLayout {
    const view = this.runner.view();
    const terminal = view.kind === "terminal";
    return {
      view, terminal, hero: view.blocks[0]?.type === "hero", canGoBack: !terminal && this.runner.history.length > 0, rtl: this.runner.isRtl, lang: this.runner.lang,
      body: view.blocks.filter((b) => b.type !== "button"), buttons: view.blocks.filter((b) => b.type === "button"),
      steps: view.stepCount > 0 && view.stepIndex >= 0 ? { count: view.stepCount, done: Array.from({ length: view.stepCount }, (_, i) => i <= view.stepIndex), label: view.stepLabel } : null,
    };
  }
}
