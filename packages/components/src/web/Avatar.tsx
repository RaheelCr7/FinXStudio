import type { AvatarProps } from "../props";

/** The initials of a name: first and last word. */
export const initialsOf = (name: string) => { const w = name.trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1]![0]! : "")).toUpperCase(); };

/** A circle with a person's initials, and their name under it. */
export function Avatar({ name, text }: AvatarProps) {
  return (
    <div className="fxc-avatar">
      <span className="fxc-avatar-disc" aria-hidden>{initialsOf(name)}</span>
      <span className="fxc-avatar-name">{name}</span>
      {text ? <span className="fxc-avatar-text">{text}</span> : null}
    </div>
  );
}
