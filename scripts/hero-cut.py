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
# WebP q80 is roughly JPEG q88 perceptually on this material, at ~60% of the
# bytes. Only the 2x tiers are WebP -- the 1x files stay JPEG because they double
# as the CSS cascade fallback for browsers that cannot parse image-set().
WEBP_Q = 80


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
                 "mobile 1x: lifted so the bus clears the search card"))
    # One 2x file covers the whole mobile range including DPR3: the widest
    # mobile box is 752 CSS px (at viewport 767, just under the md breakpoint),
    # so 752*2 = 1504, and the tallest DPR3 case is 430*3 = 1245. 1536 clears
    # both, which is why there is no separate 3x tier here.
    jobs.append(("landing-golden-1280@2x.webp", 0.55, 1536,
                 0.615, (0.18, 1.0),
                 "mobile 2x: covers 752@2x (1504) and 430@3x (1245)"))

    # --- md, 768-1023. Box h/w 0.830 -> aspect 1.205. -----------------------
    # cover shows 67.9% of width and the bus spans 22.5%, so there is room to
    # keep the skyline too. Window 0.30-0.979.
    jobs.append(("landing-golden-md-1536.jpg", 1.205, 1536,
                 0.30, None,
                 "md 1x: whole bus + skyline"))
    # md box tops out at 1008 CSS px, so DPR2 wants 2016.
    jobs.append(("landing-golden-md-1536@2x.webp", 1.205, 2048,
                 0.30, None,
                 "md 2x: covers 1008@2x (2016)"))

    # --- lg, 1024-1919. Full master, positioned in CSS. ---------------------
    # No crop. The CSS uses `cover` at `50% 48%` - see page.tsx for why the old
    # right-anchor is gone.
    jobs.append(("landing-golden-1920.jpg", W / H, 1920,
                 0.0, None,
                 "lg 1x: full master, CSS positions it"))
    # lg spans a box of 1009-1904 CSS px, so DPR2 at the very top wants 3808.
    # 3072 is a deliberate compromise: it covers 1536@2x exactly (the common
    # Retina laptop) and leaves a 1.24x residual upscale at the extreme top of
    # the range, against 1.70x today. Going to 3808 would cost ~800KB for the
    # last slice of the range.
    jobs.append(("landing-golden-1920@2x.webp", W / H, 3072,
                 0.0, None,
                 "lg 2x: covers 1536@2x; 1.24x residual at the top of the range"))

    # --- 3xl, >=1920. Box aspect 2.617; crop to match. ----------------------
    # Position-only tuning has an empty valid range past ~2090px of box width,
    # which is why this slot gets its own crop. Band re-derived for this master:
    # the crop is 639 rows, the navbar covers 11.5% of it (73 rows), the tree
    # line under nav content is y 0.272 (= row 256) and the bus floor is row
    # 743. So y0 <= 183 to keep the navbar on sky, and y0 >= 104 to keep the
    # wheels. y0 = 145 sits mid-range -> 0.154-0.833.
    jobs.append(("landing-golden-3840.jpg", 2.617, 2560,
                 0.0, (0.154, 0.833),
                 "3xl 1x: cropped to box aspect; band re-derived for this master"))
    # 3xl starts at a box of 1905 CSS px, so DPR2 wants 3810 -- that is a 4K
    # panel at 200% scaling, much the commonest way a 4K display is actually
    # driven. A 4K panel at 100% (box 3825, DPR1) falls back to the 2560 file
    # and takes a 1.49x upscale; that configuration is rare enough not to be
    # worth another ~600KB variant.
    jobs.append(("landing-golden-3840@2x.webp", 2.617, 3840,
                 0.0, (0.154, 0.833),
                 "3xl 2x: covers 1905@2x (3810), i.e. 4K at 200% scaling"))

    # --- contract-rental thumbnail, NOT a hero variant. ----------------------
    # components/home/ContractCarRental.tsx paints a 288x128 (aspect 2.25)
    # thumbnail. It used to point at landing-golden-1280.jpg, which was fine
    # while that file was landscape 2.000 - but the mobile hero is now PORTRAIT
    # 0.550, so object-cover kept only ~24% of its height and rendered a
    # close-up of the windscreen. It also pulled a 187KB hero to paint a
    # thumbnail. Cut to the box aspect instead, at 2x for retina.
    jobs.append(("contract-rental-thumb.jpg", 2.25, 576,
                 0.35, (0.34, 0.84),
                 "contract-rental thumb: landscape, bus + road + coast"))

    os.makedirs(a.out, exist_ok=True)
    written = []
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
        # Hard failure, not a note. This was printed and never checked, so a
        # crop that lost the vehicle would have been written to public/hero/ and
        # only noticed by eye -- which is exactly how a wrong asset ships.
        if not bus_in:
            print(f"    ABORT: {name} does not contain the whole bus")
            return 1
        if not a.dry_run:
            dest = os.path.join(a.out, name)
            # Write to a temp file and swap. A direct save over the destination
            # means an interrupt mid-write leaves a corrupt asset, and two runs
            # without a commit in between destroy the first run's output with no
            # recovery path.
            tmp = dest + ".tmp"
            if name.lower().endswith(".webp"):
                img.save(tmp, format="WEBP", quality=WEBP_Q, method=6)
            else:
                img.save(tmp, format="JPEG", quality=JPEG_Q, optimize=True)
            os.replace(tmp, dest)
            written.append((name, img.size, os.path.getsize(dest)))
    if a.dry_run:
        print("\n(dry run - nothing written)")
    else:
        total = sum(b for _, _, b in written)
        print(f"\n  wrote {len(written)} files, {total:,} bytes total")
        for nm, sz, b in written:
            print(f"    {nm:34s} {sz[0]:5d}x{sz[1]:<5d} {b:9,d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
