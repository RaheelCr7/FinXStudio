import { ACCESS, AccessDirectory, MockBank, SIGNED_OUT, isProviderId, maskPhone, personasFor, type DeviceInfo, type Persona } from "@finx/mock-bank-api";
import type { Preset, WorkspaceId } from "@finx/ui-kit";
import { slugIs, type CatalogResult, type Live, type createLive } from "./live";
import { usd } from "./format";
import { NO_SETTINGS, activeContext, findContext, stepUpValid, workspaceOf, type BankSettings, type ContextInfo, type SessionInfo } from "./session";
import { ACTIVE, IDLE, backgroundTooLong, idleState, sameIdle, type IdleConfig, type IdleState } from "./idle";
import { loadHistory, loadSecurity, type History, type HistoryQuery, type SecurityVm } from "./view-models/security";
import { entryFor, journeyAllowed, journeyNeedsStepUp, launchFromValues, launchPointsFor, launchValues, type LaunchPoint } from "./launch-points";
import { linkContext, needsSwitch, parseLink, type Link } from "./links";
import { FIRST_TAB, isTab, type ShellTab } from "./view-models/menus";
import { noticesFor, type ContextNotice, type RawNotification } from "./view-models/notices";
import { loadScreen, type Screen } from "./view-models/screens";

export type TabId = "dashboard" | "accounts" | "budgets" | "wallet";
export type Sheet = null | "fab" | "menu" | "notes" | "signout";
/** The Invest area sits above the tabs: null is closed, {} is its home, { symbol } is one stock or fund. */
export type InvestView = null | { symbol?: string };
export type ActiveJourney = Live & { initial?: Record<string, any>; /** Values there before the entry screen runs. */ launch?: Record<string, any> };
export type Toast = { text: string; ok: boolean } | null;

/** One screen's data while it loads: the app keeps it per place so a switch can clear it. */
export type ViewData<T = unknown> = { status: "loading" | "ready" | "error"; data?: T; error?: string; code?: string };
/** `unavailable` is a customer with a single place (no `bank.session`): the classic shell is used instead. */
export type SessionState = { status: "idle" | "loading" | "ready" | "unavailable" | "error"; info: SessionInfo | null; settings: BankSettings; error?: string };
/** Asking the customer to confirm it is them before opening a company: password (or biometrics) first, then the one-time code. */
export type StepUpState = {
  contextId: string; phase: "password" | "code"; busy: boolean; error?: string; phone?: string;
  /** What it is for, in words ("To open Alpha Trading LLC.", "To change your password."). */
  reason?: string;
  /** After it, open this link (a security journey) instead of switching place. */
  then?: Link;
  /** How the person proves it first: the password, or the quick PIN or the phone's own check when that is how this device signs in. */
  method?: "password" | "pin" | "biometric";
  /** The phone can do fingerprint or face (a flag, not a prompt: the sandbox cannot show one). */
  biometric?: boolean;
} | null;
/** Why the sign-in screen is showing: the person was signed out for their security (idle, or the bank ended the session), or the profile was locked. */
export type SignedOutNotice = null | "expired" | "locked";
/** What a switch keeps: the customer's own settings, not anything the bank showed them. */
export type Prefs = { scheme: "system" | "light" | "dark"; lastTab: Record<WorkspaceId, ShellTab> };
const DEFAULT_PREFS: Prefs = { scheme: "system", lastTab: { personal: "home", business: "overview" } };

export type AppState = {
  screen: "login" | "app" | "journey";
  personaId: string;
  /** The sandbox customer picker is shown instead of the sign-in journey (for development). Always true for a bank without a real sign-in. */
  picker: boolean;
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
  // ---- sessions with workspaces (one login, Personal and companies) ----
  session: SessionState;
  /** The place the shell shows: Personal, or a company. Decides the theme. */
  workspace: WorkspaceId;
  shellTab: ShellTab;
  /** The name of the place being switched to, during the "Switching to ..." moment. */
  switching: string | null;
  stepUp: StepUpState;
  /** A link into another place, waiting for the customer to accept switching to it. */
  offer: Link | null;
  /** A link whose switch is done: the app opens it and calls `clearArrived`. */
  arrived: Link | null;
  prefs: Prefs;
  /** Sensitive, per place: all of these are cleared on a switch. */
  search: string;
  filters: Record<string, string>;
  drafts: Record<string, Record<string, any>>;
  views: Record<string, ViewData>;
  /** Notifications opened in this sitting (the bank has no "mark read" call in the sandbox). */
  readIds: string[];
  /** The session timeout: nothing, the "Still there?" warning with the seconds left, or signed out. */
  idle: IdleState;
  /** A page inside the More tab (Settings > Security) for apps that keep the screen in this store; the web app's address decides instead. */
  sub: null | "security";
  notice: SignedOutNotice;
};

