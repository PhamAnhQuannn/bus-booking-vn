"""Cut the BBVN brand assets from the supplied logo contact sheet.

Usage:  python scripts/brand-cut.py <sheet-A.png> [--out public/brand] [--dry-run]

Source is a 1536x1024 contact sheet holding four lockups on pure black:

    x split 781, y split 444
      TL  horizontal, orange mark + orange BB + white VN
      TR  horizontal, all white
      BL  stacked, orange
      BR  stacked, all white

ONLY sheet A (white-on-black) is used. The companion sheet with the dark bus and
dark "VN" cannot be extracted: its dark ink measures RGB ~46-50 against a
background of 0, with ~20% of the quadrant sitting in an ambiguous 1-20 band
between them, so no threshold separates artwork from background without either
jagging the edges or leaving a black halo. Its design is instead REPRODUCED here
by recolouring sheet A's white pixels to dark ink - the two differ only in that
one substitution, and saturation separates the classes cleanly (measured: 68% of
ink is saturated orange, 32% is neutral white).

Alpha recovery is the standard screen-on-black inverse. A pixel of colour C at
coverage a observes as C*a, so with both inks peaking at max-channel 255
(verified on this sheet) a = max(R,G,B)/255 and C = observed/a.
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image

SPLIT_X, SPLIT_Y = 781, 444

# Sampled from the companion sheet's dark wordmark.
INK = (46, 46, 46)
# Brand orange, for icon backplates. Matches manifest.ts theme_color.
ORANGE = (255, 106, 0)
# Pixels at or below this saturation are the "white" class.
NEUTRAL_MAX_SAT = 0.35


def extract(rgb):
    """Screen-on-black -> straight RGBA."""
    a = rgb.astype(float)
    alpha = a.max(axis=2) / 255.0
    safe = np.maximum(alpha, 1e-6)[..., None]
    colour = np.clip(a / safe, 0, 255)
    out = np.zeros(a.shape[:2] + (4,), dtype=np.uint8)
    out[..., :3] = colour.round().astype(np.uint8)
    out[..., 3] = np.clip(alpha * 255, 0, 255).round().astype(np.uint8)
    return out


def recolour_neutrals(rgba, ink):
    """Swap the white ink for `ink`, leaving saturated (orange) pixels alone.

    This is what reproduces the companion sheet's light-background colourway.
    Operates on straight (un-premultiplied) colour so anti-aliased edges keep
    their coverage and simply change hue.
    """
    out = rgba.copy()
    c = out[..., :3].astype(float)
    mx, mn = c.max(axis=2), c.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    mask = (sat <= NEUTRAL_MAX_SAT) & (out[..., 3] > 0)
    out[mask, 0], out[mask, 1], out[mask, 2] = ink
    return out


def tight_crop(rgba, pad=0):
    ys, xs = np.where(rgba[..., 3] > 8)
    y0, y1 = ys.min(), ys.max() + 1
    x0, x1 = xs.min(), xs.max() + 1
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(rgba.shape[0], y1 + pad), min(rgba.shape[1], x1 + pad)
    return rgba[y0:y1, x0:x1]


def on_plate(glyph_rgba, size, bg, coverage):
    """Centre a glyph on a solid square plate.

    `coverage` is the fraction of the plate the glyph's LONGEST side may occupy.
    Maskable icons need this well under 1: Android crops to a circle inscribed in
    the central 80%, so anything outside that can be cut off.
    """
    g = Image.fromarray(tight_crop(glyph_rgba), "RGBA")
    target = int(size * coverage)
    scale = target / max(g.size)
    g = g.resize((max(1, round(g.size[0] * scale)), max(1, round(g.size[1] * scale))),
                 Image.LANCZOS)
    plate = Image.new("RGBA", (size, size), bg + (255,))
    plate.paste(g, ((size - g.size[0]) // 2, (size - g.size[1]) // 2), g)
    return plate


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("--out", default="public/brand")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sheet = np.asarray(Image.open(args.sheet).convert("RGB"))
    h, w = sheet.shape[:2]
    print(f"sheet {w}x{h}")
    if (w, h) != (1536, 1024):
        print("  WARNING: expected 1536x1024; the split constants are keyed to it")

    quads = {
        "tl": sheet[0:SPLIT_Y, 0:SPLIT_X],
        "tr": sheet[0:SPLIT_Y, SPLIT_X:w],
        "bl": sheet[SPLIT_Y:h, 0:SPLIT_X],
        "br": sheet[SPLIT_Y:h, SPLIT_X:w],
    }
    art = {k: extract(v) for k, v in quads.items()}

    # The mark is the left cluster of the horizontal lockup; the sheet leaves a
    # 27px empty gutter at x 329-356 between mark and wordmark. Slice at the
    # middle of that gutter so neither side clips.
    MARK_CUT = 342
    mark_colour = tight_crop(art["tl"][:, :MARK_CUT])
    mark_white = tight_crop(art["tr"][:, :MARK_CUT])

    outputs = {
        "logo-horizontal.png": tight_crop(recolour_neutrals(art["tl"], INK)),
        "logo-horizontal-white.png": tight_crop(art["tr"]),
        "logo-vertical.png": tight_crop(recolour_neutrals(art["bl"], INK)),
        "logo-vertical-white.png": tight_crop(art["br"]),
        "logo-mark.png": recolour_neutrals(mark_colour, INK),
        "logo-mark-white.png": mark_white,
    }

    os.makedirs(args.out, exist_ok=True)
    for name, rgba in outputs.items():
        print(f"  {name:<28} {rgba.shape[1]}x{rgba.shape[0]}")
        if not args.dry_run:
            Image.fromarray(rgba, "RGBA").save(os.path.join(args.out, name))

    # --- icons ---------------------------------------------------------------
    # icon-192/512 keep the transparent colour glyph the site already ships.
    # The maskable and apple plates use the WHITE glyph on orange: a colour glyph
    # on an orange plate would put orange on orange.
    colour_glyph = recolour_neutrals(mark_colour, INK)
    icons = [
        ("icon-192.png", on_plate(colour_glyph, 192, (0, 0, 0), 0.92), True),
        ("icon-512.png", on_plate(colour_glyph, 512, (0, 0, 0), 0.92), True),
        ("icon-512-maskable.png", on_plate(mark_white, 512, ORANGE, 0.60), False),
        ("apple-touch-icon.png", on_plate(mark_white, 180, ORANGE, 0.72), False),
    ]
    for name, img, transparent in icons:
        if transparent:
            # on_plate filled an opaque black plate; drop it back to transparent.
            arr = np.asarray(img).copy()
            g = Image.fromarray(tight_crop(colour_glyph), "RGBA")
            size = img.size[0]
            target = int(size * 0.92)
            scale = target / max(g.size)
            g = g.resize((max(1, round(g.size[0] * scale)),
                          max(1, round(g.size[1] * scale))), Image.LANCZOS)
            img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            img.paste(g, ((size - g.size[0]) // 2, (size - g.size[1]) // 2), g)
        print(f"  {name:<28} {img.size[0]}x{img.size[1]}")
        if not args.dry_run:
            img.save(os.path.join(args.out, name))

    # favicon: multi-size ICO off the colour glyph on transparent.
    fav = Image.fromarray(tight_crop(colour_glyph), "RGBA")
    side = max(fav.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(fav, ((side - fav.size[0]) // 2, (side - fav.size[1]) // 2), fav)
    print(f"  {'favicon.ico':<28} 16/32/48")
    if not args.dry_run:
        sq.save(os.path.join(args.out, "favicon.ico"),
                sizes=[(16, 16), (32, 32), (48, 48)])

    if args.dry_run:
        print("\n(dry run - nothing written)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
