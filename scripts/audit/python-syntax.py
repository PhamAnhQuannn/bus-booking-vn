#!/usr/bin/env python3
"""Parse every tracked .py file and fail the build on any syntax error.

WHY THIS EXISTS
---------------
Nothing in CI has ever looked at a Python file in this repo. `pnpm lint` is
ESLint (JS/TS only), `pnpm tsc` is TypeScript, and the test runner is Vitest.
That left the .py files under scripts/ with no gate of any kind.

The cost was paid on 2026-07-29: a commit changed the output shape of
tourism-kb/code/sweep_monan.py and broke three readers. `ast.parse` had been run
by hand on the changed file and passed, so "it parses" was mistaken for "it
works" and the break shipped. This script would NOT have caught that -- it was a
semantic break, not a syntax error. Of the three Python breakages the mistake log
records from one day, it catches TWO: the regex line-deletion that orphaned a
continuation line, and the mangled f-string. The third was a string replace that
silently matched nothing, which no parser can see. This is the floor, not the
ceiling, and it is worth having only because the floor was missing entirely.

DESIGN NOTE -- why a zero-file result is a FAILURE
--------------------------------------------------
CLAUDE.md's 2026-07-25 entry (#333) records a lint gate that was inert for its
entire life: `import-x/no-cycle` silently walked an empty graph because an
extension setting excluded every .ts file, so "0 cycles" meant "the rule never
ran" rather than "the tree is clean". A gate that emits nothing is not evidence
of health.

So this script exits non-zero if the file list comes back holding nothing but
this script itself. That is reachable -- `git ls-files` can legitimately return
one entry, and a reviewer reproduced the guard firing by pointing the checker at
a tree containing only itself. The self-exclusion is what makes it meaningful:
the checker is always in its own file list, so a bare `checked == 0` test would
be weaker, though not strictly dead.

It also refuses to fall back to a filesystem walk when git is unavailable. A
fallback would be the fail-open path: it would quietly scan gitignored trees,
including the full repo copies under .claude/worktrees/.

KNOWN LIMIT -- untracked files are not checked
----------------------------------------------
Asking git means a brand-new .py is invisible until `git add`. In CI that costs
nothing: the runner checks out tracked files and nothing else, so coverage is
identical. Locally it means running this before staging a new file reports OK
without having looked at it. Accepted deliberately -- the alternative is scanning
gitignored worktrees, which is worse -- but worth knowing before trusting a local
green. Wiring this into the pre-commit hook (against the staged blob, as
scripts/audit/secret-scan-staged.sh intends to do) would close the gap.
"""

from __future__ import annotations

import ast
import pathlib
import subprocess
import sys


def tracked_py_files(root: pathlib.Path) -> list[pathlib.Path]:
    """Ask git, not the filesystem.

    An `rglob` walks whatever happens to be on disk. That is wrong twice over:
    `.claude/` is gitignored but would still be walked, and `.claude/worktrees/`
    holds entire second copies of this repository — so a developer with a worktree
    open would silently double every count. It also cannot see the difference
    between a file the project owns and a stray scratch file.

    `git ls-files` answers the question the docstring actually asks: every TRACKED
    .py file. A non-zero exit (not a repo, git missing) is a hard failure rather
    than a silent fallback to the glob -- see the note about fail-open above.
    """
    out = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--", "*.py"],
        capture_output=True,
        check=True,
    ).stdout
    return [root / name.decode("utf-8") for name in out.split(b"\0") if name]


def main() -> int:
    self_path = pathlib.Path(__file__).resolve()
    root = self_path.parents[2]
    failures: list[str] = []
    checked = 0
    others = 0

    try:
        candidates = tracked_py_files(root)
    except (subprocess.CalledProcessError, FileNotFoundError, OSError) as exc:
        print(f"python-syntax: FAIL -- could not list tracked files via git: {exc}")
        print("  Refusing to fall back to a filesystem walk: it would scan")
        print("  gitignored trees (.claude/worktrees/ holds full repo copies).")
        return 1

    for path in sorted(candidates):
        if not path.is_file():
            continue  # tracked but deleted in the working tree
        checked += 1
        if path != self_path:
            others += 1
        try:
            # read_bytes, not read_text: ast.parse handles a UTF-8 BOM and a PEP 263
            # coding cookie itself, both of which CPython runs happily and
            # read_text(encoding="utf-8") rejects. That is not theoretical here --
            # PowerShell's `>` and Out-File default to UTF-8-WITH-BOM on this
            # project's primary platform, so any agent rewriting a .py through
            # redirection manufactures a file this script would have called broken.
            source = path.read_bytes()
        except OSError as exc:
            failures.append(f"{path.relative_to(root)}: unreadable -- {exc}")
            continue
        try:
            ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            where = f"{path.relative_to(root)}:{exc.lineno or 0}"
            failures.append(f"{where}: {exc.msg}")
        except ValueError as exc:
            # Source containing a null byte, and similar. Not a SyntaxError, but
            # not parseable either -- report rather than crash with a traceback.
            failures.append(f"{path.relative_to(root)}: not parseable -- {exc}")

    if others == 0:
        print("python-syntax: FAIL -- the glob matched only this script.")
        print("  A gate that checks nothing is not a passing gate. Either the")
        print("  glob broke or the tree moved; fix the script, do not silence it.")
        return 1

    if failures:
        print(f"python-syntax: FAIL -- {len(failures)} of {checked} file(s) did not parse.\n")
        for line in failures:
            print(f"  {line}")
        print("\n  Reminder: a line-oriented regex cannot see a multi-line Python")
        print("  construct. Edit whole constructs and re-parse BEFORE writing back.")
        return 1

    print(f"python-syntax: OK -- {checked} file(s) parsed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
