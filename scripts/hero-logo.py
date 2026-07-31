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
#
# x1 stays at 5530 even though the decal now reaches 5632. Widening it to 5650 to
# "cover the whole decal" was tried and made things WORSE: the fit degraded (grain
# sigma 3.16 -> 4.01) and the illumination it produced stopped tracking the paint
# (correlation with the real falloff dropped 0.976 -> 0.568) while overshooting
# into the clamp. The narrow box is better conditioned; its shape is right and
# only its amplitude is short, which MODULATION_GAIN corrects.
#
# y1 stops at 2498 to stay ABOVE the panel seam (y 2502-2519), whose dark line
# would otherwise drag the fit -- the robust pass rejects only positive residuals,
# so a dark seam survives it.
BOX = (5200, 2312, 5530, 2498)  # x0, y0, x1, y1  -- where the panel is FITTED

# ...but the old artwork reaches y 2522, BELOW that. Fitting and erasing must
# therefore use different regions: shrinking BOX to 2498 left the artwork's lower
# fragments (x[5283,5329] y[2507,2522]) outside the erase mask, and they survived
# as a stray light shape under the monogram. The panel model is simply evaluated
# down here rather than fitted here.
ERASE_BOX = (5200, 2312, 5530, 2534)

# Measured plane gradients (see module docstring).
TOP_SLOPE = 9.0 / 69.0
H_SLOPE = -3.0 / 69.0
CAP_REF_X = 5379.0   # centre x of the first cap glyph
CAP_AT_REF = 68.0    # its measured cap height

# Destination anchor: left edge of the artwork block being replaced.
#
# Size and centre are SOLVED against the panel's real boundaries, not chosen.
# The usable band is only ~225px tall and both of its edges slope:
#
#   panel top (orange/window)   y 2265 @ x5220  ->  2332 @ x5640
#   horizontal panel seam       y 2502 @ x5240  ->  2519 @ x5660
#
# and the panel top descends FASTER (0.1595/px) than the decal's own top edge
# (TOP_SLOPE 0.1304/px), so clearance shrinks left-to-right and the binding
# corner is the top-RIGHT one. Solving for the largest width keeping >=10px at
# all four corners gives W=410, cy=2390: top 26/14, bottom 13/23.
#
# W=430 looked fine on the left and left only 2.9px at the top right. The
# previous W=360/cy=2413 cleared the seam by 3.0px, i.e. the decal was sitting
# ON the panel seam -- a line running through the base of the monogram, which is
# part of why it read as "broken".
#
# The rear vent is NOT a constraint: measured at x[5712,5753] y[2560,2680], it is
# both right of and below the decal.
DEST_X = 5222
DEST_W = 410
ART_CY = 2390

# Panel boundaries, measured. Used to ASSERT containment after the quad is built,
# because the margins are 13-26px and a later constant change would eat them
# silently.
def panel_top_at(x):
    return 2265.0 + (2332.0 - 2265.0) / (5640.0 - 5220.0) * (x - 5220.0)


def panel_seam_at(x):
    return 2502.0 + (2519.0 - 2502.0) / (5660.0 - 5240.0) * (x - 5240.0)


MIN_MARGIN = 10.0

# The wordmark's "BUS BOOKING" rule and its flanking dashes are ERASED before
# warping. Measured on the source: they land 2.0-2.9 CSS px tall at every
# breakpoint (mobile 2.22, md 1.96, lg 2.14, 3xl 2.86), which cannot be drawn --
# 10 of the lockup's 26 components are thinner than one CSS pixel on screen, the
# thinnest 0.34px, and they alias into the grey smear under BBVN. For the rule to
# reach a legible 8px the decal would have to span ~292 CSS px, about 65% of the
# whole visible bus.
#
# Erase by ALPHA within the wordmark column, never by cropping the canvas: the
# mark spans y[0,287], nearly the full height, so a crop would behead it.
#   MARK      x[0,296]    y[0,287]
#   WORDMARK  x[321,681]  y[113,246], with a clean row gap at y[212,228]
TAGLINE_X0 = 321
TAGLINE_Y0 = 228

