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
the layout needs them. Landmark fractions of the master, pixel-measured:

    bus body      x 0.59 -> 0.95, roof y 0.41, tyres y 0.83, shadow floor 0.845
    sun disc      x 0.09, y 0.46
    city skyline  x 0.29 -> 0.58
    trees down the right edge intrude from the top at
                  x 0.90 -> y 0.379,  x 0.96 -> y 0.254,  x 0.99 -> y 0.187

If the master is ever replaced, these fractions change and every crop below
becomes wrong. Re-measure before trusting this script on a new photograph.
"""

import argparse
import os
import sys

from PIL import Image

# Landmarks as fractions of the master. Re-measure on any asset swap.
BUS_X0, BUS_X1 = 0.59, 0.95
BUS_FLOOR_Y = 0.845

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
    # The whole bus cannot fit here and no crop changes that: a 0.512-aspect
    # frame holding a bus 36% of the master's width would need to be 1306px
    # tall, and the master is 941. So this crop deliberately frames the bus
    # FRONT plus sky rather than pretending to show the vehicle. Cut slightly
    # wider than the 390 box (0.55 vs 0.512) so it still covers at 767.
    jobs.append(("landing-golden-1280.jpg", 0.55, 768,
                 BUS_X0 - 0.005, None,
                 "mobile: bus front + sky; whole bus geometrically impossible"))

    # --- md, 768-1023. Box h/w 0.830 -> aspect 1.205. -----------------------
    # cover shows 67.9% of width here and the bus spans 36%, so it fits. Anchor
    # so the crop holds the bus with margin on both sides; the sun (x 0.09)
    # falls outside and is sacrificed.
    jobs.append(("landing-golden-md-1536.jpg", 1.205, 1536,
                 0.30, None,
                 "md: whole bus + skyline; sun sacrificed"))

    # --- lg, 1024-1919. Full master, positioned in CSS. ---------------------
    # No crop: the CSS uses `cover` with `100% 60%`, which is provably valid
    # across this whole range. Just resize.
    jobs.append(("landing-golden-1920.jpg", W / H, 1920,
                 0.0, None,
                 "lg: full master, CSS positions it"))

    # --- 3xl, >=1920. Box aspect 2.617; crop to match. ----------------------
    # Position-only tuning has an EMPTY valid range past ~2090px box width
    # (tyres need P>=68.5% while trees cap P<=51.1% at 2560), which is why this
    # slot gets its own crop instead. y 0.181-0.860 puts the navbar band on
    # sky and keeps the shadow floor (0.845) inside.
    jobs.append(("landing-golden-3840.jpg", 2.617, 2560,
                 0.0, (0.181, 0.860),
                 "3xl: cropped to box aspect; position-only fails past ~2090px"))

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
