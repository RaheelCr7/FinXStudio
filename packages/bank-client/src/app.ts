import { MockBank, isProviderId, personasFor, type Persona } from "@finx/mock-bank-api";
import type { Preset } from "@finx/ui-kit";
import { slugIs, type CatalogResult, type Live, type createLive } from "./live";
import { usd } from "./format";

export type TabId = "dashboard" | "accounts" | "budgets" | "wallet";
export type Sheet = null | "fab" | "menu" | "notes";
/** The Invest area sits above the tabs: null is closed, {} is its home, { symbol } is one stock or fund. */
export type InvestView = null | { symbol?: string };
export type ActiveJourney = Live & { initial?: Record<string, any> };
export type Toast = { text: string; ok: boolean } | null;

export type AppState = {
  screen: "login" | "app" | "journey";
  personaId: string;
  lang: string;
  tab: TabId;
  budgetId: string | null;
  investView: InvestView;
  sheet: Sheet;
  /** The subscription being paid, while its sheet is open. */
  subId: string | null;
  paying: boolean;
  toast: Toast;
  /** Goes up whenever data changed behind the screens' backs (a journey closed, a payment was made), so they redraw. */
  tick: number;
  catalog: CatalogResult;
  active: ActiveJourney | null;
  /** The slug of the journey being fetched, while it loads. */
  opening: string | null;
  studioUrl: string;
};

export type BankAppDeps = {
  /** The bank this app is. Decides which sandbox customers can sign in. */
  preset: Preset;
  /** The project (bank app) this is, when it has sandbox customers of its own. Those are used instead of the look's customers. */
  projectId?: string;
  live: ReturnType<typeof createLive>;
  studioUrl: string;
  /** The bank API of the project (a corporate customer's company sits behind it). Unset: the reference sandbox. */
  bankApi?: string;
  /** The customer selected on the sign-in screen at first. Defaults to the first one for this bank. */
  defaultPersona?: string;
  money?: (n: number) => string;
  toastMs?: number;
};

/**
 * Everything a bank app does that is not drawing: who is signed in, which screen and tab is open, the Studio catalog,
 * the journey in progress, payments, and notices. It holds no React and no platform code, so the Expo app and the web app share it
 * and only draw what it says. Screens read `getState()` (and redraw on `subscribe`) and call its methods.
 */
export class BankApp {
  private state: AppState;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private current: MockBank;
  private adapterFor: MockBank | null = null;
  private adapterFn!: (id: string, input: Record<string, any>) => Promise<any>;

  constructor(private deps: BankAppDeps) {
    const personaId = deps.defaultPersona ?? personasFor(deps.preset, deps.projectId)[0]?.id ?? "ayesha";
    this.current = this.newBank(personaId);
    this.state = {
      screen: "login", personaId, lang: "en", tab: "dashboard", budgetId: null, investView: null, sheet: null, subId: null, paying: false, toast: null, tick: 0,
      catalog: { entries: deps.live.bundledEntries(), source: "bundled" }, active: null, opening: null, studioUrl: deps.studioUrl,
    };
  }

  // ---- reading ----------------------------------------------------------------------------------------------------
  getState = (): AppState => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  /** The sandbox bank of the signed-in customer. A fresh one is made each time the sign-in screen shows, so the sandbox resets. */
  get bank(): MockBank { return this.current; }
  get persona(): Persona { return this.current.persona; }
  /** The function journeys use to call the bank. Stable for as long as the bank is the same. */
  get adapter() {
    if (this.adapterFor !== this.current) { const bank = this.current; this.adapterFor = bank; this.adapterFn = (id, input) => bank.call(id, input); }
    return this.adapterFn;
  }
  personas = () => personasFor(this.deps.preset, this.deps.projectId);
  money = (n: number) => (this.deps.money ?? usd)(n);

  private set(patch: Partial<AppState>) { this.state = { ...this.state, ...patch }; for (const l of [...this.listeners]) l(); }
  private newBank(personaId: string) { return new MockBank(personaId, { corpProvider: isProviderId(this.deps.bankApi) ? this.deps.bankApi : undefined }); }
  private freshBank() { this.current = this.newBank(this.state.personaId); }

