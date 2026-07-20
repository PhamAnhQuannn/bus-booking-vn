CODE REVIEW — PR #300 "feat(brand): integrate BBVN logo across app" @ 29f7665d
────────────────────────────────
Diff scope: 19 files, +585 / -57 lines (bulk is pnpm-lock.yaml sharp/png-to-ico entries)

Meaningful source changes: 5 files (+220 / -50 approx)
  - components/brand/Logo.tsx (rewrite: SVG → next/image with light/dark/mono modes)
  - app/opengraph-image.tsx (embed logo PNG via fs readFile + base64)
  - app/manifest.ts (new PWA manifest)
  - scripts/generate-logo-assets.mjs (new one-off asset generator)
  - package.json (devDeps: sharp, png-to-ico)

Binary assets: 7 new/replaced (logo-light.png, logo-dark.png, icon.png, apple-icon.png, favicon.ico, icon-192.png, icon-512.png)
Deleted: 6 files (icon.svg, 5 unused Next.js starter SVGs)


PRIORITY 1 — Block push, fix first:
  (none)


PRIORITY 2 — Fix before merge:
  (none)


PRIORITY 3 — Address when convenient:
  [READABILITY / DEAD CODE] components/brand/Logo.tsx
    `variant='glyph'` path exists but has zero callers in the codebase. Not harmful
    (preserves API surface for future use) but worth noting as dead code in this diff.

  [HYGIENE / CONSOLE] scripts/generate-logo-assets.mjs
    Multiple console.log statements. Acceptable — one-off CLI script, not production code.
    Would be a P1 if this were a runtime module.


NOTES (informational, not findings):

  [OK] components/brand/Logo.tsx — `mono` prop preserved for AuthSplitLayout usage.
    Uses `brightness-0 invert` CSS filter on raster PNG to achieve white-on-dark.
    Old SVG used `fill="currentColor"`. Both approaches valid; raster filter makes
    entire image (mark + text) uniformly white, which is the intended auth-panel look.

  [OK] components/brand/Logo.tsx — imported by `'use client'` OperatorNav.tsx.
    Logo imports `next/image` (client-safe) and `@/lib/utils` (barrel-exempt).
    No server-only transitives pulled into client bundle. Safe per WT-operator-smoke rule.

  [OK] app/opengraph-image.tsx — uses `process.cwd()` to read logo file.
    Standard Next.js pattern for OG route handlers (Node.js runtime, not Edge).
    `readFile` reads committed file from `public/` — no missing-file risk in prod.

  [OK] app/manifest.ts — clean MetadataRoute.Manifest. theme_color #FF6A00 matches
    brand guide primary orange.

  [OK] package.json — sharp and png-to-ico are devDependencies only. Not in prod bundle.
    Both security-audited earlier in session (sharp: 67M weekly, Apache-2.0; png-to-ico:
    272K weekly, MIT, depends only on pngjs).

  [OK] Deleted files — 5 unused starter SVGs (file.svg, globe.svg, next.svg, vercel.svg,
    window.svg) and replaced icon.svg with icon.png. No remaining references to deleted files.


SUMMARY: 0 P1, 0 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → Clean PR. No blocking findings.
  → P3 items can ride as-is — glyph variant preserves API, console.log in script is expected.
