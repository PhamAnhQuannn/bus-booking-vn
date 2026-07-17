BACKCOMPAT REVIEW — PR #302 "feat: hero redesign, audit fixes, brand logo, analytics"
───────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/302
Base/Head: master ← feat/vercel-analytics @ ff2e2ac3
Decision:  (none yet)
Size:      +1067 / −369 across 66 files
Project license: private app (no OSS license constraint)
Generated: 2026-07-16T22:15+07:00

Findings: 3  (P1: 0 · P2: 2 · P3: 1)

P2 — SHOULD FIX (or accept knowingly):
  lib/core/validation/search.ts:29  ⚠️  P2: searchParamsSchema gained a `.refine`
    (origin ≠ destination). The schema is ALSO consumed by the public endpoint
    app/api/trips/search/route.ts (untouched in this PR): same-city queries that
    previously parsed (→ 200 + empty results) now fail validation (→ 4xx).
    Assessment: intentional tightening per DS-030 (inline `// SPEC CONFLICT:` documents the
    FD-004 divergence); the updated test file covers the refine; Phase-1 launch has no
    external API consumers. ACCEPTABLE — documented here so the behavior change is on record.

  components/search/SearchFormWrapper.tsx + lib/stores/searchStore.ts  ⚠️  P2:
    Exported surface changes — SearchFormWrapper dropped its `initialValues` prop;
    SearchQuery.ticketCount type changed string → number. All internal consumers updated in
    the same PR (tsc green); persisted localStorage payloads migrated via zustand persist
    `version: 1` + `migrate`. No package-external consumers exist. ACCEPTABLE.

P3 — ADVISORY:
  package.json  ℹ️  P3: New dep `@vercel/analytics@^1.x` — scoped first-party Vercel package
    (MIT). No lifecycle scripts in the lockfile hunk; no typosquat distance to popular list
    (scoped name). Verify if desired: `npm view @vercel/analytics license`.

Category walk: no app/api file edits (Cat 1 direct: clean); no prisma/schema or migrations
(Cat 2: clean); Cat 3 items above; lockfile updated together with package.json (Cat 6: clean).

RECOMMENDED NEXT:
  - No P1. Both P2s are intentional, same-PR-aligned changes — ride with record.

SUMMARY: 0 P1 · 2 P2 · 1 P3 · pinned to ff2e2ac3
