# CODE REVIEW (ROUND 2) — PR #356 "fix(ci): G6 barrel-leak guard derives server-only domains dynamically (#348)" @ `898ab249`

────────────────────────────────
**Mode:** PR mode (standalone — no `/commit-split` chain, no PR comment posted)
**Head:** `898ab2498f6cae4d19458ef3a51fbf46d02f1107` (round-1 head was `55d70773`)
**Base:** `master`
**Diff scope:** 1 file, +85 / −8 lines — `scripts/audit/greppable-invariants.sh`
**Reviewed:** 2026-07-26
**Prior round:** `docs/qa/code-review-pr356-20260726.md` (2 P1, filed against `55d70773`)

---

## Empirical verification performed

Reviewed from a detached `git worktree` at the PR head (main working tree left on
`fix/333-no-cycle-resolver`, untouched). No `node_modules` was junctioned into the worktree.
Every probe file created was removed; the worktree ends at `git status --porcelain` = 0 lines.

| Experiment | Expected | Observed |
|---|---|---|
| Full script, clean tree | PASS / exit 0 | **PASS, 26 derived, exit 0**, 16.7s ✅ |
| Derived set echoed to log | visible | `derived server-only barrels (26): …` ✅ |
| `'use client'` + `@/lib/config` | FAIL | **FAIL**, exit 1 ✅ |
| `'use client'` + `@/lib/geo` | FAIL | **FAIL**, exit 1 ✅ |
| `'use client'` + `@/lib/ledger` + `@/lib/op` + `@/lib/trips` | FAIL | **FAIL** (all 3 listed), exit 1 ✅ |
| Forced-collapse derivation (marker grep neutered, `EXTRA` emptied) + live violation | FAIL on floor | **FAIL** `0 tainted domain(s), expected >= 20`, exit 1 ✅ |
| `tainted_count` via `wc -w` on empty `$tainted` under `set -u` | 0, no unbound error | **0**, clean ✅ |
| **Partial shrink**: `payment` dropped (grep exit-2 sim), live `@/lib/payment` violation | FAIL | **PASS, exit 0** ❌ **→ P1-3** |
| **`EXTRA_SERVER_ONLY` name drift**: `geo`→`geoRENAMED`, live `@/lib/geo` violation | FAIL | **PASS, exit 0** ❌ **→ P2-1** |
| Committed blob line endings (CRLF-on-Ubuntu risk) | LF | **0 × `0x0D` bytes — pure LF** ✅ non-issue |
| CI `Greppable Invariants` job @ head | pass | **pass, 8s** ✅ |

---

## Round-1 P1 disposition

### ✅ P1-1 (vacuous pass) — **RESOLVED**
The derived set is now echoed and floor-asserted. Forced total collapse produces
`FAIL  G6 barrel derivation collapsed: 0 tainted domain(s), expected >= 20` and exit 1 where
round 1 printed `PASS`. The early `return` on floor failure was checked: it skips only the
dead `BARRELS` build, the alternation, and the per-file scan — `FAILURES` is already
incremented, so the script still exits 1. Nothing load-bearing is skipped. **Correct.**

### ✅ P1-2 (`config` / `geo` untainted) — **RESOLVED**
Both are now tainted via `EXTRA_SERVER_ONLY` and both planted violations FAIL. The choice to
list them explicitly rather than add `import 'server-only'` to widely-imported modules is the
right call for this PR's scope and is documented inline at the list. **Correct.**

**However, the fix for P1-1 is incomplete in a way that partially reopens it — see P1-3.**

---

## PRIORITY 1 — Block merge, fix first

### [CORRECTNESS / VACUOUS-PASS — Mistake Log 2026-06-04 class] `scripts/audit/greppable-invariants.sh:203-211`

**A count floor is a proxy for the invariant, not the invariant. The check still passes
vacuously for any subset of up to 6 domains — including `payment` and `auth`.**

The floor only detects *total* collapse. `G6_MIN_TAINTED=20` against a live derivation of 26
leaves **6 domains of silent headroom**. The pass-1 loop greps each domain's subtree
*independently*, so a grep exiting 2 on one subtree (unreadable path, transient IO, a symlink
loop, a domain dir mid-`git mv`) drops exactly that one domain and nothing else.

Reproduced by simulating a grep exit-2 on `lib/payment` only, with a genuine violation on disk:

```
derived server-only barrels (25): account admin analytics audit auth booking catalog charter
core flags home jobs ledger notification onboarding op places reports security staff storage
ticketing trips config geo
PASS
EXIT=0
```

