# Hero image credits

All variants are cut from one master by `scripts/hero-cut.py`. The master itself
is committed at `docs/design/hero-master/` — see the README there for the full
pipeline and for why it must not be regenerated.

**Dimensions below are the real ones on disk.** Every row in the previous version
of this file was wrong: it described a 3840×1920 / 1920×960 / 1536×1152 /
1280×640 set that had not existed since commit `e384d1a` re-cut every variant.
This file was last touched in the *earlier* commit `62d7314`, so the re-cut
landed without it and the credits silently described assets that were gone. If
you change `hero-cut.py`'s job table, update this table in the same commit.

## Shipped

Each breakpoint ships two files: a **JPEG at 1×**, which doubles as the CSS
cascade fallback for browsers that cannot parse `image-set()`, and a **WebP at
2×**. Format is not negotiated in CSS — `image-set()`'s `type()` has an open
WebKit bug and is unsupported in Safari — so only density is.

| File | Pixels | Bytes | Serves |
|------|--------|-------|--------|
| `landing-golden-1280.jpg` | 768×1397 (portrait) | 212 KB | mobile `<768`, DPR1 + fallback |
| `landing-golden-1280@2x.webp` | 1536×2794 | 272 KB | mobile DPR2 **and** DPR3 (covers 752@2× = 1504 and 430@3× = 1245) |
| `landing-golden-md-1536.jpg` | 1536×1275 | 390 KB | md `768–1023`, DPR1 + fallback |
| `landing-golden-md-1536@2x.webp` | 2048×1700 | 319 KB | md DPR2 (covers 1008@2× = 2016) |
| `landing-golden-1920.jpg` | 1920×1081 | 434 KB | lg `1024–1919`, DPR1 + fallback |
| `landing-golden-1920@2x.webp` | 3072×1729 | 480 KB | lg DPR2; 1.24× residual at the very top of the range |
| `landing-golden-3840.jpg` | 2560×978 | 459 KB | 3xl `≥1920`, DPR1 + fallback |
| `landing-golden-3840@2x.webp` | 3840×1468 | 400 KB | 3xl DPR2 (covers 1905@2× = 3810, i.e. 4K at 200% scaling) |
| `contract-rental-thumb.jpg` | 576×256 | 41 KB | `components/home/ContractCarRental.tsx` — NOT a hero variant |

The `1280` / `md-1536` / `1920` / `3840` in the filenames are historical and no
longer describe the width of anything. They are kept because renaming buys
nothing and touches four call sites plus the preload hints; read the Pixels
column, not the name.

Source for all of the above: AI-generated master, owner-provided 2026-07-22,
super-resolved 4× with `realesrgan-x4plus`. The bus's livery is
`public/brand/logo-horizontal-white.png` composited by `scripts/hero-logo.py` —
the generator had painted an approximation reading "BBVn" over a line of
gibberish, and 4× super-resolution rendered that sharply rather than hiding it.

The decal carries the **mark plus the BBVN wordmark only**. The "BUS BOOKING"
rule below the wordmark is erased before compositing: it renders 2.0–2.9 CSS px
tall at every breakpoint, which cannot be drawn, and aliases into a grey smear.
For it to reach a legible 8 px the decal would have to span roughly 65% of the
visible bus. See `scripts/hero-logo.py` for the measurements behind that, and
behind the decal's size, position and brightness — all four are solved against
the panel's real boundaries rather than chosen.

## Unreferenced legacy assets

Still on disk, referenced by nothing (grepped across `app/` and `components/`).
Left in place deliberately — removing them is dead-asset cleanup, a separate
concern from this change.

| File | Bytes | Note |
|------|-------|------|
| `landing-golden-1774.jpg` | 268 KB | earlier 1774×887 generation of the same composition, superseded 2026-07-16 |
| `landing-sunset-wide-1774.jpg` | 192 KB | bottom-anchored 1774×665 crop (src y=222) of the sunset generation, unused since 2026-07-16 |
| `landing-sunset-1280.jpg` | 129 KB | sunset generation — bbvn bus on coastal highway, previous mobile hero |
| `landing-sunset-1774.jpg` | 236 KB | same image, native resolution |
| `landing-day-1280.jpg` | 132 KB | daylight variant, never shipped |
| `landing-day-1774.jpg` | 245 KB | same image, native resolution |

All owner-provided.
