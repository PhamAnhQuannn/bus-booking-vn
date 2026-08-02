# CODE REVIEW — PR #399 "feat(tourism): Đà Lạt knowledge-base pipeline + PII-safe data boundary" @ `c9b240f7`

**Mode:** PR · **Base:** `master` · **Head:** `feat/tourism-kb-scripts`
**Diff scope:** 79 files, +21,399 / −758
**Date:** 2026-08-01

Re-review. The prior pass is `docs/qa/code-review-pr399-20260729.md`; **9 commits have landed
since**, including `a63f831`, `b2a4c45`, `8513958`, `9064b49` (2026-07-30) and `71b4fef`,
`45c9a50` (2026-08-01). This pass targets the delta plus the security-gate config the PR
introduces.

---

## PRIORITY 1 — Block merge, fix first

### [SECURITY / PII] `.gitleaks.toml:58` — the allowlist this PR indicts is left in place, and it is currently leaking a real-looking number from a PUBLIC repo

`docs/qa/.*` sits in the `[allowlist] paths` array. A gitleaks **path** allowlist skips the file
against *every* rule, including this repo's own `vn-mobile-number`
(`regex = '''\+84[35789]\d{8}'''`, `.gitleaks.toml:7-10`).

This PR adds a comment directly above it (`.gitleaks.toml:50-56`) that states the problem in its
own words — *"tourism QA reports began quoting live business phones and street addresses … and
the scanner stayed green the whole time because of this very line"* — and then **leaves the line
active while adding 21 more files under that path**. The comment documents the hole instead of
closing it. This is the CLAUDE.md 2026-07-30 pattern ("a comment explaining why a branch exists
is not evidence that it still runs") and the 2026-07-28 pattern ("an invariant comment asserting
something its own parenthetical contradicts"), so it is **auto-P1** per the Mistake-Log rule.

**The consequence is not hypothetical, and it is live right now.** `gh repo view` reports
`visibility: PUBLIC`, `isPrivate: false`:

```
docs/qa/code-review-pr124-20260622.md:81
  - Changed: hold created for +8490xxxxxx4 → hold created for +8490xxxxxxx
  - Context: QA run log entry, single real-looking phone masked
```

PR #124 correctly masked that number at its source — `docs/qa/traveler-smoke-2026-06-22.md:190`
now reads `hold created for +8490xxxxxxx`. **The report documenting the redaction re-published
the raw value.** It has survived since `c340cd9` (2026-06-25) solely because of the `docs/qa/.*`
path allowlist. Unlike the other four numbers in that tree it has no repeating-digit or
descending-sequence shape:

| Number | In `docs/qa` | Shape | Allowlisted by `regexes`? |
|---|---|---|---|
| `+84901230001` | `cross-persona-2026-06-22.md:4` | seed phone | yes — `:21` |
| `+84901234567` | `security-deep-pr399-20260729.md:409` | doc example | yes — `:16` |
| `+84909999999` | `code-review-pr124-20260622.md:41` | repeating 9s | no |
| `+84987654321` | `security-deep-pr399-20260729.md:249` | descending run | no |
| **`+8490xxxxxx4`** | **`code-review-pr124-20260622.md:81`** | **no pattern — plausibly real** | **no** |

**Compounding, and the reason this is P1 rather than P2:** the pre-commit scanner this PR adds
has **zero PII patterns** (see P2 below). So for everything under `docs/qa/**` there is **no PII
gate at either layer** — CI gitleaks skips the path, and the new hook has no rule that would
match. The PR's stated purpose is a "PII-safe data boundary".

**Fix** (all four steps, or the CI job goes red on removal):
1. Mask `code-review-pr124-20260622.md:81` → `+8490xxxxxx4`, matching the `+8490xxxxxx[N]`
   convention that CLAUDE.md requires (literal `x` cannot be consumed by `\d{8}`).
2. Add `'''+84909999999'''` and `'''+84987654321'''` to the `regexes` allowlist with a one-line
   justification each — these are genuinely fabricated and must stay readable.
3. Delete `'''docs/qa/.*'''` from `paths`. Its stated justification (the smoke scripts' seed
   phone) is **already covered** by the `regexes` entry at `:21`, which is global — so removing
   the path entry costs nothing it was actually buying.
4. Rewrite the `:50-56` comment to describe the closed state, not the open one.

> Note on scope: the leaked literal is on `master` and outside this diff. `.gitleaks.toml` is
> **inside** the diff, and this PR is the change that re-examines that allowlist. Fixing the
> config without removing the value it is currently exposing would ship a gate that passes only
> because the evidence is still hidden behind it.

---

## PRIORITY 2 — Fix before merge

### [SECURITY / GATE CORRECTNESS] `scripts/audit/secret-scan-staged.sh:22` — scans the worktree, not the staged blob

```sh
FILES=$(git diff --cached --name-only --diff-filter=ACM)   # :11 — staged path list
...
if grep -I -n -E "$pattern" "$f" >/dev/null 2>&1; then     # :22 — reads the WORKING TREE file
```

The path list comes from the index; the bytes come from the working tree. The two diverge
routinely:

- **False negative (the one that matters):** `git add config.ts` with a key → edit the file to
  remove the key → `git commit`. The scanner greps the clean worktree copy, passes, and the
  commit carries the secret. The hook's entire stated advantage over CI gitleaks is catching it
  *before* the commit exists.
- **False positive:** an unstaged secret in an otherwise-staged file blocks a clean commit with
  no way to see why from the message.

**Fix:** read the staged blob — `git show ":$f" | grep -I -n -E "$pattern"` — or scan
`git diff --cached -U0` once and drop the per-file loop entirely.

### [SECURITY / COVERAGE] `scripts/audit/secret-scan-staged.sh:29-36` — six API-key patterns, zero PII patterns

`AIza…` / `hf_…` / `sk-…` / `ghp_…` / `xox[baprs]-…` / `AKIA…`. Nothing matches a Vietnamese
mobile — the exact class that motivates the 50-line `.gitignore` rationale added by this same PR.

The PR body already concedes this ("Known gap, for the reviewer"), so this is confirmation
rather than discovery. It is P2 rather than P3 because of the composition with P1: `docs/qa/**`
is CI-exempt, making this hook the only possible gate there, and it has no rule that fires.

**Fix:** add `check '\+84[35789][0-9]{8}' 'Vietnamese mobile number'`, reusing the
`.gitleaks.toml:9` regex verbatim so the two gates cannot drift.

### [TEST / UNWIRED] `scripts/tourism/test_xep_hang.py` — 15 assertions ship, nothing runs them

The file is well-built: offline, zero-quota, zero-network, and it deliberately encodes the two
findings from the 2026-08-01 Mistake-Log entry — that Wilson barely penalises small `n` at high
`R` (`:28-30`), and that `co_varnames` must be sliced by `co_argcount` to inspect a signature
rather than locals (`:43-46`). It exits 1 on failure.

Nothing executes it. CI job 9 (`.github/workflows/ci.yml:377-390`) runs only
`python scripts/audit/python-syntax.py`, which `ast.parse`s every `.py` and asserts nothing about
behaviour. `grep -rn "test_xep_hang\|pytest\|unittest"` across `.github/workflows/`,
`package.json` and `scripts/audit/` returns nothing.

Per CLAUDE.md (2026-07-31): *"A stated acceptance test that the built artifact cannot exercise is
not a passing test, it is an absent one."*

**Fix:** append a step to the existing `python-syntax` job — no new job, no `pip install`, the
test is stdlib-only:
```yaml
      - name: Ranking unit tests
        run: python scripts/tourism/test_xep_hang.py
        env:
          PYTHONIOENCODING: utf-8
```

### [SECURITY / SCOPE] `scripts/audit/secret-scan-staged.sh:11` — `--diff-filter=ACM` omits renames

`R` is not in the filter, so `git mv secrets.ts config.ts` presents as a rename and is never
scanned. **Fix:** use `--diff-filter=ACMR`.

---

## PRIORITY 3 — Address when convenient

### [ROBUSTNESS] `scripts/audit/secret-scan-staged.sh:19` — unquoted `for f in $FILES` silently skips paths

Two ways a path is dropped without a word of output, because `[ -f "$f" ] || continue` (`:20`)
treats "cannot see this file" identically to "nothing to scan":

1. **Word splitting** — a path containing a space becomes two tokens, neither of which is a file.
2. **`core.quotepath`** — unset here, so it defaults true; `git diff --cached --name-only`
   emits non-ASCII paths in escaped-and-quoted form (`"scripts/t\341\273\225ng.py"`), which is
   not a real path either.

**Latent, not live:** `git ls-files | grep -cP '[^\x00-\x7F]| '` returns **0** today. Recorded
because this is a Vietnamese-language project actively generating Vietnamese filenames, and
because the failure is silent in the fail-open direction. **Fix:** `git diff --cached -z` with a
`while IFS= read -r -d ''` loop, or set `core.quotepath=false` and quote the expansion.

---

## Verified clean — checked and found no finding

Recording these so the next pass does not re-spend budget on them.

- **No injection sinks.** `grep -rn "subprocess\|os\.system\|shell=True"` over `scripts/tourism/`
  returns nothing. The one `exec(` hit is `RegExp.prototype.exec` in
  `tour_sites_crawl.mts:78`, not Python `exec`.
- **Every external call is bounded.** All 16 `urllib.request.urlopen` sites pass an explicit
  `timeout=` (30–240 s); both Playwright `page.goto` calls pass `timeout: NAV_TIMEOUT`. Verified
  the two multi-line calls individually (`enrich_diahinh.py:51`, `sweep_fsq.py:69`) — both
  carry it on the continuation line, which a single-line grep misses.
- **No credential is literal.** All keys resolve through `os.environ` with an
  `.env.tourism.local` fallback (`yt_chung.py:122`, `sweep_google_placeid.py:106`,
  `sweep_fsq.py:25`, `xep_hang_song.py:56`). `git check-ignore` confirms `.env.tourism.local` is
  covered by `.gitignore:37` (`.env*`).
- **The `re.M` claim in the shipped QA report is true.** `grep -rn "re\.M\|re\.MULTILINE" scripts/`
  returns zero — the 2026-07-28 line-regex-on-source class is genuinely absent.
- **The atomic-write remediation was actually applied**, not just logged. `yt_chung.py:58-69`
  implements temp-file + `os.replace`, and `enrich_mo_ta.py:282-291` uses the same shape. The
  remaining ~25 plain `json.dump(rows, io.open(OUT,"w"))` sites write derived data that is
  regenerable without spending metered quota, which is the boundary the CLAUDE.md rule draws
  ("for a file costlier to recreate than to write").
- **The ignore rules have nothing to fail to remove.** `git ls-files` is empty for
  `scripts/tourism/*.json`, `documentation/tourism`, `.tourism-data`, and `*.docx` — so no
  already-tracked file is silently unaffected by the new patterns.
- **No PII in the diff's own added lines.** The five phone-shaped literals are three placeholders
  quoted inside prose about placeholder detection, plus `0734985568` and `0920559476`, which are
  substrings of the Facebook page IDs `107349855685345` and `100092055947685` at
  `sweep_google_placeid.py` — traced to source, not numbers.
- **Ranking logic is sound.** `xep_hang.py` takes `(R, n)` only; `NGUONG` and `SAN_TOI_THIEU` are
  frozen module constants with no benchmark in the denominator, which is the corrected design
  from the 2026-08-01 Mistake-Log entry. `DUOI_CHUAN` vs `None` correctly separates *concluded
  below standard* from *insufficient evidence*.

## Not reviewed

- Prose accuracy of the 21 `docs/qa/**` reports carried by this PR (they document other PRs).
- Correctness of the Vietnamese-language guide content itself — not verifiable from the diff.
- Whether CI stays green after the P1 fix; removal of a gitleaks path allowlist must be
  confirmed by an actual run, not predicted.

---

```
SUMMARY: 1 P1, 4 P2, 1 P3
```

## RECOMMENDED NEXT STEPS

1. **Fix P1 in all four steps.** Masking the literal without removing the path entry leaves the
   gate blind; removing the path entry without allowlisting the two fabricated numbers turns CI
   red. Re-run CI and read the gitleaks job output rather than assuming the outcome.
2. Fix the worktree-vs-index bug and add the VN-mobile pattern to the hook — together they are
   what make the "PII-safe boundary" in the PR title true at the pre-commit layer.
3. Wire `test_xep_hang.py` into CI job 9. One step, no new dependency.
4. P3 can ride this PR or defer; it is latent at today's file inventory.