…while `components/__probe__/ProbePayment.tsx` contained:

```tsx
'use client';
import { createPaymentIntent } from '@/lib/payment';
```

**This is a regression in guarantee strength versus `master`.** On master the list was a
literal — `BARRELS="@/lib/auth @/lib/booking @/lib/payment @/lib/notification @/lib/admin
@/lib/onboarding"` — so those 6 were checked *unconditionally*; no derivation could drop them.
This PR makes coverage of all 26 (including those original 6) contingent on 37 greps each
succeeding, and the floor does not restore the lost guarantee. Net coverage is much broader,
but the *floor* of the guarantee on the money/auth path is now lower than master's.

This is the same vacuous-pass class as round-1 P1-1, narrowed from "all 26 can vanish" to
"any ≤6 can vanish, silently, including payment and auth".

**Fix:** assert the *names*, not the count. A required-set check is ~5 lines, subsumes the
floor entirely, and also closes P2-1 below:

```sh
local REQUIRED="auth booking payment notification admin onboarding ledger op trips config geo"
for name in $REQUIRED; do
  case " $tainted " in
    *" $name "*) ;;
    *) echo "FAIL  G6 derivation lost required server-only domain: $name"
       FAILURES=$((FAILURES + 1)); return ;;
  esac
done
```

Keep the count floor as a secondary signal if desired, but the named assertion is what actually
encodes "these must always be checked."

---

## PRIORITY 2 — Fix before merge

### [CORRECTNESS / FAIL-OPEN] `scripts/audit/greppable-invariants.sh:176-181`

**`EXTRA_SERVER_ONLY` fails OPEN when a domain name drifts.**

```sh
*) [ -f "lib/$name/index.ts" ] && tainted="$tainted $name" ;;
```

If a listed name no longer resolves to a barrel — a rename, a domain split, a move to
`lib/core/` — the `[ -f ]` guard silently evaluates false and the domain is dropped with **no
message**. Coverage disappears and the log line still reads plausible.

Reproduced by changing `geo` → `geoRENAMED` with a live `'use client'` + `@/lib/geo` import on
disk: derived count 25 (still ≥ floor), **G6 PASS, exit 0**.

This matters more than usual because `EXTRA_SERVER_ONLY` is now the **third** hand-maintained
domain list in the repo, alongside `LIB_DOMAINS` in `eslint.config.mjs` (35 entries vs the 37
`lib/*/index.ts` barrels that exist) and the `boundaries/elements` patterns. Three lists, three
independent drift surfaces, and this one is the only one that degrades without a diagnostic.

**Fix:** make the miss loud — `else echo "FAIL  EXTRA_SERVER_ONLY names a domain with no barrel:
$name"; FAILURES=$((FAILURES + 1))`. The named-required assertion in P1-3 also covers this if
`config` and `geo` are in `REQUIRED`.

### [CORRECTNESS / CONSISTENCY] `scripts/audit/greppable-invariants.sh:167`

**The round-2 criterion is under-applied — `lib/einvoice` meets it and was not added.**

The stated rationale for adding `config` is that `lib/config/env.ts` exports `getEnv()`, i.e.
`HOLD_SECRET` / `JWT_SECRET` / `SEPAY_API_KEY` / `DATABASE_URL`. But:

- `lib/einvoice/misaClient.ts:12` — `import { getEnv } from '@/lib/core/config';` — reaches the
  *same* secrets accessor, and `lib/einvoice` imports neither `server-only` nor `@/lib/core/db`,
  so the marker scan cannot see it either. It is untainted, and `'use client'` +
  `@/lib/einvoice` passes the guard today. This is a money/PII-adjacent domain (invoice issuance,
  MISA provider credentials).
- `lib/ratelimit/index.ts` reads `process.env.UPSTASH_REDIS_REST_TOKEN` / `REDIS_URL` directly
  and is likewise untainted.

Either add `einvoice` (and consider `ratelimit`) to `EXTRA_SERVER_ONLY`, or narrow the inline
comment so it does not read as a general "exposes secrets ⇒ listed" rule that the list does not
actually implement. A criterion applied to 2 of 4 qualifying domains invites the next reader to
assume the scan is complete.

---

## PRIORITY 3 — Address when convenient

