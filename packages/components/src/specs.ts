import type { ComponentSpec } from "./spec";
import { Button } from "./web/Button";
import { TextField } from "./web/TextField";
import { AppBar } from "./web/AppBar";
import { ListRow } from "./web/ListRow";
import { Keypad, PinDots } from "./web/Keypad";
import { Alert } from "./web/Alert";
import { Result } from "./web/Result";
import { SummaryList } from "./web/SummaryList";
import { Switch } from "./web/Switch";
import { Checkbox } from "./web/Checkbox";
import { ChoiceGroup } from "./web/ChoiceGroup";
import { AmountField } from "./web/AmountField";
import { CodeInput } from "./web/CodeInput";
import { SectionHeader } from "./web/SectionHeader";
import { Shortcuts } from "./web/Shortcuts";
import { Hero } from "./web/Hero";
import { Divider } from "./web/Divider";
import { Dialog } from "./web/Dialog";
import { DateField } from "./web/DateField";
import { Dropdown } from "./web/Dropdown";
import { Avatar } from "./web/Avatar";
import { MapPins } from "./web/MapPins";
import { Accordion } from "./web/Accordion";
import { BalanceList } from "./web/BalanceList";
import { StatusChip } from "./web/StatusChip";
import { Timeline } from "./web/Timeline";
import { DataTable } from "./web/DataTable";
import { FileField } from "./web/FileField";
import { DocumentViewer } from "./web/DocumentViewer";
import { SignaturePad } from "./web/SignaturePad";
import { IdCapture } from "./web/IdCapture";

const LONG = "A very long label that has to wrap onto a second line without breaking the layout";

export const catalog: ComponentSpec[] = [
  {
    name: "Button", group: "Actions", Component: Button, purpose: "Runs the screen's main action, or a secondary one.",
    props: [
      { name: "label", type: "string", description: "The words on the button." },
      { name: "variant", type: "primary | secondary", default: "primary", description: "Filled in the bank's colour, or outlined." },
      { name: "busy", type: "boolean", description: "Shows that work is in progress and blocks a second press." },
      { name: "disabled", type: "boolean", description: "Cannot be pressed." },
      { name: "type", type: "button | submit", default: "button", description: "submit lets Enter in a form press it." },
      { name: "onPress", type: "() => void", description: "Called when pressed." },
    ],
    states: [
      { name: "Primary", props: { label: "Continue" } },
      { name: "Secondary", props: { label: "Cancel", variant: "secondary" } },
      { name: "Busy", props: { label: "Continue", busy: true } },
      { name: "Disabled", props: { label: "Continue", disabled: true } },
      { name: "Long label", props: { label: LONG } },
    ],
    a11y: ["A real button element; busy sets aria-busy and blocks presses.", "Visible focus ring.", "Disabled is announced, not just dimmed."],
    tokens: ["button.height", "button.radius"],
  },
  {
    name: "TextField", group: "Inputs", Component: TextField, purpose: "One line of typed text, with a label, help and an error.",
    props: [
      { name: "label", type: "string", description: "Names the field. Always present, hidden visually in the outlined look." },
      { name: "value / onChange", type: "string / (v) => void", description: "Controlled value." },
      { name: "look", type: "standard | outlined", default: "standard", description: "Label above the box, or the label inside it as the placeholder." },
      { name: "helper / error", type: "string", description: "A line of help, or what is wrong. The error is announced." },
      { name: "secure", type: "boolean", description: "Hides what is typed, with a show/hide control." },
      { name: "keyboard", type: "default | number | phone | email", description: "Which on-screen keyboard to open." },
      { name: "lines", type: "number", description: "More than 1 makes it a taller box for pasted rows or a note." },
    ],
    states: [
      { name: "Empty", props: { label: "Mobile number", value: "", helper: "10 to 14 digits", keyboard: "phone" } },
      { name: "Filled", props: { label: "Mobile number", value: "03001234567" } },
      { name: "Error", props: { label: "Mobile number", value: "0300", error: "Enter 10 to 14 digits" } },
      { name: "Password", props: { label: "Password", value: "hunter22", secure: true } },
      { name: "Outlined", props: { label: "Username", value: "", look: "outlined" } },
      { name: "Several lines", props: { label: "Payment lines", value: "sup_textile,25000,INV-1\nsup_logistics,18000,INV-2", lines: 4 } },
      { name: "Outlined password", props: { label: "Password", value: "hunter22", look: "outlined", secure: true } },
      { name: "Disabled", props: { label: "Account", value: "Current ••4321", disabled: true } },
    ],
    a11y: ["Label tied to the input; helper and error are referenced by aria-describedby.", "Error is a live region and sets aria-invalid.", "Show/hide is a toggle button with aria-pressed."],
    tokens: ["field.height", "field.radius", "field.border"],
  },
  {
    name: "AppBar", group: "Navigation", Component: AppBar, purpose: "The top of a screen: title, back and close.",
    props: [
      { name: "title", type: "string", description: "The screen's name (an h1)." },
      { name: "tone", type: "plain | bar", default: "plain", description: "On the page colour, or a solid bar in the bank's colour." },
      { name: "onBack / onClose", type: "() => void", description: "Each control appears only when given." },
      { name: "labels", type: "{ back, close }", description: "Words for the icon buttons, in the screen's language." },
    ],
    states: [
      { name: "Plain", props: { title: "Send money", onBack: () => {}, onClose: () => {} } },
      { name: "Bank bar", props: { title: "Enroll / Activate your profile", tone: "bar", onBack: () => {}, onClose: () => {} } },
      { name: "Title only", props: { title: "Welcome" } },
      { name: "Long title", props: { title: LONG, tone: "bar", onClose: () => {} } },
    ],
    a11y: ["The title is the page's h1.", "Icon buttons have text labels.", "Arrows mirror in right-to-left."],
    tokens: ["bar.height"],
  },
  {
    name: "ListRow", group: "Lists", Component: ListRow, purpose: "A tappable row with an icon, a title, a chevron and an optional line of help.",
    props: [
      { name: "label", type: "string", description: "The row's title." },
      { name: "text", type: "string", description: "A line of help under the row." },
      { name: "icon", type: "string", description: "Name of a shared icon." },
      { name: "onPress", type: "() => void", description: "Called when pressed." },
    ],
    states: [
      { name: "With icon and help", props: { label: "Enroll your account", icon: "user", text: "Enroll now to create your digital banking profile" } },
      { name: "Plain", props: { label: "Business Banking" } },
      { name: "Disabled", props: { label: "Business Banking", disabled: true } },
      { name: "Long text", props: { label: LONG, icon: "help", text: LONG } },
    ],
    a11y: ["A button element, not a clickable div.", "Chevron is decorative and mirrors in right-to-left."],
    tokens: ["row.height", "row.radius"],
  },
  {
    name: "Keypad", group: "Verification", Component: Keypad, purpose: "A number pad for a PIN or code. It reports key presses; the screen owns the value.",
    props: [
      { name: "onKey", type: "(key) => void", description: "0 to 9, or back." },
      { name: "labels", type: "{ back }", description: "Word for the delete key." },
    ],
    states: [{ name: "Default", props: {} }],
    a11y: ["Every key is a labelled button.", "Always left to right, as digits are."],
    tokens: ["keypad.key", "keypad.keyHeight", "keypad.gapX", "keypad.gapY"],
  },
  {
    name: "PinDots", group: "Verification", Component: PinDots, purpose: "The boxes above a keypad: dots when masked, digits otherwise.",
    props: [
      { name: "length", type: "number", description: "How many digits." },
      { name: "filled", type: "number", description: "How many are entered." },
      { name: "masked", type: "boolean", default: "true", description: "Dots instead of digits." },
      { name: "digits", type: "string", description: "The digits, shown when not masked." },
      { name: "label", type: "string", description: "Spoken description, with progress added." },
    ],
    states: [
      { name: "Empty", props: { length: 4, filled: 0, label: "Enter your PIN" } },
      { name: "Partly filled", props: { length: 4, filled: 2, label: "Enter your PIN" } },
      { name: "Digits shown", props: { length: 6, filled: 3, masked: false, digits: "482", label: "Enter the code" } },
    ],
    a11y: ["One image with a spoken summary (for example 2/4), not four separate items."],
  },
];

