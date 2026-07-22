"""Cut the four art-directed hero variants from one graded master.

Usage:  python scripts/hero-cut.py <master> [--dry-run]

One master, four boxes with wildly different aspect ratios - measured live from
the running site rather than computed, because the hero's height is driven by
its content:

    viewport 390  -> box  375x732  (h/w 1.952 - PORTRAIT)
    viewport 900  -> box  885x734  (h/w 0.830)
    viewport 1024 -> box 1009x690  (h/w 0.684)
    viewport 1920 -> box 1905x728  (h/w 0.382)

Each crop is chosen so `background-size: cover` lands the bus and the sky where
the layout needs them. Landmark fractions of the CURRENT master, measured:

    bus body      x 0.63 -> 0.855, tyres y 0.775, shadow floor ~0.79
    sun disc      x 0.114, y 0.472
    trees down the right edge intrude from the top at
                  x 0.85 -> y 0.397,  x 0.90 -> y 0.326,
                  x 0.946 -> y 0.272 (the nav-content edge, the binding one),
                  x 0.99 -> y 0.179

The bus figures are read off the grid overlay from hero-candidate.py, NOT
detected. Automated masking has now failed four times on these frames: a
white/orange mask returns x 0.550-0.949 because it catches the guardrail and the
lit road markings, and a dark-window-band probe returns x 0.498-0.999 because it
catches the trees and the mountain. On a golden-hour coastal scene there is no
colour that isolates the vehicle. Do not re-add a detector here.

If the master is ever replaced, these fractions change and every crop below
becomes wrong. Re-measure before trusting this script on a new photograph.
"""

import argparse
import os
import sys

from PIL import Image

# Landmarks as fractions of the master. Re-measure on any asset swap.
BUS_X0, BUS_X1 = 0.63, 0.855
BUS_FLOOR_Y = 0.79

# Output quality. 88 is where this photograph stops gaining visible detail.
JPEG_Q = 88


def cut(master, box_aspect, out_w, anchor_x=None, y_range=None):
    """Crop `master` to `box_aspect` (w/h), then resize to `out_w` wide.

    anchor_x: fraction of the master where the crop's LEFT edge sits. None
              centres it. y_range: explicit (y0, y1) fractions, overriding the
              aspect-driven full-height crop.
    """
    W, H = master.size
    if y_range is not None:
        y0, y1 = int(H * y_range[0]), int(H * y_range[1])
        ch = y1 - y0
        cw = min(W, int(ch * box_aspect))
    else:
        # Prefer using the full height; fall back to full width if that would
        # need more width than the master has.
        ch, cw = H, int(H * box_aspect)
        if cw > W:
            cw, ch = W, int(W / box_aspect)
        y0 = 0
    x0 = int(W * anchor_x) if anchor_x is not None else (W - cw) // 2
    x0 = max(0, min(x0, W - cw))
    y0 = max(0, min(y0, H - ch))
    crop = master.crop((x0, y0, x0 + cw, y0 + ch))
    out_h = round(out_w * ch / cw)
    return crop.resize((out_w, out_h), Image.LANCZOS), (x0, y0, cw, ch)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("master")
    ap.add_argument("--out", default="public/hero")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    m = Image.open(a.master).convert("RGB")
    W, H = m.size
    print(f"master {W}x{H}  aspect {W/H:.4f}")

    jobs = []

    # --- mobile, <768. Box is PORTRAIT (h/w 1.952 at 390). ------------------
    # The constraint here is the SEARCH CARD, not the frame. At 390 the card
    # covers roughly y 340-665 of a 732px box - the middle 44%. A full-height
    # crop puts the bus at y 373-578, i.e. entirely behind it: the vehicle is in
    # the picture and invisible. (The previous master had the same problem for a
    # different reason - its 36% bus could not fit the 28.8% window at all.)
    #
    # So the crop is LIFTED: taking master y 0.18-1.0 raises the bus to y
    # 0.402-0.744 of the crop, putting its roof and window band above the card's
    # top edge at 0.464 while the card hides the wheels. Sky still fills the
    # navbar band (0.18-0.261 against a tree line of 0.397 in this x-window).
    #
    # Cut slightly wider than the 390 box (0.55 vs 0.512) so it still covers
    # at 767.
    jobs.append(("landing-golden-1280.jpg", 0.55, 768,
                 0.615, (0.18, 1.0),
                 "mobile: lifted so the bus clears the search card"))

    # --- md, 768-1023. Box h/w 0.830 -> aspect 1.205. -----------------------
    # cover shows 67.9% of width and the bus spans 22.5%, so there is room to
    # keep the skyline too. Window 0.30-0.979.
    jobs.append(("landing-golden-md-1536.jpg", 1.205, 1536,
                 0.30, None,
                 "md: whole bus + skyline"))

    # --- lg, 1024-1919. Full master, positioned in CSS. ---------------------
    # No crop. The CSS uses `cover` at `50% 48%` - see page.tsx for why the old
    # right-anchor is gone.
    jobs.append(("landing-golden-1920.jpg", W / H, 1920,
                 0.0, None,
                 "lg: full master, CSS positions it"))

    # --- 3xl, >=1920. Box aspect 2.617; crop to match. ----------------------
    # Position-only tuning has an empty valid range past ~2090px of box width,
    # which is why this slot gets its own crop. Band re-derived for this master:
    # the crop is 639 rows, the navbar covers 11.5% of it (73 rows), the tree
    # line under nav content is y 0.272 (= row 256) and the bus floor is row
    # 743. So y0 <= 183 to keep the navbar on sky, and y0 >= 104 to keep the
    # wheels. y0 = 145 sits mid-range -> 0.154-0.833.
    jobs.append(("landing-golden-3840.jpg", 2.617, 2560,
                 0.0, (0.154, 0.833),
                 "3xl: cropped to box aspect; band re-derived for this master"))

    os.makedirs(a.out, exist_ok=True)
    for name, aspect, out_w, ax, yr, note in jobs:
        img, (x0, y0, cw, ch) = cut(m, aspect, out_w, ax, yr)
        fx0, fx1 = x0 / W, (x0 + cw) / W
        fy0, fy1 = y0 / H, (y0 + ch) / H
        bus_in = fx0 <= BUS_X0 and fx1 >= BUS_X1 and fy1 >= BUS_FLOOR_Y
        print(f"\n  {name}")
        print(f"    {note}")
        print(f"    src rect x[{x0},{x0+cw}] y[{y0},{y0+ch}]  "
              f"= x[{fx0:.3f},{fx1:.3f}] y[{fy0:.3f},{fy1:.3f}]")
        print(f"    out {img.size[0]}x{img.size[1]}  aspect {img.size[0]/img.size[1]:.4f}"
              f"  upscale {out_w/cw:.2f}x")
        print(f"    whole bus inside crop: {'YES' if bus_in else 'NO'}")
        if not a.dry_run:
            img.save(os.path.join(a.out, name), quality=JPEG_Q, optimize=True)
    if a.dry_run:
        print("\n(dry run - nothing written)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
