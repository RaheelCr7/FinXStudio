#!/usr/bin/env python3
"""Reads a bank's design frames (PNG exports from Figma) and writes the look they show: colours, field and button sizes, corner radii.

  python3 scripts/extract-look.py design/artea --name Artea --out design/artea/look.json

Measurements are taken from solid areas (buttons, fields, bars, cards), so they are exact to about 1 px at the export scale (use --scale 2 for
2x exports). Everything is reported with how many frames agree. Needs Pillow only.
"""
import argparse, json, os, sys, time
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import figma_measure as m  # noqa: E402


def chroma(c):
    return max(c) - min(c)


def is_neutral(c):
    return chroma(c) <= 18


def frames_in(root, min_side=300, max_side=3300):
    out = []
    for d, _, fs in os.walk(root):
        for f in sorted(fs):
            if not f.lower().endswith(".png"):
                continue
            p = os.path.join(d, f)
            try:
                w, h = m.load(p).size
            except Exception:
                continue
            if min(w, h) >= min_side and max(w, h) <= max_side * 2 and w * h <= 9_000_000:
                out.append((p, w, h))
    return out


PREFERRED = ("login", "sign in", "signin", "default", "enrol", "onboard", "transfer", "account", "welcome", "pin", "home", "payment")


def relevance(path):
    n = os.path.basename(path).lower()
    return 0 if any(k in n for k in PREFERRED) else 1


def measure(path, scale):
    im = m.load(path)
    found = []
    for r in m.flat_rects(im, min_w=int(100 * scale), min_h=int(26 * scale), max_h=int(110 * scale)):
        seed = (r[0] + 10, r[1] + 3 if r[3] - r[1] < 30 else (r[1] + r[3]) // 2 - 12)
        try:
            b = m.region_bbox(im, seed, tol=2, limit=60000)
        except Exception:
            continue
        wd, ht = m.size(b)
        if ht < 26 * scale or ht > 110 * scale or wd < 100 * scale:
            continue
        found.append({"w": wd, "h": ht, "fill": r[4], "radius": m.corner_radius(im, b), "border": m.border(im, b), "frame_w": im.size[0]})
    # a bar across the top: a wide solid band with a saturated colour
    px = im.load()
    bar = None
    for y in (2, 6, 10):
        c = px[im.size[0] // 2, y]
        # only on a single phone screen (a wide sheet's top edge is the design file's own title band)
        if chroma(c) > 40 and im.size[0] <= 460 * scale * 1.7:
            bar = c
            break
    return found, bar, im.size


def mode(values, default=None):
    return Counter(values).most_common(1)[0][0] if values else default


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--name", default=None)
    ap.add_argument("--scale", type=float, default=1.0, help="2 when the frames were exported at 2x")
    ap.add_argument("--max-frames", type=int, default=60)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    frames = frames_in(a.folder)
    frames.sort(key=lambda t: (relevance(t[0]), t[1] * t[2]))  # sign-in, onboarding and account screens first, small ones before big sheets
    frames = frames[: a.max_frames]
    if not frames:
        sys.exit(f"No PNG frames found in {a.folder}")

    allr, bars, used, by_frame = [], [], [], {}
    t0 = time.time()
    for p, w, h in frames:
        rs, bar, _ = measure(p, a.scale)
        if rs:
            used.append(os.path.relpath(p, a.folder))
        allr += rs
        by_frame[p] = rs
        if bar:
            bars.append(m.hexc(bar))
    s = a.scale

    # buttons: solid, saturated, tall enough to press, wide
    saturated = [r for r in allr if chroma(r["fill"]) > 60 and 36 * s <= r["h"] <= 72 * s and r["w"] >= 180 * s]
    # the accent is the action colour that appears in the most frames (a one-off, like a toast, does not count)
    in_frames = Counter()
    for rs in by_frame.values():
        for c in {m.hexc(r["fill"]) for r in rs if chroma(r["fill"]) > 60 and 36 * s <= r["h"] <= 72 * s and r["w"] >= 180 * s}:
            in_frames[c] += 1
    action_colours = Counter(m.hexc(r["fill"]) for r in saturated)
    accent = max(in_frames, key=lambda c: (in_frames[c], action_colours[c])) if in_frames else None
    buttons = [r for r in saturated if m.hexc(r["fill"]) == accent]
    # fields: light, near-neutral fills (or white with an outline), the height of a form field
    fieldish = [r for r in allr if is_neutral(r["fill"]) and sum(r["fill"]) > 3 * 225 and 44 * s <= r["h"] <= 60 * s and 280 * s <= r["w"] <= 620 * s]
    field_fill = Counter(m.hexc(r["fill"]) for r in fieldish).most_common(1)[0][0] if fieldish else None
    fields = [r for r in fieldish if m.hexc(r["fill"]) == field_fill]
    borders = Counter(r["border"] for r in fields if r["border"])

    def dp(v):
        return round(v / s, 1) if v is not None else None

    def spec(rs):
        return {"height": dp(mode([r["h"] for r in rs])), "radius": dp(mode([r["radius"] for r in rs])), "width": dp(mode([r["w"] for r in rs])), "samples": len(rs)}

    look = {
        "name": a.name or os.path.basename(os.path.normpath(a.folder)),
        "scale": s,
        "frames": {"read": len(frames), "with_measurements": len(used)},
        "accent": accent,
        "accent_frames": dict(in_frames.most_common(4)),
        "bar": mode(bars),
        "button": spec(buttons) if buttons else None,
        "field": {**spec(fields), "fill": field_fill, "border": borders.most_common(1)[0][0] if borders else None} if fields else None,
        "other_fills": dict(Counter(m.hexc(r["fill"]) for r in allr if not is_neutral(r["fill"])).most_common(6)),
        "seconds": round(time.time() - t0, 1),
    }
    text = json.dumps(look, indent=2)
    print(text)
    if a.out:
        with open(a.out, "w") as f:
            f.write(text + "\n")


if __name__ == "__main__":
    main()
