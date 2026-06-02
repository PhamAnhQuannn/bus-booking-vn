ARCHITECT REVIEW — PR #6 "feat: OTA redesign + payment/booking correctness fixes + rebuild backlog" @ 02e6eab5
─────────────────────────────
Base: master  ·  Head: feat/ota-redesign  ·  State: open
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/6
Mode note: HEAD already equals PR #6 head + working tree dirty → audited HEAD in place (no temp-branch
checkout). Equivalent to local audit at the pinned SHA.

Scanned: app/** + components/** + lib/** TS/TSX; 30d coupling window; invariant + layer + graph pass.

PRIORITY 1 — Block push, fix first:
  (none — no dependency cycles, no layer violations, no domain-invariant breaches)

  Invariant pass results (all clean):
  ✓ UI→DB: no client component imports the DB layer at runtime. `app/**/page.tsx` → lib/db are RSC
    server-side fetches (correct app-router pattern). The `app/op/**/*Client.tsx` hits on @prisma/client
    are type-only `import type` (erased at compile) — not a runtime edge.
  ✓ Payment crypto in webhooks only: the createHmac matches are in lib/auth/{operatorSession,refreshToken}.ts
    — AUTH session-token signing, not payment-signature verify. MoMo IPN signature verify stays in the
    webhook path. No payment crypto leaked outside its boundary.
  ✓ No schema DDL (CREATE/ALTER/DROP) via $executeRaw in app code.
  ✓ No secret env names (SECRET/TOKEN/PASSWORD/API_KEY) referenced in client ('use client') modules.

PRIORITY 2 — Fix before next release:

  [PARALLEL-DEV DUPLICATION / MERGE RISK] The operator-console subsystem was built TWICE.
    Divergence point: merge-base c827c3b. Since then, master received exactly ONE op commit —
    6e58f54 "feat(op): operator console redesign … (#4)" — while THIS branch independently developed
    its own op-console redesign. Result: 8 files conflict (add/add + content):
      - small deltas (component tweaks): components/op/{KpiTile +5/-1, ConsoleHeader +6/-3,
        OperatorNav +6/-5, ActivityFeed +1/-1}, components/charts/RevenueLineChart.tsx +1/-1,
        lib/op/statusLabels.ts +14/-4
      - large reworks (HIGH merge risk): app/op/(console)/dashboard/page.tsx +59/-137,
        app/op/(console)/reports/overview/page.tsx +251/-153  ← near-rewrite
    Architectural risk: resolving these by blindly taking the branch side could DROP analytics-landing /
    charts / composer work that PR #4 already shipped to master. reports/overview especially is a
    near-total rewrite — a 3-way merge must confirm the branch version is a SUPERSET of master's #4
    output, not a regression to an earlier fork.
    Fix: resolve each conflict as an explicit 3-way merge (master #4 ⊕ branch). For dashboard +
    reports/overview, diff both sides feature-by-feature before choosing. After resolve, the op-console
    smoke path (dashboard tiles, reports charts, activity feed) must be re-verified — unit tests won't
    catch a dropped UI feature.
    Root-cause prevention: feature subsystems should land via one branch. The split (#4 to master while
    feat/ota-redesign carried a parallel copy) is the process defect that produced this.

  [ADR MISSING] recharts ^3.8.1 added to package.json; repo has NO docs/adr/ directory at all.
    Charting-library choice (and, more broadly, the Postgres/Prisma/custom-JWT/MoMo stack) is unrecorded.
    Fix: /adr-writer to record the charting choice now; backfill stack ADRs on the roadmap.

PRIORITY 3 — Track on roadmap:

  [DEP HYGIENE — positive] package.json adds pnpm overrides pinning @hono/node-server ≥1.19.13 and
    postcss ≥8.5.10 (transitive CVE bumps). Good practice — noted, no action.

  [ADR COVERAGE GAP] Zero ADRs for a project with payment integration, custom JWT auth, and a
    relational schema. Pre-existing (not introduced by this PR) but worth a backfill pass.

DRIFT vs prior snapshot (docs/qa/arch-graph.json @ PR #4 baseline 2026-05-28) — IMPROVEMENT:
  The PR #4 op-console baseline carried two violations; BOTH are resolved on this branch:
  ✓ [was P1] app/op/(console)/dashboard/page.tsx → lib/db/client (direct UI→DB, service-layer bypass)
    — gone. The branch dashboard rework (+59/-137) no longer imports the raw Prisma client.
  ✓ [was P2] lib/op/statusLabels.ts → components/ui/badge (lib→UI type reversal) — gone.
  Consequence for conflict resolution: the branch op-console version is architecturally CLEANER than
  master's #4 version. When resolving the 8 conflicts, prefer the branch side as the base and graft in
  any master-#4 features the branch lacks — do NOT reintroduce the UI→DB bypass by taking master's
  dashboard wholesale.

SUMMARY: 0 P1, 2 P2, 2 P3 (+2 prior violations resolved — drift positive)
Graph snapshot updated → docs/qa/arch-graph.json

RECOMMENDED NEXT STEPS:
  → The op-console duplication is the conflict root cause AND an architectural finding: resolve as a
    deliberate 3-way merge, prioritizing dashboard + reports/overview, then re-verify the op UI.
  → /adr-writer for the recharts choice.
  → No cycles / layer violations / invariant breaches — the code's dependency structure is sound.
