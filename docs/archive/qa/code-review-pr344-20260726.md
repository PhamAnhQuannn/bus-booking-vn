CODE REVIEW — PR #344 "refactor(home): remove FeatureHighlights section from homepage (#289)" @ 876add04
────────────────────────────────
Mode: PR mode (`/code-review 344`)
Pinned head SHA: `876add04c16a5ebbde79cfa06ad3df3316c68890`
Base: `master` · Head: `fix/289-remove-feature-highlights` · State: OPEN, not draft
Diff scope: 1 file, +0 / -3 lines

## Diff under review

```
app/(customer)/page.tsx
-import { FeatureHighlights } from '@/components/home/FeatureHighlights';   (line 20)
-      <FeatureHighlights />                                                (line 393)
-                                                                           (blank line 394)
```

Pure deletion. No added lines — Categories 1/2/3/6 have no `+` surface to review. Review therefore
concentrates on **deletion-creates-a-gap** (the explicit carve-out in the skill's scoping rule),
Category 4 (test coverage / stale assertions), and Category 5 (dead code left behind).

---

PRIORITY 1 — Block push, fix first:

  (none)

PRIORITY 2 — Fix before merge:

  (none)

PRIORITY 3 — Address when convenient:

  [READABILITY / DEAD CODE] components/home/FeatureHighlights.tsx (whole file)
    After this diff, `FeatureHighlights` has ZERO importers repo-wide — the component file
    (plus its three `/public/features/*.jpg` assets, ~kb of shipped static files, and
    `public/features/CREDITS.md`) is orphaned. Category 5 "new export with zero importers"
    normally fires here.
    NOT A DEFECT — explicitly sanctioned. Issue #289 Scope says verbatim: "Do NOT delete the
    component file (`components/home/FeatureHighlights.tsx`) or `/public/features/` images yet
    — separate cleanup". The PR body repeats this. CLAUDE.md Working Principle 3 likewise says
    "Don't remove pre-existing dead code unless asked."
    Action: none in this PR. Confirm the "separate cleanup" follow-up issue actually exists, or
    the orphan becomes permanent. Note the orphan is not tree-shaken out of the repo, only out of
    the client bundle — the `/public/features/*.jpg` files still deploy.

---

## Category-by-category walk

### Category 1 — Correctness
No logic changed. The removal is a sibling-element deletion inside `HeroMarketingView`'s JSX
fragment. `FeatureHighlights` is a zero-prop, zero-data component (`export function
FeatureHighlights()` — no args, no async, no DB read), so removing the call site drops no
data-fetch, no `await`, no shared-state read. **No finding.**

### Category 2 — Security smells
`FeatureHighlights` renders static marketing copy and three `next/image` tags against
`/features/*.jpg`. It carried no authz check, no session read, no user input, no redirect.
Deleting it removes no trust-boundary guard. **No finding.**

### Category 3 — Failure mode
No try/catch, external call, or write path in or around the removed lines. **No finding.**

### Category 4 — Test coverage of diff
Grepped `e2e/`, `__tests__/`, and `components/**/__tests__/` for `FeatureHighlights`,
`feature-highlights`, and the section's rendered heading text `Vì sao chọn BBVN?`:
**zero hits in any test or spec file.** The section was never asserted on, in CI-run specs or in
sandbox-gated ones. So there is no stale assertion to fail CI and no silently-rotting
sandbox-gated spec (the failure mode called out in the 2026-05-19 Issue 012 / 2026-05-19 Issue 011
Mistake Log entries). A deletion-only diff needs no new test. **No finding.**

Only surviving references are documentation:
`docs/design/mockup-home-spec.md`, `docs/design/landing-page-scan-20260720.md`,
`docs/design/landing-page-color-report-20260721.md`,
`documentation/frontend-design/FD-001-design-system/README.md:96`,
`documentation/frontend-design/FD-007-responsive-mobile/README.md:38`.
These reference the component file, which still exists — so they are not broken links. Doc drift
against the *homepage composition* is raised in the `/pr-review` report (negative-space audit),
not here.

### Category 5 — Naming + readability
Sole finding is the orphaned component, recorded as P3 above and AC-sanctioned.

### Category 6 — Diff hygiene
Clean. Three contiguous deleted lines, no whitespace churn, no `console.log`, no `debugger`,
no `.only`/`.skip`, no commented-out code, no lockfile or generated artifact. The removed blank
line is the correct one: post-diff, `<OperatorShowcase />` and `<ContractCarRental />` are
separated by exactly one blank line, matching the surrounding one-blank-between-sections rhythm.
Verified against the branch tree, not just the hunk. **No finding.**

---

## CLAUDE.md Mistake Log cross-check (auto-P1 on match)

Every entry walked against this diff. All clear:

| Log entry | Applies? | Verdict |
|---|---|---|
| 2026-07-17 — never add `loading.tsx` / `useSearchParams`-in-client-layout to a segment whose children rely on `notFound()` | Checked | **Clear.** No `loading.tsx` added/removed. The `(customer)` segment's only streaming boundary is the pre-existing explicit `<Suspense fallback={<ResultsSkeleton/>}>` inside `page.tsx` — untouched by this diff, and it wraps the *search-results* subtree, not the marketing subtree the removal sits in. `export const dynamic = 'force-dynamic'` (line 31) unchanged. No change to the segment's streaming boundary or to `/booking/result/[token]`'s ability to set HTTP 404. |
| 2026-07-18 — Tailwind v4/Turbopack per-file stale rescan | Advisory | **Noted.** Removal generates no new utility classes, so a stale rescan cannot hide this change — but per the parent brief, no dev-server visual check was treated as authoritative here. Review is source-based. |
| 2026-05-17 Issue 001 — `select` whitelist leaking filter columns | No | No query touched. |
| 2026-05-17 Issue 002/003 — RSC self-fetching own API | No | No fetch added; the removed component did none. |
| 2026-06-04 — `'use client'` files must deep-import client-safe modules, never the `@/lib/auth` barrel | No | `page.tsx` is a server component (no `'use client'`); no import added, only removed. Barrel-leak class cannot fire on a deletion. |
| 2026-05-19 Issue 013/014 — DTO / status-enum / timestamp drift | No | No schema, DTO, or state machine touched. |
| 2026-07-23/24/25 — payment, reconcile, NotificationLog, transaction entries | No | No payment, job, or DB path in diff. |
| 2026-05-18 Issue 007 / 2026-05-19 Issue 012 — NOT NULL column vs fixtures | No | No schema change. |

No Mistake Log pattern matched. No auto-P1.

---

## Verification performed

- `gh pr view 344` / `gh pr diff 344` — diff fetched and pinned to `876add04`.
- `gh pr diff 344 --name-only` — confirms **1** changed file; no hidden second file.
- Repo-wide grep `FeatureHighlights` — on the PR branch, the only remaining code reference is the
  component's own definition; `app/(customer)/page.tsx` is clean of both the import and the render.
  **The Surgical-Changes obligation ("remove imports YOUR changes made unused") is satisfied** —
  the import was removed in the same hunk, so there is no unused-import lint error.
- Repo-wide grep `Vì sao chọn` / `public/features` / `/features/` — no test, spec, or other
  component depends on the removed section.
- Read `app/(customer)/page.tsx` at the PR head to confirm blank-line hygiene around the deletion
  and that no sibling JSX or anchor target (`id="search"`, `scroll-mt-20 lg:scroll-mt-[92px]`,
  line 204) was disturbed. No in-page anchor pointed at the removed section.

## AC trace (issue #289)

| AC | Status |
|---|---|
| Homepage no longer renders the "Vì sao chọn BBVN?" section | MET — render removed |
| No unused import warnings | MET — import removed in same hunk |
| `pnpm tsc --noEmit` passes | Not re-run (out of `/code-review` scope per Boundaries; PR body asserts clean). Statically safe: the only symbol removed is used nowhere else. |
| `pnpm lint` passes | Same as above. |
| Component file + `/public/features/` NOT deleted | MET — correctly left in place |

SUMMARY: 0 P1, 0 P2, 1 P3

RECOMMENDED NEXT STEPS:
  → Nothing blocks merge. Zero P1, zero P2.
  → The single P3 is AC-sanctioned, not a defect. Before closing #289, confirm the promised
    "separate cleanup" follow-up issue exists for `components/home/FeatureHighlights.tsx` +
    `public/features/*` + `public/features/CREDITS.md`, so the orphan does not become permanent.
  → Do not manufacture further findings on a 3-line deletion.