# The flank is in shadow, so the decal is NOT full white -- compositing at 255
# made the lockup read as a sticker lying on the paint rather than sprayed into
# it. But 150, taken from the eroded core of the old artwork, was too dark: it
# left the decal dimmer than the vehicle's own paintwork and, worse, gave it no
# separation in the red channel.
#
#     decal   rgb(151.9, 143.3, 140.2)
#     orange  rgb(154.0,  60.0,   3.9)
#             R  -2.0     G +83.3   B +136.3
#
# The decal's red was IDENTICAL to the orange it sits on, so the logo separated
# only through green and blue and read grey rather than white. Raising the level
# fixes brightness and separation together, because all three channels scale.
#
# WHERE THE CEILING ACTUALLY IS. An earlier pass set this to 165 on the grounds
# that "the brightest white bodywork is 162.3" -- but that figure was the MEAN of
# a detected blob, dragged down by shaded and anti-aliased edge pixels, and it
# badly understated the real whites. Measured against the whole frame instead:
#
#     frame luma   p50 139.9 | p75 187.2 | p90 204.8 | p95 209.6 | p99 232.0
#     white pixels on the bus itself, p99: 250.0
#
# At 165 the decal sat near the frame's 60th PERCENTILE, i.e. darker than most of
# the image, which is why it kept reading grey however the numbers were framed.
#
# Chosen off a rendered ladder (172/190/210/230 composited and compared at true
# render scale) rather than from a formula, after three formula-driven guesses in
# a row missed. Measured on the decal, with the frame percentile it lands at:
#
#     INK   mark   wordmark   mean   Rsep   frame pct
#     172   169.1     155.5   165.0  +17.5     61%   <- judged too dark
#     190   186.2     171.2   181.6  +34.3     70%
#     210   205.1     188.6   200.0  +53.0     86%   <- chosen
#     230   223.9     206.0   218.5  +71.6     98%   <- judged too bright
#
# 210 sits above most of the image but below the vehicle's own 250 peak white.
# 190 is deliberately not used: at p70 it is close to the 172 already called dark.
#
# Note the alpha-0.94 composite: the rendered result lands ~4% BELOW this
# constant, the remaining 6% being orange panel showing through.
#     0.94 * 210 + 0.06 * 81 (panel) = 202
INK_LEVEL = 210.0

# Amplitude of the illumination modulation. See the modulation block in main()
# for why a gain is needed at all rather than using the fitted surface directly.
#
# Calibrated by sweep against the real paint, which swings 25.6% across the
# decal's own band. Resulting ink swing / correlation with that falloff:
#     gain 2.0 -> 17.4%  (+0.967)
#     gain 2.5 -> 21.7%  (+0.966)
#     gain 3.0 -> 26.0%  (+0.966)
# Correlation is flat across the sweep because gain scales amplitude only; the
# shape comes from the fitted surface and is already right.
#
# 2.0 rather than the paint-matching 3.0, on purpose. The paint dims left-to-
# right and the BBVN wordmark sits on the RIGHT, so a full-strength match
# penalises exactly the element carrying the brand name:
#     gain 3.0 -> mark 151.0, wordmark 133.1
#     gain 2.0 -> mark 164.6, wordmark 151.5   (at INK_LEVEL 165)
# 17% is still a real lighting response and keeps the decal sitting in the
# photograph; going below ~1.5 flattens it back into a sticker.
MODULATION_GAIN = 2.0

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
    coefs = [None, None, None]
    for _ in range(iters):
        for c in range(3):
            coef, *_ = np.linalg.lstsq(A[keep], sub[:, :, c].ravel()[keep], rcond=None)
            coefs[c] = coef
            model[:, :, c] = (A @ coef).reshape(h, w)
        keep = (sub - model).mean(2).ravel() < thresh

    # Detect over ERASE_BOX, not over the fit box. The old artwork reaches y 2522
    # while the fit deliberately stops at 2498 to stay above the panel seam, so
    # detecting only where we fitted leaves the artwork's lower fragments behind.
    ex0, ey0, ex1, ey1 = ERASE_BOX
    esub = img[ey0:ey1, ex0:ex1].astype(np.float64)
    eh, ew = esub.shape[:2]
    eyy, exx = np.mgrid[ey0:ey1, ex0:ex1]
    emodel = illumination(coefs, exx.astype(np.float64), eyy.astype(np.float64))
    ink = ((esub - emodel).mean(2) >= thresh).astype(np.uint8)
    ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    full = np.zeros(img.shape[:2], np.uint8)
    full[ey0:ey1, ex0:ex1] = ink
    return full, model, coefs


def illumination(coefs, xs, ys):
    """Evaluate the fitted panel surface at arbitrary MASTER coordinates.

    The enlarged decal reaches x 5632 and y 2291, outside BOX, so the model has
    to be evaluated beyond the region it was fitted on. The fit is NOT widened to
    cover it: BOX is deliberately confined to clean paint, and stretching it over
    the window band above would make the quadratic model two surfaces at once
    (that mistake previously showed up as grain sigma 6.79 vs 3.16).

    Extrapolation is modest -- about 31% past the box in x, 9% in y -- and a
    smooth quadratic tolerates that. The caller still clamps the result.
    """
    x0, y0, x1, y1 = BOX
    w, h = x1 - x0, y1 - y0
    xn = (xs - x0) / w - 0.5
    yn = (ys - y0) / h - 0.5
    A = _poly_basis(xn.ravel(), yn.ravel())
    out = np.stack([(A @ c).reshape(xs.shape) for c in coefs], axis=-1)
    return out


