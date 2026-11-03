import { ICON_SHAPES } from "@finx/ui-kit";

/** An icon from the shared drawings, as an inline SVG that takes the surrounding text colour. Decorative unless given a label. */
export function Icon({ name, size = 22, stroke = 2, label, className }: { name: string; size?: number; stroke?: number; label?: string; className?: string }) {
  const shapes = ICON_SHAPES[name];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      {shapes?.map((sh, i) => ("d" in sh ? <path key={i} d={sh.d} /> : <rect key={i} x={sh.rect.x} y={sh.rect.y} width={sh.rect.width} height={sh.rect.height} rx={sh.rect.rx} />))}
    </svg>
  );
}
