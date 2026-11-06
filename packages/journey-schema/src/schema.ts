import { z } from "zod";

export const LocalizedText = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]);
export type LocalizedText = z.infer<typeof LocalizedText>;

export const Action: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("validate") }),
    z.object({
      type: z.literal("navigate"), to: z.string().optional(),
      /** Opens another journey (by its slug) in place of this one. A navigation rule of the screen that matches still wins. */
      toJourney: z.string().optional(),
      /** Values for the other journey, by data path. A value may be a {{template}} read from this journey's data. */
      with: z.record(z.string(), z.any()).optional(),
      /** Reserved: the calling journey is replaced, so nothing comes back to this screen yet. */
      returnTo: z.string().optional(),
    }),
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
    /**
     * Shares a receipt of this screen: printed on the web, the share sheet on a phone. `template` names the kind (receipt).
     * The receipt has `title` (default: the result's title or the screen's), then `rows` (labels and values, may use {{templates}});
     * without rows it takes the screen's review rows and the result's text and reference line.
     */
    z.object({ type: z.literal("share"), template: z.string(), title: LocalizedText.optional(), rows: z.array(z.object({ label: LocalizedText, value: LocalizedText })).optional() }),
    z.object({ type: z.literal("exit") }),
  ]),
);

const base = { id: z.string().optional(), visibleWhen: z.string().optional() };
const StatusTone = z.enum(["positive", "warning", "negative", "info", "neutral"]);
/** Per status value: the words and the tone to show instead of the defaults. */
const StatusMap = z.record(z.string(), z.object({ label: LocalizedText.optional(), tone: StatusTone.optional() }));

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
    variant: z.enum(["chips", "tiles", "rows", "dropdown"]).optional(),
    /** Richer fixed options with an icon and a line of help. Used instead of options when present. */
    choices: z.array(z.object({ id: z.string(), label: LocalizedText, icon: z.string().optional(), text: LocalizedText.optional() })).optional(),
  }),
  z.object({
    ...base, type: z.literal("textInput"), bind: z.string(), label: LocalizedText, placeholder: LocalizedText.optional(),
    keyboard: z.enum(["default", "number", "phone", "email"]).optional(), secure: z.boolean().optional(),
    /** Several lines of text (rows pasted from a file, a note): the height of the box in lines. */
    lines: z.number().int().min(2).max(12).optional(), pattern: z.string().optional(), patternMessage: LocalizedText.optional(),
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
  /**
   * A pop-up over the screen, shown while its `visibleWhen` is true (open it with a setData on a flag, close it the same way).
   * It asks one thing: a PIN (`bind` and `length`), a fingerprint unlock, a call, a confirmation. Its buttons run actions like any button.
   */
  z.object({ ...base, type: z.literal("dialog"), title: LocalizedText, text: LocalizedText.optional(), icon: z.string().optional(), bind: z.string().optional(), length: z.number().int().min(4).max(8).optional(), buttons: z.array(z.object({ label: LocalizedText, variant: z.enum(["primary", "secondary", "ghost"]).optional(), actions: z.array(Action) })).min(1).max(3), dismiss: z.array(Action).optional() }),
  /**
   * A schematic map of the places in a list (`source`: records with `id`, `name`, `lat`, `lng`). Pressing a pin saves its id in
   * `bind` (when given) and runs `onSelect`, where {{item.x}} reads that place. It draws pins on a grid, not streets.
   */
  z.object({ ...base, type: z.literal("map"), source: z.string(), label: LocalizedText, bind: z.string().optional(), onSelect: z.array(Action).optional(), height: z.number().int().min(120).max(400).optional() }),
  /**
   * A date with a calendar. The answer is saved as YYYY-MM-DD. `min` and `max` are a date or the word "today"
   * (a birth date has max "today"); `messages` replace the built-in "too early" and "too late" texts.
   */
  z.object({ ...base, type: z.literal("dateInput"), bind: z.string(), label: LocalizedText, placeholder: LocalizedText.optional(), helper: LocalizedText.optional(), min: z.string().optional(), max: z.string().optional(), messages: z.object({ min: LocalizedText.optional(), max: LocalizedText.optional() }).optional() }),
  /** A person's initials in a circle, with their name and a line under it (for example the profile found when signing in). */
  z.object({ ...base, type: z.literal("avatar"), name: LocalizedText, text: LocalizedText.optional() }),
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
  /**
   * A word for where something stands, with a colour and an icon (never the colour alone). `status` is a value or a {{template}} such as
   * {{payment.status}}; known words (paid, pending_approval, rejected…) get a tone and a readable label, `statuses` replaces either per value.
   */
  z.object({ ...base, type: z.literal("statusChip"), status: z.string(), label: LocalizedText.optional(), tone: StatusTone.optional(), statuses: StatusMap.optional() }),
  /**
   * What happened and what is still to come, top to bottom. Fixed `items`, or one entry per row of a saved list (`source`, drawn from the
   * `item` template where {{item.x}} reads that row). `state` is done (default), current, upcoming or failed; it may be a {{template}}.
   */
  z.object({
    ...base, type: z.literal("timeline"), label: LocalizedText.optional(),
    items: z.array(z.object({ id: z.string(), title: LocalizedText, text: LocalizedText.optional(), time: LocalizedText.optional(), state: z.string().optional(), visibleWhen: z.string().optional() })).optional(),
    source: z.string().optional(),
    item: z.object({ title: LocalizedText, text: LocalizedText.optional(), time: LocalizedText.optional(), state: z.string().optional() }).optional(),
  }),
  /**
   * A list of records as a table: sort by a heading, search, filter chips, pages and (with `bind`) ticked rows saved as a list of ids.
   * On a phone it is a list of cards. `source` is a list or record of rows; a row's id is its `rowKey` (default id).
   * A column reads one key of the row; `type` decides how it is written and ordered (money needs `currency` or `currencyKey`).
   */
  z.object({
    ...base, type: z.literal("dataTable"), source: z.string(), label: LocalizedText,
    columns: z.array(z.object({
      key: z.string(), label: LocalizedText, type: z.enum(["text", "number", "money", "date", "status"]).optional(),
      currency: z.string().optional(), currencyKey: z.string().optional(), sortable: z.boolean().optional(), filter: z.boolean().optional(), align: z.enum(["start", "end"]).optional(),
      statuses: StatusMap.optional(),
    })).min(1),
    rowKey: z.string().optional(), search: z.boolean().optional(), pageSize: z.number().int().min(1).max(200).optional(),
    sort: z.object({ key: z.string(), dir: z.enum(["asc", "desc"]).optional() }).optional(),
    /** Ticking rows: the ids of the ticked rows are saved here. `maxSelected` stops further ticks. */
    bind: z.string().optional(), maxSelected: z.number().int().min(1).optional(),
    /** With ticking: "3 selected · total $1,200.00", the sum of one money column in one currency (a code or a {{path}}). */
    total: z.object({ key: z.string(), currency: z.string() }).optional(),
    /** Run when a row is opened (click or tap); {{item.x}} reads that row. */
    onRowPress: z.array(Action).optional(),
    empty: LocalizedText.optional(),
  }),
  /**
   * A drawing of a saved list: a smooth line (one `series` shown at a time, or all as a table) or a ring (the first series as shares).
   * `x` is the key of each row's label, `xFormat: "date"` writes it as 9 Nov. `currency` makes the numbers money. `table` adds a "Show as table" switch.
   */
  z.object({
    ...base, type: z.literal("chart"), kind: z.enum(["line", "donut"]), source: z.string(), label: LocalizedText,
    x: z.string().optional(), xLabel: LocalizedText.optional(), xFormat: z.enum(["text", "date"]).optional(),
    series: z.array(z.object({ key: z.string(), label: LocalizedText })).min(1),
    currency: z.string().optional(), table: z.boolean().optional(), height: z.number().int().min(80).max(400).optional(),
  }),
  /**
   * Chooses a file: csv, xml, pdf or an image. The answer saved at `bind` is { name, size, kind } and, for csv and xml, `content` (the text),
   * so a bank call can check the rows. Pictures and PDFs are not kept. `maxKb` replaces the usual limit (256 KB for csv and xml, 10 MB for the rest).
   */
  z.object({ ...base, type: z.literal("fileUpload"), bind: z.string(), label: LocalizedText, accept: z.array(z.enum(["csv", "xml", "pdf", "image"])).min(1), maxKb: z.number().int().min(1).optional(), helper: LocalizedText.optional() }),
  /**
   * A text to read to the end (terms, an agreement). `text` has paragraphs separated by a blank line and "## " headings. `bind` becomes true when the person
   * has scrolled to the bottom; a screen with an unread document does not validate. Pair it with a consent block for the tick.
   */
  z.object({ ...base, type: z.literal("documentViewer"), bind: z.string(), title: LocalizedText, text: LocalizedText, height: z.number().int().min(120).max(600).optional() }),
  /**
   * A signature, drawn or typed (`modes`, both by default; typing is the one a keyboard can use). Saved at `bind` as { mode, name } or { mode, path, points }.
   * `expectedName` (a {{template}} such as the person's name) makes a typed signature match it. Pair it with an otp block for the code.
   */
  z.object({ ...base, type: z.literal("signature"), bind: z.string(), label: LocalizedText, modes: z.array(z.enum(["type", "draw"])).min(1).optional(), expectedName: z.string().optional(), helper: LocalizedText.optional() }),
  /**
   * A simulated capture of an identity document and a selfie: a button per step "takes" a picture (no camera, nothing is kept). Saved at `bind` as
   * { front: { ref }, selfie: { ref } }. `steps` is front, back, selfie (front and selfie by default); every step must be captured.
   */
  z.object({ ...base, type: z.literal("idCapture"), bind: z.string(), label: LocalizedText, steps: z.array(z.enum(["front", "back", "selfie"])).min(1).optional() }),
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
    /** For a customer with several places to bank from: the one to be working in when the walk starts (for example "alpha"), switched into with the step-up before setup runs. */
    context: z.string().optional(),
    /** The sandbox clock, as an ISO time, for rules that depend on it (a cut-off). */
    now: z.string().optional(),
    /**
     * Things that go wrong in the sandbox on purpose: adapters that time out or are unavailable, how slow the slow ones are,
     * accounts that are frozen, a core that fails after the code. Nothing in the apps sets these.
     */
    conditions: z.object({
      timeout: z.array(z.string()).optional(), unavailable: z.array(z.string()).optional(), latencyMs: z.number().int().nonnegative().optional(),
      empty: z.array(z.string()).optional(), frozen: z.array(z.string()).optional(), transferFails: z.boolean().optional(), limitUsed: z.number().nonnegative().optional(), closedDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
      /** The device a sign-in comes from, and how long a session may stay quiet before it ends (seconds). */
      device: z.enum(["known", "new", "unusual", "browser"]).optional(), idleTimeoutSeconds: z.number().int().positive().optional(),
      /** Personal permissions the person lacks (for example payments.create): the bank refuses what needs them. */
      withoutPermissions: z.array(z.string()).optional(),
    }).optional(),
    /** How the bank is set up for this scenario: its options per journey (for example { "sign-in": { forceExpiry: false } }). */
    config: z.object({ options: z.record(z.string(), z.record(z.string(), z.unknown())).optional(), /** The bank's home market (us, uk, eu, ae, sa, jo): the numbers, addresses and postcodes it shows. */ homeMarket: z.enum(["us", "uk", "eu", "ae", "sa", "jo"]).optional(), /** Journey slugs the bank has switched off (a view draws no button to them). */ disabled: z.array(z.string()).optional() }).optional(),
    /** Values the journey is opened with, by data path (as when another journey opens it, or an app deep link): they are there before the entry screen runs. */
    launch: z.record(z.string(), z.unknown()).optional(),
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
