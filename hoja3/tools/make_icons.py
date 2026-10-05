#!/usr/bin/env python3
"""
HHL Gamepad Config (hoja3) - app icon generator.

Writes the master SVGs *and* every PNG/ICO raster from one shared set of
geometry numbers, so the vector and bitmap versions always match.

    python hoja3/tools/make_icons.py

Requires Pillow (>= 10.1 for multi-image ICO). No cairo needed: shapes are
drawn procedurally at 4x supersampling and downscaled with LANCZOS.
"""
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # .../hoja3
APP_DIR = os.path.join(ROOT, "assets", "icons", "app")
SPLASH_DIR = os.path.join(ROOT, "assets", "icons", "splash")

SS = 4          # supersampling factor
U = 1024        # design units (viewBox 0 0 1024 1024)
CX = CY = U / 2

# ---- palette (exact) -------------------------------------------------------
RED, YELLOW, BLUE, GREEN = "#E23B3B", "#F4B41A", "#2F6BD8", "#23A35A"
LAVENDER = "#8E7CC3"
GRAY_L, GRAY_M, GRAY_D = "#E9E8EE", "#C9C7D3", "#6E6B7B"
BG_DARK, SURFACE_DARK, BG_LIGHT = "#121117", "#1B1A22", "#F8F7F4"
WHITE = "#FFFFFF"
TILE_GRAD = ("grad", SURFACE_DARK, BG_DARK)  # top -> bottom

# ---- master geometry (design units) ---------------------------------------
TILE_R = 230            # tile corner radius
RING_R, RING_W = 430, 16  # lavender accent ring (center-line radius, width)
PAD_R = 372             # light console-gray pad face
PAD_BEVEL = 20          # mid-gray lip visible under the pad face
WELL_EXTENT = 292       # rounded-diamond button well: center -> tip distance
WELL_RX = 130
WELL_SIDE = (WELL_EXTENT + WELL_RX * (math.sqrt(2) - 1)) * math.sqrt(2)
BTN_OFF = 165           # button center distance from icon center
BTN_R = 98
BTN_SHADOW = 14         # dark crescent offset under each button

# SFC layout: X top (blue), A right (red), B bottom (yellow), Y left (green)
BUTTONS = [(0, -1, BLUE), (1, 0, RED), (0, 1, YELLOW), (-1, 0, GREEN)]

# ---- favicon geometry (simplified for 16-48 px) ---------------------------
FAV_PAD_R = 430
FAV_BTN_OFF = 205
FAV_BTN_R = 120

MASKABLE_SCALE = 0.80   # keeps artwork inside the 80% safe-zone circle
MONO_SCALE = 0.80
APPLE_SCALE = 0.90
TILE_SCALE = 0.70       # mstile


# ---------------------------------------------------------------------------
# Primitive builders.  Each primitive is a tuple:
#   ("rrect", x, y, w, h, r, paint)
#   ("circle", cx, cy, r, paint)
#   ("ring", cx, cy, r, width, paint)
#   ("rdiamond", cx, cy, side, r, paint)  rounded square rotated 45deg
#   ("cutdisc", cx, cy, r, [(hx, hy, hr), ...], paint)  disc with holes
# paint is "#RRGGBB" or ("grad", top, bottom)
# ---------------------------------------------------------------------------
def _s(v, k):
    return v * k


def _p(v, k):
    return CX + (v - CX) * k


def artwork(k=1.0, ring=True):
    """Pad face + well + buttons, scaled by k about the icon center."""
    prims = []
    if ring:
        prims.append(("ring", CX, CY, _s(RING_R, k), _s(RING_W, k), LAVENDER))
    prims.append(("circle", CX, _p(CY + PAD_BEVEL, k), _s(PAD_R, k), GRAY_M))
    prims.append(("circle", CX, CY, _s(PAD_R, k), GRAY_L))
    prims.append(("rdiamond", CX, CY, _s(WELL_SIDE, k), _s(WELL_RX, k), GRAY_M))
    for dx, dy, col in BUTTONS:
        bx, by = CX + dx * BTN_OFF, CY + dy * BTN_OFF
        prims.append(("circle", _p(bx, k), _p(by + BTN_SHADOW, k), _s(BTN_R, k), GRAY_D))
        prims.append(("circle", _p(bx, k), _p(by, k), _s(BTN_R, k), col))
    return prims


def icon_any():
    return [("rrect", 0, 0, U, U, TILE_R, TILE_GRAD)] + artwork(1.0)


def icon_fullbleed(k):
    return [("rrect", 0, 0, U, U, 0, TILE_GRAD)] + artwork(k)


def icon_monochrome():
    k = MONO_SCALE
    holes = [(_p(CX + dx * BTN_OFF, k), _p(CY + dy * BTN_OFF, k), _s(BTN_R, k))
             for dx, dy, _ in BUTTONS]
    return [("cutdisc", CX, CY, _s(PAD_R, k), holes, WHITE)]