def reconstruct(img, mask, coefs, rng):
    """Replace flagged pixels with the fitted panel plus matched grain.

    Works over ERASE_BOX, which extends below the fit box to cover the whole of
    the old artwork, so the panel surface is EVALUATED here rather than reused
    from the fit.
    """
    x0, y0, x1, y1 = ERASE_BOX
    out = img.copy()
    sub = out[y0:y1, x0:x1].astype(np.float64)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    model = illumination(coefs, xx.astype(np.float64), yy.astype(np.float64))
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

    # Containment. The clean band is ~225px tall between a sloping panel edge and
    # a sloping seam, and the decal is 197px of it -- these margins are 13-26px,
    # small enough that a later tweak to DEST_W or ART_CY could push the decal
    # into the window glass or across the seam without anyone noticing on screen,
    # where the whole lockup is under 100 CSS px wide.
    xl, xr = DEST_X, DEST_X + DEST_W
    gaps = {
        "top-left": top_l - panel_top_at(xl),
        "top-right": top_r - panel_top_at(xr),
        "bottom-left": panel_seam_at(xl) - (top_l + hl),
        "bottom-right": panel_seam_at(xr) - (top_r + hr),
    }
    print("    panel-band margins: "
          + "  ".join(f"{k} {v:.0f}px" for k, v in gaps.items()))
    tight = {k: v for k, v in gaps.items() if v < MIN_MARGIN}
    if tight:
        raise SystemExit(
            f"REFUSING: decal is within {MIN_MARGIN:.0f}px of the panel edge at "
            + ", ".join(f"{k} ({v:.1f}px)" for k, v in tight.items())
            + ". Re-solve DEST_W/ART_CY against panel_top_at/panel_seam_at."
        )

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
    mask, model, coefs = panel_model_and_mask(src)
    print(f"    artwork ink pixels: {int(mask.sum())}")
    cleaned = reconstruct(src, mask, coefs, rng)

    logo = np.asarray(Image.open(LOGO).convert("RGBA")).astype(np.float32)
    before = int((logo[:, :, 3] > 25).sum())
    logo[TAGLINE_Y0:, TAGLINE_X0:, 3] = 0.0
    print(f"    tagline erased: ink pixels {before} -> "
          f"{int((logo[:, :, 3] > 25).sum())}")
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

    # Modulate the ink by the panel's own illumination. A FLAT ink level is what
    # made the decal read as a sticker: measured, the panel varies 13.5% in
    # luminance across the decal's width and the generator's own painted logo
    # varied 21.4%, while a flat INK_LEVEL varied 0.5%. Real paint on a shaded
    # surface tracks the light; anything that doesn't is read as lying on top.
    #
    # INK_LEVEL stays the MEAN target, so overall density is unchanged and only
    # the falloff is added.
    ys, xs = np.mgrid[0:H, 0:W]
    lit = illumination(coefs, xs.astype(np.float64), ys.astype(np.float64))
    lit_lum = 0.299 * lit[:, :, 0] + 0.587 * lit[:, :, 1] + 0.114 * lit[:, :, 2]
    hot = warped[:, :, 3] > 0
    ref = float(lit_lum[hot].mean()) if hot.any() else 1.0
    # The fitted surface has the right SHAPE but too little amplitude over the
    # decal, because the decal's right third sits outside BOX and is
    # extrapolated. Gain restores the magnitude without touching the shape.
    # Calibrated against the real paint: clean panel inside the decal's own band
    # falls 83.7 -> 64.3, a 25.6% swing, and unmodulated ink swings 0.6%.
    # (The 13.5% quoted while diagnosing this was sampled BELOW the seam, on a
    # different panel -- wrong surface, too small a number.)
    #
    # Clamped because `lit` is extrapolated outside BOX; a runaway quadratic must
    # not be able to blow out or black out the decal.
    shade = 1.0 + MODULATION_GAIN * (lit_lum / max(ref, 1e-6) - 1.0)
    shade = np.clip(shade, 0.80, 1.20)[:, :, None]
    print(f"    illumination modulation across the decal: "
          f"{shade[hot].min():.3f} .. {shade[hot].max():.3f} "
          f"({(shade[hot].max() / shade[hot].min() - 1) * 100:.1f}% range)")

    ink = warped[:, :, :3] / 255.0 * tint[None, None, :] * INK_LEVEL * shade
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
