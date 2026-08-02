# REVIEW ROUND 2 — PR #399 @ `a2aa1dd`

**Base:** `master` (`85a3e50`) · **Head:** `feat/tourism-kb-scripts`
**Scope:** the delta since round-1 head `c9b240f7` — commits `32b5607`, `182dfe0`, `f3ab89c`, `a2aa1dd`
**Date:** 2026-08-01

Round 1 (`docs/qa/{code-review,pr-review,security-deep}-pr399-20260801.md`) found 4 P1 · 8 P2 · 5 P3
against `c9b240f7`. This pass reviews only what changed since, because the rest of the diff is
unmodified and re-reviewing it would produce the same report.

Roster unchanged. `.github/workflows/ci.yml` entering the diff does not newly trigger any
specialist: no `lib/**` domain dirs, no schema/auth/payment, no new route handlers or workers, no
migration or dependency change.

---

## Round-1 P1 findings — disposition

| # | Finding | Status |
|---|---|---|
| 1 | `.gitleaks.toml` path-allowlists `docs/qa/.*`, hiding a live +84 mobile in a public repo | **Fixed** — `32b5607` |
| 2 | `sweep_quanlyluhanh.py` disables TLS verification + bare-IP fallback | **Fixed** — `32b5607` |
| 3 | PR body carries five false claims | **Fixed** — body rewritten, every figure re-derived at `182dfe0` |
| 4 | Diff size 2× threshold | **Waived**, reason recorded in the body |

Security P2s from rounds 1: scanner reading the worktree (**fixed**), no PII pattern (**fixed**),
phones printed to stdout (**fixed**), `test_xep_hang.py` unwired (**fixed**).

Verified, not assumed:

- `grep -rhoE '\+84[35789][0-9]{8}' docs/ scripts/` → exactly four values, all allowlisted literals
  in `.gitleaks.toml`. The real number is gone from the tree.
- `grep -rnE '^\s*s\.verify\s*=\s*False|CERT_NONE|disable_warnings\(\)' scripts/` → one hit, and it
  is the prohibition text in a comment. Bare-IP grep → empty.
- gitleaks (Docker, this branch's config) → **no leaks** across `docs/`, `scripts/`, `.github/`.
- `python scripts/tourism/test_xep_hang.py` → `tat ca phep kiem dat.` · `python-syntax.py` → 54 files.
- New ignore rules hold in both directions: `docs/Huong-Dan-Da-Lat.md` and `docs/Nha-Hang-Da-Lat.md`
  ignored; `docs/qa/code-review-pr399-20260801.md` and `docs/work-inventory.md` still visible.

---

## New finding this round — found and fixed

### [PERF / SECURITY] `scripts/audit/secret-scan-staged.sh` — the round-1 fix made the hook ~3× slower than what it replaced

Switching from worktree to staged blob was correct, but it kept the original one-pass-per-pattern
shape, so `git show` ran once per pattern per file. Measured on this machine:

| | per file | 84-file commit |
|---|---|---|
| pre-PR (6 greps on disk) | ~162 ms | ~13 s |
| round-1 fix (8 × `git show` + 7 × `grep`) | ~533 ms | **~45 s** |
| round-2 fix (1 × `git show` + 1 × `grep`) | ~82 ms | **6.6 s measured on 81 files** |

`git show` spawns in ~43 ms and `grep` in ~27 ms here — Windows process creation dominates
everything else the script does.

This is filed as a security finding, not a performance one. **A pre-commit hook slow enough to
irritate is a hook that gets run with `--no-verify`, and at that point the gate is worth nothing.**
Shipping a 45-second hook would have been a slower way of removing it.

Fixed in `f3ab89c`: one read into a temp file, one `grep -oE` with every pattern in a single
alternation, and per-hit classification via shell `case` — no further spawns. Net result is faster
than the hook that existed before this PR while doing strictly more work (reads the index, carries
the PII pattern, reports unreadable staged paths instead of skipping them).

Behaviour was re-verified rather than assumed — 10 cases: Google/AWS/Slack/GitHub keys block; clean
file passes; unknown VN mobile blocks and prints the offending number; allowlisted fabricated
numbers pass; mixed file blocks naming only the unknown; a file with both a key and a phone reports
both categories from one scan; and staged-clean-with-dirty-worktree passes, which is possible only
if it genuinely reads the index.

---

## Two inert guards, caught before merge

Both were mine, both in the allowlist derivation, and each alone made the exemption list match
nothing while looking correct:

1. `sed 's/\\//g'` fails on Git-Bash — MSYS rewrites `//` into a Windows path before `sed` sees it,
   giving ``unterminated `s' command``. `SDT_GIA` was empty, so nothing was exempt.
2. With the list populated it still matched nothing: the pattern became `^(+84901230001|…)$`, and in
   ERE a `+` immediately after `(` is a repetition operator with no operand. grep matches nothing
   and **does not error**.

Same shape as the 2026-07-25 `import-x/no-cycle` lesson, arriving in shell: *a filter that silently
matches nothing is indistinguishable from a filter with nothing to match.* What caught both was the
test asserting an allowlisted value must **pass** — a suite that only checks "bad input blocks"
would have been green with a completely inert allowlist. Logged in `CLAUDE.md` (`a2aa1dd`).

---

## Self-inflicted P1, caught and fixed

Round 1's P1 read *"a report about a redaction re-published the value it redacted."* The three
round-1 reports then quoted that raw number **three times** while explaining why quoting it is the
defect. Found only because a `grep -rn` after masking the original still returned three hits, all
mine. Masked before those reports were ever committed. Rule recorded in `CLAUDE.md`.

---

## Still open — deliberately deferred, recorded in the PR body

- `scripts/tourism/README.md` documents 25 of 49 scripts; `YOUTUBE_API_KEY` and `.env.tourism.local`
  appear nowhere, and that README is the only route back to gitignored data
- `tour_sites_crawl.mts:28` asserts robots.txt compliance no code implements
- `csdl` sweeps parse responses with no status check; that host 403s today
- `--diff-filter=ACM` omits renames
- `documentation/design-specifications/DS-008-zalopay-adapter/README.md:342` trips
  `generic-api-key` — pre-existing on `master`, absent from every open PR diff, unaffected by this
  change (re-confirmed: still the only finding outside `docs/`/`scripts/`/`.github/`)

---

```
SUMMARY: 0 P1 · 0 new P2 · 0 new P3
```

All round-1 P1s are resolved or explicitly waived. The one regression introduced by the round-1 fix
was found by self-review, measured, fixed, and re-verified. **Clear to proceed to CI.**
