#!/usr/bin/env python3
"""Parse every tracked .py file and fail the build on any syntax error.

WHY THIS EXISTS
---------------
Nothing in CI has ever looked at a Python file in this repo. `pnpm lint` is
ESLint (JS/TS only), `pnpm tsc` is TypeScript, and the test runner is Vitest.
That left the .py files under scripts/ with no gate of any kind.

The cost was paid on 2026-07-29: a commit changed the output shape of
scripts/tourism/sweep_monan.py and broke three readers. `ast.parse` had been run
by hand on the changed file and passed, so "it parses" was mistaken for "it
works" and the break shipped. A syntax gate would not have caught that
particular defect -- it was semantic -- but it is the floor below which nothing
else can be built, and the same session's mistake log records THREE separate
Python breakages in one day from line-oriented regex edits orphaning
continuation lines. Those are exactly what this catches.

DESIGN NOTE -- why a zero-file result is a FAILURE
--------------------------------------------------
CLAUDE.md's 2026-07-25 entry (#333) records a lint gate that was inert for its
entire life: `import-x/no-cycle` silently walked an empty graph because an
extension setting excluded every .ts file, so "0 cycles" meant "the rule never
ran" rather than "the tree is clean". A gate that emits nothing is not evidence
of health.

So this script exits non-zero if it finds no files to check -- counting files
OTHER than itself. The self-exclusion matters: `root` is derived from this
file's own path, so the glob always matches at least this script. A bare
`checked == 0` guard could therefore never fire, which would have made it the
very thing this paragraph warns about. Verified by injecting a broken file and
watching the gate fail, then removing it and watching it pass.
"""

from __future__ import annotations

import ast
import pathlib
import sys

# Directories that are never ours to parse.
SKIP_PARTS = {"node_modules", "__pycache__", ".venv", "venv", ".git", ".next"}


def main() -> int:
    self_path = pathlib.Path(__file__).resolve()
    root = self_path.parents[2]
    failures: list[str] = []
    checked = 0
    others = 0

    for path in sorted(root.rglob("*.py")):
        if SKIP_PARTS & set(path.parts):
            continue
        checked += 1
        if path != self_path:
            others += 1
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            failures.append(f"{path.relative_to(root)}: unreadable -- {exc}")
            continue
        try:
            ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            where = f"{path.relative_to(root)}:{exc.lineno or 0}"
            failures.append(f"{where}: {exc.msg}")

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