def icon_favicon():
    prims = [("rrect", 0, 0, U, U, TILE_R, TILE_GRAD),
             ("circle", CX, CY, FAV_PAD_R, GRAY_L)]
    for dx, dy, col in BUTTONS:
        prims.append(("circle", CX + dx * FAV_BTN_OFF, CY + dy * FAV_BTN_OFF, FAV_BTN_R, col))
    return prims


# ---------------------------------------------------------------------------
# SVG writer
# ---------------------------------------------------------------------------
def _f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s if s != "-0" else "0"


def _circle_path(cx, cy, r):
    return (f"M{_f(cx - r)} {_f(cy)}a{_f(r)} {_f(r)} 0 1 0 {_f(2 * r)} 0"
            f"a{_f(r)} {_f(r)} 0 1 0 {_f(-2 * r)} 0z")


def to_svg(prims, title):
    defs, body = [], []
    grad_id = None

    def paint(p):
        nonlocal grad_id
        if isinstance(p, tuple):
            if grad_id is None:
                grad_id = "tile"
                defs.append(
                    f'<linearGradient id="{grad_id}" x1="0" y1="0" x2="0" y2="1">'
                    f'<stop offset="0" stop-color="{p[1]}"/>'
                    f'<stop offset="1" stop-color="{p[2]}"/></linearGradient>')
            return f"url(#{grad_id})"
        return p

    for pr in prims:
        kind = pr[0]
        if kind == "rrect":
            _, x, y, w, h, r, pt = pr
            rx = f' rx="{_f(r)}"' if r else ""
            body.append(f'<rect x="{_f(x)}" y="{_f(y)}" width="{_f(w)}" height="{_f(h)}"{rx} fill="{paint(pt)}"/>')
        elif kind == "circle":
            _, cx, cy, r, pt = pr
            body.append(f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r)}" fill="{paint(pt)}"/>')
        elif kind == "ring":
            _, cx, cy, r, w, pt = pr
            body.append(f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r)}" fill="none" stroke="{paint(pt)}" stroke-width="{_f(w)}"/>')
        elif kind == "rdiamond":
            _, cx, cy, side, r, pt = pr
            body.append(f'<rect x="{_f(cx - side / 2)}" y="{_f(cy - side / 2)}" width="{_f(side)}" height="{_f(side)}" '
                        f'rx="{_f(r)}" transform="rotate(45 {_f(cx)} {_f(cy)})" fill="{paint(pt)}"/>')
        elif kind == "cutdisc":
            _, cx, cy, r, holes, pt = pr
            d = _circle_path(cx, cy, r) + "".join(_circle_path(*h) for h in holes)
            body.append(f'<path fill-rule="evenodd" d="{d}" fill="{paint(pt)}"/>')
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {U} {U}" width="{U}" height="{U}">',
           f"<title>{title}</title>"]
    if defs:
        out.append("<defs>" + "".join(defs) + "</defs>")
    out += body
    out.append("</svg>")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# PIL renderer
# ---------------------------------------------------------------------------
def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _paint_layer(pt, n, y0, y1):
    if isinstance(pt, tuple):
        top, bot = _rgb(pt[1]), _rgb(pt[2])
        col = Image.new("RGBA", (1, n))
        span = max(1.0, y1 - y0)
        px = col.load()
        for y in range(n):
            t = min(1.0, max(0.0, (y + 0.5 - y0) / span))
            px[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bot)) + (255,)
        return col.resize((n, n), Image.NEAREST)
    return Image.new("RGBA", (n, n), _rgb(pt) + (255,))


def _rounded_square_pts(cx, cy, side, r, angle_deg, steps=48):
    h = side / 2 - r
    pts = []
    for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ccx, ccy = sx * h, sy * h
        for i in range(steps + 1):
            a = math.radians(a0 + 90 * i / steps)
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    ca, sa = math.cos(math.radians(angle_deg)), math.sin(math.radians(angle_deg))
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]


def render(prims, px, ss=SS):
    n = px * ss
    k = n / U
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    for pr in prims:
        kind = pr[0]
        mask = Image.new("L", (n, n), 0)
        d = ImageDraw.Draw(mask)
        y0, y1 = 0, n
        if kind == "rrect":
            _, x, y, w, h, r, pt = pr
            box = [x * k, y * k, (x + w) * k - 1, (y + h) * k - 1]
            if r:
                d.rounded_rectangle(box, radius=r * k, fill=255)
            else:
                d.rectangle(box, fill=255)
            y0, y1 = y * k, (y + h) * k
        elif kind == "circle":
            _, cx, cy, r, pt = pr
            d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=255)
        elif kind == "ring":
            _, cx, cy, r, w, pt = pr
            ro = r + w / 2
            d.ellipse([(cx - ro) * k, (cy - ro) * k, (cx + ro) * k, (cy + ro) * k],
                      outline=255, width=max(1, round(w * k)))
        elif kind == "rdiamond":
            _, cx, cy, side, r, pt = pr
            d.polygon([(x * k, y * k) for x, y in _rounded_square_pts(cx, cy, side, r, 45)], fill=255)
        elif kind == "cutdisc":
            _, cx, cy, r, holes, pt = pr
            d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=255)
            for hx, hy, hr in holes:
                d.ellipse([(hx - hr) * k, (hy - hr) * k, (hx + hr) * k, (hy + hr) * k], fill=0)
        else:
            raise ValueError(kind)
        layer = _paint_layer(pt, n, y0, y1)
        layer.putalpha(mask)
        img.alpha_composite(layer)
    return img.resize((px, px), Image.LANCZOS)


