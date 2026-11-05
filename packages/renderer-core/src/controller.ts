import type { Journey } from "@finx/journey-schema";
import { JourneyRunner, type Adapter, type ChainRequest, type RunEvent, type RunnerOptions, type View } from "./runner";

/** A run event with where and when it happened. `session` groups the events of one play-through. */
export type JourneyEvent = RunEvent & { session: string; slug: string; version: number; lang: string; at: string };

export type JourneyControllerOptions = {
  /** Called for every event of the run (screen views, mistakes, bank failures, exits). Never receives answers. */
  onEvent?: (e: JourneyEvent) => void;
  adapter: Adapter;
  lang?: string;
  /** Answers to fill in when the journey opens, by data path, for example the item the customer was looking at. */
  initial?: Record<string, any>;
  /** Values at data paths that are there BEFORE the first screen runs, so the entry screen can branch or skip steps on them (unlike `initial`, which is applied after). */
  launch?: Record<string, any>;
  /** The journey asked to open another one (navigate.toJourney). Without it the person sees a message and stays on the screen. */
  onOpenJourney?: (req: ChainRequest) => void;
  /** What the person may do where they bank from (`session.permissions` in a journey's rules). Read-only for the journey. */
  session?: RunnerOptions["session"];
  /** A receipt was shared (the share action). The player normally handles this itself: print on the web, the share sheet on a phone. */
  onShare?: RunnerOptions["onShare"];
};

/** What a renderer needs to draw the current screen of a journey. */
export type PlayerLayout = {
  view: View;
  /** Blocks drawn in the scrolling body (everything except buttons). */
  body: Array<Record<string, any>>;
  /** Pop-ups, drawn above everything else on the screen. */
  dialogs: Array<Record<string, any>>;
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
    const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.runner = new JourneyRunner(journey, {
      adapter: opts.adapter, lang: opts.lang, launch: opts.launch, openJourney: opts.onOpenJourney, session: opts.session, onShare: opts.onShare,
      onEvent: opts.onEvent ? (e) => opts.onEvent!({ ...e, session, slug: journey.slug, version: journey.version, lang: this.runner.lang, at: new Date().toISOString() }) : undefined,
    });
  }

  /** Opens the first screen (launch values are already in place), then fills in any initial answers. */
  private starting?: Promise<void>;
  /** Opens the first screen once. A second call (React runs an effect twice in development) gets the same answer and runs nothing again, so launch values used once are not lost. */
  start(): Promise<void> {
    return (this.starting ??= this.begin());
  }
  private async begin() {
    await this.runner.start();
    for (const [path, value] of Object.entries(this.opts.initial ?? {})) this.runner.set(path, value);
  }
  subscribe = (fn: () => void) => this.runner.subscribe(fn);
  setLang(lang: string) { this.runner.setLang(lang); }
  set(path: string, value: any) { this.runner.set(path, value); }
  press(actions: any[]) { return this.runner.press(actions); }

  get canStepBack() { return this.runner.screen.kind !== "terminal" && this.runner.canGoBack; }
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
      view, terminal, hero: view.blocks[0]?.type === "hero", canGoBack: !terminal && this.runner.canGoBack, rtl: this.runner.isRtl, lang: this.runner.lang,
      body: view.blocks.filter((b) => b.type !== "button" && b.type !== "dialog"), dialogs: view.blocks.filter((b) => b.type === "dialog"), buttons: view.blocks.filter((b) => b.type === "button"),
      steps: view.stepCount > 0 && view.stepIndex >= 0 ? { count: view.stepCount, done: Array.from({ length: view.stepCount }, (_, i) => i <= view.stepIndex), label: view.stepLabel } : null,
    };
  }
}
