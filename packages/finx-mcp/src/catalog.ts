import { ADAPTER_CATALOG, describePersonas } from "@finx/mock-bank-api";

/**
 * The reference an AI agent reads before authoring a journey. It documents what the engine really does today,
 * including the limits. catalog.test.ts checks it against the schema and the lint source so it cannot drift.
 */

export const SECTIONS = ["all", "overview", "journey", "blocks", "actions", "expressions", "data", "localization", "adapters", "personas", "lint", "patterns"] as const;
export type Section = (typeof SECTIONS)[number];

export const SKELETON = {
  id: "jrn_example",
  slug: "example",
  name: { en: "Example", ur: "مثال" },
  version: 0,
  status: "draft",
  channels: ["web", "mobile"],
  locale: { default: "en", supported: ["en", "ur"], rtl: ["ur"] },
  entryScreen: "welcome",
  dataModel: {},
  integrations: [],
  screens: [
    { id: "welcome", title: { en: "Example", ur: "مثال" }, blocks: [
      { type: "text", variant: "title", text: { en: "Example", ur: "مثال" } },
      { type: "button", label: { en: "Continue", ur: "جاری رکھیں" }, variant: "primary", actions: [{ type: "navigate", to: "done" }] },
    ] },
    { id: "done", title: { en: "Done", ur: "مکمل" }, kind: "terminal", blocks: [
      { type: "result", tone: "success", title: { en: "All done", ur: "سب مکمل" } },
      { type: "button", label: { en: "Close", ur: "بند کریں" }, variant: "primary", actions: [{ type: "exit" }] },
    ] },
  ],
};

type BlockDoc = { type: string; purpose: string; fields: Record<string, string>; notes?: string[]; example: Record<string, unknown> };

