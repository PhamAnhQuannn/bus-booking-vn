---
name: traceability-matrix
description: Build a four-column traceability table mapping each issue → its Given/When/Then acceptance criteria → the test files that exercise those criteria → the release/version that ships them. Used to prove no requirement ships untested and no test is orphaned. Use when user says "traceability matrix", "requirements coverage", "what's tested", "audit trail", "/traceability-matrix", or before any L/XL release, regulated audit, or stage-gate review.
output_size:
  XS: skip
  S:  30m
  M:  1h
  L:  2h
  XL: 3h
---

# /traceability-matrix — issue → AC → test → release table

Invoke as `/traceability-matrix`. Walk `issues/`, harvest AC blocks, scan test files for matching test names, emit table.

## Why you'd care

Three classes of release defect die when this table exists:

- **Untested requirement** — an Issue says "user must be able to refund within 14 days" but no test names that path. Ships green; first refund-attempt at day 13 explodes.
- **Orphan test** — `tests/refund.spec.ts::cancel-after-charge` exists but no Issue claims it. Either the test guards a hidden requirement (document it) or the requirement got deleted but the test didn't (delete it). Either way: surface it.
- **Drift between AC and code** — Issue's Given/When/Then says "refund to original payment method only"; test only asserts refund record exists, doesn't assert payment method matches. Matrix forces an honest comparison.

The matrix is recomputed on every change; the cost is low and the artifact survives audits.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - S → top-10 issues only.
   - M/L/XL → full sweep.
2. Glob `issues/*.md`. Fail-soft if empty (run `/prd-to-issues` first).
3. Glob `tests/**/*` and `e2e/**/*` and `**/*.test.*` and `**/*.spec.*` — collect test-file → test-name pairs.
4. Read `package.json` or VERSION file to determine current release tag.

## Inputs

- `issues/*.md` with `acceptance_criteria:` frontmatter or `## Acceptance Criteria` body block (G/W/T format from `/acceptance-criteria`).
- Test discovery patterns (default above; project-specific via `CLAUDE.md` `## Test discovery` block).
- Release tag (current cycle + previous shipped).

## Process

1. **Harvest AC per issue.** For each `issues/<id>.md`:
   - Parse `## Acceptance Criteria` block (each `- Given … When … Then …` is one AC row).
   - Tag each AC `<id>-AC1`, `<id>-AC2`, …
   - Fail-soft skip issues with no AC; surface them in "Missing AC" section.
2. **Discover tests.** For each test file, list each `test(...)` / `it(...)` / `describe(...)` / Python `def test_*` name.
3. **Match AC → test** by:
   - Explicit AC-id reference in test name (e.g. `test('AC-003-1 refund within 14 days', …)`).
   - Then by issue-id substring match in file path or test name.
   - Then by keyword overlap (≥3 content words from AC's Then-clause match test name) — flag these as **WEAK** match.
4. **Match AC → release** — issue frontmatter `release: v1.2` (set by `/release-notes`) or default to "unreleased".
5. **Emit matrix.** Four columns: Issue · AC · Test · Release. One row per AC.
6. **Surface gaps:**
   - AC with no test → P1, listed in "Untested ACs".
   - Test with no AC → P2, listed in "Orphan tests".
   - Weak matches → P3, listed for review.
7. **Write** `docs/qa/traceability-matrix.md`.

## Output Format

```markdown
# Traceability matrix — <project>
**Generated:** <YYYY-MM-DD> · **Issues scanned:** <N> · **AC rows:** <M> · **Tests scanned:** <T>

## Matrix
| Issue | AC | Statement (one-line) | Test file::name | Release | Match |
|-------|-----|----------------------|-----------------|---------|-------|
| 001 | AC1 | Given valid creds, When login, Then session cookie set | tests/auth.spec.ts::login-happy | v0.2 | STRONG |
| 001 | AC2 | Given expired token, When request, Then 401 | tests/auth.spec.ts::expired-token | v0.2 | STRONG |
| 003 | AC1 | Given refund within 14d, When request, Then approved | tests/refund.spec.ts::within-window | unreleased | STRONG |
| 003 | AC2 | Given refund after 14d, When request, Then denied | — | unreleased | UNTESTED |
| 008 | AC1 | Given admin role, When view audit log, Then last 100 entries visible | tests/admin.spec.ts::audit-log | unreleased | WEAK |

## Untested ACs (P1)
- 003-AC2 — Given refund after 14d, When request, Then denied
- 011-AC3 — Given duplicate webhook, When received, Then second is no-op

## Orphan tests (P2)
- tests/legacy/old-pricing.spec.ts::v1-tiers — no matching issue
- e2e/checkout.spec.ts::guest-flow — no matching issue (deleted issue?)

## Weak matches (P3)
- 008-AC1 ↔ tests/admin.spec.ts::audit-log — name match only, AC says "last 100", test asserts "non-empty list"

## Missing AC (issues w/ no AC block)
- 005 — Refund admin UI
- 012 — Email template

## Coverage stats
- AC rows: M
- AC with strong match: x (y%)
- AC with weak match: x (y%)
- Untested AC: x (y%)  ← target: 0% for Must-tier, ≤10% for Should-tier
```

## Verification

- Matrix row count = sum of AC across all issues (no drops).
- Every Must-tier issue (from `/prioritize`) has 0 untested ACs OR the run fails verification.
- Orphan tests section is either empty or every entry is annotated within 1 cycle.
- `git diff docs/qa/traceability-matrix.md` shows monotonic improvement run-over-run (no regressions in coverage %).

## Cross-skill references

- **Upstream:** `/prd-to-issues`, `/acceptance-criteria`, `/prioritize`, `/tdd` (test files), `/release-notes` (release tags).
- **Downstream:** `/inception-gate-review` (uses coverage %), `/launch-checklist` (Must-tier untested = ship-block), `/audit` (regulated projects).

## When to re-run

- After every `/acceptance-criteria` pass.
- After every `/tdd` slice.
- Before any release-cut.
- Quarterly during mature stage (detect orphan-test rot).
- Pre-launch (L/XL) — ship-block if Must-tier untested rows > 0.
