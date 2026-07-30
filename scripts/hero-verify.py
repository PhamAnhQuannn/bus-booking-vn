"""Gate a re-cut of the hero variants against the files they replace.

Usage:  python scripts/hero-verify.py <before-dir> [--out public/hero]
        python scripts/hero-verify.py <before-dir> --self-test

Answers the only two questions that matter about a hero re-cut, and answers them
as numbers rather than by eye:

    1. Did anything MOVE?      low-frequency SSIM(before, after) >= SSIM_MIN
    2. Did the bus get SHARPER? Laplacian variance on the bus region, strictly up

plus an exact-dimension check, because a variant that silently changes shape
would pass both of the above while breaking the CSS that positions it.

WHY LOW-FREQUENCY SSIM
----------------------
Composition drift lives at low spatial frequency; sharpening lives at high. Run
SSIM on the full-resolution images and the two effects fight: a genuinely
sharper crop scores WORSE, so the check would punish exactly the change it is
meant to approve. Downsampling both sides to a common small grid first strips
the high-frequency term, leaving a test of "is the same thing in the same place".

WHY NOT hero-grade.py
---------------------
hero-grade.py cannot serve as this gate. Run against the assets that were live
before this change it already exits 1 -- lg scores D5 23.7 (target >=40) and E2b
47.3% dark (target <=2%), 3xl scores 25.1 / 42.5%. E2b structurally cannot pass
on a raw file because it reads the text region with no CSS wash on top. So its
exit code carries no information about a re-cut, and only a before/after
comparison of its raw numbers does. It also cannot check the bus: its
BUS_REGION stops at y 0.56 while the bus floor is at 0.79, so its exported crop
shows the roofline and nothing else.

PROVING THE GATE FIRES
----------------------
--self-test deliberately breaks each check and asserts it reports failure. A
check that has never been seen to fail is not evidence of anything; this repo
learned that from a lint rule that was inert for its entire life.
"""

import argparse
import os
import sys

import cv2
import numpy as np
from PIL import Image

# The bus, in fractions of the MASTER: x 0.63-0.855 (hero-cut.py BUS_X0/BUS_X1),
# down to the floor at 0.79 (BUS_FLOOR_Y). Deliberately not hero-grade.py's
# BUS_REGION, which stops at y 0.56 -- above the windows, let alone the wheels.
BUS_MASTER = (0.63, 0.855, 0.50, 0.80)

# Each variant is a DIFFERENT crop of the master, so master fractions do not
# address the same content in each one. Applying a single frame-relative box to
# all of them measures a different patch per variant -- for the thumb, whose crop
# starts at master x 0.350, it lands nowhere near the vehicle and reported a
# spurious 0.89x regression. These are the src rects hero-cut.py prints; keep
# them in step with its jobs table.
CROP_RECT = {
    "landing-golden-1280.jpg": (0.615, 0.869, 0.180, 1.000),
    "landing-golden-md-1536.jpg": (0.300, 0.978, 0.000, 1.000),
    "landing-golden-1920.jpg": (0.000, 1.000, 0.000, 1.000),
    "landing-golden-3840.jpg": (0.000, 1.000, 0.154, 0.833),
    "contract-rental-thumb.jpg": (0.350, 0.983, 0.340, 0.840),
    "landing-golden-1280@2x.webp": (0.615, 0.869, 0.180, 1.000),
    "landing-golden-md-1536@2x.webp": (0.300, 0.978, 0.000, 1.000),
    "landing-golden-1920@2x.webp": (0.000, 1.000, 0.000, 1.000),
    "landing-golden-3840@2x.webp": (0.000, 1.000, 0.154, 0.833),
}


def bus_box(name):
    """Where the bus sits inside a given variant, as fractions of that variant."""
    rect = CROP_RECT.get(name)
    if rect is None:
        return BUS_MASTER
    rx0, rx1, ry0, ry1 = rect
    bx0, bx1, by0, by1 = BUS_MASTER
    f = lambda v, lo, hi: min(1.0, max(0.0, (v - lo) / (hi - lo)))
    return (f(bx0, rx0, rx1), f(bx1, rx0, rx1), f(by0, ry0, ry1), f(by1, ry0, ry1))

SSIM_MIN = 0.98
LOWFREQ_W = 200


def _ssim(a, b):
    """Global SSIM on two equally sized greyscale float arrays."""
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    mu_a, mu_b = a.mean(), b.mean()
    va, vb = a.var(), b.var()
    cov = ((a - mu_a) * (b - mu_b)).mean()
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    return ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a ** 2 + mu_b ** 2 + c1) * (va + vb + c2))


def lowfreq_ssim(before, after):
    """SSIM after collapsing both images to a common low-resolution grid."""
    h = max(1, round(LOWFREQ_W * before.size[1] / before.size[0]))
    a = np.asarray(before.convert("L").resize((LOWFREQ_W, h), Image.LANCZOS))
    b = np.asarray(after.convert("L").resize((LOWFREQ_W, h), Image.LANCZOS))
    return _ssim(a, b)


def bus_lapvar(img, name=None):
    g = np.asarray(img.convert("L"), dtype=np.float64)
    H, W = g.shape
    x0, x1, y0, y1 = bus_box(name) if name else BUS_MASTER
    r = g[int(H * y0):int(H * y1), int(W * x0):int(W * x1)]
    return cv2.Laplacian(r, cv2.CV_64F).var()