  // ---- signing in and out ------------------------------------------------------------------------------------------
  selectPersona(id: string) { this.set({ personaId: id }); this.freshBank(); this.set({ tick: this.state.tick + 1 }); }
  login() {
    this.set({ screen: "app", tab: "dashboard" });
    void this.refreshCatalog();
  }
  logout() {
    this.freshBank();
    this.set({ screen: "login", budgetId: null, investView: null, sheet: null, subId: null, active: null, toast: null, tick: this.state.tick + 1 });
  }
  setLang(lang: string) { this.set({ lang }); }
  toggleLang() { this.setLang(this.state.lang === "en" ? "ur" : "en"); }

  // ---- places -----------------------------------------------------------------------------------------------------
  setTab(tab: TabId) { this.set({ tab }); }
  openBudget(id: string) { this.set({ budgetId: id }); }
  closeBudget() { this.set({ budgetId: null }); }
  openInvest() { this.set({ investView: {} }); }
  openInstrument(symbol: string) { this.set({ investView: { symbol } }); }
  /** Back from a stock goes to the Invest home; back from the home leaves Invest. */
  backInvest() { this.set({ investView: this.state.investView?.symbol ? {} : null }); }
  openSheet(sheet: Exclude<Sheet, null>) { this.set({ sheet }); }
  closeSheet() { this.set({ sheet: null }); }
  bump() { this.set({ tick: this.state.tick + 1 }); }

  // ---- Studio and journeys -----------------------------------------------------------------------------------------
  async refreshCatalog() {
    const catalog = await this.deps.live.loadCatalog(this.state.studioUrl);
    this.set({ catalog });
  }
  setStudioUrl(url: string) {
    this.set({ studioUrl: url });
    if (this.state.screen !== "login") void this.refreshCatalog();
  }
  /** The slug of the journey to open for a name, matching copies made for this bank (add-money-acme for add-money). */
  resolveSlug(want: string) { return this.state.catalog.entries.find((e) => slugIs(e.slug, want))?.slug ?? want; }
  /** Loads a journey (from Studio, else the bundled copy) without changing the screen. For apps where the address decides the screen. */
  fetchJourney(want: string) { return this.deps.live.loadJourney(this.state.studioUrl, this.resolveSlug(want)); }
  /** Opens a journey by name. Fails with a notice, never an exception. */
  async openJourney(want: string, initial?: Record<string, any>) {
    const slug = this.resolveSlug(want);
    this.set({ sheet: null, opening: slug });
    const l = await this.deps.live.loadJourney(this.state.studioUrl, slug);
    if (l) this.set({ opening: null, active: { ...l, initial }, screen: "journey" });
    else { this.set({ opening: null }); this.say("That journey is not available right now.", false); }
  }
  /** The journey finished or was closed: back to the app, and everything redraws because balances may have changed. */
  closeJourney() {
    this.set({ screen: "app", active: null, tick: this.state.tick + 1 });
    void this.refreshCatalog();
  }

  // ---- paying a subscription --------------------------------------------------------------------------------------
  paySubscription(id: string) { this.set({ subId: id }); }
  cancelPayment() { this.set({ subId: null }); }
  async confirmPayment() {
    const fin = this.persona.finance, from = this.persona.accounts[0];
    const sub = fin?.subscriptions.find((x) => x.id === this.state.subId);
    if (!sub || !from) return;
    this.set({ paying: true });
    try {
      await this.current.call("bank.subscriptions.pay", { subscriptionId: sub.id, fromAccountId: from.id });
      this.set({ paying: false, subId: null, tick: this.state.tick + 1 });
      this.say(`Paid ${sub.name} ${this.money(sub.amount)}`);
    } catch (e: any) {
      this.set({ paying: false });
      this.say(e?.message ?? "Payment failed", false);
    }
  }

  // ---- notices -----------------------------------------------------------------------------------------------------
  say(text: string, ok = true) {
    if (this.timer) clearTimeout(this.timer);
    this.set({ toast: { text, ok } });
    this.timer = setTimeout(() => { this.timer = null; this.set({ toast: null }); }, this.deps.toastMs ?? 3200);
  }
  /** Stops the pending notice timer. Listeners are left alone: React may unmount and remount an effect without the app going away. */
  dispose() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}