const OPTS = [
  { id: "a", title: "Mobile top-up", sub: "Jazz, Zong, Telenor", selected: true, icon: "phone", avatar: "MT" },
  { id: "b", title: "Pay a bill", sub: "Electricity, gas, water", selected: false, icon: "card", avatar: "PB" },
  { id: "c", title: "Send money", selected: false, avatar: "SM", round: true },
];
const QUICK = [
  { value: 500, label: "500", aria: "500 rupees", selected: false },
  { value: 1000, label: "1,000", aria: "1,000 rupees", selected: true },
  { value: 5000, label: "5,000", aria: "5,000 rupees", selected: false },
];

catalog.push(
  {
    name: "Alert", group: "Feedback", Component: Alert, purpose: "A short message in a coloured box: information, a warning, an error or a success.",
    props: [{ name: "tone", type: "info | warning | error | success", description: "Sets the colours and how urgently it is announced." }, { name: "text", type: "string", description: "The message." }],
    states: [
      { name: "Info", props: { tone: "info", text: "Transfers after 5 pm are processed the next working day." } },
      { name: "Warning", props: { tone: "warning", text: "You are close to your daily limit." } },
      { name: "Error", props: { tone: "error", text: "We could not reach the bank. Try again." } },
      { name: "Success", props: { tone: "success", text: "Beneficiary added." } },
      { name: "Long text", props: { tone: "info", text: LONG + ". " + LONG } },
    ],
    a11y: ["Errors and warnings are announced at once (role alert); information and success wait their turn (role status).", "Meaning is carried by the words, not only the colour."],
  },
  {
    name: "Result", group: "Feedback", Component: Result, purpose: "The end of a journey: a big tick or warning, a title, a line of text and a reference.",
    props: [
      { name: "tone", type: "success | error", description: "A tick, or an exclamation mark." },
      { name: "title / text", type: "string", description: "The headline and an explanation." },
      { name: "meta", type: "string", description: "A reference or time, in a small pill." },
    ],
    states: [
      { name: "Success", props: { tone: "success", title: "Money sent", text: "Ayesha will receive it in a few seconds.", meta: "Ref FX-20481" } },
      { name: "Error", props: { tone: "error", title: "Payment failed", text: "Nothing was taken from your account." } },
      { name: "Title only", props: { tone: "success", title: "Done" } },
    ],
    a11y: ["A status region, so the outcome is announced when the screen opens.", "The icon is decorative; the title says the result."],
  },
  {
    name: "SummaryList", group: "Lists", Component: SummaryList, purpose: "Label and value pairs, for the review step before money moves.",
    props: [{ name: "rows", type: "{ label, value }[]", description: "One line each; the value is right-aligned and uses tabular figures." }],
    states: [
      { name: "Review", props: { rows: [{ label: "From", value: "Current ••4321" }, { label: "To", value: "Ayesha Khan" }, { label: "Amount", value: "PKR 5,000" }] } },
      { name: "Long value", props: { rows: [{ label: "Reference", value: LONG }, { label: "Fee", value: "PKR 0" }] } },
    ],
    a11y: ["A description list (dl), so a screen reader pairs each label with its value."],
    tokens: ["radius.lg"],
  },
  {
    name: "Switch", group: "Inputs", Component: Switch, purpose: "An on/off setting with a label, optional help and an optional link on the same row.",
    props: [
      { name: "label / helper", type: "string", description: "The setting and a line of help." },
      { name: "checked / onChange", type: "boolean / (v) => void", description: "Controlled value." },
      { name: "link", type: "{ label, onPress }", description: "A link at the start of the row." },
    ],
    states: [
      { name: "Off", props: { label: "Remember me", checked: false } },
      { name: "On with help", props: { label: "Use Face ID", helper: "Sign in without typing your password", checked: true } },
      { name: "With link", props: { label: "Remember me", checked: false, link: { label: "Forgot password?", onPress: () => {} } } },
    ],
    a11y: ["A real checkbox with role switch; the whole row is the target.", "The track mirrors in right-to-left."],
  },
  {
    name: "Checkbox", group: "Inputs", Component: Checkbox, purpose: "A tick box for consent, with an error when it is left empty.",
    props: [
      { name: "label", type: "string", description: "The statement being agreed to." },
      { name: "checked / onChange", type: "boolean / (v) => void", description: "Controlled value." },
      { name: "error", type: "string", description: "Why the screen cannot continue. Announced." },
    ],
    states: [
      { name: "Unchecked", props: { label: "I agree to the terms and conditions", checked: false } },
      { name: "Checked", props: { label: "I agree to the terms and conditions", checked: true } },
      { name: "Error", props: { label: "I agree to the terms and conditions", checked: false, error: "Tick the box to continue" } },
      { name: "Long label", props: { label: LONG + ". " + LONG, checked: false } },
    ],
    a11y: ["A real checkbox; the label is the target.", "The error sets aria-invalid and is announced."],
  },
  {
    name: "ChoiceGroup", group: "Inputs", Component: ChoiceGroup, purpose: "Pick one of several: chips, tiles, rows, or cards with initials (accounts, people).",
    props: [
      { name: "label / name", type: "string", description: "The question, and the group's name." },
      { name: "look", type: "chips | tiles | rows | cards", default: "chips", description: "How the options are drawn." },
      { name: "options", type: "ChoiceOption[]", description: "id, title, sub, selected, plus avatar/round (cards) or icon/color (tiles)." },
      { name: "onChange / error / footer", type: "(id) => void / string / string", description: "Called with the chosen id; an error; a line below the options." },
    ],
    states: [
      { name: "Chips", props: { label: "Network", name: "n1", look: "chips", options: OPTS } },
      { name: "Tiles", props: { label: "What would you like to do?", name: "n2", look: "tiles", options: OPTS } },
      { name: "Rows", props: { label: "Frequency", name: "n3", look: "rows", options: OPTS } },
      { name: "Cards", props: { label: "Pay from", name: "n4", look: "cards", options: OPTS, footer: "Add a beneficiary" } },
      { name: "Error", props: { label: "Network", name: "n5", look: "chips", options: OPTS.map((o) => ({ ...o, selected: false })), error: "Choose one" } },
    ],
    a11y: ["Real radio inputs in a fieldset with a legend: arrow keys and screen readers work with no extra code.", "The selected option is shown by border and tick, not colour alone."],
    tokens: ["radius.lg", "radius.pill"],
  },
  {
    name: "AmountField", group: "Inputs", Component: AmountField, purpose: "A large amount with its currency symbol, optional preset amounts and an error.",
    props: [
      { name: "label / symbol", type: "string", description: "The field's name and the currency symbol." },
      { name: "decimals", type: "number", default: "0", description: "Decimal places the currency allows; more than 0 opens a keypad with a decimal point." },
      { name: "value / onChange", type: "string / (text) => void", description: "The amount as typed; the screen parses it." },
      { name: "quick / onQuick", type: "QuickAmount[] / (n) => void", description: "Preset amounts shown as chips." },
      { name: "helper / error", type: "string", description: "Help or what is wrong." },
    ],
    states: [
      { name: "Empty", props: { label: "Amount", symbol: "Rs", value: "", helper: "Daily limit left: Rs 200,000" } },
      { name: "With quick amounts", props: { label: "Amount", symbol: "Rs", value: "1,000", quick: QUICK } },
      { name: "Error", props: { label: "Amount", symbol: "Rs", value: "9,000,000", error: "That is more than your balance" } },
      { name: "With decimals", props: { label: "Amount", symbol: "JOD", decimals: 3, value: "12.5", helper: "Up to 3 decimal places" } },
    ],
    a11y: ["A text input with a numeric keypad, not type=number: no spinner, no scroll-to-change.", "The symbol is decorative; the label names the field.", "Quick amounts are a radio group with spoken labels."],
  },
  {
    name: "CodeInput", group: "Verification", Component: CodeInput, purpose: "A one-time code in separate boxes, typed or pasted on the device keyboard.",
    props: [
      { name: "label / hint", type: "string", description: "Spoken name, and a line of help above the boxes." },
      { name: "length / value / onChange", type: "number / string / (typed) => void", description: "Controlled; the screen keeps only digits." },
      { name: "error", type: "string", description: "Why the code was refused." },
    ],
    states: [
      { name: "Empty", props: { label: "Enter the 6-digit code", length: 6, value: "", hint: "We sent a code to ••• 4321" } },
      { name: "Partly typed", props: { label: "Enter the 6-digit code", length: 6, value: "482", hint: "We sent a code to ••• 4321" } },
      { name: "Error", props: { label: "Enter the 6-digit code", length: 6, value: "482100", error: "Incorrect code" } },
    ],
    a11y: ["One real input with autocomplete one-time-code, so a code from an SMS can be filled in; the boxes only mirror it.", "Always left to right, as digits are."],
  },
  {
    name: "SectionHeader", group: "Navigation", Component: SectionHeader, purpose: "A heading with a link on the same row, such as the language switcher.",
    props: [{ name: "title", type: "string", description: "The heading." }, { name: "subtitle", type: "string", description: "A quieter line under the title, such as an \"As of\" time." }, { name: "action", type: "{ label, onPress }", description: "A link at the far end." }],
    states: [
      { name: "With link", props: { title: "Welcome", action: { label: "English", onPress: () => {} } } },
      { name: "With a subtitle", props: { title: "Account Preview", subtitle: "As of 03/30/2026 12:50 PM", action: { label: "English", onPress: () => {} } } },
      { name: "Title only", props: { title: "Welcome" } },
    ],
    a11y: ["The heading is a real h2; the link is a button."],
  },
  {
    name: "Shortcuts", group: "Navigation", Component: Shortcuts, purpose: "Icon buttons in a row at the foot of a sign-in screen (locations, support, offers).",
    props: [{ name: "items", type: "{ id, label, icon, onPress }[]", description: "Each shortcut: a tile with an icon and a label under it." }],
    states: [{ name: "Three", props: { items: [{ id: "1", label: "Branches", icon: "mapPin" }, { id: "2", label: "Support", icon: "shield" }, { id: "3", label: "Offers", icon: "star" }] } }],
    a11y: ["Every shortcut is a button with its label as text."],
  },
  {
    name: "Hero", group: "Navigation", Component: Hero, purpose: "The bank's banner at the top of the sign-in screen: its logo, or its name.",
    props: [{ name: "name", type: "string", description: "The bank's name; also the logo's alternative text." }, { name: "logo", type: "string", description: "Address of the logo image." }],
    states: [{ name: "Name only", props: { name: "Cairo Amman Bank" } }],
    a11y: ["The logo has the bank's name as alternative text."],
  },
);

