"""Replace the bus's hallucinated livery with the real BBVN lockup.

Usage:  python scripts/hero-logo.py <master> [-o <out>] [--dry-run]

Runs BETWEEN the super-resolution pass and scripts/hero-cut.py:

    ChatGPT master 1672x941  ->  realesrgan-x4plus 4x  ->  hero-logo.py  ->  hero-cut.py

WHY THIS EXISTS
---------------
The master is AI-generated, and the generator painted an approximation of the
brand on the bus flank: a doubled-B roundel, the wordmark as "BBVn" (lowercase
n), and beneath it a second line that is illegible gibberish rather than "BUS
BOOKING". At the native 1672px those glyphs are ~9-11px of cap height, blurry
enough to read as "a logo". Super-resolving to 4x renders them SHARPLY, which is
strictly worse: a blur reads as a low-resolution photo, whereas a crisply drawn
wrong wordmark reads as a real brand claim. It lands on the most-looked-at object
on the homepage.

So the artwork is erased and public/brand/logo-horizontal-white.png is warped
onto the flank in its place.

GEOMETRY IS MEASURED, NOT GUESSED
---------------------------------
The flank plane's perspective is derived from the ARTWORK ITSELF, because no
colour mask can isolate the panel -- this is a golden-hour scene and the sky is
the same hue as the orange livery (an attempt at hue segmentation returned a
single component covering the whole 6688x3764 frame). The three cap glyphs give
the plane directly:

    cap glyph      centre x    top y    height
    B              5379        2385     68
    B              5415        2390     66
    V              5448        2394     65

  -> top edge slope  d(top)/dx = +9/69 = +0.1304   (plane tilts down to the right)
  -> height slope    d(h)/dx   = -3/69 = -0.0435   px of height per px of x

The lowercase 'n' at x[5468,5494] is EXCLUDED from the height fit: it is an
x-height glyph, not a cap, and including it understates the cap line.

Height is linear in x, not hyperbolic. A homography maps lines to lines, so the
panel's top and bottom edges are each straight in image space and their
difference h(x) is therefore linear. An earlier pass fitted h = k/(x-v) to the
same three points and got a plausible-looking vanishing point, but that was
overfitting three noisy samples with a model the projection cannot produce.

These numbers describe THIS master. If the photograph is ever regenerated they
all become wrong -- re-measure before trusting this script on a new frame.
"""

import argparse
import os
import sys

import cv2
import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(REPO, "public", "brand", "logo-horizontal-white.png")

# Work box around the flank artwork, kept strictly INSIDE the orange panel.
# A taller box clipped the darker window band above and the seam below, and the
# panel fit then had to model two surfaces at once (grain sigma 6.79 vs 3.16).
BOX = (5200, 2312, 5530, 2534)  # x0, y0, x1, y1

# Measured plane gradients (see module docstring).
TOP_SLOPE = 9.0 / 69.0
H_SLOPE = -3.0 / 69.0
CAP_REF_X = 5379.0   # centre x of the first cap glyph
CAP_AT_REF = 68.0    # its measured cap height

# Destination anchor: left edge of the artwork block being replaced.
# The real lockup is wider per unit cap height than the AI one (6.9x vs 4.0x)
# because of the mark plus the "BUS BOOKING" rule, so it cannot both match the
# old cap height AND fit the old footprint. 360 keeps the decal close to the
# artwork it replaces (272 wide) without shrinking the wordmark to illegibility,
# and leaves clear margin before the rear vent at x~5706.
DEST_X = 5222
DEST_W = 360
ART_CY = 2413  # centre of the artwork block y[2323,2503]

# The flank is in shadow: its existing white livery ink renders at RGB
# (151, 149, 151), NOT 255. Compositing at full white made the lockup read as a
# sticker lying on the paint rather than sprayed into it. Measured on the eroded
# CORE of the old artwork so anti-aliased edge pixels do not drag it down.
INK_LEVEL = 150.0

# Master this script's constants were measured against.
EXPECT_SIZE = (6688, 3764)


def _poly_basis(xx, yy):
    """Quadratic basis for the smooth panel model."""
    return np.stack([np.ones_like(xx), xx, yy, xx * xx, xx * yy, yy * yy], 1)


def panel_model_and_mask(img, iters=4, thresh=7.0):
    """Fit the flank panel; flag the artwork as positive residual against it.

    HSV thresholding does NOT work here and this is worth stating plainly,
    because it is the obvious thing to reach for. The hallucinated sub-line is
    not white ink: measured over x[5385,5490] y[2470,2495] its saturation median
    is 245 against a clean panel's 248, so no saturation cut separates the two.
    A (s<110, v>95) mask caught 116 of 2625 pixels and the glyphs were still
    legible after inpainting.

    What DOES separate them is brightness against the local panel gradient
    (V p90 175 vs panel 151). So fit a quadratic per channel with iterative
    outlier rejection and treat pixels ABOVE that surface as ink. Only positive
    residual is flagged, which leaves the darker panel seams and shadow lines
    untouched.
    """
    x0, y0, x1, y1 = BOX
    sub = img[y0:y1, x0:x1].astype(np.float64)
    h, w = sub.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    A = _poly_basis((xx / w - 0.5).ravel(), (yy / h - 0.5).ravel())

    keep = np.ones(h * w, bool)
    model = np.zeros_like(sub)
    for _ in range(iters):
        for c in range(3):
            coef, *_ = np.linalg.lstsq(A[keep], sub[:, :, c].ravel()[keep], rcond=None)
            model[:, :, c] = (A @ coef).reshape(h, w)
        keep = (sub - model).mean(2).ravel() < thresh

    ink = (~keep).reshape(h, w).astype(np.uint8)
    ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    full = np.zeros(img.shape[:2], np.uint8)
    full[y0:y1, x0:x1] = ink
    return full, model


