# CODE REVIEW — PR #407 "chore(tourism): two guards so generated data cannot be pushed" @ `8934a33a`

**Mode:** PR · **Base:** `master` (`def1ad8`) · **Head:** `chore/tourism-output-guard`
**Diff scope:** 10 files, +339 / −9 · **Date:** 2026-08-01

Self-review of my own change. Two new files (`duong_dan_ra.py`, `test_duong_dan_ra.py`), five
builders touched by one line each, `G8` added to the CI invariants, one CI step, one `CLAUDE.md`
entry. Roster is `/code-review` + `/pr-review` — no `lib/**` domains, no schema/auth/payment, no
route handlers, no dependency change.

---

## PRIORITY 1

None.

---

## PRIORITY 2 — Fix before merge

### [DRIFT] `THU_MUC_CHO_PHEP` and `.gitignore` must agree, and nothing checks that they do

`duong_dan_ra.py:52` hardcodes the allowed roots:

```python
THU_MUC_CHO_PHEP = ("documentation/tourism", ".tourism-data")
TIEN_TO_DOCS = ("Huong-Dan-", "Diem-Den-", "Nha-Hang-", "Khach-San-")
```

The whole guarantee is *"the guard only permits paths that are gitignored"*. That is true today, but
it is true by coincidence of two lists agreeing — nothing enforces it. Add a root here without
adding it to `.gitignore` and the guard cheerfully permits writing a phone-number-bearing document
to a **tracked** location, which is the exact outcome it exists to prevent.

The module's own error message already tells the next person *"them luat vao .gitignore VA vao
THU_MUC_CHO_PHEP cung luc"* — but that is a comment, not a check, and this project's log is full of
comments that stopped being true. It is the same two-lists-must-agree shape as the 2026-07-30
renderer-drift entry.

Mitigating, and the reason this is P2 rather than P1: `G8` catches the consequence at commit time,
so the two layers genuinely cover each other. The drift would produce an untracked-but-permitted
file, then a failing CI check the moment anyone stages it.

**Fix — cheap, and it belongs in the test file that already exists:** assert that every entry in
`THU_MUC_CHO_PHEP`, and a representative `docs/` guide name, is actually ignored:

```python
subprocess.run(["git", "check-ignore", "-q", p])  # returncode 0 == ignored
```

That turns "these two lists agree" from a comment into a test, and it fails loudly the moment
someone widens one side only.

---

## PRIORITY 3

### [ROBUSTNESS] `abspath`, not `realpath` — symlinks are not resolved

`_tuong_doi` (`duong_dan_ra.py:69`) uses `os.path.abspath` + `normpath`. That correctly handles `..`
traversal and absolute inputs — both covered by tests — but does **not** resolve symlinks. A symlink
at `.tourism-data/out` pointing at `docs/` would be accepted, and the write would land on the
tracked side.

Low severity on purpose: the writer here is our own build script, not an adversary, and nothing in
the repo creates such a link. Recorded because the fix is one word (`realpath`) and the reason not
to use it is not obvious — `realpath` also resolves the repo root, which on Windows can differ in
casing and would need `GOC` resolved the same way. Worth doing together or not at all.

### [PLATFORM] Case variants are rejected, which is the safe direction but a confusing failure

`rel.startswith("docs/")` is case-sensitive while Windows' filesystem is not. Measured:
`DOCS/Diem-Den-x.docx`, `.TOURISM-DATA/raw/x.json` and `Documentation/Tourism/x.md` are all
**rejected**, even though on this machine they name the same directories as the accepted forms.

Fail-closed is the right side of that trade — a case variant can never sneak *past* the guard. But
the error message will claim the path is "outside the ignored area" when it is arguably inside, and
that is the kind of message that gets a guard removed rather than understood. One sentence in the
rejection text would cover it.

### [COVERAGE] `G8` itself has no automated test

Each of its four checks was proven to fire by staging an isolating violation and observing the
FAIL — including re-running check 1 with a non-guide `.json` so it could not have been passing on
checks 2/3. But that was a manual pass; nothing re-proves it on future edits.

Not raised higher because it is **consistent with the file's existing design** — verified:
`grep -c "self.test|--self-test|selftest"` over `greppable-invariants.sh` returns **0**, so none of
G1–G7 has a self-test either. Introducing the pattern for G8 alone would be inconsistent; doing it
for all eight is its own change.

---

## Verified clean

- **Import order is correct in every builder.** `build_huong_dan.py:20` imports the guard,
  `:29`/`:30` use it. The other four follow the same shape. Proven functionally rather than by
  reading: all five refuse `docs/LEAK.md`, which is only possible if the import resolved.
- **The guard was proven in BOTH directions**, which is the point — a rejection-only test cannot
  distinguish a working guard from one that rejects everything. `test_duong_dan_ra.py` covers 23
  paths: 8 accepted (both data roots, all four `docs/` guide prefixes, the default `.md` target,
  the merged `.docx`), 15 rejected (the 8 measured committable paths, `..` traversal at one and two
  levels, out-of-repo, and absolute paths on both sides).
- **`kiem_loi_ra` is asserted to do both jobs** — exit 1 on a bad path *and* **return** the path on
  a good one, so `OUT = kiem_loi_ra(argv[2])` is safe to write inline. A guard that returned `None`
  on success would silently blank every output path.
- **The predicate is split from the exiting wrapper** (`duoc_phep` vs `kiem_loi_ra`), which is what
  makes it testable without spawning a process. This is the design that the `CLAUDE.md` entry in
  this same PR says I failed to use for half my own testing.
- **`GOC` derivation is right** — three `dirname` calls from `abspath(__file__)` land on the repo
  root, and it does not shell out to `git`, so the module works in a tarball or a worktree.
- **Writing to the repo root itself is rejected** — `_tuong_doi` returns `None` when the resolved
  path equals `GOC`.
- **`G8` queries the index, not the worktree.** `git ls-files` is the correct choice: every artefact
  is *expected* to exist on disk, so a worktree scan would fire constantly and be disabled within a
  day. The question asked is "could this be pushed".
- **`G8`'s pathspecs glob across directory levels** — confirmed by the `zzprobe/Nha-Hang-copy.md`
  probe firing from a directory that does not appear in any ignore rule.
- **No secrets, no PII, no injection sink, no network call, no new dependency.** The new module
  imports `os` and `sys` only.
- **Diff hygiene clean** — no `console.log`/`print` debugging, no commented-out code, no `.only`,
  no unrelated churn. The `G1-G6` → `G1-G8` header fix is a genuine correction, not churn: the
  header had been stale since G7 landed.

## Not reviewed

- Whether the Vietnamese comment prose is idiomatic — matches the surrounding files' register.
- Behaviour of the 6 `OUT = sys.argv[1]` sweeps and ~25 `RAW`-joining writers. Out of scope by
  declaration, stated in the PR body, and covered by `G8` at commit time.

---

```
SUMMARY: 0 P1, 1 P2, 3 P3
```

## RECOMMENDED NEXT STEPS

1. **Fix the P2 in this PR** — it is ~6 lines in a test file that already exists, and it converts
   the central assumption of the whole change ("permitted implies ignored") from prose into
   something that fails when it stops being true.
2. P3s can ride or defer; the symlink one should be done together with `GOC` or not at all.