catalog.push(
  {
    name: "Divider", group: "Lists", Component: Divider, purpose: "A thin line between groups, with an optional word in the middle such as OR.",
    props: [{ name: "label", type: "string", description: "A word in the middle of the line. Without it, a plain line." }],
    states: [{ name: "With a word", props: { label: "OR" } }, { name: "Plain line", props: {} }],
    a11y: ["With a label it is a separator named by that word; without one it is a plain horizontal rule."],
  },
  {
    name: "DateField", group: "Inputs", Component: DateField, purpose: "A date field with a calendar that opens under it. It stores the day as YYYY-MM-DD and shows DD / MM / YYYY. Month and year step with buttons, so a birth date takes a few presses.",
    props: [
      { name: "label", type: "string", description: "The field's name." }, { name: "value", type: "string", description: "The chosen day, YYYY-MM-DD." }, { name: "onChange", type: "(iso) => void", description: "Called with the chosen day." },
      { name: "min", type: "string", description: "The earliest day: YYYY-MM-DD or today." }, { name: "max", type: "string", description: "The latest day: YYYY-MM-DD or today." },
      { name: "placeholder", type: "string", description: "Shown while empty." }, { name: "error", type: "string", description: "A message under the field." },
      { name: "look", type: "standard | outlined", default: "standard", description: "Label above, or inside as the placeholder." }, { name: "lang", type: "string", default: "en", description: "Month and weekday names." },
    ],
    states: [{ name: "Empty", props: { label: "Date of birth", max: "today" } }, { name: "Chosen", props: { label: "Date of birth", value: "2001-01-01", max: "today" } }, { name: "Error", props: { label: "Date of birth", error: "Choose a date" } }],
    a11y: ["The field is a button that says it opens a dialog and whether it is open; Escape closes the calendar.", "Every day is a button named in words (1 January 2001), the chosen one is pressed, days outside the limits are disabled.", "The month and year are announced when they change."],
  },
  {
    name: "Dropdown", group: "Inputs", Component: Dropdown, purpose: "A list that folds into one line until pressed. On the web it is the browser's own select; on a phone, a list that opens under the field.",
    props: [
      { name: "label", type: "string", description: "The field's name." }, { name: "options", type: "{ id, name, sub }[]", description: "The choices." }, { name: "value", type: "string", description: "The id chosen." },
      { name: "onChange", type: "(id) => void", description: "Called with the id chosen." }, { name: "placeholder", type: "string", description: "Shown while nothing is chosen." }, { name: "error", type: "string", description: "A message under the field." },
    ],
    states: [{ name: "Nothing chosen", props: { label: "Username", placeholder: "Choose a username", options: [{ id: "nour", name: "nour" }, { id: "nour.haddad", name: "nour.haddad" }] } }, { name: "Chosen", props: { label: "Username", value: "nour", options: [{ id: "nour", name: "nour" }, { id: "nour.haddad", name: "nour.haddad" }] } }],
    a11y: ["On the web it is a labelled native select; on a phone each choice is a menu item and the chosen one is marked selected."],
  },
  {
    name: "Avatar", group: "Feedback", Component: Avatar, purpose: "A circle with a person's initials, and their name (and a line such as a username) under it.",
    props: [{ name: "name", type: "string", description: "The person's name." }, { name: "text", type: "string", description: "A line under the name." }],
    states: [{ name: "With username", props: { name: "Nour Haddad", text: "nour" } }, { name: "One name", props: { name: "Nour" } }],
    a11y: ["The initials are decorative; the name and line are real text."],
  },
  {
    name: "Dialog", group: "Feedback", Component: Dialog, purpose: "A pop-up over the screen that asks one thing: a PIN prompt, a fingerprint unlock, a call, a confirmation.",
    props: [
      { name: "title", type: "string", description: "The heading." }, { name: "text", type: "string", description: "A line under the heading." },
      { name: "icon", type: "string", description: "An icon name (lock, phone, shield) shown above the heading." },
      { name: "children", type: "node", description: "What it asks for, such as a code field." },
      { name: "actions", type: "{ id, label, variant, onPress }[]", description: "Its buttons, in order." },
      { name: "onDismiss", type: "() => void", description: "Called on Escape." },
    ],
    states: [
      { name: "Confirmation", props: { title: "Change language", text: "Do you want to change the language to Arabic?", actions: [{ id: "no", label: "No", variant: "secondary" }, { id: "yes", label: "Yes" }] } },
      { name: "Call", props: { title: "Call us", text: "+962 6 580 0800", icon: "phone", actions: [{ id: "cancel", label: "Cancel", variant: "secondary" }, { id: "call", label: "Call" }] } },
    ],
    a11y: ["A dialog named by its heading; focus moves into it when it opens and Escape closes it.", "What is behind it is covered, and the native twin marks the view as modal."],
  },
  {
    name: "MapPins", group: "Navigation", Component: MapPins, purpose: "A schematic map: places as pins on a plain grid by latitude and longitude. No streets or tiles; a map provider can replace it.",
    props: [
      { name: "pins", type: "{ id, label, lat, lng }[]", description: "The places." }, { name: "selected", type: "string", description: "The id of the selected pin." },
      { name: "label", type: "string", description: "Names the map for a screen reader." }, { name: "onSelect", type: "(id) => void", description: "Called when a pin is pressed." },
      { name: "height", type: "number", default: "220", description: "The map's height." },
    ],
    states: [
      { name: "Three branches", props: { label: "Branches near you", pins: [{ id: "a", label: "Abdali Branch", lat: 31.96, lng: 35.91 }, { id: "b", label: "Sweifieh Branch", lat: 31.95, lng: 35.86 }, { id: "c", label: "Airport Road ATM", lat: 31.9, lng: 35.99 }], selected: "b" } },
      { name: "One place", props: { label: "Head office", pins: [{ id: "h", label: "Head office", lat: 31.95, lng: 35.93 }] } },
    ],
    a11y: ["Every pin is a button named by the place, and the selected one says so.", "It is a group named by its label; the places are also listed as text by the journey, so the map is never the only way to reach them."],
  },
  {
    name: "Accordion", group: "Lists", Component: Accordion, purpose: "Questions that open to show their answers, one at a time (FAQs).",
    props: [
      { name: "items", type: "{ id, title, text }[]", description: "Each question and its answer." },
      { name: "defaultOpen", type: "string", description: "The id of the item open to start with." },
    ],
    states: [
      { name: "All closed", props: { items: [{ id: "a", title: "Account activity", text: "Savings, checking and credit cards are listed." }, { id: "b", title: "Alerts & communication", text: "Turn alerts on in Settings." }] } },
      { name: "One open", props: { defaultOpen: "a", items: [{ id: "a", title: "Account activity", text: "Savings, checking and credit cards are listed." }, { id: "b", title: "Alerts & communication", text: "Turn alerts on in Settings." }] } },
    ],
    a11y: ["Each question is a button with aria-expanded that controls its answer region.", "Only one answer is open at a time; the chevron points up when open.", "Titles are headings, so a screen reader can jump between questions."],
    tokens: ["radius.lg"],
  },
);

