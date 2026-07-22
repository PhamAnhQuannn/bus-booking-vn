"""Check a candidate hero master against the acceptance criteria.

Usage:  python scripts/hero-candidate.py <image> [--out <dir>]

This is for a NEW MASTER, before it is cut into variants. Use hero-grade.py for
the four shipped variants afterwards.

Criteria come from the agent synthesis (see the plan file). The target is a bus
at 24% of frame width, sitting further down the road rather than shrunk in
place, with the approved sun / skyline / horizon composition preserved.

WHAT THIS CANNOT MEASURE, and why it does not pretend to:

  bus width, trailing margin, tyre y

Those are the three criteria that actually decide a candidate, and they are the
ones automated detection keeps getting wrong on these frames. Colour masking for
the bus failed three separate times during this work: on a golden-hour coastal
scene the sky, the sea reflection and the lit road are all the same orange as
the livery, and the fits it produced were geometrically impossible - 1.10x width
against 1.98x height for a rigid object. Rather than emit a confident wrong
number, this script writes a grid-overlaid copy so the three values can be read
off by eye in seconds.

The SUN is measurable, but only after blurring. A raw "brightest pixels"
centroid lands at x 0.243 on the current master, where the sun is actually at
0.09 - the glitter path on the water, the white bus flank and the headlights all
clear a top-0.1% threshold. Blurring first collapses those into the one
sustained glow: at radius w/80 it reports x 0.105, y 0.468 against a true
0.09 / 0.46. That is the version implemented here.

The HORIZON is deliberately NOT automated. It was tried and removed: on this
scene the sea/sky boundary is a soft haze transition with no strong edge, so a
row-gradient search returns 0.169 or 0.573 depending on the window - never the
true 0.39. Any threshold that found it would have been one tuned until it
matched an answer already known, which measures nothing. It is on the manual
list instead, where the grid overlay makes it a two-second read.
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# --- Acceptance criteria ------------------------------------------------------
BUS_W = (0.22, 0.26)          # manual
TRAIL_MARGIN_MIN = 0.09       # manual
TYRE_Y = (0.64, 0.72)         # manual - catches a shrink-in-place
SUN_X = (0.07, 0.11)
# ~0.50, NOT the 0.39 quoted in early analysis - that figure came from a visual
# estimate and is wrong. Corrected against two anchors on the current master:
# the sun measures y 0.468 and sits just above the waterline, and open sea is
# unambiguous below y 0.52. The band is wide because this is a hazy sunset with
# no hard sea/sky edge; the real instruction is "unchanged from the reference".
HORIZON_Y = (0.46, 0.56)
SKY_LUMA_MIN = 60             # navbar is glass w/ dark labels; was L>=0.855
MIN_WIDTH = 2560

ANSI = {"pass": "\033[32m", "fail": "\033[31m", "info": "\033[36m",
        "warn": "\033[33m", "off": "\033[0m"}


def luma(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def find_sun(a):
    """Largest sustained glow, found by blurring then taking the max.

    Blur radius scales with width (w/80) so the behaviour is resolution
    independent. Do NOT replace this with a percentile threshold on raw pixels:
    that was tried and reports x 0.243 on a master whose sun is at 0.09,
    because specular water, the white bus flank and the headlights all pass the
    threshold and drag the centroid right.
    """
    L = luma(a)
    radius = max(8, a.shape[1] // 80)
    blurred = np.asarray(
        Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    ).astype(float)
    y, x = np.unravel_index(blurred.argmax(), blurred.shape)
    return x / a.shape[1], y / a.shape[0]


def check(label, ok, measured, target):
    tag = "PASS" if ok else "FAIL"
    c = ANSI["pass"] if ok else ANSI["fail"]
    print(f"  {c}{tag}{ANSI['off']}  {label:<28} {measured:<22} target {target}")
    return ok


def grid_overlay(im, path):
    """Write a copy with 10% gridlines and the bus-target band marked, so the
    manual criteria can be read off directly."""
    g = im.convert("RGB").copy()
    d = ImageDraw.Draw(g, "RGBA")
    w, h = g.size
    for i in range(1, 10):
        x, y = w * i / 10, h * i / 10
        d.line([(x, 0), (x, h)], fill=(255, 255, 255, 90), width=1)
        d.line([(0, y), (w, y)], fill=(255, 255, 255, 90), width=1)
        d.text((x + 3, 3), f"{i/10:.1f}", fill=(255, 255, 0, 220))
        d.text((3, y + 3), f"{i/10:.1f}", fill=(255, 255, 0, 220))
    # Target bus box: 24% wide centred at x 0.77, tyres in the 0.64-0.72 band.
    d.rectangle([w * 0.65, h * 0.40, w * 0.89, h * TYRE_Y[1]],
                outline=(0, 255, 0, 230), width=3)
    d.text((w * 0.65 + 5, h * 0.40 + 5), "target bus box (0.65-0.89)",
           fill=(0, 255, 0, 255))
    # Trailing-margin floor.
    d.line([(w * 0.91, 0), (w * 0.91, h)], fill=(255, 0, 0, 200), width=2)
    d.text((w * 0.91 + 4, h * 0.5), "rear must be left of this",
           fill=(255, 80, 80, 255))
    g.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--out", default="hero-candidate-out")
    a_ = ap.parse_args()
    if not os.path.isfile(a_.image):
        sys.exit(f"not found: {a_.image}")

    im = Image.open(a_.image).convert("RGB")
    w, h = im.size
    a = np.asarray(im).astype(float)
    print(f"\n{ANSI['info']}{os.path.basename(a_.image)}{ANSI['off']}  {w}x{h}"
          f"  aspect {w/h:.4f}")

    ok = []
    ok.append(check("native width", w >= MIN_WIDTH, f"{w}px", f">= {MIN_WIDTH}px"))

    sky = luma(a[: int(h * 0.125)])
    ok.append(check("sky luma (top 12.5%)", sky.mean() >= SKY_LUMA_MIN,
                    f"{sky.mean():.0f}", f">= {SKY_LUMA_MIN}"))

    sx, sy = find_sun(a)
    ok.append(check("sun x", SUN_X[0] <= sx <= SUN_X[1],
                    f"{sx:.3f}  (y {sy:.3f})", f"{SUN_X[0]}-{SUN_X[1]}"))

    os.makedirs(a_.out, exist_ok=True)
    grid = os.path.join(a_.out, os.path.splitext(os.path.basename(a_.image))[0]
                        + "-grid.png")
    grid_overlay(im, grid)

    print(f"\n  {ANSI['info']}MANUAL — read these off {grid}{ANSI['off']}")
    print(f"    bus width         target {BUS_W[0]}-{BUS_W[1]} of frame "
          f"(green box shows 0.65-0.89)")
    print(f"    trailing margin   target >= {TRAIL_MARGIN_MIN} "
          f"(rear left of the red line)")
    print(f"    tyre y            target {TYRE_Y[0]}-{TYRE_Y[1]}")
    print(f"    horizon y         target {HORIZON_Y[0]}-{HORIZON_Y[1]} "
          f"(soft haze edge — not automatable, see module docstring)")
    print("    ^ the tyre check is the important one: a smaller bus whose tyres")
    print("      are still near y 0.83 was shrunk IN PLACE, not moved down the")
    print("      road. Reject it - it will not read as distance.")

    bad = len([x for x in ok if not x])
    if bad:
        print(f"\n  {ANSI['fail']}{bad} automated check(s) failed.{ANSI['off']}"
              "  Manual checks still needed.\n")
        return 1
    print(f"\n  {ANSI['pass']}Automated checks pass.{ANSI['off']}"
          "  Now do the three manual ones.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
