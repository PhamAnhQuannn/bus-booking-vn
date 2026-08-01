CODE REVIEW — PR #401 "ci: gate Python syntax — no CI job has ever read a .py file" @ `0d662787`
────────────────────────────────────────────────────────────────────────────────
Diff scope: 2 files, +104 / −0
Base: `master` · Head: `ci/python-syntax-gate` · State: OPEN, not draft
Reviewed read-only via `gh pr diff` + `git show <ref>:<path>`. No checkout, no install.
Empirical verification run in scratchpad `…\Temp\claude\D--Bus-Booking\pr401\`, never in the repo.

## Verification actually performed (not inferred)

The PR body was written by an AI agent with a track record of false claims this session, so
every checkable assertion in it was re-run rather than accepted. Local interpreter is
**Python 3.14.4**; CI pins **3.12**, so version-sensitive results are flagged where relevant.

| PR body / docstring claim | Verdict | Evidence |
|---|---|---|
| `master` carries 6 `.py` scripts | **TRUE** | `git ls-tree -r origin/master` → exactly 6, all under `scripts/` |
| `master`'s `ci.yml` references `python` zero times | **TRUE** | `grep -ic python` on `origin/master:.github/workflows/ci.yml` → `0`; `ci.yml` is the only workflow |
| clean tree → `OK -- 7 file(s) parsed`, exit 0 | **TRUE** | reproduced byte-for-byte against master's 6 + the checker |
| injected orphaned continuation → `FAIL`, exit 1, correct `file:line`, `'(' was never closed` | **TRUE** | reproduced verbatim: `pkg\probe.py:1: '(' was never closed`, exit 1 |
| tree containing only the checker → `FAIL`, exit 1 (zero-guard reachable) | **TRUE** | reproduced; guard fires, exit 1 |
| probe removed → `OK` again, exit 0 | **TRUE** | reproduced |
| "would NOT have caught" the 2026-07-29 semantic `sweep_monan.py` break | **TRUE, and correctly scoped** | that break was an output-shape change; `ast.parse` is blind to it by construction |
| catches the recorded line-oriented-regex breakages | **PARTLY — see P3-5** | 3 of the 4 recorded shapes caught; one recorded instance is not a syntax error at all |
| stdlib only, no `pip install` | **TRUE** | imports are `ast`, `pathlib`, `sys` |

Additional measurements taken:

- **All 48 `.py` files reachable in this checkout** (master's 6 + the 39 tourism scripts on the
  unmerged `feat/tourism-kb-scripts` branch + 2 untracked scratch scripts) parse cleanly, and
  **every one of them parses at `feature_version=(3,7)`** — so the `python-version: '3.12'` pin
  is comfortably above the floor for both the current 6 and the 39 arriving with PR #399.
  No BOMs, no PEP 263 coding cookies, no non-UTF-8 bytes anywhere in the current tree.
- Runtime: **0.18 s** for 8 files; a full 48-file scan is not measurably different. CI cost is
  one runner slot for checkout + `setup-python` + a sub-second command.
- The four failure shapes recorded in `CLAUDE.md` were reconstructed as fixtures and fed to the
  checker. Results: orphaned continuation → `unterminated string literal`; mangled f-string →
  `f-string: single '}' is not allowed`; heredoc-collapsed `\n` inside a string literal →
  `unterminated string literal`; heredoc-collapsed `\n` inside an f-string →
  `unterminated f-string literal`. **All four caught, all with correct `file:line`.**

────────────────────────────────────────────────────────────────────────────────

PRIORITY 1 — Block merge, fix first:

  **None.**

  Specifically: no security surface (no network, no `exec`, no subprocess, no secrets, no
  writes — the script reads files and prints), no money/auth/data-loss path, and no match
  against any `CLAUDE.md` Mistake Log pattern. The #333 pattern ("prove a gate fires before
  trusting a green result") is *complied with*, not violated — the PR proves it fires and I
  independently reproduced every row of that proof.

────────────────────────────────────────────────────────────────────────────────

PRIORITY 2 — Fix before merge:

  **[CORRECTNESS / FALSE POSITIVE] scripts/audit/python-syntax.py:59**

    `source = path.read_text(encoding="utf-8")` rejects two file shapes that CPython itself
    accepts and executes, so the gate red-lines CI on a *valid* file — with a misleading
    diagnostic in both cases. Both reproduced:

      pkg\bom.py:1: invalid non-printable character U+FEFF     ← file has a UTF-8 BOM
      pkg\latin.py: unreadable -- 'utf-8' codec can't decode…  ← file has `# -*- coding: latin-1 -*-`

    Confirmed both fixtures run correctly under `python <file>` (exit 0). A UTF-8 BOM in a
    `.py` file is legal Python; a PEP 263 coding cookie is legal Python. The checker calls the
    first a syntax error and the second "unreadable".

    This is **fail-closed**, not fail-open — nothing bad gets through, CI just goes red on a
    good file. But it is a live hazard rather than a theoretical one on *this* box: the
    PowerShell tool in this environment documents that `>`, `>>` and `Out-File` "usually
    default to UTF-8 (with BOM)". An agent that writes or rewrites a `.py` file through
    PowerShell redirection produces exactly `bom.py`, and the resulting CI failure points at
    "invalid non-printable character U+FEFF" on line 1 of a file that runs fine locally.

    Fix (one line, verified working on all three fixtures):

        ast.parse(path.read_bytes(), filename=str(path))

    `ast.parse` on `bytes` runs CPython's own encoding detection — it strips the BOM and honours
    the coding cookie, which is precisely the behaviour the interpreter has. Verified: BOM file
    OK, latin-1 file OK, plain file OK. This also makes the `UnicodeDecodeError` arm of the
    `except` at :60 unnecessary (keep `OSError`).

  **[CORRECTNESS / COVERAGE GUARANTEE] scripts/audit/python-syntax.py:47 and :52**

    The gate's whole value proposition is "every `.py` file is parsed", but the file set is a
    filesystem glob rooted at `self_path.parents[2]` — a positional magic index with no
    assertion that it landed on the repo root — and it is never cross-checked against git.
    Three consequences, in descending likelihood:

    (a) **Local/CI divergence, live today.** The docstring at :2 says "every **tracked** .py
        file"; the code globs the working tree. Right now that means the local run checks
        `scripts/hero-logo.py` and `scripts/hero-verify.py` (untracked, invisible to CI) — so a
        green local run and a green CI run are checking different sets. More seriously,
        `.claude/` is gitignored and **not** in `SKIP_PARTS`, and `.claude/worktrees/` exists in
        this checkout. The moment any agent creates a worktree there, `python
        scripts/audit/python-syntax.py` walks a second full copy of the repo and reports
        failures against another branch's files. The PR body advertises the script as
        "Runnable locally" — that is the mode this breaks.

    (b) **Silent undercount → the only genuine fail-open path.** `pathlib`'s `**` swallows
        traversal `OSError`s and does not descend into symlinked directories. An entire subtree
        can therefore drop out of the scan and the run still prints `OK -- N file(s) parsed`
        and exits 0, with nothing indicating `N` is short. The `others == 0` guard proves
        "at least one file", not "the expected files" — which is #333 relocated one level up
        rather than eliminated. (Not reachable on a fresh CI checkout; reachable locally.)

    (c) **Silent root drift.** `parents[2]` is load-bearing and unasserted. If the script is
        ever moved one directory up (`scripts/python-syntax.py`), `root` becomes the *parent of
        the checkout*: on CI that is `/home/runner/work/<repo>/`, which still contains only the
        repo, so **CI stays green**; locally on Windows it becomes `D:\` and the script walks
        the whole drive. The failure is invisible in the only place that gates the merge.

    Fix — take the list from git, fall back to the glob only outside a repo:

        names = subprocess.run(["git", "-C", str(root), "ls-files", "*.py"], …)

    That single change makes the docstring's word "tracked" true, deletes (a) and (b), and
    makes `SKIP_PARTS` almost vestigial. Pair it with a cheap root assertion —
    `assert (root / "package.json").is_file()` or an explicit exit-1 — to close (c).
    If you prefer to keep the glob, at minimum add `.claude`, `.tourism-data`, `dist`,
    `build` and `coverage` to `SKIP_PARTS` and assert the root marker.

────────────────────────────────────────────────────────────────────────────────

PRIORITY 3 — Address when convenient:

  **[CI / VERSION DRIFT] .github/workflows/ci.yml:379**

    `actions/setup-python@v5` is **two majors behind**; `gh api repos/actions/setup-python/releases/latest`
    returns `v7.0.0`. Every other action in this file tracks the latest major tag:
    `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`,
    `gitleaks/gitleaks-action@v3`. To correct the premise in the review brief: this repo has
    **no SHA-pinning convention at all** — it pins to moving major tags throughout — so the
    *form* `@v5` is consistent; the *number* is not. Bump to `@v7`.

    Related, optional: `ubuntu-latest` (24.04) already ships Python 3.12 with `python` on PATH,
    so the `setup-python` step is not strictly required. Keeping it is the better call — it
    makes the version explicit and deterministic instead of inheriting whatever the runner image
    happens to carry — but it is worth knowing the step is a choice, not a necessity.

  **[ACCURACY / DOCSTRING] scripts/audit/python-syntax.py:29-30**

    "A bare `checked == 0` guard could therefore never fire" is overstated. `path.parts` is
    **absolute**, so `SKIP_PARTS & set(path.parts)` tests the checkout's ancestors too. Placed
    the whole tree under a directory named `venv` and every file — including the script itself —
    was skipped: `checked` was 0, and a bare `checked == 0` guard would have fired. (The
    `others` guard fired instead; exit 1, fail-closed, correct behaviour either way.)

    The **code is right** — `others == 0` implies `checked <= 1`, so it is strictly the stronger
    guard — and the guard is genuinely reachable, which was the load-bearing claim. Only the
    stated rationale is too absolute. Worth correcting precisely because this docstring is
    lecturing about dead guards.

  **[ACCURACY / OVERCLAIM] scripts/audit/python-syntax.py:15-17 and the PR body**

    "the same session's mistake log records THREE separate Python breakages in one day from
    line-oriented regex edits orphaning continuation lines. Those are exactly what this catches."
    It is **two of the three**. `CLAUDE.md`'s 2026-07-28 entry names them: (1) regex
    line-deletion orphaning a continuation — caught, verified; (2) the `<<'PY'` heredoc rewriting
    `\n` into a real newline — caught, verified; (3) "the bulk string-replace missing
    `"[VERIFIED"` because the literal in the branch test lacked the colon I matched on" — that
    is a **silent no-op replace, not a syntax error**, and `ast.parse` cannot see it. (The
    2026-07-29 heredoc repeat is a genuine fourth instance, and it *is* caught.)

    The PR is otherwise scrupulous about scope — it volunteers that it would not have caught the
    defect that motivated it — which makes this one sentence stand out. Say "two of the three"
    and the whole document is accurate.

  **[FAILURE MODE] scripts/audit/python-syntax.py:65**

    Only `SyntaxError` is caught from `ast.parse`. Two other exception types are reachable:
    `RecursionError` on a deeply nested literal, and — on the pinned **3.12** — `ValueError:
    source code string cannot contain null bytes` (on my 3.14 that case is already a
    `SyntaxError` and was caught cleanly, reported as `pkg\nullbyte.py:0`, but the exception
    type changed between the two versions and CI runs the older one). Either escapes as an
    uncaught traceback: exit is still non-zero, so **not fail-open**, but the output has no
    `file:line` attribution and the scan aborts, leaving every later file unchecked.
    Widen to `except (SyntaxError, ValueError, RecursionError) as exc` and guard
    `getattr(exc, "lineno", 0)`.

  **[TEST COVERAGE] scripts/audit/python-syntax.py (new file, no test)**

    There is no re-executable test of the checker. The PR's verification table is honest and I
    reproduced all four rows — but it was run by hand, so a later edit to `SKIP_PARTS`, to the
    `others` guard, or to the root derivation can silently disarm the gate with nothing to
    notice. That is #333's failure mode moved up one level: the *rule* is proven, the *proof*
    is not automated.

    The repo has no Python test infrastructure (Vitest only), so standing up pytest for 88 lines
    would be disproportionate. Proportionate alternative: a `--self-test` flag that writes a
    broken fixture and a clean fixture to a temp dir, asserts exit 1 then exit 0, and is run as a
    second `run:` line in the same CI job. Cost: ~15 lines, zero new dependencies, and the proof
    then re-runs on every PR instead of living in a PR description.

  **[PROCESS] pre-commit hook not wired**

    The PR body raises this itself and asks. Feedback loop is currently CI-only: a broken `.py`
    is discovered after push. Measured cost of the full scan is **0.18 s**, which is noise next
    to the hook's existing `pnpm lint && pnpm tsc --noEmit`. Recommend adding it — but the P2
    coverage fix should land first, or the hook inherits the `.claude/worktrees` scanning
    problem and starts failing commits for reasons outside the developer's working tree.

────────────────────────────────────────────────────────────────────────────────

SUMMARY: 0 P1, 2 P2, 6 P3

## Direct answers

**Can the gate fail open?** — **No**, not on any path reachable in CI. Every problem the script
encounters terminates in exit 1: unreadable file → `failures` → 1; undecodable file → `failures`
→ 1; unparseable file → `failures` → 1; glob matched nothing but itself → guard → 1; checkout
path collides with `SKIP_PARTS` so *everything* is skipped → guard → 1 (verified by construction);
exception type outside the `except` clause → uncaught traceback → 1. There is no `continue` that
passes a real problem and still reaches `return 0`. The one theoretical fail-open is `pathlib`
silently swallowing directory-traversal errors and not descending into symlinked directories,
which can shrink the scanned set without any signal (P2, item b) — unreachable on a fresh CI
checkout, reachable locally.

This is a categorically different artifact from `scripts/audit/secret-scan-staged.sh`. That
script's failure was that its *detection* silently produced nothing while the *exit code* stayed
0; this one's guards all point the same direction as its exit code, and its zero-result case is
explicitly and correctly a failure.

**Will this pass on master's existing 6 `.py` files?** — **Yes. Verified by execution, not by
inspection.** Exported all 6 from `origin/master` into a scratchpad tree alongside the PR's
checker and ran it: `python-syntax: OK -- 7 file(s) parsed.`, exit 0 — matching the PR body's
claimed output exactly. All 6 also parse at `feature_version=(3,7)`, contain no BOM, no coding
cookie and no non-UTF-8 bytes, so the `3.12` pin is not a risk for them. The same holds for all
39 tourism scripts on the unmerged branch, so PR #399 will not red-line this gate either.
**This PR will not break `master` on merge.**

**Verdict: MERGE, with the two P2s as a same-day follow-up — or NEEDS-CHANGE if you want them
in this PR.**

The gate is sound, it demonstrably catches the failure class it claims, it exits 0 on the tree it
will be merged into, it costs under a second, and it is unusually honest about its own limits.
Neither P2 can break `master` or let a broken file through — one produces a false red on a file
shape not currently present anywhere in the tree, the other weakens a coverage guarantee that is
still stronger than the zero coverage it replaces. The `read_bytes()` fix is one line and I have
verified it against all three fixtures; the git-derived file list is roughly five. Both are small
enough that folding them in now is cheaper than tracking them.

RECOMMENDED NEXT STEPS:
  → Apply P2-1 (`ast.parse(path.read_bytes(), …)`) — one line, verified fix, removes a
    Windows-specific false-red that this environment actively manufactures.
  → Apply P2-2 (`git ls-files '*.py'` + root assertion) — makes the docstring's "tracked"
    true and stops `.claude/worktrees/` poisoning local runs.
  → Bump `actions/setup-python@v5` → `@v7` to match the file's own convention (P3).
  → Correct the two overclaims (P3-4, P3-5) in the docstring; the PR body inherits them on
    squash-merge and becomes the permanent commit message.
  → Consider `--self-test` so the "proved it fires" evidence re-runs instead of living in a
    PR description.