catalog.push({
  name: "BalanceList", group: "Lists", Component: BalanceList, purpose: "Read-only account rows: name and number, a type tag, the balance and a note under it (the account preview before sign in).",
  props: [{ name: "rows", type: "{ id, title, tag?, amount, caption? }[]", description: "One row per account; the amount is already formatted for its currency." }],
  states: [
    { name: "Three accounts", props: { rows: [
      { id: "a", title: "Kmart Corporation...0375", tag: "Current Account", amount: "JOD 2,173.420", caption: "Available balance" },
      { id: "b", title: "Kmart Corporation...0375", tag: "Savings Account", amount: "-JOD 3,085.310", caption: "Overdrawn" },
      { id: "c", title: "A very long account name that has to wrap without breaking the layout...0375", amount: "JOD 120,199.800" },
    ] } },
  ],
  a11y: ["A list; each row reads as one sentence (name, type, balance, note).", "A negative balance carries a minus sign, not only a colour."],
});

catalog.push({
  name: "StatusChip", group: "Feedback", Component: StatusChip, purpose: "A status word with an icon and a tone: where a payment, an application or a request stands.",
  props: [
    { name: "label", type: "string", description: "The status in words." },
    { name: "tone", type: "positive | warning | negative | info | neutral", default: "neutral", description: "The colour and the default icon." },
    { name: "icon", type: "string", description: "An icon from the shared drawings, instead of the one that goes with the tone." },
  ],
  states: [
    { name: "Paid", props: { label: "Paid", tone: "positive" } },
    { name: "Waiting", props: { label: "Waiting for approval", tone: "warning" } },
    { name: "Rejected", props: { label: "Rejected", tone: "negative" } },
    { name: "Processing", props: { label: "Processing", tone: "info" } },
    { name: "Withdrawn", props: { label: "Withdrawn" } },
  ],
  a11y: ["The words and the icon carry the meaning; the colour only reinforces it.", "Text and background pairs come from the bank's own status colours, which the contrast check covers."],
  tokens: ["radius.pill"],
});

