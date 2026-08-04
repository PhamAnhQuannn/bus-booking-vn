# CODE REVIEW — PR #405 "feat(home): trust strip as a dark band over the hero bottom" @ `d5bc955`

**Mode:** PR · **Base:** `master` (re-targeted from `feat/hero-sharpen` on 2026-08-01)
**Diff scope:** 1 file (`app/(customer)/page.tsx`), +72 / −26 · **Date:** 2026-08-01

## Read this first — the PR's history changed during review

This PR was **stacked on `feat/hero-sharpen` (#403)** and had been receiving **2 of 13 CI checks for
its entire life**, because most workflows are gated on `base: master`. Both facts are logged in
`CLAUDE.md` (2026-07-28) as a pair, and they were the reason the merge order for this batch was
chosen deliberately:

1. #403 was merged **without** `--delete-branch`. Deleting the base auto-closes a stacked child and
   `gh pr reopen` refuses once the base is gone.
2. #405 was then re-targeted with `gh pr edit 405 --base master`.
3. At that point its diff **re-proposed all 19 of #403's files** (`CONFLICTING`/`DIRTY`), because
   #403 was squash-merged and so exists on master under a new SHA.
4. Resolved by **merging master into the branch, not rebasing** — the plan called for a rebase and
   force-push, but a merge produces the identical three-dot diff for a squash-merged PR while
   leaving published history intact. No force-push was needed.

The diff below is what remains after that: **1 file, +72/−26**, this PR's own change.

Full 13-check CI is running against it now for the first time.

---

## PRIORITY 1 / PRIORITY 2

None.

---

## PRIORITY 3

### [DEAD DATA] `FEATURES[].sub` now has zero readers

The old markup destructured `{ icon: Icon, title, sub }` and rendered `sub` as a description line.
The new band renders `{ icon: Icon, title }` only. All four `sub` strings remain defined at
`page.tsx:58-66` and nothing reads them.

Neither gate catches this: `tsc` does not flag unused object *properties*, and ESLint's
`no-unused-vars` only sees destructured bindings, which were correctly dropped.

One of those strings is load-bearing history — the `2026-07-30` comment above the `Bus` entry
explains a copy correction (*"asserts a nationwide partner network; at launch there is one
operator, so it was simply untrue"*). That comment still applies to the `title`, which **is** still
rendered, so it is half-live rather than stale. Worth keeping the comment; the `sub` values are the
dead part.

**Fix:** drop `sub` from the four entries, or add one line stating it is retained for a planned
re-use. Either is fine; leaving it silent means the next reader cannot tell which.

---

## Verified clean

The load-bearing claim in this diff is an accessibility floor, and the comment says an earlier
estimate of it was **wrong**. That is exactly the claim worth recomputing rather than trusting.

- **The alpha/contrast table verifies.** Recomputed white-on-black-overlay against the stated
  brightest underlying pixel `(251,222,185)`:

  | alpha | comment | measured |
  |---|---|---|
  | 0.45 | 4.15 | 4.15 |
  | 0.48 | 4.58 | 4.57 |
  | 0.50 | 4.87 | 4.87 |
  | 0.52 | **5.19** | **5.21** |
  | 0.60 | 6.84 | 6.85 |

  All within ±0.02. Shipped value is `bg-black/52` → **5.21:1**, clearing the 4.5 AA floor with
  ~0.7 of margin, which is what the comment claims it reserved.

- **The recorded mistake is real and correctly diagnosed.** The comment says the first estimate
  sampled the base at one x-position, got `(248,185,130)`, and concluded 0.45 was safe. Recomputed:
  that sample yields **5.20:1** at α=0.45 — comfortably safe-looking — while the true brightest
  point over the full sweep yields **4.15:1**, below the floor. The stated lesson (*"estimating an
  extremum from ONE sample will undershoot; sweep the whole region"*) is the same shape as the
  `CLAUDE.md` 2026-08-01 entry about a threshold anchored to a single extreme-valued row. Finding
  it, fixing it, and writing down why is the correct handling.

- **The 1px top edge is justified by a proof, not a preference.** The comment shows the band cannot
  be separated from the photo by luminance alone at both ends — the image runs 0.419 at x=280 down
  to 0.023 at x=1360, a multiplicative overlay drives the right end to 1.07:1, and satisfying both
  ends simultaneously requires `≤0.106` and `≥0.169`, which is empty. It also explains why
  `backdrop-blur`/`brightness`/`saturate` cannot help (all multiplicative on a near-monochrome
  region). The edge is then contrasted against the **band**, not the photo, so it holds evenly:
  2.98:1 at x=280 and 3.74:1 at x=1360.

- **`inset` shadow rather than `border-t`, for a stated reason** — a border would add 1px to an
  intrinsic-height element and break the `lg:pb-[72px]` figure the hero was sized against. That is
  the kind of coupling that usually gets discovered later.

- **The geometry is internally consistent.** Band ~56px, so `lg:pb-8` (32px) would occlude the
  search card by 24px; padding goes to 72px (56 + 16) and `min-h` up by the same 40px, 570 → 610.
  This was the one merge conflict against master, and master's 570/`pb-8` is simply the pre-trust
  value rather than a competing decision.

- **One markup, two positions** — static two-column below `lg`, absolute four-column from `lg`. No
  duplicate band to drift.

- **Accessibility of the element itself** — `aria-label="Điểm nổi bật"` moved from the removed
  `<section>` onto the `<ul>`, so the landmark label is preserved; icons are `aria-hidden`, with the
  text carrying meaning.

- **Icon colour change is explained as a consequence, not a taste call** — orange-on-orange over the
  sunset half measured 2.29 → 1.45 once the band lightened, so white was chosen (5.20 left half,
  17.97 right half). The comment names the cost: the band loses its only orange accent.

- **No secrets, no PII, no injection sink, no new dependency, no route or schema change.**

## Interaction worth noting, not a defect

#404 (merged earlier today) retuned `--secondary`/`--muted`/`--accent` partly so that *bands* would
still read against the new page field. This PR **deletes** the one `bg-muted` band on the homepage
— the old trust strip's `border-b border-border bg-muted` wrapper. The two changes are consistent
(#404's tokens still serve op/admin table stripes and hovers), but the specific surface that
motivated part of #404's reasoning is no longer on this page.

## Not reviewed

- Whether the band looks right. Design judgement, and per `CLAUDE.md` 2026-08-01 a `:3001`
  measurement after a branch switch describes Turbopack's on-disk cache rather than this diff. The
  numeric claims were recomputed from source instead.
- The measured image luminances (0.419 / 0.023 / the `(251,222,185)` peak) — these come from the
  author's sweep of a rendered hero and cannot be re-derived from the diff. The *arithmetic built on
  them* is what I verified.

---

```
SUMMARY: 0 P1, 0 P2, 1 P3
```

## RECOMMENDED NEXT STEPS

1. Wait for the full 13-check suite — it has never run on this branch before, so treat a failure as
   newly-revealed rather than newly-introduced.
2. `FEATURES[].sub` cleanup can ride this PR or the next.
3. After merge, delete `feat/hero-sharpen`, which was deliberately kept alive to avoid auto-closing
   this PR.
