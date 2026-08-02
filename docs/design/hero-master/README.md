# Hero master

`landing-golden-master-1672x941.png` is the **source of truth** for every hero
variant in `public/hero/`. It is the original AI generation, lossless, 1672x941.

It lives here rather than in `public/` on purpose: everything under `public/` is
served to visitors, and this file is a build input, not an asset.

## Why it is committed

It was previously not in the repo at all, and not in git history either. It had
to be recovered from a Downloads folder, identified among four near-identical
generations by resampling each one down and diffing it against the shipped
`landing-golden-1920.jpg`:

| candidate | mean abs diff vs shipped |
|---|---|
| **02_15_43 PM** | **2.479** (this file — JPEG round-trip error only) |
| 01_52_48 PM | 20.979 |
| 01_55_29 PM | 22.988 |
| 02_45_49 AM | 24.822 |

Losing it again would mean the crops could never be re-derived.

## Pipeline

```
landing-golden-master-1672x941.png          <- this file, the only irreplaceable part
  |
  |  realesrgan-ncnn-vulkan -n realesrgan-x4plus -s 4      (exact 4x -> 6688x3764)
  v
master-4x.png
  |
  |  python scripts/hero-logo.py master-4x.png -o master-final.png
  v
master-final.png                            <- real BBVN lockup on the flank
  |
  |  python scripts/hero-cut.py master-final.png
  v
public/hero/*.jpg + *.webp                  (9 files)
  |
  |  python scripts/hero-verify.py <dir-of-previous-variants>
  v
gate: dimensions, low-frequency SSIM, bus sharpness
```

The two derived masters are **not** committed — the 4x is 27 MB and both are
reproducible from the commands above. Only this 2.3 MB original is irreplaceable.

## Do not regenerate the photograph

`scripts/hero-cut.py` and `app/(customer)/page.tsx` both hardcode hand-measured
landmark fractions of THIS frame (bus x 0.63-0.855, sun x 0.114 y 0.472, tree
line x 0.946 -> y 0.272). Automated detection of them failed four times and is
explicitly forbidden in `hero-cut.py`. A uniform upscale preserves those
fractions; a re-generation silently invalidates every crop rect and both
`bg-[position:...]` values. The tightest margin is 2.55% of frame width, at the
sun.

`scripts/hero-logo.py` additionally refuses to run on anything that is not
exactly 6688x3764, because every coordinate in it is absolute.