const STEPS = [
  { id: "a", title: "Started by Priya Nair", time: "12 Nov 2026 08:41" },
  { id: "b", title: "Approved by Alex Morgan", time: "12 Nov 2026 09:14", state: "done" as const },
  { id: "c", title: "Waiting for one more approver", text: "Value date 13 Nov 2026", state: "current" as const },
  { id: "d", title: "Released", state: "upcoming" as const },
];
catalog.push({
  name: "Timeline", group: "Lists", Component: Timeline, purpose: "What happened and what is still to come, top to bottom: a payment's or an application's history.",
  props: [
    { name: "items", type: "{ id, title, text?, time?, state? }[]", description: "The steps. state is done (default), current, upcoming (dashed) or failed." },
    { name: "label", type: "string", description: "Names the list for a screen reader." },
    { name: "strings", type: "{ done, current, upcoming, failed }", description: "What a screen reader says for each state, in the screen's language." },
  ],
  states: [
    { name: "In progress", props: { label: "Payment history", items: STEPS, strings: { done: "Done", current: "In progress", upcoming: "Not yet", failed: "Did not happen" } } },
    { name: "Rejected", props: { label: "Payment history", items: [STEPS[0]!, { id: "x", title: "Rejected by Dana Haddad", text: "Reason: amount does not match the invoice", state: "failed" as const }] } },
    { name: "One step", props: { items: [STEPS[0]!] } },
  ],
  a11y: ["An ordered list, so a screen reader announces the position of each step.", "The current step has aria-current=step; every state also has a spoken word, so it never relies on the dot's colour or shape.", "Long titles and notes wrap."],
});

