"""Grade a candidate hero image against the HARD requirements.

Usage:  python scripts/hero-grade.py <image> [--out <dir>]

Every rule prints the MEASURED number, not just a verdict — a candidate that
fails E1 at 0.851 is a re-grade away from passing, one that fails at 0.62 needs
a regeneration, and pass/fail alone cannot tell those apart.

Two luminance scales are in play here on purpose, so do not unify them:
  - E1/E2 use WCAG relative luminance (0-1, sRGB-linearised). These thresholds
    are derived from contrast ratios, so they must use the definition WCAG does.
    Check: #CA3500 has L=0.151, and (L_bg+0.05)/(0.151+0.05) = 4.5 solves to
    L_bg = 0.8545 — that is where E1's 0.855 comes from.
  - D5 uses perceptual luma on 0-255 (0.299R+0.587G+0.114B), because the
    mockup's sigma-64 baseline was measured on that scale this session.
    Converting one side only would make the comparison meaningless.

CAREFUL, D5 baselines are not interchangeable. The mockup's 64 is a RAW image
measurement, so a raw candidate compares against it directly. The "ours 12.8"
figure quoted in the plan is NOT raw — it was taken off a rendered screenshot
with the CSS wash on top. Raw, the same master measures 29.0. Grade candidates
raw against 40; judge the shipped result on a screenshot instead.

Grade only clean photographs. Do NOT grade a design mockup or a page
screenshot: those have UI drawn into them, so E1b reads the navbar's own dark
label pixels (the reference mockup scores p2 = 0.006 for exactly this reason,
not because its sky is dark) and E2 reads rendered headline text. On such an
image only D5 and F1 mean anything.

Requirement IDs refer to the plan file (run-the-server-nifty-pascal.md).
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image

# --- Region boxes, as fractions of the image. From the plan's B/E sections. ---
NAVBAR_STRIP = (0.00, 1.00, 0.000, 0.125)  # x0,x1,y0,y1 — E1
LEFT_THIRD = (0.00, 0.33, 0.150, 0.640)  # D5, matches the session's gutter box
TEXT_REGION = (0.23, 0.66, 0.250, 0.830)  # E2
BUS_REGION = (0.58, 0.95, 0.080, 0.560)  # C-group, visual check only

ANSI = {"pass": "\033[32m", "fail": "\033[31m", "info": "\033[36m", "off": "\033[0m"}


def relative_luminance(rgb):
    """WCAG 2.x relative luminance. rgb is a float array 0-255, any shape."""
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def perceptual_luma(rgb):
    """0-255 luma. Same formula the session's sigma baselines were taken with."""
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def hsv_saturation(rgb):
    """HSV S channel, 0-1. Mean over a region is what F1's 35-45% refers to."""
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    # Black pixels have no defined saturation; report them as 0 rather than NaN.
    return np.where(mx == 0, 0.0, (mx - mn) / np.maximum(mx, 1e-9))


def crop(arr, box):
    h, w = arr.shape[:2]
    x0, x1, y0, y1 = box
    return arr[int(h * y0) : int(h * y1), int(w * x0) : int(w * x1)]


class Report:
    def __init__(self):
        self.rows = []

    def add(self, rule, name, ok, measured, target):
        self.rows.append((rule, name, ok, measured, target))

    def hard_failures(self):
        return [r for r in self.rows if not r[2]]

    def render(self):
        print()
        for rule, name, ok, measured, target in self.rows:
            tag = "PASS" if ok else "FAIL"
            colour = ANSI["pass"] if ok else ANSI["fail"]
            print(
                f"  {colour}{tag}{ANSI['off']}  {rule:<6} {name:<34} "
                f"measured {measured:<26} target {target}"
            )
        print()


