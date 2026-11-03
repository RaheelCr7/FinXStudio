import { Icon } from "./Icon";
import type { KeypadKey, KeypadProps, PinDotsProps } from "../props";

export const KEYPAD_ROWS: (KeypadKey | "")[][] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "back"]];


/** A number pad. It only reports which key was pressed; the screen decides what that does to the value. */
export function Keypad({ onKey, labels = { back: "Delete" } }: KeypadProps) {
  return (
    <div className="fxc-keypad" dir="ltr">
      {KEYPAD_ROWS.flat().map((k, i) => k === "" ? <span key={i} /> : (
        <button key={i} type="button" className="fxc-key" aria-label={k === "back" ? labels.back : k} onClick={() => onKey?.(k)}>
          {k === "back" ? <Icon name="backspace" size={20} /> : k}
        </button>
      ))}
    </div>
  );
}


/** The boxes above a keypad: dots when masked, the digits otherwise. */
export function PinDots({ length, filled, masked = true, digits = "", label }: PinDotsProps) {
  return (
    <div className="fxc-dashes" dir="ltr" role="img" aria-label={`${label}. ${filled}/${length}`}>
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`fxc-dash ${i === filled ? "is-active" : ""}`}><span>{i < filled ? (masked ? "•" : digits[i]) : ""}</span></span>
      ))}
    </div>
  );
}
