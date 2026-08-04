# docs/archive

Superseded, point-in-time artifacts moved out of `docs/` during the 2026-08-02 cleanup.
Kept for history; **not** live documentation. Nothing here is regenerated or maintained.

## Contents

- `qa/` — 156 per-PR review reports (`code-review-pr*`, `pr-review-pr*`, `security-deep-pr*`,
  `architect-review-pr*`, `backcompat-pr*`, `perf-pr*`, `obs-pr*`, `observability-review-pr*`).
  Each documents one merged PR and is obsolete once that PR landed. Live QA reports (non-PR:
  `architect-review-<date>`, `gl-*`, `*-deps-*`, hold-system, security-signoff) stay in `docs/qa/`.
- `current-status/` — a full point-in-time codebase snapshot (28 top-level files + `comparison/`).
  Goes stale the moment code changes; regenerate on demand rather than trusting this copy.

## Report naming convention (for future reports written into `docs/qa/`)

Drift existed at archive time — normalize to these prefixes going forward:

| Use | Not |
|-----|-----|
| `obs-pr<N>-<date>.md` | `observability-review-pr<N>-…` |
| `backcompat-pr<N>-<date>.md` | `backcompat-review-pr<N>-…` |
| `perf-pr<N>-<date>.md` | `perf-review-pr<N>-…` |

Per-PR reports are disposable — archive or delete them once the PR merges instead of letting
`docs/qa/` accumulate hundreds again.
