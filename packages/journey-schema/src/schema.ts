import { z } from "zod";

export const LocalizedText = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]);
export type LocalizedText = z.infer<typeof LocalizedText>;

export const Action: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("validate") }),
    z.object({ type: z.literal("navigate"), to: z.string().optional(), toJourney: z.string().optional(), returnTo: z.string().optional() }),
    z.object({ type: z.literal("setData"), path: z.string(), value: z.any() }),
    z.object({
      type: z.literal("callApi"),
      integration: z.string(),
      input: z.record(z.string(), z.any()).optional(),
      saveAs: z.string().optional(),
      onError: z.object({
        navigate: z.string().optional(),
        showToast: LocalizedText.optional(),
        stay: z.boolean().optional(),
        lockAfter: z.number().optional(),
        lockTo: z.string().optional(),
      }).optional(),
    }),
    z.object({ type: z.literal("showToast"), text: LocalizedText }),
    z.object({ type: z.literal("share"), template: z.string() }),
    z.object({ type: z.literal("exit") }),
  ]),
);

const base = { id: z.string().optional(), visibleWhen: z.string().optional() };

export const Block = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("text"), text: LocalizedText, variant: z.enum(["title", "body", "caption"]).optional() }),
  z.object({ ...base, type: z.literal("stepper"), steps: z.array(z.string()) }),
  z.object({ ...base, type: z.literal("accountPicker"), bind: z.string(), source: z.string(), showBalance: z.boolean().optional(), filter: z.string().optional() }),
  z.object({ ...base, type: z.literal("beneficiaryPicker"), bind: z.string(), source: z.string(), allowAddNew: z.boolean().optional(), addNewJourney: z.string().optional() }),
  z.object({
    ...base, type: z.literal("amountInput"), bind: z.string(), currency: z.string(), label: LocalizedText.optional(),
    helper: LocalizedText.optional(),
    /** One-tap amounts shown under the field, for example [50, 100, 150, 200]. */
    quickAmounts: z.array(z.number()).optional(),
    validation: z.object({ min: z.union([z.number(), z.string()]).optional(), max: z.union([z.number(), z.string()]).optional(), messages: z.record(z.string(), LocalizedText).optional() }).optional(),
  }),
  z.object({
    ...base, type: z.literal("select"), bind: z.string(), label: LocalizedText, options: z.array(z.string()).optional(), source: z.string().optional(),
    /** chips (default) are small pills. tiles are larger cards, good for banks or account types. */
    variant: z.enum(["chips", "tiles", "rows"]).optional(),
    /** Richer fixed options with an icon and a line of help. Used instead of options when present. */
    choices: z.array(z.object({ id: z.string(), label: LocalizedText, icon: z.string().optional(), text: LocalizedText.optional() })).optional(),
  }),
  z.object({
    ...base, type: z.literal("textInput"), bind: z.string(), label: LocalizedText, placeholder: LocalizedText.optional(),
    keyboard: z.enum(["default", "number", "phone", "email"]).optional(), secure: z.boolean().optional(), pattern: z.string().optional(), patternMessage: LocalizedText.optional(),
  }),
  z.object({
    ...base, type: z.literal("toggle"), bind: z.string(), label: LocalizedText, helper: LocalizedText.optional(),
    /** A link at the start of the same row ("Can't sign in?" beside "Remember me"). */
    link: z.object({ label: LocalizedText, actions: z.array(Action) }).optional(),
  }),
  /** Card number, name, expiry and security code with a live card picture. bind is the object the four fields are saved in. */
  z.object({ ...base, type: z.literal("cardForm"), bind: z.string() }),
  z.object({ ...base, type: z.literal("alert"), tone: z.enum(["info", "warning", "error", "success"]), text: LocalizedText }),
  z.object({ ...base, type: z.literal("reviewSummary"), rows: z.array(z.object({ label: LocalizedText, value: LocalizedText })) }),
  z.object({
    ...base, type: z.literal("consent"), bind: z.string(), termsVersion: z.string(), text: LocalizedText,
    validation: z.object({ mustBeTrue: z.boolean().optional(), messages: z.record(z.string(), LocalizedText).optional() }).optional(),
  }),
  z.object({
    ...base, type: z.literal("otp"), bind: z.string(), length: z.number().int().min(4).max(8), maxAttempts: z.number().int().optional(),
    resendAfterSeconds: z.number().int().optional(), hint: LocalizedText.optional(), onResend: z.array(Action).optional(),
    /** Draw a number pad under the code instead of using the device keyboard. */
    keypad: z.boolean().optional(),
    /** Show dots instead of the digits, for a PIN. */
    masked: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal("result"), tone: z.enum(["success", "error"]), title: LocalizedText, text: LocalizedText.optional(), meta: LocalizedText.optional() }),
  /** A banner with the bank's logo at the top of a screen. The bank decides how it looks. */
  z.object({ ...base, type: z.literal("hero") }),
  /** A bold heading with an optional link on the same row, for example "Welcome" and the language. */
  /** A thin line between groups, with an optional word in the middle ("OR"). */
  z.object({ ...base, type: z.literal("divider"), label: LocalizedText.optional() }),
  /** Read-only rows of accounts: name and number, a type tag, the balance and a note under it. `source` is a path to the accounts (a list or a record). */
  z.object({ ...base, type: z.literal("balanceList"), source: z.string() }),
  /** Questions that open to show their answer, one at a time. */
  z.object({ ...base, type: z.literal("accordion"), items: z.array(z.object({ id: z.string(), title: LocalizedText, text: LocalizedText })).min(1) }),
  z.object({ ...base, type: z.literal("sectionHeader"), title: LocalizedText, subtitle: LocalizedText.optional(), action: z.object({ label: LocalizedText, actions: z.array(Action) }).optional() }),
  /** A row of icon buttons, for example Enroll, Locate us and Support at the bottom of a sign-in screen. */
  z.object({ ...base, type: z.literal("shortcuts"), items: z.array(z.object({ id: z.string(), label: LocalizedText, icon: z.string().optional(), actions: z.array(Action) })) }),
  /** A list of rows that each do something when tapped, with an optional icon and a line of help. */
  z.object({
    ...base, type: z.literal("menu"),
    /** Fixed rows. */
    items: z.array(z.object({ id: z.string(), label: LocalizedText, text: LocalizedText.optional(), icon: z.string().optional(), actions: z.array(Action) })).optional(),
    /** Or one row per entry of a saved list (a path such as loc.found), drawn from the `item` template: {{item.name}} in its texts and actions reads that entry. */
    source: z.string().optional(),
    item: z.object({ label: LocalizedText, text: LocalizedText.optional(), icon: z.string().optional(), actions: z.array(Action) }).optional(),
  }),
  z.object({ ...base, type: z.literal("button"), label: LocalizedText, variant: z.enum(["primary", "secondary", "ghost"]).optional(), actions: z.array(Action) }),
]);
export type Block = z.infer<typeof Block>;

