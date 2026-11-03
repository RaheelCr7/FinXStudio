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
import { Accordion } from "./web/Accordion";

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
    ],
    states: [
      { name: "Empty", props: { label: "Mobile number", value: "", helper: "10 to 14 digits", keyboard: "phone" } },
      { name: "Filled", props: { label: "Mobile number", value: "03001234567" } },
      { name: "Error", props: { label: "Mobile number", value: "0300", error: "Enter 10 to 14 digits" } },
      { name: "Password", props: { label: "Password", value: "hunter22", secure: true } },
      { name: "Outlined", props: { label: "Username", value: "", look: "outlined" } },
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
    props: [{ name: "title", type: "string", description: "The heading." }, { name: "action", type: "{ label, onPress }", description: "A link at the far end." }],
    states: [
      { name: "With link", props: { title: "Welcome", action: { label: "English", onPress: () => {} } } },
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
