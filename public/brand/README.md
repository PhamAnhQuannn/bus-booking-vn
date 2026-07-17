# Brand assets — bbvn logo

Extracted 2026-07-16 from owner-provided AI-generated logo masters (ChatGPT, Jul 16 2026).
Brand orange: `#FF6A00` · Dark: `#1F2937` (per design spec sheet).

| File | Contents | Use on |
|------|----------|--------|
| `logo-vertical.png` | Full lockup: BB-bus monogram / bbvn / BUS BOOKING (color, transparent) | Light backgrounds |
| `logo-vertical-white.png` | Same lockup, white knockout | Dark / orange backgrounds |
| `logo-horizontal.png` | Monogram left, wordmark + tagline right (color, transparent) | Light backgrounds, headers |
| `logo-horizontal-white.png` | Same, white knockout | Dark / orange backgrounds, footers |
| `logo-mark.png` | Monogram only (color, transparent) | Avatars, compact UI |
| `logo-mark-white.png` | Monogram only, white knockout | Dark / orange backgrounds |
| `favicon.ico` | 16/32/48 multi-size ICO, color mark | Swap into `app/favicon.ico` |
| `icon-192.png` | 192×192 color mark, transparent | PWA manifest |
| `icon-512.png` | 512×512 color mark, transparent | PWA manifest |
| `icon-512-maskable.png` | 512×512 white mark on `#FF6A00`, 16% safe padding | PWA manifest `purpose: maskable` |
| `apple-touch-icon.png` | 180×180 white mark on `#FF6A00`, opaque | `<link rel="apple-touch-icon">` |

Not yet wired: `app/favicon.ico` + `app/icon.svg` still carry the old generic glyph, and
`components/brand/Logo.tsx` renders an inline SVG placeholder. Swap intentionally.