def compare(before_path, after_path, expect_size=None, name=None):
    """Return (ok, rows) for one variant."""
    before = Image.open(before_path)
    after = Image.open(after_path)
    name = name or os.path.basename(after_path)
    rows, ok = [], True

    size_ok = (expect_size is None) or (after.size == tuple(expect_size))
    dim_ok = size_ok and after.size == before.size
    rows.append(("dimensions", f"{before.size[0]}x{before.size[1]} -> "
                               f"{after.size[0]}x{after.size[1]}", dim_ok))
    ok &= dim_ok

    if after.size == before.size:
        s = lowfreq_ssim(before, after)
        rows.append(("low-freq SSIM", f"{s:.4f} (>= {SSIM_MIN})", s >= SSIM_MIN))
        ok &= s >= SSIM_MIN
    else:
        rows.append(("low-freq SSIM", "skipped (sizes differ)", False))
        ok = False

    lb, la = bus_lapvar(before, name), bus_lapvar(after, name)
    sharper = la > lb
    rows.append(("bus sharpness", f"{lb:.1f} -> {la:.1f} ({la / lb:.2f}x)", sharper))
    ok &= sharper
    return ok, rows


def report(title, ok, rows):
    print(f"\n  {title}")
    for name, detail, good in rows:
        print(f"    [{'PASS' if good else 'FAIL'}] {name:16s} {detail}")
    return ok


def self_test(before_dir, out_dir):
    """Break each check on purpose; every one must report FAIL."""
    print("SELF-TEST -- each case below MUST fail, or the gate is decorative.\n")
    ref = "landing-golden-1920.jpg"
    bpath = os.path.join(before_dir, ref)
    results = []

    # 1. identical input -> sharpness check must fail (not strictly greater)
    ok, rows = compare(bpath, bpath)
    results.append(("identical file fails sharpness",
                    not any(r[2] for r in rows if r[0] == "bus sharpness")))
    report("case 1: before vs itself", ok, rows)

    # 2. shifted crop -> low-frequency SSIM must fail
    im = Image.open(bpath)
    W, H = im.size
    dx = int(W * 0.05)
    shifted = im.crop((dx, 0, W, H)).resize((W, H), Image.LANCZOS)
    tmp = os.path.join(out_dir, "_selftest_shift.jpg")
    shifted.save(tmp, quality=88)
    ok, rows = compare(bpath, tmp)
    results.append(("5% crop shift fails SSIM",
                    not any(r[2] for r in rows if r[0] == "low-freq SSIM")))
    report("case 2: 5% horizontal crop shift", ok, rows)
    os.remove(tmp)

    # 3. one pixel off -> dimension check must fail
    tmp = os.path.join(out_dir, "_selftest_dim.jpg")
    im.resize((W, H - 1), Image.LANCZOS).save(tmp, quality=88)
    ok, rows = compare(bpath, tmp)
    results.append(("1px size change fails dimensions",
                    not any(r[2] for r in rows if r[0] == "dimensions")))
    report("case 3: height off by one pixel", ok, rows)
    os.remove(tmp)

    print("\n  self-test summary")
    allgood = True
    for name, fired in results:
        print(f"    [{'OK' if fired else 'BROKEN'}] {name}")
        allgood &= fired
    print("\n" + ("  gate proven to fire" if allgood
                  else "  GATE IS NOT TRUSTWORTHY -- a deliberate break was not caught"))
    return 0 if allgood else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("before", help="directory holding the pre-change variants")
    ap.add_argument("--out", default="public/hero")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()

    if a.self_test:
        return self_test(a.before, a.out)

    # Only the 1x tiers have a predecessor to compare against; the 2x WebP files
    # are new, so they get a dimension check only.
    paired = ["landing-golden-1280.jpg", "landing-golden-md-1536.jpg",
              "landing-golden-1920.jpg", "landing-golden-3840.jpg",
              "contract-rental-thumb.jpg"]
    new_only = {"landing-golden-1280@2x.webp": (1536, 2794),
                "landing-golden-md-1536@2x.webp": (2048, 1700),
                "landing-golden-1920@2x.webp": (3072, 1729),
                "landing-golden-3840@2x.webp": (3840, 1468)}

    allok = True
    for name in paired:
        b, n = os.path.join(a.before, name), os.path.join(a.out, name)
        if not (os.path.exists(b) and os.path.exists(n)):
            print(f"\n  {name}\n    [FAIL] missing file")
            allok = False
            continue
        ok, rows = compare(b, n)
        allok &= report(name, ok, rows)

    for name, size in new_only.items():
        p = os.path.join(a.out, name)
        if not os.path.exists(p):
            print(f"\n  {name}\n    [FAIL] missing")
            allok = False
            continue
        im = Image.open(p)
        good = im.size == size
        allok &= good
        print(f"\n  {name} (new, no predecessor)")
        print(f"    [{'PASS' if good else 'FAIL'}] dimensions      "
              f"{im.size[0]}x{im.size[1]} (expect {size[0]}x{size[1]})")
        print(f"    [ -- ] bus sharpness    {bus_lapvar(im, name):.1f} "
              f"(no before-image to compare)")

    print("\n" + ("ALL CHECKS PASS" if allok else "FAILURES ABOVE"))
    return 0 if allok else 1


if __name__ == "__main__":
    sys.exit(main())