/** Launch values waiting for a journey that a web address opens (the address cannot carry them). */
type PendingLaunch = { slug: string; values: Record<string, any> };

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
  /** How long the "Switching to ..." moment lasts at least (apps give it a short pause; tests none). */
  switchMs?: number;
  /**
   * The bank has a real sign-in: the sign-in journey signs the customer in at the sandbox (username, password, code on a new device), and the
   * sandbox customer picker is only there when asked for (`showPicker`). Without it the picker is the sign-in, as before.
   */
  signIn?: boolean;
  /** The device this app is on, for trusted devices and the code on a new one (the sandbox remembers it for as long as the app runs). */
  device?: DeviceInfo;
  /** Sign the customer out after quiet minutes (true: 300 seconds, a warning at 240). The sandbox bank ends the session at the same time. Off unless set. */
  idle?: boolean | IdleConfig;
  /** The clock of the timeout, for tests (default: the real clock, which is also the sandbox bank's). */
  now?: () => number;
  /** After a timeout, the next sign-in returns to the tab the customer was on (for apps that keep the screen here; the web app's address does it). */
  keepPlace?: boolean;
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
  private pending: PendingLaunch | null = null;
  private adapterFn!: (id: string, input: Record<string, any>) => Promise<any>;
  /** Goes up whenever the place changes or the customer signs out, so an answer that arrives late is dropped, never shown in the wrong place. */
  private epoch = 0;
  private arriveAfter: Link | null = null;
  private inflight = new Map<string, Promise<void>>();
  /** A link that arrived before the session was ready (a deep link that opened the app): followed once it is. */
  private heldLink: Link | null = null;
  /** What the sandbox bank remembers about who can sign in (passwords as hashes, trusted devices, locks). It outlives a sign-out, so a device that was trusted is still trusted. */
  private access = new AccessDirectory();
  private picker: boolean;
  private idleCfg: IdleConfig | null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivity = 0;
  /** When the phone went to the background (null: it is in the front). */
  private backgroundAt: number | null = null;
  /** Where the customer was when the session ended, and who they were: the next sign-in of the same customer returns there (apps with keepPlace). */
  private returnTo: { link: Link; personaId: string } | null = null;
  private pendingReturn: Link | null = null;
  /** The bank made for the sign-in journey: only a customer it signed in counts as signed in by the journey (a customer chosen another way does not). */
  private signInBank?: MockBank;

  constructor(private deps: BankAppDeps) {
    const personaId = deps.defaultPersona ?? personasFor(deps.preset, deps.projectId)[0]?.id ?? "ayesha";
    this.idleCfg = deps.idle ? (deps.idle === true ? IDLE : deps.idle) : null;
    this.picker = !deps.signIn;
    this.current = this.picker ? this.newBank(personaId) : this.signedOutBank();
    this.state = {
      screen: "login", personaId, picker: this.picker, lang: "en", tab: "dashboard", budgetId: null, investView: null, sheet: null, subId: null, paying: false, toast: null, tick: 0,
      catalog: { entries: deps.live.bundledEntries(), source: "bundled" }, active: null, opening: null, studioUrl: deps.studioUrl,
      idle: ACTIVE, notice: null,
      ...this.freshShell(),
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
    if (this.adapterFor !== this.current) { const bank = this.current; this.adapterFor = bank; this.adapterFn = (id, input) => { this.touch(); return bank.call(id, input); }; }
    return this.adapterFn;
  }
  /** The customers the sign-in offers: the demo customers, not the ones made for tests. */
  personas = () => personasFor(this.deps.preset, this.deps.projectId).filter((p) => !p.testCast);
  money = (n: number) => (this.deps.money ?? usd)(n);

  /** The shell fields of a signed-out or just-switched app. Preferences are not in it: they survive a switch. */
  private freshShell() {
    return { session: { status: "idle", info: null, settings: NO_SETTINGS } as SessionState, workspace: "personal" as WorkspaceId, shellTab: "home" as ShellTab, switching: null, stepUp: null as StepUpState, offer: null as Link | null, arrived: null as Link | null,
      prefs: this.state?.prefs ?? DEFAULT_PREFS, search: "", filters: {} as Record<string, string>, drafts: {} as AppState["drafts"], views: {} as AppState["views"], readIds: [] as string[], sub: null as AppState["sub"] };
  }
  private set(patch: Partial<AppState>) { this.state = { ...this.state, ...patch }; for (const l of [...this.listeners]) l(); }
  private newBank(personaId: string) { return new MockBank(personaId, { corpProvider: isProviderId(this.deps.bankApi) ? this.deps.bankApi : undefined, directory: this.access, device: this.deps.device, ...(this.idleCfg ? { conditions: { idleTimeoutSeconds: this.idleCfg.idleSeconds } } : {}) }); }
  /** A bank that nobody is signed in to: only the sign-in and recovery adapters answer, until the sign-in journey completes. */
  private signedOutBank() { return (this.signInBank = this.newBank(SIGNED_OUT)); }
  private freshBank() { this.current = this.picker ? this.newBank(this.state.personaId) : this.signedOutBank(); }

  // ---- signing in and out ------------------------------------------------------------------------------------------
  selectPersona(id: string) { this.epoch++; this.set({ personaId: id, ...this.freshShell() }); this.current = this.newBank(id); this.set({ tick: this.state.tick + 1 }); }
  /** Whether the bank has a real sign-in (the picker is then only there for development). */
  get hasSignIn() { return !!this.deps.signIn; }
  /** Shows or hides the sandbox customer picker (for development). Only a bank with a real sign-in has anything to switch. */
  showPicker(on: boolean) {
    if (!this.deps.signIn || this.picker === on) return;
    this.picker = on;
    this.epoch++;
    this.set({ picker: on, ...this.freshShell() });
    this.freshBank();
    this.set({ tick: this.state.tick + 1 });
  }
  /**
   * The sign-in journey has ended. When the bank now serves a customer the app opens it: who signed in is the bank's own answer (its session),
   * so no password, token or name passes through the journey or the app. Returns whether a customer is signed in.
   */
  finishSignIn(): boolean {
    const bank = this.current;
    if (this.picker || bank !== this.signInBank || !bank.signedIn || this.state.screen !== "login") return false;
    this.epoch++;
    this.set({ personaId: bank.persona.id, ...this.freshShell() });
    // the same customer signing in again after a timeout goes back to the tab they were on
    this.pendingReturn = this.returnTo && this.returnTo.personaId === bank.persona.id ? this.returnTo.link : null;
    this.returnTo = null;
    this.login();
    return true;
  }
  login() {
    this.touchNow();
    this.set({ screen: "app", tab: "dashboard", notice: null, idle: ACTIVE });
    this.startIdle();
    void this.refreshCatalog();
  }
  /**
   * Signs out. The app clears everything of the customer (the session, the place, the step-up and the code, every cached screen, the journey and its drafts,
   * open sheets, search and filters, toasts) and tells the bank; if the bank cannot be told the person is signed out here all the same. What is kept is the
   * language, light or dark, the device the bank remembers and the greeting. `why` is the reason the sign-in screen gives (a timeout or a lock).
   */
  logout(why: SignedOutNotice = null) {
    this.epoch++;
    this.stopIdle();
    this.arriveAfter = null; this.pending = null; this.stepUpProof = null; this.heldLink = null; this.pendingReturn = null;
    if (why === null) this.returnTo = null;
    // the session ends at the bank too: a journey still holding `adapter` (or a late call) must not keep working in the old sandbox
    void this.current.call("bank.auth.signOut").catch(() => undefined);
    this.current.expireSession();
    this.freshBank();
    this.set({ screen: "login", budgetId: null, investView: null, sheet: null, subId: null, active: null, toast: null, idle: ACTIVE, notice: why, ...this.freshShell(), tick: this.state.tick + 1 });
  }
  /** The person chose Log out: ask once (the timeout and the lock do not ask). */
  askSignOut() { this.set({ sheet: "signout" }); }

  // ---- the session timeout -------------------------------------------------------------------------------------------
  private now() { return this.deps.now?.() ?? Date.now(); }
  private touchNow() { this.lastActivity = this.now(); }
  /** A request of the app counts as activity, except while the "Still there?" warning is up (a request behind it must not keep the session going). */
  private touch() { if (this.idleCfg && this.state.screen !== "login" && this.state.idle.phase === "active") this.touchNow(); }
  /** A tap, key press or scroll. Ignored while the warning is up: only "Stay signed in" keeps the session. */
  activity() { if (this.idleCfg && this.state.screen !== "login" && this.state.idle.phase === "active") this.touchNow(); }
  private startIdle() {
    this.stopIdle();
    if (this.idleCfg) this.idleTimer = setInterval(() => this.idleTick(), 1000);
  }
  private stopIdle() { if (this.idleTimer) { clearInterval(this.idleTimer); this.idleTimer = null; } }
  /** Once a second: the countdown. At the end the session ends (a request already on its way is allowed to finish; nothing new is sent). */
  idleTick() {
    if (!this.idleCfg || this.state.screen === "login" || this.backgroundAt !== null) return;
    const next = idleState(this.lastActivity, this.now(), this.idleCfg);
    if (next.phase === "out") { this.expire(); return; }
    if (!sameIdle(next, this.state.idle)) this.set({ idle: next });
  }
  /** "Stay signed in": the bank is asked to keep the session and the clock starts again. */
  async keepAlive() {
    try { await this.current.call("bank.session.keepAlive"); } catch (e: any) { if (e?.code === "SESSION_EXPIRED") { this.expire(); return; } }
    this.touchNow();
    this.set({ idle: ACTIVE });
  }
  /** Signed out for their security: the timeout ran out, or the bank ended the session. The next sign-in says why. */
  expire() {
    if (this.deps.keepPlace && this.state.session.info) {
      const ctx = this.context;
      this.returnTo = { personaId: this.state.personaId, link: ctx?.workspace === "business" ? { workspace: "business", companyId: ctx.id, tab: this.state.shellTab } as Link : { workspace: "personal", tab: this.state.shellTab } as Link };
    }
    this.logout("expired");
  }
  /** The phone went to the background or came back. After more than the idle time away it comes back signed out, with no warning. */
  setBackground(away: boolean) {
    if (!this.idleCfg || this.state.screen === "login") return;
    if (away) { if (this.backgroundAt === null) this.backgroundAt = this.now(); return; }
    const left = this.backgroundAt; this.backgroundAt = null;
    if (left !== null && backgroundTooLong(left, this.now(), this.idleCfg)) this.expire();
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
  bump() { this.set({ tick: this.state.tick + 1, views: {} }); }

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
  /**
   * Opens a journey by name. `initial` answers are filled in after its first screen opens; `launch` values are there before it
   * runs, so its entry can branch on them. Fails with a notice, never an exception.
   */
  async openJourney(want: string, initial?: Record<string, any>, launch?: Record<string, any>) {
    const slug = this.resolveSlug(want);
    this.set({ sheet: null, opening: slug });
    const l = await this.deps.live.loadJourney(this.state.studioUrl, slug);
    if (l) this.set({ opening: null, active: { ...l, initial, launch }, screen: "journey" });
    else { this.set({ opening: null }); this.say("That journey is not available right now.", false); }
  }
  /**
   * A journey asked to open another one (navigate.toJourney): the target takes its place with the values it was given.
   * When the target cannot be loaded the calling journey (which has nothing left to show) is closed with a notice.
   */
  async openChained(want: string, launch: Record<string, any>) {
    const slug = this.resolveSlug(want);
    const l = await this.deps.live.loadJourney(this.state.studioUrl, slug);
    if (l) this.set({ active: { ...l, launch }, screen: "journey" });
    else { this.closeJourney(); this.say("That journey is not available right now.", false); }
  }
  /** For apps where the address decides the journey: values to start the journey at `want` with, picked up by `launchFor` when it opens. */
  setLaunch(want: string, values: Record<string, any>) { this.pending = { slug: this.resolveSlug(want), values }; }
  launchFor(want: string): Record<string, any> | undefined { return this.pending && this.pending.slug === this.resolveSlug(want) ? this.pending.values : undefined; }
  clearLaunch() { this.pending = null; }
  /** The journey finished or was closed: back to the app, and everything redraws because balances may have changed. */
  closeJourney() {
    this.pending = null;
    this.set({ screen: "app", active: null, views: {}, tick: this.state.tick + 1 });
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
      await this.call("bank.subscriptions.pay", { subscriptionId: sub.id, fromAccountId: from.id });
      this.set({ paying: false, subId: null, tick: this.state.tick + 1 });
      this.say(`Paid ${sub.name} ${this.money(sub.amount)}`);
    } catch (e: any) {
      this.set({ paying: false });
      this.say(e?.message ?? "Payment failed", false);
    }
  }

  // ---- places: Personal and each company ------------------------------------------------------------------------------
  /** The context the customer is in now, as the bank described it (its permissions are what menus and buttons follow). */
  get context(): ContextInfo | undefined { return activeContext(this.state.session.info); }
  private call = (id: string, input: Record<string, any> = {}) => { this.touch(); return this.current.call(id, input); };

  /** Asks the bank who is signed in, where they bank from and what the bank has switched on. A customer with one place gets `unavailable`. */
  async loadSession() {
    const epoch = this.epoch, prev = this.state.session;
    // a refresh behind a screen that is already showing does not blank it
    this.set({ session: { ...prev, status: prev.status === "ready" ? "ready" : "loading", error: undefined } });
    try {
      const [info, settings] = await Promise.all([this.call("bank.session.get"), this.call("bank.app.config")]);
      if (epoch !== this.epoch) return;
      const ctx = findContext(info, info.activeContextId);
      const workspace = workspaceOf(ctx);
      this.set({ session: { status: "ready", info, settings: { homeMarket: settings.homeMarket, disabled: settings.disabled ?? [], options: settings.options ?? {} } }, workspace, shellTab: this.state.prefs.lastTab[workspace] });
      if (workspace === "business") void this.loadShell("approvals");
      if (this.heldLink) { const link = this.heldLink; this.heldLink = null; if (this.followLink(link) === "go") void this.applyLink(link); }
      // back from a timeout: the tab the customer was on (never a journey: its entries were lost)
      if (this.pendingReturn) { const back = this.pendingReturn; this.pendingReturn = null; if (this.followLink(back) === "go") this.set({ arrived: back }); }
    } catch (e: any) {
      if (epoch !== this.epoch) return;
      if (e?.code === "SESSION_EXPIRED" && this.idleCfg) { this.expire(); return; }
      this.set({ session: { ...prev, status: e?.code === "NOT_SUPPORTED" ? "unavailable" : "error", error: e?.message ?? "Could not load your accounts" } });
    }
  }

  /**
   * Moves to another place. The bank may ask for a step-up first ("step-up" is returned and `stepUp` is set: the app asks, then
   * `confirmStepUp` finishes the switch). Everything that belongs to the place being left is cleared; language, light or dark and
   * the last tab of each workspace stay.
   */
  private switchBusy = false;
  async switchContext(contextId: string): Promise<"switched" | "step-up" | "failed"> {
    // one switch at a time: a second tap while one is running would use the old place and file the current tab under the wrong workspace
    if (this.switchBusy) return "failed";
    this.switchBusy = true;
    try { return await this.switchOnce(contextId); } finally { this.switchBusy = false; }
  }
  private async switchOnce(contextId: string): Promise<"switched" | "step-up" | "failed"> {
    const info = this.state.session.info, target = findContext(info, contextId);
    if (!info || !target) { this.say("You don't have access to that.", false); return "failed"; }
    if (contextId === info.activeContextId) { this.deliver(); return "switched"; }
    this.set({ switching: target.workspace === "business" ? `Switching to ${target.label}...` : "Switching to Personal...", offer: null });
    try {
      await this.call("bank.session.switch", { contextId });
      if (this.deps.switchMs) await new Promise((r) => setTimeout(r, this.deps.switchMs));
    } catch (e: any) {
      this.set({ switching: null });
      if (e?.code === "STEP_UP_REQUIRED") { this.set({ stepUp: { contextId, phase: "password", busy: false } }); return "step-up"; }
      this.arriveAfter = null;
      // a bank that did not answer: nothing was applied, so the person says where they still are (README 2.3)
      const stay = findContext(info, info.activeContextId)?.label ?? "Personal";
      this.say(e?.code === "TIMEOUT" || e?.code === "SERVICE_UNAVAILABLE" ? `We couldn't switch. You are still in ${stay}. Try again.` : e?.message ?? "Could not switch", false);
      return "failed";
    }
    this.leave(info, target);
    await this.loadSession();
    this.set({ switching: null });
    this.deliver();
    return "switched";
  }
  /** Clears what belongs to the place being left, remembers its last tab and swaps the theme (the workspace). */
  private leave(info: SessionInfo, to: ContextInfo) {
    this.epoch++;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const from = workspaceOf(findContext(info, info.activeContextId)), next = workspaceOf(to);
    const lastTab = { ...this.state.prefs.lastTab, [from]: this.state.shellTab };
    this.pending = null;
    this.set({
      active: null, opening: null, sheet: null, subId: null, budgetId: null, investView: null, toast: null, stepUp: null, offer: null,
      search: "", filters: {}, drafts: {}, views: {}, readIds: [], workspace: next, shellTab: lastTab[next], prefs: { ...this.state.prefs, lastTab },
      screen: "app", session: { ...this.state.session, info: { ...info, activeContextId: to.id } }, tick: this.state.tick + 1,
    });
  }
  private deliver() { if (this.arriveAfter) { const link = this.arriveAfter; this.arriveAfter = null; this.set({ arrived: link }); } }
  clearArrived() { if (this.state.arrived) this.set({ arrived: null }); }

  /** The proof the customer gave in step 1, kept in memory only until the switch is done (the bank asks for it again with the code). */
  private stepUpProof: { method: "password" | "pin" | "biometric"; secret?: string } | null = null;

  /** Whether opening this journey needs a step-up that is not valid now (the shell asks first; the bank refuses the change without one). */
  needsStepUp(journey: string) { return journeyNeedsStepUp(journey) && !stepUpValid(this.state.session.info, this.now()); }
  /**
   * Asks the customer to confirm it is them before a sensitive journey (Change password, Trusted devices, ...). The proof is the one this device signs in
   * with: the quick PIN, or the phone's own check when it has one, else the password; then a one-time code. When it is done the app opens `then`.
   */
  async askStepUp(then: Link, reason: string) {
    if (this.state.stepUp) return;
    let method: "password" | "pin" | "biometric" = "password", biometric = false;
    try {
      const o = await this.call("bank.device.options");
      biometric = !!o.biometricAvailable && o.default === "biometric";
      method = o.default === "pin" && o.pinSet ? "pin" : biometric ? "biometric" : "password";
    } catch { /* the password is always there */ }
    this.set({ stepUp: { contextId: this.state.session.info?.activeContextId ?? "personal", phase: "password", busy: false, reason, then, method, biometric } });
  }
  /** After a right step-up: open the journey that asked, or finish the switch. */
  private async stepUpDone(su: NonNullable<StepUpState>) {
    this.stepUpProof = null;
    this.set({ stepUp: null });
    if (su.then) { await this.loadSession(); this.set({ arrived: su.then }); return; }
    await this.switchContext(su.contextId);
  }
  /** What a wrong password or PIN says: the tries left of the five the sign-in shares. */
  private triesText(e: any, what: string) {
    const left = typeof e?.attempt === "number" ? Math.max(0, ACCESS.maxFailedSignIns - e.attempt) : null;
    return left === null ? `That ${what} isn't right.` : `That ${what} isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`;
  }
  /** Step 1 of the confirmation: the password, PIN or biometric check first; only a right one makes the bank send a code. */
  async beginStepUp(input: { method?: "password" | "pin" | "biometric"; secret?: string } = {}) {
    const su = this.state.stepUp;
    if (!su) return;
    this.set({ stepUp: { ...su, busy: true, error: undefined } });
    const proof = { method: input.method ?? (su.method === "biometric" ? "password" : su.method) ?? "password", ...(input.secret !== undefined ? { secret: input.secret } : {}) } as const;
    try {
      await this.call("bank.session.stepUp", proof);
    } catch (e: any) {
      // the right password is answered "code needed": that is the way forward, and only now is a code sent
      if (e?.code === "OTP_REQUIRED") {
        try { await this.call("bank.otp.send"); } catch (err: any) { this.set({ stepUp: { ...su, busy: false, error: err?.message ?? "We couldn't send the code. Try again." } }); return; }
        this.stepUpProof = proof;
        this.set({ stepUp: { ...su, phase: "code", busy: false, error: undefined, phone: maskPhone(this.persona.phone) } });
        return;
      }
      // the last wrong try locks the profile: the person is signed out and the sign-in says so
      if (e?.code === "LOCKED") { this.cancelStepUp(); this.logout("locked"); return; }
      this.set({ stepUp: { ...su, busy: false, error: e?.code === "STEP_UP_FAILED" ? this.triesText(e, proof.method === "pin" ? "PIN" : "password") : e?.message ?? "That didn't work. Try again." } });
      return;
    }
    // already confirmed (a code was still valid): the switch can go ahead
    await this.stepUpDone(su);
  }
  /** Step 2: the one-time code. Done, the switch that asked for it finishes. */
  async confirmStepUp(code: string) {
    const su = this.state.stepUp, proof = this.stepUpProof;
    if (!su || !proof) return;
    this.set({ stepUp: { ...su, busy: true, error: undefined } });
    try {
      await this.call("bank.otp.verify", { code });
      await this.call("bank.session.stepUp", proof);
    } catch (e: any) {
      // the third wrong code ends the attempt: the sheet closes, the person stays where they were and starts again from the password
      if (e?.code === "OTP_INVALID" && (e.attempt ?? 0) >= 3) { this.cancelStepUp(); this.say("Too many wrong codes. Start again.", false); return; }
      if (e?.code === "LOCKED") { this.cancelStepUp(); this.logout("locked"); return; }
      this.set({ stepUp: { ...su, busy: false, error: e?.code === "OTP_INVALID" ? `That code isn't right. ${Math.max(0, 3 - (e.attempt ?? 0))} ${3 - (e.attempt ?? 0) === 1 ? "try" : "tries"} left.` : e?.message ?? "That didn't work. Try again." } });
      return;
    }
    await this.stepUpDone(su);
  }
  cancelStepUp() { this.stepUpProof = null; this.arriveAfter = null; this.set({ stepUp: null, switching: null }); }

  // ---- links ------------------------------------------------------------------------------------------------------
  /**
   * What to do with a link: "go" when it points into the place the customer is in, "offer" when it points into another one (the
   * app shows `offer` and the customer decides), "denied" when the customer has no such place.
   */
  followLink(link: Link): "go" | "offer" | "denied" {
    const info = this.state.session.info;
    if (!info || !findContext(info, linkContext(link))) { this.say("You don't have access to that.", false); return "denied"; }
    if (!needsSwitch(link, info.activeContextId)) return "go";
    this.set({ offer: link });
    return "offer";
  }
  /**
   * A link as the device gives it (a deep link, a tapped notification). Anything that is not one of ours is ignored; one that arrives
   * before the session is ready is held; otherwise it is followed as `followLink` says and, inside the place, opened.
   */
  receiveLink(input: string, scheme?: string): "ignored" | "held" | "go" | "offer" | "denied" {
    const link = parseLink(input, scheme);
    if (!link) return "ignored";
    if (this.state.session.status !== "ready") { this.heldLink = link; return "held"; }
    const r = this.followLink(link);
    if (r === "go") void this.applyLink(link);
    return r;
  }
  /** Opens what a link points at in the place the customer is in (for apps that keep the screen in this store). A journey the place may not use is refused here, as at every other way in. */
  async applyLink(link: Link) {
    if (link.journey === undefined) { this.setShellTab(link.tab); this.set({ screen: "app", active: null, opening: null, sub: link.sub ?? null }); return; }
    const ctx = this.context;
    if (!ctx || !journeyAllowed(link.journey, { context: ctx, entries: this.state.catalog.entries, settings: this.state.session.settings })) { this.say("This isn't available to you here.", false); return; }
    await this.openJourney(link.journey, undefined, launchFromValues(link.journey, link.values));
  }
  declineOffer() { this.set({ offer: null }); }
  /** The customer accepted: switch (with a step-up if the bank wants one), then `arrived` carries the link. */
  async acceptOffer() {
    const link = this.state.offer;
    if (!link) return;
    this.arriveAfter = link;
    this.set({ offer: null });
    await this.switchContext(linkContext(link));
  }

  // ---- tabs, preferences and cached screens ---------------------------------------------------------------------------
  setShellTab(tab: ShellTab) {
    if (!isTab(this.state.workspace, tab)) tab = FIRST_TAB[this.state.workspace];
    this.set({ shellTab: tab, search: "", filters: {}, prefs: { ...this.state.prefs, lastTab: { ...this.state.prefs.lastTab, [this.state.workspace]: tab } } });
  }
  setPrefs(patch: Partial<Prefs>) { this.set({ prefs: { ...this.state.prefs, ...patch } }); }
  setSearch(search: string) { this.set({ search }); }
  setFilter(key: string, value: string) { this.set({ filters: { ...this.state.filters, [key]: value } }); }
  /** A half-filled form of the place; cleared with everything else on a switch. */
  setDraft(key: string, values: Record<string, any>) { this.set({ drafts: { ...this.state.drafts, [key]: values } }); }

  /** Loads data for a screen once per place (and again on `force`), keeping the last answer while it reloads. An answer from a place the customer has since left is dropped. */
  loadView<T>(key: string, loader: () => Promise<T>, force = false): Promise<void> {
    const cur = this.state.views[key];
    if (!force && cur && cur.status !== "error") return this.inflight.get(key) ?? Promise.resolve();
    const epoch = this.epoch;
    this.set({ views: { ...this.state.views, [key]: { status: "loading", data: cur?.data } } });
    const done = loader().then(
      (data) => { if (epoch === this.epoch) this.set({ views: { ...this.state.views, [key]: { status: "ready", data } } }); },
      (e: any) => { if (epoch === this.epoch) this.set({ views: { ...this.state.views, [key]: { status: "error", data: cur?.data, error: e?.message ?? "Something went wrong", code: e?.code } } }); },
    ).finally(() => { if (this.inflight.get(key) === done) this.inflight.delete(key); });
    this.inflight.set(key, done);
    return done;
  }
  viewKey = (name: string) => `${this.state.session.info?.activeContextId ?? "none"}:${name}`;
  view<T = unknown>(name: string): ViewData<T> | undefined { return this.state.views[this.viewKey(name)] as ViewData<T> | undefined; }
  /** The data of a tab's screen in the active place. */
  loadShell(tab: ShellTab, force = false): Promise<void> {
    const ctx = this.context;
    if (!ctx) return Promise.resolve();
    return this.loadView<Screen>(this.viewKey(tab), () => loadScreen(this.call, ctx, tab), force);
  }
  /** A journey reached its end (a result screen): what it may have changed is read again now, not when the person closes it. At the moment that is the approvals count in a company. */
  journeyFinished() { if (this.state.workspace === "business" && this.state.session.status === "ready") void this.loadShell("approvals", true); }
  /** The approvals waiting for the person, as the badge on Approvals counts them (known once that screen's data has loaded). */
  get approvalsBadge(): number { return this.view<Screen>("approvals")?.data?.approvals ?? 0; }

  /**
   * Notifications of every place, tagged. They are made safe as they arrive (the active place's in full, the others as a pointer),
   * so the details of another place are never held in the app's state.
   */
  loadNotices(force = false) {
    const info = this.state.session.info;
    return this.loadView<ContextNotice[]>(this.viewKey("notices"), async () => noticesFor(Object.values((await this.call("bank.notifications.list")) ?? {}) as RawNotification[], info?.contexts ?? [], info?.activeContextId ?? ""), force);
  }
  notices(): ContextNotice[] {
    const read = new Set(this.state.readIds);
    return (this.view<ContextNotice[]>("notices")?.data ?? []).map((n) => (read.has(n.id) ? { ...n, read: true } : n));
  }
  markRead(id: string) { if (!this.state.readIds.includes(id)) this.set({ readIds: [...this.state.readIds, id] }); }

  // ---- launch points ------------------------------------------------------------------------------------------------
  /** The buttons for a place (or the + quick actions): what the active place's permissions allow, that this app has and the bank has not switched off. */
  launchPoints(filter: { place?: string; quick?: boolean } = {}): LaunchPoint[] {
    return launchPointsFor({ context: this.context, entries: this.state.catalog.entries, settings: this.state.session.settings }, filter);
  }
  /** The journey to open and its starting values for a button, with the values the place passed in. */
  launchTarget(lp: LaunchPoint, passed: Record<string, unknown> = {}) {
    const slug = entryFor(lp.journey, this.state.catalog.entries) ?? lp.journey, values = launchValues(lp, passed);
    // `values` are plain names (an address carries them); `launch` is what the engine takes
    return { slug, values, launch: launchFromValues(slug, values) };
  }

  // ---- Settings > Security ------------------------------------------------------------------------------------------
  openSub(sub: NonNullable<AppState["sub"]>) { this.set({ sub }); }
  closeSub() { this.set({ sub: null }); }
  /** The password row, the sign-in methods and the devices of this customer. */
  loadSecurityView(force = false) { return this.loadView<SecurityVm>(this.viewKey("security"), () => loadSecurity(this.call), force); }
  securityView() { return this.view<SecurityVm>("security"); }
  /** The login history for these filters (cached per place and filters; a change of filters is a new key). */
  historyKey = (q: HistoryQuery) => `history:${q.result}:${q.days}:${q.deviceId}:${q.order}:${q.page}`;
  loadHistoryView(q: HistoryQuery, deviceId: string, force = false) { return this.loadView<History>(this.viewKey(this.historyKey(q)), () => loadHistory(this.call, q, deviceId, Date.now()), force); }
  historyView(q: HistoryQuery) { return this.view<History>(this.historyKey(q)); }
  /**
   * Turns biometrics off for this device (it only makes sign-in stricter, so no step-up): the PIN if one is set, else the password. A failure
   * leaves the toggle where it was and says so.
   */
  async biometricsOff() {
    const before = this.securityView()?.data;
    try {
      await this.call("bank.device.setDefault", { mode: before?.quickPin.set ? "pin" : "password" });
      this.say("Biometrics turned off.");
    } catch (e: any) {
      this.say(e?.code === "TIMEOUT" ? "This is taking longer than expected. Nothing was changed." : e?.code === "SERVICE_UNAVAILABLE" ? "This isn't available right now. Nothing was changed." : e?.message ?? "Nothing was changed.", false);
    }
    await this.loadSecurityView(true);
  }

  // ---- notices -----------------------------------------------------------------------------------------------------
  say(text: string, ok = true) {
    if (this.timer) clearTimeout(this.timer);
    this.set({ toast: { text, ok } });
    this.timer = setTimeout(() => { this.timer = null; this.set({ toast: null }); }, this.deps.toastMs ?? 3200);
  }
  /** Stops the pending notice timer. Listeners are left alone: React may unmount and remount an effect without the app going away. */
  dispose() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.stopIdle(); }
}