export const Screen = z.object({
  id: z.string(),
  title: LocalizedText,
  kind: z.enum(["screen", "branch", "terminal"]).optional(),
  onEnter: z.array(Action).optional(),
  blocks: z.array(Block),
  navigation: z.object({
    rules: z.array(z.object({ when: z.string(), to: z.string() })).optional(),
    default: z.string().optional(),
  }).optional(),
});
export type Screen = z.infer<typeof Screen>;

export const Journey = z.object({
  id: z.string(),
  slug: z.string(),
  name: LocalizedText,
  version: z.number().int(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  channels: z.array(z.enum(["web", "mobile"])),
  /** Which bank apps show this journey (for example ["bankworkx"]). Empty or missing means the original Meezan app. */
  apps: z.array(z.string()).optional(),
  locale: z.object({ default: z.string(), supported: z.array(z.string()), rtl: z.array(z.string()).optional() }),
  entryScreen: z.string(),
  /** What must be true for the journey to be right: each criterion has an id (AC-1 …) that scenarios say they cover. */
  acceptance: z.array(z.object({ id: z.string().regex(/^AC-[0-9]{1,3}$/, "must look like AC-1"), text: z.string().min(1) })).optional(),
  /**
   * Executable tests that travel with the journey. Each is a scripted walk through it (the steps of finx_simulate_journey) against
   * the sandbox bank, says which criteria it covers, and may prepare the bank first (setup) and fix its clock (now).
   */
  scenarios: z.array(z.object({
    id: z.string().regex(/^T-[0-9]{1,3}$/, "must look like T-1"), name: z.string().min(1), covers: z.array(z.string()).default([]),
    persona: z.string().min(1), lang: z.string().optional(),
    /** Which bank API stands behind the corporate adapters: reference (default) or bank-b. */
    provider: z.string().optional(),
    /** The sandbox clock, as an ISO time, for rules that depend on it (a cut-off). */
    now: z.string().optional(),
    /** Calls made on the bank before the walk starts, for example a payment waiting for approval. */
    setup: z.array(z.object({ adapter: z.string(), input: z.record(z.string(), z.unknown()).optional(), saveAs: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/).optional() })).optional(),
    steps: z.array(z.record(z.string(), z.unknown())).min(1),
  })).optional(),
  /**
   * Who may use the journey: a role, read from the data once the person is known (rolesFrom is a path to a list of role names).
   * When the list is loaded and does not include the role, the person is sent to deniedScreen. Needed by journeys that move
   * money for a company.
   */
  authorisation: z.object({ role: z.string().min(1), rolesFrom: z.string().min(1), deniedScreen: z.string().min(1) }).optional(),
  dataModel: z.record(z.string(), z.object({ type: z.string(), required: z.boolean().optional(), currency: z.string().optional(), pattern: z.string().optional() })).optional(),
  integrations: z.array(z.object({ id: z.string(), adapter: z.string(), mode: z.enum(["sandbox", "live"]) })),
  screens: z.array(Screen).min(1),
});
export type Journey = z.infer<typeof Journey>;
