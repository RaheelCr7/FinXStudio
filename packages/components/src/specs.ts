import type { ComponentSpec } from "./spec";
import { Button } from "./web/Button";
import { TextField } from "./web/TextField";
import { AppBar } from "./web/AppBar";
import { ListRow } from "./web/ListRow";
import { Keypad, PinDots } from "./web/Keypad";

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
