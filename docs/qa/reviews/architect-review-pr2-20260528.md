ARCHITECT REVIEW — PR #2 "Redesign auth pages with split-panel brand layout" @ 4ac6ac30
─────────────────────────────
Base: master  ·  Head: feat/ota-redesign  ·  State: open (ready)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/2
Reviewed: 2026-05-28 (standalone — report only, no PR comment)

Mode note: PR head 4ac6ac30 == current local HEAD and the checked-out branch IS the PR
branch, so the PR-mode temp-branch checkout was a no-op and was skipped (also: gh
rate-limited + working tree dirty with unrelated skill/docs edits — auditing committed HEAD
directly). This is a UI-only diff; per this skill's own boundary ("skips when group set
is UI-only") the architectural surface is intentionally small — the audit is scoped to the
changed cluster (auth pages + new shell + layout chrome) plus repo-wide invariant checks.

Scanned: auth/layout changed-cluster (10 files), new module AuthSplitLayout + 8 consumers

PRIORITY 1 — Block push, fix first:
  (none)

  Invariant checks (repo-wide rules, evaluated against changed files):
  - LAYER (UI→DB): CLEAR. None of app/auth/**, app/op/{login,first-login}, components/auth,
    components/layout import lib/db / PrismaClient / $queryRaw / $executeRaw. New component
    AuthSplitLayout imports only: react(type), next/link, lucide-react, components/brand/Logo,
    lib/utils(cn). Pure presentation layer.
  - PAYMENT CRYPTO outside webhooks: N/A (no payment code touched).
  - SCHEMA mutation outside migrations: CLEAR (no $executeRaw DDL).
  - SECRETS in source: CLEAR (no process.env *SECRET/KEY/TOKEN/PASSWORD in the diff;
    CSRF token is read client-side from the bb_csrf cookie, not an env secret).

PRIORITY 2 — Fix before next release:
  (none)

  - CYCLES: none. The string `"/auth/login"` in register/page.tsx is an <Link href>, not an
    import — no module cycle. login → register is one-directional.
  - GOD MODULE / SHALLOW MODULE: AuthSplitLayout exports 1 symbol over ~146 impl lines — a
    deep module (small API, real implementation). Not a barrel/re-export pile. Good seam:
    6 auth pages now share one shell instead of duplicating the <main>/<Card> scaffold.
  - ADR coverage: no new dependency added (package.json not in diff) — no ADR-triggering
    pattern introduced.

PRIORITY 3 — Track on roadmap:
  [CROSS-PAGE COUPLING — pre-existing, NOT introduced by this PR]
    app/auth/login/page.tsx:11 imports `setAccessToken, setDisplayName` from
    `@/app/auth/register/page`. The register page module exports module-level mutable
    singletons (`_displayName`, access token) that a sibling page reads. A page importing
    another page's module for shared mutable auth state is an architectural smell — that
    state belongs in a `lib/auth/clientSession.ts` (or a context), not a route module.
    This PR does not touch it (the import line is unchanged context). Flagging for the
    backlog so the redesign momentum doesn't entrench it. Cross-link:
    /improve-codebase-architecture, /refactor-extract.

  [DRIFT] No prior docs/qa/arch-graph.json → baseline established this run.
    New edges added by this PR (all within UI/util layer, none crossing a layer boundary):
      app/auth/{login,register,forgot-password,reset-password}/page.tsx → components/auth/AuthSplitLayout
      app/op/{login,first-login}/page.tsx                               → components/auth/AuthSplitLayout
      components/auth/AuthSplitLayout → components/brand/Logo, lib/utils
    SAFE drift — consolidating direction (6 pages → 1 shell), no new boundary crossing.

SUMMARY: 0 P1, 0 P2, 2 P3
Graph snapshot updated → docs/qa/arch-graph.json (auth-cluster baseline)

RECOMMENDED NEXT STEPS:
  → No P1/P2 — nothing blocks merge on architectural grounds. The new shell is a clean
    consolidating seam.
  → P3 cross-page coupling is pre-existing; file a follow-up to lift the client-session
    singletons out of app/auth/register/page into lib/auth/ when convenient.
