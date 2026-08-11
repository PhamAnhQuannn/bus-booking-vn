ARCHITECT REVIEW — PR #408 "refactor(tourism-kb): relocate tourism KB into a standalone feature" @ b9e7a5bf
─────────────────────────────
Base: master  ·  Head: feat/tourism-kb-relocation  ·  State: open (ready)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/408

Scope note: audited in place (HEAD already == PR headRefOid; no temp-branch checkout).
Assessed the PR's ARCHITECTURAL DELTA, not a full Tarjan rebuild — ~790 of 842 files are
mechanical renames (scripts/tourism→tourism-kb/code, docs/qa→docs/archive) and untrack-deletions
(.claude/skills, tourism data) that change no TS import edge. arch-graph.json (baseline 2026-07-30)
deliberately NOT overwritten — a partial delta graph would corrupt the drift baseline.

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before next release:
  (none)

PRIORITY 3 — Track on roadmap:
  [DOMAIN PLACEMENT] lib/op/statusLabels.ts now serves both operator AND customer UI.
    This PR's fix(status) unify points app/(customer)/account/bookings/{page,[id]/page}.tsx and
    app/(customer)/booking/confirmation/[token]/page.tsx at `@/lib/op/statusLabels`, deleting three
    drifted local maps. Net architectural effect is POSITIVE (single source of truth, three copies →
    one). But booking-status display vocabulary physically lives in the OPERATOR domain (`lib/op`)
    while now consumed cross-audience. Consider relocating to a neutral shared/booking home at a
    convenient point. Not blocking, and not CI-relevant (see below).

ARCHITECTURAL DELTA — verified:
  - New cross-domain edge: app/(customer) → lib/op/statusLabels. NOT a lint violation: statusLabels
    is already an established deep entry-point of lib/op, imported clean by 10+ op client components
    on master (DashboardClient, BusesClient, TripsClient, …). `boundaries/entry-point` (enforced at
    ERROR, eslint.config) gates the imported PATH, not the consumer, so the new customer consumer
    passes the identical rule the op consumers already pass. CI lint stays green.
  - No new cycle. The only new TS edge is the entry-point import above (acyclic). Everything else in
    the diff is Python-script relocation + TS/asset DELETIONS.
  - Graph SHRINKS: removes the shadowed `lib/utils/` dir (index.ts + useReducedMotion.ts) and 6 dead
    orphan components (FeatureHighlights, IntroBanner, RouteDirectory, DetailLayout, KpiTile,
    radio-group) — fewer nodes, fewer edges. Structural improvement.
  - Domain invariants intact: no payment crypto relocated (webhook dirs untouched), no DDL in app
    code (`$executeRaw` CREATE/ALTER/DROP absent from diff), no new `process.env.SECRET` in a
    client-reachable module. The PR barely touches app runtime — only the statusLabels unify.
  - Client-bundle safety: statusLabels imports only `import type { BookingStatus } from "@prisma/client"`
    (erased at compile) — client-safe, so the two `'use client'` account pages deep-importing it
    honor the "client files deep-import client-safe modules" rule rather than violating it.

SUMMARY: 0 P1, 0 P2, 1 P3
Graph snapshot: NOT updated (2026-07-30 baseline preserved; delta audit did not rebuild full graph).

RECOMMENDED NEXT STEPS:
  → No architectural blockers. The relocation is net-additive-hygiene: shrinks the graph, adds one
    already-permitted entry-point edge.
  → P3 (statusLabels domain home) is a future /improve-codebase-architecture candidate, not for this PR.