def flatten(img, bg):
    out = Image.new("RGB", img.size, _rgb(bg))
    out.paste(img, mask=img.split()[3])
    return out


# ---------------------------------------------------------------------------
# Shortcut glyphs (24-unit line art, same style as ui.svg)
# ---------------------------------------------------------------------------
GLYPH_UPDATE = [  # download into tray (matches ui.svg #i-install)
    [(12, 3), (12, 14)],
    [(7, 9), (12, 14), (17, 9)],
    [(3, 15), (3, 20.5), (21, 20.5), (21, 15)],
]
GLYPH_ARENA = [  # crossed swords (matches ui.svg #i-arena)
    [(3.5, 3.5), (16.5, 16.5)], [(14.4, 18.6), (18.6, 14.4)], [(16.5, 16.5), (20, 20)],
    [(20.5, 3.5), (7.5, 16.5)], [(9.6, 18.6), (5.4, 14.4)], [(7.5, 16.5), (4, 20)],
]


def shortcut(glyph, color, px=96, ss=SS):
    n = px * ss
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, n - 1, n - 1], fill=_rgb(color) + (255,))
    area = n * 0.56
    k = area / 24
    off = (n - area) / 2
    w = 2.2 * k
    white = (255, 255, 255, 255)
    for pl in glyph:
        pts = [(off + x * k, off + y * k) for x, y in pl]
        d.line(pts, fill=white, width=round(w), joint="curve")
        for x, y in pts:
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=white)
    return img.resize((px, px), Image.LANCZOS)


SPLASH_SIZES = [(1290, 2796), (1179, 2556), (1284, 2778), (1170, 2532),
                (750, 1334), (2048, 2732), (1668, 2388), (1640, 2360)]
SPLASH_ICON_FRAC = 0.30


def main():
    os.makedirs(APP_DIR, exist_ok=True)
    os.makedirs(SPLASH_DIR, exist_ok=True)

    def w_svg(name, prims, title):
        with open(os.path.join(APP_DIR, name), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(to_svg(prims, title))

    def w_png(name, img, folder=APP_DIR):
        img.save(os.path.join(folder, name), optimize=True)
        print("wrote", os.path.relpath(os.path.join(folder, name), ROOT))

    name = "HHL Gamepad Config"
    w_svg("icon.svg", icon_any(), name)
    w_svg("icon-maskable.svg", icon_fullbleed(MASKABLE_SCALE), name)
    w_svg("icon-monochrome.svg", icon_monochrome(), name)
    w_svg("favicon.svg", icon_favicon(), name)

    # "any" icons: simplified favicon geometry below 64 px for legibility
    fav = {}
    for px in (16, 32, 48):
        fav[px] = render(icon_favicon(), px)
        w_png(f"icon-{px}.png", fav[px])
    for px in (96, 192, 512, 1024):
        w_png(f"icon-{px}.png", render(icon_any(), px))

    for px in (192, 512):
        w_png(f"maskable-{px}.png", flatten(render(icon_fullbleed(MASKABLE_SCALE), px), BG_DARK))
    w_png("monochrome-512.png", render(icon_monochrome(), 512))
    w_png("apple-touch-icon.png", flatten(render(icon_fullbleed(APPLE_SCALE), 180), BG_DARK))
    w_png("mstile-150.png", flatten(render(icon_fullbleed(TILE_SCALE), 150), BG_DARK))

    ico = os.path.join(APP_DIR, "favicon.ico")
    fav[48].save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)],
                 append_images=[fav[16], fav[32]])
    print("wrote", os.path.relpath(ico, ROOT))

    w_png("shortcut-update.png", shortcut(GLYPH_UPDATE, BLUE))
    w_png("shortcut-arena.png", shortcut(GLYPH_ARENA, RED))

    cache = {}
    for (sw, sh) in SPLASH_SIZES:
        isz = round(min(sw, sh) * SPLASH_ICON_FRAC)
        if isz not in cache:
            cache[isz] = render(icon_any(), isz)
        canvas = Image.new("RGB", (sw, sh), _rgb(BG_DARK))
        canvas.paste(cache[isz], ((sw - isz) // 2, (sh - isz) // 2), cache[isz])
        w_png(f"splash-{sw}x{sh}.png", canvas, SPLASH_DIR)


if __name__ == "__main__":
    main()
