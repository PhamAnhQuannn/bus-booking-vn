# CODE REVIEW — PR #356 "fix(ci): G6 barrel-leak guard derives server-only domains dynamically (#348)" @ `55d70773`

────────────────────────────────
**Mode:** PR mode (standalone — no `/commit-split` chain, no PR comment posted)
**Head:** `55d707733d40fda6e952f88f189c3a75f9b13649`
**Base:** `master`
**Diff scope:** 1 file, +43 / −8 lines — `scripts/audit/greppable-invariants.sh`
**Reviewed:** 2026-07-26

---

## Empirical verification performed

This review is not static-only. The PR-head script was extracted to a scratchpad and executed
against the live working tree, and the derivation logic was instrumented and re-run standalone.

| Experiment | Result |
|---|---|
| Full script, clean tree (Git Bash / Windows) | **all G1–G6 PASS**, 0 failures, 20.7s wall |
| Domains enumerated (`lib/*/index.ts`) | **37** |
| Pass-1 tainted (server-only / `@/lib/core/db` marker) | **24** |
| Pass-2 fixpoint (barrel re-export closure) | **24** — added **zero** domains |
| `ledger` / `op` / `trips` (issue #348's named gaps) | **all three tainted** ✅ |
| Planted `'use client'` + `@/lib/ledger` | PR **FAIL** ✅ / master **PASS** ❌ |
| Planted `'use client'` + `@/lib/op` | PR **FAIL** ✅ / master **PASS** ❌ |
| Planted `'use client'` + `@/lib/trips` | PR **FAIL** ✅ / master **PASS** ❌ |
| Planted `'use client'` + `@/lib/config` | PR **PASS** ❌ (see P1-2) |
| Planted `'use client'` + `await import('@/lib/auth')` | PR **PASS** ❌ (pre-existing, P3-4) |
| Simulated empty derivation + live planted `@/lib/auth` violation | **G6 reports PASS** ❌ (see P1-1) |

All probe files were removed; the working tree is unchanged by this review.

**Verdict on the PR's core claim: substantiated.** The dynamic derivation genuinely widens
coverage from 6 → 24 barrels and genuinely catches the three domains #348 named. The findings
below are about what the derivation still cannot see, and about the guard's silent-failure mode.

---

## PRIORITY 1 — Block merge, fix first

### [CORRECTNESS / VACUOUS-PASS — Mistake Log class] `scripts/audit/greppable-invariants.sh:186-196`

The derived barrel set has **no non-empty floor assertion and is never echoed**. The alternation
regex is built unconditionally from whatever `$tainted` happens to contain:

```sh
alt=$(echo "$tainted" | tr -s ' ' '|' | sed 's/^|//;s/|$//')
...
barrel_hits=$(grep -nE "from ['\"]@/lib/(${alt})['\"]" "$f" ...)
```

If `$tainted` is empty, `alt` is empty and the pattern degenerates to
`from ['"]@/lib/()['"]` — an alternation containing only the empty branch, i.e. it matches the
literal string `@/lib/` with a closing quote and nothing else. Nothing in the repo matches, `hits`
stays empty, and **G6 prints `PASS`**.

Proven empirically: with the derivation forced to yield an empty set and a genuine live violation
planted (`components/__g6probe__/V.tsx` containing `'use client';` + `import { login } from
'@/lib/auth';`), the guard reported **`G6 REPORTS: PASS`**.

Three plausible triggers, none of which produce any diagnostic:

1. `for idx in lib/*/index.ts` has no `nullglob` — a barrel-convention change (`index.tsx`,
   `mod.ts`, barrels moved under `lib/<d>/public/`) makes the glob fail, `dirname` returns the
   literal `lib/*`, and `domains` becomes `*`.
2. The script runs `set -uo pipefail` **without `-e`** (pre-existing). Any `grep` exiting 2
   (permission / unreadable path / bad locale on a CI runner) silently contributes nothing to
   `$tainted` instead of aborting.
3. The taint markers themselves are string-coupled to today's conventions
   (`import 'server-only'`, `@/lib/core/db`). A future rename of `lib/core/db` → `lib/core/database`
   zeroes pass 1 outright.

This is precisely the defect class the PR exists to fix, relocated one level up: **the old guard
under-enumerated visibly (6 hardcoded names in the diff); the new guard can under-enumerate
invisibly.** It is the same shape as issue #333 (the `no-cycle` gate passing vacuously) and matches
the CLAUDE.md Mistake Log rule on dead-by-construction fallbacks — *auto-P1*.

**Fix:** after derivation, assert a floor and print the set. e.g.

```sh
echo "G6: derived ${count} server-only barrels: ${tainted}"
if [ "$count" -lt 6 ]; then
  echo "FAIL  G6 derivation collapsed (${count} < 6) — guard is not checking anything"
  FAILURES=$((FAILURES + 1)); return
fi
```
plus a hard `case " $tainted " in *" auth "*) ;; *) fail ;; esac` sentinel on 2–3 known-server
domains (`auth`, `payment`, `ledger`). A guard whose output is a bare `PASS` cannot be
distinguished from a guard that is broken.

---

### [SECURITY / SECRETS INTO CLIENT BUNDLE] `scripts/audit/greppable-invariants.sh:156-162` — `lib/config` is not tainted

The taint predicate is:

```sh
grep -rqE "import[[:space:]]+['\"]server-only['\"]|from[[:space:]]+['\"]@/lib/core/db" "lib/$name" \
  || [ -e "lib/$name/db/client.ts" ]
```

`lib/config` satisfies neither branch, so the derivation classifies it **client-safe**. But
`lib/config/index.ts` is:

```ts
export { getEnv } from './env';
```

and `lib/config/env.ts` is the Zod schema that declares `HOLD_SECRET`, `JWT_SECRET`,
`REFRESH_TOKEN_SECRET`, `SEPAY_API_KEY`, `DATABASE_URL`, and `ADMIN_BOOTSTRAP_PASSWORD` — its own
module docstring says verbatim:

> *"Call getEnv() from route handlers / server modules — **never from client bundles**."*

Verified: a planted `'use client'` file with `import { env } from '@/lib/config';` passes G6 green.

This is strictly worse than the 500-error class the guard was built for. The 2026-06-04 incident was
a crash — loud, and it self-announced within minutes. A `@/lib/config` barrel-import into a client
component is *silent*: it type-checks, it renders, and it ships secret material into a
browser-reachable chunk. The PR's stated goal is "derive the server-only barrel set" and this is a
server-only barrel the derivation blesses as safe.

Two transitive amplifiers, both currently untainted:
- `lib/observability/sentry.ts:21` → `import { getEnv } from '@/lib/config'`
- `lib/einvoice/misaClient.ts:12` → `import { getEnv } from '@/lib/core/config'` (MISA credentials)

**Fix:** widen the taint predicate beyond the two current markers — at minimum add
`from ['"]@/lib/(core/)?config['"]`, `process\.env\.`, `next/headers`, `next/server`, and `from 'pg'`
to the pass-1 alternation. Better: add `import 'server-only'` to `lib/config/env.ts` (and
`lib/geo/vnAdmin.ts`) so the marker-based derivation becomes *true* rather than approximately true —
the marker is the contract; domains that need it should carry it.

---

## PRIORITY 2 — Fix before merge

### [CORRECTNESS] `lib/geo` false negative — the barrel documents the very rule the guard enforces

`lib/geo/index.ts` opens with:

```
// SERVER-SIDE ONLY: vnAdmin statically imports a ~690 KB dataset. Do NOT import this
// barrel from 'use client' components — it would ship the whole tree into the browser
// bundle. Client code uses GET /api/geo instead (components/geo/AdminUnitPicker).
```

`geo` is **not** in the derived tainted set. The codebase states the constraint in prose, in the
exact file the guard reads, and the guard cannot see it. The old hardcoded list missed it too, so
this is not a regression — but a PR whose thesis is "stop hand-maintaining the list, derive it"
leaves a documented member of the set underived. Consequence is bundle bloat + hydration cost, not a
500, hence P2 rather than P1.

**Fix:** same as P1-2 — either widen the predicate or (cleaner) let a domain opt in explicitly, e.g.
honour a `// @g6-server-only` pragma anywhere in `lib/<d>/index.ts` as a third taint branch. That
gives `geo` and `config` a one-line, greppable, self-documenting way to join the set.

### [CORRECTNESS] `scripts/audit/greppable-invariants.sh:170-181` — fixpoint is asymmetric and currently a no-op

Pass 1 scans a domain's **whole subtree** (`grep -r "lib/$name"`). Pass 2 scans **only the barrel**:

```sh
if grep -q "from ['\"]@/lib/$t['\"]" "lib/$name/index.ts" 2>/dev/null; then
```

So a domain whose barrel re-exports `./foo` where `foo.ts` imports a tainted barrel never gets
tainted — the taint stops at the file boundary that pass 1 would have crossed. Concrete instance in
tree today: `lib/einvoice/index.ts` re-exports `./misaClient`, and `misaClient.ts:12` imports
`@/lib/core/config` (from tainted `core`); `einvoice` stays untainted.

Second narrowing: the pattern requires an exact `@/lib/<t>` **with closing quote**, so a barrel
re-exporting a *deep* path of a tainted domain (`from '@/lib/payment/types'`) also does not
propagate.

Measured effect: pass 2 promotes **0 of 37** domains today (24 → 24). A fixpoint loop that has never
fired is untested code guarding a security boundary — the CLAUDE.md "dead-by-construction fallback"
smell. It is not wrong, but it is unexercised, so its correctness is asserted rather than
demonstrated.

**Fix:** make pass 2 scan the subtree like pass 1 (`grep -rq ... "lib/$name"`) and drop the closing
quote from the pattern (`@/lib/$t['\"/]`). Re-measure; if it still promotes zero, say so in the
comment so the next reader knows it is inert by measurement rather than by accident.

### [TEST COVERAGE — Cat 4] No committed planted-violation regression test

The diff is **1 file, 0 tests**. The PR body reports a manual synthetic check
(`components/__g6probe__/Probe.tsx` importing `@/lib/ledger`), and that check is real — I reproduced
it and it does fail as claimed. But nothing in the repo re-runs it. `grep -rn "greppable"` returns
only `.github/workflows/ci.yml:340`; there is no spec, no fixture, no self-test.

The whole PR is 43 lines of new derivation logic whose only consumer is a CI gate whose only failure
mode is a false negative. Shipping it with zero executable proof that it still catches anything is
the gap that lets P1-1 sit undetected indefinitely.

**Fix:** a `--self-test` flag on the script (write a temp `'use client'` file importing `@/lib/auth`
under a scratch dir, assert G6 exits non-zero, remove it, assert G6 exits zero), invoked as a second
CI step. That single addition also closes P1-1 for the common case.

---

## PRIORITY 3 — Address when convenient

### [HYGIENE / DEAD CODE] `scripts/audit/greppable-invariants.sh:167,153` — `BARRELS` and `barrel` are written but never read

The diff keeps

```sh
for name in $tainted; do BARRELS="$BARRELS @/lib/$name"; done
```

and declares `local ... barrel ... BARRELS=""`, but the alternation-regex rewrite means neither is
ever consumed — `alt` is built independently from `$tainted` on the next line. Both are residue from
the per-barrel loop this PR deleted. Cat 5 dead-code-in-same-diff.

**Fix:** delete the `BARRELS` accumulation loop and both names from the `local` declaration.

### [CORRECTNESS / FALSE POSITIVE] `scripts/audit/greppable-invariants.sh:191` — multi-line type-only imports

`grep -v 'import type'` filters **per output line**, but a wrapped type import puts `from` on a line
that carries no `import type` marker:

```ts
import type {
  BookingQueueRow,
} from '@/lib/booking';
```

→ flagged as a violation. Pre-existing logic, but the barrel set just went 6 → 24, which multiplies
the surface fourfold. Not firing today (verified: full script PASSes clean), so P3.

**Fix:** `grep -v -e 'import type' -e '^\s*}\s*from'` is a cheap 80% mitigation; a `-B2` context
check is the correct one.

### [ROBUSTNESS] `scripts/audit/greppable-invariants.sh:154` — unguarded glob

`for idx in lib/*/index.ts` with no `shopt -s nullglob`. On a no-match the loop body runs once with
the literal pattern. Harmless in isolation; it is one of the three feeders into P1-1.

### [COVERAGE GAP] `scripts/audit/greppable-invariants.sh:194` — `lib/**` not scanned for `'use client'`

The client-file discovery is `grep -rl ... app/ components/`. `lib/utils/useReducedMotion.ts` is a
`'use client'` module living outside both. Pre-existing scope decision; worth stating now that the
guard knows the full domain graph and could cheaply cover `lib/` too.

### [COVERAGE GAP] dynamic imports not matched

`await import('@/lib/auth')` in a `'use client'` file is not caught by either version (the pattern
is anchored on `from`). Verified with probe `P5.tsx` — both master and PR pass it. Pre-existing;
noting because the Mistake Log's 092b entry explicitly calls out dynamic `import('@/lib/x')`
specifiers as part of the same barrel-migration hazard.

---

## Shell portability — clean

Checked explicitly, since CI is `ubuntu-latest` (`.github/workflows/ci.yml:333-340`) and the dev
machine is Windows/Git Bash. **No portability defect found.**

- Shebang `#!/usr/bin/env bash`; CI invokes `bash scripts/audit/greppable-invariants.sh` — bash on
  both sides, so the process substitution `done < <(...)` and `local` are legitimate.
- `[[:space:]]`, `grep -rqE`, `grep -rl -m1`, `case`-glob matching, `tr -s`, `sed` usage are all
  POSIX/GNU-portable and behave identically under Git Bash's GNU grep and Ubuntu's.
- No `mapfile`, no `readarray`, no `${var,,}`, no associative arrays, no `realpath`, no GNU-only
  `sed -i` — nothing that splits between the two.
- Unquoted `$domains` / `$tainted` in `for` loops is deliberate word-splitting on names that are
  directory basenames; safe absent a space in a `lib/` dir name.
- **Empirically confirmed:** full script executes end-to-end on Windows Git Bash, exit 0, 20.7s —
  which also validates the PR's stated motive for collapsing the per-barrel loop (the old shape's
  ~2k process spawns are genuinely pathological on Windows).

---

## SUMMARY: 2 P1, 3 P2, 6 P3

**Recommendation: request changes.** The PR does what it says — coverage really is 6 → 24, and
`ledger`/`op`/`trips` really are caught now where master silently passed them. That is a real fix
and the direction is right. But it replaces a *visibly* incomplete list with an *invisibly*
fallible derivation, and ships no executable proof that the derivation still bites. P1-1 (floor
assertion + echo the derived set) and P2-3 (self-test) are the same fix from two angles and are
each a handful of lines.

## RECOMMENDED NEXT STEPS

→ Fix P1-1 first: echo the derived set and fail below a floor. Cheapest possible defense against
  the exact class this PR is a member of.
→ Fix P1-2 by adding `import 'server-only'` to `lib/config/env.ts` (and `lib/geo/vnAdmin.ts`) —
  fixes the derivation at the source rather than piling markers into the grep alternation, and
  makes the runtime bundler enforce it too.
→ Land P2-3 (`--self-test`) as a second CI step in the same PR; it is the planted-violation test the
  PR body describes, made permanent.
→ P2-1 / P2-2 / all P3 can ride this PR or defer to a follow-up on #348.
