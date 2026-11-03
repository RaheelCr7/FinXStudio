import type { MapPinsProps } from "../props";
import { Icon } from "./Icon";

/** Where the pins sit inside the map, as percentages, with a margin so none touches the edge. A single pin sits in the middle. */
export function pinPositions(pins: MapPinsProps["pins"]): Record<string, { x: number; y: number }> {
  const lats = pins.map((p) => p.lat), lngs = pins.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const at = (v: number, lo: number, hi: number) => (hi === lo ? 50 : 12 + ((v - lo) / (hi - lo)) * 76);
  return Object.fromEntries(pins.map((p) => [p.id, { x: at(p.lng, minLng, maxLng), y: 100 - at(p.lat, minLat, maxLat) }]));
}

/**
 * A schematic map: the places as pins on a plain grid, placed by their latitude and longitude. It draws no streets or tiles
 * (that needs a map provider and its key); a bank that has one can replace this component without changing any journey.
 */
export function MapPins({ pins, selected, label, onSelect, height = 220 }: MapPinsProps) {
  const pos = pinPositions(pins);
  return (
    <div className="fxc-map" role="group" aria-label={label} style={{ height }}>
      {pins.map((p) => (
        <button key={p.id} type="button" className={`fxc-pin ${selected === p.id ? "is-selected" : ""}`} style={{ left: `${pos[p.id]!.x}%`, top: `${pos[p.id]!.y}%` }} aria-label={p.label} aria-pressed={selected === p.id} onClick={() => onSelect?.(p.id)}>
          <Icon name="mapPin" size={selected === p.id ? 34 : 26} />
        </button>
      ))}
    </div>
  );
}
