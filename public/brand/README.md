# Brand assets — BBVN logo

Cut 2026-07-22 from an owner-provided AI-generated contact sheet (ChatGPT,
Jul 22 2026) by `scripts/brand-cut.py`. **Do not hand-edit these files** — re-run
the script so every variant stays in register.

Brand orange `#FF6A00` · wordmark ink `#2E2E2E`.

| File | Dimensions | Contents | Use on |
|------|-----------|----------|--------|
| `logo-horizontal.png` | 726×294 | Monogram left, wordmark + tagline right (colour) | Light backgrounds, headers |
| `logo-horizontal-white.png` | 681×289 | Same, white knockout | Dark / orange backgrounds, footers |
| `logo-vertical.png` | 365×461 | Stacked lockup (colour) | Light backgrounds |
| `logo-vertical-white.png` | 358×462 | Stacked, white knockout | Dark / orange backgrounds |
| `logo-mark.png` | 303×294 | Monogram only (colour) | Avatars, compact UI, collapsed sidebar |
| `logo-mark-white.png` | 299×289 | Monogram only, white knockout | Dark / orange backgrounds |
| `favicon.ico` | 16/32/48 | Multi-size ICO, colour mark | Copied to `app/favicon.ico` |
| `icon-192.png` | 192×192 | Colour mark, transparent | PWA manifest |
| `icon-512.png` | 512×512 | Colour mark, transparent | PWA manifest, copied to `app/icon.png` |
| `icon-512-maskable.png` | 512×512 | White mark on `#FF6A00`, 40% padding | PWA manifest `purpose: maskable` |
| `apple-touch-icon.png` | 180×180 | White mark on `#FF6A00`, opaque | Copied to `app/apple-icon.png` |

## Wiring

- `components/brand/Logo.tsx` consumes the four lockups via `variant`
  (`glyph`/`combo`) × `mono`. Its `LOGOS` map hardcodes the **exact** pixel
  dimensions above — `next/image` derives aspect ratio from them, so if the
  artwork is recut those numbers must change in the same commit or the logo
  silently distorts. The vertical lockups are not wired to any component.
- `app/icon.png`, `app/apple-icon.png` and `app/favicon.ico` are **byte-identical
  copies** of `icon-512.png`, `apple-touch-icon.png` and `favicon.ico`. Next's
  file conventions auto-wire them; there is no `icons` field in any `metadata`
  export. Re-copy all three together or the browser tab and the PWA disagree.
- `app/opengraph-image.tsx` inlines `logo-horizontal-white.png` as base64 and
  draws it at a hardcoded size that must match the asset's 2.356 aspect ratio.
- `app/manifest.ts` references the three `/brand/icon-*.png` paths.

## Known limitation

The horizontal lockup bakes in the "BUS BOOKING" tagline. At the 36px header
size that renders at roughly 4–5px cap height and is not legible; it reads
correctly at the 48px footer and 72px auth-panel sizes. A tagline-free lockup
for small surfaces would be the right fix, but the supplied sheet contains no
such variant.

These are rasters, not vectors. The 16px favicon is soft as a result.
