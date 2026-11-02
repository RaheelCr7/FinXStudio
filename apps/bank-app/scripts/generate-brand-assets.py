#!/usr/bin/env python3
"""
Generates the app icon set from one accent colour, so every bank gets its own branded icons.

    python3 scripts/generate-brand-assets.py                 # default FinX teal
    python3 scripts/generate-brand-assets.py --accent "#0F6E56" --detail "#E3C25B"

Needs Pillow (pip install pillow). Writes into ./assets:
  icon.png (iOS and legacy), android-icon-foreground/background/monochrome.png, splash-icon.png, favicon.png
"""
import argparse
from pathlib import Path
try:
    from PIL import Image, ImageDraw
except ImportError as exc:  # missing, or installed for another CPU (an Intel copy on an Apple Silicon Mac)
    raise SystemExit(
        f"Pillow could not be loaded ({exc.__class__.__name__}). Install or repair it, then run this again:\n"
        "  python3 -m pip install --upgrade --force-reinstall pillow"
    ) from None

SS = 4          # supersampling for smooth edges
OUT = 1024


def rgba(hex_color: str, alpha: int = 255):
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def glyph(size: int, color, detail=None, scale: float = 0.56) -> Image.Image:
    """A classic bank building on a transparent square canvas. `scale` is the glyph's share of the canvas."""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box = big * scale
    ox, oy = (big - box) / 2, (big - box) / 2

    def P(x, y):  # glyph units (0..100) to pixels
        return (ox + x / 100 * box, oy + y / 100 * box)

    def rect(x0, y0, x1, y1, fill, r=0):
        a, b = P(x0, y0), P(x1, y1)
        if r:
            d.rounded_rectangle([a, b], radius=r / 100 * box, fill=fill)
        else:
            d.rectangle([a, b], fill=fill)

    d.polygon([P(50, 6), P(94, 31), P(6, 31)], fill=color)                      # pediment
    rect(10, 36, 90, 43, detail or color, r=1.5)                                  # entablature
    for cx in (23.75, 41.25, 58.75, 76.25):                                               # four columns
        rect(cx - 5, 48, cx + 5, 74, color, r=1.5)
    rect(8, 79, 92, 86, color, r=1.5)                                             # base
    rect(3, 90, 97, 96, color, r=1.5)                                             # step
    return img.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--accent", default="#0F6E56", help="brand colour, e.g. #0F6E56")
    ap.add_argument("--detail", default="#E3C25B", help="small accent detail colour")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "assets"))
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    teal, white, detail = rgba(a.accent), rgba("#FFFFFF"), rgba(a.detail)

    # iOS and legacy icon: full-bleed square, no transparency
    icon = Image.new("RGBA", (OUT, OUT), teal)
    icon.alpha_composite(glyph(OUT, white, detail, 0.56))
    icon.convert("RGB").save(out / "icon.png")

    # Android adaptive icon: foreground sits inside the central safe zone, background is the brand colour
    glyph(OUT, white, detail, 0.46).save(out / "android-icon-foreground.png")
    Image.new("RGBA", (OUT, OUT), teal).save(out / "android-icon-background.png")
    glyph(OUT, rgba("#FFFFFF"), None, 0.46).save(out / "android-icon-monochrome.png")  # themed icons use the alpha only

    # splash: white glyph on transparent, drawn over the brand colour by the splash screen
    glyph(OUT, white, detail, 0.62).save(out / "splash-icon.png")

    # web favicon
    fav = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    ImageDraw.Draw(fav).rounded_rectangle([0, 0, 255, 255], radius=56, fill=teal)
    fav.alpha_composite(glyph(256, white, detail, 0.62))
    fav.resize((48, 48), Image.LANCZOS).save(out / "favicon.png")
    print(f"Wrote brand assets for {a.accent} to {out}")


if __name__ == "__main__":
    main()
