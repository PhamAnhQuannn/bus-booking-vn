BACKCOMPAT REVIEW — PR #408 "refactor(tourism-kb): relocate tourism KB into a standalone feature"
───────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/408
Base/Head: master ← feat/tourism-kb-relocation @ b9e7a5bf
Size:      +437 / -98,292 across 842 files
Project license: none (private repo, no "license" field)
Generated: 2026-08-02

No backcompat findings.
(No API shape breaks, no schema breaks, no live shared-lib signature breaks, no risky new deps.)

Scan detail:
  - Cat 1 API shape: no app/api/** hunks in the diff (0 added/modified route handlers) → no response
    field/status/param/endpoint changes.
  - Cat 2 schema: prisma/schema.prisma NOT touched → no dropped/renamed/narrowed column, no NOT NULL add.
  - Cat 3 shared-lib: two exports removed by commit 038b497 ("remove dead orphan components and
    shadowed utils dir"), both verified SAFE (dead code, no live break):
      · `useReducedMotion` (lib/utils/useReducedMotion.ts) — grep across HEAD returns ZERO importers.
      · The `lib/utils/` DIRECTORY was shadowing the canonical `lib/utils.ts` file. Removing the dir
        leaves `@/lib/utils` resolving unambiguously to `lib/utils.ts`, which still exports `cn` — all
        ~40+ `import { cn } from '@/lib/utils'` sites keep resolving. (The shadowing was the bug; the
        removal FIXES module-resolution ambiguity rather than breaking it.)
      · DepartTripSchema/CompleteTripSchema removed as dead — CI tsc is the backstop; code-review found
        no surviving consumer.
    lib/op/statusLabels.ts: exported `bookingStatusDisplay(status: BookingStatus)` signature UNCHANGED;
    `StatusBadgeVariant` union unchanged. Only an internal map VALUE changed (cancelled variant). No
    exported-symbol break.
  - Cat 4/5/6 supply-chain: package.json NOT touched → no new dep, no license/typosquat/postinstall/
    lockfile-drift surface.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to b9e7a5bf
