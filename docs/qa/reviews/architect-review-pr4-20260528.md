ARCHITECT REVIEW — PR #4 "feat(op): operator console redesign" @ 55c043d6
─────────────────────────────
Base: master  ·  Head: feat/ota-redesign  ·  State: open (ready)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/4
Reviewed: 2026-05-28 (standalone — report only, no PR comment)

Mode note: PR-mode temp-branch checkout SKIPPED — working tree is dirty with
unrelated pre-existing edits and auto-stash is unsafe per this skill's rule.
PR HEAD fetched as local ref `_pr4-review` instead and audited via `git show
_pr4-review:<path>` directly. This is the same workaround used on PR #2.

Scanned: 26 new app/op pages, 20 new components/op modules, 6 new lib/op modules,
1 new lib/auth (duplicated from PR #3 squash — already on master), 1 new API route.

PRIORITY 1 — Block push, fix first:
  [LAYER VIOLATION / UI→DB] app/op/(console)/dashboard/page.tsx:29,76
    The redesigned dashboard imports `prisma` directly:
        29: import { prisma } from "@/lib/db/client"
        76: const routes = routeIds.length
              ? await prisma.route.findMany({
                  where: { id: { in: routeIds }, operatorId: session.operatorId },
                  select: { id: true, origin: true, destination: true },
                })
              : []
    This is the ONLY `page.tsx` in the entire repo that imports prisma directly.
    Every other server-component page (including this same dashboard before the
    redesign, and the new activity page in this PR) routes through a `lib/op/*`
    or `lib/<domain>/*` helper. The dashboard already imports 8 such helpers
    (getOperatorSession, getUnviewedPaidCount, getOperatorKpis, listUpcomingForOperator,
    listOperatorBookings, getActivityFeed, getDefaultDateRange, touchLastViewed) —
    adding one prisma usage on top breaks the convention the rest of this same file
    upholds.
    Fix: extract the route-enrichment query into a new helper
    `lib/op/listRoutesForTripIds.ts` (or fold it into whichever helper produces
    `todayCandidates`, so the consumer never sees raw routeIds). Drop the prisma
    import from the page. ~10 lines of refactor, zero behavior change.

PRIORITY 2 — Fix before next release:
  [LAYER REVERSAL / TYPE-ONLY] lib/op/statusLabels.ts:3
    `import type { badgeVariants } from "@/components/ui/badge"` — the service
    layer (lib/) reaches up into the UI layer (components/) to borrow a type.
    Runtime is clean because `import type` is stripped at build, but the type
    dependency points the wrong way: the data dictionary should own the variant
    vocabulary; the badge should consume it.
    Fix (inverted dep): define `type StatusBadgeVariant = 'success' | 'warning' |
    'danger' | 'neutral' | 'pending'` locally in lib/op/statusLabels.ts; export it;
    have `components/ui/badge` (or a thin wrapper) import THAT. Service owns the
    vocabulary, UI consumes.

  [ADR MISSING / PROJECT-WIDE] No `docs/adr/` directory exists in the repo at all.
    `recharts@^3.8.1` is the trigger surfaced by this PR (new charting library —
    ADR-significant per the skill rule), but the underlying issue is broader:
    Prisma, Next.js App Router, Tailwind, Zustand, base-ui, jose-JWT, MoMo PSP
    integration, the bb_csrf double-submit middleware, the otpProof JWT (Issue 007),
    the FunnelEvent append-only design — all architecturally-significant choices
    already live in code with no recorded ADR. Flagging a single PR's new dep
    while the broader practice is absent would be misleading.
    Fix: start a `docs/adr/` directory with /adr-writer. Backfill 0001-prisma-orm,
    0002-next-app-router, 0003-base-ui-vs-shadcn (the project uses both), then
    0004-recharts-chart-library for this PR's new dep. Subsequent ADR-triggering
    PRs land their own ADR alongside.

PRIORITY 3 — Track on roadmap:
  [DRIFT] arch-graph.json snapshot updated.
    Prior snapshot scope: PR #2 auth-cluster (Logo, AuthSplitLayout, lib/utils).
    PR #4 adds:
      • 20 new components/op/* modules
      • 6 new lib/op/* modules
      • 1 new app/api/op/activity/route.ts
      • 26 new/modified app/op/(console)/**/page.tsx files
    Cross-layer edges added: ONE — the P1 dashboard→prisma above. Otherwise all
    new edges stay within their layer (app→lib, components→components/ui,
    lib→lib/db via the proper client). Auth subgraph unchanged on master
    (the duplicated PR #3 files in this diff are content-identical).

  [SHAPE / SQUASH-MERGE DUPLICATION] (also flagged by /pr-review P1 + /code-review P3)
    Branch not rebased after PR #2 + PR #3 squashes; carries the original
    357113af + 2ed4a207 commits. Architecturally invisible (content matches
    master) but creates audit-trail confusion.

SUMMARY: 1 P1, 2 P2, 2 P3
Graph snapshot updated → docs/qa/arch-graph.json (PR #4 cluster baseline)

────────────────────────────────
WHAT'S GOOD (noted, not required)

  - **Cycle scan: CLEAN.** Hub patterns inside components/op all one-directional:
    EmptyState consumed by 4 (ActivityFeed, DataTable, QueueStrip, TodayTripsStrip);
    navConfig consumed by 4 (Breadcrumbs, CommandPalette, OperatorBottomNav,
    OperatorNav); OperatorNavContext consumed by 3 (CommandPalette,
    OperatorBottomNav, OperatorNav). None of those leafs imports back. Cleanly
    layered cluster.

  - **Deep modules across the board.** No shallow / barrel pile finding:
      lib/op/getActivityFeed.ts  — 1 export / 202 lines  ← textbook deep
      lib/op/formatRelativeVi.ts — 1 export / 38 lines
      components/op/CommandPalette.tsx — 1 export / 369 lines
      components/op/OperatorNav.tsx — 2 exports / 308 lines
      components/op/DataTable.tsx — 4 exports / 342 lines
    Even statusLabels.ts at 9 exports / 103 lines is a lookup-map module, not a
    barrel — every export is a labeled record consumed independently.

  - **`/api/op/activity` correctly wrapped.** requireOperatorAuth() gates the
    handler; ctx.operatorId is the only tenant identifier passed downstream;
    withErrorHandler envelopes the throw path. New endpoint, right layering.

  - **Activity page = in-process call.** `app/op/(console)/activity/page.tsx`
    invokes `getActivityFeed()` directly in the RSC body — NOT
    `fetch('/api/op/activity')` from a server component. This honors the
    Issue 002 Mistake Log rule. Same lib function is reused from both the
    RSC and the polling API endpoint — single source of truth.

  - **No `$executeRaw` DDL in app code.** Schema mutation invariant holds.
    No payment crypto outside webhooks (no payment touched). No secret env
    vars in source.

RECOMMENDED NEXT STEPS:
  → Extract the dashboard prisma usage into `lib/op/listRoutesForTripIds.ts`
    (or fold into the helper that produces `todayCandidates`). One-commit fix,
    behavior-neutral.
  → Invert the statusLabels ↔ badge type dependency.
  → Open the ADR practice — `/adr-writer` for recharts in this PR; backfill the
    big pre-existing decisions in a follow-up.
  → After fix lands and branch is rebased, re-run /architect-review against
    master to refresh the baseline.