def grade(path, out_dir):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    a = np.asarray(im).astype(float)
    rep = Report()

    print(f"\n{ANSI['info']}{os.path.basename(path)}{ANSI['off']}  {w}x{h}")

    # --- A1: aspect ---------------------------------------------------------
    aspect = w / h
    rep.add("A1", "aspect ratio", abs(aspect - 1.5) <= 0.0075,
            f"{aspect:.4f}", "1.500 +/- 0.5%")

    # --- A3: delivery size --------------------------------------------------
    rep.add("A3", "width >= 1920", w >= 1920, f"{w}px", ">= 1920px")

    # --- E1: navbar strip ---------------------------------------------------
    strip = crop(a, NAVBAR_STRIP)
    strip_L = relative_luminance(strip)
    strip_S = hsv_saturation(strip)
    # Minimum is measured on a 2% low percentile, not the single darkest pixel:
    # one stray dark pixel (a bird, sensor noise) should not fail an otherwise
    # clean sky, but a dark BAND covering 2% of the strip genuinely will sit
    # under a nav label somewhere across 1024-1920.
    strip_min = np.percentile(strip_L, 2)
    rep.add("E1a", "navbar strip mean luminance", strip_L.mean() >= 0.855,
            f"{strip_L.mean():.3f}", ">= 0.855")
    rep.add("E1b", "navbar strip min (p2) luminance", strip_min >= 0.80,
            f"{strip_min:.3f}", ">= 0.80")
    rep.add("E1c", "navbar strip saturation", strip_S.mean() <= 0.12,
            f"{strip_S.mean() * 100:.1f}%", "<= 12%")

    # --- D5: left-third texture --------------------------------------------
    gutter_sigma = perceptual_luma(crop(a, LEFT_THIRD)).std()
    rep.add("D5", "left-third texture sigma", gutter_sigma >= 40,
            f"{gutter_sigma:.1f}", ">= 40  (this master raw 29.0, mockup 64)")

    # --- E2: text region ----------------------------------------------------
    text_L = relative_luminance(crop(a, TEXT_REGION))
    dark_frac = float((text_L < 0.25).mean())
    rep.add("E2a", "text region mean luminance", 0.30 <= text_L.mean() <= 0.45,
            f"{text_L.mean():.3f}", "0.30 - 0.45")
    rep.add("E2b", "text region dark pixels", dark_frac <= 0.02,
            f"{dark_frac * 100:.1f}% below L 0.25", "<= 2%")

    # --- F1: saturation -----------------------------------------------------
    sat = hsv_saturation(a).mean()
    rep.add("F1", "overall saturation", 0.35 <= sat <= 0.45,
            f"{sat * 100:.1f}%", "35 - 45%  (master 40.8%)")

    rep.render()

    # --- B2/C3 proxy — reported, not graded ---------------------------------
    # The real rule is "nothing essential below y=56%", and "essential" is not
    # something a histogram knows. What CAN be measured is where the dark
    # subject mass sits: the bus reads by its dark trim (C7), so the lowest row
    # carrying a meaningful run of dark pixels approximates its base.
    luma = perceptual_luma(a)
    dark_by_row = (luma < np.percentile(luma, 12)).mean(axis=1)
    substantive = np.where(dark_by_row > 0.05)[0]
    print(f"  {ANSI['info']}B2/C3{ANSI['off']}   dark-mass proxy: lowest row with "
          f">5% dark pixels is y={substantive.max() / h * 100:.1f}%"
          if substantive.size
          else f"  {ANSI['info']}B2/C3{ANSI['off']}   no dark mass found")
    print("           (advisory — 'essential' is a judgement, verify on the crop below)")

    # --- C-group: crop for eyeball verification -----------------------------
    # Deliberately NOT automated. Colour masking to find the bus failed twice
    # this session: on a sunset frame the sky, the sea reflection and the lit
    # road are all the same orange as the livery, and the fits it produced were
    # geometrically impossible (1.10x width against 1.98x height for a rigid
    # object). A wrong number here is worse than no number.
    os.makedirs(out_dir, exist_ok=True)
    bus_path = os.path.join(out_dir, "bus-region.png")
    bx0, bx1, by0, by1 = BUS_REGION
    im.crop((int(w * bx0), int(h * by0), int(w * bx1), int(h * by1))).save(bus_path)
    print(f"\n  {ANSI['info']}C1-C7{ANSI['off']}   manual check -> {bus_path}")
    print("           whole vehicle in frame? roof above y=15%? wheels above y=50%?")
    print("           dark trim separating from sky? ~20-26% of frame width?")

    fails = rep.hard_failures()
    if fails:
        print(f"\n  {ANSI['fail']}{len(fails)} HARD requirement(s) failed:"
              f"{ANSI['off']} {', '.join(f[0] for f in fails)}\n")
        return 1
    print(f"\n  {ANSI['pass']}All measurable HARD requirements pass.{ANSI['off']} "
          "Bus geometry still needs the visual check above.\n")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("image")
    ap.add_argument("--out", default="hero-grade-out",
                    help="where to write the bus-region crop")
    args = ap.parse_args()
    if not os.path.isfile(args.image):
        sys.exit(f"not found: {args.image}")
    sys.exit(grade(args.image, args.out))


if __name__ == "__main__":
    main()