const PEOPLE = [
  { id: "p1", cells: { payee: { text: "Zeta Supplies" }, amount: { text: "$1,200.50" }, status: { text: "Waiting for approval", chip: { label: "Waiting for approval", tone: "warning" as const, icon: "clock" } } } },
  { id: "p2", cells: { payee: { text: "Alpha Freight" }, amount: { text: "$80.00" }, status: { text: "Paid", chip: { label: "Paid", tone: "positive" as const, icon: "check" } } } },
];
const COLS = [
  { key: "payee", label: "Payee", sortable: true },
  { key: "amount", label: "Amount", align: "end" as const, sortable: true, sort: "desc" as const },
  { key: "status", label: "Status" },
];
const TABLE_STRINGS = { search: "Search", all: "All", clear: "Clear search and filters", prev: "Previous page", next: "Next page", selectRow: "Select {name}", selectAll: "Select all rows on this page", sortBy: "Sort by", asc: "ascending", desc: "descending", open: "Open" };
catalog.push({
  name: "DataTable", group: "Lists", Component: DataTable, purpose: "A list of records with search, filter chips, sortable headings, ticked rows and pages. On a phone each row is a card.",
  props: [
    { name: "label", type: "string", description: "Names the table for a screen reader." },
    { name: "layout", type: "table | cards", default: "table", description: "cards is one card per row, for a phone." },
    { name: "columns", type: "{ key, label, align?, sortable?, sort? }[]", description: "The headings; sort is the order the column is in now." },
    { name: "rows", type: "{ id, cells, selected?, onPress? }[]", description: "One entry per row; a cell is { text, chip? }. A row with onPress opens from its first cell." },
    { name: "onSort", type: "(key, dir?) => void", description: "A heading was pressed (no dir), or an order was chosen from the list on cards." },
    { name: "selectable / all / onToggleRow / onToggleAll / selection", type: "boolean / all | some | none / fns / string", description: "Tick boxes, the header box (which can be half-ticked) and the line that says how many are ticked." },
    { name: "search / filters / page", type: "objects", description: "The search box, the filter chips (an All chip first) and the pager with its summary line." },
    { name: "empty / onClear", type: "string / () => void", description: "What shows when there are no rows; onClear offers to undo the search and filters." },
    { name: "strings", type: "object", description: "The words around the table, in the screen's language." },
  ],
  states: [
    { name: "Table", props: { label: "Payments", columns: COLS, rows: PEOPLE, onSort: () => {}, strings: TABLE_STRINGS } },
    { name: "Ticked rows, search and filter", props: { label: "Payments", columns: COLS, rows: [{ ...PEOPLE[0]!, selected: true }, PEOPLE[1]!], selectable: true, all: "some", selection: "1 selected · total $1,200.50", search: { value: "", onChange: () => {} }, filters: [{ key: "status", label: "Status", value: "Paid", options: [{ value: "Paid", label: "Paid" }, { value: "Waiting for approval", label: "Waiting for approval" }], onChange: () => {} }], page: { summary: "1–2 of 40", index: 0, pages: 20, onPrev: () => {}, onNext: () => {} }, strings: TABLE_STRINGS } },
    { name: "Cards (phone)", props: { label: "Payments", layout: "cards", columns: COLS, rows: PEOPLE.map((r) => ({ ...r, onPress: () => {} })), selectable: true, onSort: () => {}, strings: TABLE_STRINGS } },
    { name: "Nothing found", props: { label: "Payments", columns: COLS, rows: [], empty: "No rows match your search or filters.", onClear: () => {}, search: { value: "zzz", onChange: () => {} }, strings: TABLE_STRINGS } },
  ],
  a11y: ["A real table with column headings (scope=col); a sorted heading says aria-sort, and sorting is a button in the heading.", "Every tick box is named by its row, and the header box is half-ticked when only some rows are.", "Search is a labelled field; filter chips are buttons with aria-pressed; the count of ticked rows and the page summary are announced politely.", "On a phone the same rows become cards with the same names, ticks and actions; the sort list replaces the headings."],
  tokens: ["field.height", "field.radius", "radius.lg"],
});

