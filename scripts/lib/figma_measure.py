"""Measures what a bank's design frames contain, from PNG exports. Pillow only (no numpy): works on any machine that builds the apps."""
from PIL import Image

def load(path):
    return Image.open(path).convert("RGB")

def hexc(p):
    return "#%02X%02X%02X" % p[:3]

def near(a, b, tol=10):
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol

def background(im):
    """The colour of the canvas around the designs: read along the bottom edge (a design file's own title band can sit at the top)."""
    w, h = im.size
    cs = [im.getpixel(p) for p in [(1, h - 2), (w - 2, h - 2), (w // 2, h - 2)]]
    return max(set(cs), key=cs.count)

def boxes(im, bg=None, tol=10, min_w=12, min_h=12, step=1):
    """Bounding boxes of every connected object that is not the canvas colour, as (x0, y0, x1, y1) inclusive. Objects touching are merged."""
    bg = bg or background(im)
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    out = []
    for y0 in range(0, h, step):
        for x0 in range(0, w, step):
            i = y0 * w + x0
            if seen[i] or near(px[x0, y0], bg, tol):
                continue
            stack = [(x0, y0)]; seen[i] = 1
            x_lo = x_hi = x0; y_lo = y_hi = y0
            while stack:
                x, y = stack.pop()
                if x < x_lo: x_lo = x
                if x > x_hi: x_hi = x
                if y < y_lo: y_lo = y
                if y > y_hi: y_hi = y
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and not near(px[nx, ny], bg, tol):
                            seen[j] = 1; stack.append((nx, ny))
            if x_hi - x_lo + 1 >= min_w and y_hi - y_lo + 1 >= min_h:
                out.append((x_lo, y_lo, x_hi, y_hi))
    return out

def size(b):
    return (b[2] - b[0] + 1, b[3] - b[1] + 1)

def dist(a, b):
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))

def corner_radius(im, b, tol=None):
    """The corner radius of the object in box b, from how the left edge steps in along the top rows: the arc ends once the edge is straight."""
    px = im.load()
    x0, y0, x1, y1 = b
    h = y1 - y0 + 1
    outside = px[max(x0 - 2, 0), max(y0 - 2, 0)] if x0 > 2 and y0 > 2 else px[x0 + (x1 - x0) // 2, max(y0 - 2, 0)]
    if tol is None:
        # how different the object is from what is around it decides how strict "background" is
        tol = max(1, min(14, dist(px[(x0 + x1) // 2, y0 + h // 2], outside) // 3))
    offs = []
    for dy in range(0, min(40, h // 2 + 1)):
        y = y0 + dy
        off = None
        for x in range(x0, min(x0 + 60, x1)):
            if not near(px[x, y], outside, tol):
                off = x - x0
                break
        offs.append(off if off is not None else 60)
    base = min(offs)
    d = len(offs)
    for dy, o in enumerate(offs):
        if o <= base:
            d = dy
            break
    # on a circle the edge looks straight again at dy = r - sqrt(r); solve that for r
    return round(((1 + (1 + 4 * d) ** 0.5) / 2) ** 2) if d > 0 else 0

def fill(im, b):
    x0, y0, x1, y1 = b
    return hexc(im.getpixel(((x0 + x1) // 2, y0 + 3)))

def border(im, b):
    """The colour of the outline if the object has one (its edge differs from its inside), else None."""
    x0, y0, x1, y1 = b
    y = (y0 + y1) // 2
    edge, inner = im.getpixel((x0, y)), im.getpixel((x0 + 4, y))
    return None if near(edge, inner, 6) else hexc(edge)


def flat_rects(im, min_w=120, min_h=28, max_h=96, tol=0):
    """Solid rectangles (buttons, fields, cards, bars): finds long same-colour runs along rows, joins the rows they continue over, then
    trims to the real top and bottom at the rectangle's left edge, so text inside does not cut a rectangle short."""
    w, h = im.size
    px = im.load()
    from itertools import groupby
    found = {}
    for y in range(h):
        row = [px[x, y] for x in range(w)]
        x = 0
        for colour, grp in groupby(row):
            n = len(list(grp))
            if n >= min_w:
                found.setdefault((colour, x // 3, ), []).append((y, x, x + n - 1))
            x += n
    rects = []
    for (colour, _), runs in found.items():
        runs.sort()
        start = prev = runs[0]
        top = prev[0]
        for r in runs[1:] + [None]:
            if r is not None and r[0] <= prev[0] + 1 and abs(r[1] - prev[1]) <= 3:
                prev = r
                continue
            x0 = min(start[1], prev[1]); x1 = max(start[2], prev[2])
            y0, y1 = top, prev[0]
            probe = x0 + 8
            while y0 > 0 and near(px[probe, y0 - 1], colour, tol + 2):
                y0 -= 1
            while y1 < h - 1 and near(px[probe, y1 + 1], colour, tol + 2):
                y1 += 1
            hh = y1 - y0 + 1
            if min_h <= hh <= max_h:
                rects.append((x0, y0, x1, y1, colour))
            if r is not None:
                start = prev = r; top = r[0]
    # the same rectangle can be found twice (runs split by text): keep one per position
    best = {}
    for r in rects:
        key = (r[1], r[3], r[4])
        if key not in best or (r[2] - r[0]) > (best[key][2] - best[key][0]):
            best[key] = r
    return sorted(best.values(), key=lambda r: (r[1], r[0]))


def region_bbox(im, seed, tol=3, limit=400000):
    """The box of the same-coloured area around a point (text and icons inside it are ignored, as they are other colours)."""
    w, h = im.size
    px = im.load()
    base = px[seed]
    seen = {seed}
    stack = [seed]
    x_lo = x_hi = seed[0]; y_lo = y_hi = seed[1]
    while stack and len(seen) < limit:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and near(px[nx, ny], base, tol):
                seen.add((nx, ny)); stack.append((nx, ny))
                if nx < x_lo: x_lo = nx
                if nx > x_hi: x_hi = nx
                if ny < y_lo: y_lo = ny
                if ny > y_hi: y_hi = ny
    return (x_lo, y_lo, x_hi, y_hi)