### [HYGIENE / DEAD CODE] `scripts/audit/greppable-invariants.sh:157, 213`
`BARRELS` is built (`for name in $tainted; do BARRELS="$BARRELS @/lib/$name"; done`) and then
**never read** — `alt` is derived from `$tainted` directly at line 219. The `barrel` loop
variable declared at line 157 is likewise unused after the inner loop was collapsed. Both are
leftovers from the pre-alternation shape introduced by this PR. Delete both.

### [PERF / DEAD CODE] `scripts/audit/greppable-invariants.sh:183-194`
The pass-2 fixpoint is O(untainted × tainted) process spawns — ~11 × 26 = 286 greps per
iteration, ≥ 2 iterations — and the PR body itself concedes it promotes **0 of 37** domains.
Confirmed: only `lib/ratelimit/index.ts` contains any `from '@/lib/…'` in a barrel, and it
imports `@/lib/logger`, which is not a `lib/*/index.ts` domain. Either delete pass 2 or fix its
detection (it reads only `index.ts` and requires an exact closing quote, so it cannot see
`export * from '@/lib/x/deep'` or multi-line re-exports). Keeping provably-dead code inside a
guard is how the next reader concludes the closure is handled when it is not.

### [READABILITY / MISDIRECTING MESSAGE] `scripts/audit/greppable-invariants.sh:208`
> `The check cannot be trusted in this state — fix the derivation, do not lower the floor.`

Correct for the collapse case, **wrong** for the one realistic way this fires benignly: a
legitimate refactor that merges or removes domains until fewer than 20 are server-only. With 6
domains of headroom that is not far-fetched, and the message actively instructs the engineer
away from the correct action. Reword to distinguish the two cases, or drop the floor in favour
of the named assertion in P1-3 (which cannot fire spuriously).

### [CORRECTNESS / FALSE POSITIVE] `scripts/audit/greppable-invariants.sh:223`
`grep -v 'import type'` excludes only the statement-level form. The inline type modifier —
`import { getApprovalQueue, type ApprovalQueueOperator } from '@/lib/admin';` — does not contain
the substring `import type` and is therefore reported as a violation. Latent today (all such
sites are server components / route handlers, so the `'use client'` pre-filter excludes them),
but this PR expanded the barrel set 6 → 26, so the false-positive surface grew ~4×. A future
client component using the inline modifier gets a spurious CI failure.

### [COVERAGE GAP — pre-existing, carried from round 1] `scripts/audit/greppable-invariants.sh:227`
Dynamic `await import('@/lib/auth')` in a `'use client'` file is still undetected — the regex
anchors on `from '…'`. Unchanged by this PR; noting only so it is not lost between rounds.

---

## Cross-platform check (Ubuntu CI vs Windows Git Bash) — clean

Explicitly checked, no findings:
- Committed blob contains **0 × `0x0D`** bytes — pure LF. The `file(1)` report of "CRLF line
  terminators" is an artifact of `core.autocrlf=true` on the Windows checkout and does not reach
  `ubuntu-latest`. **This was investigated and disproved, not assumed.**
- Process substitution `< <(…)` keeps the `while` loop in the current shell, so `hits+=`
  accumulates correctly — verified empirically (probes produced hits).
- `wc -w | tr -d '[:space:]'` normalises Git Bash's leading-space output; both platforms yield a
  bare integer. Verified.
- `local` with multiple declarations, `case`/`esac` matching, `[[:space:]]`, `tr -s`, `grep -rqE`,
  `grep -rl --include -m1` — all GNU/bash-portable and present in both environments.
- Script runs 16.7s locally, 8s on CI. No timeout risk.

---

## SUMMARY: 1 P1, 2 P2, 5 P3

**Both round-1 P1s are genuinely fixed and empirically confirmed.** The new P1 is not a
regression *introduced* by the fix so much as the fix stopping short: the floor closes the
total-collapse hole but leaves a 6-domain partial-collapse hole that happens to include
`payment` and `auth`, which master covered unconditionally. Per the repo's own 2026-07-24
"Bug B round 3" rule — *re-run the adversarial review on the FIX, not just the original defect* —
this is exactly the residual the rule predicts.

## RECOMMENDED NEXT STEPS
  → Replace the count floor with a required-name assertion (P1-3). ~5 lines; subsumes P2-1.
  → Decide on `einvoice` / `ratelimit` (P2-2): add them, or narrow the comment's stated criterion.
  → Delete `BARRELS` + `barrel` (P3) — they are dead on arrival in this diff.
  → P3s otherwise can ride or defer.