const FILE_STRINGS = { choose: "Choose a file", replace: "Choose another", remove: "Remove", drop: "or drop it here" };
catalog.push({
  name: "FileField", group: "Inputs", Component: FileField, purpose: "Choose a file by button or by dropping it: a payment file, a document, a picture.",
  props: [
    { name: "label", type: "string", description: "Names the field." },
    { name: "accept", type: "string", description: "The file input's accept list (.csv,.xml). Web only." },
    { name: "hint / helper / error", type: "string", description: "What may be chosen and how big; a line of help; what is wrong." },
    { name: "file", type: "{ name, detail? }", description: "The file chosen, with its size under the name." },
    { name: "onFile / onPick", type: "fn", description: "Web: a file was chosen or dropped. Phone: the button was pressed and the app opens its picker." },
    { name: "onRemove / busy / strings", type: "fn / boolean / object", description: "Remove the file; reading it; the words on the buttons." },
  ],
  states: [
    { name: "Empty", props: { label: "Payment file", accept: ".csv,.xml", hint: "CSV or XML, up to 256 KB.", strings: FILE_STRINGS } },
    { name: "Chosen", props: { label: "Payment file", accept: ".csv", file: { name: "october-payroll.csv", detail: "12 KB" }, strings: FILE_STRINGS, onRemove: () => {} } },
    { name: "Error", props: { label: "Payment file", accept: ".csv", error: "Use a CSV or XML file.", strings: FILE_STRINGS } },
    { name: "Reading", props: { label: "Payment file", accept: ".csv", busy: true, strings: FILE_STRINGS } },
  ],
  a11y: ["The real file input sits inside the button, so keyboard and screen readers use the browser's own control; it is named by the label, and the hint and error are tied to it.", "The error is announced; the chosen file's name is text, not only an icon.", "Dropping a file is an extra, never the only way."],
  tokens: ["button.radius", "button.border", "radius.lg"],
});