export const BLOCKS: BlockDoc[] = [
  { type: "text", purpose: "A heading or a paragraph.", fields: { text: "Loc (required)", variant: "title | body | caption (default body)" }, example: { type: "text", variant: "title", text: { en: "Pay a bill", ur: "بل ادا کریں" } } },
  {
    type: "stepper", purpose: "Progress bar and \"Step X of N\" for a multi-step journey.", fields: { steps: "screen ids in order" },
    notes: ["Declare it once, on the first screen. It then shows on every screen listed in steps. It renders nothing itself on other screens.", "Use it when there are 3 or more steps. Do not list branch or terminal screens."],
    example: { type: "stepper", steps: ["bill", "review", "otp"] },
  },
  {
    type: "accountPicker", purpose: "Choose one of the customer's accounts.", fields: { bind: "data path that receives the account id", source: "a ctx path saved by callApi, normally ctx.accounts", showBalance: "boolean", filter: "optional expression using `account`, e.g. account.canDebit" },
    notes: ["Needs the accounts integration to be called with saveAs ctx.accounts before the screen is shown (onEnter)."],
    example: { type: "accountPicker", bind: "bill.fromAccountId", source: "ctx.accounts", showBalance: true },
  },
  {
    type: "beneficiaryPicker", purpose: "Choose a saved payee.", fields: { bind: "data path for the beneficiary id", source: "normally ctx.beneficiaries", allowAddNew: "boolean, shows an \"Add new\" link (not wired to a journey yet)" },
    example: { type: "beneficiaryPicker", bind: "transfer.beneficiaryId", source: "ctx.beneficiaries", allowAddNew: true },
  },
  {
    type: "amountInput", purpose: "Money amount, stored as a number.", fields: { bind: "data path", currency: "e.g. PKR", label: "Loc", helper: "Loc, may use {{templates}}", quickAmounts: "optional list of numbers shown as one-tap chips, e.g. [50, 100, 150, 200]", validation: "{ min?, max?, messages?: { min?: Loc, max?: Loc } }. min and max are a number or an expression string; messages replace the default error texts." },
    notes: ["If an amount is entered it must be greater than 0. An empty amount is only rejected when dataModel marks the path required: true, so always do that. Use max for balance or limit checks, e.g. \"ctx.accounts[transfer.fromAccountId].balance\"."],
    example: { type: "amountInput", bind: "topup.amount", currency: "PKR", label: { en: "Amount", ur: "رقم" }, validation: { min: 50, max: 5000, messages: { min: { en: "The least you can top up is PKR 50", ur: "کم از کم ٹاپ اپ PKR 50 ہے" }, max: { en: "The most you can top up is PKR 5,000", ur: "زیادہ سے زیادہ ٹاپ اپ PKR 5,000 ہے" } } } },
  },
  {
    type: "select", purpose: "Pick one option, shown as chips.", fields: { bind: "data path", label: "Loc", options: "fixed list of strings (the value is the text)", choices: "OR a fixed list of { id, label: Loc, icon?, text?: Loc } for tiles with an icon and a line of help. Icons: bank, card, food, bag, trend, shield, wallet, repeat, dollar, home, briefcase", source: "OR a ctx path of an object map whose values have { id, name, color?, sub? } (the value is the id)", variant: "chips (default), tiles (larger cards, good for banks or account types) rows (a plain list with a tick on the chosen row, good for languages) or dropdown (one line that opens a list, good for a long list or a few names)" },
    notes: ["Use source for data from the bank (billers, carriers). Use options only for short fixed lists. Use variant tiles with choices for a short list of big options."],
    example: { type: "select", bind: "topup.carrier", label: { en: "Carrier", ur: "کیریئر" }, source: "ctx.carriers" },
  },
  {
    type: "textInput", purpose: "Free text such as a mobile number or reference.", fields: { bind: "data path", label: "Loc", placeholder: "Loc", keyboard: "default | number | phone | email", lines: "2 to 12: a taller box for several lines of text, such as rows pasted from a file", secure: "true hides what is typed, with a Show button (passwords)", pattern: "JavaScript regular expression, matched against the whole value. Use ^ and $.", patternMessage: "Loc shown when the value does not match" },
    notes: ["Mark the field required: true in dataModel, otherwise an empty value is accepted."],
    example: { type: "textInput", bind: "bill.reference", label: { en: "Consumer number", ur: "کنزیومر نمبر" }, placeholder: { en: "10 to 14 digits", ur: "10 سے 14 ہندسے" }, keyboard: "number", pattern: "^[0-9]{10,14}$", patternMessage: { en: "Enter 10 to 14 digits", ur: "10 سے 14 ہندسے درج کریں" } },
  },
  { type: "alert", purpose: "A highlighted message.", fields: { tone: "info | warning | error | success", text: "Loc, may use {{templates}}" }, example: { type: "alert", tone: "warning", text: { en: "PKR {{transfer.amount | money}} is above your remaining daily limit.", ur: "PKR {{transfer.amount | money}} آپ کی بقیہ یومیہ حد سے زیادہ ہے۔" } } },
  {
    type: "reviewSummary", purpose: "A read-only list of label and value rows, for the confirmation step.", fields: { rows: "[{ label: Loc, value: Loc }]. Values may use {{templates}}." },
    example: { type: "reviewSummary", rows: [{ label: { en: "Biller", ur: "بل جاری کرنے والا" }, value: "{{ctx.bill.billerName}}" }, { label: { en: "Amount due", ur: "واجب الادا رقم" }, value: "PKR {{ctx.bill.amount | money}}" }] },
  },
  {
    type: "consent", purpose: "A checkbox the customer must tick before money moves.", fields: { bind: "boolean data path", termsVersion: "e.g. transfers-v3", text: "Loc", validation: "{ mustBeTrue: true, messages: { mustBeTrue: Loc } }" },
    notes: ["It is only enforced when validation.mustBeTrue is true. Always set it."],
    example: { type: "consent", bind: "bill.consent", termsVersion: "bills-v2", text: { en: "I confirm I want to pay this bill", ur: "میں اس بل کی ادائیگی کی تصدیق کرتا/کرتی ہوں" }, validation: { mustBeTrue: true, messages: { mustBeTrue: { en: "Tick the confirmation first", ur: "پہلے تصدیق کریں" } } } },
  },
  {
    type: "toggle", purpose: "An on/off switch for a yes-or-no choice that is not a legal confirmation.", fields: { bind: "boolean data path", label: "Loc", helper: "Loc", link: "optional { label: Loc, actions } shown at the other end of the same row, e.g. \"Can't sign in?\" beside Remember me" },
    notes: ["Use consent, not toggle, for anything the customer must agree to. A toggle is never required."],
    example: { type: "toggle", bind: "budget.alert", label: { en: "Alert me at 80%" }, helper: { en: "We will tell you when you are close to the limit" } },
  },
  {
    type: "cardForm", purpose: "Card number, name, expiry and security code with a live card picture. Checks each field.", fields: { bind: "an object path; the form saves number, holder, expiry and cvv under it" },
    notes: ["Declare the bind and each of bind.number, bind.holder, bind.expiry and bind.cvv in dataModel. The button's validate action checks the number (Luhn), name, expiry (MM/YY, not past) and code, and shows one error per field. Send the values to bank.cards.add."],
    example: { type: "cardForm", bind: "card" },
  },
  {
    type: "otp", purpose: "One-time code entry.", fields: { bind: "data path, normally otp.code", length: "4 to 8 digits", hint: "Loc, e.g. \"Enter the code sent to {{ctx.otp.maskedPhone}}\"", maxAttempts: "informational only today", resendAfterSeconds: "informational only today", onResend: "actions, not run by the UI yet", keypad: "true shows a number pad (good for a PIN)", masked: "true shows dots instead of digits" },
    notes: ["The attempt limit is enforced by the verify call: put lockAfter and lockTo in its onError (see the otp pattern). The integration must be named exactly otpVerify for failures to be counted.", "Mark otp.code required: true in dataModel so an empty code is caught before the call."],
    example: { type: "otp", bind: "otp.code", length: 6, hint: { en: "Enter the code sent to {{ctx.otp.maskedPhone}}", ur: "{{ctx.otp.maskedPhone}} پر بھیجا گیا کوڈ درج کریں" } },
  },
  {
    type: "hero", purpose: "A banner with the bank's logo at the top of a screen. Only banks with a brand logo show one; otherwise nothing is drawn.", fields: {},
    notes: ["Use once, as the first block of the first screen."],
    example: { type: "hero" },
  },
  {
    type: "sectionHeader", purpose: "A bold heading with an optional link on the same row.", fields: { title: "Loc", subtitle: "optional Loc, a quieter line under the title", action: "optional { label: Loc, actions } shown at the end of the row, e.g. the language" },
    example: { type: "sectionHeader", title: { en: "Welcome" }, action: { label: { en: "English" }, actions: [{ type: "navigate", to: "language" }] } },
  },
  {
    type: "balanceList", purpose: "Read-only account rows: name and number, a type tag, the balance and a note under it, such as the account preview before sign in.", fields: { source: "path to the accounts: a list or a record of { id, name, maskedNumber?, type?, balance, currency, note? }" },
    example: { type: "balanceList", source: "ctx.previewAccounts" },
  },
  {
    type: "divider", purpose: "A thin line between groups, with an optional word in the middle such as OR.", fields: { label: "optional Loc" },
    example: { type: "divider", label: { en: "OR", ar: "أو" } },
  },
  {
    type: "dateInput", purpose: "A date with a calendar under the field. Saved as YYYY-MM-DD, shown as DD / MM / YYYY. Use it instead of a typed date; show it with {{x | date}}.",
    fields: { bind: "path", label: "Loc", placeholder: "Loc?", helper: "Loc?", min: "date, \"today\" or a {{path}} to another date?", max: "date, \"today\" or a {{path}}? (birth date: today; the end of a range: min is the start)", messages: "{ min, max } Loc?" },
    example: { type: "dateInput", bind: "enroll.dob", label: { en: "Date of birth" }, max: "today" },
  },
  {
    type: "avatar", purpose: "A circle with a person's initials, their name and a line under it (the profile found while signing in, for example).",
    fields: { name: "Loc", text: "Loc, optional (such as a username)" }, example: { type: "avatar", name: { en: "{{recover.result.firstName}} {{recover.result.lastName}}" }, text: { en: "{{recover.result.username}}" } },
  },
  {
    type: "dialog", purpose: "A pop-up asking one thing (PIN, unlock, call, confirmation). Shown while its visibleWhen is true: open and close it with setData on a flag such as ui.confirm.",
    fields: { title: "Loc", text: "Loc?", icon: "lock, phone or shield?", bind: "PIN field path?", length: "PIN length 4-8 (6)", buttons: "1-3 of { label: Loc, variant?, actions }", dismiss: "actions for Escape?", visibleWhen: "opens it" },
    example: { type: "dialog", visibleWhen: "ui.confirm", title: { en: "Language change" }, text: { en: "Change the language?" }, buttons: [{ label: { en: "No" }, variant: "secondary", actions: [{ type: "setData", path: "ui.confirm", value: false }] }, { label: { en: "Yes" }, actions: [{ type: "exit" }] }] },
  },
  {
    type: "map", purpose: "Places of a list as pins on a grid by lat/lng (no streets). A pin saves its id and runs onSelect; {{item.x}} reads that place.",
    fields: { source: "list of { id, name, lat, lng }", label: "Loc", bind: "chosen id path?", onSelect: "actions?", height: "120-400?" },
    example: { type: "map", source: "loc.found", label: { en: "Locations on the map" }, onSelect: [{ type: "navigate", to: "details" }] },
  },
  {
    type: "accordion", purpose: "Questions that open to show their answers, one open at a time (FAQs).", fields: { items: "[{ id, title: Loc, text: Loc }], at least one" },
    example: { type: "accordion", items: [{ id: "q1", title: { en: "How do I reset my password?" }, text: { en: "Choose Can't Sign In." } }] },
  },
  {
    type: "shortcuts", purpose: "A row of icon buttons, e.g. Enroll, Locate us and Support at the bottom of a sign-in screen.", fields: { items: "[{ id, label: Loc, icon?, actions }]. Icons are the names the select tiles use plus pin, user, help, globe, key, lock" },
    example: { type: "shortcuts", items: [{ id: "enroll", label: { en: "Enroll" }, icon: "user", actions: [{ type: "navigate", to: "enroll" }] }] },
  },
  {
    type: "menu", purpose: "A list of rows that each run actions when tapped, with an optional icon and a line of help.", fields: { items: "[{ id, label: Loc, text?: Loc, icon?, actions }] for fixed rows", source: "or a path to a saved list (e.g. loc.found) to get one row per entry", item: "with source: { label: Loc, text?: Loc, icon?, actions } where {{item.name}} etc. read that entry, in the texts and in the actions" },
    notes: ["A row built from a list: { type: \"menu\", source: \"loc.found\", item: { label: \"{{item.name}}\", actions: [{ type: \"callApi\", integration: \"detail\", input: { id: \"{{item.id}}\" }, saveAs: \"loc.detail\" }, { type: \"navigate\", to: \"details\" }] } }. On a screen with navigation.rules, a navigate action with a target is overridden by a matching rule: guard the rules with a flag if another button must navigate freely."],
    example: { type: "menu", items: [{ id: "chat", label: { en: "Chat with us" }, text: { en: "Mon to Fri, 9 to 5" }, icon: "help", actions: [{ type: "navigate", to: "chat" }] }] },
  },
  {
    type: "statusChip", purpose: "A status word with an icon and a tone (never the colour alone): where a payment, application or request stands.",
    fields: { status: "the value or a template, e.g. \"{{payment.status}}\"", label: "Loc?, replaces the readable default", tone: "positive | warning | negative | info | neutral?", statuses: "{ <value>: { label?: Loc, tone? } }? translations and tones per value" },
    notes: ["Known words get a tone and a label: paid, released, settled, approved, active (positive); pending, pending_approval, waiting (warning); rejected, failed, declined, overdue (negative); processing, scheduled, submitted (info); withdrawn, cancelled, draft (neutral). Unknown words are neutral. Give statuses translations for a second language."],
    example: { type: "statusChip", status: "{{payment.status}}", statuses: { pending_approval: { label: { en: "Waiting for approval" }, tone: "warning" } } },
  },
  {
    type: "timeline", purpose: "What happened and what is still to come, top to bottom (payment or application history).",
    fields: { label: "Loc? names the list", items: "[{ id, title: Loc, text?: Loc, time?: Loc, state?: done | current | upcoming | failed (or a template), visibleWhen? }]", source: "or a path to a saved list: one step per row", item: "with source: { title, text?, time?, state? } where {{item.x}} reads that row" },
    notes: ["state defaults to done; upcoming steps are dashed, failed ones red. A state may be a template: \"{{payment.status == 'released' ? 'done' : 'upcoming'}}\". Write times with {{x | datetime}}."],
    example: { type: "timeline", label: { en: "Payment history" }, items: [{ id: "started", title: { en: "Started by {{pay.startedBy}}" }, time: "{{pay.startedAt | datetime}}" }, { id: "released", title: { en: "Released" }, state: "{{pay.status == 'released' ? 'done' : 'upcoming'}}" }] },
  },
  {
    type: "dataTable", purpose: "A list of records as a table: sort, search, filter chips, pages and ticked rows. On a phone it becomes cards.",
    fields: { source: "path to a list or record of rows", label: "Loc names the table", columns: "[{ key, label: Loc, type?: text | number | money | date | status, currency? or currencyKey? (money), sortable? (default true), filter? (chips of its values), align?, statuses? (as statusChip) }], at least one; the first column is the card title on a phone", rowKey: "row id key (default id)", search: "boolean, a search box over all columns", pageSize: "rows per page (default 25)", sort: "{ key, dir?: asc | desc } the order to start with", bind: "path that receives the ticked row ids (adds tick boxes)", maxSelected: "limit of ticks", total: "{ key, currency } with bind: the sum of a money column shown as '3 selected · total $1,200.00'; one currency", onRowPress: "actions when a row is opened; {{item.x}} reads that row", empty: "Loc, shown when there are no rows" },
    notes: ["Money cells always show the currency's own digits (two decimals for dollars). Sorting, search and filters are the table's own and are not saved; only the ticked ids are, as a list. Declare the bind in dataModel. A date filter is two dateInput fields, the second with min \"{{form.from}}\"."],
    example: { type: "dataTable", source: "ctx.payments", label: { en: "Payments" }, columns: [{ key: "payee", label: { en: "Payee" } }, { key: "amount", label: { en: "Amount" }, type: "money", currency: "USD" }, { key: "status", label: { en: "Status" }, type: "status", filter: true }], search: true, pageSize: 10, bind: "approve.paymentIds", total: { key: "amount", currency: "USD" } },
  },
  {
    type: "chart", purpose: "A line or ring over a saved list, readable by pointer, keys or as a table.",
    fields: { kind: "line | donut", source: "path to a list of rows", label: "Loc names the chart", x: "row key of each point's label", xLabel: "Loc? heading of that column in the table", xFormat: "text | date (date writes 9 Nov)", series: "[{ key, label: Loc }], at least one; a line shows one at a time (a switch when several), a ring uses the first", currency: "code or {{path}}; makes the numbers money", table: "boolean, adds a Show as table switch", height: "80-400?" },
    example: { type: "chart", kind: "line", source: "ctx.cashflow", label: { en: "13-week cash flow" }, x: "weekStart", xFormat: "date", series: [{ key: "inflow", label: { en: "Money in" } }, { key: "outflow", label: { en: "Money out" } }, { key: "closing", label: { en: "Closing balance" } }], currency: "USD", table: true },
  },
  {
    type: "result", purpose: "The outcome on a terminal screen.", fields: { tone: "success | error", title: "Loc", text: "Loc", meta: "Loc, e.g. \"Ref {{result.reference}}\"" },
    notes: ["An error result for a money-moving journey must say that no money has left the account."],
    example: { type: "result", tone: "success", title: { en: "Bill paid", ur: "بل ادا ہو گیا" }, text: { en: "PKR {{ctx.bill.amount | money}} to {{ctx.bill.billerName}}", ur: "PKR {{ctx.bill.amount | money}} بنام {{ctx.bill.billerName}}" }, meta: { en: "Ref {{result.reference}}", ur: "حوالہ {{result.reference}}" } },
  },
  {
    type: "button", purpose: "Runs a list of actions in order. Buttons are shown at the bottom of the screen, whatever their position in blocks.", fields: { label: "Loc", variant: "primary | secondary | ghost", actions: "Action[] (required)" },
    notes: ["Put validate first when the screen has inputs. The chain stops at the first failed validate or callApi with an onError that does not navigate."],
    example: { type: "button", label: { en: "Continue", ur: "جاری رکھیں" }, variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
  },
];

export const ACTIONS = [
  { type: "validate", does: "Checks every bound input on the screen (required, format, amount limits, consent, OTP length). Stops the actions and shows the errors if any is invalid.", example: { type: "validate" } },
  { type: "navigate", does: "Goes to another screen. If the current screen has navigation.rules, the first rule whose `when` is true overrides `to`. toJourney (a slug) opens that journey instead, with `with` {path: value or {{template}}} as launch values; returnTo is reserved.", example: { type: "navigate", to: "review" } },
  { type: "setData", does: "Writes a value to a data path.", example: { type: "setData", path: "bill.reminder", value: true } },
  {
    type: "callApi",
    does: "Calls a declared integration. Top-level input values are used as is, except a value that is exactly one {{expression}}, which is replaced by the evaluated value (keeps numbers as numbers). Nested objects are not evaluated. saveAs stores the result (use ctx.<name> for lists and lookups, any other root such as result for a one-off). onError: showToast (message), navigate (go to a screen), lockAfter + lockTo (go to lockTo after that many failures; only counted for the integration named otpVerify), stay (default when there is no navigate): stay on the screen and stop the chain.",
    notes: ["Without onError, a failing API call raises an error and the journey cannot recover. Always add onError to every callApi, including those in onEnter.", "When a call fails, the engine saves what went wrong as ctx.error = { code, message, integration }: show {{ctx.error.message}} on the failure screen so the customer learns the reason (for example a limit or a rule of the bank)."],
    example: { type: "callApi", integration: "billLookup", input: { billerId: "{{bill.billerId}}", reference: "{{bill.reference}}" }, saveAs: "ctx.bill", onError: { showToast: { en: "We couldn't find that bill.", ur: "یہ بل نہیں ملا۔" }, stay: true } },
  },
  { type: "showToast", does: "Shows a short message at the top of the screen.", example: { type: "showToast", text: { en: "Saved", ur: "محفوظ ہو گیا" } } },
  { type: "share", does: "Reserved for sharing a receipt. Does nothing yet.", example: { type: "share", template: "receipt-transfer" } },
  { type: "exit", does: "Closes the journey and returns to the app home. Use it on the last button of a terminal screen.", example: { type: "exit" } },
];

const EXPRESSIONS = {
  where: "navigation.rules[].when, a block's visibleWhen, amountInput validation min and max, accountPicker filter, and inside {{ }} in any text.",
  operators: ["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "&&", "||", "!", "a ? b : c", "parentheses"],
  literals: ["numbers", "'text' or \"text\"", "true", "false", "null", "Infinity"],
  functions: ["min(a, b, ...)", "max(a, b, ...)", "abs(x)", "round(x)", "floor(x)", "ceil(x)", "len(x)", "isEmpty(x)"],
  paths: "Dotted paths such as transfer.amount or ctx.limits.daily, and lookups with brackets such as ctx.accounts[transfer.fromAccountId].balance. A missing value is simply empty, never an error. == is a loose comparison.",
  templates: "{{ expression }} or {{ expression | formatter }}. Formatters: money (amounts with thousands separators, up to two decimals), money2 (always two decimals; money2:USD adds the symbol), upper. A missing value renders as empty text. Do not use templates in bind, source, pattern or ids.",
  notAvailable: ["no assignment", "no ??", "no method calls (only the functions above)", "no string concatenation in rules (use templates in text instead)"],
  examples: ["transfer.amount > (ctx.limits.daily - ctx.limits.usedToday)", "bill.amount >= 50 && bill.amount <= 5000", "ctx.accounts[topup.fromAccountId].balance", "!isEmpty(bill.reference)"],
};

const DATA = {
  dataModel: "A map from dotted path to { type, required?, currency?, pattern? }. type is \"string\", \"money\" or \"boolean\". Declare EVERY path that a block binds to or that a setData writes, and set required: true for every mandatory input (the engine only enforces required fields declared here).",
  ctx: "ctx.* holds data loaded by callApi (saveAs: \"ctx.accounts\"). It is read-only for blocks. A block's source and every {{ctx.x}} must match a saveAs. Lint checks this.",
  results: "saveAs with another root, such as saveAs: \"result\", makes {{result.reference}} available afterwards.",
  lifetime: "All data lives for one run of the journey and is reset when it restarts.",
  never: ["Do not put secrets, tokens or real customer data in a journey. Journeys are public configuration.", "Do not store card numbers or PINs."],
};

const LOCALIZATION = {
  loc: "Every customer-facing string is either a plain string (English only) or an object { en, ur }. Always use { en, ur }. Lint reports translation_gap when an object lacks a language the journey supports.",
  urdu: ["Use a polite, formal register (آپ).", "Keep PKR, digits and {{templates}} exactly as in English.", "Keep labels short. Do not translate ids, data paths or integration names."],
  glossary: { Continue: "جاری رکھیں", Confirm: "تصدیق کریں", Done: "مکمل", "Try again": "دوبارہ کوشش کریں", Amount: "رقم", Account: "اکاؤنٹ", "Pay now": "ابھی ادا کریں", Verify: "تصدیق", "Incorrect code": "غلط کوڈ", Required: "ضروری ہے", Review: "جائزہ", Biller: "بل جاری کرنے والا", Fee: "فیس", From: "سے", To: "کو", Mobile: "موبائل", "Mobile number": "موبائل نمبر", Carrier: "کیریئر", Reference: "حوالہ", "Close": "بند کریں", "Back": "واپس", "Transfer sent": "ٹرانسفر بھیج دیا گیا", "No money has left your account": "آپ کے اکاؤنٹ سے کوئی رقم نہیں کٹی" },
  directions: "Set locale.rtl to [\"ur\"]. Layout mirrors automatically.",
};

export const LINT_RULES = [
  { code: "entry_missing", means: "entryScreen is not a screen id.", fix: "Set entryScreen to the first screen's id." },
  { code: "duplicate_screen_id", means: "Two screens share an id.", fix: "Make ids unique." },
  { code: "duplicate_integration_id", means: "Two integrations share an id.", fix: "Make ids unique." },
  { code: "dangling_target", means: "A navigate (or rule, onError, lockTo) points at a screen that does not exist.", fix: "Fix the target id." },
  { code: "unreachable", means: "No path leads to this screen from the entry screen.", fix: "Add a navigate to it, or delete it." },
  { code: "unknown_integration", means: "A callApi uses an integration id that integrations[] does not declare.", fix: "Declare it in integrations." },
  { code: "no_terminal", means: "No screen has kind \"terminal\".", fix: "Add a success screen, and a failed screen for money-moving journeys." },
  { code: "consent_before_submit", means: "A money-moving journey has no consent block.", fix: "Add a consent block on the review screen." },
  { code: "otp_before_money", means: "A money-moving journey has no OTP screen, or the money call is before otpVerify.", fix: "Put otpVerify before the money call in the same button." },
  { code: "unbound_input", means: "A block binds a path that dataModel does not declare.", fix: "Add the path to dataModel." },
  { code: "amount_no_currency", means: "An amountInput has no currency.", fix: "Set currency to a code like JOD, or a path like {{account.currency}}." },
  { code: "amount_currency_invalid", means: "An amountInput's currency is neither a 3-4 letter code nor a {{path}}.", fix: "Use a code like JOD, or {{account.currency}}." },
  { code: "currency_mismatch", means: "An amountInput's currency differs from its dataModel entry's.", fix: "Make both the same." },
  { code: "mixed_currency", means: "A journey has amounts in more than one fixed currency.", fix: "Fine for a conversion; otherwise one currency, or {{account.currency}}." },
  { code: "authorisation_missing", means: "A journey that starts or approves a company payment names no role.", fix: "Add authorisation: { role, rolesFrom: \"ctx.company.me.roles\", deniedScreen } and that terminal screen." },
  { code: "authorisation_denied_missing", means: "authorisation.deniedScreen is not a terminal screen.", fix: "Add a terminal screen with that id saying the person is not allowed." },
  { code: "acceptance_duplicate", means: "Two acceptance criteria share an id.", fix: "Make the ids unique (AC-1, AC-2 …)." },
  { code: "scenario_duplicate", means: "Two scenarios share an id.", fix: "Make the ids unique (T-1, T-2 …)." },
  { code: "scenario_unknown_criterion", means: "A scenario covers a criterion that is not in acceptance.", fix: "Fix the id, or add the criterion." },
  { code: "criterion_uncovered", means: "An acceptance criterion has no scenario that covers it.", fix: "Write a scenario for it (covers: [\"AC-n\"]), or remove the criterion." },
  { code: "unknown_journey", means: "Warning: toJourney is not a catalog journey.", fix: "Use a catalog slug." },
  { code: "translation_gap", means: "A { en, ur } object is missing a supported language.", fix: "Add the missing translation." },
  { code: "expression_syntax", means: "A rule or {{template}} is not a valid expression, or uses an unknown function.", fix: "Fix the syntax. See the expressions section." },
  { code: "unknown_reference", means: "An expression uses a root, or a ctx name, that the journey never defines.", fix: "Use the suggested name, or add the dataModel entry or saveAs." },
  { code: "unknown_field", means: "An expression uses a path under a known root that dataModel does not declare (usually a typo).", fix: "Use the suggested path." },
  { code: "unknown_formatter", means: "A {{x | name}} uses a formatter that does not exist.", fix: "Use money (optionally money:JOD or money:account.currency), money2, datetime or upper." },
  { code: "unknown_source", means: "A block's source is never saved by a callApi.", fix: "Add saveAs to the callApi, or fix the name." },
];

const PATTERNS = [
  "Money movement (transfer, bill, top-up): collect details, then a REVIEW screen with reviewSummary + consent, whose button validates, calls otpSend (saveAs ctx.otp) and navigates to the OTP screen. The OTP screen's button: validate, callApi otpVerify (onError: showToast, stay, lockAfter 3, lockTo failed), callApi the money adapter (saveAs result, onError navigate failed), navigate success. End with terminal screens success and failed.",
  "Data from the bank: declare the integration, call it in the first screen's onEnter with saveAs ctx.<name> (and an onError), then use accountPicker/beneficiaryPicker/select with source ctx.<name>.",
  "Look something up before continuing (bill, quote): callApi in the Continue button with saveAs ctx.<name> and onError { showToast, stay: true }, then navigate. Show the result on the next screen with {{ctx.<name>.field}}.",
  "Branch on a rule: add a screen with kind \"branch\" and a navigation.rules entry on the screen whose single Continue button should divert, e.g. { when: \"topup.amount > ctx.limits.daily - ctx.limits.usedToday\", to: \"limitExceeded\" }. The branch screen needs a button back.",
  "Validation: set required in dataModel, use pattern/patternMessage on text inputs, min/max on amounts, and validate as the first action of every button that moves forward.",
  "Failure screens: a terminal screen with an error result and a Try again button that navigates to the start of the journey. For money movement, say that no money has left the account.",
  "Keep it small: aim for 3 to 6 steps. One idea per screen.",
];

const OVERVIEW = {
  what: "A FinX journey is JSON: screens made of blocks, wired together by buttons and rules, calling banking integrations. The same JSON runs on web, Android and iOS. Studio shows the draft you save, and a person publishes it.",
  workflow: ["finx_get_catalog (this)", "finx_get_example for the closest shipped journey", "finx_create_journey (new) or finx_get_journey (change)", "finx_save_draft or finx_patch_journey, until issues is empty", "finx_simulate_journey: happy path, a validation failure, a failure path, Urdu", "finx_report_run with the summary, then tell the person to review in Studio"],
  limits: { maxScreens: 30, maxJsonKilobytes: 200, advice: "Typical journeys have 3 to 8 screens." },
  scope: "Agents only write drafts. Publishing needs the person's explicit instruction.",
};

export function getCatalog(section: Section = "all") {
  const all = {
    overview: OVERVIEW,
    journey: {
      shape: SKELETON,
      fields: {
        id: "string, e.g. jrn_mobile_top_up", slug: "must equal the slug returned by finx_create_journey", name: "Loc", version: "integer, keep the value you were given (0 for a new journey)", status: "\"draft\" (Studio sets it)",
        channels: "[\"web\", \"mobile\"]", locale: "{ default: \"en\", supported: [\"en\", \"ur\"], rtl: [\"ur\"] }", entryScreen: "id of the first screen", authorisation: "optional { role, rolesFrom, deniedScreen }: a journey for one role (a company initiator or approver). rolesFrom is a path to the list of the signed-in person's roles (ctx.company.me.roles); once it is loaded, anyone without the role is sent to deniedScreen, a terminal screen. Required for any journey that calls corp.payments.initiate or corp.payments.approve",
        dataModel: "see the data section", integrations: "[{ id, adapter, mode: \"sandbox\" }] where adapter is from the adapters section",
        screens: "[{ id, title: Loc, kind?: screen | branch | terminal, onEnter?: Action[], blocks: Block[], navigation?: { rules?: [{ when, to }] } }]",
      },
      notes: ["navigation.default is informational today: only button navigate actions and navigation.rules move the customer. Every screen except terminal ones needs a button that navigates.", "navigation.rules apply to every navigate action on that screen, so use them on a screen with one forward button.", "kind: terminal marks the end (success or failed) and hides the back arrow in the app. branch marks an alternate path such as limit exceeded. Both also change how Studio draws them and how lint reasons about the flow.", "Screen ids: lowercase letters, digits and underscores."],
    },
    blocks: BLOCKS,
    actions: ACTIONS,
    expressions: EXPRESSIONS,
    data: DATA,
    localization: LOCALIZATION,
    adapters: { note: "Declare an integration { id: suggestedId, adapter, mode: \"sandbox\" } for each adapter you use. Only these exist today. If the brief needs something else, say so in the run summary instead of inventing one.", list: ADAPTER_CATALOG },
    personas: { note: "Use these in finx_simulate_journey. The code 000000 is accepted for every customer; use 999999 as a wrong code.", list: describePersonas() },
    lint: LINT_RULES,
    patterns: PATTERNS,
  };
  if (section === "all") return all;
  return { [section]: all[section] };
}