def reconstruct(img, mask, model, rng):
    """Replace flagged pixels with the fitted panel plus matched grain."""
    x0, y0, x1, y1 = BOX
    out = img.copy()
    sub = out[y0:y1, x0:x1].astype(np.float64)
    grow = cv2.dilate((mask[y0:y1, x0:x1] > 0).astype(np.uint8),
                      np.ones((9, 9), np.uint8)) > 0
    clean = ~grow
    sigma = float((sub - model)[clean].std()) if clean.any() else 2.0

    # The panel's grain is spatially correlated -- it comes out of the super-
    # resolver, not a sensor. Per-pixel white noise at this sigma reads as
    # television static against it, so correlate the field before scaling it
    # back to the measured amplitude.
    noise = rng.normal(0.0, 1.0, size=sub.shape)
    noise = cv2.GaussianBlur(noise, (0, 0), 1.2)
    noise *= sigma / max(noise.std(), 1e-6)

    filled = np.where(grow[:, :, None], model + noise, sub)
    a = cv2.GaussianBlur(grow.astype(np.float64), (0, 0), 3.0)[:, :, None]
    out[y0:y1, x0:x1] = np.clip(sub * (1 - a) + filled * a, 0, 255).astype(np.uint8)
    print(f"    panel grain sigma {sigma:.2f}")
    return out


def dest_quad():
    """The lockup's four corners on the flank plane."""
    h_left = CAP_AT_REF + H_SLOPE * (DEST_X - CAP_REF_X)
    h_right = CAP_AT_REF + H_SLOPE * (DEST_X + DEST_W - CAP_REF_X)
    shrink = h_right / h_left

    # Pick the left-edge height so the quad's MEAN height matches what the
    # logo's own aspect wants at this image-space width; splitting it this way
    # keeps the lockup from reading as squashed at either end.
    hl = (DEST_W / (681.0 / 289.0)) * 2.0 / (1.0 + shrink)
    hr = hl * shrink
    top_l = ART_CY - hl / 2.0
    top_r = top_l + TOP_SLOPE * DEST_W
    print(f"    plane cap height {h_left:.1f} (x={DEST_X}) -> {h_right:.1f} "
          f"(x={DEST_X + DEST_W}), foreshorten {shrink:.3f}")
    print(f"    quad height {hl:.1f} -> {hr:.1f}")
    return np.float32([
        [DEST_X, top_l],
        [DEST_X + DEST_W, top_r],
        [DEST_X + DEST_W, top_r + hr],
        [DEST_X, top_l + hl],
    ])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("master")
    ap.add_argument("-o", "--out", default=None)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    src = np.asarray(Image.open(a.master).convert("RGB"))
    H, W = src.shape[:2]
    print(f"master {W}x{H}")
    if (W, H) != EXPECT_SIZE:
        print(f"REFUSING: constants were measured on {EXPECT_SIZE[0]}x{EXPECT_SIZE[1]}. "
              f"Every coordinate in this file is absolute; on a differently sized "
              f"master they point at the wrong pixels. Re-measure first.")
        return 1

    rng = np.random.default_rng(20260730)
    mask, model = panel_model_and_mask(src)
    print(f"    artwork ink pixels: {int(mask.sum())}")
    cleaned = reconstruct(src, mask, model, rng)

    logo = np.asarray(Image.open(LOGO).convert("RGBA")).astype(np.float32)
    lh, lw = logo.shape[:2]
    M = cv2.getPerspectiveTransform(
        np.float32([[0, 0], [lw, 0], [lw, lh], [0, lh]]), dest_quad())
    warped = cv2.warpPerspective(logo, M, (W, H), flags=cv2.INTER_LANCZOS4,
                                 borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

    # Tint the ink to the panel's own light. The residual mask CANNOT be used
    # for this: it flags every pixel above the panel surface, including orange
    # highlights, and sampling it returns rgb (154, 103, 75) -- orange, which
    # dyes the lockup. Isolate the white ink by the one property that does
    # distinguish it, low saturation.
    x0, y0, x1, y1 = BOX
    sub = src[y0:y1, x0:x1]
    hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV)
    white = cv2.erode(((hsv[:, :, 1] < 80) & (hsv[:, :, 2] > 130)).astype(np.uint8),
                      np.ones((7, 7), np.uint8))
    ink_px = sub[white > 0].astype(np.float32)
    tint = ink_px.mean(0) / ink_px.mean(0).max()
    print(f"    white-ink core rgb={ink_px.mean(0).round(1).tolist()} "
          f"level={ink_px.mean():.0f} tint={tint.round(3).tolist()}")

    ink = warped[:, :, :3] / 255.0 * tint[None, None, :] * INK_LEVEL
    alpha = (warped[:, :, 3:4] / 255.0) * 0.94  # just under full, so it sits in the paint
    out = np.clip(cleaned.astype(np.float32) * (1 - alpha) + ink * alpha, 0, 255).astype(np.uint8)

    if a.dry_run:
        print("(dry run - nothing written)")
        return 0

    dest = a.out or os.path.splitext(a.master)[0] + "-logo.png"
    tmp = dest + ".tmp.png"
    Image.fromarray(out).save(tmp)
    os.replace(tmp, dest)
    print(f"wrote {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