const PARAS = [{ heading: "1. Using the account", text: "You agree to keep your details up to date and to tell us if anything changes." }, { heading: "2. Payments", text: "A payment you approve cannot be undone once it has been released to the receiving bank." }, { text: "A long closing paragraph that has to wrap onto several lines without breaking the layout of the box it is drawn in." }];
catalog.push({
  name: "DocumentViewer", group: "Inputs", Component: DocumentViewer, purpose: "A text the person must read to the end (terms, an agreement) before going on.",
  props: [
    { name: "title / paragraphs", type: "string / { heading?, text }[]", description: "The document, in order." },
    { name: "read / onRead", type: "boolean / () => void", description: "Whether the end was reached; called once when it is (at once if the text fits)." },
    { name: "height / error / strings", type: "number / string / object", description: "The box's height; what is wrong; the words under the box." },
  ],
  states: [
    { name: "Not read yet", props: { title: "Terms of use", paragraphs: PARAS, read: false, height: 120, strings: { progress: "Scroll to the end to continue.", done: "You have read the whole document." } } },
    { name: "Read", props: { title: "Terms of use", paragraphs: PARAS, read: true, strings: { progress: "Scroll to the end to continue.", done: "You have read the whole document." } } },
    { name: "Error", props: { title: "Terms of use", paragraphs: PARAS, read: false, error: "Read the document to the end first.", strings: { progress: "Scroll to the end to continue.", done: "You have read the whole document." } } },
  ],
  a11y: ["The scrolling box is a named region that takes focus, so the keyboard scrolls it.", "Reaching the end is announced politely and is also written under the box; the text is real text, not an image."],
  tokens: ["radius.lg"],
});

const SIG_STRINGS = { type: "Type", draw: "Draw", name: "Type your full name", clear: "Clear", pad: "Signature box. Draw with a finger or a mouse; use Type for the keyboard.", modes: "How to sign" };
catalog.push({
  name: "SignaturePad", group: "Inputs", Component: SignaturePad, purpose: "Sign by typing a name or by drawing it.",
  props: [
    { name: "label / helper / error", type: "string", description: "Names the field; help; what is wrong." },
    { name: "modes / mode / onMode", type: "(type | draw)[] / type | draw / fn", description: "Which ways to sign are offered and the one in use." },
    { name: "name / onName", type: "string / fn", description: "The typed name." },
    { name: "path / onPath", type: "string / (path, points) => void", description: "The drawn line as a path, and how many points it has." },
  ],
  states: [
    { name: "Typed", props: { label: "Sign here", modes: ["type", "draw"], mode: "type", name: "Alex Morgan", strings: SIG_STRINGS } },
    { name: "Drawn", props: { label: "Sign here", modes: ["type", "draw"], mode: "draw", path: "M20 80 L60 40 L100 80 L140 40 L180 80", strings: SIG_STRINGS } },
    { name: "Error", props: { label: "Sign here", modes: ["type"], mode: "type", error: "Type your full name.", strings: SIG_STRINGS } },
  ],
  a11y: ["Typing a name is a plain labelled text field, so a keyboard and a screen reader can sign; drawing is an extra for a pointer or touch.", "The two ways are a radio group; the drawing box says in words how to use it and where the keyboard way is.", "The error is announced."],
  tokens: ["field.height", "field.radius", "radius.lg"],
});

const CAP_STRINGS = { capture: "Capture", retake: "Retake", done: "Captured", simulated: "Simulated: no camera is used and nothing is saved." };
catalog.push({
  name: "IdCapture", group: "Inputs", Component: IdCapture, purpose: "A simulated capture of an identity document and a selfie, step by step.",
  props: [
    { name: "label / error", type: "string", description: "Names the field; what is still to do." },
    { name: "steps", type: "{ id, label, hint, done, ref? }[]", description: "front, back and selfie, each with its state and the reference of the simulated picture." },
    { name: "onCapture", type: "(id) => void", description: "A step's button was pressed." },
  ],
  states: [
    { name: "Nothing yet", props: { label: "Verify your identity", steps: [{ id: "front", label: "Front of the document", hint: "Fit the whole document in the frame.", done: false }, { id: "selfie", label: "Selfie", hint: "Look at the camera in good light.", done: false }], strings: CAP_STRINGS } },
    { name: "Half done", props: { label: "Verify your identity", steps: [{ id: "front", label: "Front of the document", hint: "", done: true, ref: "SIM-FRONT-1" }, { id: "selfie", label: "Selfie", hint: "Look at the camera in good light.", done: false }], error: "Still to capture: selfie.", strings: CAP_STRINGS } },
  ],
  a11y: ["Each step is a list item with its own button named by the step and the action (Capture: Selfie).", "Done is written in words with the reference, not only drawn as a tick; the line under the title says it is simulated."],
});
